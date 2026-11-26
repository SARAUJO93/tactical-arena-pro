import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaRuntime, consumeAccumulator } from './ArenaRuntime';
import { bus, GameEvents } from '../core/EventBus';
import { beginRound, makeBaseState, state, WORLD_ROSTER } from '../core/GameState';
import { ElixirSystem } from '../systems/ElixirSystem';
import type { Simulation } from '../core/Simulation';

class FakeStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function createRuntimeDeps() {
  const activateSuddenDeath = vi.fn();
  const activateTowerDecay = vi.fn();
  const applyTowerDecay = vi.fn();
  const updateFrenzyGaugeUI = vi.fn();
  const syncTimerPill = vi.fn();

  const runtime = new ArenaRuntime({
    elixir: new ElixirSystem(),
    simulation: {
      getUnitCount: () => 0,
      getJetCount: () => 0,
      update: vi.fn(),
      render: vi.fn(),
    } as unknown as Simulation,
    activateSuddenDeath,
    activateTowerDecay,
    applyTowerDecay,
    updateFrenzyGaugeUI,
    syncTimerPill,
  });

  return {
    runtime,
    activateSuddenDeath,
    activateTowerDecay,
    applyTowerDecay,
    updateFrenzyGaugeUI,
    syncTimerPill,
  };
}

describe('consumeAccumulator', () => {
  it('acumula fracciones sin perder el residuo', () => {
    expect(consumeAccumulator(0.4, 0.6, 1)).toEqual({
      accumulator: 0,
      elapsedIntervals: 1,
    });
  });

  it('acumula varios intervalos y conserva el residuo', () => {
    const result = consumeAccumulator(0.8, 2.5, 1);
    expect(result.accumulator).toBeCloseTo(0.3, 10);
    expect(result.elapsedIntervals).toBe(3);
  });

  it('ignora deltas negativos', () => {
    expect(consumeAccumulator(0.25, -1, 1)).toEqual({
      accumulator: 0.25,
      elapsedIntervals: 0,
    });
  });
});

describe('ArenaRuntime', () => {
  let unsubs: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T21:00:00Z'));
    vi.stubGlobal('localStorage', new FakeStorage());
    vi.stubGlobal('document', { getElementById: () => null });

    state.teamA = makeBaseState(WORLD_ROSTER[0], true);
    state.teamB = makeBaseState(WORLD_ROSTER[1], false);
    state.telemetryOpen = false;
    state.demoMode = true;
    state.takeoverActive = false;
    state.lastDailyReset = Date.now();
    state.currentSeason.endDate = Date.now() + 86_400_000;
    beginRound('grove');
    unsubs = [];
  });

  afterEach(() => {
    unsubs.forEach((u) => u());
    unsubs = [];
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('transiciona de tiempo normal a Muerte Súbita y luego a Colapso de Torres', () => {
    const { runtime, activateSuddenDeath, activateTowerDecay, applyTowerDecay, syncTimerPill } = createRuntimeDeps();

    state.roundTimeLeft = 1;
    runtime.tickOneSecond();
    expect(state.roundTimeLeft).toBe(0);
    expect(activateSuddenDeath).toHaveBeenCalledWith(true);
    expect(syncTimerPill).toHaveBeenCalled();

    state.suddenDeathActive = true;
    state.roundTimeLeft = 1;
    runtime.tickOneSecond();
    expect(activateTowerDecay).toHaveBeenCalledTimes(1);

    state.towerDecayActive = true;
    runtime.tickOneSecond();
    expect(applyTowerDecay).toHaveBeenCalledTimes(1);
  });

  it('descuenta Frenesí, escudo y EMP en cada segundo', () => {
    const { runtime, updateFrenzyGaugeUI } = createRuntimeDeps();

    state.frenzyActive = true;
    state.frenzyTimeLeft = 1;
    state.teamA.shieldHp = 300;
    state.teamA.shieldTimer = 2;
    state.teamB.empTimer = 3;

    runtime.tickOneSecond();

    expect(state.frenzyActive).toBe(false);
    expect(state.frenzyTimeLeft).toBe(0);
    expect(updateFrenzyGaugeUI).toHaveBeenCalledTimes(1);
    expect(state.teamA.shieldTimer).toBe(1);
    expect(state.teamB.empTimer).toBe(2);

    // Al llegar a 0 el escudo, el siguiente tick limpia shieldHp
    state.teamA.shieldTimer = 0;
    runtime.tickOneSecond();
    expect(state.teamA.shieldHp).toBe(0);
  });

  it('respeta la ventana de gracia de 12s en modo Demo y emite eventos al quedar inactivo', () => {
    const { runtime } = createRuntimeDeps();
    const taps: GameEvents['game:tap'][] = [];
    const gifts: GameEvents['game:gift'][] = [];
    unsubs.push(
      bus.on('game:tap', (e) => taps.push(e)),
      bus.on('game:gift', (e) => gifts.push(e))
    );

    // Interacción real reciente: no debe disparar demo
    state.lastRealInteractionAt = Date.now();
    runtime.tickDemoStep(() => 0.1);
    expect(taps).toHaveLength(0);
    expect(gifts).toHaveLength(0);

    // Tras 13s sin interacción real: emite evento demo
    vi.advanceTimersByTime(13_000);
    runtime.tickDemoStep(() => 0.1);
    expect(taps).toHaveLength(1);
    expect(taps[0].isDemo).toBe(true);
  });
});