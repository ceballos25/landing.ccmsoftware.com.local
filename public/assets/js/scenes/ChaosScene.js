import { BaseScene } from '/assets/js/core/SceneManager.js';
import { LATE_WAVE_ASSETS } from '/assets/js/config/experience.js';
import { playSuspensoComposition } from '/assets/js/core/CinematicSuspense.js';

/** Dolores reales de vender rifas a mano (sin sistema) */
const CHIPS = [
  'Un cliente pregunta… y no sabes qué números quedan',
  'El comprobante se perdió entre 40 chats',
  'Reservaste un número y nadie lo anotó',
  'Vendiste el mismo número dos veces',
  'Te demoraste en contestar y ya compró en otra rifa',
  'Llegó el sorteo y no tienes claro quién pagó qué',
];

export class ChaosScene extends BaseScene {
  async enter() {
    await this.ctx.audio.unlock();
    await this.ctx.audio._resumeCtx?.();
    // Decode bed en WebAudio (iPhone no tiene gesto fresco tras el chat)
    await this.ctx.audio._primeChaosSfx?.().catch?.(() => {});
    this.ctx.media?.preloadMany?.(LATE_WAVE_ASSETS, 'audio')?.catch?.(() => {});

    // playSuspensoComposition siempre corre la escena (audio o wall-clock)
    await playSuspensoComposition({
      root: this.root,
      audio: this.ctx.audio,
      signal: this.ac.signal,
      chips: CHIPS,
      labels: [],
      title: '¿Te suena familiar?',
      receipts: [],
    });

    if (this.aborted || this.ac.signal.aborted) return;

    this.ctx.tracking.track('ChaosCompleted', { scene: 'CHAOS' });
    this.next('DECISION');
  }

  async exit() {
    this.root.classList.remove(
      'scene--chaos-cinematic',
      'scene--suspense',
      'scene--blackout',
      'is-suspense-impact',
      'is-fade-black',
      'is-suspense-shake',
      'is-glitching',
      'is-chaos-peak'
    );
    this.root.style.removeProperty('--chaos-dread');
    this.root.style.background = '';
    this.root.style.filter = '';
    this.ctx.audio.stopLayer?.('chaos-heart', 120)?.catch?.(() => {});
    this.ctx.audio.stopLayer?.('chaos-amb', 120)?.catch?.(() => {});
    await this.ctx.audio.stopTrack(220);
    await super.exit();
  }
}
