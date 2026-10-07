import { Character } from './Character.js';
import { AIController } from '../ai/AIController.js';
import { CharacterView } from '../view/CharacterView.js';
import { emit, on, off } from '../core/EventBus.js';

export class Bot extends Character {
  static skinType = 'soldier'; // 'soldier' | 'ghost'

  constructor(id, world, scene = null, skinType = Bot.skinType, weaponId = 'ar15') {
    super(world);
    this.id = id;
    this.skinType = skinType;
    this.weaponId = weaponId;
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
    this.applyPhysics(dt, 0.5);

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

  takeDamage(dmg, part) {
    if (!this.alive) return false;
    this.lastHitPart = part;
    const died = super.takeDamage(dmg);
    emit('bot:damaged', { bot: this, dmg, part });
    return died;
  }

  die() {
    super.die();
    this.lean = 0;
    this.targetLean = 0;
    if (this.view?.root) {
      this.view.root.visible = false;
    }
    emit('bot:died', { bot: this, headshot: this.lastHitPart === 'head' });
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