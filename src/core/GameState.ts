import { TeamId } from './EventBus';
import { LruMap } from '../utils/helpers';
import { BIOMES, BiomeTheme } from '../config/biomes';
import {
  createEmptyWorldCup,
  createWorldCup,
  getCurrentWorldCupMatch,
  sanitizeWorldCupState,
  WorldCupMatch,
  WorldCupState,
} from '../systems/WorldCup';

export const STORAGE_KEY = 'tactical_arena_v2_3_league';
export const PERSISTENCE_SCHEMA_VERSION = 5;
export const MAX_BASE_HP = 3000;
export const MAX_SIDE_DEFENSE_HP = 1050;
export const ROUND_DURATION_SEC = 180;
export const SUDDEN_DEATH_DURATION_SEC = 60;
export const METEOR_COIN_STEP = 500;
export const DESIGN_W = 390;

/* =====================================================================
   ROSTER / BIOMES / GIFT SLOTS  (sin cambios de forma)
   ===================================================================== */

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
  roundCount: number;
  totalRoundDurationSec: number;
  longestRoundSec: number;
  runtimeErrorCount: number;
  persistenceErrorCount: number;
  websocketDisconnectCount: number;
  fps: number;
  averageFrameMs: number;
  maxFrameMs: number;
  usedHeapMb: number | null;
  errorLog: string[];
  giftBreakdown: Record<string, { count: number; coins: number }>;
  wsLog: string[];
  structuredLog: Array<{ ts: number; level: 'info' | 'warn' | 'error'; event: string; detail: string }>;
}

/* =====================================================================
   FASE A — MODELO DE DATOS COMPETITIVO
   ===================================================================== */

/** Registro histórico (lifetime) de un viewer/jugador. */
export interface PlayerRecord {
  user: string;
  avatarUrl: string;
  favoriteTeam: TeamId | null;
  lifetime: {
    taps: number;
    coins: number;
    gifts: number;
    follows: number;
    shares: number;
    kills: number;
    baseDamage: number;
    towerKills: number;
  };
  /** Acumuladores para leaderboards por periodo. Se resetean con resetIfNeeded(). */
  period: {
    coinsToday: number;
    tapsToday: number;
    coinsSeason: number;
    tapsSeason: number;
  };
  peaks: {
    maxSessionScore: number;
    maxRoundScore: number;
    maxTapsRound: number;
    maxCoinsRound: number;
  };
  mvpSessions: number;
  mvpRounds: number;
  teamsSupported: Partial<Record<TeamId, number>>;
  badges: string[];
  dailyStreak?: number;
  bestDailyStreak?: number;
  lastStreakDay?: string;
  streakXp?: number;
  firstSeen: number;
  lastSeen: number;
}

/** Registro histórico de un equipo (nación / club). Persistente entre sesiones. */
export interface TeamRecord {
  key: string;
  name: string;
  flag: string;
  color: string;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  championships: number;
  elo: number;
  totalCoinsSpent: number;
  totalTaps: number;
  lastPlayed: number;
}

/** Registro de un round finalizado. Se guardan los últimos MAX_ROUND_LOGS. */
export interface RoundLog {
  id: string;
  ts: number;
  durationSec: number;
  winner: TeamId;
  winnerKey: string;
  winnerName: string;
  loserKey: string;
  loserName: string;
  suddenDeath: boolean;
  featured: boolean;
  biome: string;
  totalCoins: number;
  totalTaps: number;
  mvp: { user: string; avatarUrl: string; score: number } | null;
  topGifter: { user: string; coins: number } | null;
}

/** Datos de una temporada (4 semanas). */
export interface SeasonData {
  index: number;
  startDate: number;
  endDate: number;
  championKey: string | null;
  championName: string | null;
  championFlag: string | null;
  championMvp: { user: string; avatarUrl: string; score: number } | null;
  topMvps: MvpEntry[];
  standings: Array<{
    key: string;
    name: string;
    flag: string;
    color: string;
    points: number;
    participation: number;
    wins: number;
    losses: number;
  }>;
}

/** Récords globales históricos (no per-player). */
export interface GlobalRecords {
  biggestSingleRound: { coins: number; ts: number; winnerKey: string } | null;
  fastestRound: { durationSec: number; ts: number; winnerKey: string } | null;
  longestRound: { durationSec: number; ts: number; winnerKey: string } | null;
  biggestUpset: { eloDiff: number; ts: number; winnerKey: string; loserKey: string } | null;
}

/* =====================================================================
   CONSTANTES DE FASE A
   ===================================================================== */

export const MAX_ROUND_LOGS = 500;
export const MAX_PLAYER_RECORDS = 200;
export const MAX_SEASON_HISTORY = 12;
export const MAX_ERROR_LOG_ENTRIES = 40;
export const MAX_WS_LOG_ENTRIES = 40;
export const MAX_STRUCTURED_LOG_ENTRIES = 40;
export const MAX_PERSISTENCE_SNAPSHOTS = 10;
export const SEASON_DURATION_DAYS = 28;
export const ELO_INITIAL = 1500;
export const ELO_K_FACTOR = 32;
export const POINTS_WIN_NORMAL = 3;
export const POINTS_WIN_FEATURED = 5;
export const POINTS_PARTICIPATION = 1;

