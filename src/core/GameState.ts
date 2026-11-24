import { TeamId } from './EventBus';
import { LruMap } from '../utils/helpers';

export const STORAGE_KEY = 'tactical_arena_v2_2_elixir';
export const MAX_BASE_HP = 3000;
export const MAX_SIDE_DEFENSE_HP = 1350;
export const METEOR_COIN_STEP = 500;
export const DESIGN_W = 390;

export interface TeamPreset {
  name: string;
  flag: string;
  key: string;
  aliases: string[];
  color: string;
}

export interface SideDefenseState {
  hp: number;
  maxHp: number;
  angle: number;
  cooldown: number;
  flash: number;
}

export interface BaseState extends TeamPreset {
  hp: number;
  wins: number;
  streak: number;
  flash: number;
  shieldHp: number;
  shieldTimer: number;
  shieldOwner: string;
  shieldAvatar: string;
  empTimer: number;
  panicActive: boolean;
  sideDefenses: [SideDefenseState, SideDefenseState];
  turretAngles: [number, number];
  turretCooldowns: [number, number];
}

export interface GiftSlot {
  id: string;
  tier: number;
  scope: 'team_a' | 'team_b' | 'universal';
  label: string;
  matchers: string;
  display: string;
  coins: number;
  emoji: string;
  imgUrl: string;
}

export interface MvpEntry {
  user: string;
  team: TeamId;
  avatarUrl: string;
  score: number;
}

export interface TelemetryData {
  sessionStart: number;
  totalCoins: number;
  totalGifts: number;
  totalTaps: number;
  totalFollows: number;
  totalShares: number;
  giftBreakdown: Record<string, { count: number; coins: number }>;
  wsLog: string[];
}

export const WORLD_ROSTER: TeamPreset[] = [
  { name: 'MÉXICO', flag: '🇲🇽', key: 'MX', aliases: ['mx', 'mexico', 'méxico'], color: '#10B981' },
  { name: 'ARGENTINA', flag: '🇦🇷', key: 'AR', aliases: ['ar', 'arg', 'argentina'], color: '#38BDF8' },
  { name: 'COLOMBIA', flag: '🇨🇴', key: 'CO', aliases: ['co', 'col', 'colombia'], color: '#F59E0B' },
  { name: 'ESPAÑA', flag: '🇪🇸', key: 'ES', aliases: ['es', 'esp', 'españa', 'espana'], color: '#F43F5E' },
  { name: 'PERÚ', flag: '🇵🇪', key: 'PE', aliases: ['pe', 'per', 'peru', 'perú'], color: '#FB7185' },
  { name: 'CHILE', flag: '🇨🇱', key: 'CL', aliases: ['cl', 'chi', 'chile'], color: '#3B82F6' },
  { name: 'BRASIL', flag: '🇧🇷', key: 'BR', aliases: ['br', 'bra', 'brasil'], color: '#22C55E' },
  { name: 'USA', flag: '🇺🇸', key: 'US', aliases: ['us', 'usa', 'eeuu'], color: '#818CF8' },
];

export const LIGAMX_ROSTER: TeamPreset[] = [
  { name: 'AMÉRICA', flag: '🦅', key: 'AME', aliases: ['ame', 'america', 'américa', 'aguilas'], color: '#FACC15' },
  { name: 'CHIVAS', flag: '🐐', key: 'CHI', aliases: ['chi', 'chivas', 'guadalajara'], color: '#EF4444' },
  { name: 'CRUZ AZUL', flag: '🚂', key: 'CAZ', aliases: ['caz', 'cruz azul', 'maquina'], color: '#38BDF8' },
  { name: 'PUMAS', flag: '🐾', key: 'PUM', aliases: ['pum', 'pumas', 'unam'], color: '#F59E0B' },
  { name: 'TIGRES', flag: '🐯', key: 'TIG', aliases: ['tig', 'tigres'], color: '#FB923C' },
  { name: 'RAYADOS', flag: '🤠', key: 'MTY', aliases: ['mty', 'rayados', 'monterrey'], color: '#60A5FA' },
];

