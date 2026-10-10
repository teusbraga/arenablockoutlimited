import * as THREE from 'three';

/**
 * TextureGenerator.js
 * Gerador de Texturas Procedurais PBR e Gerenciador de Texturas Externas (PNG/JPG/Bitmap).
 * Simulação temática estilo CS Italy:
 * - Paredes pintadas e descascadas (reboco toscano sobre tijolos rústicos)
 * - Cobblestones (paralelepípedos italianos)
 * - Portas e janelas de madeira rústica e venezianas verdes
 * - Telhas cerâmicas curvas de terracota
 * - Folhagens de hera (ivy) com canal alfa
 * - Barris de vinho, caixotes de feira e toldos listrados
 */

export class TextureGenerator {
  constructor() {
    this._cache = new Map();
    this.textureLoader = new THREE.TextureLoader();
  }

  // =========================================================================
  // UTILITÁRIOS MATEMÁTICOS DE RUÍDO PROCEDURAL (Vanilla JS Puro)
  // =========================================================================

  /**
   * Função pseudo-aleatória determinística de alta performance (Fast Integer Hash 2D)
   * Até 9x mais rápida que Math.sin e sem artefatos de moiré
   */
  static pseudoRandom(x, y) {
    let h = ((x * 374761393) ^ (y * 668265263)) >>> 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  /**
   * Ruído de valor 2D suave (Bilinear interpolation)
   */
  static valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Curva suave hermite (smoothstep)
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = TextureGenerator.pseudoRandom(ix, iy);
    const n10 = TextureGenerator.pseudoRandom(ix + 1, iy);
    const n01 = TextureGenerator.pseudoRandom(ix, iy + 1);
    const n11 = TextureGenerator.pseudoRandom(ix + 1, iy + 1);

    const nx0 = n00 * (1 - sx) + n10 * sx;
    const nx1 = n01 * (1 - sx) + n11 * sx;

    return nx0 * (1 - sy) + nx1 * sy;
  }

  /**
   * Movimento Browniano Fractal (fBm) multi-oitava para superfícies orgânicas
   */
  static fbm(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let sum = 0;
    let amp = 1.0;
    let freq = 1.0;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += TextureGenerator.valueNoise(x * freq, y * freq) * amp;
      max += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / max;
  }

  /**
   * Cria um elemento de Canvas 2D
   */
  static createCanvas(width = 512, height = 512) {
    if (typeof document === 'undefined') {
      const dummyCtx = new Proxy({}, {
        get(target, prop) {
          if (prop === 'getImageData') {
            return (x, y, w, h) => ({ data: new Uint8ClampedArray((w || width) * (h || height) * 4) });
          }
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
            return () => ({ addColorStop() {} });
          }
          return () => {};
        },
        set() { return true; }
      });
      return { canvas: { width, height }, ctx: dummyCtx };
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return { canvas, ctx };
  }

