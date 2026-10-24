import * as THREE from 'three';
import { CONFIG } from '../core/ConfigLoader.js';
import { emit, on } from '../core/EventBus.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';
import { NavGrid } from './NavGrid.js';
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
    this.navGrid = world ? (world.navGrid || (world.navGrid = new NavGrid(world))) : null;

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

    // Estado do GPS / Pathfinding A*
    this.path = [];
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.pathGoal = { x: NaN, z: NaN };

    // Detector Anti-Stuck (desengate de cantos/pilares)
    this.stuckCheckTimer = 0.35 + Math.random() * 0.15;
    this.lastProgressPos = new THREE.Vector3();
    this.unstickTimer = 0;
    this.unstickYaw = 0;

    // Burst Fire state
    this.burstShotsRemaining = 0;
    this.burstShotDelay = 0.1;

    // Suppression State
    this.suppressionLevel = 0;

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

  clearPath() {
    this.path.length = 0;
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.pathGoal.x = NaN;
    this.pathGoal.z = NaN;
  }

  /**
   * Navega em direção a (targetX, targetZ) seguindo waypoints da malha A* (NavGrid).
   */
  navigateTo(targetX, targetZ, speed, dt, turnSpeed = 5) {
    const bot = this.bot;

    // Se estiver executando manobra curta de desengate lateral (anti-stuck)
    if (this.unstickTimer > 0) {
      this.unstickTimer -= dt;
      this._faceTowards(this.unstickYaw, dt, turnSpeed + 2);
      this.desiredMove.x = Math.sin(this.unstickYaw) * speed;
      this.desiredMove.z = Math.cos(this.unstickYaw) * speed;
      return;
    }

    this.repathTimer -= dt;
    const goalShift = Math.hypot(targetX - this.pathGoal.x, targetZ - this.pathGoal.z);
    const needRepath =
      this.path.length === 0 ||
      this.pathIndex >= this.path.length ||
      Number.isNaN(this.pathGoal.x) ||
      (goalShift > 1.8 && this.repathTimer <= 0.25) ||
      this.repathTimer <= 0;

    if (needRepath && this.navGrid) {
      this.path = this.navGrid.findPath(bot.pos, { x: targetX, z: targetZ });
      this.pathIndex = 0;
      this.pathGoal.x = targetX;
      this.pathGoal.z = targetZ;
      // Intervalo escalonado (550ms a 900ms) para nunca recalcular todos os bots no mesmo frame
      this.repathTimer = 0.55 + Math.random() * 0.35;
    }

    // Avança pelos waypoints já alcançados
    while (this.pathIndex < this.path.length - 1) {
      const wp = this.path[this.pathIndex];
      if (Math.hypot(wp.x - bot.pos.x, wp.z - bot.pos.z) < 0.72) {
        this.pathIndex++;
      } else {
        break;
      }
    }

    const activeWp = this.path[this.pathIndex] || { x: targetX, z: targetZ };
    const dx = activeWp.x - bot.pos.x;
    const dz = activeWp.z - bot.pos.z;
    const distToWp = Math.hypot(dx, dz);

    if (distToWp < 0.15) {
      this.desiredMove.x = 0;
      this.desiredMove.z = 0;
      return;
    }

    const yaw = Math.atan2(dx, dz);
    this._faceTowards(yaw, dt, turnSpeed);
    this.desiredMove.x = Math.sin(yaw) * speed;
    this.desiredMove.z = Math.cos(yaw) * speed;
  }

  _updateStuckDetector(dt) {
    this.stuckCheckTimer -= dt;
    if (this.stuckCheckTimer > 0) return;
    this.stuckCheckTimer = 0.35 + Math.random() * 0.10;

    const bot = this.bot;
    const wantSpeed = Math.hypot(this.desiredMove.x, this.desiredMove.z);
    const movedDist = Math.hypot(bot.pos.x - this.lastProgressPos.x, bot.pos.z - this.lastProgressPos.z);
    this.lastProgressPos.copy(bot.pos);

    // Se o bot queria andar mas ficou preso em quina/batente/outro bot
    if (wantSpeed > 0.6 && movedDist < 0.12) {
      this.clearPath();
      if (this.state === 'patrol') {
        this.hasPatrolTarget = false;
      }

      // Escolhe um ângulo lateral ou diagonal livre para desgrudar da quina
      const candidates = [
        bot.yaw + Math.PI * 0.5,
        bot.yaw - Math.PI * 0.5,
        bot.yaw + Math.PI * 0.75,
        bot.yaw - Math.PI * 0.75,
        bot.yaw + Math.PI,
      ];
      let chosenYaw = candidates[Math.floor(Math.random() * 2)];
      if (this.navGrid) {
        for (let i = 0; i < candidates.length; i++) {
          const a = candidates[i];
          const tx = bot.pos.x + Math.sin(a) * 1.1;
          const tz = bot.pos.z + Math.cos(a) * 1.1;
          if (this.navGrid.isWorldWalkable(tx, tz)) {
            chosenYaw = a;
            break;
          }
        }
      }
      this.unstickYaw = chosenYaw;
      this.unstickTimer = 0.26;
    }
  }

  applySuppression(intensity = 0.5) {
    this.suppressionLevel = Math.min(1.0, this.suppressionLevel + intensity * 0.7);
    // Se o bot estiver em patrulha desavisado e um tiro passa raspando, alerta e busca cobertura
    if (this.state === 'patrol') {
      this.changeState('search');
    } else if (this.suppressionLevel > 0.65 && this.state === 'engage' && Math.random() < 0.4) {
      this.changeState('flee');
    }
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
    this.clearPath();
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

    // Decaimento natural do nível de supressão ao longo do tempo
    if (this.suppressionLevel > 0) {
      this.suppressionLevel = Math.max(0, this.suppressionLevel - dt * 0.45);
    }

    // Atualiza o estado atual na FSM
    this.currentState.update(this, dt, player, dist, canSee);

    // Monitora se o bot ficou preso em alguma quina e aplica manobra de desengate
    this._updateStuckDetector(dt);

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
    let hitChance = Math.min(maxAcc, Math.max(baseAcc, 1 - dist / rangeAcc));
    // Penalidade por supressão (tiros passando perto tiram a precisão do bot em até 55%)
    if (this.suppressionLevel > 0) {
      hitChance *= Math.max(0.35, 1.0 - this.suppressionLevel * 0.55);
    }
    const hit = Math.random() < hitChance;

    if (hit) {
      _endPos.copy(_targetPos); // Acertou o player
    } else {
      // Errou, desvia o tiro próximo da cabeça (0.6m a 2.3m) gerando supressão tática
      const missAngle = Math.random() * Math.PI * 2;
      const missDist = 0.6 + Math.random() * 1.7; // entre 0.6m e 2.3m
      _endPos.set(
        _targetPos.x + Math.cos(missAngle) * missDist,
        _targetPos.y + (Math.random() - 0.5) * 1.4,
        _targetPos.z + Math.sin(missAngle) * missDist
      );
    }
    
    // Vetor de direção real do disparo
    _forward.subVectors(_endPos, _muzzleWorld).normalize();

    // Evento de tiro para flash/dano/projétil físico/áudio espacial
    emit('bot:fired', {
      bot: this.bot,
      player,
      dist,
      hit,
      pos: _muzzleWorld.clone(),
      muzzleWorld: _muzzleWorld.clone(),
      endPos: _endPos.clone(),
      dir: _forward.clone()
    });
    
    // Evento de muzzle flash
    // Muzzle flash e áudio 3D são disparados via bot:fired
  }
}