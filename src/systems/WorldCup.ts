import type { TeamPreset } from '../core/GameState';

export const WORLD_CUP_TEAM_COUNT = 64;
export const WORLD_CUP_ROUND_COUNTS = [32, 16, 8, 4, 2, 1] as const;
export const WORLD_CUP_TOTAL_MATCHES = WORLD_CUP_ROUND_COUNTS.reduce((total, count) => total + count, 0);

export type WorldCupStatus = 'idle' | 'in_progress' | 'completed';

export interface WorldCupMatch {
  teamA: TeamPreset | null;
  teamB: TeamPreset | null;
  winner: TeamPreset | null;
}

export interface WorldCupState {
  status: WorldCupStatus;
  startedAt: number;
  rounds: WorldCupMatch[][];
  champion: TeamPreset | null;
}

export function createEmptyWorldCup(): WorldCupState {
  return {
    status: 'idle',
    startedAt: 0,
    rounds: [],
    champion: null,
  };
}

export function createWorldCup(
  teams: readonly TeamPreset[],
  ratings: Readonly<Record<string, number>>,
  startedAt = Date.now(),
): WorldCupState {
  if (teams.length !== WORLD_CUP_TEAM_COUNT) {
    throw new Error(`La Copa Mundial requiere exactamente ${WORLD_CUP_TEAM_COUNT} equipos.`);
  }
  if (new Set(teams.map((team) => team.key)).size !== WORLD_CUP_TEAM_COUNT) {
    throw new Error('La Copa Mundial requiere claves de equipo únicas.');
  }

  const seededTeams = teams
    .map((team, index) => ({
      team: structuredClone(team),
      index,
      rating: Number.isFinite(ratings[team.key]) ? ratings[team.key] : 1500,
    }))
    .sort((a, b) => b.rating - a.rating || a.index - b.index)
    .map(({ team }) => team);
  const seedOrder = getSeedOrder(WORLD_CUP_TEAM_COUNT);
  const firstRound = Array.from({ length: WORLD_CUP_ROUND_COUNTS[0] }, (_, index) => ({
    teamA: seededTeams[seedOrder[index * 2] - 1],
    teamB: seededTeams[seedOrder[index * 2 + 1] - 1],
    winner: null,
  }));
  const rounds: WorldCupMatch[][] = [firstRound];

  for (const matchCount of WORLD_CUP_ROUND_COUNTS.slice(1)) {
    rounds.push(Array.from({ length: matchCount }, () => ({
      teamA: null,
      teamB: null,
      winner: null,
    })));
  }

  return {
    status: 'in_progress',
    startedAt,
    rounds,
    champion: null,
  };
}

export function getCurrentWorldCupMatch(cup: WorldCupState): WorldCupMatch | null {
  if (cup.status !== 'in_progress') return null;
  for (const round of cup.rounds) {
    const match = round.find((candidate) =>
      candidate.teamA !== null &&
      candidate.teamB !== null &&
      candidate.winner === null
    );
    if (match) return match;
  }
  return null;
}

export function recordWorldCupWinner(cup: WorldCupState, winnerKey: string): WorldCupMatch | null {
  const match = getCurrentWorldCupMatch(cup);
  if (!match || !match.teamA || !match.teamB) {
    throw new Error('No hay un partido pendiente en la Copa Mundial.');
  }

  const winner = match.teamA.key === winnerKey
    ? match.teamA
    : match.teamB.key === winnerKey
      ? match.teamB
      : null;
  if (!winner) throw new Error(`El equipo ${winnerKey} no participa en el partido actual.`);

  match.winner = structuredClone(winner);
  const roundIndex = cup.rounds.findIndex((round) => round.includes(match));
  const matchIndex = cup.rounds[roundIndex].indexOf(match);

  if (roundIndex === cup.rounds.length - 1) {
    cup.status = 'completed';
    cup.champion = structuredClone(winner);
    return null;
  }

  const nextRoundMatch = cup.rounds[roundIndex + 1][Math.floor(matchIndex / 2)];
  if (matchIndex % 2 === 0) nextRoundMatch.teamA = structuredClone(winner);
  else nextRoundMatch.teamB = structuredClone(winner);
  return getCurrentWorldCupMatch(cup);
}

export function countCompletedWorldCupMatches(cup: WorldCupState): number {
  return cup.rounds.reduce(
    (total, round) => total + round.filter((match) => match.winner !== null).length,
    0,
  );
}

export function sanitizeWorldCupState(value: unknown): WorldCupState | null {
  if (!isObject(value) || !isWorldCupStatus(value.status)) return null;
  if (value.status === 'idle') return createEmptyWorldCup();
  if (typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt) || value.startedAt < 0) return null;
  if (!Array.isArray(value.rounds) || value.rounds.length !== WORLD_CUP_ROUND_COUNTS.length) return null;

  const rounds: WorldCupMatch[][] = [];
  for (let roundIndex = 0; roundIndex < WORLD_CUP_ROUND_COUNTS.length; roundIndex++) {
    const rawRound = value.rounds[roundIndex];
    if (!Array.isArray(rawRound) || rawRound.length !== WORLD_CUP_ROUND_COUNTS[roundIndex]) return null;
    const round: WorldCupMatch[] = [];
    for (const rawMatch of rawRound) {
      if (!isObject(rawMatch)) return null;
      const teamA = sanitizeNullableTeam(rawMatch.teamA);
      const teamB = sanitizeNullableTeam(rawMatch.teamB);
      const winner = sanitizeNullableTeam(rawMatch.winner);
      if (!teamA.valid || !teamB.valid || !winner.valid) return null;
      if (winner.team && winner.team.key !== teamA.team?.key && winner.team.key !== teamB.team?.key) return null;
      round.push({ teamA: teamA.team, teamB: teamB.team, winner: winner.team });
    }
    rounds.push(round);
  }

  const champion = sanitizeNullableTeam(value.champion);
  if (!champion.valid) return null;
  const sanitized: WorldCupState = {
    status: value.status,
    startedAt: value.startedAt,
    rounds,
    champion: champion.team,
  };

  if (sanitized.status === 'in_progress') {
    if (sanitized.champion || !getCurrentWorldCupMatch(sanitized)) return null;
  } else {
    const finalMatch = sanitized.rounds[sanitized.rounds.length - 1][0];
    if (!sanitized.champion || finalMatch.winner?.key !== sanitized.champion.key) return null;
  }
  return sanitized;
}

function getSeedOrder(teamCount: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < teamCount) {
    const nextSeed = seeds.length * 2 + 1;
    seeds = seeds.flatMap((seed) => [seed, nextSeed - seed]);
  }
  return seeds;
}

function isWorldCupStatus(value: unknown): value is WorldCupStatus {
  return value === 'idle' || value === 'in_progress' || value === 'completed';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeNullableTeam(value: unknown): { valid: boolean; team: TeamPreset | null } {
  if (value === null) return { valid: true, team: null };
  if (!isObject(value) ||
    typeof value.name !== 'string' ||
    typeof value.flag !== 'string' ||
    typeof value.key !== 'string' ||
    !Array.isArray(value.aliases) ||
    !value.aliases.every((alias) => typeof alias === 'string') ||
    typeof value.color !== 'string') {
    return { valid: false, team: null };
  }
  return {
    valid: true,
    team: {
      name: value.name.slice(0, 64),
      flag: value.flag.slice(0, 16),
      key: value.key.slice(0, 16),
      aliases: value.aliases.slice(0, 100),
      color: value.color.slice(0, 32),
    },
  };
}
