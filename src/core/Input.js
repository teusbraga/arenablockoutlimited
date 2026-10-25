import { emit, on } from './EventBus.js';
import { TouchInput } from './TouchInput.js';
import { CONFIG } from './ConfigLoader.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.locked = false;
    this.roundOver = false;
    this.inventoryOpen = false;
    
    // Estado raw do mouse para cálculos de câmera
    this.mouse = { dx: 0, dy: 0 };
    this._unsubs = [];
    
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
      'leanRight': 'leanRight',
      'throw_smoke': 'throwSmoke',
      'throwSmoke': 'throwSmoke',
      'toggle_inventory': 'toggleInventory',
      'toggleInventory': 'toggleInventory',
      'reload_speed': 'reload_speed',
      'reload_tactical': 'reload_tactical',
      'reload_tap': 'reload_speed',
      'reload_hold': 'reload_tactical',
      'qte_interact': 'qte_interact'
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
      'KeyU': 'throw_smoke',
      'KeyI': 'toggle_inventory'
    };

    // Estado atual das intenções (ações contínuas) - Proxy transparente para retrocompatibilidade
    this._actionsRaw = {
      forward: false, backward: false, left: false, right: false,
      jump: false, sprint: false, crouch: false,
      fire: false, ads: false, reload: false, nextWeapon: false,
      slot1: false, slot2: false, interact: false, toggleFireMode: false,
      leanLeft: false, leanRight: false, throwSmoke: false,
      toggleInventory: false
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
    this._qteActive = false;
    this._ignoreNextReloadRelease = false;

    this._bind();

    // Inicializa suporte tátil para Mobile
    this.touch = new TouchInput(this);

    if (typeof window !== 'undefined') {
      window.cheat = (name) => this.triggerCheat(name);
      window.whoami = () => this.triggerCheat('whoami');
    }
  }

  triggerCheat(cheatName) {
    const code = (cheatName || '').toLowerCase().trim();
    if (code === 'whoami') {
      emit('cheat:activated', { cheat: 'whoami' });
    } else if (code === 'gettherefast') {
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
    } else if (code === 'professionalkiller') {
      CONFIG.CHEATS = CONFIG.CHEATS || {};
      CONFIG.CHEATS.infiniteAmmo = !CONFIG.CHEATS.infiniteAmmo;
      const active = CONFIG.CHEATS.infiniteAmmo;
      emit('hud:popup', {
        text: active ? '⚡ CHEAT ACTIVATED: PROFESSIONALKILLER (Munição Infinita)' : 'CHEAT DEACTIVATED (Munição Normal)',
        color: active ? '#06d6a0' : '#f77f00',
        duration: active ? 2200 : 1800
      });
      emit('cheat:activated', { cheat: 'professionalkiller', active });
    } else if (code === 'baguvix') {
      CONFIG.CHEATS = CONFIG.CHEATS || {};
      CONFIG.CHEATS.godMode = !CONFIG.CHEATS.godMode;
      const active = CONFIG.CHEATS.godMode;
      emit('hud:popup', {
        text: active ? '⚡ CHEAT ACTIVATED: BAGUVIX (Modo Deus / Imortal)' : 'CHEAT DEACTIVATED (Modo Normal)',
        color: active ? '#06d6a0' : '#f77f00',
        duration: active ? 2200 : 1800
      });
      emit('cheat:activated', { cheat: 'baguvix', active });
    }
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
    if (key === 'reload') {
      this._actionsRaw.reload = true;
      if (this._qteActive) {
        // Durante o minigame QTE, o toque em R aciona estritamente a agulha de timing
        this._actionQueue.add('qte_interact');
        this._ignoreNextReloadRelease = true;
        if (this._rHoldTimer) {
          clearTimeout(this._rHoldTimer);
          this._rHoldTimer = null;
        }
        return;
      }

      this._actionQueue.add('qte_interact');
      if (!this._rHoldTimer && !this._rHoldFired) {
        this._rHoldTimer = setTimeout(() => {
          this._rHoldTimer = null;
          if (this._actionsRaw.reload) {
            this._rHoldFired = true;
            this._actionQueue.add('reload_tactical');
            this._actionQueue.add('reload_hold');
          }
        }, 250);
      }
      return;
    }

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
    if (key === 'reload') {
      this._actionsRaw.reload = false;
      this._actionQueue.delete('reload');
      if (this._rHoldTimer) {
        clearTimeout(this._rHoldTimer);
        this._rHoldTimer = null;
      }
      if (this._ignoreNextReloadRelease) {
        this._ignoreNextReloadRelease = false;
        this._rHoldFired = false;
        return;
      }
      if (!this._rHoldFired) {
        this._actionQueue.add('reload_speed');
        this._actionQueue.add('reload_tap');
        this._actionQueue.add('reload');
      }
      this._rHoldFired = false;
      return;
    }

    this._actionsRaw[key] = false;
    this._actionQueue.delete(key);
  }

  /**
   * Limpa ações de recarga pendentes para evitar múltiplos disparos ou loops
   */
  clearReloadQueue() {
    this._actionQueue.delete('reload');
    this._actionQueue.delete('reload_speed');
    this._actionQueue.delete('reload_tap');
    this._actionQueue.delete('reload_tactical');
    this._actionQueue.delete('reload_hold');
    this._actionQueue.delete('qte_interact');
    if (this._rHoldTimer) {
      clearTimeout(this._rHoldTimer);
      this._rHoldTimer = null;
    }
    this._rHoldFired = false;
    this._ignoreNextReloadRelease = false;
  }

  /**
   * Limpa imediatamente o estado residual de mouse e teclado (evita disparos/movimentos fantasmas ao abrir menus)
   */
  clearState() {
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.clearReloadQueue();
    for (const key in this._actionsRaw) this._actionsRaw[key] = false;
    this._actionQueue.clear();
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }
    if (this.touch && typeof this.touch.destroy === 'function') {
      this.touch.destroy();
    }
  }

  _bind() {
    this._unsubs.push(
      on('weapon:qte:start', () => {
        this._qteActive = true;
      }),
      on('weapon:qte:result', () => {
        this._qteActive = false;
      }),
      on('weapon:qte:stop', () => {
        this._qteActive = false;
      }),
      on('weapon:reload:end', () => {
        this._qteActive = false;
        this.clearReloadQueue();
      }),
      on('round:over', () => {
        this.roundOver = true;
        this.locked = false;
        this.clearState();
        if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock?.();
        emit('input:lock', { locked: false });
      }),
      on('game:reset', () => {
        this.roundOver = false;
        this.clearState();
      }),
      on('inventory:opened', () => {
        this.inventoryOpen = true;
        this.locked = false;
        this.clearState();
        if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock?.();
        emit('input:lock', { locked: false });
      }),
      on('inventory:closed', () => {
        this.inventoryOpen = false;
        this.clearState();
      })
    );

    if (typeof addEventListener !== 'function') return;

    addEventListener('keydown', e => {
      // Cheat code detection (ex: GETTHEREFAST, PROFESSIONALKILLER, BAGUVIX, WHOAMI)
      // Restrito ao buffer de teclas somente quando CONFIG.DEV_MODE estiver ativo
      if (CONFIG.DEV_MODE && e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        this._cheatBuffer = ((this._cheatBuffer || '') + e.key.toLowerCase()).slice(-20);
        if (this._cheatBuffer.endsWith('gettherefast')) {
          this._cheatBuffer = '';
          this.triggerCheat('gettherefast');
        } else if (this._cheatBuffer.endsWith('professionalkiller')) {
          this._cheatBuffer = '';
          this.triggerCheat('professionalkiller');
        } else if (this._cheatBuffer.endsWith('baguvix')) {
          this._cheatBuffer = '';
          this.triggerCheat('baguvix');
        } else if (this._cheatBuffer.endsWith('whoami')) {
          this._cheatBuffer = '';
          this.triggerCheat('whoami');
          // Ao completar o cheat 'whoami', previne a tecla 'I' de acionar o inventário tático
          e.preventDefault();
          return;
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
        if (e.repeat && e.code === 'KeyR') {
          e.preventDefault();
          return;
        }
        const isInventoryKey = e.code === 'KeyI';
        if ((this.locked && !this.roundOver && !this.inventoryOpen) || (isInventoryKey && !this.roundOver)) {
          this.pressAction(rawAction);
          e.preventDefault();
        }
      }
    });

    addEventListener('keyup', e => {
      if (this.locked && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }
      const rawAction = this.bindings[e.code];
      if (rawAction) {
        this.releaseAction(rawAction);
        if (this.locked) e.preventDefault();
      }
    });

    addEventListener('blur', () => {
      this.clearState();
    });

    addEventListener('mousemove', e => {
      if (!this.locked || this.roundOver || this.inventoryOpen) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });

    addEventListener('mousedown', e => {
      if (!this.locked || this.roundOver || this.inventoryOpen) return;
      const code = `Mouse${e.button}`;
      const rawAction = this.bindings[code];
      if (rawAction) {
        this.pressAction(rawAction);
      }
    });

    // Re-captura automática do mouse caso o jogador clique diretamente no canvas e nenhum menu esteja bloqueando
    this.canvas.addEventListener('mousedown', () => {
      if (!this.locked && !this.roundOver && !this.inventoryOpen) {
        const overlay = document.getElementById('overlay');
        if (!overlay || overlay.classList.contains('hidden')) {
          this.requestLock();
        }
      }
    });

    addEventListener('mouseup', e => {
      const code = `Mouse${e.button}`;
      const rawAction = this.bindings[code];
      if (rawAction) {
        this.releaseAction(rawAction);
      }
    });

    this.canvas?.addEventListener?.('contextmenu', e => e.preventDefault());

    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', () => {
        this.locked = (document.pointerLockElement === this.canvas) && !this.roundOver && !this.inventoryOpen;
        if (!this.locked) {
          this.clearState();
        }
        emit('input:lock', { locked: this.locked });
      });
    }
  }

  async requestLock() { 
    if (this.roundOver || this.inventoryOpen) return;
    if (this.isMobile) {
      this.locked = true;
      emit('input:lock', { locked: true });
      return;
    }
    if (document.pointerLockElement === this.canvas) {
      this.locked = true;
      emit('input:lock', { locked: true });
      return;
    }
    try {
      await this.canvas.requestPointerLock?.(); 
      // API nativa do Chrome para jogos em tela cheia/captura: bloqueia atalhos de navegador
      if (navigator.keyboard && navigator.keyboard.lock) {
        navigator.keyboard.lock(['ControlLeft', 'ControlRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR']).catch(() => {});
      }
    } catch (err) {
      console.warn('Pointer lock falhou (possível cooldown de ESC):', err);
      this.locked = false;
      this.clearState();
      emit('input:lock', { locked: false });
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
