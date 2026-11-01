/**
 * ============================================================================
 *   SCOPE SYSTEM â€” Lente TelescÃ³pica com Segunda CÃ¢mera (Arquivo 1 Literal)
 * ============================================================================
 * CÃ³digo literal e integral do algoritmo do Arquivo 1:
 * - RenderTarget quadrado (1024x1024) para a scopeCamera
 * - ShaderMaterial com distorÃ§Ã£o de barril, aberraÃ§Ã£o cromÃ¡tica e vinheta
 * - Mesh de CircleGeometry mapeado na overlayScene ortogrÃ¡fica 2D
 * - MÃ¡scara circular perfeita com setScissor delimitado ao quadrado da lente
 * - RetÃ­culo em SVG (Duplex + Ticks + Ponto Central Vermelho)
 * - Sensibilidade trigonomÃ©trica e scroll de zoom
 * ============================================================================
 */

import * as THREE from 'three';
import { on } from '../core/EventBus.js';

// ── Vetores estáticos reutilizáveis (Zero-Allocation no loop) ─────────────────
// Declarados no escopo do módulo para evitar alocação de memória dentro do loop
// de renderização, eliminando pressão no Garbage Collector (GC pauses de 50-100ms).
const _vRear   = new THREE.Vector3();
const _vFront  = new THREE.Vector3();
const _dir     = new THREE.Vector3();
const _vUp     = new THREE.Vector3();
const _target  = new THREE.Vector3();
const _vCam    = new THREE.Vector3();
const _qShake  = new THREE.Quaternion();
const _euler   = new THREE.Euler();

/* =====================================================================
 *  CONFIGURAÃ‡ÃƒO DO ARQUIVO 1
 * ===================================================================== */
export const SCOPE_CONFIG = {
  NORMAL_FOV: 75,
  ADS_FOV: 60,
  SCOPE_FOV: 10,
  SCOPE_FOV_MIN: 2,
  SCOPE_FOV_MAX: 30,
  LENS_SIZE: 0.45,
  SCOPE_RT_SIZE: 512, // Otimizado de 1024 para 512 (75% menos fillrate/pixels processados na GPU com nitidez idÃªntica)
  ADS_SPEED: 12
};

export const rad = d => d * Math.PI / 180;

export class ScopeSystem {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    this.scopeFov = SCOPE_CONFIG.SCOPE_FOV;
    this.adsT = 0;
    this.scopeOn = false;

    // â”€â”€ CÃ‚MERA 2: scope (mesma cena, mesma posiÃ§Ã£o/orientaÃ§Ã£o, FOV bem menor)
    // aspect = 1 porque a lente Ã© um cÃ­rculo (textura quadrada).
    // far ajustado para 150m (culling otimizado; fog do mapa corta aos 110m)
    this.scopeCamera = new THREE.PerspectiveCamera(this.scopeFov, 1, 0.1, 115);

