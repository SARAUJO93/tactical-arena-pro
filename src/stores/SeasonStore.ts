import { SeasonData, PlayerRecord, TeamRecord, MvpEntry, TeamPreset } from '../core/GameState';
import { WORLD_ROSTER, SEASON_DURATION_DAYS, MAX_SEASON_HISTORY, POINTS_WIN_NORMAL, POINTS_WIN_FEATURED } from './GameStore';

function makeInitialSeason(roster: TeamPreset[]): SeasonData {
  const now = Date.now();
  const end = now + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;
  return {
    index: 1,
    startDate: now,
    endDate: end,
    championKey: null,
    championName: null,
    championFlag: null,
    championMvp: null,
    topMvps: [],
    standings: roster.map((t) => ({
      key: t.key,
      name: t.name,
      flag: t.flag,
      color: t.color,
      points: 0,
      participation: 0,
      wins: 0,
      losses: 0,
    })),
  };
}

function ensureStandingsEntry(season: SeasonData, team: TeamPreset) {
  let e = season.standings.find((s) => s.key === team.key);
  if (!e) {
    e = {
      key: team.key,
      name: team.name,
      flag: team.flag,
      color: team.color,
      points: 0,
      participation: 0,
      wins: 0,
      losses: 0,
    };
    season.standings.push(e);
  }
  return e;
}

export class SeasonStore {
  currentSeason: SeasonData;
  seasonHistory: SeasonData[] = [];
  lastSeasonReset = Date.now();
  lastDailyReset = Date.now();

  constructor(roster: TeamPreset[] = WORLD_ROSTER) {
    this.currentSeason = makeInitialSeason(roster);
  }

  updateStandingsForRound(winnerBase: TeamPreset, loserBase: TeamPreset, featured: boolean, roundMvp: MvpEntry | null): void {
    if (this.currentSeason.standings.length === 0) return;

    const winEntry = ensureStandingsEntry(this.currentSeason, winnerBase);
    const loseEntry = ensureStandingsEntry(this.currentSeason, loserBase);
    winEntry.wins += 1;
    winEntry.points += featured ? POINTS_WIN_FEATURED : POINTS_WIN_NORMAL;
    winEntry.participation += 1;
    loseEntry.losses += 1;
    loseEntry.participation += 1;
    if (roundMvp) {
      this.currentSeason.topMvps.push({ ...roundMvp });
      this.currentSeason.topMvps.sort((a, b) => b.score - a.score);
      if (this.currentSeason.topMvps.length > 100) this.currentSeason.topMvps.length = 100;
    }
  }

  closeCurrentSeason(teamRecords: Record<string, TeamRecord>): void {
    const season = this.currentSeason;
    if (season.standings.length === 0) return;

    const sorted = [...season.standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });
    const champ = sorted[0];
    if (!champ) return;

    season.championKey = champ.key;
    season.championName = champ.name;
    season.championFlag = champ.flag;

    const topMvp = season.topMvps[0] ?? null;
    season.championMvp = topMvp ? { user: topMvp.user, avatarUrl: topMvp.avatarUrl, score: topMvp.score } : null;

    const teamRec = teamRecords[champ.key];
    if (teamRec) teamRec.championships += 1;

    this.seasonHistory.push(structuredClone(season));
    if (this.seasonHistory.length > MAX_SEASON_HISTORY) this.seasonHistory.shift();

    this.lastSeasonReset = Date.now();
  }

  startNewSeason(roster: TeamPreset[]): void {
    const nextIndex = (this.currentSeason.index || 0) + 1;
    const now = Date.now();
    this.currentSeason = {
      index: nextIndex,
      startDate: now,
      endDate: now + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000,
      championKey: null,
      championName: null,
      championFlag: null,
      championMvp: null,
      topMvps: [],
      standings: roster.map((t) => ({
        key: t.key,
        name: t.name,
        flag: t.flag,
        color: t.color,
        points: 0,
        participation: 0,
        wins: 0,
        losses: 0,
      })),
    };
  }

  resetDaily(playerRecords: Record<string, PlayerRecord>): void {
    for (const rec of Object.values(playerRecords)) {
      rec.period.coinsToday = 0;
      rec.period.tapsToday = 0;
    }
    this.lastDailyReset = Date.now();
  }

  resetIfNeeded(playerRecords: Record<string, PlayerRecord>): void {
    const today = new Date().toDateString();
    const lastDay = new Date(this.lastDailyReset).toDateString();
    if (today !== lastDay) this.resetDaily(playerRecords);

    if (Date.now() > this.currentSeason.endDate) {
      this.closeCurrentSeason({} as Record<string, TeamRecord>);
      this.startNewSeason(WORLD_ROSTER);
    }
  }

  getStandings(): SeasonData['standings'] {
    return [...this.currentSeason.standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });
  }

  getPreviousSeasonChampion(): SeasonData | null {
    for (let i = this.seasonHistory.length - 1; i >= 0; i--) {
      if (this.seasonHistory[i]?.championName) return this.seasonHistory[i];
    }
    return null;
  }
}

export const seasonStore = new SeasonStore();