import assert from 'assert';
import * as THREE from 'three';
import { Player } from '../src/entities/Player.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { CONFIG, ConfigLoader } from '../src/core/ConfigLoader.js';

console.log('==================================================');
console.log('🧪 TESTE DE MOVIMENTAÇÃO - FASE 1 (ESCALA MÉTRICA & DADOS)');
console.log('==================================================\n');

// 1. Carrega dados de configuração para garantir que o gameplay.json foi lido
const loaded = await ConfigLoader.loadAll();
assert.strictEqual(CONFIG.PLAYER.walkSpeed, 4.2, 'walkSpeed deve ser 4.2 m/s');
assert.strictEqual(CONFIG.PLAYER.sprintMul, 1.62, 'sprintMul deve ser 1.62x');
assert.strictEqual(CONFIG.PLAYER.crouchMul, 0.5, 'crouchMul deve ser 0.5x');
assert.strictEqual(CONFIG.PLAYER.adsMul, 0.48, 'adsMul deve ser 0.48x');
assert.strictEqual(CONFIG.PLAYER.stanceRecoveryTime, 0.15, 'stanceRecoveryTime deve ser 0.15s');

console.log('✅ [1] Configuração de dados validada:');
console.log(`  - Walk: ${CONFIG.PLAYER.walkSpeed} m/s`);
console.log(`  - Sprint: ${(CONFIG.PLAYER.walkSpeed * CONFIG.PLAYER.sprintMul).toFixed(2)} m/s (${CONFIG.PLAYER.sprintMul}x)`);
console.log(`  - Crouch: ${(CONFIG.PLAYER.walkSpeed * CONFIG.PLAYER.crouchMul).toFixed(2)} m/s (${CONFIG.PLAYER.crouchMul}x)`);
console.log(`  - ADS: ${(CONFIG.PLAYER.walkSpeed * CONFIG.PLAYER.adsMul).toFixed(2)} m/s (${CONFIG.PLAYER.adsMul}x)`);

// 2. Instancia Player com mock de CollisionWorld
const world = new CollisionWorld(4.0);
world.addBox(0, -0.5, 0, 50, 1, 50);
const player = new Player(world, [-50, 50, -50, 50], [0, 0, 0]);

// Mock de input para testar velocidades alvo
let mockActions = {
  move_forward: true,
  move_back: false,
  move_left: false,
  move_right: false,
  sprint: false,
  crouch: false,
  jump: false,
  lean_left: false,
  lean_right: false
};

const mockInput = {
  actions: mockActions,
  isActionPressed: (action) => !!mockActions[action],
  consumeMouseDelta: () => ({ dx: 0, dy: 0 })
};

const dt = 1 / 60;

// Teste 2.1: Caminhada normal (Walk)
for (let i = 0; i < 60; i++) {
  player.update(dt, mockInput);
}
let speedWalk = Math.hypot(player.vel.x, player.vel.z);
assert(Math.abs(speedWalk - 4.2) < 0.05, `Velocidade de caminhada deve estabilizar em ~4.2 m/s, obtido: ${speedWalk.toFixed(3)}`);
console.log(`✅ [2.1] Caminhada atingiu velocidade alvo: ${speedWalk.toFixed(2)} m/s`);

// Teste 2.2: Corrida (Sprint)
mockActions.sprint = true;
for (let i = 0; i < 60; i++) {
  player.update(dt, mockInput);
}
let speedSprint = Math.hypot(player.vel.x, player.vel.z);
const targetSprint = 4.2 * 1.62; // 6.804 m/s
assert(Math.abs(speedSprint - targetSprint) < 0.05, `Velocidade de sprint deve estabilizar em ~${targetSprint.toFixed(2)} m/s, obtido: ${speedSprint.toFixed(3)}`);
console.log(`✅ [2.2] Sprint atingiu velocidade alvo: ${speedSprint.toFixed(2)} m/s`);

// Teste 2.3: Transição Sprint -> Soltar Shift dispara sprintRecoveryTimer
mockActions.sprint = false;
player.update(dt, mockInput);
assert(player.sprintRecoveryTimer > 0.13, `sprintRecoveryTimer deve iniciar em ~0.15s ao soltar sprint, obtido: ${player.sprintRecoveryTimer}`);
console.log(`✅ [2.3] Cooldown de postura (sprintRecoveryTimer) acionado com sucesso: ${player.sprintRecoveryTimer.toFixed(3)}s`);

// Teste 2.4: Agachado (Crouch) consome crouchMul (0.50x)
mockActions.crouch = true;
for (let i = 0; i < 60; i++) {
  player.update(dt, mockInput);
}
let speedCrouch = Math.hypot(player.vel.x, player.vel.z);
const targetCrouch = 4.2 * 0.50; // 2.10 m/s
assert(Math.abs(speedCrouch - targetCrouch) < 0.05, `Velocidade agachado deve estabilizar em ~${targetCrouch.toFixed(2)} m/s, obtido: ${speedCrouch.toFixed(3)}`);
console.log(`✅ [2.4] Crouch consome crouchMul do JSON: ${speedCrouch.toFixed(2)} m/s`);

// Teste 2.5: Mirando (ADS) consome adsMul (0.48x)
mockActions.crouch = false;
mockActions.ads = true;
player.ads = true;
for (let i = 0; i < 60; i++) {
  player.update(dt, mockInput);
}
let speedAds = Math.hypot(player.vel.x, player.vel.z);
const targetAds = 4.2 * 0.48; // 2.016 m/s
assert(Math.abs(speedAds - targetAds) < 0.05, `Velocidade ADS deve estabilizar em ~${targetAds.toFixed(2)} m/s, obtido: ${speedAds.toFixed(3)}`);
console.log(`✅ [2.5] ADS consome adsMul do JSON: ${speedAds.toFixed(2)} m/s`);

// Teste 2.6: Ausência de código morto de stepTimer
assert.strictEqual(player.stepTimer, undefined, 'stepTimer não deve existir no Player (código morto removido)');
console.log('✅ [2.6] Código morto de passos no fixedUpdate removido com sucesso.');

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DA FASE 1 PASSARAM COM SUCESSO!');
console.log('==================================================');
