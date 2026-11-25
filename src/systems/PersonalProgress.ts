import { PlayerRecord } from '../core/GameState';

export interface PersonalRankInfo {
  level: number;
  title: string;
  xp: number;
  nextLevelXp: number | null;
  progressPct: number;
}

export interface PersonalProgressUpdate extends PersonalRankInfo {
  sessionTaps: number;
  leveledUp: boolean;
  milestoneLabel: string | null;
}

interface SessionViewerProgress {
  taps: number;
  gifts: number;
  follows: number;
  shares: number;
  coins: number;
  lastLevel: number;
  lastTapMilestone: number;
}

const RANK_TIERS: ReadonlyArray<{ xp: number; title: string }> = [
  { xp: 0, title: 'Recluta' },
  { xp: 30, title: 'Soldado' },
  { xp: 80, title: 'Cabo' },
  { xp: 160, title: 'Sargento' },
  { xp: 280, title: 'Capitán' },
  { xp: 450, title: 'Comandante' },
  { xp: 700, title: 'General' },
  { xp: 1050, title: 'Leyenda' },
];

const TAP_MILESTONES = [15, 50, 100, 250, 500, 1000] as const;
const MAX_TRACKED_VIEWERS = 500;

export function computePersonalRank(xpRaw: number): PersonalRankInfo {
  const xp = Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  let tierIdx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (xp >= RANK_TIERS[i].xp) tierIdx = i;
    else break;
  }

  const current = RANK_TIERS[tierIdx];
  const next = RANK_TIERS[tierIdx + 1] ?? null;
  const progressPct = next
    ? Math.min(100, Math.round(((xp - current.xp) / Math.max(1, next.xp - current.xp)) * 100))
    : 100;

  return {
    level: tierIdx + 1,
    title: current.title,
    xp,
    nextLevelXp: next ? next.xp : null,
    progressPct,
  };
}

export function computeXpFromRecord(rec: PlayerRecord | undefined): number {
  if (!rec) return 0;
  return (
    rec.lifetime.taps +
    rec.lifetime.gifts * 15 +
    rec.lifetime.follows * 25 +
    rec.lifetime.shares * 40 +
    rec.mvpRounds * 60 +
    Math.floor(Math.sqrt(Math.max(0, rec.lifetime.coins)) * 5)
  );
}

export class PersonalProgressTracker {
  private viewers = new Map<string, SessionViewerProgress>();

  resetSession(): void {
    this.viewers.clear();
  }

  getRank(user: string, persisted?: PlayerRecord): PersonalRankInfo {
    const clean = this.normalize(user);
    const session = this.viewers.get(clean);
    const xp = persisted ? computeXpFromRecord(persisted) : this.computeSessionXp(session);
    return computePersonalRank(xp);
  }

  recordAction(
    user: string,
    kind: 'tap' | 'gift' | 'follow' | 'share',
    amount: number,
    coins = 0,
    persisted?: PlayerRecord
  ): PersonalProgressUpdate {
    const clean = this.normalize(user);
    const entry = this.ensureEntry(clean, persisted);
    const safeAmount = Number.isFinite(amount) ? Math.max(1, Math.floor(amount)) : 1;
    const safeCoins = Number.isFinite(coins) ? Math.max(0, coins) : 0;

    if (kind === 'tap') entry.taps += safeAmount;
    else if (kind === 'gift') {
      entry.gifts += safeAmount;
      entry.coins += safeCoins * safeAmount;
    } else if (kind === 'follow') entry.follows += safeAmount;
    else if (kind === 'share') entry.shares += safeAmount;

    const xp = persisted ? computeXpFromRecord(persisted) : this.computeSessionXp(entry);
    const rank = computePersonalRank(xp);
    const leveledUp = rank.level > entry.lastLevel;
    if (leveledUp) entry.lastLevel = rank.level;

    let milestoneLabel: string | null = null;
    if (kind === 'tap') {
      for (const m of TAP_MILESTONES) {
        if (entry.taps >= m && entry.lastTapMilestone < m) {
          entry.lastTapMilestone = m;
          milestoneLabel = `${m} Taps en el Live`;
        }
      }
    }

    return {
      ...rank,
      sessionTaps: entry.taps,
      leveledUp,
      milestoneLabel,
    };
  }

  private normalize(user: string): string {
    const trimmed = (user || 'Viewer').trim();
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  }

  private computeSessionXp(entry: SessionViewerProgress | undefined): number {
    if (!entry) return 0;
    return (
      entry.taps +
      entry.gifts * 15 +
      entry.follows * 25 +
      entry.shares * 40 +
      Math.floor(Math.sqrt(Math.max(0, entry.coins)) * 5)
    );
  }

  private ensureEntry(clean: string, persisted?: PlayerRecord): SessionViewerProgress {
    const existing = this.viewers.get(clean);
    if (existing) {
      this.viewers.delete(clean);
      this.viewers.set(clean, existing);
      return existing;
    }
    if (this.viewers.size >= MAX_TRACKED_VIEWERS) {
      const oldest = this.viewers.keys().next().value;
      if (oldest !== undefined) this.viewers.delete(oldest);
    }
    const initialLevel = persisted ? computePersonalRank(computeXpFromRecord(persisted)).level : 1;
    const created: SessionViewerProgress = {
      taps: 0,
      gifts: 0,
      follows: 0,
      shares: 0,
      coins: 0,
      lastLevel: initialLevel,
      lastTapMilestone: 0,
    };
    this.viewers.set(clean, created);
    return created;
  }
}