import assert from 'assert';
import fs from 'fs';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import * as THREE from 'three';
import { loadMap, createWedgeGeometry } from '../src/world/MapLoader.js';
import { materialFactory } from '../src/world/MaterialFactory.js';
import { ItalyProps } from '../src/world/ItalyProps.js';
import { Character } from '../src/entities/Character.js';

console.log('==================================================');
console.log('⛰️  TESTE DE FÍSICA DE TERRENO INCLINADO, MONTES E ESCORREGAMENTO (SLOPE & DOME)');
console.log('==================================================\n');

// -----------------------------------------------------------------------------
// 1. Testes Geométricos de RampBox
// -----------------------------------------------------------------------------
console.log('--- 1. Primitiva RampBox: Normais e Superfície ---');
const world = new CollisionWorld();

// Rampa +z de 26.6° (sy = 2, sz = 4 -> L = sqrt(20) = 4.472)
const rampZ = world.addRamp(0, 1, 0, 4, 2, 4, '+z');
assert.strictEqual(rampZ.isRamp, true);
assert(Math.abs(rampZ.normal.y - (4 / Math.hypot(2, 4))) < 1e-4, 'Normal Y deve ser sz / L');
assert(rampZ.normal.z < 0, 'Normal Z deve ser negativa (oposta à subida para +Z)');
assert(rampZ.normal.y >= 0.7071, 'Rampa de 26.6° deve ser transitável (ny >= 0.7071)');

// Altura da superfície em z = -2 (início) deve ser 0; em z = 0 (meio) deve ser 1; em z = 2 (fim) deve ser 2
const s0 = rampZ.getSurfaceAt(0, -2);
const sMid = rampZ.getSurfaceAt(0, 0);
const sTop = rampZ.getSurfaceAt(0, 2);
assert(Math.abs(s0.y - 0.0) < 1e-4, 'Base da rampa deve estar em y = 0');
assert(Math.abs(sMid.y - 1.0) < 1e-4, 'Meio da rampa deve estar em y = 1');
assert(Math.abs(sTop.y - 2.0) < 1e-4, 'Topo da rampa deve estar em y = 2');

// Rampa -z (sobe em direção a -z)
const rampNegZ = world.addRamp(10, 1, 0, 4, 2, 4, '-z');
assert(rampNegZ.normal.z > 0, 'Normal Z da rampa -z deve ser positiva');
const sTopNegZ = rampNegZ.getSurfaceAt(10, -2);
assert(Math.abs(sTopNegZ.y - 2.0) < 1e-4, 'Topo da rampa -z deve estar em z = -2');

// Rampa +x
const rampX = world.addRamp(20, 1, 0, 4, 2, 4, '+x');
assert(rampX.normal.x < 0, 'Normal X da rampa +x deve ser negativa');

// Rampa íngreme de 63.4° (sy = 4, sz = 2 -> tan = 2.0)
const rampSteep = world.addRamp(30, 2, 0, 4, 4, 2, '+z');
assert(rampSteep.normal.y < 0.7071, 'Rampa de 63.4° deve ser não-transitável (ny < 0.7071)');
console.log('✅ Normais analíticas e interpolação de superfície de RampBox 100% corretas!');

// -----------------------------------------------------------------------------
// 2. Testes Geométricos de EllipsoidDome
// -----------------------------------------------------------------------------
console.log('\n--- 2. Primitiva EllipsoidDome: Ápice, Declive e Gradiente ---');
// Domo com centro (0, 0, 50), raios rx = 3, rz = 3, altura ry = 1.5
const dome = world.addDome(0, 0, 50, 3, 1.5, 3);
assert.strictEqual(dome.isDome, true);

// Ápice no centro (0, 50)
const apexSurf = dome.getSurfaceAt(0, 50);
assert(Math.abs(apexSurf.y - 1.5) < 1e-4, 'Ápice do domo deve ter altura ry = 1.5m');
assert(Math.abs(apexSurf.normal.y - 1.0) < 1e-4, 'Normal no ápice deve apontar puramente para cima (ny = 1.0)');
assert(Math.abs(apexSurf.normal.x) < 1e-4 && Math.abs(apexSurf.normal.z) < 1e-4, 'Normais X/Z no ápice devem ser 0');

