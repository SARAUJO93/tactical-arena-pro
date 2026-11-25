import { BIOMES, BiomeTheme } from '../config/biomes';
import { FACTION_GOAL_DEFAULT_LIKES } from './FactionGoals';

const MS_PER_WEEK = 7 * 86_400_000;
const ROTATION_ANCHOR_MONDAY_UTC = Date.UTC(1970, 0, 5);

export type WeeklyEventId = 'monday_biome' | 'wednesday_faction' | 'saturday_finals' | 'regular';

export interface WeeklyEvent {
  id: WeeklyEventId;
  dayLabel: string;
  badge: string;
  title: string;
  description: string;
  isFeatured: boolean;
  factionGoalLikes: number;
  featuredBiomeId: BiomeTheme['id'] | null;
}

export interface WeeklyCalendarItem {
  dayShort: string;
  badge: string;
  title: string;
  detail: string;
  isToday: boolean;
}

function getFeaturedBiomeForWeek(date: Date): BiomeTheme {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);

  const weekStartUtc = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const weekIndex = Math.floor((weekStartUtc - ROTATION_ANCHOR_MONDAY_UTC) / MS_PER_WEEK);
  const biomeIndex = ((weekIndex % BIOMES.length) + BIOMES.length) % BIOMES.length;
  return BIOMES[biomeIndex];
}

export function getWeeklyEventForDate(date = new Date()): WeeklyEvent {
  const day = date.getDay(); // 0 = Dom, 1 = Lun, 3 = Mié, 6 = Sáb

  if (day === 1) {
    const biome = getFeaturedBiomeForWeek(date);
    return {
      id: 'monday_biome',
      dayLabel: 'LUNES',
      badge: biome.icon,
      title: 'Lunes de Bioma',
      description: `Bioma destacado de la semana: ${biome.name}`,
      isFeatured: false,
      factionGoalLikes: FACTION_GOAL_DEFAULT_LIKES,
      featuredBiomeId: biome.id,
    };
  }

  if (day === 3) {
    return {
      id: 'wednesday_faction',
      dayLabel: 'MIÉRCOLES',
      badge: '🛡️',
      title: 'Miércoles de Bandos',
      description: 'Meta de Escudo de Bando a 100 ❤️',
      isFeatured: false,
      factionGoalLikes: 100,
      featuredBiomeId: null,
    };
  }

  if (day === 6) {
    return {
      id: 'saturday_finals',
      dayLabel: 'SÁBADO',
      badge: '🏆',
      title: 'Final de Semana',
      description: 'Rondas Featured: +5 pts en Liga',
      isFeatured: true,
      factionGoalLikes: FACTION_GOAL_DEFAULT_LIKES,
      featuredBiomeId: null,
    };
  }

  return {
    id: 'regular',
    dayLabel: 'LIGA',
    badge: '⚔️',
    title: 'Liga Regular',
    description: 'Rotación de biomas · +3 pts por victoria',
    isFeatured: false,
    factionGoalLikes: FACTION_GOAL_DEFAULT_LIKES,
    featuredBiomeId: null,
  };
}

export function getWeeklyCalendar(date = new Date()): WeeklyCalendarItem[] {
  const day = date.getDay();
  const weekBiome = getFeaturedBiomeForWeek(date);

  return [
    {
      dayShort: 'LUN',
      badge: weekBiome.icon,
      title: 'Lunes de Bioma',
      detail: `Bioma destacado: ${weekBiome.name}`,
      isToday: day === 1,
    },
    {
      dayShort: 'MIÉ',
      badge: '🛡️',
      title: 'Miércoles de Bandos',
      detail: 'Escudo de Bando a 100 ❤️',
      isToday: day === 3,
    },
    {
      dayShort: 'SÁB',
      badge: '🏆',
      title: 'Final de Semana',
      detail: 'Rondas Featured (+5 pts Liga)',
      isToday: day === 6,
    },
  ];
}