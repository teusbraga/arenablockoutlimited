/**
 * ============================================================================
 *   SCOPE SYSTEM — Lente Telescópica com Segunda Câmera (Arquivo 1 Literal)
 * ============================================================================
 * Código literal e integral do algoritmo do Arquivo 1:
 * - RenderTarget quadrado (1024x1024) para a scopeCamera
 * - ShaderMaterial com distorção de barril, aberração cromática e vinheta
 * - Mesh de CircleGeometry mapeado na overlayScene ortográfica 2D
 * - Máscara circular perfeita com setScissor delimitado ao quadrado da lente
 * - Retículo em SVG (Duplex + Ticks + Ponto Central Vermelho)
 * - Sensibilidade trigonométrica e scroll de zoom
 * ============================================================================
 */

import * as THREE from 'three';

/* =====================================================================
 *  CONFIGURAÇÃO DO ARQUIVO 1
 * ===================================================================== */
export const SCOPE_CONFIG = {
  NORMAL_FOV: 75,
  ADS_FOV: 60,
  SCOPE_FOV: 10,
  SCOPE_FOV_MIN: 2,
  SCOPE_FOV_MAX: 30,
  LENS_SIZE: 0.45,
  SCOPE_RT_SIZE: 1024,
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

    // ── CÂMERA 2: scope (mesma cena, mesma posição/orientação, FOV bem menor)
    // aspect = 1 porque a lente é um círculo (textura quadrada).
    this.scopeCamera = new THREE.PerspectiveCamera(this.scopeFov, 1, 0.1, 500);

    /* ---------------------------------------------------------------------
     *  Render target: a scopeCamera desenha AQUI (textura quadrada offscreen),
     *  e depois essa textura é colada num disco 2D no centro da tela.
     *  Isso resolve o problema de setScissor() ser sempre retangular: com a
     *  textura mapeada num CircleGeometry, a máscara circular é perfeita.
     * ------------------------------------------------------------------- */
    this.scopeRT = new THREE.WebGLRenderTarget(SCOPE_CONFIG.SCOPE_RT_SIZE, SCOPE_CONFIG.SCOPE_RT_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    /* ---------------------------------------------------------------------
     *  Cena de composição (overlay 2D em pixels): um disco com a textura da
     *  scopeCamera + shader com vinheta, leve distorção de lente e aberração
     *  cromática. Câmera ortográfica com 1 unidade = 1 pixel CSS.
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
          vUv = uv;   // CircleGeometry gera UVs que mapeiam o círculo dentro do quadrado 0..1
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
          
          // A imagem da cÃ¢mera vem alinhada com o cano (frontLens)
          // EntÃ£o adicionamos uma levÃ­ssima distorÃ§Ã£o de lente baseada na lente traseira (p)
          vec2 uv = 0.5 + p * (1.0 - 0.10 * r * r);
          vec2 ca = p * 0.006 * r * r;
          
          vec3 col;
          col.r = texture2D(tMap, uv + ca).r;
          col.g = texture2D(tMap, uv).g;
          col.b = texture2D(tMap, uv - ca).b;
          
          // Anel Interno (A parede do tubo que varia dinamicamente com o zoom)
          // Se o raio na lente dianteira passar de uInnerRingRadius, comeÃ§a a parede interna do cilindro
          float isWall = smoothstep(uInnerRingRadius, uInnerRingRadius + 0.035, rFront);
          
          // IluminaÃ§Ã£o da parede interna baseada na direÃ§Ã£o (fake 3D shading do tubo)
          float wallShade = 0.45 + 0.55 * dot(normalize(pFront + vec2(0.001)), vec2(0.0, 1.0));
          vec3 wallColor = vec3(0.012, 0.014, 0.018) * wallShade;
          
          // Mistura a imagem da lente com a parede interna
          col = mix(col, wallColor, isWall);
          
          // Anel Externo (O limite da ocular traseira, define a transparÃªncia)
          float alpha = uOpacity * (1.0 - smoothstep(0.98, 1.0, r));
          
          gl_FragColor = vec4(col, alpha);
        }`,
    });

    // Disco de raio 1: a escala do mesh (em pixels) define o raio real da lente.
    this.lensMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 96), this.lensMat);
    this.overlayScene.add(this.lensMesh);

    // Elementos da interface DOM
    this.lensEl = document.getElementById('lens');
    this.scopeHudEl = document.getElementById('scopeHud');
    this.zoomTextEl = document.getElementById('scope-zoom-text');
    this.fovTextEl = document.getElementById('scope-fov-text');
    this.dotEl = document.getElementById('crosshair');

    // Variáveis de oscilação orgânica (Scope Sway / Respiração)
    this.swayTime = 0;
    this.swayPitch = 0;
    this.swayYaw = 0;

    // Inércia de movimento do mouse (Mouse Look Inertia) para paralaxe realista
    this.prevYaw = 0;
    this.prevPitch = 0;
    this.hasPrevLook = false;
    this.lookInertia = new THREE.Vector2(0, 0);

    // Inicializa Retículo SVG literal do Arquivo 1
    this.buildReticle();

    // Listener para redimensionamento
    window.addEventListener('resize', () => this.onResize());

    // Listener de Scroll do Mouse (ajusta zoom durante scope)
    window.addEventListener('wheel', e => {
      if (!this.adsTarget) return;
      e.preventDefault();
      this.scopeFov *= (e.deltaY < 0) ? 0.9 : 1 / 0.9;
      this.scopeFov = Math.max(SCOPE_CONFIG.SCOPE_FOV_MIN, Math.min(SCOPE_CONFIG.SCOPE_FOV_MAX, this.scopeFov));
    }, { passive: false });
  }

  buildReticle() {
    const el = document.getElementById('reticle');
    if (!el) return;
    const L = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}"/>`;
    let s = '';
    // Linhas grossas externas + finas internas (estilo duplex)
    s += L(-46, 0, -10, 0, .9) + L(10, 0, 46, 0, .9) + L(0, -46, 0, -10, .9) + L(0, 10, 0, 46, .9);
    s += L(-10, 0, -1.5, 0, .22) + L(1.5, 0, 10, 0, .22) + L(0, -10, 0, -1.5, .22) + L(0, 1.5, 0, 10, .22);
    // Marcações de mira (ticks) ao longo dos eixos
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

  attachToModel(protoDetails) {
    if (!protoDetails || !protoDetails.rearLens) return;
    this.protoDetails = protoDetails;
    // Vincula a textura do scopeRender à lente traseira do modelo 3D
    if (protoDetails.rearLens.material) {
      protoDetails.rearLens.material.map = this.scopeRT.texture;
      protoDetails.rearLens.material.roughness = 0.08;
      protoDetails.rearLens.material.metalness = 0.2;
      protoDetails.rearLens.material.transmission = 0.0;
      protoDetails.rearLens.material.opacity = 1.0;
      protoDetails.rearLens.material.transparent = false;
      protoDetails.rearLens.material.needsUpdate = true;
    }
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

  update(dt, mainCamera, isAdsActive) {
    this.adsTarget = isAdsActive;

    // Transição suave do ADS (exponencial, independente de FPS)
    const target = this.adsTarget ? 1 : 0;
    this.adsT += (target - this.adsT) * (1 - Math.exp(-dt * SCOPE_CONFIG.ADS_SPEED));
    if (Math.abs(target - this.adsT) < 0.001) this.adsT = target;

    // ── Inércia de Movimento da Câmera (Mouse Look Inertia para Paralaxe Realista) ──
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

    if (this.adsT > 0.05 && dt > 0) {
      // Velocidade angular real do mouse em radianos por segundo (independente de FPS)
      const lookSpeedX = dYaw / dt;
      const lookSpeedY = dPitch / dt;

      // Ganho calibrado para sensação de paralaxe cilíndrico realista ao mover o mouse
      const inertiaGain = 0.085;
      const targetInertiaX = THREE.MathUtils.clamp(lookSpeedX * inertiaGain, -0.48, 0.48);
      const targetInertiaY = THREE.MathUtils.clamp(-lookSpeedY * inertiaGain, -0.48, 0.48);

      // Resposta ágil ao movimento da mão e retorno amortecido ao parar o mouse
      const speedX = Math.abs(targetInertiaX) > Math.abs(this.lookInertia.x) ? 26.0 : 14.0;
      const speedY = Math.abs(targetInertiaY) > Math.abs(this.lookInertia.y) ? 26.0 : 14.0;

      this.lookInertia.x += (targetInertiaX - this.lookInertia.x) * Math.min(dt * speedX, 1);
      this.lookInertia.y += (targetInertiaY - this.lookInertia.y) * Math.min(dt * speedY, 1);
    } else {
      this.lookInertia.set(0, 0);
    }

    // ── Sway Orgânico de Respiração no Scope ─────────────────────────────────
    // Quando em ADS, a respiração do atirador produz uma oscilação contínua e suave em 8 (Lissajous)
    if (this.adsT > 0.1) {
      this.swayTime += dt * 1.4;
      const swayAmplitude = 0.00085 * this.adsT;
      this.swayYaw = Math.sin(this.swayTime) * swayAmplitude;
      this.swayPitch = Math.cos(this.swayTime * 2) * (swayAmplitude * 0.55);
    } else {
      this.swayYaw = 0;
      this.swayPitch = 0;
    }

    // Câmera do scope: Orientação sincronizada com a principal + leve oscilação orgânica
    mainCamera.updateMatrixWorld();
    this.scopeCamera.position.copy(mainCamera.position);

    if (this.protoDetails && this.protoDetails.rearLens && this.protoDetails.frontLens) {
      const vRear = new THREE.Vector3();
      const vFront = new THREE.Vector3();
      this.protoDetails.rearLens.getWorldPosition(vRear);
      this.protoDetails.frontLens.getWorldPosition(vFront);
      
      const dir = new THREE.Vector3().subVectors(vFront, vRear).normalize();
      
      const vUp = new THREE.Vector3(0, 1, 0);
      vUp.transformDirection(this.protoDetails.opticBody.matrixWorld).normalize();

      const target = new THREE.Vector3().copy(this.scopeCamera.position).add(dir);
      this.scopeCamera.up.copy(vUp);
      this.scopeCamera.lookAt(target);
    } else {
      this.scopeCamera.quaternion.copy(mainCamera.quaternion);
      if (this.adsT > 0.1) {
        const euler = new THREE.Euler().setFromQuaternion(this.scopeCamera.quaternion, 'YXZ');
        euler.y += this.swayYaw;
        euler.x += this.swayPitch;
        this.scopeCamera.quaternion.setFromEuler(euler);
      }
    }

    this.scopeCamera.fov = this.scopeFov;
    this.scopeCamera.aspect = 1;
    this.scopeCamera.updateProjectionMatrix();

    // Estado do scope ativo
    this.scopeOn = this.adsT > 0.01;

    // HUD Telemetria de Ótica posicionada harmonicamente no topo do HUD da arma
    if (this.scopeHudEl) {
      if (this.adsT > 0.45) {
        this.scopeHudEl.classList.add('show');
        if (this.zoomTextEl) {
          this.zoomTextEl.textContent = `${this.apparentZoom().toFixed(1)}x`;
        }
        if (this.fovTextEl) {
          this.fovTextEl.textContent = `FOV ${this.scopeFov.toFixed(1)}°`;
        }
      } else {
        this.scopeHudEl.classList.remove('show');
      }
    }

    // Transição de Eye Relief para shooter moderno:
    // O overlay 2D surge suavemente apenas na fase final de aproximação (adsT > 0.65)
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

    // Atualiza orientação da scopeCamera com as matrizes mais recentes antes do render
    if (this.protoDetails && this.protoDetails.rearLens && this.protoDetails.frontLens) {
      this.protoDetails.rearLens.updateMatrixWorld(true);
      this.protoDetails.frontLens.updateMatrixWorld(true);
      
      const vRear = new THREE.Vector3();
      const vFront = new THREE.Vector3();
      this.protoDetails.rearLens.getWorldPosition(vRear);
      this.protoDetails.frontLens.getWorldPosition(vFront);
      
      const dir = new THREE.Vector3().subVectors(vFront, vRear).normalize();
      const vUp = new THREE.Vector3(0, 1, 0);
      vUp.transformDirection(this.protoDetails.opticBody.matrixWorld).normalize();

      const target = new THREE.Vector3().copy(this.scopeCamera.position).add(dir);
      this.scopeCamera.up.copy(vUp);
      this.scopeCamera.lookAt(target);
    }

    // ── PASSADA 2: mesma cena, scopeCamera, dentro do render target (textura da lente)
    // Oculta a arma apenas para a scopeCamera não enxergar o próprio cano à frente
    if (protoModel) protoModel.visible = false;

    this.renderer.setRenderTarget(this.scopeRT);
    this.renderer.render(this.scene, this.scopeCamera);
    this.renderer.setRenderTarget(null);

    if (protoModel) protoModel.visible = true;
  }

  render(mainCamera) {
    const w = innerWidth, h = innerHeight;

    if (!this.scopeOn) return;

    // Transição de Eye-Relief da lente de composição
    const eyeReliefThreshold = 0.65;
    const overlayProgress = Math.max(0, (this.adsT - eyeReliefThreshold) / (1 - eyeReliefThreshold));
    if (overlayProgress <= 0.001) return;

    const smoothOverlay = Math.pow(overlayProgress, 1.8);

    // ── SINCRONIZAÇÃO MATEMÁTICA EXATA COM O RECUO E ORIENTAÇÃO DO RIFLE ────────
    // Força atualização mundial da câmera e de toda a hierarquia de nós da arma
    mainCamera.updateMatrixWorld(true);
    if (this.protoDetails?.rearLens) {
      this.protoDetails.rearLens.updateMatrixWorld(true);
    }
    if (this.protoDetails?.frontLens) {
      this.protoDetails.frontLens.updateMatrixWorld(true);
    }

    let offsetX = 0;
    let offsetY = 0;
    let rollAngle = 0;
    let depthScale = 1.0;

    if (this.protoDetails && this.protoDetails.rearLens) {
      const rearLens = this.protoDetails.rearLens;
      const v = new THREE.Vector3();
      rearLens.getWorldPosition(v);

      // Distância frontal no eixo de visão da câmera (-Z no espaço local da câmera)
      // Mede com precisão matemática a aproximação/afastamento da lente (profundidade física)
      const vCam = v.clone().applyMatrix4(mainCamera.matrixWorldInverse);
      const depthZ = -vCam.z;

      // Calibra a distância base em repouso da ocular para sincronismo de escala 1:1 perfeito
      if (!this.baseDepth) {
        this.baseDepth = depthZ;
      } else if (this.adsT > 0.95 && (!this.protoDetails?.physics || this.protoDetails.physics.recoil < 0.005)) {
        this.baseDepth += (depthZ - this.baseDepth) * 0.05;
      }

      if (depthZ > 0.02) {
        const rawScale = this.baseDepth / depthZ;
        depthScale = Math.max(0.65, Math.min(2.5, rawScale));
      }

      // Projeção do centro no plano da câmera
      v.project(mainCamera);
      offsetX = (v.x * (w / 2));
      offsetY = (-v.y * (h / 2));

      // Calcula o roll (torção/inclinação) da carcaça da ótica no plano de visão da tela
      if (this.protoDetails.opticBody) {
        const vUp = new THREE.Vector3(0, 1, 0);
        vUp.transformDirection(this.protoDetails.opticBody.matrixWorld);
        vUp.transformDirection(mainCamera.matrixWorldInverse);
        rollAngle = Math.atan2(vUp.x, vUp.y);
      }

      if (this.protoDetails.frontLens) {
        const vFront = new THREE.Vector3();
        this.protoDetails.frontLens.getWorldPosition(vFront);
        vFront.project(mainCamera);
        this.pxShiftX = (vFront.x * (w / 2)) - offsetX;
        this.pxShiftY = (-vFront.y * (h / 2)) - offsetY;
      }
    }

    // Centro do disco na tela
    const centerX = (w / 2) + offsetX;
    const centerY = (h / 2) - offsetY; // Inversão para o sistema de coordenadas WebGL (origem inferior-esquerda)

    // Expansão tática do diâmetro acompanhando a profundidade física real da arma
    const D = this.lensDiameter() * (0.68 + 0.32 * smoothOverlay) * depthScale;
    const R = D / 2;

    // Posiciona o disco 2D na overlayScene exatamente onde a ocular 3D está na tela com rotação sincronizada
    this.lensMesh.position.set(offsetX, -offsetY, 0);
    this.lensMesh.rotation.z = -rollAngle;
    this.lensMesh.scale.set(R, R, 1);
    this.lensMat.uniforms.uOpacity.value = smoothOverlay;

    // ── RAIO DINÂMICO DO ANEL INTERNO COM BASE NO ZOOM (FOV) ─────────────────
    const zoomFactor = (SCOPE_CONFIG.SCOPE_FOV_MAX - this.scopeFov) / (SCOPE_CONFIG.SCOPE_FOV_MAX - SCOPE_CONFIG.SCOPE_FOV_MIN);
    const innerRingRadius = THREE.MathUtils.lerp(0.84, 1.08, THREE.MathUtils.clamp(zoomFactor, 0, 1));
    this.lensMat.uniforms.uInnerRingRadius.value = innerRingRadius;

    // ── PARALAXE COMBINADO: RECUO/BOBBING 3D + INÉRCIA DO MOUSE ─────────────
    let shiftX = 0;
    let shiftY = 0;
    if (D > 0 && this.pxShiftX !== undefined) {
      const pxMultiplier = 2.0; // Proporção calibrada de profundidade do tubo
      shiftX = (this.pxShiftX / D) * pxMultiplier;
      shiftY = (-this.pxShiftY / D) * pxMultiplier;
    }

    // Inércia fluida do mouse para sensação de peso e cilindro 3D realista
    shiftX += this.lookInertia.x;
    shiftY += this.lookInertia.y;

    this.lensMat.uniforms.uParallax.value.set(shiftX, shiftY);

    // setScissor acompanha o centro dinâmico da mira (coordenadas do scissor: x, y, width, height)
    const scissorX = Math.round(centerX - R - 2);
    const scissorY = Math.round(centerY - R - 2);
    const scissorSize = Math.round(D + 4);

    this.renderer.setScissor(scissorX, scissorY, scissorSize, scissorSize);
    this.renderer.setScissorTest(true);
    this.renderer.autoClear = false;
    this.renderer.render(this.overlayScene, this.overlayCam);
    this.renderer.setScissorTest(false);
    this.renderer.autoClear = true;

    // Sincroniza o retículo e carcaça externa HTML/SVG com os mesmos pixels de deslocamento e rotação
    if (this.lensEl) {
      this.lensEl.style.setProperty('--d', D.toFixed(1) + 'px');
      this.lensEl.style.setProperty('--x', offsetX.toFixed(2) + 'px');
      this.lensEl.style.setProperty('--y', offsetY.toFixed(2) + 'px');
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



