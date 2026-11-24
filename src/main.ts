import './style.css';
import { bus, TeamId } from './core/EventBus';
import {
  loadPersistentState, makeSideDefenseState, MAX_BASE_HP, METEOR_COIN_STEP,
  saveNow, savePersistentState, state, TeamPreset,
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
import { cycleNextBiome, getActiveBiome, getBiomeProgressText } from './config/biomes';
import { renderTeamFlagHtml } from './ui/FlagRenderer';

const $ = (id: string) => document.getElementById(id)!;
const synth = new SynthEngine();
const elixir = new ElixirSystem();
const tikfinity = new TikFinityClient();

const sim = new Simulation(
  $('arenaCanvas') as HTMLCanvasElement,
  $('stageFrame'),
  $('stage'),
  $('cardBaseA'),
  $('cardBaseB'),
  synth,
  () => { updateBaseHUD(); updatePanicAlerts(); },
  (winner) => triggerVictory(winner)
);

// =========================================================================
// HUD DE COMBATE, ELIXIR (CON DEDUPLICACIÓN DOM) Y NOTIFICATION DOCK ÚNICO
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
  const lbl = document.getElementById(`elixirVal${team}`);
  const qLbl = document.getElementById(`queueVal${team}`);
  if (fill) fill.style.width = `${Math.min(100, (val / maxElixir) * 100)}%`;
  if (lbl) lbl.textContent = `⚡${valText}`;
  if (qLbl) {
    qLbl.textContent = `⏳${queueLength}`;
    qLbl.classList.toggle('hidden', queueLength === 0);
  }
});

bus.on('elixir:deploy', (order) => sim.deployOrder(order));

function updateBaseHUD(): void {
  const rA = (state.teamA.hp / MAX_BASE_HP) * 100;
  const rB = (state.teamB.hp / MAX_BASE_HP) * 100;
  $('hpTextA').textContent = String(Math.ceil(state.teamA.hp));
  $('hpTextB').textContent = String(Math.ceil(state.teamB.hp));
  $('hpPctA').textContent = `${Math.ceil(rA)}%`;
  $('hpPctB').textContent = `${Math.ceil(rB)}%`;
  $('hpBarA').style.width = `${rA}%`; $('hpTrailA').style.width = `${rA}%`;
  $('hpBarB').style.width = `${rB}%`; $('hpTrailB').style.width = `${rB}%`;
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
  if (state.suddenDeathActive) {
    pill.classList.remove('frenzy');
    pill.classList.add('sudden');
    $('timerIcon').textContent = '💀';
    $('timerText').textContent = 'x3⚡';
  } else if (state.frenzyActive) {
    pill.classList.remove('sudden');
    pill.classList.add('frenzy');
    $('timerIcon').textContent = '⚡';
    $('timerText').textContent = `x2 · ${state.frenzyTimeLeft}s`;
  } else {
    pill.classList.remove('sudden', 'frenzy');
    $('timerIcon').textContent = '⏱️';
    $('timerText').textContent = `${String(Math.floor(state.roundTimeLeft / 60)).padStart(2, '0')}:${String(state.roundTimeLeft % 60).padStart(2, '0')}`;
  }
}

let tickerIdx = 0;
function updateOnboardingTicker(): void {
  const msgs = [
    `1. Escribe ${state.teamA.key} o ${state.teamB.key} en chat para elegir bando`,
    `2. ❤️ ${state.personalTapThreshold} Tap Taps = +⚡ Elixir • ${state.frenzyGoalLikes} = Frenesí x2`,
    `3. Derriba 1 torre lateral para exponer la base central`,
    `4. ⚡ EMP frena elixir rival • 👾 Hack roba 3 tropas`,
  ];
  $('onboardingTicker').textContent = msgs[tickerIdx % msgs.length];
  tickerIdx++;
}
setInterval(updateOnboardingTicker, 4000);

