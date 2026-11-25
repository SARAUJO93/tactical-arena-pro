import { TeamId } from '../core/EventBus';
import {
  LIGAMX_ROSTER, makeBaseState, savePersistentState, state, TeamPreset, WORLD_ROSTER,
  getStandings, getTopPlayers, getTopGifters, getRecentRounds,
  exportPersistentState, importPersistentState,
  listPersistenceSnapshots, restorePersistenceSnapshot,
} from '../core/GameState';
import { SynthEngine } from '../audio/SynthEngine';
import { TikFinityClient } from '../network/TikFinityClient';
import { downloadFile, renderTelemetry } from '../systems/Telemetry';
import { escapeHtml, hexToRgba } from '../utils/helpers';
import { getAvatar } from '../systems/AvatarCache';
import { ExternalObservability, sanitizeExternalEndpoint } from '../monitoring/ExternalObservability';

export interface SettingsPanelDeps {
  synth: SynthEngine;
  tikfinity: TikFinityClient;
  applyTeamUI: () => void;
  renderGiftLegend: () => void;
  updatePanicAlerts: () => void;
  updateFrenzyGaugeUI: () => void;
  activateSuddenDeath: () => void;
  resetRound: () => void;
  resetSession: () => void;
  simulateTap: (team: TeamId) => void;
  externalObservability: ExternalObservability;
}

const $ = (id: string) => document.getElementById(id)!;

type LeagueTab = 'standings' | 'mvps' | 'gifters' | 'history';
type GifterPeriod = 'today' | 'season' | 'lifetime';

function compressImageFile(file: File, cb: (dataUrl: string) => void): void {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 48;
      c.getContext('2d')?.drawImage(img, 0, 0, 48, 48);
      cb(c.toDataURL('image/png'));
    };
    img.src = String(ev.target?.result || '');
  };
  reader.readAsDataURL(file);
}

