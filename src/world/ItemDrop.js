import * as THREE from 'three';
import { WEAPONS } from '../weapons/WeaponDefs.js';

export class ItemDrop {
  static builders = {};

  static setBuilders(map) {
    ItemDrop.builders = map || {};
  }

  constructor({ id, weaponId, ammo = 30, pos, scene = null, world = null }) {
    this.id = id || Math.random().toString(36).substring(2, 9);
    this.weaponId = weaponId || 'ar15';
    this.ammo = ammo;
    this.pos = new THREE.Vector3(pos.x, Math.max(0.2, pos.y), pos.z);
    this.baseY = Math.max(0.38, this.pos.y);
    this.size = new THREE.Vector3(0.8, 0.4, 0.8);
    this.scene = scene;
    this.world = world;
    this.collected = false;
    this.animTime = Math.random() * Math.PI * 2;

    // Trigger de colisão puro (solid: false para permitir passagem e detecção)
    this.triggerBox = null;
    if (this.world) {
      this.triggerBox = this.world.addBox(
        this.pos.x, this.pos.y, this.pos.z,
        this.size.x, this.size.y, this.size.z,
        { solid: false, isTrigger: true, itemDrop: this }
      );
    }

    // Representação visual 3D
    this.mesh = null;
    this._disposables = [];
    if (this.scene) {
      this._createVisual();
    }
  }

  _createVisual() {
    const def = WEAPONS[this.weaponId];
    const group = new THREE.Group();
    group.position.set(this.pos.x, this.baseY, this.pos.z);

    // Cor do halo / identificação por tipo de arma
    let glowColor = 0xffcc00; // rifle padrão
    if (def) {
      if (def.type === 'sniper' || this.weaponId === 'vss' || this.weaponId === 'rifle_proto') {
        glowColor = 0x00f0ff;
      } else if (def.type === 'heavy' || this.weaponId === 'm249') {
        glowColor = 0xff6600;
      } else if (def.type === 'shotgun' || this.weaponId === 'm12') {
        glowColor = 0xff3344;
      } else if (def.type === 'smg' || this.weaponId === 'uzi' || this.weaponId === 'p9') {
        glowColor = 0x33ff66;
      } else if (this.weaponId === 'sw500') {
        glowColor = 0xff00bb;
      }
    }

    let weaponObj = null;
    const builder = ItemDrop.builders[this.weaponId];
    if (typeof builder === 'function') {
      try {
        const res = builder();
        weaponObj = res.group ?? res;
      } catch (err) {
        console.warn(`[ItemDrop] Falha ao construir modelo 3D para ${this.weaponId}:`, err);
      }
    }

    if (weaponObj) {
      // Centraliza perfeitamente o modelo 3D da arma no ponto de rotação
      const bbox = new THREE.Box3().setFromObject(weaponObj);
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      weaponObj.position.sub(center);

      // Leve inclinação tática para dar destaque à silhueta
      weaponObj.rotation.x = 0.15;
      weaponObj.rotation.z = 0.20;

      // Desativa luzes internas ou flashes do viewmodel no modelo dropado
      weaponObj.traverse(o => {
        if (o.isLight) o.intensity = 0;
        if (o.name && (o.name.includes('flash') || o.name.includes('Flash'))) o.visible = false;
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });

      group.add(weaponObj);
    } else {
      // Fallback procedural clássico: caixa/estojo tático
      const boxGeo = new THREE.BoxGeometry(0.5, 0.15, 0.22);
      const boxMat = new THREE.MeshStandardMaterial({
        color: glowColor,
        roughness: 0.4,
        metalness: 0.6,
        emissive: glowColor,
        emissiveIntensity: 0.25
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.castShadow = true;
      group.add(boxMesh);
      this._disposables.push(boxGeo, boxMat);
    }

    // Halo tático no solo (círculo emissivo que marca o drop)
    const ringGeo = new THREE.RingGeometry(0.25, 0.35, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -0.32;
    group.add(ringMesh);
    this._disposables.push(ringGeo, ringMat);

    // Luz pontual suave de destaque
    const pLight = new THREE.PointLight(glowColor, 0.7, 3.2, 1.6);
    pLight.position.set(0, 0, 0);
    group.add(pLight);
    this._disposables.push(pLight);

    this.mesh = group;
    this.scene.add(this.mesh);
  }

  update(dt) {
    this.animTime += dt;
    if (this.mesh) {
      this.mesh.rotation.y += dt * 1.5;
      this.mesh.position.y = this.baseY + Math.sin(this.animTime * 3) * 0.08;
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
      if (this._disposables) {
        for (const item of this._disposables) {
          if (item.dispose) item.dispose();
        }
        this._disposables = [];
      }
      this.mesh.clear();
      this.mesh = null;
    }
  }
}
