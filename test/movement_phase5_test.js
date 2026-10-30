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
const { CollisionWorld } = await import('../src/physics/CollisionWorld.js');
const { NavGrid } = await import('../src/ai/NavGrid.js');
const { Bot } = await import('../src/entities/Bot.js');
const { Player } = await import('../src/entities/Player.js');

console.log('==================================================');
console.log('🤖 TESTE DE MOVIMENTAÇÃO — FASE 5 (IA, INÉRCIA & HUMANIZAÇÃO)');
console.log('==================================================\n');

const dt = 1 / 60;

// -------------------------------------------------------------------
// SUÍTE 1: Normalização de stepHeight no NavGrid e Bot
// -------------------------------------------------------------------
console.log('[Suíte 1] Validando stepHeight = 0.35 no NavGrid e no Bot...');
const world = new CollisionWorld(4.0);
world.addBox(0, -0.5, 0, 50, 1, 50, { material: 'floor' });
const nav = new NavGrid(world);

assert.strictEqual(nav.stepHeight, 0.35, 'NavGrid.stepHeight deve ser normalizado em 0.35');
console.log(`  ✔ NavGrid.stepHeight: ${nav.stepHeight} m`);

const bot = new Bot(1, world, null, 'soldier', 'ar15');
bot.setPosition(0, 0, 0);

// Adiciona degrau de 0.30m (deve subir) e degrau de 0.50m (deve bloquear)
world.addBox(0, 0.30 / 2, 2, 4, 0.30, 2, { material: 'floor' });
world.addBox(10, 0.50 / 2, 2, 4, 0.50, 2, { material: 'floor' });

bot.setPosition(0, 0, 0.5);
bot.vel.set(0, 0, 3.2);

for (let i = 0; i < 30; i++) {
  bot.applyPhysics(dt);
}
assert(bot.pos.y >= 0.28, `Bot deve subir degrau de 0.30m com stepHeight 0.35m, y atual: ${bot.pos.y.toFixed(3)}`);
console.log(`  ✔ Bot subiu suavemente obstáculo de 0.30m (pos.y = ${bot.pos.y.toFixed(2)}m)`);

// Degrau de 0.50m deve bloquear o bot (0.50 > 0.35)
bot.setPosition(10, 0, 0.5);
bot.vel.set(0, 0, 3.2);
for (let i = 0; i < 30; i++) {
  bot.applyPhysics(dt);
}
assert(bot.pos.y < 0.1, `Bot deve ser bloqueado por degrau de 0.50m, y atual: ${bot.pos.y.toFixed(3)}`);
console.log(`  ✔ Degrau de 0.50m bloqueou o avanço do Bot como esperado`);

// -------------------------------------------------------------------
// SUÍTE 2: Curva de Aceleração Suave dos Bots (k_acc = 18.0)
// -------------------------------------------------------------------
console.log('\n[Suíte 2] Validando curva de aceleração suave dos bots (k_acc = 18.0)...');
const accelBot = new Bot(2, world, null, 'soldier', 'ar15');
accelBot.setPosition(10, 0, 10);
accelBot.vel.set(0, 0, 0);

// FSM vazia para isolar a cinemática de aceleração
accelBot.ai.currentState = { name: 'test', update: () => {} };
accelBot.ai.state = 'test';

// Configura intenção de movimento a 3.2 m/s
accelBot.ai.desiredMove.set(3.2, 0, 0);

// Tick 1 (16.6ms)
accelBot.ai.update(dt, { pos: new THREE.Vector3(), alive: false });
const v1 = accelBot.vel.x;
assert(v1 < 3.2, 'Bot NÃO deve estalar instantaneamente para 3.2 m/s no frame 1');
assert(v1 > 0.5, `Bot deve iniciar aceleração com k=18 (~0.96 m/s), obtido: ${v1.toFixed(3)}`);
console.log(`  ✔ Frame 1 (16.6ms): vel = ${v1.toFixed(3)} m/s (aceleração progressiva, sem teleporte)`);

// Tick 5 (~83ms)
for (let i = 0; i < 4; i++) accelBot.ai.update(dt, { pos: new THREE.Vector3(), alive: false });
const v5 = accelBot.vel.x;
assert(v5 > 2.0 && v5 < 3.2, `Velocidade no tick 5 deve estar intermediária (~2.5 m/s), obtido: ${v5.toFixed(3)}`);
console.log(`  ✔ Frame 5 (83.3ms): vel = ${v5.toFixed(3)} m/s`);

