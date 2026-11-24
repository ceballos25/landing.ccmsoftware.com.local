import { EXPERIENCE } from '/assets/js/config/experience.js';

export class WhatsAppService {
  /**
   * @param {{whatsappConfigured?: boolean, whatsappNumber?: string}} boot
   */
  constructor(boot) {
    this.boot = boot || {};
  }

  isConfigured() {
    return Boolean(this.boot.whatsappConfigured && this.boot.whatsappNumber);
  }

  /**
   * @param {string} [extra]
   * @returns {{ok: boolean, url?: string, error?: string}}
   */
  buildUrl(extra = '') {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error:
          'WHATSAPP_NUMBER no está configurado. Define el número en .env (formato internacional sin +).',
      };
    }

    let text = EXPERIENCE.whatsappMessage;
    if (extra && extra.trim()) {
      text = `${text} ${extra.trim()}`;
    }

    const url = `https://wa.me/${this.boot.whatsappNumber}?text=${encodeURIComponent(text)}`;
    return { ok: true, url };
  }

  /**
   * @param {string} [extra]
   * @returns {{ok: boolean, url?: string, error?: string}}
   */
  open(extra = '') {
    const result = this.buildUrl(extra);
    if (!result.ok || !result.url) return result;
    window.open(result.url, '_blank', 'noopener,noreferrer');
    return result;
  }
}
