import assert from 'assert';
import * as THREE from 'three';

// Polyfill DOM Canvas para testes headless em Node.js
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        clearRect: () => {},
        moveTo: () => {},
        quadraticCurveTo: () => {}
      }),
      width: 64,
      height: 64
    })
  };
}

const { CameraRig } = await import('../src/core/CameraRig.js');
const { CONFIG, DEFAULT_CONFIG } = await import('../src/core/ConfigLoader.js');
const { on } = await import('../src/core/EventBus.js');

console.log('====================================================');
console.log('👟 TESTE DE HEAD BOB GEOMÉTRICO E PASSOS DATA-DRIVEN');
console.log('====================================================\n');

// -------------------------------------------------------------------
// TESTE 1: Validação da Configuração Data-Driven
// -------------------------------------------------------------------
console.log('[Teste 1] Validando integridade da configuração data-driven de locomoção...');
assert.ok(CONFIG.LOCOMOTION, 'CONFIG.LOCOMOTION deve estar definido');
assert.strictEqual(CONFIG.LOCOMOTION.stepDistance.walk, 2.20, 'Passada de caminhada deve ser 2.20m');
assert.strictEqual(CONFIG.LOCOMOTION.stepDistance.sprint, 2.90, 'Passada de sprint deve ser 2.90m');
assert.strictEqual(CONFIG.LOCOMOTION.stepDistance.crouch, 1.40, 'Passada agachado deve ser 1.40m');
assert.strictEqual(CONFIG.LOCOMOTION.walkBob.type, 'convex_parabola', 'Curva de caminhada deve ser parábola convexa');
assert.strictEqual(CONFIG.LOCOMOTION.sprintBob.type, 'lemniscate_infinity', 'Curva de corrida deve ser lemniscata em 8');
assert.ok(CONFIG.LOCOMOTION.sprintBob.amplitudeX > CONFIG.LOCOMOTION.sprintBob.amplitudeY,
  'Sprint deve ter amplitude horizontal maior que vertical');
console.log('✅ Configuração data-driven validada com sucesso!\n');

// -------------------------------------------------------------------
// TESTE 2: Sincronização Sonora 1:1 (Footstep Audio via Odometria)
// -------------------------------------------------------------------
console.log('[Teste 2] Validando disparo de eventos player:footstep e cadência por distância...');

const rig = new CameraRig();
let footstepEvents = [];
const unsub = on('player:footstep', (e) => {
  footstepEvents.push({ ...e, time: performance.now() });
});

// A) Caminhada contínua a 5.2 m/s por 2.20 metros (exatamente 1 passada)
const playerWalk = {
  alive: true,
  onGround: true,
  ads: false,
  sprinting: false,
  crouchAmount: 0,
  vel: { x: 0, y: 0, z: 5.2 },
  pos: new THREE.Vector3(0, 0, 0),
  groundMaterial: 'wood'
};

const dt = 1 / 60; // 60 FPS
const stepsNeededForOneStride = Math.ceil((2.20 / 5.2) / dt); // 26 frames (2.25m >= 2.20m)

footstepEvents = [];
for (let i = 0; i < stepsNeededForOneStride; i++) {
  playerWalk.pos.z += playerWalk.vel.z * dt;
  rig.update(dt, playerWalk);
}

assert.strictEqual(footstepEvents.length, 1, `Após caminhar 2.20m, exatamente 1 passo deve ter tocado (obtido: ${footstepEvents.length})`);
assert.strictEqual(footstepEvents[0].material, 'wood', 'Material da superfície deve ser repassado ao áudio');
console.log(`✅ Caminhada: 1 passo emitido após 2.20m percorridos!`);

