import * as THREE from 'three';
import { emit } from '../core/EventBus.js';
import { BallisticsCalculator } from './BallisticsCalculator.js';

export const SPEED_OF_SOUND = 343.0; // Velocidade do som no ar (m/s) a 20°C

/**
 * Representação individual de um projétil em voo.
 * Objeto reutilizável para a piscina (Object Pool).
 */
export class Projectile {
  constructor() {
    this.active = false;
    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.gravity = 9.8;
    this.drag = 0.005;
    this.speed = 700;
    this.color = '#ffd27f';
    this.weaponDef = null;
    this.owner = 'player'; // 'player' | 'bot'
    this.ownerEntity = null;
    this.distanceTraveled = 0;
    this.maxDistance = 500;
    this.life = 0;
    this.maxLife = 3.0;
    this.isPellet = false;
  }

  reset() {
    this.active = false;
    this.distanceTraveled = 0;
    this.life = 0;
    this.weaponDef = null;
    this.ownerEntity = null;
  }
}

// Vetores auxiliares reutilizáveis para zerar alocação de memória no loop a 120Hz
const _stepVec = new THREE.Vector3();
const _stepDir = new THREE.Vector3();
const _hittableMeshes = [];
const _screenPos = new THREE.Vector3();
const _botHitPoint = new THREE.Vector3();
const _worldHitPoint = new THREE.Vector3();

/**
 * ProjectileManager
 * Gerencia a simulação física de projéteis com Continuous Collision Detection (CCD),
 * Trajetória parabólica, resistência do ar, vento e atraso acústico realista.
 */
export class ProjectileManager {
  constructor({ world, botsProvider = () => [], player = null, camera = null, maxProjectiles = 256 }) {
    this.world = world;
    this.botsProvider = botsProvider;
    this.player = player;
    this.camera = camera;
    this.maxProjectiles = maxProjectiles;

    // Object Pool pré-alocado
    this.pool = Array.from({ length: maxProjectiles }, () => new Projectile());
    this.raycaster = new THREE.Raycaster();
    this.wind = new THREE.Vector3(0, 0, 0); // Vento global (m/s)
  }

  setWind(x = 0, y = 0, z = 0) {
    this.wind.set(x, y, z);
  }