export const WORLD_ROSTER: TeamPreset[] = [
  { name: 'MÉXICO', flag: '🇲🇽', key: 'MX', aliases: ['mx', 'mexico', 'méxico'], color: '#10B981' },
  { name: 'ARGENTINA', flag: '🇦🇷', key: 'AR', aliases: ['ar', 'arg', 'argentina'], color: '#38BDF8' },
  { name: 'COLOMBIA', flag: '🇨🇴', key: 'CO', aliases: ['co', 'col', 'colombia'], color: '#F59E0B' },
  { name: 'ESPAÑA', flag: '🇪🇸', key: 'ES', aliases: ['es', 'esp', 'españa', 'espana'], color: '#F43F5E' },
  { name: 'PERÚ', flag: '🇵🇪', key: 'PE', aliases: ['pe', 'per', 'peru', 'perú'], color: '#FB7185' },
  { name: 'CHILE', flag: '🇨🇱', key: 'CL', aliases: ['cl', 'chi', 'chile'], color: '#3B82F6' },
  { name: 'BRASIL', flag: '🇧🇷', key: 'BR', aliases: ['br', 'bra', 'brasil'], color: '#22C55E' },
  { name: 'USA', flag: '🇺🇸', key: 'US', aliases: ['us', 'usa', 'eeuu'], color: '#818CF8' },
  { name: 'URUGUAY', flag: '🇺🇾', key: 'UY', aliases: ['uy', 'uru', 'uruguay'], color: '#06B6D4' },
  { name: 'FRANCIA', flag: '🇫🇷', key: 'FR', aliases: ['fr', 'fra', 'francia'], color: '#2563EB' },
  { name: 'ALEMANIA', flag: '🇩🇪', key: 'DE', aliases: ['de', 'ger', 'alemania'], color: '#374151' },
  { name: 'ITALIA', flag: '🇮🇹', key: 'IT', aliases: ['it', 'ita', 'italia'], color: '#16A34A' },
  { name: 'PORTUGAL', flag: '🇵🇹', key: 'PT', aliases: ['pt', 'por', 'portugal'], color: '#DC2626' },
  { name: 'PAÍSES BAJOS', flag: '🇳🇱', key: 'NL', aliases: ['nl', 'ned', 'paises bajos', 'países bajos', 'holanda'], color: '#F97316' },
  { name: 'REINO UNIDO', flag: '🇬🇧', key: 'GB', aliases: ['gb', 'uk', 'reino unido', 'inglaterra'], color: '#1D4ED8' },
  { name: 'ECUADOR', flag: '🇪🇨', key: 'EC', aliases: ['ec', 'ecu', 'ecuador'], color: '#EAB308' },
  { name: 'PARAGUAY', flag: '🇵🇾', key: 'PY', aliases: ['py', 'par', 'paraguay'], color: '#EF4444' },
  { name: 'BOLIVIA', flag: '🇧🇴', key: 'BO', aliases: ['bo', 'bol', 'bolivia'], color: '#16A34A' },
  { name: 'VENEZUELA', flag: '🇻🇪', key: 'VE', aliases: ['ve', 'ven', 'venezuela'], color: '#FACC15' },
  { name: 'COSTA RICA', flag: '🇨🇷', key: 'CR', aliases: ['cr', 'crc', 'costa rica'], color: '#DC2626' },
  { name: 'PANAMÁ', flag: '🇵🇦', key: 'PA', aliases: ['pa', 'pan', 'panama', 'panamá'], color: '#2563EB' },
  { name: 'CANADÁ', flag: '🇨🇦', key: 'CA', aliases: ['ca', 'can', 'canada', 'canadá'], color: '#EF4444' },
  { name: 'JAPÓN', flag: '🇯🇵', key: 'JP', aliases: ['jp', 'jpn', 'japon', 'japón'], color: '#DB2777' },
  { name: 'COREA DEL SUR', flag: '🇰🇷', key: 'KR', aliases: ['kr', 'kor', 'corea', 'corea del sur'], color: '#3B82F6' },
  { name: 'CHINA', flag: '🇨🇳', key: 'CN', aliases: ['cn', 'chn', 'china'], color: '#DC2626' },
  { name: 'INDONESIA', flag: '🇮🇩', key: 'ID', aliases: ['id', 'idn', 'indonesia'], color: '#EF4444' },
  { name: 'FILIPINAS', flag: '🇵🇭', key: 'PH', aliases: ['ph', 'phi', 'filipinas', 'philippines'], color: '#2563EB' },
  { name: 'VIETNAM', flag: '🇻🇳', key: 'VN', aliases: ['vn', 'vnm', 'vietnam', 'viet nam'], color: '#DC2626' },
  { name: 'TAILANDIA', flag: '🇹🇭', key: 'TH', aliases: ['th', 'tha', 'tailandia', 'tailândia'], color: '#1D4ED8' },
  { name: 'AUSTRALIA', flag: '🇦🇺', key: 'AU', aliases: ['au', 'aus', 'australia'], color: '#2563EB' },
  { name: 'ARABIA SAUDITA', flag: '🇸🇦', key: 'SA', aliases: ['sa', 'ksa', 'arabia saudita'], color: '#16A34A' },
  { name: 'MARRUECOS', flag: '🇲🇦', key: 'MA', aliases: ['ma', 'mar', 'marruecos'], color: '#DC2626' },
  { name: 'EGIPTO', flag: '🇪🇬', key: 'EG', aliases: ['eg', 'egy', 'egipto'], color: '#B91C1C' },
  { name: 'NIGERIA', flag: '🇳🇬', key: 'NG', aliases: ['ng', 'nga', 'nigeria'], color: '#16A34A' },
  { name: 'SUDÁFRICA', flag: '🇿🇦', key: 'ZA', aliases: ['za', 'rsa', 'sudafrica', 'sudáfrica'], color: '#059669' },
  { name: 'GHANA', flag: '🇬🇭', key: 'GH', aliases: ['gh', 'gha', 'ghana'], color: '#EAB308' },
  { name: 'SENEGAL', flag: '🇸🇳', key: 'SN', aliases: ['sn', 'sen', 'senegal'], color: '#16A34A' },
  { name: 'COSTA DE MARFIL', flag: '🇨🇮', key: 'CI', aliases: ['ci', 'civ', 'costa de marfil', 'ivory coast'], color: '#F97316' },
  { name: 'ARGELIA', flag: '🇩🇿', key: 'DZ', aliases: ['dz', 'alg', 'argelia'], color: '#16A34A' },
  { name: 'TÚNEZ', flag: '🇹🇳', key: 'TN', aliases: ['tn', 'tun', 'tunez', 'túnez'], color: '#DC2626' },
  { name: 'TURQUÍA', flag: '🇹🇷', key: 'TR', aliases: ['tr', 'tur', 'turquia', 'turquía'], color: '#DC2626' },
  { name: 'GRECIA', flag: '🇬🇷', key: 'GR', aliases: ['gr', 'gre', 'grecia'], color: '#2563EB' },
  { name: 'SUECIA', flag: '🇸🇪', key: 'SE', aliases: ['se', 'swe', 'suecia'], color: '#EAB308' },
  { name: 'NORUEGA', flag: '🇳🇴', key: 'NO', aliases: ['no', 'nor', 'noruega'], color: '#DC2626' },
  { name: 'DINAMARCA', flag: '🇩🇰', key: 'DK', aliases: ['dk', 'den', 'dinamarca'], color: '#DC2626' },
  { name: 'POLONIA', flag: '🇵🇱', key: 'PL', aliases: ['pl', 'pol', 'polonia'], color: '#F43F5E' },
  { name: 'CROACIA', flag: '🇭🇷', key: 'HR', aliases: ['hr', 'cro', 'croacia'], color: '#EF4444' },
  { name: 'SERBIA', flag: '🇷🇸', key: 'RS', aliases: ['rs', 'srb', 'serbia'], color: '#DC2626' },
  { name: 'BÉLGICA', flag: '🇧🇪', key: 'BE', aliases: ['be', 'bel', 'belgica', 'bélgica'], color: '#FACC15' },
  { name: 'SUIZA', flag: '🇨🇭', key: 'CH', aliases: ['ch', 'sui', 'suiza'], color: '#DC2626' },
  { name: 'ESCOCIA', flag: '🏴', key: 'SCO', aliases: ['sco', 'scotland', 'escocia'], color: '#2563EB' },
  { name: 'UCRANIA', flag: '🇺🇦', key: 'UA', aliases: ['ua', 'ukr', 'ucrania'], color: '#2563EB' },
  { name: 'RUSIA', flag: '🇷🇺', key: 'RU', aliases: ['ru', 'rus', 'rusia'], color: '#DC2626' },
  { name: 'AUSTRIA', flag: '🇦🇹', key: 'AT', aliases: ['at', 'aut', 'austria'], color: '#DC2626' },
  { name: 'CHEQUIA', flag: '🇨🇿', key: 'CZ', aliases: ['cz', 'cze', 'chequia', 'republica checa', 'república checa'], color: '#2563EB' },
  { name: 'IRLANDA', flag: '🇮🇪', key: 'IE', aliases: ['ie', 'irl', 'irlanda'], color: '#16A34A' },
  { name: 'ISLANDIA', flag: '🇮🇸', key: 'IS', aliases: ['is', 'isl', 'islandia'], color: '#2563EB' },
  { name: 'HUNGRÍA', flag: '🇭🇺', key: 'HU', aliases: ['hu', 'hun', 'hungria', 'hungría'], color: '#DC2626' },
  { name: 'RUMANÍA', flag: '🇷🇴', key: 'RO', aliases: ['ro', 'rou', 'rumania', 'rumanía'], color: '#2563EB' },
  { name: 'IRÁN', flag: '🇮🇷', key: 'IR', aliases: ['ir', 'irn', 'iran', 'irán'], color: '#16A34A' },
  { name: 'CAMERÚN', flag: '🇨🇲', key: 'CM', aliases: ['cm', 'cmr', 'camerun', 'camerún'], color: '#16A34A' },
  { name: 'JAMAICA', flag: '🇯🇲', key: 'JM', aliases: ['jm', 'jam', 'jamaica'], color: '#16A34A' },
  { name: 'NUEVA ZELANDA', flag: '🇳🇿', key: 'NZ', aliases: ['nz', 'nzl', 'nueva zelanda', 'new zealand'], color: '#1D4ED8' },
  { name: 'CATAR', flag: '🇶🇦', key: 'QA', aliases: ['qa', 'qat', 'catar', 'qatar'], color: '#7C2D4B' },
];

export const LIGAMX_ROSTER: TeamPreset[] = [
  { name: 'AMÉRICA', flag: '🦅', key: 'AME', aliases: ['ame', 'america', 'américa', 'aguilas'], color: '#FACC15' },
  { name: 'ATLAS', flag: '🦊', key: 'ATL', aliases: ['atl', 'atlas'], color: '#EF4444' },
  { name: 'ATLÉTICO DE SAN LUIS', flag: '🛡️', key: 'SLP', aliases: ['slp', 'san luis', 'atletico de san luis', 'atlético de san luis'], color: '#DC2626' },
  { name: 'CRUZ AZUL', flag: '🚂', key: 'CAZ', aliases: ['caz', 'cruz azul', 'maquina', 'máquina'], color: '#38BDF8' },
  { name: 'GUADALAJARA', flag: '🐐', key: 'CHI', aliases: ['chi', 'chivas', 'guadalajara'], color: '#EF4444' },
  { name: 'FC JUÁREZ', flag: '🐎', key: 'JUA', aliases: ['jua', 'juarez', 'juárez', 'fc juarez', 'fc juárez'], color: '#16A34A' },
  { name: 'LEÓN', flag: '🦁', key: 'LEO', aliases: ['leo', 'leon', 'león'], color: '#22C55E' },
  { name: 'MAZATLÁN', flag: '🏴‍☠️', key: 'MAZ', aliases: ['maz', 'mazatlan', 'mazatlán'], color: '#7C3AED' },
  { name: 'MONTERREY', flag: '🤠', key: 'MTY', aliases: ['mty', 'rayados', 'monterrey'], color: '#60A5FA' },
  { name: 'NECAXA', flag: '⚡', key: 'NEC', aliases: ['nec', 'necaxa'], color: '#DC2626' },
  { name: 'PACHUCA', flag: '⛏️', key: 'PAC', aliases: ['pac', 'pachuca', 'tuzos'], color: '#38BDF8' },
  { name: 'PUEBLA', flag: '🎽', key: 'PUE', aliases: ['pue', 'puebla', 'franja'], color: '#2563EB' },
  { name: 'PUMAS UNAM', flag: '🐾', key: 'PUM', aliases: ['pum', 'pumas', 'unam'], color: '#F59E0B' },
  { name: 'QUERÉTARO', flag: '🐓', key: 'QRO', aliases: ['qro', 'queretaro', 'querétaro', 'gallos'], color: '#111827' },
  { name: 'SANTOS LAGUNA', flag: '⚔️', key: 'SAN', aliases: ['san', 'santos', 'santos laguna', 'guerreros'], color: '#16A34A' },
  { name: 'TIGRES UANL', flag: '🐯', key: 'TIG', aliases: ['tig', 'tigres', 'uanl'], color: '#F59E0B' },
  { name: 'TIJUANA', flag: '🐕', key: 'TIJ', aliases: ['tij', 'xolos', 'tijuana'], color: '#DC2626' },
  { name: 'TOLUCA', flag: '😈', key: 'TOL', aliases: ['tol', 'toluca', 'diablos'], color: '#B91C1C' },
];

