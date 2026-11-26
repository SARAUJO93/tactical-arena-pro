import { BIOMES, BiomeTheme } from '../config/biomes';
import { GiftSlot, RoundLog } from '../core/GameState';

export interface BalanceAnalyticsOptions {
  minRoundsForAlert?: number;
  imbalanceThresholdPct?: number;
}

export interface BiomeBalanceStat {
  biomeId: BiomeTheme['id'];
  name: string;
  icon: string;
  rounds: number;
  teamAWins: number;
  teamBWins: number;
  teamAPct: number;
  avgDurationSec: number;
  alert: string | null;
}

export interface GiftUsageStat {
  label: string;
  display: string;
  coins: number;
  emoji: string;
  count: number;
  totalCoins: number;
  sharePct: number;
}

export interface BalanceReport {
  totalRounds: number;
  teamAWinPct: number;
  suddenDeathPct: number;
  avgDurationSec: number;
  alertCount: number;
  biomes: BiomeBalanceStat[];
  giftUsage: GiftUsageStat[];
  unusedGifts: Array<{ label: string; display: string; coins: number; emoji: string }>;
}

export function computeBalanceReport(
  roundLogs: RoundLog[],
  giftSlots: GiftSlot[],
  giftBreakdown: Record<string, { count: number; coins: number }>,
  options: BalanceAnalyticsOptions = {}
): BalanceReport {
  const minRoundsForAlert = Math.max(1, Math.floor(options.minRoundsForAlert ?? 4));
  const highThreshold = Math.min(95, Math.max(55, options.imbalanceThresholdPct ?? 65));
  const lowThreshold = 100 - highThreshold;

  const totalRounds = roundLogs.length;
  let totalTeamAWins = 0;
  let suddenDeathCount = 0;
  let totalDuration = 0;

  const biomeMap = new Map<string, { a: number; b: number; duration: number }>();
  for (const b of BIOMES) biomeMap.set(b.id, { a: 0, b: 0, duration: 0 });

  for (const log of roundLogs) {
    if (log.winner === 'A') totalTeamAWins += 1;
    if (log.suddenDeath) suddenDeathCount += 1;
    const dur = Math.max(0, log.durationSec);
    totalDuration += dur;

    const bucket = biomeMap.get(log.biome);
    if (bucket) {
      if (log.winner === 'A') bucket.a += 1;
      else bucket.b += 1;
      bucket.duration += dur;
    }
  }

  let alertCount = 0;
  const biomes: BiomeBalanceStat[] = BIOMES.map((b) => {
    const counts = biomeMap.get(b.id) ?? { a: 0, b: 0, duration: 0 };
    const rounds = counts.a + counts.b;
    const teamAPct = rounds > 0 ? Math.round((counts.a / rounds) * 100) : 50;
    const avgDurationSec = rounds > 0 ? Math.round(counts.duration / rounds) : 0;
    let alert: string | null = null;
    if (rounds >= minRoundsForAlert && (teamAPct >= highThreshold || teamAPct <= lowThreshold)) {
      alert = teamAPct >= highThreshold ? 'Desbalance Norte' : 'Desbalance Sur';
      alertCount += 1;
    }
    return {
      biomeId: b.id,
      name: b.name,
      icon: b.icon,
      rounds,
      teamAWins: counts.a,
      teamBWins: counts.b,
      teamAPct,
      avgDurationSec,
      alert,
    };
  });

  const normalizedBreakdown = new Map<string, { count: number; coins: number }>();
  for (const [name, info] of Object.entries(giftBreakdown)) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    const prev = normalizedBreakdown.get(key) ?? { count: 0, coins: 0 };
    normalizedBreakdown.set(key, {
      count: prev.count + Math.max(0, info.count),
      coins: prev.coins + Math.max(0, info.coins),
    });
  }

  const rawGiftUsage = giftSlots.map((slot) => {
    const candidates = new Set(
      [slot.display, ...(slot.matchers || '').split(',')]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    let count = 0;
    let totalCoins = 0;
    for (const token of candidates) {
      const info = normalizedBreakdown.get(token);
      if (info) {
        count += info.count;
        totalCoins += info.coins;
      }
    }
    return {
      label: slot.label,
      display: slot.display,
      coins: slot.coins,
      emoji: slot.emoji,
      count,
      totalCoins,
    };
  });

  const totalCatalogCount = rawGiftUsage.reduce((sum, g) => sum + g.count, 0);
  const giftUsage: GiftUsageStat[] = rawGiftUsage.map((g) => ({
    ...g,
    sharePct: totalCatalogCount > 0 ? Math.round((g.count / totalCatalogCount) * 100) : 0,
  }));

  const unusedGifts = giftUsage
    .filter((g) => g.count === 0)
    .map(({ label, display, coins, emoji }) => ({ label, display, coins, emoji }));

  return {
    totalRounds,
    teamAWinPct: totalRounds > 0 ? Math.round((totalTeamAWins / totalRounds) * 100) : 50,
    suddenDeathPct: totalRounds > 0 ? Math.round((suddenDeathCount / totalRounds) * 100) : 0,
    avgDurationSec: totalRounds > 0 ? Math.round(totalDuration / totalRounds) : 0,
    alertCount,
    biomes,
    giftUsage,
    unusedGifts,
  };
}