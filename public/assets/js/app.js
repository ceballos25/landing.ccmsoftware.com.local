import { EventBus } from '/assets/js/core/EventBus.js';
import { MediaLoader } from '/assets/js/core/MediaLoader.js';
import { AudioManager } from '/assets/js/core/AudioManager.js';
import { SceneManager } from '/assets/js/core/SceneManager.js';
import { TrackingService } from '/assets/js/services/TrackingService.js';
import { WhatsAppService } from '/assets/js/services/WhatsAppService.js';
import {
  CRITICAL_ASSETS,
  EXPERIENCE,
  LATE_WAVE_ASSETS,
  NEXT_WAVE_ASSETS,
} from '/assets/js/config/experience.js';

import { FilterScene } from '/assets/js/scenes/FilterScene.js';
import { IntroScene } from '/assets/js/scenes/IntroScene.js';
import { IncomingCallScene } from '/assets/js/scenes/IncomingCallScene.js';
import { ChatScene } from '/assets/js/scenes/ChatScene.js';
import { ChaosScene } from '/assets/js/scenes/ChaosScene.js';
import { ConfrontationScene } from '/assets/js/scenes/ConfrontationScene.js';
import { DecisionScene } from '/assets/js/scenes/DecisionScene.js';
import { TransformationScene } from '/assets/js/scenes/TransformationScene.js';
import { BrandRevealScene } from '/assets/js/scenes/BrandRevealScene.js';
import { OfferScene } from '/assets/js/scenes/OfferScene.js';

/** Bust automático de media: usa window.__CCM_ASSET_V__ (mtime del server). */
function stampUrl(url, v) {
  if (!url || typeof url !== 'string' || !v) return url;
  if (!url.startsWith('/assets/')) return url;
  const clean = url.replace(/([?&])v=[^&]*/g, '$1').replace(/[?&]$/, '');
  return `${clean}${clean.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

function stampAssetTree(node, v) {
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (typeof val === 'string') node[key] = stampUrl(val, v);
    else if (val && typeof val === 'object') stampAssetTree(val, v);
  }
}

function stampUrlList(list, v) {
  if (!Array.isArray(list)) return;
  for (let i = 0; i < list.length; i++) list[i] = stampUrl(list[i], v);
}

async function boot() {
  const assetV = window.__CCM_ASSET_V__ || '';
  stampAssetTree(EXPERIENCE.assets, assetV);
  stampUrlList(CRITICAL_ASSETS, assetV);
  stampUrlList(NEXT_WAVE_ASSETS, assetV);
  stampUrlList(LATE_WAVE_ASSETS, assetV);

  const bootConfig = window.__CCM_BOOT__ || {};
  if (bootConfig.brandName) EXPERIENCE.brand.name = bootConfig.brandName;
  if (bootConfig.priceLabel) EXPERIENCE.pricing.label = bootConfig.priceLabel;
  if (typeof bootConfig.priceCop === 'number') EXPERIENCE.pricing.amount = bootConfig.priceCop;

  const stage = document.getElementById('scene-stage');
  const subtitleBar = document.getElementById('subtitle-bar');
  const subtitleText = document.getElementById('subtitle-text');
  if (!stage) throw new Error('scene-stage missing');

  const bus = new EventBus();
  const media = new MediaLoader();
  const audio = new AudioManager(media, bus);

  const ctx = {
    boot: bootConfig,
    bus,
    media,
    audio,
    tracking: null,
    whatsapp: new WhatsAppService(bootConfig),
    scenes: null,
  };

  const scenes = new SceneManager(stage, bus, ctx);
  ctx.scenes = scenes;
  ctx.tracking = new TrackingService(bootConfig, () => scenes.elapsed());

  scenes.register('FILTER', FilterScene);
  scenes.register('INTRO', IntroScene);
  scenes.register('INCOMING_CALL', IncomingCallScene);
  scenes.register('CHAT_SIMULATION', ChatScene);
  scenes.register('CHAOS', ChaosScene);
  scenes.register('CONFRONTATION', ConfrontationScene);
  scenes.register('DECISION', DecisionScene);
  scenes.register('TRANSFORMATION', TransformationScene);
  scenes.register('BRAND_REVEAL', BrandRevealScene);
  scenes.register('OFFER', OfferScene);

  bus.on('subtitle:show', (text) => {
    if (!subtitleBar || !subtitleText) return;
    subtitleText.textContent = text || '';
    subtitleBar.hidden = !text;
  });
  bus.on('subtitle:hide', () => {
    if (!subtitleBar) return;
    subtitleBar.hidden = true;
  });

  // Safari: lock screen / tab switch suspende el AudioContext
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.pause();
    } else {
      audio.resume();
      audio._resumeCtx?.();
    }
  });
  window.addEventListener('pagehide', () => audio.pause());
  window.addEventListener(
    'pageshow',
    () => {
      audio.resume();
      audio._resumeCtx?.();
    },
    { passive: true }
  );

  // Consent
  const banner = document.getElementById('consent-banner');
  ctx.tracking.maybeShowConsent(banner);
  document.getElementById('consent-accept')?.addEventListener('click', () => {
    ctx.tracking.setConsent(true);
    if (banner) banner.hidden = true;
  });
  document.getElementById('consent-reject')?.addEventListener('click', () => {
    ctx.tracking.setConsent(false);
    if (banner) banner.hidden = true;
  });

  // Preload critical audio quietly (no play)
  media.preloadMany(CRITICAL_ASSETS, 'audio').catch(() => {});

  // Warn developer if WhatsApp missing
  if (!ctx.whatsapp.isConfigured()) {
    console.info(
      '%c[CCM] WHATSAPP_NUMBER no configurado. El CTA final no redirigirá hasta que lo definas en .env',
      'color:#38BDF8'
    );
  }

  window.__CCM__ = ctx;
  await scenes.go('FILTER');
  ctx.tracking.track('PageView', { scene: 'FILTER' });
}

boot().catch((err) => {
  console.error('[CCM Experience] boot failed', err);
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;background:#050608;color:#F8FAFC;font-family:system-ui;padding:2rem;text-align:center">
      <div>
        <h1>No se pudo iniciar la experiencia</h1>
        <p style="color:#94A3B8">Recarga la página. Si el problema continúa, revisa la consola del navegador.</p>
      </div>
    </main>
  `;
});
