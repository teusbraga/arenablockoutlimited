import * as THREE from 'three';
import { emit } from '../core/EventBus.js';

/**
 * SmokeGrenade.js
 * Granada de fumaça tática M18 com física de arremesso, quiques mecânicos,
 * detonação volumétrica por 10 segundos e emissão de som espacial 3D com oclusão.
 */
export class SmokeGrenade {
  constructor({ id, pos, dir, world, scene = null, audio = null }) {
    this.id = id || `smoke_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.world = world;
    this.scene = scene;
    this.audio = audio;

    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    
    // Vetor inicial de lançamento
    const launchSpeed = 15.0;
    this.vel = new THREE.Vector3(
      dir.x * launchSpeed,
      dir.y * launchSpeed + 2.8,
      dir.z * launchSpeed
    );

    this.state = 'flying'; // 'flying' | 'active' | 'done'
    this.flightTime = 0;
    this.activeTimer = 0;
    this.duration = 10.0; // Duração exata de 10 segundos conforme especificação
    this.bounces = 0;
    this.radius = 4.2; // Raio volumétrico final da cortina de fumaça

    // Objetos 3D
    this.canisterMesh = null;
    this.smokeGroup = null;
    this.smokePuffs = [];

    this._createCanisterVisual();
  }

  _createCanisterVisual() {
    if (!this.scene) return;

    const group = new THREE.Group();

    // Corpo cilíndrico do canister verde oliva (estilo militar M18)
    const bodyGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.13, 12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x41523c,
      roughness: 0.65,
      metalness: 0.25
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Faixa amarela de identificação tática
    const stripeGeo = new THREE.CylinderGeometry(0.039, 0.039, 0.024, 12);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xd6b238,
      roughness: 0.5
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.03;
    group.add(stripe);

    // Tampa superior e pino
    const topGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2b2f33,
      metalness: 0.8,
      roughness: 0.3
    });
    const top = new THREE.Mesh(topGeo, metalMat);
    top.position.y = 0.075;
    group.add(top);

    group.position.copy(this.pos);
    this.scene.add(group);
    this.canisterMesh = group;
  }

  _createSmokeCloudVisual() {
    if (!this.scene) return;

    this.smokeGroup = new THREE.Group();
    this.smokeGroup.position.copy(this.pos);
    this.smokeGroup.position.y += 0.8; // Eleva ligeiramente o centro da fumaça

    const puffGeo = new THREE.IcosahedronGeometry(1.0, 1);
    const puffCount = 14;

    for (let i = 0; i < puffCount; i++) {
      const angle = (i / puffCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const distFromCenter = 0.4 + Math.random() * 0.8;
      const heightOffset = (Math.random() - 0.3) * 0.8;

      const puffMat = new THREE.MeshStandardMaterial({
        color: 0xccd1cb,
        roughness: 0.95,
        metalness: 0.0,
        transparent: true,
        opacity: 0.84,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(puffGeo, puffMat);
      const targetPos = new THREE.Vector3(
        Math.cos(angle) * distFromCenter * 2.2,
        heightOffset * 1.5,
        Math.sin(angle) * distFromCenter * 2.2
      );

      mesh.position.set(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      );

      const baseScale = 0.8 + Math.random() * 0.7;
      mesh.scale.setScalar(0.2);

      this.smokeGroup.add(mesh);
      this.smokePuffs.push({
        mesh,
        mat: puffMat,
        targetPos,
        baseScale,
        rotSpeed: (Math.random() - 0.5) * 0.4
      });
    }

    this.scene.add(this.smokeGroup);
  }

  detonate() {
    this.state = 'active';
    this.vel.set(0, 0, 0);

    // Ajusta o canister para descansar no solo
    if (this.canisterMesh) {
      this.canisterMesh.rotation.z = Math.PI / 2;
      this.canisterMesh.position.y = this.pos.y + 0.04;
    }

    this._createSmokeCloudVisual();

    // Emite eventos de áudio 3D e detonação
    emit('smoke:detonate', {
      id: this.id,
      pos: { x: this.pos.x, y: this.pos.y + 0.4, z: this.pos.z },
      duration: this.duration
    });
  }

  update(dt) {
    if (this.state === 'done') return;

    if (this.state === 'flying') {
      this.flightTime += dt;

      // Gravidade
      this.vel.y -= 9.8 * dt;
      this.vel.x *= Math.max(0, 1 - dt * 0.25);
      this.vel.z *= Math.max(0, 1 - dt * 0.25);

      const step = this.vel.clone().multiplyScalar(dt);
      const stepLen = step.length();

      if (this.world && stepLen > 0.001) {
        const rayDir = step.clone().normalize();
        const hit = this.world.raycast(this.pos, { x: rayDir.x, y: rayDir.y, z: rayDir.z }, stepLen + 0.05);

        if (hit && hit.distance <= stepLen + 0.05) {
          // Bateu em superfície ou piso
          this.pos.copy(hit.point);
          this.bounces++;

          emit('smoke:bounce', { pos: { x: this.pos.x, y: this.pos.y, z: this.pos.z } });

          // Quique mecânico simples: inverte eixo vertical ou horizontal
          if (Math.abs(rayDir.y) > 0.6) {
            this.vel.y = -this.vel.y * 0.42;
            this.vel.x *= 0.65;
            this.vel.z *= 0.65;
          } else {
            this.vel.x = -this.vel.x * 0.45;
            this.vel.z = -this.vel.z * 0.45;
            this.vel.y *= 0.70;
          }

          if (this.bounces >= 3 || this.flightTime >= 1.2 || this.vel.length() < 0.9) {
            this.detonate();
            return;
          }
        } else {
          this.pos.add(step);
        }
      } else {
        this.pos.add(step);
      }

      // Atualiza visual durante o voo
      if (this.canisterMesh) {
        this.canisterMesh.position.copy(this.pos);
        this.canisterMesh.rotation.x += dt * 8.0;
        this.canisterMesh.rotation.z += dt * 6.0;
      }

      if (this.flightTime >= 1.3) {
        const excess = this.flightTime - 1.3;
        this.detonate();
        if (excess > 0) {
          this.activeTimer += excess;
          if (this.activeTimer >= this.duration) {
            this.state = 'done';
            this.dispose();
          }
        }
      }
    } else if (this.state === 'active') {
      this.activeTimer += dt;

      // Animação de expansão e rotação da cortina de fumaça
      if (this.smokeGroup && this.smokePuffs.length > 0) {
        this.smokeGroup.rotation.y += dt * 0.12;

        const expandFactor = Math.min(1.0, this.activeTimer / 1.5);
        // Desvanecimento nos últimos 2.5 segundos
        const timeLeft = this.duration - this.activeTimer;
        const fadeFactor = timeLeft < 2.5 ? Math.max(0, timeLeft / 2.5) : 1.0;

        for (const p of this.smokePuffs) {
          p.mesh.position.lerp(p.targetPos, Math.min(1.0, dt * 2.8));
          const currentScale = p.baseScale * (0.3 + expandFactor * 1.8);
          p.mesh.scale.setScalar(currentScale);
          p.mesh.rotation.y += dt * p.rotSpeed;
          p.mat.opacity = 0.84 * fadeFactor;
        }
      }

      if (this.activeTimer >= this.duration) {
        this.state = 'done';
        this.dispose();
      }
    }
  }

  dispose() {
    emit('smoke:stop', { id: this.id });

    if (this.canisterMesh && this.canisterMesh.parent) {
      this.canisterMesh.parent.remove(this.canisterMesh);
    }
    if (this.smokeGroup && this.smokeGroup.parent) {
      this.smokeGroup.parent.remove(this.smokeGroup);
    }
    for (const p of this.smokePuffs) {
      if (p.mat) p.mat.dispose();
      if (p.mesh && p.mesh.geometry) p.mesh.geometry.dispose();
    }
    this.smokePuffs = [];
  }
}
