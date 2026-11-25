import { describe, expect, it } from 'vitest';
import { BIOMES } from '../config/biomes';
import { getWeeklyCalendar, getWeeklyEventForDate } from './WeeklySchedule';

describe('weekly biome rotation', () => {
  it('keeps the Monday featured biome fixed for the full local week', () => {
    const monday = new Date(2026, 10, 23, 12);
    const mondayEvent = getWeeklyEventForDate(monday);
    expect(mondayEvent.id).toBe('monday_biome');
    expect(mondayEvent.featuredBiomeId).not.toBeNull();

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(2026, 10, 23 + dayOffset, 12);
      const mondayCalendarItem = getWeeklyCalendar(date)[0];
      expect(mondayCalendarItem.detail).toBe(`Bioma fijo: ${mondayEvent.description.replace('Mapa destacado: ', '')}`);
    }
  });

  it('rotates through all ten biomes once before repeating', () => {
    const firstMonday = new Date(2026, 10, 23, 12);
    const firstBiomeIndex = BIOMES.findIndex(
      (biome) => biome.id === getWeeklyEventForDate(firstMonday).featuredBiomeId,
    );
    const scheduledBiomeIds = Array.from({ length: BIOMES.length }, (_, weekOffset) => {
      const monday = new Date(2026, 10, 23 + weekOffset * 7, 12);
      return getWeeklyEventForDate(monday).featuredBiomeId;
    });
    const expectedBiomeIds = Array.from(
      { length: BIOMES.length },
      (_, offset) => BIOMES[(firstBiomeIndex + offset) % BIOMES.length].id,
    );

    expect(scheduledBiomeIds).toEqual(expectedBiomeIds);
    expect(new Set(scheduledBiomeIds).size).toBe(10);
  });

  it('preserves the other weekly event rules', () => {
    expect(getWeeklyEventForDate(new Date(2026, 10, 24, 12)).id).toBe('regular');
    expect(getWeeklyEventForDate(new Date(2026, 10, 25, 12))).toMatchObject({
      id: 'wednesday_faction',
      factionGoalLikes: 100,
      featuredBiomeId: null,
    });
    expect(getWeeklyEventForDate(new Date(2026, 10, 28, 12))).toMatchObject({
      id: 'saturday_finals',
      isFeatured: true,
      featuredBiomeId: null,
    });
  });
});
