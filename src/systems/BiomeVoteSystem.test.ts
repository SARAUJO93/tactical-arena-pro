import { describe, expect, it } from 'vitest';
import { BIOMES } from '../config/biomes';
import { BiomeVoteSystem } from './BiomeVoteSystem';

describe('BiomeVoteSystem', () => {
  it('counts one vote per viewer and lets the viewer change it', () => {
    const vote = new BiomeVoteSystem();
    vote.start([BIOMES[0], BIOMES[1]]);

    expect(vote.castVote('@Viewer', '1')).toMatchObject({
      votesFirst: 1,
      votesSecond: 0,
      totalVotes: 1,
    });
    expect(vote.castVote('@viewer', '!bioma 2')).toMatchObject({
      votesFirst: 0,
      votesSecond: 1,
      totalVotes: 1,
    });
    expect(vote.castVote('@Other', '#1')).toMatchObject({
      votesFirst: 1,
      votesSecond: 1,
      totalVotes: 2,
    });
  });

  it('ignores malformed votes and resolves a tie to the first option', () => {
    const vote = new BiomeVoteSystem();
    vote.start([BIOMES[0], BIOMES[1]]);

    expect(vote.castVote('@Viewer', 'option 1')).toBeNull();
    expect(vote.finish()?.id).toBe(BIOMES[0].id);
    expect(vote.getSnapshot()).toBeNull();
  });

  it('rejects duplicate biome options', () => {
    const vote = new BiomeVoteSystem();
    expect(() => vote.start([BIOMES[0], BIOMES[0]])).toThrow('Biome vote options must be distinct');
  });
});
