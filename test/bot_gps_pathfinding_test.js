import assert from 'node:assert/strict';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { NavGrid } from '../src/ai/NavGrid.js';
import { Bot } from '../src/entities/Bot.js';
import { Player } from '../src/entities/Player.js';

console.log('==================================================');
console.log('🧭 TESTE DO GPS DOS BOTS (NAVGRID A* & ANTI-STUCK)');
console.log('==================================================\n');

// 1. Cenário com Parede Central e Passagem de Porta Estreita
const world = new CollisionWorld(4.0);
// Chão 60x60
world.addBox(0, -0.5, 0, 60, 1, 60, { material: 'floor' });
// Parede longa em Z=0 de X=-8 até X=8 (forçando contorno pelas pontas)
world.addBox(0, 1.5, 0, 16, 3, 1.0, { material: 'wall' });

const navGrid = new NavGrid(world);

console.log('[Teste 1] Calculando rota A* contornando parede de 16m...');
const start = { x: 0, z: -6 };
const goal = { x: 0, z: 6 };
const path = navGrid.findPath(start, goal);

assert(path.length >= 2, 'A rota deve ter múltiplos waypoints para contornar a parede');
const maxAbsX = Math.max(...path.map(wp => Math.abs(wp.x)));
console.log(`  - Waypoints gerados (${path.length}):`, path.map(p => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).join(' -> '));
assert(maxAbsX > 8.0, `A rota deve contornar a extremidade da parede (|x| > 8.0, obtido: ${maxAbsX.toFixed(2)})`);
console.log('✅ Rota A* contornou a parede com folga segura e String-Pulling!\n');

// 2. Simulação Física Real: Bot em SearchState atravessando parede + vão de porta
console.log('[Teste 2] Simulando Bot físico navegando até lastKnownPlayerPos atrás de parede...');
const bot = new Bot(1, world, null, 'soldier', 'ar15');
bot.setPosition(0, 0, -6);

const dummyPlayer = new Player(world, [-28, 28, -28, 28], [0, 0, 25], null);
dummyPlayer.alive = false; // Player inativo para isolar navegação de SearchState

bot.ai.lastKnownPlayerPos.set(0, 0, 6);
bot.ai.hasKnownPlayerPos = true;
bot.ai.changeState('search');
bot.ai.searchTimer = 20.0;

const dt = 1 / 60;
let reached = false;
let ticks = 0;
for (let i = 0; i < 600; i++) {
  ticks++;
  bot.update(dt, dummyPlayer);
  const distToGoal = Math.hypot(bot.pos.x - goal.x, bot.pos.z - goal.z);
  if (distToGoal < 1.3) {
    reached = true;
    break;
  }
}

console.log(`  - Posição final do Bot após ${ticks} ticks (${(ticks * dt).toFixed(2)}s): (${bot.pos.x.toFixed(2)}, ${bot.pos.z.toFixed(2)})`);
assert(reached, 'O Bot deveria ter contornado a parede e chegado ao destino sem ficar preso');
console.log('✅ Bot físico contornou o obstáculo e chegou ao destino sem travar em quinas!\n');

// 3. Teste de Vão de Porta (Doorway Navigation)
console.log('[Teste 3] Testando navegação por vão de porta (abertura central de 2.2m)...');
const doorWorld = new CollisionWorld(4.0);
doorWorld.addBox(0, -0.5, 0, 60, 1, 60, { material: 'floor' });
// Duas paredes deixando um vão de porta em X ∈ [-1.1, +1.1] na linha Z = 0
doorWorld.addBox(-11.1, 1.5, 0, 20, 3, 1.0, { material: 'wall' }); // X de -21.1 até -1.1
doorWorld.addBox(11.1, 1.5, 0, 20, 3, 1.0, { material: 'wall' });  // X de +1.1 até +21.1

const doorBot = new Bot(2, doorWorld, null, 'soldier', 'ar15');
doorBot.setPosition(-5, 0, -5);
doorBot.ai.lastKnownPlayerPos.set(5, 0, 5);
doorBot.ai.hasKnownPlayerPos = true;
doorBot.ai.changeState('search');
doorBot.ai.searchTimer = 20.0;

let passedDoor = false;
for (let i = 0; i < 600; i++) {
  doorBot.update(dt, dummyPlayer);
  if (Math.hypot(doorBot.pos.x - 5, doorBot.pos.z - 5) < 1.3) {
    passedDoor = true;
    break;
  }
}
console.log(`  - Posição final pós-porta: (${doorBot.pos.x.toFixed(2)}, ${doorBot.pos.z.toFixed(2)})`);
assert(passedDoor, 'O Bot deveria ter alinhado com o vão da porta e atravessado para a outra sala');
console.log('✅ Bot atravessou o vão de porta perfeitamente!\n');

// 4. Benchmark de Performance (100 buscas A*)
console.log('[Teste 4] Benchmark de CPU: 100 buscas A* consecutivas...');
const t0 = performance.now();
for (let i = 0; i < 100; i++) {
  const sx = -10 + (i % 10) * 2;
  const gx = 10 - (i % 10) * 2;
  navGrid.findPath({ x: sx, z: -8 }, { x: gx, z: 8 });
}
const elapsed = performance.now() - t0;
const avgMs = elapsed / 100;
console.log(`  - 100 rotas A* calculadas em ${elapsed.toFixed(2)}ms (Média: ${avgMs.toFixed(4)}ms por rota)`);
assert(avgMs < 0.5, `Tempo médio por rota A* muito alto: ${avgMs}ms`);
console.log('✅ Performance A* validada com folga (< 0.5ms por busca)!\n');

// 5. Teste de Orientação Visual 3D do Bot (Prevenção do Bug de Atirar de Costas)
console.log('[Teste 5] Validando orientação 3D do Bot (CharacterView) ao mirar e recuar...');
import * as THREE from 'three';
const dummyScene = new THREE.Scene();
const viewBot = new Bot(3, doorWorld, dummyScene, 'soldier', 'ar15');
viewBot.setPosition(0, 0, 0);
// Player em (0, 0, +10) -> direção frontal +Z (yaw = 0)
viewBot.yaw = Math.atan2(0 - 0, 10 - 0); // 0 rad
// Simula bot recuando de costas (vz = -3.0) enquanto mira para a frente (+Z)
viewBot.vel.set(0, 0, -3.0);
for (let i = 0; i < 30; i++) {
  viewBot.renderUpdate(1.0, dt);
}
const totalFacingYaw = viewBot.view.root.rotation.y + viewBot.view.torso.rotation.y;
let angleErr = totalFacingYaw - 0;
while (angleErr > Math.PI) angleErr -= Math.PI * 2;
while (angleErr < -Math.PI) angleErr += Math.PI * 2;
console.log(`  - Yaw resultante da arma/tronco 3D: ${totalFacingYaw.toFixed(3)} rad (Erro: ${angleErr.toFixed(3)} rad)`);
assert(Math.abs(angleErr) < 0.05, `O Bot não pode mirar de costas! Erro angular: ${angleErr}`);
console.log('✅ Bot mantém o tronco e o fuzil 100% voltados para a frente mesmo recuando!\n');

console.log('==================================================');
console.log('🎉 TODOS OS TESTES DO GPS E ORIENTAÇÃO PASSARAM!');
console.log('==================================================');

