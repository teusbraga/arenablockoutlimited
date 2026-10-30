import { CONFIG } from '../core/ConfigLoader.js';
import { on, emit } from '../core/EventBus.js';
import { materialFactory } from '../world/MaterialFactory.js';
import { DEFAULT_CROSSHAIR_CONFIG } from './CrosshairManager.js';
import { WeaponPreview3D } from './WeaponPreview3D.js';

export const SOLDIER_SKIN_PRESETS = {
  woodland: {
    id: 'woodland',
    name: 'Woodland Green',
    icon: '🌲',
    uniform: '#3a4833',
    sheenColor: '#6b7d58',
    vest: '#303c2a',
    pads: '#161816',
    skinTone: '#c4987e',
  },
  urban: {
    id: 'urban',
    name: 'Urban Slate',
    icon: '🏙️',
    uniform: '#3c444d',
    sheenColor: '#64748b',
    vest: '#24282f',
    pads: '#121416',
    skinTone: '#c4987e',
  },
  desert: {
    id: 'desert',
    name: 'Desert Coyote',
    icon: '🏜️',
    uniform: '#78674d',
    sheenColor: '#a8906c',
    vest: '#544633',
    pads: '#2e271c',
    skinTone: '#b58363',
  },
  specops: {
    id: 'specops',
    name: 'Spec-Ops Dark',
    icon: '🌑',
    uniform: '#1f2327',
    sheenColor: '#3f464e',
    vest: '#151719',
    pads: '#0a0c0d',
    skinTone: '#c4987e',
  },
  mercenary: {
    id: 'mercenary',
    name: 'Mercenary Camo',
    icon: '🍂',
    uniform: '#484d3d',
    sheenColor: '#788065',
    vest: '#363b2e',
    pads: '#1a1c17',
    skinTone: '#9e6e4f',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic Snow',
    icon: '❄️',
    uniform: '#cdd6db',
    sheenColor: '#f0f5fa',
    vest: '#7b878f',
    pads: '#383e43',
    skinTone: '#e6be9f',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Ops',
    icon: '🩸',
    uniform: '#5a1f24',
    sheenColor: '#8a333b',
    vest: '#281316',
    pads: '#140c0d',
    skinTone: '#c4987e',
  },
  navy: {
    id: 'navy',
    name: 'Navy Seal',
    icon: '⚓',
    uniform: '#232f3e',
    sheenColor: '#3c5068',
    vest: '#151d28',
    pads: '#0c1015',
    skinTone: '#c4987e',
  },
  hazard: {
    id: 'hazard',
    name: 'Toxic Hazard',
    icon: '🧪',
    uniform: '#666128',
    sheenColor: '#9c953d',
    vest: '#2d2c1c',
    pads: '#15150f',
    skinTone: '#c4987e',
  },
  custom: {
    id: 'custom',
    name: 'Personalizado',
    icon: '🛠️',
    uniform: '#3a4833',
    sheenColor: '#6b7d58',
    vest: '#303c2a',
    pads: '#161816',
    skinTone: '#c4987e',
  }
};

export const DEFAULT_SOLDIER_SKIN = {
  preset: 'woodland',
  name: 'Woodland Green',
  uniform: '#3a4833',
  sheenColor: '#6b7d58',
  vest: '#303c2a',
  pads: '#161816',
  skinTone: '#c4987e',
};

/**
 * MenuController
 * Gerencia a interface HTML do menu, sliders, seletores de mapa/arma/skin, texturas e pointer-lock / touch.
 */
