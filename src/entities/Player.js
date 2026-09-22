import * as THREE from 'three';
import { Character } from './Character.js';
import { CONFIG } from '../core/Config.js';
import { emit } from '../core/EventBus.js';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();

export class Player extends Character {
  constructor(world, bounds) {
    super(world);
    this.bounds = bounds;
    this.pos.set(0, 0.1, 10);
    this.size.set(0.6, CONFIG.PLAYER.height, 0.6);

    this.pitch = 0;
    this.sprinting = false;
    this.crouched = false;
    this.ads = false;
    this.lastDamageTime = -999;
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.stepTimer = 0;
    this.crouchAmount = 0;
    this.eyeHeight = CONFIG.PLAYER.eyeHeight;
  }

  update(dt, input) {
    // ---- Look & Input (só se estiver vivo) ----
    if (this.alive) {
      const { dx, dy } = input.consumeMouseDelta();
      const sens = CONFIG.CAMERA.sens * (CONFIG.CAMERA.sensMultiplier || 1.0) * (this.ads ? CONFIG.CAMERA.adsSensMul : 1);
      this.yaw -= dx * sens;
      this.pitch -= dy * sens;
      this.pitch = Math.max(-CONFIG.CAMERA.pitchLimit, Math.min(CONFIG.CAMERA.pitchLimit, this.pitch));

      _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _wish.set(0, 0, 0);
      if (input.actions.forward) _wish.add(_fwd);
      if (input.actions.backward) _wish.sub(_fwd);
      if (input.actions.right) _wish.add(_right);
      if (input.actions.left) _wish.sub(_right);

      this.sprinting = input.actions.sprint && _wish.lengthSq() > 0 && !this.ads && !this.crouched;
      this.crouched = input.actions.crouch;

      // Pulo
      if (input.actions.jump && this.onGround) {
        this.vel.y = CONFIG.PLAYER.jumpSpeed;
        this.onGround = false;
      }
    } else {
      _wish.set(0, 0, 0);
      this.sprinting = false;
      this.crouched = false;
      this.ads = false;
    }

    // ---- Velocidade alvo ----
    let speed = CONFIG.PLAYER.walkSpeed;
    if (this.sprinting) speed *= CONFIG.PLAYER.sprintMul;
    if (this.crouched) speed *= CONFIG.PLAYER.crouchMul;
    if (this.ads) speed *= CONFIG.PLAYER.adsMul;

    // ---- Aceleração e Atrito ----
    if (this.alive && _wish.lengthSq() > 0) {
      _wish.normalize().multiplyScalar(speed);
      const k = Math.min((this.onGround ? CONFIG.PLAYER.accel : CONFIG.PLAYER.airAccel) * dt, 1);
      this.vel.x += (_wish.x - this.vel.x) * k;
      this.vel.z += (_wish.z - this.vel.z) * k;
    } else if (this.onGround) {
      const k = Math.min(CONFIG.PLAYER.friction * dt, 1);
      this.vel.x -= this.vel.x * k;
      this.vel.z -= this.vel.z * k;
    }

    // Interpola altura do corpo (para colisão bater com a animação de agachar)
    // Se morto, força a altura para o chão
    const targetCrouch = !this.alive ? 1.5 : (this.crouched ? 1 : 0);
    this.crouchAmount += (targetCrouch - this.crouchAmount) * Math.min(dt * 12, 1);
    this.size.y = Math.max(0.2, CONFIG.PLAYER.height + (CONFIG.PLAYER.crouchHeight - CONFIG.PLAYER.height) * this.crouchAmount);

    // ---- Aplica Física Unificada ----
    this.applyPhysics(dt, CONFIG.PLAYER.stepHeight);

    // ---- Limites do mapa ----
    const [minX, maxX, minZ, maxZ] = this.bounds;
    this.pos.x = Math.max(minX, Math.min(maxX, this.pos.x));
    this.pos.z = Math.max(minZ, Math.min(maxZ, this.pos.z));

    // ---- Passos sonoros ----
    const speedXZ = Math.hypot(this.vel.x, this.vel.z);
    if (this.alive && this.onGround && speedXZ > 1) {
      this.stepTimer -= dt;
      const interval = this.sprinting ? 0.30 : (this.crouched ? 0.55 : 0.42);
      if (this.stepTimer <= 0) {
        this.stepTimer = interval;
        emit('player:footstep', { pos: this.pos.clone() });
      }
    } else {
      this.stepTimer = 0;
    }

    // ---- Regeneração de Vida ----
    const now = performance.now() / 1000;
    if (this.alive && this.hp < this.maxHp && now - this.lastDamageTime > CONFIG.PLAYER.regenDelay) {
      this.hp = Math.min(this.maxHp, this.hp + CONFIG.PLAYER.regenRate * dt);
      emit('player:hp', { hp: this.hp, max: this.maxHp });
    }
  }