export const DEFAULT_GIFT_SLOTS: GiftSlot[] = [
  { id: 't1a', tier: 1, scope: 'team_a', label: 'Soldados A', matchers: '5655, Rose, Rosa', display: 'Rose', coins: 1, emoji: '🌹', imgUrl: '' },
  { id: 't1b', tier: 1, scope: 'team_b', label: 'Soldados B', matchers: '5269, TikTok', display: 'TikTok', coins: 1, emoji: '🎵', imgUrl: '' },
  { id: 't2u', tier: 2, scope: 'universal', label: 'Tanque', matchers: '5879, Doughnut, Dona', display: 'Dona', coins: 30, emoji: '🍩', imgUrl: '' },
  { id: 't3u', tier: 3, scope: 'universal', label: 'Jet Furtivo', matchers: '5658, Perfume', display: 'Perfume', coins: 20, emoji: '🧴', imgUrl: '' },
  { id: 't5u', tier: 5, scope: 'universal', label: 'Escudo+15%', matchers: '7934, Heart Me, Corazón', display: 'Heart Me', coins: 10, emoji: '💙', imgUrl: '' },
  { id: 't6u', tier: 6, scope: 'universal', label: 'EMP (10s)', matchers: '5660, Hand Hearts, Rayo', display: 'EMP', coins: 100, emoji: '⚡', imgUrl: '' },
  { id: 't7u', tier: 7, scope: 'universal', label: 'Cyber Hack', matchers: '5760, Cap, Gorra, Hack', display: 'Hack', coins: 99, emoji: '👾', imgUrl: '' },
  { id: 't4u', tier: 4, scope: 'universal', label: 'Nuclear 3s', matchers: '5659, Galaxy, Galaxia, Lion', display: 'Galaxy', coins: 1000, emoji: '🌌', imgUrl: '' },
];

export function makeSideDefenseState(isTop: boolean): SideDefenseState {
  return {
    hp: MAX_SIDE_DEFENSE_HP,
    maxHp: MAX_SIDE_DEFENSE_HP,
    angle: isTop ? Math.PI / 2 : -Math.PI / 2,
    cooldown: 10 + Math.random() * 12,
    flash: 0,
  };
}

export function makeBaseState(teamData: TeamPreset, isTop: boolean): BaseState {
  return {
    ...teamData,
    hp: MAX_BASE_HP,
    wins: 0,
    streak: 0,
    flash: 0,
    shieldHp: 0,
    shieldTimer: 0,
    shieldOwner: '',
    shieldAvatar: '',
    empTimer: 0,
    panicActive: false,
    sideDefenses: [makeSideDefenseState(isTop), makeSideDefenseState(isTop)],
    turretAngles: isTop ? [Math.PI / 2, Math.PI / 2] : [-Math.PI / 2, -Math.PI / 2],
    turretCooldowns: [0, 12],
  };
}

export const state = {
  roster: structuredClone(WORLD_ROSTER) as TeamPreset[],
  rosterCursor: 2,
  tournamentMode: true,
  teamA: makeBaseState(WORLD_ROSTER[0], true),
  teamB: makeBaseState(WORLD_ROSTER[1], false),
  giftSlots: structuredClone(DEFAULT_GIFT_SLOTS) as GiftSlot[],

  personalTapThreshold: 15,
  frenzyGoalLikes: 100,
  unalignedTapSupportsUnderdog: true,

  aiDirectorEnabled: true,
  suddenDeathDurationSec: 180,
  roundActive: true,
  roundTimeLeft: 180,
  suddenDeathActive: false,
  frenzyActive: false,
  frenzyTimeLeft: 0,
  globalTapCount: 0,
  nextMeteorCoinTarget: METEOR_COIN_STEP,
  meteorRainRemaining: 0,
  lastRealInteractionAt: Date.now(),

  timeScale: 1.0,
  takeoverActive: false,
  audioEnabled: true,
  musicMode: 'starfox' as 'starfox' | 'pulse' | 'mp3' | 'off',
  musicVolume: 0.35,
  ttsEnabled: false,
  safeZonesVisible: false,
  demoMode: true,
  panelOpen: false,
  telemetryOpen: false,
  shake: 0,
  screenFlash: 0,

  sessionMVP: {} as Record<string, MvpEntry>,
  roundMVP: {} as Record<string, MvpEntry>,
  viewerTeams: new LruMap<string, TeamId>(500),
  viewerLikes: new LruMap<string, number>(500),

  telemetry: {
    sessionStart: Date.now(),
    totalCoins: 0,
    totalGifts: 0,
    totalTaps: 0,
    totalFollows: 0,
    totalShares: 0,
    giftBreakdown: {},
    wsLog: [],
  } as TelemetryData,
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function savePersistentState(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 800);
}

