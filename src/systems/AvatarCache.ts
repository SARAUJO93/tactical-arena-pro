import { drawRoundRect } from '../utils/helpers';
import { AvatarCosmeticStyle } from './SeasonPass';

export const MAX_AVATAR_CACHE = 150;

interface AvatarEntry {
  img: HTMLImageElement | HTMLCanvasElement;
  ready: boolean;
  dataUrl: string;
}

interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const lruAvatarCache = new Map<string, AvatarEntry>();
const monogramCache = new Map<string, AvatarEntry>();
const PALETTES = [
  ['#10B981', '#047857'], ['#38BDF8', '#0369A1'], ['#F59E0B', '#B45309'],
  ['#F43F5E', '#BE123C'], ['#8B5CF6', '#5B21B6'], ['#EC4899', '#9D174D'],
  ['#06B6D4', '#0E7490'], ['#EAB308', '#A16207'],
];

const avatarBubblePositions: { x: number; y: number; radius: number }[] = [];
const avatarLabelRects: LabelRect[] = [];
const avatarLabelOwners = new Set<string>();
const MAX_VISIBLE_AVATAR_LABELS = 6;

export function resetAvatarFrameRegistry(): void {
  avatarBubblePositions.length = 0;
  avatarLabelRects.length = 0;
  avatarLabelOwners.clear();
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

export function createMonogramAvatar(username: string): AvatarEntry {
  const clean = (username || 'U').replace(/^@/, '');
  const key = clean.toLowerCase();
  if (monogramCache.has(key)) return monogramCache.get(key)!;
  if (monogramCache.size >= 150) monogramCache.delete(monogramCache.keys().next().value!);

  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const pal = PALETTES[hashStr(clean) % PALETTES.length];
  const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, pal[0]);
  grad.addColorStop(1, pal[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath();
  g.arc(20, 14, 24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#FFFFFF';
  g.font = '800 26px -apple-system, BlinkMacSystemFont, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(clean.slice(0, 2).toUpperCase(), 32, 34);

  const entry: AvatarEntry = { img: c, ready: true, dataUrl: c.toDataURL('image/png') };
  monogramCache.set(key, entry);
  return entry;
}

export function getAvatar(url: string, username: string): AvatarEntry {
  const fb = createMonogramAvatar(username);
  if (!url || !url.startsWith('http')) return fb;
  if (lruAvatarCache.has(url)) {
    const val = lruAvatarCache.get(url)!;
    lruAvatarCache.delete(url);
    lruAvatarCache.set(url, val);
    return val.ready ? val : fb;
  }
  if (lruAvatarCache.size >= MAX_AVATAR_CACHE) {
    lruAvatarCache.delete(lruAvatarCache.keys().next().value!);
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  const entry: AvatarEntry = { img, ready: false, dataUrl: fb.dataUrl };
  let done = false;
  const tid = setTimeout(() => { if (!done) { done = true; entry.ready = false; } }, 6000);
  img.onload = () => { if (!done) { done = true; clearTimeout(tid); entry.ready = true; entry.dataUrl = url; } };
  img.onerror = () => { if (!done) { done = true; clearTimeout(tid); entry.ready = false; } };
  img.src = url;
  lruAvatarCache.set(url, entry);
  return fb;
}

export function getAvatarCacheSize(): number {
  return lruAvatarCache.size;
}

export function drawUnitAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  avatarUrl: string,
  username: string,
  ringColor: string,
  veteranRank = 1,
  cosmetic?: AvatarCosmeticStyle,
  showLabel = true
): void {
  if (!username) return;

  // Evita apilar burbujas de avatar muy cercanas en el mismo frame
  const bubbleConflict = avatarBubblePositions.some(
    (p) => Math.hypot(p.x - x, p.y - y) < p.radius + radius + 4
  );
  if (bubbleConflict) return;
  avatarBubblePositions.push({ x, y, radius });

  const av = getAvatar(avatarUrl, username);
  const frameColor = cosmetic ? cosmetic.ringColor : veteranRank > 1 ? '#FBBF24' : ringColor;

  ctx.save();
  if (cosmetic?.outerRingColor) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = cosmetic.outerRingColor;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = cosmetic.outerRingColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = frameColor;
  ctx.shadowColor = frameColor;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  try {
    ctx.drawImage(av.img, x - radius, y - radius, radius * 2, radius * 2);
  } catch {
    ctx.drawImage(createMonogramAvatar(username).img, x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  const ownerKey = username.replace(/^@/, '').toLowerCase();
  if (!showLabel || avatarLabelOwners.has(ownerKey) || avatarLabelOwners.size >= MAX_VISIBLE_AVATAR_LABELS) return;

  const prefix = cosmetic ? `${cosmetic.emblem} ` : veteranRank > 1 ? `★${veteranRank} ` : '';
  const label = prefix + (username.startsWith('@') ? username : `@${username}`).slice(0, 10);
  ctx.save();
  ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width + 6;
  const labelH = 11;
  const gap = 3;

  const candidates: LabelRect[] = [
    { left: x - tw / 2, top: y - radius - gap - labelH, right: x + tw / 2, bottom: y - radius - gap },
    { left: x - tw / 2, top: y + radius + gap, right: x + tw / 2, bottom: y + radius + gap + labelH },
  ];
  const overlaps = (r: LabelRect) =>
    avatarLabelRects.some(
      (o) => r.left < o.right + 4 && r.right > o.left - 4 && r.top < o.bottom + 3 && r.bottom > o.top - 3
    );

  const chosen = candidates.find((r) => !overlaps(r));
  if (chosen) {
    avatarLabelRects.push(chosen);
    avatarLabelOwners.add(ownerKey);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    drawRoundRect(ctx, chosen.left, chosen.top, tw, labelH, 4);
    ctx.fill();
    ctx.fillStyle = cosmetic ? cosmetic.ringColor : veteranRank > 1 ? '#FDE047' : '#F8FAFC';
    ctx.fillText(label, x, chosen.top + 8.1);
  }
  ctx.restore();
}