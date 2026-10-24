import { emit, on } from '../core/EventBus.js';

export const DEFAULT_CROSSHAIR_CONFIG = {
  style: 'cross',           // 'cross' | 't_shape' | 'none'
  mode: 'static',          // 'static' | 'dynamic' (abertura das hastes com spread)
  dynamicAlignment: false,   // true | false (alinhamento dinâmico 3D do cano na HUD)
  followRecoil: false,      // true | false (subida/desvio da mira com o recuo/spray)
  centerDot: false,         // true | false
  length: 7,                // 2 a 24 px
  thickness: 1.5,           // 1 a 6 px
  gap: 5,                   // -4 a 20 px
  outline: 1,               // 0 a 3 px
  color: '#00ff66',         // hex
  noFireWarning: false,      // true | false
  aimAssist: true           // true ('true' = ON) | 'none' (false = OFF)
};

const STORAGE_KEY = 'blocky_crosshair_settings';

export class CrosshairManager {
  constructor({ crosshairEl = null, noFireEl = null } = {}) {
    this.el = crosshairEl || (typeof document !== 'undefined' ? document.getElementById('crosshair') : null);
    this.noFireEl = noFireEl || (typeof document !== 'undefined' ? document.getElementById('crosshair-no-fire') : null);
    
    this.config = this._loadConfig();
    this.currentRecoilOffset = { x: 0, y: 0 };
    this.isBlocked = false;

    this._bindEvents();
    this.applyConfig();
  }

