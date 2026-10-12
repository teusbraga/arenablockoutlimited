import { CONFIG } from '../core/ConfigLoader.js';
import { on, emit } from '../core/EventBus.js';
import { materialFactory } from '../world/MaterialFactory.js';
import { DEFAULT_CROSSHAIR_CONFIG } from './CrosshairManager.js';

/**
 * MenuController
 * Gerencia a interface HTML do menu, sliders, seletores de mapa/arma/skin, texturas e pointer-lock / touch.
 */
export class MenuController {
  constructor({ input, gameManager, weapons, crosshairManager }) {
    this.input = input;
    this.gameManager = gameManager;
    this.weapons = weapons;
    this.crosshairManager = crosshairManager;

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

    // Controles de Textura (Aba Texturas)
    this.texModeSelect = document.getElementById('texture-mode-select');
    this.bumpSlider = document.getElementById('bump-slider');
    this.bumpSliderVal = document.getElementById('bump-val');
    this.uvSlider = document.getElementById('uv-scale-slider');
    this.uvSliderVal = document.getElementById('uv-scale-val');
    this.customTexTarget = document.getElementById('custom-tex-target');
    this.customTexFile = document.getElementById('custom-tex-file');
    this.customTexStatus = document.getElementById('custom-tex-status');

    this._bindDOM();
    this._bindTabs();
    this._bindCrosshairUI(this.crosshairManager);
    this._bindLockEvents();
    this._bindTextureKeys();
  }

  static getSavedMap(defaultUrl = './assets/maps/dust.json') {
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

  static getSavedSecondaryWeapon(defaultWeapon = 'p9') {
    const weaponSecondarySelect = document.getElementById('weapon-secondary-select');
    const saved = localStorage.getItem('blocky_weapon_secondary');
    if (saved && weaponSecondarySelect) weaponSecondarySelect.value = saved;
    return weaponSecondarySelect ? weaponSecondarySelect.value : defaultWeapon;
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
      this.weapons.setSlot(0, this.weaponSelect.value);
    });

    this.weaponSecondarySelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_weapon_secondary', this.weaponSecondarySelect.value);
      this.weapons.setSlot(1, this.weaponSecondarySelect.value);
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
      if (e.target.closest('input, button, select, .menu-tab-btn')) return;
      await this.input.requestLock();
    });
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
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        tabPanels.forEach(p => {
          const isTarget = p.getAttribute('data-panel') === targetTab;
          p.classList.toggle('active', isTarget);
        });
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
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    });
    this._unsubInvClose = on('inventory:closed', () => {
      this.inventoryOpen = false;
      this.input.requestLock();
    });

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
      } else if (this.gameManager.hasStarted && !this.gameManager.roundOver && !this.inventoryOpen) {
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

  destroy() {
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
