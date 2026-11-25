import { describe, expect, it } from 'vitest';
import { WORLD_ROSTER } from '../core/GameState';
import {
  countCompletedWorldCupMatches,
  createWorldCup,
  getCurrentWorldCupMatch,
  recordWorldCupWinner,
  sanitizeWorldCupState,
  WORLD_CUP_ROUND_COUNTS,
} from './WorldCup';

describe('WorldCup', () => {
  it('creates a 64-team bracket seeded by ELO without byes', () => {
    const ratings = Object.fromEntries(WORLD_ROSTER.map((team, index) => [team.key, index]));
    const cup = createWorldCup(WORLD_ROSTER, ratings, 1234);
    const openingMatch = getCurrentWorldCupMatch(cup);

    expect(cup.status).toBe('in_progress');
    expect(cup.startedAt).toBe(1234);
    expect(cup.rounds.map((round) => round.length)).toEqual(WORLD_CUP_ROUND_COUNTS);
    expect(openingMatch?.teamA?.key).toBe(WORLD_ROSTER[WORLD_ROSTER.length - 1].key);
    expect(openingMatch?.teamB?.key).toBe(WORLD_ROSTER[0].key);
    expect(cup.rounds[0].every((match) => match.teamA && match.teamB)).toBe(true);
    expect(cup.rounds.slice(1).flat().every((match) => !match.teamA && !match.teamB)).toBe(true);
  });

  it('advances all 63 matches and records a champion', () => {
    const cup = createWorldCup(WORLD_ROSTER, {}, 1234);
    let matchesPlayed = 0;

    while (cup.status === 'in_progress') {
      const match = getCurrentWorldCupMatch(cup);
      expect(match?.teamA).toBeTruthy();
      expect(match?.teamB).toBeTruthy();
      recordWorldCupWinner(cup, match!.teamA!.key);
      matchesPlayed++;
    }

    expect(matchesPlayed).toBe(63);
    expect(countCompletedWorldCupMatches(cup)).toBe(63);
    expect(cup.status).toBe('completed');
    expect(cup.champion?.key).toBe(WORLD_ROSTER[0].key);
    expect(sanitizeWorldCupState(cup)).toEqual(cup);
  });

  it('rejects winners outside the active match and malformed saved brackets', () => {
    const cup = createWorldCup(WORLD_ROSTER, {}, 1234);

    expect(() => recordWorldCupWinner(cup, 'NOT-IN-MATCH')).toThrow(/no participa/i);
    expect(sanitizeWorldCupState({ status: 'in_progress', startedAt: 1234, rounds: [], champion: null })).toBeNull();
  });
});
