import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE, NEXT_WAVE_ASSETS } from '/assets/js/config/experience.js';

const LINE_1 = '¿Cuántos clientes quieren comprarte números en este momento?';
const LINE_2 = '¿Y cuántos se van porque tu rifa sigue en el caos?';

export class IntroScene extends BaseScene {
  async enter() {
    this.root.classList.add('scene-intro', 'scene--centered');
    this.root.innerHTML = `
      <div class="scene-copy intro-typewriter">
        <p class="scene-kicker" data-line="1" aria-live="polite"><span class="tw-text"></span><span class="tw-caret" aria-hidden="true"></span></p>
        <p class="scene-kicker is-intense" data-line="2" style="margin-top:1rem" aria-live="polite"><span class="tw-text"></span></p>
      </div>
    `;

    // Audio ya desbloqueado en el filtro; asegurar buffers de tecla ANTES de tipiar
    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();
    await this.ctx.audio._primeIntroSfx?.();
    if (!(await this.wait(180))) return;

    const line1 = this.root.querySelector('[data-line="1"]');
    const line2 = this.root.querySelector('[data-line="2"]');
    const caret = line1?.querySelector('.tw-caret');

    await this._typeLine(line1, LINE_1, { msPerChar: 56 });
    if (this.aborted) return;

    await this._strikeReturn();
    if (!(await this.wait(500))) return;
    caret?.setAttribute('hidden', '');

    await this._typeLine(line2, LINE_2, { msPerChar: 58 });
    if (this.aborted) return;

    await this._strikeReturn();
    // Pausa clara al terminar la escritura — luego sí el CTA
    if (!(await this.wait(850))) return;
    if (this.aborted) return;

    this._showStartButton();
  }

  _showStartButton() {
    const wrap = this.root.querySelector('.intro-typewriter');
    if (!wrap || this.root.querySelector('#btn-start')) return;

    const actions = document.createElement('div');
    actions.className = 'actions intro-actions fade-up';
    actions.dataset.line = '3';
    actions.innerHTML = `
      <button type="button" class="btn-primary btn-primary--success btn-cta-pulse" id="btn-start">
        Descubrir qué está pasando
      </button>
    `;
    wrap.appendChild(actions);

    actions.querySelector('#btn-start')?.addEventListener(
      'click',
      async () => {
        // Sin race: Safari necesita unlock real en este gesto
        await this.ctx.audio.unlock();
        await this.ctx.audio._resumeCtx?.();
        this.ctx.tracking.track('ExperienceStarted', { scene: 'INTRO' });
        await this.ctx.audio._primeCallChatSfx?.();
        // Preload SFX/música; voces solo se cargan en la escena de llamada (nunca play aquí)
        const waveNoVoice = NEXT_WAVE_ASSETS.filter(
          (u) =>
            u !== EXPERIENCE.assets.voices.clienteLlamada &&
            u !== EXPERIENCE.assets.voices.clienteLlamadaPerdida
        );
        this.ctx.media.preloadMany(waveNoVoice, 'audio').catch(() => {});
        this.ctx.audio.stopVoice?.();
        this.next('INCOMING_CALL');
      },
      { signal: this.ac.signal }
    );
  }

  _keyUrls() {
    const s = EXPERIENCE.assets.sfx;
    return [
      s.typingClick,
      s.typingClick2,
      s.typingClick3,
      s.typingClick,
    ].filter(Boolean);
  }

  async _strikeReturn() {
    this.ctx.audio.playClick(this._keyUrls(), { volume: 0.62, rate: 0.98 });
    await this.wait(40);
    this.ctx.audio.playClick(this._keyUrls(), { volume: 0.5, rate: 1.03 });
  }

  /**
   * @param {HTMLElement|null} el
   * @param {string} text
   * @param {{msPerChar?: number}} [opts]
   */
  async _typeLine(el, text, opts = {}) {
    if (!el) return;
    const target = el.querySelector('.tw-text') || el;
    const ms = opts.msPerChar ?? 58;
    const keys = this._keyUrls();

    let buf = '';
    for (let i = 0; i < text.length; i++) {
      if (this.ac.signal.aborted) return;
      const ch = text[i];
      buf += ch;
      target.textContent = buf;

      // Un click limpio por carácter (volumen golden / audible en iPhone)
      if (ch.trim()) {
        this.ctx.audio.playClick(keys, {
          volume: 0.52 + Math.random() * 0.14,
          rate: 0.99 + Math.random() * 0.03,
        });
      }

      let pause;
      if (ch === ' ') {
        pause = ms * 0.5 + Math.random() * 10;
      } else if (ch === '?' || ch === '¿') {
        pause = ms * 1.6 + Math.random() * 25;
      } else if (ch === ',' || ch === '.') {
        pause = ms * 1.35 + Math.random() * 18;
      } else {
        // Un poco más lento que la sample (~40ms) para no empastar
        pause = Math.max(52, ms + Math.random() * 8);
      }

      if (!(await this.wait(pause))) return;
    }
  }
}
