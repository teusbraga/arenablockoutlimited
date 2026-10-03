import * as THREE from 'three';
import { on } from '../core/EventBus.js';
import { SMOKE_TEX } from '../weapons/models/RiflePrototype.js';

const MAX_TRACERS = 30;
const MAX_SPARKS = 80;
const MAX_SMOKE = 40;
const MAX_CASINGS = 24;

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // Constantes
    this.TRACER_LIFE = 0.09;
    
    // Geometrias reutilizáveis
    this.sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);
    // Cartucho 3D cilíndrico de latão (escala 1:1 estojo de munição)
    this.casingGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.026, 8);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xdfb850,
      metalness: 0.90,
      roughness: 0.28
    });

    // Pools
    this.tracers = [];
    this.tracerIdx = 0;

    this.sparks = [];
    this.sparkIdx = 0;

    this.smokes = [];
    this.smokeIdx = 0;

    this.casings = [];
    this.casingIdx = 0;

    this._initPools();
    this._bind();
  }

  _initPools() {
    // 1. Tracers
    for (let i = 0; i < MAX_TRACERS; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
      geo.computeBoundingSphere();
      const mat = new THREE.LineBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.scene.add(line);
      this.tracers.push({ line, life: 0, active: false });
    }

    // 2. Sparks (Faíscas / Sangue / Impacto)
    for (let i = 0; i < MAX_SPARKS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.35, active: false });
    }

    // 3. Smokes (Fumaça do tiro)
    for (let i = 0; i < MAX_SMOKE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb8bcc2, transparent: true, opacity: 0.6, depthWrite: false });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokes.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.7, startScale: 1, growth: 1, active: false });
    }

    // 4. Faíscas da boca do cano (THREE.Points do protótipo)
    this.SPARK_MAX = 90;
    this.sparkPos = new Float32Array(this.SPARK_MAX * 3);
    this.sparkVel = new Float32Array(this.SPARK_MAX * 3);
    this.sparkLife = new Float32Array(this.SPARK_MAX);
    for (let i = 0; i < this.SPARK_MAX; i++) this.sparkPos[i * 3 + 1] = -999;

    this.sparkPointsGeo = new THREE.BufferGeometry();
    this.sparkPointsGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkPointsMat = new THREE.PointsMaterial({
      color: 0xffc061,
      size: 0.017,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    this.sparkPoints = new THREE.Points(this.sparkPointsGeo, this.sparkPointsMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    // 5. Fumaça de tiro com textura procedural radial do protótipo
    this.protoSmokePool = [];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: SMOKE_TEX,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0x9aa2ad
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      this.protoSmokePool.push({ mesh: m, life: 0, max: 1, vel: new THREE.Vector3(), spin: 0 });
    }

    // 6. Cartuchos vazios ejetados (Brass Casings com física e rotação)
    for (let i = 0; i < MAX_CASINGS; i++) {
      const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.casings.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2,
        active: false
      });
    }
  }

  _bind() {
    on('shot:tracer', e => this._spawnTracer(e.from, e.to, e.color));
    on('shot:world', e => this._spawnImpact(e.point, 0xd9c79b, 5));
    on('shot:bot', e => this._spawnImpact(e.point, e.headshot ? 0xffd166 : 0xc4504a, 6));
    on('bot:died', e => {
      const p = e.bot.pos.clone(); p.y += 1.0;
      this._spawnImpact(p, 0xc4504a, 14);
    });
    on('weapon:fired', e => {
      // Ejeção do cartucho vazio em todas as armas
      if (e.ejectWorld && e.right && e.up) {
        this._spawnCasing(e.ejectWorld, e.right, e.up, e.forward);
      }

      if (!e.muzzleWorld) return;
      if (e.weapon?.id === 'rifle_proto') {
        this._spawnProtoSparks(e.muzzleWorld, e.forward, 9);
        this._spawnProtoSmoke(e.muzzleWorld, e.forward, 2);
        return;
      }
      const opacity = e.weapon?.smokeConeOpacity ?? 0.06;
      this._spawnMuzzleSmoke(e.muzzleWorld, e.forward, opacity);
    });
    on('weapon:smoke:residual', e => {
      if (!e.muzzleWorld || !e.count) return;
      this._spawnBarrelHeatSmoke(e.muzzleWorld, e.count, e.color);
    });
  }

  _spawnProtoSparks(pos, dir, count = 9) {
    for (let n = 0; n < count; n++) {
      let idx = -1;
      for (let j = 0; j < this.SPARK_MAX; j++) {
        if (this.sparkLife[j] <= 0) { idx = j; break; }
      }
      if (idx < 0) return;

      this.sparkLife[idx] = 0.14 + Math.random() * 0.24;
      this.sparkPos[idx * 3 + 0] = pos.x;
      this.sparkPos[idx * 3 + 1] = pos.y;
      this.sparkPos[idx * 3 + 2] = pos.z;

      const spread = 0.95;
      const sp = 2.0 + Math.random() * 3.0;
      this.sparkVel[idx * 3 + 0] = (dir.x + (Math.random() - 0.5) * spread) * sp;
      this.sparkVel[idx * 3 + 1] = (dir.y + (Math.random() - 0.5) * spread) * sp + 0.5;
      this.sparkVel[idx * 3 + 2] = (dir.z + (Math.random() - 0.5) * spread) * sp;
    }
    this.sparkPointsGeo.attributes.position.needsUpdate = true;
  }

  _spawnProtoSmoke(pos, dir, count = 2) {
    for (let n = 0; n < count; n++) {
      const s = this.protoSmokePool.find(x => x.life <= 0);
      if (!s) return;
      s.max = 0.75 + Math.random() * 0.6;
      s.life = s.max;
      s.mesh.visible = true;
      s.mesh.position.copy(pos);
      s.mesh.position.x += (Math.random() - 0.5) * 0.04;
      s.mesh.position.y += (Math.random() - 0.5) * 0.04;
      s.mesh.position.z += (Math.random() - 0.5) * 0.04;
      s.mesh.rotation.z = Math.random() * Math.PI;
      s.spin = (Math.random() - 0.5) * 1.4;
      s.vel.set(
        dir.x * (0.25 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.20,
        0.16 + Math.random() * 0.22,
        dir.z * (0.25 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.20
      );
      s.mesh.scale.setScalar(0.55 + Math.random() * 0.4);
    }
  }

  _spawnCasing(pos, right, up, forward) {
    if (!pos || !right) return;
    const c = this.casings[this.casingIdx];
    this.casingIdx = (this.casingIdx + 1) % MAX_CASINGS;

    c.mesh.position.copy(pos);
    c.mesh.visible = true;
    c.active = true;
    c.life = c.maxLife;

    // Orientação inicial aleatória
    c.mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Vetor de velocidade física:
    // Ejetado com força para a direita (+right), ligeiramente para cima (+up) e para trás (-forward)
    const rightForce = 1.6 + Math.random() * 0.9;
    const upForce    = 1.1 + Math.random() * 0.7;
    const backForce  = -0.4 - Math.random() * 0.5;

    c.vel.set(0, 0, 0)
      .addScaledVector(right, rightForce)
      .addScaledVector(up, upForce)
      .addScaledVector(forward, backForce);

    // Velocidade angular de rotação rápida no ar (tumble)
    c.rotVel.set(
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 28
    );
  }

  _spawnTracer(from, to, color = null) {
    if (!from || !to) return;
    if (!Number.isFinite(from.x) || !Number.isFinite(from.y) || !Number.isFinite(from.z) ||
        !Number.isFinite(to.x) || !Number.isFinite(to.y) || !Number.isFinite(to.z)) {
      return;
    }

    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % MAX_TRACERS;

    const positions = t.line.geometry.attributes.position.array;
    positions[0] = from.x; positions[1] = from.y; positions[2] = from.z;
    positions[3] = to.x;   positions[4] = to.y;   positions[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.geometry.computeBoundingSphere();

    if (color) {
      t.line.material.color.set(color);
    } else {
      t.line.material.color.setHex(0xffd27f);
    }

    t.line.material.opacity = 0.9;
    t.line.visible = true;
    t.life = this.TRACER_LIFE;
    t.active = true;
  }

  _spawnImpact(pos, color, count) {
    for (let i = 0; i < count; i++) {
      const p = this.sparks[this.sparkIdx];
      this.sparkIdx = (this.sparkIdx + 1) % MAX_SPARKS;

      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.visible = true;
      p.vel.set((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      p.life = p.maxLife;
      p.active = true;
    }
  }

  // 1. Cone de fumaça frontal durante o disparo (quase totalmente translúcida)
  _spawnMuzzleSmoke(muzzlePos, forward, maxOpacity = 0.06) {
    for (let i = 0; i < 3; i++) {
      const p = this.smokes[this.smokeIdx];
      this.smokeIdx = (this.smokeIdx + 1) % MAX_SMOKE;

      p.mesh.position.copy(muzzlePos);
      p.startScale = 0.6 + Math.random() * 0.5;
      p.mesh.scale.setScalar(p.startScale);
      p.maxOpacity = maxOpacity;
      p.mesh.material.opacity = maxOpacity;
      p.mesh.visible = true;
      
      // Projeção em cone para frente com leve abertura
      const spread = 0.35;
      p.vel.copy(forward).multiplyScalar(2.2 + Math.random() * 1.5).add(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread + 0.1,
        (Math.random() - 0.5) * spread
      ));
      
      p.growth = 2.2 + Math.random() * 1.0;
      p.maxLife = 0.28 + Math.random() * 0.12; // evaporação rápida no ar
      p.life = p.maxLife;
      p.active = true;
    }
  }

  // 2. Fumaça de calor residual do cano quente ao término de spray (flutua suavemente para cima)
  _spawnBarrelHeatSmoke(muzzlePos, count = 3, color = null) {
    const total = Math.min(count, 6);
    for (let i = 0; i < total; i++) {
      const p = this.smokes[this.smokeIdx];
      this.smokeIdx = (this.smokeIdx + 1) % MAX_SMOKE;

      // Leve atraso e deslocamento natural ao redor da boca do cano
      const jitter = 0.015;
      p.mesh.position.set(
        muzzlePos.x + (Math.random() - 0.5) * jitter,
        muzzlePos.y + (Math.random() - 0.5) * jitter,
        muzzlePos.z + (Math.random() - 0.5) * jitter
      );

      if (color) p.mesh.material.color.set(color);

      p.startScale = 0.4 + Math.random() * 0.3;
      p.mesh.scale.setScalar(p.startScale);
      p.maxOpacity = 0.18 + Math.random() * 0.10; // translúcida, perceptível e graciosa
      p.mesh.material.opacity = p.maxOpacity;
      p.mesh.visible = true;

      // Flutuação ascendente (corrente térmica de ar quente)
      p.vel.set(
        (Math.random() - 0.5) * 0.15,
        0.35 + Math.random() * 0.30, // sobe em Y
        (Math.random() - 0.5) * 0.15
      );

      p.growth = 3.0 + Math.random() * 1.5;
      p.maxLife = 0.70 + Math.random() * 0.40; // persiste suavemente
      p.life = p.maxLife;
      p.active = true;
    }
  }

  update(dt, camera) {
    // 1. Tracers
    for (let i = 0; i < MAX_TRACERS; i++) {
      const t = this.tracers[i];
      if (!t.active) continue;
      
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.line.visible = false;
      } else {
        t.line.material.opacity = Math.max(0, t.life / this.TRACER_LIFE);
      }
    }

    // 2. Sparks
    for (let i = 0; i < MAX_SPARKS; i++) {
      const p = this.sparks[i];
      if (!p.active) continue;
      
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.vel.y *= -0.3;
        p.vel.x *= 0.7; p.vel.z *= 0.7;
      }
      p.mesh.material.opacity = p.life / p.maxLife;
    }

    // 3. Smokes
    for (let i = 0; i < MAX_SMOKE; i++) {
      const p = this.smokes[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const t = p.life / p.maxLife; // 1 -> 0
      p.vel.y += 0.9 * dt; // empuxo
      p.vel.x *= (1 - 2.2 * dt); // drag
      p.vel.z *= (1 - 2.2 * dt);
      
      p.mesh.position.addScaledVector(p.vel, dt);
      const grow = 1 + (1 - t) * p.growth;
      p.mesh.scale.setScalar(p.startScale * grow);
      p.mesh.material.opacity = t * t * (p.maxOpacity || 0.6);
    }

    // 4. Faíscas do Protótipo (simulação física com gravidade e arrasto)
    if (this.sparkPointsGeo) {
      let anyProtoSpark = false;
      for (let i = 0; i < this.SPARK_MAX; i++) {
        if (this.sparkLife[i] <= 0) continue;
        anyProtoSpark = true;
        this.sparkLife[i] -= dt;
        if (this.sparkLife[i] <= 0) {
          this.sparkPos[i * 3 + 1] = -999;
          continue;
        }
        this.sparkVel[i * 3 + 1] -= 7.0 * dt;
        this.sparkPos[i * 3 + 0] += this.sparkVel[i * 3 + 0] * dt;
        this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
        this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      }
      if (anyProtoSpark) this.sparkPointsGeo.attributes.position.needsUpdate = true;
    }

    // 5. Fumaça do Protótipo (billboard face-camera, giro e flutuação térmica)
    if (this.protoSmokePool) {
      for (const s of this.protoSmokePool) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.visible = false;
          s.mesh.material.opacity = 0;
          continue;
        }
        const k = s.life / s.max;
        s.mesh.material.opacity = 0.42 * k;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.vel.multiplyScalar(1 - 1.6 * dt);
        s.vel.y += 0.16 * dt;
        s.mesh.scale.setScalar(0.55 + (1 - k) * 2.1);
        s.mesh.rotation.z += s.spin * dt;
        if (camera) s.mesh.quaternion.copy(camera.quaternion);
      }
    }

    // 6. Cartuchos vazios ejetados (gravidade, quique no chão e rotação tumbling)
    for (let i = 0; i < MAX_CASINGS; i++) {
      const c = this.casings[i];
      if (!c.active) continue;

      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }

      // Gravidade acelerada
      c.vel.y -= 13.0 * dt;
      // Arrasto do ar leve
      c.vel.x *= Math.max(0, 1 - 0.5 * dt);
      c.vel.z *= Math.max(0, 1 - 0.5 * dt);

      // Movimento linear
      c.mesh.position.addScaledVector(c.vel, dt);

      // Rotação dinâmica no ar
      c.mesh.rotation.x += c.rotVel.x * dt;
      c.mesh.rotation.y += c.rotVel.y * dt;
      c.mesh.rotation.z += c.rotVel.z * dt;

      // Colisão / quique suave no solo (y = 0.01)
      if (c.mesh.position.y < 0.012) {
        c.mesh.position.y = 0.012;
        // Amortecimento elástico de quique de latão
        c.vel.y = Math.abs(c.vel.y) * 0.35;
        c.vel.x *= 0.65;
        c.vel.z *= 0.65;
        c.rotVel.multiplyScalar(0.45);
      }
    }
  }
}