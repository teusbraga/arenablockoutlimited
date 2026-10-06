import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { emit } from '../core/EventBus.js';

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
    this.state = 'patrol';               // patrol | engage | search
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
  }

  update(dt, player) {
    const bot = this.bot;
    _toPlayer.subVectors(player.pos, bot.pos);
    _toPlayer.y = 0;
    const dist = _toPlayer.length();

    const canSee = player.alive && this._hasLOS(player, dist);

    if (canSee) {
      this.lastKnownPlayerPos.copy(player.pos);
      this.hasKnownPlayerPos = true;
      this.losTimer = CONFIG.BOTS.losMemory;
      if (this.state !== 'engage') {
        this.state = 'engage';
        this.reactionTimer = CONFIG.BOTS.reactionTime;
        emit('bot:alerted', { bot });
      }
    } else if (this.state === 'engage') {
      this.losTimer -= dt;
      if (this.losTimer <= 0) {
        this.state = 'search';
        this.searchTimer = CONFIG.BOTS.searchTime;
      }
    }

    // Despacho por estado
    if (this.state === 'engage') this._engage(dt, player, dist, canSee);
    else if (this.state === 'search') this._search(dt);
    else this._patrol(dt);

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

  _engage(dt, player, dist, canSee) {
    const bot = this.bot;
    const targetYaw = Math.atan2(player.pos.x - bot.pos.x, player.pos.z - bot.pos.z);
    this._faceTowards(targetYaw, dt, 8);

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.strafeTimer = 0.6 + Math.random() * 1.2;
    }

    // Strafe lateral
    const rightX = Math.cos(bot.yaw);
    const rightZ = -Math.sin(bot.yaw);
    this.desiredMove.x = rightX * this.strafeDir * CONFIG.BOTS.walkSpeed * 0.6;
    this.desiredMove.z = rightZ * this.strafeDir * CONFIG.BOTS.walkSpeed * 0.6;

    // Avanço / recuo
    let forward = 0;
    if (dist > 14) forward = CONFIG.BOTS.sprintSpeed * 0.7;
    else if (dist < 5) forward = -CONFIG.BOTS.walkSpeed * 0.6;
    this.desiredMove.x += Math.sin(bot.yaw) * forward;
    this.desiredMove.z += Math.cos(bot.yaw) * forward;

    // Tiro
    if (canSee && this.reactionTimer <= 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = CONFIG.BOTS.fireInterval * (0.8 + Math.random() * 0.6);
        this._fire(player, dist);
      }
    } else if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
    }
  }

  _search(dt) {
    const bot = this.bot;
    this.searchTimer -= dt;
    if (this.searchTimer <= 0) {
      this.state = 'patrol';
      this.hasPatrolTarget = false;
      return;
    }

    if (!this.hasKnownPlayerPos) {
      this.state = 'patrol';
      return;
    }
    const dx = this.lastKnownPlayerPos.x - bot.pos.x;
    const dz = this.lastKnownPlayerPos.z - bot.pos.z;
    const d = Math.hypot(dx, dz);

    if (d < 1.2) {
      this.desiredMove.set(0, 0, 0);
      return;
    }
    const yaw = Math.atan2(dx, dz);
    this._faceTowards(yaw, dt, 5);
    this.desiredMove.x = Math.sin(yaw) * CONFIG.BOTS.walkSpeed;
    this.desiredMove.z = Math.cos(yaw) * CONFIG.BOTS.walkSpeed;
  }

  _patrol(dt) {
    const bot = this.bot;
    if (!this.patrolTarget) {
      this.patrolTarget = { x: 0, z: 0 };
      this.hasPatrolTarget = false;
    }
    if (!this.hasPatrolTarget || Math.hypot(this.patrolTarget.x - bot.pos.x, this.patrolTarget.z - bot.pos.z) < 1.5) {
      this.patrolTarget.x = (Math.random() * 2 - 1) * 16;
      this.patrolTarget.z = (Math.random() * 2 - 1) * 16;
      this.hasPatrolTarget = true;
    }
    const dx = this.patrolTarget.x - bot.pos.x;
    const dz = this.patrolTarget.z - bot.pos.z;
    const yaw = Math.atan2(dx, dz);
    this._faceTowards(yaw, dt, 4);
    this.desiredMove.x = Math.sin(yaw) * CONFIG.BOTS.walkSpeed * 0.7;
    this.desiredMove.z = Math.cos(yaw) * CONFIG.BOTS.walkSpeed * 0.7;
  }

  _fire(player, dist) {
    _botQuat.setFromAxisAngle(_upAxis, this.bot.yaw);
    _muzzleWorld.copy(_muzzleLocal).applyQuaternion(_botQuat).add(this.bot.pos);

    // Vector de direcao real: da arma pro player
    _targetPos.copy(player.pos);
    _targetPos.y += 1.4; // Altura do peito do player
    _forward.subVectors(_targetPos, _muzzleWorld).normalize();

    // Evento de tiro para flash/dano
    emit('bot:fired', { bot: this.bot, player, dist });
    
    // Evento de muzzle flash
    emit('weapon:fired', { muzzleWorld: _muzzleWorld, forward: _forward });

    // Evento de tracer
    const hitChance = Math.max(0.15, 1 - dist / 35);
    const hit = Math.random() < hitChance;
    
    if (hit) {
      _endPos.copy(_targetPos); // Acertou o player
    } else {
      // Errou, desvia o tracer
      _endPos.set(
        _targetPos.x + (Math.random() - 0.5) * 4,
        _targetPos.y + (Math.random() - 0.5) * 2,
        _targetPos.z + (Math.random() - 0.5) * 4
      );
    }
    
    emit('shot:tracer', { from: _muzzleWorld, to: _endPos });
  }
}