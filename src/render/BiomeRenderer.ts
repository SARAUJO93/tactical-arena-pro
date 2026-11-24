import { BiomeTheme } from '../config/biomes';
import { drawRoundRect } from '../utils/helpers';

interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

export class BiomeRenderer {
  private motes: AmbientMote[] = [];
  private seeded = false;
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticCacheKey = '';

  private ensureMotes(W: number, H: number): void {
    if (this.seeded) return;
    this.seeded = true;
    for (let i = 0; i < 28; i++) {
      this.motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.45,
        r: 1.2 + Math.random() * 2.1,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private ensureStaticLayer(
    biome: BiomeTheme,
    W: number,
    H: number,
    safeLeft: number,
    safeRight: number,
    baseAY: number,
    baseBY: number,
    bridgeLeftX: number,
    bridgeRightX: number
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;

    const key = [
      biome.id,
      Math.round(W),
      Math.round(H),
      Math.round(safeLeft),
      Math.round(safeRight),
      Math.round(baseAY),
      Math.round(baseBY),
      Math.round(bridgeLeftX),
      Math.round(bridgeRightX),
    ].join('|');

    if (this.staticCanvas && this.staticCacheKey === key) {
      return this.staticCanvas;
    }

    const scale = 2;
    const canvas = this.staticCanvas ?? document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(W * scale));
    canvas.height = Math.max(1, Math.round(H * scale));

    const off = canvas.getContext('2d');
    if (!off) return null;

    off.setTransform(scale, 0, 0, scale, 0, 0);
    off.clearRect(0, 0, W, H);

    // 1. Base atmosférica exterior
    const outerBg = off.createLinearGradient(0, 0, 0, H);
    outerBg.addColorStop(0, biome.sky[0]);
    outerBg.addColorStop(0.5, biome.sky[1]);
    outerBg.addColorStop(1, biome.sky[2]);
    off.fillStyle = outerBg;
    off.fillRect(0, 0, W, H);

    // 2. Arena principal con cuadrícula tipo tablero Clash Royale
    const padX = 12;
    const arenaX = safeLeft - padX;
    const arenaW = safeRight - safeLeft + padX * 2;
    const arenaTop = Math.max(0, baseAY - 58);
    const arenaBot = Math.min(H, baseBY + 58);
    const arenaH = arenaBot - arenaTop;

    // Borde/muro de piedra exterior de la arena
    off.fillStyle = biome.tower.stroke;
    drawRoundRect(off, arenaX - 6, arenaTop - 6, arenaW + 12, arenaH + 12, 16);
    off.fill();

    // Suelo base de la arena
    const groundGrad = off.createLinearGradient(0, arenaTop, 0, arenaBot);
    groundGrad.addColorStop(0, biome.ground[0]);
    groundGrad.addColorStop(0.5, biome.ground[1]);
    groundGrad.addColorStop(1, biome.ground[2]);
    off.fillStyle = groundGrad;
    drawRoundRect(off, arenaX, arenaTop, arenaW, arenaH, 12);
    off.fill();

    // Patrón de losetas alternadas + caminos empedrados dentro del clip
    off.save();
    drawRoundRect(off, arenaX, arenaTop, arenaW, arenaH, 12);
    off.clip();

    const tileSize = 24;
    const cols = Math.ceil(arenaW / tileSize);
    const rows = Math.ceil(arenaH / tileSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          off.fillStyle = biome.id === 'frost' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.065)';
          off.fillRect(arenaX + c * tileSize, arenaTop + r * tileSize, tileSize, tileSize);
        } else {
          off.fillStyle = 'rgba(0,0,0,0.055)';
          off.fillRect(arenaX + c * tileSize, arenaTop + r * tileSize, tileSize, tileSize);
        }
      }
    }

    // 3. Caminos empedrados conectando bases y puentes
    this.drawStonePath(off, biome, bridgeLeftX, baseAY + 10, baseBY - 10);
    this.drawStonePath(off, biome, bridgeRightX, baseAY + 10, baseBY - 10);

    const centerX = (safeLeft + safeRight) / 2;
    this.drawHorizontalPath(off, biome, bridgeLeftX, bridgeRightX, baseAY + 34);
    this.drawHorizontalPath(off, biome, bridgeLeftX, bridgeRightX, baseBY - 34);
    this.drawStonePath(off, biome, centerX, baseAY, baseAY + 34);
    this.drawStonePath(off, biome, centerX, baseBY - 34, baseBY);

    off.restore();

    this.staticCanvas = canvas;
    this.staticCacheKey = key;
    return canvas;
  }

  renderBackground(
    ctx: CanvasRenderingContext2D,
    biome: BiomeTheme,
    W: number,
    H: number,
    safeLeft: number,
    safeRight: number,
    baseAY: number,
    baseBY: number,
    midY: number,
    bridgeLeftX: number,
    bridgeRightX: number,
    frame: number
  ): void {
    this.ensureMotes(W, H);

    const staticLayer = this.ensureStaticLayer(
      biome,
      W,
      H,
      safeLeft,
      safeRight,
      baseAY,
      baseBY,
      bridgeLeftX,
      bridgeRightX
    );

    if (staticLayer) {
      ctx.drawImage(staticLayer, 0, 0, W, H);
    }

    const padX = 12;
    const arenaX = safeLeft - padX;
    const arenaW = safeRight - safeLeft + padX * 2;
    const arenaTop = Math.max(0, baseAY - 58);
    const arenaBot = Math.min(H, baseBY + 58);
    const arenaH = arenaBot - arenaTop;

    ctx.save();
    drawRoundRect(ctx, arenaX, arenaTop, arenaW, arenaH, 12);
    ctx.clip();

    // 4. Río / Foso central animado
    this.drawRiver(ctx, biome, arenaX, arenaW, midY, frame);

    // 5. Puentes detallados con tablones y barandales
    this.drawBridge(ctx, biome, bridgeLeftX, midY);
    this.drawBridge(ctx, biome, bridgeRightX, midY);

    // 6. Decoración perimetral por bioma (árboles, cristales, rocas, ruinas)
    this.drawBiomeProps(ctx, biome, arenaX, arenaX + arenaW, arenaTop, arenaBot, midY, frame);

    ctx.restore();
  }

  private drawStonePath(ctx: CanvasRenderingContext2D, biome: BiomeTheme, x: number, y1: number, y2: number): void {
    const top = Math.min(y1, y2);
    const h = Math.abs(y2 - y1);
    ctx.fillStyle = biome.id === 'volcano' ? 'rgba(30,22,28,0.45)' : 'rgba(255,244,214,0.22)';
    ctx.fillRect(x - 11, top, 22, h);

    // Lajas individuales
    ctx.fillStyle = biome.id === 'volcano' ? 'rgba(130,115,125,0.28)' : 'rgba(255,250,235,0.24)';
    for (let y = top + 4; y < top + h - 6; y += 12) {
      drawRoundRect(ctx, x - 8, y, 16, 7, 2);
      ctx.fill();
    }
  }

  private drawHorizontalPath(ctx: CanvasRenderingContext2D, biome: BiomeTheme, x1: number, x2: number, y: number): void {
    const left = Math.min(x1, x2);
    const w = Math.abs(x2 - x1);
    ctx.fillStyle = biome.id === 'volcano' ? 'rgba(30,22,28,0.38)' : 'rgba(255,244,214,0.18)';
    ctx.fillRect(left, y - 7, w, 14);
  }

  private drawRiver(
    ctx: CanvasRenderingContext2D,
    biome: BiomeTheme,
    arenaX: number,
    arenaW: number,
    midY: number,
    frame: number
  ): void {
    // Sombra de profundidad del foso
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(arenaX, midY - 19, arenaW, 38);

    // Orillas de piedra/tierra
    ctx.fillStyle = biome.bank;
    ctx.fillRect(arenaX, midY - 16, arenaW, 32);

    // Agua / Lava
    const rg = ctx.createLinearGradient(0, midY - 13, 0, midY + 13);
    rg.addColorStop(0, biome.water[0]);
    rg.addColorStop(0.5, biome.water[1]);
    rg.addColorStop(1, biome.water[2]);
    ctx.fillStyle = rg;
    ctx.fillRect(arenaX, midY - 12, arenaW, 24);

    // Corriente animada (ondas de agua, grietas de hielo o burbujas de lava)
    const offset = (frame * 0.65) % 36;
    if (biome.id === 'volcano') {
      ctx.fillStyle = 'rgba(255, 230, 128, 0.55)';
      for (let x = arenaX - 20 + offset; x < arenaX + arenaW; x += 36) {
        const pulse = 2 + Math.sin(frame * 0.08 + x) * 1.4;
        ctx.beginPath();
        ctx.arc(x, midY + Math.sin(x * 0.1) * 4, pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = biome.id === 'frost' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1.4;
      for (let x = arenaX - 36 + offset; x < arenaX + arenaW; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, midY - 4);
        ctx.quadraticCurveTo(x + 9, midY - 7, x + 18, midY - 4);
        ctx.moveTo(x + 10, midY + 5);
        ctx.quadraticCurveTo(x + 19, midY + 2, x + 28, midY + 5);
        ctx.stroke();
      }
    }
  }

  private drawBridge(ctx: CanvasRenderingContext2D, biome: BiomeTheme, bx: number, midY: number): void {
    // Sombra bajo el puente
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    drawRoundRect(ctx, bx - 17, midY - 17, 36, 36, 4);
    ctx.fill();

    // Base del puente
    ctx.fillStyle = biome.bridge[0];
    drawRoundRect(ctx, bx - 15, midY - 16, 30, 32, 3);
    ctx.fill();

    // Tablones / losas del puente
    ctx.fillStyle = biome.bridge[1];
    for (let y = midY - 13; y <= midY + 11; y += 6) {
      ctx.fillRect(bx - 12, y, 24, 3.5);
    }

    // Barandales laterales + postes en las 4 esquinas
    ctx.fillStyle = biome.bridge[2];
    ctx.fillRect(bx - 16, midY - 16, 3.5, 32);
    ctx.fillRect(bx + 12.5, midY - 16, 3.5, 32);

    ctx.fillStyle = biome.tower.trim;
    [
      [bx - 14.5, midY - 15],
      [bx + 14.5, midY - 15],
      [bx - 14.5, midY + 15],
      [bx + 14.5, midY + 15],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawBiomeProps(
    ctx: CanvasRenderingContext2D,
    biome: BiomeTheme,
    left: number,
    right: number,
    top: number,
    bot: number,
    midY: number,
    frame: number
  ): void {
    const spots = [
      { x: left + 10, y: top + 24 },
      { x: right - 10, y: top + 24 },
      { x: left + 9, y: midY - 34 },
      { x: right - 9, y: midY - 34 },
      { x: left + 9, y: midY + 34 },
      { x: right - 9, y: midY + 34 },
      { x: left + 10, y: bot - 24 },
      { x: right - 10, y: bot - 24 },
    ];

    spots.forEach((s, idx) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      // Sombra proyectada
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (biome.id === 'grove') {
        // Pinos y arbustos frondosos
        ctx.fillStyle = '#14532d';
        ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(-2, -2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#86efac';
        ctx.beginPath(); ctx.arc(-3, -3, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (biome.id === 'frost') {
        // Cristales de hielo facetados
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(7, 2); ctx.lineTo(0, 7); ctx.lineTo(-7, 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(3, 1); ctx.lineTo(-3, 1);
        ctx.closePath(); ctx.fill();
      } else if (biome.id === 'volcano') {
        // Rocas de obsidiana con grieta de magma pulsante
        ctx.fillStyle = '#1f1924';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        const glow = 0.55 + Math.sin(frame * 0.09 + idx) * 0.35;
        ctx.strokeStyle = `rgba(255, 115, 45, ${glow})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(1, 0); ctx.lineTo(4, 3); ctx.stroke();
      } else {
        // Columnas / ruinas del desierto + palma
        ctx.fillStyle = '#b48a54';
        drawRoundRect(ctx, -6, -6, 12, 12, 3); ctx.fill();
        ctx.fillStyle = '#fde68a';
        drawRoundRect(ctx, -4, -4, 8, 8, 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  renderAmbient(ctx: CanvasRenderingContext2D, biome: BiomeTheme, W: number, H: number, frame: number): void {
    this.ensureMotes(W, H);
    ctx.save();
    for (const m of this.motes) {
      if (biome.id === 'frost') {
        m.y += Math.abs(m.vy) * 1.1;
        m.x += Math.sin(frame * 0.03 + m.phase) * 0.35;
      } else if (biome.id === 'desert') {
        m.x += 0.85;
        m.y += Math.sin(frame * 0.04 + m.phase) * 0.2;
      } else {
        m.x += m.vx + Math.sin(frame * 0.03 + m.phase) * 0.2;
        m.y += m.vy;
      }

      if (m.y < -10) m.y = H + 10;
      if (m.y > H + 10) m.y = -10;
      if (m.x < -10) m.x = W + 10;
      if (m.x > W + 10) m.x = -10;

      const alpha = 0.28 + Math.sin(frame * 0.07 + m.phase) * 0.22;
      ctx.fillStyle =
        biome.id === 'volcano'
          ? `rgba(255, 145, 60, ${alpha + 0.2})`
          : biome.id === 'frost'
            ? `rgba(240, 252, 255, ${alpha + 0.2})`
            : biome.id === 'desert'
              ? `rgba(255, 224, 150, ${alpha})`
              : `rgba(187, 247, 208, ${alpha + 0.15})`;

      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}