// Ponto a 1.5m do centro (zona transitável, ny > 0.7071)
const midSurf = dome.getSurfaceAt(0, 51.5);
assert(midSurf.y > 0 && midSurf.y < 1.5, 'Altura intermediária deve estar entre 0 e 1.5');
assert(midSurf.normal.y >= 0.7071, 'A 1.5m do centro o domo deve ser transitável (ny >= 0.7071)');

// Ponto na borda a 2.85m do centro (zona íngreme de escorregamento, ny < 0.7071)
const edgeSurf = dome.getSurfaceAt(0, 52.85);
assert(edgeSurf.normal.y < 0.7071, 'Borda do domo deve ter inclinação > 45° (ny < 0.7071)');
assert(edgeSurf.normal.z > 0, 'Normal na borda frontal deve apontar para fora (+Z)');

// Fora do domo (r > 3m)
const outsideSurf = dome.getSurfaceAt(0, 53.5);
assert.strictEqual(outsideSurf, null, 'getSurfaceAt fora do raio do elipsoide deve retornar null');
console.log('✅ Geometria analítica e gradiente instantâneo de EllipsoidDome 100% corretos!');

// -----------------------------------------------------------------------------
// 3. Testes de Raycast Analítico
// -----------------------------------------------------------------------------
console.log('\n--- 3. Raycast Analítico contra Rampas e Domos ---');
// Disparo vertical contra rampa +z
const rayRamp = world.raycast({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 });
assert(rayRamp !== null, 'Raio deve atingir a rampa');
assert.strictEqual(rayRamp.box, rampZ, 'Raio deve identificar a rampa como alvo');
assert(Math.abs(rayRamp.point.y - 1.0) < 0.05, 'Ponto de impacto na rampa em z=0 deve ser y=1.0');
assert(Math.abs(rayRamp.normal.y - rampZ.normal.y) < 1e-4, 'Normal retornada deve ser a normal da rampa');

// Disparo horizontal contra a lateral do Domo
const rayDome = world.raycast({ x: 0, y: 0.5, z: 40 }, { x: 0, y: 0, z: 1 });
assert(rayDome !== null, 'Raio horizontal deve atingir o domo');
assert.strictEqual(rayDome.box, dome, 'Raio deve identificar o domo como alvo');
assert(rayDome.normal.z < 0, 'Normal do domo deve apontar contra a direção do tiro (-Z)');
console.log('✅ Raycast analítico de alta precisão contra rampas e domos validado!');

// -----------------------------------------------------------------------------
// 4. Teste de Subida e Descida Contínua em Rampa Suave (Walkable)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Caminhada Contínua: Subida e Descida em Rampa de 26.6° ---');
const simWorld = new CollisionWorld();
simWorld.addBox(0, -0.5, 0, 100, 1, 100); // Chão plano base em y = 0
// Rampa de 0m a 4m de altura ao longo de 8m (z: -4 a +4)
const walkRamp = simWorld.addRamp(0, 2, 0, 6, 4, 8, '+z', { material: 'concrete' });
// Plataforma de continuação no topo (z: 4 a 8, altura 4m)
simWorld.addBox(0, 2, 6, 6, 4, 4, { material: 'concrete' });

const charWalk = new Character(simWorld);
charWalk.setPosition(0, 0, -5); // 1 metro antes da rampa

// Caminha para frente (+Z) a 4.2 m/s por 160 ticks (~2.67 segundos)
let fellOrBlocked = false;
for (let t = 0; t < 160; t++) {
  charWalk.vel.z = 4.2;
  const res = charWalk.applyPhysics(1/60, 0.35);
  if (res.hitWall && !res.onGround) {
    fellOrBlocked = true;
  }
}
assert(!fellOrBlocked, 'O personagem não deve travar nem perder o chão ao subir rampa suave');
assert(charWalk.pos.y >= 3.99, `O personagem deve atingir o topo da rampa (y atual: ${charWalk.pos.y.toFixed(2)})`);
assert(charWalk.onGround, 'O personagem deve estar firmemente no chão no topo da rampa');

