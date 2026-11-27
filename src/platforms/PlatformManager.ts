import { state, savePersistentState } from '../core/GameState';
import { getPlatformPreset } from './presets';
import { PlatformGiftSlot, PlatformId, PlatformPreset } from './types';

const ACTIVE_PLATFORM_KEY = 'tactical_arena_active_platform_v1';
const PLATFORM_GIFTS_KEY_PREFIX = 'tactical_arena_gifts_v1_';

function isValidPlatformId(val: unknown): val is PlatformId {
  return val === 'tiktok' || val === 'twitch' || val === 'facebook';
}

export class PlatformManager {
  private currentId: PlatformId = 'tiktok';

  constructor() {
    this.currentId = this.loadSavedPlatformId();
  }

  getActiveId(): PlatformId {
    return this.currentId;
  }

  getActivePreset(): PlatformPreset {
    return getPlatformPreset(this.currentId);
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
    if (wsUrlInput && !wsUrlInput.dataset.userEdited) {
      wsUrlInput.value = preset.labels.wsDefaultUrl;
    }
  }

  init(): void {
    // Si es la primera vez en TikTok, preserva los giftSlots actuales de state
    const hasTikTokSaved = Boolean(localStorage.getItem(`${PLATFORM_GIFTS_KEY_PREFIX}tiktok`));
    if (this.currentId === 'tiktok' && !hasTikTokSaved) {
      this.saveCurrentPlatformGifts();
    } else if (this.currentId !== 'tiktok') {
      state.giftSlots = this.loadPlatformGifts(this.currentId);
    }
    this.applyCurrentPresetToDOM();
  }

  switchPlatform(nextId: PlatformId): PlatformPreset {
    if (nextId !== this.currentId) {
      this.saveCurrentPlatformGifts();
      this.currentId = nextId;
      try {
        localStorage.setItem(ACTIVE_PLATFORM_KEY, nextId);
      } catch {
        // ignore storage errors
      }
      state.giftSlots = this.loadPlatformGifts(nextId);
      savePersistentState();
    }
    const wsUrlInput = document.getElementById('wsUrl') as HTMLInputElement | null;
    if (wsUrlInput) delete wsUrlInput.dataset.userEdited;
    this.applyCurrentPresetToDOM();
    return this.getActivePreset();
  }
}