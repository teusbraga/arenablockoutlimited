import assert from 'node:assert';
import * as THREE from 'three';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { CameraRig } from '../src/core/CameraRig.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import fs from 'fs';
import { on } from '../src/core/EventBus.js';
import { WEAPONS, initWeaponsFromData } from '../src/weapons/WeaponDefs.js';

// Inicializa armas a partir dos JSONs
const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
rawData.ammo = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
initWeaponsFromData(rawData);

console.log('==================================================');
console.log('♿ TESTE FASE 14: ACESSIBILIDADE, HEADBOB ±20% & WALL PRESS');
console.log('==================================================\n');

// ---------------------------------------------------------------------
// TESTE 1: Configuração Padrão de Acessibilidade
// ---------------------------------------------------------------------
console.log('[Teste 1] Validando Defaults de Acessibilidade...');
assert.ok(CONFIG.ACCESSIBILITY, 'CONFIG.ACCESSIBILITY deve existir');
assert.strictEqual(typeof CONFIG.ACCESSIBILITY.headbobScale, 'number');
assert.strictEqual(typeof CONFIG.ACCESSIBILITY.shakeScale, 'number');
assert.strictEqual(typeof CONFIG.ACCESSIBILITY.vibrationEnabled, 'boolean');
console.log(`✅ Defaults OK: Headbob=${CONFIG.ACCESSIBILITY.headbobScale}, Shake=${CONFIG.ACCESSIBILITY.shakeScale}, Vibrate=${CONFIG.ACCESSIBILITY.vibrationEnabled}`);

// ---------------------------------------------------------------------
// TESTE 2: Modulação Data-Driven do Headbob (±20%) no CameraRig
// ---------------------------------------------------------------------
console.log('\n[Teste 2] Modulação Data-Driven do Headbob (±20%)...');
const playerMoving = {
  alive: true,
  onGround: true,
  vel: { x: 4.8, z: 0 },
  renderPos: { x: 0, y: 0, z: 0 },
  sprinting: false,
  crouchAmount: 0,
  ads: false
};

function measureBob(scale) {
  CONFIG.ACCESSIBILITY.headbobScale = scale;
  const testRig = new CameraRig();
  testRig.bobAmt = 0;
  for (let i = 0; i < 40; i++) {
    testRig.update(0.016, playerMoving);
  }
  return testRig.bobAmt;
}

const bob100 = measureBob(1.0);
const bob80  = measureBob(0.8);
const bob120 = measureBob(1.2);
const bob0   = measureBob(0.0);

console.log(`  - Bob Base (100%): amt = ${bob100.toFixed(5)}`);
console.log(`  - Bob -20% ( 80%): amt = ${bob80.toFixed(5)} (Razão: ${(bob80 / bob100).toFixed(2)})`);
console.log(`  - Bob +20% (120%): amt = ${bob120.toFixed(5)} (Razão: ${(bob120 / bob100).toFixed(2)})`);
console.log(`  - Bob Zero (  0%): amt = ${bob0.toFixed(5)}`);

assert.ok(Math.abs((bob80 / bob100) - 0.8) < 0.02, 'Bob -20% deve ser ~0.80x');
assert.ok(Math.abs((bob120 / bob100) - 1.2) < 0.02, 'Bob +20% deve ser ~1.20x');
assert.ok(bob0 < 0.0001, 'Bob Zero deve ser nulo');
console.log('✅ Modulação Data-Driven de Headbob validada com precisão matemática!');

// ---------------------------------------------------------------------
// TESTE 3: Modulação Data-Driven do Camera Shake
// ---------------------------------------------------------------------
console.log('\n[Teste 3] Modulação Data-Driven de Shake...');
const playerStill = {
  alive: true,
  onGround: true,
  vel: { x: 0, z: 0 },
  renderPos: { x: 0, y: 0, z: 0 },
  sprinting: false,
  crouchAmount: 0,
  ads: false
};

function measureShake(scale) {
  CONFIG.ACCESSIBILITY.shakeScale = scale;
  const testRig = new CameraRig();
  testRig.addShake(1.0);
  testRig.update(0.016, playerStill);
  return testRig.shakePos.length();
}

const shake100 = measureShake(1.0);
const shake50  = measureShake(0.5);
const shake0   = measureShake(0.0);

console.log(`  - Shake Base (100%): len = ${shake100.toFixed(5)}`);
console.log(`  - Shake 50%  ( 50%): len = ${shake50.toFixed(5)} (Razão: ${(shake50 / shake100).toFixed(2)})`);
console.log(`  - Shake Zero (  0%): len = ${shake0.toFixed(5)}`);

