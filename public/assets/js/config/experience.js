/** @typedef {'INTRO'|'INCOMING_CALL'|'ACTIVE_CALL'|'MISSED_CALL'|'CHAT_SIMULATION'|'CHAOS'|'CONFRONTATION'|'DECISION'|'TRANSFORMATION'|'BRAND_REVEAL'|'OFFER'} SceneId */

export const EXPERIENCE = {
  title: 'Acabas de perder un cliente',
  brand: {
    name: 'CCM SOFTWARE_',
    legal: 'CCM SOFTWARE_ S.A.S.',
  },
  pricing: {
    amount: 600000,
    label: '$600.000 COP / mes',
    note: 'Software por suscripción mensual.',
  },
  features: [
    'Página web de rifas personalizada',
    'Panel para administrar números y ventas',
    'Clientes y comprobantes organizados',
    'Boletos digitales automáticos',
    'Estadísticas de tu rifa',
    'Soporte técnico',
  ],
  whatsappMessage:
    'Hola, quiero contratar el sistema de rifas de CCM SOFTWARE por $600.000 mensuales.',
  volumes: {
    master: 1,
    music: 0.16,
    sfx: 0.75,
    voice: 1,
    duckMusicTo: 0.04,
  },
  assets: {
    images: {
      brandLogo: '/assets/images/logo-ccm-on-light.png?v=2',
      clienteAvatar: '/assets/images/cliente-avatar.jpg',
      clienteWhatsappAvatar: '/assets/images/cliente-whatsapp.jpg?v=1',
      avatar2: '/assets/images/avatar-c2.svg',
      avatar3: '/assets/images/avatar-c3.svg',
      avatar4: '/assets/images/avatar-c4.svg',
      avatar5: '/assets/images/avatar-c5.svg',
    },
    characters: {
      caller: { name: 'Cliente interesado', gender: 'male' },
      whatsapp: { name: 'Valentina R.', gender: 'female' },
    },
    voices: {
      clienteLlamada: '/assets/audio/voices/cliente-llamada.mp3?v=amigo2',
      clienteLlamadaPerdida: '/assets/audio/voices/cliente-llamada-perdida.mp3?v=amigo2',
      narradorProblema: '/assets/audio/voices/narrador-problema.mp3?v=2',
      narradorTransformacion: '/assets/audio/voices/narrador-transformacion.mp3?v=2',
      narradorCierre: '/assets/audio/voices/narrador-cierre.mp3?v=gonzalo1',
    },
    music: {
      suspense: '/assets/audio/music/suspense.mp3',
      demoBg: '/assets/audio/music/demo-bg.mp3?v=r50',
    },
    sfx: {
      ringtone: '/assets/audio/sfx/ringtone-snap.mp3?v=r50',
      vibration: '/assets/audio/sfx/vibration.mp3?v=r50',
      callConnected: '/assets/audio/sfx/call-connected.mp3?v=r50',
      callEnded: '/assets/audio/sfx/call-ended.mp3?v=r50',
      messageReceived: '/assets/audio/sfx/wa-message-in.mp3?v=r50',
      notification: '/assets/audio/sfx/wa-notification.mp3?v=r50',
      waMessageIn: '/assets/audio/sfx/wa-message-in.mp3?v=r50',
      waNotification: '/assets/audio/sfx/wa-notification.mp3?v=r50',
      // Clicks cortos (~48ms WAV, audible iPhone)
      typingClick: '/assets/audio/sfx/tecla-a.wav?v=r50',
      typingClick2: '/assets/audio/sfx/tecla-b.wav?v=r50',
      typingClick3: '/assets/audio/sfx/tecla-c.wav?v=r50',
      cinematicImpact: '/assets/audio/sfx/cinematic-impact.mp3?v=3',
      cinematicBoom: '/assets/audio/sfx/cinematic-boom.mp3?v=terror2',
      whoosh: '/assets/audio/sfx/whoosh.mp3?v=1',
      riser: '/assets/audio/sfx/riser.mp3?v=1',
      digitalTransition: '/assets/audio/sfx/digital-transition.mp3',
      brandReveal: '/assets/audio/sfx/brand-reveal.mp3',
      suspenso: '/assets/audio/cinematic/suspenso-web.mp3?v=r50',
      chaosStress: '/assets/audio/sfx/chaos-stress.mp3?v=2',
      chaosStress2: '/assets/audio/sfx/chaos-stress-2.mp3?v=2',
    },
    cinematic: {
      suspenso: '/assets/audio/cinematic/suspenso-web.mp3?v=r50',
      boom: '/assets/audio/sfx/cinematic-boom.mp3?v=terror2',
      impact: '/assets/audio/sfx/cinematic-impact.mp3?v=3',
      reverse: '/assets/audio/cinematic/reverse-impact.mp3',
      reverb: '/assets/audio/cinematic/dark-reverb.mp3',
      typeImpact: '/assets/audio/cinematic/dark-type-impact.mp3',
      subBass: '/assets/audio/cinematic/sub-bass-pulse.mp3',
      ambience: '/assets/audio/cinematic/dark-ambience.mp3',
      heartbeat: '/assets/audio/cinematic/heartbeat.mp3',
    },
    video: {
      demo: '/assets/video/software-demo-narrated.mp4?v=moto1',
      demoWebm: '/assets/video/software-demo-narrated.webm?v=moto1',
      demoNarrated: '/assets/video/software-demo-narrated.mp4?v=moto1',
      demoNarratedWebm: '/assets/video/software-demo-narrated.webm?v=moto1',
    },
  },
  subtitleFallbacks: {
    clienteLlamada:
      '¿Aló? Amigo, te escribí hace rato porque quería comprarte unos números de la rifa y nada que me confirmabas. Llevo esperando pa saber cuáles tienes disponibles. ¿Sabes qué? Tranquilo, ya compré en otro lado.',
    clienteLlamadaPerdida:
      'Hola, te estaba llamando porque quería comprarte unos números de la rifa, pero no logré comunicarme. Ya compré en otro lado. Gracias.',
    narradorProblema:
      'No es que tus clientes no quieran comprarte números. Es que se cansan de un proceso manual. Mientras anotas una venta, otro comprador ya está buscando otra rifa. Mientras revisas un comprobante, se te cruzan los números. Tu negocio de rifas no debería depender de un cuaderno, un Excel, o de que tú estés disponible.',
    narradorTransformacion:
      'Imagina que tus clientes entran a tu propia página web de rifas. Consultan números disponibles, eligen, pagan y reciben su boleto digital. Tú ves cada venta ordenada en tu panel: clientes, comprobantes y estadísticas. Eso es CCM SOFTWARE. El sistema para administrar y comercializar rifas.',
    narradorCierre:
      'Puedes seguir vendiendo números a mano. O puedes administrar tu rifa con un sistema profesional. El siguiente movimiento es tuyo.',
  },
};

