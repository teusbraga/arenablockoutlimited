import assert from 'assert';
import * as THREE from 'three';

// Polyfill DOM Canvas para testes headless em Node.js (necessário antes de importar modelos com canvas texture)
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({
      getContext: () => new Proxy({
        canvas: { width: 64, height: 64 }
      }, {
        get: (target, prop) => {
          if (prop in target) return target[prop];
          return () => ({ addColorStop: () => {} });
        }
      }),
      width: 64,
      height: 64
    })
  };
}

const { LocomotionSmoothingSystem } = await import('../src/new_mechanics/LocomotionSmoothingSystem.js');
const { Viewmodel } = await import('../src/weapons/Viewmodel.js');
const { CameraRig } = await import('../src/core/CameraRig.js');
const { CONFIG } = await import('../src/core/ConfigLoader.js');

console.log('==================================================');
console.log('🏃 TESTE DE SUAVIZAÇÃO DE ANIMAÇÕES & LOCOMOÇÃO');
console.log('==================================================\n');

// -------------------------------------------------------------------
// TESTE 1: Continuidade Matemática de Fase e Pesos de Estado
// -------------------------------------------------------------------
console.log('[Teste 1] Validando continuidade de fase e pesos (Idle -> Walk -> Sprint -> Stop)...');

const loco = new LocomotionSmoothingSystem();
const dt = 1 / 60; // 60 FPS
let maxPhaseDelta = 0;
let prevPhase = loco.bobPhase;

// Fase A: Idle por 1 segundo
for (let i = 0; i < 60; i++) {
  loco.update(dt, { speedXZ: 0, isSprinting: false, isADS: false });
  assert(loco.idleWeight > 0.8, 'idleWeight deve dominar no repouso');
}

// Fase B: Transição para Walk (aceleração para 5.2 m/s)
for (let i = 0; i < 60; i++) {
  loco.update(dt, { speedXZ: 5.2, isSprinting: false, isADS: false });
  let dPhase = loco.bobPhase - prevPhase;
  if (dPhase < -Math.PI) dPhase += Math.PI * 2;
  maxPhaseDelta = Math.max(maxPhaseDelta, Math.abs(dPhase));
  prevPhase = loco.bobPhase;
}
assert(loco.walkWeight > 0.7, 'walkWeight deve dominar na caminhada');
assert(maxPhaseDelta < 0.25, `Delta de fase máximo por frame deve ser suave (<0.25 rad), obtido: ${maxPhaseDelta}`);

// Fase C: Transição brusca para Sprint (tecla Shift pressionada)
for (let i = 0; i < 60; i++) {
  loco.update(dt, { speedXZ: 9.1, isSprinting: true, isADS: false });
  let dPhase = loco.bobPhase - prevPhase;
  if (dPhase < -Math.PI) dPhase += Math.PI * 2;
  maxPhaseDelta = Math.max(maxPhaseDelta, Math.abs(dPhase));
  prevPhase = loco.bobPhase;
}
assert(loco.sprintWeight > 0.7, 'sprintWeight deve dominar na corrida');
assert(maxPhaseDelta < 0.25, `Delta de fase no sprint não pode saltar descontinuamente, obtido: ${maxPhaseDelta}`);

// Fase D: Parada Abrupta (soltou todas as teclas WASD)
let maxBobAmpDelta = 0;
let prevBobAmp = loco.bobAmount;
for (let i = 0; i < 60; i++) {
  loco.update(dt, { speedXZ: 0, isSprinting: false, isADS: false });
  const dAmp = Math.abs(loco.bobAmount - prevBobAmp);
  maxBobAmpDelta = Math.max(maxBobAmpDelta, dAmp);
  prevBobAmp = loco.bobAmount;
}
assert(loco.idleWeight > 0.8, 'idleWeight deve retornar ao repouso após parada');
assert(maxBobAmpDelta < 0.005, `Decaimento de amplitude deve ser suave sem degrau, max dAmp: ${maxBobAmpDelta}`);

console.log('✅ Continuidade de fase e pesos validada! Max delta phase:', maxPhaseDelta.toFixed(4), 'rad/frame');

// -------------------------------------------------------------------
// TESTE 2: Viewmodel Pose Multi-Blending e Ausência de Teleporte
// -------------------------------------------------------------------
console.log('\n[Teste 2] Validando Viewmodel Multi-Pose Blending e derivada contínua...');