let dockTimer: ReturnType<typeof setTimeout> | null = null;
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
  const dock = $('notificationDock');
  dock.style.setProperty('--notification-accent', color);
  dock.style.setProperty('--notification-duration', `${durationMs}ms`);
  $('notificationTitle').textContent = title;
  $('notificationSub').textContent = sub;
  $('notificationTag').textContent = tag;
  const img = $('notificationAvatar') as HTMLImageElement;
  const gly = $('notificationGlyph');
  if (user) {
    img.src = getAvatar(avatarUrl, user).dataUrl;
    img.classList.remove('hidden');
    gly.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    gly.textContent = glyph;
    gly.classList.remove('hidden');
  }
  dock.classList.remove('hidden', 'dock-progress-run');
  void dock.offsetWidth;
  dock.classList.add('dock-progress-run');
  if (dockTimer) clearTimeout(dockTimer);
  dockTimer = setTimeout(() => dock.classList.add('hidden'), durationMs);
}

function announceActiveBiome(): void {
  const b = getActiveBiome();
  pushNotificationDock(b.name, `Escenario ${getBiomeProgressText()}`, b.accent, '', '', b.icon, 'MAPA', 3000);
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
    pushNotificationDock(`🚨 ${state.teamA.name} EN PELIGRO`, `Envía ${shieldSlot.display} → +15% HP`, '#ef4444', '', '', '🚨', 'SOS');
  } else if (!aLow) {
    state.teamA.panicActive = false;
  }

  if (bLow && !state.teamB.panicActive) {
    state.teamB.panicActive = true;
    synth.playSFX('panic');
    pushNotificationDock(`🚨 ${state.teamB.name} EN PELIGRO`, `Envía ${shieldSlot.display} → +15% HP`, '#ef4444', '', '', '🚨', 'SOS');
  } else if (!bLow) {
    state.teamB.panicActive = false;
  }

  $('cardBaseA').classList.toggle('panic', aLow);
  $('cardBaseB').classList.toggle('panic', bLow);
}

let top3Timer: ReturnType<typeof setTimeout> | null = null;
function addMVPPoints(user: string, team: TeamId, avatarUrl: string, points: number, isDemo = false): void {
  const clean = user.startsWith('@') ? user : `@${user}`;
  const buckets = isDemo ? [state.roundMVP] : [state.sessionMVP, state.roundMVP];
  buckets.forEach((b) => {
    if (!b[clean]) b[clean] = { user: clean, team, avatarUrl: avatarUrl || '', score: 0 };
    b[clean].score += points; b[clean].team = team;
    if (avatarUrl) b[clean].avatarUrl = avatarUrl;
  });
  if (!top3Timer) top3Timer = setTimeout(() => { top3Timer = null; renderTop3MVP(); }, 400);
  if (!isDemo) savePersistentState();
}

