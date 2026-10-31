import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GameMode } from '../src/core/modes/GameMode.js';
import { DeathmatchMode } from '../src/core/modes/DeathmatchMode.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';
import { GameManager } from '../src/core/GameManager.js';
import { Bot } from '../src/entities/Bot.js';
import { Player } from '../src/entities/Player.js';
import { Input } from '../src/core/Input.js';
import { emit, on } from '../src/core/EventBus.js';

test('GameMode Strategy Pattern & DeathmatchMode FFA Rules', async (t) => {
  await t.test('GameMode base interface provides standard default contracts', () => {
    const base = new GameMode({ name: 'BaseTest' });
    assert.equal(base.name, 'BaseTest');
    const p1 = {};
    const p2 = {};
    assert.equal(base.isEnemy(p1, p1), false);
    assert.equal(base.isEnemy(p1, p2), true);
    assert.equal(base.canDamage(p1, p2), true);
    assert.equal(base.getScoreboard().length, 0);
  });

  await t.test('DeathmatchMode.isEnemy enforces strict FFA: everyone is an enemy except self and dead entities', () => {
    const ffa = new DeathmatchMode();

    const player = { id: 'player_1', alive: true, isPlayer: true };
    const bot1 = { id: 1, alive: true };
    const bot2 = { id: 2, alive: true };
    const deadBot = { id: 3, alive: false };

    // Self is never enemy
    assert.equal(ffa.isEnemy(player, player), false);
    assert.equal(ffa.isEnemy(bot1, bot1), false);

    // Dead entity is not active enemy
    assert.equal(ffa.isEnemy(player, deadBot), false);
    assert.equal(ffa.isEnemy(bot1, deadBot), false);

    // Any two distinct alive combatants are mutual enemies
    assert.equal(ffa.isEnemy(player, bot1), true);
    assert.equal(ffa.isEnemy(bot1, player), true);
    assert.equal(ffa.isEnemy(bot1, bot2), true);
    assert.equal(ffa.isEnemy(bot2, bot1), true);
  });

  await t.test('DeathmatchMode.canDamage prevents self-damage and allows cross-combatant damage', () => {
    const ffa = new DeathmatchMode();
    const p1 = { id: 'p1' };
    const p2 = { id: 'p2' };

    assert.equal(ffa.canDamage(p1, p1), false);
    assert.equal(ffa.canDamage(p1, p2), true);
    assert.equal(ffa.canDamage(p2, p1), true);
  });

  await t.test('DeathmatchMode scoring and scoreboard ranking with K/D calculation', () => {
    const ffa = new DeathmatchMode();
    const p1 = { id: 'player', name: 'VOCÊ', badge: '🌟', isPlayer: true, alive: true };
    const b1 = { id: 1, name: 'ALPHA-01', badge: '🪖', alive: true };
    const b2 = { id: 2, name: 'BRAVO-02', badge: '👻', alive: false };

    ffa.registerCombatant(p1);
    ffa.registerCombatant(b1);
    ffa.registerCombatant(b2);

    // Initial scoreboard
    let sb = ffa.getScoreboard();
    assert.equal(sb.length, 3);
    assert.equal(sb[0].kills, 0);
    assert.equal(sb[0].deaths, 0);
    assert.equal(sb[0].kd, '0.00');

    // Simulate kills
    ffa.onKill({ killer: p1, victim: b1 });
    ffa.onKill({ killer: p1, victim: b2 });
    ffa.onKill({ killer: b1, victim: p1 });

    sb = ffa.getScoreboard();
    // p1 has 2 kills, 1 death -> kd 2.00, rank 1
    assert.equal(sb[0].id, 'player');
    assert.equal(sb[0].kills, 2);
    assert.equal(sb[0].deaths, 1);
    assert.equal(sb[0].kd, '2.00');
    assert.equal(sb[0].rank, 1);

    // b1 has 1 kill, 1 death -> kd 1.00, rank 2
    assert.equal(sb[1].id, 1);
    assert.equal(sb[1].kills, 1);
    assert.equal(sb[1].deaths, 1);
    assert.equal(sb[1].kd, '1.00');
    assert.equal(sb[1].rank, 2);

    // b2 has 0 kills, 1 death -> kd 0.00, rank 3
    assert.equal(sb[2].id, 2);
    assert.equal(sb[2].kills, 0);
    assert.equal(sb[2].deaths, 1);
    assert.equal(sb[2].kd, '0.00');
    assert.equal(sb[2].rank, 3);

    // Reset clears kills and deaths
    ffa.reset();
    sb = ffa.getScoreboard();
    assert.equal(sb[0].kills, 0);
    assert.equal(sb[0].deaths, 0);
  });

  await t.test('Maximal dispersion spawn algorithm picks point furthest from enemies', () => {
    const spawns = [
      [-20, 0, -20],
      [0, 0, 0],
      [20, 0, 20]
    ];
    const ffa = new DeathmatchMode({ spawns, bounds: [-24, 24, -24, 24] });

    // Active combatant is located near [0, 0, 0] and [20, 0, 20]
    const enemy1 = { pos: { x: 0, y: 0, z: 0 }, alive: true };
    const enemy2 = { pos: { x: 19, y: 0, z: 19 }, alive: true };
    const spawner = { pos: { x: 0, y: 0, z: 0 } };

    const selected = ffa.getSpawnPoint(spawner, {
      combatants: [enemy1, enemy2],
      spawns,
      isPositionClear: () => true
    });

    // Best spawn should be [-20, 0, -20] because it is furthest from [0, 0, 0] and [19, 0, 19]
    assert.deepEqual(selected, { x: -20, y: 0, z: -20 });
  });
});

