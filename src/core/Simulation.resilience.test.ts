import { describe, expect, it } from 'vitest';
import { calculateFallbackDamage } from './Simulation';

describe('Simulation resilience', () => {
  it('normaliza daño invalido sin producir valores negativos o infinitos', () => {
    expect(calculateFallbackDamage(-10, 1, false)).toBe(0);
    expect(calculateFallbackDamage(Infinity, 1, false)).toBe(0);
    expect(calculateFallbackDamage(25, Infinity, false)).toBe(0);
  });

  it('aplica multiplicador y frenesí de forma determinista', () => {
    expect(calculateFallbackDamage(20, 1.5, false)).toBe(30);
    expect(calculateFallbackDamage(20, 1.5, true)).toBe(60);
  });

  it('acepta daño normal en frenesí sin duplicarlo por defecto', () => {
    expect(calculateFallbackDamage(11, 1, false)).toBe(11);
  });
});
