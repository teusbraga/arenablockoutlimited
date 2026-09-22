import * as THREE from 'three';
import { Character } from './Character.js';
import { CONFIG } from '../core/Config.js';
import { AIController } from '../ai/AIController.js';
import { emit } from '../core/EventBus.js';

export class Bot extends Character {
  constructor(id, world, scene) {
    super(world);
    this.id = id;
    this.scene = scene;
    this.size.set(0.8, 1.7, 0.8);
    this.respawnTimer = 0;
    this.ai = new AIController(this, world);
    this._buildMesh();
  }

  _buildMesh() {
    this.root = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a2f28, roughness: 0.7 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5 });

    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.5), bodyMat);
    this.body.position.y = 0.55;
    this.body.castShadow = true;
    this.body.userData = { type: 'bot', bot: this, part: 'body' };

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), headMat);
    this.head.position.y = 1.42;
    this.head.castShadow = true;
    this.head.userData = { type: 'bot', bot: this, part: 'head' };

    this.root.add(this.body, this.head);
    this.scene.add(this.root);
  }

  update(dt, player) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn();
      return;
    }

    this.ai.update(dt, player);

    // Aplica física unificada
    this.applyPhysics(dt, 0.5);

    // Sincroniza malha 3D
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
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
    this.respawnTimer = CONFIG.BOTS.respawnTime;
    this.root.visible = false;
    emit('bot:died', { bot: this, headshot: this.lastHitPart === 'head' });
  }

  respawn() {
    super.respawn();
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 10;
    this.pos.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    this.root.visible = true;
    this.root.position.copy(this.pos);
  }

  /** Retorna as malhas de hitbox ativas */
  hittables() {
    return this.alive ? [this.body, this.head] : [];
  }
}