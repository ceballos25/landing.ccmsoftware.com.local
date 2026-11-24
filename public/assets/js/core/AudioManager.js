import { EXPERIENCE } from '/assets/js/config/experience.js';

/**
 * Audio engine tuned for iOS Safari + Android Chrome.
 * Short SFX → Web Audio buffers (survive after the unlock gesture).
 * Long media (voice / music / cinematic track) → HTMLAudioElement.
 */
export class AudioManager {
  /**
   * @param {import('/assets/js/core/MediaLoader.js').MediaLoader} mediaLoader
   * @param {import('/assets/js/core/EventBus.js').EventBus} bus
   */
  constructor(mediaLoader, bus) {
    this.media = mediaLoader;
    this.bus = bus;
    this.unlocked = false;
    this.muted = false;
    this.master = EXPERIENCE.volumes.master;
    this.musicVol = EXPERIENCE.volumes.music;
    this.sfxVol = EXPERIENCE.volumes.sfx;
    this.voiceVol = EXPERIENCE.volumes.voice;

    /** @type {HTMLAudioElement|{_kind:string,paused:boolean,volume:number,loop:boolean,pause:Function,play:Function}|null} */
    this.currentMusic = null;
    /** @type {AudioBufferSourceNode|null} */
    this._musicSource = null;
    /** @type {GainNode|null} */
    this._musicGain = null;
    /** @type {HTMLAudioElement|null} */
    this.currentVoice = null;
    /** @type {Set<HTMLAudioElement>} */
    this.activeSfx = new Set();
    /** @type {AbortController|null} */
    this.voiceAbort = null;
    this._musicKey = null;
    /** @type {HTMLAudioElement|null} */
    this._unlockEl = null;
    /** @type {Map<string, HTMLAudioElement>} */
    this._layers = new Map();
    /** @type {HTMLAudioElement|null} */
    this._track = null;
    /** @type {Map<string, HTMLAudioElement[]>} HTMLAudio fallback banks */
    this._sfxBanks = new Map();
    /** @type {Map<string, AudioBuffer>} decoded WebAudio SFX */
    this._buffers = new Map();
    /** @type {Map<string, Promise<AudioBuffer|null>>} */
    this._decoding = new Map();
    /** @type {Set<{stop:()=>void}>} active buffer voices (loops/oneshots) */
    this._bufferVoices = new Set();
    /** @type {GainNode|null} */
    this._masterGain = null;
    /** @type {HTMLAudioElement|null} persistent voice element (Safari) */
    this._voiceEl = null;
    /** @type {boolean} true solo mientras una línea de voz debe sonar */
    this._voiceWanted = false;
    /** @type {Map<string, HTMLAudioElement>} */
    this._clickPool = new Map();
    this._clickIdx = 0;
  }

  _isIOS() {
    const ua = navigator.userAgent || '';
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  /**
   * Must be called from a click/tap handler.
   */
  async unlock() {
    if (this.unlocked) {
      await this._resumeCtx();
      return true;
    }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this._ctx = this._ctx || new Ctx();
        if (!this._masterGain) {
          this._masterGain = this._ctx.createGain();
          this._masterGain.gain.value = this.muted ? 0 : 1;
          this._masterGain.connect(this._ctx.destination);
        }
        if (this._ctx.state === 'suspended') {
          await this._ctx.resume();
        }
        // Tick silencioso: confirma el unlock del AudioContext en Safari
        this._silentTick();
      }

      // HTMLAudio unlock muted (no audible)
      const el = new Audio(
        EXPERIENCE.assets?.sfx?.typingClick || '/assets/audio/sfx/tecla-a.wav'
      );
      el.preload = 'auto';
      el.muted = true;
      el.volume = 0;
      el.setAttribute('playsinline', '');
      el.playsInline = true;
      this._unlockEl = el;
      try {
        await el.play();
      } catch {
        /* soft */
      }
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* noop */
      }

