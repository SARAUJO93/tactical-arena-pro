import { bus } from '../core/EventBus';
import { METEOR_COIN_STEP, state } from '../core/GameState';
import { escapeHtml } from '../utils/helpers';
import { getAvatarCacheSize, MAX_AVATAR_CACHE } from './AvatarCache';
import { computeBalanceReport } from './BalanceAnalytics';

export function logWsEvent(msg: string): void {
  const t = new Date().toLocaleTimeString('es-MX', { hour12: false });
  state.telemetry.wsLog.unshift(`[${t}] ${msg}`);
  if (state.telemetry.wsLog.length > 40) state.telemetry.wsLog.pop();
  if (state.telemetryOpen) renderTelemetry();
}

export function recordTelemetryGift(giftName: string, count: number, coinsEach: number): void {
  const addedCoins = count * coinsEach;
  state.telemetry.totalGifts += count;
  state.telemetry.totalCoins += addedCoins;
  if (!state.telemetry.giftBreakdown[giftName]) {
    state.telemetry.giftBreakdown[giftName] = { count: 0, coins: 0 };
  }
  state.telemetry.giftBreakdown[giftName].count += count;
  state.telemetry.giftBreakdown[giftName].coins += addedCoins;

  if (state.telemetry.totalCoins >= state.nextMeteorCoinTarget) {
    state.nextMeteorCoinTarget =
      (Math.floor(state.telemetry.totalCoins / METEOR_COIN_STEP) + 1) * METEOR_COIN_STEP;
    bus.emit('action:instant', {
      team: 'A',
      kind: 'METEOR_SHOWER',
      user: 'Meta 500 🪙',
      avatarUrl: '',
    });
  }
  if (state.telemetryOpen) renderTelemetry();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatShortDuration(sec: number): string {
  if (sec <= 0) return '0s';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function renderTelemetry(): void {
  const $ = (id: string) => document.getElementById(id)!;
  const elapsed = Math.max(1000, Date.now() - state.telemetry.sessionStart);
  const hrs = elapsed / 3600000;

  $('telDuration').textContent = formatDuration(elapsed);
  $('telCoins').textContent = `${state.telemetry.totalCoins.toLocaleString()} 🪙`;
  $('telCoinsHr').textContent = Math.round(state.telemetry.totalCoins / Math.max(0.01, hrs)).toLocaleString();
  $('telGifts').textContent = state.telemetry.totalGifts.toLocaleString();
  $('telTaps').textContent = state.telemetry.totalTaps.toLocaleString();
  $('telRatio').textContent =
    state.telemetry.totalGifts > 0
      ? `${(state.telemetry.totalTaps / state.telemetry.totalGifts).toFixed(1)}:1`
      : `${state.telemetry.totalTaps}:0`;
  $('telFollows').textContent = state.telemetry.totalFollows.toLocaleString();
  $('telShares').textContent = state.telemetry.totalShares.toLocaleString();
  $('telCache').textContent = `${getAvatarCacheSize()}/${MAX_AVATAR_CACHE}`;
  const roundCount = state.telemetry.roundCount;
  const averageRoundSec = roundCount > 0
    ? Math.round(state.telemetry.totalRoundDurationSec / roundCount)
    : 0;
  $('telRoundCount').textContent = String(roundCount);
  $('telAvgRound').textContent = formatDuration(averageRoundSec * 1000);
  $('telLongestRound').textContent = formatDuration(state.telemetry.longestRoundSec * 1000);
  $('telRuntimeErrors').textContent = String(state.telemetry.runtimeErrorCount);
  $('telPersistenceErrors').textContent = String(state.telemetry.persistenceErrorCount);
  $('telFps').textContent = String(state.telemetry.fps);
  $('telAvgFrame').textContent = `${state.telemetry.averageFrameMs.toFixed(1)} ms`;
  $('telMaxFrame').textContent = `${state.telemetry.maxFrameMs.toFixed(1)} ms`;
  $('telHeap').textContent = state.telemetry.usedHeapMb === null
    ? 'N/D'
    : `${state.telemetry.usedHeapMb.toFixed(1)} MB`;

  const top = Object.entries(state.telemetry.giftBreakdown)
    .sort((a, b) => b[1].coins - a[1].coins)
    .slice(0, 6);

  $('telTopGifts').innerHTML = top.length
    ? top
        .map(
          ([n, inf]) =>
            `<div style="display:flex;justify-content:space-between;background:rgba(255,255,255,0.04);padding:4px 8px;border-radius:6px;"><strong>${escapeHtml(n)}</strong><span class="tabular" style="color:#FDE047;">x${inf.count} (${inf.coins.toLocaleString()} 🪙)</span></div>`
        )
        .join('')
    : `<div style="color:#94A3B8;">Sin regalos aún.</div>`;

  const balanceEl = document.getElementById('telBalanceReport');
  if (balanceEl) {
    const report = computeBalanceReport(state.roundLogs, state.giftSlots, state.telemetry.giftBreakdown);
    const teamBPct = 100 - report.teamAWinPct;

    const biomeRows = report.biomes
      .map((b) => {
        const stats = b.rounds > 0
          ? `N ${b.teamAPct}% · ${b.rounds}r · ${formatShortDuration(b.avgDurationSec)}`
          : 'Sin rondas';
        const alertTag = b.alert
          ? `<span style="color:#FCA5A5;font-weight:800;"> · ⚠ ${escapeHtml(b.alert)}</span>`
          : '';
        const barFill = b.rounds > 0 ? b.teamAPct : 50;
        const barOpacity = b.rounds > 0 ? '1' : '0.35';
        return `<div style="background:rgba(255,255,255,0.04);padding:4px 7px;border-radius:6px;">
          <div style="display:flex;justify-content:space-between;gap:6px;">
            <span>${b.icon} ${escapeHtml(b.name)}</span>
            <span class="tabular" style="color:#E2E8F0;">${stats}${alertTag}</span>
          </div>
          <div style="height:3px;border-radius:999px;background:rgba(56,189,248,0.45);overflow:hidden;margin-top:3px;opacity:${barOpacity};">
            <div style="width:${barFill}%;height:100%;background:#10B981;"></div>
          </div>
        </div>`;
      })
      .join('');

    const activeGiftRows = report.giftUsage
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((g) => `
        <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.035);padding:3px 7px;border-radius:6px;font-size:9px;">
          <span style="min-width:74px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.emoji} ${escapeHtml(g.display)}</span>
          <div style="flex:1;height:4px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;">
            <div style="width:${Math.max(4, g.sharePct)}%;height:100%;background:linear-gradient(90deg,#F59E0B,#FDE047);"></div>
          </div>
          <span class="tabular" style="color:#FDE047;min-width:58px;text-align:right;">x${g.count} (${g.sharePct}%)</span>
        </div>`)
      .join('');

    const unusedText = report.unusedGifts.length
      ? report.unusedGifts.map((g) => `${g.emoji} ${escapeHtml(g.display)} (${g.coins}🪙)`).join(' · ')
      : 'Todos los regalos del catálogo tuvieron uso.';

    balanceEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-bottom:5px;font-size:9px;color:#CBD5E1;">
        <div style="background:rgba(255,255,255,0.04);padding:4px 6px;border-radius:6px;">
          Rondas: <strong class="tabular" style="color:#F8FAFC;">${report.totalRounds}</strong> · Media: <strong class="tabular" style="color:#7DD3FC;">${formatShortDuration(report.avgDurationSec)}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.04);padding:4px 6px;border-radius:6px;">
          Norte/Sur: <strong class="tabular" style="color:#34D399;">${report.teamAWinPct}%</strong>/<strong class="tabular" style="color:#38BDF8;">${teamBPct}%</strong> · Súbita: <strong class="tabular" style="color:#FCA5A5;">${report.suddenDeathPct}%</strong>
        </div>
      </div>
      ${report.alertCount > 0 ? `<div style="margin-bottom:5px;padding:4px 7px;border-radius:6px;background:rgba(239,68,68,0.14);border:1px solid rgba(248,113,113,0.38);font-size:9px;color:#FECACA;">⚠ ${report.alertCount} bioma${report.alertCount > 1 ? 's' : ''} con alerta de desbalance</div>` : ''}
      ${biomeRows}
      ${activeGiftRows ? `<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px;"><div style="font-size:8.5px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">Uso de catálogo en sesión</div>${activeGiftRows}</div>` : ''}
      <div style="margin-top:5px;padding:5px 7px;border-radius:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.22);font-size:9px;color:#FDE68A;">
        <strong>Sin uso en sesión:</strong> ${unusedText}
      </div>`;
  }

  $('telWsLog').innerHTML = state.telemetry.wsLog.length
    ? state.telemetry.wsLog.map((l) => `<div>${escapeHtml(l)}</div>`).join('')
    : `<div>[Sistema] Listo.</div>`;
  $('telErrorLog').innerHTML = state.telemetry.errorLog.length
    ? state.telemetry.errorLog.map((l) => `<div>${escapeHtml(l)}</div>`).join('')
    : `<div>[Sistema] Sin errores registrados.</div>`;
}

export function downloadFile(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}