test('GameManager 3D Vertical Spawn Clearance (Rooftops & Platforms)', async (t) => {
  await t.test('A rooftop at y=4.8 with a 4.8m tall building underneath is recognized as clear standing surface', () => {
    const world = new CollisionWorld();
    // Add a building box from y=0 to y=4.8
    world.addBox(-5, 0, -5, 10, 4.8, 10, true, { material: 'concrete' });

    const gm = new GameManager({
      scene: new THREE.Scene(),
      world,
      player: null,
      weapons: null,
      bounds: [-25, 25, -25, 25]
    });

    // Trying to spawn inside the building (y=2.0) must FAIL
    const insideClear = gm._isPositionClear(0, 2.0, 0, 0.5, 0.5);
    assert.equal(insideClear, false, 'Inside the building volume must not be clear');

    // Spawning on top of the roof (y=4.8) must SUCCEED because the roof acts as floor support
    const roofClear = gm._isPositionClear(0, 4.8, 0, 0.5, 0.5);
    assert.equal(roofClear, true, 'Rooftop at y=4.8 must be recognized as valid clear standing surface');
  });
});

test('Mutual Bot-vs-Bot and Attacker Attribution in ProjectileManager', async (t) => {
  await t.test('Bot takes damage from another bot and attributes attacker properly', () => {
    const world = new CollisionWorld();
    const pm = new ProjectileManager(world);

    // Mock GameManager with FFA
    const gm = {
      isEnemy(a, b) { return a !== b && a?.alive && b?.alive; },
      canDamage(a, b) { return a !== b; }
    };
    pm.setGameManager(gm);

    const bot1 = {
      id: 1,
      alive: true,
      pos: { x: 0, y: 0, z: 0 },
      size: { x: 0.8, y: 1.8, z: 0.8 },
      hp: 100,
      takeDamage(dmg, part, attacker) {
        this.hp -= dmg;
        this.lastAttacker = attacker;
      }
    };

    const bot2 = {
      id: 2,
      alive: true,
      pos: { x: 0, y: 0, z: 10 },
      isPlayer: false
    };

    pm.botsProvider = () => [bot1, bot2];

    // Bot 2 shoots at Bot 1
    const origin = new THREE.Vector3(0, 1.0, 5);
    const dir = new THREE.Vector3(0, 0, -1);
    pm.spawn({
      origin,
      direction: dir,
      weaponDef: {
        ballistics: {
          terminal: { damage: 25, bulletSpeed: 700, maxRange: 500 }
        }
      },
      owner: 'bot',
      ownerEntity: bot2
    });

    // Step physics forward
    pm.update(0.05);

    assert.equal(bot1.hp < 100, true, 'Bot 1 should have taken damage from Bot 2');
    assert.equal(bot1.lastAttacker, bot2, 'Attacker should be attributed to Bot 2');
  });
});

test('Input and Scoreboard Action Mapping', () => {
  const input = new Input({ addEventListener: () => {} });

  assert.equal(input.bindings['Tab'], 'scoreboard');
  assert.equal(input.ACTION_ALIASES['scoreboard'], 'scoreboard');
  assert.equal(input._actionsRaw.scoreboard, false);

  input.pressAction('scoreboard');
  assert.equal(input.isActionPressed('scoreboard'), true);

  input.releaseAction('scoreboard');
  assert.equal(input.isActionPressed('scoreboard'), false);
});

