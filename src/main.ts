import './style.css';
import { bus, TeamId } from './core/EventBus';
import {
  loadPersistentState, makeBaseState, makeSideDefenseState, MAX_BASE_HP,
  prepareNewTournament,
  prepareWorldCup,
  savePersistentState, state, TeamPreset,
  // Fase A
  beginRound, finalizeRound, resetIfNeeded, resetSession as resetSessionState,
  scoreMvp, ensurePlayerRecord,
} from './core/GameState';
import { ElixirSystem } from './systems/ElixirSystem';
import { SynthEngine } from './audio/SynthEngine';
import { TikFinityClient } from './network/TikFinityClient';
import { Simulation } from './core/Simulation';
import { getAvatar } from './systems/AvatarCache';
import { registerChatAlignment, resolveUserTeam } from './systems/GiftMapper';
import { logWsEvent, recordTelemetryGift, renderTelemetry } from './systems/Telemetry';
import { escapeHtml } from './utils/helpers';
import { SettingsPanel } from './ui/SettingsPanel';
import { initInputShortcuts } from './ui/InputShortcuts';
import { BiomeTheme, getActiveBiome, setActiveBiome } from './config/biomes';
import { renderTeamFlagHtml } from './ui/FlagRenderer';
import { NotificationDock } from './ui/NotificationDock';
import { consumeTapRewards } from './utils/tapRewards';
import { ArenaRuntime } from './app/ArenaRuntime';
import { installErrorMonitoring } from './monitoring/ErrorMonitor';
import { ExternalObservability } from './monitoring/ExternalObservability';
import { installBrowserLifecycle } from './app/BrowserLifecycle';
import { registerOfflineCache } from './app/OfflineCache';
import {
  calculateGiftMvpPoints,
  calculateUnderdogElixirBonus,
  MVP_PARTICIPATION_POINTS,
  RoundImpactLimiter,
} from './systems/BalanceEconomy';
import {
  getBiomeExplorationProgress,
  PersonalProgressTracker,
  recordBiomeExploration,
} from './systems/PersonalProgress';
import { BiomeVoteSystem } from './systems/BiomeVoteSystem';
import { BiomeRotationSystem } from './systems/BiomeRotation';
import { FactionGoalSystem, getTeamCaptain } from './systems/FactionGoals';
import {
  getCosmeticFrameFromBadges,
  getPreviousSeasonChampion,
  syncSeasonPassBadges,
} from './systems/SeasonPass';
import { getWeeklyEventForDate } from './systems/WeeklySchedule';
import { recordWorldCupWinner } from './systems/WorldCup';
import { advanceTowerDecay, getCrownScore, getDefenseHealthPercent, resolveTimeoutWinner } from './systems/CrownScoring';
import type { TimeoutDecisionReason } from './systems/CrownScoring';

const $ = (id: string) => document.getElementById(id)!;
const notificationDock = new NotificationDock($);
const synth = new SynthEngine();
const elixir = new ElixirSystem();
const tikfinity = new TikFinityClient();
const externalObservability = new ExternalObservability('3.2.0');
const impactLimiter = new RoundImpactLimiter();
const personalProgress = new PersonalProgressTracker();
const factionGoals = new FactionGoalSystem();
const biomeVote = new BiomeVoteSystem();
const biomeRotation = new BiomeRotationSystem();
const lastJoinAnnounceAt = new Map<string, number>();
let nextBiomeOverride: BiomeTheme['id'] | null = null;

const sim = new Simulation(
  $('arenaCanvas') as HTMLCanvasElement,
  $('stageFrame'),
  $('stage'),
  $('cardBaseA'),
  $('cardBaseB'),
  synth,
  () => { updateBaseHUD(); updatePanicAlerts(); },
  (winner, reason) => triggerVictory(winner, reason)
);

// =========================================================================
// HUD DE COMBATE, ELIXIR, METAS DE BANDO Y NOTIFICATION DOCK
// =========================================================================
const lastElixirHud: Record<TeamId, { valText: string; queueLen: number }> = {
  A: { valText: '', queueLen: -1 },
  B: { valText: '', queueLen: -1 },
};

bus.on('elixir:updated', ({ team, elixir: val, maxElixir, queueLength }) => {
  const valText = val.toFixed(1);
  const prev = lastElixirHud[team];
  if (prev.valText === valText && prev.queueLen === queueLength) return;
  prev.valText = valText;
  prev.queueLen = queueLength;

  const fill = document.getElementById(`elixirFill${team}`);
  const elixirValue = document.getElementById(`elixirValue${team}`);
  const queueBadge = document.getElementById(`queueVal${team}`);
  const queueValue = document.getElementById(`queueValue${team}`);
  if (fill) fill.style.width = `${Math.min(100, (val / maxElixir) * 100)}%`;
  if (elixirValue) {
    elixirValue.textContent = valText;
    elixirValue.parentElement?.setAttribute('aria-label', `Elixir: ${valText}`);
  }
  if (queueBadge && queueValue) {
    queueValue.textContent = String(queueLength);
    queueBadge.setAttribute('aria-label', `Unidades en cola: ${queueLength}`);
    queueBadge.classList.toggle('hidden', queueLength === 0);
  }
});

bus.on('elixir:deploy', (order) => sim.deployOrder(order));

function isOnlyCoreRemaining(team: TeamId): boolean {
  const base = team === 'A' ? state.teamA : state.teamB;
  return base.sideDefenses[0].hp <= 0 && base.sideDefenses[1].hp <= 0;
}

function updateBaseHUD(): void {
  const rA = (state.teamA.hp / MAX_BASE_HP) * 100;
  const rB = (state.teamB.hp / MAX_BASE_HP) * 100;
  $('hpTextA').textContent = String(Math.ceil(state.teamA.hp));
  $('hpTextB').textContent = String(Math.ceil(state.teamB.hp));
  $('hpPctA').textContent = `${Math.ceil(rA)}%`;
  $('hpPctB').textContent = `${Math.ceil(rB)}%`;
  $('hpBarA').style.width = `${rA}%`; $('hpTrailA').style.width = `${rA}%`;
  $('hpBarB').style.width = `${rB}%`; $('hpTrailB').style.width = `${rB}%`;

  const aLeads = state.roundActive && state.teamA.hp > state.teamB.hp;
  const bLeads = state.roundActive && state.teamB.hp > state.teamA.hp;
  $('cardBaseA').classList.toggle('leading', aLeads);
  $('cardBaseB').classList.toggle('leading', bLeads);

  (['A', 'B'] as TeamId[]).forEach((team) => {
    const base = team === 'A' ? state.teamA : state.teamB;
    const crowns = getCrownScore(base);
    const health = Math.round(getDefenseHealthPercent(base));
    $(`crownCount${team}`).textContent = String(crowns);
    $(`crownBadge${team}`).setAttribute('aria-label', `${crowns} coronas`);
    $(`towerHealth${team}`).textContent = `${health}%`;
    $(`towerHealth${team}`).setAttribute('aria-label', `Vida total de torres y núcleo: ${health}%`);
  });
}

function updateFactionHUD(): void {
  (['A', 'B'] as TeamId[]).forEach((team) => {
    const snap = factionGoals.getSnapshot(team);
    const fill = document.getElementById(`factionGoalFill${team}`);
    const goalValue = document.getElementById(`factionGoalValue${team}`);
    const goalLabel = document.getElementById(`factionGoalText${team}`);
    const capValue = document.getElementById(`captainValue${team}`);

    if (fill) fill.style.width = `${snap.pct}%`;
    if (goalValue) goalValue.textContent = `${snap.likes}/${snap.target}`;
    goalLabel?.setAttribute('aria-label', `Meta de facción: ${snap.likes} de ${snap.target}`);

    if (capValue) {
      const cap = getTeamCaptain(team, state.roundMVP, state.sessionMVP);
      capValue.textContent = cap
        ? `Cap: ${cap.user.replace('@', '').slice(0, 9)}`
        : 'Cap: —';
    }
  });
}