// Agora desce a rampa caminhando para trás (-Z) por 160 ticks
for (let t = 0; t < 160; t++) {
  charWalk.vel.z = -4.2;
  charWalk.applyPhysics(1/60, 0.35);
}
assert(charWalk.pos.y <= 0.05, `O personagem deve descer suavemente até o chão plano (y atual: ${charWalk.pos.y.toFixed(2)})`);
assert(charWalk.onGround, 'O personagem deve manter onGround durante toda a descida');
console.log('✅ Subida e descida 100% fluidas em rampa transitável sem interrupções!');

// -----------------------------------------------------------------------------
// 5. Teste de Escorregamento Físico em Rampa Íngreme (Slide Physics)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Escorregamento Físico em Rampa Íngreme de 63.4° ---');
const slideWorld = new CollisionWorld();
slideWorld.addBox(0, -0.5, 0, 100, 1, 100); // chão plano
// Rampa íngreme de 4m de altura em 2m de profundidade (z: 10 a 12, topo em z=12)
slideWorld.addRamp(0, 2, 11, 6, 4, 2, '+z');

const charSlide = new Character(slideWorld);
// Posiciona no meio da rampa íngreme (z = 11, y = 2.0)
charSlide.setPosition(0, 2.0, 11);

let enteredSlide = false;
let landedOnFlat = false;

for (let t = 0; t < 60; t++) {
  const res = charSlide.applyPhysics(1/60, 0.35);
  if (res.isSliding) {
    enteredSlide = true;
    assert.strictEqual(res.onGround, false, 'Enquanto escorrega, onGround deve ser false');
    if (t > 0) {
      assert(charSlide.vel.z < 0, 'Aceleração tangencial deve empurrar o personagem encosta abaixo (-Z)');
    }
  }
  if (enteredSlide && res.onGround && !res.isSliding && charSlide.pos.y <= 0.05) {
    landedOnFlat = true;
    break;
  }
}

assert(enteredSlide, 'O personagem deve entrar em estado de escorregamento físico (isSliding = true)');
assert(landedOnFlat, 'O personagem deve escorregar até a base e aterrissar com segurança no chão plano');
console.log('✅ Escorregamento físico com aceleração tangencial ladeira abaixo confirmado!');

// -----------------------------------------------------------------------------
// 6. Teste de Caminhada no Topo do Domo e Deslizamento nas Bordas
// -----------------------------------------------------------------------------
console.log('\n--- 6. Teste de Domo / Pedra Arredondada (Molly Dome) ---');
const domeWorld = new CollisionWorld();
domeWorld.addBox(0, -0.5, 0, 100, 1, 100);
// Pedra de raio 3m, altura 1.5m em (0, 0, 0)
domeWorld.addDome(0, 0, 0, 3, 1.5, 3);

const charDome = new Character(domeWorld);
// Posiciona no ápice (0, 1.5, 0)
charDome.setPosition(0, 1.5, 0);
let apexRes = charDome.applyPhysics(1/60, 0.35);
assert(apexRes.onGround, 'No cume da pedra o personagem deve conseguir ficar em pé (onGround = true)');
assert(!apexRes.isSliding, 'No cume da pedra o personagem NÃO deve escorregar');

// Posiciona o personagem próximo da borda íngreme da pedra (z = 2.5m)
charDome.setPosition(0, 0.8, 2.5);
let domeSlid = false;
for (let t = 0; t < 30; t++) {
  charDome.vel.z = 1.0;
  const res = charDome.applyPhysics(1/60, 0.35);
  if (res.isSliding) {
    domeSlid = true;
    break;
  }
}
assert(domeSlid, 'Ao se aproximar da borda da pedra (> 45°), o personagem deve perder tração e escorregar');
console.log('✅ Pedra arredondada transitável no topo e escorregadia nas laterais validada!');