function renderTop3MVP(): void {
  const src = Object.keys(state.sessionMVP).length ? state.sessionMVP : state.roundMVP;
  const top = Object.values(src).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top.length) { $('mvpStrip').innerHTML = `<div style="font-size:8.5px;color:#94A3B8;padding:0 4px;">👑 Top 3 MVP</div>`; return; }
  const medals = ['👑', '🥈', '🥉'], rings = ['#FBBF24', '#CBD5E1', '#D97706'];
  $('mvpStrip').innerHTML = top.map((m, idx) => {
    const av = getAvatar(m.avatarUrl, m.user);
    const tCol = m.team === 'A' ? state.teamA.color : state.teamB.color;
    const pts = m.score >= 1000 ? `${(m.score / 1000).toFixed(1)}k` : String(m.score);
    return `<div class="mvp-item">
      <div style="position:relative;flex-shrink:0;">
        <img src="${av.dataUrl}" alt="" style="width:16px;height:16px;border-radius:50%;object-fit:cover;border:1.5px solid ${rings[idx]};display:block;" />
        <span style="position:absolute;top:-5px;left:-4px;font-size:7px;line-height:1;">${medals[idx]}</span>
      </div>
      <div style="min-width:0;line-height:1.1;">
        <div style="font-size:8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:2px;">
          <span style="width:5px;height:5px;border-radius:50%;background:${tCol};flex-shrink:0;"></span>
          <span>${escapeHtml(m.user.replace('@', '').slice(0, 6))}</span>
        </div>
        <div class="tabular" style="font-size:7px;color:#94A3B8;">${pts}</div>
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
  if (!job || !state.roundActive) { endTakeovers(); return; }
  const enemyObj = job.team === 'A' ? state.teamB : state.teamA;
  state.takeoverActive = true; state.timeScale = 0.25;
  synth.duck(3500); synth.playSFX('nuclear_siren');
  synth.speak(`${job.clean.replace('@', '')} lanzó ataque nuclear contra ${enemyObj.name}`);
  ($('tkAvatar') as HTMLImageElement).src = getAvatar(job.avatarUrl, job.clean).dataUrl;
  $('tkUser').textContent = job.clean;
  $('tkSub').textContent = `${job.giftName.toUpperCase()} • OBJETIVO: ${enemyObj.name}`;
  $('whaleTakeover').classList.remove('hidden');

  takeoverTimer = setTimeout(() => {
    if (state.roundActive) {
      sim.spawnOrbital(job.team, job.clean, job.avatarUrl);
      elixir.addElixir(job.team, state.frenzyActive ? 5 : 3);
    }
    if (takeoverQueue.length && state.roundActive) runNextTakeover();
    else endTakeovers();
  }, 2600);
}

bus.on('action:instant', ({ team, kind, user, avatarUrl, giftName, mult = 1 }) => {
  if (!state.roundActive) return;
  if (kind === 'SHIELD') {
    const base = team === 'A' ? state.teamA : state.teamB;
    const heal = Math.round(MAX_BASE_HP * 0.15 * mult);
    base.hp = Math.min(MAX_BASE_HP, base.hp + heal);
    base.shieldHp = 550 * mult; base.shieldTimer = 12; base.shieldOwner = user; base.shieldAvatar = avatarUrl;
    synth.duck(2000); synth.playSFX('shield');
    sim.pushShockwave(sim.safeCenterX, team === 'A' ? sim.baseAY : sim.baseBY, 72, '#22D3EE', 3);
    sim.pushBadge(sim.safeCenterX, (team === 'A' ? sim.baseAY : sim.baseBY) + (team === 'A' ? 24 : -24), `+${heal} HP 🛡️`, '#67E8F9');
    showCenterBanner('🛡️ ESCUDO + REPARACIÓN', `${user} curó +${heal} HP a ${base.name}`, '#22D3EE', avatarUrl, user);
    updateBaseHUD(); updatePanicAlerts();
  } else if (kind === 'EMP') {
    const enemyTeam: TeamId = team === 'A' ? 'B' : 'A';
    const enemyBase = enemyTeam === 'A' ? state.teamA : state.teamB;
    const dur = state.frenzyActive ? 14 : 10;
    enemyBase.empTimer = Math.min(18, enemyBase.empTimer + dur);
    sim.applyEmpToUnits(enemyTeam, dur);
    elixir.applyEmpSlow(enemyTeam, 6);
    synth.duck(2400); synth.playSFX('emp'); state.shake = Math.max(state.shake, 7);
    showCenterBanner(`⚡ PULSO EMP (${enemyBase.empTimer}s)`, `${user} apagó torretas de ${enemyBase.name}`, '#22D3EE', avatarUrl, user);
  } else if (kind === 'CYBER_HACK') {
    const maxSteal = state.frenzyActive ? 4 : 3;
    const stolen = sim.applyCyberHack(team, user, avatarUrl, maxSteal);
    const missing = Math.max(0, maxSteal - stolen);
    if (missing > 0) elixir.addElixir(team, missing * 2);
    synth.duck(2400); synth.playSFX('hack');
    const detail = missing > 0 ? `robó ${stolen} y recuperó +${missing * 2}⚡` : `robó ${stolen} unidades enemigas`;
    showCenterBanner('👾 CYBER HACK', `${user} ${detail}`, '#C084FC', avatarUrl, user);
  } else if (kind === 'NUCLEAR') {
    const clean = user.startsWith('@') ? user : `@${user}`;
    takeoverQueue.push({ team, clean, avatarUrl, giftName: giftName || 'Nuclear' });
    if (!state.takeoverActive) runNextTakeover();
  } else if (kind === 'METEOR_SHOWER') {
    state.meteorRainRemaining += 9;
    synth.duck(3000); synth.playSFX('sudden_horn');
    showCenterBanner('☄️ LLUVIA DE METEORITOS', `${user} • Impactos orbitales en zona central`, '#FB923C');
  }
});

bus.on('game:chat', ({ user, comment }) => registerChatAlignment(user, comment));

bus.on('game:tap', ({ user, count, avatarUrl, forcedTeam, isDemo = false }) => {
  if (!state.roundActive) return;
  if (!isDemo) { state.lastRealInteractionAt = Date.now(); state.telemetry.totalTaps += count; }
  const clean = (user || 'Viewer').startsWith('@') ? user : `@${user || 'Viewer'}`;
  let team = forcedTeam || state.viewerTeams.get(clean) || null;
  if (!team && state.unalignedTapSupportsUnderdog) team = state.teamA.hp <= state.teamB.hp ? 'A' : 'B';

  if (team) {
    let likes = (state.viewerLikes.get(clean) || 0) + count;
    let guard = 0;
    while (likes >= state.personalTapThreshold && guard++ < 4) {
      likes -= state.personalTapThreshold;
      elixir.addElixir(team, 0.6);
      elixir.enqueueOrder({ team, kind: 'INFANTRY', priority: 2, user: clean, avatarUrl, isTapBadge: true });
      addMVPPoints(clean, team, avatarUrl, 15, isDemo);
      synth.playSFX('tap');
    }
    state.viewerLikes.set(clean, Math.min(likes, state.personalTapThreshold * 2));
  }
  if (!state.frenzyActive) {
    state.globalTapCount += count;
    if (state.globalTapCount >= state.frenzyGoalLikes) { activateFrenzy(); return; }
  }
  updateFrenzyGaugeUI();
});

bus.on('game:follow', ({ user, avatarUrl, isDemo = false }) => {
  if (!state.roundActive) return;
  if (!isDemo) { state.lastRealInteractionAt = Date.now(); state.telemetry.totalFollows++; }
  const clean = user.startsWith('@') ? user : `@${user}`;
  const team = resolveUserTeam(clean);
  elixir.addElixir(team, 0.8);
  elixir.enqueueOrder({ team, kind: 'INFANTRY', priority: 2, user: clean, avatarUrl });
  addMVPPoints(clean, team, avatarUrl, 20, isDemo);
  showLastCommander(clean, avatarUrl, `¡siguió! → +⚡ y Soldados`, '#34D399');
  synth.playSFX('follow');
});

bus.on('game:share', ({ user, avatarUrl, isDemo = false }) => {
  if (!state.roundActive) return;
  if (!isDemo) { state.lastRealInteractionAt = Date.now(); state.telemetry.totalShares++; }
  const clean = user.startsWith('@') ? user : `@${user}`;
  const team = resolveUserTeam(clean);
  elixir.addElixir(team, 1.5);
  elixir.enqueueOrder({ team, kind: 'JET', priority: 2, user: clean, avatarUrl });
  addMVPPoints(clean, team, avatarUrl, 50, isDemo);
  showCenterBanner('✈️ ATAQUE POR COMPARTIR', `${clean} → Jet en cola para ${(team === 'A' ? state.teamA : state.teamB).name}`, '#38BDF8', avatarUrl, clean);
});

bus.on('game:gift', ({ team, tier, delta, user, giftName, avatarUrl, coins, isDemo = false }) => {
  if (!state.roundActive || delta <= 0) return;
  if (!isDemo) { state.lastRealInteractionAt = Date.now(); recordTelemetryGift(giftName, delta, coins || 1); }
  const clean = user.startsWith('@') ? user : `@${user}`;
  state.viewerTeams.set(clean, team);
  addMVPPoints(clean, team, avatarUrl, Math.max(10, (coins || 1) * 10) * delta, isDemo);

  const tObj = team === 'A' ? state.teamA : state.teamB;
  showLastCommander(clean, avatarUrl, `${delta > 1 ? `x${delta} ` : ''}${giftName}${state.frenzyActive ? ' ⚡x2' : ''}`, tObj.color);

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
// RELOJ, FRENESÍ, MUERTE SÚBITA, CINEMÁTICA DE VICTORIA 10s Y RESET
// =========================================================================
function activateFrenzy(): void {
  if (!state.roundActive) return;
  state.frenzyActive = true; state.frenzyTimeLeft = 20; state.globalTapCount = 0;
  $('frenzyVignette').classList.add('active');
  updateFrenzyGaugeUI();
  syncTimerPill();
  pushNotificationDock('⚡ FRENESÍ x2 ACTIVO', 'Elixir doble durante 20 segundos', '#FBBF24', '', '', '⚡', 'BOOST', 3000);
  synth.duck(2400); synth.playSFX('frenzy');
  elixir.addElixir('A', 2.5); elixir.addElixir('B', 2.5);
}

function activateSuddenDeath(): void {
  if (!state.roundActive || state.suddenDeathActive) return;
  state.suddenDeathActive = true; state.roundTimeLeft = 0;
  $('suddenDeathVignette').classList.add('active');
  syncTimerPill();
  pushNotificationDock('💀 MUERTE SÚBITA', 'Elixir x3 • Daño x2 • BPM +18%', '#ef4444', '', '', '💀', 'FINAL', 3200);
  synth.duck(2400); synth.playSFX('sudden_horn');
}

let restartTimer: ReturnType<typeof setInterval> | null = null;
let victoryOverlayTimer: ReturnType<typeof setTimeout> | null = null;

function triggerVictory(winner: TeamId): void {
  if (!state.roundActive) return;
  state.roundActive = false; state.frenzyActive = false; state.suddenDeathActive = false;
  endTakeovers();
  $('frenzyVignette').classList.remove('active'); $('suddenDeathVignette').classList.remove('active');
  $('notificationDock').classList.add('hidden');

  const winObj = winner === 'A' ? state.teamA : state.teamB;
  const loseObj = winner === 'A' ? state.teamB : state.teamA;
  winObj.wins++; winObj.streak++; loseObj.streak = 0;

  let nextChallenger: TeamPreset | null = null;
  if (state.tournamentMode && state.roster.length > 2) {
    for (let i = 0; i < state.roster.length; i++) {
      const c = state.roster[state.rosterCursor % state.roster.length];
      state.rosterCursor = (state.rosterCursor + 1) % state.roster.length;
      if (c.name !== winObj.name && c.name !== loseObj.name) {
        nextChallenger = c;
        break;
      }
    }
  }

  savePersistentState();
  state.shake = 18; state.screenFlash = 0.65;
  sim.spawnVictoryConfetti(winner);
  synth.duck(3200); synth.playSFX('orbital_boom');
  synth.speak(`Victoria para ${winObj.name}`);
  setTimeout(() => synth.playSFX('victory'), 420);

  const topRound = Object.values(state.roundMVP).sort((a, b) => b.score - a.score)[0] || { user: '@Comandante', avatarUrl: '', score: 0 };
  $('vicFlag').innerHTML = renderTeamFlagHtml(winObj.key, winObj.flag, 'hero');
  $('vicName').textContent = winObj.name;
  $('vicName').style.color = winObj.color;
  ($('vicMvpAvatar') as HTMLImageElement).src = getAvatar(topRound.avatarUrl, topRound.user).dataUrl;
  $('vicMvpUser').textContent = topRound.user;
  $('vicMvpScore').textContent = `${topRound.score.toLocaleString()} pts`;
  $('vicStreakText').classList.toggle('hidden', !(state.tournamentMode && winObj.streak >= 1));
  $('vicStreakText').textContent = `🔥 ${winObj.streak} VICTORIA${winObj.streak > 1 ? 'S' : ''} EN EL TRONO`;
  $('vicChallengerBanner').classList.toggle('hidden', !nextChallenger);
  if (nextChallenger) $('vicChallengerBanner').textContent = `⚔️ NUEVO RETADOR: ${nextChallenger.flag} ${nextChallenger.name}`;

  if (victoryOverlayTimer) clearTimeout(victoryOverlayTimer);
  victoryOverlayTimer = setTimeout(() => {
    const ov = $('victoryOverlay');
    ov.classList.remove('hidden', 'show');
    void ov.offsetWidth;
    ov.classList.add('show');
  }, 650);

  let sec = 10;
  $('vicCountdown').textContent = String(sec);
  if (restartTimer) clearInterval(restartTimer);
  restartTimer = setInterval(() => {
    sec--;
    $('vicCountdown').textContent = String(Math.max(0, sec));
    if (sec <= 0) {
      if (restartTimer) clearInterval(restartTimer);
      if (nextChallenger) {
        Object.assign(winner === 'A' ? state.teamB : state.teamA, nextChallenger, { wins: 0, streak: 0 });
        state.viewerTeams.clear();
        applyTeamUI(); savePersistentState();
      }
      resetRound();
    }
  }, 1000);
}

function resetRound(): void {
  if (restartTimer) clearInterval(restartTimer);
  if (victoryOverlayTimer) clearTimeout(victoryOverlayTimer);
  endTakeovers();
  [state.teamA, state.teamB].forEach((t) => {
    t.hp = MAX_BASE_HP; t.flash = 0; t.shieldHp = 0; t.shieldTimer = 0; t.empTimer = 0; t.panicActive = false;
  });
  state.teamA.sideDefenses = [makeSideDefenseState(true), makeSideDefenseState(true)];
  state.teamB.sideDefenses = [makeSideDefenseState(false), makeSideDefenseState(false)];

  state.roundActive = true; state.roundTimeLeft = state.suddenDeathDurationSec;
  state.suddenDeathActive = false; state.frenzyActive = false; state.frenzyTimeLeft = 0;
  state.globalTapCount = 0; state.roundMVP = {}; state.meteorRainRemaining = 0;

  lastElixirHud.A.valText = ''; lastElixirHud.A.queueLen = -1;
  lastElixirHud.B.valText = ''; lastElixirHud.B.queueLen = -1;
  clockAccumSec = 0;
  demoAccumSec = 0;

  sim.clearEntities();
  elixir.resetRound();
  cycleNextBiome();

  $('suddenDeathVignette').classList.remove('active'); $('frenzyVignette').classList.remove('active');
  $('victoryOverlay').classList.remove('show'); $('victoryOverlay').classList.add('hidden');
  applyTeamUI(); updateBaseHUD(); updateFrenzyGaugeUI(); syncTimerPill();
  announceActiveBiome();
}

function resetSession(): void {
  state.teamA.wins = 0; state.teamA.streak = 0;
  state.teamB.wins = 0; state.teamB.streak = 0;
  state.sessionMVP = {};
  state.viewerTeams.clear();
  state.viewerLikes.clear();
  state.nextMeteorCoinTarget = METEOR_COIN_STEP;
  state.telemetry = {
    sessionStart: Date.now(),
    totalCoins: 0, totalGifts: 0, totalTaps: 0, totalFollows: 0, totalShares: 0,
    giftBreakdown: {}, wsLog: [],
  };
  logWsEvent('Sesión y telemetría reiniciadas.');
  renderTop3MVP();
  renderTelemetry();
  savePersistentState();
  resetRound();
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

  $('streakBadgeA').classList.toggle('hidden', !(state.tournamentMode && state.teamA.streak >= 1));
  $('streakBadgeA').textContent = `🔥 ${state.teamA.streak}`;
  $('streakBadgeB').classList.toggle('hidden', !(state.tournamentMode && state.teamB.streak >= 1));
  $('streakBadgeB').textContent = `🔥 ${state.teamB.streak}`;

  renderGiftLegend();
  renderTop3MVP();
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
  simulateTap,
});

initInputShortcuts({
  togglePanel: () => settings.togglePanel(),
  toggleTelemetry: () => settings.toggleTelemetry(),
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

bus.on('tikfinity:status', ({ status, detail }) => {
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

// =========================================================================
// TICK DE 1s Y MODO DEMO SINCRONIZADOS CON EL LOOP (ESTABILIDAD 24/7 OBS)
// =========================================================================
const REAL_INTERACTION_GRACE_MS = 12000;
const DEMO_USERS: { user: string; team: TeamId }[] = [
  { user: '@CarlosMX', team: 'A' }, { user: '@Sofia_99', team: 'A' },
  { user: '@MateoAR', team: 'B' }, { user: '@KiraLive', team: 'B' },
];

function tickOneSecond(): void {
  if (state.telemetryOpen) renderTelemetry();
  if (!state.roundActive) return;

  if (!state.suddenDeathActive) {
    state.roundTimeLeft = Math.max(0, state.roundTimeLeft - 1);
    if (state.roundTimeLeft === 0) activateSuddenDeath();
  }
  if (state.frenzyActive) {
    state.frenzyTimeLeft = Math.max(0, state.frenzyTimeLeft - 1);
    if (state.frenzyTimeLeft === 0) {
      state.frenzyActive = false;
      $('frenzyVignette').classList.remove('active');
    }
    updateFrenzyGaugeUI();
  }
  syncTimerPill();

  (['A', 'B'] as TeamId[]).forEach((t) => {
    const b = t === 'A' ? state.teamA : state.teamB;
    const sBadge = $(`shieldBadge${t}`), eBadge = $(`empBadge${t}`), card = $(`cardBase${t}`);
    if (b.shieldTimer > 0 && b.shieldHp > 0) { b.shieldTimer--; sBadge.textContent = `🛡️ ${b.shieldTimer}s`; sBadge.classList.remove('hidden'); }
    else { b.shieldHp = 0; sBadge.classList.add('hidden'); }
    if (b.empTimer > 0) { b.empTimer--; eBadge.textContent = `⚡ EMP ${b.empTimer}s`; eBadge.classList.remove('hidden'); card.classList.add('emp-hit'); }
    else { eBadge.classList.add('hidden'); card.classList.remove('emp-hit'); }
  });
}

function tickDemoStep(): void {
  if (!state.roundActive || !state.demoMode || state.takeoverActive) return;
  if (Date.now() - state.lastRealInteractionAt < REAL_INTERACTION_GRACE_MS) return;

  const v = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
  const r = Math.random();
  if (r < 0.35) bus.emit('game:tap', { user: v.user, count: 15, avatarUrl: '', forcedTeam: v.team, isDemo: true });
  else if (r < 0.65) bus.emit('game:gift', { team: v.team, tier: 1, delta: 2, user: v.user, giftName: 'Rose', avatarUrl: '', coins: 1, isDemo: true });
  else if (r < 0.80) bus.emit('game:gift', { team: v.team, tier: 2, delta: 1, user: v.user, giftName: 'Dona', avatarUrl: '', coins: 30, isDemo: true });
  else if (r < 0.90) bus.emit('game:gift', { team: v.team, tier: 3, delta: 1, user: v.user, giftName: 'Perfume', avatarUrl: '', coins: 20, isDemo: true });
  else if (r < 0.95) bus.emit('game:gift', { team: v.team, tier: 6, delta: 1, user: v.user, giftName: 'EMP', avatarUrl: '', coins: 100, isDemo: true });
  else bus.emit('game:gift', { team: v.team, tier: 7, delta: 1, user: v.user, giftName: 'Hack', avatarUrl: '', coins: 99, isDemo: true });
}

// Game Loop 60 FPS determinista
let lastTime = performance.now();
let clockAccumSec = 0;
let demoAccumSec = 0;

function loop(now: number): void {
  const dtSec = Math.min(0.05, Math.max(0.008, (now - lastTime) / 1000));
  lastTime = now;

  clockAccumSec += dtSec;
  if (clockAccumSec >= 1) {
    clockAccumSec -= 1;
    tickOneSecond();
  }

  demoAccumSec += dtSec;
  if (demoAccumSec >= 1.1) {
    demoAccumSec -= 1.1;
    tickDemoStep();
  }

  elixir.update(dtSec, {
    roundActive: state.roundActive,
    roundTimeLeft: state.roundTimeLeft,
    suddenDeathActive: state.suddenDeathActive,
    frenzyActive: state.frenzyActive,
    timeScale: state.timeScale,
    aiDirectorEnabled: state.aiDirectorEnabled,
    unitCountByTeam: (t) => sim.getUnitCount(t),
    jetCountByTeam: (t) => sim.getJetCount(t),
  });
  sim.update(dtSec * 60);
  sim.render();
  requestAnimationFrame(loop);
}

// Arranque
window.addEventListener('pointerdown', () => synth.unlock(), { passive: true });
window.addEventListener('beforeunload', saveNow);
loadPersistentState();
settings.renderRosterChips();
settings.renderGiftMapperTable();
applyTeamUI();
updateBaseHUD();
syncTimerPill();
elixir.resetRound();
synth.init();
synth.applyMusicMode();
announceActiveBiome();
logWsEvent('Tactical Arena V2.3 listo.');
requestAnimationFrame(loop);