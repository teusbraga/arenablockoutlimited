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
  constructor({ camera, viewmodel, input, player, world, botsProvider, inventory }) {
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.input = input;
    this.player = player;
    this.world = world;
    this.botsProvider = botsProvider;

    // Inventário dinâmico baseado nas armas carregadas do weapons.json
    this.inventory = inventory || (Object.keys(WEAPONS).length > 0 ? Object.keys(WEAPONS) : ['ar15', 'p9']);
    this.currentIndex = 0;
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

    this._equip(this.inventory[0], true);
  }

  get def() { return WEAPONS[this.current]; }

  _equip(id, instant = false) {
    if (this.current) {
      this.ammoByWeapon[this.current] = this.ammo;
    }
    this.current = id;
    if (this.ammoByWeapon[id] === undefined) {
      this.ammoByWeapon[id] = WEAPONS[id].magSize;
    }
    this.ammo = this.ammoByWeapon[id];
    this.reloading = false;
    this.reloadT = 0;
    this.viewmodel.equip(id);
    emit('weapon:equipped', { id, name: WEAPONS[id].name });
    emit('weapon:ammo', { ammo: this.ammo, max: WEAPONS[id].magSize });
  }

  cycle() {
    this.currentIndex = (this.currentIndex + 1) % this.inventory.length;
    this._equip(this.inventory[this.currentIndex]);
    emit('weapon:cycle');
  }

  selectSlot(idx) {
    if (idx < 0 || idx >= this.inventory.length || idx === this.currentIndex) return;
    this.currentIndex = idx;
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

    // 1. Troca de arma (tecla Q, slots 1/2 ou botão mobile ARMA)
    if (this.input.consumeAction('nextWeapon')) {
      this.cycle();
    }
    if (this.input.consumeAction('slot1')) {
      this.selectSlot(0);
    }
    if (this.input.consumeAction('slot2')) {
      this.selectSlot(1);
    }

    // 2. Recarga manual (tecla R ou botão mobile RELOAD)
    if (this.input.consumeAction('reload')) {
      this.reload();
    }

    // 3. ADS
    this.ads = this.input.actions.ads && !this.player.sprinting && this.player.alive;
    const targetAds = this.ads ? 1 : 0;
    this.adsAmount += (targetAds - this.adsAmount) * Math.min(dt * 10, 1);

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

    // 5. Disparo
    this.fireCooldown -= dt;
    if (!this.player.alive || this.reloading) return;

    const wantsFire = def.auto ? this.input.actions.fire : this.input.consumeAction('fire');
    if (wantsFire && this.fireCooldown <= 0 && this.ammo > 0 && !this.player.sprinting) {
      this._fire();
      this.ammoByWeapon[this.current] = this.ammo;
    }

    if (this.ammo === 0 && !this.reloading) this.reload();

    // ── Recuperação Elástica do Recoil da Câmera ────────────────────────────
    // A câmera volta ao centro suavemente de maneira fluida e contínua
    if ((this._recoilDebt || 0) > 0.0001) {
      const recoverySpeed = this.ads ? 6.0 : 8.5;
      const step = this._recoilDebt * recoverySpeed * dt;
      const recover = Math.min(this._recoilDebt, Math.max(step, 0.001 * dt));
      this._recoilDebt -= recover;
      this.player.pitch -= recover;
    } else {
      this._recoilDebt = 0;
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

    if (this.ads) {
      // No ADS: primeiro tiro parado tem precisão absoluta (pinpoint)
      const movePenalty = speedRatio * 0.008;
      const streakPenalty = (this.fireStreak || 0) * 0.0012;
      return def.spreadAds + movePenalty + streakPenalty;
    }

    // No Hipfire: dispersão clássica arcade controlada
    const moveSpread = speedRatio * 0.012;
    const streakSpread = (this.fireStreak || 0) * 0.0025;
    return def.spreadHip + moveSpread + streakSpread;
  }

  _fire() {
    const def = this.def;
    this.ammo--;
    this.fireCooldown = def.fireInterval;
    emit('weapon:ammo', { ammo: this.ammo, max: def.magSize });

    const now = performance.now() / 1000;
    const streakDelay = CONFIG.GUNPLAY?.fireStreakDecayDelay ?? 0.20;
    const maxStreak   = CONFIG.GUNPLAY?.maxFireStreak ?? 8;
    const streakFactor = CONFIG.GUNPLAY?.fireStreakMultiplier ?? 0.08;

    if (now - (this.lastFireGapTime || 0) < streakDelay) {
      this.fireStreak = Math.min((this.fireStreak || 0) + 1, maxStreak);
    } else {
      this.fireStreak = 0;
    }
    this.lastFireGapTime = now;

    const streakMul = 1 + this.fireStreak * streakFactor;

    // ── Recoil Vertical da Câmera ───────────────────────────────────────────
    // No ADS, a câmera é muito firme (recuo leve para acompanhamento fácil do alvo)
    const pitchScale = this.ads ? 0.25 : 0.85;
    const pitchAdd = def.recoilPitch * pitchScale * streakMul;
    this.player.pitch += pitchAdd;

    // 70% do recoil vertical retorna suavemente (retorno elástico moderno)
    this._recoilDebt = (this._recoilDebt || 0) + pitchAdd * 0.70;

    // ── Recoil Horizontal da Câmera ────────────────────────────────────────
    // No primeiro tiro: zero horizontal. Em spray: leve oscilação previsível
    if (this.fireStreak > 0) {
      const yawBias = def.recoilYawBias ?? 0.5;
      const yawScale = this.ads ? 0.20 : 0.60;
      const yawAdd = yawBias * def.recoilYaw * yawScale * streakMul;
      this.player.yaw += yawAdd;
    }
    
    const kickbackZ = def.kickbackZ ?? (def.id === 'm249' ? 0.010 : def.id === 'uzi' ? 0.006 : 0.008);
    const kickRot = def.kickRotFactor ?? 1.5;
    this.viewmodel.applyKick(def.recoilPitch * streakMul, 0, kickbackZ, kickRot, this.ads);
    this.viewmodel.flash();

    // Raycast do tiro & Posições de Câmera
    this.camera.getWorldPosition(_camPos);
    this.camera.getWorldQuaternion(_quat);

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

    _dir.set(0, 0, -1).applyQuaternion(_quat).normalize();
    _right.set(1, 0, 0).applyQuaternion(_quat);
    _up.set(0, 1, 0).applyQuaternion(_quat);

    const spread = this._currentSpread();
    const a = Math.random() * Math.PI * 2;
    const m = Math.random() * spread;
    
    // Onde a mira aponta o tiro vai: sem distorções de sway somadas no vetor do tiro!
    _dir.addScaledVector(_right, Math.cos(a) * m)
        .addScaledVector(_up, Math.sin(a) * m)
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

    const hitDist = Math.min(botDist, worldDist);
    const traceDist = Number.isFinite(hitDist) ? hitDist : 120;

    // Ponto de impacto e traçante colineares com o cano:
    // O traçante sai da boca do cano e viaja em linha reta absoluta (extensão física da régua do cano)
    const impactPoint = (this.ads ? _camPos : muzzleWorld).clone().addScaledVector(_dir, traceDist);

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
      color: def.tracerColor,
    });
  }
}