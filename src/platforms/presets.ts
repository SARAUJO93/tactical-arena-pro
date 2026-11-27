import { PlatformId, PlatformPreset } from './types';

export const TIKTOK_PRESET: PlatformPreset = {
  id: 'tiktok',
  name: 'TikTok Live',
  shortName: 'TikTok',
  icon: '🎵',
  accent: '#FB7185',
  safeZones: {
    top: '10.4%',
    bottom: '14%',
    left: '3%',
    right: '13%',
    topLabel: 'CONTROLES SUPERIORES · 10.4%',
    bottomLabel: 'CHAT Y REGALOS · 14%',
    rightLabel: 'ICONOS TIKTOK · 13%',
    leftLabel: 'MARGEN · 3%',
  },
  labels: {
    currencyEmoji: '🪙',
    currencyName: 'Monedas',
    tapAction: 'Taps',
    tapRulePrefix: '❤️',
    wsTitle: 'TikFinity WebSocket (Auto-Reconnect)',
    wsDefaultUrl: 'ws://localhost:21213/',
    wsHint: 'Conecta TikFinity local para recibir chat, likes y regalos de TikTok Live.',
    tickerTips: [
      '❤️ {tap} Taps = Tropas',
      '⚔️ {goal} Likes = Asalto / Escudo',
      '🏆 Copa de 64 · Ciclo continuo',
      '🔥 Vuelve diario = +XP al Pase',
      '🎟️ Sube tu Pase Gratis con Taps',
      '🧭 3 biomas = Marco Explorador',
      '🤝 Taps libres = Al de menos HP',
    ],
  },
  defaultGiftSlots: [
    { tier: 1, emoji: '🌹', label: 'A: Soldados', display: 'Rosa', matchers: '5655, rose, rosa', coins: 1, imgUrl: '' },
    { tier: 1, emoji: '🍦', label: 'B: Soldados', display: 'Helado', matchers: '5827, ice cream, helado', coins: 1, imgUrl: '' },
    { tier: 2, emoji: '🍩', label: 'Tanque', display: 'Dona', matchers: '5879, doughn, dona, donut', coins: 30, imgUrl: '' },
    { tier: 3, emoji: '🎩', label: 'Jet Furtivo', display: 'Sombrero', matchers: '5760, hat, sombrero', coins: 99, imgUrl: '' },
    { tier: 5, emoji: '🛡️', label: 'Escudo 3s', display: 'Corazón', matchers: '7934, heart me, corazon', coins: 10, imgUrl: '' },
    { tier: 6, emoji: '⚡', label: 'EMP 10s', display: 'Perfume', matchers: '5658, perfume, emp', coins: 20, imgUrl: '' },
    { tier: 7, emoji: '👾', label: 'Cyber Hack', display: 'GG', matchers: '6064, gg, hack', coins: 100, imgUrl: '' },
    { tier: 4, emoji: '☢️', label: 'Nuclear', display: 'Galaxy', matchers: '5585, galaxy, galaxia, universe', coins: 1000, imgUrl: '' },
  ],
};

export const TWITCH_PRESET: PlatformPreset = {
  id: 'twitch',
  name: 'Twitch',
  shortName: 'Twitch',
  icon: '🟣',
  accent: '#A855F7',
  safeZones: {
    top: '3.5%',
    bottom: '4%',
    left: '2.5%',
    right: '2.5%',
    topLabel: 'MARGEN SUPERIOR · 3.5%',
    bottomLabel: 'MARGEN INFERIOR · 4%',
    rightLabel: 'MARGEN · 2.5%',
    leftLabel: 'MARGEN · 2.5%',
  },
  labels: {
    currencyEmoji: '💎',
    currencyName: 'Bits',
    tapAction: 'Puntos',
    tapRulePrefix: '💬',
    wsTitle: 'Twitch (Canal Directo o Bridge WS)',
    wsDefaultUrl: '',
    wsHint: 'Escribe tu canal de Twitch (ej. tu_canal) para chat y Bits directos, o una URL ws:// de Streamer.bot.',
    tickerTips: [
      '💬 {tap} Puntos/Chat = Tropas',
      '⚔️ {goal} Mensajes = Asalto / Escudo',
      '💎 Bits y Subs invocan refuerzos',
      '🏆 Copa de 64 · Ciclo continuo',
      '🎟️ Sube tu Pase Gratis participando',
      '🧭 3 biomas = Marco Explorador',
    ],
  },
  defaultGiftSlots: [
    { tier: 1, emoji: '💎', label: 'A: Soldados', display: '10 Bits', matchers: 'bits10, cheer10, pts_a', coins: 10, imgUrl: '' },
    { tier: 1, emoji: '💎', label: 'B: Soldados', display: '10 Bits', matchers: 'bits10b, cheer10b, pts_b', coins: 10, imgUrl: '' },
    { tier: 2, emoji: '🛡️', label: 'Tanque', display: '100 Bits', matchers: 'bits100, cheer100, tank', coins: 100, imgUrl: '' },
    { tier: 3, emoji: '✈️', label: 'Jet Furtivo', display: '1 Sub', matchers: 'sub, prime, bits200', coins: 200, imgUrl: '' },
    { tier: 5, emoji: '💠', label: 'Escudo 3s', display: '150 Bits', matchers: 'bits150, shield, escudo', coins: 150, imgUrl: '' },
    { tier: 6, emoji: '⚡', label: 'EMP 10s', display: '300 Bits', matchers: 'bits300, giftsub2, emp', coins: 300, imgUrl: '' },
    { tier: 7, emoji: '👾', label: 'Cyber Hack', display: '500 Bits', matchers: 'bits500, giftsub3, hack', coins: 500, imgUrl: '' },
    { tier: 4, emoji: '☢️', label: 'Nuclear', display: '1k Bits/Raid', matchers: 'bits1000, raid, giftsub5', coins: 1000, imgUrl: '' },
  ],
};

