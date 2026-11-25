import { state } from '../core/GameState';

export type OperationalLevel = 'info' | 'warn' | 'error';

export function redactSensitiveText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s]+/gi, '[URL]')
    .replace(/@[A-Za-z0-9_.-]+/g, '[USER]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b\d{6,}\b/g, '[NUMBER]')
    .slice(0, 300);
}

export function logOperationalEvent(
  level: OperationalLevel,
  event: string,
  detail = ''
): void {
  state.telemetry.structuredLog.unshift({
    ts: Date.now(),
    level,
    event: event.trim().slice(0, 64) || 'unknown',
    detail: redactSensitiveText(detail),
  });
  state.telemetry.structuredLog = state.telemetry.structuredLog.slice(0, 40);
}
