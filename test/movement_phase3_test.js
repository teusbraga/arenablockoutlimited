import assert from 'assert';
import { Player } from '../src/entities/Player.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { CameraRig } from '../src/core/CameraRig.js';
import { CONFIG, ConfigLoader } from '../src/core/ConfigLoader.js';

console.log('==================================================');
console.log('🧪 TESTE DE MOVIMENTAÇÃO - FASE 3 (HEADROOM, TETO BAIXO & LEAN SNAP)');
console.log('==================================================\n');

await ConfigLoader.loadAll();
const dt = 1 / 60;

// 1. Validação de hasHeadroom no CollisionWorld
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50); // Piso

  // Adiciona laje/teto a 1.40m de altura com espessura de 0.3m (de y = 1.40 a y = 1.70)
  // Convenção: world.addBox(x, y + h/2, z, w, h, d)
  world.addBox(0, 1.40 + 0.30 / 2, 0, 10, 0.30, 10);

  const playerSize = { x: 0.6, y: 1.2, z: 0.6 };
  const posUnderCeiling = { x: 0, y: 0.0, z: 0 };
  const posOpenAir = { x: 20, y: 0.0, z: 0 };

  // 1.1 Em céu aberto deve haver headroom para 1.8m
  assert.strictEqual(world.hasHeadroom(posOpenAir, playerSize, 1.8), true, 'Céu aberto deve ter headroom para 1.8m');

  // 1.2 Sob o teto de 1.40m:
  // - Altura 1.2m tem espaço livre
  assert.strictEqual(world.hasHeadroom(posUnderCeiling, playerSize, 1.2), true, 'Altura 1.2m deve ter espaço livre sob teto de 1.40m');
  // - Altura 1.8m DEVE ser bloqueada
  assert.strictEqual(world.hasHeadroom(posUnderCeiling, playerSize, 1.8), false, 'Altura 1.8m NÃO deve ter headroom sob teto de 1.40m');

  console.log('✅ [1] CollisionWorld.hasHeadroom validado com sucesso (volumétrico e sem falsos positivos).');
}

// 2. Validação do Bloqueio de Levantar no Player (Headroom Check)
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50);
  // Teto a 1.40m na região de z = [0, 8]
  world.addBox(0, 1.40 + 0.30 / 2, 4, 6, 0.30, 8);

  // Spawna fora do túnel em z = 10 (céu aberto)
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 10]);

  const inputCrouched = {
    actions: { crouch: true },
    consumeAction: () => false,
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  const inputReleasedCrouch = {
    actions: { crouch: false },
    consumeAction: () => false,
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  // 2.1: Agacha fora do túnel e entra em z = 4
  for (let i = 0; i < 30; i++) {
    player.update(dt, inputCrouched);
  }
  assert.strictEqual(player.crouched, true, 'Player deve estar agachado');
  assert(player.size.y <= 1.25, `Player deve estar com altura agachada, obtido: ${player.size.y}`);

  // Entra no túnel em z = 4 mantendo agachado
  player.pos.set(0, 0, 4);

  // 2.2: Solta o botão de agachar embaixo do teto -> HEADROOM DEVE MANTER AGACHADO
  for (let i = 0; i < 30; i++) {
    player.update(dt, inputReleasedCrouch);
  }
  assert.strictEqual(player.crouched, true, 'Player DEVE permanecer agachado sob teto baixo mesmo com tecla solta');
  assert(player.size.y <= 1.25, `Altura deve continuar travada em ~1.2m, obtido: ${player.size.y}`);
  assert(player.pos.y < 0.1, `Player NÃO pode se teleportar para cima da laje! pos.y: ${player.pos.y}`);

  // 2.3: Sai debaixo do teto para z = 15 (céu aberto)
  player.pos.set(0, 0, 15);
  for (let i = 0; i < 30; i++) {
    player.update(dt, inputReleasedCrouch);
  }
  assert.strictEqual(player.crouched, false, 'Player deve conseguir levantar em céu aberto');
  assert(player.size.y >= 1.75, `Altura deve expandir suavemente para 1.8m, obtido: ${player.size.y}`);

  console.log('✅ [2] Headroom Check do Player validado:');
  console.log('  - Bloqueia levantar sob teto de 1.40m.');
  console.log('  - Previne teleporte de colisão para cima da laje.');
  console.log('  - Levanta automaticamente ao sair para área aberta.');
}

// 3. Validação do Lean Snap e Eliminação da Dupla Suavização
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50);
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 0]);
  const rig = new CameraRig();

  const inputLeanLeft = {
    actions: { lean_left: true },
    consumeAction: () => false,
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  };

  // Simula 6 ticks (~0.1s) inclinando para a esquerda
  for (let i = 0; i < 6; i++) {
    player.update(dt, inputLeanLeft);
  }

  // Com taxa de 18/s (em vez de duplo 14/s), em 6 ticks a inclinação deve estar bem avançada (> 0.75)
  assert(Math.abs(player.lean) > 0.75, `Lean deve responder com snap tático (>0.75 em 100ms), obtido: ${Math.abs(player.lean).toFixed(3)}`);

  // Valida que o CameraRig segue o player.lean de forma síncrona
  const dummyCam = { position: { set: () => {} }, rotation: { set: () => {} } };
  rig.update(dt, player, dummyCam);
  assert.strictEqual(rig.currentLean, player.lean, 'CameraRig deve seguir player.lean 1:1 sem atraso de segundo lerp');

  console.log(`✅ [3] Lean Snap validado: taxa calibrada a 18/s atingiu ${Math.abs(player.lean).toFixed(3)} em 100ms e CameraRig sincronizado 1:1.`);
}

// 4. Validação de crouchAmount normalizado [0, 1]
{
  const world = new CollisionWorld(4.0);
  world.addBox(0, -0.5, 0, 50, 1, 50);
  const player = new Player(world, [-50, 50, -50, 50], [0, 0, 0]);

  // Força morte
  player.alive = false;
  player.update(dt, { actions: {}, consumeAction: () => false, consumeMouseDelta: () => ({ dx: 0, dy: 0 }) });

  assert(player.crouchAmount >= 0 && player.crouchAmount <= 1.0, `crouchAmount deve estar estritamente no intervalo [0, 1], obtido: ${player.crouchAmount}`);
  console.log(`✅ [4] Normalização de crouchAmount validada (sem extrapolação para 1.5).`);
}

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DA FASE 3 PASSARAM COM SUCESSO!');
console.log('==================================================');
