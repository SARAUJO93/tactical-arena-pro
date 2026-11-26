import type { PlayerRecord } from '../core/GameState';

const MS_PER_DAY = 86_400_000;
export const DAILY_STREAK_XP_PER_DAY = 10;
export const DAILY_STREAK_MAX_XP_BONUS = 50;

export interface DailyStreakUpdate {
  streak: number;
  bestStreak: number;
  isFirstVisitToday: boolean;
  streakExtended: boolean;
  streakReset: boolean;
  xpBonus: number;
}

export function getLocalDayKey(ts: number): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDayKeyUtc(dayKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function getDayDifference(prevDayKey: string, currentDayKey: string): number | null {
  const prevUtc = parseDayKeyUtc(prevDayKey);
  const currUtc = parseDayKeyUtc(currentDayKey);
  if (prevUtc === null || currUtc === null) return null;
  return Math.round((currUtc - prevUtc) / MS_PER_DAY);
}

export function getDailyStreakXpBonus(streak: number): number {
  if (!Number.isFinite(streak) || streak < 2) return 0;
  return Math.min(DAILY_STREAK_MAX_XP_BONUS, Math.floor(streak) * DAILY_STREAK_XP_PER_DAY);
}

/**
 * Registra la visita diaria de un viewer en su PlayerRecord.
 * Es idempotente dentro del mismo día calendario local.
 */
export function recordDailyVisit(rec: PlayerRecord, now = Date.now()): DailyStreakUpdate {
  const todayKey = getLocalDayKey(now);
  const prevDay = rec.lastStreakDay;
  const prevStreak = Math.max(0, Math.floor(rec.dailyStreak ?? 0));
  const prevBest = Math.max(prevStreak, Math.floor(rec.bestDailyStreak ?? 0));

  if (prevDay) {
    const dayDiff = getDayDifference(prevDay, todayKey);
    if (dayDiff !== null && dayDiff <= 0) {
      const safeStreak = Math.max(1, prevStreak);
      return {
        streak: safeStreak,
        bestStreak: Math.max(prevBest, safeStreak),
        isFirstVisitToday: false,
        streakExtended: false,
        streakReset: false,
        xpBonus: 0,
      };
    }

    if (dayDiff === 1) {
      const nextStreak = Math.max(1, prevStreak) + 1;
      const nextBest = Math.max(prevBest, nextStreak);
      const xpBonus = getDailyStreakXpBonus(nextStreak);
      rec.dailyStreak = nextStreak;
      rec.bestDailyStreak = nextBest;
      rec.lastStreakDay = todayKey;
      rec.streakXp = Math.max(0, Math.floor(rec.streakXp ?? 0)) + xpBonus;

      return {
        streak: nextStreak,
        bestStreak: nextBest,
        isFirstVisitToday: true,
        streakExtended: true,
        streakReset: false,
        xpBonus,
      };
    }
  }

  const streakReset = prevStreak >= 2;
  const nextBest = Math.max(prevBest, 1);
  rec.dailyStreak = 1;
  rec.bestDailyStreak = nextBest;
  rec.lastStreakDay = todayKey;

  return {
    streak: 1,
    bestStreak: nextBest,
    isFirstVisitToday: true,
    streakExtended: false,
    streakReset,
    xpBonus: 0,
  };
}