import { BIOMES, BiomeTheme } from '../config/biomes';
import { GiftSlot, RoundLog } from '../core/GameState';

export interface BiomeBalanceStat {
  biomeId: BiomeTheme['id'];
  name: string;
  icon: string;
  rounds: number;
  teamAWins: number;
  teamBWins: number;
  teamAPct: number;
  alert: string | null;
}

export interface BalanceReport {
  totalRounds: number;
  suddenDeathPct: number;
  avgDurationSec: number;
  biomes: BiomeBalanceStat[];
  unusedGifts: Array<{ label: string; display: string; coins: number; emoji: string }>;
}

export function computeBalanceReport(
  roundLogs: RoundLog[],
  giftSlots: GiftSlot[],
  giftBreakdown: Record<string, { count: number; coins: number }>
): BalanceReport {
  const totalRounds = roundLogs.length;
  let suddenDeathCount = 0;
  let totalDuration = 0;

  const biomeMap = new Map<string, { a: number; b: number }>();
  for (const b of BIOMES) biomeMap.set(b.id, { a: 0, b: 0 });

  for (const log of roundLogs) {
    if (log.suddenDeath) suddenDeathCount += 1;
    totalDuration += Math.max(0, log.durationSec);
    const bucket = biomeMap.get(log.biome);
    if (bucket) {
      if (log.winner === 'A') bucket.a += 1;
      else bucket.b += 1;
    }
  }

  const biomes: BiomeBalanceStat[] = BIOMES.map((b) => {
    const counts = biomeMap.get(b.id) ?? { a: 0, b: 0 };
    const rounds = counts.a + counts.b;
    const teamAPct = rounds > 0 ? Math.round((counts.a / rounds) * 100) : 50;
    let alert: string | null = null;
    if (rounds >= 4 && (teamAPct >= 65 || teamAPct <= 35)) {
      alert = teamAPct >= 65 ? 'Desbalance Norte' : 'Desbalance Sur';
    }
    return {
      biomeId: b.id,
      name: b.name,
      icon: b.icon,
      rounds,
      teamAWins: counts.a,
      teamBWins: counts.b,
      teamAPct,
      alert,
    };
  });

  const usedNames = new Set(
    Object.entries(giftBreakdown)
      .filter(([, info]) => info.count > 0)
      .map(([name]) => name.trim().toLowerCase())
  );

  const unusedGifts = giftSlots
    .filter((slot) => {
      const candidates = [
        slot.display,
        ...(slot.matchers || '').split(','),
      ]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return !candidates.some((token) => usedNames.has(token));
    })
    .map((slot) => ({
      label: slot.label,
      display: slot.display,
      coins: slot.coins,
      emoji: slot.emoji,
    }));

  return {
    totalRounds,
    suddenDeathPct: totalRounds > 0 ? Math.round((suddenDeathCount / totalRounds) * 100) : 0,
    avgDurationSec: totalRounds > 0 ? Math.round(totalDuration / totalRounds) : 0,
    biomes,
    unusedGifts,
  };
}