import { bus } from '../core/EventBus';
import { computeTikFinityDelta, routeGiftV2 } from '../systems/GiftMapper';
import { logWsEvent } from '../systems/Telemetry';

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
          tier: Math.max(1, Math.min(7, Number(msg.tier))),
          delta: msg.count || 1,
          user: msg.user || 'TikTok',
          giftName: msg.gift || 'Regalo',
          avatarUrl: msg.avatar || '',
          coins: msg.coins || 1,
          isDemo: false,
        });
        return;
      }

      const d = msg.data || {};
      const user = d.uniqueId || d.nickname || 'Viewer';
      const avatarUrl = d.profilePictureUrl || '';

      if (msg.event === 'chat') bus.emit('game:chat', { user, comment: d.comment || '', avatarUrl });
      else if (msg.event === 'like') bus.emit('game:tap', { user, count: Number(d.likeCount || 1), avatarUrl, isDemo: false });
      else if (msg.event === 'follow') bus.emit('game:follow', { user, avatarUrl, isDemo: false });
      else if (msg.event === 'share') bus.emit('game:share', { user, avatarUrl, isDemo: false });
      else if (msg.event === 'gift') {
        const delta = computeTikFinityDelta(d.userId || user, d.giftId || d.giftName, d.msgId, d.repeatCount, d.repeatEnd);
        if (delta <= 0) return;
        const gName = d.giftName || 'Regalo';
        const coins = Number(d.diamondCount || 1);
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