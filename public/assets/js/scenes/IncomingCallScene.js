import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE } from '/assets/js/config/experience.js';

export class IncomingCallScene extends BaseScene {
  constructor(ctx, root) {
    super(ctx, root);
    this.ringtone = null;
    this.timerId = null;
    this.seconds = 0;
  }

  _clock() {
    const d = new Date();
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  _phoneHTML(mode = 'incoming') {
    const avatar = EXPERIENCE.assets.images.clienteAvatar;
    return `
      <div class="phone-shell phone-shell--ios" id="phone">
        <div class="phone-status phone-status--ios">
          <span id="phone-clock">${this._clock()}</span>
          <div class="phone-dynamic-island" aria-hidden="true"></div>
          <div class="phone-status-icons" aria-hidden="true">
            <span class="sig"></span><span class="wifi"></span><span class="bat"></span>
          </div>
        </div>
        <div class="caller-block">
          <div class="caller-avatar-wrap">
            <img class="caller-avatar" src="${avatar}" alt="" width="112" height="112" />
          </div>
          <p class="caller-name">Cliente interesado</p>
          <p class="caller-state" id="caller-state">${mode === 'incoming' ? 'móvil' : 'llamada en curso'}</p>
          <p class="call-timer" id="call-timer" hidden>00:00</p>
        </div>
        <div class="call-actions" id="call-actions">
          <button type="button" class="call-btn call-btn--reject" id="btn-reject" aria-label="Rechazar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z" transform="rotate(135 12 12)"/></svg>
            <span>Rechazar</span>
          </button>
          <button type="button" class="call-btn call-btn--accept" id="btn-accept" aria-label="Aceptar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg>
            <span>Aceptar</span>
          </button>
        </div>
      </div>
    `;
  }

  async enter() {
    this.root.innerHTML = this._phoneHTML('incoming');
    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();
    // Corta cualquier voz filtrada del CTA; Nokia solo aquí
    this.ctx.audio.stopVoice?.();
    this.ctx.audio.stopAllSfx();
    this.ctx.media.preload(EXPERIENCE.assets.sfx.ringtone, 'audio').catch(() => {});

    // Ringtone YA — no esperar música ni vibración
    this.ringtone = await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.ringtone, {
      loop: true,
      volume: 0.95,
    });
    if (!this.ringtone) {
      this.ringtone = await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.ringtone, {
        loop: true,
        volume: 0.95,
      });
    }
    this._ringPulse();

    // Fondo y preloads en paralelo (no bloquean el tono)
    this.ctx.media.preload(EXPERIENCE.assets.voices.clienteLlamada, 'audio').catch(() => {});
    this.ctx.media.preload(EXPERIENCE.assets.voices.clienteLlamadaPerdida, 'audio').catch(() => {});
    this.ctx.audio.playMusic(EXPERIENCE.assets.music.suspense, { fade: 900 }).catch(() => {});
    this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.vibration, { volume: 0.4 }).catch(() => {});

    this.root.querySelector('#btn-accept')?.addEventListener(
      'click',
      () => this._accept(),
      { signal: this.ac.signal }
    );
    this.root.querySelector('#btn-reject')?.addEventListener(
      'click',
      () => this._reject(),
      { signal: this.ac.signal }
    );

    this.later(() => {
      if (!this.ac.signal.aborted && this.ringtone) this._reject(true);
    }, 16000);
  }

  _ringPulse() {
    if (this.ac.signal.aborted) return;
    this.later(async () => {
      if (this.ac.signal.aborted || !this.ringtone) return;
      this.root.querySelector('#phone')?.classList.add('is-shaking');
      this.later(() => this.root.querySelector('#phone')?.classList.remove('is-shaking'), 450);
      await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.vibration, { volume: 0.3 });
      this._ringPulse();
    }, 2000);
  }

  _stopRing() {
    if (this.ringtone) {
      this.ctx.audio.stopSfx(this.ringtone);
      this.ringtone = null;
    }
  }

  _startTimer() {
    const el = this.root.querySelector('#call-timer');
    if (el) el.hidden = false;
    this.seconds = 0;
    this.timerId = window.setInterval(() => {
      this.seconds += 1;
      const m = String(Math.floor(this.seconds / 60)).padStart(2, '0');
      const s = String(this.seconds % 60).padStart(2, '0');
      if (el) el.textContent = `${m}:${s}`;
    }, 1000);
    this.timers.push(this.timerId);
  }

  async _accept() {
    this._stopRing();
    // Voz PRIMERO en el gesto de Aceptar (iOS: cualquier await antes rompe el play)
    this.ctx.audio._resumeCtx?.();
    const voicePromise = this.ctx.audio.playVoice(
      EXPERIENCE.assets.voices.clienteLlamada,
      {
        subtitle: EXPERIENCE.subtitleFallbacks.clienteLlamada,
        fallbackMs: 15000,
        volume: 1,
      }
    );

    this.ctx.tracking.track('CallAccepted', { scene: 'ACTIVE_CALL' });
    const actions = this.root.querySelector('#call-actions');
    if (actions) actions.hidden = true;
    const state = this.root.querySelector('#caller-state');
    if (state) state.textContent = 'llamada en curso';
    this._startTimer();
    // Connected es WebAudio buffer — no necesita el gesto
    this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.callConnected).catch(() => {});

    const voiceResult = await voicePromise;
    console.info('[Call] voice finished', voiceResult);

    await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.callEnded);
    if (state) state.textContent = 'llamada finalizada';
    this.ctx.tracking.track('CallCompleted', { scene: 'ACTIVE_CALL', interaction: 'accepted' });
    await this.wait(1400);
    this.next('CHAT_SIMULATION', { from: 'accepted' });
  }

  async _reject(auto = false) {
    this._stopRing();
    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();
    this.ctx.tracking.track('CallRejected', {
      scene: 'MISSED_CALL',
      interaction: auto ? 'timeout' : 'rejected',
    });

    const actions = this.root.querySelector('#call-actions');
    if (actions) actions.hidden = true;

    const toast = document.createElement('div');
    toast.className = 'missed-toast';
    toast.innerHTML = `<img src="${EXPERIENCE.assets.images.clienteAvatar}" alt=""><div><strong>Cliente interesado</strong><span>1 llamada perdida</span></div>`;
    this.root.querySelector('#phone')?.appendChild(toast);

    await this.wait(1800);
    toast.remove();

    // Voz missed: elemento ya warm en CTA; re-assert ctx por si Safari lo suspendió
    await this.ctx.audio._resumeCtx?.();
    await this.ctx.audio.playVoice(EXPERIENCE.assets.voices.clienteLlamadaPerdida, {
      subtitle: EXPERIENCE.subtitleFallbacks.clienteLlamadaPerdida,
      fallbackMs: 9000,
    });

    this.ctx.tracking.track('CallCompleted', { scene: 'MISSED_CALL', interaction: 'rejected' });
    await this.wait(1000);
    this.next('CHAT_SIMULATION', { from: 'rejected' });
  }

  async exit() {
    this._stopRing();
    if (this.timerId) clearInterval(this.timerId);
    await super.exit();
  }
}
