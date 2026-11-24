import { bus } from '../core/EventBus';
import { METEOR_COIN_STEP, state } from '../core/GameState';
import { escapeHtml } from '../utils/helpers';
import { getAvatarCacheSize, MAX_AVATAR_CACHE } from './AvatarCache';

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
    : `<div style="color:#64748B;">Sin regalos aún.</div>`;

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