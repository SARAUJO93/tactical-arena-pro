import { PlayerRecord, SeasonData } from '../core/GameState';
import { BIOME_EXPLORER_BADGE } from './PersonalProgress';

export interface SeasonPassTier {
  tier: number;
  id: string;
  xpRequired: number;
  title: string;
  emblem: string;
  ringColor: string;
  outerRingColor?: string;
}

export interface SeasonPassProgress {
  xp: number;
  current: SeasonPassTier | null;
  next: SeasonPassTier | null;
  progressPct: number;
  unlockedIds: string[];
}

export interface AvatarCosmeticStyle {
  emblem: string;
  title: string;
  ringColor: string;
  outerRingColor?: string;
}

export const SEASON_PASS_TIERS: readonly SeasonPassTier[] = [
  { tier: 1, id: 'sp_t1_bronze', xpRequired: 30, title: 'Aspirante', emblem: '🔰', ringColor: '#CD7F32' },
  { tier: 2, id: 'sp_t2_silver', xpRequired: 100, title: 'Vanguardia', emblem: '⚔️', ringColor: '#CBD5E1' },
  { tier: 3, id: 'sp_t3_emerald', xpRequired: 220, title: 'Centinela', emblem: '🛡️', ringColor: '#34D399' },
  { tier: 4, id: 'sp_t4_gold', xpRequired: 400, title: 'Élite', emblem: '🔥', ringColor: '#FBBF24', outerRingColor: '#FDE68A' },
  { tier: 5, id: 'sp_t5_prism', xpRequired: 650, title: 'Campeón', emblem: '⚡', ringColor: '#38BDF8', outerRingColor: '#C084FC' },
  { tier: 6, id: 'sp_t6_mythic', xpRequired: 1000, title: 'Inmortal', emblem: '👑', ringColor: '#FDE047', outerRingColor: '#FB7185' },
];

export function computeSeasonXp(rec: PlayerRecord | undefined): number {
  if (!rec) return 0;
  const taps = Math.max(0, rec.period.tapsSeason);
  const coins = Math.max(0, rec.period.coinsSeason);
  const mvps = Math.max(0, rec.mvpRounds);
  const streakXp = Math.max(0, rec.streakXp ?? 0);
  return Math.floor(taps + Math.sqrt(coins) * 8 + mvps * 50 + streakXp);
}

export function getSeasonPassProgress(xpRaw: number): SeasonPassProgress {
  const xp = Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  let current: SeasonPassTier | null = null;
  const unlockedIds: string[] = [];

  for (const tier of SEASON_PASS_TIERS) {
    if (xp >= tier.xpRequired) {
      current = tier;
      unlockedIds.push(tier.id);
    } else {
      break;
    }
  }

  const nextIdx = current ? current.tier : 0;
  const next = SEASON_PASS_TIERS[nextIdx] ?? null;
  const floorXp = current ? current.xpRequired : 0;
  const progressPct = next
    ? Math.min(100, Math.round(((xp - floorXp) / Math.max(1, next.xpRequired - floorXp)) * 100))
    : 100;

  return { xp, current, next, progressPct, unlockedIds };
}

/**
 * Sincroniza las insignias desbloqueadas en PlayerRecord.badges.
 * Devuelve el tier más alto recién desbloqueado, o null si no hubo cambio.
 */
export function syncSeasonPassBadges(rec: PlayerRecord): SeasonPassTier | null {
  const progress = getSeasonPassProgress(computeSeasonXp(rec));
  let newlyUnlocked: SeasonPassTier | null = null;

  for (const tier of SEASON_PASS_TIERS) {
    if (progress.xp >= tier.xpRequired && !rec.badges.includes(tier.id)) {
      rec.badges.push(tier.id);
      if (rec.badges.length > 100) rec.badges.shift();
      newlyUnlocked = tier;
    }
  }

  return newlyUnlocked;
}

export function getCosmeticFrameFromBadges(badges: string[] | undefined): AvatarCosmeticStyle | undefined {
  if (!badges || badges.length === 0) return undefined;
  let passStyle: AvatarCosmeticStyle | undefined;
  for (let i = SEASON_PASS_TIERS.length - 1; i >= 0; i--) {
    const tier = SEASON_PASS_TIERS[i];
    if (badges.includes(tier.id)) {
      passStyle = {
        emblem: tier.emblem,
        title: tier.title,
        ringColor: tier.ringColor,
        outerRingColor: tier.outerRingColor,
      };
      break;
    }
  }
  if (!badges.includes(BIOME_EXPLORER_BADGE)) return passStyle;
  return {
    emblem: '🧭',
    title: 'Explorador',
    ringColor: passStyle?.ringColor ?? '#A3E635',
    outerRingColor: '#BEF264',
  };
}

export function getPreviousSeasonChampion(seasonHistory: SeasonData[]): SeasonData | null {
  for (let i = seasonHistory.length - 1; i >= 0; i--) {
    if (seasonHistory[i]?.championName) return seasonHistory[i];
  }
  return null;
}