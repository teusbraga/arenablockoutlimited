import * as THREE from 'three';
import { on } from '../core/EventBus.js';
import { SMOKE_TEX } from '../weapons/models/RiflePrototype.js';

const MAX_TRACERS = 120;
const MAX_SPARKS = 80;
const MAX_SMOKE = 40;
const MAX_CASINGS = 24;
const MAX_BLOOD_VOXELS = 180;
const MAX_GHOST_SMOKE = 60;

const _dummy = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _bloodPalette = [
  0xd90429, // Carmine red
  0xef233c, // Vivid arcade crimson
  0xa4161a, // Dark arterial red
  0x800f2f, // Deep blood ruby
  0xba181b, // Punchy red
  0xff4d6d  // Bright arcade splash
];
const _ghostPalette = [
  0xffffff, // Pure white
  0xf5f7fa, // Soft white cloud
  0xe4e7eb, // Light puff
  0xd0d5dd, // Ghost grey
  0x9aa4b2  // Cartoon shadow grey
];

export class Effects {
  constructor(scene, world = null) {
    this.scene = scene;
    this.world = world;

    // Constantes
    this.TRACER_LIFE = 0.15;
    
    // Geometrias reutilizáveis
    this.sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);
    // Cartucho 3D cilíndrico de latão (escala 1:1 estojo de munição)
    this.casingGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.026, 8);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xdfb850,
      metalness: 0.90,
      roughness: 0.28
    });
    // Cartucho de escopeta Calibre 12 Vermelho com base em latão
    this.shotgunCasingGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.038, 10);
    this.shotgunCasingMat = new THREE.MeshStandardMaterial({
      color: 0xd61818, // Vermelho vívido de cartucho calibre 12
      metalness: 0.20,
      roughness: 0.45
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

    // 7. Pixels de Sangue Arcade para Soldados Blocky (InstancedMesh: 1 único draw call na GPU)
    this.bloodGeo = new THREE.BoxGeometry(1, 1, 1);
    this.bloodMat = new THREE.MeshLambertMaterial({});
    this.bloodMesh = new THREE.InstancedMesh(this.bloodGeo, this.bloodMat, MAX_BLOOD_VOXELS);
    this.bloodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bloodMesh.frustumCulled = false;
    this.scene.add(this.bloodMesh);

    this.bloodVoxels = [];
    this.bloodIdx = 0;
    for (let i = 0; i < MAX_BLOOD_VOXELS; i++) {
      _dummy.position.set(0, -999, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      this.bloodMesh.setMatrixAt(i, _dummy.matrix);
      this.bloodMesh.setColorAt(i, _tempColor.setHex(0xd90429));
      this.bloodVoxels.push({
        active: false,
        x: 0, y: -999, z: 0,
        vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0,
        vrx: 0, vry: 0, vrz: 0,
        size: 0.1,
        life: 0,
        maxLife: 3.0,
        settled: false
      });
    }
    this.bloodMesh.instanceMatrix.needsUpdate = true;
    if (this.bloodMesh.instanceColor) this.bloodMesh.instanceColor.needsUpdate = true;

    // 8. Fumaça de Fantasma (Explosão poof cartoon cinza/branca)
    this.ghostSmokeGeo = new THREE.SphereGeometry(0.18, 7, 7);
    this.ghostSmokePool = [];
    this.ghostSmokeIdx = 0;
    for (let i = 0; i < MAX_GHOST_SMOKE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.ghostSmokeGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.ghostSmokePool.push({
        mesh,
        active: false,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        startScale: 0.5,
        growth: 3.0
      });
    }
  }

  setWorld(world) {
    this.world = world;
  }

  _bind() {
    this._unsubs = [
      on('shot:tracer', e => this._spawnTracer(e.from, e.to, e.color)),
      on('shot:world', e => this._spawnImpact(e.point, 0xd9c79b, 5)),
      on('shot:bot', e => this._spawnImpact(e.point, e.headshot ? 0xffd166 : 0xc4504a, 6)),
      on('bot:died', e => {
        if (!e?.bot) return;
        const pos = e.bot.pos;
        const isGhost = e.bot.skinType === 'ghost';
        const isHeadshot = !!e.headshot;

        if (isGhost) {
          this._spawnGhostDeathSmoke(pos, isHeadshot);
        } else {
          this._spawnSoldierBloodVoxels(pos, isHeadshot);
        }
      }),
      on('weapon:fired', e => {
        // Ejeção do cartucho vazio em todas as armas (Ignora m12 que tem ejeção manual)
        if (e.ejectWorld && e.right && e.up && e.weapon?.id !== 'm12') {
          const isShotgun = (e.weapon?.casingType === 'shotgun' || e.weapon?.id === 'm12');
          this._spawnCasing(e.ejectWorld, e.right, e.up, e.forward, isShotgun);
        }

        if (!e.muzzleWorld) return;
        if (e.weapon?.id === 'rifle_proto') {
          this._spawnProtoSparks(e.muzzleWorld, e.forward, 9);
          this._spawnProtoSmoke(e.muzzleWorld, e.forward, 2);
          return;
        }
        const opacity = e.weapon?.smokeConeOpacity ?? 0.06;
        this._spawnMuzzleSmoke(e.muzzleWorld, e.forward, opacity);
      }),
      on('weapon:manual_eject_fx', e => {
        if (e.ejectWorld && e.right && e.up) {
          this._spawnCasing(e.ejectWorld, e.right, e.up, e.forward, e.isShotgun);
        }
      }),
      on('weapon:smoke:residual', e => {
        if (!e.muzzleWorld || !e.count) return;
        this._spawnBarrelHeatSmoke(e.muzzleWorld, e.count, e.color);
      }),
    ];
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }

    // Libera geometrias base
    if (this.sparkGeo) this.sparkGeo.dispose();
    if (this.casingGeo) this.casingGeo.dispose();
    if (this.shotgunCasingGeo) this.shotgunCasingGeo.dispose();
    if (this.casingMat) this.casingMat.dispose();
    if (this.shotgunCasingMat) this.shotgunCasingMat.dispose();

    // Libera tracres
    for (const t of this.tracers) {
      if (t.line) {
        if (t.line.parent) t.line.parent.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
      }
    }
    this.tracers = [];

    // Libera sparks
    for (const s of this.sparks) {
      if (s.mesh) {
        if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
        s.mesh.material.dispose();
      }
    }
    this.sparks = [];

    // Libera smokes
    for (const sm of this.smokes) {
      if (sm.mesh) {
        if (sm.mesh.parent) sm.mesh.parent.remove(sm.mesh);
        sm.mesh.material.dispose();
      }
    }
    this.smokes = [];

    // Libera casings
    for (const c of this.casings) {
      if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
    }
    this.casings = [];

    // Libera proto sparks e smoke
    if (this.sparkPoints) {
      if (this.sparkPoints.parent) this.sparkPoints.parent.remove(this.sparkPoints);
      this.sparkPointsGeo.dispose();
      this.sparkPointsMat.dispose();
    }
    for (const ps of this.protoSmokePool) {
      if (ps.mesh) {
        if (ps.mesh.parent) ps.mesh.parent.remove(ps.mesh);
        ps.mesh.geometry.dispose();
        ps.mesh.material.dispose();
      }
    }
    this.protoSmokePool = [];

    // Libera blood voxels
    if (this.bloodMesh) {
      if (this.bloodMesh.parent) this.bloodMesh.parent.remove(this.bloodMesh);
      if (this.bloodGeo) this.bloodGeo.dispose();
      if (this.bloodMat) this.bloodMat.dispose();
    }
    this.bloodVoxels = [];

    // Libera ghost smoke
    for (const g of this.ghostSmokePool) {
      if (g.mesh) {
        if (g.mesh.parent) g.mesh.parent.remove(g.mesh);
        g.mesh.material.dispose();
      }
    }
    if (this.ghostSmokeGeo) this.ghostSmokeGeo.dispose();
    this.ghostSmokePool = [];
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

  _spawnCasing(pos, right, up, forward, isShotgun = false) {
    if (!pos || !right) return;
    const c = this.casings[this.casingIdx];
    this.casingIdx = (this.casingIdx + 1) % MAX_CASINGS;

    c.mesh.geometry = isShotgun ? this.shotgunCasingGeo : this.casingGeo;
    c.mesh.material = isShotgun ? this.shotgunCasingMat : this.casingMat;
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

  _getFloorY(x, y, z) {
    if (!this.world || !this.world.boxes) return 0.01;
    let floorY = 0.01;
    const boxes = this.world.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.solid) continue;
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) {
        if (b.max.y <= y + 0.15 && b.max.y > floorY) {
          floorY = b.max.y;
        }
      }
    }
    return floorY;
  }

  _spawnSoldierBloodVoxels(pos, isHeadshot = false) {
    const count = isHeadshot ? 36 : 26;
    const baseY = pos.y + 0.85;

    for (let i = 0; i < count; i++) {
      const idx = this.bloodIdx;
      this.bloodIdx = (this.bloodIdx + 1) % MAX_BLOOD_VOXELS;
      const v = this.bloodVoxels[idx];

      v.active = true;
      v.x = pos.x + (Math.random() - 0.5) * 0.45;
      v.y = baseY + (Math.random() - 0.5) * 0.70;
      v.z = pos.z + (Math.random() - 0.5) * 0.45;

      const ang = Math.random() * Math.PI * 2;
      const hSpeed = 1.2 + Math.random() * (isHeadshot ? 4.2 : 3.2);
      v.vx = Math.cos(ang) * hSpeed;
      v.vz = Math.sin(ang) * hSpeed;
      v.vy = (isHeadshot ? 3.5 : 2.0) + Math.random() * (isHeadshot ? 5.5 : 3.8);

      v.rx = Math.random() * Math.PI * 2;
      v.ry = Math.random() * Math.PI * 2;
      v.rz = Math.random() * Math.PI * 2;

      v.vrx = (Math.random() - 0.5) * 22;
      v.vry = (Math.random() - 0.5) * 22;
      v.vrz = (Math.random() - 0.5) * 22;

      v.size = 0.075 + Math.random() * 0.055;
      v.maxLife = 2.8 + Math.random() * 0.8;
      v.life = v.maxLife;
      v.settled = false;

      const hex = _bloodPalette[Math.floor(Math.random() * _bloodPalette.length)];
      _tempColor.setHex(hex);
      this.bloodMesh.setColorAt(idx, _tempColor);
    }
    if (this.bloodMesh.instanceColor) this.bloodMesh.instanceColor.needsUpdate = true;
  }

  _spawnGhostDeathSmoke(pos, isHeadshot = false) {
    const count = isHeadshot ? 26 : 20;
    const baseY = pos.y + 0.9;

    for (let i = 0; i < count; i++) {
      const idx = this.ghostSmokeIdx;
      this.ghostSmokeIdx = (this.ghostSmokeIdx + 1) % MAX_GHOST_SMOKE;
      const s = this.ghostSmokePool[idx];

      s.active = true;
      s.mesh.visible = true;
      s.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        baseY + (Math.random() - 0.5) * 0.5,
        pos.z + (Math.random() - 0.5) * 0.4
      );

      const hex = _ghostPalette[Math.floor(Math.random() * _ghostPalette.length)];
      s.mesh.material.color.setHex(hex);
      s.startScale = 0.4 + Math.random() * 0.35;
      s.mesh.scale.setScalar(s.startScale);
      s.mesh.material.opacity = 0.85;

      const spd = 1.4 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      s.vel.set(
        Math.cos(theta) * spd,
        1.2 + Math.random() * 2.8,
        Math.sin(theta) * spd
      );

      s.growth = 2.5 + Math.random() * 1.5;
      s.maxLife = 0.85 + Math.random() * 0.40;
      s.life = s.maxLife;
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

    // 7. Pixels de Sangue Arcade para Soldados Blocky (Física, quique no chão e encolhimento)
    let bloodNeedsUpdate = false;
    for (let i = 0; i < MAX_BLOOD_VOXELS; i++) {
      const v = this.bloodVoxels[i];
      if (!v.active) continue;

      bloodNeedsUpdate = true;
      v.life -= dt;
      if (v.life <= 0) {
        v.active = false;
        _dummy.position.set(0, -999, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.bloodMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      if (!v.settled) {
        // Gravidade arcade e arrasto aerodinâmico
        v.vy -= 18.0 * dt;
        v.vx *= Math.max(0, 1 - 0.40 * dt);
        v.vz *= Math.max(0, 1 - 0.40 * dt);

        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.z += v.vz * dt;

        v.rx += v.vrx * dt;
        v.ry += v.vry * dt;
        v.rz += v.vrz * dt;

        // Colisão com chão ou topo de obstáculos e quique (bounce/kick)
        const floorY = this._getFloorY(v.x, v.y, v.z);
        if (v.y - v.size * 0.5 <= floorY) {
          v.y = floorY + v.size * 0.5;
          if (Math.abs(v.vy) > 0.85) {
            // Kick / Bounce no chão
            v.vy = -v.vy * (0.35 + Math.random() * 0.15);
            v.vx *= 0.65;
            v.vz *= 0.65;
            v.vrx *= 0.6;
            v.vry *= 0.6;
            v.vrz *= 0.6;
          } else {
            // Assenta no chão
            v.vy = 0;
            v.vx = 0;
            v.vz = 0;
            v.vrx = 0;
            v.vry = 0;
            v.vrz = 0;
            v.settled = true;
          }
        }
      }

      // Encolhimento gradual nos últimos 0.6s de vida
      let curSize = v.size;
      if (v.life < 0.6) {
        curSize = v.size * Math.max(0, v.life / 0.6);
      }

      _dummy.position.set(v.x, v.y, v.z);
      _dummy.rotation.set(v.rx, v.ry, v.rz);
      _dummy.scale.setScalar(curSize);
      _dummy.updateMatrix();
      this.bloodMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (bloodNeedsUpdate) {
      this.bloodMesh.instanceMatrix.needsUpdate = true;
    }

    // 8. Fumaça de Fantasma (Explosão poof cinza/branca que expande e dissipa)
    for (let i = 0; i < MAX_GHOST_SMOKE; i++) {
      const s = this.ghostSmokePool[i];
      if (!s.active) continue;

      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }

      const t = s.life / s.maxLife; // 1 -> 0
      s.vel.y += 0.85 * dt; // sustentação térmica ascendente
      s.vel.x *= Math.max(0, 1 - 2.8 * dt);
      s.vel.z *= Math.max(0, 1 - 2.8 * dt);

      s.mesh.position.addScaledVector(s.vel, dt);
      const grow = 1 + (1 - t) * s.growth;
      s.mesh.scale.setScalar(s.startScale * grow);
      s.mesh.material.opacity = t * t * 0.85;
    }
  }
}