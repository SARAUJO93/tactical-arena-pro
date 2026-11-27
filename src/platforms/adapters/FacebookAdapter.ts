import { bus } from '../../core/EventBus';
import { resolveUserTeam } from '../../systems/GiftMapper';
import { logWsEvent } from '../../systems/Telemetry';
import { PlatformAdapter } from './types';

function mapStarsToTier(stars: number): number {
  if (stars >= 1000) return 4; // Nuclear
  if (stars >= 500) return 7;  // Cyber Hack
  if (stars >= 300) return 6;  // EMP
  if (stars >= 200) return 3;  // Jet
  if (stars >= 150) return 5;  // Escudo
  if (stars >= 50) return 2;   // Tanque
  return 1;                    // Soldados
}

export class FacebookAdapter implements PlatformAdapter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private target = '';

  get isEnabled(): boolean {
    return this.enabled;
  }

  connect(target: string): void {
    const clean = target.trim();
    if (!clean) {
      logWsEvent('FB Live: pega tu JWT Token de StreamElements o una URL ws://');
      return;
    }
    this.disconnect();
    this.enabled = true;
    this.target = clean;
    this.openSocket();
  }

  disconnect(): void {
    this.enabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    bus.emit('tikfinity:status', { status: 'offline' });
  }

  private openSocket(): void {
    if (!this.enabled) return;
    const isCustomWs = /^wss?:\/\//i.test(this.target);
    const url = isCustomWs
      ? this.target
      : 'wss://realtime.streamelements.com/socket.io/?EIO=3&transport=websocket';

    bus.emit('tikfinity:status', { status: 'reconnecting', detail: 'FB Live...' });
    logWsEvent(`Facebook Live conectando (${isCustomWs ? url : 'StreamElements Realtime'})...`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (isCustomWs) {
        bus.emit('tikfinity:status', { status: 'connected' });
        logWsEvent('Facebook Live conectado (Bridge WS).');
      } else {
        // Autenticación JWT en StreamElements Socket.IO v2/EIO3
        ws.send(`42["authenticate",{"method":"jwt","token":${JSON.stringify(this.target)}}]`);
        this.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('2');
        }, 25000);
      }
    };

    ws.onmessage = (ev) => {
      const text = String(ev.data || '');
      if (isCustomWs) {
        this.handleNormalizedEvent(text);
        return;
      }
      if (text === '2') {
        ws.send('3');
        return;
      }
      if (!text.startsWith('42')) return;
      try {
        const [eventName, payload] = JSON.parse(text.slice(2)) as [string, Record<string, unknown>];
        if (eventName === 'authenticated') {
          bus.emit('tikfinity:status', { status: 'connected' });
          logWsEvent('Facebook Live conectado vía StreamElements.');
        } else if (eventName === 'unauthorized') {
          logWsEvent('FB Live: JWT Token inválido en StreamElements.');
          this.disconnect();
        } else if (eventName === 'event' && payload) {
          this.handleStreamElementsEvent(payload);
        }
      } catch {
        // ignorar tramas no parseables
      }
    };

    ws.onerror = () => {
      logWsEvent('Facebook Live: error de conexión WebSocket.');
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (!this.enabled) return;
      bus.emit('tikfinity:status', { status: 'reconnecting', detail: 'Reconectando...' });
      this.reconnectTimer = setTimeout(() => this.openSocket(), 4000);
    };
  }

  private handleStreamElementsEvent(payload: Record<string, unknown>): void {
    const type = String(payload.type || '').toLowerCase();
    const data = (payload.data as Record<string, unknown>) || {};
    const user = String(data.username || data.displayName || 'FBViewer');
    const avatarUrl = String(data.avatar || '');
    const amount = Number(data.amount || 0);
    const message = String(data.message || '').trim();

    if (message) {
      bus.emit('game:chat', { user, comment: message, avatarUrl });
    }

    if (type === 'stars' || type === 'tip' || type === 'supporter') {
      const stars = Math.max(10, amount || 50);
      bus.emit('game:gift', {
        team: resolveUserTeam(user),
        tier: mapStarsToTier(stars),
        delta: 1,
        user,
        giftName: type === 'stars' ? `${stars} Estrellas` : type === 'supporter' ? 'Supporter' : `Tip $${stars}`,
        avatarUrl,
        coins: stars,
      });
    } else if (type === 'like') {
      bus.emit('game:tap', { user, count: 5, avatarUrl });
    } else if (type === 'share') {
      bus.emit('game:share', { user, avatarUrl });
    } else if (type === 'follow') {
      bus.emit('game:follow', { user, avatarUrl });
    }
  }

  private handleNormalizedEvent(raw: string): void {
    try {
      const msg = JSON.parse(raw) as Record<string, unknown>;
      const type = String(msg.type || msg.event || '').toLowerCase();
      const data = (msg.data as Record<string, unknown>) || msg;
      const user = String(data.user || data.username || 'FBViewer');
      const avatarUrl = String(data.avatarUrl || '');

      if (type.includes('comment') || type.includes('chat')) {
        const comment = String(data.comment || data.message || '').trim();
        if (comment) {
          bus.emit('game:chat', { user, comment, avatarUrl });
          bus.emit('game:tap', { user, count: 3, avatarUrl });
        }
      } else if (type.includes('like') || type.includes('reaction')) {
        bus.emit('game:tap', { user, count: Number(data.count || 5), avatarUrl });
      } else if (type.includes('share')) {
        bus.emit('game:share', { user, avatarUrl });
      } else if (type.includes('follow')) {
        bus.emit('game:follow', { user, avatarUrl });
      } else if (type.includes('star') || type.includes('gift') || type.includes('tip')) {
        const stars = Math.max(10, Number(data.stars || data.amount || 10));
        bus.emit('game:gift', {
          team: resolveUserTeam(user),
          tier: mapStarsToTier(stars),
          delta: 1,
          user,
          giftName: `${stars} ⭐`,
          avatarUrl,
          coins: stars,
        });
      }
    } catch {
      // ignorar payloads no JSON
    }
  }
}