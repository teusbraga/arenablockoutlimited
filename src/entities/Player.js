import * as THREE from 'three';
import { Character } from './Character.js';
import { CONFIG } from '../core/ConfigLoader.js';
import { emit, on } from '../core/EventBus.js';
import { CameraRig } from '../core/CameraRig.js';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();

export class Player extends Character {
  constructor(world, bounds, spawnPos = [0, 0.1, 10]) {
    super(world);
    this.bounds = bounds;
    this.spawnPos = spawnPos;
    this.pos.set(spawnPos[0], spawnPos[1], spawnPos[2]);
    this.size.set(0.6, CONFIG.PLAYER.height, 0.6);

    // Instancia o CameraRig (Layer 1 da câmera)
    this.rig = new CameraRig();
    this.rig.setOrientation(this._yaw || 0, 0);

    this.sprinting = false;
    this.crouched = false;
    this.ads = false;
    this.lastDamageTime = -999;
    this.stepTimer = 0;
    this.respawnTimer = 0;
    this.crouchAmount = 0;

    // Escuta evento de ADS para garantir sincronismo
    this._unsubAds = on('player:ads', e => {
      this.ads = !!e.ads;
    });
  }

  destroy() {
    if (this._unsubAds) {
      this._unsubAds();
      this._unsubAds = null;
    }
  }

  get yaw() {
    return this.rig ? this.rig.currentYaw : (this._yaw || 0);
  }
  set yaw(v) {
    if (this.rig) {
      this.rig.setYaw(v);
    } else {
      this._yaw = v;
    }
  }

  get pitch() {
    return this.rig ? this.rig.currentPitch : (this._pitch || 0);
  }
  set pitch(v) {
    if (this.rig) {
      this.rig.setPitch(v);
    } else {
      this._pitch = v;
    }
  }

  get eyeHeight() {
    return this.rig ? this.rig.eyeHeight : CONFIG.PLAYER.eyeHeight;
  }
  set eyeHeight(v) {
    if (this.rig) this.rig.eyeHeight = v;
  }

  update(dt, input) {
    this.savePreviousState();

    // ---- Respawn Timer (quando morto) ----
    if (!this.alive && this.respawnTimer > 0) {
      const prevSecond = Math.ceil(this.respawnTimer);
      this.respawnTimer -= dt;
      const currentSecond = Math.ceil(this.respawnTimer);
      if (currentSecond > 0 && currentSecond !== prevSecond) {
        emit('player:respawn_tick', currentSecond);
      }
      if (this.respawnTimer <= 0) {
        this.respawnTimer = 0;
        this.respawn();
      }
    }

    // ---- Look & Input (só se estiver vivo) ----
    if (this.alive) {
      // Atualiza ADS imediatamente com a ação do botão direito do mouse
      if (input) {
        this.ads = input.isActionPressed ? input.isActionPressed('ads') : !!input.actions?.ads;
      }

      const { dx, dy } = input.consumeMouseDelta();
      const scopeMul = (this.customSensMul !== undefined) ? this.customSensMul : 1.0;
      const sens = CONFIG.CAMERA.sens * (CONFIG.CAMERA.sensMultiplier || 1.0) * (this.ads ? CONFIG.CAMERA.adsSensMul : 1) * scopeMul;
      this.rig.addMouseInput(dx, dy, sens);

      _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _wish.set(0, 0, 0);
      
      const isPressed = (action) => input.isActionPressed ? input.isActionPressed(action) : !!input.actions?.[action];
      if (isPressed('move_forward')) _wish.add(_fwd);
      if (isPressed('move_back')) _wish.sub(_fwd);
      if (isPressed('move_right')) _wish.add(_right);
      if (isPressed('move_left')) _wish.sub(_right);

      this.sprinting = isPressed('sprint') && _wish.lengthSq() > 0 && !this.ads && !this.crouched;
      this.crouched = isPressed('crouch');

      // Pulo
      if (isPressed('jump') && this.onGround) {
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
    if (this.sprinting) {
      speed *= CONFIG.PLAYER.sprintMul;
    } else if (this.crouched || this.ads) {
      // Valor fixo de 0.5x tanto no agachado quanto no ADS, sem acumular
      speed *= 0.5;
    }

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

    // ---- Atualização do subsistema de armas acoplado ----
    this.updateWeapons(dt);
  }

  updateCamera(camera, dt) {
    this.rig.update(dt, this);
    this.rig.applyToCamera(camera);
  }

  takeDamage(dmg, source) {
    if (!this.alive) return;
    this.lastDamageTime = performance.now() / 1000;
    
    // Flinch impact no rig
    this.rig.addFlinch(Math.random() * 0.06 + 0.04, (Math.random() - 0.5) * 0.1);

    super.takeDamage(dmg);
    emit('player:hp', { hp: this.hp, max: this.maxHp });
    emit('player:damaged', { dmg, source, playerPos: this.pos.clone() });
  }

  die() {
    super.die();
    emit('player:died');
    
    // Morte dura 3 segundos antes do respawn, controlada no loop update(dt)
    this.respawnTimer = 3.0;
    emit('player:respawn_tick', 3);
  }

  respawn() {
    super.respawn();
    this.respawnTimer = 0;
    if (this.spawnPos) {
      this.pos.set(this.spawnPos[0], this.spawnPos[1], this.spawnPos[2]);
    } else {
      this.pos.set(0, 0.1, 12);
    }
    this.rig.reset();
    emit('player:hp', { hp: this.hp, max: this.maxHp });
    emit('player:respawn');
  }
}