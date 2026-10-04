import { emit } from './EventBus.js';
import { TouchInput } from './TouchInput.js';
import { CONFIG } from './Config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.locked = false;
    
    // Estado raw do mouse para cálculos de câmera
    this.mouse = { dx: 0, dy: 0 };
    
    // Mapeamento de botões físicos para intenções lógicas
    this.bindings = {
      'KeyW': 'forward', 'ArrowUp': 'forward',
      'KeyS': 'backward', 'ArrowDown': 'backward',
      'KeyA': 'left', 'ArrowLeft': 'left',
      'KeyD': 'right', 'ArrowRight': 'right',
      'Space': 'jump',
      'ShiftLeft': 'sprint',
      'ShiftRight': 'sprint',
      'KeyC': 'crouch',
      'Mouse0': 'fire',
      'Mouse2': 'ads',
      'KeyR': 'reload',
      'KeyQ': 'nextWeapon',
      'Digit1': 'slot1',
      'Digit2': 'slot2',
      'KeyE': 'interact',
      'KeyB': 'toggleFireMode',
      'KeyV': 'toggleFireMode'
    };

    // Estado atual das intenções (ações contínuas)
    this.actions = {
      forward: false, backward: false, left: false, right: false,
      jump: false, sprint: false, crouch: false,
      fire: false, ads: false, reload: false, nextWeapon: false,
      slot1: false, slot2: false, interact: false, toggleFireMode: false
    };

    // Fila de intenções (ações discretas - one shot click)
    this._actionQueue = new Set();
    this._cheatBuffer = '';

    this._bind();

    // Inicializa suporte tátil para Mobile
    this.touch = new TouchInput(this);
  }

  get isMobile() {
    return this.touch?.isMobile || false;
  }

  _bind() {
    addEventListener('keydown', e => {
      // Cheat code detection (ex: GETTHEREFAST)
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        this._cheatBuffer = ((this._cheatBuffer || '') + e.key.toLowerCase()).slice(-20);
        if (this._cheatBuffer.endsWith('gettherefast')) {
          this._cheatBuffer = '';
          const isBoosted = CONFIG.PLAYER.walkSpeed > 10.0;
          if (!isBoosted) {
            CONFIG.PLAYER.walkSpeed = 52.0;
            CONFIG.PLAYER.accel = 150.0;
            CONFIG.PLAYER.airAccel = 25.0;
            emit('hud:popup', {
              text: '⚡ CHEAT ACTIVATED: GETTHEREFAST (10x Speed)',
              color: '#06d6a0',
              duration: 2200
            });
            emit('cheat:activated', { cheat: 'gettherefast', active: true });
          } else {
            CONFIG.PLAYER.walkSpeed = 5.2;
            CONFIG.PLAYER.accel = 40.0;
            CONFIG.PLAYER.airAccel = 6.0;
            emit('hud:popup', {
              text: 'CHEAT DEACTIVATED (Velocidade Normal)',
              color: '#f77f00',
              duration: 1800
            });
            emit('cheat:activated', { cheat: 'gettherefast', active: false });
          }
        }
      }

      // 1. Previne atalhos perigosos do Chrome quando o mouse está capturado no jogo
      // Ctrl+W (fecha aba), Ctrl+A (seleciona tudo), Ctrl+S (salva), Ctrl+D (favoritos), etc.
      if (this.locked) {
        if (e.ctrlKey || e.metaKey || ['ControlLeft','ControlRight','AltLeft','AltRight','Tab'].includes(e.code)) {
          if (!['F12','F5','F11'].includes(e.code)) {
            e.preventDefault();
          }
        }
      }

      const action = this.bindings[e.code];
      if (action) {
        if (!this.actions[action]) this._actionQueue.add(action); // Registra apenas no primeiro frame
        this.actions[action] = true;
        e.preventDefault();
      }
    });

    addEventListener('keyup', e => {
      if (this.locked && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }
      const action = this.bindings[e.code];
      if (action) {
        this.actions[action] = false;
        this._actionQueue.delete(action);
        e.preventDefault();
      }
    });

    addEventListener('blur', () => {
      for (const key in this.actions) this.actions[key] = false;
      this._actionQueue.clear();
    });

    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });

    addEventListener('mousedown', e => {
      if (!this.locked) return;
      const code = `Mouse${e.button}`;
      const action = this.bindings[code];
      if (action) {
        if (!this.actions[action]) this._actionQueue.add(action);
        this.actions[action] = true;
      }
    });

    addEventListener('mouseup', e => {
      const code = `Mouse${e.button}`;
      const action = this.bindings[code];
      if (action) {
        this.actions[action] = false;
        this._actionQueue.delete(action);
      }
    });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      emit('input:lock', this.locked);
    });
  }

  async requestLock() { 
    if (this.isMobile) {
      this.locked = true;
      emit('input:lock', true);
      return;
    }
    try {
      await this.canvas.requestPointerLock?.(); 
      // API nativa do Chrome para jogos em tela cheia/captura: bloqueia atalhos de navegador
      if (navigator.keyboard && navigator.keyboard.lock) {
        navigator.keyboard.lock(['ControlLeft', 'ControlRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR']).catch(() => {});
      }
    } catch (err) {
      console.warn('Pointer lock falhou:', err);
    }
  }

  /**
   * Consome o movimento do mouse / touchpad touch neste frame.
   */
  consumeMouseDelta() {
    const d = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; 
    this.mouse.dy = 0;
    return d;
  }

  /**
   * Consome uma ação discreta (ex: clique para atirar em arma semi-automática).
   */
  consumeAction(actionName) {
    if (this._actionQueue.has(actionName)) {
      this._actionQueue.delete(actionName);
      return true;
    }
    return false;
  }
}