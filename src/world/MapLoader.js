import * as THREE from 'three';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { Door } from './Door.js';
import { materialFactory } from './MaterialFactory.js';
import { ItalyProps } from './ItalyProps.js';
import { loadingScreen } from '../ui/LoadingScreen.js';

// Mapeamento de dependências de materiais para cada tipo de prop especializado
const PROP_MATERIAL_DEPS = {
  // Dust Mirage Props
  palm_tree: ['palm_trunk', 'palm_frond'],
  arabic_arch: ['sandstone'],
  arabic_rug: ['fabric_red', 'fabric_green'],
  military_crate: ['military_crate'],
  oil_barrel: ['oil_barrel'],
  desert_tarp: ['blue_tarp'],
  water_tank: ['iron_grill'],
  // CS Italy Props
  archway: ['stone'],
  window: ['stone', 'window_shutter'],
  rustic_door: ['stone', 'door_wood'],
  balcony: ['stone', 'iron_grill'],
  ivy_wall: ['ivy_foliage'],
  wine_barrel: ['wine_barrel'],
  wine_crate: ['crate'],
  striped_awning: ['awning_red'],
  market_stall: ['crate', 'awning_red'],
  street_lantern: ['iron_grill'],
  showcase_wall: ['wall_peeling_ochre', 'wall_peeling_terra', 'wall_white', 'stone', 'roof', 'door_wood', 'window_shutter', 'ivy_foliage'],
  // Woods Props
  giant_jungle_tree: ['jungle_bark', 'jungle_fern'],
  fallen_log: ['jungle_bark'],
  fern_cluster: ['jungle_fern'],
  bamboo_grove: ['bamboo', 'jungle_fern'],
  sandbag_bunker: ['sandbags'],
  jungle_watchtower: ['wood', 'iron_grill', 'corrugated_iron'],
  ancient_ruins: ['mossy_rock', 'jungle_fern'],
  camo_tent: ['camo_tarp', 'wood'],
  mossy_boulder: ['mossy_rock'],
};

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
  steel_girder:  () => new THREE.MeshStandardMaterial({ color: 0xc44527, roughness: 0.55, metalness: 0.65 }),
  caution_yellow:() => new THREE.MeshStandardMaterial({ color: 0xd9a425, roughness: 0.60 }),
  blue_tarp:     () => new THREE.MeshStandardMaterial({ color: 0x24558a, roughness: 0.70 }),
  plywood:       () => new THREE.MeshStandardMaterial({ color: 0xb59263, roughness: 0.85 }),
  scaffold:      () => new THREE.MeshStandardMaterial({ color: 0xa0a8b0, roughness: 0.35, metalness: 0.85 }),
};

