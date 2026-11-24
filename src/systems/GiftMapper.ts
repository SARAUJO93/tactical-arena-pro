import { TeamId } from '../core/EventBus';
import { state } from '../core/GameState';

const COMBO_TTL_MS = 15000;
const comboDeltaTracker = new Map<string, { lastRepeatCount: number; updatedAt: number }>();

function pruneExpiredCombos(now: number): void {
  for (const [k, v] of comboDeltaTracker.entries()) {
    if (now - v.updatedAt > COMBO_TTL_MS) comboDeltaTracker.delete(k);
  }
}

export function clearComboDeltaTracker(): void {
  comboDeltaTracker.clear();
}

export function computeTikFinityDelta(
  userId: string,
  giftId: string | number,
  msgId: string | null | undefined,
  repeatCount: number,
  repeatEnd?: boolean,
  now = Date.now()
): number {
  if (comboDeltaTracker.size > 0) pruneExpiredCombos(now);

  const key = userId && giftId ? `${userId}_${giftId}` : msgId || `${userId}_g`;
  const count = Math.max(1, Number(repeatCount) || 1);
  const prev = comboDeltaTracker.get(key);
  let delta = count;
  if (prev && count >= prev.lastRepeatCount) delta = Math.max(0, count - prev.lastRepeatCount);
  if (repeatEnd === true) comboDeltaTracker.delete(key);
  else comboDeltaTracker.set(key, { lastRepeatCount: count, updatedAt: now });
  return delta;
}

export function resolveUserTeam(user: string): TeamId {
  const clean = (user || 'Viewer').startsWith('@') ? user : `@${user || 'Viewer'}`;
  const existing = state.viewerTeams.get(clean);
  if (existing) return existing;
  return state.teamA.hp <= state.teamB.hp ? 'A' : 'B';
}

export function registerChatAlignment(user: string, comment: string): TeamId | null {
  const clean = (user || 'Viewer').startsWith('@') ? user : `@${user || 'Viewer'}`;
  const raw = (comment || '').trim().toLowerCase();
  if (!raw) return null;
  const norm = raw.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return null;
  const tokens = norm.split(' ');

  const matchTeam = (t: { aliases: string[]; key: string }) => {
    const keys = [...(t.aliases || []), t.key].map((x) => String(x).toLowerCase());
    if (keys.includes(norm)) return true;
    if (tokens.length <= 3) return tokens.some((tok) => tok.length >= 3 && keys.includes(tok));
    return false;
  };

  const hitA = matchTeam(state.teamA);
  const hitB = matchTeam(state.teamB);
  if (hitA && !hitB) { state.viewerTeams.set(clean, 'A'); return 'A'; }
  if (hitB && !hitA) { state.viewerTeams.set(clean, 'B'); return 'B'; }
  return null;
}

export function routeGiftV2(
  giftId: string | number | undefined,
  giftName: string,
  diamondCount: number,
  user: string
): { team: TeamId; tier: number; coins: number } {
  const idStr = giftId != null ? String(giftId).trim() : '';
  const nameNorm = (giftName || '').trim().toLowerCase();

  for (const slot of state.giftSlots) {
    const tokens = (slot.matchers || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if ((idStr && tokens.includes(idStr)) || (nameNorm && tokens.includes(nameNorm))) {
      const team: TeamId =
        slot.scope === 'team_a' ? 'A' : slot.scope === 'team_b' ? 'B' : resolveUserTeam(user);
      return { team, tier: slot.tier, coins: slot.coins };
    }
  }

  return {
    team: resolveUserTeam(user),
    tier: diamondCount >= 500 ? 4 : diamondCount >= 90 ? 6 : diamondCount >= 25 ? 2 : diamondCount >= 10 ? 5 : 1,
    coins: diamondCount || 1,
  };
}