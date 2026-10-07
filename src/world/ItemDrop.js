import * as THREE from 'three';
import { WEAPONS } from '../weapons/WeaponDefs.js';

export class ItemDrop {
  constructor({ id, weaponId, ammo = 30, pos, scene = null, world = null }) {
    this.id = id || Math.random().toString(36).substring(2, 9);
    this.weaponId = weaponId || 'ar15';
    this.ammo = ammo;
    this.pos = new THREE.Vector3(pos.x, Math.max(0.2, pos.y), pos.z);
    this.size = new THREE.Vector3(0.8, 0.4, 0.8);
    this.scene = scene;
    this.world = world;
    this.collected = false;

    // Trigger de colisão puro (solid: false para permitir passagem e detecção)
    this.triggerBox = null;
    if (this.world) {
      this.triggerBox = this.world.addBox(
        this.pos.x, this.pos.y, this.pos.z,
        this.size.x, this.size.y, this.size.z,
        { solid: false, isTrigger: true, itemDrop: this }
      );
    }

    // Representação visual procedural (caixa de suprimentos/arma iluminada)
    this.mesh = null;
    if (this.scene) {
      const def = WEAPONS[this.weaponId];
      const color = def?.type === 'sniper' ? 0x00f0ff : (def?.type === 'heavy' ? 0xff3333 : 0xffaa00);
      
      const group = new THREE.Group();
      const boxGeo = new THREE.BoxGeometry(0.5, 0.15, 0.22);
      const boxMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.6,
        emissive: color,
        emissiveIntensity: 0.25
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.castShadow = true;
      group.add(boxMesh);

      group.position.copy(this.pos);
      this.mesh = group;
      this.scene.add(this.mesh);
    }
  }

  update(dt) {
    if (this.mesh) {
      this.mesh.rotation.y += dt * 1.5;
    }
  }

  checkPickup(character) {
    if (this.collected || !character || !character.alive) return false;
    const dist = Math.hypot(character.pos.x - this.pos.x, character.pos.z - this.pos.z);
    return dist < 1.4;
  }

  destroy() {
    this.collected = true;
    if (this.triggerBox && this.world) {
      this.world.removeBox(this.triggerBox);
      this.triggerBox = null;
    }
    if (this.mesh) {
      if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
      this.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.mesh = null;
    }
  }
}
