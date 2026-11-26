import { describe, expect, it } from 'vitest';
import { colorsContrastWell, resolveContrastingTeamColors } from './teamColors';

describe('resolveContrastingTeamColors', () => {
  it('mantiene colores que ya contrastan bien (ej. México vs Argentina)', () => {
    const result = resolveContrastingTeamColors('#10B981', '#38BDF8', 'AR');
    expect(result).toEqual({ colorA: '#10B981', colorB: '#38BDF8' });
  });

  it('cambia el color del equipo B cuando chocan dos países rojos', () => {
    const result = resolveContrastingTeamColors('#EF4444', '#DC2626', 'VN');
    expect(result.colorA).toBe('#EF4444');
    expect(result.colorB).not.toBe('#DC2626');
    expect(colorsContrastWell(result.colorA, result.colorB)).toBe(true);
  });

  it('cambia el color del equipo B cuando chocan dos tonos de azul', () => {
    const result = resolveContrastingTeamColors('#2563EB', '#38BDF8', 'AR');
    expect(colorsContrastWell(result.colorA, result.colorB)).toBe(true);
  });

  it('es idempotente si se vuelve a ejecutar durante la misma partida', () => {
    const first = resolveContrastingTeamColors('#EF4444', '#F43F5E', 'CA');
    const second = resolveContrastingTeamColors(first.colorA, first.colorB, 'CA');
    expect(second).toEqual(first);
  });
});