export interface SettingsState {
  personalTapThreshold: number;
  frenzyGoalLikes: number;
  unalignedTapSupportsUnderdog: boolean;
  aiDirectorEnabled: boolean;
  audioEnabled: boolean;
  externalObservabilityEnabled: boolean;
  externalObservabilityEndpoint: string;
  musicMode: 'starfox' | 'pulse' | 'mp3' | 'off';
  musicVolume: number;
  ttsEnabled: boolean;
  safeZonesVisible: boolean;
  demoMode: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  personalTapThreshold: 15,
  frenzyGoalLikes: 100,
  unalignedTapSupportsUnderdog: true,
  aiDirectorEnabled: true,
  audioEnabled: true,
  externalObservabilityEnabled: false,
  externalObservabilityEndpoint: '',
  musicMode: 'starfox',
  musicVolume: 0.35,
  ttsEnabled: false,
  safeZonesVisible: false,
  demoMode: true,
};

type SettingsKey = keyof SettingsState;

export class SettingsStore {
  private settings: SettingsState = { ...DEFAULT_SETTINGS };
  private listeners = new Set<() => void>();

  get<K extends SettingsKey>(key: K): SettingsState[K] {
    return this.settings[key];
  }

  getAll(): Readonly<SettingsState> {
    return { ...this.settings };
  }

  set<K extends SettingsKey>(key: K, value: SettingsState[K]): void {
    if (this.settings[key] !== value) {
      (this.settings as Record<SettingsKey, unknown>)[key] = value;
      this.notify();
    }
  }

  setMultiple(partial: Partial<SettingsState>): void {
    let changed = false;
    (Object.keys(partial) as SettingsKey[]).forEach((key) => {
      const value = partial[key];
      if (value !== undefined && this.settings[key] !== value) {
        (this.settings as Record<SettingsKey, unknown>)[key] = value;
        changed = true;
      }
    });
    if (changed) this.notify();
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
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

export const settingsStore = new SettingsStore();