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

const { CONFIG, ConfigLoader } = await import('../src/core/ConfigLoader.js');
const { Player } = await import('../src/entities/Player.js');
const { CollisionWorld } = await import('../src/physics/CollisionWorld.js');

console.log('==================================================');
console.log('🎯 TESTE DE VELOCIDADES DIRECIONAIS E ANTI SPRINT DE COSTAS');
console.log('==================================================\n');

await ConfigLoader.loadAll();

const dt = 1 / 60;

function simulate(actionMap, ticks = 60) {
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 100, 1, 100);
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 0]);
  player.update(dt, { actions: {}, consumeAction: () => false, consumeMouseDelta: () => ({ dx: 0, dy: 0 }) });

  const input = {
    isActionPressed: (act) => !!actionMap[act],
    consumeAction: () => false,
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  for (let i = 0; i < ticks; i++) {
    player.update(dt, input);
  }
  return {
    dist: Math.hypot(player.pos.x, player.pos.z),
    speed: Math.hypot(player.vel.x, player.vel.z),
    sprinting: player.sprinting
  };
}

// 1. Configuração data-driven
console.log('[1] Validando dados de configuração direcionais...');
assert.strictEqual(CONFIG.PLAYER.strafeMul, 0.85, 'strafeMul deve ser 0.85');
assert.strictEqual(CONFIG.PLAYER.backwardMul, 0.75, 'backwardMul deve ser 0.75');
console.log('  ✔ strafeMul = 0.85, backwardMul = 0.75');

// 2. Caminhada Direcional
console.log('\n[2] Validando velocidades de caminhada direcional...');
const fwd = simulate({ move_forward: true });
assert(Math.abs(fwd.speed - 4.20) < 0.05, `Forward deve ser ~4.20 m/s, obtido: ${fwd.speed.toFixed(3)}`);
console.log(`  ✔ Forward (W): ${fwd.speed.toFixed(3)} m/s (100% da base)`);

const back = simulate({ move_back: true });
assert(Math.abs(back.speed - 3.15) < 0.05, `Backward deve ser ~3.15 m/s (0.75x), obtido: ${back.speed.toFixed(3)}`);
console.log(`  ✔ Backward (S): ${back.speed.toFixed(3)} m/s (75% da base)`);

const strafe = simulate({ move_right: true });
assert(Math.abs(strafe.speed - 3.57) < 0.05, `Strafe deve ser ~3.57 m/s (0.85x), obtido: ${strafe.speed.toFixed(3)}`);
console.log(`  ✔ Strafe (D): ${strafe.speed.toFixed(3)} m/s (85% da base)`);

// 3. Proibição de Sprint de Costas e Strafe Puro
console.log('\n[3] Validando bloqueio estrito de sprint para trás e lateral...');
const backSprint = simulate({ move_back: true, sprint: true });
assert.strictEqual(backSprint.sprinting, false, 'Sprint deve ser bloqueado ao se mover para trás');
assert(Math.abs(backSprint.speed - 3.15) < 0.05, `Velocidade com S + Shift deve permanecer ~3.15 m/s, obtido: ${backSprint.speed.toFixed(3)}`);
console.log(`  ✔ S + Shift: sprint bloqueado, velocidade contida em ${backSprint.speed.toFixed(3)} m/s`);

const strafeSprint = simulate({ move_left: true, sprint: true });
assert.strictEqual(strafeSprint.sprinting, false, 'Sprint deve ser bloqueado em strafe puro');
assert(Math.abs(strafeSprint.speed - 3.57) < 0.05, `Velocidade com A + Shift deve permanecer ~3.57 m/s, obtido: ${strafeSprint.speed.toFixed(3)}`);
console.log(`  ✔ A + Shift: sprint bloqueado, velocidade contida em ${strafeSprint.speed.toFixed(3)} m/s`);

// 4. Sprint Frontal e Diagonais
console.log('\n[4] Validando sprint frontal e diagonais...');
const fwdSprint = simulate({ move_forward: true, sprint: true });
assert.strictEqual(fwdSprint.sprinting, true, 'Sprint frontal deve ser permitido');
assert(Math.abs(fwdSprint.speed - 6.804) < 0.05, `Sprint frontal deve ser ~6.80 m/s, obtido: ${fwdSprint.speed.toFixed(3)}`);
console.log(`  ✔ W + Shift: sprint ativo a ${fwdSprint.speed.toFixed(3)} m/s`);

const diagSprint = simulate({ move_forward: true, move_right: true, sprint: true });
assert.strictEqual(diagSprint.sprinting, true, 'Sprint diagonal frontal deve ser permitido');
assert(diagSprint.speed < fwdSprint.speed, 'Sprint diagonal frontal não deve ser mais rápido que o frontal puro');
console.log(`  ✔ W + D + Shift: sprint ativo a ${diagSprint.speed.toFixed(3)} m/s (< frontal puro)`);

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DIRECIONAIS PASSARAM COM SUCESSO!');
console.log('==================================================\n');
