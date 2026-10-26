import { emit, on } from './EventBus.js';
import { CONFIG } from './ConfigLoader.js';

export class TouchInput {
  constructor(inputManager) {
    this.input = inputManager;
    const hasTouch = (typeof window !== 'undefined' && 'ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    const isCoarseOrMobileUA = (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches) || (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));
    this.isMobile = Boolean(hasTouch && isCoarseOrMobileUA);
    
    // Identificadores de toque ativos
    this.moveTouchId = null;
    this.lookTouchId = null;

    // Posições do joystick esquerdo
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickPos = { x: 0, y: 0 };
    this.maxRadius = 45; // Raio máximo do analógico em pixels

    // Posições do touchpad direito
    this.lastLookPos = { x: 0, y: 0 };

    // Elementos DOM
    this.container = typeof document !== 'undefined' ? document.getElementById('mobile-controls') : null;
    this.joystickBase = typeof document !== 'undefined' ? document.getElementById('joystick-base') : null;
    this.joystickKnob = typeof document !== 'undefined' ? document.getElementById('joystick-knob') : null;
    this.touchZoneLeft = typeof document !== 'undefined' ? document.getElementById('touch-zone-left') : null;
    this.touchZoneRight = typeof document !== 'undefined' ? document.getElementById('touch-zone-right') : null;

    this._unsubs = [
      on('weapon:fired', () => this.vibrate(18)),
      on('player:damaged', () => this.vibrate([40, 30, 40])),
      on('weapon:empty', () => this.vibrate(35)),
      on('weapon:reload:start', () => this.vibrate(25)),
      on('weapon:reload:end', () => this.vibrate([15, 30, 20])),
      on('weapon:pump', () => this.vibrate(22))
    ];

    if (this.isMobile && this.container) {
      this._init();
    }
  }

  _init() {
    this.container.style.display = 'block';
    this._bindZones();
    this._bindButtons();
  }

  _bindZones() {
    if (!this.touchZoneLeft || !this.touchZoneRight) return;

    // --- 1. ZONA ESQUERDA: JOYSTICK DINÂMICO ---
    this.touchZoneLeft.addEventListener('touchstart', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.moveTouchId === null) {
          this.moveTouchId = t.identifier;
          this.joystickOrigin = { x: t.clientX, y: t.clientY };
          this.joystickPos = { x: t.clientX, y: t.clientY };

          if (this.joystickBase && this.joystickKnob) {
            this.joystickBase.style.display = 'block';
            this.joystickBase.style.left = `${t.clientX}px`;
            this.joystickBase.style.top = `${t.clientY}px`;
            this.joystickKnob.style.transform = 'translate(-50%, -50%)';
          }
          break;
        }
      }
    }, { passive: false });

    this.touchZoneLeft.addEventListener('touchmove', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.moveTouchId) {
          let dx = t.clientX - this.joystickOrigin.x;
          let dy = t.clientY - this.joystickOrigin.y;
          const dist = Math.hypot(dx, dy);

          if (dist > this.maxRadius) {
            dx = (dx / dist) * this.maxRadius;
            dy = (dy / dist) * this.maxRadius;
          }

          if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          }

          // Converte o ângulo em ações booleanas WASD
          const deadzone = 10;
          this.input.actions.forward = dy < -deadzone;
          this.input.actions.backward = dy > deadzone;
          this.input.actions.left = dx < -deadzone;
          this.input.actions.right = dx > deadzone;

          // Se empurrar mais de 75% para cima, ativa sprint automático
          this.input.actions.sprint = dy < -(this.maxRadius * 0.75);
          break;
        }
      }
    }, { passive: false });

    const endLeftTouch = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.moveTouchId) {
          this.moveTouchId = null;
          this.input.actions.forward = false;
          this.input.actions.backward = false;
          this.input.actions.left = false;
          this.input.actions.right = false;
          this.input.actions.sprint = false;

          if (this.joystickBase) {
            this.joystickBase.style.display = 'none';
          }
          break;
        }
      }
    };

    this.touchZoneLeft.addEventListener('touchend', endLeftTouch);
    this.touchZoneLeft.addEventListener('touchcancel', endLeftTouch);

    // --- 2. ZONA DIREITA: TOUCHPAD DE CÂMERA (LOOK) ---
    this.touchZoneRight.addEventListener('touchstart', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.lookTouchId === null) {
          this.lookTouchId = t.identifier;
          this.lastLookPos = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    }, { passive: false });

    this.touchZoneRight.addEventListener('touchmove', e => {
      e.preventDefault();
      const sensFactor = 2.8 * (CONFIG.CAMERA?.sensMultiplier || 1.0);
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.lookTouchId) {
          const deltaX = (t.clientX - this.lastLookPos.x) * sensFactor;
          const deltaY = (t.clientY - this.lastLookPos.y) * sensFactor;
          this.lastLookPos = { x: t.clientX, y: t.clientY };

          this.input.mouse.dx += deltaX;
          this.input.mouse.dy += deltaY;
          break;
        }
      }
    }, { passive: false });

    const endRightTouch = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.lookTouchId) {
          this.lookTouchId = null;
          break;
        }
      }
    };

    this.touchZoneRight.addEventListener('touchend', endRightTouch);
    this.touchZoneRight.addEventListener('touchcancel', endRightTouch);
  }

  _bindButtons() {
    const bindBtn = (id, action, isToggle = false) => {
      const el = document.getElementById(id);
      if (!el) return;

      const press = e => {
        e.preventDefault();
        e.stopPropagation();
        this.vibrate(12);
        if (isToggle) {
          this.input.actions[action] = !this.input.actions[action];
          el.classList.toggle('active', this.input.actions[action]);
        } else {
          this.input.pressAction(action);
          el.classList.add('active');
        }
      };

      const release = e => {
        e.preventDefault();
        if (!isToggle) {
          this.input.releaseAction(action);
          el.classList.remove('active');
        }
      };

      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('mousedown', press);

      if (!isToggle) {
        el.addEventListener('touchend', release);
        el.addEventListener('touchcancel', release);
        el.addEventListener('mouseup', release);
        el.addEventListener('mouseleave', release);
      }
    };

    // --- BOTÃO DE TIRO COM MIRA INTEGRADA (AIM-WHILE-SHOOTING) ---
    const fireBtn = document.getElementById('btn-touch-fire');
    if (fireBtn) {
      this.fireTouchId = null;
      this.lastFireLookPos = { x: 0, y: 0 };

      fireBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        e.stopPropagation();
        this.vibrate(18);
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (this.fireTouchId === null) {
            this.fireTouchId = t.identifier;
            this.lastFireLookPos = { x: t.clientX, y: t.clientY };
            this.input.actions.fire = true;
            this.input._actionQueue.add('fire');
            fireBtn.classList.add('active');
            break;
          }
        }
      }, { passive: false });

      // Permite arrastar o dedo a partir do botão de tiro para rotacionar a mira
      const onFireTouchMove = e => {
        if (this.fireTouchId === null) return;
        const sensFactor = 2.8 * (CONFIG.CAMERA?.sensMultiplier || 1.0);
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.fireTouchId) {
            const deltaX = (t.clientX - this.lastFireLookPos.x) * sensFactor;
            const deltaY = (t.clientY - this.lastFireLookPos.y) * sensFactor;
            this.lastFireLookPos = { x: t.clientX, y: t.clientY };

            this.input.mouse.dx += deltaX;
            this.input.mouse.dy += deltaY;
            break;
          }
        }
      };

      const onFireTouchEnd = e => {
        if (this.fireTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.fireTouchId) {
            this.fireTouchId = null;
            fireBtn.classList.remove('active');
            
            const topFire = document.getElementById('btn-touch-fire-top');
            const leftFire = document.getElementById('btn-touch-fire-left');
            const isTopFireActive = topFire && topFire.classList.contains('active');
            const isLeftFireActive = leftFire && leftFire.classList.contains('active');
            if (!isTopFireActive && !isLeftFireActive) {
              this.input.actions.fire = false;
            }
            break;
          }
        }
      };

      window.addEventListener('touchmove', onFireTouchMove, { passive: false });
      window.addEventListener('touchend', onFireTouchEnd);
      window.addEventListener('touchcancel', onFireTouchEnd);

      // Suporte a mouse para teste no desktop/emulador
      fireBtn.addEventListener('mousedown', e => {
        this.input.actions.fire = true;
        this.input._actionQueue.add('fire');
        fireBtn.classList.add('active');
      });
      window.addEventListener('mouseup', () => {
        if (this.fireTouchId === null && fireBtn.classList.contains('active')) {
          fireBtn.classList.remove('active');
          const topFire = document.getElementById('btn-touch-fire-top');
          const leftFire = document.getElementById('btn-touch-fire-left');
          const isTopFireActive = topFire && topFire.classList.contains('active');
          const isLeftFireActive = leftFire && leftFire.classList.contains('active');
          if (!isTopFireActive && !isLeftFireActive) {
            this.input.actions.fire = false;
          }
        }
      });
    }
    // --- BOTÕES DE TIRO ADICIONAIS (TOP DIREITO E ESQUERDO) ---
    const setupAdditionalFireButton = (id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let touchId = null;
      
      const startFire = e => {
        e.preventDefault();
        e.stopPropagation();
        this.vibrate(18);
        this.input.actions.fire = true;
        this.input._actionQueue.add('fire');
        btn.classList.add('active');
        if (e.changedTouches && e.changedTouches[0]) {
          touchId = e.changedTouches[0].identifier;
        }
      };
      
      const stopFire = e => {
        if (e.changedTouches && touchId !== null) {
          let found = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
              touchId = null;
              found = true;
              break;
            }
          }
          if (!found) return;
        }
        
        btn.classList.remove('active');
        
        const isMainFireActive = this.fireTouchId !== null;
        const topFire = document.getElementById('btn-touch-fire-top');
        const leftFire = document.getElementById('btn-touch-fire-left');
        const isTopFireActive = topFire && topFire.classList.contains('active');
        const isLeftFireActive = leftFire && leftFire.classList.contains('active');
        
        if (!isMainFireActive && !isTopFireActive && !isLeftFireActive) {
          this.input.actions.fire = false;
        }
      };

      btn.addEventListener('touchstart', startFire, { passive: false });
      btn.addEventListener('touchend', stopFire);
      btn.addEventListener('touchcancel', stopFire);
      btn.addEventListener('mousedown', startFire);
      window.addEventListener('mouseup', stopFire);
    };

    setupAdditionalFireButton('btn-touch-fire-top');
    setupAdditionalFireButton('btn-touch-fire-left');

    // Botão de Pausa Mobile
    const pauseBtn = document.getElementById('btn-touch-pause');
    if (pauseBtn) {
      const triggerPause = e => {
        e.preventDefault();
        e.stopPropagation();
        this.vibrate(12);
        this.input.locked = false;
        emit('input:lock', { locked: false });
      };
      pauseBtn.addEventListener('touchstart', triggerPause, { passive: false });
      pauseBtn.addEventListener('click', triggerPause);
    }

    // Botão de Seleção de Zoom
    const zoomBtn = document.getElementById('btn-touch-zoom');
    if (zoomBtn) {
      const triggerZoom = e => {
        e.preventDefault();
        e.stopPropagation();
        this.vibrate(12);
        emit('input:zoom-toggle', {});
      };
      zoomBtn.addEventListener('touchstart', triggerZoom, { passive: false });
      zoomBtn.addEventListener('click', triggerZoom);
    }

    // Demais Botões de Ação Táteis
    bindBtn('btn-touch-ads', 'ads', true); // Toggle ADS no mobile para conforto
    bindBtn('btn-touch-jump', 'jump');
    bindBtn('btn-touch-crouch', 'crouch', true); // Toggle agachar
    bindBtn('btn-touch-reload', 'reload');
    bindBtn('btn-touch-smoke', 'throwSmoke');
    bindBtn('btn-touch-cycle', 'nextWeapon');
    bindBtn('btn-touch-firemode', 'toggleFireMode');
    bindBtn('btn-touch-interact', 'interact');

    // Botão de Interagir Contextual (aparece somente próximo a portas ou drops)
    const interactBtn = document.getElementById('btn-touch-interact');
    if (interactBtn) {
      interactBtn.style.display = 'none';
      const unsubInteract = on('interact:target', e => {
        const target = (e && typeof e === 'object' && 'target' in e) ? e.target : e;
        interactBtn.style.display = target ? 'flex' : 'none';
      });
      this._unsubs.push(unsubInteract);
    }
  }

  _ensureIOSHapticBridge() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    let label = typeof document.getElementById === 'function' ? document.getElementById('ios-haptic-label') : null;
    if (!label) {
      const bridge = document.createElement('div');
      bridge.id = 'ios-haptic-bridge';
      bridge.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;overflow:hidden;';
      bridge.setAttribute('aria-hidden', 'true');

      const switchInput = document.createElement('input');
      switchInput.type = 'checkbox';
      switchInput.id = 'ios-haptic-switch';
      switchInput.setAttribute('switch', '');

      label = document.createElement('label');
      label.id = 'ios-haptic-label';
      label.htmlFor = 'ios-haptic-switch';

      bridge.appendChild(switchInput);
      bridge.appendChild(label);
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(bridge);
      }
    }
    return label;
  }

  _triggerIOSHaptic(pattern) {
    if (!this._iosHapticLabel) {
      this._iosHapticLabel = this._ensureIOSHapticBridge();
    }
    const label = this._iosHapticLabel;
    if (!label || typeof label.click !== 'function') return;

    if (Array.isArray(pattern)) {
      let delay = 0;
      for (let i = 0; i < pattern.length; i++) {
        const dur = pattern[i];
        if (i % 2 === 0) {
          if (delay === 0) {
            try { label.click(); } catch (_) {}
          } else {
            setTimeout(() => {
              try { label.click(); } catch (_) {}
            }, delay);
          }
        }
        delay += dur;
      }
    } else {
      try {
        label.click();
      } catch (_) {}
    }
  }

  vibrate(pattern = 18) {
    if (!CONFIG.ACCESSIBILITY?.vibrationEnabled) return;
    let hasVibrated = false;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        const res = navigator.vibrate(pattern);
        hasVibrated = res !== false;
      } catch (_) {
        hasVibrated = false;
      }
    }

    // Fallback para iOS WebKit / Safari / PWA (onde navigator.vibrate não existe ou retorna false)
    if (!hasVibrated) {
      this._triggerIOSHaptic(pattern);
    }
  }

  destroy() {
    if (this._unsubs) {
      this._unsubs.forEach(unsub => typeof unsub === 'function' && unsub());
      this._unsubs = [];
    }
  }
}