export const MEXICO_CITIES_ROSTER: TeamPreset[] = [
  { name: 'CIUDAD DE MÉXICO', flag: '🏙️', key: 'MEX-CDMX', aliases: ['cdmx', 'ciudad de mexico', 'ciudad de méxico', 'df'], color: '#64748B' },
  { name: 'GUADALAJARA', flag: '🎺', key: 'MEX-GDL', aliases: ['gdl', 'guadalajara'], color: '#EF4444' },
  { name: 'MONTERREY', flag: '🏔️', key: 'MEX-MTY', aliases: ['mty', 'monterrey'], color: '#38BDF8' },
  { name: 'PUEBLA', flag: '🌋', key: 'MEX-PUE', aliases: ['pue', 'puebla'], color: '#2563EB' },
  { name: 'TIJUANA', flag: '🌉', key: 'MEX-TIJ', aliases: ['tij', 'tijuana'], color: '#DC2626' },
  { name: 'LEÓN', flag: '🦁', key: 'MEX-LEO', aliases: ['leo', 'leon', 'león'], color: '#22C55E' },
  { name: 'CIUDAD JUÁREZ', flag: '🌵', key: 'MEX-JUA', aliases: ['jua', 'juarez', 'juárez', 'ciudad juarez', 'ciudad juárez'], color: '#16A34A' },
  { name: 'TOLUCA', flag: '🌋', key: 'MEX-TOL', aliases: ['tol', 'toluca'], color: '#B91C1C' },
  { name: 'QUERÉTARO', flag: '🏛️', key: 'MEX-QRO', aliases: ['qro', 'queretaro', 'querétaro'], color: '#7C3AED' },
  { name: 'MÉRIDA', flag: '🏛️', key: 'MEX-MID', aliases: ['mid', 'merida', 'mérida'], color: '#0D9488' },
  { name: 'SAN LUIS POTOSÍ', flag: '⛏️', key: 'MEX-SLP', aliases: ['slp', 'san luis potosi', 'san luis potosí'], color: '#16A34A' },
  { name: 'MEXICALI', flag: '☀️', key: 'MEX-MXL', aliases: ['mxl', 'mexicali'], color: '#F59E0B' },
  { name: 'AGUASCALIENTES', flag: '♨️', key: 'MEX-AGS', aliases: ['ags', 'aguascalientes'], color: '#DC2626' },
  { name: 'CUERNAVACA', flag: '🌺', key: 'MEX-CVA', aliases: ['cva', 'cuernavaca'], color: '#EC4899' },
  { name: 'MORELIA', flag: '🦋', key: 'MEX-MLM', aliases: ['mlm', 'morelia'], color: '#7C3AED' },
  { name: 'SALTILLO', flag: '🐎', key: 'MEX-SAL', aliases: ['sal', 'saltillo'], color: '#F97316' },
  { name: 'HERMOSILLO', flag: '☀️', key: 'MEX-HMO', aliases: ['hmo', 'hermosillo'], color: '#EAB308' },
  { name: 'CULIACÁN', flag: '🌴', key: 'MEX-CUL', aliases: ['cul', 'culiacan', 'culiacán'], color: '#16A34A' },
  { name: 'CHIHUAHUA', flag: '🐕', key: 'MEX-CHH', aliases: ['chh', 'chihuahua'], color: '#B45309' },
  { name: 'TAMPICO', flag: '⚓', key: 'MEX-TAM', aliases: ['tam', 'tampico'], color: '#0D9488' },
  { name: 'ACAPULCO', flag: '🏖️', key: 'MEX-ACA', aliases: ['aca', 'acapulco'], color: '#06B6D4' },
  { name: 'VERACRUZ', flag: '🚢', key: 'MEX-VER', aliases: ['ver', 'veracruz'], color: '#2563EB' },
  { name: 'TUXTLA GUTIÉRREZ', flag: '🐆', key: 'MEX-TGZ', aliases: ['tgz', 'tuxtla', 'tuxtla gutierrez', 'tuxtla gutiérrez'], color: '#16A34A' },
  { name: 'VILLAHERMOSA', flag: '🌿', key: 'MEX-VSA', aliases: ['vsa', 'villahermosa'], color: '#059669' },
  { name: 'MAZATLÁN', flag: '🐟', key: 'MEX-MZT', aliases: ['mzt', 'mazatlan', 'mazatlán'], color: '#06B6D4' },
  { name: 'DURANGO', flag: '🐎', key: 'MEX-DGO', aliases: ['dgo', 'durango'], color: '#B45309' },
  { name: 'TORREÓN', flag: '🌵', key: 'MEX-TRC', aliases: ['trc', 'torreon', 'torreón'], color: '#F59E0B' },
  { name: 'CANCÚN', flag: '🏝️', key: 'MEX-CUN', aliases: ['cun', 'cancun', 'cancún'], color: '#06B6D4' },
  { name: 'OAXACA', flag: '🎭', key: 'MEX-OAX', aliases: ['oax', 'oaxaca'], color: '#F97316' },
  { name: 'XALAPA', flag: '☕', key: 'MEX-XAL', aliases: ['xal', 'xalapa'], color: '#92400E' },
  { name: 'REYNOSA', flag: '🌉', key: 'MEX-REY', aliases: ['rey', 'reynosa'], color: '#2563EB' },
  { name: 'MATAMOROS', flag: '🌊', key: 'MEX-MAT', aliases: ['mat', 'matamoros'], color: '#0EA5E9' },
  { name: 'PACHUCA', flag: '⚽', key: 'MEX-PAC', aliases: ['pac', 'pachuca'], color: '#38BDF8' },
  { name: 'IRAPUATO', flag: '🍓', key: 'MEX-ITO', aliases: ['ito', 'irapuato'], color: '#EF4444' },
  { name: 'CELAYA', flag: '🌱', key: 'MEX-CEL', aliases: ['cel', 'celaya'], color: '#16A34A' },
  { name: 'ENSENADA', flag: '🍇', key: 'MEX-ESE', aliases: ['ese', 'ensenada'], color: '#7C3AED' },
  { name: 'PLAYA DEL CARMEN', flag: '🏖️', key: 'MEX-PDC', aliases: ['pdc', 'playa del carmen'], color: '#06B6D4' },
  { name: 'PUERTO VALLARTA', flag: '🐬', key: 'MEX-PVR', aliases: ['pvr', 'puerto vallarta'], color: '#0D9488' },
  { name: 'LOS CABOS', flag: '🐋', key: 'MEX-SJD', aliases: ['sjd', 'los cabos', 'san jose del cabo', 'san josé del cabo'], color: '#0EA5E9' },
  { name: 'LA PAZ', flag: '🐳', key: 'MEX-LAP', aliases: ['lap', 'la paz'], color: '#2563EB' },
  { name: 'TEPIC', flag: '🌳', key: 'MEX-TEP', aliases: ['tep', 'tepic'], color: '#16A34A' },
  { name: 'COLIMA', flag: '🌋', key: 'MEX-COL', aliases: ['col', 'colima'], color: '#DC2626' },
  { name: 'CAMPECHE', flag: '🏰', key: 'MEX-CPE', aliases: ['cpe', 'campeche'], color: '#7C3AED' },
  { name: 'ZACATECAS', flag: '⛏️', key: 'MEX-ZAC', aliases: ['zac', 'zacatecas'], color: '#DC2626' },
  { name: 'GUANAJUATO', flag: '🎭', key: 'MEX-GTO', aliases: ['gto', 'guanajuato'], color: '#F97316' },
  { name: 'SAN MIGUEL DE ALLENDE', flag: '⛪', key: 'MEX-SMA', aliases: ['sma', 'san miguel de allende'], color: '#F59E0B' },
  { name: 'URUAPAN', flag: '🥑', key: 'MEX-UPN', aliases: ['upn', 'uruapan'], color: '#16A34A' },
  { name: 'COATZACOALCOS', flag: '⚓', key: 'MEX-COA', aliases: ['coa', 'coatzacoalcos'], color: '#0D9488' },
  { name: 'NUEVO LAREDO', flag: '🚛', key: 'MEX-NLD', aliases: ['nld', 'nuevo laredo'], color: '#64748B' },
  { name: 'ECATEPEC', flag: '🏙️', key: 'MEX-ECA', aliases: ['eca', 'ecatepec', 'ecatepec de morelos'], color: '#475569' },
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

/* =====================================================================
   STATE
   ===================================================================== */

export const state = {
  roster: structuredClone(WORLD_ROSTER) as TeamPreset[],
  rosterCursor: 2,
  tournamentMode: true,
  worldCup: createEmptyWorldCup() as WorldCupState,
  teamA: makeBaseState(WORLD_ROSTER[0], true),
  teamB: makeBaseState(WORLD_ROSTER[1], false),
  giftSlots: structuredClone(DEFAULT_GIFT_SLOTS) as GiftSlot[],

  personalTapThreshold: 15,
  frenzyGoalLikes: 100,
  unalignedTapSupportsUnderdog: true,

  aiDirectorEnabled: true,
  roundDurationSec: ROUND_DURATION_SEC,
  suddenDeathDurationSec: SUDDEN_DEATH_DURATION_SEC,
  roundActive: true,
  roundTimeLeft: ROUND_DURATION_SEC,
  suddenDeathActive: false,
  towerDecayActive: false,
  frenzyActive: false,
  frenzyTimeLeft: 0,
  globalTapCount: 0,
  nextMeteorCoinTarget: METEOR_COIN_STEP,
  meteorRainRemaining: 0,
  lastRealInteractionAt: Date.now(),

  timeScale: 1.0,
  takeoverActive: false,
  audioEnabled: true,
  externalObservabilityEnabled: false,
  externalObservabilityEndpoint: '',
  musicMode: 'starfox' as 'starfox' | 'pulse' | 'mp3' | 'off',
  musicVolume: 0.35,
  ttsEnabled: false,
  safeZonesVisible: false,
  demoMode: true,
  panelOpen: false,
  telemetryOpen: false,
  shake: 0,
  screenFlash: 0,

  /* ---------- IDs / tracking de sesión y round ---------- */
  sessionId: Date.now(),
  roundId: Date.now(),
  currentRoundStart: Date.now(),
  currentRoundCoins: 0,
  currentRoundTaps: 0,
  currentRoundGifterCoins: {} as Record<string, number>,
  currentRoundBiome: 'grove' as BiomeTheme['id'],
  biomeRotationRemaining: [] as BiomeTheme['id'][],

  /* ---------- MVP actuales ---------- */
  sessionMVP: {} as Record<string, MvpEntry>,
  roundMVP: {} as Record<string, MvpEntry>,

  /* ---------- FASE A: registros históricos ---------- */
  playerRecords: {} as Record<string, PlayerRecord>,
  teamRecords: {} as Record<string, TeamRecord>,
  roundLogs: [] as RoundLog[],
  seasonHistory: [] as SeasonData[],
  currentSeason: makeInitialSeason(),
  globalRecords: {
    biggestSingleRound: null,
    fastestRound: null,
    longestRound: null,
    biggestUpset: null,
  } as GlobalRecords,

  /* ---------- reset diario / temporada ---------- */
  lastDailyReset: Date.now(),
  lastSeasonReset: Date.now(),

  /* ---------- LRUs de viewers ---------- */
  viewerTeams: new LruMap<string, TeamId>(500),
  viewerLikes: new LruMap<string, number>(500),

  /* ---------- telemetría de sesión (compat) ---------- */
  telemetry: {
    sessionStart: Date.now(),
    totalCoins: 0,
    totalGifts: 0,
    totalTaps: 0,
    totalFollows: 0,
    totalShares: 0,
    roundCount: 0,
    totalRoundDurationSec: 0,
    longestRoundSec: 0,
    runtimeErrorCount: 0,
    persistenceErrorCount: 0,
    websocketDisconnectCount: 0,
    fps: 0,
    averageFrameMs: 0,
    maxFrameMs: 0,
    usedHeapMb: null,
    errorLog: [],
    giftBreakdown: {},
    wsLog: [],
    structuredLog: [],
  } as TelemetryData,
};

export function prepareNewTournament(): void {
  const [openingA, openingB] = state.roster;
  if (!openingA || !openingB) throw new Error('El roster necesita al menos dos equipos para iniciar un torneo.');

  state.worldCup = createEmptyWorldCup();
  state.teamA = makeBaseState(openingA, true);
  state.teamB = makeBaseState(openingB, false);
  state.rosterCursor = 2;
  state.tournamentMode = true;
  state.viewerTeams.clear();
}

export function prepareWorldCup(): WorldCupMatch {
  const ratings: Record<string, number> = {};
  WORLD_ROSTER.forEach((team) => {
    ratings[team.key] = state.teamRecords[team.key]?.elo ?? ELO_INITIAL;
  });
  state.worldCup = createWorldCup(WORLD_ROSTER, ratings);
  state.roster = structuredClone(WORLD_ROSTER);
  state.rosterCursor = 2;
  state.tournamentMode = false;
  state.viewerTeams.clear();
  state.roster.forEach(ensureTeamRecord);

  const openingMatch = getCurrentWorldCupMatch(state.worldCup);
  if (!openingMatch?.teamA || !openingMatch.teamB) {
    throw new Error('No se pudo preparar el partido inicial de la Copa Mundial.');
  }
  state.teamA = makeBaseState(openingMatch.teamA, true);
  state.teamB = makeBaseState(openingMatch.teamB, false);
  return openingMatch;
}

/* =====================================================================
   FACTORIES / HELPERS DE TEMPORADA
   ===================================================================== */

function makeInitialSeason(): SeasonData {
  const now = Date.now();
  const end = now + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;
  return {
    index: 1,
    startDate: now,
    endDate: end,
    championKey: null,
    championName: null,
    championFlag: null,
    championMvp: null,
    topMvps: [],
    standings: WORLD_ROSTER.map((t) => ({
      key: t.key,
      name: t.name,
      flag: t.flag,
      color: t.color,
      points: 0,
      participation: 0,
      wins: 0,
      losses: 0,
    })),
  };
}

function ensureStandingsEntry(season: SeasonData, team: TeamPreset) {
  let e = season.standings.find((s) => s.key === team.key);
  if (!e) {
    e = {
      key: team.key,
      name: team.name,
      flag: team.flag,
      color: team.color,
      points: 0,
      participation: 0,
      wins: 0,
      losses: 0,
    };
    season.standings.push(e);
  }
  return e;
}

function emptyPlayerRecord(user: string, avatarUrl: string): PlayerRecord {
  const now = Date.now();
  return {
    user,
    avatarUrl,
    favoriteTeam: null,
    lifetime: {
      taps: 0, coins: 0, gifts: 0, follows: 0, shares: 0,
      kills: 0, baseDamage: 0, towerKills: 0,
    },
    period: { coinsToday: 0, tapsToday: 0, coinsSeason: 0, tapsSeason: 0 },
    peaks: {
      maxSessionScore: 0, maxRoundScore: 0,
      maxTapsRound: 0, maxCoinsRound: 0,
    },
    mvpSessions: 0,
    mvpRounds: 0,
    teamsSupported: {},
    badges: [],
    firstSeen: now,
    lastSeen: now,
  };
}

function emptyTeamRecord(team: TeamPreset): TeamRecord {
  return {
    key: team.key,
    name: team.name,
    flag: team.flag,
    color: team.color,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    championships: 0,
    elo: ELO_INITIAL,
    totalCoinsSpent: 0,
    totalTaps: 0,
    lastPlayed: 0,
  };
}

function truncateUrl(url: string, max = 300): string {
  if (!url) return '';
  return url.length > max ? url.slice(0, max) : url;
}

/* =====================================================================
   API PÚBLICA — PLAYER / TEAM RECORDS
   ===================================================================== */

export function ensurePlayerRecord(user: string, avatarUrl: string): PlayerRecord {
  if (!user) throw new Error('ensurePlayerRecord: user requerido');
  const cleanUser = user.slice(0, 64);
  let rec = state.playerRecords[cleanUser];
  if (!rec) {
    rec = emptyPlayerRecord(cleanUser, truncateUrl(avatarUrl));
    state.playerRecords[cleanUser] = rec;
  } else {
    if (avatarUrl) rec.avatarUrl = truncateUrl(avatarUrl);
  }
  rec.lastSeen = Date.now();
  return rec;
}

export function ensureTeamRecord(team: TeamPreset): TeamRecord {
  let rec = state.teamRecords[team.key];
  if (!rec) {
    rec = emptyTeamRecord(team);
    state.teamRecords[team.key] = rec;
  }
  // Sync identidad por si el usuario editó nombre/flag/color
  rec.name = team.name;
  rec.flag = team.flag;
  rec.color = team.color;
  return rec;
}

/* =====================================================================
   API PÚBLICA — TRACKING DE EVENTOS
   ===================================================================== */

export function recordTap(user: string, avatarUrl: string, team?: TeamId): void {
  const rec = ensurePlayerRecord(user, avatarUrl);
  rec.lifetime.taps += 1;
  rec.period.tapsToday += 1;
  rec.period.tapsSeason += 1;
  if (team) {
    rec.favoriteTeam = rec.favoriteTeam ?? team;
    rec.teamsSupported[team] = (rec.teamsSupported[team] ?? 0) + 1;
  }
  state.telemetry.totalTaps += 1;
  state.currentRoundTaps += 1;
  state.globalTapCount += 1;
}

export function recordGift(user: string, avatarUrl: string, team: TeamId, coins: number): void {
  const rec = ensurePlayerRecord(user, avatarUrl);
  const safeCoins = Number.isFinite(coins) ? Math.max(0, coins) : 0;
  rec.lifetime.gifts += 1;
  rec.lifetime.coins += safeCoins;
  rec.period.coinsToday += safeCoins;
  rec.period.coinsSeason += safeCoins;
  rec.favoriteTeam = rec.favoriteTeam ?? team;
  rec.teamsSupported[team] = (rec.teamsSupported[team] ?? 0) + 1;
  state.telemetry.totalGifts += 1;
  state.telemetry.totalCoins += safeCoins;
  state.currentRoundCoins += safeCoins;
  state.currentRoundGifterCoins[user] = (state.currentRoundGifterCoins[user] ?? 0) + safeCoins;
}

export function recordFollow(user: string, avatarUrl: string): void {
  const rec = ensurePlayerRecord(user, avatarUrl);
  rec.lifetime.follows += 1;
  state.telemetry.totalFollows += 1;
}

export function recordShare(user: string, avatarUrl: string): void {
  const rec = ensurePlayerRecord(user, avatarUrl);
  rec.lifetime.shares += 1;
  state.telemetry.totalShares += 1;
}

/** Suma puntos al MVP de sesión y de round (llamar desde main.ts en cada gift/tap). */
export function scoreMvp(user: string, avatarUrl: string, team: TeamId, delta: number): void {
  if (!user || delta <= 0) return;
  const rec = ensurePlayerRecord(user, avatarUrl);

  const s = state.sessionMVP[user] ?? { user, team, avatarUrl: rec.avatarUrl, score: 0 };
  s.score += delta;
  s.team = team;
  if (avatarUrl) s.avatarUrl = truncateUrl(avatarUrl);
  state.sessionMVP[user] = s;

  const r = state.roundMVP[user] ?? { user, team, avatarUrl: rec.avatarUrl, score: 0 };
  r.score += delta;
  r.team = team;
  if (avatarUrl) r.avatarUrl = truncateUrl(avatarUrl);
  state.roundMVP[user] = r;

  if (s.score > rec.peaks.maxSessionScore) rec.peaks.maxSessionScore = s.score;
  if (r.score > rec.peaks.maxRoundScore) rec.peaks.maxRoundScore = r.score;
}

/* =====================================================================
   CICLO DE ROUND
   ===================================================================== */

export function beginRound(biome: BiomeTheme['id']): void {
  state.roundActive = true;
  state.roundTimeLeft = state.roundDurationSec;
  state.suddenDeathActive = false;
  state.towerDecayActive = false;
  state.frenzyActive = false;
  state.frenzyTimeLeft = 0;
  state.globalTapCount = 0;
  state.roundMVP = {};
  state.currentRoundStart = Date.now();
  state.currentRoundCoins = 0;
  state.currentRoundTaps = 0;
  state.currentRoundGifterCoins = {};
  state.currentRoundBiome = biome;
  state.roundId = Date.now();
  state.teamA.hp = MAX_BASE_HP;
  state.teamB.hp = MAX_BASE_HP;
  state.teamA.sideDefenses.forEach((sd) => { sd.hp = sd.maxHp; sd.flash = 0; });
  state.teamB.sideDefenses.forEach((sd) => { sd.hp = sd.maxHp; sd.flash = 0; });
}

export interface FinalizeRoundOptions {
  featured?: boolean;
  suddenDeath?: boolean;
}

/**
 * Cierra el round actual:
 *  - Actualiza teamRecords (W/L/streak/bestStreak/ELO).
 *  - Escribe un RoundLog con MVP, topGifter, coins y taps.
 *  - Actualiza currentSeason.standings + topMvps.
 *  - Actualiza globalRecords.
 *  - Resetea roundMVP para el siguiente round.
 *  - Llama savePersistentState().
 */
export function finalizeRound(winner: TeamId, opts: FinalizeRoundOptions = {}): RoundLog {
  if (!state.roundActive) {
    throw new Error('Cannot finalize a round that is not active');
  }
  const featured = Boolean(opts.featured);
  const suddenDeath = Boolean(opts.suddenDeath);
  const durationSec = Math.max(1, Math.round((Date.now() - state.currentRoundStart) / 1000));
  const winnerBase = winner === 'A' ? state.teamA : state.teamB;
  const loserBase = winner === 'A' ? state.teamB : state.teamA;
  const winnerTeam = ensureTeamRecord(winnerBase);
  const loserTeam = ensureTeamRecord(loserBase);

  /* ---- 1. TeamRecords ---- */
  winnerTeam.wins += 1;
  winnerTeam.streak += 1;
  if (winnerTeam.streak > winnerTeam.bestStreak) winnerTeam.bestStreak = winnerTeam.streak;
  winnerTeam.lastPlayed = Date.now();
  winnerTeam.totalCoinsSpent += state.currentRoundCoins;
  winnerTeam.totalTaps += state.currentRoundTaps;

  loserTeam.losses += 1;
  loserTeam.streak = 0;
  loserTeam.lastPlayed = Date.now();

  /* ---- 2. ELO ---- */
  const expWinner = 1 / (1 + Math.pow(10, (loserTeam.elo - winnerTeam.elo) / 400));
  const eloDiff = Math.abs(winnerTeam.elo - loserTeam.elo);
  winnerTeam.elo = Math.round(winnerTeam.elo + ELO_K_FACTOR * (1 - expWinner));
  loserTeam.elo = Math.round(loserTeam.elo - ELO_K_FACTOR * (1 - expWinner));

  /* ---- 3. GlobalRecords ---- */
  if (!state.globalRecords.biggestSingleRound || state.currentRoundCoins > state.globalRecords.biggestSingleRound.coins) {
    state.globalRecords.biggestSingleRound = { coins: state.currentRoundCoins, ts: Date.now(), winnerKey: winnerTeam.key };
  }
  if (!state.globalRecords.fastestRound || durationSec < state.globalRecords.fastestRound.durationSec) {
    state.globalRecords.fastestRound = { durationSec, ts: Date.now(), winnerKey: winnerTeam.key };
  }
  if (!state.globalRecords.longestRound || durationSec > state.globalRecords.longestRound.durationSec) {
    state.globalRecords.longestRound = { durationSec, ts: Date.now(), winnerKey: winnerTeam.key };
  }
  if (eloDiff > 0 && (!state.globalRecords.biggestUpset || eloDiff > state.globalRecords.biggestUpset.eloDiff)) {
    state.globalRecords.biggestUpset = {
      eloDiff, ts: Date.now(),
      winnerKey: winnerTeam.key, loserKey: loserTeam.key,
    };
  }

  /* ---- 4. MVP del round ---- */
  const roundMvpList = Object.values(state.roundMVP).sort((a, b) => b.score - a.score);
  const roundMvp = roundMvpList[0] ?? null;
  const roundTopGifter = (() => {
    const entries = Object.entries(state.currentRoundGifterCoins)
      .sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    return { user: entries[0][0], coins: entries[0][1] };
  })();

  if (roundMvp) {
    const rec = ensurePlayerRecord(roundMvp.user, roundMvp.avatarUrl);
    rec.mvpRounds += 1;
  }

  /* ---- 5. RoundLog ---- */
  const log: RoundLog = {
    id: `r_${state.roundId}`,
    ts: Date.now(),
    durationSec,
    winner,
    winnerKey: winnerTeam.key,
    winnerName: winnerTeam.name,
    loserKey: loserTeam.key,
    loserName: loserTeam.name,
    suddenDeath,
    featured,
    biome: state.currentRoundBiome,
    totalCoins: state.currentRoundCoins,
    totalTaps: state.currentRoundTaps,
    mvp: roundMvp ? { user: roundMvp.user, avatarUrl: roundMvp.avatarUrl, score: roundMvp.score } : null,
    topGifter: roundTopGifter,
  };
  state.telemetry.roundCount += 1;
  state.telemetry.totalRoundDurationSec += durationSec;
  state.telemetry.longestRoundSec = Math.max(state.telemetry.longestRoundSec, durationSec);
  state.roundLogs.unshift(log);
  if (state.roundLogs.length > MAX_ROUND_LOGS) state.roundLogs.length = MAX_ROUND_LOGS;

  /* ---- 6. Temporada regular (la Copa mantiene una clasificación aparte) ---- */
  if (state.worldCup.status !== 'in_progress') {
    const season = state.currentSeason;
    const winEntry = ensureStandingsEntry(season, winnerBase);
    const loseEntry = ensureStandingsEntry(season, loserBase);
    winEntry.wins += 1;
    winEntry.points += featured ? POINTS_WIN_FEATURED : POINTS_WIN_NORMAL;
    winEntry.participation += 1;
    loseEntry.losses += 1;
    loseEntry.participation += 1;
    if (roundMvp) {
      season.topMvps.push({ ...roundMvp });
      season.topMvps.sort((a, b) => b.score - a.score);
      if (season.topMvps.length > 100) season.topMvps.length = 100;
    }
  }

  /* ---- 7. Reset round-local ---- */
  state.roundMVP = {};
  state.currentRoundStart = Date.now();
  state.currentRoundCoins = 0;
  state.currentRoundTaps = 0;
  state.currentRoundGifterCoins = {};
  state.roundActive = false;

  savePersistentState();
  return log;
}

/* =====================================================================
   CICLO DE SESIÓN / DÍA / TEMPORADA
   ===================================================================== */

/** Llamar al inicio de cada live (nuevo stream). NO borra históricos. */
export function resetSession(): void {
  // Si quedó un round abierto, lo cerramos sin ganador
  if (state.roundActive) state.roundActive = false;

  state.sessionMVP = {};
  state.roundMVP = {};
  state.currentRoundGifterCoins = {};
  state.viewerTeams = new LruMap<string, TeamId>(500);
  state.viewerLikes = new LruMap<string, number>(500);

  state.telemetry = {
    sessionStart: Date.now(),
    totalCoins: 0,
    totalGifts: 0,
    totalTaps: 0,
    totalFollows: 0,
    totalShares: 0,
    roundCount: 0,
    totalRoundDurationSec: 0,
    longestRoundSec: 0,
    runtimeErrorCount: 0,
    persistenceErrorCount: 0,
    websocketDisconnectCount: 0,
    fps: 0,
    averageFrameMs: 0,
    maxFrameMs: 0,
    usedHeapMb: null,
    errorLog: [],
    giftBreakdown: {},
    wsLog: [],
    structuredLog: [],
  };

  state.sessionId = Date.now();
  state.nextMeteorCoinTarget = METEOR_COIN_STEP;
  state.meteorRainRemaining = 0;
  state.lastRealInteractionAt = Date.now();

  savePersistentState();
}

/** Reset diario: solo campos period.today*. */
export function resetDaily(): void {
  for (const rec of Object.values(state.playerRecords)) {
    rec.period.coinsToday = 0;
    rec.period.tapsToday = 0;
  }
  state.lastDailyReset = Date.now();
  saveNow();
}

/** Cierra temporada actual: corona campeón y archiva. */
export function closeCurrentSeason(): void {
  const season = state.currentSeason;
  if (season.standings.length === 0) return;

  const sorted = [...season.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });
  const champ = sorted[0];
  if (!champ) return;

  season.championKey = champ.key;
  season.championName = champ.name;
  season.championFlag = champ.flag;

  const topMvp = season.topMvps[0] ?? null;
  season.championMvp = topMvp ? { user: topMvp.user, avatarUrl: topMvp.avatarUrl, score: topMvp.score } : null;

  const teamRec = state.teamRecords[champ.key];
  if (teamRec) teamRec.championships += 1;

  state.seasonHistory.push(structuredClone(season));
  if (state.seasonHistory.length > MAX_SEASON_HISTORY) state.seasonHistory.shift();

  state.lastSeasonReset = Date.now();
}

