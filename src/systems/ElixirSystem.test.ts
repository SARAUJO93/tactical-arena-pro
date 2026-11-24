import { describe, it, expect, beforeEach } from 'vitest';
import { bus, DeployOrder } from '../core/EventBus';
import { ELIXIR_CONFIG, ElixirContextSnapshot, ElixirSystem } from './ElixirSystem';

function makeCtx(overrides: Partial<ElixirContextSnapshot> = {}): ElixirContextSnapshot {
  return {
    roundActive: true,
    roundTimeLeft: 150,
    suddenDeathActive: false,
    frenzyActive: false,
    timeScale: 1,
    aiDirectorEnabled: false,
    unitCountByTeam: () => 0,
    jetCountByTeam: () => 0,
    ...overrides,
  };
}

describe('ElixirSystem', () => {
  let tick = 1000;
  let sys: ElixirSystem;
  let deployed: DeployOrder[];
  let unsub: () => void;

  beforeEach(() => {
    tick = 1000;
    deployed = [];
    sys = new ElixirSystem(() => (tick += 10), () => 0.1);
    unsub = bus.on('elixir:deploy', (o) => deployed.push(o));
  });

  it('regenera correctamente en normal (x1), frenesí/último minuto (x2) y muerte súbita (x3)', () => {
    sys.update(1, makeCtx());
    expect(sys.getSnapshot('A').elixir).toBeCloseTo(5 + ELIXIR_CONFIG.BASE_REGEN_PER_SEC, 5);

    sys.resetRound();
    sys.update(1, makeCtx({ frenzyActive: true }));
    expect(sys.getSnapshot('A').elixir).toBeCloseTo(5 + ELIXIR_CONFIG.BASE_REGEN_PER_SEC * 2, 5);

    sys.resetRound();
    sys.update(1, makeCtx({ suddenDeathActive: true }));
    expect(sys.getSnapshot('A').elixir).toBeCloseTo(5 + ELIXIR_CONFIG.BASE_REGEN_PER_SEC * 3, 5);
    unsub();
  });

  it('bloquea despliegue de jets al alcanzar MAX_JETS_PER_TEAM', () => {
    sys.enqueueOrder({ team: 'A', kind: 'JET', priority: 1, user: '@vip', avatarUrl: '', isPaidGift: true });
    sys.update(0.1, makeCtx({ jetCountByTeam: () => ELIXIR_CONFIG.MAX_JETS_PER_TEAM }));
    expect(deployed).toHaveLength(0);
    expect(sys.getSnapshot('A').queueLength).toBe(1);

    sys.update(0.1, makeCtx({ jetCountByTeam: () => ELIXIR_CONFIG.MAX_JETS_PER_TEAM - 1 }));
    expect(deployed).toHaveLength(1);
    expect(deployed[0].isPaidGift).toBe(true);
    unsub();
  });

  it('descuenta el temporizador EMP en tiempo real independiente de timeScale', () => {
    sys.applyEmpSlow('A', 6);
    sys.update(2, makeCtx({ timeScale: 0.25 }));
    expect(sys.getSnapshot('A').empSlowTimer).toBeCloseTo(4, 5);
    unsub();
  });

  it('respeta GCD en despliegues y en el auto-encolado del Director IA', () => {
    sys.addElixir('A', 5); // 10/10
    sys.enqueueOrder({ team: 'A', kind: 'INFANTRY', priority: 1, user: '@a', avatarUrl: '', isPaidGift: true });
    sys.update(0.05, makeCtx({ aiDirectorEnabled: true }));
    expect(deployed).toHaveLength(1);
    expect(sys.getSnapshot('A').deployCooldown).toBeGreaterThan(0);

    // Aunque el elixir siga > 7.8, la IA no auto-encola mientras haya GCD
    sys.update(0.1, makeCtx({ aiDirectorEnabled: true }));
    expect(sys.getSnapshot('A').queueLength).toBe(0);

    // Al expirar el GCD, la IA auto-encola y despliega
    sys.update(ELIXIR_CONFIG.DEPLOY_GCD_SEC, makeCtx({ aiDirectorEnabled: true }));
    expect(deployed).toHaveLength(2);
    unsub();
  });

  it('fusiona 6 infanterías VIP en un Tanque Veterano ★2 y reinicia seqId en resetRound', () => {
    for (let i = 0; i < 7; i++) {
      sys.enqueueOrder({ team: 'A', kind: 'INFANTRY', priority: 1, user: '@whale', avatarUrl: '', isPaidGift: true });
    }
    sys.update(0.1, makeCtx());
    // Deben quedar 5 órdenes en cola (6 - 2 fusionadas + 1 tanque = 5 tras desplegar 1)
    expect(sys.getSnapshot('A').queueLength).toBe(4);

    sys.resetRound();
    sys.enqueueOrder({ team: 'A', kind: 'INFANTRY', priority: 1, user: '@fresh', avatarUrl: '' });
    sys.update(0.1, makeCtx());
    expect(deployed.at(-1)?.id).toBe('ord_1');
    unsub();
  });

  it('ignora NaN e Infinity en addElixir y applyEmpSlow', () => {
    sys.addElixir('A', Number.NaN);
    sys.addElixir('A', Number.POSITIVE_INFINITY);
    sys.applyEmpSlow('A', Number.NaN);
    expect(sys.getSnapshot('A').elixir).toBe(ELIXIR_CONFIG.START_ELIXIR);
    expect(sys.getSnapshot('A').empSlowTimer).toBe(0);
    unsub();
  });
});