import { bus, DeployOrder, OrderPriority, TeamId, UnitOrderKind } from '../core/EventBus';

export const ELIXIR_CONFIG = {
  MAX_ELIXIR: 10,
  START_ELIXIR: 5,
  BASE_REGEN_PER_SEC: 0.45,
  DEPLOY_GCD_SEC: 0.65,
  AUTO_DEPLOY_THRESHOLD: 7.8,
  MAX_UNITS_PER_TEAM: 32,
  MAX_JETS_PER_TEAM: 6,
  MAX_SOCIAL_QUEUE: 3,
  MAX_TOTAL_QUEUE: 14,
  BASE_COSTS: {
    INFANTRY: 2,
    JET: 3,
    TANK: 4,
  } as Record<UnitOrderKind, number>,
};

interface TeamElixirPool {
  elixir: number;
  deployCooldown: number;
  empSlowTimer: number;
  queue: DeployOrder[];
}

export interface ElixirContextSnapshot {
  roundActive: boolean;
  roundTimeLeft: number;
  suddenDeathActive: boolean;
  frenzyActive: boolean;
  timeScale: number;
  aiDirectorEnabled?: boolean;
  unitCountByTeam: (team: TeamId) => number;
  jetCountByTeam?: (team: TeamId) => number;
}

export class ElixirSystem {
  private pools: Record<TeamId, TeamElixirPool> = {
    A: this.createPool(),
    B: this.createPool(),
  };
  private seqId = 0;

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly rng: () => number = Math.random
  ) {}

  private createPool(): TeamElixirPool {
    return {
      elixir: ELIXIR_CONFIG.START_ELIXIR,
      deployCooldown: 0,
      empSlowTimer: 0,
      queue: [],
    };
  }

  resetRound(): void {
    this.seqId = 0;
    this.pools.A = this.createPool();
    this.pools.B = this.createPool();
    this.emitHud('A', ELIXIR_CONFIG.BASE_REGEN_PER_SEC);
    this.emitHud('B', ELIXIR_CONFIG.BASE_REGEN_PER_SEC);
  }

  addElixir(team: TeamId, amount: number): void {
    if (!Number.isFinite(amount)) return;
    const pool = this.pools[team];
    pool.elixir = Math.min(ELIXIR_CONFIG.MAX_ELIXIR, Math.max(0, pool.elixir + amount));
  }

  applyEmpSlow(team: TeamId, seconds = 6): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.pools[team].empSlowTimer = Math.min(18, this.pools[team].empSlowTimer + seconds);
  }

  getSnapshot(team: TeamId): Readonly<{ elixir: number; queueLength: number; empSlowTimer: number; deployCooldown: number }> {
    const p = this.pools[team];
    return {
      elixir: p.elixir,
      queueLength: p.queue.length,
      empSlowTimer: p.empSlowTimer,
      deployCooldown: p.deployCooldown,
    };
  }

  enqueueOrder(params: {
    team: TeamId;
    kind: UnitOrderKind;
    priority: OrderPriority;
    user: string;
    avatarUrl: string;
    isPaidGift?: boolean;
    isTapBadge?: boolean;
  }): void {
    const pool = this.pools[params.team];
    const isPaid = Boolean(params.isPaidGift);
    const baseCost = ELIXIR_CONFIG.BASE_COSTS[params.kind];
    const effectiveCost = isPaid ? baseCost * 0.5 : baseCost;

    if (params.priority === 2) {
      const socialCount = pool.queue.filter((o) => o.priority === 2).length;
      if (socialCount >= ELIXIR_CONFIG.MAX_SOCIAL_QUEUE) {
        this.addElixir(params.team, 0.35);
        return;
      }
    }

    if (params.priority === 1 && params.kind === 'INFANTRY') {
      const vipInfantry = pool.queue.filter((o) => o.priority === 1 && o.kind === 'INFANTRY');
      if (vipInfantry.length >= 6) {
        const toMerge = vipInfantry.slice(-2);
        for (const old of toMerge) {
          const idx = pool.queue.indexOf(old);
          if (idx !== -1) pool.queue.splice(idx, 1);
        }
        pool.queue.push({
          id: `ord_${++this.seqId}`,
          team: params.team,
          kind: 'TANK',
          cost: ELIXIR_CONFIG.BASE_COSTS.TANK * 0.5,
          priority: 1,
          user: params.user,
          avatarUrl: params.avatarUrl,
          veteranRank: 2,
          isPaidGift: isPaid,
          enqueuedAt: this.now(),
        });
        this.sortQueue(pool);
        return;
      }
    }

    if (pool.queue.length >= ELIXIR_CONFIG.MAX_TOTAL_QUEUE) {
      const target = pool.queue.find((o) => o.kind === params.kind && o.veteranRank < 5) || pool.queue[0];
      if (target) {
        target.veteranRank = Math.min(5, target.veteranRank + 1);
        if (isPaid) {
          target.user = params.user;
          target.avatarUrl = params.avatarUrl;
          target.isPaidGift = true;
        }
      }
      this.addElixir(params.team, isPaid ? 0.8 : 0.3);
      return;
    }

    pool.queue.push({
      id: `ord_${++this.seqId}`,
      team: params.team,
      kind: params.kind,
      cost: effectiveCost,
      priority: params.priority,
      user: params.user,
      avatarUrl: params.avatarUrl,
      veteranRank: 1,
      isPaidGift: isPaid,
      isTapBadge: params.isTapBadge,
      enqueuedAt: this.now(),
    });
    this.sortQueue(pool);
  }

  private sortQueue(pool: TeamElixirPool): void {
    pool.queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
  }

  update(dtSec: number, ctx: ElixirContextSnapshot): void {
    if (!ctx.roundActive || !Number.isFinite(dtSec) || dtSec <= 0) return;
    const safeScale = Number.isFinite(ctx.timeScale) && ctx.timeScale >= 0 ? ctx.timeScale : 1;
    const scaledDt = dtSec * safeScale;

    let phaseMult = 1;
    if (ctx.suddenDeathActive) phaseMult = 3;
    else if (ctx.frenzyActive || ctx.roundTimeLeft <= 60) phaseMult = 2;

    (['A', 'B'] as TeamId[]).forEach((team) => {
      const pool = this.pools[team];
      const enemy: TeamId = team === 'A' ? 'B' : 'A';

      // EMP corre en tiempo real (dtSec) para mantenerse sincronizado con el HUD de 1s
      if (pool.empSlowTimer > 0) {
        pool.empSlowTimer = Math.max(0, pool.empSlowTimer - dtSec);
      }

      const empFactor = pool.empSlowTimer > 0 ? 0.5 : 1.0;
      const regenRate = ELIXIR_CONFIG.BASE_REGEN_PER_SEC * phaseMult * empFactor;

      pool.elixir = Math.min(ELIXIR_CONFIG.MAX_ELIXIR, pool.elixir + regenRate * scaledDt);
      if (pool.deployCooldown > 0) {
        pool.deployCooldown = Math.max(0, pool.deployCooldown - scaledDt);
      }

      // Director IA respeta el GCD antes de auto-encolar
      if (
        ctx.aiDirectorEnabled !== false &&
        pool.deployCooldown <= 0 &&
        pool.queue.length === 0 &&
        pool.elixir >= ELIXIR_CONFIG.AUTO_DEPLOY_THRESHOLD
      ) {
        const enemyCount = ctx.unitCountByTeam(enemy);
        const autoKind: UnitOrderKind =
          pool.elixir >= 8.5 && enemyCount >= 5 ? 'TANK' : this.rng() < 0.72 ? 'INFANTRY' : 'JET';

        this.enqueueOrder({
          team,
          kind: autoKind,
          priority: 3,
          user: '',
          avatarUrl: '',
        });
      }

      const next = pool.queue[0];
      if (next && pool.deployCooldown <= 0 && pool.elixir >= next.cost) {
        const hasPopSpace =
          next.kind === 'JET'
            ? (ctx.jetCountByTeam?.(team) ?? 0) < ELIXIR_CONFIG.MAX_JETS_PER_TEAM
            : ctx.unitCountByTeam(team) < ELIXIR_CONFIG.MAX_UNITS_PER_TEAM;

        if (hasPopSpace) {
          pool.elixir -= next.cost;
          pool.deployCooldown = ELIXIR_CONFIG.DEPLOY_GCD_SEC;
          pool.queue.shift();
          bus.emit('elixir:deploy', next);
        }
      }

      this.emitHud(team, regenRate);
    });
  }

  private emitHud(team: TeamId, ratePerSec: number): void {
    const pool = this.pools[team];
    bus.emit('elixir:updated', {
      team,
      elixir: pool.elixir,
      maxElixir: ELIXIR_CONFIG.MAX_ELIXIR,
      ratePerSec,
      queueLength: pool.queue.length,
      nextCost: pool.queue[0]?.cost ?? null,
    });
  }
}