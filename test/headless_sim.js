import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { GameManager } from '../src/core/GameManager.js';
import { Player } from '../src/entities/Player.js';
import { Bot } from '../src/entities/Bot.js';
import { on } from '../src/core/EventBus.js';

console.log('==================================================');
console.log('🤖 INICIANDO SIMULAÇÃO HEADLESS (PROVA DE FOGO GODOT/SERVER)');
console.log('==================================================');

// 1. Instancia o Mundo Físico com Spatial Hash Grid
const world = new CollisionWorld(4.0);

// Cria chão e algumas paredes de teste
world.addBox(0, -0.5, 0, 60, 1, 60); // Piso principal
world.addBox(5, 1.5, 0, 1, 3, 10);   // Parede obstáculo
world.addBox(-5, 1.5, 5, 8, 3, 1);   // Parede obstáculo

console.log(`[Physics] CollisionWorld inicializado com ${world.boxes.length} caixas estáticas.`);

// 2. Instancia o Jogador Lógico (sem câmera, sem WebGL)
const player = new Player(world, [-24, 24, -24, 24], [0, 0.1, 5]);
console.log(`[Player] Instanciado na posição (${player.pos.x}, ${player.pos.y}, ${player.pos.z}). HP: ${player.hp}`);

// 3. Instancia o GameManager Headless (sem THREE.Scene nem viewmodel visual)
const gameManager = new GameManager({
  scene: null, // Zero dependência de cena Three.js
  world,
  player,
  weapons: null,
  botSpawns: [[-10, 0.6, -10], [10, 0.6, 10], [0, 0.6, -12]],
  playerSpawn: [0, 0.1, 5],
  bounds: [-24, 24, -24, 24]
});

gameManager.hasStarted = true;
gameManager.setBotCount(3);
console.log(`[GameManager] Spawnow ${gameManager.bots.length} bots headless.`);

// Contadores de telemetria
let totalBotShots = 0;
let totalBotHits = 0;
let totalBotKills = 0;

on('bot:fired', () => {
  totalBotShots++;
});

on('player:damaged', (e) => {
  totalBotHits++;
});

on('bot:died', () => {
  totalBotKills++;
});

// Mock de input do player simulando movimento contínuo
const mockInput = {
  consumeMouseDelta: () => ({ dx: 2, dy: 0 }),
  isActionPressed: (action) => {
    if (action === 'move_forward') return true;
    if (action === 'sprint') return true;
    return false;
  },
  actions: {
    forward: true,
    sprint: true,
    backward: false,
    left: false,
    right: false,
    jump: false,
    crouch: false,
    ads: false
  }
};

const fixedDt = 1 / 120; // 120Hz ticks
const totalTicks = 600;  // 5 segundos de jogo contínuo
console.log(`[Loop] Executando ${totalTicks} ticks a 120Hz (tempo simulado: ${(totalTicks * fixedDt).toFixed(2)}s)...`);

const startTime = performance.now();

for (let tick = 1; tick <= totalTicks; tick++) {
  // Tick do jogador
  player.update(fixedDt, mockInput);

  // Tick do GameManager (atualiza bots, FSM, colisão mútua, respawns e drops)
  gameManager.update(fixedDt);

  // Verificação periódica de log
  if (tick % 120 === 0) {
    const sec = (tick * fixedDt).toFixed(1);
    const botStates = gameManager.bots.map(b => `${b.id}:${b.ai.state}`).join(' | ');
    console.log(`[T=${sec}s] Player pos: (${player.pos.x.toFixed(2)}, ${player.pos.z.toFixed(2)}) HP: ${player.hp.toFixed(1)} | Bots: [${botStates}] | Disparos: ${totalBotShots}`);
  }
}

const elapsedMs = performance.now() - startTime;
console.log('--------------------------------------------------');
console.log(`✅ SIMULAÇÃO CONCLUÍDA EM ${elapsedMs.toFixed(2)}ms! (${(totalTicks / (elapsedMs / 1000)).toFixed(0)} ticks/seg)`);
console.log(`- Posição Final do Jogador: (${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(2)})`);
console.log(`- Vida do Jogador: ${player.hp.toFixed(1)} / ${player.maxHp}`);
console.log(`- Tiros de Bots efetuados: ${totalBotShots}`);
console.log(`- Tiros recebidos pelo Jogador: ${totalBotHits}`);
console.log(`- Drops de Itens gerados no mundo: ${gameManager.itemDrops.length}`);
console.log('==================================================');
console.log('🎉 SUCESSO: O ecossistema roda 100% autônomo sem DOM e sem WebGL (Godot/Dedicated Server Ready)!');
console.log('==================================================');
