import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bus, TeamId } from './EventBus';
import {
  beginRound,
  finalizeRound,
  makeBaseState,
  MAX_BASE_HP,
  prepareWorldCup,
  scoreMvp,
  state,
  WORLD_ROSTER,
} from './GameState';
import { Simulation } from './Simulation';
import { ElixirSystem } from '../systems/ElixirSystem';
import { createEmptyWorldCup, getCurrentWorldCupMatch, recordWorldCupWinner } from '../systems/WorldCup';
import type { SynthEngine } from '../audio/SynthEngine';

type VictoryHandler = (winner: TeamId, reason?: 'core' | 'sudden_death_tower') => void;

class FakeStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function createHeadlessSimulation(
  onBaseDamageUI: () => void = vi.fn(),
  onVictoryHandler?: VictoryHandler
) {
  const onVictory = onVictoryHandler ? vi.fn<VictoryHandler>(onVictoryHandler) : vi.fn<VictoryHandler>();

  const fakeCanvas = {
    width: 390,
    height: 693,
    getContext: () => ({}),
  } as unknown as HTMLCanvasElement;

  const fakeRect = { top: 0, bottom: 100, height: 100 };
  const fakeStageFrame = { clientWidth: 390, clientHeight: 693 } as unknown as HTMLElement;
  const fakeStage = {
    style: { width: '', height: '', transform: '' },
    offsetHeight: 693,
    getBoundingClientRect: () => ({ top: 0, bottom: 693, height: 693 }),
  } as unknown as HTMLElement;
  const fakeCardA = {
    getBoundingClientRect: () => ({ ...fakeRect, top: 80, bottom: 180 }),
  } as unknown as HTMLElement;
  const fakeCardB = {
    getBoundingClientRect: () => ({ ...fakeRect, top: 480, bottom: 580 }),
  } as unknown as HTMLElement;
  const fakeSynth = { playSFX: vi.fn() } as unknown as SynthEngine;

  const sim = new Simulation(
    fakeCanvas,
    fakeStageFrame,
    fakeStage,
    fakeCardA,
    fakeCardB,
    fakeSynth,
    onBaseDamageUI,
    onVictory
  );

  return { sim, fakeSynth, onBaseDamageUI, onVictory };
}

