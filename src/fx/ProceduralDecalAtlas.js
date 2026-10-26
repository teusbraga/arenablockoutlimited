import * as THREE from 'three';

/**
 * ProceduralDecalAtlas.js
 * Gerador 100% procedural de Texture Atlas (Diffuse + Alpha) e Normal Map (PBR)
 * para marcas de impacto de projétil (Shot Decals) em alta fidelidade.
 *
 * Gera em tempo de boot:
 *  1. Diffuse/Alpha Map: Furo de penetração escuro, queima de pólvora, borda de estilhaço/spall e trincas.
 *  2. Normal Map: Mapa de relevo com filtro Sobel/gradiente para relevo 3D sob luz do sol e lanternas.
 *
 * Funciona offline, sem requisições HTTP adicionais e com fallback gracioso para Node.js (testes headless).
 */

export const ATLAS_SLOTS = {
  concrete: { col: 0, row: 0 },
  metal:    { col: 1, row: 0 },
  wood:     { col: 0, row: 1 },
  dirt:     { col: 1, row: 1 },
  glass:    { col: 0, row: 0 } // Reutiliza slot com adaptação ou slot compartilhado
};

export class ProceduralDecalAtlas {
  constructor(size = 512) {
    this.size = size;
    this.diffuseTexture = null;
    this.normalTexture = null;
    this._isHeadless = typeof document === 'undefined';
  }

  /**
   * Inicializa e gera os mapas procedurais.
   * @returns {{ diffuseTexture: THREE.Texture, normalTexture: THREE.Texture }}
   */
  generate() {
    if (this._isHeadless) {
      return this._generateHeadlessFallback();
    }

    const size = this.size;
    const halfSize = size / 2;

    // 1. Canvas para Diffuse/Alpha
    const diffuseCanvas = document.createElement('canvas');
    diffuseCanvas.width = size;
    diffuseCanvas.height = size;
    const diffCtx = diffuseCanvas.getContext('2d', { willReadFrequently: true });

    // 2. Buffer para Heightmap (para extração do Normal Map via filtro Sobel)
    const heightBuffer = new Float32Array(size * size);

    // Fundo totalmente transparente
    diffCtx.clearRect(0, 0, size, size);

    // Geração de cada slot no grid 2x2
    // Slot (0, 0): Concreto / Alvenaria
    this._drawConcreteDecal(diffCtx, heightBuffer, 0, 0, halfSize, size);

    // Slot (1, 0): Metal / Aço
    this._drawMetalDecal(diffCtx, heightBuffer, halfSize, 0, halfSize, size);

    // Slot (0, 1): Madeira / Fibras
    this._drawWoodDecal(diffCtx, heightBuffer, 0, halfSize, halfSize, size);

    // Slot (1, 1): Terra / Superfícies Macias
    this._drawDirtDecal(diffCtx, heightBuffer, halfSize, halfSize, halfSize, size);

    // 3. Geração do Normal Map a partir do Heightmap
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const normCtx = normalCanvas.getContext('2d');
    const normImageData = normCtx.createImageData(size, size);
    const normData = normImageData.data;

    this._computeNormalMap(heightBuffer, normData, size, 3.5);
    normCtx.putImageData(normImageData, 0, 0);

    // 4. Criação das texturas Three.js
    this.diffuseTexture = new THREE.CanvasTexture(diffuseCanvas);
    this.diffuseTexture.colorSpace = THREE.SRGBColorSpace;
    this.diffuseTexture.generateMipmaps = true;
    this.diffuseTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.diffuseTexture.magFilter = THREE.LinearFilter;

    this.normalTexture = new THREE.CanvasTexture(normalCanvas);
    this.normalTexture.generateMipmaps = true;
    this.normalTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.normalTexture.magFilter = THREE.LinearFilter;

    return {
      diffuseTexture: this.diffuseTexture,
      normalTexture: this.normalTexture
    };
  }

  /**
   * Retorna os offsets e escalas de UV para o slot do atlas especificado.
   * @param {string} slotKey 'concrete' | 'metal' | 'wood' | 'dirt'
   * @returns {{ uOffset: number, vOffset: number, uScale: number, vScale: number }}
   */
  getUVBounds(slotKey = 'concrete') {
    const slot = ATLAS_SLOTS[slotKey] || ATLAS_SLOTS.concrete;
    // Em Three.js UV: u vai de 0 a 1 (esquerda para direita), v vai de 0 a 1 (baixo para cima).
    // No Canvas: row 0 é o topo (v = 0.5 a 1.0), row 1 é a base (v = 0.0 a 0.5).
    const uOffset = slot.col * 0.5;
    const vOffset = (1 - slot.row) * 0.5; // Inverte Y do Canvas para UV do WebGL
    return {
      uOffset,
      vOffset,
      uScale: 0.5,
      vScale: 0.5
    };
  }

