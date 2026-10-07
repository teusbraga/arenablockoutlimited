import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { BallisticsCalculator } from './BallisticsCalculator.js';
import { ProjectileManager } from './ProjectileManager.js';
import { CONFIG } from '../core/ConfigLoader.js';
import { emit, on } from '../core/EventBus.js';

const _dir = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tempMuzzle = new THREE.Vector3();
const _tempEject = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _ejectWorld = new THREE.Vector3();
const _pelletDir = new THREE.Vector3();
const _impactPoint = new THREE.Vector3();
const _screenPos = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
const _forwardCopy = new THREE.Vector3();
const _rightCopy = new THREE.Vector3();
const _upCopy = new THREE.Vector3();
const _botHitPoint = new THREE.Vector3();
const _worldHitPoint = new THREE.Vector3();
const _smokeMuzzleWorld = new THREE.Vector3();
const _hittableMeshes = [];

export class WeaponSystem {
  constructor({ camera, viewmodel, input, player, world, botsProvider, inventory }) {
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.input = input;
    this.player = player;
    this.world = world;
    this.botsProvider = botsProvider;

    // Gerenciador de Projéteis Físicos e Balística Externa (CCD)
    this.projectileManager = new ProjectileManager({
      world: this.world,
      botsProvider: this.botsProvider,
      player: this.player,
      camera: this.camera
    });

    // Inventário tático limitado estritamente a 2 slots de armas
    const initialId = (inventory && inventory[0]) || 'ar15';
    this.slots = [initialId, (inventory && inventory[1]) || null];
    this.currentSlot = 0;
    this.current = null;
    this.ammo = 0;
    this.ammoByWeapon = {};
    this.reloading = false;
    this.reloadT = 0;
    this.fireCooldown = 0;
    this.adsAmount = 0;
    this.ads = false;
    this.lastShotTime = -10;

    this.raycaster = new THREE.Raycaster();
    this.sprayBullets = 0;
    this.lastShotTimestamp = 0;

    // Estado dinâmico de balística
    this.precisionPenalty = 0;
    this.currentSway = { x: 0, y: 0, amplitude: 0 };

    this._equip(this.slots[0], true);

    this._unsubEvents = [
      on('weapon:select_slot', idx => this.selectSlot(idx)),
      on('weapon:cycle_action', () => this.cycle()),
    ];
  }

  get def() { return WEAPONS[this.current]; }

  get isAuto() {
    const mode = this.fireModeByWeapon[this.current];
    if (mode) return mode === 'auto';
    return !!this.def?.auto;
  }

  _equip(id, instant = false) {
    if (!id || !WEAPONS[id]) return;
    if (this.current) {
      this.ammoByWeapon[this.current] = this.ammo;
    }
    this.current = id;
    if (this.ammoByWeapon[id] === undefined) {
      this.ammoByWeapon[id] = WEAPONS[id].magSize;
    }
    if (!this.fireModeByWeapon) this.fireModeByWeapon = {};
    if (this.fireModeByWeapon[id] === undefined) {
      const modes = WEAPONS[id].fireModes || (WEAPONS[id].auto ? ['auto'] : ['semi']);
      this.fireModeByWeapon[id] = modes[0];
    }
    this.ammo = this.ammoByWeapon[id];
    this.reloading = false;
    this.reloadT = 0;
    this.input?.consumeAction('fire');
    this.viewmodel.equip(id);
    emit('weapon:equipped', { id, name: WEAPONS[id].name, fireMode: this.fireModeByWeapon[id] });
    emit('weapon:ammo', { ammo: this.ammo, max: WEAPONS[id].magSize });
    emit('weapon:firemode', { fireMode: this.fireModeByWeapon[id], canToggle: (WEAPONS[id].fireModes?.length || 1) > 1 });
    emit('weapon:slots', { slots: this.slots, currentSlot: this.currentSlot });
  }

  toggleFireMode() {
    const def = this.def;
    const modes = def.fireModes || (def.auto ? ['auto'] : ['semi']);
    if (modes.length <= 1) return; // Arma não possui modo seletivo

    const cur = this.fireModeByWeapon[this.current] || modes[0];
    const nextIdx = (modes.indexOf(cur) + 1) % modes.length;
    this.fireModeByWeapon[this.current] = modes[nextIdx];
    this.input?.consumeAction('fire');
    emit('weapon:firemode', { fireMode: this.fireModeByWeapon[this.current], canToggle: true });
    emit('notification', { message: `Modo de Disparo: ${this.fireModeByWeapon[this.current].toUpperCase()}` });
  }

