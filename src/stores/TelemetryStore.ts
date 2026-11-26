import { TelemetryData, RoundLog, GiftSlot } from '../core/GameState';
import { METEOR_COIN_STEP } from './GameStore';
import { computeBalanceReport, BalanceReport } from '../systems/BalanceAnalytics';

export class TelemetryStore {
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

  nextMeteorCoinTarget = METEOR_COIN_STEP;

  resetSession(): void {
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
    this.nextMeteorCoinTarget = METEOR_COIN_STEP;
  }

  recordGift(giftName: string, count: number, coinsEach: number): void {
    const addedCoins = count * coinsEach;
    this.telemetry.totalGifts += count;
    this.telemetry.totalCoins += addedCoins;
    if (!this.telemetry.giftBreakdown[giftName]) {
      this.telemetry.giftBreakdown[giftName] = { count: 0, coins: 0 };
    }
    this.telemetry.giftBreakdown[giftName].count += count;
    this.telemetry.giftBreakdown[giftName].coins += addedCoins;

    if (this.telemetry.totalCoins >= this.nextMeteorCoinTarget) {
      this.nextMeteorCoinTarget =
        (Math.floor(this.telemetry.totalCoins / METEOR_COIN_STEP) + 1) * METEOR_COIN_STEP;
    }
  }

  logWsEvent(msg: string): void {
    const t = new Date().toLocaleTimeString('es-MX', { hour12: false });
    this.telemetry.wsLog.unshift(`[${t}] ${msg}`);
    if (this.telemetry.wsLog.length > 40) this.telemetry.wsLog.pop();
  }

  recordError(error: string): void {
    this.telemetry.runtimeErrorCount += 1;
    this.telemetry.errorLog.unshift(`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}] ${error}`);
    this.telemetry.errorLog = this.telemetry.errorLog.slice(0, 40);
  }

  recordPersistenceError(): void {
    this.telemetry.persistenceErrorCount += 1;
    this.telemetry.errorLog.unshift(`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}] Persistencia: no se pudo guardar el estado`);
    this.telemetry.errorLog = this.telemetry.errorLog.slice(0, 40);
  }

  recordWebsocketDisconnect(): void {
    this.telemetry.websocketDisconnectCount += 1;
  }

  updateFrameMetrics(fps: number, averageFrameMs: number, maxFrameMs: number, usedHeapMb: number | null): void {
    this.telemetry.fps = fps;
    this.telemetry.averageFrameMs = averageFrameMs;
    this.telemetry.maxFrameMs = maxFrameMs;
    this.telemetry.usedHeapMb = usedHeapMb;
  }

  recordRound(durationSec: number): void {
    this.telemetry.roundCount += 1;
    this.telemetry.totalRoundDurationSec += durationSec;
    this.telemetry.longestRoundSec = Math.max(this.telemetry.longestRoundSec, durationSec);
  }

  computeBalanceReport(roundLogs: RoundLog[], giftSlots: GiftSlot[]): BalanceReport {
    return computeBalanceReport(roundLogs, giftSlots, this.telemetry.giftBreakdown);
  }
}

export const telemetryStore = new TelemetryStore();