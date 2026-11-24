export type TeamId = 'A' | 'B';
export type UnitOrderKind = 'INFANTRY' | 'TANK' | 'JET';
export type InstantActionKind = 'SHIELD' | 'EMP' | 'CYBER_HACK' | 'NUCLEAR' | 'METEOR_SHOWER';
export type OrderPriority = 1 | 2 | 3; // 1: VIP Regalo, 2: Tap/Follow/Share, 3: Auto-IA

export interface DeployOrder {
  id: string;
  team: TeamId;
  kind: UnitOrderKind;
  cost: number;
  priority: OrderPriority;
  user: string;
  avatarUrl: string;
  veteranRank: number; // 1 = normal, 2..5 = fusionado/potenciado
  isPaidGift: boolean;
  isTapBadge?: boolean;
  enqueuedAt: number;
}

export interface GameEvents {
  'tikfinity:status': { status: 'connected' | 'reconnecting' | 'offline'; detail?: string };
  'game:chat': { user: string; comment: string; avatarUrl: string };
  'game:tap': { user: string; count: number; avatarUrl: string; forcedTeam?: TeamId; isDemo?: boolean };
  'game:follow': { user: string; avatarUrl: string; isDemo?: boolean };
  'game:share': { user: string; avatarUrl: string; isDemo?: boolean };
  'game:gift': {
    team: TeamId;
    tier: number;
    delta: number;
    user: string;
    giftName: string;
    avatarUrl: string;
    coins: number;
    isDemo?: boolean;
  };
  'elixir:updated': {
    team: TeamId;
    elixir: number;
    maxElixir: number;
    ratePerSec: number;
    queueLength: number;
    nextCost: number | null;
  };
  'elixir:deploy': DeployOrder;
  'action:instant': {
    team: TeamId;
    kind: InstantActionKind;
    user: string;
    avatarUrl: string;
    giftName?: string;
    mult?: number;
  };
}

type Listener<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<keyof GameEvents, Listener<never>[]>();

  on<K extends keyof GameEvents>(event: K, callback: Listener<GameEvents[K]>): () => void {
    const list = this.listeners.get(event) ?? [];
    list.push(callback as Listener<never>);
    this.listeners.set(event, list);
    return () => {
      const current = this.listeners.get(event);
      if (current) {
        this.listeners.set(
          event,
          current.filter((cb) => cb !== (callback as Listener<never>))
        );
      }
    };
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.listeners.get(event)?.forEach((cb) => (cb as Listener<GameEvents[K]>)(payload));
  }
}

export const bus = new EventBus();