assert.ok(Math.abs((shake50 / shake100) - 0.5) < 0.02, 'Shake 50% deve ser ~0.50x');
assert.strictEqual(shake0, 0, 'Shake Zero deve ser nulo');
console.log('✅ Modulação Data-Driven de Camera Shake validada com sucesso!');

// ---------------------------------------------------------------------
// TESTE 4: Detecção de Material no Chão via CollisionWorld
// ---------------------------------------------------------------------
console.log('\n[Teste 4] Detecção de Material no Chão (moveAndSlide)...');
const world = new CollisionWorld();
world.addBox(0, -1, 0, 10, 2, 10, { material: 'wood' });

const pos = { x: 0, y: 0.1, z: 0 };
const size = { x: 0.6, y: 1.8, z: 0.6 };
const delta = { x: 0, y: -0.2, z: 0 };
const res = world.moveAndSlide(pos, size, delta);

assert.strictEqual(res.onGround, true, 'Deve aterrissar sobre a caixa');
assert.strictEqual(res.groundMaterial, 'wood', 'Deve identificar material "wood" do chão');
console.log(`✅ Material de chão detectado: "${res.groundMaterial}" (onGround=${res.onGround})`);

// ---------------------------------------------------------------------
// TESTE 5: Weapon Wall Press & Obstrução de Disparo
// ---------------------------------------------------------------------
console.log('\n[Teste 5] Weapon Wall Press & Obstrução...');
const wallWorld = new CollisionWorld();
// Parede a 0.4 metros em frente da câmera (face frontal em Z = -0.4)
wallWorld.addBox(0, 1.5, -0.6, 2, 3, 0.4, { material: 'concrete' });

const mockCamera = new THREE.PerspectiveCamera();
mockCamera.position.set(0, 1.5, 0);
mockCamera.lookAt(0, 1.5, -5);
const mockViewmodel = {
  mount: new THREE.Group(),
  applySwayFromRig: () => {},
  getShake: () => 0,
  triggerMuzzleLight: () => {},
  updatePose: () => {},
  equip: (id) => {},
  models: { ar15: { mesh: new THREE.Group() } }
};
const mockInput = {
  actions: { fire: false, ads: false },
  consumeAction: () => false
};
const mockPlayer = {
  pos: { x: 0, y: 0, z: 0 },
  vel: { x: 0, y: 0, z: 0 },
  yaw: 0, // forward aponta para -Z (em direção à caixa em Z=-0.4)
  pitch: 0,
  alive: true,
  sprinting: false
};

const ws = new WeaponSystem({
  camera: mockCamera,
  viewmodel: mockViewmodel,
  input: mockInput,
  player: mockPlayer,
  world: wallWorld,
  botsProvider: () => [],
  inventory: ['ar15', null]
});

// Executa update simulando aproximação da parede
for (let i = 0; i < 30; i++) {
  ws.update(0.016);
}

console.log(`  - Wall Compression detectada: ${(ws.wallCompression * 100).toFixed(1)}%`);
assert.ok(ws.wallCompression > 0.40, 'A compressão deve ser detectada próxima à parede');

// Tenta mirar em ADS enquanto comprimido
ws.ads = true;
ws.wallCompression = 0.50;
ws.update(0.016);
assert.strictEqual(ws.ads, false, 'ADS deve ser cancelado automaticamente se wallCompression >= 0.45');

// Disparo bloqueado com cano obstruído
ws.wallCompression = 0.90;
const initialAmmo = ws.ammo;
let blockedPopup = null;
let emptySoundFired = false;
const unsub1 = on('hud:popup', e => { blockedPopup = e.text; });
const unsub2 = on('weapon:empty', () => { emptySoundFired = true; });

ws._fire();

unsub1();
unsub2();

assert.strictEqual(ws.ammo, initialAmmo, 'Munição não deve ser gasta se o cano estiver obstruído');
assert.strictEqual(emptySoundFired, true, 'Som de câmara vazia/clique deve ser emitido');
assert.strictEqual(blockedPopup, 'CANO OBSTRUÍDO PELA PAREDE', 'Alerta HUD de obstrução deve ser exibido');
console.log('✅ Bloqueio de ADS e Disparo por obstrução de parede validado com sucesso!');

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DA FASE 14 E DATA-DRIVEN PASSARAM!');
console.log('==================================================');
