import * as THREE from 'three';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { Door } from './Door.js';

const MATERIALS = {
  wall:          () => new THREE.MeshStandardMaterial({ color: 0x2f3336, roughness: 0.9 }),
  wall_white:    () => new THREE.MeshStandardMaterial({ color: 0xded9cf, roughness: 0.88 }),
  crate:         () => new THREE.MeshStandardMaterial({ color: 0x4a4034, roughness: 0.85 }),
  fence:         () => new THREE.MeshStandardMaterial({ color: 0x6a6a70, roughness: 0.6, metalness: 0.4 }),
  wood:          () => new THREE.MeshStandardMaterial({ color: 0x6e4c32, roughness: 0.85 }),
  roof:          () => new THREE.MeshStandardMaterial({ color: 0xa84332, roughness: 0.80 }),
  stone:         () => new THREE.MeshStandardMaterial({ color: 0x75787b, roughness: 0.90 }),
  trunk:         () => new THREE.MeshStandardMaterial({ color: 0x48321e, roughness: 0.92 }),
  foliage:       () => new THREE.MeshStandardMaterial({ color: 0x367332, roughness: 0.82 }),
  foliage_light: () => new THREE.MeshStandardMaterial({ color: 0x4c8a3c, roughness: 0.80 }),
  dirt:          () => new THREE.MeshStandardMaterial({ color: 0x8a7051, roughness: 0.95 }),
  grass:         () => new THREE.MeshStandardMaterial({ color: 0x4d7c3d, roughness: 0.92 }),
  floor:         () => new THREE.MeshStandardMaterial({ color: 0x2b2f32, roughness: 0.95 }),
};

export async function loadMap(url, scene) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar mapa: ${url}`);
  const data = await res.json();

  const world = new CollisionWorld();
  const doors = [];

  // Configurações de iluminação / céu do mapa
  if (data.environment) {
    if (data.environment.fogColor) {
      scene.background = new THREE.Color(data.environment.fogColor);
      scene.fog = new THREE.Fog(
        data.environment.fogColor,
        data.environment.fogNear || 45,
        data.environment.fogFar || 130
      );
    }
  }

  // Chão — visual + colisão (caixa fina abaixo de y=0)
  const [w, d] = data.size;
  const floorMatName = data.floorMaterial || 'floor';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), (MATERIALS[floorMatName] || MATERIALS.floor)());
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  world.addBox(0, -0.5, 0, w, 1, d);

  const bounds = data.bounds || [-w/2, w/2, -d/2, d/2];

  // Geometria estática
  for (const item of data.staticGeometry || []) {
    const [x, y, z] = item.pos;
    const [sx, sy, sz] = item.size;
    const matName = item.material || 'wall';
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      (MATERIALS[matName] || MATERIALS.wall)()
    );
    mesh.position.set(x, y + sy/2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    world.addBox(x, y + sy/2, z, sx, sy, sz, { vaultable: !!item.vaultable });
  }

  // Portas
  for (const dsc of data.doors || []) {
    doors.push(new Door({
      scene, world,
      position: dsc.pos,
      width: dsc.width || 1.1,
      height: dsc.height || 2.2,
    }));
  }

  return {
    world, doors, bounds,
    playerSpawns: data.playerSpawns || [[0, 1, 8]],
    botSpawns: data.botSpawns || [[-8, 0, -8], [8, 0, -8]],
  };
}