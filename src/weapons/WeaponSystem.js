import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { CONFIG } from '../core/Config.js';
import { emit } from '../core/EventBus.js';

const _dir = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

export class WeaponSystem {
  constructor({ camera, viewmodel, input, player, world, botsProvider }) {
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.input = input;
    this.player = player;
    this.world = world;
    this.botsProvider = botsProvider;

    this.inventory = ['ar15', 'p9'];
    this.currentIndex = 0;
    this.current = null;
    this.ammo = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.fireCooldown = 0;
    this.adsAmount = 0;
    this.ads = false;
    this.lastShotTime = -10;

    this.raycaster = new THREE.Raycaster();

    this._equip(this.inventory[0], true);
  }

  get def() { return WEAPONS[this.current]; }

  _equip(id, instant = false) {
    this.current = id;
    this.ammo = WEAPONS[id].magSize;
    this.reloading = false;
    this.viewmodel.equip(id);
    emit('weapon:equipped', { id, name: WEAPONS[id].name });
    emit('weapon:ammo', { ammo: this.ammo, max: WEAPONS[id].magSize });
  }

  cycle() {
    if (this.reloading) return;
    this.currentIndex = (this.currentIndex + 1) % this.inventory.length;
    this._equip(this.inventory[this.currentIndex]);
    emit('weapon:cycle');
  }

  reload() {
    if (this.reloading || this.ammo === this.def.magSize) return;
    this.reloading = true;
    this.reloadT = 0;
    emit('weapon:reload:start');
  }

 update(dt) {
    const def = this.def;

    // ADS
    this.ads = this.input.actions.ads && !this.player.sprinting && this.player.alive;
    const targetAds = this.ads ? 1 : 0;
    this.adsAmount += (targetAds - this.adsAmount) * Math.min(dt * 10, 1);

    // ---- Reload progress — PRECISA rodar SEMPRE, mesmo recarregando ----
    if (this.reloading) {
      this.reloadT += dt;
      const p = this.reloadT / def.reloadTime;
      if (p >= 1) {
        this.reloading = false;
        this.ammo = def.magSize;
        emit('weapon:ammo', { ammo: this.ammo, max: def.magSize });
        emit('weapon:reload:end');
      }
    }

    // Firing
    this.fireCooldown -= dt;
    if (!this.player.alive || this.reloading) return;

    const wantsFire = def.auto ? this.input.actions.fire : this.input.consumeAction('fire');
    if (wantsFire && this.fireCooldown <= 0 && this.ammo > 0 && !this.player.sprinting) {
      this._fire();
    }

    if (this.ammo === 0 && !this.reloading) this.reload();
}

  get reloadProgress() {
    if (!this.reloading) return 0;
    return Math.min(this.reloadT / this.def.reloadTime, 1);
  }

  _currentSpread() {
    const def = this.def;
    const base = this.ads ? def.spreadAds : def.spreadHip;
    const walkSpd = CONFIG.PLAYER?.walkSpeed || 5.2;
    const speedRatio = Math.hypot(this.player.vel.x, this.player.vel.z) / walkSpd;
    const moveSpread = speedRatio * (this.ads ? 0.010 : 0.014);
    
    // Adiciona o sway visual do Viewmodel ao desvio da bala (Tarkov-style)
    const swayYaw = this.viewmodel.swayGroup.rotation.y * 0.4; // fator de escala
    const swayPitch = this.viewmodel.swayGroup.rotation.x * 0.4;

    const swaySpread = this.viewmodel.getSpreadFromSway();
    return base + moveSpread + swaySpread + Math.hypot(swayYaw, swayPitch);
  }

