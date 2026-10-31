import * as THREE from 'three';
import { CONFIG } from '../core/ConfigLoader.js';

const _delta = new THREE.Vector3();

export class Character {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.renderPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.size = new THREE.Vector3(0.6, 1.8, 0.6);
    this.onGround = false;
    this.isSliding = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.weaponManager = null;
  }

  savePreviousState() {
    this.prevPos.copy(this.pos);
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.renderPos.copy(this.pos);
  }

  interpolatePosition(alpha) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
  }

  setWeaponManager(weaponManager) {
    this.weaponManager = weaponManager;
    if (weaponManager) {
      weaponManager.player = this;
    }
  }

  updateWeapons(dt) {
    if (this.weaponManager) {
      this.weaponManager.update(dt);
    }
  }

  applyPhysics(dt, stepHeight = (CONFIG.PLAYER?.stepHeight || 0.35)) {
    // Gravidade e Escorregamento Físico (Slide Physics em superfícies > 45°)
    const g = CONFIG.PLAYER?.gravity || 20.0;
    if (this.lastMoveRes?.isSliding && this.lastMoveRes?.groundNormal) {
      const n = this.lastMoveRes.groundNormal;
      const slideAx = g * n.y * n.x;
      const slideAy = -g * (1.0 - n.y * n.y);
      const slideAz = g * n.y * n.z;

      this.vel.x += slideAx * dt;
      this.vel.y += slideAy * dt;
      this.vel.z += slideAz * dt;
      this.isSliding = true;
    } else {
      this.vel.y -= g * dt;
      this.isSliding = false;
    }

    // Integração e colisão com o mundo
    _delta.set(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    const res = this.world.moveAndSlide(this.pos, this.size, _delta, {
      stepHeight,
      maxWalkSlope: CONFIG.PLAYER?.maxWalkSlope ?? 0.7071
    });
    this.lastMoveRes = res;

    this.onGround = res.onGround;
    this.isSliding = res.isSliding;
    if (res.groundNormal) {
      this.groundNormal.set(res.groundNormal.x, res.groundNormal.y, res.groundNormal.z);
    }
    if (res.onGround && res.groundMaterial) {
      this.groundMaterial = res.groundMaterial;
    }
    if (res.onGround && this.vel.y < 0) this.vel.y = 0;
    if (res.hitCeiling && this.vel.y > 0) this.vel.y = 0;
    if (res.hitX && !res.isSliding) this.vel.x = 0;
    if (res.hitZ && !res.isSliding) this.vel.z = 0;

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