  _loadConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return Object.assign({}, DEFAULT_CROSSHAIR_CONFIG, parsed);
        }
      }
    } catch (_) {}
    return Object.assign({}, DEFAULT_CROSSHAIR_CONFIG);
  }

  saveConfig(newConfig = {}) {
    this.config = Object.assign({}, this.config, newConfig);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch (_) {}
    this.applyConfig();

  }

  _bindEvents() {
    this._unsubs = [];
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }
  }

  /**
   * Aplica variáveis CSS e classes ao elemento da mira
   * @param {HTMLElement} [targetEl] Se passado, aplica no preview em vez da mira principal
   * @param {Object} [overrideConfig]
   */
  applyConfig(targetEl = this.el, overrideConfig = this.config) {
    if (!targetEl) return;
    const cfg = overrideConfig;

    // Variáveis CSS
    targetEl.style.setProperty('--ch-color', cfg.color);
    targetEl.style.setProperty('--ch-len', `${cfg.length}px`);
    targetEl.style.setProperty('--ch-thick', `${cfg.thickness}px`);
    targetEl.style.setProperty('--ch-gap', `${cfg.gap}px`);
    
    // Contorno (Outline)
    const o = Number(cfg.outline) || 0;
    let shadow = 'none';
    if (o > 0) {
      shadow = `0 0 0 ${o}px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0,0,0,0.85)`;
    }
    targetEl.style.setProperty('--ch-shadow', shadow);

    // Estilo (Cross, T-Shape ou None)
    const noLines = cfg.style === 'none';
    const isCompletelyHidden = noLines && !cfg.centerDot;
    targetEl.classList.toggle('ch-no-lines', noLines);
    targetEl.classList.toggle('ch-hidden', isCompletelyHidden);
    targetEl.classList.toggle('ch-t-shape', cfg.style === 't_shape');
    
    // Dot central (independente do estilo das linhas)
    const dot = targetEl.querySelector('.ch-dot');
    if (dot) {
      dot.style.display = cfg.centerDot ? 'block' : 'none';
      dot.style.width = `${Math.max(2, cfg.thickness)}px`;
      dot.style.height = `${Math.max(2, cfg.thickness)}px`;
      dot.style.left = `-${Math.max(2, cfg.thickness) / 2}px`;
      dot.style.top = `-${Math.max(2, cfg.thickness) / 2}px`;
    }

    // Se for o elemento principal da HUD, garante reset imediato dos eixos desligados
    if (targetEl === this.el) {
      if (!cfg.dynamicAlignment) {
        targetEl.style.left = '50%';
        targetEl.style.top = '50%';
      }
      if (!cfg.followRecoil) {
        this.currentRecoilOffset.x = 0;
        this.currentRecoilOffset.y = 0;
        targetEl.style.transform = 'translate(calc(-50% + 0.0px), calc(-50% + 0.0px))';
      }
    }
  }

  /**
   * Atualização contínua frame a frame nos 3 eixos independentes:
   * - Eixo 1 (mode): Abertura dinâmica/estática das hastes (--gap)
   * - Eixo 2 (dynamicAlignment): Posição base (left/top) seguindo o cano 3D ou fixa em 50%
   * - Eixo 3 (followRecoil): Offset de recuo/spray (transform) seguindo a rajada ou fixo em 0px
   */
  update({
    dt = 0.016,
    isAds = false,
    adsAmount = 0,
    spread = 0.02,
    isSprinting = false,
    weaponId = 'ar15',
    cameraRig = null,
    cameraFov = 78,
    wallCompression = 0,
    sprayRecoil = null,
    barrelScreenPos = null
  } = {}) {
    if (!this.el) return;

    const cfg = this.config;
    const hasAnyVisible = (cfg.style !== 'none') || !!cfg.centerDot;
    if (!hasAnyVisible) {
      this.el.style.opacity = '0';
      if (this.noFireEl) this.noFireEl.style.display = 'none';
      return;
    }

    // 1. Verificação de No Fire Warning (Cano obstruído contra parede)
    const isObstructed = (wallCompression > 0.45);
    this.isBlocked = isObstructed && cfg.noFireWarning;

    if (this.noFireEl) {
      if (this.isBlocked && adsAmount < 0.9) {
        this.noFireEl.style.display = 'flex';
        this.el.classList.add('ch-blocked');
      } else {
        this.noFireEl.style.display = 'none';
        this.el.classList.remove('ch-blocked');
      }
    }

    // Se estiver em ADS completo, esconde a crosshair
    if (adsAmount >= 0.95) {
      this.el.style.opacity = '0';
      return;
    }

    const baseOpacity = isSprinting ? 0.25 : 0.90;
    this.el.style.opacity = String(Math.max(0, (1 - adsAmount * 1.2) * baseOpacity));

    // 2. EIXO 1 — Comportamento de Dispersão: Estático vs Dinâmico (Abrir/Fechar das hastes com spread)
    let currentGap = cfg.gap;
    if (cfg.mode === 'dynamic') {
      const dynamicSpreadOffset = Math.max(0, (spread - 0.010) * 480);
      currentGap = cfg.gap + dynamicSpreadOffset;
    }
    this.el.style.setProperty('--gap', `${currentGap.toFixed(1)}px`);

    // 3. EIXO 2 — Alinhamento Dinâmico do Cano 3D (ON vs OFF)
    if (cfg.dynamicAlignment && barrelScreenPos && typeof barrelScreenPos.x === 'number' && typeof barrelScreenPos.y === 'number') {
      this.el.style.left = `${barrelScreenPos.x.toFixed(1)}px`;
      this.el.style.top = `${barrelScreenPos.y.toFixed(1)}px`;
    } else {
      this.el.style.left = '50%';
      this.el.style.top = '50%';
    }

    // 4. EIXO 3 — Seguir Recuo / Follow Recoil (ON vs OFF)
    if (cfg.followRecoil) {
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const fovRad = (cameraFov * Math.PI) / 180;
      const pixelsPerRad = screenH / (2 * Math.tan(fovRad / 2));

      // Combina o recuo acumulado da rajada (spray) com o punch elástico instantâneo da câmera
      const sPitch = (sprayRecoil?.pitch || 0);
      const sYaw = (sprayRecoil?.yaw || 0);
      const rPitch = (cameraRig?.recoilRot?.x || 0) + (cameraRig?.flinchPitch || 0);
      const rYaw = (cameraRig?.recoilRot?.y || 0) + (cameraRig?.flinchYaw || 0);

      // sPitch dá a subida nítida do spray; rPitch dá o tranco vivo a cada tiro
      const totalPitch = sPitch * 1.0 + rPitch * 3.5;
      const totalYaw = sYaw * 1.0 + rYaw * 3.5;

      const targetOffsetY = -totalPitch * pixelsPerRad;
      const targetOffsetX = -totalYaw * pixelsPerRad;

      // Interpolação suave e responsiva (snappy)
      const lerpSpeed = Math.min(1.0, dt * 35.0);
      this.currentRecoilOffset.x += (targetOffsetX - this.currentRecoilOffset.x) * lerpSpeed;
      this.currentRecoilOffset.y += (targetOffsetY - this.currentRecoilOffset.y) * lerpSpeed;

      const rx = this.currentRecoilOffset.x.toFixed(1);
      const ry = this.currentRecoilOffset.y.toFixed(1);
      this.el.style.transform = `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;
    } else {
      // Follow Recoil OFF: Sem deslocamento de recuo no transform
      this.currentRecoilOffset.x = 0;
      this.currentRecoilOffset.y = 0;
      this.el.style.transform = 'translate(calc(-50% + 0.0px), calc(-50% + 0.0px))';
    }
  }
}