  _fire() {
    const def = this.def;
    this.ammo--;
    this.fireCooldown = def.fireInterval;
    emit('weapon:ammo', { ammo: this.ammo, max: def.magSize });

    const now = performance.now() / 1000;
    const streakDelay = CONFIG.GUNPLAY?.fireStreakDecayDelay ?? 0.22;
    const maxStreak = CONFIG.GUNPLAY?.maxFireStreak ?? 6;
    const streakFactor = CONFIG.GUNPLAY?.fireStreakMultiplier ?? 0.16;

    if (now - (this.lastFireGapTime || 0) < streakDelay) {
      this.fireStreak = Math.min((this.fireStreak || 0) + 1, maxStreak);
    } else {
      this.fireStreak = 0;
    }
    this.lastFireGapTime = now;

    const streakMul = 1 + this.fireStreak * streakFactor;

    // Recoil na câmera
    this.player.pitch += def.recoilPitch * (this.ads ? 0.5 : 1) * streakMul;
    
    // Alterna o yaw para os lados baseado no streak
    const yawDir = (this.fireStreak % 2 === 0 ? 1 : -1);
    this.player.yaw += yawDir * def.recoilYaw * (this.ads ? 0.36 : 1) * streakMul * (0.6 + Math.random() * 0.5);
    
    this.viewmodel.applyKick(def.recoilPitch * streakMul, 0);
    this.viewmodel.flash();
    // Calcula muzzle em coords de mundo a partir do mount do viewmodel
	const mz = def.muzzleLocal || [0, 0.02, -0.5];
	const muzzleLocal = new THREE.Vector3(mz[0], mz[1], mz[2]);
	const muzzleWorld = this.viewmodel.mount.localToWorld(muzzleLocal.clone());
	const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(_quat).normalize();
	emit('weapon:fired', {
	weapon: def,
	pos: this.player.pos.clone(),
	muzzleWorld,
	forward,
	});

    // Raycast do tiro
    this.camera.getWorldPosition(_camPos);
    this.camera.getWorldQuaternion(_quat);
    _dir.set(0, 0, -1).applyQuaternion(_quat).normalize();
    _right.set(1, 0, 0).applyQuaternion(_quat);
    _up.set(0, 1, 0).applyQuaternion(_quat);

    const spread = this._currentSpread();
    const a = Math.random() * Math.PI * 2;
    const m = Math.random() * spread;
    
    // No ADS, o projétil segue precisamente o alinhamento da alça/massa de mira (Viewmodel)
    // No Hipfire, o sway influencia o desvio orgânico
    const swayYawFactor = this.ads ? -1.0 : -0.5;
    const swayPitchFactor = this.ads ? 1.0 : 0.5;
    const swayYaw = this.viewmodel.swayGroup.rotation.y * swayYawFactor;
    const swayPitch = this.viewmodel.swayGroup.rotation.x * swayPitchFactor;
    
    _dir.addScaledVector(_right, Math.cos(a) * m + swayYaw)
        .addScaledVector(_up, Math.sin(a) * m + swayPitch)
        .normalize();

    // Alvos: parede + bots
    const hittableMeshes = [];
    for (const bot of this.botsProvider()) {
      hittableMeshes.push(...bot.hittables());
    }

    // Primeiro raycast contra meshes dos bots
    this.raycaster.set(_camPos, _dir);
    this.raycaster.far = 200;
    const hitsBot = this.raycaster.intersectObjects(hittableMeshes, false);

    // Depois raycast contra o mundo físico
    const hitWorld = this.world.raycast(_camPos, _dir, 200);

    const botDist = hitsBot.length ? hitsBot[0].distance : Infinity;
    const worldDist = hitWorld ? hitWorld.distance : Infinity;

    const impactPoint = _camPos.clone().addScaledVector(_dir, Math.min(botDist, worldDist));

    if (botDist < worldDist && hitsBot.length) {
      const h = hitsBot[0];
      const bot = h.object.userData.bot;
      const part = h.object.userData.part;
      const dmg = part === 'head' ? def.damageHead : def.damageBody;
      const killed = bot.takeDamage(dmg, part);
      emit('shot:bot', { point: h.point.clone(), headshot: part === 'head', killed });
    } else if (hitWorld) {
      emit('shot:world', { point: hitWorld.point.clone(), box: hitWorld.box });
    }

	emit('shot:tracer', {
		from: muzzleWorld,
		to: impactPoint,
	});
  }
}