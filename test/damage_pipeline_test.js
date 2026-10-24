import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';
import { BallisticsCalculator } from '../src/weapons/BallisticsCalculator.js';
import { Bot } from '../src/entities/Bot.js';
import { on } from '../src/core/EventBus.js';

const testWeaponDef = {
  id: 'ar15',
  name: 'HK416',
  type: 'rifle',
  tracerColor: '#ffd27f',
  ballistics: {
    terminal: {
      bulletSpeed: 880,
      bulletDrop: 9.8,
      damageBody: 25,
      damageHead: 55,
      damageFalloff: { startDistance: 25, endDistance: 80, minMultiplier: 0.6 }
    },
    external: {
      drag: 0.005
    }
  }
};

test('Pipeline de Dano - 1. ProjectileManager spawna projétil contínuo com velocidade e balística', () => {
  const world = new CollisionWorld(4.0);
  const pm = new ProjectileManager({
    world,
    botsProvider: () => [],
    player: null,
    camera: null,
    maxProjectiles: 64
  });

  const origin = new THREE.Vector3(0, 1.5, 0);
  const dir = new THREE.Vector3(0, 0, 1);

  const p = pm.spawn({
    origin,
    direction: dir,
    weaponDef: testWeaponDef,
    owner: 'player'
  });

  assert.ok(p, 'Projétil deve ser instanciado');
  assert.equal(p.active, true);
  assert.equal(p.speed, 880, 'Velocidade inicial deve vir de bulletSpeed');
  assert.equal(p.owner, 'player');
});

test('Pipeline de Dano - 2. Colisão direta em Bot decrementa HP e emite shot:bot', () => {
  const world = new CollisionWorld(4.0);
  const bot = new Bot(1, world, null);
  bot.pos.set(0, 0.1, 10);
  bot.alive = true;
  bot.hp = 100;

  let shotBotEvent = null;
  const unsub = on('shot:bot', e => { shotBotEvent = e; });

  const pm = new ProjectileManager({
    world,
    botsProvider: () => [bot],
    player: null,
    camera: null,
    maxProjectiles: 64
  });

  pm.spawn({
    origin: new THREE.Vector3(0, 1.0, 0),
    direction: new THREE.Vector3(0, 0, 1),
    weaponDef: testWeaponDef,
    owner: 'player'
  });

  pm.update(0.02);

  assert.ok(shotBotEvent, 'Deve emitir evento shot:bot ao atingir inimigo');
  assert.ok(bot.hp < 100, `HP do bot deve sofrer dano (atual: ${bot.hp})`);
  assert.equal(shotBotEvent.headshot, false, 'Tiro no centro do corpo não é headshot');

  unsub();
  bot.destroy();
});

test('Pipeline de Dano - 3. Headshot classifica dano crítico de cabeça e emite headshot: true', () => {
  const world = new CollisionWorld(4.0);
  const bot = new Bot(2, world, null);
  bot.pos.set(0, 0.1, 10);
  bot.alive = true;
  bot.hp = 100;

  let headshotEvent = null;
  const unsub = on('shot:bot', e => { headshotEvent = e; });

  const pm = new ProjectileManager({
    world,
    botsProvider: () => [bot],
    player: null,
    camera: null,
    maxProjectiles: 64
  });

  pm.spawn({
    origin: new THREE.Vector3(0, 1.65, 0),
    direction: new THREE.Vector3(0, 0, 1),
    weaponDef: testWeaponDef,
    owner: 'player'
  });

  pm.update(0.02);

  assert.ok(headshotEvent, 'Deve registrar impacto no bot');
  assert.equal(headshotEvent.headshot, true, 'Deve classificar como headshot');
  assert.ok(bot.hp <= 45, `Dano de headshot deve reduzir drasticamente o HP (atual: ${bot.hp})`);

  unsub();
  bot.destroy();
});

