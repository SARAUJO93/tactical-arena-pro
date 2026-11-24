import { TeamId } from '../core/EventBus';
import {
  LIGAMX_ROSTER, makeBaseState, savePersistentState, state, TeamPreset, WORLD_ROSTER,
} from '../core/GameState';
import { SynthEngine } from '../audio/SynthEngine';
import { TikFinityClient } from '../network/TikFinityClient';
import { downloadFile, renderTelemetry } from '../systems/Telemetry';
import { escapeHtml, hexToRgba } from '../utils/helpers';

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
}

const $ = (id: string) => document.getElementById(id)!;

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

export class SettingsPanel {
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
    $('controlPanel').classList.toggle('hidden', !state.panelOpen);
  }

  toggleTelemetry(): void {
    state.telemetryOpen = !state.telemetryOpen;
    state.panelOpen = false;
    $('controlPanel').classList.add('hidden');
    $('telemetryModal').classList.toggle('hidden', !state.telemetryOpen);
    if (state.telemetryOpen) renderTelemetry();
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

    // Música
    ($('selMusicMode') as HTMLSelectElement).value = state.musicMode;
    const volPct = Math.round(state.musicVolume * 100);
    ($('sliderMusicVol') as HTMLInputElement).value = String(volPct);
    $('lblMusicVol').textContent = `${volPct}%`;
    this.deps.synth.syncVolume();

    // Tap Tap
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
    $('obsAudioUnlock').addEventListener('click', () => synth.unlock());

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

    $('btnTriggerSudden').addEventListener('click', () => this.deps.activateSuddenDeath());
    $('btnResetRound').addEventListener('click', () => this.deps.resetRound());
    $('btnResetSession').addEventListener('click', () => this.deps.resetSession());
    $('btnTelReset').addEventListener('click', () => this.deps.resetSession());

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
      };
      downloadFile(`tactical_v2_3_telemetry_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
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
      downloadFile(`tactical_v2_3_telemetry_${Date.now()}.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv;charset=utf-8;');
    });
  }
}