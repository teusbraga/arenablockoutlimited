import assert from 'assert';
import { Player } from '../src/entities/Player.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { CONFIG, ConfigLoader } from '../src/core/ConfigLoader.js';

console.log('==================================================');
console.log('🧪 TESTE DE MOVIMENTAÇÃO - FASE 2 (PULO, COYOTE, BUFFER & DEGHAUS)');
console.log('==================================================\n');

// 1. Validação de dados carregados
await ConfigLoader.loadAll();
assert.strictEqual(CONFIG.PLAYER.jumpSpeed, 6.0, 'jumpSpeed deve ser 6.0 m/s');
assert.strictEqual(CONFIG.PLAYER.stepHeight, 0.35, 'stepHeight deve ser 0.35 m');
assert.strictEqual(CONFIG.PLAYER.coyoteTime, 0.12, 'coyoteTime deve ser 0.12 s');
assert.strictEqual(CONFIG.PLAYER.jumpBuffer, 0.12, 'jumpBuffer deve ser 0.12 s');

console.log('✅ [1] Configuração de dados de pulo e degrau validada:');
console.log(`  - jumpSpeed: ${CONFIG.PLAYER.jumpSpeed} m/s`);
console.log(`  - stepHeight: ${CONFIG.PLAYER.stepHeight} m`);
console.log(`  - coyoteTime: ${CONFIG.PLAYER.coyoteTime} s`);
console.log(`  - jumpBuffer: ${CONFIG.PLAYER.jumpBuffer} s`);

const dt = 1 / 60;

// 2. Validação da Altura Máxima do Salto (Apex = 0.90m)
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50);
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 0]);

  const noInput = { actions: {}, consumeAction: () => false, consumeMouseDelta: () => ({ dx: 0, dy: 0 }) };

  // Deixa o player assentar no chão (1 tick)
  player.update(dt, noInput);
  assert(player.onGround, 'Player deve assentar no chão no primeiro tick');

  // Força pulo
  const mockInputJump = {
    actions: { jump: true },
    consumeAction: (act) => act === 'jump',
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  player.update(dt, mockInputJump);
  assert(player.vel.y > 5.0, `Pulo deve iniciar com vel.y > 5.0 (6.0 - gravidade*dt), obtido: ${player.vel.y}`);
  let maxY = 0;
  for (let i = 0; i < 40; i++) {
    player.update(dt, noInput);
    if (player.pos.y > maxY) maxY = player.pos.y;
  }

  // Altura esperada teórica: v^2 / 2g = 36 / 40 = 0.90 m
  assert(Math.abs(maxY - 0.90) < 0.05, `Apex do pulo deve atingir ~0.90m, obtido: ${maxY.toFixed(3)}m`);
  console.log(`✅ [2] Arco e Altura do Pulo validado: Apex em ${maxY.toFixed(3)}m (esperado ~0.90m)`);
}

// 3. Validação do Step-Up Físico com stepHeight = 0.35m
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 100, 1, 100);

  // Adiciona degraus de teste: 0.15m, 0.30m, 0.35m, 0.45m, 0.60m
  // Convenção: y + h/2 para centralizar no AABB
  world.addBox(0, 0.15 / 2, 10, 4, 0.15, 2); // Degrau 0.15m
  world.addBox(5, 0.30 / 2, 10, 4, 0.30, 2); // Degrau 0.30m
  world.addBox(10, 0.35 / 2, 10, 4, 0.35, 2); // Degrau 0.35m
  world.addBox(15, 0.45 / 2, 10, 4, 0.45, 2); // Degrau 0.45m
  world.addBox(20, 0.60 / 2, 10, 4, 0.60, 2); // Degrau 0.60m

  const playerSize = { x: 0.6, y: 1.8, z: 0.6 };
  const stepHeight = CONFIG.PLAYER.stepHeight; // 0.35m
  const deltaZ = { x: 0, y: -0.1, z: 0.6 };

  // 3.1: Degrau 0.15m -> deve subir
  const pos15 = { x: 0, y: 0.0, z: 8.5 };
  world.moveAndSlide(pos15, playerSize, deltaZ, { stepHeight });
  assert(pos15.y >= 0.14, `Degrau 0.15m deve ser transposto com step-up, pos.y: ${pos15.y}`);

  // 3.2: Degrau 0.30m -> deve subir
  const pos30 = { x: 5, y: 0.0, z: 8.5 };
  world.moveAndSlide(pos30, playerSize, deltaZ, { stepHeight });
  assert(pos30.y >= 0.29, `Degrau 0.30m deve ser transposto com step-up, pos.y: ${pos30.y}`);

  // 3.3: Degrau 0.35m -> deve subir (limite exato)
  const pos35 = { x: 10, y: 0.0, z: 8.5 };
  world.moveAndSlide(pos35, playerSize, deltaZ, { stepHeight });
  assert(pos35.y >= 0.34, `Degrau 0.35m deve ser transposto com step-up, pos.y: ${pos35.y}`);

  // 3.4: Degrau 0.45m -> deve ser BLOQUEADO (0.45 > 0.35)
  const pos45 = { x: 15, y: 0.0, z: 8.5 };
  const res45 = world.moveAndSlide(pos45, playerSize, deltaZ, { stepHeight });
  assert(pos45.y < 0.1 && res45.hitZ, `Degrau 0.45m deve bloquear step-up! pos.y: ${pos45.y}`);

  // 3.5: Degrau 0.60m -> deve ser BLOQUEADO
  const pos60 = { x: 20, y: 0.0, z: 8.5 };
  const res60 = world.moveAndSlide(pos60, playerSize, deltaZ, { stepHeight });
  assert(pos60.y < 0.1 && res60.hitZ, `Degrau 0.60m deve bloquear step-up! pos.y: ${pos60.y}`);

  console.log(`✅ [3] Validação de Degraus (stepHeight = 0.35m):`);
  console.log(`  - 0.15m, 0.30m e 0.35m subiram suavemente sem tecla de pulo.`);
  console.log(`  - 0.45m e 0.60m foram bloqueados rigidamente.`);
}

