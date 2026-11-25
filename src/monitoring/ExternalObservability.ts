import { state } from '../core/GameState';

export interface SanitizedQualityPayload {
  appVersion: string;
  sessionId: string;
  timestamp: number;
  quality: {
    roundCount: number;
    totalRoundDurationSec: number;
    longestRoundSec: number;
    runtimeErrorCount: number;
    persistenceErrorCount: number;
    websocketDisconnectCount: number;
  };
  errorKinds: string[];
  structuredEvents: string[];
  performance: {
    fps: number;
    averageFrameMs: number;
    maxFrameMs: number;
    usedHeapMb: number | null;
  };
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeExternalEndpoint(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const isHttps = url.protocol === 'https:';
    const isLocalHttp = url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) return null;
    if (url.username || url.password) return null;
    if (url.search || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildSanitizedPayload(appVersion: string): SanitizedQualityPayload {
  return {
    appVersion,
    sessionId: createSessionId(),
    timestamp: Date.now(),
    quality: {
      roundCount: state.telemetry.roundCount,
      totalRoundDurationSec: state.telemetry.totalRoundDurationSec,
      longestRoundSec: state.telemetry.longestRoundSec,
      runtimeErrorCount: state.telemetry.runtimeErrorCount,
      persistenceErrorCount: state.telemetry.persistenceErrorCount,
      websocketDisconnectCount: state.telemetry.websocketDisconnectCount,
    },
    errorKinds: state.telemetry.errorLog
      .map((entry) => entry.includes('Persistencia') ? 'persistence' : 'runtime')
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 10),
    structuredEvents: state.telemetry.structuredLog
      .map((entry) => entry.event)
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 10),
    performance: {
      fps: state.telemetry.fps,
      averageFrameMs: state.telemetry.averageFrameMs,
      maxFrameMs: state.telemetry.maxFrameMs,
      usedHeapMb: state.telemetry.usedHeapMb,
    },
  };
}

export class ExternalObservability {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly sessionId = createSessionId();
  private status: 'off' | 'idle' | 'sent' | 'failed' = 'off';
  private lastAttemptAt: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelayMs = 15000;
  private lastSuccessAt: number | null = null;
  private lastLatencyMs: number | null = null;
  private successCount = 0;
  private failureCount = 0;

  constructor(private readonly appVersion: string) {}

  getStatus(): {
    status: 'off' | 'idle' | 'sent' | 'failed';
    lastAttemptAt: number | null;
    lastSuccessAt: number | null;
    lastLatencyMs: number | null;
    successCount: number;
    failureCount: number;
  } {
    return {
      status: this.status,
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastLatencyMs: this.lastLatencyMs,
      successCount: this.successCount,
      failureCount: this.failureCount,
    };
  }

  start(): void {
    if (this.timer) return;
    if (!state.externalObservabilityEnabled) return;
    const endpoint = sanitizeExternalEndpoint(state.externalObservabilityEndpoint);
    if (!endpoint) return;
    this.status = 'idle';
    void this.send(endpoint);
    this.timer = setInterval(() => void this.send(endpoint), 60000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timer = null;
    this.retryTimer = null;
    this.status = 'off';
    this.retryDelayMs = 15000;
    this.lastSuccessAt = null;
    this.lastLatencyMs = null;
    this.successCount = 0;
    this.failureCount = 0;
  }

  private scheduleRetry(endpoint: string): void {
    if (this.retryTimer) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(300000, delay * 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.send(endpoint);
    }, delay);
  }

  async send(endpointOverride?: string): Promise<boolean> {
    const endpoint = sanitizeExternalEndpoint(endpointOverride || state.externalObservabilityEndpoint);
    if (!state.externalObservabilityEnabled || !endpoint) return false;

    const payload = buildSanitizedPayload(this.appVersion);
    payload.sessionId = this.sessionId;
    this.lastAttemptAt = Date.now();
    const attemptStartedAt = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        keepalive: true,
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        this.status = 'sent';
        this.lastSuccessAt = Date.now();
        this.lastLatencyMs = Math.round(performance.now() - attemptStartedAt);
        this.successCount += 1;
        this.retryDelayMs = 15000;
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }
      } else {
        this.status = 'failed';
        this.lastLatencyMs = Math.round(performance.now() - attemptStartedAt);
        this.failureCount += 1;
        this.scheduleRetry(endpoint);
      }
      return response.ok;
    } catch {
      this.status = 'failed';
      this.lastLatencyMs = Math.round(performance.now() - attemptStartedAt);
      this.failureCount += 1;
      this.scheduleRetry(endpoint);
      return false;
    }
  }
}
