import { DeployOrder, TeamId } from './EventBus';
import { BaseState, DESIGN_W, MAX_BASE_HP, state } from './GameState';
import { drawRoundRect, distSq, hexToRgba } from '../utils/helpers';
import { drawUnitAvatar, resetAvatarFrameRegistry } from '../systems/AvatarCache';
import { getActiveBiome } from '../config/biomes';
import { BiomeRenderer } from '../render/BiomeRenderer';
import { SynthEngine } from '../audio/SynthEngine';

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

  constructor(
    private canvas: HTMLCanvasElement,
    private stageFrame: HTMLElement,
    private stage: HTMLElement,
    private cardBaseA: HTMLElement,
    private cardBaseB: HTMLElement,
    private synth: SynthEngine,
    private onBaseDamageUI: () => void,
    private onVictory: (winner: TeamId) => void
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
    this.projectiles.length = 0;
    this.orbitals.length = 0;
    this.meteors.length = 0;
    this.hackBeams.length = 0;
    this.scars.length = 0;
  }

  deployOrder(order: DeployOrder): void {
    if (!state.roundActive) return;
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
          hp: Math.round(48 * vetMultHp),
          maxHp: Math.round(48 * vetMultHp),
          speed: 1.0 + Math.random() * 0.12,
          range: 54,
          damage: Math.round(11 * vetMultDmg),
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
      this.synth.playSFX('rifle');
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
        hp: Math.round(320 * vetMultHp),
        maxHp: Math.round(320 * vetMultHp),
        speed: 0.62,
        range: 82,
        damage: Math.round(48 * vetMultDmg),
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
      this.synth.playSFX('cannon');
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
    this.confetti.length = 0;
    const pal = [winObj.color, '#FBBF24', '#FFFFFF', '#FB7185'];
    for (let i = 0; i < 80; i++) {
      this.confetti.push({
        x: this.safeCenterX + (Math.random() - 0.5) * 60,
        y: this.midY,
        vx: (Math.random() - 0.5) * 11,
        vy: (Math.random() - 0.85) * 14,
        size: 4 + Math.random() * 4,
        color: pal[Math.floor(Math.random() * pal.length)],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      });
    }
  }

  pushBadge(x: number, y: number, text: string, color: string, vy = -0.6): void {
    if (this.floatBadges.length >= CAPS.badges) this.floatBadges.shift();
    this.floatBadges.push({ x, y, text, color, vy, alpha: 1, decay: 0.018 });
  }

  pushShockwave(x: number, y: number, maxR: number, color: string, width = 2.2): void {
    if (this.shockwaves.length >= CAPS.shockwaves) this.shockwaves.shift();
    this.shockwaves.push({ x, y, r: 8, maxR, color, alpha: 0.92, width });
  }

  private addScar(type: Scar['type'], x: number, y: number, r: number, angle = 0): void {
    if (this.scars.length >= CAPS.scars) this.scars.shift();
    this.scars.push({ type, x, y, r, angle, alpha: type === 'tread' ? 0.24 : 0.72 });
  }

  private emitDamageSmoke(x: number, y: number, intense: boolean): void {
    if (this.smokePlumes.length >= CAPS.smoke) this.smokePlumes.shift();
    this.smokePlumes.push({
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.45 - Math.random() * 0.35,
      r: intense ? 5.5 + Math.random() * 3.5 : 3.5 + Math.random() * 2.5,
      grow: 0.14,
      alpha: intense ? 0.44 : 0.28,
      decay: 0.014,
    });
  }

  spawnExplosion(x: number, y: number, color: string, size: 'small' | 'medium' | 'nuclear' = 'small'): void {
    const cfg =
      size === 'nuclear'
        ? { sparks: 44, smoke: 14, spd: 7.5, ring: (this.safeRight - this.safeLeft) * 0.94 }
        : size === 'medium'
          ? { sparks: 14, smoke: 5, spd: 4.0, ring: 42 }
          : { sparks: 5, smoke: 2, spd: 2.2, ring: 0 };

    for (let i = 0; i < cfg.sparks; i++) {
      if (this.particles.length >= CAPS.particles) this.particles.shift();
      const a = Math.random() * Math.PI * 2,
        s = (Math.random() * 0.75 + 0.25) * cfg.spd;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        size: Math.random() * (size === 'nuclear' ? 3.8 : 2.1) + 1.1,
        color: Math.random() > 0.5 ? '#FEF08A' : Math.random() > 0.4 ? '#EF4444' : color,
        alpha: 1, decay: 0.025 + Math.random() * 0.02,
      });
    }
    for (let i = 0; i < cfg.smoke; i++) {
      if (this.smokePlumes.length >= CAPS.smoke) this.smokePlumes.shift();
      const a = Math.random() * Math.PI * 2,
        s = Math.random() * (size === 'nuclear' ? 2.2 : 1.0);
      this.smokePlumes.push({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.2,
        r: size === 'nuclear' ? 12 : 4 + Math.random() * 4,
        grow: size === 'nuclear' ? 0.4 : 0.16, alpha: size === 'nuclear' ? 0.6 : 0.36, decay: 0.015,
      });
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
    const pos = this.getSideTowerPos(targetTeam, lane);
    if (tower.hp <= 0) {
      this.spawnExplosion(pos.x, pos.y, base.color, 'medium');
      this.synth.playSFX('cannon');
      state.shake = Math.max(state.shake, 7);
      this.pushBadge(pos.x, pos.y, '💥 TORRE CAÍDA', '#FDE047', -0.7);
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
    if (base.hp <= 0) this.onVictory(targetTeam === 'A' ? 'B' : 'A');
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
          sd.cooldown = 30;
          this.projectiles.push({
            team, type: 'turret',
            x: pos.x + Math.cos(sd.angle) * 10, y: pos.y + Math.sin(sd.angle) * 10,
            vx: Math.cos(sd.angle) * 8.2, vy: Math.sin(sd.angle) * 8.2,
            damage: 12, splash: 0, color: baseObj.color, life: 28,
          });
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
          baseObj.turretCooldowns[idx] = 26;
          this.projectiles.push({
            team, type: 'turret',
            x: tx + Math.cos(ang) * 9, y: ty + Math.sin(ang) * 9,
            vx: Math.cos(ang) * 8.2, vy: Math.sin(ang) * 8.2,
            damage: 10, splash: 0, color: baseObj.color, life: 26,
          });
        }
      }
      if (baseObj.turretCooldowns[idx] > 0) baseObj.turretCooldowns[idx] -= ts;
    });
  }

  update(dtFrames: number): void {
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
        if (u.type === 'tank') { this.synth.playSFX('cannon'); state.shake = Math.max(state.shake, 3.2); }
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
          this.projectiles.push({
            team: u.team, type: u.type === 'tank' ? 'shell' : 'bullet',
            x: u.x + Math.cos(fAng) * (u.radius + 4), y: u.y + Math.sin(fAng) * (u.radius + 4),
            vx: Math.cos(fAng) * (u.type === 'tank' ? 6.0 : 8.5), vy: Math.sin(fAng) * (u.type === 'tank' ? 6.0 : 8.5),
            damage: u.damage, splash: u.splash, color: col, life: 45,
          });
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
        this.spawnExplosion(b.tx, b.ty, b.color, 'medium'); this.synth.playSFX('cannon'); state.shake = Math.max(state.shake, 3.5);
        for (const u of this.units) if (u.team === enemyTeam && distSq(u.x, u.y, b.tx, b.ty) < 58 * 58) u.hp -= 70 * dmgMult;
        ([0, 1] as const).forEach((lane) => {
          const tp = this.getSideTowerPos(enemyTeam, lane);
          if (distSq(tp.x, tp.y, b.tx, b.ty) < 58 * 58) this.damageSideTower(enemyTeam, lane, 85);
        });
        const eBaseY = enemyTeam === 'A' ? this.baseAY : this.baseBY;
        if (distSq(this.safeCenterX, eBaseY, b.tx, b.ty) < 88 * 88) this.damageBase(enemyTeam, 55, b.tx);
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
      if (hit || p.life <= 0) this.projectiles.splice(i, 1);
    }

    for (let i = this.scars.length - 1; i >= 0; i--) if ((this.scars[i].alpha -= 0.0005 * ts) <= 0.01) this.scars.splice(i, 1);
    for (let i = this.hackBeams.length - 1; i >= 0; i--) if ((this.hackBeams[i].life -= ts) <= 0) this.hackBeams.splice(i, 1);
    for (let i = this.particles.length - 1; i >= 0; i--) { const pt = this.particles[i]; pt.x += pt.vx * ts; pt.y += pt.vy * ts; pt.vx *= 0.94; pt.vy *= 0.94; if ((pt.alpha -= pt.decay * ts) <= 0) this.particles.splice(i, 1); }
    for (let i = this.smokePlumes.length - 1; i >= 0; i--) { const sm = this.smokePlumes[i]; sm.x += sm.vx * ts; sm.y += sm.vy * ts; sm.r += sm.grow * ts; if ((sm.alpha -= sm.decay * ts) <= 0) this.smokePlumes.splice(i, 1); }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) { const sw = this.shockwaves[i]; sw.r += (sw.maxR - sw.r) * 0.14 * ts; if ((sw.alpha -= 0.032 * ts) <= 0) this.shockwaves.splice(i, 1); }
    for (let i = this.floatBadges.length - 1; i >= 0; i--) { const fb = this.floatBadges[i]; fb.y += fb.vy * ts; if ((fb.alpha -= fb.decay * ts) <= 0) this.floatBadges.splice(i, 1); }
    for (let i = this.confetti.length - 1; i >= 0; i--) { const c = this.confetti[i]; c.x += c.vx * ts; c.y += c.vy * ts; c.vy += 0.22 * ts; c.rot += c.vRot * ts; if ((c.alpha -= 0.006 * ts) <= 0 || c.y > this.H) this.confetti.splice(i, 1); }
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
      if (u.type === 'soldier') {
        const bob = Math.sin(u.bobPhase) * 1.1;
        ctx.rotate(u.angle);
        ctx.translate(0, bob * 0.4);
        ctx.fillStyle = '#1E293B'; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        drawRoundRect(ctx, -3.5, -5.5, 6.5, 11, 2.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#CBD5E1'; ctx.fillRect(1.5, 1.5, 7.5, 2);
        if (u.muzzleFlash > 0) {
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(10.5, 2.5, 2.4 * (u.muzzleFlash / 4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0.5, 0, 3.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.rotate(u.angle);
        ctx.fillStyle = '#070A10'; ctx.fillRect(-12, -10.5, 24, 4.2); ctx.fillRect(-12, 6.3, 24, 4.2);
        ctx.fillStyle = '#1E293B'; ctx.strokeStyle = u.empStun > 0 ? '#22D3EE' : u.veteranRank > 1 ? '#FBBF24' : '#475569'; ctx.lineWidth = 1.4;
        drawRoundRect(ctx, -11, -7.5, 22, 15, 3); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.rotate(u.turretAngle);
        ctx.fillStyle = '#CBD5E1'; ctx.fillRect(3 - u.recoil, -2, 15, 4);
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
        ctx.fillStyle = '#0F172A'; ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        drawRoundRect(ctx, -6.5, -6, 13, 12, 3); ctx.fill(); ctx.stroke();
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

        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(-12, -18, 24, 3);
        ctx.fillStyle = u.veteranRank > 1 ? '#FBBF24' : col; ctx.fillRect(-12, -18, 24 * (u.hp / u.maxHp), 3);
      }
      ctx.restore();
      if (u.type === 'tank' && u.owner) drawUnitAvatar(ctx, u.x, u.y - 27, 9, u.avatarUrl, u.owner, col, u.veteranRank);
      else if (u.type === 'soldier' && u.isLeader && u.owner) drawUnitAvatar(ctx, u.x, u.y - 16, 7, u.avatarUrl, u.owner, col, u.veteranRank);
    }

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.projectiles) {
      ctx.strokeStyle = p.type === 'shell' ? '#FDBA74' : p.color; ctx.lineWidth = p.type === 'shell' ? 2.8 : 1.8;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5); ctx.stroke();
    }
    for (const b of this.bombs) {
      ctx.fillStyle = '#FDE047'; ctx.beginPath(); ctx.arc(b.x + (b.tx - b.x) * b.progress, b.y + (b.ty - b.y) * b.progress, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    for (const m of this.meteors) {
      const mx = m.x + (m.tx - m.x) * m.progress, my = m.y + (m.ty - m.y) * m.progress;
      ctx.strokeStyle = 'rgba(251,146,60,0.6)'; ctx.beginPath(); ctx.arc(m.tx, m.ty, 18 * (1 - m.progress) + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of this.particles) { ctx.fillStyle = hexToRgba(pt.color, Math.max(0, pt.alpha)); ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill(); }
    for (const sw of this.shockwaves) { ctx.strokeStyle = hexToRgba(sw.color, Math.max(0, sw.alpha)); ctx.lineWidth = sw.width; ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.stroke(); }
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
      if (j.owner) drawUnitAvatar(ctx, j.x, j.y - 20, 9, j.avatarUrl, j.owner, col, j.veteranRank);
    }

    for (const orb of this.orbitals) {
      if (!orb.detonated) {
        const p = 1 - orb.timer / orb.maxTimer;
        ctx.strokeStyle = 'rgba(239,68,68,0.9)'; ctx.beginPath(); ctx.arc(orb.x, orb.y, 64 * (1 - p * 0.65), 0, Math.PI * 2); ctx.stroke();
        drawUnitAvatar(ctx, orb.x, orb.y - (1 - p) * 160, 12, orb.avatarUrl, orb.owner, '#FBBF24');
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
      ctx.fillStyle = sd.flash > 0 ? '#FFFFFF' : biome.tower.wall;
      ctx.strokeStyle = baseObj.empTimer > 0 ? '#22D3EE' : baseObj.color;
      ctx.lineWidth = 2;
      drawRoundRect(ctx, -13, -13, 26, 26, 6); ctx.fill(); ctx.stroke();

      ctx.save(); ctx.rotate(sd.angle);
      ctx.fillStyle = baseObj.empTimer > 0 ? '#475569' : biome.tower.trim;
      ctx.fillRect(0, -2, 12, 4);
      ctx.restore();

      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(-14, barY, 28, 3.5);
      ctx.fillStyle = baseObj.color; ctx.fillRect(-14, barY, 28 * (sd.hp / sd.maxHp), 3.5);
      ctx.restore();
    });
  }

  private drawBase(
    x: number, y: number, baseObj: BaseState, isTop: boolean,
    biome: ReturnType<typeof getActiveBiome>, protectedBySides: boolean
  ): void {
    const ctx = this.ctx, col = baseObj.flash > 0 ? '#FFFFFF' : baseObj.color;
    ctx.save(); ctx.translate(x, y);

    ctx.fillStyle = biome.tower.platform;
    ctx.beginPath();
    for (let s = 0; s < 6; s++) { const a = (Math.PI / 3) * s; if (s === 0) ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 24); else ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 24); }
    ctx.closePath(); ctx.fill();

    ctx.beginPath();
    for (let s = 0; s < 6; s++) { const a = (Math.PI / 3) * s; if (s === 0) ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 20); else ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 20); }
    ctx.closePath(); ctx.fillStyle = biome.tower.wall; ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = baseObj.empTimer > 0 ? '#22D3EE' : biome.tower.stroke; ctx.stroke();

    ctx.fillStyle = baseObj.empTimer > 0 ? '#22D3EE' : biome.tower.gem;
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = col; ctx.stroke();

    [{ dx: -20, dy: isTop ? 9 : -9 }, { dx: 20, dy: isTop ? 9 : -9 }].forEach((off, idx) => {
      ctx.save(); ctx.translate(off.dx, off.dy); ctx.rotate(baseObj.turretAngles[idx]);
      ctx.fillStyle = baseObj.empTimer > 0 ? '#475569' : biome.tower.trim; ctx.fillRect(0, -1.6, 10, 3.2);
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
      drawUnitAvatar(ctx, x, y + (isTop ? 34 : -34), 8, baseObj.shieldAvatar, baseObj.shieldOwner, '#22D3EE');
    }
  }
}