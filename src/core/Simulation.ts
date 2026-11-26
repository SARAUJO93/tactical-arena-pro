import { DeployOrder, TeamId } from './EventBus';
import { BaseState, DESIGN_W, MAX_BASE_HP, state } from './GameState';
import { drawRoundRect, distSq, hexToRgba } from '../utils/helpers';
import { drawUnitAvatar, resetAvatarFrameRegistry } from '../systems/AvatarCache';
import { getCosmeticFrameFromBadges } from '../systems/SeasonPass';
import { getActiveBiome } from '../config/biomes';
import { BiomeRenderer } from '../render/BiomeRenderer';
import { SynthEngine } from '../audio/SynthEngine';
import { ObjectPool } from '../utils/ObjectPool';

interface Point {
  x: number;
  y: number;
}

interface Unit {
  type: 'soldier' | 'tank';
  team: TeamId;
  lane: 0 | 1; // 0 = puente izquierdo, 1 = puente derecho
  isLeader?: boolean;
  owner: string;
  avatarUrl: string;
  veteranRank: number;
  x: number; y: number;
  hp: number; maxHp: number;
  speed: number; range: number; damage: number; splash: number;
  fireRate: number; cooldown: number; radius: number;
  angle: number; turretAngle: number;
  bobPhase: number; recoil: number; trackTimer: number;
  muzzleFlash: number; empStun: number; hackedFlash: number;
}

interface Jet {
  team: TeamId;
  lane: 0 | 1;
  owner: string;
  avatarUrl: string;
  veteranRank: number;
  x: number;
  y: number;
  speed: number;
  angle: number;
  bombsLeft: number;
  bombTimer: number;
  contrailL: Point[];
  contrailR: Point[];
}

interface Bomb {
  team: TeamId;
  x: number;
  y: number;
  tx: number;
  ty: number;
  progress: number;
  color: string;
}

interface Projectile {
  team: TeamId;
  type: 'bullet' | 'shell' | 'turret';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  splash: number;
  color: string;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface SmokePlume {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grow: number;
  alpha: number;
  decay: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  alpha: number;
  width: number;
}

interface Scar {
  type: 'tread' | 'crater';
  x: number;
  y: number;
  r: number;
  angle: number;
  alpha: number;
}

interface FloatBadge {
  x: number;
  y: number;
  text: string;
  color: string;
  vy: number;
  alpha: number;
  decay: number;
}

interface OrbitalStrike {
  team: TeamId;
  owner: string;
  avatarUrl: string;
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  detonated: boolean;
  beamLife: number;
  impactScale: number;
}

interface Meteor {
  x: number;
  y: number;
  tx: number;
  ty: number;
  progress: number;
}

interface HackBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vRot: number;
  alpha: number;
}

const CAPS = { particles: 220, smoke: 80, shockwaves: 24, scars: 80, badges: 40 };

export interface ResilienceStats {
  unitCount: number;
  jetCount: number;
  projectileCount: number;
  visualEffectCount: number;
}

export function calculateFallbackDamage(
  rawAmount: number,
  dmgMultiplier: number,
  frenzyActive: boolean
): number {
  if (!Number.isFinite(rawAmount) || rawAmount < 0) return 0;
  if (!Number.isFinite(dmgMultiplier) || dmgMultiplier < 0) return 0;
  const multiplier = frenzyActive ? dmgMultiplier * 2 : dmgMultiplier;
  return Math.max(0, Math.round(rawAmount * multiplier));
}

export class Simulation {
  private ctx: CanvasRenderingContext2D;
  private biomeRenderer = new BiomeRenderer();
  private W = DESIGN_W;
  private H = 693;
  private res = 1;
  private stageScale = 1;
  safeLeft = 16;
  safeRight = 336;
  safeCenterX = 176;
  baseAY = 215;
  baseBY = 470;
  midY = 342;
  private frame = 0;

