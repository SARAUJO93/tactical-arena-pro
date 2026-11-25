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

  constructor(private readonly appVersion: string) {}

  getStatus(): { status: 'off' | 'idle' | 'sent' | 'failed'; lastAttemptAt: number | null } {
    return { status: this.status, lastAttemptAt: this.lastAttemptAt };
  }

  start(): void {
    if (this.timer) return;
    if (!state.externalObservabilityEnabled) return;
    const endpoint = sanitizeExternalEndpoint(state.externalObservabilityEndpoint);
    if (!endpoint) return;
    this.status = 'idle';
    this.timer = setInterval(() => void this.send(endpoint), 60000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.status = 'off';
  }

  async send(endpointOverride?: string): Promise<boolean> {
    const endpoint = sanitizeExternalEndpoint(endpointOverride || state.externalObservabilityEndpoint);
    if (!state.externalObservabilityEnabled || !endpoint) return false;

    const payload = buildSanitizedPayload(this.appVersion);
    payload.sessionId = this.sessionId;
    this.lastAttemptAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        keepalive: true,
        body: JSON.stringify(payload),
      });
      this.status = response.ok ? 'sent' : 'failed';
      return response.ok;
    } catch {
      this.status = 'failed';
      return false;
    }
  }
}
