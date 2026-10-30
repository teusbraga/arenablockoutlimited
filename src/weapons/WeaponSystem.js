import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { BallisticsCalculator } from './BallisticsCalculator.js';
import { MasterWeapon } from './MasterWeapon.js';
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
const _targetPoint = new THREE.Vector3();
const _hittableMeshes = [];

/**
 * Calcula a duração do cooldown de fumaça após o término do disparo
 * com base no tempo de fogo automático sustentado (em segundos).
 *
 * Regra Exponencial:
 * 1s de spray = 0.3s de fumaça
 * 2s de spray = 0.6s de fumaça (0.3 * 2^1)
 * 3s de spray = 1.2s de fumaça (0.3 * 2^2)
 */
export function calculateSmokeCooldownDuration(sustainedSeconds) {
  if (!sustainedSeconds || sustainedSeconds <= 0.05) return 0;
  if (sustainedSeconds < 1.0) {
    return 0.3 * sustainedSeconds;
  }
  return Math.min(0.3 * Math.pow(2, sustainedSeconds - 1.0), 6.0);
}

export class WeaponSystem {
  constructor({ camera, viewmodel, input, player, world, botsProvider, inventory, hud = null, mapName = '' }) {
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.input = input;
    this.player = player;
    this.world = world;
    this.botsProvider = botsProvider;
    this.hud = hud;
    this.mapName = mapName;

    this._boundMuzzleTracker = (outVec) => this.getMuzzlePosition(outVec);

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
    this.reloadType = 'speed';
    this.reloadDuration = 2.0;
    this.magDropped = false;
    this.ammoRestored = false;
    this.reserveMagsByWeapon = {};
    this.qteActive = false;
    this.qteProgress = 0;
    this.qteSweetSpotStart = 0.45;
    this.qteSweetSpotEnd = 0.70;
    this.qteDuration = 1.8;
    this.qteSuccess = null;
    this.reloadT = 0;
    this.fireCooldown = 0;
    this.adsAmount = 0;
    this.ads = false;
    this.lastShotTime = -10;

    this.raycaster = new THREE.Raycaster();
    this.sprayBullets = 0;
    this.lastShotTimestamp = 0;
    this.timeSinceLastShot = 999;

    // Algoritmo de Fogo Sustentado e Cooldown de Fumaça
    this.sustainedFireDuration = 0;
    this.sustainedFireStartTime = 0;
    this.smokeCooldownRemaining = 0;
    this.smokeCooldownTotal = 0;
    this.smokeCooldownInterval = 0;

    // Estado dinâmico de balística
    this.precisionPenalty = 0;
    this.currentSway = { x: 0, y: 0, amplitude: 0 };
    this.wallCompression = 0;
    this.sprayRecoil = { pitch: 0, yaw: 0 };

    // Trava de Loadout (Anti-Exploit de troca de armas no meio da partida)
    this.loadoutLocked = false;
    this.pendingSlots = { 0: null, 1: null };

    this._equip(this.slots[0], true);

    this._unsubEvents = [
      on('weapon:select_slot', e => this.selectSlot(typeof e === 'object' && e !== null ? (e.slotIdx ?? e.slot) : e)),
      on('map:loaded', e => {
        if (e && (e.mapName || e.url || e.name)) {
          this.mapName = e.mapName || e.url || e.name;
        }
      }),

      on('cheat:activated', e => {
        if (e.cheat === 'professionalkiller' && e.active) {
          if (this.def) {
            this.ammo = this.def.magSize;
            this.ammoByWeapon[this.current] = this.ammo;
            emit('weapon:ammo', { ammo: this.ammo, max: this.def.magSize });
          }
        }
      }),
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
    if (!this.reserveMagsByWeapon) this.reserveMagsByWeapon = {};
    if (this.reserveMagsByWeapon[id] === undefined) {
      this.reserveMagsByWeapon[id] = 3;
    }
    this.reloading = false;
    this.reloadT = 0;
    this.qteActive = false;
    emit('weapon:qte:stop', {});
    this.input?.clearReloadQueue?.();
    this.sustainedFireDuration = 0;
    this.sustainedFireStartTime = 0;
    this.smokeCooldownRemaining = 0;
    this.smokeCooldownTotal = 0;
    this.smokeCooldownInterval = 0;
    this.viewmodel.equip(id);
    emit('weapon:equipped', { id, name: WEAPONS[id].name, fireMode: this.fireModeByWeapon[id] });
    emit('weapon:ammo', { ammo: this.ammo, max: WEAPONS[id].magSize, reserve: this.getReserveMags(id) });
    emit('weapon:firemode', { fireMode: this.fireModeByWeapon[id], canToggle: (WEAPONS[id].fireModes?.length || 1) > 1 });
    emit('weapon:slots', { slots: this.slots, currentSlot: this.currentSlot });
  }

  toggleFireMode() {
    if (this.player && !this.player.alive) return;
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
    if (this.player && !this.player.alive) return;
    const targetSlot = 1 - this.currentSlot;
    if (this.slots[targetSlot]) {
      this.selectSlot(targetSlot);
    } else {
      emit('notification', { message: `Slot ${targetSlot + 1} vazio! Pegue uma arma no chão.` });
    }
  }

  selectSlot(idx) {
    if (this.player && !this.player.alive) return;
    if (idx !== 0 && idx !== 1) return;
    if (idx === this.currentSlot) return;
    if (!this.slots[idx]) {
      emit('notification', { message: `Slot ${idx + 1} vazio! Pegue uma arma no chão.` });
      return;
    }
    this.currentSlot = idx;
    this._equip(this.slots[idx]);
    emit('weapon:cycle', {});
  }

  setLoadoutLocked(locked) {
    this.loadoutLocked = !!locked;
  }

  hasPendingLoadout() {
    return this.pendingSlots[0] !== null || this.pendingSlots[1] !== null;
  }

  applyPendingSlots() {
    let changed = false;
    if (this.pendingSlots[0] !== null) {
      this.setSlot(0, this.pendingSlots[0], true);
      this.pendingSlots[0] = null;
      changed = true;
    }
    if (this.pendingSlots[1] !== null) {
      this.setSlot(1, this.pendingSlots[1], true);
      this.pendingSlots[1] = null;
      changed = true;
    }
    return changed;
  }

  setSlot(slotIdx, weaponId, force = false) {
    if (this.player && !this.player.alive) return false;
    if (slotIdx !== 0 && slotIdx !== 1) return false;
    if (this.loadoutLocked && !force) {
      this.pendingSlots[slotIdx] = weaponId;
      emit('hud:popup', {
        text: 'LOADOUT TRAVADO: Arma selecionada entrará em vigor no próximo reinício',
        color: '#f77f00',
        duration: 2500
      });
      return false;
    }
    const validId = (weaponId && weaponId !== 'none' && WEAPONS[weaponId]) ? weaponId : null;
    this.slots[slotIdx] = validId;
    if (this.currentSlot === slotIdx) {
      if (validId) {
        this._equip(validId);
      } else {
        const otherSlot = 1 - slotIdx;
        if (this.slots[otherSlot]) {
          this.currentSlot = otherSlot;
          this._equip(this.slots[otherSlot]);
        }
      }
    }
    emit('weapon:slots', { slots: this.slots, currentSlot: this.currentSlot });
    return true;
  }

  pickupWeapon(newWeaponId) {
    if (this.player && !this.player.alive) return null;
    if (!newWeaponId || !WEAPONS[newWeaponId]) return null;
    const oldWeapon = this.slots[this.currentSlot];
    this.slots[this.currentSlot] = newWeaponId;
    this._equip(newWeaponId);
    return oldWeapon;
  }

  getReserveMags(wepId = this.current) {
    return this.reserveMagsByWeapon?.[wepId] ?? 3;
  }

  addReserveMag(wepId, ammoCount) {
    if (!wepId) return;
    if (!this.reserveMagsByWeapon) this.reserveMagsByWeapon = {};
    this.reserveMagsByWeapon[wepId] = (this.reserveMagsByWeapon[wepId] ?? 0) + 1;
    if (wepId === this.current && this.def) {
      emit('weapon:ammo', { ammo: this.ammo, max: this.def.magSize, reserve: this.getReserveMags() });
    }
  }

  startReload(type = 'speed') {
    if (this.player && !this.player.alive) return;
    if (this.reloading || !this.def) return;
    if (this.ammo === this.def.magSize) return;

    const reserves = this.getReserveMags();
    if (reserves <= 0) {
      emit('notification', { message: 'Sem carregadores sobressalentes!' });
      emit('weapon:empty', {});
      return;
    }

    this.reloading = true;
    this.reloadType = type;
    this.reloadT = 0;
    this.magDropped = false;
    this.ammoRestored = false;
    this.input?.consumeAction('fire');
    this.input?.clearReloadQueue?.();
    this.viewmodel.triggerReload();

    if (type === 'speed') {
      // Recarga simples rápida: menos de 1s (0.85s) com descarte do carregador
      this.reloadDuration = 0.85;
      this.qteActive = false;
      emit('notification', { message: 'Recarga Rápida (Carregador descartado)' });
    } else {
      // Recarga com retenção e QTE: 4s de duração caso erre ou não acerte o timing
      this.reloadDuration = 4.0;
      this.qteActive = true;
      this.qteProgress = 0;
      this.qteSuccess = null;
      this.qteDuration = 1.8;
      emit('weapon:qte:start', {
        duration: this.qteDuration,
        sweetStart: this.qteSweetSpotStart,
        sweetEnd: this.qteSweetSpotEnd
      });
    }

    emit('weapon:reload:start', { type: this.reloadType, weaponId: this.current });
  }

  reload() {
    this.startReload('speed');
    return;
  }
  update(dt) {
    const def = this.def;

    // 0. Atualização determinística da simulação de projéteis físicos (CCD Sweep)
    this.projectileManager.update(dt);

    // 0.1. Weapon Wall Press (Cano da arma colide/aproxima-se de paredes)
    // O cano só deve recolher se a ponta do cano estiver prestes a penetrar ou colidir na parede (< 0.15m de folga)
    const barrelLength = def?.barrelLength || (def?.type === 'pistol' ? 0.32 : (def?.type === 'smg' ? 0.38 : 0.55));
    const safetyBuffer = 0.18; // Inicia compressão apenas a 18cm de encostar no obstáculo físico
    const maxDetectionDist = barrelLength + safetyBuffer;
    let targetCompression = 0.0;
    if (this.world && this.camera && this.player?.alive) {
      _camPos.copy(this.camera.position);
      this.camera.getWorldDirection(_dir);
      const wallHit = this.world.raycast(_camPos, _dir, maxDetectionDist);
      const hitDist = wallHit ? (wallHit.distance ?? wallHit.dist) : Infinity;
      if (wallHit && hitDist < maxDetectionDist) {
        // Interpolação suave e linear da compressão conforme o cano se aproxima da superfície
        targetCompression = Math.max(0, Math.min(1.0, (maxDetectionDist - hitDist) / Math.max(0.15, safetyBuffer)));
      }
    }
    this.wallCompression += (targetCompression - this.wallCompression) * Math.min(dt * 14, 1.0);

    // 1. Troca de arma (tecla Q, slots 1/2 ou botão mobile ARMA)
    const playerAlive = !this.player || this.player.alive;
    if (playerAlive && this.input.consumeAction('next_weapon')) {
      this.cycle();
    }
    if (playerAlive && this.input.consumeAction('slot_1')) {
      this.selectSlot(0);
    }
    if (playerAlive && this.input.consumeAction('slot_2')) {
      this.selectSlot(1);
    }

    // Modo de disparo seletivo (tecla B / V)
    if (playerAlive && this.input.consumeAction('toggle_fire_mode')) {
      this.toggleFireMode();
    }

    // 2. Recarga manual (Tap R = Speed / Drop Mag; Hold R = Tactical com Retenção & QTE)
    if (playerAlive && (this.input.consumeAction('reload_tactical') || this.input.consumeAction('reload_hold'))) {
      if (!this.reloading) this.startReload('tactical');
    } else if (playerAlive && (this.input.consumeAction('reload_speed') || this.input.consumeAction('reload_tap') || this.input.consumeAction('reload'))) {
      if (!this.reloading) this.startReload('speed');
    }

    // 2.1. Processamento dinâmico do QTE na Recarga Tática
    if (this.qteActive) {
      this.qteProgress += dt / Math.max(0.01, this.qteDuration);
      emit('weapon:qte:update', { progress: this.qteProgress });

      if (this.input.consumeAction('qte_interact') || this.input.consumeAction('reload_tap') || this.input.consumeAction('reload_speed')) {
        if (this.qteProgress >= this.qteSweetSpotStart && this.qteProgress <= this.qteSweetSpotEnd) {
          // ACERTOU O TEMPO: Termina imediatamente!
          this.qteActive = false;
          this.qteSuccess = true;
          emit('weapon:qte:result', { success: true });
          emit('notification', { message: '⚡ Recarga Tática Perfeita!' });
          this.reserveMagsByWeapon[this.current] = Math.max(0, (this.reserveMagsByWeapon[this.current] ?? 3) - 1);

          // Restaura munição completa do novo carregador
          this.ammoRestored = true;
          this.ammo = def.magSize;
          this.ammoByWeapon[this.current] = this.ammo;

          // Encerra imediatamente a recarga
          this.reloading = false;
          this.reloadT = 0;
          emit('weapon:ammo', { ammo: this.ammo, max: def.magSize, reserve: this.getReserveMags() });
          emit('weapon:reload:end', { weaponId: this.current, type: this.reloadType });
          this.input?.clearReloadQueue?.();
        } else {
          // Errou o tempo: penalidade com recarga lenta de 4s
          this.qteActive = false;
          this.qteSuccess = false;
          emit('weapon:qte:result', { success: false });
          emit('notification', { message: 'Falhou o timing! Recarga lenta (4s)...' });
          this.input?.clearReloadQueue?.();
        }
      } else if (this.qteProgress >= 1.0) {
        // Agulha esgotou sem acertar: penalidade com recarga de 4s
        this.qteActive = false;
        this.qteSuccess = false;
        emit('weapon:qte:result', { success: false });
        this.input?.clearReloadQueue?.();
      }
    }

    // 3. ADS (Mira com botão direito, bloqueada se o cano estiver colado na parede)
    this.ads = this.input.actions.ads && !this.player.sprinting && !(this.player.sprintRecoveryTimer > 0) && this.player.alive && (this.wallCompression < 0.45);
    this.player.ads = this.ads;
    emit('player:ads', { ads: this.ads });
    const adsTime = def.ballistics?.internal?.adsTime || 0.22;
    const adsSpeed = 1.0 / Math.max(0.04, adsTime);
    const targetAds = this.ads ? 1 : 0;
    this.adsAmount += (targetAds - this.adsAmount) * Math.min(dt * adsSpeed * 2.2, 1);

    // 4. Progresso de Recarga Determinística
    if (this.reloading) {
      this.reloadT += dt;
      const curDur = Math.max(0.01, this.reloadDuration || def.reloadTime);
      const p = Math.min(this.reloadT / curDur, 1.0);

      // Ponto de ejeção do carregador (35% do ciclo)
      if (p >= 0.35 && !this.magDropped) {
        this.magDropped = true;
        if (this.reloadType === 'speed') {
          const dropPos = new THREE.Vector3(0, -0.06, -0.04);
          if (this.viewmodel?.mount) {
            this.viewmodel.mount.localToWorld(dropPos);
          } else if (this.camera) {
            dropPos.copy(this.camera.position);
          }
          emit('weapon:magazine_dropped', {
            weaponId: this.current,
            ammoCount: this.ammo,
            maxAmmo: def.magSize,
            pos: dropPos
          });
          this.reserveMagsByWeapon[this.current] = Math.max(0, (this.reserveMagsByWeapon[this.current] ?? 3) - 1);
          this.ammo = 0;
          emit('weapon:ammo', { ammo: this.ammo, max: def.magSize, reserve: this.getReserveMags() });
        } else {
          emit('notification', { message: 'Guardou carregador no bolso (' + this.ammo + ' balas)' });
        }
      }

      // Ponto de inserção do novo carregador (78% do ciclo) -> Balas restauradas
      if (p >= 0.78 && !this.ammoRestored) {
        if (this.reloadType === 'tactical') {
          this.reserveMagsByWeapon[this.current] = Math.max(0, (this.reserveMagsByWeapon[this.current] ?? 3) - 1);
        }
        this.ammoRestored = true;
        this.ammo = def.magSize;
        this.ammoByWeapon[this.current] = this.ammo;
        emit('weapon:ammo', { ammo: this.ammo, max: def.magSize, reserve: this.getReserveMags() });
      }

      // Conclusão total da recarga
      if (p >= 1.0) {
        this.reloading = false;
        this.reloadT = 0;
        emit('weapon:ammo', { ammo: this.ammo, max: def.magSize, reserve: this.getReserveMags() });
        emit('weapon:reload:end', { weaponId: this.current, type: this.reloadType });
        this.input?.clearReloadQueue?.();
      }
    }

    // 5. Disparo (considera modo de disparo selecionado: auto ou semi)
    this.fireCooldown -= dt;
    this.timeSinceLastShot = (this.timeSinceLastShot ?? 999) + dt;

    const nowSec = performance.now() / 1000;
    const ceaseDelay = Math.max(def.fireInterval * 1.5, 0.18);
    const isBurstActive = this.timeSinceLastShot < ceaseDelay && !this.reloading && this.ammo > 0;

    // Recuperação determinística de precisão e dispersão SOMENTE após o término da rajada (cease-fire)
    // Durante a rajada contínua, o recuo e a dispersão acumulam cumulativamente (estilo CS2 / realismo),
    // sem sofrer quedas espasmódicas entre tiros consecutivos.
    if (!isBurstActive) {
      const precRecoveryTime = def.ballistics?.external?.precision?.recoveryTime || 0.35;
      const recoveryRate = 1.0 / Math.max(0.05, precRecoveryTime);
      if (this.precisionPenalty > 0) {
        this.precisionPenalty = Math.max(0, this.precisionPenalty - dt * recoveryRate * 0.08);
      }
      if (this.fireStreak > 0) {
        this.fireStreak = Math.max(0, this.fireStreak - dt * recoveryRate * 6.0);
      }
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
    const isInfiniteAmmo = !!CONFIG.CHEATS?.infiniteAmmo;
    if (wantsFire && this.fireCooldown <= 0 && (this.ammo > 0 || isInfiniteAmmo) && !this.player.sprinting) {
      if (isInfiniteAmmo && this.ammo <= 0) {
        this.ammo = def.magSize;
      }
      this._fire();
      this.ammoByWeapon[this.current] = this.ammo;
    } else if (wantsFire && this.ammo <= 0 && this.fireCooldown <= 0 && !this.reloading) {
      this.fireCooldown = 0.22;
      emit('weapon:empty', {});
    }

    if (this.ammo === 0 && !this.reloading && !isInfiniteAmmo && this.getReserveMags() > 0) {
      this.reload();
    }

    // ── Detecção de Término de Fogo Sustentado (Smoke Cooldown Exponencial) ─────────────
    const smokeCeaseDelay = Math.max(def.fireInterval * 1.5, 0.16);
    const hasCeasedFire = (nowSec - (this.lastShotTimestamp || 0)) > smokeCeaseDelay || this.reloading || this.ammo === 0;

    if (this.sustainedFireDuration > 0 && hasCeasedFire) {
      const cooldownDuration = calculateSmokeCooldownDuration(this.sustainedFireDuration);
      if (cooldownDuration > 0) {
        this.smokeCooldownRemaining = cooldownDuration;
        this.smokeCooldownTotal = cooldownDuration;
        this.smokeCooldownInterval = 0; // Emite primeiro puff imediatamente
      }
      this.sustainedFireDuration = 0;
      this.sustainedFireStartTime = 0;
    }

    // ── Emissão Contínua de Fumaça Branca durante o Cooldown do Cano ─────────────
    if (this.smokeCooldownRemaining > 0 && !this.reloading) {
      this.smokeCooldownRemaining -= dt;
      this.smokeCooldownInterval -= dt;

      if (this.smokeCooldownInterval <= 0) {
        this.smokeCooldownInterval = 0.085; // Novo puff a cada 85ms
        const mz = def.muzzleLocal || [0, 0.02, -0.5];
        _smokeMuzzleWorld.set(mz[0], mz[1], mz[2]);
        this.viewmodel.mount.localToWorld(_smokeMuzzleWorld);

        const ratio = Math.max(0, this.smokeCooldownRemaining / Math.max(0.001, this.smokeCooldownTotal));
        emit('weapon:smoke:residual', {
          muzzleWorld: _smokeMuzzleWorld,
          weapon: def,
          count: def?.smokeResidualMax ? Math.min(2, def.smokeResidualMax) : 1,
          ratio,
          color: def?.smokeResidualColor || '#ffffff'
        });
      }
    }

    // Decaimento suave do recuo acumulado de spray (Follow Recoil & Spray Tracking)
    // Também condicionado ao cessar-fogo para não colapsar a mira entre tiros de uma mesma rajada
    if (this.sprayRecoil && !isBurstActive) {
      const recTime = def?.ballistics?.external?.recoil?.recoveryTime || 0.28;
      const sprayRecoverySpeed = (1.0 / recTime) * 3.5;
      const sprayDecay = Math.exp(-dt * sprayRecoverySpeed);
      this.sprayRecoil.pitch *= sprayDecay;
      this.sprayRecoil.yaw *= sprayDecay;
      if (Math.abs(this.sprayRecoil.pitch) < 0.0001) this.sprayRecoil.pitch = 0;
      if (Math.abs(this.sprayRecoil.yaw) < 0.0001) this.sprayRecoil.yaw = 0;
    }
  }

  getSprayRecoil() {
    return this.sprayRecoil;
  }

  get reloadProgress() {
    if (!this.reloading) return 0;
    return Math.min(this.reloadT / Math.max(0.01, this.reloadDuration || this.def?.reloadTime || 2.0), 1);
  }

  _currentSpread() {
    const def = this.def;
    const zeroingMode = MasterWeapon.isZeroingMode(this.mapName);
    if (zeroingMode) return 0;

    const walkSpd = CONFIG.PLAYER?.walkSpeed || 5.2;
    const speedRatio = Math.hypot(this.player.vel.x, this.player.vel.z) / walkSpd;
    const isStrafing = (this.input?.isActionPressed?.('move_left') || this.input?.isActionPressed?.('move_right')) && speedRatio > 0.1;
    const isSprinting = !!this.player.sprinting;

    const baseSpread = BallisticsCalculator.calculateCurrentSpread(def, {
      isAds: this.ads,
      speedRatio,
      isStrafing,
      isSprinting,
      precisionPenalty: this.precisionPenalty,
      swayAmount: this.currentSway?.amplitude ?? 0,
      zeroingMode
    });
    return baseSpread + (this.wallCompression || 0) * 0.05;
  }

  _fire() {
    const noFireWarningEnabled = this.hud?.crosshairManager
      ? !!this.hud.crosshairManager.config.noFireWarning
      : true;
    const isBlockedByWall = noFireWarningEnabled && (this.wallCompression > 0.45 || this.hud?.crosshairManager?.isBlocked);
    if (isBlockedByWall) {
      emit('weapon:empty', {});
      emit('hud:popup', { text: 'CANO OBSTRUÍDO PELA PAREDE', color: '#e0574a', duration: 700 });
      this.fireCooldown = 0.20;
      return;
    }

    const def = this.def;
    if (!CONFIG.CHEATS?.infiniteAmmo) {
      this.ammo--;
    }
    this.fireCooldown = def.fireInterval;
    emit('weapon:ammo', { ammo: this.ammo, max: def.magSize });

    const now = performance.now() / 1000;
    this.sprayBullets = (this.sprayBullets || 0) + 1;

    // Cancela qualquer fumaça de cooldown anterior que estava saindo
    this.smokeCooldownRemaining = 0;

    // Rastreia a duração cumulativa de fogo automático sustentado contínuo
    const ceaseDelayThreshold = Math.max(def.fireInterval * 1.5, 0.16);
    if (!this.sustainedFireStartTime || (now - (this.lastShotTimestamp || 0)) > ceaseDelayThreshold) {
      this.sustainedFireStartTime = now;
      this.sustainedFireDuration = def.fireInterval;
    } else {
      this.sustainedFireDuration = (now - this.sustainedFireStartTime) + def.fireInterval;
    }
    this.lastShotTimestamp = now;
    this.timeSinceLastShot = 0;

    const streakDelay = CONFIG.GUNPLAY?.fireStreakDecayDelay ?? 0.20;
    const maxStreak   = CONFIG.GUNPLAY?.maxFireStreak ?? 8;
    const streakFactor = CONFIG.GUNPLAY?.fireStreakMultiplier ?? 0.08;

    if (now - (this.lastFireGapTime || 0) < streakDelay) {
      this.fireStreak = Math.min((this.fireStreak || 0) + 1, maxStreak);
    } else {
      this.fireStreak = 1;
    }
    this.lastFireGapTime = now;
    const isZeroing = MasterWeapon.isZeroingMode(this.mapName);
    this.precisionPenalty = isZeroing ? 0 : Math.min(this.precisionPenalty + 0.005, 0.04);

    const streakMul = isZeroing ? 1.0 : (1 + this.fireStreak * streakFactor);

    // ── Recoil no CameraRig (Layer 2 via BallisticsCalculator) ───────────────────
    const isProto = def.id === 'rifle_proto';
    const recoil = BallisticsCalculator.calculateRecoilImpulse(def, this.fireStreak, this.ads, isZeroing);
    const pitchAdd = isProto ? recoil.pitch * 1.4 : recoil.pitch;
    const yawAdd = recoil.yaw;
    const kickbackZ = recoil.kickbackZ;

    // Acumula recuo contínuo da rajada para rastreio de spray (Follow Recoil estilo CS2)
    if (this.sprayRecoil && !isZeroing) {
      const sprayGain = this.ads ? 0.85 : 1.45;
      this.sprayRecoil.pitch += pitchAdd * sprayGain;
      this.sprayRecoil.yaw += yawAdd * sprayGain;
      this.sprayRecoil.pitch = Math.min(this.sprayRecoil.pitch, 0.16);
      this.sprayRecoil.yaw = Math.max(-0.09, Math.min(0.09, this.sprayRecoil.yaw));
    }

    if (this.player.rig) {
      const climbRatio = 0.40;
      const recoveryDelay = Math.max(0.24, (def.fireInterval || 0.1) * 2.2);
      if (isProto) {
        // Rifle Proto: aplica a subida contínua da mira/câmera no spray (climbPitch e climbYaw),
        // preservando as animações exclusivas do modelo 3D e do scope.
        this.player.rig.addRecoilImpulse({
          climbPitch: isZeroing ? 0 : pitchAdd * climbRatio,
          climbYaw: isZeroing ? 0 : yawAdd,
          punchPitch: 0,
          punchYaw: 0,
          punchRoll: 0,
          posKickZ: 0,
          posKickY: 0,
          shake: 0,
          recoveryDelay
        });
      } else {
        // Armas clássicas: parte permanente (climb) e parte elástica (punch que retorna com mola)
        this.player.rig.addRecoilImpulse({
          climbPitch: isZeroing ? 0 : pitchAdd * climbRatio,
          climbYaw: isZeroing ? 0 : yawAdd,
          punchPitch: isZeroing ? 0 : (this.ads ? pitchAdd * (1 - climbRatio) : pitchAdd * (1 - climbRatio) * 0.4),
          punchRoll: isZeroing ? 0 : (Math.random() - 0.5) * 0.004,
          posKickZ: isZeroing ? 0 : (this.ads ? kickbackZ : kickbackZ * 0.4),
          posKickY: isZeroing ? 0 : (kickbackZ * 0.2),
          shake: isZeroing ? 0 : ((this.ads ? 0.18 : 0.08) * streakMul),
          recoveryDelay
        });
      }
    } else if (!isZeroing) {
      this.player.pitch += pitchAdd;
      this.player.yaw += yawAdd;
    }
    const kickRot = def.kickRotFactor ?? 1.5;
    this.viewmodel.applyKick(isZeroing ? 0 : def.recoilPitch * streakMul, 0, isZeroing ? 0 : kickbackZ, kickRot, this.ads);
    this.viewmodel.flash(def);
    this.viewmodel.triggerFire(this.ammo);

    // Raycast do tiro & Posições de Câmera
    this.camera.getWorldPosition(_camPos);
    this.camera.getWorldQuaternion(_quat);

    // Se o player se moveu no fixedUpdate atual, compensa a defasagem cinemática
    // entre a física do player e a última renderização da câmera/viewmodel (GEMINI.md)
    if (this.player && this.player.pos && this.player.prevPos) {
      const dx = this.player.pos.x - this.player.prevPos.x;
      const dy = this.player.pos.y - this.player.prevPos.y;
      const dz = this.player.pos.z - this.player.prevPos.z;
      _camPos.x += dx;
      _camPos.y += dy;
      _camPos.z += dz;
    }

    _dir.set(0, 0, -1).applyQuaternion(_quat).normalize();
    _right.set(1, 0, 0).applyQuaternion(_quat).normalize();
    _up.set(0, 1, 0).applyQuaternion(_quat).normalize();

    // Sincroniza matriz do mount do viewmodel no momento do disparo
    if (this.viewmodel && this.viewmodel.mount) {
      this.viewmodel.mount.updateWorldMatrix(true, true);
    }

    // Calcula muzzle em coords de mundo a partir do mount do viewmodel
    const mz = def.muzzleLocal || [0, 0.02, -0.5];
    _tempMuzzle.set(mz[0], mz[1], mz[2]);
    _muzzleWorld.copy(_tempMuzzle);
    if (this.viewmodel && this.viewmodel.mount) {
      this.viewmodel.mount.localToWorld(_muzzleWorld);
    }

    if (this.player && this.player.pos && this.player.prevPos) {
      const dx = this.player.pos.x - this.player.prevPos.x;
      const dy = this.player.pos.y - this.player.prevPos.y;
      const dz = this.player.pos.z - this.player.prevPos.z;
      _muzzleWorld.x += dx;
      _muzzleWorld.y += dy;
      _muzzleWorld.z += dz;
    }

    // Se dynamicAlignment estiver ativo no HUD (Mecânica Wardogs) OU se estiver em ADS,
    // o tiro é 100% COLINEAR com o cano físico 3D da arma no mundo (Zero Curva / Zero Paralaxe)
    const isDynamicAlignment = this.hud?.crosshairManager
          ? !!this.hud.crosshairManager.config.dynamicAlignment
          : false;
        const isFollowRecoil = this.hud?.crosshairManager
          ? !!this.hud.crosshairManager.config.followRecoil
          : false;
    
        // Distância nominal de zeroing e elevação mecânica analítica (calculada em WeaponDefs)
        const zeroDist = this.zeroDistance || (CONFIG?.ZEROING?.defaultZeroDistance ?? 50.0);
        const zeroElevation = def.zeroingElevation || MasterWeapon.calculateZeroingElevation(def, zeroDist);
    
        // Extrai o vetor diretor físico puro do cano 3D da arma no espaço de mundo
        const _barrelDir = _forwardCopy;
        _barrelDir.set(0, 0, -1);
        if (this.viewmodel && this.viewmodel.mount) {
          _barrelDir.transformDirection(this.viewmodel.mount.matrixWorld).normalize();
        }
    
        if (this.ads) {
          // 1. ADS: Visada ótica central (linha de visada da câmera).
          // Aplica a elevação mecânica analítica fixa (zeroElevation) para cruzar a visada exatamente nos 50m.
          // A bala sai 100% reta da ponta física do cano e preserva Height-Over-Bore natural (< 2m).
          _dir.addScaledVector(_up, zeroElevation).normalize();
        } else if (isDynamicAlignment) {
          // 2. Hipfire Dinâmico (Mecânica Wardogs):
          // A bala sai na direção física do cano 3D com a elevação mecânica de zeroing.
          _dir.copy(_barrelDir).addScaledVector(_up, zeroElevation).normalize();
    
          if (this.barrelAlignment) {
            this.barrelAlignment.update(def, this.ads, 0.016, this.sprayRecoil, _muzzleWorld);
          }
        } else {
          // 3. Hipfire Clássico (Retículo Estático 50%, 50%):
          // Se followRecoil estiver ativo no modo clássico estilo CS2, aplica a deflexão de sprayRecoil.
          if (isFollowRecoil && this.sprayRecoil) {
            _dir.addScaledVector(_up, this.sprayRecoil.pitch)
                .addScaledVector(_right, -this.sprayRecoil.yaw)
                .normalize();
          }
          MasterWeapon.getConvergenceTarget(_camPos, _dir, zeroDist, _targetPoint);
          MasterWeapon.computeShotDirection(_muzzleWorld, _targetPoint, _dir);
        }
    

    // Se o cano estiver obstruído/comprimido contra a parede (Wall Press) e o mount ainda não tiver
    // refletido a inclinação (ex: antes do renderUpdate ou sem barrelAlignment), aplica a elevação física do cano (~75° para cima)
    const mountRotX = this.viewmodel?.mount?.rotation?.x || 0;
    if (this.wallCompression > 0.001 && (!this.barrelAlignment || Math.abs(mountRotX) < this.wallCompression * 0.5)) {
      const wallPitch = this.wallCompression * 1.31; // +75° para cima
      const wallYaw = -this.wallCompression * 0.26;  // -15° lateral
      _dir.applyAxisAngle(_right, wallPitch)
          .applyAxisAngle(_up, wallYaw)
          .normalize();
    }

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
    if (spread > 0.00001) {
      const a = Math.random() * Math.PI * 2;
      const m = Math.random() * spread;
      
      // Dispersão natural de tiro
      _dir.addScaledVector(_right, Math.cos(a) * m)
          .addScaledVector(_up, Math.sin(a) * m)
          .normalize();
    }

    const pelletCount = def.pellets || 1;
    const maxPelletSpread = def.pelletSpread || 0.01333; // Raio de 0.80m a 60m
    const originPoint = _muzzleWorld;

    for (let p = 0; p < pelletCount; p++) {
      _pelletDir.copy(_dir);
      if (pelletCount > 1 && !isZeroing) {
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
        originTracker: this._boundMuzzleTracker,
        direction: _pelletDir,
        weaponDef: def,
        owner: 'player',
        ownerEntity: this.player,
        isPellet: pelletCount > 1
      });
    }
  }

  getMuzzlePosition(outVec) {
    const def = this.def;
    const mz = def?.muzzleLocal || [0, 0.02, -0.5];
    outVec.set(mz[0], mz[1], mz[2]);
    if (this.viewmodel && this.viewmodel.mount) {
      this.viewmodel.mount.localToWorld(outVec);
    }
    return outVec;
  }

  destroy() {
    if (this._unsubEvents) {
      for (const unsub of this._unsubEvents) unsub();
      this._unsubEvents = [];
    }
  }
}
