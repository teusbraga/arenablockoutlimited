import * as THREE from 'three';
import { on } from '../core/EventBus.js';

const MAX_TRACERS = 30;
const MAX_SPARKS = 80;
const MAX_SMOKE = 40;

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // Constantes
    this.TRACER_LIFE = 0.09;
    
    // Geometrias reutilizáveis
    this.sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);

    // Pools
    this.tracers = [];
    this.tracerIdx = 0;

    this.sparks = [];
    this.sparkIdx = 0;

    this.smokes = [];
    this.smokeIdx = 0;

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
      if (!e.muzzleWorld) return;
      const opacity = e.weapon?.smokeConeOpacity ?? 0.06;
      this._spawnMuzzleSmoke(e.muzzleWorld, e.forward, opacity);
    });
    on('weapon:smoke:residual', e => {
      if (!e.muzzleWorld || !e.count) return;
      this._spawnBarrelHeatSmoke(e.muzzleWorld, e.count, e.color);
    });
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

  update(dt) {
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
  }
}