import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { createHK416MagazineMesh } from './models/HK416.js';

export class MagazineDrop {
  constructor({ scene, world = null, weaponId = 'ar15', ammoCount = 0, maxAmmo = 30, pos, vel = null }) {
    this.scene = scene;
    this.world = world;
    this.weaponId = weaponId;
    this.ammoCount = Math.max(0, ammoCount);
    this.maxAmmo = maxAmmo;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.vel = vel ? new THREE.Vector3(vel.x, vel.y, vel.z) : new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      -0.8,
      (Math.random() - 0.5) * 0.4
    );
    this.collected = false;
    this.isResting = false;
    this.disposables = [];

    this.mesh = this._buildMesh();
    this.mesh.position.copy(this.pos);
    if (this.scene) {
      this.scene.add(this.mesh);
    }
  }

  _buildMesh() {
    const root = new THREE.Group();
    root.name = `MagazineDrop_${this.weaponId}`;

    let magObj = null;
    if (this.weaponId === 'ar15' || this.weaponId === 'hk416') {
      magObj = createHK416MagazineMesh();
    } else {
      // Procedural magazine tailored to weapon type
      const def = WEAPONS[this.weaponId];
      const isPistol = def?.type === 'pistol';
      const isSMG = def?.type === 'smg';
      const isDrum = this.weaponId === 'm249';

      const width = isDrum ? 0.08 : (isPistol ? 0.022 : 0.028);
      const height = isDrum ? 0.12 : (isPistol ? 0.11 : 0.15);
      const depth = isDrum ? 0.08 : (isPistol ? 0.038 : 0.058);

      const mat = new THREE.MeshStandardMaterial({
        color: 0x1f2328,
        roughness: 0.55,
        metalness: 0.45
      });
      this.disposables.push(mat);

      const geo = new THREE.BoxGeometry(width, height, depth);
      this.disposables.push(geo);

      magObj = new THREE.Mesh(geo, mat);
      magObj.position.set(0, height * 0.5, 0);
      magObj.castShadow = true;
      magObj.receiveShadow = true;
    }

    // Leve rotação deitada ao repousar no solo
    magObj.rotation.x = Math.PI * 0.45;
    magObj.rotation.z = 0.25;
    root.add(magObj);

    // Indicador sutil no solo (Ring luminoso tático)
    const ringGeo = new THREE.RingGeometry(0.12, 0.18, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7bc67e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    this.disposables.push(ringGeo, ringMat);

    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.01;
    root.add(ringMesh);

    return root;
  }

  update(dt) {
    if (this.collected) return;

    if (!this.isResting) {
      // Simulação física suave de queda e gravidade
      this.vel.y -= 9.8 * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      this.pos.z += this.vel.z * dt;

      // Fricção no ar
      this.vel.x *= Math.max(0, 1 - dt * 2.5);
      this.vel.z *= Math.max(0, 1 - dt * 2.5);

      // Verificação de chão
      let floorY = 0.05;
      if (this.world && typeof this.world.raycast === 'function') {
        const hit = this.world.raycast(this.pos, { x: 0, y: -1, z: 0 }, 1.5);
        if (hit && hit.point) {
          floorY = hit.point.y + 0.04;
        }
      }

      if (this.pos.y <= floorY) {
        this.pos.y = floorY;
        this.vel.set(0, 0, 0);
        this.isResting = true;
      }

      if (this.mesh) {
        this.mesh.position.copy(this.pos);
      }
    }
  }

  checkPickup(character) {
    if (this.collected || !character || !character.alive) return false;
    const px = character.pos?.x ?? character.position?.x ?? 0;
    const pz = character.pos?.z ?? character.position?.z ?? 0;
    const dist = Math.hypot(px - this.pos.x, pz - this.pos.z);
    return dist < 1.4;
  }

  destroy() {
    this.collected = true;
    if (this.mesh) {
      if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
      for (const item of this.disposables) {
        if (item && item.dispose) item.dispose();
      }
      this.disposables = [];
      if (this.mesh.clear) {
        this.mesh.clear();
      }
      this.mesh = null;
    }
  }
}
