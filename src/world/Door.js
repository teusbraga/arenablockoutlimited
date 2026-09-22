import * as THREE from 'three';
import { emit } from '../core/EventBus.js';

export class Door {
  constructor({ scene, world, position, width = 1.1, height = 2.2, thickness = 0.12, openAngle = Math.PI * 0.55 }) {
    this.world = world;
    this.openAngle = openAngle;
    this.speed = 3.2;
    this.state = 'closed';           // closed | opening | open | closing
    this.angle = 0;
    this.interactRange = 2.2;

    // Pivot no lado esquerdo
    this.pivot = new THREE.Group();
    this.pivot.position.set(position[0] - width/2, position[1], position[2]);
    scene.add(this.pivot);

    const mat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.75 });
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), mat);
    doorMesh.position.set(width/2, height/2, 0);
    doorMesh.castShadow = true; doorMesh.receiveShadow = true;
    this.pivot.add(doorMesh);

    // Colisor inicial (fechado)
    this.collider = world.addBox(position[0], position[1] + height/2, position[2], width, height, thickness);
    this._colliderPos = { x: position[0], y: position[1] + height/2, z: position[2] };
    this._colliderSize = { w: width, h: height, d: thickness };
  }

  toggle() {
    if (this.state === 'closed' || this.state === 'closing') this.state = 'opening';
    else this.state = 'closing';
    emit('door:toggle', { door: this });
  }

  update(dt) {
    const target = (this.state === 'opening' || this.state === 'open') ? this.openAngle : 0;
    const diff = target - this.angle;
    if (Math.abs(diff) < 0.005) {
      if (this.state === 'opening') this.state = 'open';
      if (this.state === 'closing') this.state = 'closed';
      this.angle = target;
    } else {
      this.angle += Math.sign(diff) * Math.min(this.speed * dt, Math.abs(diff));
    }
    this.pivot.rotation.y = this.angle;

    // Colisor "sólido" só quando quase fechado
    const openness = Math.abs(this.angle) / this.openAngle;
    this.collider.solid = openness < 0.2;
  }
}