test('High-Ground Sniper Behavior & Parapet Vaulting', async (t) => {
  await t.test('High-ground bot holds position when losing sight and only jumps on prolonged target loss', async () => {
    const { EngageState } = await import('../src/ai/states/EngageState.js');
    const state = new EngageState();

    const bot = {
      pos: { x: 0, y: 3.5, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      yaw: 0,
      hp: 100,
      onGround: true,
      lastMoveRes: {}
    };

    const targetBelow = {
      pos: { x: 0, y: 0.5, z: 10 }
    };

    let changedState = null;
    const controller = {
      bot,
      losTimer: 2.0,
      reactionTimer: 0,
      strafeTimer: 1.0,
      strafeDir: 1,
      desiredMove: { x: 0, y: 0, z: 0 },
      _faceTowards: () => {},
      changeState: (st) => { changedState = st; },
      navigateTo: () => {
        throw new Error('High ground bot should not navigate/walk off the ledge while holding position');
      }
    };

    // 1. Target briefly out of view (canSee = false), losTimer > 0
    state.update(controller, 0.5, targetBelow, 10, false);
    assert.equal(changedState, null, 'Should hold position without state change');
    assert.equal(controller.losTimer, 1.5, 'losTimer should decrement');
    assert.equal(bot.vel.y, 0, 'Should not jump yet');

    // 2. Prolonged loss of sight (losTimer decrements to <= 0)
    controller.losTimer = 0.2;
    state.update(controller, 0.3, targetBelow, 10, false);
    assert.equal(changedState, 'search', 'Should transition to search state');
    assert.equal(bot.vel.y, 6.0, 'Should jump the parapet (vel.y = 6.0) to descend and search');
  });

  await t.test('High-ground bot vaults parapet to flee when HP < 30%', async () => {
    const { EngageState } = await import('../src/ai/states/EngageState.js');
    const state = new EngageState();

    const bot = {
      pos: { x: 0, y: 3.5, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      yaw: 0,
      hp: 20, // Critical HP
      onGround: true
    };

    let changedState = null;
    const controller = {
      bot,
      changeState: (st) => { changedState = st; }
    };

    state.update(controller, 0.05, { pos: { x: 0, y: 0.5, z: 10 } }, 10, true);
    assert.equal(changedState, 'flee');
    assert.equal(bot.vel.y, 6.0, 'Should vault parapet with vel.y = 6.0 when fleeing from high ground');
  });
});

test('Vaulting Sweep Detection of Thin Obstacles', async (t) => {
  await t.test('tryVault detects thin obstacle (0.3m thick) directly in front of bot', async () => {
    const { AIController } = await import('../src/ai/AIController.js');
    const world = new CollisionWorld();
    // Add a thin sandbag / wall at x=1.5 to 1.8, y=0 to 1.0 (height 1.0m, vaultable)
    world.addBox(1.5, 0, -1, 0.3, 1.0, 2, true, { vaultable: true });

    const bot = {
      pos: { x: 1.0, y: 0, z: 0 }, // 0.5m away from the box
      vel: { x: 0, y: 0, z: 0 },
      yaw: Math.PI / 2, // Facing +X
      onGround: true,
      lastMoveRes: { hitWall: true }
    };

    const ai = new AIController(bot, world);
    ai.desiredMove.set(1.0, 0, 0);

    const vaulted = ai.tryVault();
    assert.equal(vaulted, true, 'Should detect thin obstacle and trigger vault');
    assert.equal(bot.vel.y, 6.0, 'Impulse should be 6.0');
    ai.destroy();
  });
});

test('Scoreboard Lifecycle & Event Sync', async (t) => {
  await t.test('Scoreboard emits score_update on bot respawn and registers alive status', () => {
    const world = new CollisionWorld();
    const gm = new GameManager({
      scene: new THREE.Scene(),
      world,
      player: {
        pos: { x: 0, y: 0.6, z: 0 },
        maxHp: 100,
        hp: 100,
        alive: true,
        isPlayer: true,
        setPosition: () => {}
      },
      bounds: [-20, 20, -20, 20]
    });

    let scoreUpdates = 0;
    const unsub = on('match:score_update', () => {
      scoreUpdates++;
    });

    const bot = gm.spawnBot(1);
    assert.ok(scoreUpdates > 0, 'spawnBot should emit match:score_update');

    // Kill bot
    bot.alive = false;
    gm.gameMode.onKill(gm.player, bot);

    let sb = gm.gameMode.getScoreboard();
    const botRow = sb.find(r => r.id === 1);
    assert.equal(botRow.alive, false, 'Killed bot must show alive: false');

    // Finalize respawn
    gm.finalizeBotRespawn(bot);
    sb = gm.gameMode.getScoreboard();
    const respawnedBotRow = sb.find(r => r.id === 1);
    assert.equal(respawnedBotRow.alive, true, 'Respawned bot must show alive: true');

    unsub();
    gm.destroy();
  });

  await t.test('GameMode onKill returns both isPlayerKiller and isPlayerAttacker matching true', () => {
    const ffa = new DeathmatchMode();
    const player = { id: 0, name: 'VOCÊ', badge: '🌟', isPlayer: true, alive: true };
    const bot = { id: 1, name: '#01 Viper', badge: '🪖', alive: false };

    ffa.registerCombatant(player);
    ffa.registerCombatant(bot);

    const killData = ffa.onKill({ killer: player, victim: bot, headshot: true, extra: { player } });
    assert.equal(killData.isPlayerKiller, true);
    assert.equal(killData.isPlayerAttacker, true);
    assert.equal(killData.isPlayerVictim, false);
  });
});

