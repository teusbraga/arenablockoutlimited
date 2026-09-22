/**
 * TouchInput: Gerenciador de controles táteis para dispositivos móveis.
 * - Metade Esquerda: Analógico Virtual Dinâmico (Dynamic Floating Joystick) para movimentação WASD e Sprint.
 * - Metade Direita: Touchpad invisível para rotação livre de câmera (Yaw / Pitch).
 * - Botões Táteis: Atirar, Mirar (ADS), Pular, Agachar, Recarregar, Trocar Arma e Interagir.
 */

export class TouchInput {
  constructor(inputManager) {
    this.input = inputManager;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
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
    this.container = document.getElementById('mobile-controls');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickKnob = document.getElementById('joystick-knob');
    this.touchZoneLeft = document.getElementById('touch-zone-left');
    this.touchZoneRight = document.getElementById('touch-zone-right');

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
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.lookTouchId) {
          const deltaX = (t.clientX - this.lastLookPos.x) * 1.5;
          const deltaY = (t.clientY - this.lastLookPos.y) * 1.5;
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
        if (isToggle) {
          this.input.actions[action] = !this.input.actions[action];
          el.classList.toggle('active', this.input.actions[action]);
        } else {
          this.input.actions[action] = true;
          this.input._actionQueue.add(action);
          el.classList.add('active');
        }
      };

      const release = e => {
        e.preventDefault();
        if (!isToggle) {
          this.input.actions[action] = false;
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
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.fireTouchId) {
            const deltaX = (t.clientX - this.lastFireLookPos.x) * 1.5;
            const deltaY = (t.clientY - this.lastFireLookPos.y) * 1.5;
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
            this.input.actions.fire = false;
            fireBtn.classList.remove('active');
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
        if (this.fireTouchId === null && this.input.actions.fire) {
          this.input.actions.fire = false;
          fireBtn.classList.remove('active');
        }
      });
    }

    // Demais Botões de Ação Táteis
    bindBtn('btn-touch-ads', 'ads', true); // Toggle ADS no mobile para conforto
    bindBtn('btn-touch-jump', 'jump');
    bindBtn('btn-touch-crouch', 'crouch', true); // Toggle agachar
    bindBtn('btn-touch-reload', 'reload');
    bindBtn('btn-touch-cycle', 'nextWeapon');
    bindBtn('btn-touch-interact', 'interact');
  }
}
