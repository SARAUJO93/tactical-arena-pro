import { TeamId } from '../core/EventBus';
import { TeamPreset, BaseState, SideDefenseState, GiftSlot, MvpEntry, RoundLog, SeasonData, GlobalRecords, TelemetryData, PlayerRecord, TeamRecord } from '../core/GameState';
import { LruMap } from '../utils/helpers';
import { BiomeTheme } from '../config/biomes';
import { createEmptyWorldCup, createWorldCup, getCurrentWorldCupMatch, WorldCupState, WorldCupMatch } from '../systems/WorldCup';

export const STORAGE_KEY = 'tactical_arena_v2_3_league';
export const PERSISTENCE_SCHEMA_VERSION = 5;
export const MAX_BASE_HP = 3000;
export const MAX_SIDE_DEFENSE_HP = 1050;
export const ROUND_DURATION_SEC = 180;
export const SUDDEN_DEATH_DURATION_SEC = 60;
export const METEOR_COIN_STEP = 500;
export const DESIGN_W = 390;

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

export class GameStore {
  roster: TeamPreset[] = structuredClone(WORLD_ROSTER);
  rosterCursor = 2;
  tournamentMode = true;
  worldCup: WorldCupState = createEmptyWorldCup();
  teamA: BaseState = makeBaseState(WORLD_ROSTER[0], true);
  teamB: BaseState = makeBaseState(WORLD_ROSTER[1], false);
  giftSlots: GiftSlot[] = structuredClone(DEFAULT_GIFT_SLOTS);

  personalTapThreshold = 15;
  frenzyGoalLikes = 100;
  unalignedTapSupportsUnderdog = true;

  aiDirectorEnabled = true;
  roundDurationSec = ROUND_DURATION_SEC;
  suddenDeathDurationSec = SUDDEN_DEATH_DURATION_SEC;
  roundActive = true;
  roundTimeLeft = ROUND_DURATION_SEC;
  suddenDeathActive = false;
  towerDecayActive = false;
  frenzyActive = false;
  frenzyTimeLeft = 0;
  globalTapCount = 0;
  nextMeteorCoinTarget = METEOR_COIN_STEP;
  meteorRainRemaining = 0;
  lastRealInteractionAt = Date.now();

  timeScale = 1.0;
  takeoverActive = false;
  audioEnabled = true;
  externalObservabilityEnabled = false;
  externalObservabilityEndpoint = '';
  musicMode: 'starfox' | 'pulse' | 'mp3' | 'off' = 'starfox';
  musicVolume = 0.35;
  ttsEnabled = false;
  safeZonesVisible = false;
  demoMode = true;
  panelOpen = false;
  telemetryOpen = false;
  shake = 0;
  screenFlash = 0;

  sessionId = Date.now();
  roundId = Date.now();
  currentRoundStart = Date.now();
  currentRoundCoins = 0;
  currentRoundTaps = 0;
  currentRoundGifterCoins: Record<string, number> = {};
  currentRoundBiome: BiomeTheme['id'] = 'grove';
  biomeRotationRemaining: BiomeTheme['id'][] = [];

  sessionMVP: Record<string, MvpEntry> = {};
  roundMVP: Record<string, MvpEntry> = {};

  playerRecords: Record<string, PlayerRecord> = {};
  teamRecords: Record<string, TeamRecord> = {};
  roundLogs: RoundLog[] = [];
  seasonHistory: SeasonData[] = [];
  currentSeason: SeasonData = makeInitialSeason();
  globalRecords: GlobalRecords = {
    biggestSingleRound: null,
    fastestRound: null,
    longestRound: null,
    biggestUpset: null,
  };

  lastDailyReset = Date.now();
  lastSeasonReset = Date.now();

  viewerTeams = new LruMap<string, TeamId>(500);
  viewerLikes = new LruMap<string, number>(500);