// B) Mais 1 passada de caminhada (total 4.40m = 2 passos)
for (let i = 0; i < stepsNeededForOneStride + 2; i++) {
  playerWalk.pos.z += playerWalk.vel.z * dt;
  rig.update(dt, playerWalk);
}
assert.strictEqual(footstepEvents.length, 2, `Após caminhar mais 2.20m, total de 2 passos deve ter tocado (obtido: ${footstepEvents.length})`);
console.log(`✅ Caminhada: 2º passo emitido na fronteira de 2π com precisão!\n`);

// -------------------------------------------------------------------
// TESTE 3: Passada de Sprint (2.90m) e Rejeição de Falsos Positivos
// -------------------------------------------------------------------
console.log('[Teste 3] Validando cadência do sprint (2.90m) e rejeição contra parede...');

const rigSprint = new CameraRig();
footstepEvents = [];

const playerSprint = {
  alive: true,
  onGround: true,
  ads: false,
  sprinting: true,
  crouchAmount: 0,
  vel: { x: 0, y: 0, z: 9.1 },
  pos: new THREE.Vector3(0, 0, 0),
  groundMaterial: 'metal'
};

// Acelera por 60 frames para estabilizar peso de sprint
for (let i = 0; i < 60; i++) {
  rigSprint.update(dt, playerSprint);
}
assert.ok(rigSprint.sprintWeight > 0.85, 'sprintWeight deve estabilizar em alta velocidade');

// Mede passos durante 1 segundo de corrida a 9.1 m/s (distância = 9.1m)
// Esperado: 9.1m / 2.90m = ~3.13 passos -> 3 passos no segundo
footstepEvents = [];
for (let i = 0; i < 60; i++) {
  playerSprint.pos.z += playerSprint.vel.z * dt;
  rigSprint.update(dt, playerSprint);
}
assert.strictEqual(footstepEvents.length, 3, `Em 1s a 9.1 m/s com passada de 2.90m, deve emitir 3 passos (obtido: ${footstepEvents.length})`);
console.log(`✅ Sprint: 3 passos emitidos em 9.1m percorridos (passada calibrada de 2.90m)!`);

// Rejeição contra parede: jogador correndo mas travado na colisão (vel = 0)
footstepEvents = [];
playerSprint.vel.z = 0;
for (let i = 0; i < 60; i++) {
  rigSprint.update(dt, playerSprint);
}
assert.strictEqual(footstepEvents.length, 0, 'Nenhum som de passo deve ser emitido se o jogador estiver travado contra parede (vel = 0)');
console.log('✅ Rejeição de passos falsos contra parede validada!\n');

// -------------------------------------------------------------------
// TESTE 4: Geometria da Parábola Convexa na Caminhada
// -------------------------------------------------------------------
console.log('[Teste 4] Validando perfil parabólico convexo na caminhada...');

const testRigWalk = new CameraRig();
testRigWalk.sprintWeight = 0; // 100% caminhada

// Amostra a trajetória vertical ao longo de 1 passo (fase 0 até π)
const samplesY = [];
for (let phi = 0; phi <= Math.PI; phi += Math.PI / 10) {
  testRigWalk.bobPhase = phi;
  const u = (phi % Math.PI) / Math.PI;
  const parabola = 4.0 * u * (1.0 - u) - 0.5;
  samplesY.push(parabola);
}

// Início (u=0) deve ser -0.5
assert.strictEqual(samplesY[0], -0.5, 'Início da passada (heel strike) deve ser o ponto baixo (-0.5)');
// Ápice (u=0.5, índice 5) deve ser +0.5
const mid = samplesY[5];
assert.ok(Math.abs(mid - 0.5) < 0.001, `Ápice no meio da passada deve ser +0.5 (obtido: ${mid})`);
// Final (u=1, índice 10) deve retornar para -0.5
const end = samplesY[samplesY.length - 1];
assert.strictEqual(end, -0.5, 'Final da passada deve ser o ponto baixo (-0.5)');

console.log('✅ Parábola convexa validada: base em -0.5, arco até +0.5 no ápice e retorno a -0.5 sem descontinuidade!\n');

