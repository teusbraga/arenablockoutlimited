import assert from 'assert';
import * as THREE from 'three';

// Polyfill DOM para testes headless em Node.js
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

const { CONFIG } = await import('../src/core/ConfigLoader.js');
const { CameraRig } = await import('../src/core/CameraRig.js');
const { Player } = await import('../src/entities/Player.js');
const { CollisionWorld } = await import('../src/physics/CollisionWorld.js');
const { LocomotionSmoothingSystem } = await import('../src/new_mechanics/LocomotionSmoothingSystem.js');

console.log('==================================================');
console.log('🎥 TESTE DE MOVIMENTAÇÃO — FASE 4 (CAMERARIG, LANDING & VIEWMODEL)');
console.log('==================================================\n');

// -------------------------------------------------------------------
// SUÍTE 1: Configuração e Dados de Landing Dip
// -------------------------------------------------------------------
console.log('[Suíte 1] Validando dados de configuração (landingDipScale)...');
assert.strictEqual(typeof CONFIG.PLAYER.landingDipScale, 'number', 'landingDipScale deve ser número');
assert(CONFIG.PLAYER.landingDipScale > 0, 'landingDipScale deve ser maior que zero');
console.log(`  ✔ CONFIG.PLAYER.landingDipScale = ${CONFIG.PLAYER.landingDipScale}`);

// -------------------------------------------------------------------
// SUÍTE 2: CameraRig.reset(spawnYaw) e Orientação no Respawn
// -------------------------------------------------------------------
console.log('\n[Suíte 2] Validando CameraRig.reset(spawnYaw) e preservação de ângulo de spawn...');
const rig = new CameraRig();
rig.setOrientation(0.5, 0.2);
rig.flinchPitch = 0.1;
rig.landingDip = -0.05;

// Reseta com spawnYaw de 1.57 radianos (~90 graus)
rig.reset(1.57);
assert.strictEqual(rig.currentYaw, 1.57, 'reset(spawnYaw) deve definir currentYaw com precisão');
assert.strictEqual(rig.targetYaw, 1.57, 'reset(spawnYaw) deve definir targetYaw com precisão');
assert.strictEqual(rig.targetPitch, 0, 'targetPitch deve ser zerado no reset');
assert.strictEqual(rig.flinchPitch, 0, 'flinchPitch deve ser zerado');
assert.strictEqual(rig.landingDip, 0, 'landingDip deve ser zerado no reset');
assert.strictEqual(rig.landingDipVel, 0, 'landingDipVel deve ser zerada no reset');

// Reseta sem argumento -> default 0
rig.reset();
assert.strictEqual(rig.currentYaw, 0, 'reset() sem argumentos deve defaultar para yaw 0');
assert.strictEqual(rig.targetYaw, 0, 'reset() sem argumentos deve defaultar para targetYaw 0');
console.log('  ✔ CameraRig.reset(spawnYaw) respeita o ângulo passado e zera impulsos cinéticos.');

// -------------------------------------------------------------------
// SUÍTE 3: Player Inicialização de Yaw e Respawn
// -------------------------------------------------------------------
console.log('\n[Suíte 3] Validando orientação inicial e respawn do Player com spawnYaw...');
const mockWorld = new CollisionWorld(4.0);
const player = new Player(mockWorld, [-50, 50, -50, 50], [5, 0.1, 10, 2.35]);

assert.strictEqual(player.spawnYaw, 2.35, 'player.spawnYaw deve ser extraído do quarto elemento de spawnPos');
assert.strictEqual(player.rig.currentYaw, 2.35, 'player.rig inicial deve iniciar com spawnYaw');

// Simula rotação de câmera durante o jogo
player.rig.targetYaw = 0.5;
player.rig.currentYaw = 0.5;

// Dispara respawn do jogador
player.respawn();
assert.strictEqual(player.rig.currentYaw, 2.35, 'player.respawn() deve resetar a câmera para player.spawnYaw');
assert.strictEqual(player.rig.targetYaw, 2.35, 'player.respawn() deve resetar targetYaw para player.spawnYaw');
console.log('  ✔ Player preserva spawnYaw e restaura orientação correta ao renascer.');

// -------------------------------------------------------------------
// SUÍTE 4: Mola de Landing Dip na CameraRig
// -------------------------------------------------------------------
console.log('\n[Suíte 4] Validando mola e amortecimento do landingDip (k=280, d=26)...');
const testRig = new CameraRig();
const dummyPlayer = {
  alive: true,
  onGround: true,
  crouchAmount: 0,
  vel: new THREE.Vector3(0, 0, 0),
  renderPos: new THREE.Vector3(0, 0, 0),
  lean: 0
};