test('Pipeline de Dano - 4. BallisticsCalculator calcula queda de dano terminal por distância', () => {
  const impactClose = BallisticsCalculator.calculateTerminalImpact(testWeaponDef, 10, 'body');
  const impactFar = BallisticsCalculator.calculateTerminalImpact(testWeaponDef, 75, 'body');

  assert.ok(impactClose.finalDamage > impactFar.finalDamage, 'Dano a 10m deve ser superior ao dano a 75m');
  assert.equal(impactClose.finalDamage, 25, 'Dano à queima-roupa deve ser 100% do dano base do JSON');

  const headClose = BallisticsCalculator.calculateTerminalImpact(testWeaponDef, 10, 'head');
  const headFar = BallisticsCalculator.calculateTerminalImpact(testWeaponDef, 75, 'head');
  assert.ok(headClose.finalDamage > headFar.finalDamage, 'Dano de headshot a 10m deve ser superior ao de 75m');
  assert.equal(headClose.finalDamage, 55, 'Headshot à queima-roupa deve aplicar 55 de dano');
});

test('Pipeline de Dano - 5. Disparo de raspão (< 2.2m) aciona player:suppression', () => {
  const world = new CollisionWorld(4.0);
  world.addBox(0, 1.5, 30, 10, 4, 1.0); // Parede atrás do jogador a 30m

  const dummyPlayer = {
    alive: true,
    pos: new THREE.Vector3(0, 0, 15),
    eyeHeight: 1.6,
    crouched: false,
    rig: {
      flinchPitch: 0,
      flinchYaw: 0,
      shakeIntensity: 0,
      addFlinch(p, y) { this.flinchPitch += p; this.flinchYaw += y; },
      addShake(s) { this.shakeIntensity += s; }
    }
  };

  let suppressionEvent = null;
  const unsub = on('player:suppression', e => { suppressionEvent = e; });

  const pm = new ProjectileManager({
    world,
    botsProvider: () => [],
    player: dummyPlayer,
    camera: null,
    maxProjectiles: 64
  });

  // Projétil de bot passando em X=0.8 (0.8m do jogador) indo até a parede em Z=30
  const proj = pm.spawn({
    origin: new THREE.Vector3(0.8, 1.6, 0),
    direction: new THREE.Vector3(0, 0, 1),
    weaponDef: testWeaponDef,
    owner: 'bot'
  });

  let ticks = 0;
  while (proj.active && ticks < 20) {
    pm.update(0.016);
    ticks++;
  }

  assert.ok(suppressionEvent, 'Near-miss deve acionar supressão tática no jogador');
  assert.ok(suppressionEvent.intensity > 0, 'Intensidade da supressão deve ser positiva');
  assert.ok(suppressionEvent.distance <= 2.4, 'Distância da supressão deve estar dentro do raio');

  unsub();
});

test('Pipeline de Dano - 6. Dano fatal zera HP e emite bot:died', () => {
  const world = new CollisionWorld(4.0);
  const bot = new Bot(3, world, null);
  bot.pos.set(0, 0.1, 5);
  bot.alive = true;
  bot.hp = 15; // HP baixo prestes a morrer

  let diedEvent = null;
  const unsub = on('bot:died', e => { diedEvent = e; });

  const pm = new ProjectileManager({
    world,
    botsProvider: () => [bot],
    player: null,
    camera: null,
    maxProjectiles: 64
  });

  pm.spawn({
    origin: new THREE.Vector3(0, 1.0, 0),
    direction: new THREE.Vector3(0, 0, 1),
    weaponDef: testWeaponDef,
    owner: 'player'
  });

  pm.update(0.02);

  assert.ok(diedEvent, 'Deve emitir bot:died quando HP atinge 0');
  assert.equal(bot.alive, false, 'Bot deve estar morto');
  assert.equal(bot.hp, 0, 'HP não deve ser negativo');

  unsub();
  bot.destroy();
});