  telemetry: TelemetryData = {
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

  resetRound(): void {
    this.roundActive = true;
    this.roundTimeLeft = this.roundDurationSec;
    this.suddenDeathActive = false;
    this.towerDecayActive = false;
    this.frenzyActive = false;
    this.frenzyTimeLeft = 0;
    this.globalTapCount = 0;
    this.roundMVP = {};
    this.currentRoundStart = Date.now();
    this.currentRoundCoins = 0;
    this.currentRoundTaps = 0;
    this.currentRoundGifterCoins = {};
    this.roundId = Date.now();
    this.teamA.hp = MAX_BASE_HP;
    this.teamB.hp = MAX_BASE_HP;
    this.teamA.sideDefenses.forEach((sd) => { sd.hp = sd.maxHp; sd.flash = 0; });
    this.teamB.sideDefenses.forEach((sd) => { sd.hp = sd.maxHp; sd.flash = 0; });
  }

  prepareNewTournament(): void {
    const [openingA, openingB] = this.roster;
    if (!openingA || !openingB) throw new Error('El roster necesita al menos dos equipos para iniciar un torneo.');

    this.worldCup = createEmptyWorldCup();
    this.teamA = makeBaseState(openingA, true);
    this.teamB = makeBaseState(openingB, false);
    this.rosterCursor = 2;
    this.tournamentMode = true;
    this.viewerTeams.clear();
  }

  prepareWorldCup(): WorldCupMatch {
    const ratings: Record<string, number> = {};
    WORLD_ROSTER.forEach((team) => {
      ratings[team.key] = this.teamRecords[team.key]?.elo ?? ELO_INITIAL;
    });
    this.worldCup = createWorldCup(WORLD_ROSTER, ratings);
    this.roster = structuredClone(WORLD_ROSTER);
    this.rosterCursor = 2;
    this.tournamentMode = false;
    this.viewerTeams.clear();
    this.roster.forEach((t) => this.ensureTeamRecord(t));

    const openingMatch = getCurrentWorldCupMatch(this.worldCup);
    if (!openingMatch?.teamA || !openingMatch.teamB) {
      throw new Error('No se pudo preparar el partido inicial de la Copa Mundial.');
    }
    this.teamA = makeBaseState(openingMatch.teamA, true);
    this.teamB = makeBaseState(openingMatch.teamB, false);
    return openingMatch;
  }

  ensurePlayerRecord(user: string, avatarUrl: string): PlayerRecord {
    if (!user) throw new Error('ensurePlayerRecord: user requerido');
    const cleanUser = user.slice(0, 64);
    let rec = this.playerRecords[cleanUser];
    if (!rec) {
      rec = emptyPlayerRecord(cleanUser, truncateUrl(avatarUrl));
      this.playerRecords[cleanUser] = rec;
    } else {
      if (avatarUrl) rec.avatarUrl = truncateUrl(avatarUrl);
    }
    rec.lastSeen = Date.now();
    return rec;
  }

  ensureTeamRecord(team: TeamPreset): TeamRecord {
    let rec = this.teamRecords[team.key];
    if (!rec) {
      rec = emptyTeamRecord(team);
      this.teamRecords[team.key] = rec;
    }
    rec.name = team.name;
    rec.flag = team.flag;
    rec.color = team.color;
    return rec;
  }

  recordTap(user: string, avatarUrl: string, team?: TeamId): void {
    const rec = this.ensurePlayerRecord(user, avatarUrl);
    rec.lifetime.taps += 1;
    rec.period.tapsToday += 1;
    rec.period.tapsSeason += 1;
    if (team) {
      rec.favoriteTeam = rec.favoriteTeam ?? team;
      rec.teamsSupported[team] = (rec.teamsSupported[team] ?? 0) + 1;
    }
    this.telemetry.totalTaps += 1;
    this.currentRoundTaps += 1;
    this.globalTapCount += 1;
  }

  recordGift(user: string, avatarUrl: string, team: TeamId, coins: number): void {
    const rec = this.ensurePlayerRecord(user, avatarUrl);
    const safeCoins = Number.isFinite(coins) ? Math.max(0, coins) : 0;
    rec.lifetime.gifts += 1;
    rec.lifetime.coins += safeCoins;
    rec.period.coinsToday += safeCoins;
    rec.period.coinsSeason += safeCoins;
    rec.favoriteTeam = rec.favoriteTeam ?? team;
    rec.teamsSupported[team] = (rec.teamsSupported[team] ?? 0) + 1;
    this.telemetry.totalGifts += 1;
    this.telemetry.totalCoins += safeCoins;
    this.currentRoundCoins += safeCoins;
    this.currentRoundGifterCoins[user] = (this.currentRoundGifterCoins[user] ?? 0) + safeCoins;
  }

  recordFollow(user: string, avatarUrl: string): void {
    const rec = this.ensurePlayerRecord(user, avatarUrl);
    rec.lifetime.follows += 1;
    this.telemetry.totalFollows += 1;
  }

  recordShare(user: string, avatarUrl: string): void {
    const rec = this.ensurePlayerRecord(user, avatarUrl);
    rec.lifetime.shares += 1;
    this.telemetry.totalShares += 1;
  }

  scoreMvp(user: string, avatarUrl: string, team: TeamId, delta: number): void {
    if (!user || delta <= 0) return;
    const rec = this.ensurePlayerRecord(user, avatarUrl);

    const s = this.sessionMVP[user] ?? { user, team, avatarUrl: rec.avatarUrl, score: 0 };
    s.score += delta;
    s.team = team;
    if (avatarUrl) s.avatarUrl = truncateUrl(avatarUrl);
    this.sessionMVP[user] = s;

    const r = this.roundMVP[user] ?? { user, team, avatarUrl: rec.avatarUrl, score: 0 };
    r.score += delta;
    r.team = team;
    if (avatarUrl) r.avatarUrl = truncateUrl(avatarUrl);
    this.roundMVP[user] = r;

    if (s.score > rec.peaks.maxSessionScore) rec.peaks.maxSessionScore = s.score;
    if (r.score > rec.peaks.maxRoundScore) rec.peaks.maxRoundScore = r.score;
  }

  finalizeRound(winner: TeamId, opts: { featured?: boolean; suddenDeath?: boolean } = {}): RoundLog {
    if (!this.roundActive) {
      throw new Error('Cannot finalize a round that is not active');
    }
    const featured = Boolean(opts.featured);
    const suddenDeath = Boolean(opts.suddenDeath);
    const durationSec = Math.max(1, Math.round((Date.now() - this.currentRoundStart) / 1000));
    const winnerBase = winner === 'A' ? this.teamA : this.teamB;
    const loserBase = winner === 'A' ? this.teamB : this.teamA;
    const winnerTeam = this.ensureTeamRecord(winnerBase);
    const loserTeam = this.ensureTeamRecord(loserBase);

    winnerTeam.wins += 1;
    winnerTeam.streak += 1;
    if (winnerTeam.streak > winnerTeam.bestStreak) winnerTeam.bestStreak = winnerTeam.streak;
    winnerTeam.lastPlayed = Date.now();
    winnerTeam.totalCoinsSpent += this.currentRoundCoins;
    winnerTeam.totalTaps += this.currentRoundTaps;

    loserTeam.losses += 1;
    loserTeam.streak = 0;
    loserTeam.lastPlayed = Date.now();

    const expWinner = 1 / (1 + Math.pow(10, (loserTeam.elo - winnerTeam.elo) / 400));
    const eloDiff = Math.abs(winnerTeam.elo - loserTeam.elo);
    winnerTeam.elo = Math.round(winnerTeam.elo + ELO_K_FACTOR * (1 - expWinner));
    loserTeam.elo = Math.round(loserTeam.elo - ELO_K_FACTOR * (1 - expWinner));

    if (!this.globalRecords.biggestSingleRound || this.currentRoundCoins > this.globalRecords.biggestSingleRound.coins) {
      this.globalRecords.biggestSingleRound = { coins: this.currentRoundCoins, ts: Date.now(), winnerKey: winnerTeam.key };
    }
    if (!this.globalRecords.fastestRound || durationSec < this.globalRecords.fastestRound.durationSec) {
      this.globalRecords.fastestRound = { durationSec, ts: Date.now(), winnerKey: winnerTeam.key };
    }
    if (!this.globalRecords.longestRound || durationSec > this.globalRecords.longestRound.durationSec) {
      this.globalRecords.longestRound = { durationSec, ts: Date.now(), winnerKey: winnerTeam.key };
    }
    if (eloDiff > 0 && (!this.globalRecords.biggestUpset || eloDiff > this.globalRecords.biggestUpset.eloDiff)) {
      this.globalRecords.biggestUpset = {
        eloDiff, ts: Date.now(),
        winnerKey: winnerTeam.key, loserKey: loserTeam.key,
      };
    }

    const roundMvpList = Object.values(this.roundMVP).sort((a, b) => b.score - a.score);
    const roundMvp = roundMvpList[0] ?? null;
    const roundTopGifter = (() => {
      const entries = Object.entries(this.currentRoundGifterCoins)
        .sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return null;
      return { user: entries[0][0], coins: entries[0][1] };
    })();

    if (roundMvp) {
      const rec = this.ensurePlayerRecord(roundMvp.user, roundMvp.avatarUrl);
      rec.mvpRounds += 1;
    }

    const log: RoundLog = {
      id: `r_${this.roundId}`,
      ts: Date.now(),
      durationSec,
      winner,
      winnerKey: winnerTeam.key,
      winnerName: winnerTeam.name,
      loserKey: loserTeam.key,
      loserName: loserTeam.name,
      suddenDeath,
      featured,
      biome: this.currentRoundBiome,
      totalCoins: this.currentRoundCoins,
      totalTaps: this.currentRoundTaps,
      mvp: roundMvp ? { user: roundMvp.user, avatarUrl: roundMvp.avatarUrl, score: roundMvp.score } : null,
      topGifter: roundTopGifter,
    };
    this.telemetry.roundCount += 1;
    this.telemetry.totalRoundDurationSec += durationSec;
    this.telemetry.longestRoundSec = Math.max(this.telemetry.longestRoundSec, durationSec);
    this.roundLogs.unshift(log);
    if (this.roundLogs.length > MAX_ROUND_LOGS) this.roundLogs.length = MAX_ROUND_LOGS;

    if (this.worldCup.status !== 'in_progress') {
      const season = this.currentSeason;
      const winEntry = this.ensureStandingsEntry(season, winnerBase);
      const loseEntry = this.ensureStandingsEntry(season, loserBase);
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

    this.roundMVP = {};
    this.currentRoundStart = Date.now();
    this.currentRoundCoins = 0;
    this.currentRoundTaps = 0;
    this.currentRoundGifterCoins = {};
    this.roundActive = false;

    return log;
  }

  private ensureStandingsEntry(season: SeasonData, team: TeamPreset) {
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

  resetSession(): void {
    if (this.roundActive) this.roundActive = false;

    this.sessionMVP = {};
    this.roundMVP = {};
    this.currentRoundGifterCoins = {};
    this.viewerTeams = new LruMap<string, TeamId>(500);
    this.viewerLikes = new LruMap<string, number>(500);

    this.telemetry = {
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

    this.sessionId = Date.now();
    this.nextMeteorCoinTarget = METEOR_COIN_STEP;
    this.meteorRainRemaining = 0;
    this.lastRealInteractionAt = Date.now();
  }

  resetDaily(): void {
    for (const rec of Object.values(this.playerRecords)) {
      rec.period.coinsToday = 0;
      rec.period.tapsToday = 0;
    }
    this.lastDailyReset = Date.now();
  }

  closeCurrentSeason(): void {
    const season = this.currentSeason;
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

    const teamRec = this.teamRecords[champ.key];
    if (teamRec) teamRec.championships += 1;

    this.seasonHistory.push(structuredClone(season));
    if (this.seasonHistory.length > MAX_SEASON_HISTORY) this.seasonHistory.shift();

    this.lastSeasonReset = Date.now();
  }

  startNewSeason(): void {
    const nextIndex = (this.currentSeason.index || 0) + 1;
    const now = Date.now();
    this.currentSeason = {
      index: nextIndex,
      startDate: now,
      endDate: now + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000,
      championKey: null,
      championName: null,
      championFlag: null,
      championMvp: null,
      topMvps: [],
      standings: this.roster.map((t) => ({
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

  resetIfNeeded(): void {
    const today = new Date().toDateString();
    const lastDay = new Date(this.lastDailyReset).toDateString();
    if (today !== lastDay) this.resetDaily();

    if (Date.now() > this.currentSeason.endDate) {
      this.closeCurrentSeason();
      this.startNewSeason();
    }
  }

  getTopMVPs(limit = 3): MvpEntry[] {
    return Object.values(this.sessionMVP)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getTopPlayers(limit = 50): PlayerRecord[] {
    const score = (p: PlayerRecord) =>
      p.mvpSessions * 100 +
      p.mvpRounds * 10 +
      p.peaks.maxSessionScore +
      p.lifetime.coins * 0.5 +
      p.lifetime.taps * 0.05;
    return Object.values(this.playerRecords)
      .sort((a, b) => score(b) - score(a))
      .slice(0, limit);
  }

  getTopGifters(period: 'today' | 'season' | 'lifetime' = 'season', limit = 10): Array<{ user: string; avatarUrl: string; coins: number }> {
    const key = (p: PlayerRecord): number =>
      period === 'today' ? p.period.coinsToday : period === 'season' ? p.period.coinsSeason : p.lifetime.coins;
    return Object.values(this.playerRecords)
      .filter((p) => key(p) > 0)
      .sort((a, b) => key(b) - key(a))
      .slice(0, limit)
      .map((p) => ({ user: p.user, avatarUrl: p.avatarUrl, coins: key(p) }));
  }

  getStandings(): SeasonData['standings'] {
    return [...this.currentSeason.standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });
  }

  getRecentRounds(limit = 10): RoundLog[] {
    return this.roundLogs.slice(0, limit);
  }
}

export const gameStore = new GameStore();