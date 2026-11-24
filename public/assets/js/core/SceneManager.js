/**
 * Finite-state scene lifecycle manager.
 * Contract per scene: enter(), exit(), pause(), resume(), destroy()
 */
export class SceneManager {
  /**
   * @param {HTMLElement} stage
   * @param {import('/assets/js/core/EventBus.js').EventBus} bus
   * @param {object} ctx shared runtime context
   */
  constructor(stage, bus, ctx) {
    this.stage = stage;
    this.bus = bus;
    this.ctx = ctx;
    /** @type {Map<string, object>} */
    this.registry = new Map();
    /** @type {string|null} */
    this.currentId = null;
    /** @type {object|null} */
    this.current = null;
    this.transitioning = false;
    this.paused = false;
    this.startedAt = Date.now();
    /** Soft crossfade between scenes (ms) */
    this.fadeMs = 520;
  }

  /**
   * @param {string} id
   * @param {new (ctx: object, root: HTMLElement) => object} SceneClass
   */
  register(id, SceneClass) {
    this.registry.set(id, SceneClass);
  }

  elapsed() {
    return Date.now() - this.startedAt;
  }

  _fadeDelay(ms) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise((r) => setTimeout(r, reduced ? Math.min(160, ms) : ms));
  }

  /**
   * @param {string} id
   * @param {Record<string, unknown>} [payload]
   */
  async go(id, payload = {}) {
    if (!this.registry.has(id)) {
      console.error(`[SceneManager] unknown scene: ${id}`);
      return;
    }
    if (this.currentId === id && !payload.force) return;

    // Allow skip/HUD transitions to preempt an in-flight enter()
    if (this.transitioning) {
      this._pending = { id, payload };
      this.current?.ac?.abort?.();
      return;
    }

    this.transitioning = true;
    this._pending = null;
    this._gen = (this._gen || 0) + 1;
    const gen = this._gen;
    this.bus.emit('scene:will-change', { from: this.currentId, to: id, payload });

    const prev = this.current;
    const prevId = this.currentId;
    const prevRoot = prev?.root || null;
    const fade = this.fadeMs;

    try {
      if (prev) {
        this.ctx.audio?.stopVoice?.();
        this.ctx.audio?.stopAllSfx?.();
        // Start logical exit (abort timers) but keep DOM for fade-out
        await prev.exit?.();
      }

      if (gen !== this._gen) return;

      const SceneClass = this.registry.get(id);
      const root = document.createElement('section');
      root.className = 'scene is-entering';
      root.dataset.scene = id;
      root.setAttribute('aria-label', id);
      this.stage.appendChild(root);

      const scene = new SceneClass(this.ctx, root);
      this.current = scene;
      this.currentId = id;

      // Crossfade: old out + new in
      if (prevRoot) {
        prevRoot.classList.remove('is-active');
        prevRoot.classList.add('is-leaving');
      }

      // Force reflow then fade in
      void root.offsetWidth;
      root.classList.remove('is-entering');
      root.classList.add('is-active');

      this.bus.emit('scene:changed', { from: prevId, to: id, payload });
      // Sin ViewContent por cada escena (duplicaba /api/track + CAPI).
      // Las escenas ya emiten eventos propios (OfferViewed, ChatCompleted, etc.).

      // enter() can start during fade for snappier feel
      const enterPromise = Promise.resolve().then(() => scene.enter?.(payload));

      await this._fadeDelay(fade);

      if (prevRoot) {
        try {
          await prev.destroy?.();
        } catch {
          /* noop */
        }
        prevRoot.remove();
      }

      this.transitioning = false;
      await enterPromise;
    } catch (err) {
      console.error(`[SceneManager] failed entering ${id}`, err);
    } finally {
      if (gen === this._gen) {
        this.transitioning = false;
        const pending = this._pending;
        this._pending = null;
        if (pending && pending.id !== this.currentId) {
          await this.go(pending.id, pending.payload);
        }
      }
    }
  }

  async pause() {
    if (this.paused) return;
    this.paused = true;
    this.ctx.audio?.pause();
    await this.current?.pause?.();
    this.bus.emit('experience:paused');
  }

  async resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ctx.audio?.resume();
    await this.current?.resume?.();
    this.bus.emit('experience:resumed');
  }

  async destroy() {
    if (this.current) {
      await this.current.exit?.();
      await this.current.destroy?.();
      this.current.root?.remove();
    }
    this.current = null;
    this.currentId = null;
  }
}

/** Shared helpers for scene implementations */
export class BaseScene {
  /**
   * @param {object} ctx
   * @param {HTMLElement} root
   */
  constructor(ctx, root) {
    this.ctx = ctx;
    this.root = root;
    /** @type {AbortController} */
    this.ac = new AbortController();
    /** @type {number[]} */
    this.timers = [];
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** @returns {boolean} */
  get aborted() {
    return this.ac.signal.aborted;
  }

  /**
   * @param {number} ms
   * @returns {Promise<boolean>} true if completed without abort
   */
  wait(ms) {
    return new Promise((resolve) => {
      if (this.ac.signal.aborted) {
        resolve(false);
        return;
      }
      const id = window.setTimeout(() => {
        this.timers = this.timers.filter((t) => t !== id);
        resolve(!this.ac.signal.aborted);
      }, this.reducedMotion ? Math.max(400, Math.floor(ms * 0.6)) : ms);
      this.timers.push(id);
      this.ac.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(id);
          resolve(false);
        },
        { once: true }
      );
    });
  }

  /**
   * @param {() => void} fn
   * @param {number} ms
   */
  later(fn, ms) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      if (!this.ac.signal.aborted) fn();
    }, ms);
    this.timers.push(id);
    return id;
  }

  clearTimers() {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }

  async enter() {}
  async exit() {
    this.ac.abort();
    this.clearTimers();
  }
  async pause() {}
  async resume() {}
  async destroy() {
    this.ac.abort();
    this.clearTimers();
  }

  next(sceneId, payload = {}) {
    if (this.ac.signal.aborted) return Promise.resolve();
    return this.ctx.scenes.go(sceneId, payload);
  }
}
