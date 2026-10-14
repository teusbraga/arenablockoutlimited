/**
 * SurfaceEyedropper.js
 * Algoritmo "Conta-Gotas" de Alta Performance para Superfícies do Mundo 3D.
 * 
 * Amostra em tempo de execução O(1) a cor exata da textura (ou cor base do material)
 * no ponto milimétrico onde o projétil atingiu a parede ou o chão, utilizando a
 * projeção matemática World-Space Triplanar idêntica ao shader de renderização.
 */

export class SurfaceEyedropper {
  constructor() {
    // Mapa de cache por nome de material:
    // materialName -> { data: Uint8ClampedArray|null, width: number, height: number, uvScale: number, fallbackColor: number|null }
    this._textureCache = new Map();
    // Cache de materiais puros (sem textura)
    this._materialColorCache = new Map();
  }

  /**
   * Registra um material ou textura no sistema de conta-gotas.
   * @param {string} materialName Nome do identificador do material (ex: 'stone', 'cobblestones', 'wood')
   * @param {THREE.Material|object} material Instância do Three.js material ou objeto com map/color
   * @param {number} uvScale Escala World-Space UV (default 0.35)
   */
  registerMaterial(materialName, material, uvScale = null) {
    if (!materialName || !material) return;

    const scale = uvScale ?? material.userData?.worldUVScale ?? 0.35;
    const diffuseMap = material.map;

    if (diffuseMap && diffuseMap.image) {
      this._extractImageData(materialName, diffuseMap.image, scale);
    }

    if (material.color) {
      const hex = typeof material.color.getHex === 'function' ? material.color.getHex() : material.color;
      this._materialColorCache.set(materialName.toLowerCase(), hex);
    }
  }

  /**
   * Extrai e armazena os bytes RGBA do elemento de imagem/canvas.
   */
  _extractImageData(materialName, image, uvScale) {
    try {
      const key = materialName.toLowerCase();
      let width = image.width || 0;
      let height = image.height || 0;
      let data = null;

      if (image instanceof Uint8Array || image instanceof Uint8ClampedArray) {
        // Já é um buffer bruto em memória
        data = image;
      } else if (typeof image.getContext === 'function') {
        // É um HTMLCanvasElement
        const ctx = image.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const imgData = ctx.getImageData(0, 0, width, height);
          data = imgData.data;
        }
      } else if (typeof document !== 'undefined' && image instanceof (typeof HTMLImageElement !== 'undefined' ? HTMLImageElement : Object)) {
        // É um Image element carregado
        if (image.naturalWidth && image.naturalHeight) {
          width = image.naturalWidth;
          height = image.naturalHeight;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(image, 0, 0);
          data = ctx.getImageData(0, 0, width, height).data;
        }
      } else if (image.data && (image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray)) {
        // Objeto customizado ou DataTexture
        data = image.data;
      }

      if (data && width > 0 && height > 0) {
        this._textureCache.set(key, {
          data,
          width,
          height,
          uvScale: uvScale || 0.35
        });
      }
    } catch {
      // Falha graciosa em ambientes sem suporte ou cross-origin; o fallback de cor assumirá
    }
  }

  /**
   * Permite registrar diretamente um buffer de pixels mockado ou procedural (útil para testes unitários).
   */
  registerBuffer(materialName, data, width, height, uvScale = 0.35) {
    this._textureCache.set(materialName.toLowerCase(), {
      data,
      width,
      height,
      uvScale
    });
  }

  /**
   * Amostra a cor exata no ponto de impacto utilizando a projeção triplanar.
   * @param {{x: number, y: number, z: number}} point Ponto de impacto no espaço de mundo
   * @param {{x: number, y: number, z: number}} normal Vetor normal da superfície atingida
   * @param {string} materialName Identificador do material
   * @returns {number|null} Cor numérica Three.js (0xRRGGBB) ou null se não for possível amostrar
   */
  sampleColor(point, normal, materialName) {
    if (!point || !materialName) return null;

    const key = materialName.toLowerCase();
    const texInfo = this._textureCache.get(key);

    if (texInfo && texInfo.data) {
      const { data, width, height, uvScale } = texInfo;

      // 1. Projeção Triplanar em World Space (idêntica ao shader do jogo)
      const nx = normal ? Math.abs(normal.x) : 0;
      const ny = normal ? Math.abs(normal.y) : 1;
      const nz = normal ? Math.abs(normal.z) : 0;

      let u = 0;
      let v = 0;

      if (ny > 0.6) {
        // Normal apontando para cima/baixo: Plano XZ (Chão ou Teto)
        u = point.x * uvScale;
        v = point.z * uvScale;
      } else if (nx > 0.6) {
        // Normal apontando para os lados X: Plano ZY (Paredes orientadas em X)
        u = point.z * uvScale;
        v = point.y * uvScale;
      } else {
        // Normal apontando para os lados Z: Plano XY (Paredes orientadas em Z)
        u = point.x * uvScale;
        v = point.y * uvScale;
      }

      // 2. Mapeamento cíclico com repeat wrapping (0.0 a 1.0)
      const uFrac = ((u % 1.0) + 1.0) % 1.0;
      // Inversão do eixo vertical: WebGL V = 0 é a base, Canvas Y = 0 é o topo
      const vFrac = 1.0 - (((v % 1.0) + 1.0) % 1.0);

      const px = Math.min(width - 1, Math.max(0, Math.floor(uFrac * width)));
      const py = Math.min(height - 1, Math.max(0, Math.floor(vFrac * height)));

      const idx = (py * width + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      return (r << 16) | (g << 8) | b;
    }

    // Fallback: cor direta do material cadastrado
    if (this._materialColorCache.has(key)) {
      return this._materialColorCache.get(key);
    }

    return null;
  }

  /**
   * Gera uma paleta de cores com leve micro-jitter (variação orgânica de brilho/tonalidade)
   * em torno da cor base capturada pelo conta-gotas.
   * @param {number} baseHex Cor base numérica (0xRRGGBB)
   * @param {number} count Quantidade de partículas/cores a gerar (padrão 4)
   * @param {number} spread Variabilidade de brilho (0.05 a 0.12)
   * @returns {number[]} Array de cores hexadecimais
   */
  generateJitteredColors(baseHex, count = 4, spread = 0.08) {
    if (typeof baseHex !== 'number') return [baseHex];

    const baseR = (baseHex >> 16) & 0xff;
    const baseG = (baseHex >> 8) & 0xff;
    const baseB = baseHex & 0xff;

    const result = [];
    for (let i = 0; i < count; i++) {
      // Variação orgânica entre grãos mais claros e mais escuros da superfície esmagada
      const factor = 1.0 + (Math.random() - 0.5) * (spread * 2.0);
      const r = Math.min(255, Math.max(0, Math.round(baseR * factor)));
      const g = Math.min(255, Math.max(0, Math.round(baseG * factor)));
      const b = Math.min(255, Math.max(0, Math.round(baseB * factor)));
      result.push((r << 16) | (g << 8) | b);
    }
    return result;
  }

  /**
   * Limpa o cache de texturas (ex: na troca de mapas)
   */
  clear() {
    this._textureCache.clear();
    this._materialColorCache.clear();
  }
}

export const surfaceEyedropper = new SurfaceEyedropper();
