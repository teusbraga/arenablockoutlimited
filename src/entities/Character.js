import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

export class Character {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.size = new THREE.Vector3(0.6, 1.8, 0.6);
    this.onGround = false;
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
  }

  applyPhysics(dt, stepHeight = 0.5) {
    // Gravidade
    this.vel.y -= CONFIG.PLAYER.gravity * dt;

    // Integração e colisão com o mundo
    const delta = new THREE.Vector3(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    const res = this.world.moveAndSlide(this.pos, this.size, delta, { stepHeight });

    this.onGround = res.onGround;
    if (res.onGround && this.vel.y < 0) this.vel.y = 0;
    if (res.hitCeiling && this.vel.y > 0) this.vel.y = 0;
    if (res.hitX) this.vel.x = 0;
    if (res.hitZ) this.vel.z = 0;

    return res;
  }

  takeDamage(dmg) {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.alive = false;
  }

  respawn() {
    this.hp = this.maxHp;
    this.alive = true;
    this.vel.set(0, 0, 0);
  }
}
