/**
 * LoadingScreen.js
 * Gerencia a tela de carregamento tática (Loading Screen) com barra de progresso,
 * status das etapas e transição suave de fade-out.
 */

export class LoadingScreen {
  constructor() {
    this.el = null;
    this.mapNameEl = null;
    this.barEl = null;
    this.statusEl = null;
    this.percentEl = null;
    this._initDOM();
  }

  _initDOM() {
    if (typeof document === 'undefined') return;
    this.el = document.getElementById('loading-screen');
    this.mapNameEl = document.getElementById('loading-map-name');
    this.barEl = document.getElementById('loading-bar');
    this.statusEl = document.getElementById('loading-status');
    this.percentEl = document.getElementById('loading-percent');
  }

  /**
   * Exibe a tela de carregamento e define o título da missão/mapa
   */
  show(mapTitle = 'CARREGANDO MAPA...') {
    this._initDOM();
    if (!this.el) return;
    this.el.classList.remove('fade-out');
    if (this.mapNameEl) this.mapNameEl.textContent = mapTitle;
    this.setProgress(0, 'INICIALIZANDO MOTOR...');
  }

  /**
   * Atualiza a porcentagem (0 - 100) e a mensagem de status da etapa atual
   */
  setProgress(percent, statusText = '') {
    this._initDOM();
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    if (this.barEl) this.barEl.style.width = `${p}%`;
    if (this.percentEl) this.percentEl.textContent = `${p}%`;
    if (this.statusEl && statusText) this.statusEl.textContent = statusText;
  }

  /**
   * Finaliza o carregamento com animação suave de fade-out
   */
  hide() {
    this._initDOM();
    if (!this.el) return;
    this.setProgress(100, 'PRONTO PARA COMBATE');
    setTimeout(() => {
      this.el.classList.add('fade-out');
    }, 280);
  }
}

export const loadingScreen = new LoadingScreen();
