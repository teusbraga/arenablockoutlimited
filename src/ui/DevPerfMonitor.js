import { CONFIG } from '../core/ConfigLoader.js';
import { on } from '../core/EventBus.js';

/**
 * DevPerfMonitor — Monitor de Telemetria de Desempenho Científico
 * ──────────────────────────────────────────────────────────────────
 * Ferramenta para medir o desempenho do jogo no PC simulando condições
 * de dispositivos mobile low-end, sem precisar enviar builds para iOS/Android.
 *
 * Recursos:
 * - FPS estável em janela deslizante de 0.5s (elimina oscilações instantâneas)
 * - 1% Low: expõe stutters/engasgos que FPS médio esconde
 * - JS Frame Time: isola custo de CPU/JavaScript por frame
 * - Semáforo de Draw Calls (verde ≤50, amarelo 51-90, vermelho >90)
 * - Contagem de triângulos e memória de texturas/geometrias
 *
 * Ativado/desativado por F3. Responde ao preset de qualidade em CONFIG.GRAPHICS.
 */
export class DevPerfMonitor {
  constructor() {
    this.visible = false;
    this.el = null;

    // Janela deslizante de frame times (0.5s de amostras)
    this._frameTimes = [];
    this._windowMs = 500;

    // Medição de JS Frame Time
    this._frameStart = 0;

    // Bind F3
    this._onKey = (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._onKey);

    // Escutar ativação via CONFIG
    this._unsubGraphics = on('config:graphicsChanged', e => {
      if (e && typeof e.perfMonitor === 'boolean') {
        if (e.perfMonitor) this.show();
        else this.hide();
      }
    });

    this._buildUI();
  }

  _buildUI() {
    if (typeof document === 'undefined') return;

    this.el = document.createElement('div');
    this.el.id = 'dev-perf-monitor';
    this.el.style.cssText = [
      'position:fixed',
      'top:8px',
      'left:8px',
      'background:rgba(0,0,0,0.75)',
      'color:#e8e8e8',
      'font:11px/1.55 monospace',
      'padding:7px 10px',
      'border-radius:5px',
      'pointer-events:none',
      'z-index:9999',
      'display:none',
      'min-width:200px',
      'border:1px solid rgba(255,255,255,0.08)',
      'backdrop-filter:blur(2px)',
    ].join(';');
    document.body.appendChild(this.el);
  }

  /** Marca o início do frame JavaScript (chamar no início do renderUpdate) */
  begin() {
    this._frameStart = performance.now();
  }

  /**
   * Finaliza a medição do frame, lê renderer.info e atualiza o display.
   * @param {THREE.WebGLRenderer} renderer
   */
  end(renderer) {
    if (!this.visible) return;

    const now = performance.now();
    const jsFrameMs = now - this._frameStart;

    // Acumular frame times na janela deslizante
    this._frameTimes.push({ t: now, jsMs: jsFrameMs });

    // Remover frames fora da janela de 0.5s
    const cutoff = now - this._windowMs;
    while (this._frameTimes.length > 1 && this._frameTimes[0].t < cutoff) {
      this._frameTimes.shift();
    }

    // Calcular apenas a cada ~100ms para não thrash o DOM
    if (!this._lastDisplay || now - this._lastDisplay > 100) {
      this._lastDisplay = now;
      this._updateDisplay(renderer);
    }
  }

  _updateDisplay(renderer) {
    const frames = this._frameTimes;
    if (frames.length < 2) return;

    // FPS estável na janela
    const span = frames[frames.length - 1].t - frames[0].t;
    const fps = span > 0 ? ((frames.length - 1) / span * 1000) : 0;

    // 1% Low: pior 1% dos frame times
    const sorted = [...frames.map(f => f.jsMs)].sort((a, b) => b - a);
    const p1count = Math.max(1, Math.floor(sorted.length * 0.01));
    const worstMs = sorted.slice(0, p1count).reduce((s, v) => s + v, 0) / p1count;
    const low1fps = worstMs > 0 ? (1000 / worstMs) : fps;

    // JS Frame Time médio da janela
    const avgJsMs = frames.reduce((s, f) => s + f.jsMs, 0) / frames.length;

    // Draw calls e triângulos do renderer
    let calls = 0, tris = 0, texCount = 0, geoCount = 0;
    if (renderer && renderer.info) {
      calls = renderer.info.render.calls || 0;
      tris = renderer.info.render.triangles || 0;
      texCount = renderer.info.memory?.textures || 0;
      geoCount = renderer.info.memory?.geometries || 0;
    }

    // Semáforo de Draw Calls
    let callColor, callEmoji;
    if (calls <= 50) { callColor = '#4cde80'; callEmoji = '🟢'; }
    else if (calls <= 90) { callColor = '#f7c948'; callEmoji = '🟡'; }
    else { callColor = '#f05a5a'; callEmoji = '🔴'; }

    // FPS color
    const fpsColor = fps >= 55 ? '#4cde80' : fps >= 30 ? '#f7c948' : '#f05a5a';
    const lowColor = low1fps >= 45 ? '#4cde80' : low1fps >= 25 ? '#f7c948' : '#f05a5a';

    // Preset ativo
    const preset = CONFIG.GRAPHICS?.preset || 'auto';
    const shadowEnabled = renderer?.shadowMap?.enabled ? 'ON' : 'OFF';

    this.el.innerHTML = [
      `<span style="color:#aaa;font-size:10px">▶ PERF MONITOR (F3)</span>`,
      `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:3px 0">`,
      `<span style="color:${fpsColor}"><b>FPS:</b> ${fps.toFixed(1)}</span>   <span style="color:${lowColor}"><b>1% Low:</b> ${low1fps.toFixed(1)}</span>`,
      `<b>JS Frame:</b> ${avgJsMs.toFixed(2)} ms`,
      `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:3px 0">`,
      `<b>Draw Calls:</b> <span style="color:${callColor}">${callEmoji} ${calls}</span>`,
      `<b>Triângulos:</b> ${(tris / 1000).toFixed(1)}K`,
      `<b>Texturas:</b> ${texCount}  <b>Geos:</b> ${geoCount}`,
      `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:3px 0">`,
      `<span style="color:#aaa;font-size:10px">Preset: <b>${preset}</b>  Shadows: <b>${shadowEnabled}</b></span>`,
      `<span style="color:#555;font-size:9px">Mobile alvo: ≤50 DC · ≤500K tri</span>`,
    ].join('<br>');
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    if (this.el) this.el.style.display = 'block';
  }

  hide() {
    this.visible = false;
    if (this.el) this.el.style.display = 'none';
    this._frameTimes = [];
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    if (this._unsubGraphics) {
      this._unsubGraphics();
      this._unsubGraphics = null;
    }
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
      this.el = null;
    }
  }
}