export function saveNow(): void {
  if (saveTimer) clearTimeout(saveTimer);
  const top20Mvp: Record<string, MvpEntry> = {};
  Object.values(state.sessionMVP)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .forEach((m) => (top20Mvp[m.user] = m));

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        roster: state.roster,
        rosterCursor: state.rosterCursor,
        tournamentMode: state.tournamentMode,
        teamA: {
          name: state.teamA.name, flag: state.teamA.flag, key: state.teamA.key,
          aliases: state.teamA.aliases, color: state.teamA.color,
          wins: state.teamA.wins, streak: state.teamA.streak,
        },
        teamB: {
          name: state.teamB.name, flag: state.teamB.flag, key: state.teamB.key,
          aliases: state.teamB.aliases, color: state.teamB.color,
          wins: state.teamB.wins, streak: state.teamB.streak,
        },
        giftSlots: state.giftSlots,
        personalTapThreshold: state.personalTapThreshold,
        frenzyGoalLikes: state.frenzyGoalLikes,
        unalignedTapSupportsUnderdog: state.unalignedTapSupportsUnderdog,
        aiDirectorEnabled: state.aiDirectorEnabled,
        audioEnabled: state.audioEnabled,
        musicMode: state.musicMode,
        musicVolume: state.musicVolume,
        ttsEnabled: state.ttsEnabled,
        sessionMVP: top20Mvp,
        telemetry: { ...state.telemetry, elapsedMs: Date.now() - state.telemetry.sessionStart },
      })
    );
  } catch {
    // Ignorar errores de cuota en OBS/Private mode
  }
}

export function loadPersistentState(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.roster) && d.roster.length >= 2) state.roster = d.roster;
    if (typeof d.rosterCursor === 'number') state.rosterCursor = d.rosterCursor;
    if (typeof d.tournamentMode === 'boolean') state.tournamentMode = d.tournamentMode;
    if (d.teamA) Object.assign(state.teamA, d.teamA);
    if (d.teamB) Object.assign(state.teamB, d.teamB);
    if (Array.isArray(d.giftSlots) && d.giftSlots.length === 8) state.giftSlots = d.giftSlots;
    if (typeof d.personalTapThreshold === 'number') state.personalTapThreshold = d.personalTapThreshold;
    if (typeof d.frenzyGoalLikes === 'number') state.frenzyGoalLikes = d.frenzyGoalLikes;
    if (typeof d.unalignedTapSupportsUnderdog === 'boolean') state.unalignedTapSupportsUnderdog = d.unalignedTapSupportsUnderdog;
    if (typeof d.aiDirectorEnabled === 'boolean') state.aiDirectorEnabled = d.aiDirectorEnabled;
    if (typeof d.audioEnabled === 'boolean') state.audioEnabled = d.audioEnabled;
    if (typeof d.musicMode === 'string') state.musicMode = d.musicMode as typeof state.musicMode;
    if (typeof d.musicVolume === 'number') state.musicVolume = d.musicVolume;
    if (typeof d.ttsEnabled === 'boolean') state.ttsEnabled = d.ttsEnabled;
    if (d.sessionMVP && typeof d.sessionMVP === 'object') state.sessionMVP = d.sessionMVP;
    if (d.telemetry && typeof d.telemetry === 'object') {
      Object.assign(state.telemetry, d.telemetry);
      state.telemetry.sessionStart = Date.now() - (Number(d.telemetry.elapsedMs) || 0);
    }
    state.nextMeteorCoinTarget = (Math.floor(state.telemetry.totalCoins / METEOR_COIN_STEP) + 1) * METEOR_COIN_STEP;
  } catch {
    // Estado corrupto: arrancar limpio
  }
}