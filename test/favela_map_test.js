import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { materialFactory } from '../src/world/MaterialFactory.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ItalyProps } from '../src/world/ItalyProps.js';

console.log('==================================================');
console.log('🏘️ TESTE DE VALIDAÇÃO DO MAPA FAVELA (150x150 & PBR)');
console.log('==================================================');

const mapPath = path.resolve('assets/maps/favela.json');
if (!fs.existsSync(mapPath)) {
  console.error('❌ Arquivo assets/maps/favela.json não encontrado!');
  process.exit(1);
}

const raw = fs.readFileSync(mapPath, 'utf8');
const data = JSON.parse(raw);

console.log(`- Nome: "${data.name}"`);
console.log(`- Dimensões: [${data.size.join(' x ')}] metros | Floor: "${data.floorMaterial}"`);
console.log(`- Bounds: [${data.bounds.join(', ')}]`);
console.log(`- Geometria Estática: ${data.staticGeometry.length} blocos`);
console.log(`- Props Arquitetônicos: ${data.props.length} itens`);
console.log(`- Player Spawns: ${data.playerSpawns.length} | Bot Spawns: ${data.botSpawns.length}`);

// 1. Validação de Dimensões
if (data.size[0] !== 150 || data.size[1] !== 150) {
  console.error(`❌ Dimensão incorreta: esperado [150, 150], recebido [${data.size.join(', ')}]`);
  process.exit(1);
}

if (data.floorMaterial !== 'favela_alley_floor') {
  console.error(`❌ Material de piso incorreto: esperado favela_alley_floor, recebido ${data.floorMaterial}`);
  process.exit(1);
}

if (!data.environment || !data.environment.fogColor) {
  console.error('❌ Configuração de ambiente/céu ensolarado ausente em favela.json!');
  process.exit(1);
}
console.log(`- Céu / Ambiente: Fog/Sky "${data.environment.fogColor}" | Sun: ${data.environment.sunIntensity}x | Ambient: ${data.environment.ambientIntensity}x`);

// 2. Validação dos Materiais PBR
const requiredMaterials = [
  'favela_brick',
  'favela_wall_organic',
  'favela_graffiti',
  'favela_pixo',
  'favela_concrete_slab',
  'favela_slab',
  'favela_alley_floor'
];

for (const matName of requiredMaterials) {
  const mat = materialFactory.get(matName);
  if (!mat) {
    console.error(`❌ Falha ao obter material '${matName}' via MaterialFactory!`);
    process.exit(1);
  }
}
console.log('✅ Todos os novos materiais PBR de favela instanciados com sucesso!');

// 3. Validação dos Spawns (Distância player <-> bots > 11m)
const pSpawn = data.playerSpawns[0];
for (let i = 0; i < data.botSpawns.length; i++) {
  const bSpawn = data.botSpawns[i];
  const dx = bSpawn[0] - pSpawn[0];
  const dz = bSpawn[2] - pSpawn[2];
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 11.0) {
    console.error(`❌ Bot spawn ${i} muito próximo do jogador (${dist.toFixed(1)}m < 11.0m)!`);
    process.exit(1);
  }
}
console.log('✅ Todos os spawns de bots respeitam a distância mínima de segurança (>11m)!');

// 4. Teste de Instanciação Física e 3D dos Props e Paredes
const scene = new THREE.Scene();
const world = new CollisionWorld();
const props = new ItalyProps(scene, world);

// Adicionar geometria estática ao mundo
for (const item of data.staticGeometry) {
  const [x, y, z] = item.pos;
  const [sx, sy, sz] = item.size;
  world.addBox(x, y + sy / 2, z, sx, sy, sz, { material: item.material });
}

// Executar props
for (const p of data.props) {
  switch (p.type) {
    case 'favela_antenna':
      props.addFavelaAntenna(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.scale || 1.0, p.antennaType || 'uhf');
      break;
    case 'overhead_wires':
      props.addOverheadWires(p.from[0], p.from[1], p.from[2], p.to[0], p.to[1], p.to[2], p.sag || 0.35, p.cableCount || 3);
      break;
    case 'utility_pole':
      props.addUtilityPole(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.height || 7.0);
      break;
    case 'favela_water_tank':
      props.addFavelaWaterTank(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
      break;
    case 'favela_stairs':
      props.addFavelaStairs(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.steps || 8, p.width || 1.2, p.stepHeight || 0.35, p.stepDepth || 0.45, p.withHandrail ?? true);
      break;
    case 'military_crate':
      props.addMilitaryCrate(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.sx, p.sy, p.sz);
      break;
    case 'oil_barrel':
      props.addOilBarrel(p.pos[0], p.pos[1], p.pos[2], p.scale || 1.0);
      break;
    case 'wine_crate':
      props.addWineCrate(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.sx, p.sy, p.sz);
      break;
    case 'desert_tarp':
      props.addDesertTarp(p.pos[0], p.pos[1], p.pos[2], p.rotY || 0, p.width || 4.2, p.depth || 3.2);
      break;
  }
}

console.log(`✅ Mundo de física populado com sucesso: ${world.boxes.length} caixas colidíveis ativas!`);
console.log(`✅ Cena 3D populada com sucesso: ${scene.children.length} grupos e props renderizáveis!`);

// 5. Teste de Raycast e Navegação
const rayOrigin = new THREE.Vector3(0, 1.6, 58); // Visão do player no spawn
const rayDir = new THREE.Vector3(0, 0, -1);
const hit = world.raycast(rayOrigin, rayDir, 100);
if (hit) {
  console.log(`✅ Raycast do spawn detectou obstáculo à frente a ${(hit.distance || hit.t).toFixed(2)}m (Material: ${hit.box.material || 'default'})`);
}

console.log('==================================================');
console.log('🎉 MAPA FAVELA 150x150 TOTALMENTE APROVADO!');
console.log('==================================================');
