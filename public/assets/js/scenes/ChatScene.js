import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE } from '/assets/js/config/experience.js';

const MESSAGES = [
  // pauseMs = espera sin respuesta (un poco más ágil, sin volver a “spam”)
  { text: 'Hola', typingMs: 900, pauseMs: 2400 },
  { text: '¿Aún tienes números disponibles?', typingMs: 2200, pauseMs: 2000 },
  { text: '¿A dónde realizo el pago?', typingMs: 2000, pauseMs: 6500 },
  { text: '?', typingMs: 650, pauseMs: 2800 },
  { text: 'Ok, voy a comprar en otra rifa, adiós', typingMs: 2600, pauseMs: 1800 },
];

/** Avatar genérico WA (evita icono roto al quitar la foto) */
const WA_DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23dfe5e7'/%3E%3Ccircle cx='20' cy='15' r='8' fill='%23aeb6bd'/%3E%3Cpath d='M6 36c0-7.7 6.3-12 14-12s14 4.3 14 12' fill='%23aeb6bd'/%3E%3C/svg%3E";

const NOTIFS = [
  {
    who: 'Andrés M.',
    text: 'Te envié el comprobante de los números 42 y 43.',
    avatar: EXPERIENCE.assets.images.avatar2,
  },
  {
    who: 'Laura R.',
    text: '¿Me confirmas si ya quedaron mis números?',
    avatar: EXPERIENCE.assets.images.avatar3,
  },
  {
    who: 'Carlos P.',
    text: 'Quiero 10 números. ¿Qué tienes disponible?',
    avatar: EXPERIENCE.assets.images.avatar4,
  },
  {
    who: 'Diana S.',
    text: 'Se me venció la reserva y nadie me avisó.',
    avatar: EXPERIENCE.assets.images.avatar5,
  },
];

export class ChatScene extends BaseScene {
  constructor(ctx, root) {
    super(ctx, root);
    this._msgAudio = null;
  }

  async enter() {
    const avatar =
      EXPERIENCE.assets.images.clienteWhatsappAvatar ||
      EXPERIENCE.assets.images.clienteAvatar;
    const waName = EXPERIENCE.characters?.whatsapp?.name || 'Valentina R.';
    const dateLabel = this._dateLabel();

    this.root.classList.add('scene--whatsapp');
    this.root.innerHTML = `
      <div class="wa-phone" id="wa-phone">
        <div class="wa-status" aria-hidden="true">
          <span class="wa-status-time">${this._clock()}</span>
          <div class="wa-status-icons">
            <svg class="wa-ico-sig" viewBox="0 0 18 12" width="16" height="11" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="0.5" fill="currentColor"/><rect x="5" y="5" width="3" height="7" rx="0.5" fill="currentColor"/><rect x="10" y="2" width="3" height="10" rx="0.5" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="0.5" fill="currentColor" opacity=".35"/></svg>
            <svg class="wa-ico-wifi" viewBox="0 0 16 12" width="14" height="11" aria-hidden="true"><path fill="currentColor" d="M8 9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm0-3.2c1.5 0 2.9.6 3.9 1.6l-1.1 1.1A3.9 3.9 0 0 0 8 8a3.9 3.9 0 0 0-2.8 1.1L4.1 8C5.1 7 6.5 6.4 8 6.4zm0-3.2c2.4 0 4.6 1 6.2 2.6L13.1 7A7.1 7.1 0 0 0 8 5c-2 0-3.8.8-5.1 2.1L1.8 5.8A9.5 9.5 0 0 1 8 3.2z"/></svg>
            <span class="wa-ico-bat" aria-hidden="true"><i></i></span>
          </div>
        </div>

        <header class="wa-header">
          <button type="button" class="wa-back" tabindex="-1" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <img class="wa-avatar" id="wa-avatar" src="${avatar}" alt="" width="40" height="40" />
          <div class="wa-header-meta">
            <p class="wa-name" id="wa-name">${this._esc(waName)}</p>
            <p class="wa-presence" id="wa-presence">en línea</p>
          </div>
          <div class="wa-header-actions" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </div>
        </header>

        <div class="wa-thread" id="thread" role="log" aria-live="polite">
          <div class="wa-day"><span>${dateLabel}</span></div>
        </div>

        <div class="wa-compose" id="wa-compose" aria-hidden="true">
          <div class="wa-compose-field">
            <svg class="wa-compose-emoji" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            <span class="wa-compose-placeholder">Mensaje</span>
            <div class="wa-compose-trailing">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-1.93-1.57-3.5-3.5-3.5S8 3.07 8 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-2.5z"/></svg>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-7h-1.2l-.9-1.2c-.3-.4-.8-.8-1.3-.8H9.4c-.5 0-1 .4-1.3.8L7.2 5H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 14H6V7h2.1l1.2-1.5h5.4L15.9 7H18v12z"/></svg>
            </div>
          </div>
          <button type="button" class="wa-compose-mic" tabindex="-1" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>
        </div>
      </div>
      <div class="notif-stack" id="notif-stack"></div>
    `;

    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();
    // Re-prime chat + arranca decode del caos mientras Valentina escribe
    this.ctx.audio._primeCallChatSfx?.();
    this.ctx.audio._primeChaosSfx?.().catch?.(() => {});
    this.ctx.audio.media?.preload?.(EXPERIENCE.assets.sfx.waMessageIn, 'audio').catch?.(() => {});
    await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.vibration, { volume: 0.3 });
    await this.wait(900);

    const thread = this.root.querySelector('#thread');
    // Un solo reloj coherente (status + burbujas).
    const clock = new Date();