/** Arranca una temporada nueva limpia. */
export function startNewSeason(): void {
  const nextIndex = (state.currentSeason.index || 0) + 1;
  const now = Date.now();
  state.currentSeason = {
    index: nextIndex,
    startDate: now,
    endDate: now + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000,
    championKey: null,
    championName: null,
    championFlag: null,
    championMvp: null,
    topMvps: [],
    standings: state.roster.map((t) => ({
      key: t.key,
      name: t.name,
      flag: t.flag,
      color: t.color,
      points: 0,
      participation: 0,
      wins: 0,
      losses: 0,
    })),
  };
}

/** Chequea si hace falta cerrar día o temporada. Llamar al inicio del live y en finalizeRound. */
export function resetIfNeeded(): void {
  const today = new Date().toDateString();
  const lastDay = new Date(state.lastDailyReset).toDateString();
  if (today !== lastDay) resetDaily();

  if (Date.now() > state.currentSeason.endDate) {
    closeCurrentSeason();
    startNewSeason();
    savePersistentState();
  }
}

/* =====================================================================
   LEADERBOARDS (helpers puros para UI)
   ===================================================================== */

export function getTopMVPs(limit = 3): MvpEntry[] {
  return Object.values(state.sessionMVP)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getTopPlayers(limit = 50): PlayerRecord[] {
  const score = (p: PlayerRecord) =>
    p.mvpSessions * 100 +
    p.mvpRounds * 10 +
    p.peaks.maxSessionScore +
    p.lifetime.coins * 0.5 +
    p.lifetime.taps * 0.05;
  return Object.values(state.playerRecords)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

export function getTopGifters(period: 'today' | 'season' | 'lifetime' = 'season', limit = 10): Array<{ user: string; avatarUrl: string; coins: number }> {
  const key = (p: PlayerRecord): number =>
    period === 'today' ? p.period.coinsToday : period === 'season' ? p.period.coinsSeason : p.lifetime.coins;
  return Object.values(state.playerRecords)
    .filter((p) => key(p) > 0)
    .sort((a, b) => key(b) - key(a))
    .slice(0, limit)
    .map((p) => ({ user: p.user, avatarUrl: p.avatarUrl, coins: key(p) }));
}

export function getStandings(): SeasonData['standings'] {
  return [...state.currentSeason.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });
}

export function getRecentRounds(limit = 10): RoundLog[] {
  return state.roundLogs.slice(0, limit);
}

/* =====================================================================
   PERSISTENCIA
   ===================================================================== */

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

  // Solo persistimos los TOP N players por score para no reventar localStorage
  const topPlayersEntries = getTopPlayers(MAX_PLAYER_RECORDS)
    .map((p) => [p.user, { ...p, avatarUrl: truncateUrl(p.avatarUrl) }] as const);
  const playerRecordsToSave = Object.fromEntries(topPlayersEntries);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: PERSISTENCE_SCHEMA_VERSION,
        roster: state.roster,
        rosterCursor: state.rosterCursor,
        tournamentMode: state.tournamentMode,
        worldCup: state.worldCup,
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
        externalObservabilityEnabled: state.externalObservabilityEnabled,
        externalObservabilityEndpoint: state.externalObservabilityEndpoint,
        musicMode: state.musicMode,
        musicVolume: state.musicVolume,
        ttsEnabled: state.ttsEnabled,
        currentRoundBiome: state.currentRoundBiome,
        biomeRotationRemaining: state.biomeRotationRemaining,
        sessionMVP: top20Mvp,
        telemetry: { ...state.telemetry, elapsedMs: Date.now() - state.telemetry.sessionStart },

        // Fase A
        playerRecords: playerRecordsToSave,
        teamRecords: state.teamRecords,
        roundLogs: state.roundLogs,
        seasonHistory: state.seasonHistory,
        currentSeason: state.currentSeason,
        globalRecords: state.globalRecords,
        lastDailyReset: state.lastDailyReset,
        lastSeasonReset: state.lastSeasonReset,
      })
    );
  } catch {
    state.telemetry.persistenceErrorCount += 1;
    state.telemetry.errorLog.unshift(`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}] Persistencia: no se pudo guardar el estado`);
    state.telemetry.errorLog = state.telemetry.errorLog.slice(0, 40);
  }
}