  /**
   * Desenha cratera de concreto/alvenaria:
   * - Centro preto de cavidade
   * - Anel de queima de pólvora (lead fouling)
   * - Borda estilhaçada irregular (spall) com cimento esfarelado claro
   * - Trincas radiais orgânicas
   */
  _drawConcreteDecal(ctx, heightBuffer, startX, startY, slotSize, totalSize) {
    const cx = startX + slotSize * 0.5;
    const cy = startY + slotSize * 0.5;
    const rMax = slotSize * 0.42;
    const rHole = slotSize * 0.09;
    const rBurn = slotSize * 0.18;
    const rSpall = slotSize * 0.32;

    // 1. Halo difuso externo de poeira de impacto
    const gradDust = ctx.createRadialGradient(cx, cy, rBurn, cx, cy, rMax);
    gradDust.addColorStop(0, 'rgba(80, 75, 70, 0.45)');
    gradDust.addColorStop(0.6, 'rgba(120, 115, 110, 0.15)');
    gradDust.addColorStop(1, 'rgba(140, 135, 130, 0)');
    ctx.fillStyle = gradDust;
    ctx.beginPath();
    ctx.arc(cx, cy, rMax, 0, Math.PI * 2);
    ctx.fill();

    // 2. Borda estilhaçada de alvenaria (Spall Ring irregular)
    ctx.save();
    ctx.fillStyle = 'rgba(215, 205, 195, 0.85)';
    ctx.beginPath();
    const spallSteps = 24;
    for (let i = 0; i <= spallSteps; i++) {
      const angle = (i / spallSteps) * Math.PI * 2;
      const noise = 0.8 + ((Math.sin(angle * 5) + Math.cos(angle * 7) * 0.5) * 0.25);
      const r = rSpall * noise;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Halo de queima e fuligem de pólvora (Lead Fouling)
    const gradBurn = ctx.createRadialGradient(cx, cy, rHole * 0.8, cx, cy, rBurn);
    gradBurn.addColorStop(0, 'rgba(20, 18, 16, 0.95)');
    gradBurn.addColorStop(0.5, 'rgba(38, 35, 32, 0.75)');
    gradBurn.addColorStop(1, 'rgba(50, 48, 45, 0.0)');
    ctx.fillStyle = gradBurn;
    ctx.beginPath();
    ctx.arc(cx, cy, rBurn, 0, Math.PI * 2);
    ctx.fill();

    // 4. Cavidade central profunda (Furo escuro ocluso)
    const gradHole = ctx.createRadialGradient(cx, cy, 0, cx, cy, rHole);
    gradHole.addColorStop(0, 'rgba(8, 8, 8, 1.0)');
    gradHole.addColorStop(0.85, 'rgba(15, 14, 13, 0.98)');
    gradHole.addColorStop(1, 'rgba(30, 28, 25, 0.8)');
    ctx.fillStyle = gradHole;
    ctx.beginPath();
    ctx.arc(cx, cy, rHole, 0, Math.PI * 2);
    ctx.fill();

    // 5. Trincas radiais orgânicas (Radial Cracks)
    ctx.strokeStyle = 'rgba(25, 23, 20, 0.75)';
    ctx.lineWidth = 1.6;
    const crackCount = 7;
    for (let c = 0; c < crackCount; c++) {
      const baseAngle = (c / crackCount) * Math.PI * 2 + (Math.sin(c * 1.7) * 0.3);
      let curX = cx + Math.cos(baseAngle) * (rHole * 0.8);
      let curY = cy + Math.sin(baseAngle) * (rHole * 0.8);
      ctx.beginPath();
      ctx.moveTo(curX, curY);

      const segments = 4;
      const segLen = (rMax - rHole) / segments;
      let curAngle = baseAngle;
      for (let s = 0; s < segments; s++) {
        curAngle += (Math.sin(s * 3.1 + c) * 0.35);
        curX += Math.cos(curAngle) * segLen;
        curY += Math.sin(curAngle) * segLen;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
    }

    // 6. Alimenta Heightmap (cavidade = valor negativo/baixo, borda do spall = relevo positivo)
    this._fillHeightRadial(heightBuffer, cx, cy, rHole, rSpall, rMax, totalSize, 1.0);
  }

  /**
   * Desenha impacto em metal:
   * - Deformação plástica côncava estufada
   * - Anel polido de metal raspado (lasca de pintura expondo aço)
   * - Halo térmico de queima (irisado sutil)
   */
  _drawMetalDecal(ctx, heightBuffer, startX, startY, slotSize, totalSize) {
    const cx = startX + slotSize * 0.5;
    const cy = startY + slotSize * 0.5;
    const rMax = slotSize * 0.38;
    const rHole = slotSize * 0.08;
    const rRim = slotSize * 0.16;

    // 1. Halo térmico (queimadura e calor)
    const gradHeat = ctx.createRadialGradient(cx, cy, rHole, cx, cy, rMax);
    gradHeat.addColorStop(0, 'rgba(25, 25, 30, 0.85)');
    gradHeat.addColorStop(0.3, 'rgba(65, 55, 45, 0.50)');
    gradHeat.addColorStop(0.7, 'rgba(40, 50, 65, 0.20)');
    gradHeat.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradHeat;
    ctx.beginPath();
    ctx.arc(cx, cy, rMax, 0, Math.PI * 2);
    ctx.fill();

    // 2. Anel de metal polido/exposto (aço nu rebatido)
    const gradSteel = ctx.createRadialGradient(cx, cy, rHole * 0.9, cx, cy, rRim);
    gradSteel.addColorStop(0, 'rgba(195, 205, 215, 0.95)');
    gradSteel.addColorStop(0.6, 'rgba(150, 160, 170, 0.90)');
    gradSteel.addColorStop(1, 'rgba(80, 85, 90, 0.0)');
    ctx.fillStyle = gradSteel;
    ctx.beginPath();
    ctx.arc(cx, cy, rRim, 0, Math.PI * 2);
    ctx.fill();

    // 3. Furo central profundo
    const gradHole = ctx.createRadialGradient(cx, cy, 0, cx, cy, rHole);
    gradHole.addColorStop(0, 'rgba(12, 14, 16, 1.0)');
    gradHole.addColorStop(0.8, 'rgba(20, 22, 25, 0.95)');
    gradHole.addColorStop(1, 'rgba(60, 65, 70, 0.6)');
    ctx.fillStyle = gradHole;
    ctx.beginPath();
    ctx.arc(cx, cy, rHole, 0, Math.PI * 2);
    ctx.fill();

    // 4. Heightmap (metal estufado na borda com depressão central acentuada)
    this._fillHeightRadial(heightBuffer, cx, cy, rHole, rRim, rMax, totalSize, 1.3);
  }

  /**
   * Desenha impacto em madeira:
   * - Furo com queima
   * - Lascas axiais de madeira projetadas para fora ao longo das fibras
   */
  _drawWoodDecal(ctx, heightBuffer, startX, startY, slotSize, totalSize) {
    const cx = startX + slotSize * 0.5;
    const cy = startY + slotSize * 0.5;
    const rMax = slotSize * 0.40;
    const rHole = slotSize * 0.08;

    // 1. Halo de pólvora
    const gradBurn = ctx.createRadialGradient(cx, cy, rHole, cx, cy, rMax * 0.65);
    gradBurn.addColorStop(0, 'rgba(30, 20, 10, 0.85)');
    gradBurn.addColorStop(0.5, 'rgba(60, 42, 24, 0.45)');
    gradBurn.addColorStop(1, 'rgba(80, 60, 35, 0)');
    ctx.fillStyle = gradBurn;
    ctx.beginPath();
    ctx.arc(cx, cy, rMax * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 2. Lascas de madeira (Splinters alongadas no sentido vertical/horizontal)
    ctx.fillStyle = 'rgba(205, 160, 110, 0.9)';
    const splinterCount = 14;
    for (let i = 0; i < splinterCount; i++) {
      const angle = (i / splinterCount) * Math.PI * 2;
      // Estica mais no eixo Y simulando as fibras da madeira
      const lengthMult = 1.0 + Math.abs(Math.sin(angle)) * 0.8;
      const splinterLen = (rMax * 0.75) * lengthMult * (0.7 + Math.sin(i * 4) * 0.3);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(rHole * 0.8, -2);
      ctx.lineTo(splinterLen, 0);
      ctx.lineTo(rHole * 0.8, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Furo ocluso de entrada
    const gradHole = ctx.createRadialGradient(cx, cy, 0, cx, cy, rHole);
    gradHole.addColorStop(0, 'rgba(15, 10, 5, 1.0)');
    gradHole.addColorStop(0.8, 'rgba(25, 18, 10, 0.95)');
    gradHole.addColorStop(1, 'rgba(45, 30, 15, 0.7)');
    ctx.fillStyle = gradHole;
    ctx.beginPath();
    ctx.arc(cx, cy, rHole, 0, Math.PI * 2);
    ctx.fill();

    this._fillHeightRadial(heightBuffer, cx, cy, rHole, rMax * 0.45, rMax, totalSize, 0.9);
  }

  /**
   * Desenha impacto em terra / areia / superfície macia:
   * - Cratera esfarelada com poeira dispersa
   */
  _drawDirtDecal(ctx, heightBuffer, startX, startY, slotSize, totalSize) {
    const cx = startX + slotSize * 0.5;
    const cy = startY + slotSize * 0.5;
    const rMax = slotSize * 0.44;
    const rHole = slotSize * 0.11;

    // Dispersão suave de terra
    const grad = ctx.createRadialGradient(cx, cy, rHole, cx, cy, rMax);
    grad.addColorStop(0, 'rgba(45, 35, 25, 0.9)');
    grad.addColorStop(0.4, 'rgba(85, 68, 48, 0.55)');
    grad.addColorStop(0.8, 'rgba(110, 90, 65, 0.2)');
    grad.addColorStop(1, 'rgba(130, 105, 75, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rMax, 0, Math.PI * 2);
    ctx.fill();

    // Centro afundado
    ctx.fillStyle = 'rgba(20, 15, 10, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, rHole, 0, Math.PI * 2);
    ctx.fill();

    this._fillHeightRadial(heightBuffer, cx, cy, rHole, rMax * 0.5, rMax, totalSize, 0.7);
  }

  /**
   * Preenche a matriz de altura para geração do Normal Map.
   */
  _fillHeightRadial(buffer, cx, cy, rHole, rLip, rMax, totalSize, heightScale = 1.0) {
    const minX = Math.max(0, Math.floor(cx - rMax));
    const maxX = Math.min(totalSize - 1, Math.ceil(cx + rMax));
    const minY = Math.max(0, Math.floor(cy - rMax));
    const maxY = Math.min(totalSize - 1, Math.ceil(cy + rMax));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rMax) continue;

        let h = 0.5; // Altura neutra da parede plana
        if (dist < rHole) {
          // Cavidade profunda
          h = 0.05 + 0.1 * (dist / rHole);
        } else if (dist < rLip) {
          // Borda saliente / rebatida (spall ou lábio de metal)
          const t = (dist - rHole) / (rLip - rHole);
          h = 0.15 + (0.85 * Math.sin(t * Math.PI * 0.8));
        } else {
          // Transição suave de volta ao plano neutro
          const t = (dist - rLip) / (rMax - rLip);
          h = 0.5 + 0.2 * (1.0 - t);
        }

        const idx = y * totalSize + x;
        buffer[idx] = h * heightScale;
      }
    }
  }

  /**
   * Converte o mapa de alturas para Normal Map RGB utilizando derivadas centrais (Sobel 3x3).
   */
  _computeNormalMap(heights, outData, size, strength = 3.0) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(size - 1, x + 1);
        const y0 = Math.max(0, y - 1);
        const y1 = Math.min(size - 1, y + 1);

        // Diferenças centrais
        const dx = (heights[y * size + x1] - heights[y * size + x0]) * strength;
        const dy = (heights[y1 * size + x] - heights[y0 * size + x]) * strength;
        const dz = 1.0;

        // Normalização do vetor (Nx, Ny, Nz)
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
        const nx = -dx / len;
        const ny = -dy / len;
        const nz = dz / len;

        const idx = (y * size + x) * 4;
        // Converte de [-1, 1] para [0, 255]
        outData[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
        outData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        outData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        outData[idx + 3] = 255;
      }
    }
  }

  /**
   * Fallback limpo para testes headless no Node.js (sem DOM nem Canvas).
   */
  _generateHeadlessFallback() {
    const diffData = new Uint8Array([255, 255, 255, 255]);
    const normData = new Uint8Array([128, 128, 255, 255]);

    this.diffuseTexture = new THREE.DataTexture(diffData, 1, 1, THREE.RGBAFormat);
    this.diffuseTexture.needsUpdate = true;

    this.normalTexture = new THREE.DataTexture(normData, 1, 1, THREE.RGBAFormat);
    this.normalTexture.needsUpdate = true;

    return {
      diffuseTexture: this.diffuseTexture,
      normalTexture: this.normalTexture
    };
  }

  /**
   * Descarte de recursos de textura.
   */
  destroy() {
    if (this.diffuseTexture) {
      this.diffuseTexture.dispose();
      this.diffuseTexture = null;
    }
    if (this.normalTexture) {
      this.normalTexture.dispose();
      this.normalTexture = null;
    }
  }
}
