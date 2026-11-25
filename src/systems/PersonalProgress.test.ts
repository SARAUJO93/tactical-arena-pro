import { describe, expect, it } from 'vitest';
import { getCosmeticFrameFromBadges } from './SeasonPass';
import {
  BIOME_EXPLORER_BADGE,
  getBiomeExplorationProgress,
  recordBiomeExploration,
} from './PersonalProgress';

describe('biome exploration mastery', () => {
  it('persists progress across distinct biomes and unlocks the free cosmetic once', () => {
    const badges: string[] = [];

    expect(recordBiomeExploration(badges, 'grove')).toMatchObject({
      visited: 1,
      target: 3,
      newBiome: true,
      newlyUnlocked: false,
    });
    expect(recordBiomeExploration(badges, 'grove')).toMatchObject({
      visited: 1,
      newBiome: false,
      newlyUnlocked: false,
    });
    expect(recordBiomeExploration(badges, 'frost').visited).toBe(2);
    expect(recordBiomeExploration(badges, 'sky-temple')).toMatchObject({
      visited: 3,
      complete: true,
      newlyUnlocked: true,
    });
    expect(badges).toContain(BIOME_EXPLORER_BADGE);
    expect(recordBiomeExploration(badges, 'abyss').newlyUnlocked).toBe(false);
    expect(getCosmeticFrameFromBadges(badges)).toMatchObject({
      emblem: '🧭',
      title: 'Explorador',
    });
  });

  it('ignores unknown biome markers in imported badge data', () => {
    expect(getBiomeExplorationProgress(['biome_visit:not-a-biome']).visited).toBe(0);
  });
});