describe('Integración — Ciclo completo de ronda', () => {
  let unsubs: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T21:00:00Z'));
    vi.stubGlobal('localStorage', new FakeStorage());
    vi.stubGlobal('window', {
      innerWidth: 390,
      innerHeight: 693,
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    state.teamA = makeBaseState(WORLD_ROSTER[0], true);
    state.teamB = makeBaseState(WORLD_ROSTER[1], false);
    state.teamRecords = {};
    state.playerRecords = {};
    state.sessionMVP = {};
    state.roundMVP = {};
    state.roundLogs = [];
    state.worldCup = createEmptyWorldCup();
    state.timeScale = 1;
    state.takeoverActive = false;
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
    unsubs = [];
  });

  afterEach(() => {
    unsubs.forEach((u) => u());
    unsubs = [];
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('conecta ElixirSystem con Simulation y despliega infantería, tanques y jets', () => {
    const { sim } = createHeadlessSimulation();
    const elixir = new ElixirSystem(() => Date.now(), () => 0.1);
    unsubs.push(bus.on('elixir:deploy', (order) => sim.deployOrder(order)));

    elixir.addElixir('A', 5);
    elixir.enqueueOrder({ team: 'A', kind: 'INFANTRY', priority: 1, user: '@vip', avatarUrl: '', isPaidGift: true });
    elixir.enqueueOrder({ team: 'A', kind: 'TANK', priority: 1, user: '@vip', avatarUrl: '', isPaidGift: true });
    elixir.enqueueOrder({ team: 'B', kind: 'JET', priority: 1, user: '@rival', avatarUrl: '', isPaidGift: true });

    const ctx = {
      roundActive: state.roundActive,
      roundTimeLeft: state.roundTimeLeft,
      suddenDeathActive: false,
      frenzyActive: false,
      timeScale: 1,
      aiDirectorEnabled: false,
      unitCountByTeam: (team: TeamId) => sim.getUnitCount(team),
      jetCountByTeam: (team: TeamId) => sim.getJetCount(team),
    };

    elixir.update(0.1, ctx);
    elixir.update(0.7, ctx);

    expect(sim.getUnitCount('A')).toBe(4); // 3 soldados + 1 tanque
    expect(sim.getJetCount('B')).toBe(1);
    expect(sim.getResilienceStats().unitCount).toBe(4);

    sim.clearEntities();
    expect(sim.getResilienceStats()).toEqual({
      unitCount: 0,
      jetCount: 0,
      projectileCount: 0,
      visualEffectCount: 0,
    });
  });

  it('aplica Cyber Hack, EMP y absorción de escudo antes de dañar el núcleo', () => {
    const { sim } = createHeadlessSimulation();

    sim.deployOrder({
      id: 'ord_tank_b',
      team: 'B',
      kind: 'TANK',
      cost: 4,
      priority: 1,
      user: '@b',
      avatarUrl: '',
      veteranRank: 1,
      isPaidGift: true,
      enqueuedAt: 1,
    });
    expect(sim.getUnitCount('B')).toBe(1);

    sim.applyEmpToUnits('B', 5);
    expect(sim.units[0].empStun).toBe(300);

    const stolen = sim.applyCyberHack('A', '@hacker', '', 2);
    expect(stolen).toBe(1);
    expect(sim.getUnitCount('A')).toBe(1);
    expect(sim.getUnitCount('B')).toBe(0);

    state.teamB.shieldHp = 350;
    state.teamB.shieldTimer = 3;
    sim.spawnOrbital('A', '@vip', '', 1);
    for (let i = 0; i < 42; i++) sim.update(1);

    // El orbital hace 650 al núcleo; el escudo absorbe 350 y pasan 300 de daño
    expect(state.teamB.shieldHp).toBe(0);
    expect(state.teamB.hp).toBe(MAX_BASE_HP - 300);
    expect(state.teamB.sideDefenses[0].hp).toBe(550);
    expect(state.teamB.sideDefenses[1].hp).toBe(550);
  });

  it('resuelve victoria en Muerte Súbita al caer una torre lateral y actualiza Liga y ELO', () => {
    const victories: Array<{ winner: TeamId; reason?: 'core' | 'sudden_death_tower' }> = [];
    const { sim } = createHeadlessSimulation(vi.fn(), (winner, reason) => {
      victories.push({ winner, reason });
      finalizeRound(winner, { suddenDeath: true });
    });

    scoreMvp('@campeon', '', 'A', 420);
    state.suddenDeathActive = true;
    state.teamB.sideDefenses[0].hp = 400;

    vi.advanceTimersByTime(30_000);
    sim.spawnOrbital('A', '@campeon', '', 1);
    for (let i = 0; i < 42; i++) sim.update(1);

    expect(victories).toEqual([{ winner: 'A', reason: 'sudden_death_tower' }]);
    expect(state.roundActive).toBe(false);
    expect(state.roundLogs).toHaveLength(1);
    expect(state.roundLogs[0]).toMatchObject({
      winner: 'A',
      suddenDeath: true,
      biome: 'grove',
      mvp: { user: '@campeon', score: 420 },
    });
    expect(state.teamRecords.MX.wins).toBe(1);
    expect(state.teamRecords.MX.elo).toBeGreaterThan(1500);
    expect(state.currentSeason.standings.find((s) => s.key === 'MX')?.points).toBe(3);
  });

  it('cierra una victoria por núcleo en Copa Mundial y avanza al siguiente cruce', () => {
    const openingMatch = prepareWorldCup();
    beginRound('volcano');

    const { sim, onVictory } = createHeadlessSimulation(vi.fn(), (winner) => {
      const winKey = winner === 'A' ? state.teamA.key : state.teamB.key;
      finalizeRound(winner);
      recordWorldCupWinner(state.worldCup, winKey);
    });

    state.teamB.hp = 500;
    sim.spawnOrbital('A', '@vip', '', 1);
    for (let i = 0; i < 42; i++) sim.update(1);

    expect(onVictory).toHaveBeenCalledWith('A', 'core');
    expect(state.worldCup.rounds[0][0].winner?.key).toBe(openingMatch.teamA?.key);

    const nextMatch = getCurrentWorldCupMatch(state.worldCup);
    expect(nextMatch).not.toBeNull();
    expect(nextMatch?.teamA?.key).not.toBe(openingMatch.teamA?.key);
  });
});