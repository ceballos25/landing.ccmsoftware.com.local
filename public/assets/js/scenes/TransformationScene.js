import { BaseScene } from '/assets/js/core/SceneManager.js';
import { EXPERIENCE } from '/assets/js/config/experience.js';

export class TransformationScene extends BaseScene {
  async enter() {
    this.root.classList.add('scene--blue-shift');
    this.root.classList.remove('scene--centered');

    this.root.innerHTML = `
      <div class="transform-wrap">
        <div class="transform-frame" id="video-frame">
          <video
            class="transform-video"
            id="demo-video"
            playsinline
            webkit-playsinline
            preload="auto"
          >
            <source src="${EXPERIENCE.assets.video.demoNarratedWebm}" type="video/webm" />
            <source src="${EXPERIENCE.assets.video.demoNarrated}" type="video/mp4" />
          </video>
        </div>
      </div>
    `;

    this.ctx.bus?.emit?.('subtitle:hide');
    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();

    // Bed emotivo EN WebAudio (no lo mata el <video> en iPhone)
    await this.ctx.audio.playMusic(EXPERIENCE.assets.music.demoBg, {
      fade: 0,
      volume: 0.34,
    });

    const video = this.root.querySelector('#demo-video');
    let ended = false;

    if (video) {
      video.muted = false;
      video.volume = 1;
      video.style.removeProperty('--demo-zoom');
      video.classList.remove('is-zoomed');

      const tryPlay = async () => {
        try {
          await video.play();
        } catch {
          // iOS a veces exige muted; la narración va por audio aparte
          try {
            video.muted = true;
            await video.play();
            this.ctx.audio.playVoice(EXPERIENCE.assets.voices.narradorTransformacion, {
              fallbackMs: 26000,
              volume: 1,
            });
            // Voz ducka el bed: súbelo un poco para que siga emotivo debajo
            this.ctx.audio._musicTargetVol = 0.22;
            this.ctx.audio.duckMusic?.(false);
            this.ctx.audio._setMusicVolume?.(0.22);
          } catch {
            /* soft */
          }
        }
      };

      await tryPlay();
      this.later(() => {
        if (video.paused) tryPlay();
      }, 350);
    }

    this.ctx.tracking.track('TransformationViewed', { scene: 'TRANSFORMATION' });

    // Espera al final real del video (o tope 28s)
    await new Promise((resolve) => {
      const cap = window.setTimeout(() => resolve(), 28000);
      if (!video) {
        window.clearTimeout(cap);
        resolve();
        return;
      }
      const done = () => {
        if (ended) return;
        ended = true;
        window.clearTimeout(cap);
        resolve();
      };
      video.addEventListener('ended', done, { once: true });
      // Si duration ya está, arma un backup
      const arm = () => {
        if (!Number.isFinite(video.duration) || video.duration < 1) return;
        window.setTimeout(done, Math.min(28000, video.duration * 1000 + 200));
      };
      if (video.readyState >= 1) arm();
      else video.addEventListener('loadedmetadata', arm, { once: true });
    });

    if (this.aborted) return;

    if (video) {
      try {
        video.pause();
      } catch {
        /* noop */
      }
    }

    // Mantener la misma música emotiva hacia el cierre/formulario
    this.next('BRAND_REVEAL');
  }
}