    for (let i = 0; i < MESSAGES.length; i++) {
      const msg = MESSAGES[i];
      if (this.ac.signal.aborted) return;

      const presence = this.root.querySelector('#wa-presence');
      if (presence) presence.textContent = 'escribiendo…';
      this._syncStatusClock(clock);

      if (!(await this._typing(thread, msg.typingMs))) return;

      if (presence) presence.textContent = 'en línea';
      // Solo avanza el reloj entre mensajes (más real, no +1 min siempre)
      if (i > 0) clock.setMinutes(clock.getMinutes() + 1);
      const time = this._fmtDate(clock);
      this._syncStatusClock(clock);
      this._bubble(thread, msg.text, time);
      await this._playIncoming();
      thread.scrollTop = thread.scrollHeight;

      if (!(await this.wait(msg.pauseMs))) return;
    }

    // Cliente te bloquea — sin nota de voz
    if (!(await this._playBlocked(thread, waName))) return;

    const stack = this.root.querySelector('#notif-stack');
    let gap = 1100;
    for (let i = 0; i < NOTIFS.length; i++) {
      if (this.ac.signal.aborted) return;
      if (!(await this.wait(gap))) return;
      const n = NOTIFS[i];
      const card = document.createElement('div');
      card.className = 'wa-notif';
      card.innerHTML = `
        <img src="${n.avatar}" alt="" />
        <div>
          <div class="wa-notif-top"><strong>${this._esc(n.who)}</strong><em>ahora</em></div>
          <span>${this._esc(n.text)}</span>
        </div>
      `;
      stack?.appendChild(card);
      await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.waNotification, {
        volume: 0.45,
      });
      this.root.classList.add('is-shaking');
      this.later(() => this.root.classList.remove('is-shaking'), 350);
      gap = Math.max(480, gap * 0.78);
    }

    if (!(await this.wait(1100))) return;
    if (this.aborted) return;
    this.ctx.tracking.track('ChatCompleted', { scene: 'CHAT_SIMULATION' });
    this.next('CHAOS');
  }

  async _playBlocked(thread, waName) {
    if (!(await this.wait(1100))) return false;

    const phone = this.root.querySelector('#wa-phone');
    const presence = this.root.querySelector('#wa-presence');
    const avatar = this.root.querySelector('#wa-avatar');
    const compose = this.root.querySelector('#wa-compose');

    if (presence) {
      presence.textContent = '';
      presence.hidden = true;
    }
    // Foto → silueta genérica (src data-URI: sin icono roto)
    if (avatar) {
      avatar.classList.add('is-blocked-gone');
      avatar.src = WA_DEFAULT_AVATAR;
      avatar.alt = '';
      avatar.setAttribute('aria-hidden', 'true');
    }
    phone?.classList.add('is-blocked');
    compose?.classList.add('is-disabled');

    const blockNote = document.createElement('div');
    blockNote.className = 'wa-system wa-system--block';
    blockNote.innerHTML = `<span>${this._esc(waName)} te bloqueó</span>`;
    thread.appendChild(blockNote);
    thread.scrollTop = thread.scrollHeight;

    await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.vibration, { volume: 0.45 });
    if (navigator.vibrate) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch {
        /* noop */
      }
    }

    if (!(await this.wait(650))) return false;

    const system = document.createElement('div');
    system.className = 'wa-system';
    system.innerHTML = `<span>Ya no puedes enviar mensajes a este contacto.</span>`;
    thread.appendChild(system);
    thread.scrollTop = thread.scrollHeight;

    return this.wait(1800);
  }

  async exit() {
    this._stopIncoming();
    this.root.classList.remove('scene--whatsapp');
    await super.exit();
  }

  async _playIncoming() {
    const url =
      EXPERIENCE.assets.sfx.waMessageIn || EXPERIENCE.assets.sfx.messageReceived;
    // Oneshot por mensaje: evita banco muted/race y garantiza un tono por burbuja
    this._msgAudio = await this.ctx.audio.playSfx(url, {
      volume: 0.88,
      oneshot: true,
    });
    if (!this._msgAudio) {
      await this.ctx.audio.unlock();
      this._msgAudio = await this.ctx.audio.playSfx(url, {
        volume: 0.92,
        oneshot: true,
      });
    }
  }

  _stopIncoming() {
    if (this._msgAudio) {
      this.ctx.audio.stopSfx(this._msgAudio);
      this._msgAudio = null;
    }
  }

  _clock() {
    return this._fmtDate(new Date());
  }

  /** HH:mm fijo 24h — mismo formato en status bar y burbujas */
  _fmtDate(d) {
    const h = d.getHours();
    const m = d.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  _syncStatusClock(d) {
    const el = this.root.querySelector('.wa-status-time');
    if (el) el.textContent = this._fmtDate(d);
  }

  _dateLabel() {
    const d = new Date();
    const label = d.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  async _typing(thread, ms) {
    const row = document.createElement('div');
    row.className = 'wa-row wa-row--in';
    row.innerHTML = `
      <div class="wa-typing" aria-label="Escribiendo">
        <i></i><i></i><i></i>
      </div>
    `;
    thread.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
    const ok = await this.wait(ms);
    row.remove();
    return ok;
  }

  _bubble(thread, text, time) {
    const row = document.createElement('div');
    row.className = 'wa-row wa-row--in';
    row.innerHTML = `
      <div class="wa-bubble wa-bubble--in">
        <p>${this._esc(text)}</p>
        <time>${time}</time>
      </div>
    `;
    thread.appendChild(row);
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