export function exportPersistentState(): string {
  saveNow();
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function importPersistentState(raw: string): boolean {
  if (!raw.trim()) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    const persisted = parsed as Record<string, unknown>;
    const version = persisted.schemaVersion;
    if (typeof version === 'number' && version > PERSISTENCE_SCHEMA_VERSION) return false;

    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try { localStorage.setItem(`${STORAGE_KEY}_backup_${Date.now()}`, existing); } catch { /* noop */ }
    }
    localStorage.setItem(STORAGE_KEY, raw);
    loadPersistentState();
    return true;
  } catch {
    return false;
  }
}

export interface PersistenceSnapshot {
  key: string;
  kind: 'backup' | 'corrupt';
  ts: number;
}

export function listPersistenceSnapshots(): PersistenceSnapshot[] {
  const snapshots: PersistenceSnapshot[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(`${STORAGE_KEY}_backup_`)) {
      snapshots.push({
        key,
        kind: 'backup',
        ts: Number(key.slice(`${STORAGE_KEY}_backup_`.length)) || 0,
      });
    } else if (key.startsWith(`${STORAGE_KEY}_corrupt_`)) {
      snapshots.push({
        key,
        kind: 'corrupt',
        ts: Number(key.slice(`${STORAGE_KEY}_corrupt_`.length)) || 0,
      });
    }
  }
  return snapshots.sort((a, b) => b.ts - a.ts).slice(0, MAX_PERSISTENCE_SNAPSHOTS);
}

