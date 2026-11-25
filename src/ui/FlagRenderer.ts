import { escapeHtml } from '../utils/helpers';

export type FlagSizeVariant = 'inline' | 'board' | 'hero';

const flagSvg = (cls: string, content: string): string =>
  `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">${content}</svg>`;

const horizontalBands = (cls: string, colors: readonly string[], weights = colors.map(() => 1)): string => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let y = 0;
  const bands = colors.map((color, index) => {
    const height = index === colors.length - 1 ? 24 - y : (24 * weights[index]) / total;
    const band = `<rect x="0" y="${y.toFixed(3)}" width="36" height="${height.toFixed(3)}" fill="${color}" stroke="none"/>`;
    y += height;
    return band;
  });
  return flagSvg(cls, bands.join(''));
};

const verticalBands = (cls: string, colors: readonly string[], weights = colors.map(() => 1)): string => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let x = 0;
  const bands = colors.map((color, index) => {
    const width = index === colors.length - 1 ? 36 - x : (36 * weights[index]) / total;
    const band = `<rect x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="24" fill="${color}" stroke="none"/>`;
    x += width;
    return band;
  });
  return flagSvg(cls, bands.join(''));
};

const starPoints = (cx: number, cy: number, outer: number, inner = outer * 0.42, points = 5): string =>
  Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(' ');

const unionJack = `
  <path d="M0 0 4 0 36 20 36 24 32 24 0 4Z M36 0 32 0 0 20 0 24 4 24 36 4Z" fill="#FFFFFF" stroke="none"/>
  <path d="M0 0 2 0 36 21 36 24 34 24 0 3Z M36 0 34 0 0 21 0 24 2 24 36 3Z" fill="#C8102E" stroke="none"/>
  <path d="M15 0h6v24h-6zM0 9h36v6H0z" fill="#FFFFFF" stroke="none"/>
  <path d="M16.5 0h3v24h-3zM0 10.5h36v3H0z" fill="#C8102E" stroke="none"/>`;