  cycle() {
    const targetSlot = 1 - this.currentSlot;
    if (this.slots[targetSlot]) {
      this.selectSlot(targetSlot);
    } else {
      emit('notification', { message: `Slot ${targetSlot + 1} vazio! Pegue uma arma no chão.` });
    }
  }

  selectSlot(idx) {
    if (idx !== 0 && idx !== 1) return;
    if (idx === this.currentSlot) return;
    if (!this.slots[idx]) {
      emit('notification', { message: `Slot ${idx + 1} vazio! Pegue uma arma no chão.` });
      return;
    }
    this.currentSlot = idx;
    this._equip(this.slots[idx]);
    emit('weapon:cycle');
  }

  pickupWeapon(newWeaponId) {
    if (!newWeaponId || !WEAPONS[newWeaponId]) return null;
    const oldWeapon = this.slots[this.currentSlot];
    this.slots[this.currentSlot] = newWeaponId;
    this._equip(newWeaponId);
    return oldWeapon;
  }

  reload() {
    if (this.reloading || this.ammo === this.def.magSize) return;
    this.reloading = true;
    this.reloadT = 0;
    this.input?.consumeAction('fire');
    this.viewmodel.triggerReload();
    emit('weapon:reload:start');
  }

  update(dt) {
    const def = this.def;

    // 0. Atualização determinística da simulação de projéteis físicos (CCD Sweep)
    this.projectileManager.update(dt);

    // 1. Troca de arma (tecla Q, slots 1/2 ou botão mobile ARMA)
    if (this.input.consumeAction('next_weapon')) {
      this.cycle();
    }
    if (this.input.consumeAction('slot_1')) {
      this.selectSlot(0);
    }
    if (this.input.consumeAction('slot_2')) {
      this.selectSlot(1);
    }

    // Modo de disparo seletivo (tecla B / V)
    if (this.input.consumeAction('toggle_fire_mode')) {
      this.toggleFireMode();
    }

    // 2. Recarga manual (tecla R ou botão mobile RELOAD)
    if (this.input.consumeAction('reload')) {
      this.reload();
    }

    // 3. ADS (Mira com botão direito)
    this.ads = this.input.actions.ads && !this.player.sprinting && this.player.alive;
    this.player.ads = this.ads; // Sincroniza diretamente com o jogador
    emit('player:ads', { ads: this.ads }); // Emite evento para todo o jogo
    const adsTime = def.ballistics?.internal?.adsTime || 0.22;
    const adsSpeed = 1.0 / Math.max(0.04, adsTime);
    const targetAds = this.ads ? 1 : 0;
    this.adsAmount += (targetAds - this.adsAmount) * Math.min(dt * adsSpeed * 2.2, 1);

    // 4. Progresso de Recarga
    if (this.reloading) {
      this.reloadT += dt;
      const p = this.reloadT / def.reloadTime;
      if (p >= 1) {
        this.reloading = false;
        this.ammo = def.magSize;
        this.ammoByWeapon[this.current] = this.ammo;
        emit('weapon:ammo', { ammo: this.ammo, max: def.magSize });
        emit('weapon:reload:end');
      }
    }

    // 5. Disparo (considera modo de disparo selecionado: auto ou semi)
    this.fireCooldown -= dt;

    // Recuperação determinística de precisão por arma (tempo configurado no JSON)
    const precRecoveryTime = def.ballistics?.external?.precision?.recoveryTime || 0.35;
    const recoveryRate = 1.0 / Math.max(0.05, precRecoveryTime);
    if (this.precisionPenalty > 0) {
      this.precisionPenalty = Math.max(0, this.precisionPenalty - dt * recoveryRate * 0.05);
    }

    // Decaimento suave e imediato da dispersão de tiro (spray streak)
    const nowSec = performance.now() / 1000;
    const timeSinceLastShot = nowSec - (this.lastShotTimestamp || 0);
    const ceaseDelay = Math.max(def.fireInterval * 1.2, 0.12);
    if (this.fireStreak > 0 && timeSinceLastShot > ceaseDelay) {
      this.fireStreak += (0 - this.fireStreak) * Math.min(1, dt * 14);
      if (this.fireStreak < 0.01) this.fireStreak = 0;
    }

    // Cálculo contínuo do sway orgânico
    const walkSpd = CONFIG.PLAYER?.walkSpeed || 5.2;
    const speedRatio = Math.hypot(this.player.vel.x, this.player.vel.z) / walkSpd;
    this.currentSway = BallisticsCalculator.calculateSway(def, nowSec, this.ads, speedRatio);

    if (!this.player.alive || this.reloading) {
      this.input.consumeAction('fire');
      return;
    }

    const isAutomatic = this.isAuto;
    const queuedFire = this.input.consumeAction('fire');
    const wantsFire = isAutomatic ? this.input.actions.fire : queuedFire;
    if (wantsFire && this.fireCooldown <= 0 && this.ammo > 0 && !this.player.sprinting) {
      this._fire();
      this.ammoByWeapon[this.current] = this.ammo;
    } else if (wantsFire && this.ammo <= 0 && this.fireCooldown <= 0 && !this.reloading) {
      this.fireCooldown = 0.22;
      emit('weapon:empty');
    }

    if (this.ammo === 0 && !this.reloading) this.reload();

    // ── Detecção de Término de Spray (Fumaça Residual de Calor) ─────────────
    if (this.sprayBullets > 0) {
      const ceaseDelay = Math.max(def.fireInterval * 1.4, 0.14);
      if (!wantsFire || (nowSec - this.lastShotTimestamp) > ceaseDelay || this.reloading || this.ammo === 0) {
        const magSize = def.magSize || 30;
        const heatRatio = Math.min(1, this.sprayBullets / (magSize * 0.45));
        const maxResidual = def.smokeResidualMax ?? 5;
        const count = Math.round(heatRatio * maxResidual);

        if (count > 0) {
          const mz = def.muzzleLocal || [0, 0.02, -0.5];
          _smokeMuzzleWorld.set(mz[0], mz[1], mz[2]);
          this.viewmodel.mount.localToWorld(_smokeMuzzleWorld);
          emit('weapon:smoke:residual', {
            muzzleWorld: _smokeMuzzleWorld,
            count,
            color: def.smokeResidualColor
          });
        }
        this.sprayBullets = 0;
      }
    }

  }

