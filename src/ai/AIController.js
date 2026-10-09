import * as THREE from 'three';
import { CONFIG } from '../core/ConfigLoader.js';
import { emit, on } from '../core/EventBus.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';
import { PatrolState } from './states/PatrolState.js';
import { EngageState } from './states/EngageState.js';
import { SearchState } from './states/SearchState.js';
import { FleeState } from './states/FleeState.js';

const _toPlayer = new THREE.Vector3();
const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _muzzleLocal = new THREE.Vector3(0.10, 1.03, 0.85);
const _upAxis = new THREE.Vector3(0, 1, 0);
const _botQuat = new THREE.Quaternion();
const _muzzleWorld = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _endPos = new THREE.Vector3();

export class AIController {
  constructor(bot, world) {
    this.bot = bot;
    this.world = world;
    this.desiredMove = new THREE.Vector3();
    this.lastKnownPlayerPos = new THREE.Vector3();
    this.hasKnownPlayerPos = false;
    this.losTimer = 0;
    this.searchTimer = 0;
    this.reactionTimer = 0;
    this.fireTimer = 1 + Math.random();
    this.patrolTarget = { x: 0, z: 0 };
    this.hasPatrolTarget = false;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 1;

    // Burst Fire state
    this.burstShotsRemaining = 0;
    this.burstShotDelay = 0.1;

    // FSM States registry
    this.states = {
      patrol: new PatrolState(),
      engage: new EngageState(),
      search: new SearchState(),
      flee: new FleeState()
    };
    this.currentState = this.states.patrol;
    this.state = 'patrol';

    this._bindAudioSensory();
    this._bindPlayerDied();
  }

  _bindPlayerDied() {
    this._unsubPlayerDied = on('player:died', () => {
      if (!this.bot.alive) return;
      // Ao abater o player, os bots dispersam (flee / recuo para longe da área)
      this.burstShotsRemaining = 0;
      this.hasKnownPlayerPos = false;
      this.changeState('flee');
    });
  }

  changeState(stateName) {
    if (!this.states[stateName]) return;
    if (this.currentState) {
      this.currentState.exit(this);
    }
    this.state = stateName;
    this.currentState = this.states[stateName];
    this.currentState.enter(this);
  }

  _bindAudioSensory() {
    this._unsubShot = on('weapon:fired', (e) => {
      if (!this.bot.alive) return;
      // Se não estiver em combate ativo (engage ou flee), reage ao som de tiros
      if (this.state === 'patrol' && e.muzzleWorld) {
        const distSound = Math.hypot(e.muzzleWorld.x - this.bot.pos.x, e.muzzleWorld.z - this.bot.pos.z);
        if (distSound < 35.0) {
          this.lastKnownPlayerPos.set(e.muzzleWorld.x, e.muzzleWorld.y, e.muzzleWorld.z);
          this.hasKnownPlayerPos = true;
          this.changeState('search');
        }
      }
    });
  }

  destroy() {
    if (this._unsubShot) {
      this._unsubShot();
      this._unsubShot = null;
    }
    if (this._unsubPlayerDied) {
      this._unsubPlayerDied();
      this._unsubPlayerDied = null;
    }
  }

  update(dt, player) {
    const bot = this.bot;
    _toPlayer.subVectors(player.pos, bot.pos);
    _toPlayer.y = 0;
    const dist = _toPlayer.length();

    // CPU Optimization: Não rodar raycast a 60Hz. 
    // Verifica apenas a cada ~100ms (10Hz).
    this._losTimerTick = (this._losTimerTick || 0) - dt;
    if (this._losTimerTick <= 0) {
      this._canSee = player.alive && this._hasLOS(player, dist);
      this._losTimerTick = 0.1 + Math.random() * 0.05; // 100ms + jitter
    }
    const canSee = this._canSee;

    if (canSee) {
      this.lastKnownPlayerPos.copy(player.pos);
      this.hasKnownPlayerPos = true;
      if (this.state !== 'engage' && this.state !== 'flee') {
        this.changeState('engage');
        emit('bot:alerted', { bot });
      }
    }

    // Se o estado mudou via string legada, sincroniza com o objeto da FSM
    if (this.state !== this.currentState.name && this.states[this.state]) {
      this.changeState(this.state);
    }

    // Atualiza o estado atual na FSM
    this.currentState.update(this, dt, player, dist, canSee);

    // Aplica velocidade desejada
    bot.vel.x = this.desiredMove.x;
    bot.vel.z = this.desiredMove.z;
  }

  _hasLOS(player, dist) {
    if (dist > CONFIG.BOTS.viewRange) return false;
    _from.set(this.bot.pos.x, this.bot.pos.y + 1.4, this.bot.pos.z);
    _dir.set(player.pos.x - _from.x, (player.pos.y + 1.4) - _from.y, player.pos.z - _from.z);
    const d = _dir.length();
    if (d < 0.001) return true;
    _dir.normalize();
    const hit = this.world.raycast(_from, _dir, d - 0.01);
    return !hit;
  }

  _faceTowards(targetYaw, dt, speed = 6) {
    let diff = targetYaw - this.bot.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.bot.yaw += diff * Math.min(speed * dt, 1);
  }

  _fire(player, dist) {
    // Calculo do cano da arma
    _botQuat.setFromAxisAngle(_upAxis, this.bot.yaw);
    _muzzleWorld.copy(_muzzleLocal).applyQuaternion(_botQuat).add(this.bot.pos);

    // Vetor de direção real: da arma pro player
    _targetPos.copy(player.pos);
    _targetPos.y += 1.4; // Altura do peito do player
    _forward.subVectors(_targetPos, _muzzleWorld).normalize();

    const baseAcc = CONFIG.BOTS?.hitAccuracyBase ?? 0.08;
    const rangeAcc = CONFIG.BOTS?.hitAccuracyRange ?? 28.0;
    const maxAcc = CONFIG.BOTS?.hitAccuracyMax ?? 0.55;
    const hitChance = Math.min(maxAcc, Math.max(baseAcc, 1 - dist / rangeAcc));
    const hit = Math.random() < hitChance;

    // Evento de tiro para flash/dano
    emit('bot:fired', { bot: this.bot, player, dist, hit });
    
    // Evento de muzzle flash
    emit('weapon:fired', { muzzleWorld: _muzzleWorld, forward: _forward });

    if (hit) {
      _endPos.copy(_targetPos); // Acertou o player
    } else {
      // Errou, desvia o tiro e tracer visivelmente
      _endPos.set(
        _targetPos.x + (Math.random() - 0.5) * 5.5,
        _targetPos.y + (Math.random() - 0.5) * 3.0,
        _targetPos.z + (Math.random() - 0.5) * 5.5
      );
    }
    
    const wep = WEAPONS[this.bot.weaponId];
    emit('shot:tracer', {
      from: _muzzleWorld,
      to: _endPos,
      color: wep?.tracerColor,
      profile: wep?.tracerProfile,
      speed: wep?.ballistics?.terminal?.bulletSpeed,
      weaponId: this.bot.weaponId
    });
  }
}