const dummyCam = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
const vm = new Viewmodel(dummyCam);

// Mock básico para WEAPONS['ar15']
const weaponDef = {
  weight: 3.4,
  hipPos: [0.14, -0.15, -0.3],
  hipRot: [0, 0, 0],
  adsRot: [0, 0, 0],
  sprintPos: [0.22, -0.26, -0.32],
  sprintRot: [0.62, -0.45, 0.2],
  sightLocal: [0, 0.076, -0.26]
};

// Posição inicial no hipfire
vm.updatePose(dt, 'ar15', { isADS: false, isSprinting: false, adsAmount: 0 });

let maxMountDelta = 0;
let prevMountX = vm.mount.position.x;
let prevMountY = vm.mount.position.y;
let prevMountZ = vm.mount.position.z;

// Alterna repetidamente entre Sprint e Hipfire simulando "tapping" de Shift
for (let cycle = 0; cycle < 5; cycle++) {
  const isSprint = cycle % 2 === 1;
  for (let frame = 0; frame < 30; frame++) {
    const dummyRig = { angularVelocity: { x: 0, y: 0 } };
    const pVel = isSprint ? { x: 0, z: -8.0 } : { x: 0, z: -4.0 };
    
    vm.applySwayFromRig(dummyRig, dt, false, isSprint, pVel, weaponDef);
    vm.updatePose(dt, 'ar15', { isADS: false, isSprinting: isSprint, adsAmount: 0 });

    const dx = Math.abs(vm.mount.position.x - prevMountX);
    const dy = Math.abs(vm.mount.position.y - prevMountY);
    const dz = Math.abs(vm.mount.position.z - prevMountZ);
    maxMountDelta = Math.max(maxMountDelta, dx, dy, dz);

    prevMountX = vm.mount.position.x;
    prevMountY = vm.mount.position.y;
    prevMountZ = vm.mount.position.z;
  }
}

// O deslocamento máximo por frame nunca pode ser um teleporte
assert(maxMountDelta < 0.02, `Deslocamento da arma por frame não pode ser brusco (<0.02m), obtido: ${maxMountDelta}`);
console.log('✅ Viewmodel pose blending validado com sucesso! Max delta pos:', maxMountDelta.toFixed(4), 'm/frame');

// -------------------------------------------------------------------
// TESTE 3: Estabilidade do Headbob da Câmera e Atenuação no ADS
// -------------------------------------------------------------------
console.log('\n[Teste 3] Validando atenuação do Headbob no ADS e decaimento sem freeze no CameraRig...');

const rig = new CameraRig();
const mockPlayerHip = {
  alive: true,
  onGround: true,
  ads: false,
  sprinting: false,
  crouchAmount: 0,
  vel: { x: 0, y: 0, z: 4.5 },
  renderPos: { x: 0, y: 0, z: 0 }
};

for (let i = 0; i < 40; i++) {
  rig.update(dt, mockPlayerHip);
}
const hipBobAmt = rig.bobAmt;

const mockPlayerAds = {
  alive: true,
  onGround: true,
  ads: true,
  sprinting: false,
  crouchAmount: 0,
  vel: { x: 0, y: 0, z: 4.5 },
  renderPos: { x: 0, y: 0, z: 0 }
};

for (let i = 0; i < 60; i++) {
  rig.update(dt, mockPlayerAds);
}
const adsBobAmt = rig.bobAmt;

assert(adsBobAmt < hipBobAmt * 0.35, `ADS deve atenuar o headbob da câmera (>65%), Hip: ${hipBobAmt.toFixed(4)}, ADS: ${adsBobAmt.toFixed(4)}`);
console.log(`✅ Headbob no ADS atenuado com perfeição! (Hip: ${hipBobAmt.toFixed(4)} -> ADS: ${adsBobAmt.toFixed(4)})`);

// Teste de parada sem freeze:
mockPlayerAds.vel.z = 0;
for (let i = 0; i < 60; i++) {
  rig.update(dt, mockPlayerAds);
}
assert(rig.bobAmt < 0.005, 'Headbob deve decair para zero ao parar');
console.log('✅ Decaimento suave de parada concluído com sucesso!');

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE SUAVIZAÇÃO DE ANIMAÇÕES PASSARAM!');
console.log('==================================================');
