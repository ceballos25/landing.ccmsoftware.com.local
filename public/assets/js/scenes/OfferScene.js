import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE } from '/assets/js/config/experience.js';

const DEV_WA = '573245894268';

const WA_ICON = `<svg class="wa-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

function creditHtml() {
  return `
    <p class="offer-credit">
      <a href="https://wa.me/${DEV_WA}" target="_blank" rel="noopener noreferrer" class="offer-credit-link">
        ${WA_ICON}
        <em>Desarrollado por Cristian Ceballos</em>
      </a>
    </p>
  `;
}

export class OfferScene extends BaseScene {
  async enter(payload = {}) {
    const price = this.ctx.boot?.priceLabel || EXPERIENCE.pricing.label;
    const features = EXPERIENCE.features.map((f) => `<li>${f}</li>`).join('');

    this.root.classList.add('scene--blue-shift', 'scene--offer');
    this.root.classList.remove('scene--centered');
    const logo =
      this.ctx.boot?.brandLogo || EXPERIENCE.assets.images.brandLogo;

    this.root.innerHTML = `
      <div class="offer-shell" id="offer-main">
        <div class="offer-copy">
          <img class="offer-logo" src="${logo}" alt="CCM SOFTWARE_" width="200" height="40" />
          <p class="scene-kicker is-intense offer-headline">Tu próxima venta no debería perderse.</p>
          <p class="scene-sub offer-sub-desktop">Sistema web para administrar y comercializar rifas.</p>
          <p class="offer-price">${price}</p>
          <p class="offer-price-note">${EXPERIENCE.pricing.note}</p>
          <ul class="feature-list">${features}</ul>
        </div>

        <div class="offer-form-panel">
          <form class="hire-form" id="hire-form" novalidate>
            <header class="offer-form-head">
              <p class="offer-form-title">Tus datos</p>
              <p class="offer-form-lead">Te contactamos para activar tu acceso.</p>
            </header>
            <label>
              <span class="visually-hidden">Nombre</span>
              <input type="text" name="name" id="hire-name" autocomplete="name" required maxlength="80" placeholder="Nombre" />
            </label>
            <label>
              <span class="visually-hidden">Correo</span>
              <input type="email" name="email" id="hire-email" autocomplete="email" required maxlength="120" placeholder="Correo" />
            </label>
            <label>
              <span class="visually-hidden">Celular</span>
              <input type="tel" name="phone" id="hire-phone" autocomplete="tel" required maxlength="15" inputmode="numeric" placeholder="Celular" />
            </label>
            <button type="submit" class="btn-primary btn-primary--success" id="btn-hire">Quiero que me contacten</button>
          </form>
          <p class="scene-sub" id="wa-warn" hidden style="margin-top:0.75rem;color:var(--danger)"></p>
          ${creditHtml()}
        </div>
      </div>
    `;

    const musicKey = String(this.ctx.audio._musicKey || '');
    const hasBed = musicKey.includes('demo-bg');
    if (!hasBed || !this.ctx.audio.currentMusic || this.ctx.audio.currentMusic.paused) {
      await this.ctx.audio.playMusic(EXPERIENCE.assets.music.demoBg, {
        fade: 500,
        volume: 0.3,
      });
    } else if (this.ctx.audio.currentMusic) {
      this.ctx.audio.currentMusic.loop = true;
    }

    this.ctx.tracking.track('OfferViewed', {
      scene: 'OFFER',
      interaction: payload.reason || 'natural',
    });
    if (!payload.reason) {
      this.ctx.tracking.track('ExperienceCompleted', { scene: 'OFFER' });
    }

    this.root.querySelector('#hire-form')?.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        this._submit();
      },
      { signal: this.ac.signal }
    );
  }

  _showConfirmation(name) {
    const first = String(name || '')
      .trim()
      .split(/\s+/)[0]
      .replace(/[<>&"'`]/g, '')
      .slice(0, 40);
    const title = first
      ? `¡Hemos recibido tu mensaje, ${first}!`
      : '¡Hemos recibido tu mensaje!';

    const card = document.createElement('div');
    card.className = 'confirm-card';
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `
      <div class="confirm-check" aria-hidden="true">
        <svg viewBox="0 0 52 52" width="72" height="72">
          <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2.5"/>
          <path d="M15 27.5 L23 35 L38 18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="confirm-title"></p>
      <p class="confirm-text">
        Pronto te contactaremos para ayudarte a administrar tu rifa con un sistema profesional.
      </p>
      <p class="confirm-note">Revisa tu correo — también te enviamos un mensaje de bienvenida.</p>
      ${creditHtml()}
    `;
    const titleEl = card.querySelector('.confirm-title');
    if (titleEl) titleEl.textContent = title;

    // Mantener el shell de oferta: solo cambia el panel del form.
    // Así en desktop no colapsa el layout 2 columnas → tarjeta chica (salto feo).
    const panel = this.root.querySelector('.offer-form-panel');
    const copy = this.root.querySelector('.offer-copy');
    if (panel) {
      const mobile = window.matchMedia('(max-width: 899px)').matches;
      if (copy && mobile) copy.hidden = true;
      panel.classList.add('is-confirm');
      panel.replaceChildren(card);
      this.root.classList.add('scene--confirm');
      return;
    }

    this.root.replaceChildren();
    this.root.classList.add('scene--confirm');
    this.root.appendChild(card);
  }

  async _submit() {
    const name = String(this.root.querySelector('#hire-name')?.value || '').trim();
    const email = String(this.root.querySelector('#hire-email')?.value || '').trim();
    const phone = String(this.root.querySelector('#hire-phone')?.value || '').replace(/\D+/g, '');

    const warn = this.root.querySelector('#wa-warn');
    if (warn) warn.hidden = true;

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 10) {
      if (warn) {
        warn.hidden = false;
        warn.textContent = 'Completa nombre, correo válido y celular (mínimo 10 dígitos).';
      }
      return;
    }

    const btn = this.root.querySelector('#btn-hire');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }

    this.ctx.tracking.track('Lead', {
      scene: 'OFFER',
      interaction: 'hire_form',
      content_name: 'hire_form',
      name,
      email,
      phone,
      value: this.ctx.boot?.priceCop || EXPERIENCE.pricing?.amount || 600000,
    });

    this.ctx.audio.stopMusic(1400).catch(() => {});

    try {
      await Promise.race([
        fetch('/api/lead.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            session_id: this.ctx.tracking.sessionId,
          }),
          keepalive: true,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500)),
      ]);
    } catch {
      /* still show confirmation */
    }

    this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.brandReveal, { volume: 0.45 }).catch(() => {});
    // Solo confirmación en página — el lead llega por correo, sin sacar a WhatsApp
    this._showConfirmation(name);
  }
}
