import { afterEach, describe, expect, it } from 'vitest';
import { SynthEngine } from '../audio/SynthEngine';
import { state } from '../core/GameState';
import { BIOMES, cycleNextBiome, setActiveBiome } from './biomes';

describe('biome themes and scores', () => {
  const originalMusicMode = state.musicMode;
  const originalFrenzy = state.frenzyActive;
  const originalSuddenDeath = state.suddenDeathActive;

  afterEach(() => {
    state.musicMode = originalMusicMode;
    state.frenzyActive = originalFrenzy;
    state.suddenDeathActive = originalSuddenDeath;
    setActiveBiome('grove');
  });

  it('cycles through all ten biomes and wraps to the first', () => {
    expect(BIOMES).toHaveLength(10);
    expect(new Set(BIOMES.map((biome) => biome.id)).size).toBe(10);
    expect(BIOMES.map((biome) => biome.id)).toContain('sky-temple');
    expect(BIOMES.map((biome) => biome.id)).toContain('abyss');
    expect(BIOMES.map((biome) => biome.id)).toContain('crystal-cavern');
    expect(BIOMES.map((biome) => biome.id)).toContain('neon-city');
    expect(BIOMES.map((biome) => biome.id)).toContain('haunted-marsh');
    expect(BIOMES.map((biome) => biome.id)).toContain('stormfront');

    setActiveBiome('desert');
    expect(cycleNextBiome().id).toBe('sky-temple');
    setActiveBiome('stormfront');
    expect(cycleNextBiome().id).toBe('grove');
  });

  it('uses a distinct orchestral tempo for each biome score', () => {
    state.musicMode = 'starfox';
    state.frenzyActive = false;
    state.suddenDeathActive = false;
    const synth = new SynthEngine();
    const tempos = BIOMES.map((biome) => {
      setActiveBiome(biome.id);
      return synth.getCurrentBPM();
    });

    expect(new Set(tempos).size).toBe(10);
  });
});