  units: Unit[] = [];
  jets: Jet[] = [];
  bombs: Bomb[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  smokePlumes: SmokePlume[] = [];
  shockwaves: Shockwave[] = [];
  scars: Scar[] = [];
  floatBadges: FloatBadge[] = [];
  orbitals: OrbitalStrike[] = [];
  meteors: Meteor[] = [];
  hackBeams: HackBeam[] = [];
  confetti: ConfettiPiece[] = [];

  private projectilePool = new ObjectPool<Projectile>(
    () => ({ team: 'A', type: 'bullet', x: 0, y: 0, vx: 0, vy: 0, damage: 0, splash: 0, color: '', life: 0 }),
    () => {},
    50
  );

  private particlePool = new ObjectPool<Particle>(
    () => ({ x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', alpha: 1, decay: 0.02 }),
    () => {},
    100
  );

  private smokePool = new ObjectPool<SmokePlume>(
    () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, grow: 0, alpha: 1, decay: 0.015 }),
    () => {},
    50
  );

  private shockwavePool = new ObjectPool<Shockwave>(
    () => ({ x: 0, y: 0, r: 0, maxR: 0, color: '', alpha: 1, width: 2 }),
    () => {},
    20
  );

  private badgePool = new ObjectPool<FloatBadge>(
    () => ({ x: 0, y: 0, text: '', color: '', vy: -0.6, alpha: 1, decay: 0.018 }),
    () => {},
    20
  );

  private confettiPool = new ObjectPool<ConfettiPiece>(
    () => ({ x: 0, y: 0, vx: 0, vy: 0, size: 4, color: '', rot: 0, vRot: 0, alpha: 1 }),
    () => {},
    50
  );

  constructor(
    private canvas: HTMLCanvasElement,
    private stageFrame: HTMLElement,
    private stage: HTMLElement,
    private cardBaseA: HTMLElement,
    private cardBaseB: HTMLElement,
    private synth: SynthEngine,
    private onBaseDamageUI: () => void,
    private onVictory: (winner: TeamId, reason?: 'core' | 'sudden_death_tower') => void
  ) {
    this.ctx = canvas.getContext('2d')!;
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.updateGeometry()).observe(this.stageFrame);
    }
    window.addEventListener('resize', () => this.updateGeometry());
    this.updateGeometry();
  }

  getBridgeX(lane: 0 | 1): number {
    const laneW = Math.max(120, this.safeRight - this.safeLeft);
    return this.safeLeft + laneW * (lane === 0 ? 0.24 : 0.76);
  }

  getSideTowerPos(team: TeamId, lane: 0 | 1): Point {
    return {
      x: this.getBridgeX(lane),
      y: team === 'A' ? this.baseAY + 16 : this.baseBY - 16,
    };
  }

  isMainBaseVulnerable(team: TeamId): boolean {
    const base = team === 'A' ? state.teamA : state.teamB;
    return base.sideDefenses[0].hp <= 0 || base.sideDefenses[1].hp <= 0;
  }

  updateGeometry(): void {
    const fw = this.stageFrame.clientWidth || window.innerWidth || DESIGN_W;
    const fh = this.stageFrame.clientHeight || window.innerHeight || 693;
    this.stageScale = Math.max(0.5, fw / DESIGN_W);
    const logicalH = Math.max(500, Math.round(fh / this.stageScale));
    this.stage.style.width = `${DESIGN_W}px`;
    this.stage.style.height = `${logicalH}px`;
    this.stage.style.transform = `scale(${this.stageScale})`;

    this.W = DESIGN_W;
    this.H = this.stage.offsetHeight || 693;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.res = Math.min(dpr * this.stageScale, 3);

    const tw = Math.round(this.W * this.res);
    const th = Math.round(this.H * this.res);
    if (this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas.width = tw;
      this.canvas.height = th;
    }

    this.safeLeft = this.W * 0.04;
    this.safeRight = this.W * 0.86;
    this.safeCenterX = (this.safeLeft + this.safeRight) / 2;

    const rect = this.stage.getBoundingClientRect();
    const rA = this.cardBaseA.getBoundingClientRect();
    const rB = this.cardBaseB.getBoundingClientRect();
    if (rA.height > 0 && rB.height > 0 && rect.height > 0) {
      const topClear = (rA.bottom - rect.top) / this.stageScale + 14;
      const botClear = (rB.top - rect.top) / this.stageScale - 14;
      if (botClear - topClear >= 140) {
        this.baseAY = topClear;
        this.baseBY = botClear;
      } else {
        this.baseAY = this.H * 0.27;
        this.baseBY = this.H * 0.63;
      }
    }
    this.midY = (this.baseAY + this.baseBY) / 2;
  }

  getUnitCount(team: TeamId): number {
    let n = 0;
    for (let i = 0; i < this.units.length; i++) if (this.units[i].team === team) n++;
    return n;
  }

  getJetCount(team: TeamId): number {
    let n = 0;
    for (let i = 0; i < this.jets.length; i++) if (this.jets[i].team === team) n++;
    return n;
  }

  getResilienceStats(): ResilienceStats {
    return {
      unitCount: this.units.length,
      jetCount: this.jets.length,
      projectileCount: this.projectiles.length,
      visualEffectCount:
        this.particles.length +
        this.smokePlumes.length +
        this.shockwaves.length +
        this.scars.length +
        this.floatBadges.length,
    };
  }

  clearEntities(): void {
    this.units.length = 0;
    this.jets.length = 0;
    this.bombs.length = 0;
    while (this.projectiles.length > 0) this.projectilePool.release(this.projectiles.pop()!);
    this.orbitals.length = 0;
    this.meteors.length = 0;
    this.hackBeams.length = 0;
    this.scars.length = 0;
    while (this.particles.length > 0) this.particlePool.release(this.particles.pop()!);
    while (this.smokePlumes.length > 0) this.smokePool.release(this.smokePlumes.pop()!);
    while (this.shockwaves.length > 0) this.shockwavePool.release(this.shockwaves.pop()!);
    while (this.floatBadges.length > 0) this.badgePool.release(this.floatBadges.pop()!);
    while (this.confetti.length > 0) this.confettiPool.release(this.confetti.pop()!);
  }

  deployOrder(order: DeployOrder): void {
    if (!state.roundActive || state.towerDecayActive) return;
    const isA = order.team === 'A';
    const lane: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    const laneX = this.getBridgeX(lane) + (Math.random() - 0.5) * 14;
    const vetMultHp = (1 + (order.veteranRank - 1) * 0.35) * (state.frenzyActive ? 1.25 : 1);
    const vetMultDmg = 1 + (order.veteranRank - 1) * 0.22;

    if (order.kind === 'INFANTRY') {
      const spawnY = isA ? this.baseAY + 20 : this.baseBY - 20;
      for (let i = 0; i < 3; i++) {
        this.units.push({
          type: 'soldier',
          team: order.team,
          lane,
          isLeader: i === 0 && Boolean(order.user),
          owner: i === 0 ? order.user : '',
          avatarUrl: i === 0 ? order.avatarUrl : '',
          veteranRank: order.veteranRank,
          x: Math.max(this.safeLeft + 10, Math.min(this.safeRight - 10, laneX + (i - 1) * 9)),
          y: spawnY + (Math.random() - 0.5) * 6,
          hp: Math.round(56 * vetMultHp),
          maxHp: Math.round(56 * vetMultHp),
          speed: 1.0 + Math.random() * 0.12,
          range: 54,
          damage: Math.round(13 * vetMultDmg),
          splash: 0,
          fireRate: 24,
          cooldown: Math.floor(Math.random() * 10),
          radius: 6.5,
          angle: isA ? Math.PI / 2 : -Math.PI / 2,
          turretAngle: 0,
          bobPhase: Math.random() * Math.PI * 2,
          recoil: 0,
          trackTimer: 0,
          muzzleFlash: 0,
          empStun: 0,
          hackedFlash: 0,
        });
      }
      if (order.isTapBadge && order.user) {
        this.pushBadge(
          laneX,
          spawnY + (isA ? 14 : -14),
          `❤️ ${order.user.slice(0, 10)}`,
          isA ? state.teamA.color : state.teamB.color,
          isA ? 0.35 : -0.35
        );
      }
      this.synth.playSFX('deploy_infantry');
    } else if (order.kind === 'TANK') {
      this.units.push({
        type: 'tank',
        team: order.team,
        lane,
        owner: order.user,
        avatarUrl: order.avatarUrl,
        veteranRank: order.veteranRank,
        x: laneX,
        y: isA ? this.baseAY + 24 : this.baseBY - 24,
        hp: Math.round(360 * vetMultHp),
        maxHp: Math.round(360 * vetMultHp),
        speed: 0.68,
        range: 82,
        damage: Math.round(58 * vetMultDmg),
        splash: 36,
        fireRate: 54,
        cooldown: 10,
        radius: 13.5,
        angle: isA ? Math.PI / 2 : -Math.PI / 2,
        turretAngle: isA ? Math.PI / 2 : -Math.PI / 2,
        bobPhase: 0,
        recoil: 0,
        trackTimer: 0,
        muzzleFlash: 0,
        empStun: 0,
        hackedFlash: 0,
      });
      this.synth.playSFX('deploy_tank');
    } else if (order.kind === 'JET') {
      const jetX = this.getBridgeX(lane);
      this.jets.push({
        team: order.team,
        lane,
        owner: order.user,
        avatarUrl: order.avatarUrl,
        veteranRank: order.veteranRank,
        x: jetX,
        y: isA ? this.baseAY - 45 : this.baseBY + 45,
        speed: 5.6,
        angle: isA ? Math.PI / 2 : -Math.PI / 2,
        bombsLeft: 3,
        bombTimer: 7,
        contrailL: [],
        contrailR: [],
      });
      this.synth.playSFX('jet');
    }
  }

  spawnOrbital(team: TeamId, user: string, avatarUrl: string, impactScale = 1): void {
    const isA = team === 'A';
    const safeScale = Number.isFinite(impactScale) ? Math.max(0.2, Math.min(1, impactScale)) : 1;
    this.orbitals.push({
      team,
      owner: user,
      avatarUrl,
      x: this.safeCenterX,
      y: isA ? this.baseBY - 10 : this.baseAY + 10,
      timer: 42,
      maxTimer: 42,
      detonated: false,
      beamLife: 0,
      impactScale: safeScale,
    });
  }

  applyEmpToUnits(enemyTeam: TeamId, seconds: number): void {
    for (const u of this.units) {
      if (u.team === enemyTeam && u.type === 'tank') {
        u.empStun = Math.min(18 * 60, u.empStun + seconds * 60);
      }
    }
    this.pushShockwave(
      this.safeCenterX,
      enemyTeam === 'A' ? this.baseAY : this.baseBY,
      (this.safeRight - this.safeLeft) * 0.85,
      '#22D3EE',
      3.5
    );
  }

  applyCyberHack(team: TeamId, user: string, avatarUrl: string, maxSteal: number): number {
    const enemyTeam: TeamId = team === 'A' ? 'B' : 'A';
    const myBaseY = team === 'A' ? this.baseAY : this.baseBY;
    const candidates = this.units
      .filter((u) => u.team === enemyTeam && u.hp > 0)
      .sort(
        (a, b) =>
          (a.type === 'tank' ? -200 : 0) +
          Math.abs(a.y - myBaseY) -
          ((b.type === 'tank' ? -200 : 0) + Math.abs(b.y - myBaseY))
      )
      .slice(0, maxSteal);

    candidates.forEach((u) => {
      u.team = team;
      u.owner = user;
      u.avatarUrl = avatarUrl;
      u.isLeader = true;
      u.hackedFlash = 45;
      u.angle = team === 'A' ? Math.PI / 2 : -Math.PI / 2;
      this.hackBeams.push({ x1: this.safeCenterX, y1: myBaseY, x2: u.x, y2: u.y, life: 28, maxLife: 28 });
      this.pushBadge(u.x, u.y - 16, '👾 HACKEADO', '#E879F9', -0.55);
      this.pushShockwave(u.x, u.y, 32, '#C084FC', 2);
    });
    return candidates.length;
  }

  spawnVictoryConfetti(winner: TeamId): void {
    const winObj = winner === 'A' ? state.teamA : state.teamB;
    this.spawnExplosion(this.safeCenterX, winner === 'A' ? this.baseBY : this.baseAY, winObj.color, 'nuclear');
    while (this.confetti.length > 0) this.confettiPool.release(this.confetti.pop()!);
    const pal = [winObj.color, '#FBBF24', '#FFFFFF', '#FB7185'];
    for (let i = 0; i < 80; i++) {
      const c = this.confettiPool.acquire();
      c.x = this.safeCenterX + (Math.random() - 0.5) * 60;
      c.y = this.midY;
      c.vx = (Math.random() - 0.5) * 11;
      c.vy = (Math.random() - 0.85) * 14;
      c.size = 4 + Math.random() * 4;
      c.color = pal[Math.floor(Math.random() * pal.length)];
      c.rot = Math.random() * Math.PI * 2;
      c.vRot = (Math.random() - 0.5) * 0.25;
      c.alpha = 1;
      this.confetti.push(c);
    }
  }

  pushBadge(x: number, y: number, text: string, color: string, vy = -0.6): void {
    if (this.floatBadges.length >= CAPS.badges) {
      const old = this.floatBadges.shift();
      if (old) this.badgePool.release(old);
    }
    const b = this.badgePool.acquire();
    b.x = x;
    b.y = y;
    b.text = text;
    b.color = color;
    b.vy = vy;
    b.alpha = 1;
    b.decay = 0.018;
    this.floatBadges.push(b);
  }

  pushShockwave(x: number, y: number, maxR: number, color: string, width = 2.2): void {
    if (this.shockwaves.length >= CAPS.shockwaves) {
      const old = this.shockwaves.shift();
      if (old) this.shockwavePool.release(old);
    }
    const sw = this.shockwavePool.acquire();
    sw.x = x;
    sw.y = y;
    sw.r = 8;
    sw.maxR = maxR;
    sw.color = color;
    sw.alpha = 0.92;
    sw.width = width;
    this.shockwaves.push(sw);
  }

  private addScar(type: Scar['type'], x: number, y: number, r: number, angle = 0): void {
    if (this.scars.length >= CAPS.scars) this.scars.shift();
    this.scars.push({ type, x, y, r, angle, alpha: type === 'tread' ? 0.24 : 0.72 });
  }

  private emitDamageSmoke(x: number, y: number, intense: boolean): void {
    if (this.smokePlumes.length >= CAPS.smoke) {
      const old = this.smokePlumes.shift();
      if (old) this.smokePool.release(old);
    }
    const sm = this.smokePool.acquire();
    sm.x = x + (Math.random() - 0.5) * 14;
    sm.y = y + (Math.random() - 0.5) * 10;
    sm.vx = (Math.random() - 0.5) * 0.35;
    sm.vy = -0.45 - Math.random() * 0.35;
    sm.r = intense ? 5.5 + Math.random() * 3.5 : 3.5 + Math.random() * 2.5;
    sm.grow = 0.14;
    sm.alpha = intense ? 0.44 : 0.28;
    sm.decay = 0.014;
    this.smokePlumes.push(sm);
  }

  spawnExplosion(x: number, y: number, color: string, size: 'small' | 'medium' | 'nuclear' = 'small'): void {
    const cfg =
      size === 'nuclear'
        ? { sparks: 44, smoke: 14, spd: 7.5, ring: (this.safeRight - this.safeLeft) * 0.94 }
        : size === 'medium'
          ? { sparks: 14, smoke: 5, spd: 4.0, ring: 42 }
          : { sparks: 5, smoke: 2, spd: 2.2, ring: 0 };

    for (let i = 0; i < cfg.sparks; i++) {
      if (this.particles.length >= CAPS.particles) {
        const old = this.particles.shift();
        if (old) this.particlePool.release(old);
      }
      const a = Math.random() * Math.PI * 2,
        s = (Math.random() * 0.75 + 0.25) * cfg.spd;
      const pt = this.particlePool.acquire();
      pt.x = x;
      pt.y = y;
      pt.vx = Math.cos(a) * s;
      pt.vy = Math.sin(a) * s;
      pt.size = Math.random() * (size === 'nuclear' ? 3.8 : 2.1) + 1.1;
      pt.color = Math.random() > 0.5 ? '#FEF08A' : Math.random() > 0.4 ? '#EF4444' : color;
      pt.alpha = 1;
      pt.decay = 0.025 + Math.random() * 0.02;
      this.particles.push(pt);
    }
    for (let i = 0; i < cfg.smoke; i++) {
      if (this.smokePlumes.length >= CAPS.smoke) {
        const old = this.smokePlumes.shift();
        if (old) this.smokePool.release(old);
      }
      const a = Math.random() * Math.PI * 2,
        s = Math.random() * (size === 'nuclear' ? 2.2 : 1.0);
      const sm = this.smokePool.acquire();
      sm.x = x + (Math.random() - 0.5) * 6;
      sm.y = y + (Math.random() - 0.5) * 6;
      sm.vx = Math.cos(a) * s;
      sm.vy = Math.sin(a) * s - 0.2;
      sm.r = size === 'nuclear' ? 12 : 4 + Math.random() * 4;
      sm.grow = size === 'nuclear' ? 0.4 : 0.16;
      sm.alpha = size === 'nuclear' ? 0.6 : 0.36;
      sm.decay = 0.015;
      this.smokePlumes.push(sm);
    }
    if (cfg.ring > 0) this.pushShockwave(x, y, cfg.ring, size === 'nuclear' ? '#FFFFFF' : color, size === 'nuclear' ? 4 : 2.2);
    if (size === 'medium') this.addScar('crater', x, y, 10);
    if (size === 'nuclear') this.addScar('crater', x, y, 38);
  }

  private damageSideTower(targetTeam: TeamId, lane: 0 | 1, rawAmount: number): void {
    if (!state.roundActive) return;
    const base = targetTeam === 'A' ? state.teamA : state.teamB;
    const tower = base.sideDefenses[lane];
    if (tower.hp <= 0) return;

    const amount = rawAmount * (state.suddenDeathActive ? 2 : 1);
    tower.hp = Math.max(0, tower.hp - amount);
    tower.flash = 6;
    this.onBaseDamageUI();
    const pos = this.getSideTowerPos(targetTeam, lane);
    if (tower.hp <= 0) {
      this.spawnExplosion(pos.x, pos.y, base.color, 'medium');
      this.synth.playSFX('tower_fall');
      state.shake = Math.max(state.shake, 7);
      this.pushBadge(pos.x, pos.y, '💥 TORRE CAÍDA', '#FDE047', -0.7);
      if (state.suddenDeathActive) this.onVictory(targetTeam === 'A' ? 'B' : 'A', 'sudden_death_tower');
    }
  }

  private damageBase(targetTeam: TeamId, rawAmount: number, hitX: number, bypassGuard = false): void {
    if (!state.roundActive) return;
    if (!bypassGuard && !this.isMainBaseVulnerable(targetTeam)) return;

    let amount = rawAmount * (state.suddenDeathActive ? 2 : 1);
    const base = targetTeam === 'A' ? state.teamA : state.teamB;
    const by = targetTeam === 'A' ? this.baseAY : this.baseBY;

    if (base.shieldHp > 0 && base.shieldTimer > 0) {
      const abs = Math.min(base.shieldHp, amount);
      base.shieldHp -= abs;
      amount -= abs;
      this.pushShockwave(hitX, by, 26, '#22D3EE', 2);
      if (base.shieldHp <= 0) base.shieldTimer = 0;
      if (amount <= 0) return;
    }

    base.hp = Math.max(0, base.hp - amount);
    base.flash = 6;
    if (amount >= 25) {
      this.pushBadge(
        hitX + (Math.random() - 0.5) * 18,
        by + (targetTeam === 'A' ? 22 : -22),
        `-${Math.round(amount)}`,
        state.suddenDeathActive ? '#FCA5A5' : '#FDE68A',
        -0.65
      );
    }
    this.onBaseDamageUI();
    if (base.hp <= 0) this.onVictory(targetTeam === 'A' ? 'B' : 'A', 'core');
  }

  private updateBaseDefenses(team: TeamId, baseObj: BaseState, by: number, ts: number): void {
    if (state.roundActive && baseObj.hp > 0) {
      const ratio = baseObj.hp / MAX_BASE_HP;
      if (ratio < 0.25 && this.frame % 10 === 0) {
        this.emitDamageSmoke(this.safeCenterX, by, true);
      } else if (ratio < 0.5 && this.frame % 22 === 0) {
        this.emitDamageSmoke(this.safeCenterX, by, false);
      }
    }

    if (baseObj.empTimer > 0) return;
    const enemyTeam: TeamId = team === 'A' ? 'B' : 'A';
    const mainRangeSq = 112 * 112;
    const sideRangeSq = 126 * 126;

    ([0, 1] as const).forEach((lane) => {
      const sd = baseObj.sideDefenses[lane];
      if (sd.flash > 0) sd.flash = Math.max(0, sd.flash - ts);
      if (sd.hp <= 0) return;
      const pos = this.getSideTowerPos(team, lane);
      if (state.roundActive && sd.hp < sd.maxHp * 0.4 && this.frame % 26 === 0) {
        this.emitDamageSmoke(pos.x, pos.y, false);
      }
      let target: Unit | null = null, minD2 = sideRangeSq;
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.team !== enemyTeam || u.hp <= 0) continue;
        const d2 = distSq(u.x, u.y, pos.x, pos.y);
        if (d2 < minD2) { minD2 = d2; target = u; }
      }
      if (target) {
        sd.angle = Math.atan2(target.y - pos.y, target.x - pos.x);
        if (sd.cooldown <= 0 && state.roundActive) {
          sd.cooldown = 36;
          const proj = this.projectilePool.acquire();
          proj.team = team;
          proj.type = 'turret';
          proj.x = pos.x + Math.cos(sd.angle) * 10;
          proj.y = pos.y + Math.sin(sd.angle) * 10;
          proj.vx = Math.cos(sd.angle) * 8.2;
          proj.vy = Math.sin(sd.angle) * 8.2;
          proj.damage = 10;
          proj.splash = 0;
          proj.color = baseObj.color;
          proj.life = 28;
          this.projectiles.push(proj);
          this.synth.playSFX('turret');
        }
      }
      if (sd.cooldown > 0) sd.cooldown -= ts;
    });

    const offsets = [{ dx: -20, dy: team === 'A' ? 10 : -10 }, { dx: 20, dy: team === 'A' ? 10 : -10 }];
    offsets.forEach((off, idx) => {
      const tx = this.safeCenterX + off.dx, ty = by + off.dy;
      let target: Unit | null = null, minD2 = mainRangeSq;
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i];
        if (u.team !== enemyTeam || u.hp <= 0) continue;
        const d2 = distSq(u.x, u.y, tx, ty);
        if (d2 < minD2) { minD2 = d2; target = u; }
      }
      if (target) {
        const ang = Math.atan2(target.y - ty, target.x - tx);
        baseObj.turretAngles[idx] = ang;
        if (baseObj.turretCooldowns[idx] <= 0 && state.roundActive) {
          baseObj.turretCooldowns[idx] = 34;
          const proj = this.projectilePool.acquire();
          proj.team = team;
          proj.type = 'turret';
          proj.x = tx + Math.cos(ang) * 9;
          proj.y = ty + Math.sin(ang) * 9;
          proj.vx = Math.cos(ang) * 8.2;
          proj.vy = Math.sin(ang) * 8.2;
          proj.damage = 8;
          proj.splash = 0;
          proj.color = baseObj.color;
          proj.life = 26;
          this.projectiles.push(proj);
          this.synth.playSFX('turret');
        }
      }
      if (baseObj.turretCooldowns[idx] > 0) baseObj.turretCooldowns[idx] -= ts;
    });
  }

  update(dtFrames: number): void {
    if (state.towerDecayActive) return;
    const ts = state.timeScale * dtFrames;
    this.frame++;
    if (state.shake > 0.15) state.shake *= 0.87; else state.shake = 0;
    if (state.screenFlash > 0.01) state.screenFlash *= 0.86; else state.screenFlash = 0;
    if (state.teamA.flash > 0) state.teamA.flash = Math.max(0, state.teamA.flash - ts);
    if (state.teamB.flash > 0) state.teamB.flash = Math.max(0, state.teamB.flash - ts);

    const speedMult = (state.suddenDeathActive ? 1.22 : 1.0) * ts;
    const dmgMult = state.suddenDeathActive ? 2.0 : 1.0;

    this.updateBaseDefenses('A', state.teamA, this.baseAY, ts);
    this.updateBaseDefenses('B', state.teamB, this.baseBY, ts);

    if (state.meteorRainRemaining > 0 && this.frame % 16 === 0 && !state.takeoverActive) {
      state.meteorRainRemaining--;
      const tx = this.safeLeft + 16 + Math.random() * Math.max(80, this.safeRight - this.safeLeft - 32);
      const ty = this.baseAY + 24 + Math.random() * Math.max(60, this.baseBY - this.baseAY - 48);
      this.meteors.push({ x: tx - 90, y: ty - 220, tx, ty, progress: 0 });
    }

    const bLeft = this.getBridgeX(0);
    const bRight = this.getBridgeX(1);

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.hp <= 0) {
        this.spawnExplosion(u.x, u.y, u.team === 'A' ? state.teamA.color : state.teamB.color, u.type === 'tank' ? 'medium' : 'small');
        if (u.type === 'tank') { this.synth.playSFX('tank_explode'); state.shake = Math.max(state.shake, 3.2); }
        this.units.splice(i, 1);
        continue;
      }
      if (u.muzzleFlash > 0) u.muzzleFlash = Math.max(0, u.muzzleFlash - ts);
      if (u.hackedFlash > 0) u.hackedFlash = Math.max(0, u.hackedFlash - ts);
      if (u.type === 'tank' && u.recoil > 0.05) u.recoil *= 0.82;
      if (u.empStun > 0) { u.empStun -= ts; continue; }

      const enemyTeam: TeamId = u.team === 'A' ? 'B' : 'A';
      const eBase = enemyTeam === 'A' ? state.teamA : state.teamB;
      const eBaseY = enemyTeam === 'A' ? this.baseAY : this.baseBY;

      let structX = this.safeCenterX, structY = eBaseY;
      if (eBase.sideDefenses[u.lane].hp > 0) {
        const p = this.getSideTowerPos(enemyTeam, u.lane);
        structX = p.x; structY = p.y;
      } else if (!this.isMainBaseVulnerable(enemyTeam)) {
        const other: 0 | 1 = u.lane === 0 ? 1 : 0;
        const p = this.getSideTowerPos(enemyTeam, other);
        structX = p.x; structY = p.y;
      }

      const distStructSq = distSq(u.x, u.y, structX, structY);
      const aggroSq = (u.range * 1.45) * (u.range * 1.45);
      let nearest: Unit | null = null, minD2 = Math.min(aggroSq, distStructSq);

      let sepX = 0, sepY = 0;
      for (let j = 0; j < this.units.length; j++) {
        if (i === j) continue;
        const o = this.units[j];
        if (o.hp <= 0) continue;
        const dx = u.x - o.x, dy = u.y - o.y, d2 = dx * dx + dy * dy;
        if (o.team !== u.team) {
          if (d2 < minD2) { minD2 = d2; nearest = o; }
        } else {
          const minSep = u.radius + o.radius + 3;
          if (d2 > 0.01 && d2 < minSep * minSep) {
            const inv = 0.35 / Math.sqrt(d2);
            sepX += dx * inv; sepY += dy * inv;
          }
        }
      }

      const tx = nearest ? nearest.x : structX;
      const ty = nearest ? nearest.y : structY;
      const targetD2 = nearest ? minD2 : distStructSq;

      const needsCross = (u.y < this.midY - 12 && ty > this.midY + 12) || (u.y > this.midY + 12 && ty < this.midY - 12);
      const bridgeX = Math.abs(u.x - bLeft) <= Math.abs(u.x - bRight) ? bLeft : bRight;
      let moveX = tx, moveY = ty;
      if (needsCross && Math.abs(u.x - bridgeX) > 10) {
        moveX = bridgeX;
        moveY = this.midY;
      }

      const aimAng = Math.atan2(ty - u.y, tx - u.x);
      const moveAng = Math.atan2(moveY - u.y, moveX - u.x);

      if (u.type === 'tank') {
        let diff = aimAng - u.turretAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        u.turretAngle += diff * 0.14 * ts;
      }

      if (targetD2 > u.range * u.range) {
        u.angle = moveAng;
        const nx = u.x + (Math.cos(moveAng) * u.speed + sepX) * speedMult;
        const ny = u.y + (Math.sin(moveAng) * u.speed + sepY) * speedMult;
        const inRiver = Math.abs(ny - this.midY) < 14;
        const onBridge = Math.abs(nx - bLeft) <= 13 || Math.abs(nx - bRight) <= 13;

        u.x = nx;
        if (!inRiver || onBridge) u.y = ny;
        else u.x += Math.sign(bridgeX - u.x) * u.speed * speedMult;

        if (u.type === 'soldier') u.bobPhase += 0.32 * speedMult;
        else if (++u.trackTimer % 14 === 0) this.addScar('tread', u.x, u.y, 10, u.angle);
      } else {
        u.x += sepX * 0.3 * ts;
        if (u.type === 'soldier') u.angle = aimAng;
        if (u.cooldown <= 0 && state.roundActive) {
          u.cooldown = u.fireRate; u.muzzleFlash = 4;
          const col = u.team === 'A' ? state.teamA.color : state.teamB.color;
          const fAng = u.type === 'tank' ? u.turretAngle : aimAng;
          if (u.type === 'tank') u.recoil = 5;
          const proj = this.projectilePool.acquire();
          proj.team = u.team;
          proj.type = u.type === 'tank' ? 'shell' : 'bullet';
          proj.x = u.x + Math.cos(fAng) * (u.radius + 4);
          proj.y = u.y + Math.sin(fAng) * (u.radius + 4);
          proj.vx = Math.cos(fAng) * (u.type === 'tank' ? 6.0 : 8.5);
          proj.vy = Math.sin(fAng) * (u.type === 'tank' ? 6.0 : 8.5);
          proj.damage = u.damage;
          proj.splash = u.splash;
          proj.color = col;
          proj.life = 45;
          this.projectiles.push(proj);
          this.synth.playSFX(u.type === 'tank' ? 'cannon' : 'rifle');
        }
      }
      if (u.cooldown > 0) u.cooldown -= ts;
      u.x = Math.max(this.safeLeft + 10, Math.min(this.safeRight - 10, u.x));
    }

    for (let i = this.jets.length - 1; i >= 0; i--) {
      const j = this.jets[i];
      const enemyTeam: TeamId = j.team === 'A' ? 'B' : 'A';
      const eBase = enemyTeam === 'A' ? state.teamA : state.teamB;
      const eBaseY = enemyTeam === 'A' ? this.baseAY : this.baseBY;

      // Buscar objetivo prioritario mientras tenga bombas: torre lateral viva más cercana -> base enemiga
      let targetX = this.safeCenterX;
      let targetY = eBaseY;
      let bestDistSq = Infinity;

      for (const lane of [0, 1] as const) {
        if (eBase.sideDefenses[lane].hp > 0) {
          const tp = this.getSideTowerPos(enemyTeam, lane);
          const d2 = distSq(j.x, j.y, tp.x, tp.y);
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            targetX = tp.x;
            targetY = tp.y;
          }
        }
      }

      if (bestDistSq === Infinity) {
        bestDistSq = distSq(j.x, j.y, targetX, targetY);
      }

      if (j.bombsLeft > 0) {
        const desiredAngle = Math.atan2(targetY - j.y, targetX - j.x);
        let diff = desiredAngle - j.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        j.angle += diff * Math.min(1, 0.12 * ts);
      }

      j.x += Math.cos(j.angle) * j.speed * speedMult;
      j.y += Math.sin(j.angle) * j.speed * speedMult;

      const perpX = -Math.sin(j.angle) * 12;
      const perpY = Math.cos(j.angle) * 12;
      j.contrailL.push({ x: j.x + perpX, y: j.y + perpY });
      j.contrailR.push({ x: j.x - perpX, y: j.y - perpY });
      if (j.contrailL.length > 14) { j.contrailL.shift(); j.contrailR.shift(); }

      j.bombTimer -= ts;
      if (j.bombsLeft > 0 && j.bombTimer <= 0 && j.y > this.baseAY - 15 && j.y < this.baseBY + 15) {
        j.bombsLeft--; j.bombTimer = 10;
        const btx = bestDistSq < 110 * 110
          ? targetX + (Math.random() - 0.5) * 12
          : j.x + Math.cos(j.angle) * 42 + (Math.random() - 0.5) * 16;
        const bty = bestDistSq < 110 * 110
          ? targetY + (Math.random() - 0.5) * 12
          : Math.min(this.baseBY, Math.max(this.baseAY, j.y + Math.sin(j.angle) * 42));

        this.bombs.push({
          team: j.team, x: j.x, y: j.y, tx: btx, ty: bty, progress: 0,
          color: j.team === 'A' ? state.teamA.color : state.teamB.color,
        });
      }
      if (j.y < this.H * 0.03 || j.y > this.H * 0.95 || j.x < -40 || j.x > this.W + 40) {
        this.jets.splice(i, 1);
      }
    }

    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]; b.progress += 0.095 * ts;
      if (b.progress >= 1) {
        const enemyTeam: TeamId = b.team === 'A' ? 'B' : 'A';
        this.spawnExplosion(b.tx, b.ty, b.color, 'medium'); this.synth.playSFX('bomb_impact'); state.shake = Math.max(state.shake, 3.5);
        for (const u of this.units) if (u.team === enemyTeam && distSq(u.x, u.y, b.tx, b.ty) < 58 * 58) u.hp -= 70 * dmgMult;
        ([0, 1] as const).forEach((lane) => {
          const tp = this.getSideTowerPos(enemyTeam, lane);
          if (distSq(tp.x, tp.y, b.tx, b.ty) < 58 * 58) this.damageSideTower(enemyTeam, lane, 115);
        });
        const eBaseY = enemyTeam === 'A' ? this.baseAY : this.baseBY;
        if (distSq(this.safeCenterX, eBaseY, b.tx, b.ty) < 88 * 88) this.damageBase(enemyTeam, 80, b.tx);
        this.bombs.splice(i, 1);
      }
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.progress += 0.055 * ts;
      if (m.progress >= 1) {
        this.spawnExplosion(m.tx, m.ty, '#F97316', 'medium'); this.synth.playSFX('meteor'); state.shake = Math.max(state.shake, 5.2);
        for (const u of this.units) if (distSq(u.x, u.y, m.tx, m.ty) < 52 * 52) u.hp -= 75 * dmgMult;
        this.meteors.splice(i, 1);
      }
    }

    for (let i = this.orbitals.length - 1; i >= 0; i--) {
      const orb = this.orbitals[i];
      if (!orb.detonated) {
        orb.timer -= ts;
        if (orb.timer <= 0) {
          orb.detonated = true; orb.beamLife = 32;
          const enemyTeam: TeamId = orb.team === 'A' ? 'B' : 'A';
          state.shake = 18; state.screenFlash = 0.85; this.synth.playSFX('orbital_boom');
          this.spawnExplosion(orb.x, orb.y, orb.team === 'A' ? state.teamA.color : state.teamB.color, 'nuclear');
          for (const u of this.units) if (u.team === enemyTeam) u.hp = 0;
          this.damageSideTower(enemyTeam, 0, Math.round(500 * orb.impactScale));
          this.damageSideTower(enemyTeam, 1, Math.round(500 * orb.impactScale));
          this.damageBase(enemyTeam, Math.round(650 * orb.impactScale), this.safeCenterX, true);
        }
      } else if ((orb.beamLife -= ts) <= 0) this.orbitals.splice(i, 1);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.x += p.vx * ts; p.y += p.vy * ts; p.life -= ts;
      let hit = false;
      const enemyTeam: TeamId = p.team === 'A' ? 'B' : 'A';
      const eBase = enemyTeam === 'A' ? state.teamA : state.teamB;
      const eBaseY = enemyTeam === 'A' ? this.baseAY : this.baseBY;

      for (let j = 0; j < this.units.length; j++) {
        const u = this.units[j];
        if (u.team !== enemyTeam || u.hp <= 0) continue;
        const r = u.radius + 5;
        if (distSq(u.x, u.y, p.x, p.y) < r * r) {
          hit = true;
          if (p.splash > 0) {
            const s2 = p.splash * p.splash;
            for (const t of this.units) if (t.team === enemyTeam && distSq(t.x, t.y, p.x, p.y) <= s2) t.hp -= p.damage * dmgMult;
            this.spawnExplosion(p.x, p.y, p.color, 'medium'); state.shake = Math.max(state.shake, 2.2);
          } else {
            u.hp -= p.damage * dmgMult;
            this.spawnExplosion(p.x, p.y, p.color, 'small');
          }
          break;
        }
      }

      if (!hit) {
        for (const lane of [0, 1] as const) {
          if (eBase.sideDefenses[lane].hp <= 0) continue;
          const tp = this.getSideTowerPos(enemyTeam, lane);
          if (distSq(tp.x, tp.y, p.x, p.y) < 22 * 22) {
            hit = true;
            this.damageSideTower(enemyTeam, lane, p.damage);
            this.spawnExplosion(p.x, p.y, p.color, p.type === 'shell' ? 'medium' : 'small');
            break;
          }
        }
      }

      if (!hit && distSq(this.safeCenterX, eBaseY, p.x, p.y) < 34 * 34) {
        hit = true;
        this.damageBase(enemyTeam, p.damage, p.x);
        this.spawnExplosion(p.x, p.y, p.color, p.type === 'shell' ? 'medium' : 'small');
      }
      if (hit || p.life <= 0) {
        this.projectiles.splice(i, 1);
        this.projectilePool.release(p);
      }
    }

    for (let i = this.scars.length - 1; i >= 0; i--) if ((this.scars[i].alpha -= 0.0005 * ts) <= 0.01) this.scars.splice(i, 1);
    for (let i = this.hackBeams.length - 1; i >= 0; i--) if ((this.hackBeams[i].life -= ts) <= 0) this.hackBeams.splice(i, 1);
    for (let i = this.particles.length - 1; i >= 0; i--) { const pt = this.particles[i]; pt.x += pt.vx * ts; pt.y += pt.vy * ts; pt.vx *= 0.94; pt.vy *= 0.94; if ((pt.alpha -= pt.decay * ts) <= 0) { this.particles.splice(i, 1); this.particlePool.release(pt); } }
    for (let i = this.smokePlumes.length - 1; i >= 0; i--) { const sm = this.smokePlumes[i]; sm.x += sm.vx * ts; sm.y += sm.vy * ts; sm.r += sm.grow * ts; if ((sm.alpha -= sm.decay * ts) <= 0) { this.smokePlumes.splice(i, 1); this.smokePool.release(sm); } }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) { const sw = this.shockwaves[i]; sw.r += (sw.maxR - sw.r) * 0.14 * ts; if ((sw.alpha -= 0.032 * ts) <= 0) { this.shockwaves.splice(i, 1); this.shockwavePool.release(sw); } }
    for (let i = this.floatBadges.length - 1; i >= 0; i--) { const fb = this.floatBadges[i]; fb.y += fb.vy * ts; if ((fb.alpha -= fb.decay * ts) <= 0) { this.floatBadges.splice(i, 1); this.badgePool.release(fb); } }
    for (let i = this.confetti.length - 1; i >= 0; i--) { const c = this.confetti[i]; c.x += c.vx * ts; c.y += c.vy * ts; c.vy += 0.22 * ts; c.rot += c.vRot * ts; if ((c.alpha -= 0.006 * ts) <= 0 || c.y > this.H) { this.confetti.splice(i, 1); this.confettiPool.release(c); } }
  }

  render(): void {
    resetAvatarFrameRegistry();
    const biome = getActiveBiome();
    const ctx = this.ctx;
    ctx.setTransform(this.res, 0, 0, this.res, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save();
    if (state.shake > 0.2) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);

    // Bioma detallado estilo Clash Royale (losetas cacheadas + río animado, puentes y decoración)
    this.biomeRenderer.renderBackground(
      ctx,
      biome,
      this.W,
      this.H,
      this.safeLeft,
      this.safeRight,
      this.baseAY,
      this.baseBY,
      this.midY,
      this.getBridgeX(0),
      this.getBridgeX(1),
      this.frame
    );

    for (const sc of this.scars) {
      ctx.save(); ctx.translate(sc.x, sc.y);
      if (sc.type === 'tread') { ctx.rotate(sc.angle); ctx.fillStyle = `rgba(0,0,0,${sc.alpha})`; ctx.fillRect(-4, -9, 8, 2.8); ctx.fillRect(-4, 6.2, 8, 2.8); }
      else { ctx.fillStyle = `rgba(2,3,5,${sc.alpha})`; ctx.beginPath(); ctx.arc(0, 0, sc.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    this.drawBase(this.safeCenterX, this.baseAY, state.teamA, true, biome, !this.isMainBaseVulnerable('A'));
    this.drawBase(this.safeCenterX, this.baseBY, state.teamB, false, biome, !this.isMainBaseVulnerable('B'));
    this.drawSideTowers('A', state.teamA, biome);
    this.drawSideTowers('B', state.teamB, biome);

    for (const hb of this.hackBeams) {
      const a = hb.life / hb.maxLife;
      ctx.save(); ctx.strokeStyle = `rgba(192,132,252,${a})`; ctx.lineWidth = 3 * a;
      ctx.beginPath(); ctx.moveTo(hb.x1, hb.y1); ctx.lineTo(hb.x2, hb.y2); ctx.stroke(); ctx.restore();
    }

    for (const u of this.units) {
      const col = u.hackedFlash > 0 && this.frame % 6 < 3 ? '#E879F9' : u.team === 'A' ? state.teamA.color : state.teamB.color;
      ctx.save(); ctx.translate(u.x, u.y);
      ctx.fillStyle = 'rgba(2,6,23,0.32)';
      ctx.beginPath(); ctx.ellipse(1.5, 4.5, u.type === 'tank' ? 13 : 5, u.type === 'tank' ? 6 : 3.2, 0, 0, Math.PI * 2); ctx.fill();
      if (u.type === 'soldier') {
        const bob = Math.sin(u.bobPhase) * 1.1;
        ctx.rotate(u.angle);
        ctx.translate(0, bob * 0.4);
        ctx.fillStyle = '#080D17';
        drawRoundRect(ctx, -3.1, 2.4, 2.6, 4, 1); ctx.fill();
        drawRoundRect(ctx, 0.8, 2.4, 2.6, 4, 1); ctx.fill();
        ctx.fillStyle = '#172338';
        ctx.beginPath();
        ctx.moveTo(-2.6, -2.8); ctx.lineTo(-1.4, -4.2); ctx.lineTo(1.7, -4.1);
        ctx.lineTo(3.1, -2.2); ctx.lineTo(2.7, 3.2); ctx.lineTo(0, 4.5);
        ctx.lineTo(-2.9, 3.1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(2,6,23,0.95)'; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#263950';
        drawRoundRect(ctx, -2.1, -1.7, 4.2, 4.2, 1.1); ctx.fill();
        ctx.fillStyle = col; drawRoundRect(ctx, -1.2, 0, 2.4, 1.2, 0.5); ctx.fill();
        ctx.fillStyle = '#0B1220';
        ctx.beginPath(); ctx.arc(-0.2, -3.2, 2.8, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#CBD5E1';
        ctx.beginPath(); ctx.arc(-0.2, -3.2, 2.1, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#101827'; ctx.fillRect(0.1, -3.7, 1.9, 1.1);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(-3, -0.5, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#CBD5E1'; ctx.fillRect(1.5, 1.5, 7.5, 2);
        ctx.fillStyle = 'rgba(2,6,23,0.8)'; ctx.fillRect(1.5, 3.5, 7.5, 0.8);
        if (u.muzzleFlash > 0) {
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(10.5, 2.5, 2.4 * (u.muzzleFlash / 4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0.5, 0, 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.rotate(u.angle);
        for (let track = -1; track <= 1; track += 2) {
          const trackY = track * 8.7;
          ctx.fillStyle = '#080D17';
          drawRoundRect(ctx, -11, trackY - 2.4, 22, 4.8, 2.2); ctx.fill();
          ctx.strokeStyle = 'rgba(148,163,184,0.42)'; ctx.lineWidth = 0.65;
          drawRoundRect(ctx, -11, trackY - 2.4, 22, 4.8, 2.2); ctx.stroke();
          for (let wheel = 0; wheel < 4; wheel++) {
            ctx.fillStyle = wheel % 2 === 0 ? '#94A3B8' : '#475569';
            ctx.beginPath(); ctx.arc(-7.5 + wheel * 5, trackY, 1.1, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.fillStyle = '#22334A';
        ctx.beginPath();
        ctx.moveTo(-9, -5); ctx.lineTo(-6, -6.3); ctx.lineTo(5, -6.3);
        ctx.lineTo(10, -3.1); ctx.lineTo(10, 3.1); ctx.lineTo(5, 6.3);
        ctx.lineTo(-6, 6.3); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(2,6,23,0.95)'; ctx.lineWidth = 2.7; ctx.stroke();
        ctx.strokeStyle = u.empStun > 0 ? '#22D3EE' : u.veteranRank > 1 ? '#FBBF24' : col; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath(); ctx.moveTo(-6, -4.4); ctx.lineTo(4, -4.7); ctx.lineTo(7, -2.7); ctx.lineTo(-6, -2.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col; ctx.fillRect(-1.3, -5.2, 2.6, 10.4);
        ctx.restore();
        ctx.save(); ctx.rotate(u.turretAngle);
        ctx.fillStyle = '#CBD5E1';
        drawRoundRect(ctx, 3 - u.recoil, -1.8, 15, 3.6, 1.2); ctx.fill();
        ctx.strokeStyle = 'rgba(2,6,23,0.85)'; ctx.lineWidth = 0.9; ctx.stroke();
        ctx.fillStyle = 'rgba(2,6,23,0.85)'; ctx.fillRect(15 - u.recoil, -1, 2, 2);
        if (u.muzzleFlash > 0) {
          const mf = u.muzzleFlash / 4;
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(19 - u.recoil, 0, 4.8 * mf, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(19 - u.recoil, 0, 2.2 * mf, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#101B2D';
        drawRoundRect(ctx, -6.5, -6, 13, 12, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(2,6,23,0.95)'; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        drawRoundRect(ctx, -3.5, -4.5, 6, 2, 1); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(-2.3, 0, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Chispas EMP sobre tanques paralizados
        if (u.empStun > 0) {
          ctx.save();
          ctx.strokeStyle = this.frame % 6 < 3 ? '#67E8F9' : '#22D3EE';
          ctx.lineWidth = 1.5;
          const jitter = Math.sin(this.frame * 0.7 + u.x) * 3;
          ctx.beginPath();
          ctx.moveTo(-12, -8 + jitter);
          ctx.lineTo(-4, -2 - jitter);
          ctx.lineTo(3, -9 + jitter);
          ctx.lineTo(11, 2 - jitter);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = 'rgba(2,6,23,0.82)';
        drawRoundRect(ctx, -12, -18, 24, 3.5, 1.75); ctx.fill();
        const hpRatio = Math.max(0, Math.min(1, u.hp / u.maxHp));
        if (hpRatio > 0) {
          ctx.fillStyle = u.veteranRank > 1 ? '#FBBF24' : col;
          drawRoundRect(ctx, -11.5, -17.5, 23 * hpRatio, 2.5, 1.25); ctx.fill();
        }
      }
      ctx.restore();
      const cosmetic = u.owner ? getCosmeticFrameFromBadges(state.playerRecords[u.owner]?.badges) : undefined;
      if (u.type === 'tank' && u.owner) drawUnitAvatar(ctx, u.x, u.y - 27, 9, u.avatarUrl, u.owner, col, u.veteranRank, cosmetic);
      else if (u.type === 'soldier' && u.isLeader && u.owner) drawUnitAvatar(ctx, u.x, u.y - 16, 7, u.avatarUrl, u.owner, col, u.veteranRank, cosmetic, false);
    }

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.projectiles) {
      const shell = p.type === 'shell';
      const trailColor = shell ? '#FDBA74' : p.color;
      const trailLength = shell ? 3.1 : p.type === 'turret' ? 1.25 : 1.8;
      ctx.lineCap = 'round';
      ctx.strokeStyle = hexToRgba(trailColor, shell ? 0.3 : 0.2);
      ctx.lineWidth = shell ? 5 : 3.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * trailLength, p.y - p.vy * trailLength); ctx.stroke();
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = shell ? 2.2 : 1.25;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * trailLength, p.y - p.vy * trailLength); ctx.stroke();
      ctx.fillStyle = trailColor;
      ctx.beginPath(); ctx.arc(p.x, p.y, shell ? 2.8 : 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shell ? '#FFF7ED' : '#FFFFFF';
      ctx.beginPath(); ctx.arc(p.x, p.y, shell ? 1.1 : 0.7, 0, Math.PI * 2); ctx.fill();
    }
    for (const b of this.bombs) {
      const bx = b.x + (b.tx - b.x) * b.progress;
      const by = b.y + (b.ty - b.y) * b.progress;
      const pulse = Math.sin(b.progress * Math.PI);
      ctx.strokeStyle = hexToRgba(b.color, 0.28 + pulse * 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(b.tx, b.ty, 3 + b.progress * 5, 2 + b.progress * 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hexToRgba('#FDBA74', 0.18 + pulse * 0.18);
      ctx.beginPath(); ctx.arc(bx, by, 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF7CC'; ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    for (const m of this.meteors) {
      const mx = m.x + (m.tx - m.x) * m.progress, my = m.y + (m.ty - m.y) * m.progress;
      ctx.strokeStyle = 'rgba(251,146,60,0.6)'; ctx.beginPath(); ctx.arc(m.tx, m.ty, 18 * (1 - m.progress) + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(251,146,60,0.35)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - (m.tx - m.x) * 0.12, my - (m.ty - m.y) * 0.12); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,229,170,0.88)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - (m.tx - m.x) * 0.08, my - (m.ty - m.y) * 0.08); ctx.stroke();
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(mx, my, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of this.particles) {
      const alpha = Math.max(0, pt.alpha);
      ctx.strokeStyle = hexToRgba(pt.color, alpha * 0.3);
      ctx.lineWidth = Math.max(0.7, pt.size * 0.7);
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * 0.75, pt.y - pt.vy * 0.75); ctx.stroke();
      ctx.fillStyle = hexToRgba(pt.color, alpha);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
      if (pt.size > 2.4) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.55})`;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.32, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.alpha);
      ctx.strokeStyle = hexToRgba(sw.color, alpha * 0.28);
      ctx.lineWidth = sw.width * 2.4;
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = hexToRgba(sw.color, alpha);
      ctx.lineWidth = Math.max(0.8, sw.width * 0.75);
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    for (const sm of this.smokePlumes) { ctx.fillStyle = `rgba(15,23,42,${Math.max(0, sm.alpha)})`; ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2); ctx.fill(); }

    for (const j of this.jets) {
      const col = j.team === 'A' ? state.teamA.color : state.teamB.color;
      // Estelas de condensación de los Jets
      const drawTrail = (pts: Point[]) => {
        if (pts.length < 2) return;
        ctx.save();
        ctx.lineCap = 'round';
        for (let k = 1; k < pts.length; k++) {
          const a = (k / pts.length) * 0.45;
          ctx.strokeStyle = hexToRgba(col, a);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(pts[k - 1].x, pts[k - 1].y);
          ctx.lineTo(pts[k].x, pts[k].y);
          ctx.stroke();
        }
        ctx.restore();
      };
      drawTrail(j.contrailL);
      drawTrail(j.contrailR);

      ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.angle);
      ctx.fillStyle = '#1E293B'; ctx.strokeStyle = col; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-9, -14); ctx.lineTo(-6, 0); ctx.lineTo(-9, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (j.owner) {
        const cosmetic = getCosmeticFrameFromBadges(state.playerRecords[j.owner]?.badges);
        drawUnitAvatar(ctx, j.x, j.y - 20, 9, j.avatarUrl, j.owner, col, j.veteranRank, cosmetic);
      }
    }

    for (const orb of this.orbitals) {
      if (!orb.detonated) {
        const p = 1 - orb.timer / orb.maxTimer;
        ctx.strokeStyle = 'rgba(239,68,68,0.9)'; ctx.beginPath(); ctx.arc(orb.x, orb.y, 64 * (1 - p * 0.65), 0, Math.PI * 2); ctx.stroke();
        const cosmetic = getCosmeticFrameFromBadges(state.playerRecords[orb.owner]?.badges);
        drawUnitAvatar(ctx, orb.x, orb.y - (1 - p) * 160, 12, orb.avatarUrl, orb.owner, '#FBBF24', 1, cosmetic);
      } else {
        const a = orb.beamLife / 32, bw = 46 * a;
        ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(orb.x - bw, 0, bw * 2, this.H);
      }
    }

    for (const fb of this.floatBadges) {
      ctx.save(); ctx.globalAlpha = Math.max(0, fb.alpha); ctx.font = '800 10.5px -apple-system, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = fb.color; ctx.fillText(fb.text, fb.x, fb.y); ctx.restore();
    }
    for (const c of this.confetti) {
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.globalAlpha = Math.max(0, c.alpha);
      ctx.fillStyle = c.color; ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.55); ctx.restore();
    }

    // Partículas ambientales del bioma (luciérnagas, nieve, brasas, arena)
    this.biomeRenderer.renderAmbient(ctx, biome, this.W, this.H, this.frame);

    if (state.screenFlash > 0.02) { ctx.fillStyle = `rgba(255,255,255,${state.screenFlash * 0.55})`; ctx.fillRect(0, 0, this.W, this.H); }
    ctx.restore();
  }

  private drawSideTowers(team: TeamId, baseObj: BaseState, biome: ReturnType<typeof getActiveBiome>): void {
    const ctx = this.ctx;
    const barY = team === 'A' ? -20 : 16.5;
    ([0, 1] as const).forEach((lane) => {
      const sd = baseObj.sideDefenses[lane];
      const pos = this.getSideTowerPos(team, lane);
      ctx.save(); ctx.translate(pos.x, pos.y);
      if (sd.hp <= 0) {
        ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }
      ctx.fillStyle = 'rgba(2,6,23,0.3)';
      ctx.beginPath(); ctx.ellipse(2, 4, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = biome.tower.platform;
      drawRoundRect(ctx, -14, -14, 28, 28, 7); ctx.fill();
      ctx.fillStyle = sd.flash > 0 ? '#FFFFFF' : biome.tower.wall;
      ctx.strokeStyle = baseObj.empTimer > 0 ? '#22D3EE' : baseObj.color;
      drawRoundRect(ctx, -11, -11, 22, 22, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(2,6,23,0.78)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = baseObj.empTimer > 0 ? '#22D3EE' : baseObj.color; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-7, -8, 14, 2);
      ctx.fillStyle = biome.tower.trim;
      drawRoundRect(ctx, -10, -10, 4, 4, 1); ctx.fill();
      drawRoundRect(ctx, 6, -10, 4, 4, 1); ctx.fill();
      drawRoundRect(ctx, -10, 6, 4, 4, 1); ctx.fill();
      drawRoundRect(ctx, 6, 6, 4, 4, 1); ctx.fill();

      ctx.save(); ctx.rotate(sd.angle);
      ctx.fillStyle = baseObj.empTimer > 0 ? '#475569' : biome.tower.trim;
      drawRoundRect(ctx, 0, -2.4, 13, 4.8, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(2,6,23,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = baseObj.color;
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-0.6, -0.7, 0.65, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(2,6,23,0.78)';
      drawRoundRect(ctx, -14, barY, 28, 3.5, 1.75); ctx.fill();
      const hpRatio = Math.max(0, Math.min(1, sd.hp / sd.maxHp));
      if (hpRatio > 0) {
        ctx.fillStyle = baseObj.color;
        drawRoundRect(ctx, -13.5, barY + 0.5, 27 * hpRatio, 2.5, 1.25); ctx.fill();
      }
      ctx.restore();
    });
  }

  private drawBase(
    x: number, y: number, baseObj: BaseState, isTop: boolean,
    biome: ReturnType<typeof getActiveBiome>, protectedBySides: boolean
  ): void {
    const ctx = this.ctx, col = baseObj.flash > 0 ? '#FFFFFF' : baseObj.color;
    ctx.save(); ctx.translate(x, y);

    ctx.fillStyle = 'rgba(2,6,23,0.38)';
    ctx.beginPath(); ctx.ellipse(3, 16, 29, 11, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = biome.tower.platform;
    ctx.beginPath();
    for (let s = 0; s < 6; s++) { const a = (Math.PI / 3) * s; if (s === 0) ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 24); else ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 24); }
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = biome.tower.stroke; ctx.stroke();

    ctx.beginPath();
    for (let s = 0; s < 6; s++) { const a = (Math.PI / 3) * s; if (s === 0) ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 20); else ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 20); }
    ctx.closePath();
    const towerWall = ctx.createLinearGradient(0, -20, 0, 20);
    towerWall.addColorStop(0, hexToRgba('#FFFFFF', 0.22));
    towerWall.addColorStop(0.42, biome.tower.wall);
    towerWall.addColorStop(1, hexToRgba('#0F172A', 0.18));
    ctx.fillStyle = towerWall; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = baseObj.empTimer > 0 ? '#22D3EE' : biome.tower.stroke; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.26)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, -8, 15, 4.5, 0, Math.PI, Math.PI * 2); ctx.stroke();

    ctx.save();
    ctx.shadowColor = hexToRgba(biome.tower.gem, 0.7);
    ctx.shadowBlur = 8;
    ctx.fillStyle = baseObj.empTimer > 0 ? '#22D3EE' : biome.tower.gem;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5.5, -1); ctx.lineTo(3.5, 6); ctx.lineTo(-3.5, 6); ctx.lineTo(-5.5, -1); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(1.7, -1); ctx.lineTo(-1.6, -1); ctx.closePath(); ctx.fill();

    [{ dx: -20, dy: isTop ? 9 : -9 }, { dx: 20, dy: isTop ? 9 : -9 }].forEach((off, idx) => {
      ctx.save(); ctx.translate(off.dx, off.dy); ctx.rotate(baseObj.turretAngles[idx]);
      ctx.fillStyle = baseObj.empTimer > 0 ? '#475569' : biome.tower.trim;
      drawRoundRect(ctx, 0, -1.8, 11, 3.6, 1.5); ctx.fill();
      ctx.strokeStyle = 'rgba(2,6,23,0.58)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    });

    if (protectedBySides) {
      ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '700 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', 0, isTop ? -26 : 26);
    }
    if (baseObj.shieldTimer > 0 && baseObj.shieldHp > 0) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#67E8F9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    if (baseObj.shieldTimer > 0 && baseObj.shieldHp > 0 && baseObj.shieldOwner) {
      const cosmetic = getCosmeticFrameFromBadges(state.playerRecords[baseObj.shieldOwner]?.badges);
      drawUnitAvatar(ctx, x, y + (isTop ? 34 : -34), 8, baseObj.shieldAvatar, baseObj.shieldOwner, '#22D3EE', 1, cosmetic);
    }
  }
}