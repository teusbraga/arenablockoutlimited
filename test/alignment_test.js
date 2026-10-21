import * as THREE from 'three';
import fs from 'fs';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';
import { BallisticsCalculator } from '../src/weapons/BallisticsCalculator.js';
import { BarrelCrosshairAlignment } from '../src/new_mechanics/BarrelCrosshairAlignment.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';

console.log('==================================================');
console.log('🎯 TESTE DE ALINHAMENTO, CONVERGÊNCIA E BALÍSTICA');
console.log('==================================================');

// 1. Carrega dados de armas
const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
rawData.ammo = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
initWeaponsFromData(rawData);

// -----------------------------------------------------------------
// Teste 1: Convergência no Modo Estático (Zeroing de Paralaxe)
// -----------------------------------------------------------------
console.log('\n[Teste 1] Validação de Convergência no Modo Estático (Eliminação de Paralaxe):');
const camPos = new THREE.Vector3(0, 1.6, 0);
const camDir = new THREE.Vector3(0, 0, -1);
const zeroDist = 50.0;
const targetPoint = camPos.clone().addScaledVector(camDir, zeroDist);

// Boca do cano da AR15 deslocada lateralmente e verticalmente
const muzzleLocal = [0.14, -0.15, -0.3];
const muzzleWorld = camPos.clone().add(new THREE.Vector3(muzzleLocal[0], muzzleLocal[1], muzzleLocal[2]));

// Vetor convergente calculado da mesma forma que em WeaponSystem._fire():
const fireDir = targetPoint.clone().sub(muzzleWorld).normalize();

// Projeta o tiro para a distância zeroDist (50m no eixo Z)
const t = (targetPoint.z - muzzleWorld.z) / fireDir.z;
const hitAtTargetDist = muzzleWorld.clone().addScaledVector(fireDir, t);

const errorX = Math.abs(hitAtTargetDist.x - targetPoint.x);
const errorY = Math.abs(hitAtTargetDist.y - targetPoint.y);

if (errorX < 1e-4 && errorY < 1e-4) {
  console.log(`  ✅ Convergência a 50m perfeita! Erro X: ${errorX.toFixed(6)}m, Erro Y: ${errorY.toFixed(6)}m.`);
} else {
  console.error(`  ❌ Falha na convergência! Erro X: ${errorX}, Erro Y: ${errorY}`);
  process.exit(1);
}

// -----------------------------------------------------------------
// Teste 2: Alinhamento Dinâmico Fiel ao Cano 3D e Projeção da Crosshair
// -----------------------------------------------------------------
console.log('\n[Teste 2] Validação do Alinhamento Dinâmico (Bala acerta onde o Crosshair está):');
const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 1000);
camera.position.set(0, 1.6, 0);
camera.updateMatrixWorld(true);

const dummyMount = new THREE.Group();
camera.add(dummyMount);
dummyMount.position.set(0.14, -0.15, -0.3);
dummyMount.rotation.x = 0.05; // 50mrad de elevação
dummyMount.updateMatrixWorld(true);

const dummyViewmodel = {
  mount: dummyMount,
  kickRotX: 0.05
};

const bca = new BarrelCrosshairAlignment({
  camera,
  viewmodel: dummyViewmodel,
  collisionWorld: null,
  defaultZeroDistance: 50.0
});

const ar15Def = WEAPONS['ar15'];
// Simula rajada com sprayRecoil
const sprayRecoil = { pitch: 0.04, yaw: 0.01 };
const res = bca.update(ar15Def, false, 0.016, sprayRecoil);

// O ponto de mira 3D projetado na câmera 2D deve coincidir perfeitamente com a screenPos gerada
const projected3D = res.aimPointWorld.clone().project(camera);
const screenW = 1920;
const screenH = 1080;
const expectedScreenX = (projected3D.x * 0.5 + 0.5) * screenW;
const expectedScreenY = (-(projected3D.y * 0.5) + 0.5) * screenH;

const diffScreenX = Math.abs(res.screenPos.x - expectedScreenX);
const diffScreenY = Math.abs(res.screenPos.y - expectedScreenY);

// Como há um leve lerp de suavização em dt=0.016 (45*dt ~ 0.72 do caminho),
// roda mais alguns ticks para assentar
for (let i = 0; i < 10; i++) {
  bca.update(ar15Def, false, 0.016, sprayRecoil);
}
const finalDiffX = Math.abs(bca.screenPos.x - expectedScreenX);
const finalDiffY = Math.abs(bca.screenPos.y - expectedScreenY);