    /* ---------------------------------------------------------------------
     *  Render target: a scopeCamera desenha AQUI (textura quadrada offscreen),
     *  e depois essa textura Ã© colada num disco 2D no centro da tela.
     *  Isso resolve o problema de setScissor() ser sempre retangular: com a
     *  textura mapeada num CircleGeometry, a mÃ¡scara circular Ã© perfeita.
     * ------------------------------------------------------------------- */
    this.scopeRT = new THREE.WebGLRenderTarget(SCOPE_CONFIG.SCOPE_RT_SIZE, SCOPE_CONFIG.SCOPE_RT_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    /* ---------------------------------------------------------------------
     *  Cena de composiÃ§Ã£o (overlay 2D em pixels): um disco com a textura da
     *  scopeCamera + shader com vinheta, leve distorÃ§Ã£o de lente e aberraÃ§Ã£o
     *  cromÃ¡tica. CÃ¢mera ortogrÃ¡fica com 1 unidade = 1 pixel CSS.
     * ------------------------------------------------------------------- */
    this.overlayScene = new THREE.Scene();
    this.overlayCam = new THREE.OrthographicCamera(
      -innerWidth / 2, innerWidth / 2,
      innerHeight / 2, -innerHeight / 2,
      -10, 10
    );

    this.lensMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tMap:             { value: this.scopeRT.texture },
        uOpacity:         { value: 1 },
        uParallax:        { value: new THREE.Vector2(0, 0) },
        uInnerRingRadius: { value: 0.95 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;   // CircleGeometry gera UVs que mapeiam o cÃ­rculo dentro do quadrado 0..1
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMap;
        uniform float uOpacity;
        uniform vec2 uParallax;
        uniform float uInnerRingRadius;
        varying vec2 vUv;
        void main() {
          vec2  p = vUv - 0.5;
          float r = length(p) * 2.0;               // Raio na Lente Traseira (0 a 1)
          
          vec2 pFront = p - uParallax;
          float rFront = length(pFront) * 2.0;     // Raio na Lente Dianteira (0 a 1)
          
          // A imagem da cÃƒÂ¢mera vem alinhada com o cano (frontLens)
          // EntÃƒÂ£o adicionamos uma levÃƒÂ­ssima distorÃƒÂ§ÃƒÂ£o de lente baseada na lente traseira (p)
          vec2 uv = 0.5 + p * (1.0 - 0.10 * r * r);
          vec2 ca = p * 0.006 * r * r;
          
          vec3 col;
          col.r = texture2D(tMap, uv + ca).r;
          col.g = texture2D(tMap, uv).g;
          col.b = texture2D(tMap, uv - ca).b;
          
          // Ganho de 20% de luminosidade / clareza na imagem da lente
          col *= 1.20;

          // Anel Interno (A parede do tubo que varia dinamicamente com o zoom)
          // Se o raio na lente dianteira passar de uInnerRingRadius, comeÃ§a a parede interna do cilindro
          float isWall = smoothstep(uInnerRingRadius, uInnerRingRadius + 0.035, rFront);
          
          // IluminaÃ§Ã£o da parede interna baseada na direÃ§Ã£o (fake 3D shading do tubo)
          float wallShade = 0.45 + 0.55 * dot(normalize(pFront + vec2(0.001)), vec2(0.0, 1.0));
          vec3 wallColor = vec3(0.012, 0.014, 0.018) * wallShade;
          
          // Mistura a imagem da lente com a parede interna
          col = mix(col, wallColor, isWall);
          
          // Borda externa sÃ³lida e opaca (corte nÃ­tido e limpo com anti-aliasing de 1px, sem transparÃªncia esfumaÃ§ada)
          float alpha = uOpacity * (1.0 - smoothstep(0.995, 1.0, r));
          
          gl_FragColor = vec4(col, alpha);
        }`,
    });

    // Disco de raio 1: a escala do mesh (em pixels) define o raio real da lente.
    // 36 segmentos mantÃªm a curvatura da lente perfeitamente suave enquanto poupa vÃ©rtices da GPU
    this.lensMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 36), this.lensMat);
    this.overlayScene.add(this.lensMesh);

    // Elementos da interface DOM
    this.lensEl = document.getElementById('lens');
    this.scopeHudEl = document.getElementById('scopeHud');
    this.zoomTextEl = document.getElementById('scope-zoom-text');
    this.fovTextEl = document.getElementById('scope-fov-text');
    this.dotEl = document.getElementById('crosshair');
    this.zoomBtnTouch = document.getElementById('btn-touch-zoom');

    // VariÃ¡veis de oscilaÃ§Ã£o orgÃ¢nica (Scope Sway / RespiraÃ§Ã£o)
    this.swayTime = 0;
    this.swayPitch = 0;
    this.swayYaw = 0;

    // InÃ©rcia de movimento do mouse (Mouse Look Inertia) para paralaxe realista
    this.prevYaw = 0;
    this.prevPitch = 0;
    this.hasPrevLook = false;
    this.lookInertia = new THREE.Vector2(0, 0);

    // Inicializa RetÃ­culo SVG literal do Arquivo 1
    this.buildReticle();

    // Tremor interno cinÃ©tico exclusivo da Ã³tica (Scope Concussion / Recoil Shockwave)
    this.opticShake = 0;
    this.mainCameraRef = null;

    this._onResize = () => this.onResize();
    window.addEventListener('resize', this._onResize);

    this._onWheel = e => {
      if (!this.adsTarget) return;
      e.preventDefault();
      this.scopeFov *= (e.deltaY < 0) ? 0.9 : 1 / 0.9;
      this.scopeFov = Math.max(SCOPE_CONFIG.SCOPE_FOV_MIN, Math.min(SCOPE_CONFIG.SCOPE_FOV_MAX, this.scopeFov));
    };
    window.addEventListener('wheel', this._onWheel, { passive: false });

    this._unsubFired = on('weapon:fired', e => {
      const wepId = e.weapon?.id || e.weaponId;
      if ((wepId === 'rifle_proto' || wepId === 'vss' || wepId === 'scar_h') && (this.adsTarget || this.scopeOn)) {
        this.addOpticShake(0.95);
      }
    });

    this._unsubZoomToggle = on('input:zoom-toggle', () => {
      if (!this.adsTarget) return;
      // Cycle zoom: se estiver perto do mÃ­nimo (max zoom), volta pro fov mÃ¡ximo, senÃ£o dÃ¡ step
      if (this.scopeFov <= SCOPE_CONFIG.SCOPE_FOV_MIN * 1.1) {
        this.scopeFov = SCOPE_CONFIG.SCOPE_FOV_MAX;
      } else {
        this.scopeFov *= 0.6; // step mais agressivo pra touch cycle
        this.scopeFov = Math.max(SCOPE_CONFIG.SCOPE_FOV_MIN, this.scopeFov);
      }
    });
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('wheel', this._onWheel);
    if (this._unsubFired) {
      this._unsubFired();
      this._unsubFired = null;
    }
    if (this._unsubZoomToggle) {
      this._unsubZoomToggle();
      this._unsubZoomToggle = null;
    }

    if (this.scopeRT) {
      this.scopeRT.dispose();
      this.scopeRT = null;
    }
    if (this.lensMesh) {
      this.lensMesh.geometry.dispose();
    }
    if (this.lensMat) {
      this.lensMat.dispose();
    }
  }

  addOpticShake(amount = 0.95) {
    this.opticShake = Math.min(this.opticShake + amount, 1.8);
  }

  buildReticle(type = 'acss') {
    const el = document.getElementById('reticle');
    if (!el) return;

    if (type === 'acss') {
      const red = '#ff1a24';
      const black = '#111315';
      const L = (x1, y1, x2, y2, w, color = black) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="butt"/>`;
      const C = (cx, cy, r, color = black) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`;
      const T = (x, y, text, color = black, size = 2.4) =>
        `<text x="${x}" y="${y}" font-family="monospace, sans-serif" font-weight="bold" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="central">${text}</text>`;

      let s = '';

      // 1. Red Horseshoe (ferradura tÃ¡tica vermelha iluminada aberta embaixo)
      // Raio 5.4, aberta na parte inferior (~70 graus)
      s += `<path d="M -3.8 3.8 A 5.4 5.4 0 1 1 3.8 3.8" fill="none" stroke="${red}" stroke-width="1.35" stroke-linecap="butt"/>`;

      // 2. Red Chevron central (Ã¡pice exatamente em 0,0)
      s += `<path d="M -1.8 2.0 L 0 0 L 1.8 2.0" fill="none" stroke="${red}" stroke-width="0.8" stroke-linejoin="miter" stroke-linecap="butt"/>`;
      // TraÃ§o vertical central vermelho logo abaixo do chevron
      s += L(0, 2.7, 0, 4.4, 0.65, red);

      // 3. Walking Speed Leads Bracket (3.1 avg walking speed em volta da ferradura)
      s += `<path d="M -5.8 4.2 L -5.8 -6.8 L 5.8 -6.8 L 5.8 4.2" fill="none" stroke="${black}" stroke-width="0.32"/>`;

      // 4. Sprinting Leads (8.6mph avg target speed: 2 pontos laterais + bracket superior)
      s += C(-14.0, 0, 0.85, black);
      s += C(14.0, 0, 0.85, black);
      s += `<path d="M -14.0 -1.2 L -14.0 -10.8 L 14.0 -10.8 L 14.0 -1.2" fill="none" stroke="${black}" stroke-width="0.32"/>`;

      // 5. Ãrvore BalÃ­stica Vertical BDC (Bullet Drop Compensation)
      // Linha mestre vertical
      s += L(0, 4.4, 0, 36.0, 0.45, black);

      // Ticks horizontais de distÃ¢ncia + Wind hold dots (pontos de vento)
      // DistÃ¢ncia 3 (300m)
      s += L(-1.4, 7.2, 1.4, 7.2, 0.45, black);
      s += C(-3.2, 7.2, 0.4, black);
      s += C(3.2, 7.2, 0.4, black);

      // DistÃ¢ncia 4 (400m) - com nÃºmero '4' Ã  direita
      s += L(-2.2, 11.8, 2.2, 11.8, 0.55, black);
      s += T(3.8, 11.8, '4', black, 2.3);
      s += C(-4.8, 11.8, 0.42, black);
      s += C(6.2, 11.8, 0.42, black);

      // DistÃ¢ncia 5 (500m)
      s += L(-1.6, 17.0, 1.6, 17.0, 0.45, black);
      s += C(-6.2, 17.0, 0.42, black);
      s += C(6.2, 17.0, 0.42, black);

      // DistÃ¢ncia 6 (600m) - com nÃºmero '6' Ã  direita
      s += L(-2.6, 22.8, 2.6, 22.8, 0.55, black);
      s += T(4.4, 22.8, '6', black, 2.3);
      s += C(-7.8, 22.8, 0.45, black);
      s += C(7.2, 22.8, 0.45, black);

      // DistÃ¢ncia 7 (700m)
      s += L(-1.8, 29.0, 1.8, 29.0, 0.45, black);
      s += C(-9.4, 29.0, 0.45, black);
      s += C(9.4, 29.0, 0.45, black);

      // DistÃ¢ncia 8 (800m) - com nÃºmero '8' Ã  direita
      s += L(-3.2, 35.5, 3.2, 35.5, 0.6, black);
      s += T(5.2, 35.5, '8', black, 2.3);
      s += C(-11.2, 35.5, 0.48, black);
      s += C(8.4, 35.5, 0.48, black);

      // 6. TelÃªmetro EstadiamÃ©trico Ã  Direita (Stadiametric Rangefinder Ladder: 4, 6, 8)
      const rx = 19.5;
      s += L(rx, 11.8, rx, 35.5, 0.6, black);
      s += L(rx, 11.8, rx + 4.8, 11.8, 0.55, black);
      s += T(rx - 2.2, 11.8, '4', black, 2.1);
      s += L(rx, 17.0, rx + 3.6, 17.0, 0.45, black);
      s += L(rx, 22.8, rx + 2.8, 22.8, 0.5, black);
      s += T(rx - 2.2, 22.8, '6', black, 2.1);
      s += L(rx, 29.0, rx + 2.2, 29.0, 0.45, black);
      s += L(rx, 35.5, rx + 1.8, 35.5, 0.55, black);
      s += T(rx - 2.2, 35.5, '8', black, 2.1);
      s += L(rx, 35.5, rx + 4.8, 35.5, 0.55, black);

      el.innerHTML = s;
      return;
    }

    if (type === 'pso1') {
      const L = (x1, y1, x2, y2, w, color = '#ff3311') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}"/>`;
      let s = '';
      // Linhas mestras horizontais com intervalo central
      s += L(-45, 0, -10, 0, .85);
      s += L(10, 0, 45, 0, .85);
      // Barra vertical inferior
      s += L(0, 18, 0, 45, .85);
      
      // Chevrons tÃ¡ticos PSO-1 (topo ^ e marcas de queda balÃ­stica)
      const chevron = (cy, sz, color = '#ff2200') => {
        return `<path d="M ${-sz} ${cy + sz} L 0 ${cy} L ${sz} ${cy + sz}" fill="none" stroke="${color}" stroke-width="0.75" stroke-linejoin="miter"/>`;
      };
      s += chevron(0, 2.2, '#ff1a00');    // Chevron principal central
      s += chevron(5.5, 1.8, '#ff2a11');  // 200m
      s += chevron(11.0, 1.6, '#ff2a11'); // 300m
      s += chevron(16.5, 1.4, '#ff2a11'); // 400m

      // Escala estadiamÃ©trica / telÃªmetro balÃ­stico (quadrante inferior esquerdo)
      s += L(-34, 18, -12, 18, .55);
      s += `<path d="M -34 10 Q -24 12 -12 18" fill="none" stroke="#ff3311" stroke-width="0.55"/>`;
      s += L(-30, 18, -30, 11.2, .45);
      s += L(-24, 18, -24, 12.8, .45);
      s += L(-18, 18, -18, 15.0, .45);

      // Ponto de iluminaÃ§Ã£o central trÃ­tio / retÃ­culo russo iluminado
      s += '<circle cx="0" cy="0" r="0.4" fill="#ff1100" stroke="none"/>';
      el.innerHTML = s;
      return;
    }

    // RetÃ­culo Duplex PadrÃ£o
    const L = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}"/>`;
    let s = '';
    // Linhas grossas externas + finas internas (estilo duplex)
    s += L(-46, 0, -10, 0, .9) + L(10, 0, 46, 0, .9) + L(0, -46, 0, -10, .9) + L(0, 10, 0, 46, .9);
    s += L(-10, 0, -1.5, 0, .22) + L(1.5, 0, 10, 0, .22) + L(0, -10, 0, -1.5, .22) + L(0, 1.5, 0, 10, .22);
    // MarcaÃ§Ãµes de mira (ticks) ao longo dos eixos
    for (let t = 14; t <= 42; t += 7) {
      const l = (t % 14 === 0) ? 2.2 : 1.3;
      s += L(t, -l, t, l, .25) + L(-t, -l, -t, l, .25) + L(-l, t, l, t, .25) + L(-l, -t, l, -t, .25);
    }
    s += '<circle r=".45" fill="#ff2a2a" stroke="none"/>';   // ponto central vermelho
    el.innerHTML = s;
  }

  lensDiameter() {
    return Math.min(innerWidth, innerHeight) * SCOPE_CONFIG.LENS_SIZE;
  }

  attachWeaponModel(weaponId, details) {
    if (!details || !details.rearLens) return;
    this.models = this.models || {};
    this.models[weaponId] = details;
    if (details.rearLens.material) {
      details.rearLens.material.map = this.scopeRT.texture;
      details.rearLens.material.roughness = 0.08;
      details.rearLens.material.metalness = 0.2;
      details.rearLens.material.transmission = 0.0;
      details.rearLens.material.opacity = 1.0;
      details.rearLens.material.transparent = false;
      details.rearLens.material.needsUpdate = true;
    }
  }

  setActiveWeapon(weaponId) {
    if (this.activeWeaponId === weaponId) return;
    this.activeWeaponId = weaponId;
    this.activeDetails = this.models?.[weaponId] || null;
    this.protoDetails = this.activeDetails;
    this.baseDepth = null;
    this.buildReticle(weaponId === 'vss' ? 'pso1' : 'acss');
  }

  attachToModel(protoDetails) {
    this.protoDetails = protoDetails;
    this.attachWeaponModel('rifle_proto', protoDetails);
    this.setActiveWeapon('rifle_proto');
  }

  apparentZoom() {
    const k = Math.tan(rad(SCOPE_CONFIG.ADS_FOV) / 2) / Math.tan(rad(this.scopeFov) / 2);
    return k * this.lensDiameter() / innerHeight;
  }

  getSensitivityFactor() {
    if (this.adsT <= 0.001) return 1.0;
    const ratio = Math.tan(rad(this.scopeFov) / 2) / Math.tan(rad(SCOPE_CONFIG.ADS_FOV) / 2);
    return 1 + (Math.pow(ratio, 0.6) - 1) * this.adsT;
  }

  update(dt, mainCamera, isAdsActive, rig, viewmodel) {
    this.mainCameraRef = mainCamera;
    this.adsTarget = isAdsActive;

    // TransiÃ§Ã£o suave do ADS (exponencial, independente de FPS)
    const target = this.adsTarget ? 1 : 0;
    this.adsT += (target - this.adsT) * (1 - Math.exp(-dt * SCOPE_CONFIG.ADS_SPEED));
    if (Math.abs(target - this.adsT) < 0.001) this.adsT = target;

    // Decaimento responsivo do tremor de tiro interno da Ã³tica
    if (this.opticShake > 0.0001) {
      this.opticShake *= Math.max(0, 1 - dt * 9.0);
    } else {
      this.opticShake = 0;
    }

    // â”€â”€ InÃ©rcia de Movimento CinÃ©tico (Layer 4 â€” Paralaxe Passivo da CÃ¢mera) â”€â”€
    let lookSpeedX = 0;
    let lookSpeedY = 0;

    if (rig && rig.angularVelocity) {
      // LÃª passivamente a velocidade angular contÃ­nua da Layer 1/2 (jÃ¡ inclui inÃ©rcia e recuo!)
      lookSpeedX = rig.angularVelocity.y;
      lookSpeedY = rig.angularVelocity.x;
    } else {
      // Fallback legado se o rig nÃ£o for passado
      const currentYaw = mainCamera.rotation.y;
      const currentPitch = mainCamera.rotation.x;

      if (!this.hasPrevLook) {
        this.prevYaw = currentYaw;
        this.prevPitch = currentPitch;
        this.hasPrevLook = true;
      }

      let dYaw = currentYaw - this.prevYaw;
      let dPitch = currentPitch - this.prevPitch;

      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;

      this.prevYaw = currentYaw;
      this.prevPitch = currentPitch;

      if (dt > 0) {
        lookSpeedX = dYaw / dt;
        lookSpeedY = dPitch / dt;
      }
    }

    if (this.adsT > 0.05 && dt > 0) {
      // Ganho calibrado para sensaÃ§Ã£o de paralaxe cilÃ­ndrico realista (reduzido em 60% para estabilidade de mira)
      const inertiaGain = 0.034;
      const targetInertiaX = THREE.MathUtils.clamp(lookSpeedX * inertiaGain, -0.20, 0.20);
      const targetInertiaY = THREE.MathUtils.clamp(-lookSpeedY * inertiaGain, -0.20, 0.20);

      // Resposta Ã¡gil ao movimento da mÃ£o e retorno amortecido ao parar o mouse
      const speedX = Math.abs(targetInertiaX) > Math.abs(this.lookInertia.x) ? 26.0 : 14.0;
      const speedY = Math.abs(targetInertiaY) > Math.abs(this.lookInertia.y) ? 26.0 : 14.0;

      this.lookInertia.x += (targetInertiaX - this.lookInertia.x) * Math.min(dt * speedX, 1);
      this.lookInertia.y += (targetInertiaY - this.lookInertia.y) * Math.min(dt * speedY, 1);
    } else {
      this.lookInertia.set(0, 0);
    }

    // â”€â”€ Sway OrgÃ¢nico de RespiraÃ§Ã£o no Scope â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Quando em ADS, a respiraÃ§Ã£o produz leve oscilaÃ§Ã£o suave (reduzida em 60%)
    if (this.adsT > 0.1) {
      this.swayTime += dt * 1.4;
      const swayAmplitude = 0.00034 * this.adsT;
      this.swayYaw = Math.sin(this.swayTime) * swayAmplitude;
      this.swayPitch = Math.cos(this.swayTime * 2) * (swayAmplitude * 0.55);
    } else {
      this.swayYaw = 0;
      this.swayPitch = 0;
    }

    // CÃ¢mera do scope: OrientaÃ§Ã£o sincronizada com a principal + leve oscilaÃ§Ã£o orgÃ¢nica
    mainCamera.updateMatrixWorld();
    this.scopeCamera.position.copy(mainCamera.position);

    const details = this.activeDetails || this.protoDetails;
    if (details && details.rearLens && details.frontLens) {
      details.rearLens.getWorldPosition(_vRear);
      details.frontLens.getWorldPosition(_vFront);

      _dir.subVectors(_vFront, _vRear).normalize();

      _vUp.set(0, 1, 0);
      if (details.opticBody) {
        _vUp.transformDirection(details.opticBody.matrixWorld).normalize();
      }

      _target.copy(this.scopeCamera.position).add(_dir);
      this.scopeCamera.up.copy(_vUp);
      this.scopeCamera.lookAt(_target);
    } else {
      this.scopeCamera.quaternion.copy(mainCamera.quaternion);
      if (this.adsT > 0.1) {
        _euler.setFromQuaternion(this.scopeCamera.quaternion, 'YXZ');
        _euler.y += this.swayYaw;
        _euler.x += this.swayPitch;
        this.scopeCamera.quaternion.setFromEuler(_euler);
      }
    }

    this.scopeCamera.fov = this.scopeFov;
    this.scopeCamera.aspect = 1;
    this.scopeCamera.updateProjectionMatrix();

    // Estado do scope ativo: segundo passe da câmera só ativa quando a lente
    // estiver de fato no campo de visão (>= 0.55). Isso elimina o tranco no
    // clique de mirar (GC spike causado pelo segundo renderer.render() prematuro).
    this.scopeOn = this.adsT >= 0.55;

    // HUD Telemetria de Ã“tica posicionada harmonicamente no topo do HUD da arma
    if (this.scopeHudEl) {
      if (this.adsT > 0.45) {
        this.scopeHudEl.classList.add('show');
        if (this.zoomBtnTouch) this.zoomBtnTouch.style.display = 'flex';
        if (this.zoomTextEl) {
          this.zoomTextEl.textContent = `${this.apparentZoom().toFixed(1)}x`;
        }
        if (this.fovTextEl) {
          this.fovTextEl.textContent = `FOV ${this.scopeFov.toFixed(1)}Â°`;
        }
      } else {
        this.scopeHudEl.classList.remove('show');
        if (this.zoomBtnTouch) this.zoomBtnTouch.style.display = 'none';
      }
    }

    // TransiÃ§Ã£o de Eye Relief para shooter moderno:
    // O overlay 2D surge suavemente apenas na fase final de aproximaÃ§Ã£o (adsT > 0.65)
    // permitindo ver a arma subindo e a lente 3D se alinhando com o olho primeiro
    const eyeReliefThreshold = 0.65;
    const overlayProgress = Math.max(0, (this.adsT - eyeReliefThreshold) / (1 - eyeReliefThreshold));
    const smoothOverlay = Math.pow(overlayProgress, 1.8);

    if (this.lensEl) {
      this.lensEl.style.display = (overlayProgress > 0.01) ? 'block' : 'none';
      this.lensEl.style.opacity = smoothOverlay;
    }
  }

  renderScopePass(protoModel) {
    if (!this.scopeOn) return;

    if (this.mainCameraRef) {
      this.scopeCamera.position.copy(this.mainCameraRef.position);
    }

    // Atualiza orientaÃ§Ã£o da scopeCamera com as matrizes mais recentes antes do render
    const details = this.activeDetails || this.protoDetails;
    if (details && details.rearLens && details.frontLens) {
      details.rearLens.updateMatrixWorld(true);
      details.frontLens.updateMatrixWorld(true);
      
      details.rearLens.getWorldPosition(_vRear);
      details.frontLens.getWorldPosition(_vFront);

      _dir.subVectors(_vFront, _vRear).normalize();
      _vUp.set(0, 1, 0);
      if (details.opticBody) {
        _vUp.transformDirection(details.opticBody.matrixWorld).normalize();
      }

      _target.copy(this.scopeCamera.position).add(_dir);
      this.scopeCamera.up.copy(_vUp);
      this.scopeCamera.lookAt(_target);
    } else if (this.mainCameraRef) {
      this.scopeCamera.quaternion.copy(this.mainCameraRef.quaternion);
    }

    // â”€â”€ Tremor CinÃ©tico Exclusivo do Interior da Ã“tica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (this.opticShake > 0.001) {
      const t = performance.now() * 0.001;
      const shakePitch = (Math.sin(t * 68.0) * 0.010 + Math.cos(t * 110.0) * 0.005) * this.opticShake;
      const shakeYaw = (Math.cos(t * 82.0) * 0.008 + Math.sin(t * 125.0) * 0.004) * this.opticShake;
      const shakeRoll = (Math.sin(t * 54.0) * 0.009) * this.opticShake;

      _euler.set(shakePitch, shakeYaw, shakeRoll, 'YXZ');
      _qShake.setFromEuler(_euler);
      this.scopeCamera.quaternion.multiply(_qShake);

      this.scopeCamera.position.x += (Math.cos(t * 73.0) * 0.012) * this.opticShake;
      this.scopeCamera.position.y += (Math.sin(t * 91.0) * 0.012) * this.opticShake;
    }

    // â”€â”€ PASSADA 2: mesma cena, scopeCamera, dentro do render target (textura da lente)
    // Oculta a arma apenas para a scopeCamera nÃ£o enxergar o prÃ³prio cano Ã  frente
    if (protoModel) protoModel.visible = false;

    const prevShadows = this.renderer?.shadowMap ? this.renderer.shadowMap.enabled : false;
    if (this.renderer?.shadowMap) this.renderer.shadowMap.enabled = false;

    this.renderer.setRenderTarget(this.scopeRT);
    this.renderer.render(this.scene, this.scopeCamera);
    this.renderer.setRenderTarget(null);
    if (this.renderer?.shadowMap) this.renderer.shadowMap.enabled = prevShadows;

    if (protoModel) protoModel.visible = true;
  }

  render(mainCamera) {
    const w = innerWidth, h = innerHeight;

    if (!this.scopeOn) return;

    // TransiÃ§Ã£o de Eye-Relief da lente de composiÃ§Ã£o
    const eyeReliefThreshold = 0.65;
    const overlayProgress = Math.max(0, (this.adsT - eyeReliefThreshold) / (1 - eyeReliefThreshold));
    if (overlayProgress <= 0.001) return;

    const smoothOverlay = Math.pow(overlayProgress, 1.8);

    // â”€â”€ SINCRONIZAÃ‡ÃƒO MATEMÃTICA EXATA COM O RECUO E ORIENTAÃ‡ÃƒO DO RIFLE â”€â”€â”€â”€â”€â”€â”€â”€
    // ForÃ§a atualizaÃ§Ã£o mundial da cÃ¢mera e de toda a hierarquia de nÃ³s da arma
    const details = this.activeDetails || this.protoDetails;
    mainCamera.updateMatrixWorld(true);
    if (details?.rearLens) {
      details.rearLens.updateMatrixWorld(true);
    }
    if (details?.frontLens) {
      details.frontLens.updateMatrixWorld(true);
    }

    let offsetX = 0;
    let offsetY = 0;
    let rollAngle = 0;
    let depthScale = 1.0;

    if (details && details.rearLens) {
      const rearLens = details.rearLens;
      rearLens.getWorldPosition(_vCam);

      // DistÃ¢ncia frontal no eixo de visÃ£o da cÃ¢mera (-Z no espaÃ§o local da cÃ¢mera)
      // Mede com precisÃ£o matemÃ¡tica a aproximaÃ§Ã£o/afastamento da lente (profundidade fÃ­sica)
      _vCam.applyMatrix4(mainCamera.matrixWorldInverse);
      const depthZ = -_vCam.z;

      // Calibra a distÃ¢ncia base em repouso da ocular para sincronismo de escala 1:1 perfeito
      if (!this.baseDepth) {
        this.baseDepth = depthZ;
      } else if (this.adsT > 0.95 && (!details?.physics || details.physics.recoil < 0.005)) {
        this.baseDepth += (depthZ - this.baseDepth) * 0.05;
      }

      if (depthZ > 0.02) {
        const rawScale = this.baseDepth / depthZ;
        depthScale = Math.max(0.65, Math.min(2.5, rawScale));
      }

      // ProjeÃ§Ã£o do centro no plano da cÃ¢mera
      rearLens.getWorldPosition(_vRear);
      _vRear.project(mainCamera);
      offsetX = (_vRear.x * (w / 2));
      offsetY = (-_vRear.y * (h / 2));

      // Calcula o roll (torÃ§Ã£o/inclinaÃ§Ã£o) da carcaÃ§a da Ã³tica no plano de visÃ£o da tela
      if (details.opticBody) {
        _vUp.set(0, 1, 0);
        _vUp.transformDirection(details.opticBody.matrixWorld);
        _vUp.transformDirection(mainCamera.matrixWorldInverse);
        rollAngle = Math.atan2(_vUp.x, _vUp.y);
      }

      if (details.frontLens) {
        details.frontLens.getWorldPosition(_vFront);
        _vFront.project(mainCamera);
        this.pxShiftX = (_vFront.x * (w / 2)) - offsetX;
        this.pxShiftY = (-_vFront.y * (h / 2)) - offsetY;
      }
    }

    // Centro do disco na tela
    const centerX = (w / 2) + offsetX;
    const centerY = (h / 2) - offsetY; // InversÃ£o para o sistema de coordenadas WebGL (origem inferior-esquerda)

    // ExpansÃ£o tÃ¡tica do diÃ¢metro acompanhando a profundidade fÃ­sica real da arma
    const D = this.lensDiameter() * (0.68 + 0.32 * smoothOverlay) * depthScale;
    const R = D / 2;

    // Posiciona o disco 2D na overlayScene exatamente onde a ocular 3D estÃ¡ na tela com rotaÃ§Ã£o sincronizada
    this.lensMesh.position.set(offsetX, -offsetY, 0);
    this.lensMesh.rotation.z = -rollAngle;
    this.lensMesh.scale.set(R, R, 1);
    this.lensMat.uniforms.uOpacity.value = smoothOverlay;

    // â”€â”€ RAIO DINÃ‚MICO DO ANEL INTERNO COM BASE NO ZOOM (FOV) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const zoomFactor = (SCOPE_CONFIG.SCOPE_FOV_MAX - this.scopeFov) / (SCOPE_CONFIG.SCOPE_FOV_MAX - SCOPE_CONFIG.SCOPE_FOV_MIN);
    const innerRingRadius = THREE.MathUtils.lerp(0.84, 1.08, THREE.MathUtils.clamp(zoomFactor, 0, 1));
    this.lensMat.uniforms.uInnerRingRadius.value = innerRingRadius;

    // â”€â”€ PARALAXE COMBINADO: RECUO/BOBBING 3D + INÃ‰RCIA DO MOUSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let shiftX = 0;
    let shiftY = 0;
    if (D > 0 && this.pxShiftX !== undefined) {
      const pxMultiplier = 0.80; // ProporÃ§Ã£o calibrada de profundidade do tubo (reduzida em 60% para firmeza)
      shiftX = (this.pxShiftX / D) * pxMultiplier;
      shiftY = (-this.pxShiftY / D) * pxMultiplier;
    }

    // InÃ©rcia fluida do mouse para sensaÃ§Ã£o de peso e cilindro 3D realista
    shiftX += this.lookInertia.x;
    shiftY += this.lookInertia.y;

    // Impulso do tremor cinÃ©tico interno no paralaxe da lente
    if (this.opticShake > 0.001) {
      const t = performance.now() * 0.001;
      shiftX += Math.cos(t * 63.0) * 0.08 * this.opticShake;
      shiftY += Math.sin(t * 81.0) * 0.08 * this.opticShake;
    }

    this.lensMat.uniforms.uParallax.value.set(shiftX, shiftY);

    // setScissor acompanha o centro dinÃ¢mico da mira (coordenadas do scissor: x, y, width, height)
    const scissorX = Math.round(centerX - R - 2);
    const scissorY = Math.round(centerY - R - 2);
    const scissorSize = Math.round(D + 4);

    this.renderer.setScissor(scissorX, scissorY, scissorSize, scissorSize);
    this.renderer.setScissorTest(true);
    this.renderer.autoClear = false;
    this.renderer.render(this.overlayScene, this.overlayCam);
    this.renderer.setScissorTest(false);
    this.renderer.autoClear = true;

    // Sincroniza o retÃ­culo e carcaÃ§a externa HTML/SVG com os mesmos pixels de deslocamento e rotaÃ§Ã£o
    if (this.lensEl) {
      let reticleShiftX = 0;
      let reticleShiftY = 0;
      if (this.opticShake > 0.001) {
        const t = performance.now() * 0.001;
        reticleShiftX = Math.cos(t * 71.0) * 8.0 * this.opticShake;
        reticleShiftY = Math.sin(t * 89.0) * 8.0 * this.opticShake;
      }
      this.lensEl.style.setProperty('--d', D.toFixed(1) + 'px');
      this.lensEl.style.setProperty('--x', (offsetX + reticleShiftX).toFixed(2) + 'px');
      this.lensEl.style.setProperty('--y', (offsetY + reticleShiftY).toFixed(2) + 'px');
      this.lensEl.style.setProperty('--rot', `${rollAngle}rad`);
    }
  }

  onResize() {
    this.overlayCam.left = -innerWidth / 2;
    this.overlayCam.right = innerWidth / 2;
    this.overlayCam.top  = innerHeight / 2;
    this.overlayCam.bottom = -innerHeight / 2;
    this.overlayCam.updateProjectionMatrix();
  }
}



