export interface BiomeTheme {
  id:
    | 'grove'
    | 'frost'
    | 'volcano'
    | 'desert'
    | 'sky-temple'
    | 'abyss'
    | 'crystal-cavern'
    | 'neon-city'
    | 'haunted-marsh'
    | 'stormfront';
  name: string;
  icon: string;
  accent: string;
  sky: [string, string, string];
  ground: [string, string, string];
  water: [string, string, string];
  bank: string;
  bridge: [string, string, string];
  bridgeLine: string;
  tower: {
    platform: string;
    wall: string;
    roof: string;
    stroke: string;
    gem: string;
    trim: string;
  };
}

export const BIOMES: readonly BiomeTheme[] = [
  {
    id: 'grove',
    name: 'BOSQUE ANCESTRAL',
    icon: '🌿',
    accent: '#9be58e',
    sky: ['#1a4a4a', '#123c39', '#0b292c'],
    ground: ['#348b55', '#236f47', '#2f8450'],
    water: ['#64d9cb', '#238f9e', '#115a70'],
    bank: '#486e5b',
    bridge: ['#657a6a', '#c9d5bd', '#4d6257'],
    bridgeLine: 'rgba(224,246,204,.52)',
    tower: { platform: '#6c7953', wall: '#d6d2a3', roof: '#9fb86b', stroke: '#465b43', gem: '#9df1a3', trim: '#d5e8a5' },
  },
  {
    id: 'frost',
    name: 'CUMBRE GLACIAL',
    icon: '❄️',
    accent: '#b8edff',
    sky: ['#285e7d', '#1b4865', '#102f4b'],
    ground: ['#e7f5f7', '#b9d9e3', '#d5edf2'],
    water: ['#d9fbff', '#70c9e6', '#347da8'],
    bank: '#739bad',
    bridge: ['#a9d8e7', '#f0fcff', '#72abc2'],
    bridgeLine: 'rgba(239,253,255,.68)',
    tower: { platform: '#7798a9', wall: '#dff5fa', roof: '#8bc9e2', stroke: '#416c83', gem: '#61e4ff', trim: '#f5ffff' },
  },
  {
    id: 'volcano',
    name: 'FALLA VOLCÁNICA',
    icon: '🌋',
    accent: '#ff9a57',
    sky: ['#542e3a', '#35212f', '#1c1423'],
    ground: ['#60464a', '#3d3038', '#514044'],
    water: ['#ffb65e', '#ef552f', '#8a2028'],
    bank: '#8b4b42',
    bridge: ['#41434b', '#81808a', '#30313a'],
    bridgeLine: 'rgba(255,188,116,.52)',
    tower: { platform: '#54424a', wall: '#777078', roof: '#403943', stroke: '#241d28', gem: '#ff663e', trim: '#ffb36b' },
  },
  {
    id: 'desert',
    name: 'DUNAS DEL SOL',
    icon: '☀️',
    accent: '#ffdfa0',
    sky: ['#927044', '#705333', '#3e3329'],
    ground: ['#e0bd7b', '#c89b5d', '#dfb976'],
    water: ['#76e1d0', '#2babb0', '#176b7a'],
    bank: '#b18b59',
    bridge: ['#a77d4b', '#f0cb8b', '#8e643e'],
    bridgeLine: 'rgba(255,236,185,.62)',
    tower: { platform: '#9c7548', wall: '#f0d7a0', roof: '#c99853', stroke: '#765334', gem: '#fff0a0', trim: '#ffebbd' },
  },
  {
    id: 'sky-temple',
    name: 'CIUDADELA CELESTE',
    icon: '☁️',
    accent: '#fde68a',
    sky: ['#536b9c', '#9c8fc2', '#f0c6b5'],
    ground: ['#b2a7c7', '#81799e', '#a69db9'],
    water: ['#d7efff', '#9fc8e8', '#788fbb'],
    bank: '#8f86a7',
    bridge: ['#b8abc3', '#f4dfc2', '#8e81a5'],
    bridgeLine: 'rgba(255,238,196,.68)',
    tower: { platform: '#8c83a5', wall: '#e6d9d4', roof: '#c5a9c5', stroke: '#5d587a', gem: '#fff0a8', trim: '#f6dfb1' },
  },
  {
    id: 'abyss',
    name: 'ABISMO CORALINO',
    icon: '🐚',
    accent: '#67e8f9',
    sky: ['#123d60', '#092f50', '#061d38'],
    ground: ['#1d6173', '#15495f', '#1b566c'],
    water: ['#5eead4', '#0e7490', '#082f49'],
    bank: '#17465b',
    bridge: ['#24566b', '#64b8bb', '#173b55'],
    bridgeLine: 'rgba(153,246,228,.48)',
    tower: { platform: '#24536a', wall: '#90c8c0', roof: '#398d9b', stroke: '#0c2d45', gem: '#71f4ec', trim: '#b8fff0' },
  },
  {
    id: 'crystal-cavern',
    name: 'CAVERNA PRISMÁTICA',
    icon: '💎',
    accent: '#e9a8ff',
    sky: ['#39285f', '#291e4b', '#17152f'],
    ground: ['#6b4c91', '#49356f', '#5a4381'],
    water: ['#dc9cff', '#8b5bd1', '#442b7a'],
    bank: '#5b477c',
    bridge: ['#725b91', '#d2adf0', '#55416f'],
    bridgeLine: 'rgba(244,208,255,.62)',
    tower: { platform: '#69527f', wall: '#d8c3e8', roof: '#aa7acb', stroke: '#38284f', gem: '#f5bcff', trim: '#e9d5ff' },
  },
  {
    id: 'neon-city',
    name: 'METRÓPOLIS NEÓN',
    icon: '🌃',
    accent: '#22d3ee',
    sky: ['#171b4b', '#11183b', '#090f26'],
    ground: ['#343b66', '#252b50', '#30375f'],
    water: ['#22d3ee', '#7c3aed', '#1d2b63'],
    bank: '#292f56',
    bridge: ['#3b426b', '#7984b7', '#252a4e'],
    bridgeLine: 'rgba(103,232,249,.68)',
    tower: { platform: '#41466f', wall: '#8794bc', roof: '#a855f7', stroke: '#171a3c', gem: '#67e8f9', trim: '#f0abfc' },
  },
  {
    id: 'haunted-marsh',
    name: 'PANTANO ESPECTRAL',
    icon: '👻',
    accent: '#a3e635',
    sky: ['#30433c', '#202f2b', '#111d20'],
    ground: ['#536648', '#394b3b', '#46583f'],
    water: ['#9cae55', '#506b45', '#253f3b'],
    bank: '#3e503b',
    bridge: ['#5a5544', '#9b8a60', '#3e4438'],
    bridgeLine: 'rgba(217,249,157,.45)',
    tower: { platform: '#555846', wall: '#a4a17b', roof: '#66764b', stroke: '#222d27', gem: '#c4f27a', trim: '#e5f3b0' },
  },
  {
    id: 'stormfront',
    name: 'CIMA DE LA TORMENTA',
    icon: '⛈️',
    accent: '#c4b5fd',
    sky: ['#495572', '#343e5c', '#202941'],
    ground: ['#626b7d', '#444e63', '#555f73'],
    water: ['#b3c5d8', '#647f9b', '#354c68'],
    bank: '#4b5668',
    bridge: ['#596579', '#bac7d5', '#414d61'],
    bridgeLine: 'rgba(219,234,254,.58)',
    tower: { platform: '#5b6678', wall: '#bdc8d0', roof: '#7f8eab', stroke: '#2c374b', gem: '#d8ccff', trim: '#e6f0ff' },
  },
];

let biomeCursor = 0;
let currentBiome: BiomeTheme = BIOMES[0];

export function getActiveBiome(): BiomeTheme {
  return currentBiome;
}

export function setActiveBiome(id: BiomeTheme['id']): BiomeTheme {
  const idx = BIOMES.findIndex((b) => b.id === id);
  if (idx >= 0) {
    biomeCursor = idx;
    currentBiome = BIOMES[idx];
  }
  return currentBiome;
}

export function cycleNextBiome(): BiomeTheme {
  biomeCursor = (biomeCursor + 1) % BIOMES.length;
  currentBiome = BIOMES[biomeCursor];
  return currentBiome;
}

export function getBiomeProgressText(): string {
  const idx = String(biomeCursor + 1).padStart(2, '0');
  const total = String(BIOMES.length).padStart(2, '0');
  return `${idx} / ${total}`;
}