// Dispara impacto com velocidade vertical de -6 m/s (pulo padrão)
testRig.triggerLandingDip(-6.0);
assert(testRig.landingDipVel < 0, `landingDipVel deve ser negativa no impacto, obtido: ${testRig.landingDipVel}`);

// Avança 2 frames a 60 FPS (~33ms)
testRig.update(1 / 60, dummyPlayer);
testRig.update(1 / 60, dummyPlayer);

assert(testRig.landingDip < 0, `landingDip deve flexionar a câmera para baixo (<0), obtido: ${testRig.landingDip}`);
assert(testRig.landingDip > -0.15, `landingDip não deve ultrapassar 15cm de flexão, obtido: ${testRig.landingDip}`);
console.log(`  ✔ Flexão vertical máxima registrada: ${(Math.abs(testRig.landingDip) * 100).toFixed(2)} cm`);

// Simula recuperação completa da mola ao longo de 40 frames (~0.66s)
for (let i = 0; i < 40; i++) {
  testRig.update(1 / 60, dummyPlayer);
}

assert.strictEqual(testRig.landingDip, 0, 'landingDip deve estabilizar perfeitamente em 0 sem resíduo');
assert.strictEqual(testRig.landingDipVel, 0, 'landingDipVel deve estabilizar em 0');
console.log('  ✔ Mola de pouso amortecida estabiliza sem oscilação perpétua ou travamento.');

// -------------------------------------------------------------------
// SUÍTE 5: Integração Física Queda Livre -> Ativação Automática de Landing Dip
// -------------------------------------------------------------------
console.log('\n[Suíte 5] Validando ativação automática do Landing Dip ao tocar o solo após queda...');
const worldWithFloor = new CollisionWorld(4.0);
// Chão em y=0: centro (0, 0, 0), tamanho (20, 0.2, 20)
worldWithFloor.addBox(0, 0, 0, 20, 0.2, 20);

const fallingPlayer = new Player(worldWithFloor, [-10, 10, -10, 10], [0, 4.0, 0]);
fallingPlayer.onGround = false;

const noInput = { actions: {}, consumeAction: () => false, consumeMouseDelta: () => ({ dx: 0, dy: 0 }) };

// Cai sob gravidade por vários ticks até tocar o chão
let landed = false;
for (let i = 0; i < 60; i++) {
  fallingPlayer.update(1 / 60, noInput);
  if (fallingPlayer.onGround) {
    landed = true;
    break;
  }
}

assert(landed, 'Jogador deve ter tocado o chão após queda');
assert(fallingPlayer.rig.landingDip < 0 || fallingPlayer.rig.landingDipVel < 0, 'Landing dip deve ser acionado na aterrissagem de queda');
console.log('  ✔ Landing Dip acionado organicamente via detecção de impacto no Player.');

// -------------------------------------------------------------------
// SUÍTE 6: Sincronização de Fase 1:1 CameraRig <-> LocomotionSmoothingSystem
// -------------------------------------------------------------------
console.log('\n[Suíte 6] Validando sincronismo de fase entre CameraRig e LocomotionSmoothingSystem...');
const syncRig = new CameraRig();
const loco = new LocomotionSmoothingSystem();

// Simula movimento do player no CameraRig para avançar a fase
const movingPlayer = {
  alive: true,
  onGround: true,
  crouchAmount: 0,
  vel: new THREE.Vector3(0, 0, 4.2),
  renderPos: new THREE.Vector3(0, 0, 0),
  lean: 0,
  sprinting: false
};

// Executa 10 frames de locomoção
for (let i = 0; i < 10; i++) {
  syncRig.update(1 / 60, movingPlayer);
}

assert(syncRig.currentBobPhase > 0, 'syncRig.currentBobPhase deve avançar com a locomoção');
assert.strictEqual(syncRig.currentBobPhase, syncRig.bobPhase, 'getter currentBobPhase deve expor bobPhase diretamente');

// Atualiza o LocomotionSmoothingSystem passando o syncRig
loco.update(1 / 60, {
  speedXZ: 4.2,
  isSprinting: false,
  rig: syncRig
});

assert.strictEqual(loco.bobPhase, syncRig.currentBobPhase, 'loco.bobPhase deve estar em trava de fase 1:1 com o CameraRig');

// Testa fallback autônomo quando rig não é fornecido
const autonomousLoco = new LocomotionSmoothingSystem();
autonomousLoco.update(1 / 60, { speedXZ: 4.2, isSprinting: false });
assert(autonomousLoco.bobPhase > 0, 'Sem rig, LocomotionSmoothingSystem deve avançar fase autonomamente');
console.log('  ✔ Sincronização 1:1 de fase validada com sucesso, mantendo fallback autônomo intacto.');

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DA FASE 4 PASSARAM COM SUCESSO!');
console.log('==================================================\n');
