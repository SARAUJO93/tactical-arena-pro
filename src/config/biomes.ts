export interface BiomeTheme {
  id: 'grove' | 'frost' | 'volcano' | 'desert';
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