export const FACEBOOK_PRESET: PlatformPreset = {
  id: 'facebook',
  name: 'Facebook Live',
  shortName: 'FB Live',
  icon: '🔵',
  accent: '#3B82F6',
  safeZones: {
    top: '8%',
    bottom: '12%',
    left: '3%',
    right: '4%',
    topLabel: 'BARRA FB LIVE · 8%',
    bottomLabel: 'COMENTARIOS FB · 12%',
    rightLabel: 'MARGEN · 4%',
    leftLabel: 'MARGEN · 3%',
  },
  labels: {
    currencyEmoji: '⭐',
    currencyName: 'Estrellas',
    tapAction: 'Reacciones',
    tapRulePrefix: '👍',
    wsTitle: 'Facebook Live (StreamElements JWT o WS)',
    wsDefaultUrl: '',
    wsHint: 'Pega tu JWT Token de StreamElements para Estrellas, Likes y Shares, o una URL ws:// local.',
    tickerTips: [
      '👍 {tap} Reacciones = Tropas',
      '⚔️ {goal} Reacciones = Asalto / Escudo',
      '⭐ Estrellas invocan refuerzos',
      '🏆 Copa de 64 · Ciclo continuo',
      '🎟️ Sube tu Pase Gratis reaccionando',
      '🧭 3 biomas = Marco Explorador',
    ],
  },
  defaultGiftSlots: [
    { tier: 1, emoji: '⭐', label: 'A: Soldados', display: '10 ⭐', matchers: 'stars10, estrella10, fb_a', coins: 10, imgUrl: '' },
    { tier: 1, emoji: '⭐', label: 'B: Soldados', display: '10 ⭐', matchers: 'stars10b, estrella10b, fb_b', coins: 10, imgUrl: '' },
    { tier: 2, emoji: '🌟', label: 'Tanque', display: '100 ⭐', matchers: 'stars100, tank', coins: 100, imgUrl: '' },
    { tier: 3, emoji: '✈️', label: 'Jet Furtivo', display: '200 ⭐', matchers: 'stars200, share, jet', coins: 200, imgUrl: '' },
    { tier: 5, emoji: '🛡️', label: 'Escudo 3s', display: '150 ⭐', matchers: 'stars150, shield', coins: 150, imgUrl: '' },
    { tier: 6, emoji: '⚡', label: 'EMP 10s', display: '300 ⭐', matchers: 'stars300, emp', coins: 300, imgUrl: '' },
    { tier: 7, emoji: '👾', label: 'Cyber Hack', display: '500 ⭐', matchers: 'stars500, hack', coins: 500, imgUrl: '' },
    { tier: 4, emoji: '☢️', label: 'Nuclear', display: '1000 ⭐', matchers: 'stars1000, nuke, nuclear', coins: 1000, imgUrl: '' },
  ],
};

export const PLATFORM_PRESETS: Record<PlatformId, PlatformPreset> = {
  tiktok: TIKTOK_PRESET,
  twitch: TWITCH_PRESET,
  facebook: FACEBOOK_PRESET,
};

export const PLATFORM_LIST: PlatformPreset[] = [
  TIKTOK_PRESET,
  TWITCH_PRESET,
  FACEBOOK_PRESET,
];

export function getPlatformPreset(id: PlatformId): PlatformPreset {
  return PLATFORM_PRESETS[id] ?? TIKTOK_PRESET;
}