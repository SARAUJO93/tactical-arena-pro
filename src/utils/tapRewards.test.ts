import { describe, expect, it } from 'vitest';
import { consumeTapRewards } from './tapRewards';

describe('consumeTapRewards', () => {
  it('procesa todo el excedente y conserva el residuo', () => {
    expect(consumeTapRewards(10, 1000, 15)).toEqual({
      rewardCount: 67,
      residue: 5,
    });
  });

  it('ignora entradas no finitas y normaliza el umbral', () => {
    expect(consumeTapRewards(Number.NaN, Number.POSITIVE_INFINITY, 0)).toEqual({
      rewardCount: 0,
      residue: 0,
    });
  });

  it('conserva likes acumulados sin perder progreso', () => {
    expect(consumeTapRewards(14, 1, 15)).toEqual({
      rewardCount: 1,
      residue: 0,
    });
  });
});
