import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetDaily,
  sanitizePlayerRecords,
  sanitizeRoundLogs,
  sanitizeSessionMvp,
  sanitizeTeamRecords,
  state,
} from './GameState';

class FakeStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('Fase 1 - persistencia robusta', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sanitiza MVPs con equipo, puntaje y URL validos', () => {
    const result = sanitizeSessionMvp({
      one: { user: '@uno', team: 'A', avatarUrl: 'https://avatar', score: 120 },
      badTeam: { user: '@bad', team: 'C', avatarUrl: '', score: 999 },
      badScore: { user: '@badscore', team: 'B', avatarUrl: '', score: -10 },
    });

    expect(result.one).toEqual({
      user: '@uno',
      team: 'A',
      avatarUrl: 'https://avatar',
      score: 120,
    });
    expect(result.badTeam).toBeUndefined();
    expect(result.badScore.score).toBe(0);
  });

  it('sanitiza registros de jugadores y equipos', () => {
    const players = sanitizePlayerRecords({
      '@fan': {
        user: '@fan',
        avatarUrl: 'https://avatar',
        favoriteTeam: 'A',
        lifetime: { taps: 20, coins: 500, gifts: 4, follows: 2, shares: 1, kills: 3, baseDamage: 900, towerKills: 2 },
        period: { coinsToday: 100, tapsToday: 10, coinsSeason: 300, tapsSeason: 50 },
        peaks: { maxSessionScore: 700, maxRoundScore: 600, maxTapsRound: 200, maxCoinsRound: 300 },
        mvpSessions: 2,
        mvpRounds: 3,
        teamsSupported: { A: 40, B: -5 },
        badges: ['veteran'],
      },
    });
    expect(players['@fan'].favoriteTeam).toBe('A');
    expect(players['@fan'].lifetime.coins).toBe(500);
    expect(players['@fan'].teamsSupported.B).toBe(0);

    const teams = sanitizeTeamRecords({
      MX: { key: 'MX', name: 'México', flag: '🇲🇽', color: '#10B981', wins: 4, losses: 2, elo: -50 },
    });
    expect(teams.MX.wins).toBe(4);
    expect(teams.MX.elo).toBe(0);
  });

  it('descarta rondas corruptas y conserva rondas validas', () => {
    const logs = sanitizeRoundLogs([
      { id: 'r_valid', ts: 1000, winner: 'A', durationSec: 120, totalCoins: 300, totalTaps: 50 },
      { id: 'r_bad', ts: 'ayer', winner: 'C' },
      null,
    ]);

    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('r_valid');
  });

  it('resetDaily persiste y reinicia contadores diarios', () => {
    state.playerRecords['@fan'] = {
      user: '@fan',
      avatarUrl: '',
      favoriteTeam: 'A',
      lifetime: { taps: 1, coins: 2, gifts: 3, follows: 4, shares: 5, kills: 6, baseDamage: 7, towerKills: 8 },
      period: { coinsToday: 200, tapsToday: 25, coinsSeason: 300, tapsSeason: 50 },
      peaks: { maxSessionScore: 0, maxRoundScore: 0, maxTapsRound: 0, maxCoinsRound: 0 },
      mvpSessions: 0,
      mvpRounds: 0,
      teamsSupported: {},
      badges: [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };

    resetDaily();

    expect(state.playerRecords['@fan'].period.coinsToday).toBe(0);
    expect(state.playerRecords['@fan'].period.tapsToday).toBe(0);
    expect(localStorage.getItem('tactical_arena_v2_3_league')).not.toBeNull();
  });
});