function triggerFactionGoalReward(team: TeamId): void {
  const base = team === 'A' ? state.teamA : state.teamB;
  const by = team === 'A' ? sim.baseAY : sim.baseBY;

  if (isOnlyCoreRemaining(team)) {
    const heal = 150;
    base.hp = Math.min(MAX_BASE_HP, base.hp + heal);
    base.shieldHp = Math.max(base.shieldHp, 300);
    base.shieldTimer = 3;
    elixir.addElixir(team, 1.5);

    sim.pushShockwave(sim.safeCenterX, by, 76, '#67E8F9', 3);
    sim.pushBadge(sim.safeCenterX, by + (team === 'A' ? 24 : -24), '🛡️ ESCUDO 3s', '#67E8F9');
    synth.playSFX('shield');
    updateBaseHUD();
    updatePanicAlerts();

    pushNotificationDock(
      `🛡️ META DE ${base.name} COMPLETADA`,
      `Escudo de emergencia (3s) +${heal} HP y +1.5⚡`,
      base.color,
      '',
      '',
      '🛡️',
      'BANDO',
      2800
    );
  } else {
    elixir.addElixir(team, 2.0);
    elixir.enqueueOrder({ team, kind: 'INFANTRY', priority: 2, user: `Bando ${base.key}`, avatarUrl: '' });
    sim.pushShockwave(sim.safeCenterX, by, 68, '#FBBF24', 2.8);
    sim.pushBadge(sim.safeCenterX, by + (team === 'A' ? 24 : -24), '⚔️ ASALTO +2⚡', '#FDE047');
    synth.playSFX('frenzy');

    pushNotificationDock(
      `⚔️ ASALTO DE ${base.name}`,
      'Meta de likes: +2.0⚡ Elixir y refuerzos al frente',
      base.color,
      '',
      '',
      '⚔️',
      'BANDO',
      2800
    );
  }
}

function checkSeasonPassUnlock(user: string, avatarUrl: string): void {
  const rec = state.playerRecords[user];
  if (!rec) return;
  const unlocked = syncSeasonPassBadges(rec);
  if (!unlocked) return;
  pushNotificationDock(
    `🎟️ ${user} · ${unlocked.emblem} ${unlocked.title}`,
    `Pase T${unlocked.tier} desbloqueado: marco cosmético activo`,
    unlocked.ringColor,
    avatarUrl,
    user,
    unlocked.emblem,
    'PASE',
    2900
  );
  savePersistentState();
}

function updateFrenzyGaugeUI(): void {
  const pct = state.frenzyActive ? 100 : Math.min(100, Math.round((state.globalTapCount / state.frenzyGoalLikes) * 100));
  $('frenzyGaugeFill').style.width = `${pct}%`;
  $('frenzyGaugePct').textContent = state.frenzyActive ? 'x2!' : `${pct}%`;
  $('frenzyGaugeCount').textContent = state.frenzyActive ? `${state.frenzyTimeLeft}s` : `${state.globalTapCount}/${state.frenzyGoalLikes}`;
  $('tapRuleBadge').textContent = `❤️ ${state.personalTapThreshold} = +⚡`;
}

function syncTimerPill(): void {
  const pill = $('timerPill');
  if (state.towerDecayActive) {
    pill.classList.remove('frenzy');
    pill.classList.add('sudden');
    $('timerIcon').dataset.mode = 'sudden';
    $('timerText').textContent = 'COLAPSO';
  } else if (state.suddenDeathActive) {
    pill.classList.remove('frenzy');
    pill.classList.add('sudden');
    $('timerIcon').dataset.mode = 'sudden';
    $('timerText').textContent = `${String(Math.floor(state.roundTimeLeft / 60)).padStart(2, '0')}:${String(state.roundTimeLeft % 60).padStart(2, '0')}`;
  } else if (state.frenzyActive) {
    pill.classList.remove('sudden');
    pill.classList.add('frenzy');
    $('timerIcon').dataset.mode = 'frenzy';
    $('timerText').textContent = `x2 · ${state.frenzyTimeLeft}s`;
  } else {
    pill.classList.remove('sudden', 'frenzy');
    $('timerIcon').dataset.mode = 'normal';
    $('timerText').textContent = `${String(Math.floor(state.roundTimeLeft / 60)).padStart(2, '0')}:${String(state.roundTimeLeft % 60).padStart(2, '0')}`;
  }
}

let tickerIdx = 0;
function updateOnboardingTicker(): void {
  const weekly = getWeeklyEventForDate();
  const goalLikes = factionGoals.getSnapshot('A').target;
  const tips = [
    `${weekly.badge} ${weekly.title}`,
    `❤️ ${state.personalTapThreshold} Taps = Tropas`,
    `⚔️ ${goalLikes} Likes = Asalto / Escudo 3s`,
    `🎟️ Sube tu Pase Gratis con Taps`,
    '🧭 Participa en 3 biomas y desbloquea el marco Explorador',
    '🤝 Los taps sin equipo apoyan al bando que va perdiendo',
  ];
  const tip = tips[tickerIdx % tips.length];
  tickerIdx++;

  const keyA = escapeHtml(state.teamA.key);
  const keyB = escapeHtml(state.teamB.key);
  $('onboardingTicker').innerHTML =
    `<span>ELIGE:</span>` +
    `<span class="cta-key" style="background:${state.teamA.color};">${keyA}</span>` +
    `<span>o</span>` +
    `<span class="cta-key" style="background:${state.teamB.color};">${keyB}</span>` +
    `<span class="cta-sep">·</span>` +
    `<span class="cta-tip">${escapeHtml(tip)}</span>`;
}
setInterval(updateOnboardingTicker, 4000);

function pushNotificationDock(
  title: string,
  sub: string,
  color = '#5ac8fa',
  avatarUrl = '',
  user = '',
  glyph = '⚔️',
  tag = 'LIVE',
  durationMs = 2600
): void {
  notificationDock.push(title, sub, color, avatarUrl, user, glyph, tag, durationMs);
}

function renderBiomeVote(weeklyBiomeId: BiomeTheme['id'] | null = null): void {
  const element = $('vicBiomeVote');
  const snapshot = biomeVote.getSnapshot();
  if (!snapshot) {
    element.classList.add('hidden');
    return;
  }
  element.classList.remove('hidden');
  const featuredOption = [snapshot.first, snapshot.second].find((biome) => biome.id === weeklyBiomeId);
  const featuredLabel = featuredOption ? ` · ⭐ ${featuredOption.name} destacado semanal` : '';
  element.textContent =
    `🗺️ ¡VOTA! Escribe 1 o 2 · 1 ${snapshot.first.icon} ${snapshot.first.name} (${snapshot.votesFirst})` +
    ` · 2 ${snapshot.second.icon} ${snapshot.second.name} (${snapshot.votesSecond}) · Empate: gana 1${featuredLabel}`;
}

function openBiomeVote(weeklyBiomeId: BiomeTheme['id'] | null): void {
  const options = biomeRotation.getOptions(weeklyBiomeId);
  if (options.length === 1) {
    biomeVote.reset();
    nextBiomeOverride = options[0].id;
    $('vicBiomeVote').classList.remove('hidden');
    $('vicBiomeVote').textContent = `🔄 Último bioma de la rotación: ${options[0].icon} ${options[0].name}`;
    return;
  }

  const [first, second] = options;
  if (!second) throw new Error('Biome rotation did not provide two distinct choices');
  biomeVote.start([first, second]);
  renderBiomeVote(weeklyBiomeId);
}

function announceActiveBiome(): void {
  const b = getActiveBiome();
  const weekly = getWeeklyEventForDate();
  const sub = weekly.id !== 'regular'
    ? `${weekly.title} · ${weekly.description}`
    : `Rotación aleatoria · ${biomeRotation.getRemainingIds().length} biomas por descubrir`;
  pushNotificationDock(b.name, sub, b.accent, '', '', b.icon, weekly.dayLabel, 3200);
}

function showCenterBanner(title: string, sub: string, color = '#FBBF24', avatarUrl = '', user = ''): void {
  pushNotificationDock(title, sub, color, avatarUrl, user, '⚡', 'EVENTO');
}

function showLastCommander(user: string, avatarUrl: string, actionText: string, color: string): void {
  pushNotificationDock(user.startsWith('@') ? user : `@${user}`, actionText, color, avatarUrl, user, '🎁', 'LIVE');
}

