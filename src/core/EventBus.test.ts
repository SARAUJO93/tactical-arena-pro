import { afterEach, describe, expect, it } from 'vitest';
import { bus } from './EventBus';

describe('EventBus', () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    for (const unsubscribe of unsubscribers) unsubscribe();
    unsubscribers.length = 0;
  });

  it('emite payload tipado y permite baja de listener', () => {
    const received: Array<{ status: 'connected' | 'reconnecting' | 'offline'; detail?: string }> = [];
    unsubscribers.push(bus.on('tikfinity:status', (payload) => received.push(payload)));

    bus.emit('tikfinity:status', { status: 'connected' });
    bus.emit('tikfinity:status', { status: 'reconnecting', detail: 'Reintentando' });

    expect(received).toEqual([
      { status: 'connected' },
      { status: 'reconnecting', detail: 'Reintentando' },
    ]);
  });

  it('unsubscribe evita entregas posteriores', () => {
    let callCount = 0;
    const unsubscribe = bus.on('elixir:updated', () => { callCount++; });
    bus.emit('elixir:updated', {
      team: 'A',
      elixir: 5,
      maxElixir: 10,
      ratePerSec: 0.45,
      queueLength: 0,
      nextCost: null,
    });
    unsubscribe();
    bus.emit('elixir:updated', {
      team: 'B',
      elixir: 6,
      maxElixir: 10,
      ratePerSec: 0.45,
      queueLength: 1,
      nextCost: 2,
    });

    expect(callCount).toBe(1);
  });

  it('varios listeners reciben el mismo evento', () => {
    const calls: string[] = [];
    unsubscribers.push(bus.on('game:follow', (payload) => calls.push(`first:${payload.user}`)));
    unsubscribers.push(bus.on('game:follow', (payload) => calls.push(`second:${payload.user}`)));

    bus.emit('game:follow', { user: '@fan', avatarUrl: '', isDemo: true });

    expect(calls).toEqual(['first:@fan', 'second:@fan']);
  });
});
