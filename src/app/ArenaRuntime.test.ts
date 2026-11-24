import { describe, expect, it } from 'vitest';
import { consumeAccumulator } from './ArenaRuntime';

describe('consumeAccumulator', () => {
  it('acumula fracciones sin perder el residuo', () => {
    expect(consumeAccumulator(0.4, 0.6, 1)).toEqual({
      accumulator: 0,
      elapsedIntervals: 1,
    });
  });

  it('acumula varios intervalos y conserva el residuo', () => {
    const result = consumeAccumulator(0.8, 2.5, 1);
    expect(result.accumulator).toBeCloseTo(0.3, 10);
    expect(result.elapsedIntervals).toBe(3);
  });

  it('ignora deltas negativos', () => {
    expect(consumeAccumulator(0.25, -1, 1)).toEqual({
      accumulator: 0.25,
      elapsedIntervals: 0,
    });
  });
});