const SVG_FLAGS: Record<string, (cls: string) => string> = {
  MX: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="12" height="24" fill="#006847"/><rect x="12" width="12" height="24" fill="#FFFFFF"/><rect x="24" width="12" height="24" fill="#CE1126"/>
    <circle cx="18" cy="12" r="3.4" fill="#9A5B2A" stroke="#2E7D32" stroke-width="1"/>
  </svg>`,
  AR: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="36" height="8" fill="#74ACDF"/><rect y="8" width="36" height="8" fill="#FFFFFF"/><rect y="16" width="36" height="8" fill="#74ACDF"/>
    <circle cx="18" cy="12" r="3.2" fill="#F6B40E" stroke="#854D0E" stroke-width="0.7"/>
  </svg>`,
  CO: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="36" height="12" fill="#FCD116"/><rect y="12" width="36" height="6" fill="#003893"/><rect y="18" width="36" height="6" fill="#CE1126"/>
  </svg>`,
  ES: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="36" height="6" fill="#AA151B"/><rect y="6" width="36" height="12" fill="#F1BF00"/><rect y="18" width="36" height="6" fill="#AA151B"/>
  </svg>`,
  PE: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="12" height="24" fill="#D91023"/><rect x="12" width="12" height="24" fill="#FFFFFF"/><rect x="24" width="12" height="24" fill="#D91023"/>
  </svg>`,
  CL: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="36" height="12" fill="#FFFFFF"/><rect y="12" width="36" height="12" fill="#D52B1E"/><rect width="12" height="12" fill="#0039A6"/>
    <polygon points="6,3 7.2,6.5 10.8,6.5 7.9,8.7 9,12.2 6,10 3,12.2 4.1,8.7 1.2,6.5 4.8,6.5" fill="#FFFFFF"/>
  </svg>`,
  BR: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="36" height="24" fill="#009B3A"/><polygon points="18,3 32,12 18,21 4,12" fill="#FFDF00"/>
    <circle cx="18" cy="12" r="5.2" fill="#002776"/><path d="M13.2,11.4 Q18,9.4 22.8,13.2" fill="none" stroke="#FFFFFF" stroke-width="1.3"/>
  </svg>`,
  US: (cls) => `<svg class="team-flag-svg ${cls}" viewBox="0 0 36 24" aria-hidden="true">
    <rect width="36" height="24" fill="#FFFFFF"/>
    <path d="M0,1.8h36M0,5.5h36M0,9.2h36M0,13h36M0,16.7h36M0,20.4h36" stroke="#B22234" stroke-width="1.9"/>
    <rect width="16" height="13" fill="#3C3B6E"/>
  </svg>`,
  UY: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#FFFFFF" stroke="none"/>
    <path d="M0 2.67h36M0 8h36M0 13.33h36M0 18.67h36" stroke="#0038A8" stroke-width="2.67"/>
    <circle cx="7" cy="5.3" r="2.2" fill="#FCD116" stroke="#B8860B" stroke-width=".35"/>
    <path d="M7 2.2v6.2M3.9 5.3h6.2M4.8 3.1l4.4 4.4m0-4.4L4.8 7.5" stroke="#B8860B" stroke-width=".35"/>`),
  FR: (cls) => verticalBands(cls, ['#002395', '#FFFFFF', '#ED2939']),
  DE: (cls) => horizontalBands(cls, ['#000000', '#DD0000', '#FFCE00']),
  IT: (cls) => verticalBands(cls, ['#009246', '#FFFFFF', '#CE2B37']),
  PT: (cls) => flagSvg(cls, `
    <rect width="14.4" height="24" fill="#046A38" stroke="none"/><rect x="14.4" width="21.6" height="24" fill="#DA291C" stroke="none"/>
    <circle cx="14.4" cy="12" r="4.1" fill="#FFCD00" stroke="none"/><path d="M12.5 8.8h3.8v6.4h-3.8z" fill="#FFFFFF" stroke="#DA291C" stroke-width=".6"/>`),
  NL: (cls) => horizontalBands(cls, ['#AE1C28', '#FFFFFF', '#21468B']),
  GB: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#012169" stroke="none"/>${unionJack}`),
  EC: (cls) => flagSvg(cls, `
    <rect width="36" height="12" fill="#FFDD00" stroke="none"/><rect y="12" width="36" height="6" fill="#034EA2" stroke="none"/><rect y="18" width="36" height="6" fill="#ED1C24" stroke="none"/>
    <circle cx="18" cy="12" r="2.1" fill="#A87932" stroke="#FFFFFF" stroke-width=".35"/><path d="M18 7.8 19.2 10h-2.4z" fill="#FFFFFF" stroke="none"/>`),
  PY: (cls) => flagSvg(cls, `
    <rect width="36" height="8" fill="#D52B1E" stroke="none"/><rect y="8" width="36" height="8" fill="#FFFFFF" stroke="none"/><rect y="16" width="36" height="8" fill="#0038A8" stroke="none"/>
    <circle cx="18" cy="12" r="2.7" fill="#FFFFFF" stroke="#0038A8" stroke-width=".5"/><circle cx="18" cy="12" r="1.7" fill="none" stroke="#D52B1E" stroke-width=".45"/>`),
  BO: (cls) => horizontalBands(cls, ['#D52B1E', '#F9E300', '#007934']),
  VE: (cls) => flagSvg(cls, `
    <rect width="36" height="8" fill="#FCD116" stroke="none"/><rect y="8" width="36" height="8" fill="#003893" stroke="none"/><rect y="16" width="36" height="8" fill="#CE1126" stroke="none"/>
    ${[8, 11, 14, 17, 20, 23, 26, 29].map((x, index) => `<polygon points="${starPoints(x, index < 4 ? 11 : 13, 1.05)}" fill="#FFFFFF" stroke="none"/>`).join('')}`),
  CR: (cls) => horizontalBands(cls, ['#002B7F', '#FFFFFF', '#CE1126', '#FFFFFF', '#002B7F'], [1, 1, 2, 1, 1]),
  PA: (cls) => flagSvg(cls, `
    <rect width="18" height="12" fill="#FFFFFF" stroke="none"/><rect x="18" width="18" height="12" fill="#DA121A" stroke="none"/>
    <rect y="12" width="18" height="12" fill="#072357" stroke="none"/><rect x="18" y="12" width="18" height="12" fill="#FFFFFF" stroke="none"/>
    <polygon points="${starPoints(9, 6, 3.2)}" fill="#072357" stroke="none"/><polygon points="${starPoints(27, 18, 3.2)}" fill="#DA121A" stroke="none"/>`),
  CA: (cls) => flagSvg(cls, `
    <rect width="9" height="24" fill="#D80621" stroke="none"/><rect x="9" width="18" height="24" fill="#FFFFFF" stroke="none"/><rect x="27" width="9" height="24" fill="#D80621" stroke="none"/>
    <path d="m18 4 1.4 3.3 2.3-1.1-.7 3 2.4 1.1-2.4 1.3 1 2.5-2.7-.5-.8 4.7-.8-4.7-2.7.5 1-2.5-2.4-1.3 2.4-1.1-.7-3 2.3 1.1Z" fill="#D80621" stroke="none"/>`),
  JP: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#FFFFFF" stroke="none"/><circle cx="18" cy="12" r="6.4" fill="#BC002D" stroke="none"/>`),
  KR: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#FFFFFF" stroke="none"/>
    <path d="M18 6a6 6 0 0 0 0 12 3 3 0 0 1 0-6 3 3 0 0 0 0-6Z" fill="#CD2E3A" stroke="none"/>
    <path d="M18 6a3 3 0 0 0 0 6 3 3 0 0 1 0 6 6 6 0 0 0 0-12Z" fill="#0047A0" stroke="none"/>
    <path d="M5 4h7M5 6h7M5 8h7M24 16h7M24 18h7M24 20h7" stroke="#000000" stroke-width="1.1"/>
    <path d="M24 4h7m-7 2h3m2 0h2m-7 2h7M5 16h7m-7 2h3m2 0h2m-7 2h7" stroke="#000000" stroke-width="1.1"/>`),
  CN: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#DE2910" stroke="none"/>
    <polygon points="${starPoints(8, 7, 4.1)}" fill="#FFDE00" stroke="none"/>
    ${[[15, 4], [18, 8], [18, 13], [14, 17]].map(([x, y]) => `<polygon points="${starPoints(x, y, 1.35)}" fill="#FFDE00" stroke="none"/>`).join('')}`),
  ID: (cls) => horizontalBands(cls, ['#CE1126', '#FFFFFF']),
  PH: (cls) => flagSvg(cls, `
    <rect width="36" height="12" fill="#0038A8" stroke="none"/><rect y="12" width="36" height="12" fill="#CE1126" stroke="none"/>
    <path d="M0 0 18 12 0 24Z" fill="#FFFFFF" stroke="none"/><circle cx="5.5" cy="12" r="2" fill="#FCD116" stroke="none"/>
    ${[[2.2, 3.2], [2.2, 20.8], [12, 12]].map(([x, y]) => `<polygon points="${starPoints(x, y, 1.35)}" fill="#FCD116" stroke="none"/>`).join('')}`),
  VN: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#DA251D" stroke="none"/><polygon points="${starPoints(18, 12, 7)}" fill="#FFFF00" stroke="none"/>`),
  TH: (cls) => horizontalBands(cls, ['#A51931', '#FFFFFF', '#2D2A4A', '#FFFFFF', '#A51931'], [1, 1, 2, 1, 1]),
  AU: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#012169" stroke="none"/><g transform="scale(.5)">${unionJack}</g>
    ${[[27, 5], [30, 11], [24, 16], [31, 19], [21, 21]].map(([x, y]) => `<polygon points="${starPoints(x, y, 1.6)}" fill="#FFFFFF" stroke="none"/>`).join('')}`),
  SA: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#006C35" stroke="none"/>
    <path d="M8 16h20m-2-2 2 2-2 2" stroke="#FFFFFF" stroke-width="1.25"/><path d="M10 19q8 2 16-1" stroke="#FFFFFF" stroke-width=".45"/>`),
  MA: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#C1272D" stroke="none"/><polygon points="${starPoints(18, 12, 7, 3.1)}" fill="none" stroke="#006233" stroke-width="1.2"/>`),
  EG: (cls) => flagSvg(cls, `
    <rect width="36" height="8" fill="#CE1126" stroke="none"/><rect y="8" width="36" height="8" fill="#FFFFFF" stroke="none"/><rect y="16" width="36" height="8" fill="#000000" stroke="none"/>
    <path d="M17 8h2l1 5-2 3-2-3Z" fill="#C09300" stroke="none"/>`),
  NG: (cls) => verticalBands(cls, ['#008751', '#FFFFFF', '#008751']),
  ZA: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#FFFFFF" stroke="none"/><path d="M0 0h36v7H12L0 2Z" fill="#DE3831" stroke="none"/>
    <path d="M0 22 12 17h24v7H0Z" fill="#002395" stroke="none"/><path d="M0 0 17 10h19v4H17L0 24v-5l12-7L0 5Z" fill="#FFB81C" stroke="none"/>
    <path d="M0 2 14 10h22v4H14L0 22v-5l9-5L0 7Z" fill="#007A4D" stroke="none"/>`),
  GH: (cls) => flagSvg(cls, `
    <rect width="36" height="8" fill="#CE1126" stroke="none"/><rect y="8" width="36" height="8" fill="#FCD116" stroke="none"/><rect y="16" width="36" height="8" fill="#006B3F" stroke="none"/>
    <polygon points="${starPoints(18, 12, 4.1)}" fill="#000000" stroke="none"/>`),
  SN: (cls) => flagSvg(cls, `
    <rect width="12" height="24" fill="#00853F" stroke="none"/><rect x="12" width="12" height="24" fill="#FDEF42" stroke="none"/><rect x="24" width="12" height="24" fill="#E31B23" stroke="none"/>
    <polygon points="${starPoints(18, 12, 4)}" fill="#00853F" stroke="none"/>`),
  CI: (cls) => verticalBands(cls, ['#F77F00', '#FFFFFF', '#009A44']),
  DZ: (cls) => flagSvg(cls, `
    <rect width="18" height="24" fill="#006233" stroke="none"/><rect x="18" width="18" height="24" fill="#FFFFFF" stroke="none"/>
    <path d="M22 8a5 5 0 1 0 0 8 4 4 0 1 1 0-8Z" fill="#D21034" stroke="none"/><polygon points="${starPoints(24, 12, 2.5)}" fill="#D21034" stroke="none"/>`),
  TN: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#E70013" stroke="none"/><circle cx="18" cy="12" r="7" fill="#FFFFFF" stroke="none"/>
    <path d="M19.5 8a4.5 4.5 0 1 0 0 8 3.5 3.5 0 1 1 0-8Z" fill="#E70013" stroke="none"/><polygon points="${starPoints(21, 12, 2)}" fill="#E70013" stroke="none"/>`),
  TR: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#E30A17" stroke="none"/><circle cx="14.5" cy="12" r="6" fill="#FFFFFF" stroke="none"/>
    <circle cx="16.5" cy="12" r="4.8" fill="#E30A17" stroke="none"/><polygon points="${starPoints(22, 12, 2.7)}" fill="#FFFFFF" stroke="none"/>`),
  GR: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#FFFFFF" stroke="none"/>
    <path d="M0 0h36v2.67H0zm0 5.33h36V8H0zm0 5.34h36v2.66H0zm0 5.33h36v2.67H0z" fill="#0D5EAF" stroke="none"/>
    <rect width="13.33" height="13.33" fill="#0D5EAF" stroke="none"/><path d="M5.33 0H8v13.33H5.33zM0 5.33h13.33V8H0z" fill="#FFFFFF" stroke="none"/>`),
  SE: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#006AA7" stroke="none"/><path d="M10 0h4v24h-4zM0 10h36v4H0z" fill="#FECC00" stroke="none"/>`),
  NO: (cls) => flagSvg(cls, `
    <rect width="36" height="24" fill="#BA0C2F" stroke="none"/><path d="M10 0h7v24h-7zM0 8h36v8H0z" fill="#FFFFFF" stroke="none"/>
    <path d="M12 0h3v24h-3zM0 10.5h36v3H0z" fill="#00205B" stroke="none"/>`),
  DK: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#C8102E" stroke="none"/><path d="M10 0h4v24h-4zM0 10h36v4H0z" fill="#FFFFFF" stroke="none"/>`),
  PL: (cls) => horizontalBands(cls, ['#FFFFFF', '#DC143C']),
  HR: (cls) => flagSvg(cls, `
    <rect width="36" height="8" fill="#FF0000" stroke="none"/><rect y="8" width="36" height="8" fill="#FFFFFF" stroke="none"/><rect y="16" width="36" height="8" fill="#171796" stroke="none"/>
    <path d="M15 6h6v12h-6z" fill="#FFFFFF" stroke="#171796" stroke-width=".35"/>
    <path d="M15 6h2v2h-2zm4 0h2v2h-2zm-2 2h2v2h-2zm-2 2h2v2h-2zm4 0h2v2h-2zm-2 2h2v2h-2zm-2 2h2v2h-2zm4 0h2v2h-2z" fill="#D52B1E" stroke="none"/>`),
  RS: (cls) => flagSvg(cls, `
    <rect width="36" height="8" fill="#C6363C" stroke="none"/><rect y="8" width="36" height="8" fill="#0C4076" stroke="none"/><rect y="16" width="36" height="8" fill="#FFFFFF" stroke="none"/>
    <path d="m7 7 4 1v4q0 3-4 5-4-2-4-5V8Z" fill="#C6363C" stroke="#F5C542" stroke-width=".55"/>`),
  BE: (cls) => verticalBands(cls, ['#000000', '#FAE042', '#ED2939']),
  CH: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#D52B1E" stroke="none"/><path d="M15 5h6v5h5v5h-5v5h-6v-5h-5v-5h5z" fill="#FFFFFF" stroke="none"/>`),
  SCO: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#0065BD" stroke="none"/>
    <path d="M0 0h6l30 20v4h-6L0 4zM36 0h-6L0 20v4h6L36 4z" fill="#FFFFFF" stroke="none"/>`),
  UA: (cls) => horizontalBands(cls, ['#0057B7', '#FFD700']),
  RU: (cls) => horizontalBands(cls, ['#FFFFFF', '#0039A6', '#D52B1E']),
  AT: (cls) => horizontalBands(cls, ['#ED2939', '#FFFFFF', '#ED2939']),
  CZ: (cls) => flagSvg(cls, `<rect width="36" height="12" fill="#FFFFFF" stroke="none"/>
    <rect y="12" width="36" height="12" fill="#D7141A" stroke="none"/><path d="M0 0v24l18-12Z" fill="#11457E" stroke="none"/>`),
  IE: (cls) => verticalBands(cls, ['#169B62', '#FFFFFF', '#FF883E']),
  IS: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#003897" stroke="none"/>
    <path d="M9 0h7v24H9zM0 8.5h36v7H0z" fill="#FFFFFF" stroke="none"/>
    <path d="M11 0h3v24h-3zM0 10.5h36v3H0z" fill="#D72828" stroke="none"/>`),
  HU: (cls) => horizontalBands(cls, ['#CE2939', '#FFFFFF', '#477050']),
  RO: (cls) => verticalBands(cls, ['#002B7F', '#FCD116', '#CE1126']),
  IR: (cls) => flagSvg(cls, `<rect width="36" height="8" fill="#239F40" stroke="none"/>
    <rect y="8" width="36" height="8" fill="#FFFFFF" stroke="none"/><rect y="16" width="36" height="8" fill="#DA0000" stroke="none"/>
    <path d="M17 9v6l1 1 1-1V9zM14 12h8" fill="none" stroke="#DA0000" stroke-width="1"/>`),
  CM: (cls) => flagSvg(cls, `<rect width="12" height="24" fill="#007A5E" stroke="none"/>
    <rect x="12" width="12" height="24" fill="#CE1126" stroke="none"/><rect x="24" width="12" height="24" fill="#FCD116" stroke="none"/>
    <polygon points="${starPoints(18, 12, 4)}" fill="#FCD116" stroke="none"/>`),
  JM: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#009B3A" stroke="none"/>
    <path d="M0 0h7l29 19v5h-7L0 5zM36 0h-7L0 19v5h7L36 5z" fill="#FED100" stroke="none"/>
    <path d="M0 0h4l32 21v3h-4L0 3zM36 0h-4L0 21v3h4L36 3z" fill="#000000" stroke="none"/>`),
  NZ: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#00247D" stroke="none"/>
    <g transform="scale(.5)">${unionJack}</g>
    ${[[27, 5], [31, 11], [25, 16], [32, 20]].map(([x, y]) =>
      `<polygon points="${starPoints(x, y, 2.1)}" fill="#FFFFFF" stroke="#CC142B" stroke-width=".8"/>`).join('')}`),
  QA: (cls) => flagSvg(cls, `<rect width="36" height="24" fill="#8A1538" stroke="none"/>
    <path d="M0 0h13l2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2H0z" fill="#FFFFFF" stroke="none"/>`),
};

export function renderTeamFlagHtml(key: string, fallbackEmoji: string, variant: FlagSizeVariant = 'inline'): string {
  const variantClass =
    variant === 'hero' ? 'team-flag-hero' : variant === 'board' ? 'team-flag-board' : 'team-flag-inline';
  const normKey = String(key || '').trim().toUpperCase();
  const builder = SVG_FLAGS[normKey];
  if (builder) return builder(variantClass);
  return `<span class="team-flag-fallback ${variantClass}">${escapeHtml(fallbackEmoji || '🏳️')}</span>`;
}