export function restorePersistenceSnapshot(key: string): boolean {
  const snapshots = listPersistenceSnapshots();
  if (!snapshots.some((snapshot) => snapshot.key === key)) return false;
  const snapshotRaw = localStorage.getItem(key);
  if (!snapshotRaw) return false;

  try {
    localStorage.setItem(
      `${STORAGE_KEY}_before_restore_${Date.now()}`,
      localStorage.getItem(STORAGE_KEY) || '{}'
    );
  } catch { /* noop */ }

  localStorage.setItem(STORAGE_KEY, snapshotRaw);
  loadPersistentState();
  return true;
}

export function prunePersistenceSnapshots(limit = MAX_PERSISTENCE_SNAPSHOTS): number {
  const snapshots = listPersistenceSnapshots();
  const removeCount = Math.max(0, snapshots.length - Math.max(1, limit));
  for (const snapshot of snapshots.slice(-removeCount)) {
    try { localStorage.removeItem(snapshot.key); } catch { /* noop */ }
  }
  return removeCount;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}

export function sanitizeSessionMvp(value: unknown): Record<string, MvpEntry> {
  if (!isObject(value)) return {};
  const result: Record<string, MvpEntry> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isObject(entry) || typeof entry.user !== 'string') continue;
    if (entry.team !== 'A' && entry.team !== 'B') continue;
    result[key] = {
      user: entry.user.slice(0, 64),
      team: entry.team,
      avatarUrl: typeof entry.avatarUrl === 'string' ? entry.avatarUrl.slice(0, 300) : '',
      score: nonNegativeNumber(entry.score),
    };
  }
  return result;
}

export function sanitizePlayerRecords(value: unknown): Record<string, PlayerRecord> {
  if (!isObject(value)) return {};
  const result: Record<string, PlayerRecord> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isObject(raw) || typeof raw.user !== 'string') continue;
    const record = emptyPlayerRecord(raw.user.slice(0, 64), typeof raw.avatarUrl === 'string' ? raw.avatarUrl.slice(0, 300) : '');
    record.favoriteTeam = raw.favoriteTeam === 'A' || raw.favoriteTeam === 'B' ? raw.favoriteTeam : null;

    if (isObject(raw.lifetime)) {
      for (const field of ['taps', 'coins', 'gifts', 'follows', 'shares', 'kills', 'baseDamage', 'towerKills'] as const) {
        record.lifetime[field] = nonNegativeNumber(raw.lifetime[field]);
      }
    }
    if (isObject(raw.period)) {
      record.period.coinsToday = nonNegativeNumber(raw.period.coinsToday);
      record.period.tapsToday = nonNegativeNumber(raw.period.tapsToday);
      record.period.coinsSeason = nonNegativeNumber(raw.period.coinsSeason);
      record.period.tapsSeason = nonNegativeNumber(raw.period.tapsSeason);
    }
    if (isObject(raw.peaks)) {
      record.peaks.maxSessionScore = nonNegativeNumber(raw.peaks.maxSessionScore);
      record.peaks.maxRoundScore = nonNegativeNumber(raw.peaks.maxRoundScore);
      record.peaks.maxTapsRound = nonNegativeNumber(raw.peaks.maxTapsRound);
      record.peaks.maxCoinsRound = nonNegativeNumber(raw.peaks.maxCoinsRound);
    }
    record.mvpSessions = nonNegativeNumber(raw.mvpSessions);
    record.mvpRounds = nonNegativeNumber(raw.mvpRounds);
    record.firstSeen = nonNegativeNumber(raw.firstSeen, record.firstSeen);
    record.lastSeen = nonNegativeNumber(raw.lastSeen, record.lastSeen);
    if (Array.isArray(raw.badges)) record.badges = raw.badges.filter((badge): badge is string => typeof badge === 'string').slice(0, 100);
    if (typeof raw.dailyStreak === 'number') {
      record.dailyStreak = Math.floor(nonNegativeNumber(raw.dailyStreak));
    }
    if (typeof raw.bestDailyStreak === 'number') {
      record.bestDailyStreak = Math.floor(nonNegativeNumber(raw.bestDailyStreak));
    }
    if (record.dailyStreak && (!record.bestDailyStreak || record.bestDailyStreak < record.dailyStreak)) {
      record.bestDailyStreak = record.dailyStreak;
    }
    if (typeof raw.lastStreakDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastStreakDay)) {
      record.lastStreakDay = raw.lastStreakDay;
    }
    if (typeof raw.streakXp === 'number') {
      record.streakXp = Math.floor(nonNegativeNumber(raw.streakXp));
    }
    if (isObject(raw.teamsSupported)) {
      if (typeof raw.teamsSupported.A === 'number') record.teamsSupported.A = nonNegativeNumber(raw.teamsSupported.A);
      if (typeof raw.teamsSupported.B === 'number') record.teamsSupported.B = nonNegativeNumber(raw.teamsSupported.B);
    }
    result[key] = record;
  }
  return result;
}

