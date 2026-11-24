export class MediaLoader {
  constructor() {
    /** @type {Map<string, HTMLAudioElement|HTMLVideoElement>} */
    this.cache = new Map();
    /** @type {Map<string, Promise<boolean>>} */
    this.pending = new Map();
  }

  /**
   * @param {string} url
   * @param {'audio'|'video'} kind
   * @returns {Promise<boolean>}
   */
  preload(url, kind = 'audio') {
    if (!url) return Promise.resolve(false);
    if (this.cache.has(url)) return Promise.resolve(true);
    if (this.pending.has(url)) return this.pending.get(url);

    const promise = new Promise((resolve) => {
      const el = kind === 'video' ? document.createElement('video') : new Audio();
      el.preload = 'auto';
      if (kind === 'video') {
        /** @type {HTMLVideoElement} */ (el).muted = true;
        /** @type {HTMLVideoElement} */ (el).playsInline = true;
      }

      const finish = (ok) => {
        el.removeEventListener('canplaythrough', onOk);
        el.removeEventListener('error', onErr);
        this.pending.delete(url);
        if (ok) this.cache.set(url, el);
        resolve(ok);
      };

      const onOk = () => finish(true);
      const onErr = () => finish(false);

      el.addEventListener('canplaythrough', onOk, { once: true });
      el.addEventListener('error', onErr, { once: true });
      el.src = url;
      el.load();

      // Timeout so a slow asset never blocks the experience.
      window.setTimeout(() => {
        if (this.pending.has(url)) finish(this.cache.has(url));
      }, 8000);
    });

    this.pending.set(url, promise);
    return promise;
  }

  /**
   * @param {string[]} urls
   * @param {'audio'|'video'} kind
   */
  async preloadMany(urls, kind = 'audio') {
    const results = await Promise.allSettled(urls.map((u) => this.preload(u, kind)));
    return results.filter((r) => r.status === 'fulfilled' && r.value).length;
  }

  /**
   * @param {string} url
   */
  get(url) {
    return this.cache.get(url) ?? null;
  }

  release(url) {
    const el = this.cache.get(url);
    if (!el) return;
    el.pause?.();
    el.removeAttribute('src');
    el.load?.();
    this.cache.delete(url);
  }

  destroy() {
    for (const url of [...this.cache.keys()]) {
      this.release(url);
    }
    this.pending.clear();
  }
}