// 4. Validação de Coyote Time (Salto permitido logo após sair de plataforma)
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 10, 1, 10); // Plataforma que termina em z = 5
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 4.5]);

  // Anda para fora da plataforma em z = 5.5 (em queda livre)
  player.pos.set(0, 0, 5.5);
  player.onGround = false;
  player.coyoteTimer = 0.08; // dentro da janela de 0.12s de coyote time

  let jumped = false;
  const mockInput = {
    actions: { jump: true },
    consumeAction: (act) => act === 'jump',
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  player.update(dt, mockInput);
  assert(player.vel.y > 5.0, `Coyote Time deve permitir o pulo no ar dentro da tolerância, vel.y: ${player.vel.y}`);
  assert.strictEqual(player.coyoteTimer, 0, 'Coyote Timer deve ser zerado após consumir o pulo');
  console.log(`✅ [4] Coyote Time validado: pulo executado com sucesso no ar dentro da tolerância.`);
}

// 5. Validação de Jump Buffer (Ação armazenada antes de tocar o solo)
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50);
  const player = new Player(world, [-50, 50, -50, 50], [0, 0.15, 0]); // caindo a 15cm do chão (~0.04s do impacto)
  player.onGround = false;
  player.vel.y = -4.0;
  player.coyoteTimer = 0; // fora de coyote time

  // Pressiona pulo pouco antes de tocar o solo
  const mockBufferInput = {
    actions: { jump: true },
    consumeAction: (act) => act === 'jump',
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  player.update(dt, mockBufferInput);
  assert(player.jumpBufferTimer > 0.05, `jumpBufferTimer deve estar ativo, obtido: ${player.jumpBufferTimer}`);
  assert(player.vel.y < 0, 'Não deve pular ainda no ar fora do coyote time');

  // Avança até o jogador atingir o solo
  const noInput = { actions: {}, consumeAction: () => false, consumeMouseDelta: () => ({ dx: 0, dy: 0 }) };
  while (!player.onGround && player.jumpBufferTimer > 0) {
    player.update(dt, noInput);
  }
  assert(player.onGround, 'Deve atingir o solo dentro da janela do jump buffer');

  // No tick imediatamente após assentar no solo, o jump buffer acumulado dispara o pulo
  player.update(dt, noInput);
  assert(player.vel.y > 5.0, `Jump Buffer deve disparar o pulo imediatamente ao aterrissar, vel.y: ${player.vel.y}`);
  assert.strictEqual(player.jumpBufferTimer, 0, 'jumpBufferTimer deve ser consumido');
  console.log(`✅ [5] Jump Buffer validado: pulo pré-programado disparou perfeitamente ao encostar no chão.`);
}

// 6. Validação Anti Auto-Bhop (Segurar Espaço não repete pulo)
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50);
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 0]);

  // 1 tick para assentar no chão
  player.update(dt, { actions: {}, consumeAction: () => false, consumeMouseDelta: () => ({ dx: 0, dy: 0 }) });
  assert(player.onGround, 'Player deve assentar no chão');

  // Simula o Input real do motor onde consumeAction consome no primeiro frame
  let queue = new Set(['jump']);
  const realMockInput = {
    actions: { jump: true }, // tecla mantida pressionada
    consumeAction: (act) => {
      if (queue.has(act)) {
        queue.delete(act);
        return true;
      }
      return false;
    },
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  // 1º tick: pula
  player.update(dt, realMockInput);
  assert(player.vel.y > 5.0, `Primeiro frame com tecla deve pular, vel.y: ${player.vel.y}`);

  // Simula tempo no ar até aterrissar (45 ticks = ~0.75s)
  for (let i = 0; i < 45; i++) {
    player.update(dt, realMockInput);
  }

  // Player já aterrissou, e tecla continua mantida pressionada (actions.jump = true, mas queue vazia)
  assert(player.onGround, 'Player deve estar no chão');
  assert.strictEqual(player.vel.y, 0, `Não deve dar auto-bhop ao aterrissar segurando espaço, vel.y: ${player.vel.y}`);
  console.log(`✅ [6] Anti Auto-Bhop validado: manter espaço pressionado não gera saltos involuntários.`);
}

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DA FASE 2 PASSARAM COM SUCESSO!');
console.log('==================================================');
