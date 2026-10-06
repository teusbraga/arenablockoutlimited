import { CONFIG } from '../core/Config.js';
import { on } from '../core/EventBus.js';

/**
 * MenuController
 * Gerencia a interface HTML do menu, sliders, seletores de mapa/arma/skin e pointer-lock / touch.
 */
export class MenuController {
  constructor({ input, gameManager, weapons }) {
    this.input = input;
    this.gameManager = gameManager;
    this.weapons = weapons;

    this.mapSelect = document.getElementById('map-select');
    this.weaponSelect = document.getElementById('weapon-select');
    this.botSkinSelect = document.getElementById('bot-skin-select');

    this.botSlider = document.getElementById('bot-count');
    this.botSliderVal = document.getElementById('bot-count-val');
    this.timeSlider = document.getElementById('round-time');
    this.timeSliderVal = document.getElementById('round-time-val');
    this.btnResume = document.getElementById('btn-resume');
    this.btnReset = document.getElementById('btn-reset');
    this.overlayElRef = document.getElementById('overlay');

    this.sensSlider = document.getElementById('sens-slider');
    this.sensSliderVal = document.getElementById('sens-val');

    this._bindDOM();
    this._bindLockEvents();
  }

  static getSavedMap(defaultUrl = './assets/maps/village.json') {
    const mapSelect = document.getElementById('map-select');
    const saved = localStorage.getItem('blocky_map');
    if (saved && mapSelect) mapSelect.value = saved;
    return mapSelect ? mapSelect.value : defaultUrl;
  }

  static getSavedWeapon(defaultWeapon = 'ar15') {
    const weaponSelect = document.getElementById('weapon-select');
    const saved = localStorage.getItem('blocky_weapon');
    if (saved && weaponSelect) weaponSelect.value = saved;
    return weaponSelect ? weaponSelect.value : defaultWeapon;
  }

  static getSavedBotSkin() {
    const botSkinSelect = document.getElementById('bot-skin-select');
    const saved = localStorage.getItem('blocky_botskin');
    if (saved && botSkinSelect) botSkinSelect.value = saved;
    return botSkinSelect ? botSkinSelect.value : null;
  }

  _bindDOM() {
    this.mapSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_map', this.mapSelect.value);
      location.reload();
    });

    this.weaponSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_weapon', this.weaponSelect.value);
      this.weapons._equip(this.weaponSelect.value);
    });

    this.botSkinSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_botskin', this.botSkinSelect.value);
      this.gameManager.setBotSkin(this.botSkinSelect.value);
    });

    if (this.botSlider && this.botSliderVal) {
      this.botSlider.addEventListener('input', () => {
        this.botSliderVal.textContent = this.botSlider.value;
        if (this.gameManager.hasStarted) {
          this.gameManager.setBotCount(parseInt(this.botSlider.value, 10));
        }
      });
    }

    if (this.timeSlider && this.timeSliderVal) {
      this.timeSlider.addEventListener('input', () => {
        const s = parseInt(this.timeSlider.value, 10);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        this.timeSliderVal.textContent = `${m}:${String(sec).padStart(2, '0')}`;
        this.gameManager.setRoundDuration(s);
      });
    }

    const savedSens = parseFloat(
      localStorage.getItem('blocky_sens') || (this.input.isMobile ? '2.0' : '1.2')
    );
    if (this.sensSlider && this.sensSliderVal) {
      this.sensSlider.value = savedSens;
      this.sensSliderVal.textContent = `${savedSens.toFixed(1)}x`;
      CONFIG.CAMERA.sensMultiplier = savedSens;

      this.sensSlider.addEventListener('input', () => {
        const val = parseFloat(this.sensSlider.value);
        this.sensSliderVal.textContent = `${val.toFixed(1)}x`;
        CONFIG.CAMERA.sensMultiplier = val;
        localStorage.setItem('blocky_sens', val.toString());
      });
    }

    this.btnResume?.addEventListener('click', async () => {
      await this.input.requestLock();
    });

    this.btnReset?.addEventListener('click', () => {
      this.gameManager.resetGame();
    });

    this.overlayElRef?.addEventListener('click', async (e) => {
      if (e.target.closest('input, button, select')) return;
      await this.input.requestLock();
    });
  }

  _bindLockEvents() {
    this._unsubLock = on('input:lock', locked => {
      if (locked) {
        if (!this.gameManager.hasStarted) {
          this.gameManager.hasStarted = true;
          const count = this.botSlider ? parseInt(this.botSlider.value, 10) : 4;
          this.gameManager.setBotCount(count);
        }
        this.overlayElRef?.classList.add('hidden');
        const menuStart = document.getElementById('menu-start');
        if (menuStart) menuStart.style.display = 'none';
        const menuPause = document.getElementById('menu-pause');
        if (menuPause) menuPause.style.display = 'flex';
        const titleEl = document.getElementById('overlay-title');
        if (titleEl) titleEl.textContent = 'PAUSADO';
      } else if (this.gameManager.hasStarted && !this.gameManager.roundOver) {
        this.overlayElRef?.classList.remove('hidden');
        const menuStart = document.getElementById('menu-start');
        if (menuStart) menuStart.style.display = 'none';
        const menuPause = document.getElementById('menu-pause');
        if (menuPause) menuPause.style.display = 'flex';
        const titleEl = document.getElementById('overlay-title');
        if (titleEl) titleEl.textContent = 'PAUSADO';
      }
    });
  }

  destroy() {
    if (this._unsubLock) {
      this._unsubLock();
      this._unsubLock = null;
    }
  }
}