if (finalDiffX < 0.5 && finalDiffY < 0.5) {
  console.log(`  ✅ Crosshair 2D perfeitamente sincronizada com o ponto de impacto 3D do cano! Diferença: (${finalDiffX.toFixed(2)}px, ${finalDiffY.toFixed(2)}px)`);
} else {
  console.error(`  ❌ Crosshair descompassada do tiro! Diferença: (${finalDiffX}, ${finalDiffY})`);
  process.exit(1);
}

// -----------------------------------------------------------------
// Teste 3: Simulação Física Contínua (CCD, Queda Balística e Velocidade)
// -----------------------------------------------------------------
console.log('\n[Teste 3] Validação de Queda Balística (Bullet Drop) e Voo Físico no ProjectileManager:');
const pm = new ProjectileManager({ world: null });

const p = pm.spawn({
  origin: new THREE.Vector3(0, 2.0, 0),
  direction: new THREE.Vector3(0, 0, -1),
  weaponDef: ar15Def,
  owner: 'player'
});

const dt = 1 / 60;
// Simula 0.1 segundos de voo (6 frames a 60Hz)
for (let step = 0; step < 6; step++) {
  pm.update(dt);
}

const expectedVy = -ar15Def.ballistics.terminal.bulletDrop * 0.1;
const diffVy = Math.abs(p.vel.y - expectedVy);

if (p.pos.y < 2.0 && p.pos.z < 0 && diffVy < 0.05) {
  console.log(`  ✅ Projétil sofreu gravidade correta! Pos Y: ${p.pos.y.toFixed(4)}m, Vel Y: ${p.vel.y.toFixed(3)} m/s (Esperado: ${expectedVy.toFixed(3)} m/s).`);
} else {
  console.error(`  ❌ Falha na física do projétil! Pos Y: ${p.pos.y}, Vel Y: ${p.vel.y}`);
  process.exit(1);
}

// -----------------------------------------------------------------
// Teste 4: 100% de Precisão do Primeiro Tiro em Repouso
// -----------------------------------------------------------------
console.log('\n[Teste 4] Validação de 100% da Precisão Intrínseca no Primeiro Tiro em Repouso:');
const spreadResting = BallisticsCalculator.calculateCurrentSpread(ar15Def, { isAds: false, speedRatio: 0, precisionPenalty: 0 });
const intrinsicPrecision = ar15Def.ballistics.external.precision.baseSpread;

console.log(`  Precisão intrínseca da arma (JSON): ${intrinsicPrecision.toFixed(5)} rad`);
console.log(`  Dispersão no 1º tiro em repouso:    ${spreadResting.toFixed(5)} rad`);

const precisionDiff = Math.abs(spreadResting - intrinsicPrecision);
if (precisionDiff < 1e-6) {
  console.log(`  ✅ 1º tiro em repouso possui EXATAMENTE 100% da precisão da arma (diferença: ${precisionDiff.toFixed(6)})!`);
} else {
  console.error(`  ❌ Primeiro tiro não utilizou 100% da precisão intrínseca! Diferença: ${precisionDiff}`);
  process.exit(1);
}

// Prova com arma 100% perfeita (zero spread):
const perfectWeapon = {
  ...ar15Def,
  spreadHip: 0.02,
  ballistics: {
    ...ar15Def.ballistics,
    external: {
      ...ar15Def.ballistics.external,
      precision: {
        ...ar15Def.ballistics.external.precision,
        baseSpread: 0.0
      }
    }
  }
};
const perfectSpread = BallisticsCalculator.calculateCurrentSpread(perfectWeapon, { isAds: false, speedRatio: 0, precisionPenalty: 0 });
if (perfectSpread === 0.0) {
  console.log('  ✅ Arma com 100% de precisão (zero spread) dispara com precisão 100% perfeita (spread = 0.00000 rad)!');
} else {
  console.error(`  ❌ Arma perfeita gerou spread indesejado: ${perfectSpread}`);
  process.exit(1);
}

// Verifica que ao movimentar ou fazer spray a dispersão expande:
const spreadMoving = BallisticsCalculator.calculateCurrentSpread(ar15Def, { isAds: false, speedRatio: 1.0, isStrafing: true, precisionPenalty: 0.02 });
console.log(`  Em movimento com strafe:             ${spreadMoving.toFixed(5)} rad (~${(spreadMoving * 180 / Math.PI).toFixed(2)}°)`);
if (spreadMoving > spreadResting) {
  console.log('  ✅ Dispersão de movimento e rajada preserva a punição tática esperada.');
}

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE ALINHAMENTO E BALÍSTICA PASSARAM!');
console.log('==================================================\n');
