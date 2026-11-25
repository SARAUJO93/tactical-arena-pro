import { TeamId } from '../core/EventBus';

export type BigGiftKind = 'nuclear' | 'emp' | 'hack';

export const MVP_PARTICIPATION_POINTS = {
  TAP_BATCH: 25,
  FOLLOW: 40,
  SHARE: 80,
} as const;

const IMPACT_SCALES = [1.0, 0.6, 0.35] as const;

export class RoundImpactLimiter {
  private counts: Record<TeamId, Record<BigGiftKind, number>> = {
    A: { nuclear: 0, emp: 0, hack: 0 },
    B: { nuclear: 0, emp: 0, hack: 0 },
  };

  reset(): void {
    this.counts = {
      A: { nuclear: 0, emp: 0, hack: 0 },
      B: { nuclear: 0, emp: 0, hack: 0 },
    };
  }

  consume(team: TeamId, kind: BigGiftKind): { scale: number; useCount: number } {
    const useCount = ++this.counts[team][kind];
    const idx = Math.min(useCount - 1, IMPACT_SCALES.length - 1);
    return { scale: IMPACT_SCALES[idx], useCount };
  }
}

/**
 * Curva con tope para que un solo regalo caro no bloquee el MVP
 * a espectadores muy activos con taps, follows y shares.
 */
export function calculateGiftMvpPoints(coins: number, delta: number): number {
  const safeCoins = Number.isFinite(coins) ? Math.max(1, coins) : 1;
  const safeDelta = Number.isFinite(delta) ? Math.max(1, Math.floor(delta)) : 1;
  const perUnit = Math.round(Math.min(180, 15 + Math.sqrt(safeCoins) * 12));
  return perUnit * Math.min(safeDelta, 5);
}

/**
 * Pequeño impulso de elixir para el bando en desventaja cuando
 * el rival recibe un regalo.
 */
export function calculateUnderdogElixirBonus(tier: number, delta: number): number {
  const safeDelta = Number.isFinite(delta) ? Math.max(1, Math.floor(delta)) : 1;
  if (tier === 4) return 1.2;
  if (tier === 6 || tier === 7) return 0.8;
  return Math.min(0.6, Math.round(0.15 * safeDelta * 100) / 100);
}