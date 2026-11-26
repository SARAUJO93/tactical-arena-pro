interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const MIN_COLOR_DISTANCE = 195;
const MIN_HUE_DIFF_DEG = 34;
const MIN_ARENA_LUMINANCE = 0.2;

// Colores alternativos ("visitante") de alta visibilidad inspirados en banderas/equipaciones
const AWAY_COLOR_BY_KEY: Record<string, string[]> = {
  MX: ['#F8FAFC', '#F43F5E', '#FBBF24'],
  AR: ['#FACC15', '#F8FAFC', '#A855F7'],
  BR: ['#38BDF8', '#F8FAFC', '#10B981'],
  FR: ['#F8FAFC', '#F43F5E', '#FBBF24'],
  ES: ['#FACC15', '#38BDF8', '#F8FAFC'],
  DE: ['#FACC15', '#F8FAFC', '#F43F5E'],
  IT: ['#F8FAFC', '#10B981', '#F43F5E'],
  PT: ['#10B981', '#FACC15', '#F8FAFC'],
  GB: ['#F8FAFC', '#38BDF8', '#FBBF24'],
  US: ['#38BDF8', '#F8FAFC', '#FACC15'],
  CA: ['#F8FAFC', '#38BDF8', '#FACC15'],
  VN: ['#FACC15', '#38BDF8', '#F8FAFC'],
  JP: ['#38BDF8', '#F8FAFC', '#FACC15'],
  KR: ['#38BDF8', '#F8FAFC', '#FACC15'],
  CO: ['#38BDF8', '#F43F5E', '#F8FAFC'],
  CL: ['#38BDF8', '#F8FAFC', '#FACC15'],
  PE: ['#F8FAFC', '#38BDF8', '#FACC15'],
  UY: ['#FACC15', '#F8FAFC', '#F43F5E'],
  EC: ['#38BDF8', '#F43F5E', '#F8FAFC'],
  SA: ['#F8FAFC', '#FACC15', '#38BDF8'],
  NL: ['#38BDF8', '#F8FAFC', '#A855F7'],
  BE: ['#FACC15', '#38BDF8', '#F8FAFC'],
};

const TACTICAL_FALLBACK_PALETTE = [
  '#38BDF8', // Cian eléctrico
  '#FACC15', // Dorado táctico
  '#F43F5E', // Carmesí brillante
  '#10B981', // Esmeralda
  '#C084FC', // Violeta neón
  '#FB923C', // Naranja intenso
  '#E2E8F0', // Blanco hielo
  '#A3E635', // Lima neón
];

function parseHex(hex: string): RgbColor | null {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = Number.parseInt(clean[0] + clean[0], 16);
    const g = Number.parseInt(clean[1] + clean[1], 16);
    const b = Number.parseInt(clean[2] + clean[2], 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
  }
  if (clean.length === 6) {
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
  }
  return null;
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: RgbColor): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
      : max === gn
        ? ((bn - rn) / d + 2) * 60
        : ((rn - gn) / d + 4) * 60;

  return { h, s, l };
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Distancia perceptual "redmean" (0 = idénticos, ~765 = blanco vs negro)
export function perceptualColorDistance(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return 0;
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}

function ensureVisibleOnArena(hex: string, fallback: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return fallback;
  if (relativeLuminance(rgb) >= MIN_ARENA_LUMINANCE) return hex.toUpperCase();

  // Aclara colores muy oscuros hacia blanco manteniendo el matiz
  const mix = 0.42;
  return rgbToHex({
    r: rgb.r + (255 - rgb.r) * mix,
    g: rgb.g + (255 - rgb.g) * mix,
    b: rgb.b + (255 - rgb.b) * mix,
  });
}

export function colorsContrastWell(hexA: string, hexB: string): boolean {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return false;

  const dist = perceptualColorDistance(hexA, hexB);
  const hslA = rgbToHsl(a);
  const hslB = rgbToHsl(b);

  // Si uno es neutro (ej. blanco/plata) y el otro saturado, basta distancia + luminancia
  if (hslA.s < 0.18 || hslB.s < 0.18) {
    return dist >= 180 && Math.abs(relativeLuminance(a) - relativeLuminance(b)) >= 0.22;
  }

  const rawHueDiff = Math.abs(hslA.h - hslB.h);
  const hueDiff = Math.min(rawHueDiff, 360 - rawHueDiff);
  return dist >= MIN_COLOR_DISTANCE && hueDiff >= MIN_HUE_DIFF_DEG;
}

export function resolveContrastingTeamColors(
  rawColorA: string,
  rawColorB: string,
  keyB = ''
): { colorA: string; colorB: string } {
  const colorA = ensureVisibleOnArena(rawColorA, '#10B981');
  const candidateB = ensureVisibleOnArena(rawColorB, '#38BDF8');

  if (colorsContrastWell(colorA, candidateB)) {
    return { colorA, colorB: candidateB };
  }

  const awayCandidates = AWAY_COLOR_BY_KEY[keyB.toUpperCase()] ?? [];
  const pool = [...awayCandidates, ...TACTICAL_FALLBACK_PALETTE];

  for (const option of pool) {
    const visible = ensureVisibleOnArena(option, option);
    if (colorsContrastWell(colorA, visible)) {
      return { colorA, colorB: visible };
    }
  }

  // Último recurso: el color con mayor distancia perceptual de la paleta
  let best = TACTICAL_FALLBACK_PALETTE[0];
  let bestDist = -1;
  for (const option of TACTICAL_FALLBACK_PALETTE) {
    const d = perceptualColorDistance(colorA, option);
    if (d > bestDist) {
      bestDist = d;
      best = option;
    }
  }
  return { colorA, colorB: best };
}