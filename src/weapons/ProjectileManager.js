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
    this.spawnOrigin = new THREE.Vector3(); // Ponto exato de nascimento (Muzzle Pin)
    this.penetrationsRemaining = 0;
    this.penetrationPower = 0.35;
    this.ricochetChance = 0.25;
    this.damageMultiplier = 1.0;
    this.hasSuppressedPlayer = false;
    this.suppressedBots = new Set();
  }

  reset() {
    this.active = false;
    this.distanceTraveled = 0;
    this.life = 0;
    this.weaponDef = null;
    this.ownerEntity = null;
    this.penetrationsRemaining = 0;
    this.penetrationPower = 0.35;
    this.ricochetChance = 0.25;
    this.damageMultiplier = 1.0;
    this.hasSuppressedPlayer = false;
    if (this.suppressedBots) this.suppressedBots.clear();
  }
}

// Vetores auxiliares reutilizáveis para zerar alocação de memória no loop a 120Hz
const _stepVec = new THREE.Vector3();
const _stepDir = new THREE.Vector3();
const _tempDir = new THREE.Vector3();
const _reflVec = new THREE.Vector3();
const _hittableMeshes = [];
const _screenPos = new THREE.Vector3();
const _botHitPoint = new THREE.Vector3();
const _worldHitPoint = new THREE.Vector3();
const _exitHitPoint = new THREE.Vector3();
const _segAB = new THREE.Vector3();
const _segAP = new THREE.Vector3();
const _segClosest = new THREE.Vector3();
const _targetHead = new THREE.Vector3();

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
    originTracker,
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
    p.spawnOrigin.copy(origin); // Ancora para o tracer "Muzzle Pin"
    p.vel.copy(direction).normalize().multiplyScalar(speed);
    p.gravity = drop;
    p.drag = drag;
    p.speed = speed;
    p.color = weaponDef?.tracerColor || '#ffd27f';
    p.weaponDef = weaponDef;
    p.tracerProfile = weaponDef?.tracerProfile;
    p.owner = owner;
    p.ownerEntity = ownerEntity;
    p.distanceTraveled = 0;
    p.maxDistance = terminal.maxRange ?? 500;
    p.life = 0;
    p.maxLife = 3.5;
    p.isPellet = !!isPellet;
    p.penetrationsRemaining = terminal.maxPenetrations ?? weaponDef?.maxPenetrations ?? 1;
    p.penetrationPower = terminal.penetrationPower ?? weaponDef?.penetrationPower ?? 0.35;
    p.ricochetChance = terminal.ricochetChance ?? weaponDef?.ricochetChance ?? 0.25;
    p.damageMultiplier = 1.0;
    p.active = true;

    emit('projectile:spawned', {
      projectile: p,
      from: p.prevPos,
      to: p.pos,
      color: p.color
    });

    // Se projétil usar tracer físico parabólico, desacoplamos do flash tracer retilíneo
    const isPhysicalTracer = p.speed < 200 || weaponDef?.tracerProfile?.style === 'parabola' || weaponDef?.tracerProfile?.physical;
    if (!isPhysicalTracer) {
      const normDir = _tempDir.copy(direction).normalize();
      const estHit = this._estimateImpact(origin, normDir, p.maxDistance, owner);

      emit('tracer:fire', {
        origin: origin.clone(),
        originTracker: originTracker,
        end: estHit.point,
        speed: p.speed,
        color: p.color,
        isPellet: p.isPellet,
        profile: weaponDef?.tracerProfile
      });
    }

    return p;
  }

  /**
   * Raycast síncrono rápido no momento do disparo para estimar impacto visual imediato.
   * Totalmente desacoplado do avanço contínuo do projétil (evita atraso de vôo no tracer).
   */
  _estimateImpact(origin, dir, maxDist, owner = 'player') {
    let closestDist = maxDist;
    let hitPoint = null;

    // 1. Raycast no mundo estático (CollisionWorld)
    if (this.world) {
      const hitWorld = this.world.raycast(origin, dir, maxDist);
      if (hitWorld && hitWorld.distance < closestDist) {
        closestDist = hitWorld.distance;
        hitPoint = hitWorld.point;
      }
    }

    // 2. Raycast em entidades dinâmicas (Bots / Player)
    if (owner === 'player') {
      const bots = this.botsProvider ? this.botsProvider() : [];
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        if (!b || !b.alive) continue;
        const mHit = this._raycastMathBot(origin, dir, closestDist, b);
        if (mHit && mHit.distance < closestDist) {
          closestDist = mHit.distance;
          hitPoint = mHit.point;
        }
      }
    } else if (owner === 'bot' && this.player && this.player.alive) {
      // Bots ignoram fogo amigo visual no raycast de tracer para performance
      const mHit = this._raycastMathBot(origin, dir, closestDist, this.player);
      if (mHit && mHit.distance < closestDist) {
        closestDist = mHit.distance;
        hitPoint = mHit.point;
      }
    }

    if (!hitPoint) {
      return {
        distance: closestDist,
        point: new THREE.Vector3(
          origin.x + dir.x * closestDist,
          origin.y + dir.y * closestDist,
          origin.z + dir.z * closestDist
        )
      };
    }

    return {
      distance: closestDist,
      point: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z)
    };
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
        const pDist = this.player.pos.distanceTo(p.prevPos);
        if (pDist <= stepDist + 3.0) {
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

        // Avalia supressão nos arredores da trajetória percorrida até a colisão
        this._checkSuppression(p, p.prevPos, entityHit.point, entityHit);

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

          const dmg = Math.max(1, Math.round(terminalImpact.finalDamage * (p.damageMultiplier || 1.0)));
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
          const dmg = Math.max(1, Math.round(BallisticsCalculator.calculateTerminalImpact(p.weaponDef, totalDistance, entityHit.part).finalDamage * (p.damageMultiplier || 1.0)));
          this.player.takeDamage(dmg, p.ownerEntity);
          emit('player:damaged', {
            damage: dmg,
            distance: totalDistance,
            soundDelay: acousticDelay
          });
        }

        continue;
      }

      if (worldDist < entityDist && hitWorld && worldDist <= stepDist) {
        // ── ACERTOU O MUNDO FÍSICO (PAREDE / CHÃO) ───────────────────
        const totalDistance = p.distanceTraveled + worldDist;
        const acousticDelay = totalDistance / SPEED_OF_SOUND;
        const hitMat = (hitWorld.box?.meta?.material || 'wall').toLowerCase();
        const norm = hitWorld.normal || { x: 0, y: 1, z: 0 };
        const dot = -(_stepDir.x * norm.x + _stepDir.y * norm.y + _stepDir.z * norm.z); // cos do ângulo de incidência

        _worldHitPoint.copy(hitWorld.point);

        // Avalia supressão nos arredores da trajetória percorrida até a parede
        this._checkSuppression(p, p.prevPos, _worldHitPoint);

        // 1. VERIFICAÇÃO DE RICOCHETE ANGULAR FÍSICO
        // Superfícies duras com ângulo rasante (< 25°, cos > -0.42 ou dot < 0.42 em relação à normal)
        const isHardSurface = hitMat.includes('metal') || hitMat.includes('concrete') || hitMat.includes('stone') || hitMat.includes('sandstone') || hitMat.includes('brick');
        const isShallowAngle = dot >= 0 && dot < 0.42; // incidência rasante em relação à superfície

        if (isHardSurface && isShallowAngle && (p.penetrationsRemaining > 0 || Math.random() < p.ricochetChance)) {
          // Reflexão do vetor de velocidade: v' = v - 2(v · n)n + dispersão
          const vDotN = p.vel.x * norm.x + p.vel.y * norm.y + p.vel.z * norm.z;
          _reflVec.set(
            p.vel.x - 2 * vDotN * norm.x,
            p.vel.y - 2 * vDotN * norm.y,
            p.vel.z - 2 * vDotN * norm.z
          );

          // Leve dispersão angular (jitter) no ricochete
          _reflVec.x += (Math.random() - 0.5) * 0.15 * _reflVec.length();
          _reflVec.y += (Math.random() - 0.5) * 0.15 * _reflVec.length();
          _reflVec.z += (Math.random() - 0.5) * 0.15 * _reflVec.length();

          // Perda de energia cinética (35% a 50%)
          _reflVec.multiplyScalar(0.60);
          p.vel.copy(_reflVec);
          p.speed = p.vel.length();

          // Reposiciona o projétil ligeiramente fora da parede na direção da normal
          p.pos.copy(_worldHitPoint).addScaledVector(norm, 0.05);
          p.prevPos.copy(p.pos);
          p.distanceTraveled = totalDistance;
          p.damageMultiplier *= 0.55; // Ricochete causa menos dano letal
          p.penetrationsRemaining = Math.max(0, p.penetrationsRemaining - 1);

          emit('shot:ricochet', {
            point: _worldHitPoint.clone(),
            normal: norm,
            material: hitMat,
            distance: totalDistance,
            soundDelay: acousticDelay
          });

          // Projétil continua vivo voando após o ricochete!
          continue;
        }

        // 2. VERIFICAÇÃO DE PENETRAÇÃO DE PAREDE (WALLBANG)
        // Coeficientes de densidade/resistência do material por metro de espessura
        let resistance = 1.0;
        if (hitMat.includes('wood')) {
          resistance = 0.35;
        } else if (hitMat.includes('sandbag') || hitMat.includes('dirt') || hitMat.includes('plaster')) {
          resistance = 0.50;
        } else if (hitMat.includes('concrete') || hitMat.includes('stone') || hitMat.includes('sandstone') || hitMat.includes('brick')) {
          resistance = 1.10;
        } else if (hitMat.includes('metal') || hitMat.includes('iron') || hitMat.includes('steel')) {
          resistance = 2.40;
        }

        const wallThickness = hitWorld.thickness || 0.2;
        const requiredPenPower = wallThickness * resistance;

        if (p.penetrationsRemaining > 0 && p.penetrationPower >= requiredPenPower) {
          // PENETRAÇÃO BEM-SUCEDIDA!
          p.penetrationsRemaining--;
          p.penetrationPower -= requiredPenPower;

          // Ponto de saída do projétil do outro lado da parede
          _exitHitPoint.copy(_worldHitPoint).addScaledVector(_stepDir, wallThickness + 0.06);
          p.pos.copy(_exitHitPoint);
          p.prevPos.copy(_exitHitPoint);

          // Perda de velocidade (25% a 40%) e redução do dano restante
          const speedRetained = Math.max(0.4, 1.0 - (requiredPenPower * 0.45));
          p.vel.multiplyScalar(speedRetained);
          p.speed = p.vel.length();
          p.damageMultiplier *= Math.max(0.25, 1.0 - (requiredPenPower * 0.65));
          p.distanceTraveled = totalDistance + wallThickness;

          emit('shot:penetration', {
            entryPoint: _worldHitPoint.clone(),
            exitPoint: _exitHitPoint.clone(),
            material: hitMat,
            thickness: wallThickness,
            distance: totalDistance,
            soundDelay: acousticDelay
          });

          // Projétil continua sua trajetória mortal além da parede
          continue;
        }

        // 3. IMPACTO TERMINAL ABSORVIDO (Sem penetração e sem ricochete)
        p.pos.copy(_worldHitPoint);
        p.active = false;

        emit('shot:world', {
          point: _worldHitPoint,
          box: hitWorld.box,
          material: hitMat,
          normal: norm,
          distance: totalDistance,
          soundDelay: acousticDelay
        });

        continue;
      }

      // ── SEM IMPACTO NESTE FRAME: CONTINUA EM VOO ────────────────
      p.pos.copy(p.prevPos).add(_stepVec);
      p.distanceTraveled += stepDist;
      p.life += dt;

      // Supressão tática para projéteis em vôo livre
      this._checkSuppression(p, p.prevPos, p.pos);

      if (p.life >= p.maxLife || p.distanceTraveled >= p.maxDistance || p.pos.y < -40) {
        p.active = false;
      }
    }
  }

  /**
   * Avalia a proximidade tática (Near-Miss) de um segmento de projétil contra o jogador e bots.
   * Dispara flinch, tremor de câmera, estalo supersônico e vinheta de visão de túnel.
   */
  _checkSuppression(p, startPos, endPos, entityHit = null) {
    const suppressionRadius = 2.40;

    // 1. Supressão contra o Jogador (tiros disparados por bots ou ricochetes)
    if (this.player && this.player.alive && p.owner !== 'player' && !p.hasSuppressedPlayer) {
      if (!entityHit || !entityHit.player) {
        _targetHead.set(this.player.pos.x, this.player.pos.y + 1.55, this.player.pos.z);
        _segAB.subVectors(endPos, startPos);
        _segAP.subVectors(_targetHead, startPos);
        const abLenSq = _segAB.lengthSq();
        if (abLenSq > 1e-6) {
          const tClamped = Math.max(0, Math.min(1, _segAP.dot(_segAB) / abLenSq));
          _segClosest.copy(startPos).addScaledVector(_segAB, tClamped);
          const distToHead = _segClosest.distanceTo(_targetHead);
          if (distToHead <= suppressionRadius) {
            p.hasSuppressedPlayer = true;
            const intensity = Math.max(0.35, 1.0 - (distToHead / suppressionRadius));
            if (this.player.rig) {
              const flinchAmount = 0.035 * intensity;
              this.player.rig.addFlinch((Math.random() - 0.5) * flinchAmount, (Math.random() - 0.5) * flinchAmount);
              this.player.rig.addShake(0.35 * intensity);
            }
            emit('player:suppression', {
              pos: _segClosest.clone(),
              intensity,
              distance: distToHead
            });
          }
        }
      }
    }

    // 2. Supressão contra Bots (tiros disparados pelo jogador passando raspando)
    if (p.owner === 'player' && this.botsProvider) {
      const bots = this.botsProvider();
      for (let bIdx = 0; bIdx < bots.length; bIdx++) {
        const b = bots[bIdx];
        if (!b || !b.alive) continue;
        if (entityHit && entityHit.bot === b) continue;
        if (p.suppressedBots && p.suppressedBots.has(b.id)) continue;

        _targetHead.set(b.pos.x, b.pos.y + 1.55, b.pos.z);
        _segAB.subVectors(endPos, startPos);
        _segAP.subVectors(_targetHead, startPos);
        const abLenSq = _segAB.lengthSq();
        if (abLenSq > 1e-6) {
          const tClamped = Math.max(0, Math.min(1, _segAP.dot(_segAB) / abLenSq));
          _segClosest.copy(startPos).addScaledVector(_segAB, tClamped);
          const distToBotHead = _segClosest.distanceTo(_targetHead);
          if (distToBotHead <= suppressionRadius) {
            if (!p.suppressedBots) p.suppressedBots = new Set();
            p.suppressedBots.add(b.id);
            const intensity = Math.max(0.25, 1.0 - (distToBotHead / suppressionRadius));
            if (b.ai && b.ai.applySuppression) {
              b.ai.applySuppression(intensity);
            }
            emit('bot:suppressed', {
              bot: b,
              intensity,
              distance: distToBotHead
            });
          }
        }
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

