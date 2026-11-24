import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE, LATE_WAVE_ASSETS } from '/assets/js/config/experience.js';

export class DecisionScene extends BaseScene {
  async enter() {
    this.root.classList.add('scene--centered');
    this._busy = false;
    this.root.innerHTML = `
      <div class="scene-copy">
        <p class="scene-kicker is-intense">Elige cómo quieres continuar</p>
        <div class="decision-grid">
          <button type="button" class="btn-choice" id="opt-manual" data-action="manual">Seguir con Excel, cuaderno y WhatsApp</button>
          <button type="button" class="btn-choice btn-choice--auto btn-primary--success" id="opt-auto" data-action="auto">Administrar mi rifa con un sistema profesional</button>
        </div>
        <p class="decision-feedback" id="feedback" hidden></p>
      </div>
    `;

    // Precarga tardía + decode del bed emotivo (WebAudio) antes del gesto
    this.ctx.media?.preloadMany?.(LATE_WAVE_ASSETS, 'audio')?.catch?.(() => {});
    this.ctx.audio?._decodeBuffer?.(EXPERIENCE.assets.music.demoBg)?.catch?.(() => {});

    this.root.addEventListener(
      'click',
      (ev) => {
        const btn = ev.target?.closest?.('[data-action]');
        if (!btn || this._busy) return;
        const action = btn.getAttribute('data-action');
        if (action === 'manual') this._manual();
        else if (action === 'auto') this._goTransform();
      },
      { signal: this.ac.signal }
    );
  }

  _manual() {
    this.ctx.tracking.track('DecisionSelected', {
      scene: 'DECISION',
      interaction: 'manual',
    });
    this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.notification).catch(() => {});

    const feedback = this.root.querySelector('#feedback');
    if (feedback) {
      feedback.hidden = false;
      feedback.innerHTML = `
        <span class="fade-up">Sin inventario claro. Sin control de pagos.</span><br>
        <span class="fade-up" style="animation-delay:.2s">Seguir a mano también es una decisión.</span>
      `;
    }
  }

  async _goTransform() {
    if (this._busy || this.aborted) return;
    this._busy = true;

    this.ctx.tracking.track('DecisionSelected', {
      scene: 'DECISION',
      interaction: 'automate',
    });

    // Bed emotivo en el mismo gesto del tap (WebAudio → sobrevive al video)
    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();
    await this.ctx.audio.playMusic(EXPERIENCE.assets.music.demoBg, {
      fade: 0,
      volume: 0.34,
    });

    this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.digitalTransition).catch(() => {});
    this.root.classList.add('scene--blue-shift');
    this.root.innerHTML = `
      <div class="scene-copy">
        <p class="boot-status fade-up">Activando tu sistema de rifas…</p>
      </div>
    `;
    await this.wait(900);
    if (this.aborted) return;
    this.next('TRANSFORMATION');
  }
}
