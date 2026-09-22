import { emit } from './EventBus.js';
import { TouchInput } from './TouchInput.js';

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
      'ControlLeft': 'crouch',
      'Mouse0': 'fire',
      'Mouse2': 'ads',
      'KeyR': 'reload',
      'KeyQ': 'nextWeapon',
      'Digit1': 'slot1',
      'Digit2': 'slot2',
      'KeyE': 'interact'
    };

    // Estado atual das intenções (ações contínuas)
    this.actions = {
      forward: false, backward: false, left: false, right: false,
      jump: false, sprint: false, crouch: false,
      fire: false, ads: false, reload: false, nextWeapon: false,
      slot1: false, slot2: false, interact: false
    };

    // Fila de intenções (ações discretas - one shot click)
    this._actionQueue = new Set();

    this._bind();

    // Inicializa suporte tátil para Mobile
    this.touch = new TouchInput(this);
  }

  get isMobile() {
    return this.touch?.isMobile || false;
  }

  _bind() {
    addEventListener('keydown', e => {
      const action = this.bindings[e.code];
      if (action) {
        if (!this.actions[action]) this._actionQueue.add(action); // Registra apenas no primeiro frame
        this.actions[action] = true;
      }
      if (['Space','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyR','Digit1','Digit2'].includes(e.code)) e.preventDefault();
    });

    addEventListener('keyup', e => {
      const action = this.bindings[e.code];
      if (action) this.actions[action] = false;
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
      if (action) this.actions[action] = false;
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