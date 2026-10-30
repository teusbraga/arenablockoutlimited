import * as THREE from 'three';
import { Character } from './Character.js';
import { CONFIG } from '../core/ConfigLoader.js';
import { emit, on } from '../core/EventBus.js';
import { CameraRig } from '../core/CameraRig.js';
import { CharacterView } from '../view/CharacterView.js';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();

export class Player extends Character {
  constructor(world, bounds, spawnPos = [0, 0.1, 10], scene = null, spawnYaw = 0) {
    super(world);
    this.scene = scene;
    this.bounds = bounds;
    this.spawnPos = spawnPos;
    this.spawnYaw = (Array.isArray(spawnPos) && typeof spawnPos[3] === 'number') ? spawnPos[3] : (spawnYaw || 0);
    this.setPosition(spawnPos[0], spawnPos[1], spawnPos[2]);
    this.size.set(0.6, CONFIG.PLAYER.height, 0.6);

    // Instancia o CameraRig (Layer 1 da câmera)
    this.rig = new CameraRig();
    this.rig.setOrientation(this.spawnYaw || 0, 0);

    // Representação visual 3D em 3ª pessoa usando o Soldado Blocky tático
    this.skinType = 'soldier';
    this.view = scene ? new CharacterView(this, scene, { id: 1, skinType: 'soldier' }) : null;
    if (this.view?.root) {
      // Começa oculto em 1ª pessoa
      this.view.root.visible = false;
    }

    this.sprinting = false;
    this.crouched = false;
    this.ads = false;
    this.lastDamageTime = -999;
    this.sprintRecoveryTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.respawnTimer = 0;
    this.crouchAmount = 0;
    this.lean = 0;
    this.targetLean = 0;

    // Escuta evento de ADS para garantir sincronismo
    this._unsubAds = on('player:ads', e => {
      this.ads = !!e.ads;
    });

    this._unsubFired = on('weapon:fired', () => {
      if (this.view && this.isThirdPerson()) {
        this.view.triggerFlash();
      }
    });

    this._unsubCheat = on('cheat:activated', e => {
      if (e.cheat === 'baguvix' && e.active) {
        this.hp = this.maxHp;
        emit('player:hp', { hp: this.hp, max: this.maxHp });
      } else if (e.cheat === 'whoami') {
        this.togglePerspective();
      }
    });

    this._unsubHeal = on('player:heal', ({ amount }) => {
      if (!this.alive) return;
      this.hp = Math.min(this.maxHp, this.hp + (amount || 50));
      emit('player:hp', { hp: this.hp, max: this.maxHp });
    });
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
        emit('player:respawn_tick', { seconds: currentSecond, count: currentSecond });
      }
      if (this.respawnTimer <= 0) {
        this.respawnTimer = 0;
        this.respawn();
      }
    }

    // ---- Look & Input (só se estiver vivo) ----
    if (this.alive) {
      // Atualiza ADS imediatamente com a ação do botão direito do mouse (bloqueado em sprint e recuperação de postura)
      if (input) {
        const wantsAds = input.isActionPressed ? input.isActionPressed('ads') : !!input.actions?.ads;
        this.ads = wantsAds && !this.sprinting && !(this.sprintRecoveryTimer > 0);
      }

      const { dx, dy } = input.consumeMouseDelta();
      const scopeMul = (this.customSensMul !== undefined) ? this.customSensMul : 1.0;
      let sens = CONFIG.CAMERA.sens * (CONFIG.CAMERA.sensMultiplier || 1.0) * (this.ads ? CONFIG.CAMERA.adsSensMul : 1) * scopeMul;

      if (this.aimAssist) {
        const assist = this.aimAssist.computeAssist(dt, { player: this, input, dx, dy });
        sens *= assist.sensMultiplier;
        if (assist.deltaYaw !== 0) this.rig.addYaw(assist.deltaYaw);
        if (assist.deltaPitch !== 0) this.rig.addPitch(assist.deltaPitch);
      }

      this.rig.addMouseInput(dx, dy, sens);

      _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _wish.set(0, 0, 0);
      
      const isPressed = (action) => input.isActionPressed ? input.isActionPressed(action) : !!input.actions?.[action];
      if (isPressed('move_forward')) _wish.add(_fwd);
      if (isPressed('move_back')) _wish.sub(_fwd);
      if (isPressed('move_right')) _wish.add(_right);
      if (isPressed('move_left')) _wish.sub(_right);

      const wantsCrouch = isPressed('crouch');
      if (wantsCrouch) {
        this.crouched = true;
      } else if (this.crouched) {
        // Soltou a tecla de agachar: só levanta se houver espaço vertical livre
        const canStand = this.world?.hasHeadroom
          ? this.world.hasHeadroom(this.pos, this.size, CONFIG.PLAYER.height)
          : true;
        this.crouched = !canStand;
      } else {
        this.crouched = false;
      }

      // Sprint só é permitido com movimento para frente ou diagonais frontais
      const isMovingForward = _wish.dot(_fwd) > 0.01;
      const wantsSprint = isPressed('sprint') && _wish.lengthSq() > 0 && isMovingForward && !this.ads && !this.crouched;
      if (this.sprinting && !wantsSprint) {
        this.sprintRecoveryTimer = CONFIG.PLAYER.stanceRecoveryTime || 0.15;
      }
      this.sprinting = wantsSprint;
      if (this.sprintRecoveryTimer > 0) {
        this.sprintRecoveryTimer = Math.max(0, this.sprintRecoveryTimer - dt);
      }

      // Lean (Inclinação tática com Q / E) - Lerp único calibrado a 18/s
      const isLeanL = isPressed('lean_left');
      const isLeanR = isPressed('lean_right');
      if (isLeanL && !isLeanR) {
        this.targetLean = -1.0;
      } else if (isLeanR && !isLeanL) {
        this.targetLean = 1.0;
      } else {
        this.targetLean = 0.0;
      }
      this.lean += (this.targetLean - this.lean) * Math.min(dt * 18, 1);

      // Pulo com Coyote Time e Jump Buffer (ação discreta anti auto-bhop)
      let jumpJustPressed = false;
      if (typeof input.consumeAction === 'function') {
        jumpJustPressed = input.consumeAction('jump');
      } else if (typeof input.isActionJustPressed === 'function') {
        jumpJustPressed = input.isActionJustPressed('jump');
      } else if (input.actions && input.actions.jump) {
        jumpJustPressed = true;
        input.actions.jump = false;
      }

      if (jumpJustPressed) {
        this.jumpBufferTimer = CONFIG.PLAYER.jumpBuffer ?? 0.12;
      }

      if (this.onGround) {
        this.coyoteTimer = CONFIG.PLAYER.coyoteTime ?? 0.12;
      } else if (this.coyoteTimer > 0) {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (this.jumpBufferTimer > 0) {
        this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      }

      if (this.jumpBufferTimer > 0 && (this.onGround || this.coyoteTimer > 0)) {
        this.vel.y = CONFIG.PLAYER.jumpSpeed;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
    } else {
      _wish.set(0, 0, 0);
      this.sprinting = false;
      this.crouched = false;
      this.ads = false;
      this.sprintRecoveryTimer = 0;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.targetLean = 0;
      this.lean += (0 - this.lean) * Math.min(dt * 18, 1);
    }

    // ---- Velocidade alvo ----
    let speed = CONFIG.PLAYER.walkSpeed;

    // Multiplicador Direcional Tático (Elipsoide de Locomoção: Forward 1.0, Strafe 0.85, Backward 0.75)
    if (_wish.lengthSq() > 0.0001) {
      const wishLen = _wish.length();
      const dotFwd = _wish.dot(_fwd) / wishLen;
      const dotRight = _wish.dot(_right) / wishLen;
      const strafeMul = CONFIG.PLAYER.strafeMul ?? 0.85;
      const backwardMul = CONFIG.PLAYER.backwardMul ?? 0.75;
      const fwdFactor = dotFwd >= 0 ? 1.0 : backwardMul;
      const dirMul = Math.sqrt((dotFwd * fwdFactor) ** 2 + (dotRight * strafeMul) ** 2);
      speed *= dirMul;
    }

    if (this.sprinting) {
      speed *= (CONFIG.PLAYER.sprintMul ?? 1.62);
    } else if (this.crouched && this.ads) {
      // Menor multiplicador quando agachado e mirando simultaneamente
      speed *= Math.min(CONFIG.PLAYER.crouchMul ?? 0.5, CONFIG.PLAYER.adsMul ?? 0.48);
    } else if (this.crouched) {
      speed *= (CONFIG.PLAYER.crouchMul ?? 0.5);
    } else if (this.ads) {
      speed *= (CONFIG.PLAYER.adsMul ?? 0.48);
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

    // Interpola altura do corpo (normalizada entre 0 e 1)
    const targetCrouch = this.crouched ? 1.0 : 0.0;
    this.crouchAmount += (targetCrouch - this.crouchAmount) * Math.min(dt * 12, 1);
    this.crouchAmount = Math.max(0, Math.min(1.0, this.crouchAmount));
    this.size.y = Math.max(0.2, CONFIG.PLAYER.height + (CONFIG.PLAYER.crouchHeight - CONFIG.PLAYER.height) * this.crouchAmount);

    // ---- Aplica Física Unificada ----
    const prevVelY = this.vel.y;
    const wasOnGround = this.onGround;
    this.applyPhysics(dt, CONFIG.PLAYER.stepHeight);

    if (!wasOnGround && this.onGround && prevVelY < -3.0) {
      if (this.rig?.triggerLandingDip) {
        this.rig.triggerLandingDip(prevVelY);
      }
    }

    // ---- Limites do mapa ----
    const [minX, maxX, minZ, maxZ] = this.bounds;
    this.pos.x = Math.max(minX, Math.min(maxX, this.pos.x));
    this.pos.z = Math.max(minZ, Math.min(maxZ, this.pos.z));

    // ---- Regeneração de Vida ----
    const now = performance.now() / 1000;
    if (this.alive && this.hp < this.maxHp && now - this.lastDamageTime > CONFIG.PLAYER.regenDelay) {
      this.hp = Math.min(this.maxHp, this.hp + CONFIG.PLAYER.regenRate * dt);
      emit('player:hp', { hp: this.hp, max: this.maxHp });
    }

    // ---- Atualização do subsistema de armas acoplado ----
    this.updateWeapons(dt);
  }

  setAimAssist(aimAssist) {
    this.aimAssist = aimAssist;
  }

  isThirdPerson() {
    return this.rig?.isThirdPerson() ?? false;
  }

  togglePerspective() {
    if (!this.rig) return;
    const mode = this.rig.togglePerspective();
    const isThird = (mode === 'third');
    emit('player:perspective_changed', { mode, isThirdPerson: isThird });
    emit('hud:popup', {
      text: isThird ? '⚡ CHEAT ACTIVATED: WHOAMI (3ª Pessoa)' : 'CHEAT DEACTIVATED (1ª Pessoa)',
      color: isThird ? '#06d6a0' : '#f77f00',
      duration: isThird ? 2200 : 1800
    });
    return mode;
  }

  renderUpdate(alpha, dt) {
    if (this.view) {
      const show3rd = this.alive && (this.rig?.thirdPersonAmount > 0.05);
      this.view.root.visible = show3rd;
      if (show3rd) {
        this.view.update(dt);
      }
    }
  }

  updateCamera(camera, dt) {
    this.rig.update(dt, this);
    this.rig.applyToCamera(camera);

    // Passos sonoros 100% sincronizados com a fase cinemática da passada do CameraRig
    const speedXZ = Math.hypot(this.vel.x, this.vel.z);
    if (this.alive && this.onGround && speedXZ > 0.8 && this.rig.stepTriggered) {
      this.rig.stepTriggered = false;
      emit('player:footstep', { pos: this.pos.clone(), material: this.groundMaterial || 'floor' });
    }
  }

  takeDamage(dmg, source) {
    if (!this.alive) return;
    this.lastDamageTime = performance.now() / 1000;
    
    // Flinch impact no rig e indicador direcional mesmo se godMode estiver ativo
    this.rig.addFlinch(Math.random() * 0.06 + 0.04, (Math.random() - 0.5) * 0.1);
    emit('player:damaged', { dmg, source, playerPos: this.pos.clone() });

    if (CONFIG.CHEATS?.godMode) return;

    super.takeDamage(dmg);
    emit('player:hp', { hp: this.hp, max: this.maxHp });
  }

  die() {
    super.die();
    if (this.view?.root) {
      this.view.root.visible = false;
    }
    emit('player:died', {});
    
    // Morte dura 3 segundos antes do respawn, controlada no loop update(dt)
    this.respawnTimer = 3.0;
    emit('player:respawn_tick', { seconds: 3, count: 3 });
  }

  respawn() {
    super.respawn();
    this.respawnTimer = 0;
    if (this.spawnPos) {
      this.setPosition(this.spawnPos[0], this.spawnPos[1], this.spawnPos[2]);
    } else {
      this.setPosition(0, 0.1, 12);
    }
    this.rig.reset(this.spawnYaw || 0);
    this.rig.setOrientation(this.spawnYaw || 0, 0);
    this.lean = 0;
    this.targetLean = 0;
    if (this.view?.root) {
      this.view.root.visible = this.isThirdPerson();
    }
    emit('player:hp', { hp: this.hp, max: this.maxHp });
    emit('player:respawn', {});
  }

  setSoldierSkin(skinConfig) {
    this.soldierSkin = skinConfig;
    if (this.view) {
      this.view.applySoldierSkin(skinConfig);
    }
  }

  destroy() {
    if (this._unsubAds) {
      this._unsubAds();
      this._unsubAds = null;
    }
    if (this._unsubFired) {
      this._unsubFired();
      this._unsubFired = null;
    }
    if (this._unsubHeal) {
      this._unsubHeal();
      this._unsubHeal = null;
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }
}