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
    this.motionGraceTimer = 0.25;

    // Burst Fire state
    this.burstShotsRemaining = 0;
    this.burstShotDelay = 0.1;

    // Suppression State
    this.suppressionLevel = 0;

    this.gameManager = null;
    this.currentTarget = null;

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

  /**
   * Avalia se há um obstáculo transponível/baixo à frente (entre 0.35m e 1.40m ou vaultable: true)
   * e aciona o pulo intencional bot.vel.y = 6.0 para transpor a superfície.
   */
  tryVault() {
    const bot = this.bot;
    if (!bot.onGround || !this.world) return false;

    // Cooldown para evitar saltos repetitivos seguidos
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this._lastVaultTime && (now - this._lastVaultTime) < 450) {
      return false;
    }

    const forwardX = this.desiredMove.x !== 0 ? this.desiredMove.x : Math.sin(bot.yaw);
    const forwardZ = this.desiredMove.z !== 0 ? this.desiredMove.z : Math.cos(bot.yaw);
    const speed = Math.hypot(forwardX, forwardZ);
    if (speed < 0.01) return false;

    const dirX = forwardX / speed;
    const dirZ = forwardZ / speed;

    const probeDist = 1.05;
    const probeX = bot.pos.x + dirX * probeDist;
    const probeZ = bot.pos.z + dirZ * probeDist;
    const currentY = bot.pos.y;

    const minX = Math.min(bot.pos.x, probeX) - 0.45;
    const maxX = Math.max(bot.pos.x, probeX) + 0.45;
    const minZ = Math.min(bot.pos.z, probeZ) - 0.45;
    const maxZ = Math.max(bot.pos.z, probeZ) + 0.45;

    const candidates = this.world.getNearbyBoxes
      ? this.world.getNearbyBoxes(minX, maxX, minZ, maxZ)
      : (this.world.boxes || []);

    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (!b.solid) continue;

      const relHeight = b.max.y - currentY;
      const isLow = relHeight > 0.30 && relHeight <= 1.35;
      const isVaultable = b.vaultable === true || b.meta?.vaultable === true || isLow;

      if (isVaultable && relHeight > 0.30 && relHeight <= 1.50) {
        if (maxX >= b.min.x && minX <= b.max.x &&
            maxZ >= b.min.z && minZ <= b.max.z) {
          bot.vel.y = 6.0;
          this._lastVaultTime = now;
          return true;
        }
      }
    }
    return false;
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

    // Salto ativo se houver obstáculo baixo transponível no caminho
    if (bot.onGround && (bot.lastMoveRes?.hitWall || Math.random() < 0.08)) {
      this.tryVault();
    }

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
    const wantSpeed = Math.hypot(this.desiredMove.x, this.desiredMove.z);

    // Grace period de 250ms ao arrancar da imobilidade para evitar falso-positivo durante aceleração
    if (wantSpeed <= 0.2) {
      this.motionGraceTimer = 0.25;
    } else if (this.motionGraceTimer > 0) {
      this.motionGraceTimer = Math.max(0, this.motionGraceTimer - dt);
      return;
    }

    this.stuckCheckTimer -= dt;
    if (this.stuckCheckTimer > 0) return;
    this.stuckCheckTimer = 0.35 + Math.random() * 0.10;

    const bot = this.bot;
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
    const handleGunshot = (e) => {
      if (!this.bot.alive) return;
      if (e?.bot === this.bot) return;
      const muzzle = e?.muzzleWorld || e?.pos;
      if (muzzle && (this.state === 'patrol' || this.state === 'search')) {
        const distSound = Math.hypot(muzzle.x - this.bot.pos.x, muzzle.z - this.bot.pos.z);
        if (distSound < 35.0) {
          this.lastKnownPlayerPos.set(muzzle.x, muzzle.y, muzzle.z);
          this.hasKnownPlayerPos = true;
          this.changeState('search');
        }
      }
    };
    this._unsubShot = on('weapon:fired', handleGunshot);
    this._unsubBotShot = on('bot:fired', handleGunshot);
  }

  destroy() {
    if (this._unsubShot) {
      this._unsubShot();
      this._unsubShot = null;
    }
    if (this._unsubBotShot) {
      this._unsubBotShot();
      this._unsubBotShot = null;
    }
    if (this._unsubPlayerDied) {
      this._unsubPlayerDied();
      this._unsubPlayerDied = null;
    }
  }

  _selectTarget(player) {
    if (!this.gameManager) {
      return (player && player.alive) ? player : null;
    }

    const bot = this.bot;
    const candidates = [player, ...(this.gameManager.bots || [])].filter(
      c => c && c !== bot && c.alive && this.gameManager.isEnemy(bot, c)
    );

    if (candidates.length === 0) return null;

    if (this.currentTarget && candidates.includes(this.currentTarget) && this.currentTarget.alive) {
      const d = Math.hypot(this.currentTarget.pos.x - bot.pos.x, this.currentTarget.pos.z - bot.pos.z);
      if (this._hasLOS(this.currentTarget, d)) {
        return this.currentTarget;
      }
    }

    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const d = Math.hypot(c.pos.x - bot.pos.x, c.pos.z - bot.pos.z);
      if (d < bestDist && this._hasLOS(c, d)) {
        best = c;
        bestDist = d;
      }
    }

    return best || (this.currentTarget?.alive ? this.currentTarget : candidates[0]);
  }

  update(dt, player) {
    const bot = this.bot;
    const target = this._selectTarget(player);
    this.currentTarget = target;

    let dist = Infinity;
    let canSee = false;

    if (target) {
      const dx = target.pos.x - bot.pos.x;
      const dy = (target.pos.y + 1.4) - (bot.pos.y + 1.4);
      const dz = target.pos.z - bot.pos.z;
      const distXZ = Math.hypot(dx, dz);
      const dist3D = Math.hypot(dx, dy, dz);
      dist = dist3D;

      this._losTimerTick = (this._losTimerTick || 0) - dt;
      if (this._losTimerTick <= 0) {
        this._canSee = target.alive && this._hasLOS(target, distXZ);
        this._losTimerTick = 0.1 + Math.random() * 0.05;
      }
      canSee = this._canSee;

      if (canSee) {
        this.lastKnownPlayerPos.copy(target.pos);
        this.hasKnownPlayerPos = true;
        if (this.state !== 'engage' && this.state !== 'flee') {
          this.changeState('engage');
          emit('bot:alerted', { bot });
        }
      }

      // Inclinação biomecânica vertical (pitch) - apenas em combate ou quando avistar o alvo
      if ((canSee || this.state === 'engage') && distXZ > 0.05) {
        bot.pitch = Math.atan2(dy, distXZ);
      } else {
        bot.pitch = 0;
      }
    } else {
      bot.pitch = 0;
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
    this.currentState.update(this, dt, target || player, dist, canSee);

    // Monitora se o bot ficou preso em alguma quina e aplica manobra de desengate
    this._updateStuckDetector(dt);

    // Aplica velocidade desejada com aceleração e frenagem suaves (humanização de locomoção)
    const targetX = this.desiredMove.x;
    const targetZ = this.desiredMove.z;
    const targetSpeed = Math.hypot(targetX, targetZ);

    if (targetSpeed > 0.05) {
      const kAcc = Math.min(18.0 * dt, 1.0);
      bot.vel.x += (targetX - bot.vel.x) * kAcc;
      bot.vel.z += (targetZ - bot.vel.z) * kAcc;
    } else {
      const kDec = Math.min(26.0 * dt, 1.0);
      bot.vel.x -= bot.vel.x * kDec;
      bot.vel.z -= bot.vel.z * kDec;
      if (Math.hypot(bot.vel.x, bot.vel.z) < 0.01) {
        bot.vel.x = 0;
        bot.vel.z = 0;
      }
    }
  }

  _hasLOS(player, dist) {
    if (dist > CONFIG.BOTS.viewRange) return false;

    // Cone de visão (FOV): Em patrulha ou busca, bots só detectam jogadores dentro do arco frontal
    // a menos que o jogador esteja muito próximo (<= 3.0m), onde ruído de passos permite percepção tática
    if (this.state === 'patrol' || this.state === 'search') {
      if (dist > 3.0) {
        const toX = player.pos.x - this.bot.pos.x;
        const toZ = player.pos.z - this.bot.pos.z;
        const horizontalDist = Math.hypot(toX, toZ);
        if (horizontalDist > 0.001) {
          const forwardX = Math.sin(this.bot.yaw);
          const forwardZ = Math.cos(this.bot.yaw);
          const dot = (forwardX * toX + forwardZ * toZ) / horizontalDist;
          const halfFov = (CONFIG.BOTS.fov ?? 2.45) * 0.5;
          if (dot < Math.cos(halfFov)) {
            return false;
          }
        }
      }
    }
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