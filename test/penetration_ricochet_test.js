import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';
import { Bot } from '../src/entities/Bot.js';
import { on } from '../src/core/EventBus.js';
import * as THREE from 'three';

console.log('==================================================');
console.log('🎯 TESTE DE PENETRAÇÃO DE PAREDES (WALLBANG) & RICOCHETE');
console.log('==================================================');

// 1. Instancia mundo físico com caixas de madeira, concreto e metal
const world = new CollisionWorld(4.0);
world.addBox(0, -0.5, 0, 100, 1, 100, { material: 'floor' });

// Parede de madeira fina: 0.15m de espessura a Z = 20m
world.addBox(0, 1.5, 20, 6, 4, 0.15, { material: 'wood' });

// Parede de concreto grossa: 1.5m de espessura a Z = 60m
world.addBox(0, 1.5, 60, 6, 4, 1.5, { material: 'concrete' });

// 2. Bot atrás da parede de madeira (Z = 25m)
const bot = new Bot(1, world, null);
bot.pos.set(0, 0.1, 25);
bot.alive = true;
bot.hp = 100;

const projectileManager = new ProjectileManager({
  world,
  botsProvider: () => [bot],
  player: null,
  camera: null,
  maxProjectiles: 64
});

// Arma com munição 7.62x39mm Soviet (Alta penetração)
const akDef = {
  id: 'ak47',
  name: 'AK-47',
  tracerColor: '#ffaa44',
  ballistics: {
    terminal: {
      bulletSpeed: 715,
      bulletDrop: 9.8,
      damageBody: 38,
      damageHead: 80,
      penetrationPower: 0.50,
      maxPenetrations: 2,
      ricochetChance: 0.30
    },
    external: {
      drag: 0.005
    }
  }
};

let penetrations = [];
let ricochets = [];
let botHits = [];
let worldHits = [];

on('shot:penetration', e => penetrations.push(e));
on('shot:ricochet', e => ricochets.push(e));
on('shot:bot', e => botHits.push(e));
on('shot:world', e => worldHits.push(e));

// ── TESTE 1: Penetração de Parede de Madeira e Dano no Bot (Wallbang) ──
console.log('\n[Teste 1] Disparando 7.62mm contra parede de madeira (0.15m) com Bot atrás...');
const origin = new THREE.Vector3(0, 1.5, 0);
const dir = new THREE.Vector3(0, 0, 1); // Direção reta para Z+

const proj = projectileManager.spawn({
  origin,
  direction: dir,
  weaponDef: akDef,
  owner: 'player'
});

const dt = 1 / 120;
let ticks = 0;
while (proj.active && ticks < 200) {
  projectileManager.update(dt);
  ticks++;
}

if (penetrations.length === 0) {
  throw new Error('Projétil deveria ter penetrado a parede de madeira!');
}

console.log(`✅ Penetração registrada: Material = ${penetrations[0].material}, Espessura = ${penetrations[0].thickness.toFixed(2)}m`);
console.log(`   - Ponto de entrada: Z = ${penetrations[0].entryPoint.z.toFixed(2)}`);
console.log(`   - Ponto de saída: Z = ${penetrations[0].exitPoint.z.toFixed(2)}`);

if (botHits.length === 0) {
  throw new Error('Projétil que penetrou a parede deveria ter atingido o bot atrás dela!');
}

console.log(`✅ Bot atingido através da parede (WALLBANG)!`);
console.log(`   - HP restante do bot: ${bot.hp} (Dano computado através do obstáculo)`);
if (bot.hp >= 100) throw new Error('Bot deveria ter tomado dano!');

// ── TESTE 2: Parede Grossa de Concreto Impenetrável (Absorção) ──
console.log('\n[Teste 2] Disparando contra parede grossa de concreto (1.5m)...');
bot.alive = false; // Desativa bot
penetrations.length = 0;
worldHits.length = 0;

const proj2 = projectileManager.spawn({
  origin: new THREE.Vector3(0, 1.5, 40),
  direction: dir,
  weaponDef: akDef,
  owner: 'player'
});

ticks = 0;
while (proj2.active && ticks < 100) {
  projectileManager.update(dt);
  ticks++;
}

if (penetrations.length > 0) {
  throw new Error('Parede de concreto de 1.5m NÃO deveria ser penetrada por 7.62mm com penetrationPower 0.50!');
}
if (worldHits.length === 0) {
  throw new Error('Projétil deveria ter sido absorvido pela parede de concreto');
}
console.log(`✅ Projétil devidamente bloqueado e absorvido pela parede de concreto de 1.5m.`);

// ── TESTE 3: Ricochete Angular em Ângulo Rasante (< 25°) contra Concreto ──
console.log('\n[Teste 3] Disparando em ângulo rasante contra parede de concreto...');
ricochets.length = 0;

// Parede lateral de concreto em X = 2m, orientada no plano YZ (Normal = {-1, 0, 0})
world.addBox(2.1, 1.5, 10, 0.2, 4, 20, { material: 'concrete' });

