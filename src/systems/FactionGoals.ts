import { TeamId } from '../core/EventBus';
import { MvpEntry } from '../core/GameState';

export const FACTION_GOAL_DEFAULT_LIKES = 150;

export interface FactionGoalSnapshot {
  team: TeamId;
  likes: number;
  target: number;
  completedCount: number;
  pct: number;
}

export interface FactionGoalProgress {
  snapshot: FactionGoalSnapshot;
  triggeredCount: number;
}

interface TeamGoalState {
  likes: number;
  completedCount: number;
}

export class FactionGoalSystem {
  private goals: Record<TeamId, TeamGoalState> = {
    A: { likes: 0, completedCount: 0 },
    B: { likes: 0, completedCount: 0 },
  };

  constructor(private readonly targetLikes = FACTION_GOAL_DEFAULT_LIKES) {}

  resetRound(): void {
    this.goals = {
      A: { likes: 0, completedCount: 0 },
      B: { likes: 0, completedCount: 0 },
    };
  }

  addLikes(team: TeamId, count: number): FactionGoalProgress {
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const entry = this.goals[team];
    entry.likes += safeCount;

    let triggeredCount = 0;
    while (entry.likes >= this.targetLikes) {
      entry.likes -= this.targetLikes;
      entry.completedCount += 1;
      triggeredCount += 1;
    }

    return {
      snapshot: this.getSnapshot(team),
      triggeredCount,
    };
  }

  getSnapshot(team: TeamId): FactionGoalSnapshot {
    const entry = this.goals[team];
    return {
      team,
      likes: entry.likes,
      target: this.targetLikes,
      completedCount: entry.completedCount,
      pct: Math.min(100, Math.round((entry.likes / this.targetLikes) * 100)),
    };
  }
}

export function getTeamCaptain(
  team: TeamId,
  roundMVP: Record<string, MvpEntry>,
  sessionMVP: Record<string, MvpEntry>
): MvpEntry | null {
  const fromRound = Object.values(roundMVP)
    .filter((entry) => entry.team === team)
    .sort((a, b) => b.score - a.score)[0];
  if (fromRound) return fromRound;

  const fromSession = Object.values(sessionMVP)
    .filter((entry) => entry.team === team)
    .sort((a, b) => b.score - a.score)[0];
  return fromSession ?? null;
}