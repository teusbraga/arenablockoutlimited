import * as THREE from 'three';
import { Character } from './Character.js';
import { CONFIG } from '../core/Config.js';
import { AIController } from '../ai/AIController.js';
import { emit } from '../core/EventBus.js';

const GHOST_COLORS = [
  0xff1e1e, // Blinky (Vermelho)
  0xff85d0, // Pinky (Rosa)
  0x00f0ff, // Inky (Ciano)
  0xff9900, // Clyde (Laranja)
];

export class Bot extends Character {
  static skinType = 'ghost'; // 'ghost' | 'soldier'

  constructor(id, world, scene, skinType = Bot.skinType) {
    super(world);
    this.id = id;
    this.scene = scene;
    this.skinType = skinType;
    this.size.set(0.8, 1.7, 0.8);
    this.respawnTimer = 0;
    this.floatTime = Math.random() * 10;
    this.ai = new AIController(this, world);
    this._buildMesh();
  }

  _buildMesh() {
    this.root = new THREE.Group();

    if (this.skinType === 'ghost') {
      // Cores icônicas do Pac-Man distribuídas entre os bots
      const color = GHOST_COLORS[(this.id - 1) % GHOST_COLORS.length];
      const ghostMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.32,
        metalness: 0.15,
      });

      // 1. Cúpula / Cabeça Arredondada (Head hitbox)
      this.head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), ghostMat);
      this.head.position.y = 1.38;
      this.head.castShadow = true;
      this.head.userData = { type: 'bot', bot: this, part: 'head' };

      // 2. Corpo Cilíndrico e Saia Ondulada (Body hitbox)
      this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.75, 16), ghostMat);
      this.body.position.y = 0.85;
      this.body.castShadow = true;
      this.body.userData = { type: 'bot', bot: this, part: 'body' };

      // Babados/pregas inferiores clássicas do Pac-Man
      for (let i = 0; i < 4; i++) {
        const skirtBrim = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ghostMat);
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
        skirtBrim.position.set(Math.cos(ang) * 0.28, 0.48, Math.sin(ang) * 0.28);
        this.root.add(skirtBrim);
      }

      // 3. Olhos Grandes Características do Pac-Man
      const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x0033cc });

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeWhiteMat);
      eyeL.position.set(-0.14, 1.40, 0.30);
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyePupilMat);
      pupilL.position.set(-0.14, 1.40, 0.37);

      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeWhiteMat);
      eyeR.position.set(0.14, 1.40, 0.30);
      const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyePupilMat);
      pupilR.position.set(0.14, 1.40, 0.37);

      this.root.add(this.body, this.head, eyeL, pupilL, eyeR, pupilR);

    } else {
      // Soldado tático militar blocky padrão
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
    }

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

    // Efeito de levitação suave para o fantasma
    let yOffset = 0;
    if (this.skinType === 'ghost') {
      this.floatTime += dt * 4.5;
      yOffset = Math.sin(this.floatTime) * 0.08 + 0.12;
    }

    // Sincroniza malha 3D
    this.root.position.set(this.pos.x, this.pos.y + yOffset, this.pos.z);
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