import { escapeHtml } from '../utils/helpers';

export type FlagSizeVariant = 'inline' | 'board' | 'hero';

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
};

export function renderTeamFlagHtml(key: string, fallbackEmoji: string, variant: FlagSizeVariant = 'inline'): string {
  const variantClass =
    variant === 'hero' ? 'team-flag-hero' : variant === 'board' ? 'team-flag-board' : 'team-flag-inline';
  const normKey = String(key || '').trim().toUpperCase();
  const builder = SVG_FLAGS[normKey];
  if (builder) return builder(variantClass);
  return `<span class="team-flag-fallback ${variantClass}">${escapeHtml(fallbackEmoji || '🏳️')}</span>`;
}