export async function loadMap(url, scene) {
  const fetchUrl = (typeof url === 'string' && url.includes('?')) ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
  const res = await fetch(fetchUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar mapa: ${url}`);
  const data = await res.json();

  loadingScreen.show(data.name || 'CARREGANDO MAPA...');
  loadingScreen.setProgress(10, 'Lendo geometria e limites...');

  const world = new CollisionWorld();
  const doors = [];

  // Define se o mapa utiliza o ecossistema de texturas PBR procedurais (ex: Dust Mirage, CS Italy, Woods)
  const isPbrMap = Boolean(data.pbr || (Array.isArray(data.props) && data.props.length > 0) || data.id === 'dust' || data.id === 'italy' || data.id === 'woods');

  if (isPbrMap) {
    materialFactory.initMaterials();

    // Extrai apenas os materiais necessários para este mapa específico (evita gerar texturas desnecessárias)
    const needed = new Set();
    if (data.floorMaterial) needed.add(data.floorMaterial);
    for (const item of data.staticGeometry || []) {
      if (item.material) needed.add(item.material);
    }
    for (const prop of data.props || []) {
      const deps = PROP_MATERIAL_DEPS[prop.type];
      if (deps) {
        for (const d of deps) needed.add(d);
      }
    }

    await materialFactory.preloadMaterials(Array.from(needed), (p, text) => {
      loadingScreen.setProgress(15 + p * 55, text);
    });
  } else {
    loadingScreen.setProgress(50, 'Configurando materiais clássicos...');
  }

  // Configurações de iluminação / céu do mapa
  if (data.environment && scene) {
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
  const floorMaterial = isPbrMap
    ? materialFactory.get(floorMatName)
    : (MATERIALS[floorMatName] ? MATERIALS[floorMatName]() : MATERIALS.floor());
  
  if (scene) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }
  world.addBox(0, -0.5, 0, w, 1, d, { material: floorMatName });

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
    world.addBox(x, y + sy/2, z, sx, sy, sz, { vaultable: !!item.vaultable, material: matName });
  }

  // Caixa unitária compartilhada por todas as instâncias
  const sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const dummyMatrix = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyScale = new THREE.Vector3();
  const dummyQuat = new THREE.Quaternion(); // Rotação identidade

  if (scene) {
    loadingScreen.setProgress(75, 'Construindo malhas instanciadas...');
    for (const [matName, items] of itemsByMaterial.entries()) {
      const count = items.length;
      const material = isPbrMap
        ? materialFactory.get(matName)
        : (MATERIALS[matName] ? MATERIALS[matName]() : MATERIALS.wall());

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
  }

  // Props especializados (somente para mapas PBR que possuem props definidos)
  if (isPbrMap && scene && Array.isArray(data.props)) {
    loadingScreen.setProgress(88, 'Instanciando elementos e props 3D...');
    const italyProps = new ItalyProps(scene, world);
    for (const p of data.props) {
      switch (p.type) {
        case 'archway':
          italyProps.addStoneArchway(p.pos[0], p.pos[1], p.pos[2], p.span, p.height, p.thickness);
          break;
        case 'showcase_wall':
          italyProps.addTextureShowcaseWall(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0);
          break;
        case 'market_stall':
          italyProps.addMarketStall(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width, p.depth, p.height);
          break;
        case 'balcony':
          italyProps.addBalcony(p.pos[0], p.pos[1], p.pos[2], p.width, p.depth);
          break;
        case 'window':
          italyProps.addWindow(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width, p.height);
          break;
        case 'door_frame':
          italyProps.addRusticDoorFrame(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width, p.height);
          break;
        case 'ivy':
          italyProps.addIvyPatch(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width, p.height);
          break;
        case 'wine_barrel':
          italyProps.addWineBarrel(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        case 'wine_crate':
          italyProps.addWineCrate(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.sx, p.sy, p.sz);
          break;
        case 'lantern':
          italyProps.addStreetLantern(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0);
          break;
        // Props da Vila Ensolarada
        case 'village_tree':
          italyProps.addVillageTree(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        case 'rustic_fence':
          italyProps.addRusticFence(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.length || 5.0, p.height || 1.1);
          break;
        case 'village_well':
          italyProps.addVillageWell(p.pos[0], p.pos[1], p.pos[2]);
          break;
        case 'chimney':
          italyProps.addChimney(p.pos[0], p.pos[1], p.pos[2], p.height || 1.8);
          break;
        case 'hay_bale':
          italyProps.addHayBale(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0);
          break;
        // Props do Dust Mirage
        case 'palm_tree':
          italyProps.addPalmTree(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        case 'arabic_arch':
          italyProps.addArabicArch(p.pos[0], p.pos[1], p.pos[2], p.span || 6.5, p.height || 4.8, p.thickness || 1.2);
          break;
        case 'arabic_rug':
          italyProps.addArabicRugWall(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width || 2.4, p.height || 3.2, !!p.isGreen);
          break;
        case 'military_crate':
          italyProps.addMilitaryCrate(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.sx, p.sy, p.sz);
          break;
        case 'oil_barrel':
          italyProps.addOilBarrel(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        case 'desert_tarp':
          italyProps.addDesertTarp(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width || 4.2, p.depth || 3.2);
          break;
        case 'water_tank':
          italyProps.addWaterTank(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        // Props do Woods (Selva Tropical & Bosque)
        case 'giant_jungle_tree':
          italyProps.addGiantJungleTree(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        case 'fallen_log':
          italyProps.addFallenLog(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.length || 7.5, p.radius || 0.6);
          break;
        case 'fern_cluster':
          italyProps.addFernCluster(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
          break;
        case 'bamboo_grove':
          italyProps.addBambooGrove(p.pos[0], p.pos[1], p.pos[2], p.count || 8, p.radius || 1.6, p.height || 7.5);
          break;
        case 'sandbag_bunker':
          italyProps.addSandbagBunker(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width || 4.2, p.depth || 3.2, p.height || 1.25);
          break;
        case 'jungle_watchtower':
          italyProps.addJungleWatchtower(p.pos[0], p.pos[1], p.pos[2], p.height || 6.2);
          break;
        case 'ancient_ruins':
          italyProps.addAncientRuins(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0);
          break;
        case 'camo_tent':
          italyProps.addMilitaryCamoTent(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width || 5.2, p.length || 7.0, p.height || 3.2);
          break;
        case 'mossy_boulder':
          italyProps.addMossyBoulder(p.pos[0], p.pos[1], p.pos[2], p.sx || 2.8, p.sy || 2.0, p.sz || 2.5, p.rotY || 0);
          break;
      }
    }
  }

  // Portas
  if (scene) {
    for (const dsc of data.doors || []) {
      doors.push(new Door({
        scene, world,
        position: dsc.pos,
        width: dsc.width || 1.1,
        height: dsc.height || 2.2,
      }));
    }
  }

  return {
    world, doors, bounds,
    materialFactory,
    playerSpawns: data.playerSpawns || [[0, 1, 8]],
    botSpawns: data.botSpawns || [[-8, 0, -8], [8, 0, -8]],
  };
}