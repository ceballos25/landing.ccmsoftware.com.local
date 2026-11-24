/**
 * Meta tracking:
 * - Pixel browser → solo PageView (tras consentimiento)
 * - Conversiones → /api/track.php → Conversions API (servidor)
 */
export class TrackingService {
  /**
   * @param {object} boot
   * @param {() => number} elapsedFn
   */
  constructor(boot, elapsedFn) {
    this.boot = boot || {};
    this.elapsedFn = elapsedFn;
    this.sessionId = this._id('s');
    this.consent = this._readConsent();
    this.queue = [];
    this.pixelReady = false;
    this.utm = this._parseUtm();
    this.fbclid = this._readFbclid();
    this.device = this._device();
  }

  _id(prefix) {
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  _parseUtm() {
    const q = new URLSearchParams(location.search);
    return {
      source: q.get('utm_source') || '',
      medium: q.get('utm_medium') || '',
      campaign: q.get('utm_campaign') || '',
    };
  }

  _readFbclid() {
    try {
      const q = new URLSearchParams(location.search);
      const id = q.get('fbclid');
      if (id) {
        sessionStorage.setItem('ccm_fbclid', id);
        return id;
      }
      return sessionStorage.getItem('ccm_fbclid') || '';
    } catch {
      return '';
    }
  }

  _cookie(name) {
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch {
      return '';
    }
  }

  _device() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Mobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  _readConsent() {
    try {
      const v = localStorage.getItem('ccm_consent');
      if (v === '1') return true;
      if (v === '0') return false;
    } catch {
      /* noop */
    }
    return !this.boot.requireConsent;
  }

  setConsent(value) {
    this.consent = Boolean(value);
    try {
      localStorage.setItem('ccm_consent', this.consent ? '1' : '0');
    } catch {
      /* noop */
    }
    window.__CCM_CONSENT__ = this.consent;
    if (this.consent) this._initPixel();
  }

  /** Pixel: únicamente PageView (requisito del funnel). */
  _initPixel() {
    if (!this.boot.metaTrackingEnabled || !this.boot.metaPixelId) return;
    if (this.pixelReady || !this.consent) return;

    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', this.boot.metaPixelId);
    window.fbq('track', 'PageView');
    this.pixelReady = true;
    window.__CCM_META_READY__ = true;
  }

  maybeShowConsent(bannerEl) {
    if (!this.boot.metaTrackingEnabled || !this.boot.metaPixelId) return;
    if (!this.boot.requireConsent) {
      this.setConsent(true);
      return;
    }
    if (localStorage.getItem('ccm_consent') !== null) {
      if (this.consent) this._initPixel();
      return;
    }
    if (bannerEl) bannerEl.hidden = false;
  }

  /**
   * @param {string} eventName
   * @param {{scene?: string, interaction?: string, email?: string, phone?: string, name?: string, content_name?: string, value?: number}} [meta]
   */
  track(eventName, meta = {}) {
    // PageView solo Pixel — no saturar CAPI
    if (eventName === 'PageView') {
      if (this.consent && !this.pixelReady) this._initPixel();
      return null;
    }

    const eventId = this._id('e');
    const payload = {
      event_id: eventId,
      session_id: this.sessionId,
      event_name: eventName,
      scene: meta.scene || '',
      elapsed_ms: this.elapsedFn?.() || 0,
      utm: this.utm,
      device: this.device,
      interaction: meta.interaction || '',
      page_url: location.href,
      consent: this.consent,
      fbp: this._cookie('_fbp'),
      fbc: this._cookie('_fbc'),
      fbclid: this.fbclid || '',
      content_name: meta.content_name || '',
      external_id: this.sessionId,
    };

    if (meta.email) payload.email = String(meta.email).trim();
    if (meta.phone) payload.phone = String(meta.phone).replace(/\D+/g, '');
    if (meta.name) payload.name = String(meta.name).trim();
    if (typeof meta.value === 'number') payload.value = meta.value;

    // Sin fbq('track') de conversiones — solo CAPI (evita doble conteo)
    this._send(payload);
    return eventId;
  }

  async _send(payload) {
    try {
      await fetch('/api/track.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      this.queue.push(payload);
      console.warn('[Tracking] queue failed', err);
    }
  }
}