  static toTexture(canvas, isSRGB = true, repeatX = 1, repeatY = 1) {
    if (typeof document === 'undefined' || !canvas || !canvas.getContext) {
      return null;
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (isSRGB) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // =========================================================================
  // 1. COBBLESTONES (Paralelepípedos Italianos CS Italy)
  // =========================================================================
  createCobblestones(size = 512) {
    const cacheKey = `cobblestones_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: roughCanvas, ctx: roughCtx } = TextureGenerator.createCanvas(size, size);

    // Fundo: Argamassa escura de terra/areia
    diffCtx.fillStyle = '#3a342c';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#181818';
    bumpCtx.fillRect(0, 0, size, size);
    roughCtx.fillStyle = '#e5e5e5'; // Argamassa áspera
    roughCtx.fillRect(0, 0, size, size);

    // Grade irregular de pedras
    const rows = 12;
    const cols = 12;
    const cellW = size / cols;
    const cellH = size / rows;

    const stonePalettes = [
      { r: 160, g: 152, b: 142 }, // Arenito cinza quente
      { r: 185, g: 172, b: 155 }, // Travertino claro
      { r: 138, g: 130, b: 122 }, // Basalto cinza escuro
      { r: 175, g: 155, b: 135 }, // Ocre toscano envelhecido
      { r: 148, g: 140, b: 132 }, // Ardósia
    ];

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 1) ? cellW * 0.5 : 0;
      for (let c = 0; c < cols + 1; c++) {
        const cx = c * cellW + offsetX - cellW * 0.25;
        const cy = r * cellH;

        // Variação orgânica de tamanho e posição
        const seed = r * 37 + c * 19;
        const jitterX = (TextureGenerator.pseudoRandom(seed, 1) - 0.5) * cellW * 0.25;
        const jitterY = (TextureGenerator.pseudoRandom(seed, 2) - 0.5) * cellH * 0.25;
        const w = cellW * 0.82 + (TextureGenerator.pseudoRandom(seed, 3) - 0.5) * cellW * 0.2;
        const h = cellH * 0.78 + (TextureGenerator.pseudoRandom(seed, 4) - 0.5) * cellH * 0.2;

        const x = cx + jitterX;
        const y = cy + jitterY;
        const pal = stonePalettes[Math.floor(TextureGenerator.pseudoRandom(seed, 5) * stonePalettes.length)];

        // Desenha pedra no Diffuse com gradiente de relevo e bordas chanfradas
        const stoneGrad = diffCtx.createRadialGradient(x + w * 0.45, y + h * 0.45, w * 0.1, x + w * 0.5, y + h * 0.5, w * 0.65);
        const lgt = 1.0 + (TextureGenerator.pseudoRandom(seed, 6) - 0.5) * 0.2;
        const rVal = Math.min(255, Math.floor(pal.r * lgt));
        const gVal = Math.min(255, Math.floor(pal.g * lgt));
        const bVal = Math.min(255, Math.floor(pal.b * lgt));
        stoneGrad.addColorStop(0, `rgb(${Math.min(255, rVal + 25)}, ${Math.min(255, gVal + 25)}, ${Math.min(255, bVal + 25)})`);
        stoneGrad.addColorStop(0.75, `rgb(${rVal}, ${gVal}, ${bVal})`);
        stoneGrad.addColorStop(1, `rgb(${Math.max(0, rVal - 35)}, ${Math.max(0, gVal - 35)}, ${Math.max(0, bVal - 35)})`);

        // Forma arredondada da pedra
        diffCtx.beginPath();
        diffCtx.roundRect(x, y, w, h, [7, 7, 7, 7]);
        diffCtx.fillStyle = stoneGrad;
        diffCtx.fill();

        // Bump map: centro alto (branco/cinza claro), bordas descem para preto
        const bumpGrad = bumpCtx.createRadialGradient(x + w * 0.5, y + h * 0.5, 0, x + w * 0.5, y + h * 0.5, w * 0.55);
        bumpGrad.addColorStop(0, '#f0f0f0');
        bumpGrad.addColorStop(0.65, '#b0b0b0');
        bumpGrad.addColorStop(0.9, '#404040');
        bumpGrad.addColorStop(1, '#181818');
        bumpCtx.beginPath();
        bumpCtx.roundRect(x, y, w, h, [7, 7, 7, 7]);
        bumpCtx.fillStyle = bumpGrad;
        bumpCtx.fill();

        // Roughness: pedra polida pelo tempo (~0.60), juntas ásperas (~0.95)
        roughCtx.beginPath();
        roughCtx.roundRect(x, y, w, h, [7, 7, 7, 7]);
        roughCtx.fillStyle = '#909090';
        roughCtx.fill();
      }
    }

    // Micro-granulação de ruído procedural sobreposta
    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < diffImg.data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      const grain = (TextureGenerator.valueNoise(px * 0.15, py * 0.15) - 0.5) * 28;

      diffImg.data[i] = Math.max(0, Math.min(255, diffImg.data[i] + grain));
      diffImg.data[i + 1] = Math.max(0, Math.min(255, diffImg.data[i + 1] + grain));
      diffImg.data[i + 2] = Math.max(0, Math.min(255, diffImg.data[i + 2] + grain));

      // Bump grain
      bumpImg.data[i] = Math.max(0, Math.min(255, bumpImg.data[i] + grain * 0.4));
      bumpImg.data[i + 1] = bumpImg.data[i];
      bumpImg.data[i + 2] = bumpImg.data[i];
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
      roughness: TextureGenerator.toTexture(roughCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 2. PAREDES PINTADAS E DESCASCADAS (Reboco Toscano sobre Tijolos Rústicos)
  // =========================================================================
  createPeelingWall({
    size = 512,
    plasterColor = '#d9b280', // Ocre quente toscano clássico
    brickColor = '#a84128',    // Tijolo terracota antigo
    peelAmount = 0.42          // Proporção de áreas descascadas
  } = {}) {
    const cacheKey = `peeling_wall_${plasterColor}_${brickColor}_${peelAmount}_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: roughCanvas, ctx: roughCtx } = TextureGenerator.createCanvas(size, size);

    // 1. Camada de Fundo: Parede de Tijolos Rústicos (exposta quando descasca)
    diffCtx.fillStyle = '#b0a79a'; // Cimento/argamassa entre tijolos
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#404040'; // Rebaixo da argamassa
    bumpCtx.fillRect(0, 0, size, size);
    roughCtx.fillStyle = '#c0c0c0';
    roughCtx.fillRect(0, 0, size, size);

    const brickRows = 16;
    const brickCols = 8;
    const bH = size / brickRows;
    const bW = size / brickCols;
    const mortar = 4;

    for (let r = 0; r < brickRows; r++) {
      const offsetX = (r % 2 === 1) ? bW * 0.5 : 0;
      for (let c = -1; c < brickCols + 1; c++) {
        const bx = c * bW + offsetX + mortar * 0.5;
        const by = r * bH + mortar * 0.5;
        const bw = bW - mortar;
        const bh = bH - mortar;

        const seed = r * 53 + c * 29;
        const tone = 0.85 + TextureGenerator.pseudoRandom(seed, 1) * 0.3;
        const rC = Math.floor(168 * tone);
        const gC = Math.floor(65 * tone);
        const bC = Math.floor(40 * tone);

        diffCtx.fillStyle = `rgb(${rC}, ${gC}, ${bC})`;
        diffCtx.fillRect(bx, by, bw, bh);

        // Variação de relevo no tijolo
        bumpCtx.fillStyle = '#909090';
        bumpCtx.fillRect(bx, by, bw, bh);

        roughCtx.fillStyle = '#a0a0a0';
        roughCtx.fillRect(bx, by, bw, bh);
      }
    }

    // 2. Camada de Superfície: Reboco Pintado com Máscara de Descascamento (fBm)
    const plasterImg = diffCtx.getImageData(0, 0, size, size);
    const plasterBump = bumpCtx.getImageData(0, 0, size, size);
    const plasterRough = roughCtx.getImageData(0, 0, size, size);

    // Parse cor do reboco
    let pR = 217, pG = 178, pB = 128;
    if (typeof plasterColor === 'string' && plasterColor.startsWith('#')) {
      const hex = plasterColor.replace('#', '');
      if (hex.length === 6) {
        pR = parseInt(hex.slice(0, 2), 16);
        pG = parseInt(hex.slice(2, 4), 16);
        pB = parseInt(hex.slice(4, 6), 16);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Máscara orgânica de descascamento: 2 ilhas principais + micro-rachaduras
        const noise = TextureGenerator.fbm(x * 0.007, y * 0.007, 4);
        const crackNoise = TextureGenerator.fbm(x * 0.04, y * 0.04, 3);
        const combined = noise * 0.75 + crackNoise * 0.25;

        const isPlaster = combined > peelAmount;
        const isPeelingLip = Math.abs(combined - peelAmount) < 0.035; // Borda levantada do reboco quebrado

        if (isPlaster) {
          // Reboco com porosidade e manchas sutis de umidade
          const stuccoGrain = (TextureGenerator.valueNoise(x * 0.12, y * 0.12) - 0.5) * 22;
          const shade = 1.0 - (TextureGenerator.fbm(x * 0.003, y * 0.003, 2) - 0.5) * 0.18;

          plasterImg.data[idx] = Math.max(0, Math.min(255, (pR + stuccoGrain) * shade));
          plasterImg.data[idx + 1] = Math.max(0, Math.min(255, (pG + stuccoGrain) * shade));
          plasterImg.data[idx + 2] = Math.max(0, Math.min(255, (pB + stuccoGrain) * shade));

          // Bump do reboco é elevado em relação aos tijolos
          let bVal = 210 + stuccoGrain * 0.5;
          if (isPeelingLip) bVal = 245; // Borda descascada saliente
          plasterBump.data[idx] = Math.min(255, bVal);
          plasterBump.data[idx + 1] = plasterBump.data[idx];
          plasterBump.data[idx + 2] = plasterBump.data[idx];

          // Roughness do reboco: fosco natural
          plasterRough.data[idx] = 210;
          plasterRough.data[idx + 1] = 210;
          plasterRough.data[idx + 2] = 210;
        } else {
          // Borda sombreada (ambient occlusion da casca do reboco sobre o tijolo)
          if (isPeelingLip) {
            plasterImg.data[idx] = Math.floor(plasterImg.data[idx] * 0.65);
            plasterImg.data[idx + 1] = Math.floor(plasterImg.data[idx + 1] * 0.65);
            plasterImg.data[idx + 2] = Math.floor(plasterImg.data[idx + 2] * 0.65);
          }
        }
      }
    }

    diffCtx.putImageData(plasterImg, 0, 0);
    bumpCtx.putImageData(plasterBump, 0, 0);
    roughCtx.putImageData(plasterRough, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
      roughness: TextureGenerator.toTexture(roughCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 3. PORTAS RÚSTICAS DE MADEIRA COM FERRAGENS (CS Italy Rustic Door)
  // =========================================================================
  createRusticWoodDoor(size = 512) {
    const cacheKey = `rustic_door_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    // Fundo: Madeira de Nogueira Escura Italiana
    diffCtx.fillStyle = '#4e331c';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // 5 Tábuas verticais largas
    const planks = 5;
    const plankW = size / planks;

    for (let p = 0; p < planks; p++) {
      const px = p * plankW;
      const seed = p * 41 + 17;
      const tone = 0.88 + TextureGenerator.pseudoRandom(seed, 1) * 0.25;

      // Veios da madeira (longitudinais ao longo de Y)
      for (let y = 0; y < size; y++) {
        const grain = TextureGenerator.fbm(px * 0.05, y * 0.015, 3) * 35;
        const r = Math.min(255, Math.floor((105 + grain) * tone));
        const g = Math.min(255, Math.floor((72 + grain * 0.7) * tone));
        const b = Math.min(255, Math.floor((46 + grain * 0.5) * tone));

        diffCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        diffCtx.fillRect(px, y, plankW, 1);
      }

      // Fenda/ranhura escura profunda entre as tábuas
      diffCtx.fillStyle = '#1a0e07';
      diffCtx.fillRect(px, 0, 4, size);
      bumpCtx.fillStyle = '#101010';
      bumpCtx.fillRect(px, 0, 4, size);
    }

    // Moldura e travessas horizontais de reforço (top, center, bottom)
    const crossbeams = [
      { y: 35, h: 45 },
      { y: size * 0.5 - 25, h: 50 },
      { y: size - 85, h: 50 }
    ];

    for (const cb of crossbeams) {
      diffCtx.fillStyle = '#3a2312';
      diffCtx.fillRect(15, cb.y, size - 30, cb.h);
      diffCtx.strokeStyle = '#22140a';
      diffCtx.lineWidth = 3;
      diffCtx.strokeRect(15, cb.y, size - 30, cb.h);

      // Bump: travessa em relevo
      bumpCtx.fillStyle = '#c0c0c0';
      bumpCtx.fillRect(15, cb.y, size - 30, cb.h);

      // Tachas/Pregos de ferro forjado em cada tábua
      for (let p = 0; p < planks; p++) {
        const nailX = p * plankW + plankW * 0.5;
        const nailY = cb.y + cb.h * 0.5;

        // Cabeça de ferro quadrado/redondo
        diffCtx.fillStyle = '#18181c';
        diffCtx.beginPath();
        diffCtx.arc(nailX, nailY, 7, 0, Math.PI * 2);
        diffCtx.fill();
        diffCtx.fillStyle = '#7a7a85';
        diffCtx.beginPath();
        diffCtx.arc(nailX - 2, nailY - 2, 3, 0, Math.PI * 2);
        diffCtx.fill();

        bumpCtx.fillStyle = '#ffffff'; // Altíssimo relevo
        bumpCtx.beginPath();
        bumpCtx.arc(nailX, nailY, 7, 0, Math.PI * 2);
        bumpCtx.fill();
      }
    }

    // Puxador/Aldraba de Ferro Forjado Medieval (Knocker)
    const ringX = size * 0.78;
    const ringY = size * 0.52;
    diffCtx.strokeStyle = '#1a1a20';
    diffCtx.lineWidth = 8;
    diffCtx.beginPath();
    diffCtx.arc(ringX, ringY, 16, 0, Math.PI * 2);
    diffCtx.stroke();
    // Brilho metálico specular no topo do anel
    diffCtx.strokeStyle = '#858595';
    diffCtx.lineWidth = 3;
    diffCtx.beginPath();
    diffCtx.arc(ringX - 2, ringY - 2, 14, -Math.PI * 0.5, 0);
    diffCtx.stroke();

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 4. VENEZIANAS ITALIANAS / JANELAS (Green Tuscan Shutters)
  // =========================================================================
  createWindowShutters(size = 512) {
    const cacheKey = `window_shutters_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    // Vidro escuro reflexivo no fundo
    diffCtx.fillStyle = '#121820';
    diffCtx.fillRect(0, 0, size, size);
    // Reflexo de céu suave no vidro
    const glassGrad = diffCtx.createLinearGradient(0, 0, size, size);
    glassGrad.addColorStop(0, 'rgba(80, 120, 160, 0.45)');
    glassGrad.addColorStop(0.5, 'rgba(30, 45, 60, 0.2)');
    glassGrad.addColorStop(1, 'rgba(10, 15, 20, 0.7)');
    diffCtx.fillStyle = glassGrad;
    diffCtx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#202020';
    bumpCtx.fillRect(0, 0, size, size);

    // Moldura de pedra em volta da janela
    const stoneFrame = 24;
    diffCtx.fillStyle = '#9e968b';
    diffCtx.fillRect(0, 0, size, stoneFrame);
    diffCtx.fillRect(0, size - stoneFrame, size, stoneFrame);
    diffCtx.fillRect(0, 0, stoneFrame, size);
    diffCtx.fillRect(size - stoneFrame, 0, stoneFrame, size);

    // Duas venezianas verdes de madeira abertas nas laterais (clássico italiano)
    const shutterW = (size - stoneFrame * 2) * 0.44;
    const shutterH = size - stoneFrame * 2;
    const shutters = [
      { x: stoneFrame, y: stoneFrame },
      { x: size - stoneFrame - shutterW, y: stoneFrame }
    ];

    const shutterColor = '#2b4d32'; // Verde oliva / cipreste italiano
    const shutterLight = '#3b6644';
    const shutterDark = '#18301e';

    for (const sh of shutters) {
      // Moldura externa da veneziana
      diffCtx.fillStyle = shutterColor;
      diffCtx.fillRect(sh.x, sh.y, shutterW, shutterH);
      diffCtx.strokeStyle = shutterDark;
      diffCtx.lineWidth = 4;
      diffCtx.strokeRect(sh.x, sh.y, shutterW, shutterH);

      bumpCtx.fillStyle = '#b0b0b0';
      bumpCtx.fillRect(sh.x, sh.y, shutterW, shutterH);

      // Ripas / Palhetas angulares (louvers)
      const slats = 22;
      const slatH = (shutterH - 20) / slats;
      for (let s = 0; s < slats; s++) {
        const sy = sh.y + 10 + s * slatH;
        const grad = diffCtx.createLinearGradient(sh.x, sy, sh.x, sy + slatH);
        grad.addColorStop(0, shutterLight);
        grad.addColorStop(0.65, shutterColor);
        grad.addColorStop(1, shutterDark);

        diffCtx.fillStyle = grad;
        diffCtx.fillRect(sh.x + 8, sy, shutterW - 16, slatH - 1.5);

        // Bump das aletas
        const bGrad = bumpCtx.createLinearGradient(sh.x, sy, sh.x, sy + slatH);
        bGrad.addColorStop(0, '#f0f0f0');
        bGrad.addColorStop(1, '#505050');
        bumpCtx.fillStyle = bGrad;
        bumpCtx.fillRect(sh.x + 8, sy, shutterW - 16, slatH - 1.5);
      }
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 5. TELHAS CURVAS DE TERRACOTA (Italian Coppo Roof Tiles)
  // =========================================================================
  createRoofTiles(size = 512) {
    const cacheKey = `roof_tiles_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#612516';
    diffCtx.fillRect(0, 0, size, size);

    // Cursos verticais de telhas curvas sobrepostas
    const courses = 10;
    const tileW = size / courses;
    const rows = 14;
    const tileH = size / rows;

    for (let r = 0; r < rows; r++) {
      const y = r * tileH;
      for (let c = 0; c < courses; c++) {
        const x = c * tileW;
        const seed = r * 31 + c * 17;
        const tint = 0.9 + TextureGenerator.pseudoRandom(seed, 1) * 0.2;

        // Gradiente cilíndrico de curvatura da telha
        const tileGrad = diffCtx.createLinearGradient(x, y, x + tileW, y);
        const rVal = Math.floor(180 * tint);
        const gVal = Math.floor(75 * tint);
        const bVal = Math.floor(45 * tint);
        tileGrad.addColorStop(0, `rgb(${Math.floor(rVal * 0.6)}, ${Math.floor(gVal * 0.6)}, ${Math.floor(bVal * 0.6)})`);
        tileGrad.addColorStop(0.5, `rgb(${rVal}, ${gVal}, ${bVal})`);
        tileGrad.addColorStop(1, `rgb(${Math.floor(rVal * 0.45)}, ${Math.floor(gVal * 0.45)}, ${Math.floor(bVal * 0.45)})`);

        diffCtx.fillStyle = tileGrad;
        diffCtx.fillRect(x + 2, y, tileW - 4, tileH - 3);

        // Sombra de sobreposição da telha de cima
        diffCtx.fillStyle = 'rgba(20, 8, 4, 0.45)';
        diffCtx.fillRect(x + 2, y + tileH - 5, tileW - 4, 5);

        // Bump: arco senoidal de altura da telha
        const bumpGrad = bumpCtx.createLinearGradient(x, y, x + tileW, y);
        bumpGrad.addColorStop(0, '#202020');
        bumpGrad.addColorStop(0.5, '#f5f5f5');
        bumpGrad.addColorStop(1, '#202020');
        bumpCtx.fillStyle = bumpGrad;
        bumpCtx.fillRect(x + 2, y, tileW - 4, tileH - 3);
      }
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 6. PLANTAS & FOLHAS DE HERA COM CANAL ALFA (Ivy Foliage with Alpha)
  // =========================================================================
  createIvyFoliage(size = 512) {
    const cacheKey = `ivy_foliage_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    // Canvas transparente nativo
    diffCtx.clearRect(0, 0, size, size);

    // Ramos de videira / caules castanhos
    diffCtx.strokeStyle = '#422814';
    diffCtx.lineWidth = 4;
    diffCtx.beginPath();
    diffCtx.moveTo(size * 0.5, size);
    diffCtx.bezierCurveTo(size * 0.35, size * 0.65, size * 0.65, size * 0.35, size * 0.45, 0);
    diffCtx.stroke();

    diffCtx.lineWidth = 3;
    diffCtx.beginPath();
    diffCtx.moveTo(size * 0.4, size * 0.7);
    diffCtx.quadraticCurveTo(size * 0.15, size * 0.5, 0, size * 0.35);
    diffCtx.stroke();

    diffCtx.beginPath();
    diffCtx.moveTo(size * 0.55, size * 0.45);
    diffCtx.quadraticCurveTo(size * 0.8, size * 0.35, size, size * 0.25);
    diffCtx.stroke();

    // Gera dezenas de folhas de hera de 3 e 5 pontas
    const numLeaves = 120;
    const leafColors = [
      { r: 48, g: 110, b: 38 },  // Verde floresta
      { r: 72, g: 145, b: 52 },  // Verde vibrante
      { r: 35, g: 85,  b: 28 },  // Verde escuro sombreado
      { r: 92, g: 165, b: 64 },  // Verde broto
    ];

    for (let i = 0; i < numLeaves; i++) {
      const seed = i * 67 + 13;
      // Distribuição ao longo do caule com dispersão
      const t = i / numLeaves;
      const stemX = size * 0.5 + Math.sin(t * Math.PI * 2.5) * size * 0.25;
      const stemY = size * (1 - t * 0.95);
      const scatterX = (TextureGenerator.pseudoRandom(seed, 1) - 0.5) * size * 0.45;
      const scatterY = (TextureGenerator.pseudoRandom(seed, 2) - 0.5) * size * 0.2;
      const lx = Math.max(20, Math.min(size - 20, stemX + scatterX));
      const ly = Math.max(20, Math.min(size - 20, stemY + scatterY));

      const angle = TextureGenerator.pseudoRandom(seed, 3) * Math.PI * 2;
      const lSize = 18 + TextureGenerator.pseudoRandom(seed, 4) * 22;
      const col = leafColors[Math.floor(TextureGenerator.pseudoRandom(seed, 5) * leafColors.length)];

      diffCtx.save();
      diffCtx.translate(lx, ly);
      diffCtx.rotate(angle);

      // Desenho procedural da silhueta da folha de hera (3 pontas curvas)
      diffCtx.beginPath();
      diffCtx.moveTo(0, -lSize);
      diffCtx.quadraticCurveTo(lSize * 0.45, -lSize * 0.45, lSize * 0.8, -lSize * 0.1);
      diffCtx.quadraticCurveTo(lSize * 0.55, lSize * 0.35, lSize * 0.35, lSize * 0.8);
      diffCtx.quadraticCurveTo(0, lSize * 0.6, -lSize * 0.35, lSize * 0.8);
      diffCtx.quadraticCurveTo(-lSize * 0.55, lSize * 0.35, -lSize * 0.8, -lSize * 0.1);
      diffCtx.quadraticCurveTo(-lSize * 0.45, -lSize * 0.45, 0, -lSize);
      diffCtx.closePath();

      diffCtx.fillStyle = `rgb(${col.r}, ${col.g}, ${col.b})`;
      diffCtx.fill();

      // Nervuras da folha
      diffCtx.strokeStyle = `rgba(${col.r + 35}, ${col.g + 35}, ${col.b + 35}, 0.7)`;
      diffCtx.lineWidth = 1.2;
      diffCtx.beginPath();
      diffCtx.moveTo(0, lSize * 0.6);
      diffCtx.lineTo(0, -lSize * 0.85);
      diffCtx.moveTo(0, 0);
      diffCtx.lineTo(lSize * 0.6, -lSize * 0.05);
      diffCtx.moveTo(0, 0);
      diffCtx.lineTo(-lSize * 0.6, -lSize * 0.05);
      diffCtx.stroke();

      diffCtx.restore();
    }

    const tex = TextureGenerator.toTexture(diffCanvas, true);
    const bundle = {
      diffuse: tex,
      // No Three.js podemos usar a mesma textura para map e alphaMap quando ela já possui transparência
      alpha: tex,
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 7. BARRIL DE VINHO ITALIANO & AROS DE FERRO (Wine Barrel)
  // =========================================================================
  createWineBarrel(size = 512) {
    const cacheKey = `wine_barrel_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#5c3922'; // Carvalho envelhecido escuro
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Aduelas verticais de carvalho (staves)
    const staves = 14;
    const sW = size / staves;
    for (let i = 0; i < staves; i++) {
      const sx = i * sW;
      const seed = i * 47;
      const tint = 0.85 + TextureGenerator.pseudoRandom(seed, 1) * 0.3;

      for (let y = 0; y < size; y++) {
        const grain = TextureGenerator.fbm(sx * 0.08, y * 0.02, 3) * 25;
        const r = Math.min(255, Math.floor((105 + grain) * tint));
        const g = Math.min(255, Math.floor((68 + grain * 0.7) * tint));
        const b = Math.min(255, Math.floor((42 + grain * 0.5) * tint));
        diffCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        diffCtx.fillRect(sx, y, sW, 1);
      }

      diffCtx.fillStyle = '#1c0f08';
      diffCtx.fillRect(sx, 0, 3, size);
      bumpCtx.fillStyle = '#151515';
      bumpCtx.fillRect(sx, 0, 3, size);
    }

    // 4 Cintas/Aros de ferro forjado (top, upper-mid, lower-mid, bottom)
    const hoops = [
      { y: 40, h: 26 },
      { y: 150, h: 28 },
      { y: size - 178, h: 28 },
      { y: size - 66, h: 26 }
    ];

    for (const h of hoops) {
      // Metal forjado escuro
      diffCtx.fillStyle = '#26282c';
      diffCtx.fillRect(0, h.y, size, h.h);
      diffCtx.fillStyle = '#686c75';
      diffCtx.fillRect(0, h.y + 2, size, 3); // Brilho no topo do anel

      bumpCtx.fillStyle = '#e8e8e8'; // Alto relevo do aro de ferro
      bumpCtx.fillRect(0, h.y, size, h.h);

      // Rebites metálicos
      for (let i = 0; i < staves; i++) {
        const rx = i * sW + sW * 0.5;
        const ry = h.y + h.h * 0.5;
        diffCtx.fillStyle = '#42454d';
        diffCtx.beginPath();
        diffCtx.arc(rx, ry, 5, 0, Math.PI * 2);
        diffCtx.fill();
        diffCtx.fillStyle = '#8b909c';
        diffCtx.beginPath();
        diffCtx.arc(rx - 1, ry - 1, 2, 0, Math.PI * 2);
        diffCtx.fill();

        bumpCtx.fillStyle = '#ffffff';
        bumpCtx.beginPath();
        bumpCtx.arc(rx, ry, 5, 0, Math.PI * 2);
        bumpCtx.fill();
      }
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 8. CAIXOTE DE VINHO DE MADEIRA COM CARIMBO (Italian Crate)
  // =========================================================================
  createWineCrate(size = 512) {
    const cacheKey = `wine_crate_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#a68254'; // Pinho claro
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // 4 Tábuas horizontais
    const rows = 4;
    const rH = size / rows;
    for (let r = 0; r < rows; r++) {
      const ry = r * rH;
      diffCtx.fillStyle = '#1f1307';
      diffCtx.fillRect(0, ry, size, 4);
      bumpCtx.fillStyle = '#101010';
      bumpCtx.fillRect(0, ry, size, 4);
    }

    // Moldura periférica de reforço
    const border = 36;
    diffCtx.fillStyle = '#8f6e43';
    diffCtx.fillRect(0, 0, size, border);
    diffCtx.fillRect(0, size - border, size, border);
    diffCtx.fillRect(0, 0, border, size);
    diffCtx.fillRect(size - border, 0, border, size);

    bumpCtx.fillStyle = '#b8b8b8';
    bumpCtx.fillRect(0, 0, size, border);
    bumpCtx.fillRect(0, size - border, size, border);
    bumpCtx.fillRect(0, 0, border, size);
    bumpCtx.fillRect(size - border, 0, border, size);

    // Travessa diagonal clássica
    diffCtx.strokeStyle = '#8f6e43';
    diffCtx.lineWidth = border * 0.9;
    diffCtx.beginPath();
    diffCtx.moveTo(border, border);
    diffCtx.lineTo(size - border, size - border);
    diffCtx.stroke();

    bumpCtx.strokeStyle = '#b8b8b8';
    bumpCtx.lineWidth = border * 0.9;
    bumpCtx.beginPath();
    bumpCtx.moveTo(border, border);
    bumpCtx.lineTo(size - border, size - border);
    bumpCtx.stroke();

    // Carimbo vintage stenciled: "VINO D'ITALIA" & Uvas
    diffCtx.save();
    diffCtx.fillStyle = 'rgba(65, 20, 18, 0.72)'; // Tinta vinho escurecida
    diffCtx.font = 'bold 32px serif';
    diffCtx.textAlign = 'center';
    diffCtx.fillText("VINO D'ITALIA", size * 0.5, size * 0.42);
    diffCtx.font = 'italic bold 20px serif';
    diffCtx.fillText("CHIANTI 1999", size * 0.5, size * 0.62);
    diffCtx.restore();

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 9. TOLDO LISTRADO DE FEIRA ITALIANA (Market Striped Awning)
  // =========================================================================
  createStripedAwning(size = 512, color1 = '#b82a24', color2 = '#f0ede6') {
    const cacheKey = `striped_awning_${color1}_${color2}_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    const stripes = 8;
    const sW = size / stripes;

    for (let i = 0; i < stripes; i++) {
      const col = (i % 2 === 0) ? color1 : color2;
      diffCtx.fillStyle = col;
      diffCtx.fillRect(i * sW, 0, sW, size);

      // Micro-trama de tecido de lona
      bumpCtx.fillStyle = (i % 2 === 0) ? '#a0a0a0' : '#808080';
      bumpCtx.fillRect(i * sW, 0, sW, size);
    }

    // Dobras/rugas suaves de tecido ao longo da gravidade
    const img = diffCtx.getImageData(0, 0, size, size);
    const bImg = bumpCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      const wave = Math.sin((px / sW) * Math.PI) * 22;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + wave));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + wave));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + wave));

      bImg.data[i] = Math.max(0, Math.min(255, bImg.data[i] + wave * 0.8));
      bImg.data[i + 1] = bImg.data[i];
      bImg.data[i + 2] = bImg.data[i];
    }
    diffCtx.putImageData(img, 0, 0);
    bumpCtx.putImageData(bImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 10. BLOCOS DE PEDRA DE ARCO / TRAVERTINO (Ashlar Stone Arch)
  // =========================================================================
  createStoneArch(size = 512) {
    const cacheKey = `stone_arch_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#454038';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#101010';
    bumpCtx.fillRect(0, 0, size, size);

    const rows = 6;
    const cols = 4;
    const bW = size / cols;
    const bH = size / rows;
    const gap = 5;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 1) ? bW * 0.5 : 0;
      for (let c = -1; c < cols + 1; c++) {
        const bx = c * bW + offsetX + gap * 0.5;
        const by = r * bH + gap * 0.5;
        const bw = bW - gap;
        const bh = bH - gap;

        const seed = r * 43 + c * 19;
        const shade = 0.9 + TextureGenerator.pseudoRandom(seed, 1) * 0.2;
        const rVal = Math.floor(185 * shade);
        const gVal = Math.floor(178 * shade);
        const bVal = Math.floor(165 * shade);

        diffCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
        diffCtx.fillRect(bx, by, bw, bh);

        // Chanfro das bordas da pedra
        bumpCtx.fillStyle = '#d0d0d0';
        bumpCtx.fillRect(bx, by, bw, bh);
      }
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 11. GRAMA DA VILA COM FLORES SILVESTRES (Village Meadow & Daisies)
  // =========================================================================
  createGrassVillage(size = 512) {
    const cacheKey = `grass_village_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: roughCanvas, ctx: roughCtx } = TextureGenerator.createCanvas(size, size);

    // Solo escuro rico de fundo
    diffCtx.fillStyle = '#2d451e';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#202020';
    bumpCtx.fillRect(0, 0, size, size);
    roughCtx.fillStyle = '#e0e0e0';
    roughCtx.fillRect(0, 0, size, size);

    // Tufos de grama densa com variação de verde
    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const n1 = TextureGenerator.fbm(x * 0.04, y * 0.04, 3);
        const n2 = TextureGenerator.fbm(x * 0.12, y * 0.12, 2);

        // Paleta de gramado europeu viçoso
        const gTone = n1 * 0.7 + n2 * 0.3;
        const r = Math.floor(45 + gTone * 40);
        const g = Math.floor(100 + gTone * 75);
        const b = Math.floor(35 + gTone * 30);

        diffImg.data[idx] = r;
        diffImg.data[idx + 1] = g;
        diffImg.data[idx + 2] = b;

        // Bump dos tufos de lâminas
        const bVal = Math.floor(120 + n2 * 110);
        bumpImg.data[idx] = bVal;
        bumpImg.data[idx + 1] = bVal;
        bumpImg.data[idx + 2] = bVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    // Flores silvestres campestres (margaridas brancas e flores amarelas)
    const numFlowers = 45;
    for (let f = 0; f < numFlowers; f++) {
      const seed = f * 79 + 31;
      const fx = Math.floor(TextureGenerator.pseudoRandom(seed, 1) * (size - 20)) + 10;
      const fy = Math.floor(TextureGenerator.pseudoRandom(seed, 2) * (size - 20)) + 10;
      const isYellow = TextureGenerator.pseudoRandom(seed, 3) > 0.6;
      const petalColor = isYellow ? '#ffd147' : '#ffffff';
      const centerColor = '#e89c17';

      // Pétalas circulares
      diffCtx.fillStyle = petalColor;
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2;
        const px = fx + Math.cos(ang) * 4;
        const py = fy + Math.sin(ang) * 4;
        diffCtx.beginPath();
        diffCtx.arc(px, py, 2.5, 0, Math.PI * 2);
        diffCtx.fill();
      }

      // Miolo da flor
      diffCtx.fillStyle = centerColor;
      diffCtx.beginPath();
      diffCtx.arc(fx, fy, 2.2, 0, Math.PI * 2);
      diffCtx.fill();

      // Bump suave da flor
      bumpCtx.fillStyle = '#ffffff';
      bumpCtx.beginPath();
      bumpCtx.arc(fx, fy, 5, 0, Math.PI * 2);
      bumpCtx.fill();
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
      roughness: TextureGenerator.toTexture(roughCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 12. CAMINHO DE TERRA BATIDA & CASCALHO (Village Dirt Road)
  // =========================================================================
  createDirtPath(size = 512) {
    const cacheKey = `dirt_path_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#6e563b';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#606060';
    bumpCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const soilNoise = TextureGenerator.fbm(x * 0.02, y * 0.02, 4);
        const fineNoise = TextureGenerator.valueNoise(x * 0.15, y * 0.15);

        // Variação de terra batida marrom-dourada
        const shade = 0.8 + soilNoise * 0.4;
        diffImg.data[idx] = Math.min(255, Math.floor(118 * shade + (fineNoise - 0.5) * 20));
        diffImg.data[idx + 1] = Math.min(255, Math.floor(92 * shade + (fineNoise - 0.5) * 18));
        diffImg.data[idx + 2] = Math.min(255, Math.floor(65 * shade + (fineNoise - 0.5) * 15));

        const bVal = Math.min(255, Math.max(0, Math.floor(100 + soilNoise * 70 + (fineNoise - 0.5) * 35)));
        bumpImg.data[idx] = bVal;
        bumpImg.data[idx + 1] = bVal;
        bumpImg.data[idx + 2] = bVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    // Cascalho / seixos espalhados
    const numPebbles = 80;
    for (let p = 0; p < numPebbles; p++) {
      const seed = p * 61 + 19;
      const px = Math.floor(TextureGenerator.pseudoRandom(seed, 1) * size);
      const py = Math.floor(TextureGenerator.pseudoRandom(seed, 2) * size);
      const pr = 2 + TextureGenerator.pseudoRandom(seed, 3) * 3.5;
      const col = 140 + Math.floor(TextureGenerator.pseudoRandom(seed, 4) * 50);

      diffCtx.fillStyle = `rgb(${col}, ${col - 10}, ${col - 20})`;
      diffCtx.beginPath();
      diffCtx.arc(px, py, pr, 0, Math.PI * 2);
      diffCtx.fill();

      bumpCtx.fillStyle = '#e8e8e8';
      bumpCtx.beginPath();
      bumpCtx.arc(px, py, pr, 0, Math.PI * 2);
      bumpCtx.fill();
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 13. CASCA DE TRONCO DE CARVALHO (Oak Tree Bark)
  // =========================================================================
  createTreeBark(size = 512) {
    const cacheKey = `tree_bark_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#3d2b1d';
    diffCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Ranhuras longitudinais esticadas no eixo vertical
        const furrow = TextureGenerator.fbm(x * 0.06, y * 0.012, 4);
        const fiber = TextureGenerator.valueNoise(x * 0.2, y * 0.04);

        const tone = 0.75 + furrow * 0.5 + fiber * 0.15;
        diffImg.data[idx] = Math.min(255, Math.floor(75 * tone));
        diffImg.data[idx + 1] = Math.min(255, Math.floor(52 * tone));
        diffImg.data[idx + 2] = Math.min(255, Math.floor(34 * tone));

        const bVal = Math.min(255, Math.floor(furrow * 220));
        bumpImg.data[idx] = bVal;
        bumpImg.data[idx + 1] = bVal;
        bumpImg.data[idx + 2] = bVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 14. FOLHAGEM DE COPA DE ÁRVORE & BLOCOS DE FOLHA (Dense Tree Foliage)
  // =========================================================================
  createOakFoliage(size = 512, isLight = false) {
    const cacheKey = `oak_foliage_${isLight ? 'light_' : ''}${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    if (!diffCtx) {
      const bundle = { diffuse: null, bump: null };
      this._cache.set(cacheKey, bundle);
      return bundle;
    }

    // Fundo denso de oclusão e sombra interna da copa (evita vazios transparentes em blocos cúbicos)
    const baseColor = isLight ? '#1f3814' : '#14280d';
    diffCtx.fillStyle = baseColor;
    diffCtx.fillRect(0, 0, size, size);

    if (bumpCtx) {
      bumpCtx.fillStyle = '#606060';
      bumpCtx.fillRect(0, 0, size, size);
    }

    // Camada de ruído orgânico de folhas profundas
    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx ? bumpCtx.getImageData(0, 0, size, size) : null;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const leafNoise = TextureGenerator.fbm(x * 0.04, y * 0.04, 3);
        const microNoise = (TextureGenerator.pseudoRandom(x, y) - 0.5) * 18;

        const baseR = isLight ? 36 : 24;
        const baseG = isLight ? 78 : 55;
        const baseB = isLight ? 26 : 18;

        const factor = 0.75 + leafNoise * 0.5;
        diffImg.data[idx] = Math.max(0, Math.min(255, Math.floor(baseR * factor + microNoise)));
        diffImg.data[idx + 1] = Math.max(0, Math.min(255, Math.floor(baseG * factor + microNoise * 1.2)));
        diffImg.data[idx + 2] = Math.max(0, Math.min(255, Math.floor(baseB * factor + microNoise * 0.8)));

        if (bumpImg) {
          const bVal = Math.max(0, Math.min(255, Math.floor(90 + leafNoise * 75 + microNoise * 0.5)));
          bumpImg.data[idx] = bVal;
          bumpImg.data[idx + 1] = bVal;
          bumpImg.data[idx + 2] = bVal;
        }
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    if (bumpCtx && bumpImg) bumpCtx.putImageData(bumpImg, 0, 0);

    // Centenas de agrupamentos de folhas em camadas sobrepostas
    const numClusters = 220;
    const darkPal = [
      { r: 38, g: 82, b: 26 },
      { r: 52, g: 110, b: 35 },
      { r: 28, g: 65, b: 20 },
      { r: 68, g: 135, b: 46 },
      { r: 84, g: 160, b: 58 },
    ];
    const lightPal = [
      { r: 55, g: 115, b: 34 },
      { r: 76, g: 148, b: 48 },
      { r: 42, g: 92, b: 26 },
      { r: 95, g: 178, b: 62 },
      { r: 118, g: 205, b: 76 },
    ];
    const leafPal = isLight ? lightPal : darkPal;

    for (let i = 0; i < numClusters; i++) {
      const seed = i * 89 + 17;
      const cx = TextureGenerator.pseudoRandom(seed, 1) * size;
      const cy = TextureGenerator.pseudoRandom(seed, 2) * size;
      const radius = 10 + TextureGenerator.pseudoRandom(seed, 3) * 22;
      const col = leafPal[Math.floor(TextureGenerator.pseudoRandom(seed, 4) * leafPal.length)];

      diffCtx.save();
      diffCtx.translate(cx, cy);
      const clusterRot = TextureGenerator.pseudoRandom(seed, 5) * Math.PI * 2;
      diffCtx.rotate(clusterRot);

      // Aglomerado central de folíolos
      diffCtx.fillStyle = `rgb(${col.r}, ${col.g}, ${col.b})`;
      diffCtx.beginPath();
      diffCtx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
      diffCtx.fill();

      // Folhas ovais ao redor do aglomerado
      const leavesInCluster = 5 + Math.floor(TextureGenerator.pseudoRandom(seed, 6) * 4);
      for (let l = 0; l < leavesInCluster; l++) {
        const ang = (l / leavesInCluster) * Math.PI * 2;
        const dist = radius * 0.55;
        const lx = Math.cos(ang) * dist;
        const ly = Math.sin(ang) * dist;
        const leafW = radius * 0.50;
        const leafH = radius * 0.28;

        diffCtx.beginPath();
        diffCtx.ellipse(lx, ly, leafW, leafH, ang + 0.3, 0, Math.PI * 2);
        diffCtx.fill();

        // Nervura sutil de luz solar na folha
        diffCtx.strokeStyle = `rgba(${Math.min(255, col.r + 40)}, ${Math.min(255, col.g + 45)}, ${Math.min(255, col.b + 35)}, 0.55)`;
        diffCtx.lineWidth = 1.0;
        diffCtx.beginPath();
        diffCtx.moveTo(lx - Math.cos(ang) * leafW * 0.7, ly - Math.sin(ang) * leafH * 0.7);
        diffCtx.lineTo(lx + Math.cos(ang) * leafW * 0.7, ly + Math.sin(ang) * leafH * 0.7);
        diffCtx.stroke();
      }

      diffCtx.restore();

      if (bumpCtx) {
        bumpCtx.save();
        bumpCtx.translate(cx, cy);
        bumpCtx.rotate(clusterRot);
        bumpCtx.fillStyle = '#d5d5d5';
        bumpCtx.beginPath();
        bumpCtx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
        bumpCtx.fill();
        bumpCtx.restore();
      }
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: bumpCanvas ? TextureGenerator.toTexture(bumpCanvas, false) : null,
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 15. AREIA DO DESERTO COM ONDULAÇÕES DE VENTO (Dust Desert Sand Dunes)
  // =========================================================================
  createSandDunes(size = 512) {
    const cacheKey = `sand_dunes_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#d4b380';
    diffCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Ondulações de vento (sand ripples): ondas suaves com leve ruído
        const ripplePhase = (x * 0.08 + y * 0.04);
        const rippleNoise = TextureGenerator.valueNoise(x * 0.03, y * 0.03) * 2.5;
        const ripple = Math.sin(ripplePhase + rippleNoise);

        const macroNoise = TextureGenerator.fbm(x * 0.008, y * 0.008, 3);
        const microGrain = (TextureGenerator.pseudoRandom(x, y) - 0.5) * 16;

        const shade = 0.88 + macroNoise * 0.22 + ripple * 0.08;
        const rVal = Math.max(0, Math.min(255, Math.floor(214 * shade + microGrain)));
        const gVal = Math.max(0, Math.min(255, Math.floor(180 * shade + microGrain * 0.8)));
        const bVal = Math.max(0, Math.min(255, Math.floor(128 * shade + microGrain * 0.6)));

        diffImg.data[idx] = rVal;
        diffImg.data[idx + 1] = gVal;
        diffImg.data[idx + 2] = bVal;

        // Bump: relevo das ondas de vento
        const bumpVal = Math.max(0, Math.min(255, Math.floor(128 + ripple * 55 + macroNoise * 40)));
        bumpImg.data[idx] = bumpVal;
        bumpImg.data[idx + 1] = bumpVal;
        bumpImg.data[idx + 2] = bumpVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 16. BLOCOS DE ARENITO DO ORIENTE MÉDIO (Dust Mirage Sandstone Blocks)
  // =========================================================================
  createSandstoneBlocks(size = 512) {
    const cacheKey = `sandstone_blocks_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#b89464'; // Argamassa com areia
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#202020';
    bumpCtx.fillRect(0, 0, size, size);

    const rows = 8;
    const cols = 4;
    const bW = size / cols;
    const bH = size / rows;
    const mortar = 5;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 1) ? bW * 0.5 : 0;
      for (let c = -1; c < cols + 1; c++) {
        const bx = c * bW + offsetX + mortar * 0.5;
        const by = r * bH + mortar * 0.5;
        const bw = bW - mortar;
        const bh = bH - mortar;

        const seed = r * 59 + c * 23;
        const tone = 0.9 + TextureGenerator.pseudoRandom(seed, 1) * 0.22;
        const rVal = Math.floor(218 * tone);
        const gVal = Math.floor(182 * tone);
        const bVal = Math.floor(134 * tone);

        // Bloco de arenito com gradiente de erosão do deserto
        const blockGrad = diffCtx.createLinearGradient(bx, by, bx, by + bh);
        blockGrad.addColorStop(0, `rgb(${rVal + 15}, ${gVal + 15}, ${bVal + 10})`);
        blockGrad.addColorStop(1, `rgb(${rVal - 15}, ${gVal - 15}, ${bVal - 20})`);
        diffCtx.fillStyle = blockGrad;
        diffCtx.fillRect(bx, by, bw, bh);

        // Bump dos blocos chanfrados com erosão
        bumpCtx.fillStyle = '#d5d5d5';
        bumpCtx.fillRect(bx, by, bw, bh);
      }
    }

    // Porosidade e marcas de vento
    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < diffImg.data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      const grain = (TextureGenerator.valueNoise(px * 0.12, py * 0.12) - 0.5) * 24;
      diffImg.data[i] = Math.max(0, Math.min(255, diffImg.data[i] + grain));
      diffImg.data[i + 1] = Math.max(0, Math.min(255, diffImg.data[i + 1] + grain));
      diffImg.data[i + 2] = Math.max(0, Math.min(255, diffImg.data[i + 2] + grain));

      bumpImg.data[i] = Math.max(0, Math.min(255, bumpImg.data[i] + grain * 0.5));
      bumpImg.data[i + 1] = bumpImg.data[i];
      bumpImg.data[i + 2] = bumpImg.data[i];
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 17. ADOBE DESÉRTICO COM RACHADURAS TÉRMICAS (Desert Adobe Plaster)
  // =========================================================================
  createAdobePlaster(size = 512) {
    const cacheKey = `adobe_plaster_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#e8d5be';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#b0b0b0';
    bumpCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const wave = TextureGenerator.fbm(x * 0.01, y * 0.01, 3);
        const crack = TextureGenerator.fbm(x * 0.05, y * 0.05, 3);
        const isCrack = Math.abs(crack - 0.5) < 0.015;

        let r = Math.floor(232 + (wave - 0.5) * 25);
        let g = Math.floor(212 + (wave - 0.5) * 25);
        let b = Math.floor(190 + (wave - 0.5) * 20);

        let bVal = Math.floor(180 + wave * 40);
        if (isCrack) {
          r = Math.floor(r * 0.65);
          g = Math.floor(g * 0.65);
          b = Math.floor(b * 0.65);
          bVal = 60; // Profundidade da fenda
        }

        diffImg.data[idx] = r;
        diffImg.data[idx + 1] = g;
        diffImg.data[idx + 2] = b;

        bumpImg.data[idx] = bVal;
        bumpImg.data[idx + 1] = bVal;
        bumpImg.data[idx + 2] = bVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 18. TAPETE / TECIDO ÁRABE GEOMÉTRICO (Persian / Arabic Rug)
  // =========================================================================
  createArabicRug(size = 512, primaryColor = '#a8241e', secondaryColor = '#1e385c') {
    const cacheKey = `arabic_rug_${primaryColor}_${secondaryColor}_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    // Fundo vermelho carmim tradicional
    diffCtx.fillStyle = primaryColor;
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Bordas ornamentais
    const borderW = 40;
    diffCtx.fillStyle = secondaryColor;
    diffCtx.fillRect(0, 0, size, borderW);
    diffCtx.fillRect(0, size - borderW, size, borderW);
    diffCtx.fillRect(0, 0, borderW, size);
    diffCtx.fillRect(size - borderW, 0, borderW, size);

    diffCtx.strokeStyle = '#dfb858'; // Fita dourada
    diffCtx.lineWidth = 4;
    diffCtx.strokeRect(borderW * 0.5, borderW * 0.5, size - borderW, size - borderW);

    // Medalhão central em diamante
    diffCtx.fillStyle = '#dfb858';
    diffCtx.beginPath();
    diffCtx.moveTo(size * 0.5, size * 0.2);
    diffCtx.lineTo(size * 0.8, size * 0.5);
    diffCtx.lineTo(size * 0.5, size * 0.8);
    diffCtx.lineTo(size * 0.2, size * 0.5);
    diffCtx.closePath();
    diffCtx.fill();

    diffCtx.fillStyle = secondaryColor;
    diffCtx.beginPath();
    diffCtx.arc(size * 0.5, size * 0.5, size * 0.16, 0, Math.PI * 2);
    diffCtx.fill();

    // Franjas brancas/bege nas extremidades superior e inferior
    diffCtx.fillStyle = '#ede8db';
    const fringeCount = 32;
    const fW = size / fringeCount;
    for (let i = 0; i < fringeCount; i++) {
      diffCtx.fillRect(i * fW + 1, 0, fW - 2, 12);
      diffCtx.fillRect(i * fW + 1, size - 12, fW - 2, 12);
    }

    // Bump da textura de lã/nó de tapeçaria
    const bImg = bumpCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < bImg.data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      const weave = Math.sin(px * 0.5) * Math.sin(py * 0.5) * 35;
      bImg.data[i] = Math.max(0, Math.min(255, bImg.data[i] + weave));
      bImg.data[i + 1] = bImg.data[i];
      bImg.data[i + 2] = bImg.data[i];
    }
    bumpCtx.putImageData(bImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 19. FOLHAS DE PALMEIRA DO DESERTO COM ALFA (Desert Palm Fronds)
  // =========================================================================
  createPalmFronds(size = 512) {
    const cacheKey = `palm_fronds_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    if (!diffCtx) {
      const bundle = { diffuse: null, alpha: null, bump: null };
      this._cache.set(cacheKey, bundle);
      return bundle;
    }

    diffCtx.clearRect(0, 0, size, size);
    if (bumpCtx) {
      bumpCtx.fillStyle = '#808080';
      bumpCtx.fillRect(0, 0, size, size);
    }

    const centerX = size * 0.5;

    // Função de traçado do eixo da raque central (curvatura suave natural de deserto)
    const getSpinePoint = (t) => {
      // t varia de 0 (base inferior) a 1 (ponta superior da folha)
      const sy = size - 12 - t * (size - 30);
      const sx = centerX + Math.sin(t * Math.PI * 0.82) * 14;
      return { x: sx, y: sy };
    };

    const numLeaflets = 60;

    // 1. CAMADA INFERIOR DE PÍNULAS (Sombra profunda / volume denso de oclusão)
    // Garante corpo foliar sólido, 100% visível e imune à perda por mipmapping
    for (let i = 0; i < numLeaflets; i++) {
      const t = i / (numLeaflets - 1);
      const { x: sx, y: sy } = getSpinePoint(t);

      // Perfil de leque: envergadura ampla no terço médio (até 210px) e afunilada nas pontas
      const spanCurve = Math.sin(Math.pow(t, 0.70) * Math.PI);
      const len = 38 + spanCurve * 175;
      const bladeW = 9.0 + (1 - t * 0.45) * 6.5;

      for (const side of [-1, 1]) {
        const spreadAng = -Math.PI * 0.5 + side * (1.14 - t * 0.46);
        const tipX = sx + Math.cos(spreadAng) * len + side * (Math.sin(t * Math.PI) * 12);
        const tipY = sy + Math.sin(spreadAng) * len;

        const midX = sx + Math.cos(spreadAng) * (len * 0.50);
        const midY = sy + Math.sin(spreadAng) * (len * 0.50);
        const perpX = -Math.sin(spreadAng) * side;
        const perpY = Math.cos(spreadAng) * side;

        // Lâmina foliar fechada como polígono sólido
        diffCtx.beginPath();
        diffCtx.moveTo(sx, sy + bladeW * 0.5);
        diffCtx.quadraticCurveTo(midX + perpX * (bladeW * 0.58), midY + perpY * (bladeW * 0.58), tipX, tipY);
        diffCtx.quadraticCurveTo(midX - perpX * (bladeW * 0.38), midY - perpY * (bladeW * 0.38), sx, sy - bladeW * 0.5);
        diffCtx.closePath();

        diffCtx.fillStyle = '#1c3e12';
        diffCtx.fill();

        if (bumpCtx) {
          bumpCtx.fillStyle = '#656565';
          bumpCtx.fill();
        }
      }
    }

    // 2. CAMADA FRONTAL DE PÍNULAS (Verde tropical vibrante e degradês solares)
    for (let i = 0; i < numLeaflets; i++) {
      const t = i / (numLeaflets - 1);
      const { x: sx, y: sy } = getSpinePoint(t);

      const spanCurve = Math.sin(Math.pow(t, 0.72) * Math.PI);
      const len = 36 + spanCurve * 170;
      const bladeW = 8.0 + (1 - t * 0.42) * 5.8;

      for (const side of [-1, 1]) {
        const spreadAng = -Math.PI * 0.5 + side * (1.12 - t * 0.45);
        const tipX = sx + Math.cos(spreadAng) * len + side * (Math.sin(t * Math.PI) * 10);
        const tipY = sy + Math.sin(spreadAng) * len;

        const midX = sx + Math.cos(spreadAng) * (len * 0.48);
        const midY = sy + Math.sin(spreadAng) * (len * 0.48);
        const perpX = -Math.sin(spreadAng) * side;
        const perpY = Math.cos(spreadAng) * side;

        // Degradê luminoso de folha viva
        const leafGrad = diffCtx.createLinearGradient(sx, sy, tipX, tipY);
        const alt = (i % 2 === 0);
        if (alt) {
          leafGrad.addColorStop(0, '#2d5e1b');
          leafGrad.addColorStop(0.45, '#4a942a');
          leafGrad.addColorStop(1, '#78c63e');
        } else {
          leafGrad.addColorStop(0, '#255217');
          leafGrad.addColorStop(0.45, '#3f8224');
          leafGrad.addColorStop(1, '#68b434');
        }

        diffCtx.beginPath();
        diffCtx.moveTo(sx, sy + bladeW * 0.45);
        diffCtx.quadraticCurveTo(midX + perpX * (bladeW * 0.54), midY + perpY * (bladeW * 0.54), tipX, tipY);
        diffCtx.quadraticCurveTo(midX - perpX * (bladeW * 0.34), midY - perpY * (bladeW * 0.34), sx, sy - bladeW * 0.45);
        diffCtx.closePath();

        diffCtx.fillStyle = leafGrad;
        diffCtx.fill();

        // Nervura central da pínula (specular highlight que reflete o sol)
        diffCtx.strokeStyle = 'rgba(168, 232, 88, 0.65)';
        diffCtx.lineWidth = 1.6;
        diffCtx.beginPath();
        diffCtx.moveTo(sx, sy);
        diffCtx.quadraticCurveTo(midX, midY, tipX, tipY);
        diffCtx.stroke();

        if (bumpCtx) {
          bumpCtx.fillStyle = '#b2b2b2';
          bumpCtx.fill();
          bumpCtx.strokeStyle = '#eaeaea';
          bumpCtx.lineWidth = 2.0;
          bumpCtx.stroke();
        }
      }
    }

    // 3. RAQUE CENTRAL / HASTE LENHOSA (Sturdy Central Rachis)
    const spineGrad = diffCtx.createLinearGradient(centerX, size, centerX, 20);
    spineGrad.addColorStop(0, '#889a3c');
    spineGrad.addColorStop(0.35, '#758d32');
    spineGrad.addColorStop(0.7, '#5c7626');
    spineGrad.addColorStop(1, '#49631d');

    // Sombra de contorno da haste
    diffCtx.beginPath();
    let fShadow = true;
    for (let i = 0; i < numLeaflets; i++) {
      const t = i / (numLeaflets - 1);
      const { x, y } = getSpinePoint(t);
      if (fShadow) { diffCtx.moveTo(x, y); fShadow = false; }
      else { diffCtx.lineTo(x, y); }
    }
    diffCtx.strokeStyle = 'rgba(18, 38, 10, 0.85)';
    diffCtx.lineWidth = 11;
    diffCtx.lineCap = 'round';
    diffCtx.stroke();

    // Haste principal
    diffCtx.beginPath();
    let fSpine = true;
    for (let i = 0; i < numLeaflets; i++) {
      const t = i / (numLeaflets - 1);
      const { x, y } = getSpinePoint(t);
      if (fSpine) { diffCtx.moveTo(x, y); fSpine = false; }
      else { diffCtx.lineTo(x, y); }
    }
    diffCtx.strokeStyle = spineGrad;
    diffCtx.lineWidth = 8;
    diffCtx.lineCap = 'round';
    diffCtx.stroke();

    // Filete de luz especular central
    diffCtx.beginPath();
    let fHighlight = true;
    for (let i = 0; i < numLeaflets; i++) {
      const t = i / (numLeaflets - 1);
      const { x, y } = getSpinePoint(t);
      if (fHighlight) { diffCtx.moveTo(x - 0.7, y); fHighlight = false; }
      else { diffCtx.lineTo(x - 0.7, y); }
    }
    diffCtx.strokeStyle = 'rgba(215, 245, 132, 0.85)';
    diffCtx.lineWidth = 2.2;
    diffCtx.stroke();

    if (bumpCtx) {
      bumpCtx.beginPath();
      let fBump = true;
      for (let i = 0; i < numLeaflets; i++) {
        const t = i / (numLeaflets - 1);
        const { x, y } = getSpinePoint(t);
        if (fBump) { bumpCtx.moveTo(x, y); fBump = false; }
        else { bumpCtx.lineTo(x, y); }
      }
      bumpCtx.strokeStyle = '#ffffff';
      bumpCtx.lineWidth = 10;
      bumpCtx.lineCap = 'round';
      bumpCtx.stroke();
    }

    const diffTex = TextureGenerator.toTexture(diffCanvas, true);
    const bumpTex = bumpCanvas ? TextureGenerator.toTexture(bumpCanvas, false) : null;

    const bundle = {
      diffuse: diffTex,
      alpha: diffTex,
      bump: bumpTex,
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 20. TRONCO ANELADO DE PALMEIRA (Palm Tree Trunk)
  // =========================================================================
  createPalmTrunk(size = 512) {
    const cacheKey = `palm_trunk_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#6e5137';
    diffCtx.fillRect(0, 0, size, size);

    const rings = 16;
    const rH = size / rings;

    for (let r = 0; r < rings; r++) {
      const ry = r * rH;
      // Anel fibroso
      const grad = diffCtx.createLinearGradient(0, ry, 0, ry + rH);
      grad.addColorStop(0, '#533b25');
      grad.addColorStop(0.5, '#7d5c3f');
      grad.addColorStop(1, '#3f2b1a');
      diffCtx.fillStyle = grad;
      diffCtx.fillRect(0, ry, size, rH - 2);

      bumpCtx.fillStyle = '#f0f0f0';
      bumpCtx.fillRect(0, ry, size, rH - 2);
      bumpCtx.fillStyle = '#202020';
      bumpCtx.fillRect(0, ry + rH - 2, size, 2);
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 21. CAIXOTE MILITAR DE MUNIÇÃO / SUPRIMENTOS (Military Supply Crate)
  // =========================================================================
  createMilitaryCrate(size = 512) {
    const cacheKey = `military_crate_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    // Cor verde oliva militar desgastada
    diffCtx.fillStyle = '#4a5740';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Cantoneiras metálicas pretas de proteção
    const corner = 45;
    diffCtx.fillStyle = '#222520';
    diffCtx.fillRect(0, 0, corner, corner);
    diffCtx.fillRect(size - corner, 0, corner, corner);
    diffCtx.fillRect(0, size - corner, corner, corner);
    diffCtx.fillRect(size - corner, size - corner, corner, corner);

    bumpCtx.fillStyle = '#d0d0d0';
    bumpCtx.fillRect(0, 0, corner, corner);
    bumpCtx.fillRect(size - corner, 0, corner, corner);
    bumpCtx.fillRect(0, size - corner, corner, corner);
    bumpCtx.fillRect(size - corner, size - corner, corner, corner);

    // Rebites de fixação
    diffCtx.fillStyle = '#7a8072';
    const rivets = [
      [15, 15], [35, 15], [15, 35],
      [size - 15, 15], [size - 35, 15], [size - 15, 35],
      [15, size - 15], [35, size - 15], [15, size - 35],
      [size - 15, size - 15], [size - 35, size - 15], [size - 15, size - 35]
    ];
    for (const [rx, ry] of rivets) {
      diffCtx.beginPath();
      diffCtx.arc(rx, ry, 3.5, 0, Math.PI * 2);
      diffCtx.fill();
    }

    // Estêncil militar amarelo
    diffCtx.save();
    diffCtx.fillStyle = 'rgba(235, 195, 60, 0.85)';
    diffCtx.font = 'bold 30px monospace';
    diffCtx.textAlign = 'center';
    diffCtx.fillText("AMMO 7.62x39mm", size * 0.5, size * 0.44);
    diffCtx.font = 'bold 20px monospace';
    diffCtx.fillText("MIL-SPEC #04-D", size * 0.5, size * 0.60);

    // Losango de alerta / perigo
    diffCtx.strokeStyle = 'rgba(235, 195, 60, 0.85)';
    diffCtx.lineWidth = 3;
    diffCtx.beginPath();
    diffCtx.moveTo(size * 0.5, size * 0.70);
    diffCtx.lineTo(size * 0.55, size * 0.77);
    diffCtx.lineTo(size * 0.5, size * 0.84);
    diffCtx.lineTo(size * 0.45, size * 0.77);
    diffCtx.closePath();
    diffCtx.stroke();
    diffCtx.restore();

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 22. BARRIL DE ÓLEO INDUSTRIAL / INFLAMÁVEL (Oil Drum Barrel)
  // =========================================================================
  createOilBarrel(size = 512, color = '#2d5a6e') {
    const cacheKey = `oil_barrel_${color}_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = color;
    diffCtx.fillRect(0, 0, size, size);

    // Costelas / anéis de reforço prensados no aço
    const ribs = [size * 0.3, size * 0.7];
    for (const ry of ribs) {
      diffCtx.fillStyle = '#1c3440';
      diffCtx.fillRect(0, ry - 8, size, 16);
      diffCtx.fillStyle = '#5c8a9e';
      diffCtx.fillRect(0, ry - 3, size, 4); // Brilho no topo do vinco

      bumpCtx.fillStyle = '#ffffff';
      bumpCtx.fillRect(0, ry - 8, size, 16);
    }

    // Marcações de desgaste / ferrugem
    const img = diffCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      const rust = TextureGenerator.fbm(px * 0.05, py * 0.05, 3);
      if (rust > 0.65) {
        img.data[i] = 160;     // ferrugem alaranjada
        img.data[i + 1] = 85;
        img.data[i + 2] = 40;
      }
    }
    diffCtx.putImageData(img, 0, 0);

    // Símbolo de inflamável (Losango vermelho com chama)
    diffCtx.save();
    const lx = size * 0.5, ly = size * 0.5;
    diffCtx.fillStyle = '#d63027';
    diffCtx.beginPath();
    diffCtx.moveTo(lx, ly - 35);
    diffCtx.lineTo(lx + 35, ly);
    diffCtx.lineTo(lx, ly + 35);
    diffCtx.lineTo(lx - 35, ly);
    diffCtx.closePath();
    diffCtx.fill();
    diffCtx.strokeStyle = '#ffffff';
    diffCtx.lineWidth = 2.5;
    diffCtx.stroke();

    diffCtx.fillStyle = '#ffffff';
    diffCtx.font = 'bold 16px sans-serif';
    diffCtx.textAlign = 'center';
    diffCtx.fillText("FLAMMABLE", lx, ly + 8);
    diffCtx.restore();

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 25. SOLO DE SELVA TROPICAL (Damp Jungle Humus Floor with Leaves & Roots)
  // =========================================================================
  createJungleFloor(size = 512) {
    const cacheKey = `jungle_floor_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: roughCanvas, ctx: roughCtx } = TextureGenerator.createCanvas(size, size);

    // Fundo de terra úmida rica e húmus
    diffCtx.fillStyle = '#2d2216';
    diffCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);
    const roughImg = roughCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Variação orgânica de solo úmido vs musgo superficial
        const soilNoise = TextureGenerator.fbm(x * 0.012, y * 0.012, 3);
        const mossNoise = TextureGenerator.fbm(x * 0.025 + 30, y * 0.025 + 30, 3);
        const microGrain = (TextureGenerator.pseudoRandom(x, y) - 0.5) * 18;

        let rVal = Math.floor(45 + soilNoise * 26 + microGrain);
        let gVal = Math.floor(34 + soilNoise * 20 + microGrain * 0.8);
        let bVal = Math.floor(22 + soilNoise * 14 + microGrain * 0.6);

        // Manchas de musgo verde no chão
        if (mossNoise > 0.58) {
          const mossBlend = Math.min(1.0, (mossNoise - 0.58) * 3.5);
          rVal = Math.floor(rVal * (1 - mossBlend) + 42 * mossBlend);
          gVal = Math.floor(gVal * (1 - mossBlend) + 72 * mossBlend);
          bVal = Math.floor(bVal * (1 - mossBlend) + 26 * mossBlend);
        }

        diffImg.data[idx] = Math.max(0, Math.min(255, rVal));
        diffImg.data[idx + 1] = Math.max(0, Math.min(255, gVal));
        diffImg.data[idx + 2] = Math.max(0, Math.min(255, bVal));

        const baseBump = Math.floor(100 + soilNoise * 55 + (mossNoise > 0.58 ? 35 : 0));
        bumpImg.data[idx] = Math.max(0, Math.min(255, baseBump));
        bumpImg.data[idx + 1] = Math.max(0, Math.min(255, baseBump));
        bumpImg.data[idx + 2] = Math.max(0, Math.min(255, baseBump));

        // Aspereza alta no solo, ligeiro brilho na lama
        const roughVal = Math.floor(220 - soilNoise * 40);
        roughImg.data[idx] = roughVal;
        roughImg.data[idx + 1] = roughVal;
        roughImg.data[idx + 2] = roughVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);
    roughCtx.putImageData(roughImg, 0, 0);

    // Folhas tropicais caídas em decomposição
    const leafColors = ['#4a5a2a', '#6a4e28', '#8a6230', '#3b4c22', '#2f3e1a'];
    const numLeaves = 75;
    for (let i = 0; i < numLeaves; i++) {
      const lx = TextureGenerator.pseudoRandom(i * 13, 1) * size;
      const ly = TextureGenerator.pseudoRandom(i * 17, 2) * size;
      const lLen = 12 + TextureGenerator.pseudoRandom(i * 19, 3) * 16;
      const lWid = lLen * 0.45;
      const lRot = TextureGenerator.pseudoRandom(i * 23, 4) * Math.PI;
      const color = leafColors[Math.floor(TextureGenerator.pseudoRandom(i * 29, 5) * leafColors.length)];

      diffCtx.save();
      diffCtx.translate(lx, ly);
      diffCtx.rotate(lRot);
      diffCtx.fillStyle = color;
      diffCtx.beginPath();
      diffCtx.ellipse(0, 0, lLen * 0.5, lWid * 0.5, 0, 0, Math.PI * 2);
      diffCtx.fill();
      // Nervura central da folha
      diffCtx.strokeStyle = 'rgba(20, 20, 15, 0.45)';
      diffCtx.lineWidth = 1.0;
      diffCtx.beginPath();
      diffCtx.moveTo(-lLen * 0.45, 0);
      diffCtx.lineTo(lLen * 0.45, 0);
      diffCtx.stroke();
      diffCtx.restore();

      bumpCtx.save();
      bumpCtx.translate(lx, ly);
      bumpCtx.rotate(lRot);
      bumpCtx.fillStyle = '#b0b0b0';
      bumpCtx.beginPath();
      bumpCtx.ellipse(0, 0, lLen * 0.5, lWid * 0.5, 0, 0, Math.PI * 2);
      bumpCtx.fill();
      bumpCtx.restore();
    }

    // Raízes sinuosas superficiais
    const numRoots = 7;
    for (let i = 0; i < numRoots; i++) {
      const rx = TextureGenerator.pseudoRandom(i * 31, 7) * size;
      const ry = TextureGenerator.pseudoRandom(i * 37, 8) * size;
      const rootLength = 120 + TextureGenerator.pseudoRandom(i * 41, 9) * 140;
      const rootAngle = TextureGenerator.pseudoRandom(i * 43, 10) * Math.PI * 2;
      const rootThickness = 4.5 + TextureGenerator.pseudoRandom(i * 47, 11) * 4.0;

      diffCtx.strokeStyle = '#3d2b1b';
      diffCtx.lineWidth = rootThickness;
      diffCtx.lineCap = 'round';
      diffCtx.beginPath();
      diffCtx.moveTo(rx, ry);
      let cx = rx;
      let cy = ry;
      const segments = 6;
      for (let s = 1; s <= segments; s++) {
        const segDist = rootLength / segments;
        const wiggle = (TextureGenerator.pseudoRandom(i * 53 + s, 12) - 0.5) * 35;
        cx += Math.cos(rootAngle) * segDist - Math.sin(rootAngle) * wiggle;
        cy += Math.sin(rootAngle) * segDist + Math.cos(rootAngle) * wiggle;
        diffCtx.lineTo(cx, cy);
      }
      diffCtx.stroke();

      bumpCtx.strokeStyle = '#e0e0e0';
      bumpCtx.lineWidth = rootThickness + 1.5;
      bumpCtx.lineCap = 'round';
      bumpCtx.beginPath();
      bumpCtx.moveTo(rx, ry);
      cx = rx; cy = ry;
      for (let s = 1; s <= segments; s++) {
        const segDist = rootLength / segments;
        const wiggle = (TextureGenerator.pseudoRandom(i * 53 + s, 12) - 0.5) * 35;
        cx += Math.cos(rootAngle) * segDist - Math.sin(rootAngle) * wiggle;
        cy += Math.sin(rootAngle) * segDist + Math.cos(rootAngle) * wiggle;
        bumpCtx.lineTo(cx, cy);
      }
      bumpCtx.stroke();
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
      roughness: TextureGenerator.toTexture(roughCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 26. ROCHA COBERTA DE MUSGO (Mossy Granite / Volcanic Jungle Rock)
  // =========================================================================
  createMossyRock(size = 512) {
    const cacheKey = `mossy_rock_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#424547';
    diffCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Relevo rochoso com FBM
        const rockHeight = TextureGenerator.fbm(x * 0.015, y * 0.015, 4);
        const mossPatch = TextureGenerator.fbm(x * 0.02 + 80, y * 0.02 + 80, 3);
        const microGrain = (TextureGenerator.pseudoRandom(x, y) - 0.5) * 22;

        let rVal = Math.floor(65 + rockHeight * 40 + microGrain);
        let gVal = Math.floor(68 + rockHeight * 40 + microGrain);
        let bVal = Math.floor(70 + rockHeight * 42 + microGrain);
        let bumpVal = Math.floor(100 + rockHeight * 80);

        // Musgo e líquen verde nas fendas e saliências
        if (mossPatch > 0.48) {
          const mossStrength = Math.min(1.0, (mossPatch - 0.48) * 3.0);
          rVal = Math.floor(rVal * (1 - mossStrength) + (45 + microGrain * 0.5) * mossStrength);
          gVal = Math.floor(gVal * (1 - mossStrength) + (95 + microGrain * 0.8) * mossStrength);
          bVal = Math.floor(bVal * (1 - mossStrength) + (35 + microGrain * 0.3) * mossStrength);
          bumpVal = Math.min(255, bumpVal + Math.floor(mossStrength * 45));
        }

        diffImg.data[idx] = Math.max(0, Math.min(255, rVal));
        diffImg.data[idx + 1] = Math.max(0, Math.min(255, gVal));
        diffImg.data[idx + 2] = Math.max(0, Math.min(255, bVal));

        bumpImg.data[idx] = Math.max(0, Math.min(255, bumpVal));
        bumpImg.data[idx + 1] = Math.max(0, Math.min(255, bumpVal));
        bumpImg.data[idx + 2] = Math.max(0, Math.min(255, bumpVal));
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 27. CASCA DE ÁRVORE TROPICAL GIGANTE (Giant Jungle Tree Bark with Moss)
  // =========================================================================
  createJungleBark(size = 512) {
    const cacheKey = `jungle_bark_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#322317';
    diffCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;

        // Fissuras verticais profundas esticadas ao longo do tronco
        const vertFissure = TextureGenerator.fbm(x * 0.05, y * 0.006, 4);
        const mossDust = TextureGenerator.fbm(x * 0.02 + 45, y * 0.02 + 45, 3);
        const microGrain = (TextureGenerator.pseudoRandom(x, y) - 0.5) * 16;

        let rVal = Math.floor(52 + vertFissure * 42 + microGrain);
        let gVal = Math.floor(38 + vertFissure * 32 + microGrain * 0.8);
        let bVal = Math.floor(25 + vertFissure * 22 + microGrain * 0.6);
        let bumpVal = Math.floor(70 + vertFissure * 125);

        // Manchas verdes de musgo crescendo na umidade das fendas
        if (mossDust > 0.62) {
          const mossBlend = Math.min(1.0, (mossDust - 0.62) * 4.0);
          rVal = Math.floor(rVal * (1 - mossBlend) + 40 * mossBlend);
          gVal = Math.floor(gVal * (1 - mossBlend) + 78 * mossBlend);
          bVal = Math.floor(bVal * (1 - mossBlend) + 30 * mossBlend);
        }

        diffImg.data[idx] = Math.max(0, Math.min(255, rVal));
        diffImg.data[idx + 1] = Math.max(0, Math.min(255, gVal));
        diffImg.data[idx + 2] = Math.max(0, Math.min(255, bVal));

        bumpImg.data[idx] = Math.max(0, Math.min(255, bumpVal));
        bumpImg.data[idx + 1] = Math.max(0, Math.min(255, bumpVal));
        bumpImg.data[idx + 2] = Math.max(0, Math.min(255, bumpVal));
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 28. FOLHAGEM DE SAMAMBAIA TROPICAL COM ALFA (Jungle Fern Foliage)
  // =========================================================================
  createJungleFern(size = 512) {
    const cacheKey = `jungle_fern_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas, ctx } = TextureGenerator.createCanvas(size, size);
    ctx.clearRect(0, 0, size, size);

    // Haste central da samambaia
    const centerX = size * 0.5;
    const stemGrad = ctx.createLinearGradient(centerX, size, centerX, 30);
    stemGrad.addColorStop(0, '#3a521e');
    stemGrad.addColorStop(1, '#658a32');
    ctx.strokeStyle = stemGrad;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, size - 15);
    ctx.quadraticCurveTo(centerX + 15, size * 0.5, centerX, 30);
    ctx.stroke();

    // Folíolos laterais serrados da samambaia
    const numPairs = 18;
    for (let i = 0; i < numPairs; i++) {
      const t = i / numPairs;
      const yPos = (size - 40) - t * (size - 80);
      const span = Math.sin(t * Math.PI) * (size * 0.44); // Mais largo no meio

      const fGrad = ctx.createLinearGradient(centerX - span, yPos, centerX + span, yPos);
      fGrad.addColorStop(0, '#2b4418');
      fGrad.addColorStop(0.5, '#4f7827');
      fGrad.addColorStop(1, '#2b4418');
      ctx.fillStyle = fGrad;

      // Folíolo Esquerdo
      ctx.beginPath();
      ctx.moveTo(centerX, yPos);
      ctx.quadraticCurveTo(centerX - span * 0.6, yPos - 18, centerX - span, yPos - 8);
      ctx.quadraticCurveTo(centerX - span * 0.5, yPos + 10, centerX, yPos + 6);
      ctx.closePath();
      ctx.fill();

      // Folíolo Direito
      ctx.beginPath();
      ctx.moveTo(centerX, yPos);
      ctx.quadraticCurveTo(centerX + span * 0.6, yPos - 18, centerX + span, yPos - 8);
      ctx.quadraticCurveTo(centerX + span * 0.5, yPos + 10, centerX, yPos + 6);
      ctx.closePath();
      ctx.fill();
    }

    const tex = TextureGenerator.toTexture(canvas, true);
    const bundle = {
      diffuse: tex,
      alpha: tex,
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 29. COLMOS DE BAMBU SELVAGEM COM ANÉIS NODAIS (Wild Bamboo Grove)
  // =========================================================================
  createBambooTexture(size = 512) {
    const cacheKey = `bamboo_culms_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#67883a';
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // 4 canas de bambu verticais alinhadas lado a lado
    const stalks = 4;
    const stalkW = size / stalks;

    for (let s = 0; s < stalks; s++) {
      const sx = s * stalkW;
      const grad = diffCtx.createLinearGradient(sx, 0, sx + stalkW, 0);
      grad.addColorStop(0, '#4a6428');
      grad.addColorStop(0.3, '#7ea446');
      grad.addColorStop(0.7, '#8fb54e');
      grad.addColorStop(1, '#425a24');
      diffCtx.fillStyle = grad;
      diffCtx.fillRect(sx + 2, 0, stalkW - 4, size);

      // Fibras longitudinais finas
      for (let f = 0; f < 10; f++) {
        const fx = sx + 4 + f * (stalkW / 11);
        diffCtx.strokeStyle = 'rgba(40, 60, 20, 0.25)';
        diffCtx.lineWidth = 1;
        diffCtx.beginPath();
        diffCtx.moveTo(fx, 0);
        diffCtx.lineTo(fx, size);
        diffCtx.stroke();
      }

      // Anéis nodais horizontais (septos de bambu)
      const nodes = 5;
      const nodeStep = size / nodes;
      for (let n = 1; n < nodes; n++) {
        const ny = n * nodeStep;
        // Anel escuro de fissura
        diffCtx.fillStyle = '#33441a';
        diffCtx.fillRect(sx + 1, ny - 3, stalkW - 2, 6);
        // Saliência clara do nó
        diffCtx.fillStyle = '#a6c66b';
        diffCtx.fillRect(sx + 2, ny - 1, stalkW - 4, 3);

        // Bump dos nós protuberantes
        bumpCtx.fillStyle = '#ffffff';
        bumpCtx.fillRect(sx + 1, ny - 4, stalkW - 2, 8);
        bumpCtx.fillStyle = '#202020';
        bumpCtx.fillRect(sx + 1, ny - 1, stalkW - 2, 2);
      }
    }

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 30. LONA DE CAMUFLAGEM MILITAR DE SELVA (Jungle Tigerstripe / Camo Tarp)
  // =========================================================================
  createCamoTarp(size = 512) {
    const cacheKey = `camo_tarp_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    // Fundo verde oliva militar
    diffCtx.fillStyle = '#495738';
    diffCtx.fillRect(0, 0, size, size);

    // Manchas orgânicas fluidas de camuflagem (Marrom terra, Verde escuro floresta, Preto)
    const camoColors = ['#293b22', '#413222', '#1a1f16', '#596942'];
    for (let c = 0; c < camoColors.length; c++) {
      diffCtx.fillStyle = camoColors[c];
      const blobs = 14;
      for (let b = 0; b < blobs; b++) {
        const bx = TextureGenerator.pseudoRandom(c * 23 + b, 1) * size;
        const by = TextureGenerator.pseudoRandom(c * 29 + b, 2) * size;
        const bw = 50 + TextureGenerator.pseudoRandom(c * 31 + b, 3) * 110;
        const bh = 25 + TextureGenerator.pseudoRandom(c * 37 + b, 4) * 60;
        const rot = (TextureGenerator.pseudoRandom(c * 41 + b, 5) - 0.5) * 0.8;

        diffCtx.save();
        diffCtx.translate(bx, by);
        diffCtx.rotate(rot);
        diffCtx.beginPath();
        diffCtx.ellipse(0, 0, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2);
        diffCtx.fill();
        diffCtx.restore();
      }
    }

    // Trama de tecido de lona reforçada + Bump
    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const weave = ((x % 3 === 0) ^ (y % 3 === 0)) ? 14 : -14;
        diffImg.data[idx] = Math.max(0, Math.min(255, diffImg.data[idx] + weave));
        diffImg.data[idx + 1] = Math.max(0, Math.min(255, diffImg.data[idx + 1] + weave));
        diffImg.data[idx + 2] = Math.max(0, Math.min(255, diffImg.data[idx + 2] + weave));

        const bVal = Math.floor(128 + weave * 2.5);
        bumpImg.data[idx] = bVal;
        bumpImg.data[idx + 1] = bVal;
        bumpImg.data[idx + 2] = bVal;
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 31. SACOS DE AREIA MILITARES / BUNKERS (Burlap Sandbag Fortification)
  // =========================================================================
  createSandbags(size = 512) {
    const cacheKey = `sandbags_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#423d2e'; // Frestas entre sacos
    diffCtx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#202020';
    bumpCtx.fillRect(0, 0, size, size);

    const rows = 6;
    const cols = 4;
    const bagW = size / cols;
    const bagH = size / rows;
    const margin = 4;

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 1) ? bagW * 0.5 : 0;
      for (let c = -1; c < cols + 1; c++) {
        const bx = c * bagW + offsetX + margin;
        const by = r * bagH + margin;
        const bw = bagW - margin * 2;
        const bh = bagH - margin * 2;

        const seed = r * 37 + c * 19;
        const tone = 0.9 + TextureGenerator.pseudoRandom(seed, 1) * 0.22;
        const rVal = Math.floor(142 * tone);
        const gVal = Math.floor(128 * tone);
        const bVal = Math.floor(98 * tone);

        // Curvatura convexa do saco de areia
        const grad = diffCtx.createRadialGradient(bx + bw * 0.5, by + bh * 0.5, 5, bx + bw * 0.5, by + bh * 0.5, bw * 0.6);
        grad.addColorStop(0, `rgb(${rVal + 20}, ${gVal + 18}, ${bVal + 15})`);
        grad.addColorStop(0.8, `rgb(${rVal}, ${gVal}, ${bVal})`);
        grad.addColorStop(1, `rgb(${rVal - 30}, ${gVal - 30}, ${bVal - 25})`);
        diffCtx.fillStyle = grad;
        diffCtx.beginPath();
        diffCtx.roundRect(bx, by, bw, bh, 8);
        diffCtx.fill();

        // Bump abaulado do saco
        const bGrad = bumpCtx.createRadialGradient(bx + bw * 0.5, by + bh * 0.5, 4, bx + bw * 0.5, by + bh * 0.5, bw * 0.6);
        bGrad.addColorStop(0, '#f0f0f0');
        bGrad.addColorStop(0.8, '#a0a0a0');
        bGrad.addColorStop(1, '#303030');
        bumpCtx.fillStyle = bGrad;
        bumpCtx.beginPath();
        bumpCtx.roundRect(bx, by, bw, bh, 8);
        bumpCtx.fill();
      }
    }

    // Trama áspera de juta / aniagem
    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < diffImg.data.length; i += 4) {
      const px = (i / 4) % size;
      const py = Math.floor((i / 4) / size);
      const juteWeave = ((px % 4 < 2) ^ (py % 4 < 2)) ? 16 : -16;
      diffImg.data[i] = Math.max(0, Math.min(255, diffImg.data[i] + juteWeave));
      diffImg.data[i + 1] = Math.max(0, Math.min(255, diffImg.data[i + 1] + juteWeave));
      diffImg.data[i + 2] = Math.max(0, Math.min(255, diffImg.data[i + 2] + juteWeave));

      bumpImg.data[i] = Math.max(0, Math.min(255, bumpImg.data[i] + juteWeave * 0.6));
      bumpImg.data[i + 1] = bumpImg.data[i];
      bumpImg.data[i + 2] = bumpImg.data[i];
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // 32. TELHA DE ZINCO ONDULADO COM FERRUGEM (Corrugated Rusted Metal)
  // =========================================================================
  createCorrugatedIron(size = 512) {
    const cacheKey = `corrugated_iron_${size}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

    const { canvas: diffCanvas, ctx: diffCtx } = TextureGenerator.createCanvas(size, size);
    const { canvas: bumpCanvas, ctx: bumpCtx } = TextureGenerator.createCanvas(size, size);

    diffCtx.fillStyle = '#838a90';
    diffCtx.fillRect(0, 0, size, size);

    const diffImg = diffCtx.getImageData(0, 0, size, size);
    const bumpImg = bumpCtx.getImageData(0, 0, size, size);

    const waves = 16;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const wave = Math.sin((x / size) * waves * Math.PI * 2);
        const rust = TextureGenerator.fbm(x * 0.03, y * 0.03, 3);

        let rVal = Math.floor(130 + wave * 45);
        let gVal = Math.floor(136 + wave * 45);
        let bVal = Math.floor(142 + wave * 45);

        // Manchas de ferrugem tropical alaranjada
        if (rust > 0.60) {
          const rustBlend = Math.min(1.0, (rust - 0.60) * 3.5);
          rVal = Math.floor(rVal * (1 - rustBlend) + 165 * rustBlend);
          gVal = Math.floor(gVal * (1 - rustBlend) + 75 * rustBlend);
          bVal = Math.floor(bVal * (1 - rustBlend) + 35 * rustBlend);
        }

        diffImg.data[idx] = Math.max(0, Math.min(255, rVal));
        diffImg.data[idx + 1] = Math.max(0, Math.min(255, gVal));
        diffImg.data[idx + 2] = Math.max(0, Math.min(255, bVal));

        const bumpVal = Math.floor(128 + wave * 95);
        bumpImg.data[idx] = Math.max(0, Math.min(255, bumpVal));
        bumpImg.data[idx + 1] = Math.max(0, Math.min(255, bumpVal));
        bumpImg.data[idx + 2] = Math.max(0, Math.min(255, bumpVal));
      }
    }
    diffCtx.putImageData(diffImg, 0, 0);
    bumpCtx.putImageData(bumpImg, 0, 0);

    const bundle = {
      diffuse: TextureGenerator.toTexture(diffCanvas, true),
      bump: TextureGenerator.toTexture(bumpCanvas, false),
    };
    this._cache.set(cacheKey, bundle);
    return bundle;
  }

  // =========================================================================
  // CARREGADOR DE TEXTURAS DE IMAGEM EXTERNA (PNG / JPG / BITMAP)
  // =========================================================================
  /**
   * Carrega uma imagem de URL ou Blob e retorna uma THREE.Texture pronta
   */
  loadFromURL(url, isSRGB = true) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          if (isSRGB) texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = true;
          resolve(texture);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Carrega imagem diretamente de um File/Blob (ex: upload pelo usuário)
   */
  loadFromFile(file, isSRGB = true) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loadFromURL(e.target.result, isSRGB).then(resolve).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Instância singleton global para reuso eficiente
export const textures = new TextureGenerator();