function updatePanicAlerts(): void {
  const aLow = state.roundActive && state.teamA.hp > 0 && state.teamA.hp < MAX_BASE_HP * 0.25;
  const bLow = state.roundActive && state.teamB.hp > 0 && state.teamB.hp < MAX_BASE_HP * 0.25;
  const shieldSlot = state.giftSlots.find((s) => s.tier === 5) || state.giftSlots[4];

  if (aLow && !state.teamA.panicActive) {
    state.teamA.panicActive = true;
    synth.playSFX('panic');
    pushNotificationDock(`🚨 ${state.teamA.name} EN PELIGRO`, `Envía ${shieldSlot.display} → Escudo 3s`, '#ef4444', '', '', '🚨', 'SOS');
  } else if (!aLow) {
    state.teamA.panicActive = false;
  }

  if (bLow && !state.teamB.panicActive) {
    state.teamB.panicActive = true;
    synth.playSFX('panic');
    pushNotificationDock(`🚨 ${state.teamB.name} EN PELIGRO`, `Envía ${shieldSlot.display} → Escudo 3s`, '#ef4444', '', '', '🚨', 'SOS');
  } else if (!bLow) {
    state.teamB.panicActive = false;
  }

  $('cardBaseA').classList.toggle('panic', aLow);
  $('cardBaseB').classList.toggle('panic', bLow);
}

// =========================================================================
// MVP (FASE A): usa scoreMvp de GameState para no perder peaks históricos
// =========================================================================
let top3Timer: ReturnType<typeof setTimeout> | null = null;

function addMVPPoints(user: string, team: TeamId, avatarUrl: string, points: number, isDemo = false): void {
  const clean = user.startsWith('@') ? user : `@${user}`;
  if (isDemo) {
    const bucket = state.roundMVP;
    if (!bucket[clean]) bucket[clean] = { user: clean, team, avatarUrl: avatarUrl || '', score: 0 };
    bucket[clean].score += points;
    bucket[clean].team = team;
    if (avatarUrl) bucket[clean].avatarUrl = avatarUrl;
  } else {
    scoreMvp(clean, avatarUrl, team, points);
  }
  if (!top3Timer) {
    top3Timer = setTimeout(() => {
      top3Timer = null;
      renderTop3MVP();
      updateFactionHUD();
    }, 400);
  }
  if (!isDemo) savePersistentState();
}

