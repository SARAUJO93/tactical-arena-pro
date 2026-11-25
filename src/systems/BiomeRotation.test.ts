import { describe, expect, it } from 'vitest';
import { BIOMES } from '../config/biomes';
import { BiomeRotationSystem } from './BiomeRotation';

describe('BiomeRotationSystem', () => {
  it('offers distinct randomized options and removes only the selected biome', () => {
    const rotation = new BiomeRotationSystem(() => 0);
    rotation.restore('grove', []);

    const [first, second] = rotation.getOptions();
    expect(first.id).not.toBe(second.id);
    expect([first.id, second.id]).not.toContain('grove');

    rotation.select(second.id);
    expect(rotation.getRemainingIds()).toContain(first.id);
    expect(rotation.getRemainingIds()).not.toContain(second.id);
  });

  it('visits every biome once before starting a new cycle without repeating the last one', () => {
    const rotation = new BiomeRotationSystem(() => 0);
    rotation.restore('grove', []);
    const visited = new Set<BiomeThemeId>(['grove']);

    while (visited.size < BIOMES.length) {
      const next = rotation.getOptions()[0];
      expect(visited.has(next.id)).toBe(false);
      visited.add(next.id);
      rotation.select(next.id);
    }

    const lastVisited = Array.from(visited).pop();
    const nextOptions = rotation.getOptions();
    expect(nextOptions.every((biome) => biome.id !== lastVisited)).toBe(true);
    expect(new Set(nextOptions.map((biome) => biome.id)).size).toBe(nextOptions.length);
  });

  it('restores a valid remaining order and ignores invalid or repeated ids', () => {
    const rotation = new BiomeRotationSystem(() => 0);
    rotation.restore('grove', ['frost', 'unknown', 'frost', 'grove', 'volcano']);

    expect(rotation.getRemainingIds()).toEqual(['frost', 'volcano']);
    expect(rotation.getOptions().map((biome) => biome.id)).toEqual(['frost', 'volcano']);
  });

  it('offers the weekly featured biome only while it remains in the rotation', () => {
    const rotation = new BiomeRotationSystem(() => 0);
    rotation.restore('grove', ['frost', 'volcano', 'desert']);

    expect(rotation.getOptions('desert').map((biome) => biome.id)).toEqual(['desert', 'frost']);
    rotation.select('desert');
    expect(rotation.getOptions('desert').map((biome) => biome.id)).toEqual(['frost', 'volcano']);
  });

  it('offers the final remaining biome by itself before beginning a new cycle', () => {
    const rotation = new BiomeRotationSystem(() => 0);
    rotation.restore('grove', ['frost']);

    expect(rotation.getOptions().map((biome) => biome.id)).toEqual(['frost']);
    rotation.select('frost');
    expect(rotation.getRemainingIds()).not.toContain('frost');
  });
});

type BiomeThemeId = typeof BIOMES[number]['id'];
