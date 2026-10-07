import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ProjectileManager, SPEED_OF_SOUND } from '../src/weapons/ProjectileManager.js';
import { Bot } from '../src/entities/Bot.js';
import { on } from '../src/core/EventBus.js';
import * as THREE from 'three';

console.log('==================================================');
console.log('🎯 TESTE DE BALÍSTICA EXTERNA & CCD (PROJECTILE MANAGER)');
console.log('==================================================');

// 1. Instancia mundo físico
const world = new CollisionWorld(4.0);
world.addBox(0, -0.5, 0, 100, 1, 100);     // Chão
world.addBox(0, 1.5, 50, 6, 4, 1);        // Parede a 50m no eixo Z positivo

// 2. Instancia mock de bots
const bot = new Bot(1, world, null);
bot.pos.set(0, 0.1, 30); // Bot posicionado a 30m no eixo Z positivo
bot.alive = true;
bot.hp = 100;

const bots = [bot];
const projectileManager = new ProjectileManager({
  world,
  botsProvider: () => bots,
  player: null,
  camera: null,
  maxProjectiles: 128
});

// Configuração simulada de arma (HK416)
const hk416Def = {
  id: 'ar15',
  name: 'HK416',
  tracerColor: '#ffd27f',
  ballistics: {
    terminal: {
      bulletSpeed: 880,
      bulletDrop: 9.8,
      damageBody: 25,
      damageHead: 55,
      damageFalloff: { startDistance: 30, endDistance: 90, minMultiplier: 0.6 }
    },
    external: {
      drag: 0.005
    }
  }
};

let shotBotEvents = [];
let shotWorldEvents = [];
on('shot:bot', e => shotBotEvents.push(e));
on('shot:world', e => shotWorldEvents.push(e));

// ── TESTE 1: Spawn de Projétil & Velocidade Inicial ──
console.log('\n[Teste 1] Validando Spawn e velocidade inicial...');
const origin = new THREE.Vector3(0, 1.5, 0);
const dir = new THREE.Vector3(0, 0, 1); // Apontando em direção ao bot e parede

const proj = projectileManager.spawn({
  origin,
  direction: dir,
  weaponDef: hk416Def,
  owner: 'player'
});

if (!proj.active) throw new Error('Projétil deveria estar ativo após spawn');
if (Math.abs(proj.vel.length() - 880) > 0.01) {
  throw new Error(`Velocidade esperada de 880 m/s, obtido: ${proj.vel.length()}`);
}
console.log(`✅ Projétil spawnado com sucesso: Velocidade = ${proj.vel.length()} m/s, Gravidade = ${proj.gravity} m/s²`);

// ── TESTE 2: Simulação de Vôo, Parábola e CCD contra Bot ──
console.log('\n[Teste 2] Simulando passos de física até impacto no Bot...');
const dt = 1 / 120; // 120Hz tick
let ticks = 0;
while (proj.active && ticks < 100) {
  projectileManager.update(dt);
  ticks++;
}

if (shotBotEvents.length === 0) {
  throw new Error('Projétil deveria ter interceptado o bot a 30m');
}

const botEvent = shotBotEvents[0];
console.log(`✅ Impacto no Bot registrado em ${ticks} ticks (~${(ticks * dt * 1000).toFixed(1)}ms de vôo)!`);
console.log(`   - Distância percorrida: ${botEvent.distance.toFixed(2)}m`);
console.log(`   - Atraso acústico (velocidade do som ${SPEED_OF_SOUND} m/s): ${(botEvent.soundDelay * 1000).toFixed(1)}ms`);
console.log(`   - Parte atingida: ${botEvent.headshot ? 'HEAD' : 'BODY'}`);
console.log(`   - HP restante do bot: ${bot.hp}`);

if (bot.hp >= 100) throw new Error('Bot deveria ter tomado dano!');
if (botEvent.soundDelay <= 0) throw new Error('Atraso acústico deve ser maior que zero');

// ── TESTE 3: Disparo contra Parede distante a 50m (Sem bot) ──
console.log('\n[Teste 3] Validando impacto contínuo (CCD) no mundo estático a 50m...');
bot.alive = false; // Desativa o bot para o tiro passar direto até a parede
shotWorldEvents.length = 0;

const proj2 = projectileManager.spawn({
  origin,
  direction: dir,
  weaponDef: hk416Def,
  owner: 'player'
});

ticks = 0;
while (proj2.active && ticks < 100) {
  projectileManager.update(dt);
  ticks++;
}

if (shotWorldEvents.length === 0) {
  throw new Error('Projétil deveria ter colidido com a parede do CollisionWorld a 50m');
}

const worldEvent = shotWorldEvents[0];
console.log(`✅ Impacto no CollisionWorld registrado com sucesso!`);
console.log(`   - Ponto de impacto Z: ${worldEvent.point.z.toFixed(2)}m (esperado ~49.5m)`);
console.log(`   - Ponto de impacto Y: ${worldEvent.point.y.toFixed(3)}m (queda por gravidade)`);
console.log(`   - Atraso acústico do impacto: ${(worldEvent.soundDelay * 1000).toFixed(1)}ms`);

// ── TESTE 4: Performance e Stress Test com 100 Projéteis Simultâneos ──
console.log('\n[Teste 4] Benchmark de Performance: 100 projéteis simultâneos a 120Hz...');
bot.alive = true;

for (let i = 0; i < 100; i++) {
  const rndDir = new THREE.Vector3(
    (Math.random() - 0.5) * 0.2,
    (Math.random() - 0.5) * 0.1,
    1
  ).normalize();
  projectileManager.spawn({
    origin,
    direction: rndDir,
    weaponDef: hk416Def,
    owner: 'player'
  });
}

const startTime = performance.now();
const simTicks = 600; // 5 segundos
for (let t = 0; t < simTicks; t++) {
  projectileManager.update(dt);
}
const elapsedMs = performance.now() - startTime;
const ticksPerSec = (simTicks / (elapsedMs / 1000)).toFixed(0);

console.log(`✅ 100 Projéteis simulados por 600 ticks em ${elapsedMs.toFixed(2)}ms (${ticksPerSec} ticks/seg)!`);

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE BALÍSTICA E CCD PASSARAM COM SUCESSO!');
console.log('==================================================');
