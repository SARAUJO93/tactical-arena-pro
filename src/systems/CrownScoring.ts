import { MAX_BASE_HP } from '../core/GameState';
import type { BaseState } from '../core/GameState';
import type { TeamId } from '../core/EventBus';

export const TOWER_DECAY_RATE_PER_SECOND = 0.05;

export type TimeoutDecisionReason = 'crowns';

export interface TimeoutDecision {
  winner: TeamId;
  reason: TimeoutDecisionReason;
}

export function getCrownScore(base: Pick<BaseState, 'hp' | 'sideDefenses'>): number {
  if (base.hp <= 0) return 3;
  const sideTowerCrowns = base.sideDefenses.filter((tower) => tower.hp <= 0).length;
  return sideTowerCrowns;
}

export function getDefenseHealthPercent(base: Pick<BaseState, 'hp' | 'sideDefenses'>): number {
  const structures = [
    { hp: base.hp, maxHp: MAX_BASE_HP },
    ...base.sideDefenses,
  ];
  const healthRatio = structures.reduce((total, structure) => {
    if (structure.maxHp <= 0) return total;
    return total + Math.max(0, Math.min(structure.maxHp, structure.hp)) / structure.maxHp;
  }, 0) / structures.length;
  return healthRatio * 100;
}

export function resolveTimeoutWinner(teamA: BaseState, teamB: BaseState): TimeoutDecision | null {
  const crownsA = getCrownScore(teamA);
  const crownsB = getCrownScore(teamB);
  if (crownsA !== crownsB) {
    return { winner: crownsA > crownsB ? 'A' : 'B', reason: 'crowns' };
  }

  return null;
}

export function advanceTowerDecay(
  teamA: BaseState,
  teamB: BaseState,
  tiePriority: TeamId
): TeamId | null {
  const earliestCollapse: Record<TeamId, number> = { A: Infinity, B: Infinity };
  const teams: [TeamId, BaseState][] = [['A', teamA], ['B', teamB]];

  for (const [team, base] of teams) {
    const structures = [
      { hp: base.hp, maxHp: MAX_BASE_HP, setHp: (hp: number) => { base.hp = hp; } },
      ...base.sideDefenses.map((tower) => ({
        hp: tower.hp,
        maxHp: tower.maxHp,
        setHp: (hp: number) => { tower.hp = hp; },
      })),
    ];

    for (const structure of structures) {
      if (structure.hp <= 0 || structure.maxHp <= 0) continue;
      const damagePerSecond = structure.maxHp * TOWER_DECAY_RATE_PER_SECOND;
      const collapseTime = structure.hp / damagePerSecond;
      structure.setHp(Math.max(0, structure.hp - damagePerSecond));
      if (collapseTime <= 1) {
        earliestCollapse[team] = Math.min(earliestCollapse[team], collapseTime);
      }
    }
  }

  const timeA = earliestCollapse.A;
  const timeB = earliestCollapse.B;
  if (!Number.isFinite(timeA) && !Number.isFinite(timeB)) return null;
  if (Math.abs(timeA - timeB) <= 0.0001) return tiePriority;
  return timeA < timeB ? 'B' : 'A';
}
