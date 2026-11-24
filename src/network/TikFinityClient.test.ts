import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bus, GameEvents } from '../core/EventBus';
import { DEFAULT_GIFT_SLOTS, makeBaseState, state, WORLD_ROSTER } from '../core/GameState';
import { clearComboDeltaTracker } from '../systems/GiftMapper';
import { TikFinityClient } from './TikFinityClient';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
    this.onclose?.();
  }

  emitOpen(): void {
    this.onopen?.();
  }

  emitMessage(payload: unknown): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.onmessage?.({ data });
  }

  emitClose(): void {
    this.onclose?.();
  }
}

describe('TikFinityClient', () => {
  let client: TikFinityClient;
  let unsubs: (() => void)[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);

    clearComboDeltaTracker();
    state.viewerTeams.clear();
    state.giftSlots = structuredClone(DEFAULT_GIFT_SLOTS);
    state.teamA = makeBaseState(WORLD_ROSTER[0], true);
    state.teamB = makeBaseState(WORLD_ROSTER[1], false);
    state.telemetry.wsLog = [];

    client = new TikFinityClient();
    unsubs = [];
  });

  afterEach(() => {
    client.disconnect();
    unsubs.forEach((u) => u());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('emite estados reconnecting -> connected y vuelve a offline al desconectar', () => {
    const statuses: GameEvents['tikfinity:status'][] = [];
    unsubs.push(bus.on('tikfinity:status', (s) => statuses.push(s)));

    client.connect('ws://localhost:21213/');
    expect(client.isEnabled).toBe(true);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(statuses[0].status).toBe('reconnecting');

    FakeWebSocket.instances[0].emitOpen();
    expect(statuses[1].status).toBe('connected');

    client.disconnect();
    expect(client.isEnabled).toBe(false);
    expect(statuses.at(-1)?.status).toBe('offline');
  });

  it('reintenta conexión con backoff exponencial al caer el socket', () => {
    client.connect('ws://localhost:21213/');
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Primera caída: reintenta en 1s
    FakeWebSocket.instances[0].emitClose();
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // Segunda caída: reintenta en 2s
    FakeWebSocket.instances[1].emitClose();
    vi.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('procesa eventos chat, like, follow y share de TikFinity', () => {
    const chats: GameEvents['game:chat'][] = [];
    const taps: GameEvents['game:tap'][] = [];
    const follows: GameEvents['game:follow'][] = [];
    const shares: GameEvents['game:share'][] = [];

    unsubs.push(
      bus.on('game:chat', (e) => chats.push(e)),
      bus.on('game:tap', (e) => taps.push(e)),
      bus.on('game:follow', (e) => follows.push(e)),
      bus.on('game:share', (e) => shares.push(e))
    );

    client.connect('ws://localhost:21213/');
    const ws = FakeWebSocket.instances[0];

    ws.emitMessage({ event: 'chat', data: { uniqueId: 'carlos', comment: 'MX', profilePictureUrl: 'https://a/1.png' } });
    ws.emitMessage({ event: 'like', data: { uniqueId: 'sofia', likeCount: 15 } });
    ws.emitMessage({ event: 'follow', data: { nickname: 'mateo' } });
    ws.emitMessage({ event: 'share', data: { uniqueId: 'kira' } });

    expect(chats).toEqual([{ user: 'carlos', comment: 'MX', avatarUrl: 'https://a/1.png' }]);
    expect(taps).toEqual([{ user: 'sofia', count: 15, avatarUrl: '', isDemo: false }]);
    expect(follows).toEqual([{ user: 'mateo', avatarUrl: '', isDemo: false }]);
    expect(shares).toEqual([{ user: 'kira', avatarUrl: '', isDemo: false }]);
  });

  it('procesa combos de regalos TikFinity calculando deltas incrementales', () => {
    const gifts: GameEvents['game:gift'][] = [];
    unsubs.push(bus.on('game:gift', (g) => gifts.push(g)));

    client.connect('ws://localhost:21213/');
    const ws = FakeWebSocket.instances[0];

    ws.emitMessage({
      event: 'gift',
      data: { userId: 'u1', uniqueId: 'vip1', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: 1, repeatEnd: false },
    });
    ws.emitMessage({
      event: 'gift',
      data: { userId: 'u1', uniqueId: 'vip1', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: 4, repeatEnd: false },
    });
    // Repetición duplicada (delta = 0) no debe emitir evento
    ws.emitMessage({
      event: 'gift',
      data: { userId: 'u1', uniqueId: 'vip1', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: 4, repeatEnd: true },
    });

    expect(gifts).toHaveLength(2);
    expect(gifts[0]).toMatchObject({ team: 'A', tier: 1, delta: 1, user: 'vip1', isDemo: false });
    expect(gifts[1]).toMatchObject({ team: 'A', tier: 1, delta: 3, user: 'vip1', isDemo: false });
  });

  it('soporta payloads manuales directos y acota tier entre 1 y 7', () => {
    const gifts: GameEvents['game:gift'][] = [];
    unsubs.push(bus.on('game:gift', (g) => gifts.push(g)));

    client.connect('ws://localhost:21213/');
    const ws = FakeWebSocket.instances[0];

    ws.emitMessage({ team: 'b', tier: 99, count: 2, user: '@admin', gift: 'Test', coins: 50 });

    expect(gifts).toHaveLength(1);
    expect(gifts[0]).toEqual({
      team: 'B',
      tier: 7,
      delta: 2,
      user: '@admin',
      giftName: 'Test',
      avatarUrl: '',
      coins: 50,
      isDemo: false,
    });
  });

  it('ignora mensajes JSON malformados sin lanzar errores', () => {
    const gifts: GameEvents['game:gift'][] = [];
    unsubs.push(bus.on('game:gift', (g) => gifts.push(g)));

    client.connect('ws://localhost:21213/');
    const ws = FakeWebSocket.instances[0];

    expect(() => ws.emitMessage('{json roto')).not.toThrow();
    expect(gifts).toHaveLength(0);
  });
});