      // Solo marcar unlocked si el AudioContext quedó vivo (Safari WebAudio)
      const ctxOk = Boolean(this._ctx && this._ctx.state !== 'closed');
      if (!ctxOk) {
        console.warn('[AudioManager] unlock incomplete: no AudioContext');
        return false;
      }
      this.unlocked = true;
      await this._primeIntroSfx();
      this.bus.emit('audio:unlocked');
      return true;
    } catch (err) {
      console.warn('[AudioManager] unlock failed', err);
      // No mentir: sin contexto no hay SFX fiables en iPhone
      const ctxOk = Boolean(this._ctx && this._ctx.state === 'running');
      if (ctxOk) {
        this.unlocked = true;
        await this._primeIntroSfx();
        this.bus.emit('audio:unlocked');
        return true;
      }
      this.unlocked = false;
      return false;
    }
  }

  async _resumeCtx() {
    if (this._ctx?.state === 'suspended') {
      try {
        await this._ctx.resume();
      } catch {
        /* noop */
      }
    }
  }

  _silentTick() {
    if (!this._ctx) return;
    try {
      const buf = this._ctx.createBuffer(1, 1, this._ctx.sampleRate);
      const src = this._ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this._masterGain || this._ctx.destination);
      src.start(0);
    } catch {
      /* noop */
    }
  }

  /** Decode typing keys during filter gesture — no HTMLAudio mute storms. */
  async _primeIntroSfx() {
    const s = EXPERIENCE.assets?.sfx || {};
    const urls = [s.typingClick, s.typingClick2, s.typingClick3].filter(Boolean);
    await Promise.all(urls.map((u) => this._decodeBuffer(u)));
  }

  /** Decode call/chat (+ ringtone + VO) during CTA gesture — WebAudio survives iOS. */
  async _primeCallChatSfx() {
    const s = EXPERIENCE.assets?.sfx || {};
    const v = EXPERIENCE.assets?.voices || {};
    const urls = [
      s.vibration,
      s.callConnected,
      s.callEnded,
      s.waMessageIn,
      s.messageReceived,
      s.waNotification,
      s.notification,
      s.ringtone,
      // Decode VO aquí (sin play) → en Aceptar suena por buffer, sin “aló” filtrado
      v.clienteLlamada,
      v.clienteLlamadaPerdida,
    ].filter(Boolean);
    await Promise.all(urls.map((u) => this._decodeBuffer(u)));
    // Arranca decode del caos en background (no bloquea la llamada)
    this._primeChaosSfx().catch(() => {});
  }

  /** Bed + layers del caos (suspenso ~28s) — crítico en iPhone post-chat. */
  async _primeChaosSfx() {
    const s = EXPERIENCE.assets?.sfx || {};
    const c = EXPERIENCE.assets?.cinematic || {};
    const urls = [
      s.suspenso || c.suspenso,
      c.heartbeat,
      c.ambience,
      c.reverse,
      c.reverb,
      c.subBass,
      c.typeImpact,
      s.cinematicImpact,
      s.chaosStress,
      s.chaosStress2,
    ].filter(Boolean);
    await Promise.all(urls.map((u) => this._decodeBuffer(u)));
  }

  /** @deprecated */
  _primeCriticalSfx() {
    return this._primeIntroSfx();
  }

  /**
   * @param {string} url
   * @returns {Promise<AudioBuffer|null>}
   */
  async _decodeBuffer(url) {
    if (!url) return null;
    if (this._buffers.has(url)) return this._buffers.get(url) || null;
    if (this._decoding.has(url)) return this._decoding.get(url) || null;

    const job = (async () => {
      try {
        if (!this._ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          this._ctx = new Ctx();
          this._masterGain = this._ctx.createGain();
          this._masterGain.gain.value = this.muted ? 0 : 1;
          this._masterGain.connect(this._ctx.destination);
        }
        await this._resumeCtx();
        // no-cache: evita WAV viejos mudos en iPhone tras regenerar teclas
        const res = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const raw = await res.arrayBuffer();
        const copy = raw.slice(0);
        const buf = await this._ctx.decodeAudioData(copy);
        this._buffers.set(url, buf);
        return buf;
      } catch (err) {
        console.warn('[AudioManager] decode failed', url, err);
        return null;
      } finally {
        this._decoding.delete(url);
      }
    })();

    this._decoding.set(url, job);
    return job;
  }

  /**
   * Play a decoded buffer. Returns a handle with stop() for loops.
   * @param {string} url
   * @param {{volume?: number, rate?: number, loop?: boolean}} [opts]
   */
  _playBuffer(url, opts = {}) {
    const buf = this._buffers.get(url);
    if (!buf || !this._ctx || this.muted) return null;
    this._resumeCtx();

    try {
      const src = this._ctx.createBufferSource();
      src.buffer = buf;
      src.loop = Boolean(opts.loop);
      const rate = opts.rate ?? 1;
      src.playbackRate.value = Math.max(0.5, Math.min(2, rate));

      const gain = this._ctx.createGain();
      const vol = this._vol(opts.volume ?? this.sfxVol);
      gain.gain.value = vol;
      // Fade natural al final del buffer (no cortar el ataque: snap agresivo = mudo en iPhone)
      if (opts.snapMs && this._ctx && buf.duration > 0) {
        const now = this._ctx.currentTime;
        const dur = buf.duration / Math.max(0.5, Math.min(2, rate));
        const fade = Math.min(0.012, dur * 0.25);
        const hold = Math.max(0, dur - fade);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.setValueAtTime(vol, now + hold);
        gain.gain.linearRampToValueAtTime(0.0001, now + hold + fade);
      }
      src.connect(gain);
      gain.connect(this._masterGain || this._ctx.destination);

      const handle = {
        _kind: 'buffer',
        paused: false,
        ended: false,
        stop: () => {
          try {
            src.stop(0);
          } catch {
            /* noop */
          }
          handle.ended = true;
          this._bufferVoices.delete(handle);
          this.activeSfx.delete(/** @type {any} */ (handle));
        },
      };

      src.onended = () => {
        if (!opts.loop) {
          handle.ended = true;
          this._bufferVoices.delete(handle);
          this.activeSfx.delete(/** @type {any} */ (handle));
        }
      };

      src.start(0);
      this._bufferVoices.add(handle);
      this.activeSfx.add(/** @type {any} */ (handle));
      return handle;
    } catch (err) {
      console.warn('[AudioManager] buffer play failed', url, err);
      return null;
    }
  }

  /**
   * HTMLAudio bank (fallback / loops when buffer missing).
   * Does NOT audible-prime — only constructs elements.
   */
  _ensureSfxBank(url, count = 2) {
    if (!url) return;
    let bank = this._sfxBanks.get(url);
    if (!bank) {
      bank = [];
      this._sfxBanks.set(url, bank);
    }
    while (bank.length < count) {
      const el = new Audio(url);
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.playsInline = true;
      bank.push(el);
    }
  }

  /**
   * @param {string} url
   * @param {{loop?: boolean}} [opts]
   */
  _takeSfxEl(url, opts = {}) {
    if (opts.loop) {
      const el = new Audio(url);
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.playsInline = true;
      return el;
    }
    this._ensureSfxBank(url, 3);
    const bank = this._sfxBanks.get(url) || [];
    let el = bank.find((a) => a.paused || a.ended);
    if (!el) {
      el = new Audio(url);
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.playsInline = true;
      bank.push(el);
      this._sfxBanks.set(url, bank);
    }
    return el;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this._masterGain) {
      this._masterGain.gain.value = muted ? 0 : 1;
    }
    if (this._musicGain) {
      const v = muted ? 0 : this._musicTargetVol ?? this._vol(this.musicVol);
      this._musicGain.gain.value = v;
    }
    const list = [
      this.currentMusic,
      this.currentVoice,
      this._voiceEl,
      this._unlockEl,
      this._track,
      ...this.activeSfx,
      ...this._layers.values(),
      ...(this._clickPool ? this._clickPool.values() : []),
    ];
    for (const bank of this._sfxBanks.values()) {
      for (const el of bank) list.push(el);
    }
    for (const el of list) {
      if (el && 'muted' in el) el.muted = muted;
    }
    this.bus.emit('audio:mute', muted);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * @param {string} url
   * @param {{loop?: boolean, volume?: number, fadeIn?: number, oneshot?: boolean, rate?: number}} [opts]
   */
  async playSfx(url, opts = {}) {
    if (!url) return null;
    if (!this.unlocked) await this.unlock();
    await this._resumeCtx();

    this.media.preload(url, 'audio').catch(() => {});

    // WebAudio path — reliable on iOS after unlock (oneshots + short loops)
    if (!opts.loop || this._buffers.has(url)) {
      if (!this._buffers.has(url)) {
        // Best-effort decode if not primed (won't block forever)
        await Promise.race([
          this._decodeBuffer(url),
          new Promise((r) => setTimeout(r, 120)),
        ]);
      }
      if (this._buffers.has(url)) {
        const handle = this._playBuffer(url, opts);
        if (handle) return handle;
      }
    }

    // HTMLAudio fallback (ringtone loops, decode miss, etc.)
    const el = opts.oneshot ? new Audio(url) : this._takeSfxEl(url, opts);
    if (opts.oneshot) {
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.playsInline = true;
    }
    el.loop = Boolean(opts.loop);
    el.muted = this.muted;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* noop */
    }
    el.volume = this._vol(opts.volume ?? this.sfxVol);
    this.activeSfx.add(el);

    const cleanup = () => {
      this.activeSfx.delete(el);
    };
    el.addEventListener('ended', cleanup, { once: true });
    el.addEventListener('error', cleanup, { once: true });

    try {
      await el.play();
      if (opts.fadeIn) this._fade(el, 0, el.volume, opts.fadeIn);
    } catch (err) {
      cleanup();
      try {
        const retry = new Audio(url);
        retry.loop = Boolean(opts.loop);
        retry.volume = this._vol(opts.volume ?? this.sfxVol);
        retry.muted = this.muted;
        retry.setAttribute('playsinline', '');
        retry.playsInline = true;
        this.activeSfx.add(retry);
        await retry.play();
        return retry;
      } catch (err2) {
        console.warn('[AudioManager] sfx play failed', url, err2 || err);
        return null;
      }
    }
    return el;
  }

  /**
   * Typewriter keys — WebAudio first (Safari), HTMLAudio pool fallback.
   * @param {string|string[]} urlOrUrls
   * @param {{volume?: number, rate?: number}} [opts]
   */
  /**
   * Click sintético — siempre audible si el AudioContext está vivo (iPhone).
   * @param {number} [volume]
   */
  _playSynthClick(volume = 0.45) {
    if (!this._ctx || this.muted) return;
    this._resumeCtx();
    try {
      const t0 = this._ctx.currentTime;
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 1650 + Math.random() * 450;
      const vol = this._vol(Math.max(0.15, Math.min(0.7, volume))) * 0.28;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);
      osc.connect(gain);
      gain.connect(this._masterGain || this._ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.032);
    } catch {
      /* noop */
    }
  }

  playClick(urlOrUrls, opts = {}) {
    if (!this.unlocked || this.muted) return;
    const urls = (Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls]).filter(Boolean);
    const rate = opts.rate ?? 0.99 + Math.random() * 0.03;
    const volume = opts.volume ?? 0.55;

    if (urls.length) {
      const url = urls[this._clickIdx % urls.length];
      this._clickIdx += 1;
      if (this._buffers.has(url)) {
        this._playBuffer(url, {
          volume,
          rate: Math.max(0.98, Math.min(1.05, rate)),
          snapMs: 48,
        });
        return;
      }
      // Decode en background; este strike ya no espera (iOS no bloquea el teclado)
      this._decodeBuffer(url).catch(() => {});
    }

    // Garantía iPhone: si el WAV aún no está, suena click sintético
    this._playSynthClick(volume);
  }

  stopSfx(el) {
    if (!el) return;
    if (el._kind === 'buffer' && typeof el.stop === 'function') {
      el.stop();
      return;
    }
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* noop */
    }
    this.activeSfx.delete(el);
  }

  stopAllSfx() {
    for (const el of [...this.activeSfx]) {
      this.stopSfx(el);
    }
    for (const h of [...this._bufferVoices]) {
      h.stop();
    }
    if (this._clickPool) {
      for (const el of this._clickPool.values()) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* noop */
        }
      }
    }
  }

  _isMusicPlaying() {
    if (!this.currentMusic) return false;
    if (this.currentMusic._kind === 'buffer-music') return !this.currentMusic.paused;
    return !this.currentMusic.paused;
  }

  _setMusicVolume(vol) {
    const v = this.muted ? 0 : vol;
    if (this._musicGain) {
      try {
        this._musicGain.gain.setTargetAtTime(v, this._ctx.currentTime, 0.03);
      } catch {
        this._musicGain.gain.value = v;
      }
    }
    if (this.currentMusic && this.currentMusic._kind !== 'buffer-music') {
      this.currentMusic.volume = v;
    } else if (this.currentMusic) {
      this.currentMusic.volume = v;
    }
  }

  /**
   * Bed musical. Prefiere WebAudio loop (iPhone: HTMLAudio muere al dar play al <video>).
   * @param {string} url
   * @param {{fade?: number, volume?: number}} [opts]
   */
  async playMusic(url, opts = {}) {
    if (!url || !this.unlocked) return;
    await this._resumeCtx();

    const fade = opts.fade ?? 600;
    const targetVol = this._vol(opts.volume ?? this.musicVol);
    this._musicTargetVol = targetVol;

    if (this._musicKey === url && this._isMusicPlaying()) {
      this._setMusicVolume(targetVol);
      return;
    }

    await this.stopMusic(fade > 0 ? Math.min(fade, 120) : 0);
    this.media.preload(url, 'audio').catch(() => {});

    if (!this._buffers.has(url)) {
      await Promise.race([
        this._decodeBuffer(url),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
    }

    // WebAudio loop — convive con el video narrado en Safari/iOS
    if (this._buffers.has(url) && this._ctx) {
      try {
        const buf = this._buffers.get(url);
        const src = this._ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = this._ctx.createGain();
        const startVol = fade > 0 ? 0.0001 : this.muted ? 0 : targetVol;
        gain.gain.value = startVol;
        src.connect(gain);
        gain.connect(this._masterGain || this._ctx.destination);
        src.start(0);
        this._musicSource = src;
        this._musicGain = gain;
        this._musicKey = url;
        const self = this;
        const musicObj = {
          _kind: 'buffer-music',
          paused: false,
          loop: true,
          get volume() {
            return gain.gain.value;
          },
          set volume(v) {
            gain.gain.value = self.muted ? 0 : v;
          },
          pause() {
            try {
              src.stop(0);
            } catch {
              /* noop */
            }
            musicObj.paused = true;
          },
          play() {
            return Promise.resolve();
          },
        };
        this.currentMusic = musicObj;
        if (fade > 0 && !this.muted) {
          gain.gain.setValueAtTime(0.0001, this._ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, targetVol),
            this._ctx.currentTime + fade / 1000
          );
        }
        return;
      } catch (err) {
        console.warn('[AudioManager] webaudio music failed, HTMLAudio fallback', err);
      }
    }

    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.playsInline = true;
    el.volume = fade > 0 ? 0 : targetVol;
    el.muted = this.muted;
    this.currentMusic = el;
    this._musicKey = url;
    this._musicSource = null;
    this._musicGain = null;
    el.addEventListener('ended', () => {
      if (this.currentMusic !== el) return;
      try {
        el.currentTime = 0;
        el.play().catch(() => {});
      } catch {
        /* noop */
      }
    });

    try {
      const playP = el.play();
      if (fade > 0) {
        await playP;
        this._fade(el, 0, targetVol, fade);
      } else {
        playP.catch(() => {});
        el.volume = targetVol;
      }
    } catch (err) {
      console.warn('[AudioManager] music play failed', url, err);
    }
  }

  async stopMusic(fade = 400) {
    const el = this.currentMusic;
    const src = this._musicSource;
    const gain = this._musicGain;
    this.currentMusic = null;
    this._musicKey = null;
    this._musicSource = null;
    this._musicGain = null;
    if (!el && !src) return;

    if (src && gain && this._ctx) {
      try {
        if (fade > 0 && !this.muted) {
          gain.gain.cancelScheduledValues(this._ctx.currentTime);
          gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), this._ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, this._ctx.currentTime + fade / 1000);
          await new Promise((r) => setTimeout(r, fade));
        }
        src.stop(0);
      } catch {
        /* noop */
      }
      return;
    }

    if (!el || el._kind === 'buffer-music') return;
    await this._fade(el, el.volume, 0, fade);
    try {
      el.pause();
      el.src = '';
    } catch {
      /* noop */
    }
  }

  duckMusic(enable) {
    const target = enable
      ? this._vol(EXPERIENCE.volumes.duckMusicTo)
      : this._musicTargetVol ?? this._vol(this.musicVol);
    if (this._musicGain && this._ctx) {
      const v = this.muted ? 0 : Math.max(0.0001, target);
      try {
        this._musicGain.gain.cancelScheduledValues(this._ctx.currentTime);
        this._musicGain.gain.setTargetAtTime(v, this._ctx.currentTime, 0.05);
      } catch {
        this._musicGain.gain.value = v;
      }
      return;
    }
    const el = this.currentMusic;
    if (!el || el._kind === 'buffer-music') return;
    this._fade(el, el.volume, target, 250);
  }

  /**
   * @param {string} url
   * @param {{fallbackMs?: number, subtitle?: string, volume?: number}} [opts]
   * @returns {Promise<{ok: boolean, duration: number}>}
   */
  playVoice(url, opts = {}) {
    this.stopVoice();
    this.voiceAbort = new AbortController();
    const { signal } = this.voiceAbort;
    const fallbackMs = opts.fallbackMs ?? 4000;
    let settled = false;

    return new Promise(async (resolve) => {
      const done = (ok, duration) => {
        if (settled) return;
        settled = true;
        this._voiceWanted = false;
        this.duckMusic(false);
        this.bus.emit('subtitle:hide');
        this.currentVoice = null;
        resolve({ ok, duration });
      };

      if (signal.aborted) {
        done(false, 0);
        return;
      }

      if (!url) {
        window.setTimeout(() => done(false, fallbackMs), fallbackMs);
        return;
      }

      if (!this.unlocked) await this.unlock();
      else this._resumeCtx();
      if (signal.aborted) {
        done(false, 0);
        return;
      }

      if (opts.subtitle) this.bus.emit('subtitle:show', opts.subtitle);
      this._voiceWanted = true;
      this.duckMusic(true);

      // iPhone: VO por WebAudio si ya se decodificó en el CTA (sin HTMLAudio / sin filtrar)
      if (!this._buffers.has(url)) {
        await Promise.race([
          this._decodeBuffer(url),
          new Promise((r) => setTimeout(r, 80)),
        ]);
      }
      if (this._buffers.has(url) && this._ctx) {
        const buf = this._buffers.get(url);
        const handle = this._playBuffer(url, {
          volume: Math.min(1, (opts.volume ?? this.voiceVol) * 1.1),
        });
        if (handle) {
          this.currentVoice = {
            pause: () => handle.stop(),
            play: () => {},
            currentTime: 0,
            duration: buf?.duration || 0,
            _kind: 'buffer-voice',
          };
          const ms = Math.max(500, ((buf && buf.duration) || fallbackMs / 1000) * 1000);
          const timer = window.setTimeout(() => done(true, ms), ms);
          const onAbort = () => {
            window.clearTimeout(timer);
            handle.stop();
            done(false, 0);
          };
          signal.addEventListener('abort', onAbort, { once: true });
          return;
        }
      }

      // Fallback HTMLAudio (Android / si el decode falló)
      const el = new Audio();
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.playsInline = true;
      el.src = url;
      el.muted = this.muted;
      el.volume = this._vol(Math.min(1, (opts.volume ?? this.voiceVol) * 1.15));
      this._voiceEl = el;
      this.currentVoice = el;

      const onEnd = () => {
        cleanup();
        done(true, (el.duration || 0) * 1000 || fallbackMs);
      };
      const onErr = () => {
        cleanup();
        console.warn('[AudioManager] voice error', url);
        window.setTimeout(() => done(false, fallbackMs), Math.min(fallbackMs, 2000));
      };
      const onAbort = () => {
        cleanup();
        try {
          el.pause();
        } catch {
          /* noop */
        }
        done(false, (el.currentTime || 0) * 1000);
      };

      const cleanup = () => {
        el.removeEventListener('ended', onEnd);
        el.removeEventListener('error', onErr);
        signal.removeEventListener('abort', onAbort);
      };

      el.addEventListener('ended', onEnd, { once: true });
      el.addEventListener('error', onErr, { once: true });
      signal.addEventListener('abort', onAbort, { once: true });

      try {
        await el.play();
      } catch (err) {
        console.warn('[AudioManager] voice play blocked, retry', err);
        await this._resumeCtx();
        try {
          await el.play();
        } catch (err2) {
          console.warn('[AudioManager] voice play failed', url, err2);
          onErr();
        }
      }
    });
  }

  stopVoice() {
    if (this.voiceAbort) {
      this.voiceAbort.abort();
      this.voiceAbort = null;
    }
    this._voiceWanted = false;
    const els = [this.currentVoice, this._voiceEl].filter(Boolean);
    for (const el of els) {
      try {
        el.pause();
        el.currentTime = 0;
        // No envenenar muted/volume=0: en iOS el siguiente play() a veces hereda el mute
        el.removeAttribute('src');
        el.load();
      } catch {
        /* noop */
      }
    }
    this.currentVoice = null;
    this._voiceEl = null;
    this.duckMusic(false);
  }

  async stopAll({ fadeMusic = 300 } = {}) {
    this.stopVoice();
    this.stopAllSfx();
    const layerFade = fadeMusic <= 0 ? 0 : 80;
    const trackFade = fadeMusic <= 0 ? 0 : Math.min(fadeMusic, 120);
    await Promise.all([
      this.stopAllLayers(layerFade),
      this.stopTrack(trackFade),
      this.stopMusic(fadeMusic),
    ]);
  }

  /**
   * @param {string} id
   * @param {string} url
   * @param {{volume?: number, loop?: boolean, fadeIn?: number}} [opts]
   */
  async playLayer(id, url, opts = {}) {
    if (!id || !url) return null;
    if (!this.unlocked) await this.unlock();
    await this.stopLayer(id, 60);

    // Prefer buffer for short ambiences if decoded
    if (!this._buffers.has(url)) {
      await Promise.race([
        this._decodeBuffer(url),
        new Promise((r) => setTimeout(r, 80)),
      ]);
    }
    if (this._buffers.has(url) && opts.loop !== false) {
      const handle = this._playBuffer(url, {
        volume: opts.volume ?? 0.35,
        loop: true,
      });
      if (handle) {
        this._layers.set(id, /** @type {any} */ (handle));
        return handle;
      }
    }

    const el = new Audio(url);
    el.loop = opts.loop !== false;
    el.muted = this.muted;
    el.volume = 0;
    el.setAttribute('playsinline', '');
    el.playsInline = true;
    this._layers.set(id, el);
    this.activeSfx.add(el);
    try {
      await el.play();
      const target = this._vol(opts.volume ?? 0.35);
      this._fade(el, 0, target, opts.fadeIn ?? 400);
    } catch (err) {
      this._layers.delete(id);
      this.activeSfx.delete(el);
      console.warn('[AudioManager] layer play failed', id, err);
      return null;
    }
    return el;
  }

  async stopLayer(id, fade = 300) {
    const el = this._layers.get(id);
    if (!el) return;
    this._layers.delete(id);
    if (el._kind === 'buffer') {
      el.stop();
      return;
    }
    await this._fade(el, el.volume, 0, fade);
    try {
      el.pause();
      el.src = '';
    } catch {
      /* noop */
    }
    this.activeSfx.delete(el);
  }

  stopAllLayers(fade = 200) {
    const ids = [...this._layers.keys()];
    return Promise.all(ids.map((id) => this.stopLayer(id, fade)));
  }

  /**
   * Cinematic bed. Prefers WebAudio buffer (iOS after chat has no gesture).
   * Returns HTMLAudioElement OR a shim with currentTime / ended for cue sync.
   * @param {string} url
   * @param {{volume?: number, fadeIn?: number, hardCut?: boolean}} [opts]
   */
  async playTrack(url, opts = {}) {
    if (!url) return null;
    if (!this.unlocked) await this.unlock();
    await this._resumeCtx();
    await this.stopTrack(opts.hardCut ? 0 : 80);

    if (!this._buffers.has(url)) {
      await Promise.race([
        this._decodeBuffer(url),
        new Promise((r) => setTimeout(r, 10000)),
      ]);
    }

    // WebAudio path — no necesita gesto fresco (Safari)
    if (this._buffers.has(url) && this._ctx) {
      const buf = this._buffers.get(url);
      const handle = this.muted
        ? null
        : this._playBuffer(url, {
            volume: opts.volume ?? 0.85,
            loop: false,
          });
      // Aunque esté mute, devolvemos shim con reloj para que la escena visual corra
      if (handle || this.muted) {
        const ctx = this._ctx;
        const t0 = ctx.currentTime;
        const wall0 = performance.now();
        const dur = buf.duration;
        /** @type {Set<Function>} */
        const endedListeners = new Set();
        const shim = {
          _kind: 'buffer-track',
          _handle: handle,
          paused: false,
          get currentTime() {
            const viaCtx = ctx.currentTime - t0;
            if (Number.isFinite(viaCtx) && viaCtx >= 0) {
              return Math.min(dur, viaCtx);
            }
            return Math.min(dur, (performance.now() - wall0) / 1000);
          },
          set currentTime(_v) {},
          get duration() {
            return dur;
          },
          addEventListener(type, fn) {
            if (type === 'ended' && typeof fn === 'function') endedListeners.add(fn);
          },
          removeEventListener(type, fn) {
            if (type === 'ended' && fn) endedListeners.delete(fn);
          },
          pause() {
            try {
              handle?.stop?.();
            } catch {
              /* noop */
            }
            this.paused = true;
          },
          play() {
            return Promise.resolve();
          },
        };
        const remainMs = Math.max(0, (dur - Math.max(0, ctx.currentTime - t0)) * 1000);
        window.setTimeout(() => {
          for (const fn of endedListeners) {
            try {
              fn();
            } catch {
              /* noop */
            }
          }
        }, remainMs + 40);
        this._track = /** @type {any} */ (shim);
        return /** @type {any} */ (shim);
      }
    }

    // HTMLAudio fallback (Android / decode miss)
    const el = new Audio(url);
    el.preload = 'auto';
    el.loop = false;
    el.muted = this.muted;
    el.setAttribute('playsinline', '');
    el.playsInline = true;
    const target = this._vol(opts.volume ?? 0.85);
    const fadeIn = opts.fadeIn ?? 200;
    el.volume = fadeIn > 0 ? 0 : target;
    this._track = el;
    try {
      await el.play();
      if (fadeIn > 0) this._fade(el, 0, target, fadeIn);
      else el.volume = target;
    } catch (err) {
      console.warn('[AudioManager] track play failed', url, err);
      this._track = null;
      return null;
    }
    return el;
  }

  async stopTrack(fade = 400) {
    const el = this._track;
    this._track = null;
    if (!el) return;
    if (el._kind === 'buffer-track') {
      try {
        el._handle?.stop?.();
      } catch {
        /* noop */
      }
      return;
    }
    if (typeof el.volume === 'number') {
      await this._fade(el, el.volume, 0, fade);
    }
    try {
      el.pause();
      el.removeAttribute?.('src');
      el.load?.();
    } catch {
      /* noop */
    }
  }

  getTrackTime() {
    const t = this._track?.currentTime;
    return Number.isFinite(t) ? t : 0;
  }

  getTrack() {
    return this._track;
  }

  pause() {
    this.currentMusic?.pause();
    this.currentVoice?.pause();
    this._track?.pause();
    for (const s of this.activeSfx) {
      if (s && 'pause' in s && typeof s.pause === 'function' && s._kind !== 'buffer') {
        s.pause();
      }
    }
    this._ctx?.suspend?.().catch?.(() => {});
  }

  resume() {
    if (!this.unlocked) return;
    this._resumeCtx();
    this.currentMusic?.play().catch(() => {});
    // Solo reanudar voz si sigue “querida” (evita filtrar «aló» al volver de background)
    if (this._voiceWanted && this.currentVoice) {
      this.currentVoice.play().catch(() => {});
    }
    this._track?.play().catch(() => {});
    for (const s of this.activeSfx) {
      if (s && 'play' in s && typeof s.play === 'function' && s._kind !== 'buffer') {
        s.play().catch(() => {});
      }
    }
  }

  _vol(v) {
    return Math.max(0, Math.min(1, v * this.master));
  }

  /**
   * @param {HTMLAudioElement} el
   * @param {number} from
   * @param {number} to
   * @param {number} ms
   */
  _fade(el, from, to, ms) {
    return new Promise((resolve) => {
      if (!el || ms <= 0) {
        if (el && 'volume' in el) el.volume = to;
        resolve();
        return;
      }
      const start = performance.now();
      el.volume = from;
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        el.volume = from + (to - from) * t;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
}
