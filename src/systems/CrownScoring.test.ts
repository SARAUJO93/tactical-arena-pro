import { describe, expect, it } from 'vitest';
import { makeBaseState, MAX_BASE_HP, MAX_SIDE_DEFENSE_HP, WORLD_ROSTER } from '../core/GameState';
import {
  advanceTowerDecay,
  getCrownScore,
  getDefenseHealthPercent,
  resolveTimeoutWinner,
  TOWER_DECAY_RATE_PER_SECOND,
} from './CrownScoring';

describe('CrownScoring', () => {
  it('awards one crown per side tower and three for the core', () => {
    const base = makeBaseState(WORLD_ROSTER[0], true);
    expect(getCrownScore(base)).toBe(0);

    base.sideDefenses[0].hp = 0;
    expect(getCrownScore(base)).toBe(1);

    base.sideDefenses[1].hp = 0;
    base.hp = 0;
    expect(getCrownScore(base)).toBe(3);
  });

  it('breaks a timeout tie by crowns before remaining defense health', () => {
    const teamA = makeBaseState(WORLD_ROSTER[0], true);
    const teamB = makeBaseState(WORLD_ROSTER[1], false);
    teamA.sideDefenses.forEach((tower) => { tower.hp = 0; });
    teamB.sideDefenses[0].hp = 0;
    teamA.hp = 1;

    expect(resolveTimeoutWinner(teamA, teamB)).toEqual({ winner: 'A', reason: 'crowns' });
  });

  it('starts sudden death when crowns are tied, regardless of remaining health', () => {
    const teamA = makeBaseState(WORLD_ROSTER[0], true);
    const teamB = makeBaseState(WORLD_ROSTER[1], false);
    teamA.sideDefenses[0].hp = 0;
    teamB.sideDefenses[0].hp = 0;
    teamA.hp = MAX_BASE_HP / 2;

    expect(resolveTimeoutWinner(teamA, teamB)).toBeNull();
    expect(getDefenseHealthPercent(teamA)).toBeCloseTo(100 * (0 + 1 + 0.5) / 3);
  });

  it('drains all live structures and awards the first collapse', () => {
    const teamA = makeBaseState(WORLD_ROSTER[0], true);
    const teamB = makeBaseState(WORLD_ROSTER[1], false);
    teamA.hp = MAX_BASE_HP / 2;
    teamA.sideDefenses[0].hp = 30;
    teamA.sideDefenses[1].hp = MAX_SIDE_DEFENSE_HP / 2;
    teamB.sideDefenses[0].hp = 50;

    expect(advanceTowerDecay(teamA, teamB, 'A')).toBe('B');
    expect(teamA.hp).toBe(MAX_BASE_HP / 2 - MAX_BASE_HP * TOWER_DECAY_RATE_PER_SECOND);
    expect(teamA.sideDefenses[0].hp).toBe(0);
    expect(teamA.sideDefenses[1].hp).toBe(
      MAX_SIDE_DEFENSE_HP / 2 - MAX_SIDE_DEFENSE_HP * TOWER_DECAY_RATE_PER_SECOND
    );
  });

  it('uses the alternating priority for an exactly simultaneous collapse', () => {
    const teamA = makeBaseState(WORLD_ROSTER[0], true);
    const teamB = makeBaseState(WORLD_ROSTER[1], false);
    teamA.sideDefenses[0].hp = 20;
    teamB.sideDefenses[0].hp = 20;

    expect(advanceTowerDecay(teamA, teamB, 'B')).toBe('B');
  });
});
