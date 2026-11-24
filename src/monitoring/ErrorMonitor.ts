import { state } from '../core/GameState';

export interface ErrorRecord {
  ts: number;
  source: 'window' | 'promise';
  message: string;
}

function recordError(source: ErrorRecord['source'], message: string): void {
  const clean = message.trim().slice(0, 300) || 'Error desconocido';
  state.telemetry.runtimeErrorCount += 1;
  state.telemetry.errorLog.unshift(
    `[${new Date().toLocaleTimeString('es-MX', { hour12: false })}] ${source}: ${clean}`
  );
  state.telemetry.errorLog = state.telemetry.errorLog.slice(0, 40);
}

export function installErrorMonitoring(): () => void {
  const handleWindowError = (event: ErrorEvent): void => {
    recordError('window', event.message);
  };
  const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason instanceof Error
      ? event.reason.message
      : typeof event.reason === 'string'
        ? event.reason
        : 'Promesa rechazada';
    recordError('promise', reason);
  };

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleWindowError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}
