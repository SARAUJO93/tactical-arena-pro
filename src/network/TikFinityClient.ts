import { bus } from '../core/EventBus';
import { computeTikFinityDelta, routeGiftV2 } from '../systems/GiftMapper';
import { logWsEvent } from '../systems/Telemetry';

const MAX_REPEATS = 1000;
const MAX_COINS = 1000000;

function finiteInteger(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeText(value: unknown, fallback: string, maxLength = 64): string {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : fallback;
}

export class TikFinityClient {
  private ws: WebSocket | null = null;
  private userEnabled = false;
  private backoff = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentUrl = 'ws://localhost:21213/';

  get isEnabled(): boolean {
    return this.userEnabled;
  }

  connect(url: string): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.currentUrl = url.trim();
    if (!this.currentUrl) return;

    this.userEnabled = true;
    bus.emit('tikfinity:status', { status: 'reconnecting', detail: 'Conectando...' });
    logWsEvent(`Conectando a ${this.currentUrl}...`);

    try {
      this.ws = new WebSocket(this.currentUrl);
      this.ws.onopen = () => {
        this.backoff = 1000;
        bus.emit('tikfinity:status', { status: 'connected' });
        logWsEvent('Conectado a TikFinity.');
      };
      this.ws.onmessage = (ev) => this.handleMessage(String(ev.data));
      this.ws.onerror = () => {};
      this.ws.onclose = () => {
        this.ws = null;
        if (!this.userEnabled) {
          bus.emit('tikfinity:status', { status: 'offline' });
          return;
        }
        const sec = Math.ceil(this.backoff / 1000);
        bus.emit('tikfinity:status', { status: 'reconnecting', detail: `Reintento ${sec}s` });
        logWsEvent(`Desconectado. Reintento en ${sec}s.`);
        this.reconnectTimer = setTimeout(() => {
          this.backoff = Math.min(15000, this.backoff * 2);
          this.connect(this.currentUrl);
        }, this.backoff);
      };
    } catch {
      bus.emit('tikfinity:status', { status: 'offline' });
    }
  }

  disconnect(): void {
    this.userEnabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    bus.emit('tikfinity:status', { status: 'offline' });
    logWsEvent('Desconectado manualmente.');
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg.team && msg.tier) {
        bus.emit('game:gift', {
          team: String(msg.team).toUpperCase() === 'B' ? 'B' : 'A',
          tier: finiteInteger(msg.tier, 1, 1, 7),
          delta: finiteInteger(msg.count, 1, 1, MAX_REPEATS),
          user: safeText(msg.user, 'TikTok', 64),
          giftName: safeText(msg.gift, 'Regalo', 64),
          avatarUrl: safeText(msg.avatar, '', 300),
          coins: finiteInteger(msg.coins, 1, 1, MAX_COINS),
          isDemo: false,
        });
        return;
      }

      const d = msg.data || {};
      const user = safeText(d.uniqueId || d.nickname, 'Viewer', 64);
      const avatarUrl = safeText(d.profilePictureUrl, '', 300);

      if (msg.event === 'chat') bus.emit('game:chat', { user, comment: d.comment || '', avatarUrl });
      else if (msg.event === 'like') bus.emit('game:tap', {
        user,
        count: finiteInteger(d.likeCount, 1, 1, MAX_REPEATS),
        avatarUrl,
        isDemo: false,
      });
      else if (msg.event === 'follow') bus.emit('game:follow', { user, avatarUrl, isDemo: false });
      else if (msg.event === 'share') bus.emit('game:share', { user, avatarUrl, isDemo: false });
      else if (msg.event === 'gift') {
        const repeatCount = finiteInteger(d.repeatCount, 1, 1, MAX_REPEATS);
        const delta = computeTikFinityDelta(d.userId || user, d.giftId || d.giftName, d.msgId, repeatCount, d.repeatEnd);
        if (delta <= 0) return;
        const gName = safeText(d.giftName, 'Regalo', 64);
        const coins = finiteInteger(d.diamondCount, 1, 1, MAX_COINS);
        const routed = routeGiftV2(d.giftId, gName, coins, user);
        bus.emit('game:gift', {
          team: routed.team,
          tier: routed.tier,
          delta,
          user,
          giftName: gName,
          avatarUrl,
          coins: routed.coins,
          isDemo: false,
        });
      }
    } catch {
      // Ignorar paquetes JSON malformados
    }
  }
}