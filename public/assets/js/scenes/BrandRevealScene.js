import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE } from '/assets/js/config/experience.js';

export class BrandRevealScene extends BaseScene {
  async enter() {
    this.root.classList.add('scene--blue-shift', 'scene--centered');
    const brand = this.ctx.boot?.brandName || EXPERIENCE.brand.name;
    await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.whoosh, { volume: 0.4 });

    const logoSrc =
      this.ctx.boot?.brandLogo || EXPERIENCE.assets.images.brandLogo;

    this.root.innerHTML = `
      <div class="scene-copy brand-reveal">
        <img class="brand-logo" id="logo" src="${logoSrc}" alt="${this._esc(brand)}" width="280" height="55" />
        <p class="scene-sub" id="sub" hidden style="margin-top:1.4rem">Sistema para administrar y comercializar rifas.</p>
      </div>
    `;

    // Conservar música emotiva del demo (loop) hasta el formulario.
    // Solo arranca bed de cierre si no hay música activa.
    const key = String(this.ctx.audio._musicKey || '');
    if (!key.includes('demo-bg')) {
      await this.ctx.audio.playMusic(EXPERIENCE.assets.music.demoBg, {
        fade: 600,
        volume: 0.3,
      });
    } else {
      // Asegura volumen audible tras el video (HTMLAudio o WebAudio bed)
      try {
        this.ctx.audio._musicTargetVol = this.ctx.audio._vol(0.3);
        this.ctx.audio._setMusicVolume?.(0.3);
        if (this.ctx.audio.currentMusic) this.ctx.audio.currentMusic.loop = true;
      } catch {
        /* noop */
      }
    }

    await this.ctx.audio.playSfx(EXPERIENCE.assets.sfx.brandReveal);
    const logo = this.root.querySelector('#logo');
    if (logo) {
      logo.style.opacity = '0';
      logo.style.transform = 'scale(0.92)';
      logo.style.transition = 'opacity .9s ease, transform .9s ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          logo.style.opacity = '1';
          logo.style.transform = 'scale(1)';
        });
      });
      this.later(() => {
        logo.style.opacity = '1';
        logo.style.transform = 'scale(1)';
      }, 1000);
    }

    await this.wait(1200);
    const sub = this.root.querySelector('#sub');
    if (sub) {
      sub.hidden = false;
      sub.classList.add('fade-up');
    }

    // Misma voz del narrador del demo (GonzaloNeural)
    this.ctx.bus?.emit?.('subtitle:hide');
    await this.ctx.audio.playVoice(EXPERIENCE.assets.voices.narradorCierre, {
      fallbackMs: 12000,
      volume: 1,
    });

    await this.wait(700);
    this.next('OFFER');
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
