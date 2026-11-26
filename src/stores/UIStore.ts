export interface UIState {
  panelOpen: boolean;
  telemetryOpen: boolean;
  shake: number;
  screenFlash: number;
  leagueTab: 'standings' | 'mvps' | 'gifters' | 'pass' | 'history';
  gifterPeriod: 'today' | 'season' | 'lifetime';
}

const DEFAULT_UI: UIState = {
  panelOpen: false,
  telemetryOpen: false,
  shake: 0,
  screenFlash: 0,
  leagueTab: 'standings',
  gifterPeriod: 'season',
};

type UIKey = keyof UIState;

export class UIStore {
  private state: UIState = { ...DEFAULT_UI };
  private listeners = new Set<() => void>();

  get<K extends UIKey>(key: K): UIState[K] {
    return this.state[key];
  }

  getAll(): Readonly<UIState> {
    return { ...this.state };
  }

  set<K extends UIKey>(key: K, value: UIState[K]): void {
    if (this.state[key] !== value) {
      (this.state as Record<UIKey, unknown>)[key] = value;
      this.notify();
    }
  }

  setMultiple(partial: Partial<UIState>): void {
    let changed = false;
    (Object.keys(partial) as UIKey[]).forEach((key) => {
      const value = partial[key];
      if (value !== undefined && this.state[key] !== value) {
        (this.state as Record<UIKey, unknown>)[key] = value;
        changed = true;
      }
    });
    if (changed) this.notify();
  }

  reset(): void {
    this.state = { ...DEFAULT_UI };
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const uiStore = new UIStore();