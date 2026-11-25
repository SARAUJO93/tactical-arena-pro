import { saveNow } from '../core/GameState';
import { logOperationalEvent } from '../monitoring/OperationalLogger';

export interface BrowserLifecycleCallbacks {
  onOffline: () => void;
  onOnline: () => void;
}

export function installBrowserLifecycle(callbacks: BrowserLifecycleCallbacks): () => void {
  const handleBeforeUnload = (): void => {
    saveNow();
  };
  const handlePageHide = (): void => {
    saveNow();
  };
  const handleOffline = (): void => {
    logOperationalEvent('warn', 'browser.offline');
    callbacks.onOffline();
  };
  const handleOnline = (): void => {
    logOperationalEvent('info', 'browser.online');
    callbacks.onOnline();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);
  };
}
