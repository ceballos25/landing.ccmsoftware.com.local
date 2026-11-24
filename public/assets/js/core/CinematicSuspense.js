import { EXPERIENCE } from '/assets/js/config/experience.js';

/**
 * Cue map for SUSPENSO.mp3 (≈28.4s).
 * Visual sobrio + bed de terror sincronizado.
 */
export const SUSPENSO_CUES = {
  duration: 28.4,
  blackoutAt: 16.4,
  // Tecleo en el valle previo; texto completo cae en el ataque del bed (~19.66s)
  typeStartAt: 18.2,
  impactAt: 19.66,
  holdSec: 4.5,
  endAt: 26.8,
};

const CLIMAX_TEXT = 'ACABAS DE PERDER UN CLIENTE.';

/**
 * Composición: problemas en lista fría → negro → clímax.
 */
export async function playSuspensoComposition(opts) {
  const { root, audio, signal } = opts;
  const chips = opts.chips || [];
  const cues = SUSPENSO_CUES;
  const cin = EXPERIENCE.assets.cinematic;
  const sfx = EXPERIENCE.assets.sfx;

  const stressUrls = [
    sfx.cinematicImpact,
    cin.reverse,
    sfx.chaosStress,
    cin.typeImpact,
    sfx.chaosStress2,
    cin.subBass,
  ].filter(Boolean);

  root.classList.remove('scene--centered');
  root.classList.add('scene--chaos-cinematic');
  root.style.background = '';
  root.style.setProperty('--chaos-dread', '0');
  const title = opts.title || '¿Te suena familiar?';

  const trackUrl = sfx.suspenso || cin.suspenso;
  const preloadList = [
    trackUrl,
    cin.heartbeat,
    cin.ambience,
    cin.boom,
    cin.reverb,
    ...stressUrls,
  ].filter(Boolean);
  preloadList.forEach((u) => audio.media?.preload?.(u, 'audio').catch(() => {}));

  // Corte seco → play confirmado → título en el mismo beat
  await audio.stopAll({ fadeMusic: 0 });
  await audio._resumeCtx?.();
  // Asegura decode del bed antes de tocar (iPhone post-chat)
  await audio._primeChaosSfx?.().catch?.(() => {});

  let track = await audio.playTrack(trackUrl, {
    volume: 0.95,
    fadeIn: 0,
    hardCut: true,
  });
  if (!track) {
    console.warn('[Suspenso] track failed — wall-clock visual fallback', trackUrl);
    // No abortar la escena: reloj de pared para chips → blackout → clímax
    const wall0 = performance.now();
    track = {
      get currentTime() {
        return (performance.now() - wall0) / 1000;
      },
      addEventListener() {},
      removeEventListener() {},
    };
  }

  // Espera a que el audio realmente avance (evita reloj adelantado al buffering)
  await new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      if (track.currentTime > 0.02 || performance.now() - t0 > 500) {
        resolve();
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });

  const mediaOrigin = performance.now() - track.currentTime * 1000;

  root.innerHTML = `
    <div class="chaos-stage" id="chaos-stage">
      <div class="chaos-vignette" aria-hidden="true"></div>
      <p class="chaos-title" id="chaos-title">${title}</p>
      <div class="chaos-layer" id="chaos-layer" aria-hidden="true"></div>
    </div>
    <div class="suspense-stage" id="suspense-stage" hidden aria-hidden="true">
      <p class="suspense-line" id="suspense-line" aria-live="polite"></p>
    </div>
  `;

  const layer = root.querySelector('#chaos-layer');
  const chaosStage = root.querySelector('#chaos-stage');
  const suspenseStage = root.querySelector('#suspense-stage');
  const line = root.querySelector('#suspense-line');
  const titleEl = root.querySelector('#chaos-title');
  // Fuerza reflow y revela título junto al audio audible
  void titleEl?.offsetWidth;
  titleEl?.classList.add('is-visible');

  audio
    .playLayer?.('chaos-heart', cin.heartbeat, { volume: 0.22, loop: true, fadeIn: 500 })
    ?.catch?.(() => {});
  audio
    .playLayer?.('chaos-amb', cin.ambience, {
      volume: 0.14,
      loop: true,
      fadeIn: 700,
    })
    ?.catch?.(() => {});

  // Un dolor a la vez, con tiempo real de lectura
  const chipCount = Math.min(chips.length, 6);
  const chipStart = 1.0;
  const dwell = 2.35; // segundos visibles por dolor
  const chipTimes = [];
  for (let i = 0; i < chipCount; i++) {
    chipTimes.push(chipStart + i * dwell);
  }
  const lastChipAt = chipTimes[chipTimes.length - 1] || chipStart;
  const peakAt = Math.min(lastChipAt + dwell * 0.55, cues.blackoutAt - 0.45);

  const chars = [...CLIMAX_TEXT];
  const typeWindow = Math.max(1.1, cues.impactAt - cues.typeStartAt);
  const typeStep = typeWindow / Math.max(1, chars.length);

  const fired = {
    chips: new Set(),
    blackout: false,
    typed: -1,
    impact: false,
    holdDone: false,
    peak: false,
  };

  const setDread = (n) => {
    const d = Math.min(1, Math.max(0, n));
    root.style.setProperty('--chaos-dread', String(d));
  };

  const playStress = (i) => {
    const url = stressUrls[i % stressUrls.length];
    if (!url) return;
    const vol = Math.min(0.85, 0.48 + i * 0.05);
    audio.playSfx(url, { volume: vol }).catch(() => {});
    if (navigator.vibrate) {
      try {
        navigator.vibrate(i > 3 ? [18, 28, 16] : 12);
      } catch {
        /* noop */
      }
    }
  };

  const spawnChip = (i) => {
    if (!layer || fired.chips.has(i) || fired.blackout) return;
    fired.chips.add(i);

    // Sale el anterior con fade limpio — solo queda el nuevo en foco
    layer.querySelectorAll('.chaos-line').forEach((el) => {
      el.classList.remove('is-current', 'is-in');
      el.classList.add('is-out');
      window.setTimeout(() => el.remove(), 520);
    });

    const row = document.createElement('p');
    row.className = 'chaos-line is-in is-current';
    row.textContent = chips[i % chips.length] || 'Sin control';
    layer.appendChild(row);

    setDread((i + 1) / chipCount);
    playStress(i);
  };

  const doPeak = () => {
    if (fired.peak || fired.blackout) return;
    fired.peak = true;
    setDread(1);
    root.classList.add('is-chaos-peak');
    audio.playSfx(cin.reverse || sfx.cinematicImpact, { volume: 0.55 }).catch(() => {});
  };

  const doBlackout = () => {
    if (fired.blackout) return;
    fired.blackout = true;

    audio.stopLayer?.('chaos-heart', 200)?.catch?.(() => {});
    audio.stopLayer?.('chaos-amb', 200)?.catch?.(() => {});

    chaosStage?.remove();
    root.classList.remove(
      'is-chaos-peak',
      'scene--chaos-cinematic'
    );
    root.classList.add('scene--blackout', 'scene--suspense');
    root.style.background = '#000';
    root.style.filter = 'none';

    if (suspenseStage) {
      suspenseStage.hidden = false;
      suspenseStage.setAttribute('aria-hidden', 'false');
      suspenseStage.classList.add('is-live');
    }
    if (line) {
      line.textContent = '';
      line.classList.remove('is-impact', 'is-typing');
      line.style.opacity = '0';
    }

    audio.playSfx(cin.reverse || sfx.cinematicImpact, { volume: 0.45 }).catch(() => {});
  };

  const typeTo = (count) => {
    if (!line || !fired.blackout || fired.impact) return;
    const n = Math.min(count, chars.length);
    if (n <= fired.typed) return;

    line.style.opacity = '1';
    line.classList.add('is-typing');

    for (let i = fired.typed + 1; i < n; i++) {
      const ch = chars[i];
      if (ch.trim()) {
        const keys = [sfx.typingClick, sfx.typingClick2, sfx.typingClick3].filter(Boolean);
        if (keys.length) {
          audio.playClick(keys, {
            volume: 0.3 + Math.random() * 0.08,
            rate: 0.99 + Math.random() * 0.03,
          });
        }
      }
    }
    fired.typed = n - 1;
    line.textContent = chars.slice(0, n).join('');
    const progress = (n - 1) / Math.max(1, chars.length - 1);
    line.style.setProperty('--suspense-glow', String(0.25 + progress * 0.65));
  };

  const doImpact = () => {
    if (fired.impact) return;
    fired.impact = true;
    if (line) {
      line.textContent = CLIMAX_TEXT;
      line.style.opacity = '1';
      line.classList.remove('is-typing');
      line.classList.add('is-impact');
    }
    root.classList.add('is-suspense-impact');

    // El bed ya lleva el boom en impactAt; overlay corto para refuerzo (sin segundo boom atrasado)
    audio.playSfx(sfx.cinematicImpact, { volume: 0.55 }).catch(() => {});
    audio.playSfx(cin.reverb, { volume: 0.4 }).catch(() => {});

    if (navigator.vibrate) {
      try {
        navigator.vibrate([20, 40, 30, 40, 50]);
      } catch {
        /* noop */
      }
    }
  };

  const doHoldEnd = () => {
    if (fired.holdDone) return;
    fired.holdDone = true;
    root.classList.remove('is-suspense-impact');
    if (line) line.classList.add('is-exit');
  };

  await new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      track.removeEventListener('ended', onEnded);
      resolve();
    };

    const onAbort = () => finish();
    const onEnded = () => {
      const t = Number.isFinite(track.currentTime)
        ? track.currentTime
        : (performance.now() - mediaOrigin) / 1000;
      if (t >= cues.endAt - 0.2) finish();
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    track.addEventListener('ended', onEnded, { once: true });
    window.setTimeout(finish, (cues.endAt + 1.5) * 1000);

    const tick = () => {
      if (settled || signal?.aborted) {
        finish();
        return;
      }

      // Media clock = fuente de verdad cuando el track avanza
      const media = Number.isFinite(track.currentTime) ? track.currentTime : 0;
      const wall = (performance.now() - mediaOrigin) / 1000;
      const t = media > 0.05 ? media : wall;

      if (!fired.blackout && t < cues.blackoutAt) {
        for (let i = 0; i < chipTimes.length; i++) {
          if (t >= chipTimes[i]) spawnChip(i);
        }
        if (fired.chips.size >= chipCount && t >= peakAt) doPeak();
      }

      if (t >= cues.blackoutAt) doBlackout();

      if (fired.blackout && t >= cues.typeStartAt && t < cues.impactAt) {
        const typedCount = Math.floor((t - cues.typeStartAt) / typeStep) + 1;
        typeTo(typedCount);
      }

      if (t >= cues.impactAt) {
        typeTo(chars.length);
        doImpact();
      }

      if (t >= cues.impactAt + cues.holdSec) doHoldEnd();

      if (t < cues.endAt) requestAnimationFrame(tick);
      else finish();
    };

    requestAnimationFrame(tick);
  });

  audio.stopLayer?.('chaos-heart', 180)?.catch?.(() => {});
  audio.stopLayer?.('chaos-amb', 180)?.catch?.(() => {});

  if (line) line.textContent = '';
  root.classList.remove(
    'scene--chaos-cinematic',
    'scene--suspense',
    'is-suspense-impact',
    'is-fade-black',
    'is-suspense-shake',
    'is-glitching',
    'is-chaos-peak'
  );
  root.style.removeProperty('--chaos-dread');
  root.classList.add('scene--blackout');
  root.style.background = '#000';
  root.style.filter = '';
  return true;
}

export { CLIMAX_TEXT };