function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function fmtAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export class SettingsPanel {
  private leagueTab: LeagueTab = 'standings';
  private gifterPeriod: GifterPeriod = 'season';

  constructor(private deps: SettingsPanelDeps) {
    this.bindEvents();
    this.renderRosterChips();
    this.renderGiftMapperTable();
    this.syncControlButtons();
  }

  togglePanel(): void {
    state.panelOpen = !state.panelOpen;
    state.telemetryOpen = false;
    $('telemetryModal').classList.add('hidden');
    $('leagueModal')?.classList.add('hidden');
    $('controlPanel').classList.toggle('hidden', !state.panelOpen);
  }

  toggleTelemetry(): void {
    state.telemetryOpen = !state.telemetryOpen;
    state.panelOpen = false;
    $('controlPanel').classList.add('hidden');
    $('leagueModal')?.classList.add('hidden');
    $('telemetryModal').classList.toggle('hidden', !state.telemetryOpen);
    if (state.telemetryOpen) renderTelemetry();
  }

  toggleLeague(): void {
    const modal = $('leagueModal');
    if (!modal) return;
    const wasHidden = modal.classList.contains('hidden');
    state.panelOpen = false;
    state.telemetryOpen = false;
    $('controlPanel').classList.add('hidden');
    $('telemetryModal').classList.add('hidden');
    if (wasHidden) {
      modal.classList.remove('hidden');
      this.renderLeague(this.leagueTab);
    } else {
      modal.classList.add('hidden');
    }
  }

  toggleSafeZones(): void {
    state.safeZonesVisible = !state.safeZonesVisible;
    $('safeZoneGuide').classList.toggle('hidden', !state.safeZonesVisible);
    $('btnSafeToggle').textContent = state.safeZonesVisible ? '📐 Safe Zones: ON' : '📐 Safe Zones: OFF';
    $('btnQuickSafe').style.background = state.safeZonesVisible ? 'rgba(225,29,72,0.42)' : '';
  }

  toggleDemoMode(): void {
    state.demoMode = !state.demoMode;
    this.syncControlButtons();
  }

  syncControlButtons(): void {
    $('btnDemoToggle').textContent = state.demoMode ? '⏹ Modo Demo: ON' : '▶ Modo Demo: OFF';
    $('btnDemoToggle').className = state.demoMode ? 'btn btn-emerald' : 'btn btn-amber';
    $('demoDotTop').style.background = state.demoMode ? '#34D399' : '#64748B';

    $('btnQuickMute').textContent = state.audioEnabled ? '🔊' : '🔇';
    $('btnAudioToggle').textContent = state.audioEnabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
    $('btnTtsToggle').textContent = state.ttsEnabled ? '🗣️ TTS Interno: ON' : '🗣️ TTS Interno: OFF';
    $('btnAiToggle').textContent = state.aiDirectorEnabled ? '🤖 Director IA: ON' : '🤖 Director IA: OFF';
    $('btnTournamentToggle').textContent = state.tournamentMode ? 'Torneo: ON' : 'Torneo: OFF';
    $('btnExternalTelemetry').textContent = state.externalObservabilityEnabled
      ? '📡 Externa: ON'
      : '📡 Externa: OFF';
    $('btnExternalTelemetry').className = state.externalObservabilityEnabled
      ? 'btn btn-emerald'
      : 'btn';
    ($('inExternalTelemetryUrl') as HTMLInputElement).value = state.externalObservabilityEndpoint;
    const externalStatus = this.deps.externalObservability.getStatus();
    const statusLabel = {
      off: 'OFF',
      idle: 'Esperando',
      sent: 'Enviado',
      failed: 'Falló',
    }[externalStatus.status];
    const latency = externalStatus.lastLatencyMs === null
      ? ''
      : ` · ${externalStatus.lastLatencyMs} ms`;
    const totals = externalStatus.successCount + externalStatus.failureCount > 0
      ? ` · ${externalStatus.successCount}/${externalStatus.successCount + externalStatus.failureCount} enviados`
      : '';
    $('telExternalStatus').textContent = `Estado externo: ${statusLabel}${latency}${totals}`;
    const snapshots = listPersistenceSnapshots();
    const backups = snapshots.filter((snapshot) => snapshot.kind === 'backup');
    const corrupt = snapshots.filter((snapshot) => snapshot.kind === 'corrupt');
    ($('btnRestoreBackup') as HTMLButtonElement).disabled = backups.length === 0;
    ($('btnRestoreBackup') as HTMLButtonElement).textContent =
      backups.length ? `↩ Restaurar respaldo (${backups.length})` : '↩ Sin respaldos';
    ($('btnRestoreCorrupt') as HTMLButtonElement).disabled = corrupt.length === 0;
    ($('btnRestoreCorrupt') as HTMLButtonElement).textContent =
      corrupt.length ? `↩ Recuperar corrupto (${corrupt.length})` : '↩ Sin datos corruptos';

    ($('selMusicMode') as HTMLSelectElement).value = state.musicMode;
    const volPct = Math.round(state.musicVolume * 100);
    ($('sliderMusicVol') as HTMLInputElement).value = String(volPct);
    $('lblMusicVol').textContent = `${volPct}%`;
    this.deps.synth.syncVolume();

    ($('sliderPersonalTap') as HTMLInputElement).value = String(state.personalTapThreshold);
    $('lblPersonalTap').textContent = `${state.personalTapThreshold} ❤️`;
    ($('sliderFrenzyGoal') as HTMLInputElement).value = String(state.frenzyGoalLikes);
    $('lblFrenzyGoal').textContent = `${state.frenzyGoalLikes} ❤️`;
    $('lblUnderdogTap').textContent = state.unalignedTapSupportsUnderdog ? 'ON' : 'OFF';
    $('lblUnderdogTap').style.color = state.unalignedTapSupportsUnderdog ? '#34D399' : '#94A3B8';
    $('btnTestTapA').textContent = `❤️ +${state.personalTapThreshold} Tap Norte`;
    $('btnTestTapB').textContent = `❤️ +${state.personalTapThreshold} Tap Sur`;

    this.deps.updateFrenzyGaugeUI();
  }

  renderRosterChips(): void {
    const container = $('rosterChips');
    container.innerHTML = state.roster
      .map(
        (r, idx) => `
      <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.06);border:1px solid ${hexToRgba(r.color, 0.45)};border-radius:8px;padding:3px 7px;font-size:9.5px;font-weight:700;">
        <span>${escapeHtml(r.flag)} ${escapeHtml(r.name)}</span>
        ${state.roster.length > 2 ? `<button data-remove-idx="${idx}" style="background:none;border:none;color:#FDA4AF;cursor:pointer;font-size:10px;padding:0;">✕</button>` : ''}
      </span>`
      )
      .join('');

    container.querySelectorAll<HTMLButtonElement>('[data-remove-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.removeIdx);
        if (state.roster.length > 2) {
          state.roster.splice(idx, 1);
          this.renderRosterChips();
          savePersistentState();
        }
      });
    });
  }

  renderGiftMapperTable(): void {
    const tbody = $('giftMapperBody');
    tbody.innerHTML = state.giftSlots
      .map(
        (slot, idx) => `
      <tr>
        <td style="font-weight:700;color:#E2E8F0;white-space:nowrap;">${escapeHtml(slot.emoji)} ${escapeHtml(slot.label)}</td>
        <td><input data-idx="${idx}" data-field="matchers" class="inp gm-inp" value="${escapeHtml(slot.matchers)}" /></td>
        <td><input data-idx="${idx}" data-field="coins" type="number" min="1" class="inp gm-inp tabular" value="${slot.coins}" style="width:44px;text-align:right;" /></td>
        <td>
          <div style="display:flex;gap:3px;align-items:center;">
            <input data-idx="${idx}" data-field="imgUrl" class="inp gm-inp" placeholder="URL" value="${slot.imgUrl.startsWith('http') ? escapeHtml(slot.imgUrl) : ''}" style="width:48px;" />
            <label class="btn" style="padding:3px 5px;font-size:9px;cursor:pointer;" title="Subir PNG">📁<input data-idx="${idx}" type="file" accept="image/png,image/webp,image/jpeg" class="gm-file hidden" /></label>
            ${slot.imgUrl ? `<button data-clear-img="${idx}" class="btn btn-danger" style="padding:3px 5px;font-size:9px;" title="Volver a emoji">✕</button>` : ''}
          </div>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll<HTMLInputElement>('.gm-file').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const inputEl = e.target as HTMLInputElement;
        const file = inputEl.files?.[0];
        const idx = Number(inputEl.dataset.idx);
        if (file) {
          compressImageFile(file, (url) => {
            state.giftSlots[idx].imgUrl = url;
            this.renderGiftMapperTable();
            this.deps.renderGiftLegend();
            savePersistentState();
          });
        }
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('[data-clear-img]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.clearImg);
        state.giftSlots[idx].imgUrl = '';
        this.renderGiftMapperTable();
        this.deps.renderGiftLegend();
        savePersistentState();
      });
    });
  }

  /* ===================== LIGA (Fase A) ===================== */

  private renderLeague(tab: LeagueTab): void {
    const season = state.currentSeason;
    const daysRemaining = Math.max(0, Math.ceil((season.endDate - Date.now()) / 86_400_000));
    const totalRounds = season.standings.reduce((s, e) => s + e.wins, 0);

    const elSeason = $('leagueSeasonNum');
    const elDays = $('leagueSeasonDays');
    const elRounds = $('leagueRoundsCount');
    if (elSeason) elSeason.textContent = String(season.index).padStart(2, '0');
    if (elDays) elDays.textContent = String(daysRemaining);
    if (elRounds) elRounds.textContent = String(totalRounds);

    const content = $('leagueContent');
    if (!content) return;

    if (tab === 'standings') content.innerHTML = this.renderStandingsTab();
    else if (tab === 'mvps') content.innerHTML = this.renderMvpsTab();
    else if (tab === 'gifters') content.innerHTML = this.renderGiftersTab();
    else content.innerHTML = this.renderHistoryTab();

    if (tab === 'gifters') {
      content.querySelectorAll<HTMLButtonElement>('[data-gifter-period]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.gifterPeriod = (btn.dataset.gifterPeriod as GifterPeriod) || 'season';
          this.renderLeague('gifters');
        });
      });
    }
  }

  private renderStandingsTab(): string {
    const standings = getStandings();
    const tAKey = state.teamA.key;
    const tBKey = state.teamB.key;

    const rows = standings.map((s, idx) => {
      const podium = idx < 3 ? ` podium-${idx + 1}` : '';
      const isCurrent = s.key === tAKey || s.key === tBKey;
      const highlight = isCurrent ? ` style="border-color:${s.color};box-shadow:0 0 8px ${hexToRgba(s.color, 0.28)};"` : '';
      const streakRec = state.teamRecords[s.key];
      const streakBadge = streakRec && streakRec.streak >= 2
        ? `<span style="font-size:8.5px;color:#FB923C;font-weight:800;">🔥${streakRec.streak}</span>`
        : '';
      return `
        <div class="league-row${podium}"${highlight}>
          <div class="league-pos">${idx + 1}</div>
          <div class="league-flag">${escapeHtml(s.flag)}</div>
          <div class="league-name" style="color:${s.color};">${escapeHtml(s.name)}${streakBadge ? ' ' + streakBadge : ''}</div>
          <div class="league-meta">${s.wins}W-${s.losses}L</div>
          <div class="league-pts tabular">${s.points}</div>
        </div>`;
    }).join('');

    const records = state.globalRecords;
    const recItem = (label: string, val: string, icon: string, color: string) =>
      `<div style="display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:3px;font-size:9.5px;">
        <span style="font-size:12px;">${icon}</span>
        <span style="flex:1;color:#CBD5E1;font-weight:700;">${label}</span>
        <span class="tabular" style="color:${color};font-weight:800;">${val}</span>
      </div>`;

    const recordsBlock = `
      <div class="league-subhead">🏅 Récords Globales</div>
      ${records.biggestSingleRound
        ? recItem('Ronda con más coins', `${fmtCoins(records.biggestSingleRound.coins)} 🪙`, '💰', '#FDE047')
        : ''}
      ${records.fastestRound
        ? recItem('Ronda más rápida', fmtDuration(records.fastestRound.durationSec), '⚡', '#34D399')
        : ''}
      ${records.longestRound
        ? recItem('Ronda más larga', fmtDuration(records.longestRound.durationSec), '🕰️', '#38BDF8')
        : ''}
      ${records.biggestUpset
        ? recItem('Mayor upset (ELO)', `+${records.biggestUpset.eloDiff} pts`, '🎯', '#F472B6')
        : ''}`;

    if (!rows) return `<div class="league-empty">Sin partidos jugados en esta temporada.</div>`;

    return `
      <div class="league-subhead">Tabla de la Temporada ${String(state.currentSeason.index).padStart(2, '0')}</div>
      ${rows}
      ${recordsBlock}
    `;
  }

  private renderMvpsTab(): string {
    const sessionTop = Object.values(state.sessionMVP)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const historical = getTopPlayers(20);

    const renderRow = (
      pos: number,
      avatarUrl: string,
      user: string,
      color: string,
      score: number,
      meta: string
    ) => {
      const av = getAvatar(avatarUrl, user);
      const podium = pos < 3 ? ` podium-${pos + 1}` : '';
      return `
        <div class="league-row${podium}">
          <div class="league-pos">${pos + 1}</div>
          <img class="league-avatar" src="${av.dataUrl}" alt="" />
          <div class="league-name">${escapeHtml(user)}</div>
          <div class="league-meta">${meta}</div>
          <div class="league-pts tabular" style="color:${color};">${score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score}</div>
        </div>`;
    };

    const sessionBlock = sessionTop.length
      ? sessionTop.map((m, i) => {
          const teamColor = m.team === 'A' ? state.teamA.color : state.teamB.color;
          const teamName = m.team === 'A' ? state.teamA.key : state.teamB.key;
          return renderRow(i, m.avatarUrl, m.user, teamColor, m.score, teamName);
        }).join('')
      : `<div class="league-empty">Aún sin MVPs en esta sesión.</div>`;

    const lifetimeBlock = historical.length
      ? historical.map((p, i) => {
          const color = p.favoriteTeam === 'A' ? state.teamA.color : p.favoriteTeam === 'B' ? state.teamB.color : '#FBBF24';
          const meta = `${p.mvpRounds}🏅 · ${fmtCoins(p.lifetime.coins)}🪙`;
          return renderRow(i, p.avatarUrl, p.user, color, p.peaks.maxSessionScore, meta);
        }).join('')
      : `<div class="league-empty">Sin históricos todavía. La próxima ronda abrirá el registro.</div>`;

    return `
      <div class="league-subhead">👑 MVPs de la Sesión (Live)</div>
      ${sessionBlock}
      <div class="league-subhead" style="margin-top:12px;">🏆 Top Histórico (Peak Score)</div>
      ${lifetimeBlock}
    `;
  }

  private renderGiftersTab(): string {
    const sel = (p: GifterPeriod, label: string) => {
      const active = this.gifterPeriod === p ? ' active' : '';
      return `<button data-gifter-period="${p}" class="${active.trim()}">${label}</button>`;
    };

    const gifters = getTopGifters(this.gifterPeriod, 10);

    const rows = gifters.length
      ? gifters.map((g, i) => {
          const av = getAvatar(g.avatarUrl, g.user);
          const podium = i < 3 ? ` podium-${i + 1}` : '';
          const player = state.playerRecords[g.user];
          const meta = player
            ? `${player.lifetime.gifts}g · ${player.mvpRounds}🏅`
            : '';
          return `
            <div class="league-row${podium}">
              <div class="league-pos">${i + 1}</div>
              <img class="league-avatar" src="${av.dataUrl}" alt="" />
              <div class="league-name">${escapeHtml(g.user)}</div>
              <div class="league-meta">${meta}</div>
              <div class="league-pts tabular" style="color:#FDE047;">${fmtCoins(g.coins)}🪙</div>
            </div>`;
        }).join('')
      : `<div class="league-empty">Aún sin gifters registrados en este periodo.</div>`;

    return `
      <div class="league-subhead">💰 Top Gifters</div>
      <div class="league-period-sel">
        ${sel('today', 'Hoy')}
        ${sel('season', 'Temporada')}
        ${sel('lifetime', 'Histórico')}
      </div>
      ${rows}
    `;
  }

  private renderHistoryTab(): string {
    const rounds = getRecentRounds(20);

    if (!rounds.length) {
      return `<div class="league-empty">Aún no hay rondas cerradas. Juega la primera batalla para ver el historial.</div>`;
    }

    const items = rounds.map((r) => {
      const featured = r.featured ? ' featured' : '';
      const suddenTag = r.suddenDeath
        ? `<span class="league-record-badge" style="background:rgba(239,68,68,0.2);color:#FCA5A5;">💀 Súbita</span>`
        : '';
      const featTag = r.featured
        ? `<span class="league-record-badge" style="background:rgba(251,191,36,0.18);color:#FDE68A;">⭐ Featured</span>`
        : '';
      const mvpLine = r.mvp
        ? `<span style="color:#FDE68A;">👑 ${escapeHtml(r.mvp.user)} · ${r.mvp.score.toLocaleString()}</span>`
        : `<span style="color:#64748B;">— sin MVP</span>`;
      const gifterLine = r.topGifter
        ? `<span style="color:#FDE047;">💰 ${escapeHtml(r.topGifter.user)} · ${fmtCoins(r.topGifter.coins)}</span>`
        : '';
      return `
        <div class="league-history-item${featured}">
          <div class="league-history-line">
            <span class="league-history-winner">${escapeHtml(r.winnerName)}</span>
            <span style="color:#475569;font-size:8px;">def.</span>
            <span class="league-history-loser">${escapeHtml(r.loserName)}</span>
            ${featTag}${suddenTag}
            <span style="margin-left:auto;color:#64748B;font-size:8px;">${fmtAgo(r.ts)}</span>
          </div>
          <div class="league-history-meta">
            <span>⏱️ ${fmtDuration(r.durationSec)}</span>
            <span>🪙 ${fmtCoins(r.totalCoins)}</span>
            <span>❤️ ${r.totalTaps}</span>
            ${mvpLine}
            ${gifterLine}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="league-subhead">📜 Últimas 20 Rondas</div>
      ${items}
    `;
  }

  /* ===================== ROSTER / GIFTS ===================== */

  private applyRosterPreset(list: TeamPreset[]): void {
    state.roster = structuredClone(list);
    state.rosterCursor = 2;
    state.teamA = makeBaseState(state.roster[0], true);
    state.teamB = makeBaseState(state.roster[1], false);
    this.renderRosterChips();
    this.deps.applyTeamUI();
    savePersistentState();
    this.deps.resetRound();
  }

  private bindEvents(): void {
    const { synth, tikfinity } = this.deps;

    // Barra superior y modales
    $('btnOpenPanel').addEventListener('click', () => this.togglePanel());
    $('btnClosePanel').addEventListener('click', () => this.togglePanel());
    $('wsPillTop').addEventListener('click', () => this.togglePanel());
    $('btnOpenTelemetry').addEventListener('click', () => this.toggleTelemetry());
    $('btnCloseTelemetry').addEventListener('click', () => this.toggleTelemetry());
    $('btnOpenLeague')?.addEventListener('click', () => this.toggleLeague());
    $('btnCloseLeague')?.addEventListener('click', () => this.toggleLeague());
    $('obsAudioUnlock').addEventListener('click', () => synth.unlock());

    // Tabs de la Liga (solo UI, el shortcut de teclado vive en InputShortcuts)
    document.querySelectorAll<HTMLButtonElement>('.league-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.leagueTab as LeagueTab | undefined;
        if (!tab) return;
        document.querySelectorAll('.league-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.leagueTab = tab;
        this.renderLeague(tab);
      });
    });

    // Controles generales
    $('btnQuickDemo').addEventListener('click', () => this.toggleDemoMode());
    $('btnDemoToggle').addEventListener('click', () => this.toggleDemoMode());
    $('btnQuickSafe').addEventListener('click', () => this.toggleSafeZones());
    $('btnSafeToggle').addEventListener('click', () => this.toggleSafeZones());

    const toggleAudio = () => {
      state.audioEnabled = !state.audioEnabled;
      this.syncControlButtons();
      savePersistentState();
    };
    $('btnQuickMute').addEventListener('click', toggleAudio);
    $('btnAudioToggle').addEventListener('click', toggleAudio);

    $('btnTtsToggle').addEventListener('click', () => {
      state.ttsEnabled = !state.ttsEnabled;
      this.syncControlButtons();
      savePersistentState();
    });

    $('btnAiToggle').addEventListener('click', () => {
      state.aiDirectorEnabled = !state.aiDirectorEnabled;
      this.syncControlButtons();
      savePersistentState();
    });

    $('btnExternalTelemetry').addEventListener('click', () => {
      const endpointInput = $('inExternalTelemetryUrl') as HTMLInputElement;
      const endpoint = sanitizeExternalEndpoint(endpointInput.value);
      if (!state.externalObservabilityEnabled && !endpoint) {
        window.alert('Introduce una URL HTTPS válida antes de activar observabilidad externa.');
        return;
      }
      state.externalObservabilityEndpoint = endpoint || '';
      state.externalObservabilityEnabled = !state.externalObservabilityEnabled;
      this.syncControlButtons();
      savePersistentState();
      if (state.externalObservabilityEnabled) this.deps.externalObservability.start();
      else this.deps.externalObservability.stop();
    });
    $('inExternalTelemetryUrl').addEventListener('change', (event) => {
      const endpoint = sanitizeExternalEndpoint((event.target as HTMLInputElement).value);
      if (!endpoint && (event.target as HTMLInputElement).value.trim()) {
        window.alert('La URL debe usar HTTPS o HTTP local.');
        (event.target as HTMLInputElement).value = '';
        return;
      }
      state.externalObservabilityEndpoint = endpoint || '';
      savePersistentState();
    });

    $('btnTriggerSudden').addEventListener('click', () => this.deps.activateSuddenDeath());
    $('btnResetRound').addEventListener('click', () => this.deps.resetRound());
    $('btnResetSession').addEventListener('click', () => this.deps.resetSession());
    $('btnTelReset').addEventListener('click', () => this.deps.resetSession());
    $('btnExportState').addEventListener('click', () => {
      const raw = exportPersistentState();
      if (!raw) return;
      downloadFile(`tactical_arena_state_v3_1_0_${Date.now()}.json`, raw, 'application/json');
    });
    $('btnImportState').addEventListener('click', () => {
      ($('inImportState') as HTMLInputElement).click();
    });
    $('inImportState').addEventListener('change', (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imported = importPersistentState(String(reader.result || ''));
        if (!imported) {
          window.alert('No se pudo importar el estado: archivo inválido o versión incompatible.');
          return;
        }
        window.location.reload();
      };
      reader.readAsText(file);
    });
    $('btnRestoreBackup').addEventListener('click', () => {
      const snapshot = listPersistenceSnapshots().find((item) => item.kind === 'backup');
      if (!snapshot) return;
      if (!window.confirm('¿Restaurar el respaldo persistido más reciente?')) return;
      if (!restorePersistenceSnapshot(snapshot.key)) {
        window.alert('No se pudo restaurar el respaldo.');
        return;
      }
      window.location.reload();
    });
    $('btnRestoreCorrupt').addEventListener('click', () => {
      const snapshot = listPersistenceSnapshots().find((item) => item.kind === 'corrupt');
      if (!snapshot) return;
      if (!window.confirm('¿Intentar recuperar el último estado marcado como corrupto?')) return;
      if (!restorePersistenceSnapshot(snapshot.key)) {
        window.alert('No se pudo recuperar el estado corrupto.');
        return;
      }
      window.location.reload();
    });

    // Música
    $('selMusicMode').addEventListener('change', (e) => {
      state.musicMode = (e.target as HTMLSelectElement).value as typeof state.musicMode;
      synth.applyMusicMode();
      savePersistentState();
    });
    $('sliderMusicVol').addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      state.musicVolume = Number(val) / 100;
      $('lblMusicVol').textContent = `${val}%`;
      synth.syncVolume();
      savePersistentState();
    });
    $('inMusicFile').addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        synth.loadCustomFile(file);
        this.syncControlButtons();
        savePersistentState();
      }
    });

    // Tap Tap
    $('sliderPersonalTap').addEventListener('input', (e) => {
      state.personalTapThreshold = Number((e.target as HTMLInputElement).value);
      this.syncControlButtons();
      savePersistentState();
    });
    $('sliderFrenzyGoal').addEventListener('input', (e) => {
      state.frenzyGoalLikes = Number((e.target as HTMLInputElement).value);
      this.syncControlButtons();
      savePersistentState();
    });
    $('btnUnderdogTapToggle').addEventListener('click', () => {
      state.unalignedTapSupportsUnderdog = !state.unalignedTapSupportsUnderdog;
      this.syncControlButtons();
      savePersistentState();
    });
    $('btnTestTapA').addEventListener('click', () => this.deps.simulateTap('A'));
    $('btnTestTapB').addEventListener('click', () => this.deps.simulateTap('B'));

    // TikFinity WebSocket
    $('btnWsConnect').addEventListener('click', () => {
      if (tikfinity.isEnabled) tikfinity.disconnect();
      else tikfinity.connect(($('wsUrl') as HTMLInputElement).value);
    });

    // Torneo y Roster
    $('btnTournamentToggle').addEventListener('click', () => {
      state.tournamentMode = !state.tournamentMode;
      this.deps.applyTeamUI();
      savePersistentState();
    });
    $('btnPresetWorld').addEventListener('click', () => this.applyRosterPreset(WORLD_ROSTER));
    $('btnPresetLigaMX').addEventListener('click', () => this.applyRosterPreset(LIGAMX_ROSTER));
    $('btnAddRoster').addEventListener('click', () => {
      const flagInp = $('inAddFlag') as HTMLInputElement;
      const nameInp = $('inAddName') as HTMLInputElement;
      const keyInp = $('inAddKey') as HTMLInputElement;
      const name = nameInp.value.trim().toUpperCase();
      if (!name) return;
      const flag = flagInp.value.trim() || '🏳️';
      const key = (keyInp.value.trim() || name.slice(0, 2)).toUpperCase();
      const colors = ['#10B981', '#38BDF8', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899'];
      state.roster.push({
        name,
        flag,
        key,
        aliases: [key.toLowerCase(), name.toLowerCase()],
        color: colors[state.roster.length % colors.length],
      });
      flagInp.value = '';
      nameInp.value = '';
      keyInp.value = '';
      this.renderRosterChips();
      savePersistentState();
    });

    // Gift Mapper
    $('btnSaveGifts').addEventListener('click', () => {
      document.querySelectorAll<HTMLInputElement>('.gm-inp').forEach((inp) => {
        const idx = Number(inp.dataset.idx);
        const field = inp.dataset.field;
        if (field === 'coins') {
          state.giftSlots[idx].coins = Math.max(1, Number(inp.value) || 1);
        } else if (field === 'imgUrl') {
          const val = inp.value.trim();
          if (val) {
            state.giftSlots[idx].imgUrl = val;
          } else if (state.giftSlots[idx].imgUrl.startsWith('http')) {
            state.giftSlots[idx].imgUrl = '';
          }
        } else if (field === 'matchers') {
          const val = inp.value.trim();
          if (val) {
            state.giftSlots[idx].matchers = val;
            const firstAlias = val.split(',').map((x) => x.trim()).find((x) => isNaN(Number(x)));
            if (firstAlias) state.giftSlots[idx].display = firstAlias;
          }
        }
      });
      this.renderGiftMapperTable();
      this.deps.renderGiftLegend();
      this.deps.updatePanicAlerts();
      savePersistentState();
      synth.playSFX('frenzy');
    });

    // Exportación Telemetría
    $('btnExportJson').addEventListener('click', () => {
      const payload = {
        ...state.telemetry,
        topMVP: Object.values(state.sessionMVP).sort((a, b) => b.score - a.score).slice(0, 10),
        league: {
          season: state.currentSeason,
          teamRecords: state.teamRecords,
          globalRecords: state.globalRecords,
          recentRounds: state.roundLogs.slice(0, 50),
        },
      };
      downloadFile(`tactical_v3_1_0_telemetry_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });
    $('btnExportCsv').addEventListener('click', () => {
      const rows: [string, string | number][] = [
        ['Metrica', 'Valor'],
        ['Monedas', state.telemetry.totalCoins],
        ['Regalos', state.telemetry.totalGifts],
        ['Taps', state.telemetry.totalTaps],
        ['Follows', state.telemetry.totalFollows],
        ['Shares', state.telemetry.totalShares],
      ];
      Object.entries(state.telemetry.giftBreakdown).forEach(([n, inf]) => {
        rows.push([n, `${inf.count} (${inf.coins} coins)`]);
      });
      downloadFile(`tactical_v3_1_0_telemetry_${Date.now()}.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv;charset=utf-8;');
    });
  }
}