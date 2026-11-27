import { bus } from '../../core/EventBus';
import { resolveUserTeam } from '../../systems/GiftMapper';
import { logWsEvent } from '../../systems/Telemetry';
import { PlatformAdapter } from './types';

function mapAmountToTier(amount: number): number {
  if (amount >= 1000) return 4; // Nuclear
  if (amount >= 500) return 7;  // Cyber Hack
  if (amount >= 300) return 6;  // EMP
  if (amount >= 200) return 3;  // Jet
  if (amount >= 150) return 5;  // Escudo
  if (amount >= 50) return 2;   // Tanque
  return 1;                     // Soldados
}

function parseIrcTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  if (!raw.startsWith('@')) return tags;
  for (const part of raw.slice(1).split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) tags[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return tags;
}

export class TwitchAdapter implements PlatformAdapter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;
  private target = '';

  get isEnabled(): boolean {
    return this.enabled;
  }

  connect(target: string): void {
    const clean = target.trim();
    if (!clean) {
      logWsEvent('Twitch: escribe tu nombre de canal o una URL ws://');
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
    const url = isCustomWs ? this.target : 'wss://irc-ws.chat.twitch.tv:443';

    bus.emit('tikfinity:status', { status: 'reconnecting', detail: 'Twitch...' });
    logWsEvent(`Twitch conectando a ${isCustomWs ? url : `#${this.target.replace(/^#/, '')}`}`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (!isCustomWs) {
        const channel = this.target.replace(/^#/, '').toLowerCase();
        const anonNick = `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('PASS SCHMOOPIIE');
        ws.send(`NICK ${anonNick}`);
        ws.send(`JOIN #${channel}`);
      }
      bus.emit('tikfinity:status', { status: 'connected' });
      logWsEvent(`Twitch conectado (${isCustomWs ? 'Bridge WS' : `#${this.target.replace(/^#/, '')}`}).`);
    };

    ws.onmessage = (ev) => {
      const text = String(ev.data || '');
      if (isCustomWs) {
        this.handleBridgeJson(text);
        return;
      }
      for (const line of text.split('\r\n')) {
        if (!line) continue;
        if (line.startsWith('PING')) {
          ws.send(line.replace('PING', 'PONG'));
          continue;
        }
        this.handleIrcLine(line);
      }
    };

    ws.onerror = () => {
      logWsEvent('Twitch: error de conexión WebSocket.');
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.enabled) return;
      bus.emit('tikfinity:status', { status: 'reconnecting', detail: 'Reconectando...' });
      this.reconnectTimer = setTimeout(() => this.openSocket(), 4000);
    };
  }

  private handleIrcLine(line: string): void {
    const privIdx = line.indexOf(' PRIVMSG #');
    if (privIdx === -1) return;

    const tagsEnd = line.startsWith('@') ? line.indexOf(' ') : -1;
    const tags = tagsEnd > 0 ? parseIrcTags(line.slice(0, tagsEnd)) : {};
    const msgIdx = line.indexOf(' :', privIdx);
    if (msgIdx === -1) return;

    const comment = line.slice(msgIdx + 2).trim();
    const user = tags['display-name'] || 'TwitchViewer';
    const bits = Number(tags['bits'] || 0);

    if (comment) {
      bus.emit('game:chat', { user, comment, avatarUrl: '' });
      // Cada mensaje activo suma progreso como taps
      bus.emit('game:tap', { user, count: 3, avatarUrl: '' });
    }

    if (bits > 0) {
      const team = resolveUserTeam(user);
      bus.emit('game:gift', {
        team,
        tier: mapAmountToTier(bits),
        delta: 1,
        user,
        giftName: `${bits} Bits`,
        avatarUrl: '',
        coins: bits,
      });
    }
  }

  private handleBridgeJson(raw: string): void {
    try {
      const msg = JSON.parse(raw) as Record<string, unknown>;
      const type = String(msg.type || msg.event || '').toLowerCase();
      const data = (msg.data as Record<string, unknown>) || msg;
      const user = String(data.user || data.username || data.displayName || 'TwitchUser');
      const avatarUrl = String(data.avatarUrl || '');

      if (type.includes('chat') || type.includes('message')) {
        const comment = String(data.comment || data.message || '').trim();
        if (comment) {
          bus.emit('game:chat', { user, comment, avatarUrl });
          bus.emit('game:tap', { user, count: 3, avatarUrl });
        }
      } else if (type.includes('follow')) {
        bus.emit('game:follow', { user, avatarUrl });
      } else if (type.includes('raid')) {
        const viewers = Math.max(1, Number(data.viewers || 1));
        bus.emit('game:gift', {
          team: resolveUserTeam(user),
          tier: 4,
          delta: 1,
          user,
          giftName: `Raid x${viewers}`,
          avatarUrl,
          coins: viewers * 10,
        });
      } else if (type.includes('sub')) {
        const count = Math.max(1, Number(data.count || data.gifts || 1));
        bus.emit('game:gift', {
          team: resolveUserTeam(user),
          tier: count >= 5 ? 4 : count >= 3 ? 7 : count >= 2 ? 6 : 3,
          delta: 1,
          user,
          giftName: count > 1 ? `${count} Subs` : 'Sub',
          avatarUrl,
          coins: count * 200,
        });
      } else if (type.includes('bit') || type.includes('cheer') || type.includes('redeem')) {
        const amount = Math.max(1, Number(data.bits || data.amount || data.cost || 10));
        bus.emit('game:gift', {
          team: resolveUserTeam(user),
          tier: mapAmountToTier(amount),
          delta: 1,
          user,
          giftName: String(data.reward || `${amount} Bits`),
          avatarUrl,
          coins: amount,
        });
      }
    } catch {
      // ignorar payloads no JSON
    }
  }
}