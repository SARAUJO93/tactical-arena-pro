import { describe, expect, it } from 'vitest';
import { DEFAULT_GIFT_SLOTS, RoundLog } from '../core/GameState';
import { computeBalanceReport } from './BalanceAnalytics';

function makeRound(overrides: Partial<RoundLog> = {}): RoundLog {
  return {
    id: `r_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    durationSec: 120,
    winner: 'A',
    winnerKey: 'MX',
    winnerName: 'MÉXICO',
    loserKey: 'AR',
    loserName: 'ARGENTINA',
    suddenDeath: false,
    featured: false,
    biome: 'grove',
    totalCoins: 50,
    totalTaps: 40,
    mvp: null,
    topGifter: null,
    ...overrides,
  };
}

describe('BalanceAnalytics', () => {
  it('devuelve valores neutros cuando no hay rondas ni regalos', () => {
    const report = computeBalanceReport([], DEFAULT_GIFT_SLOTS, {});

    expect(report.totalRounds).toBe(0);
    expect(report.teamAWinPct).toBe(50);
    expect(report.suddenDeathPct).toBe(0);
    expect(report.avgDurationSec).toBe(0);
    expect(report.alertCount).toBe(0);
    expect(report.biomes.every((b) => b.teamAPct === 50 && b.avgDurationSec === 0 && b.alert === null)).toBe(true);
    expect(report.unusedGifts).toHaveLength(DEFAULT_GIFT_SLOTS.length);
  });

  it('calcula win rate global, duración media por bioma y alertas de desbalance', () => {
    const logs: RoundLog[] = [
      makeRound({ biome: 'grove', winner: 'A', durationSec: 100 }),
      makeRound({ biome: 'grove', winner: 'A', durationSec: 140 }),
      makeRound({ biome: 'grove', winner: 'A', durationSec: 120 }),
      makeRound({ biome: 'grove', winner: 'B', durationSec: 160, suddenDeath: true }),
      makeRound({ biome: 'volcano', winner: 'B', durationSec: 90, suddenDeath: true }),
      makeRound({ biome: 'volcano', winner: 'B', durationSec: 110 }),
      makeRound({ biome: 'volcano', winner: 'B', durationSec: 100 }),
      makeRound({ biome: 'volcano', winner: 'B', durationSec: 100 }),
    ];

    const report = computeBalanceReport(logs, DEFAULT_GIFT_SLOTS, {});
    const grove = report.biomes.find((b) => b.biomeId === 'grove')!;
    const volcano = report.biomes.find((b) => b.biomeId === 'volcano')!;

    expect(report.totalRounds).toBe(8);
    expect(report.teamAWinPct).toBe(38); // 3/8
    expect(report.suddenDeathPct).toBe(25); // 2/8
    expect(report.avgDurationSec).toBe(115);
    expect(report.alertCount).toBe(2);

    expect(grove).toMatchObject({ rounds: 4, teamAWins: 3, teamBWins: 1, teamAPct: 75, avgDurationSec: 130, alert: 'Desbalance Norte' });
    expect(volcano).toMatchObject({ rounds: 4, teamAWins: 0, teamBWins: 4, teamAPct: 0, avgDurationSec: 100, alert: 'Desbalance Sur' });
  });

  it('mide uso de regalos por alias/display y lista correctamente los regalos sin uso', () => {
    const report = computeBalanceReport([], DEFAULT_GIFT_SLOTS, {
      Rosa: { count: 3, coins: 3 },
      Doughnut: { count: 1, coins: 30 },
    });

    const rose = report.giftUsage.find((g) => g.display === 'Rose')!;
    const dona = report.giftUsage.find((g) => g.display === 'Dona')!;

    expect(rose).toMatchObject({ count: 3, totalCoins: 3, sharePct: 75 });
    expect(dona).toMatchObject({ count: 1, totalCoins: 30, sharePct: 25 });
    expect(report.unusedGifts).toHaveLength(DEFAULT_GIFT_SLOTS.length - 2);
    expect(report.unusedGifts.some((g) => g.display === 'Rose')).toBe(false);
    expect(report.unusedGifts.some((g) => g.display === 'Dona')).toBe(false);
  });
});