export class MenuController {
  constructor({ input, gameManager, weapons, crosshairManager, audio }) {
    this.audio = audio;
    this.input = input;
    this.gameManager = gameManager;
    this.weapons = weapons;
    this.crosshairManager = crosshairManager;
    this.currentTab = 'loadout';

    this.mapSelect = document.getElementById('map-select');
    this.weaponSelect = document.getElementById('weapon-select');
    this.weaponSecondarySelect = document.getElementById('weapon-secondary-select');
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
    this.btnFullscreen = document.getElementById('btn-fullscreen');

    this.headbobSlider = document.getElementById('headbob-slider');
    this.headbobSliderVal = document.getElementById('headbob-val');
    this.shakeSlider = document.getElementById('shake-slider');
    this.shakeSliderVal = document.getElementById('shake-val');
    this.vibrationToggle = document.getElementById('vibration-toggle');
    this.suppressionToggle = document.getElementById('suppression-toggle');
    this.devModeToggle = document.getElementById('dev-mode-toggle');
    this.devCheatsPanel = document.getElementById('dev-cheats-panel');
    this.btnCheatWhoami = document.getElementById('btn-cheat-whoami');
    this.btnCheatSpeed = document.getElementById('btn-cheat-speed');
    this.btnCheatAmmo = document.getElementById('btn-cheat-ammo');
    this.btnCheatGod = document.getElementById('btn-cheat-god');

    // Controles de Textura (Aba Texturas)
    this.texModeSelect = document.getElementById('texture-mode-select');
    this.bumpSlider = document.getElementById('bump-slider');
    this.bumpSliderVal = document.getElementById('bump-val');
    this.uvSlider = document.getElementById('uv-scale-slider');
    this.uvSliderVal = document.getElementById('uv-scale-val');
    this.customTexTarget = document.getElementById('custom-tex-target');
    this.customTexFile = document.getElementById('custom-tex-file');
    this.customTexStatus = document.getElementById('custom-tex-status');

    // Vitrine 3D Interativa na Aba Loadout
    this.weaponPreview = new WeaponPreview3D({
      initialWeaponId: this.weaponSelect?.value || 'ar15',
      initialSoldierSkin: MenuController.getSavedSoldierSkin(),
    });

    this._bindDOM();
    this._bindTabs();
    this._bindSoldierSkinUI();
    this._bindCrosshairUI(this.crosshairManager);
    this._bindLockEvents();
    this._bindTextureKeys();
    this._bindAudioUI(this.audio);
  }

  static getSavedMap(defaultUrl = './assets/maps/dust.json') {
    const mapSelect = document.getElementById('map-select');
    let saved = localStorage.getItem('blocky_map');
    if (saved === 'grid') {
      saved = './assets/maps/grid.json';
      localStorage.setItem('blocky_map', saved);
    }
    if (saved && mapSelect) mapSelect.value = saved;
    return mapSelect ? mapSelect.value : defaultUrl;
  }

  static getSavedWeapon(defaultWeapon = 'ar15') {
    const weaponSelect = document.getElementById('weapon-select');
    const saved = localStorage.getItem('blocky_weapon');
    if (saved && weaponSelect) weaponSelect.value = saved;
    if (weaponSelect && !weaponSelect.value) {
      weaponSelect.value = defaultWeapon;
    }
    return (weaponSelect && weaponSelect.value) ? weaponSelect.value : defaultWeapon;
  }

  static getSavedSecondaryWeapon(defaultWeapon = 'p9') {
    const weaponSecondarySelect = document.getElementById('weapon-secondary-select');
    const saved = localStorage.getItem('blocky_weapon_secondary');
    if (saved && weaponSecondarySelect) weaponSecondarySelect.value = saved;
    if (weaponSecondarySelect && !weaponSecondarySelect.value) {
      weaponSecondarySelect.value = defaultWeapon;
    }
    return (weaponSecondarySelect && weaponSecondarySelect.value) ? weaponSecondarySelect.value : defaultWeapon;
  }

  static getSavedBotSkin() {
    const botSkinSelect = document.getElementById('bot-skin-select');
    const saved = localStorage.getItem('blocky_botskin');
    if (saved && botSkinSelect) botSkinSelect.value = saved;
    return botSkinSelect ? botSkinSelect.value : null;
  }

