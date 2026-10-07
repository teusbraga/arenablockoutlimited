import { emit } from './EventBus.js';
import { TouchInput } from './TouchInput.js';
import { CONFIG } from './ConfigLoader.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.locked = false;
    
    // Estado raw do mouse para cálculos de câmera
    this.mouse = { dx: 0, dy: 0 };
    
    // Mapeamento canônico (Godot style) e compatibilidade legada
    this.ACTION_ALIASES = {
      'move_forward': 'forward',
      'move_back': 'backward',
      'move_left': 'left',
      'move_right': 'right',
      'jump': 'jump',
      'sprint': 'sprint',
      'crouch': 'crouch',
      'fire': 'fire',
      'ads': 'ads',
      'reload': 'reload',
      'next_weapon': 'nextWeapon',
      'nextWeapon': 'nextWeapon',
      'slot_1': 'slot1',
      'slot1': 'slot1',
      'slot_2': 'slot2',
      'slot2': 'slot2',
      'interact': 'interact',
      'toggle_fire_mode': 'toggleFireMode',
      'toggleFireMode': 'toggleFireMode',
      'lean_left': 'leanLeft',
      'leanLeft': 'leanLeft',
      'lean_right': 'leanRight',
      'leanRight': 'leanRight'
    };

    // Mapeamento de botões físicos para ações canônicas
    this.bindings = {
      'KeyW': 'move_forward', 'ArrowUp': 'move_forward',
      'KeyS': 'move_back', 'ArrowDown': 'move_back',
      'KeyA': 'move_left', 'ArrowLeft': 'move_left',
      'KeyD': 'move_right', 'ArrowRight': 'move_right',
      'Space': 'jump',
      'ShiftLeft': 'sprint',
      'ShiftRight': 'sprint',
      'KeyC': 'crouch',
      'Mouse0': 'fire',
      'Mouse2': 'ads',
      'KeyR': 'reload',
      'KeyQ': 'lean_left',
      'KeyE': 'lean_right',
      'Digit1': 'slot_1',
      'Digit2': 'slot_2',
      'KeyF': 'interact',
      'KeyB': 'toggle_fire_mode',
      'KeyV': 'toggle_fire_mode'
    };

    // Estado atual das intenções (ações contínuas) - Proxy transparente para retrocompatibilidade
    this._actionsRaw = {
      forward: false, backward: false, left: false, right: false,
      jump: false, sprint: false, crouch: false,
      fire: false, ads: false, reload: false, nextWeapon: false,
      slot1: false, slot2: false, interact: false, toggleFireMode: false,
      leanLeft: false, leanRight: false
    };

    // Cria Proxy em this.actions para aceitar tanto snake_case quanto camelCase
    this.actions = new Proxy(this._actionsRaw, {
      get: (target, prop) => {
        const canonical = this._toInternalKey(prop);
        return !!target[canonical];
      },
      set: (target, prop, value) => {
        const canonical = this._toInternalKey(prop);
        target[canonical] = !!value;
        return true;
      }
    });

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

  _toInternalKey(actionName) {
    if (typeof actionName !== 'string') return actionName;
    return this.ACTION_ALIASES[actionName] || actionName;
  }

  /**
   * Godot standard: Retorna true se a ação está atualmente pressionada.
   * @param {string} actionName
   * @returns {boolean}
   */
  isActionPressed(actionName) {
    const key = this._toInternalKey(actionName);
    return !!this._actionsRaw[key];
  }

  /**
   * Godot standard: Retorna true apenas no frame em que a ação foi disparada.
   * Consome o evento da fila (action buffer).
   * @param {string} actionName
   * @returns {boolean}
   */
  isActionJustPressed(actionName) {
    return this.consumeAction(actionName);
  }

  /**
   * Registra ativação de uma ação
   * @param {string} actionName
   */
  pressAction(actionName) {
    const key = this._toInternalKey(actionName);
    if (!this._actionsRaw[key]) {
      this._actionQueue.add(key);
    }
    this._actionsRaw[key] = true;
  }

  /**
   * Registra liberação de uma ação
   * @param {string} actionName
   */
  releaseAction(actionName) {
    const key = this._toInternalKey(actionName);
    this._actionsRaw[key] = false;
    this._actionQueue.delete(key);
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
      if (this.locked) {
        if (e.ctrlKey || e.metaKey || ['ControlLeft','ControlRight','AltLeft','AltRight','Tab'].includes(e.code)) {
          if (!['F12','F5','F11'].includes(e.code)) {
            e.preventDefault();
          }
        }
      }

      const rawAction = this.bindings[e.code];
      if (rawAction) {
        this.pressAction(rawAction);
        e.preventDefault();
      }
    });

    addEventListener('keyup', e => {
      if (this.locked && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }
      const rawAction = this.bindings[e.code];
      if (rawAction) {
        this.releaseAction(rawAction);
        e.preventDefault();
      }
    });

    addEventListener('blur', () => {
      for (const key in this._actionsRaw) this._actionsRaw[key] = false;
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
      const rawAction = this.bindings[code];
      if (rawAction) {
        this.pressAction(rawAction);
      }
    });

    addEventListener('mouseup', e => {
      const code = `Mouse${e.button}`;
      const rawAction = this.bindings[code];
      if (rawAction) {
        this.releaseAction(rawAction);
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
    const key = this._toInternalKey(actionName);
    if (this._actionQueue.has(key)) {
      this._actionQueue.delete(key);
      return true;
    }
    return false;
  }
}