import { Character } from './Character.js';
import { CONFIG } from '../core/ConfigLoader.js';
import { AIController } from '../ai/AIController.js';
import { CharacterView } from '../view/CharacterView.js';
import { emit, on, off } from '../core/EventBus.js';

const SOLDIER_CALLSIGNS = [
  'Viper', 'Ghost', 'Specter', 'Bravo', 'Nomad',
  'Apex', 'Razor', 'Hunter', 'Falcon', 'Titan',
  'Hawk', 'Shadow', 'Sable', 'Phantom', 'Havoc',
  'Reaper', 'Cobra', 'Wolf', 'Striker', 'Echo'
];

const GHOST_CALLSIGNS = [
  'Phantom', 'Specter', 'Wraith', 'Blinky', 'Pinky',
  'Inky', 'Clyde', 'Spook', 'Shade', 'Banshee',
  'Mirage', 'Polter', 'Mist', 'Gloom', 'Haunt'
];

export class Bot extends Character {
  static skinType = 'soldier'; // 'soldier' | 'ghost'

  constructor(id, world, scene = null, skinType = Bot.skinType, weaponId = 'ar15') {
    super(world);
    this.id = id;
    this.botNumber = `#${String(id).padStart(2, '0')}`;
    this.skinType = skinType;
    this.weaponId = weaponId;
    this.pitch = 0;
    this.lastAttacker = null;

    if (skinType === 'ghost') {
      this.skinBadge = '👻';
      this.callsign = GHOST_CALLSIGNS[(id - 1) % GHOST_CALLSIGNS.length] || `Ghost_${id}`;
    } else {
      this.skinBadge = '🪖';
      this.callsign = SOLDIER_CALLSIGNS[(id - 1) % SOLDIER_CALLSIGNS.length] || `Soldier_${id}`;
    }
    this.name = `${this.botNumber} ${this.callsign}`;

    this.size.set(0.8, 1.7, 0.8);
    this.respawnTimer = 0;
    this.lean = 0;
    this.targetLean = 0;
    this.ai = new AIController(this, world);

    // Desacoplamento da View Three.js
    this.view = scene ? new CharacterView(this, scene, { id, skinType }) : null;

    this._bindEvents();
  }

  // Compatibilidade com código legado que acessa bot.root diretamente
  get root() {
    return this.view ? this.view.root : null;
  }

  get body() {
    return this.view ? this.view.body : null;
  }

  get head() {
    return this.view ? this.view.head : null;
  }

  _bindEvents() {
    this._onFired = (e) => {
      if (e.bot === this && this.view) {
        this.view.triggerFlash();
      }
    };
    on('bot:fired', this._onFired);
  }

  update(dt, player) {
    this.savePreviousState();
    if (!this.alive) return;

    this.ai.update(dt, player);

    // Interpolação suave do lean do bot
    this.lean += ((this.targetLean || 0) - this.lean) * Math.min(dt * 10, 1);

    // Aplica física unificada
    this.applyPhysics(dt, CONFIG.PLAYER?.stepHeight || 0.35);

    // Atualiza representação visual (se acoplada)
    if (this.view) {
      // Movido para renderUpdate
    }
  }

  renderUpdate(alpha, dt) {
    if (!this.alive) {
      if (this.view) this.view.root.visible = false;
      return;
    }
    this.interpolatePosition(alpha);
    if (this.view) {
      this.view.update(dt);
    }
  }

  takeDamage(dmg, part, attacker = null) {
    if (!this.alive) return false;
    this.lastHitPart = part;
    this.lastAttacker = attacker || null;
    const died = super.takeDamage(dmg);
    emit('bot:damaged', { bot: this, dmg, part, attacker: this.lastAttacker });
    return died;
  }

  die() {
    super.die();
    this.lean = 0;
    this.targetLean = 0;
    this.pitch = 0;
    if (this.view?.root) {
      this.view.root.visible = false;
    }
    emit('bot:died', {
      bot: this,
      headshot: this.lastHitPart === 'head',
      attacker: this.lastAttacker
    });
  }

  respawn() {
    super.respawn();
    this.lean = 0;
    this.targetLean = 0;
    if (this.view?.root) {
      this.view.root.visible = true;
    }
  }

  destroy() {
    if (this._onFired) {
      off('bot:fired', this._onFired);
      this._onFired = null;
    }

    if (this.ai) {
      this.ai.destroy();
      this.ai = null;
    }

    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  /** Retorna as malhas de hitbox ativas */
  hittables() {
    if (!this.alive || !this.view) return [];
    const list = [];
    if (this.view.body) list.push(this.view.body);
    if (this.view.head) list.push(this.view.head);
    return list;
  }
}