import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_GIFT_SLOTS, makeBaseState, state, WORLD_ROSTER } from '../core/GameState';
import {
  clearComboDeltaTracker,
  computeTikFinityDelta,
  registerChatAlignment,
  routeGiftV2,
} from './GiftMapper';

describe('GiftMapper', () => {
  beforeEach(() => {
    clearComboDeltaTracker();
    state.viewerTeams.clear();
    state.giftSlots = structuredClone(DEFAULT_GIFT_SLOTS);
    state.teamA = makeBaseState(WORLD_ROSTER[0], true);  // MÉXICO (MX)
    state.teamB = makeBaseState(WORLD_ROSTER[1], false); // ARGENTINA (AR)
  });

  it('calcula deltas incrementales de combos TikFinity y limpia al recibir repeatEnd', () => {
    expect(computeTikFinityDelta('u1', 5655, 'm1', 1, false, 1000)).toBe(1);
    expect(computeTikFinityDelta('u1', 5655, 'm2', 4, false, 1500)).toBe(3);
    expect(computeTikFinityDelta('u1', 5655, 'm3', 4, false, 1600)).toBe(0);
    expect(computeTikFinityDelta('u1', 5655, 'm4', 6, true, 2000)).toBe(2);

    // Nuevo combo después de repeatEnd arranca desde 0
    expect(computeTikFinityDelta('u1', 5655, 'm5', 2, false, 2500)).toBe(2);
  });

  it('expira combos inactivos después de 15 segundos', () => {
    expect(computeTikFinityDelta('u2', 5655, 'm1', 5, false, 1000)).toBe(5);
    expect(computeTikFinityDelta('u2', 5655, 'm2', 3, false, 17000)).toBe(3);
  });

  it('alinea usuarios por chat con clave corta o alias e ignora mensajes ambiguos', () => {
    expect(registerChatAlignment('carlos', 'MX')).toBe('A');
    expect(state.viewerTeams.get('@carlos')).toBe('A');

    expect(registerChatAlignment('@sofia', 'vamos argentina!')).toBe('B');
    expect(state.viewerTeams.get('@sofia')).toBe('B');

    // Si menciona ambos equipos, no cambia alineación
    expect(registerChatAlignment('@neutro', 'mexico argentina')).toBeNull();
    expect(state.viewerTeams.get('@neutro')).toBeUndefined();
  });

  it('enruta regalos de equipo fijo (Rose -> A, TikTok -> B) por giftId o nombre', () => {
    expect(routeGiftV2(5655, 'Rose', 1, '@alguien')).toEqual({ team: 'A', tier: 1, coins: 1 });
    expect(routeGiftV2(9999, 'TikTok', 1, '@alguien')).toEqual({ team: 'B', tier: 1, coins: 1 });
  });

  it('enruta regalos universales al equipo alineado del usuario o al underdog', () => {
    registerChatAlignment('@vip', 'AR');
    expect(routeGiftV2(5879, 'Doughnut', 30, '@vip')).toEqual({ team: 'B', tier: 2, coins: 30 });

    // Usuario sin equipo: apoya al que tiene menos HP (equipo B)
    state.teamA.hp = 2500;
    state.teamB.hp = 1800;
    expect(routeGiftV2(5659, 'Galaxy', 1000, '@nuevo')).toEqual({ team: 'B', tier: 4, coins: 1000 });
  });

  it('aplica fallback por diamondCount cuando el regalo no está mapeado', () => {
    registerChatAlignment('@fan', 'MX');
    expect(routeGiftV2(99999, 'RegaloDesconocido', 600, '@fan')).toEqual({ team: 'A', tier: 4, coins: 600 });
    expect(routeGiftV2(99999, 'RegaloDesconocido', 100, '@fan')).toEqual({ team: 'A', tier: 6, coins: 100 });
    expect(routeGiftV2(99999, 'RegaloDesconocido', 25, '@fan')).toEqual({ team: 'A', tier: 2, coins: 25 });
    expect(routeGiftV2(99999, 'RegaloDesconocido', 10, '@fan')).toEqual({ team: 'A', tier: 5, coins: 10 });
    expect(routeGiftV2(99999, 'RegaloDesconocido', 1, '@fan')).toEqual({ team: 'A', tier: 1, coins: 1 });
  });
});