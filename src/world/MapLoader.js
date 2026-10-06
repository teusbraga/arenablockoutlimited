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
  sand:          () => new THREE.MeshStandardMaterial({ color: 0xd4b27d, roughness: 0.95 }),
  sand_dark:     () => new THREE.MeshStandardMaterial({ color: 0xb59363, roughness: 0.95 }),
  sandstone:     () => new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.88 }),
  plaster_light: () => new THREE.MeshStandardMaterial({ color: 0xebd9be, roughness: 0.85 }),
  fabric_red:    () => new THREE.MeshStandardMaterial({ color: 0x9c332b, roughness: 0.85 }),
  metal_barrel:  () => new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.45, metalness: 0.6 }),
  concrete:      () => new THREE.MeshStandardMaterial({ color: 0x82878d, roughness: 0.90 }),
  concrete_dark: () => new THREE.MeshStandardMaterial({ color: 0x474b50, roughness: 0.92 }),
  steel_girder:  () => new THREE.MeshStandardMaterial({ color: 0xc44527, roughness: 0.55, metalness: 0.65 }), // Viga I de aço vermelho industrial
  caution_yellow:() => new THREE.MeshStandardMaterial({ color: 0xd9a425, roughness: 0.60 }),
  blue_tarp:     () => new THREE.MeshStandardMaterial({ color: 0x24558a, roughness: 0.70 }), // Lona azul de construção
  plywood:       () => new THREE.MeshStandardMaterial({ color: 0xb59263, roughness: 0.85 }), // Compensado de madeira
  scaffold:      () => new THREE.MeshStandardMaterial({ color: 0xa0a8b0, roughness: 0.35, metalness: 0.85 }),
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

  // Geometria estática usando InstancedMesh para otimização de Draw Calls
  const itemsByMaterial = new Map();
  for (const item of data.staticGeometry || []) {
    const [x, y, z] = item.pos;
    const [sx, sy, sz] = item.size;
    const matName = item.material || 'wall';

    if (!itemsByMaterial.has(matName)) {
      itemsByMaterial.set(matName, []);
    }
    itemsByMaterial.get(matName).push(item);

    // Registra hitbox pura no CollisionWorld (purificada de Mesh)
    world.addBox(x, y + sy/2, z, sx, sy, sz, { vaultable: !!item.vaultable });
  }

  // Caixa unitária compartilhada por todas as instâncias
  const sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const dummyMatrix = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyScale = new THREE.Vector3();
  const dummyQuat = new THREE.Quaternion(); // Rotação identidade

  for (const [matName, items] of itemsByMaterial.entries()) {
    const count = items.length;
    const matCreator = MATERIALS[matName] || MATERIALS.wall;
    const material = matCreator();

    const instancedMesh = new THREE.InstancedMesh(sharedBoxGeo, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    for (let i = 0; i < count; i++) {
      const item = items[i];
      const [x, y, z] = item.pos;
      const [sx, sy, sz] = item.size;

      dummyPos.set(x, y + sy / 2, z);
      dummyScale.set(sx, sy, sz);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);

      instancedMesh.setMatrixAt(i, dummyMatrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(instancedMesh);
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