// -----------------------------------------------------------------------------
// 7. Teste de Integração com MapLoader e ItalyProps
// -----------------------------------------------------------------------------
console.log('\n--- 7. Integração de MapLoader e ItalyProps ---');
const gridData = JSON.parse(fs.readFileSync('assets/maps/grid.json', 'utf8'));
const { world: mapWorld } = await loadMap(gridData, null);

// Verifica que grid instanciou rampas e domos no CollisionWorld
const gridRamps = mapWorld.boxes.filter(b => b.isRamp);
const gridDomes = mapWorld.boxes.filter(b => b.isDome);
assert(gridRamps.length >= 3, `Grid deve conter pelo menos 3 rampas de calibração (encontradas: ${gridRamps.length})`);
assert(gridDomes.length >= 1, `Grid deve conter pelo menos 1 domo elipsoidal (encontrados: ${gridDomes.length})`);

// Testa que ItalyProps.addMossyBoulder cria domo elipsoidal
const mockScene = { add: () => {} };
const italyProps = new ItalyProps(mockScene, mapWorld);
const initialDomes = mapWorld.boxes.filter(b => b.isDome).length;
italyProps.addMossyBoulder(10, 0, 10, 4.0, 2.5, 4.0);
const finalDomes = mapWorld.boxes.filter(b => b.isDome).length;
assert.strictEqual(finalDomes, initialDomes + 1, 'addMossyBoulder deve registrar um EllipsoidDome no CollisionWorld');

console.log('✅ Integração de MapLoader e ItalyProps com domos e rampas 100% validada!');

// -----------------------------------------------------------------------------
// 8. Teste de Renderização 3D: createWedgeGeometry e MaterialFactory (caution_yellow)
// -----------------------------------------------------------------------------
console.log('\n--- 8. Renderização 3D de Cunha (Wedge) e Materiais ---');

// Validação da geometria da cunha em todas as direções
for (const dir of ['+z', '-z', '+x', '-x']) {
  const geo = createWedgeGeometry(2.0, 1.0, 4.0, dir);
  assert(geo.isBufferGeometry, 'createWedgeGeometry deve retornar BufferGeometry');
  assert.strictEqual(geo.getAttribute('position').count, 24, 'Wedge deve possuir 24 vértices (base, parede, rampa, 2 laterais)');
  assert(geo.getAttribute('normal'), 'Wedge deve calcular normais de vértices');
  assert(geo.getAttribute('uv'), 'Wedge deve conter coordenadas UV');
}

// Validação dos materiais caution_yellow e steel_girder em MaterialFactory
assert(materialFactory.factories.has('caution_yellow'), 'MaterialFactory deve conter factory para caution_yellow');
assert(materialFactory.factories.has('steel_girder'), 'MaterialFactory deve conter factory para steel_girder');
const matCaution = materialFactory.get('caution_yellow');
assert.strictEqual(matCaution.color.getHexString(), 'd9a425', 'caution_yellow deve possuir cor 0xd9a425');

// Validação de loadMap com THREE.Scene real
const renderScene = new THREE.Scene();
await loadMap(gridData, renderScene);
const renderMeshes = renderScene.children.filter(c => c.isMesh);
const wedgeMeshes = renderMeshes.filter(m => m.geometry?.attributes?.position?.count === 24 && m.geometry.type === 'BufferGeometry');
const domeMeshes = renderMeshes.filter(m => m.geometry?.type === 'SphereGeometry');
assert.strictEqual(wedgeMeshes.length, 6, `Grid deve instanciar exatamente 6 meshes de rampa na cena 3D (encontradas: ${wedgeMeshes.length})`);
assert.strictEqual(domeMeshes.length, 2, `Grid deve instanciar exatamente 2 meshes de domo na cena 3D (encontradas: ${domeMeshes.length})`);
console.log('✅ Renderização 3D de cunhas e domos em Three.js validada com 100% de sucesso!');

console.log('\n==================================================');
console.log('🎉 SUCESSO: Todos os testes de terreno inclinado, montes e escorregamento passaram!');
console.log('==================================================');
