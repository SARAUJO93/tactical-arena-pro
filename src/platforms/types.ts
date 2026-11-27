export type PlatformId = 'tiktok' | 'twitch' | 'facebook';

export interface PlatformSafeZones {
  top: string;
  bottom: string;
  left: string;
  right: string;
  topLabel: string;
  bottomLabel: string;
  rightLabel: string;
  leftLabel: string;
}

export interface PlatformGiftSlot {
  tier: number;
  emoji: string;
  label: string;
  display: string;
  matchers: string;
  coins: number;
  imgUrl: string;
}

export interface PlatformLabels {
  currencyEmoji: string;
  currencyName: string;
  tapAction: string;
  tapRulePrefix: string;
  wsTitle: string;
  wsDefaultUrl: string;
  wsHint: string;
  tickerTips: string[];
}

export interface PlatformPreset {
  id: PlatformId;
  name: string;
  shortName: string;
  icon: string;
  accent: string;
  safeZones: PlatformSafeZones;
  labels: PlatformLabels;
  defaultGiftSlots: PlatformGiftSlot[];
}