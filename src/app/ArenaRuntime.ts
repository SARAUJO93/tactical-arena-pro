import { resetIfNeeded, state } from '../core/GameState';
import { TeamId, bus } from '../core/EventBus';
import { Simulation } from '../core/Simulation';
import { ElixirSystem } from '../systems/ElixirSystem';
import { renderTelemetry } from '../systems/Telemetry';

const REAL_INTERACTION_GRACE_MS = 12000;

export const DEMO_USERS: { user: string; team: TeamId }[] = [
  { user: '@CarlosMX', team: 'A' }, { user: '@Sofia_99', team: 'A' },
  { user: '@MateoAR', team: 'B' }, { user: '@KiraLive', team: 'B' },
];

export function consumeAccumulator(
  accumulator: number,
  deltaSeconds: number,
  intervalSeconds: number
): { accumulator: number; elapsedIntervals: number } {
  const safeDelta = Math.max(0, deltaSeconds);
  const next = accumulator + safeDelta;
  if (next < intervalSeconds) return { accumulator: next, elapsedIntervals: 0 };
  const elapsedIntervals = Math.floor(next / intervalSeconds);
  return {
    accumulator: next - elapsedIntervals * intervalSeconds,
    elapsedIntervals,
  };
}

interface ArenaRuntimeDependencies {
  elixir: ElixirSystem;
  simulation: Simulation;
  activateSuddenDeath: (atTimerEnd?: boolean) => void;
  activateTowerDecay: () => void;
  applyTowerDecay: () => void;
  updateFrenzyGaugeUI: () => void;
  syncTimerPill: () => void;
}

export class ArenaRuntime {
  private lastTime = 0;
  private clockAccumulator = 0;
  private demoAccumulator = 0;
  private frameId: number | null = null;
  private stopped = false;
  private frameSamples: number[] = [];

  constructor(private readonly deps: ArenaRuntimeDependencies) {}

  start(): void {
    if (this.frameId !== null) return;
    this.stopped = false;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame((now) => this.loop(now));
  }

  stop(): void {
    this.stopped = true;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  tickOneSecond(): void {
    resetIfNeeded();
    if (this.frameSamples.length > 0) {
      const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length;
      state.telemetry.averageFrameMs = Math.round(average * 10) / 10;
      state.telemetry.maxFrameMs = Math.max(...this.frameSamples);
      state.telemetry.fps = Math.round(1000 / Math.max(1, average));
      this.frameSamples = [];
    }
    const memory = (performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }).memory;
    state.telemetry.usedHeapMb = memory
      ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10
      : null;

    if (state.telemetryOpen) renderTelemetry();
    if (!state.roundActive) return;

    if (state.towerDecayActive) {
      this.deps.applyTowerDecay();
      this.deps.syncTimerPill();
      return;
    }

    state.roundTimeLeft = Math.max(0, state.roundTimeLeft - 1);
    if (state.roundTimeLeft === 0) {
      if (state.suddenDeathActive) this.deps.activateTowerDecay();
      else this.deps.activateSuddenDeath(true);
    }

    if (state.frenzyActive) {
      state.frenzyTimeLeft = Math.max(0, state.frenzyTimeLeft - 1);
      if (state.frenzyTimeLeft === 0) {
        state.frenzyActive = false;
        document.getElementById('frenzyVignette')?.classList.remove('active');
      }
      this.deps.updateFrenzyGaugeUI();
    }
    this.deps.syncTimerPill();

    (['A', 'B'] as TeamId[]).forEach((team) => {
      const base = team === 'A' ? state.teamA : state.teamB;
      const shieldBadge = document.getElementById(`shieldBadge${team}`);
      const shieldTimer = document.getElementById(`shieldTimer${team}`);
      const empBadge = document.getElementById(`empBadge${team}`);
      const empTimer = document.getElementById(`empTimer${team}`);
      const card = document.getElementById(`cardBase${team}`);
      if (base.shieldTimer > 0 && base.shieldHp > 0) {
        base.shieldTimer--;
        if (shieldBadge && shieldTimer) {
          shieldTimer.textContent = `${base.shieldTimer}s`;
          shieldBadge.setAttribute('aria-label', `Escudo activo: ${base.shieldTimer} segundos`);
          shieldBadge.classList.remove('hidden');
        }
      } else {
        base.shieldHp = 0;
        shieldBadge?.classList.add('hidden');
      }
      if (base.empTimer > 0) {
        base.empTimer--;
        if (empBadge && empTimer) {
          empTimer.textContent = `${base.empTimer}s`;
          empBadge.setAttribute('aria-label', `Pulso EMP activo: ${base.empTimer} segundos`);
          empBadge.classList.remove('hidden');
        }
        card?.classList.add('emp-hit');
      } else {
        empBadge?.classList.add('hidden');
        card?.classList.remove('emp-hit');
      }
    });
  }