export function sanitizeTeamRecords(value: unknown): Record<string, TeamRecord> {
  if (!isObject(value)) return {};
  const result: Record<string, TeamRecord> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isObject(raw) || typeof raw.key !== 'string') continue;
    result[key] = {
      key: raw.key.slice(0, 16),
      name: typeof raw.name === 'string' ? raw.name.slice(0, 64) : raw.key,
      flag: typeof raw.flag === 'string' ? raw.flag.slice(0, 16) : '',
      color: typeof raw.color === 'string' ? raw.color.slice(0, 32) : '#94A3B8',
      wins: nonNegativeNumber(raw.wins),
      losses: nonNegativeNumber(raw.losses),
      streak: nonNegativeNumber(raw.streak),
      bestStreak: nonNegativeNumber(raw.bestStreak),
      championships: nonNegativeNumber(raw.championships),
      elo: nonNegativeNumber(raw.elo, ELO_INITIAL),
      totalCoinsSpent: nonNegativeNumber(raw.totalCoinsSpent),
      totalTaps: nonNegativeNumber(raw.totalTaps),
      lastPlayed: nonNegativeNumber(raw.lastPlayed),
    };
  }
  return result;
}

export function sanitizeRoundLogs(value: unknown): RoundLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter((raw): raw is Record<string, unknown> => isObject(raw)).filter((raw) =>
    typeof raw.id === 'string' &&
    (raw.winner === 'A' || raw.winner === 'B') &&
    typeof raw.ts === 'number'
  ).slice(0, MAX_ROUND_LOGS).map((raw) => ({
    id: raw.id as string,
    ts: nonNegativeNumber(raw.ts),
    durationSec: nonNegativeNumber(raw.durationSec, 1),
    winner: raw.winner as TeamId,
    winnerKey: typeof raw.winnerKey === 'string' ? raw.winnerKey.slice(0, 16) : '',
    winnerName: typeof raw.winnerName === 'string' ? raw.winnerName.slice(0, 64) : '',
    loserKey: typeof raw.loserKey === 'string' ? raw.loserKey.slice(0, 16) : '',
    loserName: typeof raw.loserName === 'string' ? raw.loserName.slice(0, 64) : '',
    suddenDeath: Boolean(raw.suddenDeath),
    featured: Boolean(raw.featured),
    biome: typeof raw.biome === 'string' ? raw.biome.slice(0, 32) : '',
    totalCoins: nonNegativeNumber(raw.totalCoins),
    totalTaps: nonNegativeNumber(raw.totalTaps),
    mvp: isObject(raw.mvp) &&
      typeof raw.mvp.user === 'string' &&
      typeof raw.mvp.score === 'number'
      ? { user: raw.mvp.user.slice(0, 64), avatarUrl: typeof raw.mvp.avatarUrl === 'string' ? raw.mvp.avatarUrl.slice(0, 300) : '', score: nonNegativeNumber(raw.mvp.score) }
      : null,
    topGifter: isObject(raw.topGifter) &&
      typeof raw.topGifter.user === 'string' &&
      typeof raw.topGifter.coins === 'number'
      ? { user: raw.topGifter.user.slice(0, 64), coins: nonNegativeNumber(raw.topGifter.coins) }
      : null,
  }));
}

export function sanitizeSeason(value: unknown): SeasonData | null {
  if (!isObject(value)) return null;
  if (!Array.isArray(value.standings) || typeof value.index !== 'number') return null;
  const standings = value.standings.filter(isObject).filter((entry) =>
    typeof entry.key === 'string' &&
    typeof entry.name === 'string'
  ).map((entry) => ({
    key: typeof entry.key === 'string' ? entry.key.slice(0, 16) : '',
    name: typeof entry.name === 'string' ? entry.name.slice(0, 64) : '',
    flag: typeof entry.flag === 'string' ? entry.flag.slice(0, 16) : '',
    color: typeof entry.color === 'string' ? entry.color.slice(0, 32) : '#94A3B8',
    points: nonNegativeNumber(entry.points),
    participation: nonNegativeNumber(entry.participation),
    wins: nonNegativeNumber(entry.wins),
    losses: nonNegativeNumber(entry.losses),
  }));
  const topMvps = Array.isArray(value.topMvps)
    ? value.topMvps.filter((entry): entry is MvpEntry => isObject(entry) &&
      typeof entry.user === 'string' &&
      (entry.team === 'A' || entry.team === 'B'))
      .slice(0, 100)
      .map((entry) => ({
        user: entry.user.slice(0, 64),
        team: entry.team,
        avatarUrl: typeof entry.avatarUrl === 'string' ? entry.avatarUrl.slice(0, 300) : '',
        score: nonNegativeNumber(entry.score),
      }))
    : [];
  return {
    index: Math.max(1, Math.floor(nonNegativeNumber(value.index, 1))),
    startDate: nonNegativeNumber(value.startDate),
    endDate: nonNegativeNumber(value.endDate),
    championKey: typeof value.championKey === 'string' ? value.championKey.slice(0, 16) : null,
    championName: typeof value.championName === 'string' ? value.championName.slice(0, 64) : null,
    championFlag: typeof value.championFlag === 'string' ? value.championFlag.slice(0, 16) : null,
    championMvp: isObject(value.championMvp) &&
      typeof value.championMvp.user === 'string'
      ? {
          user: value.championMvp.user.slice(0, 64),
          avatarUrl: typeof value.championMvp.avatarUrl === 'string' ? value.championMvp.avatarUrl.slice(0, 300) : '',
          score: nonNegativeNumber(value.championMvp.score),
        }
      : null,
    topMvps,
    standings,
  };
}

export function sanitizeGlobalRecords(value: unknown): GlobalRecords {
  const fallback: GlobalRecords = {
    biggestSingleRound: null,
    fastestRound: null,
    longestRound: null,
    biggestUpset: null,
  };
  if (!isObject(value)) return fallback;

  const biggestRound = isObject(value.biggestSingleRound) ? value.biggestSingleRound : null;
  if (biggestRound) fallback.biggestSingleRound = {
    coins: nonNegativeNumber(biggestRound.coins),
    ts: nonNegativeNumber(biggestRound.ts),
    winnerKey: typeof biggestRound.winnerKey === 'string' ? biggestRound.winnerKey.slice(0, 16) : '',
  };
  for (const [field, target] of [
    ['fastestRound', 'fastestRound'],
    ['longestRound', 'longestRound'],
  ] as const) {
    const entry = isObject(value[field]) ? value[field] : null;
    if (entry) fallback[target] = {
      durationSec: nonNegativeNumber(entry.durationSec),
      ts: nonNegativeNumber(entry.ts),
      winnerKey: typeof entry.winnerKey === 'string' ? entry.winnerKey.slice(0, 16) : '',
    };
  }
  const upset = isObject(value.biggestUpset) ? value.biggestUpset : null;
  if (upset) fallback.biggestUpset = {
    eloDiff: nonNegativeNumber(upset.eloDiff),
    ts: nonNegativeNumber(upset.ts),
    winnerKey: typeof upset.winnerKey === 'string' ? upset.winnerKey.slice(0, 16) : '',
    loserKey: typeof upset.loserKey === 'string' ? upset.loserKey.slice(0, 16) : '',
  };
  return fallback;
}

