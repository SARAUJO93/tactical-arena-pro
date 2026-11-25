import { BiomeTheme } from '../config/biomes';

const MAX_BIOME_VOTERS = 500;

export interface BiomeVoteSnapshot {
  first: BiomeTheme;
  second: BiomeTheme;
  votesFirst: number;
  votesSecond: number;
  totalVotes: number;
}

export class BiomeVoteSystem {
  private options: readonly [BiomeTheme, BiomeTheme] | null = null;
  private ballots = new Map<string, 1 | 2>();

  start(options: readonly [BiomeTheme, BiomeTheme]): BiomeVoteSnapshot {
    if (options[0].id === options[1].id) throw new Error('Biome vote options must be distinct');
    this.options = options;
    this.ballots.clear();
    return this.getSnapshot()!;
  }

  castVote(user: string, comment: string): BiomeVoteSnapshot | null {
    if (!this.options) return null;
    const match = comment.trim().match(/^(?:!bioma\s*)?#?([12])$/i);
    const cleanUser = user.trim().toLowerCase();
    if (!match || !cleanUser) return null;
    if (!this.ballots.has(cleanUser) && this.ballots.size >= MAX_BIOME_VOTERS) return null;

    this.ballots.set(cleanUser, Number(match[1]) as 1 | 2);
    return this.getSnapshot();
  }

  finish(): BiomeTheme | null {
    const snapshot = this.getSnapshot();
    if (!snapshot) return null;
    const winner = snapshot.votesFirst >= snapshot.votesSecond ? snapshot.first : snapshot.second;
    this.reset();
    return winner;
  }

  getSnapshot(): BiomeVoteSnapshot | null {
    if (!this.options) return null;
    let votesFirst = 0;
    let votesSecond = 0;
    for (const vote of this.ballots.values()) {
      if (vote === 1) votesFirst++;
      else votesSecond++;
    }
    return {
      first: this.options[0],
      second: this.options[1],
      votesFirst,
      votesSecond,
      totalVotes: this.ballots.size,
    };
  }

  reset(): void {
    this.options = null;
    this.ballots.clear();
  }
}