function renderTop3MVP(): void {
  const src = Object.keys(state.sessionMVP).length ? state.sessionMVP : state.roundMVP;
  const top = Object.values(src).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top.length) {
    $('mvpStrip').innerHTML = '<div class="mvp-heading"><svg class="ui-icon" aria-hidden="true"><use href="#icon-crown"></use></svg><span>Top 3 MVP</span></div>';
    return;
  }
  const medals = [
    '<svg class="ui-icon mvp-rank-icon mvp-rank-gold" aria-hidden="true"><use href="#icon-crown"></use></svg>',
    '<svg class="ui-icon mvp-rank-icon mvp-rank-silver" aria-hidden="true"><use href="#icon-medal"></use></svg>',
    '<svg class="ui-icon mvp-rank-icon mvp-rank-bronze" aria-hidden="true"><use href="#icon-medal"></use></svg>',
  ];
  const rings = ['#FBBF24', '#CBD5E1', '#D97706'];
  $('mvpStrip').innerHTML = top.map((m, idx) => {
    const av = getAvatar(m.avatarUrl, m.user);
    const tCol = m.team === 'A' ? state.teamA.color : state.teamB.color;
    const pts = m.score >= 1000 ? `${(m.score / 1000).toFixed(1)}k` : String(m.score);
    const rec = state.playerRecords[m.user];
    const rank = personalProgress.getRank(m.user, rec);
    const cosmetic = getCosmeticFrameFromBadges(rec?.badges);
    const borderCol = cosmetic ? cosmetic.ringColor : rings[idx];
    const badgeTag = cosmetic ? cosmetic.emblem : `Nv.${rank.level}`;
    return `<div class="mvp-item">
      <div style="position:relative;flex-shrink:0;">
        <img src="${av.dataUrl}" alt="" style="width:16px;height:16px;border-radius:50%;object-fit:cover;border:1.5px solid ${borderCol};display:block;" />
        <span class="mvp-rank-badge">${medals[idx]}</span>
      </div>
      <div style="min-width:0;line-height:1.1;">
        <div style="font-size:8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:2px;">
          <span style="width:5px;height:5px;border-radius:50%;background:${tCol};flex-shrink:0;"></span>
          <span>${escapeHtml(m.user.replace('@', '').slice(0, 6))}</span>
        </div>
        <div class="tabular" style="font-size:7px;color:#94A3B8;display:flex;align-items:center;">
          <span>${pts}</span>
          <span class="mvp-lvl">${badgeTag}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderGiftLegend(): void {
  const [sA, sB, sTank, , , sEmp, sHack, sNuke] = state.giftSlots;
  const icon = (s: typeof sA) => (s.imgUrl ? `<img src="${escapeHtml(s.imgUrl)}" alt="" />` : `<span>${escapeHtml(s.emoji)}</span>`);
  $('giftLegendGrid').innerHTML = `
    <div class="gift-cell"><div class="gift-icon-wrap">${icon(sA)}</div><div class="gift-title" style="color:${state.teamA.color};">${escapeHtml(state.teamA.key)}:${escapeHtml(sA.display)}</div><div class="gift-sub">1⚡ Inf</div><div class="coin-badge">🪙${sA.coins}</div></div>
    <div class="gift-cell"><div class="gift-icon-wrap">${icon(sB)}</div><div class="gift-title" style="color:${state.teamB.color};">${escapeHtml(state.teamB.key)}:${escapeHtml(sB.display)}</div><div class="gift-sub">1⚡ Inf</div><div class="coin-badge">🪙${sB.coins}</div></div>
    <div class="gift-cell"><div class="gift-icon-wrap">${icon(sTank)}</div><div class="gift-title">${escapeHtml(sTank.display)}</div><div class="gift-sub">2⚡ Tanque</div><div class="coin-badge">🪙${sTank.coins}</div></div>
    <div class="gift-cell emp-cell"><div class="gift-icon-wrap">${icon(sEmp)}</div><div class="gift-title" style="color:#67E8F9;">${escapeHtml(sEmp.display)}</div><div class="gift-sub">EMP -50%⚡</div><div class="coin-badge">🪙${sEmp.coins}</div></div>
    <div class="gift-cell hack-cell"><div class="gift-icon-wrap">${icon(sHack)}</div><div class="gift-title" style="color:#E9D5FF;">${escapeHtml(sHack.display)}</div><div class="gift-sub">Hack x3</div><div class="coin-badge">🪙${sHack.coins}</div></div>
    <div class="gift-cell nuke-cell"><div class="gift-icon-wrap">${icon(sNuke)}</div><div class="gift-title" style="color:#FDE047;">${escapeHtml(sNuke.display)}</div><div class="gift-sub">Nuclear+3⚡</div><div class="coin-badge">🪙${sNuke.coins}</div></div>`;
}

// =========================================================================
// FASE A · Helpers de tracking por viewer (sin duplicar telemetría)
// =========================================================================
function trackTapForViewer(user: string, avatarUrl: string, team: TeamId | null, count: number): void {
  if (!user || count <= 0) return;
  const rec = ensurePlayerRecord(user, avatarUrl);
  rec.lifetime.taps += count;
  rec.period.tapsToday += count;
  rec.period.tapsSeason += count;
  if (team) {
    rec.favoriteTeam = rec.favoriteTeam ?? team;
    rec.teamsSupported[team] = (rec.teamsSupported[team] ?? 0) + count;
  }
  state.currentRoundTaps += count;
  const exploration = recordBiomeExploration(rec.badges, getActiveBiome().id);
  if (exploration.newBiome) {
    savePersistentState();
    pushNotificationDock(
      exploration.newlyUnlocked ? '🧭 MARCO EXPLORADOR DESBLOQUEADO' : `${user} · Exploración ${exploration.visited}/${exploration.target}`,
      exploration.newlyUnlocked
        ? 'Participaste en tres biomas distintos. Recompensa cosmética gratis.'
        : 'Apoya con taps en otros biomas para desbloquear tu marco.',
      '#A3E635',
      avatarUrl,
      user,
      '🧭',
      exploration.newlyUnlocked ? 'RECOMPENSA' : 'META',
      2400
    );
  }
  checkSeasonPassUnlock(user, avatarUrl);
}

function trackGiftForViewer(user: string, avatarUrl: string, team: TeamId, count: number, coinsPerUnit: number): void {
  if (!user || count <= 0) return;
  const rec = ensurePlayerRecord(user, avatarUrl);
  const coinDelta = Math.max(0, coinsPerUnit) * count;
  rec.lifetime.gifts += count;
  rec.lifetime.coins += coinDelta;
  rec.period.coinsToday += coinDelta;
  rec.period.coinsSeason += coinDelta;
  rec.favoriteTeam = rec.favoriteTeam ?? team;
  rec.teamsSupported[team] = (rec.teamsSupported[team] ?? 0) + count;
  state.currentRoundCoins += coinDelta;
  state.currentRoundGifterCoins[user] = (state.currentRoundGifterCoins[user] ?? 0) + coinDelta;
  checkSeasonPassUnlock(user, avatarUrl);
}

function trackFollowForViewer(user: string, avatarUrl: string): void {
  if (!user) return;
  const rec = ensurePlayerRecord(user, avatarUrl);
  rec.lifetime.follows += 1;
  checkSeasonPassUnlock(user, avatarUrl);
}

function trackShareForViewer(user: string, avatarUrl: string): void {
  if (!user) return;
  const rec = ensurePlayerRecord(user, avatarUrl);
  rec.lifetime.shares += 1;
  checkSeasonPassUnlock(user, avatarUrl);
}

// =========================================================================
// ACCIONES INSTANTÁNEAS, TAKEOVER Y EVENTOS DEL BUS
// =========================================================================
let takeoverTimer: ReturnType<typeof setTimeout> | null = null;
const takeoverQueue: { team: TeamId; clean: string; avatarUrl: string; giftName: string }[] = [];

function endTakeovers(): void {
  if (takeoverTimer) clearTimeout(takeoverTimer);
  takeoverQueue.length = 0;
  state.takeoverActive = false;
  state.timeScale = 1.0;
  $('whaleTakeover').classList.add('hidden');
}

function runNextTakeover(): void {
  const job = takeoverQueue.shift();
  if (!job || !state.roundActive || state.towerDecayActive) { endTakeovers(); return; }
  const enemyObj = job.team === 'A' ? state.teamB : state.teamA;
  const { scale, useCount } = impactLimiter.consume(job.team, 'nuclear');
  const scaleTag = useCount > 1 ? ` (${Math.round(scale * 100)}%)` : '';

  state.takeoverActive = true; state.timeScale = 0.25;
  synth.duck(3500); synth.playSFX('nuclear_siren');
  synth.speak(`${job.clean.replace('@', '')} lanzó ataque nuclear contra ${enemyObj.name}`);
  ($('tkAvatar') as HTMLImageElement).src = getAvatar(job.avatarUrl, job.clean).dataUrl;
  $('tkUser').textContent = job.clean;
  $('tkSub').textContent = `${job.giftName.toUpperCase()}${scaleTag} • OBJETIVO: ${enemyObj.name}`;
  $('whaleTakeover').classList.remove('hidden');

  takeoverTimer = setTimeout(() => {
    if (state.roundActive && !state.towerDecayActive) {
      sim.spawnOrbital(job.team, job.clean, job.avatarUrl, scale);
      const bonusElixir = Math.max(1, Math.round((state.frenzyActive ? 5 : 3) * scale));
      elixir.addElixir(job.team, bonusElixir);
    }
    if (takeoverQueue.length && state.roundActive && !state.towerDecayActive) runNextTakeover();
    else endTakeovers();
  }, 2600);
}

bus.on('action:instant', ({ team, kind, user, avatarUrl, giftName, mult = 1 }) => {
  if (!state.roundActive || state.towerDecayActive) return;
  if (kind === 'SHIELD') {
    const base = team === 'A' ? state.teamA : state.teamB;
    const by = team === 'A' ? sim.baseAY : sim.baseBY;

    if (isOnlyCoreRemaining(team)) {
      const heal = Math.round(MAX_BASE_HP * 0.08 * mult);
      base.hp = Math.min(MAX_BASE_HP, base.hp + heal);
      base.shieldHp = 350 * mult;
      base.shieldTimer = 3;
      base.shieldOwner = user;
      base.shieldAvatar = avatarUrl;
      synth.duck(2000); synth.playSFX('shield');
      sim.pushShockwave(sim.safeCenterX, by, 72, '#22D3EE', 3);
      sim.pushBadge(sim.safeCenterX, by + (team === 'A' ? 24 : -24), `+${heal} HP 🛡️3s`, '#67E8F9');
      showCenterBanner('🛡️ ESCUDO DE EMERGENCIA (3s)', `${user} protegió el núcleo de ${base.name} (+${heal} HP)`, '#22D3EE', avatarUrl, user);
      updateBaseHUD(); updatePanicAlerts();
    } else {
      elixir.addElixir(team, 1.5 * mult);
      elixir.enqueueOrder({ team, kind: 'TANK', priority: 1, user, avatarUrl, isPaidGift: true });
      synth.duck(1800); synth.playSFX('frenzy');
      sim.pushShockwave(sim.safeCenterX, by, 64, '#FBBF24', 2.5);
      sim.pushBadge(sim.safeCenterX, by + (team === 'A' ? 24 : -24), '⚔️ SOBRECARGA +⚡', '#FDE047');
      showCenterBanner('⚔️ SOBRECARGA OFENSIVA', `${user} impulsó a ${base.name} (Tanque + Elixir)`, base.color, avatarUrl, user);
    }
  } else if (kind === 'EMP') {
    const enemyTeam: TeamId = team === 'A' ? 'B' : 'A';
    const enemyBase = enemyTeam === 'A' ? state.teamA : state.teamB;
    const { scale, useCount } = impactLimiter.consume(team, 'emp');
    const dur = Math.max(3, Math.round((state.frenzyActive ? 14 : 10) * scale));
    const slowSec = Math.max(2, Math.round(6 * scale));
    enemyBase.empTimer = Math.min(18, enemyBase.empTimer + dur);
    sim.applyEmpToUnits(enemyTeam, dur);
    elixir.applyEmpSlow(enemyTeam, slowSec);
    synth.duck(2400); synth.playSFX('emp'); state.shake = Math.max(state.shake, 7);
    const capTag = useCount > 1 ? ` · ${Math.round(scale * 100)}%` : '';
    showCenterBanner(`⚡ PULSO EMP (${enemyBase.empTimer}s${capTag})`, `${user} apagó torretas de ${enemyBase.name}`, '#22D3EE', avatarUrl, user);
  } else if (kind === 'CYBER_HACK') {
    const { scale, useCount } = impactLimiter.consume(team, 'hack');
    const maxSteal = Math.max(1, Math.round((state.frenzyActive ? 4 : 3) * scale));
    const stolen = sim.applyCyberHack(team, user, avatarUrl, maxSteal);
    const missing = Math.max(0, maxSteal - stolen);
    if (missing > 0) elixir.addElixir(team, missing * 2);
    synth.duck(2400); synth.playSFX('hack');
    const capTag = useCount > 1 ? ` (${Math.round(scale * 100)}%)` : '';
    const detail = missing > 0 ? `robó ${stolen} y recuperó +${missing * 2}⚡` : `robó ${stolen} unidades enemigas`;
    showCenterBanner(`👾 CYBER HACK${capTag}`, `${user} ${detail}`, '#C084FC', avatarUrl, user);
  } else if (kind === 'NUCLEAR') {
    const clean = user.startsWith('@') ? user : `@${user}`;
    takeoverQueue.push({ team, clean, avatarUrl, giftName: giftName || 'Nuclear' });
    if (!state.takeoverActive) runNextTakeover();
  } else if (kind === 'METEOR_SHOWER') {
    state.meteorRainRemaining += 9;
    synth.duck(3000); synth.playSFX('meteor_alert');
    showCenterBanner('☄️ LLUVIA DE METEORITOS', `${user} • Impactos orbitales en zona central`, '#FB923C');
  }
});

bus.on('game:chat', ({ user, comment, avatarUrl }) => {
  if (state.towerDecayActive) return;
  if (!state.roundActive) {
    const snapshot = biomeVote.castVote(user, comment);
    if (snapshot) renderBiomeVote();
    return;
  }

  const aligned = registerChatAlignment(user, comment);
  if (!aligned || !state.roundActive) return;
  const clean = user.startsWith('@') ? user : `@${user}`;
  const now = Date.now();
  if (now - (lastJoinAnnounceAt.get(clean) || 0) < 15000) return;
  lastJoinAnnounceAt.set(clean, now);
  if (lastJoinAnnounceAt.size > 300) {
    const oldest = lastJoinAnnounceAt.keys().next().value;
    if (oldest !== undefined) lastJoinAnnounceAt.delete(oldest);
  }
  const tObj = aligned === 'A' ? state.teamA : state.teamB;
  pushNotificationDock(
    `${clean} → ${tObj.name}`,
    `¡Bando elegido! Tus taps ahora apoyan a ${tObj.key}`,
    tObj.color,
    avatarUrl,
    clean,
    '🎯',
    'BANDO',
    2100
  );
});

// =========================================================================
// TAP · FASE A + PROGRESO PERSONAL + METAS DE BANDO + PASE
// =========================================================================
bus.on('game:tap', ({ user, count, avatarUrl, forcedTeam, isDemo = false }) => {
  if (!state.roundActive || state.towerDecayActive) return;
  if (!isDemo) state.lastRealInteractionAt = Date.now();

  const clean = (user || 'Viewer').startsWith('@') ? user : `@${user || 'Viewer'}`;
  let team: TeamId | null = forcedTeam || state.viewerTeams.get(clean) || null;
  if (!team && state.unalignedTapSupportsUnderdog) team = state.teamA.hp <= state.teamB.hp ? 'A' : 'B';

  if (!isDemo) {
    state.telemetry.totalTaps += count;
    trackTapForViewer(clean, avatarUrl, team, count);
  }

  const progress = personalProgress.recordAction(
    clean,
    'tap',
    count,
    0,
    isDemo ? undefined : state.playerRecords[clean]
  );

  if (team) {
    const tObj = team === 'A' ? state.teamA : state.teamB;
    const tapResult = consumeTapRewards(
      state.viewerLikes.get(clean) || 0,
      count,
      state.personalTapThreshold
    );
    for (let i = 0; i < tapResult.rewardCount; i++) {
      elixir.addElixir(team, 0.6);
      elixir.enqueueOrder({ team, kind: 'INFANTRY', priority: 2, user: clean, avatarUrl, isTapBadge: true });
      addMVPPoints(clean, team, avatarUrl, MVP_PARTICIPATION_POINTS.TAP_BATCH, isDemo);
      synth.playSFX('tap');
    }
    state.viewerLikes.set(clean, Math.min(tapResult.residue, state.personalTapThreshold * 2));

    const goalProgress = factionGoals.addLikes(team, count);
    updateFactionHUD();
    if (goalProgress.triggeredCount > 0) {
      triggerFactionGoalReward(team);
    } else if (progress.leveledUp) {
      pushNotificationDock(
        `⭐ ${clean} · Nv.${progress.level} ${progress.title}`,
        `Progreso personal: ${progress.xp} XP (${progress.progressPct}%)`,
        '#FBBF24',
        avatarUrl,
        clean,
        '⭐',
        'RANGO',
        2600
      );
    } else if (progress.milestoneLabel) {
      pushNotificationDock(
        `${clean} · ${progress.milestoneLabel}`,
        `Nv.${progress.level} ${progress.title} · Apoyando a ${tObj.key}`,
        tObj.color,
        avatarUrl,
        clean,
        '❤️',
        'META',
        2200
      );
    }
  }
  if (!state.frenzyActive) {
    state.globalTapCount += count;
    if (state.globalTapCount >= state.frenzyGoalLikes) { activateFrenzy(); return; }
  }
  updateFrenzyGaugeUI();
});

// =========================================================================
// FOLLOW · FASE A + PROGRESO PERSONAL
// =========================================================================
bus.on('game:follow', ({ user, avatarUrl, isDemo = false }) => {
  if (!state.roundActive || state.towerDecayActive) return;
  if (!isDemo) {
    state.lastRealInteractionAt = Date.now();
    state.telemetry.totalFollows++;
  }
  const clean = user.startsWith('@') ? user : `@${user}`;
  const team = resolveUserTeam(clean);

  if (!isDemo) trackFollowForViewer(clean, avatarUrl);
  const progress = personalProgress.recordAction(
    clean,
    'follow',
    1,
    0,
    isDemo ? undefined : state.playerRecords[clean]
  );

  elixir.addElixir(team, 0.8);
  elixir.enqueueOrder({ team, kind: 'INFANTRY', priority: 2, user: clean, avatarUrl });
  addMVPPoints(clean, team, avatarUrl, MVP_PARTICIPATION_POINTS.FOLLOW, isDemo);
  showLastCommander(clean, avatarUrl, `¡siguió! → +⚡ Soldados · Nv.${progress.level}`, '#34D399');
  synth.playSFX('follow');
});

// =========================================================================
// SHARE · FASE A + PROGRESO PERSONAL
// =========================================================================
bus.on('game:share', ({ user, avatarUrl, isDemo = false }) => {
  if (!state.roundActive || state.towerDecayActive) return;
  if (!isDemo) {
    state.lastRealInteractionAt = Date.now();
    state.telemetry.totalShares++;
  }
  const clean = user.startsWith('@') ? user : `@${user}`;
  const team = resolveUserTeam(clean);

  if (!isDemo) trackShareForViewer(clean, avatarUrl);
  const progress = personalProgress.recordAction(
    clean,
    'share',
    1,
    0,
    isDemo ? undefined : state.playerRecords[clean]
  );

  elixir.addElixir(team, 1.5);
  elixir.enqueueOrder({ team, kind: 'JET', priority: 2, user: clean, avatarUrl });
  addMVPPoints(clean, team, avatarUrl, MVP_PARTICIPATION_POINTS.SHARE, isDemo);
  showCenterBanner(
    '✈️ ATAQUE POR COMPARTIR',
    `${clean} (Nv.${progress.level}) → Jet para ${(team === 'A' ? state.teamA : state.teamB).name}`,
    '#38BDF8',
    avatarUrl,
    clean
  );
});

// =========================================================================
// GIFT · FASE A + ECONOMÍA BALANCEADA + PROGRESO PERSONAL
// =========================================================================
bus.on('game:gift', ({ team, tier, delta, user, giftName, avatarUrl, coins, isDemo = false }) => {
  if (!state.roundActive || state.towerDecayActive || delta <= 0) return;
  if (!isDemo) {
    state.lastRealInteractionAt = Date.now();
    recordTelemetryGift(giftName, delta, coins || 1);
  }
  const clean = user.startsWith('@') ? user : `@${user}`;
  state.viewerTeams.set(clean, team);
  addMVPPoints(clean, team, avatarUrl, calculateGiftMvpPoints(coins || 1, delta), isDemo);

  if (!isDemo) trackGiftForViewer(clean, avatarUrl, team, delta, coins || 1);
  const progress = personalProgress.recordAction(
    clean,
    'gift',
    delta,
    coins || 1,
    isDemo ? undefined : state.playerRecords[clean]
  );

  const underdogTeam: TeamId = state.teamA.hp <= state.teamB.hp ? 'A' : 'B';
  if (team !== underdogTeam) {
    const underdogBonus = calculateUnderdogElixirBonus(tier, delta);
    if (underdogBonus > 0) {
      elixir.addElixir(underdogTeam, underdogBonus);
      if (tier === 4 || tier === 6 || tier === 7) {
        const uY = underdogTeam === 'A' ? sim.baseAY + 24 : sim.baseBY - 24;
        sim.pushBadge(
          sim.safeCenterX,
          uY,
          `+${underdogBonus.toFixed(1)}⚡ UNDERDOG`,
          '#34D399',
          underdogTeam === 'A' ? 0.45 : -0.45
        );
      }
    }
  }

  const tObj = team === 'A' ? state.teamA : state.teamB;
  const rankSuffix = progress.leveledUp ? ` · ⭐ Nv.${progress.level}` : ` · Nv.${progress.level}`;
  showLastCommander(
    clean,
    avatarUrl,
    `${delta > 1 ? `x${delta} ` : ''}${giftName}${state.frenzyActive ? ' ⚡x2' : ''}${rankSuffix}`,
    tObj.color
  );

  if (tier === 1) {
    for (let i = 0; i < delta; i++) {
      elixir.addElixir(team, 0.5);
      elixir.enqueueOrder({ team, kind: 'INFANTRY', priority: 1, user: clean, avatarUrl, isPaidGift: true });
    }
  } else if (tier === 2) {
    for (let i = 0; i < delta; i++) {
      elixir.addElixir(team, 1.0);
      elixir.enqueueOrder({ team, kind: 'TANK', priority: 1, user: clean, avatarUrl, isPaidGift: true });
    }
    synth.speak(`${clean.replace('@', '')} envió tanque para ${tObj.name}`);
  } else if (tier === 3) {
    for (let i = 0; i < delta; i++) {
      elixir.addElixir(team, 0.8);
      elixir.enqueueOrder({ team, kind: 'JET', priority: 1, user: clean, avatarUrl, isPaidGift: true });
    }
  } else if (tier === 4) {
    bus.emit('action:instant', { team, kind: 'NUCLEAR', user: clean, avatarUrl, giftName });
  } else if (tier === 5) {
    bus.emit('action:instant', { team, kind: 'SHIELD', user: clean, avatarUrl, mult: state.frenzyActive ? 2 : 1 });
  } else if (tier === 6) {
    bus.emit('action:instant', { team, kind: 'EMP', user: clean, avatarUrl });
  } else if (tier === 7) {
    bus.emit('action:instant', { team, kind: 'CYBER_HACK', user: clean, avatarUrl });
  }
});

// =========================================================================
// FRENESÍ, MUERTE SÚBITA, VICTORIA Y RESET · FASE A
// =========================================================================
function activateFrenzy(): void {
  if (!state.roundActive || state.towerDecayActive) return;
  state.frenzyActive = true; state.frenzyTimeLeft = 20; state.globalTapCount = 0;
  $('frenzyVignette').classList.add('active');
  updateFrenzyGaugeUI();
  syncTimerPill();
  pushNotificationDock('⚡ FRENESÍ x2 ACTIVO', 'Elixir doble durante 20 segundos', '#FBBF24', '', '', '⚡', 'BOOST', 3000);
  synth.duck(2400); synth.playSFX('frenzy');
  elixir.addElixir('A', 2.5); elixir.addElixir('B', 2.5);
}

function activateSuddenDeath(atTimerEnd = false): void {
  if (!state.roundActive || state.suddenDeathActive || state.towerDecayActive) return;
  if (atTimerEnd) {
    const decision = resolveTimeoutWinner(state.teamA, state.teamB);
    if (decision) {
      triggerVictory(decision.winner, decision.reason);
      return;
    }
  }
  state.suddenDeathActive = true;
  state.roundTimeLeft = state.suddenDeathDurationSec;
  $('suddenDeathVignette').classList.add('active');
  syncTimerPill();
  pushNotificationDock('💀 MUERTE SÚBITA · 01:00', 'La primera torre que caiga decide la ronda', '#ef4444', '', '', '💀', 'FINAL', 4200);
  synth.duck(2400); synth.playSFX('sudden_horn');
}

function activateTowerDecay(): void {
  if (!state.roundActive || !state.suddenDeathActive || state.towerDecayActive) return;
  state.towerDecayActive = true;
  state.roundTimeLeft = 0;
  state.frenzyActive = false;
  state.frenzyTimeLeft = 0;
  state.teamA.shieldHp = 0;
  state.teamA.shieldTimer = 0;
  state.teamB.shieldHp = 0;
  state.teamB.shieldTimer = 0;
  state.teamA.empTimer = 0;
  state.teamB.empTimer = 0;
  endTakeovers();
  $('frenzyVignette').classList.remove('active');
  $('shieldBadgeA').classList.add('hidden');
  $('shieldBadgeB').classList.add('hidden');
  $('empBadgeA').classList.add('hidden');
  $('empBadgeB').classList.add('hidden');
  $('cardBaseA').classList.remove('emp-hit');
  $('cardBaseB').classList.remove('emp-hit');
  updateFrenzyGaugeUI();
  syncTimerPill();
  pushNotificationDock('⏳ COLAPSO DE TORRES', 'Combate detenido · las defensas pierden vida hasta que caiga una', '#ef4444', '', '', '⏳', 'FINAL', 4500);
  synth.duck(2400); synth.playSFX('sudden_horn');
}

function applyTowerDecay(): void {
  if (!state.roundActive || !state.towerDecayActive) return;
  const tiePriority = state.telemetry.roundCount % 2 === 0 ? 'A' : 'B';
  const winner = advanceTowerDecay(state.teamA, state.teamB, tiePriority);
  updateBaseHUD();
  updatePanicAlerts();
  if (winner) triggerVictory(winner, 'tower_decay');
}

let restartTimer: ReturnType<typeof setInterval> | null = null;
let victoryOverlayTimer: ReturnType<typeof setTimeout> | null = null;

function triggerVictory(
  winner: TeamId,
  finishReason: TimeoutDecisionReason | 'core' | 'sudden_death_tower' | 'tower_decay' = 'core'
): void {
  if (!state.roundActive) return;

  const weekly = getWeeklyEventForDate();
  nextBiomeOverride = null;
  const roundLog = finalizeRound(winner, {
    suddenDeath: state.suddenDeathActive || state.towerDecayActive,
    featured: weekly.isFeatured,
  });

  state.frenzyActive = false; state.suddenDeathActive = false; state.towerDecayActive = false;
  endTakeovers();
  $('frenzyVignette').classList.remove('active');
  $('suddenDeathVignette').classList.remove('active');
  $('notificationDock').classList.add('hidden');

  const winObj = winner === 'A' ? state.teamA : state.teamB;
  const loseObj = winner === 'A' ? state.teamB : state.teamA;
  winObj.wins++; winObj.streak++; loseObj.streak = 0;

  let nextChallenger: TeamPreset | null = null;
  if (state.tournamentMode && state.roster.length > 2 && state.worldCup.status !== 'in_progress') {
    for (let i = 0; i < state.roster.length; i++) {
      const c = state.roster[state.rosterCursor % state.roster.length];
      state.rosterCursor = (state.rosterCursor + 1) % state.roster.length;
      if (c.name !== winObj.name && c.name !== loseObj.name) {
        nextChallenger = c;
        break;
      }
    }
  }
  const cupWasActive = state.worldCup.status === 'in_progress';
  const nextWorldCupMatch = cupWasActive
    ? recordWorldCupWinner(state.worldCup, winObj.key)
    : null;
  const worldCupCompleted = cupWasActive && state.worldCup.status === 'completed';
  if (worldCupCompleted) {
    biomeVote.reset();
    $('vicBiomeVote').classList.add('hidden');
  } else {
    openBiomeVote(weekly.featuredBiomeId);
  }

  if (roundLog.mvp) checkSeasonPassUnlock(roundLog.mvp.user, roundLog.mvp.avatarUrl);
  savePersistentState();
  state.shake = 18; state.screenFlash = 0.65;
  sim.spawnVictoryConfetti(winner);
  synth.duck(3200); synth.playSFX('orbital_boom');
  synth.speak(`Victoria para ${winObj.name}`);
  setTimeout(() => synth.playSFX('victory'), 420);

  const topRound = roundLog.mvp
    ? { user: roundLog.mvp.user, avatarUrl: roundLog.mvp.avatarUrl, score: roundLog.mvp.score }
    : { user: '@Comandante', avatarUrl: '', score: 0 };

  const prevChamp = getPreviousSeasonChampion(state.seasonHistory);
  const kickerEl = document.getElementById('vicKicker');
  if (kickerEl) {
    kickerEl.textContent = prevChamp
      ? `TEMPORADA ${String(state.currentSeason.index).padStart(2, '0')} · CAMPEÓN ERA ${String(prevChamp.index).padStart(2, '0')}: ${prevChamp.championFlag || '🏆'} ${prevChamp.championName}`
      : `TACTICAL ARENA · TEMPORADA ${String(state.currentSeason.index).padStart(2, '0')}`;
  }

  const mvpRec = state.playerRecords[topRound.user];
  const mvpCosmetic = getCosmeticFrameFromBadges(mvpRec?.badges);
  const seasonPeak = mvpRec ? Math.max(topRound.score, mvpRec.peaks.maxRoundScore) : topRound.score;
  const exploration = getBiomeExplorationProgress(mvpRec?.badges);

  $('vicFlag').innerHTML = renderTeamFlagHtml(winObj.key, winObj.flag, 'hero');
  $('vicName').textContent = winObj.name;
  $('vicName').style.color = winObj.color;
  const crownScoreA = getCrownScore(state.teamA);
  const crownScoreB = getCrownScore(state.teamB);
  const towerHealthA = Math.round(getDefenseHealthPercent(state.teamA));
  const towerHealthB = Math.round(getDefenseHealthPercent(state.teamB));
  const decisionLabel = finishReason === 'crowns'
    ? ' · DECISIÓN POR CORONAS'
    : finishReason === 'sudden_death_tower'
      ? ' · TORRE CAÍDA EN MUERTE SÚBITA'
      : finishReason === 'tower_decay'
        ? ' · VICTORIA POR COLAPSO DE TORRES'
        : '';
  $('vicCrownScore').textContent =
    `👑 CORONAS ${crownScoreA} — ${crownScoreB} · VIDA ${towerHealthA}% — ${towerHealthB}%${decisionLabel}`;
  const vicAvatar = $('vicMvpAvatar') as HTMLImageElement;
  vicAvatar.src = getAvatar(topRound.avatarUrl, topRound.user).dataUrl;
  vicAvatar.style.borderColor = mvpCosmetic ? mvpCosmetic.ringColor : '#ffd77c';
  $('vicMvpUser').textContent = mvpCosmetic ? `${mvpCosmetic.emblem} ${topRound.user}` : topRound.user;
  $('vicMvpScore').textContent = `${topRound.score.toLocaleString()} pts · Récord S${String(state.currentSeason.index).padStart(2, '0')}: ${seasonPeak.toLocaleString()}`;
  $('vicNextGoal').textContent = exploration.complete
    ? '🧭 Marco Explorador desbloqueado'
    : `🧭 Próxima meta del MVP: ${exploration.visited}/${exploration.target} biomas · participa en otro`;
  $('vicStreakText').classList.toggle('hidden', !(state.tournamentMode && winObj.streak >= 1));
  $('vicStreakText').textContent = `🔥 ${winObj.streak} VICTORIA${winObj.streak > 1 ? 'S' : ''} EN EL TRONO`;
  const cupRoundNames = ['RONDA DE 64', 'RONDA DE 32', 'OCTAVOS', 'CUARTOS', 'SEMIFINAL', 'FINAL'];
  if (nextWorldCupMatch?.teamA && nextWorldCupMatch.teamB) {
    const roundIndex = state.worldCup.rounds.findIndex((round) => round.includes(nextWorldCupMatch));
    $('vicChallengerBanner').textContent =
      `🏆 ${cupRoundNames[roundIndex]} · SIGUIENTE: ${nextWorldCupMatch.teamA.name} vs ${nextWorldCupMatch.teamB.name}`;
    $('vicChallengerBanner').classList.remove('hidden');
  } else if (worldCupCompleted && state.worldCup.champion) {
    $('vicChallengerBanner').textContent = `🏆 CAMPEÓN DE LA COPA: ${state.worldCup.champion.name}`;
    $('vicChallengerBanner').classList.remove('hidden');
  } else {
    $('vicChallengerBanner').classList.toggle('hidden', !nextChallenger);
    if (nextChallenger) $('vicChallengerBanner').textContent = `⚔️ NUEVO RETADOR: ${nextChallenger.flag} ${nextChallenger.name}`;
  }
  settings.syncControlButtons();

  if (victoryOverlayTimer) clearTimeout(victoryOverlayTimer);
  if (restartTimer) clearInterval(restartTimer);
  victoryOverlayTimer = setTimeout(() => {
    const ov = $('victoryOverlay');
    ov.classList.remove('hidden', 'show');
    void ov.offsetWidth;
    ov.classList.add('show');
    victoryOverlayTimer = null;

    let sec = 20;
    $('vicCountdown').textContent = String(sec);
    restartTimer = setInterval(() => {
      sec--;
      $('vicCountdown').textContent = String(Math.max(0, sec));
      if (sec <= 0) {
        if (restartTimer) clearInterval(restartTimer);
        restartTimer = null;
        if (worldCupCompleted) {
          biomeVote.reset();
          const overlay = $('victoryOverlay');
          overlay.classList.remove('show');
          overlay.classList.add('hidden');
          return;
        }
        const selectedBiome = biomeVote.finish();
        if (selectedBiome) nextBiomeOverride = selectedBiome.id;
        if (nextWorldCupMatch?.teamA && nextWorldCupMatch.teamB) {
          state.teamA = makeBaseState(nextWorldCupMatch.teamA, true);
          state.teamB = makeBaseState(nextWorldCupMatch.teamB, false);
          state.viewerTeams.clear();
          applyTeamUI();
          savePersistentState();
        } else if (nextChallenger) {
          Object.assign(winner === 'A' ? state.teamB : state.teamA, nextChallenger, { wins: 0, streak: 0 });
          state.viewerTeams.clear();
          applyTeamUI();
          savePersistentState();
        }
        resetRound();
      }
    }, 1000);
  }, 650);
}

function resetRound(): void {
  if (restartTimer) clearInterval(restartTimer);
  if (victoryOverlayTimer) clearTimeout(victoryOverlayTimer);
  endTakeovers();
  impactLimiter.reset();

  const weekly = getWeeklyEventForDate();
  const selectedBiome = nextBiomeOverride ?? biomeVote.finish()?.id ?? biomeRotation.getOptions(weekly.featuredBiomeId)[0]?.id;
  if (!selectedBiome) throw new Error('No biome is available for the next round');
  nextBiomeOverride = null;
  biomeRotation.select(selectedBiome);
  state.biomeRotationRemaining = biomeRotation.getRemainingIds();
  biomeVote.reset();
  factionGoals.setTargetLikes(weekly.factionGoalLikes);
  factionGoals.resetRound();

  setActiveBiome(selectedBiome);
  beginRound(selectedBiome);

  [state.teamA, state.teamB].forEach((t) => {
    t.flash = 0;
    t.shieldHp = 0;
    t.shieldTimer = 0;
    t.empTimer = 0;
    t.panicActive = false;
  });
  state.teamA.sideDefenses = [makeSideDefenseState(true), makeSideDefenseState(true)];
  state.teamB.sideDefenses = [makeSideDefenseState(false), makeSideDefenseState(false)];
  state.meteorRainRemaining = 0;

  lastElixirHud.A.valText = ''; lastElixirHud.A.queueLen = -1;
  lastElixirHud.B.valText = ''; lastElixirHud.B.queueLen = -1;

  sim.clearEntities();
  elixir.resetRound();

  $('suddenDeathVignette').classList.remove('active');
  $('frenzyVignette').classList.remove('active');
  $('victoryOverlay').classList.remove('show');
  $('victoryOverlay').classList.add('hidden');
  $('vicBiomeVote').classList.add('hidden');
  applyTeamUI();
  updateBaseHUD();
  updateFactionHUD();
  updateFrenzyGaugeUI();
  syncTimerPill();
  announceActiveBiome();
  savePersistentState();
}

function resetSession(): void {
  state.teamA.wins = 0; state.teamA.streak = 0;
  state.teamB.wins = 0; state.teamB.streak = 0;

  personalProgress.resetSession();
  lastJoinAnnounceAt.clear();
  resetSessionState();

  logWsEvent('Sesión y telemetría reiniciadas.');
  renderTop3MVP();
  updateFactionHUD();
  renderTelemetry();
  resetRound();
}

function startNewTournament(): void {
  prepareNewTournament();
  nextBiomeOverride = null;
  resetRound();
  logWsEvent(`Nuevo torneo iniciado · ${state.teamA.name} vs ${state.teamB.name}`);
  savePersistentState();
}

function startWorldCup(): void {
  const openingMatch = prepareWorldCup();
  nextBiomeOverride = null;
  settings.renderRosterChips();
  applyTeamUI();
  resetRound();
  logWsEvent(`Copa Mundial iniciada · ${openingMatch.teamA?.name} vs ${openingMatch.teamB?.name}`);
  savePersistentState();
}

function applyTeamUI(): void {
  document.documentElement.style.setProperty('--team-a', state.teamA.color);
  document.documentElement.style.setProperty('--team-b', state.teamB.color);
  $('scoreFlagA').innerHTML = renderTeamFlagHtml(state.teamA.key, state.teamA.flag, 'inline');
  $('scoreFlagB').innerHTML = renderTeamFlagHtml(state.teamB.key, state.teamB.flag, 'inline');
  $('winsA').textContent = String(state.teamA.wins); $('winsB').textContent = String(state.teamB.wins);
  $('flagA').innerHTML = renderTeamFlagHtml(state.teamA.key, state.teamA.flag, 'inline');
  $('nameA').textContent = state.teamA.name; $('keyBadgeA').textContent = state.teamA.key;
  $('hpBarA').style.background = state.teamA.color; $('hpPctA').style.color = state.teamA.color;
  $('flagB').innerHTML = renderTeamFlagHtml(state.teamB.key, state.teamB.flag, 'inline');
  $('nameB').textContent = state.teamB.name; $('keyBadgeB').textContent = state.teamB.key;
  $('hpBarB').style.background = state.teamB.color; $('hpPctB').style.color = state.teamB.color;

  const streakBadgeA = $('streakBadgeA');
  streakBadgeA.classList.toggle('hidden', !(state.tournamentMode && state.teamA.streak >= 1));
  streakBadgeA.setAttribute('aria-label', `Racha de victorias: ${state.teamA.streak}`);
  $('streakCountA').textContent = String(state.teamA.streak);
  const streakBadgeB = $('streakBadgeB');
  streakBadgeB.classList.toggle('hidden', !(state.tournamentMode && state.teamB.streak >= 1));
  streakBadgeB.setAttribute('aria-label', `Racha de victorias: ${state.teamB.streak}`);
  $('streakCountB').textContent = String(state.teamB.streak);

  renderGiftLegend();
  renderTop3MVP();
  updateFactionHUD();
  updateOnboardingTicker();
  settings.syncControlButtons();
  requestAnimationFrame(() => sim.updateGeometry());
}

// Helpers de simulación manual
const manualTestGift = (team: TeamId, tier: number) => {
  const slot = tier === 1 ? (team === 'A' ? state.giftSlots[0] : state.giftSlots[1]) : state.giftSlots.find((s) => s.tier === tier);
  bus.emit('game:gift', {
    team, tier, delta: 1, user: `@Cmd_${team}`,
    giftName: slot?.display || 'Regalo', avatarUrl: '', coins: slot?.coins || 1, isDemo: true,
  });
};
const simulateTap = (team: TeamId) => {
  bus.emit('game:tap', {
    user: team === 'A' ? '@TapNorte' : '@TapSur',
    count: state.personalTapThreshold, avatarUrl: '', forcedTeam: team, isDemo: true,
  });
};
const simulateFollow = () => bus.emit('game:follow', { user: '@FanDemo', avatarUrl: '', isDemo: true });
const simulateShare = () => bus.emit('game:share', { user: '@ShareDemo', avatarUrl: '', isDemo: true });
const triggerMeteorShower = (reason = 'Manual') => bus.emit('action:instant', { team: 'A', kind: 'METEOR_SHOWER', user: reason, avatarUrl: '' });

const w = window as unknown as Record<string, unknown>;
w.manualTestGift = manualTestGift;
w.activateFrenzy = activateFrenzy;
w.triggerVictory = triggerVictory;
w.simulateFollowEvent = simulateFollow;
w.simulateShareEvent = simulateShare;
w.triggerMeteorShower = triggerMeteorShower;

const settings = new SettingsPanel({
  synth,
  tikfinity,
  applyTeamUI,
  renderGiftLegend,
  updatePanicAlerts,
  updateFrenzyGaugeUI,
  activateSuddenDeath,
  resetRound,
  resetSession,
  startNewTournament,
  startWorldCup,
  simulateTap,
  externalObservability,
});

initInputShortcuts({
  closeModals: () => settings.closeAllModals(),
  togglePanel: () => settings.togglePanel(),
  toggleTelemetry: () => settings.toggleTelemetry(),
  toggleLeague: () => settings.toggleLeague(),
  toggleSafeZones: () => settings.toggleSafeZones(),
  toggleDemoMode: () => settings.toggleDemoMode(),
  activateSuddenDeath,
  activateFrenzy,
  triggerMeteorShower: () => triggerMeteorShower('Manual'),
  simulateFollow,
  simulateShare,
  simulateTap,
  manualTestGift,
});

let previousWsStatus: 'connected' | 'reconnecting' | 'offline' | null = null;
bus.on('tikfinity:status', ({ status, detail }) => {
  if (status === 'reconnecting' && previousWsStatus === 'connected') {
    state.telemetry.websocketDisconnectCount += 1;
  }
  previousWsStatus = status;
  if (status === 'connected') {
    $('wsTopDot').style.background = '#34D399'; $('wsTopText').textContent = 'TikFinity ON';
    $('wsStatus').textContent = 'Conectado'; $('btnWsConnect').textContent = 'Desconectar';
    if (state.demoMode) { state.demoMode = false; settings.syncControlButtons(); }
  } else if (status === 'reconnecting') {
    $('wsTopDot').style.background = '#FBBF24'; $('wsTopText').textContent = detail || 'Reconectando';
    $('wsStatus').textContent = detail || 'Reconectando...'; $('btnWsConnect').textContent = 'Detener';
  } else {
    $('wsTopDot').style.background = '#64748B'; $('wsTopText').textContent = 'Offline';
    $('wsStatus').textContent = 'Offline'; $('btnWsConnect').textContent = 'Conectar';
  }
});

// Arranque
window.addEventListener('pointerdown', () => synth.unlock(), { passive: true });
loadPersistentState();
if (state.worldCup.status === 'completed') state.roundActive = false;
biomeRotation.restore(state.currentRoundBiome, state.biomeRotationRemaining);
state.biomeRotationRemaining = biomeRotation.getRemainingIds();
setActiveBiome(state.currentRoundBiome);
externalObservability.start();
resetIfNeeded();
const initialWeekly = getWeeklyEventForDate();
factionGoals.setTargetLikes(initialWeekly.factionGoalLikes);
settings.renderRosterChips();
settings.renderGiftMapperTable();
applyTeamUI();
updateBaseHUD();
updateFactionHUD();
syncTimerPill();
elixir.resetRound();
synth.init();
synth.applyMusicMode();
announceActiveBiome();
savePersistentState();
logWsEvent(`Tactical Arena V3.2.0 listo · ${initialWeekly.title}.`);
void registerOfflineCache();
installErrorMonitoring();
installBrowserLifecycle({
  onOffline: () => {
    $('wsTopText').textContent = 'Sin conexión';
    pushNotificationDock('Sin conexión', 'El juego continúa en modo local', '#F59E0B', '', '', '📡', 'OFFLINE', 3000);
  },
  onOnline: () => {
    $('wsTopText').textContent = tikfinity.isEnabled ? 'Reconectando' : 'Online';
    pushNotificationDock('Conexión restaurada', 'La aplicación volvió a estar online', '#34D399', '', '', '🌐', 'ONLINE', 2400);
  },
});
const arenaRuntime = new ArenaRuntime({
  elixir,
  simulation: sim,
  activateSuddenDeath,
  activateTowerDecay,
  applyTowerDecay,
  updateFrenzyGaugeUI,
  syncTimerPill,
});
arenaRuntime.start();