export function loadPersistentState(): void {
  try {
    // Migración desde la key anterior (v2.2 → v2.3)
    const LEGACY_KEY = 'tactical_arena_v2_2_elixir';
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        raw = legacy;
        try { localStorage.setItem(STORAGE_KEY, legacy); } catch { /* noop */ }
      }
    }
    if (!raw) {
      resetIfNeeded();
      return;
    }
    const d: unknown = JSON.parse(raw);
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Persisted state is not an object');
    const persisted = d as Record<string, unknown>;
    const schemaVersion = persisted.schemaVersion;
    if (typeof schemaVersion === 'number' && schemaVersion > PERSISTENCE_SCHEMA_VERSION) {
      throw new Error(`Unsupported persisted schema version: ${schemaVersion}`);
    }
    const finiteNumber = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value);
    const isBiomeId = (value: unknown): value is BiomeTheme['id'] =>
      typeof value === 'string' && BIOMES.some((biome) => biome.id === value);
    const isTeamPreset = (value: unknown): value is TeamPreset =>
      !!value && typeof value === 'object' &&
      typeof (value as TeamPreset).name === 'string' &&
      typeof (value as TeamPreset).flag === 'string' &&
      typeof (value as TeamPreset).key === 'string' &&
      Array.isArray((value as TeamPreset).aliases) &&
      typeof (value as TeamPreset).color === 'string';
    const isGiftSlot = (value: unknown): value is GiftSlot =>
      !!value && typeof value === 'object' &&
      typeof (value as GiftSlot).id === 'string' &&
      typeof (value as GiftSlot).tier === 'number' &&
      typeof (value as GiftSlot).matchers === 'string' &&
      typeof (value as GiftSlot).display === 'string';

    if (Array.isArray(persisted.roster) && persisted.roster.length >= 2) {
      const roster = persisted.roster.filter(isTeamPreset).slice(0, 64);
      if (roster.length >= 2) state.roster = roster;
    }
    if (finiteNumber(persisted.rosterCursor)) state.rosterCursor = Math.max(0, Math.floor(persisted.rosterCursor));
    if (typeof persisted.tournamentMode === 'boolean') state.tournamentMode = persisted.tournamentMode;
    if (persisted.worldCup !== undefined) {
      const worldCup = sanitizeWorldCupState(persisted.worldCup);
      if (worldCup) {
        state.worldCup = worldCup;
      } else {
        state.worldCup = createEmptyWorldCup();
        state.telemetry.persistenceErrorCount += 1;
        state.telemetry.errorLog.unshift(`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}] Persistencia: estado de Copa Mundial no válido`);
        state.telemetry.errorLog = state.telemetry.errorLog.slice(0, 40);
      }
    } else {
      state.worldCup = createEmptyWorldCup();
    }
    if (persisted.teamA && typeof persisted.teamA === 'object') {
      const teamA = persisted.teamA as Record<string, unknown>;
      if (typeof teamA.name === 'string') state.teamA.name = teamA.name.slice(0, 64);
      if (typeof teamA.flag === 'string') state.teamA.flag = teamA.flag.slice(0, 16);
      if (typeof teamA.key === 'string') state.teamA.key = teamA.key.slice(0, 16);
      if (Array.isArray(teamA.aliases)) state.teamA.aliases = teamA.aliases.filter((v): v is string => typeof v === 'string');
      if (typeof teamA.color === 'string') state.teamA.color = teamA.color.slice(0, 32);
      if (finiteNumber(teamA.wins)) state.teamA.wins = Math.max(0, Math.floor(teamA.wins));
      if (finiteNumber(teamA.streak)) state.teamA.streak = Math.max(0, Math.floor(teamA.streak));
    }
    if (persisted.teamB && typeof persisted.teamB === 'object') {
      const teamB = persisted.teamB as Record<string, unknown>;
      if (typeof teamB.name === 'string') state.teamB.name = teamB.name.slice(0, 64);
      if (typeof teamB.flag === 'string') state.teamB.flag = teamB.flag.slice(0, 16);
      if (typeof teamB.key === 'string') state.teamB.key = teamB.key.slice(0, 16);
      if (Array.isArray(teamB.aliases)) state.teamB.aliases = teamB.aliases.filter((v): v is string => typeof v === 'string');
      if (typeof teamB.color === 'string') state.teamB.color = teamB.color.slice(0, 32);
      if (finiteNumber(teamB.wins)) state.teamB.wins = Math.max(0, Math.floor(teamB.wins));
      if (finiteNumber(teamB.streak)) state.teamB.streak = Math.max(0, Math.floor(teamB.streak));
    }
    if (Array.isArray(persisted.giftSlots)) {
      const giftSlots = persisted.giftSlots.filter(isGiftSlot).slice(0, 8);
      if (giftSlots.length === 8) state.giftSlots = giftSlots;
    }
    if (finiteNumber(persisted.personalTapThreshold)) state.personalTapThreshold = Math.max(5, Math.min(100, Math.floor(persisted.personalTapThreshold)));
    if (finiteNumber(persisted.frenzyGoalLikes)) state.frenzyGoalLikes = Math.max(25, Math.min(500, Math.floor(persisted.frenzyGoalLikes)));
    if (typeof persisted.unalignedTapSupportsUnderdog === 'boolean') state.unalignedTapSupportsUnderdog = persisted.unalignedTapSupportsUnderdog;
    if (typeof persisted.aiDirectorEnabled === 'boolean') state.aiDirectorEnabled = persisted.aiDirectorEnabled;
    if (isBiomeId(persisted.currentRoundBiome)) state.currentRoundBiome = persisted.currentRoundBiome;
    if (Array.isArray(persisted.biomeRotationRemaining)) {
      state.biomeRotationRemaining = [...new Set(persisted.biomeRotationRemaining.filter(isBiomeId))]
        .filter((id) => id !== state.currentRoundBiome);
    }
    if (typeof persisted.audioEnabled === 'boolean') state.audioEnabled = persisted.audioEnabled;
    if (typeof persisted.externalObservabilityEnabled === 'boolean') state.externalObservabilityEnabled = persisted.externalObservabilityEnabled;
    if (typeof persisted.externalObservabilityEndpoint === 'string') {
      state.externalObservabilityEndpoint = persisted.externalObservabilityEndpoint.slice(0, 500);
    }
    if (persisted.musicMode === 'starfox' || persisted.musicMode === 'pulse' || persisted.musicMode === 'mp3' || persisted.musicMode === 'off') state.musicMode = persisted.musicMode;
    if (finiteNumber(persisted.musicVolume)) state.musicVolume = Math.max(0, Math.min(1, persisted.musicVolume));
    if (typeof persisted.ttsEnabled === 'boolean') state.ttsEnabled = persisted.ttsEnabled;
    if (persisted.sessionMVP !== undefined) state.sessionMVP = sanitizeSessionMvp(persisted.sessionMVP);
    if (persisted.telemetry && typeof persisted.telemetry === 'object') {
      const telemetry = persisted.telemetry as Record<string, unknown>;
      for (const key of ['totalCoins', 'totalGifts', 'totalTaps', 'totalFollows', 'totalShares'] as const) {
        if (finiteNumber(telemetry[key])) state.telemetry[key] = Math.max(0, telemetry[key]);
      }
      if (isObject(telemetry.giftBreakdown)) {
        for (const [name, rawEntry] of Object.entries(telemetry.giftBreakdown)) {
          if (!isObject(rawEntry)) continue;
          const count = finiteNumber(rawEntry.count) ? Math.max(0, Math.floor(rawEntry.count)) : 0;
          const coins = finiteNumber(rawEntry.coins) ? Math.max(0, rawEntry.coins) : 0;
          if (count > 0) state.telemetry.giftBreakdown[name.slice(0, 64)] = { count, coins };
        }
      }
      if (Array.isArray(telemetry.wsLog)) {
        state.telemetry.wsLog = telemetry.wsLog
          .filter((entry): entry is string => typeof entry === 'string')
          .slice(0, 40);
      }
      for (const key of [
        'roundCount', 'totalRoundDurationSec', 'longestRoundSec',
        'runtimeErrorCount', 'persistenceErrorCount', 'websocketDisconnectCount',
      ] as const) {
        if (finiteNumber(telemetry[key])) state.telemetry[key] = Math.max(0, telemetry[key]);
      }
      for (const key of ['fps', 'averageFrameMs', 'maxFrameMs'] as const) {
        if (finiteNumber(telemetry[key])) state.telemetry[key] = Math.max(0, telemetry[key]);
      }
      if (finiteNumber(telemetry.usedHeapMb)) {
        state.telemetry.usedHeapMb = Math.max(0, telemetry.usedHeapMb);
      }
      if (Array.isArray(telemetry.errorLog)) {
        state.telemetry.errorLog = telemetry.errorLog
          .filter((entry): entry is string => typeof entry === 'string')
          .slice(0, 40);
      }
      if (Array.isArray(telemetry.structuredLog)) {
        state.telemetry.structuredLog = telemetry.structuredLog
          .filter((entry): entry is { ts: number; level: 'info' | 'warn' | 'error'; event: string; detail: string } =>
            isObject(entry) &&
            finiteNumber(entry.ts) &&
            (entry.level === 'info' || entry.level === 'warn' || entry.level === 'error') &&
            typeof entry.event === 'string' &&
            typeof entry.detail === 'string')
          .slice(0, 40)
          .map((entry) => ({
            ts: entry.ts,
            level: entry.level,
            event: entry.event.slice(0, 64),
            detail: entry.detail.slice(0, 300),
          }));
      }
      if (finiteNumber(telemetry.elapsedMs)) state.telemetry.sessionStart = Date.now() - Math.max(0, telemetry.elapsedMs);
    }
    state.nextMeteorCoinTarget = (Math.floor(state.telemetry.totalCoins / METEOR_COIN_STEP) + 1) * METEOR_COIN_STEP;

    // Fase A
    if (persisted.playerRecords !== undefined) state.playerRecords = sanitizePlayerRecords(persisted.playerRecords);
    if (persisted.teamRecords !== undefined) state.teamRecords = sanitizeTeamRecords(persisted.teamRecords);
    if (persisted.roundLogs !== undefined) state.roundLogs = sanitizeRoundLogs(persisted.roundLogs);
    if (Array.isArray(persisted.seasonHistory)) {
      state.seasonHistory = persisted.seasonHistory
        .map((entry) => sanitizeSeason(entry))
        .filter((entry): entry is SeasonData => entry !== null)
        .slice(-MAX_SEASON_HISTORY);
    }
    if (persisted.currentSeason !== undefined) {
      const season = sanitizeSeason(persisted.currentSeason);
      if (season) state.currentSeason = season;
    }
    if (persisted.globalRecords !== undefined) state.globalRecords = sanitizeGlobalRecords(persisted.globalRecords);
    if (finiteNumber(persisted.lastDailyReset)) state.lastDailyReset = persisted.lastDailyReset;
    if (finiteNumber(persisted.lastSeasonReset)) state.lastSeasonReset = persisted.lastSeasonReset;

    // Garantizar todos los teamRecords del roster actual
    state.roster.forEach((t) => ensureTeamRecord(t));
    const currentWorldCupMatch = getCurrentWorldCupMatch(state.worldCup);
    if (currentWorldCupMatch?.teamA && currentWorldCupMatch.teamB) {
      state.tournamentMode = false;
      state.teamA = makeBaseState(currentWorldCupMatch.teamA, true);
      state.teamB = makeBaseState(currentWorldCupMatch.teamB, false);
    }

    resetIfNeeded();
  } catch {
    state.telemetry.persistenceErrorCount += 1;
    state.telemetry.errorLog.unshift(`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}] Persistencia: estado anterior no válido`);
    state.telemetry.errorLog = state.telemetry.errorLog.slice(0, 40);
    try {
      const corruptRaw = localStorage.getItem(STORAGE_KEY);
      if (corruptRaw) localStorage.setItem(`${STORAGE_KEY}_corrupt_${Date.now()}`, corruptRaw);
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
    resetIfNeeded();
  }
}