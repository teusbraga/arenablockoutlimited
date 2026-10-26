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
    barrelScreenPos = null,
    pureBarrelScreenPos = null
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
    if (cfg.mode === 'dynamic') {
      const dynamicSpreadOffset = Math.max(0, (spread - 0.002) * 380.0);
      const targetGap = cfg.gap + dynamicSpreadOffset;
      if (this.currentGap === undefined) this.currentGap = targetGap;
      // Expansão rápida e responsiva por disparo (24.0); recuperação orgânica e suave no cessar-fogo (7.0)
      const lerpSpeed = Math.min(1.0, dt * (targetGap > this.currentGap ? 24.0 : 7.0));
      this.currentGap += (targetGap - this.currentGap) * lerpSpeed;
    } else {
      this.currentGap = cfg.gap;
    }
    this.el.style.setProperty('--gap', this.currentGap.toFixed(1) + 'px');

    // 3. EIXO 2 & 3 — Alinhamento Dinâmico do Cano 3D e Seguir Recuo (Follow Recoil)
    const hasBarrelPos = barrelScreenPos && typeof barrelScreenPos.x === 'number' && typeof barrelScreenPos.y === 'number';
    const hasPurePos = pureBarrelScreenPos && typeof pureBarrelScreenPos.x === 'number' && typeof pureBarrelScreenPos.y === 'number';

    if (cfg.dynamicAlignment && (hasBarrelPos || hasPurePos)) {
      // Alinhamento Dinâmico ATIVO:
      // Se followRecoil estiver ATIVO: usa a posição balística real onde as balas vão bater (barrelScreenPos)
      // Se followRecoil estiver DESATIVADO: usa a posição pura do cano sem a subida de spray (pureBarrelScreenPos)
      const targetPos = (cfg.followRecoil && hasBarrelPos) ? barrelScreenPos : (hasPurePos ? pureBarrelScreenPos : barrelScreenPos);
      this.el.style.left = `${targetPos.x.toFixed(1)}px`;
      this.el.style.top = `${targetPos.y.toFixed(1)}px`;

      // Como targetPos já aponta diretamente para o ponto de impacto balístico no mundo 3D (98%+ match),
      // zeramos o deslocamento extra no transform para evitar contagem duplicada (double-dipping)
      this.currentRecoilOffset.x = 0;
      this.currentRecoilOffset.y = 0;
      this.el.style.transform = 'translate(calc(-50% + 0.0px), calc(-50% + 0.0px))';
    } else {
      // Alinhamento Dinâmico DESATIVADO:
      // Ancorado no centro da tela (50%, 50%)
      this.el.style.left = '50%';
      this.el.style.top = '50%';

      if (cfg.followRecoil) {
        // Estilo CS2 (cl_crosshair_recoil true):
        // Desloca a crosshair a partir do centro da tela para acompanhar o recuo/spray
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 1080;
        const fovRad = (cameraFov * Math.PI) / 180;
        const pixelsPerRad = screenH / (2 * Math.tan(fovRad / 2));

        const sPitch = (sprayRecoil?.pitch || 0);
        const sYaw = (sprayRecoil?.yaw || 0);

        const targetOffsetY = -sPitch * pixelsPerRad;
        const targetOffsetX = -sYaw * pixelsPerRad;

        const lerpSpeed = Math.min(1.0, dt * 35.0);
        this.currentRecoilOffset.x += (targetOffsetX - this.currentRecoilOffset.x) * lerpSpeed;
        this.currentRecoilOffset.y += (targetOffsetY - this.currentRecoilOffset.y) * lerpSpeed;

        const rx = this.currentRecoilOffset.x.toFixed(1);
        const ry = this.currentRecoilOffset.y.toFixed(1);
        this.el.style.transform = `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;
      } else {
        // Estático puro (OFF, OFF):
        this.currentRecoilOffset.x = 0;
        this.currentRecoilOffset.y = 0;
        this.el.style.transform = 'translate(calc(-50% + 0.0px), calc(-50% + 0.0px))';
      }
    }
  }
}