/** Solo intro (sin Nokia: se precarga al entrar a la llamada) */
export const CRITICAL_ASSETS = [
  EXPERIENCE.assets.sfx.vibration,
  EXPERIENCE.assets.sfx.typingClick,
  EXPERIENCE.assets.sfx.typingClick2,
  EXPERIENCE.assets.sfx.typingClick3,
];

/** Ola inmediata al salir del intro: llamada + chat */
export const NEXT_WAVE_ASSETS = [
  EXPERIENCE.assets.sfx.ringtone,
  EXPERIENCE.assets.sfx.callConnected,
  EXPERIENCE.assets.sfx.callEnded,
  EXPERIENCE.assets.sfx.waMessageIn,
  EXPERIENCE.assets.sfx.waNotification,
  EXPERIENCE.assets.music.suspense,
  EXPERIENCE.assets.voices.clienteLlamada,
  EXPERIENCE.assets.voices.clienteLlamadaPerdida,
];

/** Ola tardía: caos / narración / demo (se pide al entrar a CHAOS o DECISION) */
export const LATE_WAVE_ASSETS = [
  EXPERIENCE.assets.sfx.suspenso,
  EXPERIENCE.assets.sfx.cinematicImpact,
  EXPERIENCE.assets.sfx.cinematicBoom,
  EXPERIENCE.assets.sfx.digitalTransition,
  EXPERIENCE.assets.sfx.brandReveal,
  EXPERIENCE.assets.music.demoBg,
  EXPERIENCE.assets.voices.narradorProblema,
  EXPERIENCE.assets.voices.narradorTransformacion,
  EXPERIENCE.assets.voices.narradorCierre,
];
