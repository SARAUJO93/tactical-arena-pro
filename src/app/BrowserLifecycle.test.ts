import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBrowserLifecycle } from './BrowserLifecycle';

describe('BrowserLifecycle', () => {
  it('instala y elimina listeners sin persistir automáticamente en la prueba', () => {
    const listeners = new Map<string, EventListener>();
    const fakeWindow = {
      addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        if (listeners.get(type) === listener) listeners.delete(type);
      }),
    };
    vi.stubGlobal('window', fakeWindow);
    const onOffline = vi.fn();
    const onOnline = vi.fn();

    const cleanup = installBrowserLifecycle({ onOffline, onOnline });
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));

    cleanup();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