// Disparo rasante: vetor em direção a X=2 com ângulo muito fechado (dx=0.08, dz=0.99)
const shallowDir = new THREE.Vector3(0.08, 0, 0.99).normalize();
const proj3 = projectileManager.spawn({
  origin: new THREE.Vector3(1.5, 1.5, 0),
  direction: shallowDir,
  weaponDef: akDef,
  owner: 'player'
});

ticks = 0;
while (proj3.active && ticks < 80) {
  projectileManager.update(dt);
  ticks++;
}

if (ricochets.length === 0) {
  throw new Error('Projétil em ângulo rasante contra concreto deveria ter ricocheteado!');
}

console.log(`✅ Ricochete físico angular registrado com sucesso!`);
console.log(`   - Ponto de ricochete: X=${ricochets[0].point.x.toFixed(2)}, Z=${ricochets[0].point.z.toFixed(2)}`);
console.log(`   - Material da superfície: ${ricochets[0].material}`);
console.log(`   - Nova velocidade pós-ricochete: ${proj3.speed.toFixed(1)} m/s (energia cinética dissipada)`);

// ── TESTE 4: Supressão Tática (Near-Miss a < 1.5m da cabeça) ──
console.log('\n[Teste 4] Testando Supressão Tática por Projéteis Próximos (<1.5m)...');
let suppressedEvents = [];
on('bot:suppressed', e => suppressedEvents.push(e));

bot.alive = true;
bot.hp = 100;
bot.pos.set(0, 0.1, 20); // Bot em Z = 20
bot.ai.suppressionLevel = 0;

// Disparo passando a 0.6m do bot (sem colidir nele): trajetória em X = 0.6m, Z vai de 0 a 40m
const nearMissDir = new THREE.Vector3(0, 0, 1);
const proj4 = projectileManager.spawn({
  origin: new THREE.Vector3(0.6, 1.6, 0),
  direction: nearMissDir,
  weaponDef: akDef,
  owner: 'player'
});

ticks = 0;
while (proj4.active && ticks < 40) {
  projectileManager.update(dt);
  ticks++;
}

if (suppressedEvents.length === 0) {
  throw new Error('Tiro passando a 0.6m do bot deveria ter disparado evento de supressão!');
}

console.log(`✅ Supressão registrada no Bot com sucesso!`);
console.log(`   - Distância mínima até a cabeça: ${suppressedEvents[0].distance.toFixed(2)}m (limite 1.5m)`);
console.log(`   - Intensidade da supressão: ${(suppressedEvents[0].intensity * 100).toFixed(1)}%`);
console.log(`   - Nível de supressão no AIController: ${(bot.ai.suppressionLevel * 100).toFixed(1)}%`);

if (bot.ai.suppressionLevel <= 0) {
  throw new Error('Nível de supressão no AIController deveria ter aumentado!');
}

// ── TESTE 5: Supressão no Jogador (Bot disparando perto do Player com parede atrás) ──
console.log('\n[Teste 5] Testando Supressão Tática no Jogador por tiros de Bot (Near-Miss)...');
let playerSuppressedEvents = [];
on('player:suppression', e => playerSuppressedEvents.push(e));

const dummyPlayer = {
  pos: new THREE.Vector3(0, 0, 15),
  alive: true,
  rig: {
    flinchPitch: 0,
    flinchYaw: 0,
    shakeIntensity: 0,
    addFlinch(p, y) { this.flinchPitch += p; this.flinchYaw += y; },
    addShake(s) { this.shakeIntensity += s; }
  }
};
projectileManager.player = dummyPlayer;

// Parede a 5 metros atrás do jogador (Z = 20m)
world.addBox(0, 1.5, 20, 10, 4, 1.0, { material: 'concrete' });

// Projétil de bot disparado a Z=0, passando em X=0.8 (0.8m do player em Z=15) e colidindo com a parede em Z=20
const botNearMissDir = new THREE.Vector3(0, 0, 1);
const proj5 = projectileManager.spawn({
  origin: new THREE.Vector3(0.8, 1.6, 0),
  direction: botNearMissDir,
  weaponDef: akDef,
  owner: 'bot'
});

ticks = 0;
while (proj5.active && ticks < 40) {
  projectileManager.update(dt);
  ticks++;
}

if (playerSuppressedEvents.length === 0) {
  throw new Error('Tiro de bot passando a 0.8m do player e acertando a parede atrás deveria disparar player:suppression!');
}

console.log(`✅ Supressão no Jogador registrada com sucesso!`);
console.log(`   - Distância até a cabeça: ${playerSuppressedEvents[0].distance.toFixed(2)}m (esperado ~0.8m)`);
console.log(`   - Intensidade: ${(playerSuppressedEvents[0].intensity * 100).toFixed(1)}%`);
console.log(`   - Camera Rig Shake: ${dummyPlayer.rig.shakeIntensity.toFixed(3)} | Flinch registrado: ${Math.abs(dummyPlayer.rig.flinchPitch).toFixed(4)}`);

if (dummyPlayer.rig.shakeIntensity <= 0) {
  throw new Error('Camera rig do jogador deveria ter sofrido shake pelo deslocamento de ar do projétil!');
}

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE FASE 15 (WALLBANG, RICOCHETE E SUPRESSÃO) PASSARAM!');
console.log('==================================================');

