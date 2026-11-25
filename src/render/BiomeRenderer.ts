import { BiomeTheme } from '../config/biomes';
import { drawRoundRect, hexToRgba } from '../utils/helpers';

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

    const ambientGlow = off.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, Math.max(W, H) * 0.72);
    ambientGlow.addColorStop(0, hexToRgba(biome.accent, 0.1));
    ambientGlow.addColorStop(1, hexToRgba(biome.accent, 0));
    off.fillStyle = ambientGlow;
    off.fillRect(0, 0, W, H);

    // 2. Arena principal con cuadrícula tipo tablero Clash Royale
    const padX = 12;
    const arenaX = safeLeft - padX;
    const arenaW = safeRight - safeLeft + padX * 2;
    const arenaTop = Math.max(0, baseAY - 58);
    const arenaBot = Math.min(H, baseBY + 58);
    const arenaH = arenaBot - arenaTop;

    // Marco de piedra elevado con luz en el borde superior
    off.save();
    off.shadowColor = 'rgba(0,0,0,0.48)';
    off.shadowBlur = 16;
    off.shadowOffsetY = 6;
    off.fillStyle = biome.tower.stroke;
    drawRoundRect(off, arenaX - 6, arenaTop - 6, arenaW + 12, arenaH + 12, 16);
    off.fill();
    off.restore();

    off.save();
    drawRoundRect(off, arenaX - 6, arenaTop - 6, arenaW + 12, arenaH + 12, 16);
    off.clip();
    const frameSheen = off.createLinearGradient(0, arenaTop - 6, 0, arenaBot + 6);
    frameSheen.addColorStop(0, 'rgba(255,255,255,0.17)');
    frameSheen.addColorStop(0.18, 'rgba(255,255,255,0.035)');
    frameSheen.addColorStop(0.82, 'rgba(0,0,0,0.02)');
    frameSheen.addColorStop(1, 'rgba(0,0,0,0.26)');
    off.fillStyle = frameSheen;
    off.fillRect(arenaX - 6, arenaTop - 6, arenaW + 12, arenaH + 12);
    off.restore();

    off.strokeStyle = 'rgba(255,255,255,0.22)';
    off.lineWidth = 1;
    drawRoundRect(off, arenaX - 5.5, arenaTop - 5.5, arenaW + 11, arenaH + 11, 15);
    off.stroke();

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

    const tileSize = 30;
    const cols = Math.ceil(arenaW / tileSize);
    const rows = Math.ceil(arenaH / tileSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          off.fillStyle = biome.id === 'frost' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.045)';
          off.fillRect(arenaX + c * tileSize, arenaTop + r * tileSize, tileSize, tileSize);
        } else {
          off.fillStyle = 'rgba(0,0,0,0.035)';
          off.fillRect(arenaX + c * tileSize, arenaTop + r * tileSize, tileSize, tileSize);
        }
      }
    }

    off.strokeStyle = 'rgba(255,255,255,0.035)';
    off.lineWidth = 0.6;
    for (let x = arenaX + tileSize; x < arenaX + arenaW; x += tileSize) {
      off.beginPath();
      off.moveTo(x, arenaTop);
      off.lineTo(x, arenaBot);
      off.stroke();
    }
    for (let y = arenaTop + tileSize; y < arenaBot; y += tileSize) {
      off.beginPath();
      off.moveTo(arenaX, y);
      off.lineTo(arenaX + arenaW, y);
      off.stroke();
    }

    // 3. Caminos empedrados conectando bases y puentes
    this.drawStonePath(off, biome, bridgeLeftX, baseAY + 10, baseBY - 10);
    this.drawStonePath(off, biome, bridgeRightX, baseAY + 10, baseBY - 10);

    const centerX = (safeLeft + safeRight) / 2;
    this.drawHorizontalPath(off, biome, bridgeLeftX, bridgeRightX, baseAY + 34);
    this.drawHorizontalPath(off, biome, bridgeLeftX, bridgeRightX, baseBY - 34);
    this.drawStonePath(off, biome, centerX, baseAY, baseAY + 34);
    this.drawStonePath(off, biome, centerX, baseBY - 34, baseBY);

    const floorLight = off.createRadialGradient(
      centerX,
      (arenaTop + arenaBot) / 2,
      arenaW * 0.08,
      centerX,
      (arenaTop + arenaBot) / 2,
      arenaW * 0.72
    );
    floorLight.addColorStop(0, hexToRgba(biome.accent, 0.07));
    floorLight.addColorStop(0.58, 'rgba(255,255,255,0)');
    floorLight.addColorStop(1, 'rgba(0,0,0,0.16)');
    off.fillStyle = floorLight;
    off.fillRect(arenaX, arenaTop, arenaW, arenaH);

    off.strokeStyle = 'rgba(255,255,255,0.2)';
    off.lineWidth = 0.8;
    drawRoundRect(off, arenaX + 1, arenaTop + 1, arenaW - 2, arenaH - 2, 11);
    off.stroke();

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
    ctx.strokeStyle = biome.id === 'volcano' ? 'rgba(255,190,116,0.13)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 10, top);
    ctx.lineTo(x - 10, top + h);
    ctx.moveTo(x + 10, top);
    ctx.lineTo(x + 10, top + h);
    ctx.stroke();

    // Lajas individuales
    let slab = 0;
    for (let y = top + 4; y < top + h - 6; y += 12) {
      ctx.fillStyle = biome.id === 'volcano'
        ? (slab % 2 === 0 ? 'rgba(130,115,125,0.3)' : 'rgba(130,115,125,0.2)')
        : (slab % 2 === 0 ? 'rgba(255,250,235,0.25)' : 'rgba(255,250,235,0.16)');
      drawRoundRect(ctx, x - 8, y, 16, 7, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      slab++;
    }
  }

  private drawHorizontalPath(ctx: CanvasRenderingContext2D, biome: BiomeTheme, x1: number, x2: number, y: number): void {
    const left = Math.min(x1, x2);
    const w = Math.abs(x2 - x1);
    ctx.fillStyle = biome.id === 'volcano' ? 'rgba(30,22,28,0.38)' : 'rgba(255,244,214,0.18)';
    ctx.fillRect(left, y - 7, w, 14);
    ctx.fillStyle = biome.id === 'volcano' ? 'rgba(255,190,116,0.12)' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(left, y - 7, w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.11)';
    ctx.fillRect(left, y + 6, w, 1);
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
    } else if (biome.id === 'abyss') {
      ctx.fillStyle = 'rgba(103, 232, 249, 0.55)';
      for (let x = arenaX - 20 + offset; x < arenaX + arenaW; x += 36) {
        const bubble = 1.5 + Math.sin(frame * 0.05 + x) * 0.8;
        ctx.beginPath();
        ctx.arc(x, midY + Math.sin(frame * 0.025 + x) * 5, bubble, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = biome.id === 'frost' ? 'rgba(255,255,255,0.65)' : biome.bridgeLine;
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

    // Base del puente con un ligero bisel
    const deck = ctx.createLinearGradient(bx - 15, 0, bx + 15, 0);
    deck.addColorStop(0, biome.bridge[2]);
    deck.addColorStop(0.18, biome.bridge[0]);
    deck.addColorStop(0.5, biome.bridge[1]);
    deck.addColorStop(0.82, biome.bridge[0]);
    deck.addColorStop(1, biome.bridge[2]);
    ctx.fillStyle = deck;
    drawRoundRect(ctx, bx - 15, midY - 16, 30, 32, 3);
    ctx.fill();

    // Tablones / losas del puente
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.6;
    for (let y = midY - 13; y <= midY + 11; y += 6) {
      ctx.fillStyle = biome.bridge[1];
      ctx.fillRect(bx - 12, y, 24, 3.5);
      ctx.strokeRect(bx - 12, y, 24, 3.5);
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

      const pulse = 0.5 + Math.sin(frame * 0.035 + idx * 0.8) * 0.5;
      ctx.fillStyle = hexToRgba(biome.accent, 0.035 + pulse * 0.025);
      ctx.beginPath();
      ctx.ellipse(0, -1, 8 + pulse, 9 + pulse, 0, 0, Math.PI * 2);
      ctx.fill();

      if (biome.id === 'grove') {
        // Pinos y arbustos frondosos
        ctx.fillStyle = '#5b4636';
        drawRoundRect(ctx, -1.5, 1, 3, 7, 1); ctx.fill();
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
        ctx.strokeStyle = 'rgba(224,242,254,0.65)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(3, 1); ctx.lineTo(-3, 1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 5); ctx.stroke();
      } else if (biome.id === 'volcano') {
        // Rocas de obsidiana con grieta de magma pulsante
        ctx.fillStyle = '#1f1924';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        const glow = 0.55 + Math.sin(frame * 0.09 + idx) * 0.35;
        ctx.strokeStyle = `rgba(255, 115, 45, ${glow})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(1, 0); ctx.lineTo(4, 3); ctx.stroke();
        ctx.fillStyle = `rgba(255,190,90,${glow * 0.7})`;
        ctx.beginPath(); ctx.arc(-3, -4, 1.2, 0, Math.PI * 2); ctx.fill();
      } else if (biome.id === 'desert') {
        // Columnas / ruinas del desierto + palma
        ctx.fillStyle = '#b48a54';
        drawRoundRect(ctx, -6, -6, 12, 12, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(84,58,33,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        drawRoundRect(ctx, -4, -4, 8, 8, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(-3, -3, 1.2, 5);
      } else if (biome.id === 'sky-temple') {
        ctx.fillStyle = 'rgba(79,70,105,0.5)';
        ctx.fillRect(-6, -4, 12, 11);
        ctx.fillStyle = '#c4b5d8';
        ctx.fillRect(-5, -5, 10, 12);
        ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(0, -11); ctx.lineTo(7, -5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(0, -11); ctx.lineTo(7, -5); ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.arc(0, -8, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.fillRect(-3, 0, 1.2, 4);
        ctx.fillRect(2, 0, 1.2, 4);
      } else if (biome.id === 'abyss') {
        ctx.strokeStyle = 'rgba(20,66,79,0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, 1); ctx.stroke();
        ctx.strokeStyle = idx % 2 === 0 ? '#fb7185' : '#2dd4bf';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, 7); ctx.lineTo(0, 1); ctx.lineTo(-4, -3);
        ctx.moveTo(0, 1); ctx.lineTo(4, -4); ctx.moveTo(-1, 4); ctx.lineTo(-6, 1);
        ctx.stroke();
        ctx.fillStyle = '#a5f3fc';
        ctx.beginPath(); ctx.arc(5, -7, 1.5 + Math.sin(frame * 0.05 + idx), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath(); ctx.arc(-5, -1, 1, 0, Math.PI * 2); ctx.fill();
      } else if (biome.id === 'crystal-cavern') {
        ctx.fillStyle = '#c084fc';
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, -1); ctx.lineTo(3, 8); ctx.lineTo(-4, 7); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(250,232,255,0.55)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#f5d0fe';
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(1, 1); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-4, -2); ctx.lineTo(-1, -1); ctx.closePath(); ctx.fill();
      } else if (biome.id === 'neon-city') {
        const buildingHeight = 8 + (idx % 3) * 3;
        ctx.fillStyle = '#20254a';
        ctx.fillRect(-7, -buildingHeight, 14, buildingHeight + 7);
        ctx.strokeStyle = 'rgba(196,181,253,0.38)';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(-7, -buildingHeight, 14, buildingHeight + 7);
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(-1, -buildingHeight - 3, 2, 3);
        ctx.fillStyle = idx % 2 === 0 ? '#22d3ee' : '#e879f9';
        for (let row = -buildingHeight + 3; row < 3; row += 4) {
          ctx.fillRect(-4, row, 2, 2);
          ctx.fillRect(2, row, 2, 2);
        }
      } else if (biome.id === 'haunted-marsh') {
        ctx.fillStyle = 'rgba(42,59,43,0.72)';
        ctx.beginPath(); ctx.ellipse(0, 5, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#78865a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 7); ctx.lineTo(1, -3); ctx.lineTo(-4, -9);
        ctx.moveTo(1, -1); ctx.lineTo(6, -7); ctx.moveTo(-1, 2); ctx.lineTo(-6, -2);
        ctx.stroke();
        ctx.fillStyle = '#d9f99d';
        ctx.beginPath(); ctx.arc(5, -8, 1.7 + Math.sin(frame * 0.06 + idx) * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(217,249,157,0.55)';
        ctx.beginPath(); ctx.arc(-5, -3, 1.1, 0, Math.PI * 2); ctx.fill();
      } else if (biome.id === 'stormfront') {
        ctx.fillStyle = 'rgba(55,65,87,0.88)';
        ctx.beginPath(); ctx.arc(-3, -5, 4, Math.PI, 0); ctx.arc(2, -4, 5, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#e0e7ff';
        ctx.beginPath();
        ctx.moveTo(1, -10); ctx.lineTo(-5, 0); ctx.lineTo(-1, 0);
        ctx.lineTo(-3, 9); ctx.lineTo(6, -3); ctx.lineTo(2, -3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.58)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
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
      } else if (biome.id === 'abyss') {
        m.y -= Math.abs(m.vy) * 1.2;
        m.x += Math.sin(frame * 0.025 + m.phase) * 0.55;
      } else if (biome.id === 'neon-city') {
        m.y += m.vy * 1.7;
        m.x += m.vx * 0.4;
      } else if (biome.id === 'haunted-marsh') {
        m.y += m.vy * 0.3;
        m.x += m.vx * 0.35 + Math.sin(frame * 0.02 + m.phase) * 0.25;
      } else if (biome.id === 'stormfront') {
        m.x += 0.7 + m.vx;
        m.y += Math.abs(m.vy) * 0.55;
      } else {
        m.x += m.vx + Math.sin(frame * 0.03 + m.phase) * 0.2;
        m.y += m.vy;
      }

      if (m.y < -10) m.y = H + 10;
      if (m.y > H + 10) m.y = -10;
      if (m.x < -10) m.x = W + 10;
      if (m.x > W + 10) m.x = -10;

      const alpha = 0.28 + Math.sin(frame * 0.07 + m.phase) * 0.22;
      const moteColor =
        biome.id === 'volcano'
          ? `rgba(255, 145, 60, ${alpha + 0.2})`
          : biome.id === 'frost'
            ? `rgba(240, 252, 255, ${alpha + 0.2})`
            : biome.id === 'desert'
              ? `rgba(255, 224, 150, ${alpha})`
              : biome.id === 'sky-temple'
                ? `rgba(253, 230, 138, ${alpha})`
                : biome.id === 'abyss'
                  ? `rgba(103, 232, 249, ${alpha})`
                  : biome.id === 'crystal-cavern'
                    ? `rgba(233, 168, 255, ${alpha})`
                    : biome.id === 'neon-city'
                      ? `rgba(34, 211, 238, ${alpha})`
                      : biome.id === 'haunted-marsh'
                        ? `rgba(190, 242, 100, ${alpha})`
                        : biome.id === 'stormfront'
                          ? `rgba(196, 181, 253, ${alpha})`
              : `rgba(187, 247, 208, ${alpha + 0.15})`;

      ctx.fillStyle = hexToRgba(biome.accent, alpha * 0.16);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = moteColor;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.58})`;
      ctx.beginPath();
      ctx.arc(m.x - m.r * 0.24, m.y - m.r * 0.24, Math.max(0.55, m.r * 0.32), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}