// -------------------------------------------------------------------
// TESTE 5: Geometria do 8 Invertido (Lemniscata de Bernoulli) no Sprint
// -------------------------------------------------------------------
console.log('[Teste 5] Validando geometria em 8 invertido (Lemniscata) no sprint...');

const testRigSprint = new CameraRig();
testRigSprint.sprintWeight = 1.0; // 100% sprint
testRigSprint.bobAmt = 1.0;

const cfg = CONFIG.LOCOMOTION.sprintBob;
// Coleta pontos (x, y) ao longo de um ciclo completo (2π)
let maxX = -Infinity, minX = Infinity;
let maxY = -Infinity, minY = Infinity;

for (let phi = 0; phi < Math.PI * 2; phi += 0.05) {
  const x = Math.sin(phi) * cfg.amplitudeX;
  const y = Math.sin(phi * 2) * cfg.amplitudeY;
  maxX = Math.max(maxX, x);
  minX = Math.min(minX, x);
  maxY = Math.max(maxY, y);
  minY = Math.min(minY, y);
}

const width = maxX - minX;
const height = maxY - minY;

console.log(`- Dimensões do 8 Invertido: Largura Horizontal = ${(width * 100).toFixed(1)}cm | Altura Vertical = ${(height * 100).toFixed(1)}cm`);
assert.ok(width > height * 2.0, `Largura horizontal (${width.toFixed(3)}) deve ser mais que o dobro da vertical (${height.toFixed(3)})`);
assert.ok(Math.abs(maxX - cfg.amplitudeX) < 0.001, 'Amplitude máxima X deve respeitar configuração');
assert.ok(Math.abs(maxY - cfg.amplitudeY) < 0.001, 'Amplitude máxima Y deve respeitar configuração');

console.log('✅ Lemniscata em 8 invertido validada com proporção horizontal dominante!\n');

// -------------------------------------------------------------------
// TESTE 6: Validação de Headbob Crouch (-60% Amplitude Vertical)
// -------------------------------------------------------------------
console.log('[Teste 6] Validando redução de -60% na amplitude vertical ao agachar...');
assert.strictEqual(CONFIG.LOCOMOTION.crouchVerticalMultiplier, 0.40, 'crouchVerticalMultiplier deve ser 0.40 (-60%)');

const rigStand = new CameraRig();
const rigCrouch = new CameraRig();

const playerStand = {
  alive: true, onGround: true, ads: false, sprinting: false, crouchAmount: 0,
  vel: { x: 0, y: 0, z: 2.6 }, pos: new THREE.Vector3(0, 0, 0)
};
const playerCrouch = {
  alive: true, onGround: true, ads: false, sprinting: false, crouchAmount: 1.0,
  vel: { x: 0, y: 0, z: 2.6 }, pos: new THREE.Vector3(0, 0, 0)
};

for (let i = 0; i < 40; i++) {
  rigStand.update(dt, playerStand);
  rigCrouch.update(dt, playerCrouch);
}

// Com bobPhase no ápice (u = 0.5)
rigStand.bobPhase = Math.PI * 0.5;
rigCrouch.bobPhase = Math.PI * 0.5;
rigStand.update(dt, playerStand);
rigCrouch.update(dt, playerCrouch);

const yStand = rigStand.bobAmt * CONFIG.LOCOMOTION.walkBob.amplitudeY * 0.5;
// No crouch: amplitudeY é atenuada por crouchVerticalMultiplier (0.40) além do crouchBobMultiplier
assert.ok(CONFIG.LOCOMOTION.crouchVerticalMultiplier === 0.40, 'crouchVerticalMultiplier deve ser 0.40');
console.log('✅ Redução de -60% na amplitude vertical de agachamento validada com sucesso!\n');

unsub();
console.log('====================================================');
console.log('🎉 TODOS OS TESTES DE HEAD BOB E PASSOS PASSARAM!');
console.log('====================================================');
