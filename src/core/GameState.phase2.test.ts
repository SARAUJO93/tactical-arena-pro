import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginRound,
  closeCurrentSeason,
  finalizeRound,
  loadPersistentState,
  makeBaseState,
  PERSISTENCE_SCHEMA_VERSION,
  STORAGE_KEY,
  exportPersistentState,
  importPersistentState,
  listPersistenceSnapshots,
  restorePersistenceSnapshot,
  recordGift,
  resetSession,
  saveNow,
  scoreMvp,
  startNewSeason,
  state,
  WORLD_ROSTER,
} from './GameState';

class FakeStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('Fase 2 - ciclo de round', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    vi.stubGlobal('localStorage', new FakeStorage());
    state.teamA = makeBaseState(WORLD_ROSTER[0], true);
    state.teamB = makeBaseState(WORLD_ROSTER[1], false);
    state.teamRecords = {};
    state.playerRecords = {};
    state.sessionMVP = {};
    state.roundMVP = {};
    state.roundLogs = [];
    state.seasonHistory = [];
    state.currentRoundGifterCoins = {};
    state.currentSeason = {
      index: 1,
      startDate: Date.now(),
      endDate: Date.now() + 28 * 24 * 60 * 60 * 1000,
      championKey: null,
      championName: null,
      championFlag: null,
      championMvp: null,
      topMvps: [],
      standings: WORLD_ROSTER.map((team) => ({
        key: team.key,
        name: team.name,
        flag: team.flag,
        color: team.color,
        points: 0,
        participation: 0,
        wins: 0,
        losses: 0,
      })),
    };
    beginRound('grove');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reinicia el estado local al comenzar una ronda', () => {
    state.teamA.hp = 100;
    state.teamB.hp = 200;
    state.currentRoundCoins = 999;
    state.currentRoundTaps = 300;
    state.roundMVP['@old'] = { user: '@old', team: 'A', avatarUrl: '', score: 100 };

    beginRound('volcano');

    expect(state.roundActive).toBe(true);
    expect(state.teamA.hp).toBe(3000);
    expect(state.teamB.hp).toBe(3000);
    expect(state.currentRoundCoins).toBe(0);
    expect(state.currentRoundTaps).toBe(0);
    expect(state.roundMVP).toEqual({});
    expect(state.currentRoundBiome).toBe('volcano');
  });

  it('finaliza una victoria una sola vez y actualiza Elo, liga y log', () => {
    scoreMvp('@mvp', 'https://avatar', 'A', 500);
    recordGift('@vip', 'https://avatar-vip', 'A', 250);
    state.currentRoundCoins = 250;
    state.currentRoundTaps = 30;

    vi.advanceTimersByTime(45000);
    const log = finalizeRound('A', { suddenDeath: true });

    expect(log.winner).toBe('A');
    expect(log.mvp?.user).toBe('@mvp');
    expect(log.topGifter?.user).toBe('@vip');
    expect(log.topGifter?.coins).toBe(250);
    expect(log.durationSec).toBe(45);
    expect(state.teamRecords.MX.wins).toBe(1);
    expect(state.teamRecords.AR.losses).toBe(1);
    expect(state.teamRecords.MX.elo).toBeGreaterThan(1500);
    expect(state.teamRecords.AR.elo).toBeLessThan(1500);
    expect(state.currentSeason.standings.find((entry) => entry.key === 'MX')?.points).toBe(3);
    expect(state.roundLogs).toHaveLength(1);
    expect(state.roundActive).toBe(false);
  });

  it('impide finalizar una ronda ya cerrada', () => {
    finalizeRound('A');
    expect(() => finalizeRound('B')).toThrow('Cannot finalize a round that is not active');
  });

  it('aplica puntos destacados y registra MVP de temporada', () => {
    scoreMvp('@mvp', '', 'B', 750);
    finalizeRound('B', { featured: true });

    expect(state.currentSeason.standings.find((entry) => entry.key === 'AR')?.points).toBe(5);
    expect(state.currentSeason.topMvps[0]).toMatchObject({ user: '@mvp', score: 750 });
  });

  it('resetSession limpia sesión sin borrar históricos', () => {
    state.teamRecords.MX = {
      key: 'MX',
      name: 'México',
      flag: '🇲🇽',
      color: '#10B981',
      wins: 9,
      losses: 2,
      streak: 3,
      bestStreak: 5,
      championships: 1,
      elo: 1600,
      totalCoinsSpent: 1000,
      totalTaps: 500,
      lastPlayed: Date.now(),
    };
    state.sessionMVP['@old'] = { user: '@old', team: 'A', avatarUrl: '', score: 400 };

    resetSession();

    expect(state.sessionMVP).toEqual({});
    expect(state.roundMVP).toEqual({});
    expect(state.viewerTeams.size).toBe(0);
    expect(state.teamRecords.MX.wins).toBe(9);
  });

  it('cierra y inicia temporadas nuevas sin perder historial', () => {
    state.currentSeason.standings = [
      { key: 'MX', name: 'México', flag: '🇲🇽', color: '#10B981', points: 20, participation: 8, wins: 6, losses: 2 },
      { key: 'AR', name: 'Argentina', flag: '🇦🇷', color: '#38BDF8', points: 12, participation: 8, wins: 4, losses: 4 },
    ];
    state.currentSeason.topMvps = [{ user: '@mvp', team: 'A', avatarUrl: '', score: 900 }];

    closeCurrentSeason();

    expect(state.seasonHistory).toHaveLength(1);
    expect(state.seasonHistory[0].championKey).toBe('MX');
    expect(state.seasonHistory[0].championMvp?.user).toBe('@mvp');

    startNewSeason();
    expect(state.currentSeason.index).toBe(2);
    expect(state.currentSeason.standings.every((entry) => entry.points === 0)).toBe(true);
  });

  it('persiste y carga datos principales sin perder configuración', () => {
    state.personalTapThreshold = 25;
    state.frenzyGoalLikes = 200;
    state.aiDirectorEnabled = false;
    state.playerRecords['@fan'] = {
      user: '@fan',
      avatarUrl: '',
      favoriteTeam: 'A',
      lifetime: { taps: 10, coins: 100, gifts: 5, follows: 2, shares: 1, kills: 3, baseDamage: 500, towerKills: 1 },
      period: { coinsToday: 100, tapsToday: 10, coinsSeason: 100, tapsSeason: 10 },
      peaks: { maxSessionScore: 500, maxRoundScore: 400, maxTapsRound: 50, maxCoinsRound: 100 },
      mvpSessions: 1,
      mvpRounds: 2,
      teamsSupported: { A: 10 },
      badges: [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };
    saveNow();

    state.personalTapThreshold = 15;
    state.playerRecords = {};
    loadPersistentState();

    expect(state.personalTapThreshold).toBe(25);
    expect(state.frenzyGoalLikes).toBe(200);
    expect(state.aiDirectorEnabled).toBe(false);
    expect(state.playerRecords['@fan'].lifetime.coins).toBe(100);
  });

  it('incluye una versión de esquema y rechaza esquemas futuros', () => {
    saveNow();
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(persisted.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: PERSISTENCE_SCHEMA_VERSION + 1,
    }));
    loadPersistentState();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('exporta e importa el estado persistido con respaldo', () => {
    state.personalTapThreshold = 30;
    const exported = exportPersistentState();
    expect(JSON.parse(exported).schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);

    state.personalTapThreshold = 15;
    expect(importPersistentState(exported)).toBe(true);
    expect(state.personalTapThreshold).toBe(30);
    expect([...Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))]
      .some((key) => key?.startsWith(`${STORAGE_KEY}_backup_`))).toBe(true);
  });

  it('lista y restaura snapshots de respaldo', () => {
    state.personalTapThreshold = 35;
    saveNow();
    localStorage.setItem(`${STORAGE_KEY}_backup_test`, localStorage.getItem(STORAGE_KEY) || '{}');

    const snapshots = listPersistenceSnapshots();
    expect(snapshots.some((snapshot) => snapshot.kind === 'backup')).toBe(true);

    state.personalTapThreshold = 15;
    const snapshot = snapshots.find((item) => item.kind === 'backup');
    expect(snapshot).toBeDefined();
    expect(restorePersistenceSnapshot(snapshot!.key)).toBe(true);
    expect(state.personalTapThreshold).toBe(35);
  });
});