  tickDemoStep(random = Math.random): void {
    if (!state.roundActive || state.towerDecayActive || !state.demoMode || state.takeoverActive) return;
    if (Date.now() - state.lastRealInteractionAt < REAL_INTERACTION_GRACE_MS) return;

    const viewer = DEMO_USERS[Math.floor(random() * DEMO_USERS.length)];
    const roll = random();
    if (roll < 0.35) bus.emit('game:tap', { user: viewer.user, count: 15, avatarUrl: '', forcedTeam: viewer.team, isDemo: true });
    else if (roll < 0.65) bus.emit('game:gift', { team: viewer.team, tier: 1, delta: 2, user: viewer.user, giftName: 'Rose', avatarUrl: '', coins: 1, isDemo: true });
    else if (roll < 0.80) bus.emit('game:gift', { team: viewer.team, tier: 2, delta: 1, user: viewer.user, giftName: 'Dona', avatarUrl: '', coins: 30, isDemo: true });
    else if (roll < 0.90) bus.emit('game:gift', { team: viewer.team, tier: 3, delta: 1, user: viewer.user, giftName: 'Perfume', avatarUrl: '', coins: 20, isDemo: true });
    else if (roll < 0.95) bus.emit('game:gift', { team: viewer.team, tier: 6, delta: 1, user: viewer.user, giftName: 'EMP', avatarUrl: '', coins: 100, isDemo: true });
    else bus.emit('game:gift', { team: viewer.team, tier: 7, delta: 1, user: viewer.user, giftName: 'Hack', avatarUrl: '', coins: 99, isDemo: true });
  }

  private loop(now: number): void {
    if (this.stopped) return;
    const dtSec = Math.min(0.05, Math.max(0.008, (now - this.lastTime) / 1000));
    const frameMs = Math.max(0, now - this.lastTime);
    if (Number.isFinite(frameMs) && frameMs > 0) {
      this.frameSamples.push(frameMs);
    }
    this.lastTime = now;

    const clock = consumeAccumulator(this.clockAccumulator, dtSec, 1);
    this.clockAccumulator = clock.accumulator;
    for (let i = 0; i < clock.elapsedIntervals; i++) this.tickOneSecond();

    const demo = consumeAccumulator(this.demoAccumulator, dtSec, 1.1);
    this.demoAccumulator = demo.accumulator;
    for (let i = 0; i < demo.elapsedIntervals; i++) this.tickDemoStep();

    if (!state.towerDecayActive) {
      const idleSeconds = Math.max(0, (Date.now() - state.lastRealInteractionAt) / 1000);
      this.deps.elixir.update(dtSec, {
        roundActive: state.roundActive,
        roundTimeLeft: state.roundTimeLeft,
        suddenDeathActive: state.suddenDeathActive,
        frenzyActive: state.frenzyActive,
        timeScale: state.timeScale,
        aiDirectorEnabled: state.aiDirectorEnabled,
        unitCountByTeam: (team) => this.deps.simulation.getUnitCount(team),
        jetCountByTeam: (team) => this.deps.simulation.getJetCount(team),
        idleSeconds,
      });
    }
    this.deps.simulation.update(dtSec * 60);
    this.deps.simulation.render();
    this.frameId = requestAnimationFrame((next) => this.loop(next));
  }
}