  /**
   * Spawna um projétil a partir do pool pré-alocado.
   */
  spawn({
    origin,
    direction,
    weaponDef,
    owner = 'player',
    ownerEntity = null,
    isPellet = false,
    speedOverride = null
  }) {
    let p = null;
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        p = this.pool[i];
        break;
      }
    }

    // Se o pool esgotou (raro), recicla o mais antigo
    if (!p) {
      p = this.pool[0];
    }

    p.reset();

    const ballistics = weaponDef?.ballistics ?? {};
    const terminal = ballistics.terminal ?? {};
    const external = ballistics.external ?? {};

    const speed = speedOverride ?? terminal.bulletSpeed ?? weaponDef?.bulletSpeed ?? 700;
    const drop = terminal.bulletDrop ?? weaponDef?.bulletDrop ?? 9.8;
    const drag = external.drag ?? 0.005;

    p.pos.copy(origin);
    p.prevPos.copy(origin);
    p.vel.copy(direction).normalize().multiplyScalar(speed);
    p.gravity = drop;
    p.drag = drag;
    p.speed = speed;
    p.color = weaponDef?.tracerColor || '#ffd27f';
    p.weaponDef = weaponDef;
    p.owner = owner;
    p.ownerEntity = ownerEntity;
    p.distanceTraveled = 0;
    p.maxDistance = terminal.maxRange ?? 500;
    p.life = 0;
    p.maxLife = 3.5;
    p.isPellet = !!isPellet;
    p.active = true;

    emit('projectile:spawned', {
      projectile: p,
      from: p.prevPos,
      to: p.pos,
      color: p.color
    });

    return p;
  }

  /**
   * Testa colisão de segmento contra bots de forma puramente matemática (AABB/Cilindro)
   * Usado para garantir 100% de precisão e compatibilidade com simulação headless/sem-WebGL.
   */
  _raycastMathBot(prevPos, dir, maxDist, bot) {
    if (!bot || !bot.alive) return null;

    // Bounds do bot: base no chão bot.pos.y até bot.pos.y + 1.8
    const botX = bot.pos.x;
    const botY = bot.pos.y;
    const botZ = bot.pos.z;

    const minX = botX - 0.45, maxX = botX + 0.45;
    const minZ = botZ - 0.45, maxZ = botZ + 0.45;
    const minY = botY,        maxY = botY + 1.85;

    // Ray-AABB intersection (Slab method)
    const invX = 1 / (dir.x || 1e-9);
    const invY = 1 / (dir.y || 1e-9);
    const invZ = 1 / (dir.z || 1e-9);

    let tmin = (minX - prevPos.x) * invX;
    let tmax = (maxX - prevPos.x) * invX;
    if (tmin > tmax) { const tmp = tmin; tmin = tmax; tmax = tmp; }

    let tymin = (minY - prevPos.y) * invY;
    let tymax = (maxY - prevPos.y) * invY;
    if (tymin > tymax) { const tmp = tymin; tymin = tymax; tymax = tmp; }
    if (tmin > tymax || tymin > tmax) return null;
    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (minZ - prevPos.z) * invZ;
    let tzmax = (maxZ - prevPos.z) * invZ;
    if (tzmin > tzmax) { const tmp = tzmin; tzmin = tzmax; tzmax = tmp; }
    if (tmin > tzmax || tzmin > tmax) return null;
    if (tzmin > tmin) tmin = tzmin;
    if (tzmax < tmax) tmax = tzmax;

    if (tmax < 0 || tmin > maxDist) return null;
    const hitT = tmin > 0 ? tmin : tmax;
    if (hitT < 0 || hitT > maxDist) return null;

    const hitY = prevPos.y + dir.y * hitT;
    const part = (hitY >= botY + 1.35) ? 'head' : 'body';

    return {
      distance: hitT,
      part,
      bot,
      point: new THREE.Vector3(
        prevPos.x + dir.x * hitT,
        hitY,
        prevPos.z + dir.z * hitT
      )
    };
  }

  /**
   * Atualização determinística de física e colisão contínua (CCD Sweep).
   */
  update(dt) {
    if (dt <= 0) return;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.prevPos.copy(p.pos);

      // 1. Forças balísticas: Gravidade + Arrasto + Vento
      p.vel.y -= p.gravity * dt;
      if (this.wind.x !== 0) p.vel.x += this.wind.x * dt;
      if (this.wind.z !== 0) p.vel.z += this.wind.z * dt;

      if (p.drag > 0) {
        const dragFactor = Math.max(0, 1 - p.drag * dt);
        p.vel.multiplyScalar(dragFactor);
      }

      // 2. Deslocamento do frame
      _stepVec.copy(p.vel).multiplyScalar(dt);
      const stepDist = _stepVec.length();

      if (stepDist <= 1e-6) {
        p.life += dt;
        continue;
      }

      _stepDir.copy(_stepVec).divideScalar(stepDist);

      // 3. Continuous Collision Detection (CCD Sweep)
      let entityHit = null;

      if (p.owner === 'player') {
        // Verifica se há meshes de bots disponíveis no navegador
        _hittableMeshes.length = 0;
        const bots = this.botsProvider ? this.botsProvider() : [];
        for (let bIdx = 0; bIdx < bots.length; bIdx++) {
          const b = bots[bIdx];
          if (!b || !b.alive) continue;
          const hits = b.hittables ? b.hittables() : [];
          for (let hIdx = 0; hIdx < hits.length; hIdx++) {
            _hittableMeshes.push(hits[hIdx]);
          }
        }

        if (_hittableMeshes.length > 0) {
          // Modo WebGL / Three.js Mesh Intersection
          this.raycaster.set(p.prevPos, _stepDir);
          this.raycaster.far = stepDist;
          const intersects = this.raycaster.intersectObjects(_hittableMeshes, false);
          if (intersects.length > 0) {
            const h = intersects[0];
            entityHit = {
              distance: h.distance,
              bot: h.object.userData.bot,
              part: h.object.userData.part || 'body',
              point: h.point
            };
          }
        } else {
          // Modo Headless / Matemática Pura
          let closestDist = stepDist;
          for (let bIdx = 0; bIdx < bots.length; bIdx++) {
            const mHit = this._raycastMathBot(p.prevPos, _stepDir, closestDist, bots[bIdx]);
            if (mHit && mHit.distance < closestDist) {
              closestDist = mHit.distance;
              entityHit = mHit;
            }
          }
        }
      } else if (p.owner === 'bot' && this.player && this.player.alive) {
        // Tiro de Bot contra Player
        const pY = this.player.pos.y;
        const pDist = this.player.pos.distanceTo(p.prevPos);
        if (pDist <= stepDist + 1.0) {
          const mHit = this._raycastMathBot(p.prevPos, _stepDir, stepDist, this.player);
          if (mHit) {
            entityHit = {
              distance: mHit.distance,
              player: this.player,
              part: mHit.part,
              point: mHit.point
            };
          }
        }
      }

      // Raycast contra o mundo físico estático (CollisionWorld)
      const hitWorld = this.world?.raycast(p.prevPos, _stepDir, stepDist);

      const entityDist = entityHit ? entityHit.distance : Infinity;
      const worldDist = hitWorld ? hitWorld.distance : Infinity;

      // 4. Resolução de impacto mais próximo
      if (entityDist <= worldDist && entityHit && entityDist <= stepDist) {
        // ── ACERTOU ENTIDADE (BOT OU PLAYER) ──────────────────────
        const totalDistance = p.distanceTraveled + entityDist;
        const acousticDelay = totalDistance / SPEED_OF_SOUND;

        p.pos.copy(entityHit.point);
        p.active = false;

        if (p.owner === 'player' && entityHit.bot) {
          const bot = entityHit.bot;
          let part = entityHit.part;

          // Se queda de projétil por distância for expressiva (>0.25m), ajusta headshot para body
          const terminalImpact = BallisticsCalculator.calculateTerminalImpact(p.weaponDef, totalDistance, part);
          if (terminalImpact.dropY > 0.25 && part === 'head') {
            part = 'body';
          }

          const dmg = terminalImpact.finalDamage;
          const killed = bot.takeDamage(dmg, part);

          let px = undefined, py = undefined;
          if (this.camera && typeof window !== 'undefined') {
            _screenPos.copy(entityHit.point).project(this.camera);
            px = (_screenPos.x * 0.5 + 0.5) * window.innerWidth;
            py = -(_screenPos.y * 0.5 - 0.5) * window.innerHeight;
          }

          _botHitPoint.copy(entityHit.point);
          emit('shot:bot', {
            point: _botHitPoint,
            headshot: part === 'head',
            killed,
            distance: totalDistance,
            soundDelay: acousticDelay,
            screenX: px,
            screenY: py,
            isShotgun: p.isPellet
          });
        } else if (p.owner === 'bot' && entityHit.player) {
          const dmg = BallisticsCalculator.calculateTerminalImpact(p.weaponDef, totalDistance, entityHit.part).finalDamage;
          this.player.takeDamage(dmg, p.ownerEntity);
          emit('player:damaged', {
            damage: dmg,
            distance: totalDistance,
            soundDelay: acousticDelay
          });
        }

        emit('shot:tracer', {
          from: p.prevPos,
          to: p.pos,
          color: p.color
        });
        continue;
      }

      if (worldDist < entityDist && hitWorld && worldDist <= stepDist) {
        // ── ACERTOU O MUNDO FÍSICO (PAREDE / CHÃO) ───────────────────
        const totalDistance = p.distanceTraveled + worldDist;
        const acousticDelay = totalDistance / SPEED_OF_SOUND;

        _worldHitPoint.copy(hitWorld.point);
        p.pos.copy(_worldHitPoint);
        p.active = false;

        emit('shot:world', {
          point: _worldHitPoint,
          box: hitWorld.box,
          distance: totalDistance,
          soundDelay: acousticDelay
        });

        emit('shot:tracer', {
          from: p.prevPos,
          to: p.pos,
          color: p.color
        });
        continue;
      }

      // ── SEM IMPACTO NESTE FRAME: CONTINUA EM VOO ────────────────
      p.pos.copy(p.prevPos).add(_stepVec);
      p.distanceTraveled += stepDist;
      p.life += dt;

      // Traçante contínuo em voo (para renderizar a parábola em tempo real)
      emit('shot:tracer', {
        from: p.prevPos,
        to: p.pos,
        color: p.color
      });

      if (p.life >= p.maxLife || p.distanceTraveled >= p.maxDistance || p.pos.y < -40) {
        p.active = false;
      }
    }
  }

  /**
   * Retorna os projéteis ativos para uso por sistemas visuais.
   */
  getActiveProjectiles() {
    const list = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) list.push(this.pool[i]);
    }
    return list;
  }
}
