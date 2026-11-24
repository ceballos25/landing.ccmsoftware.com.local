import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE } from '/assets/js/config/experience.js';

const BEATS = [
  { at: 0, text: 'No es que tus clientes no quieran comprarte números.' },
  { at: 4000, text: 'Es que se cansan de un proceso manual.' },
  { at: 7500, text: 'Mientras anotas una venta, otro comprador ya busca otra rifa.' },
  { at: 12500, text: 'Mientras revisas un comprobante, se te cruzan los números.' },
  { at: 17000, text: 'Tu rifa no debería vivir en un cuaderno o un Excel.' },
];

export class ConfrontationScene extends BaseScene {
  async enter() {
    this.root.classList.add('scene--centered', 'scene--blackout');
    this.root.style.background = '#05070c';
    this.root.innerHTML = `
      <div class="scene-copy">
        <p class="scene-kicker is-intense" id="beat-text" style="color:#F8FAFC"></p>
      </div>
    `;

    await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.riser, { volume: 0.4 });

    const beatEl = this.root.querySelector('#beat-text');
    const voicePromise = this.ctx.audio.playVoice(EXPERIENCE.assets.voices.narradorProblema, {
      fallbackMs: 26000,
      volume: 1,
    });

    for (const beat of BEATS) {
      this.later(() => {
        if (this.ac.signal.aborted || !beatEl) return;
        beatEl.textContent = beat.text;
        beatEl.classList.remove('fade-up');
        void beatEl.offsetWidth;
        beatEl.classList.add('fade-up');
      }, beat.at);
    }

    await voicePromise;

    if (beatEl) {
      beatEl.textContent = 'Tu negocio de rifas no debería depender solo de ti.';
      beatEl.classList.add('is-intense');
    }

    await this.wait(2800);
    this.root.innerHTML = `
      <div class="scene-copy">
        <p class="scene-kicker is-intense fade-up">¿Y si tus clientes compraran solos en tu página web de rifas?</p>
      </div>
    `;
    await this.wait(3200);
    this.next('DECISION');
  }
}
