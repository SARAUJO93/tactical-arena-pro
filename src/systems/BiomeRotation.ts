import { BIOMES, BiomeTheme } from '../config/biomes';

const BIOME_IDS = new Set(BIOMES.map((biome) => biome.id));

function isBiomeId(value: unknown): value is BiomeTheme['id'] {
  return typeof value === 'string' && BIOME_IDS.has(value as BiomeTheme['id']);
}

export class BiomeRotationSystem {
  private remaining: BiomeTheme['id'][] = [];

  constructor(private readonly random: () => number = Math.random) {}

  restore(currentBiomeId: BiomeTheme['id'], savedRotation: unknown): void {
    const savedIds = Array.isArray(savedRotation) ? savedRotation.filter(isBiomeId) : [];
    this.remaining = [...new Set(savedIds)].filter((id) => id !== currentBiomeId);
    if (this.remaining.length === 0) this.refill(currentBiomeId);
  }

  getOptions(featuredBiomeId: BiomeTheme['id'] | null = null): BiomeTheme[] {
    if (this.remaining.length === 0) throw new Error('Biome rotation must be initialized before choosing');

    const featuredIndex = featuredBiomeId ? this.remaining.indexOf(featuredBiomeId) : -1;
    if (featuredIndex >= 0 && this.remaining.length > 1) {
      const alternatives = this.remaining.filter((id) => id !== featuredBiomeId);
      const alternative = alternatives[Math.floor(this.random() * alternatives.length)];
      const featured = BIOMES.find((biome) => biome.id === featuredBiomeId)!;
      const randomBiome = BIOMES.find((biome) => biome.id === alternative)!;
      return this.random() < 0.5 ? [featured, randomBiome] : [randomBiome, featured];
    }

    return this.remaining
      .slice(0, 2)
      .map((id) => BIOMES.find((biome) => biome.id === id)!);
  }

  select(biomeId: BiomeTheme['id']): void {
    const index = this.remaining.indexOf(biomeId);
    if (index < 0) throw new Error(`Biome is not available in the current rotation: ${biomeId}`);
    this.remaining.splice(index, 1);
    if (this.remaining.length === 0) this.refill(biomeId);
  }

  getRemainingIds(): BiomeTheme['id'][] {
    return [...this.remaining];
  }

  private refill(excludedBiomeId: BiomeTheme['id']): void {
    this.remaining = BIOMES
      .map((biome) => biome.id)
      .filter((id) => id !== excludedBiomeId);
    for (let index = this.remaining.length - 1; index > 0; index--) {
      const otherIndex = Math.floor(this.random() * (index + 1));
      [this.remaining[index], this.remaining[otherIndex]] =
        [this.remaining[otherIndex], this.remaining[index]];
    }
  }
}
