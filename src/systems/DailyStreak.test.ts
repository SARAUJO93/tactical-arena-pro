import { describe, expect, it } from 'vitest';
import { PlayerRecord, sanitizePlayerRecords } from '../core/GameState';
import { computeSeasonXp } from './SeasonPass';
import {
  DAILY_STREAK_MAX_XP_BONUS,
  getDailyStreakXpBonus,
  getLocalDayKey,
  recordDailyVisit,
} from './DailyStreak';

function makePlayer(): PlayerRecord {
  const now = new Date(2026, 10, 25, 12, 0, 0).getTime();
  return {
    user: '@viewer',
    avatarUrl: '',
    favoriteTeam: 'A',
    lifetime: { taps: 0, coins: 0, gifts: 0, follows: 0, shares: 0, kills: 0, baseDamage: 0, towerKills: 0 },
    period: { coinsToday: 0, tapsToday: 0, coinsSeason: 0, tapsSeason: 0 },
    peaks: { maxSessionScore: 0, maxRoundScore: 0, maxTapsRound: 0, maxCoinsRound: 0 },
    mvpSessions: 0,
    mvpRounds: 0,
    teamsSupported: {},
    badges: [],
    firstSeen: now,
    lastSeen: now,
  };
}

describe('DailyStreak', () => {
  it('inicia la racha en día 1 sin bono y es idempotente dentro del mismo día', () => {
    const rec = makePlayer();
    const day1Morning = new Date(2026, 10, 25, 9, 0, 0).getTime();
    const day1Night = new Date(2026, 10, 25, 23, 30, 0).getTime();

    const first = recordDailyVisit(rec, day1Morning);
    expect(first).toEqual({
      streak: 1,
      bestStreak: 1,
      isFirstVisitToday: true,
      streakExtended: false,
      streakReset: false,
      xpBonus: 0,
    });
    expect(rec.lastStreakDay).toBe(getLocalDayKey(day1Morning));

    const repeat = recordDailyVisit(rec, day1Night);
    expect(repeat).toMatchObject({
      streak: 1,
      isFirstVisitToday: false,
      streakExtended: false,
      xpBonus: 0,
    });
  });

  it('extiende la racha en días consecutivos, suma XP al Pase y respeta el tope diario', () => {
    const rec = makePlayer();
    recordDailyVisit(rec, new Date(2026, 10, 28, 20, 0, 0).getTime());

    const day2 = recordDailyVisit(rec, new Date(2026, 10, 29, 10, 0, 0).getTime());
    expect(day2).toMatchObject({ streak: 2, bestStreak: 2, streakExtended: true, xpBonus: 20 });

    const day3 = recordDailyVisit(rec, new Date(2026, 10, 30, 10, 0, 0).getTime());
    expect(day3).toMatchObject({ streak: 3, bestStreak: 3, streakExtended: true, xpBonus: 30 });

    // Cruce de mes (noviembre -> diciembre)
    const day4 = recordDailyVisit(rec, new Date(2026, 11, 1, 10, 0, 0).getTime());
    expect(day4).toMatchObject({ streak: 4, bestStreak: 4, streakExtended: true, xpBonus: 40 });

    const day5 = recordDailyVisit(rec, new Date(2026, 11, 2, 10, 0, 0).getTime());
    const day6 = recordDailyVisit(rec, new Date(2026, 11, 3, 10, 0, 0).getTime());
    expect(day5.xpBonus).toBe(DAILY_STREAK_MAX_XP_BONUS);
    expect(day6.xpBonus).toBe(DAILY_STREAK_MAX_XP_BONUS);
    expect(getDailyStreakXpBonus(10)).toBe(DAILY_STREAK_MAX_XP_BONUS);

    // 20 + 30 + 40 + 50 + 50 = 190 XP acumulados en el Pase
    expect(rec.streakXp).toBe(190);
    expect(computeSeasonXp(rec)).toBe(190);
  });

  it('reinicia a día 1 si falta un día pero conserva bestDailyStreak', () => {
    const rec = makePlayer();
    recordDailyVisit(rec, new Date(2026, 10, 25, 12, 0, 0).getTime());
    recordDailyVisit(rec, new Date(2026, 10, 26, 12, 0, 0).getTime());
    recordDailyVisit(rec, new Date(2026, 10, 27, 12, 0, 0).getTime());

    // Salta el 28 y regresa el 29
    const afterGap = recordDailyVisit(rec, new Date(2026, 10, 29, 12, 0, 0).getTime());
    expect(afterGap).toEqual({
      streak: 1,
      bestStreak: 3,
      isFirstVisitToday: true,
      streakExtended: false,
      streakReset: true,
      xpBonus: 0,
    });
    expect(rec.dailyStreak).toBe(1);
    expect(rec.bestDailyStreak).toBe(3);
  });

  it('sanitiza correctamente los campos de racha diaria en persistencia', () => {
    const sanitized = sanitizePlayerRecords({
      '@leal': {
        user: '@leal',
        dailyStreak: 4,
        bestDailyStreak: 2,
        lastStreakDay: '2026-11-25',
        streakXp: 90,
      },
      '@corrupto': {
        user: '@corrupto',
        dailyStreak: -5,
        lastStreakDay: 'ayer',
        streakXp: -10,
      },
    });

    expect(sanitized['@leal'].dailyStreak).toBe(4);
    expect(sanitized['@leal'].bestDailyStreak).toBe(4);
    expect(sanitized['@leal'].lastStreakDay).toBe('2026-11-25');
    expect(sanitized['@leal'].streakXp).toBe(90);

    expect(sanitized['@corrupto'].dailyStreak).toBe(0);
    expect(sanitized['@corrupto'].lastStreakDay).toBeUndefined();
    expect(sanitized['@corrupto'].streakXp).toBe(0);
  });
});