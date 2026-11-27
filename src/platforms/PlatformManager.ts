import { state, savePersistentState } from '../core/GameState';
import { TikFinityClient } from '../network/TikFinityClient';
import { FacebookAdapter } from './adapters/FacebookAdapter';
import { TikTokAdapter } from './adapters/TikTokAdapter';
import { TwitchAdapter } from './adapters/TwitchAdapter';
import { PlatformAdapter } from './adapters/types';
import { getPlatformPreset } from './presets';
import { PlatformGiftSlot, PlatformId, PlatformPreset } from './types';

const ACTIVE_PLATFORM_KEY = 'tactical_arena_active_platform_v1';
const PLATFORM_GIFTS_KEY_PREFIX = 'tactical_arena_gifts_v1_';
const PLATFORM_TARGET_KEY_PREFIX = 'tactical_arena_target_v1_';

function isValidPlatformId(val: unknown): val is PlatformId {
  return val === 'tiktok' || val === 'twitch' || val === 'facebook';
}

export class PlatformManager {
  private currentId: PlatformId = 'tiktok';
  private adapters: Record<PlatformId, PlatformAdapter>;

  constructor(tikfinity: TikFinityClient) {
    this.currentId = this.loadSavedPlatformId();
    this.adapters = {
      tiktok: new TikTokAdapter(tikfinity),
      twitch: new TwitchAdapter(),
      facebook: new FacebookAdapter(),
    };
  }

  getActiveId(): PlatformId {
    return this.currentId;
  }

  getActivePreset(): PlatformPreset {
    return getPlatformPreset(this.currentId);
  }

  get isConnected(): boolean {
    return this.adapters[this.currentId].isEnabled;
  }

  connect(target: string): void {
    const clean = target.trim();
    this.saveTarget(this.currentId, clean);
    this.adapters[this.currentId].connect(clean);
  }

  disconnect(): void {
    this.adapters[this.currentId].disconnect();
  }

  private loadSavedPlatformId(): PlatformId {
    try {
      const raw = localStorage.getItem(ACTIVE_PLATFORM_KEY);
      if (isValidPlatformId(raw)) return raw;
    } catch {
      // ignore storage errors
    }
    return 'tiktok';
  }

  private saveTarget(id: PlatformId, target: string): void {
    try {
      localStorage.setItem(`${PLATFORM_TARGET_KEY_PREFIX}${id}`, target);
    } catch {
      // ignore storage errors
    }
  }

  private loadTarget(id: PlatformId): string {
    try {
      const saved = localStorage.getItem(`${PLATFORM_TARGET_KEY_PREFIX}${id}`);
      if (saved !== null) return saved;
    } catch {
      // ignore storage errors
    }
    return getPlatformPreset(id).labels.wsDefaultUrl;
  }

  saveCurrentPlatformGifts(): void {
    try {
      localStorage.setItem(
        `${PLATFORM_GIFTS_KEY_PREFIX}${this.currentId}`,
        JSON.stringify(state.giftSlots)
      );
    } catch {
      // ignore storage errors
    }
  }

  private loadPlatformGifts(id: PlatformId): PlatformGiftSlot[] {
    try {
      const raw = localStorage.getItem(`${PLATFORM_GIFTS_KEY_PREFIX}${id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as PlatformGiftSlot[];
        if (Array.isArray(parsed) && parsed.length === 8) {
          return structuredClone(parsed);
        }
      }
    } catch {
      // fallback to preset defaults
    }
    return structuredClone(getPlatformPreset(id).defaultGiftSlots);
  }

  private applyPlatformGifts(slots: PlatformGiftSlot[]): void {
    state.giftSlots = state.giftSlots.map((existing, idx) => {
      const next = slots[idx];
      return next ? { ...existing, ...next } : existing;
    });
  }

  applyCurrentPresetToDOM(): void {
    const preset = this.getActivePreset();
    const root = document.documentElement;
    root.style.setProperty('--sz-top', preset.safeZones.top);
    root.style.setProperty('--sz-bottom', preset.safeZones.bottom);
    root.style.setProperty('--sz-left', preset.safeZones.left);
    root.style.setProperty('--sz-right', preset.safeZones.right);

    const setLabel = (selector: string, text: string) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    };
    setLabel('#safeZoneGuide .sz-top', preset.safeZones.topLabel);
    setLabel('#safeZoneGuide .sz-bottom', preset.safeZones.bottomLabel);
    setLabel('#safeZoneGuide .sz-right', preset.safeZones.rightLabel);
    setLabel('#safeZoneGuide .sz-left', preset.safeZones.leftLabel);

    const wsTitle = document.getElementById('wsSectionTitle');
    if (wsTitle) wsTitle.textContent = preset.labels.wsTitle;
    const wsHint = document.getElementById('wsSectionHint');
    if (wsHint) wsHint.textContent = preset.labels.wsHint;
    const wsUrlInput = document.getElementById('wsUrl') as HTMLInputElement | null;
    if (wsUrlInput) {
      wsUrlInput.value = this.loadTarget(this.currentId);
      wsUrlInput.placeholder =
        this.currentId === 'twitch'
          ? 'tu_canal o ws://localhost:8080/'
          : this.currentId === 'facebook'
            ? 'JWT Token de StreamElements o ws://'
            : 'ws://localhost:21213/';
    }
  }

  init(): void {
    const hasTikTokSaved = Boolean(localStorage.getItem(`${PLATFORM_GIFTS_KEY_PREFIX}tiktok`));
    if (this.currentId === 'tiktok' && !hasTikTokSaved) {
      this.saveCurrentPlatformGifts();
    } else if (this.currentId !== 'tiktok') {
      this.applyPlatformGifts(this.loadPlatformGifts(this.currentId));
    }
    this.applyCurrentPresetToDOM();
  }

  switchPlatform(nextId: PlatformId): PlatformPreset {
    if (nextId !== this.currentId) {
      this.disconnect();
      this.saveCurrentPlatformGifts();
      this.currentId = nextId;
      try {
        localStorage.setItem(ACTIVE_PLATFORM_KEY, nextId);
      } catch {
        // ignore storage errors
      }
      this.applyPlatformGifts(this.loadPlatformGifts(nextId));
      savePersistentState();
    }
    this.applyCurrentPresetToDOM();
    return this.getActivePreset();
  }
}