  updateCamera(camera, dt) {
    const speedXZ = Math.hypot(this.vel.x, this.vel.z);
    const isMoving = this.alive && this.onGround && speedXZ > 0.6;

    // Head bob
    if (isMoving) {
      const rate = 9 + (this.sprinting ? 5 : 0) - this.crouchAmount * 3;
      this.bobPhase += dt * rate;
      const target = (this.sprinting ? 0.045 : 0.032) * Math.min(speedXZ / CONFIG.PLAYER.walkSpeed, 1.8);
      this.bobAmt += (target - this.bobAmt) * Math.min(dt * 8, 1);
    } else {
      this.bobAmt += (0 - this.bobAmt) * Math.min(dt * 6, 1);
    }

    const bobY = Math.sin(this.bobPhase * 2) * this.bobAmt;
    const bobX = Math.cos(this.bobPhase) * this.bobAmt * 0.65;
    const bobRoll = Math.cos(this.bobPhase) * this.bobAmt * 0.18;
    const bobPitch = Math.sin(this.bobPhase * 2) * this.bobAmt * 0.08;

    // Se morto, deita a câmera no chão
    let targetEye = CONFIG.PLAYER.eyeHeight + (CONFIG.PLAYER.eyeCrouch - CONFIG.PLAYER.eyeHeight) * this.crouchAmount;
    if (!this.alive) targetEye = 0.2; 
    
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(dt * (this.alive ? 18 : 6), 1);

    // Flinch (Hit Impact)
    this.flinchPitch = (this.flinchPitch || 0) * Math.max(0, 1 - dt * 15);
    this.flinchYaw = (this.flinchYaw || 0) * Math.max(0, 1 - dt * 15);

    // Aplica à câmera
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let deathRoll = !this.alive ? -0.8 : 0; // Tomba a cabeça ao morrer
    this.currentRoll = (this.currentRoll || 0);
    this.currentRoll += (deathRoll - this.currentRoll) * Math.min(dt * 4, 1);

    camera.position.set(
      this.pos.x + bobX * rightX,
      this.pos.y + this.eyeHeight + bobY,
      this.pos.z + bobX * rightZ,
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw + this.flinchYaw;
    camera.rotation.x = this.pitch + bobPitch + this.flinchPitch;
    camera.rotation.z = bobRoll + this.currentRoll;
  }

  takeDamage(dmg, source) {
    if (!this.alive) return;
    this.lastDamageTime = performance.now() / 1000;
    
    // Flinch impact
    this.flinchPitch = (this.flinchPitch || 0) + (Math.random() * 0.06 + 0.04);
    this.flinchYaw = (this.flinchYaw || 0) + (Math.random() - 0.5) * 0.1;

    super.takeDamage(dmg);
    emit('player:hp', { hp: this.hp, max: this.maxHp });
    emit('player:damaged', { dmg, source, playerPos: this.pos.clone() });
  }

  die() {
    super.die();
    emit('player:died');
    
    // Morte dura 3 segundos antes do respawn
    let t = 3;
    const iv = setInterval(() => {
      t--;
      if (t > 0) {
        emit('player:respawn_tick', t);
      } else {
        clearInterval(iv);
        this.respawn();
      }
    }, 1000);
  }

  respawn() {
    super.respawn();
    this.pos.set(0, 0.1, 12);
    this.flinchPitch = 0;
    this.flinchYaw = 0;
    this.currentRoll = 0;
    this.pitch = 0;
    emit('player:hp', { hp: this.hp, max: this.maxHp });
    emit('player:respawn');
  }
}