  static getSavedSoldierSkin() {
    try {
      const raw = localStorage.getItem('blocky_soldier_skin');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_SOLDIER_SKIN, ...parsed };
        }
      }
    } catch (err) {
      console.warn('[MenuController] Erro ao carregar skin de soldado:', err);
    }
    return { ...DEFAULT_SOLDIER_SKIN };
  }

  static saveSoldierSkin(skin) {
    try {
      localStorage.setItem('blocky_soldier_skin', JSON.stringify(skin));
    } catch (err) {
      console.warn('[MenuController] Erro ao salvar skin de soldado:', err);
    }
  }

  _bindDOM() {
    this.mapSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_map', this.mapSelect.value);
      location.reload();
    });

    this.weaponSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_weapon', this.weaponSelect.value);
      this.weapons.setSlot(0, this.weaponSelect.value);
      this.weaponPreview?.setWeapon(this.weaponSelect.value, 0);
    });
    this.weaponSelect?.addEventListener('focus', () => {
      this.weaponPreview?.setWeapon(this.weaponSelect.value, 0);
    });

    this.weaponSecondarySelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_weapon_secondary', this.weaponSecondarySelect.value);
      this.weapons.setSlot(1, this.weaponSecondarySelect.value);
      this.weaponPreview?.setWeapon(this.weaponSecondarySelect.value, 1);
    });
    this.weaponSecondarySelect?.addEventListener('focus', () => {
      this.weaponPreview?.setWeapon(this.weaponSecondarySelect.value, 1);
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

    // Acessibilidade: Headbob Slider
    const savedBob = parseFloat(
      localStorage.getItem('blocky_headbob') || (CONFIG.ACCESSIBILITY?.headbobScale ?? 1.0).toString()
    );
    if (this.headbobSlider && this.headbobSliderVal) {
      this.headbobSlider.value = savedBob;
      this.headbobSliderVal.textContent = `${Math.round(savedBob * 100)}%`;
      if (!CONFIG.ACCESSIBILITY) CONFIG.ACCESSIBILITY = {};
      CONFIG.ACCESSIBILITY.headbobScale = savedBob;

      this.headbobSlider.addEventListener('input', () => {
        const val = parseFloat(this.headbobSlider.value);
        this.headbobSliderVal.textContent = `${Math.round(val * 100)}%`;
        CONFIG.ACCESSIBILITY.headbobScale = val;
        localStorage.setItem('blocky_headbob', val.toString());
      });
    }

    // Acessibilidade: Shake Slider
    const savedShake = parseFloat(
      localStorage.getItem('blocky_shake') || (CONFIG.ACCESSIBILITY?.shakeScale ?? 1.0).toString()
    );
    if (this.shakeSlider && this.shakeSliderVal) {
      this.shakeSlider.value = savedShake;
      this.shakeSliderVal.textContent = `${Math.round(savedShake * 100)}%`;
      if (!CONFIG.ACCESSIBILITY) CONFIG.ACCESSIBILITY = {};
      CONFIG.ACCESSIBILITY.shakeScale = savedShake;

      this.shakeSlider.addEventListener('input', () => {
        const val = parseFloat(this.shakeSlider.value);
        this.shakeSliderVal.textContent = `${Math.round(val * 100)}%`;
        CONFIG.ACCESSIBILITY.shakeScale = val;
        localStorage.setItem('blocky_shake', val.toString());
      });
    }

    // Acessibilidade: Vibração Mobile
    const savedVib = localStorage.getItem('blocky_vibration');
    if (this.vibrationToggle) {
      if (savedVib !== null) {
        this.vibrationToggle.value = savedVib === 'false' ? 'off' : 'on';
      }
      if (!CONFIG.ACCESSIBILITY) CONFIG.ACCESSIBILITY = {};
      CONFIG.ACCESSIBILITY.vibrationEnabled = this.vibrationToggle.value === 'on';

      this.vibrationToggle.addEventListener('change', () => {
        const enabled = this.vibrationToggle.value === 'on';
        CONFIG.ACCESSIBILITY.vibrationEnabled = enabled;
        localStorage.setItem('blocky_vibration', enabled ? 'true' : 'false');
        if (enabled) {
          if (this.input?.touch?.vibrate) {
            this.input.touch.vibrate(25);
          } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try { navigator.vibrate(25); } catch (_) {}
          } else {
            const label = document.getElementById('ios-haptic-label');
            if (label && typeof label.click === 'function') {
              try { label.click(); } catch (_) {}
            }
          }
        }
      });
    }

    // Acessibilidade: Efeito de Supressão (Near-Miss)
    const savedSup = localStorage.getItem('blocky_suppression');
    if (this.suppressionToggle) {
      if (savedSup !== null) {
        this.suppressionToggle.value = savedSup === 'false' ? 'off' : 'on';
      } else if (CONFIG.ACCESSIBILITY?.suppressionEnabled === false) {
        this.suppressionToggle.value = 'off';
      }
      if (!CONFIG.ACCESSIBILITY) CONFIG.ACCESSIBILITY = {};
      CONFIG.ACCESSIBILITY.suppressionEnabled = this.suppressionToggle.value === 'on';

      this.suppressionToggle.addEventListener('change', () => {
        const enabled = this.suppressionToggle.value === 'on';
        CONFIG.ACCESSIBILITY.suppressionEnabled = enabled;
        localStorage.setItem('blocky_suppression', enabled ? 'true' : 'false');
      });
    }

    // Modo Desenvolvedor & Cheats
    const savedDev = localStorage.getItem('blocky_dev_mode');
    if (this.devModeToggle) {
      if (savedDev !== null) {
        this.devModeToggle.value = savedDev === 'on' ? 'on' : 'off';
      }
      CONFIG.DEV_MODE = this.devModeToggle.value === 'on';
      if (this.devCheatsPanel) {
        this.devCheatsPanel.style.display = CONFIG.DEV_MODE ? 'flex' : 'none';
      }

      this.devModeToggle.addEventListener('change', () => {
        const enabled = this.devModeToggle.value === 'on';
        CONFIG.DEV_MODE = enabled;
        localStorage.setItem('blocky_dev_mode', enabled ? 'on' : 'off');
        if (this.devCheatsPanel) {
          this.devCheatsPanel.style.display = enabled ? 'flex' : 'none';
        }
        emit('hud:popup', {
          text: enabled ? '🛠️ MODO DEV & CHEATS ATIVADO' : 'MODO DEV DESATIVADO',
          color: enabled ? '#06d6a0' : '#f77f00',
          duration: 1800
        });
      });
    }

    this.btnCheatWhoami?.addEventListener('click', () => {
      this.input?.triggerCheat?.('whoami');
    });
    this.btnCheatSpeed?.addEventListener('click', () => {
      this.input?.triggerCheat?.('gettherefast');
    });
    this.btnCheatAmmo?.addEventListener('click', () => {
      this.input?.triggerCheat?.('professionalkiller');
    });
    this.btnCheatGod?.addEventListener('click', () => {
      this.input?.triggerCheat?.('baguvix');
    });

    this.btnResume?.addEventListener('click', async () => {
      await this.input.requestLock();
    });

    this.btnReset?.addEventListener('click', async () => {
      this.gameManager.resetGame();
      await this.input.requestLock();
    });

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = typeof window !== 'undefined' && (window.navigator?.standalone === true || window.matchMedia?.('(display-mode: standalone)')?.matches);

    if (isStandalone && this.btnFullscreen) {
      this.btnFullscreen.textContent = "✓ TELA CHEIA (PWA)";
      this.btnFullscreen.style.borderColor = "rgba(123, 198, 126, 0.6)";
      this.btnFullscreen.style.color = "var(--ok)";
    }

    this.btnFullscreen?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isStandalone) {
        alert("🎮 Você já está executando o jogo no modo PWA em Tela Cheia!");
        return;
      }
      if (isIOS) {
        alert("📱 Safari no iPhone:\n\nPara jogar em TELA CHEIA (sem as barras do navegador):\n1. Toque no botão 'Compartilhar' (ícone de quadrado com seta ⎋ na barra do Safari)\n2. Role para baixo e selecione 'Adicionar à Tela de Início' (+)\n3. Abra o jogo pelo novo ícone na tela inicial!");
        return;
      }

      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(err => console.warn(err));
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    });

    // Controles de Textura (Aba Texturas)
    if (this.texModeSelect) {
      this.texModeSelect.addEventListener('change', () => {
        materialFactory.setRenderMode(this.texModeSelect.value);
        emit('hud:popup', {
          text: `MODO TEXTURA: ${this.texModeSelect.options[this.texModeSelect.selectedIndex].text.toUpperCase()}`,
          color: '#e8933a',
          duration: 1800,
        });
      });
    }

    if (this.bumpSlider && this.bumpSliderVal) {
      this.bumpSlider.addEventListener('input', () => {
        const val = parseFloat(this.bumpSlider.value);
        this.bumpSliderVal.textContent = val.toFixed(2);
        materialFactory.setBumpIntensity(val);
      });
    }

    if (this.uvSlider && this.uvSliderVal) {
      this.uvSlider.addEventListener('input', () => {
        const val = parseFloat(this.uvSlider.value);
        this.uvSliderVal.textContent = `${val.toFixed(2)}x`;
        materialFactory.setWorldUVScale(val);
      });
    }

    if (this.customTexFile) {
      this.customTexFile.addEventListener('change', async () => {
        const file = this.customTexFile.files[0];
        if (!file) return;
        const target = this.customTexTarget ? this.customTexTarget.value : 'wall_peeling_ochre';
        const ok = await materialFactory.applyExternalTexture(target, file, 'map');
        if (ok && this.customTexStatus) {
          this.customTexStatus.textContent = `✓ Imagem '${file.name}' aplicada em '${target}'!`;
          this.customTexStatus.style.display = 'block';
          emit('hud:popup', {
            text: `IMAGEM APLICADA: ${target.toUpperCase()}`,
            color: '#7bc67e',
            duration: 2200,
          });
        }
      });
    }

    this.overlayElRef?.addEventListener('click', async (e) => {
      if (this.gameManager.roundOver) return;
      if (e.target.closest('input, button, select, .menu-tab-btn, .weapon-preview-box')) return;
      await this.input.requestLock();
    });
  }

  _syncPreviewActiveState() {
    if (!this.weaponPreview) return;
    const menuVisible = !this.overlayElRef || !this.overlayElRef.classList.contains('hidden');
    this.weaponPreview.setActive(Boolean(menuVisible && this.currentTab === 'loadout'));
  }

  _bindTextureKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyT' && !e.repeat && !e.target.matches('input, select, textarea')) {
        const modes = ['pbr', 'flat_textures', 'color_only'];
        const labels = ['PBR PROCEDURAL (COM BUMP)', 'ALBEDO PURO (SEM RELEVO)', 'CORES SÓLIDAS (BLOCKY)'];
        const colors = ['#7bc67e', '#e8933a', '#ded9cf'];

        let curIdx = modes.indexOf(materialFactory.currentMode);
        if (curIdx === -1) curIdx = 0;
        const nextIdx = (curIdx + 1) % modes.length;
        const nextMode = modes[nextIdx];

        materialFactory.setRenderMode(nextMode);
        if (this.texModeSelect) this.texModeSelect.value = nextMode;

        emit('hud:popup', {
          text: `TEXTURAS: ${labels[nextIdx]}`,
          color: colors[nextIdx],
          duration: 1600,
        });
      }
    });
  }

  _bindTabs() {
    const tabBtns = document.querySelectorAll('.menu-tab-btn');
    const tabPanels = document.querySelectorAll('.menu-tab-panel');
    tabBtns.forEach(btn => {
      const handleTab = e => {
        e.preventDefault();
        e.stopPropagation();
        const targetTab = btn.getAttribute('data-tab');
        this.currentTab = targetTab || 'loadout';
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        tabPanels.forEach(p => {
          const isTarget = p.getAttribute('data-panel') === targetTab;
          p.classList.toggle('active', isTarget);
        });
        this._syncPreviewActiveState();
      };
      btn.addEventListener('click', handleTab);
      btn.addEventListener('touchstart', handleTab, { passive: false });
    });
  }

  _bindLockEvents() {
    this.inventoryOpen = false;
    this._unsubInvOpen = on('inventory:opened', () => {
      this.inventoryOpen = true;
      this.overlayElRef?.classList.add('hidden');
      this._syncPreviewActiveState();
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    });
    this._unsubInvClose = on('inventory:closed', () => {
      this.inventoryOpen = false;
      this.input.requestLock();
      this._syncPreviewActiveState();
    });

    this._unsubLock = on('input:lock', e => {
      const locked = typeof e === 'object' && e !== null ? !!e.locked : !!e;
      if (locked) {
        if (!this.gameManager.hasStarted) {
          if (typeof this.gameManager.startMatch === 'function') {
            this.gameManager.startMatch();
          } else {
            this.gameManager.hasStarted = true;
            this.weapons?.setLoadoutLocked?.(true);
          }
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
      } else if (this.gameManager.hasStarted && !this.gameManager.roundOver && !this.inventoryOpen) {
        this.overlayElRef?.classList.remove('hidden');
        const menuStart = document.getElementById('menu-start');
        if (menuStart) menuStart.style.display = 'none';
        const menuPause = document.getElementById('menu-pause');
        if (menuPause) menuPause.style.display = 'flex';
        const titleEl = document.getElementById('overlay-title');
        if (titleEl) titleEl.textContent = 'PAUSADO';
      }
      this._syncPreviewActiveState();
    });
  }

  _bindCrosshairUI(crosshairManager) {
    if (!crosshairManager || typeof document === 'undefined') return;

    const previewEl = document.getElementById('crosshair-preview');
    const warningEl = document.getElementById('crosshair-preview-warning');

    const styleSelect = document.getElementById('ch-style-select');
    const modeSelect = document.getElementById('ch-mode-select');
    const dynamicAlignSelect = document.getElementById('ch-dynamic-align');
    const followRecoilSelect = document.getElementById('ch-follow-recoil');
    const centerDotSelect = document.getElementById('ch-center-dot');

    const lengthSlider = document.getElementById('ch-length-slider');
    const lengthVal = document.getElementById('ch-length-val');
    const thickSlider = document.getElementById('ch-thick-slider');
    const thickVal = document.getElementById('ch-thick-val');
    const gapSlider = document.getElementById('ch-gap-slider');
    const gapVal = document.getElementById('ch-gap-val');
    const outlineSlider = document.getElementById('ch-outline-slider');
    const outlineVal = document.getElementById('ch-outline-val');

    const colorPicker = document.getElementById('ch-color-picker');
    const colorPills = document.querySelectorAll('.ch-color-pill');
    const noFireToggle = document.getElementById('ch-nofire-toggle');
    const aimAssistToggle = document.getElementById('ch-aim-assist');
    const btnReset = document.getElementById('ch-btn-reset');

    const syncFormFromConfig = (cfg) => {
      if (styleSelect) styleSelect.value = cfg.style || 'cross';
      if (modeSelect) modeSelect.value = cfg.mode || 'dynamic';
      if (dynamicAlignSelect) dynamicAlignSelect.value = cfg.dynamicAlignment !== false ? 'on' : 'off';
      if (followRecoilSelect) followRecoilSelect.value = cfg.followRecoil ? 'on' : 'off';
      if (centerDotSelect) centerDotSelect.value = cfg.centerDot ? 'on' : 'off';

      if (lengthSlider) {
        lengthSlider.value = cfg.length;
        if (lengthVal) lengthVal.textContent = `${cfg.length}px`;
      }
      if (thickSlider) {
        thickSlider.value = cfg.thickness;
        if (thickVal) thickVal.textContent = `${cfg.thickness}px`;
      }
      if (gapSlider) {
        gapSlider.value = cfg.gap;
        if (gapVal) gapVal.textContent = `${cfg.gap}px`;
      }
      if (outlineSlider) {
        outlineSlider.value = cfg.outline;
        if (outlineVal) outlineVal.textContent = `${cfg.outline}px`;
      }
      if (colorPicker) colorPicker.value = cfg.color || '#00ff66';
      if (noFireToggle) noFireToggle.value = cfg.noFireWarning ? 'on' : 'off';
      if (aimAssistToggle) {
        const isAAOn = cfg.aimAssist !== 'none' && cfg.aimAssist !== false;
        aimAssistToggle.value = isAAOn ? 'true' : 'none';
      }

      if (previewEl) {
        crosshairManager.applyConfig(previewEl, cfg);
        previewEl.style.setProperty('--gap', `${cfg.gap}px`);
      }
    };

    // Inicializa valores a partir do config carregado
    syncFormFromConfig(crosshairManager.config);

    const updateAndSave = (partial) => {
      crosshairManager.saveConfig(partial);
      if (previewEl) {
        crosshairManager.applyConfig(previewEl, crosshairManager.config);
        previewEl.style.setProperty('--gap', `${crosshairManager.config.gap}px`);
      }
    };

    styleSelect?.addEventListener('change', () => {
      updateAndSave({ style: styleSelect.value });
    });

    modeSelect?.addEventListener('change', () => {
      updateAndSave({ mode: modeSelect.value });
    });

    dynamicAlignSelect?.addEventListener('change', () => {
      updateAndSave({ dynamicAlignment: dynamicAlignSelect.value === 'on' });
    });

    followRecoilSelect?.addEventListener('change', () => {
      updateAndSave({ followRecoil: followRecoilSelect.value === 'on' });
    });

    centerDotSelect?.addEventListener('change', () => {
      updateAndSave({ centerDot: centerDotSelect.value === 'on' });
    });

    lengthSlider?.addEventListener('input', () => {
      const val = parseFloat(lengthSlider.value);
      if (lengthVal) lengthVal.textContent = `${val}px`;
      updateAndSave({ length: val });
    });

    thickSlider?.addEventListener('input', () => {
      const val = parseFloat(thickSlider.value);
      if (thickVal) thickVal.textContent = `${val}px`;
      updateAndSave({ thickness: val });
    });

    gapSlider?.addEventListener('input', () => {
      const val = parseFloat(gapSlider.value);
      if (gapVal) gapVal.textContent = `${val}px`;
      updateAndSave({ gap: val });
    });

    outlineSlider?.addEventListener('input', () => {
      const val = parseInt(outlineSlider.value, 10);
      if (outlineVal) outlineVal.textContent = `${val}px`;
      updateAndSave({ outline: val });
    });

    colorPicker?.addEventListener('input', () => {
      updateAndSave({ color: colorPicker.value });
    });

    colorPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const color = pill.getAttribute('data-color');
        if (color) {
          if (colorPicker) colorPicker.value = color;
          updateAndSave({ color });
        }
      });
    });

    noFireToggle?.addEventListener('change', () => {
      const enabled = noFireToggle.value === 'on';
      updateAndSave({ noFireWarning: enabled });
      if (warningEl) {
        warningEl.style.display = enabled ? 'block' : 'none';
        setTimeout(() => {
          if (warningEl) warningEl.style.display = 'none';
        }, 1200);
      }
    });

    aimAssistToggle?.addEventListener('change', () => {
      const val = aimAssistToggle.value === 'true' ? true : 'none';
      updateAndSave({ aimAssist: val });
    });

    btnReset?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      crosshairManager.saveConfig(DEFAULT_CROSSHAIR_CONFIG);
      syncFormFromConfig(crosshairManager.config);
      emit('hud:popup', {
        text: 'MIRA CS2 RESTAURADA PARA O PADRÃO',
        color: '#00ff66',
        duration: 1500
      });
    });
  }

  _bindSoldierSkinUI() {
    this.soldierPresetSelect = document.getElementById('soldier-preset-select');
    this.soldierPalettePills = document.getElementById('soldier-palette-pills');
    this.soldierColorUniform = document.getElementById('soldier-color-uniform');
    this.soldierValUniform = document.getElementById('soldier-val-uniform');
    this.soldierColorVest = document.getElementById('soldier-color-vest');
    this.soldierValVest = document.getElementById('soldier-val-vest');
    this.soldierColorPads = document.getElementById('soldier-color-pads');
    this.soldierValPads = document.getElementById('soldier-val-pads');
    this.soldierColorSkin = document.getElementById('soldier-color-skin');
    this.soldierValSkin = document.getElementById('soldier-val-skin');
    this.btnPreviewSoldier = document.getElementById('btn-preview-soldier');

    // Inicializa com a skin salva
    this.currentSoldierSkin = MenuController.getSavedSoldierSkin();
    this._applySoldierSkinConfig(this.currentSoldierSkin, false);

    // Dropdown de Predefinições
    this.soldierPresetSelect?.addEventListener('change', () => {
      const val = this.soldierPresetSelect.value;
      if (val === 'custom') {
        this.currentSoldierSkin.preset = 'custom';
        this.currentSoldierSkin.name = 'Personalizado';
        this._applySoldierSkinConfig(this.currentSoldierSkin, true);
      } else {
        this._selectSoldierPreset(val);
      }
      this.weaponPreview?.showSoldier(this.currentSoldierSkin);
    });

    // Pílulas de Acesso Rápido
    if (this.soldierPalettePills) {
      const pills = this.soldierPalettePills.querySelectorAll('.skin-preset-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const presetId = pill.getAttribute('data-preset');
          if (presetId) {
            this._selectSoldierPreset(presetId);
            this.weaponPreview?.showSoldier(this.currentSoldierSkin);
          }
        });
      });
    }

    // Color Pickers
    const bindPicker = (inputEl, valEl, field) => {
      inputEl?.addEventListener('input', () => {
        if (valEl) valEl.textContent = inputEl.value.toUpperCase();
        this.currentSoldierSkin[field] = inputEl.value;
        this.currentSoldierSkin.preset = 'custom';
        this.currentSoldierSkin.name = 'Personalizado';
        if (this.soldierPresetSelect) this.soldierPresetSelect.value = 'custom';
        this._updatePillsActiveState('custom');
        MenuController.saveSoldierSkin(this.currentSoldierSkin);
        this.weaponPreview?.updateSoldierSkin(this.currentSoldierSkin);
        emit('player:skinChanged', { skin: this.currentSoldierSkin });
      });
    };

    bindPicker(this.soldierColorUniform, this.soldierValUniform, 'uniform');
    bindPicker(this.soldierColorVest, this.soldierValVest, 'vest');
    bindPicker(this.soldierColorPads, this.soldierValPads, 'pads');
    bindPicker(this.soldierColorSkin, this.soldierValSkin, 'skinTone');

    // Botão de Ver no 3D
    this.btnPreviewSoldier?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.weaponPreview?.showSoldier(this.currentSoldierSkin);
    });
  }

  _updatePillsActiveState(activeId) {
    if (!this.soldierPalettePills) return;
    const pills = this.soldierPalettePills.querySelectorAll('.skin-preset-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-preset') === activeId);
    });
  }

  _selectSoldierPreset(presetId) {
    const preset = SOLDIER_SKIN_PRESETS[presetId];
    if (preset) {
      const nextSkin = {
        preset: presetId,
        name: preset.name,
        uniform: preset.uniform,
        sheenColor: preset.sheenColor,
        vest: preset.vest,
        pads: preset.pads,
        skinTone: preset.skinTone,
      };
      this._applySoldierSkinConfig(nextSkin, true);
    }
  }

  _applySoldierSkinConfig(skin, shouldSave = true) {
    this.currentSoldierSkin = { ...skin };

    if (this.soldierPresetSelect) {
      this.soldierPresetSelect.value = skin.preset || 'custom';
    }
    if (this.soldierColorUniform) {
      this.soldierColorUniform.value = skin.uniform || '#3a4833';
      if (this.soldierValUniform) this.soldierValUniform.textContent = (skin.uniform || '#3a4833').toUpperCase();
    }
    if (this.soldierColorVest) {
      this.soldierColorVest.value = skin.vest || '#303c2a';
      if (this.soldierValVest) this.soldierValVest.textContent = (skin.vest || '#303c2a').toUpperCase();
    }
    if (this.soldierColorPads) {
      this.soldierColorPads.value = skin.pads || '#161816';
      if (this.soldierValPads) this.soldierValPads.textContent = (skin.pads || '#161816').toUpperCase();
    }
    if (this.soldierColorSkin) {
      this.soldierColorSkin.value = skin.skinTone || '#c4987e';
      if (this.soldierValSkin) this.soldierValSkin.textContent = (skin.skinTone || '#c4987e').toUpperCase();
    }

    this._updatePillsActiveState(skin.preset || 'custom');

    if (shouldSave) {
      MenuController.saveSoldierSkin(this.currentSoldierSkin);
    }

    this.weaponPreview?.updateSoldierSkin(this.currentSoldierSkin);
    emit('player:skinChanged', { skin: this.currentSoldierSkin });
  }

  _bindAudioUI(audio) {
    if (!audio) return;

    const volMasterSlider = document.getElementById('vol-master-slider');
    const volMasterVal = document.getElementById('vol-master-val');
    const volFootstepsSlider = document.getElementById('vol-footsteps-slider');
    const volFootstepsVal = document.getElementById('vol-footsteps-val');
    const volWeaponsSlider = document.getElementById('vol-weapons-slider');
    const volWeaponsVal = document.getElementById('vol-weapons-val');
    const volImpactsSlider = document.getElementById('vol-impacts-slider');
    const volImpactsVal = document.getElementById('vol-impacts-val');
    const volTraumaSlider = document.getElementById('vol-trauma-slider');
    const volTraumaVal = document.getElementById('vol-trauma-val');
    const volBtnReset = document.getElementById('vol-btn-reset');

    const updateSlider = (slider, valEl, val) => {
      if (slider) slider.value = val;
      if (valEl) valEl.textContent = `${Math.round(val * 100)}%`;
    };

    // Sincroniza valores iniciais
    if (audio.volumes) {
      updateSlider(volMasterSlider, volMasterVal, audio.volumes.master ?? 1.00);
      updateSlider(volFootstepsSlider, volFootstepsVal, audio.volumes.footsteps ?? 0.05);
      updateSlider(volWeaponsSlider, volWeaponsVal, audio.volumes.weapons ?? 1.00);
      updateSlider(volImpactsSlider, volImpactsVal, audio.volumes.impacts ?? 0.45);
      updateSlider(volTraumaSlider, volTraumaVal, audio.volumes.trauma ?? 0.80);
    }

    volMasterSlider?.addEventListener('input', () => {
      const val = parseFloat(volMasterSlider.value);
      if (volMasterVal) volMasterVal.textContent = `${Math.round(val * 100)}%`;
      audio.setMasterVolume(val);
    });

    volFootstepsSlider?.addEventListener('input', () => {
      const val = parseFloat(volFootstepsSlider.value);
      if (volFootstepsVal) volFootstepsVal.textContent = `${Math.round(val * 100)}%`;
      audio.setFootstepsVolume(val);
    });

    volWeaponsSlider?.addEventListener('input', () => {
      const val = parseFloat(volWeaponsSlider.value);
      if (volWeaponsVal) volWeaponsVal.textContent = `${Math.round(val * 100)}%`;
      audio.setWeaponsVolume(val);
    });

    volImpactsSlider?.addEventListener('input', () => {
      const val = parseFloat(volImpactsSlider.value);
      if (volImpactsVal) volImpactsVal.textContent = `${Math.round(val * 100)}%`;
      audio.setImpactsVolume(val);
    });

    volTraumaSlider?.addEventListener('input', () => {
      const val = parseFloat(volTraumaSlider.value);
      if (volTraumaVal) volTraumaVal.textContent = `${Math.round(val * 100)}%`;
      audio.setTraumaVolume(val);
    });

    volBtnReset?.addEventListener('click', () => {
      audio.resetVolumes();
      updateSlider(volMasterSlider, volMasterVal, audio.volumes.master);
      updateSlider(volFootstepsSlider, volFootstepsVal, audio.volumes.footsteps);
      updateSlider(volWeaponsSlider, volWeaponsVal, audio.volumes.weapons);
      updateSlider(volImpactsSlider, volImpactsVal, audio.volumes.impacts);
      updateSlider(volTraumaSlider, volTraumaVal, audio.volumes.trauma);

      emit('hud:popup', {
        text: 'PADRÕES DE ÁUDIO RESTAURADOS',
        color: '#7bc67e',
        duration: 1600,
      });
    });
  }

  destroy() {
    if (this.weaponPreview) {
      this.weaponPreview.destroy();
      this.weaponPreview = null;
    }
    if (this._unsubLock) {
      this._unsubLock();
      this._unsubLock = null;
    }
    if (this._unsubInvOpen) {
      this._unsubInvOpen();
      this._unsubInvOpen = null;
    }
    if (this._unsubInvClose) {
      this._unsubInvClose();
      this._unsubInvClose = null;
    }
  }
}