  get reloadProgress() {
    if (!this.reloading) return 0;
    return Math.min(this.reloadT / this.def.reloadTime, 1);
  }

  _currentSpread() {
    const def = this.def;
    const walkSpd = CONFIG.PLAYER?.walkSpeed || 5.2;
    const speedRatio = Math.hypot(this.player.vel.x, this.player.vel.z) / walkSpd;
    const isStrafing = (this.input?.isActionPressed?.('move_left') || this.input?.isActionPressed?.('move_right')) && speedRatio > 0.1;
    const isSprinting = !!this.player.sprinting;

    return BallisticsCalculator.calculateCurrentSpread(def, {
      isAds: this.ads,
      speedRatio,
      isStrafing,
      isSprinting,
      precisionPenalty: this.precisionPenalty,
      swayAmount: this.currentSway?.amplitude ?? 0
    });
  }

  _fire() {
    const def = this.def;
    this.ammo--;
    this.fireCooldown = def.fireInterval;
    emit('weapon:ammo', { ammo: this.ammo, max: def.magSize });

    const now = performance.now() / 1000;
    this.sprayBullets = (this.sprayBullets || 0) + 1;
    this.lastShotTimestamp = now;

    const streakDelay = CONFIG.GUNPLAY?.fireStreakDecayDelay ?? 0.20;
    const maxStreak   = CONFIG.GUNPLAY?.maxFireStreak ?? 8;
    const streakFactor = CONFIG.GUNPLAY?.fireStreakMultiplier ?? 0.08;

    if (now - (this.lastFireGapTime || 0) < streakDelay) {
      this.fireStreak = Math.min((this.fireStreak || 0) + 1, maxStreak);
    } else {
      this.fireStreak = 1;
    }
    this.lastFireGapTime = now;
    this.precisionPenalty = Math.min(this.precisionPenalty + 0.005, 0.04);

    const streakMul = 1 + this.fireStreak * streakFactor;

    // ── Recoil no CameraRig (Layer 2 via BallisticsCalculator) ───────────────────
    const isProto = def.id === 'rifle_proto';
    const recoil = BallisticsCalculator.calculateRecoilImpulse(def, this.fireStreak, this.ads);
    const pitchAdd = isProto ? recoil.pitch * 1.4 : recoil.pitch;
    const yawAdd = recoil.yaw;
    const kickbackZ = recoil.kickbackZ;

    if (this.player.rig) {
      const climbRatio = 0.30;
      if (isProto) {
        // Rifle Proto: aplica a subida contínua da mira/câmera no spray (climbPitch e climbYaw),
        // preservando as animações exclusivas do modelo 3D e do scope.
        this.player.rig.addRecoilImpulse({
          climbPitch: pitchAdd * climbRatio,
          climbYaw: yawAdd,
          punchPitch: 0,
          punchYaw: 0,
          punchRoll: 0,
          posKickZ: 0,
          posKickY: 0,
          shake: 0
        });
      } else {
        // Armas clássicas: parte permanente (climb) e parte elástica (punch que retorna com mola)
        this.player.rig.addRecoilImpulse({
          climbPitch: pitchAdd * climbRatio,
          climbYaw: yawAdd,
          punchPitch: this.ads ? pitchAdd * (1 - climbRatio) : pitchAdd * (1 - climbRatio) * 0.4,
          punchRoll: (Math.random() - 0.5) * 0.004,
          posKickZ: this.ads ? kickbackZ : kickbackZ * 0.4,
          posKickY: kickbackZ * 0.2,
          shake: (this.ads ? 0.18 : 0.08) * streakMul
        });
      }
    } else {
      this.player.pitch += pitchAdd;
      this.player.yaw += yawAdd;
    }
    const kickRot = def.kickRotFactor ?? 1.5;
    this.viewmodel.applyKick(def.recoilPitch * streakMul, 0, kickbackZ, kickRot, this.ads);
    this.viewmodel.flash();
    this.viewmodel.triggerFire(this.ammo);

    // Raycast do tiro & Posições de Câmera
    this.camera.getWorldPosition(_camPos);
    this.camera.getWorldQuaternion(_quat);

    _dir.set(0, 0, -1).applyQuaternion(_quat).normalize();
    _right.set(1, 0, 0).applyQuaternion(_quat).normalize();
    _up.set(0, 1, 0).applyQuaternion(_quat).normalize();

    // Calcula muzzle em coords de mundo a partir do mount do viewmodel
    const mz = def.muzzleLocal || [0, 0.02, -0.5];
    _tempMuzzle.set(mz[0], mz[1], mz[2]);
    _muzzleWorld.copy(_tempMuzzle);
    this.viewmodel.mount.localToWorld(_muzzleWorld);

    // Ponto de ejeção do estojo vazio em coordenadas de mundo (apenas para armas com ejeção de cartucho)
    let ejectWorld = null;
    if (def.ejectCasings !== false) {
      const ej = def.ejectLocal || [0.02, 0.02, -0.06];
      _tempEject.set(ej[0], ej[1], ej[2]);
      _ejectWorld.copy(_tempEject);
      this.viewmodel.mount.localToWorld(_ejectWorld);
      ejectWorld = _ejectWorld;
    }

    _playerPos.copy(this.player.pos);
    _forwardCopy.copy(_dir);
    _rightCopy.copy(_right);
    _upCopy.copy(_up);

    emit('weapon:fired', {
      weapon: def,
      weaponId: def.id,
      pos: _playerPos,
      muzzleWorld: _muzzleWorld,
      ejectWorld,
      forward: _forwardCopy,
      right: _rightCopy,
      up: _upCopy,
      ads: this.ads,
      streak: streakMul,
    });

    const spread = this._currentSpread();
    const a = Math.random() * Math.PI * 2;
    const m = Math.random() * spread;
    
    // Onde a mira aponta o tiro vai: sem distorções de sway somadas no vetor do tiro!
    _dir.addScaledVector(_right, Math.cos(a) * m)
        .addScaledVector(_up, Math.sin(a) * m)
        .normalize();

    const pelletCount = def.pellets || 1;
    const maxPelletSpread = def.pelletSpread || 0.01333; // Raio de 0.80m a 60m
    const originPoint = this.ads ? _camPos : _muzzleWorld;

    for (let p = 0; p < pelletCount; p++) {
      _pelletDir.copy(_dir);
      if (pelletCount > 1) {
        let rx, ry;
        if (p === 0) {
          // Pellet central com leve tremor concêntrico proporcional ao cone
          rx = (Math.random() - 0.5) * (maxPelletSpread * 0.25);
          ry = (Math.random() - 0.5) * (maxPelletSpread * 0.25);
        } else {
          // 6 pellets distribuídos em anel no cone (raio proporcional à distância)
          const ang = (p * Math.PI * 2) / (pelletCount - 1) + (Math.random() - 0.5) * 0.35;
          const r = (0.35 + Math.random() * 0.65) * maxPelletSpread;
          rx = Math.cos(ang) * r;
          ry = Math.sin(ang) * r;
        }
        _pelletDir.addScaledVector(_right, rx).addScaledVector(_up, ry).normalize();
      }

      // Spawna o projétil físico contínuo na piscina (Continuous Collision Detection)
      this.projectileManager.spawn({
        origin: originPoint,
        direction: _pelletDir,
        weaponDef: def,
        owner: 'player',
        ownerEntity: this.player,
        isPellet: pelletCount > 1
      });
    }
  }

  destroy() {
    if (this._unsubEvents) {
      for (const unsub of this._unsubEvents) unsub();
      this._unsubEvents = [];
    }
  }
}