// Tick 25 (~416ms): Velocidade deve estar estabilizada
for (let i = 0; i < 20; i++) accelBot.ai.update(dt, { pos: new THREE.Vector3(), alive: false });
const v25 = accelBot.vel.x;
assert(Math.abs(v25 - 3.2) < 0.01, `Velocidade deve estabilizar em 3.2 m/s, obtido: ${v25.toFixed(3)}`);
console.log(`  ✔ Frame 25 (416ms): vel = ${v25.toFixed(3)} m/s (estabilizado)`);

// -------------------------------------------------------------------
// SUÍTE 3: Curva de Frenagem e Inércia ao Parar (k_dec = 26.0)
// -------------------------------------------------------------------
console.log('\n[Suíte 3] Validando frenagem com sangria de momentum (k_dec = 26.0)...');
accelBot.ai.desiredMove.set(0, 0, 0);

// Tick 1 de parada
accelBot.ai.update(dt, { pos: new THREE.Vector3(), alive: false });
const dec1 = accelBot.vel.x;
assert(dec1 < 3.2 && dec1 > 1.0, `Velocidade deve sangrar suavemente no frame 1 de parada, obtido: ${dec1.toFixed(3)}`);
console.log(`  ✔ Frame 1 pós-ordem de parada: vel = ${dec1.toFixed(3)} m/s`);

// 15 frames (~250ms)
for (let i = 0; i < 15; i++) accelBot.ai.update(dt, { pos: new THREE.Vector3(), alive: false });
assert.strictEqual(accelBot.vel.x, 0, 'Bot deve parar completamente em 0.0 sem micro-drift residual');
assert.strictEqual(accelBot.vel.z, 0, 'Bot deve zerar eixo Z');
console.log('  ✔ Bot estabilizou em repouso (0.000 m/s) com frenagem limpa e natural.');

// -------------------------------------------------------------------
// SUÍTE 4: Grace Period do Detector Anti-Stuck (250ms)
// -------------------------------------------------------------------
console.log('\n[Suíte 4] Validando grace period de 250ms no detector anti-stuck...');
const stuckBot = new Bot(3, world, null, 'soldier', 'ar15');
stuckBot.setPosition(0, 0, 0);
stuckBot.ai.currentState = { name: 'test', update: () => {} };
stuckBot.ai.state = 'test';
stuckBot.ai.desiredMove.set(0, 0, 0);

// Atualiza em repouso: motionGraceTimer deve estar em 0.25s
stuckBot.ai.update(dt, { pos: new THREE.Vector3(), alive: false });
assert.strictEqual(stuckBot.ai.motionGraceTimer, 0.25, 'motionGraceTimer deve ser 0.25s quando parado');

// Bot decide arrancar a 3.2 m/s
stuckBot.ai.desiredMove.set(3.2, 0, 0);
stuckBot.ai.stuckCheckTimer = 0.0; // Força janela de verificação

// No primeiro frame em movimento, o bot ainda não se deslocou
stuckBot.ai._updateStuckDetector(dt);
assert.strictEqual(stuckBot.ai.unstickTimer, 0, 'Detector NÃO deve disparar unstick no arranque inicial (grace period)');
assert(stuckBot.ai.motionGraceTimer < 0.25, 'motionGraceTimer deve decrementar durante o arranque');
console.log(`  ✔ Arranque protegido por grace period (tempo restante: ${(stuckBot.ai.motionGraceTimer * 1000).toFixed(0)}ms)`);

// Simula bot travado em parede de fato após expirar os 250ms
for (let i = 0; i < 20; i++) {
  stuckBot.ai.motionGraceTimer = Math.max(0, stuckBot.ai.motionGraceTimer - dt);
}
assert.strictEqual(stuckBot.ai.motionGraceTimer, 0, 'Grace period deve expirar após 250ms');

stuckBot.ai.stuckCheckTimer = 0.0;
stuckBot.ai.lastProgressPos.copy(stuckBot.pos); // Simula 0 deslocamento
stuckBot.ai._updateStuckDetector(dt);

assert(stuckBot.ai.unstickTimer > 0, 'Detector DEVE disparar manobra de desengate quando realmente bloqueado após grace period');
console.log(`  ✔ Unstick disparado com sucesso após bloqueio real (unstickTimer = ${stuckBot.ai.unstickTimer.toFixed(2)}s)`);

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DA FASE 5 PASSARAM COM SUCESSO!');
console.log('==================================================\n');
