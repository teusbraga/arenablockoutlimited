import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';
import { MagazineDrop } from '../src/weapons/MagazineDrop.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { TouchInput } from '../src/core/TouchInput.js';
import { Bot } from '../src/entities/Bot.js';
import { GameManager } from '../src/core/GameManager.js';
import { emit, on } from '../src/core/EventBus.js';
import fs from 'fs';

// Setup DOM mocks if headless
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.document) {
  globalThis.document = {
    getElementById: () => null,
    addEventListener: () => {}
  };
}

describe('Phase 3 - Bug Fixes & Mechanical Stability', () => {
  // Inicializa banco de armas para testes
  const weaponsJson = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
  const ammoJson = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
  initWeaponsFromData(weaponsJson.weapons, ammoJson.ammo);

  it('1. WeaponSystem: Trava de troca de arma, recarga e firemode durante morte', () => {
    const mockPlayer = {
      alive: false,
      pos: new THREE.Vector3(0, 0, 0),
      prevPos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      ads: false,
      sprinting: false
    };

    const mockViewmodel = {
      registerModel: () => {},
      update: () => {},
      applyKick: () => {},
      flash: () => {},
      triggerFire: () => {},
      startReload: () => {}
    };

    const mockInput = {
      actions: { fire: false, ads: false },
      consumeAction: () => false,
      isActionPressed: () => false
    };

    const ws = new WeaponSystem({
      camera: new THREE.PerspectiveCamera(),
      viewmodel: mockViewmodel,
      input: mockInput,
      player: mockPlayer,
      world: new CollisionWorld()
    });

    ws.slots = ['ar15', 'ak47'];
    ws.currentSlot = 0;
    ws.current = 'ar15';
    ws.fireModeByWeapon = { ar15: 'auto', ak47: 'auto' };

    // Tentativa de troca durante a morte: deve ser bloqueada
    ws.selectSlot(1);
    assert.strictEqual(ws.currentSlot, 0, 'Slot não deve mudar com jogador morto');

    ws.cycle();
    assert.strictEqual(ws.currentSlot, 0, 'Cycle não deve mudar slot com jogador morto');

    // Tentativa de recarga durante a morte
    ws.ammo = 10;
    ws.startReload('speed');
    assert.strictEqual(ws.reloading, false, 'Recarga não deve iniciar com jogador morto');

    // Tentativa de alternar modo de disparo
    const initialMode = ws.fireModeByWeapon['ar15'] || 'auto';
    ws.toggleFireMode();
    assert.strictEqual(ws.fireModeByWeapon['ar15'], initialMode, 'Modo de disparo não deve alternar');

    // Quando o jogador revive, os métodos voltam a operar
    mockPlayer.alive = true;
    ws.selectSlot(1);
    assert.strictEqual(ws.currentSlot, 1, 'Slot deve mudar após o jogador reviver');
    ws.destroy();
  });

  it('2. CameraRig: Recoil Climbing Recovery elástico e compensação manual', () => {
    const rig = new CameraRig();
    rig.setOrientation(0, 0);

    // Injeta impulso de recuo (climbPitch = 0.05)
    rig.addRecoilImpulse({ climbPitch: 0.05 });
    assert.strictEqual(rig.targetPitch, 0.05, 'Target pitch deve subir com recoil climb');
    assert.strictEqual(rig.recoilClimbPitch, 0.05, 'Acumulador de climb deve rastrear o valor');

    // Simula frame imediato dentro do recovery delay (t = 0.04s < 0.08s)
    const mockPlayer = {
      ads: false,
      activeWeaponWeight: 3.5,
      alive: true,
      onGround: true,
      vel: { x: 0, y: 0, z: 0 },
      pos: { x: 0, y: 0, z: 0 },
      renderPos: { x: 0, y: 0, z: 0 }
    };
    rig.update(0.04, mockPlayer);
    assert.strictEqual(rig.recoilClimbPitch, 0.05, 'Não deve recuperar antes do delay');

    // Simula frames após o delay (cessou fogo) -> recuperação gradual
    rig.update(0.1, mockPlayer);
    assert.ok(rig.recoilClimbPitch < 0.05, 'Climb pendente deve diminuir');
    assert.ok(rig.targetPitch < 0.05, 'Target pitch deve suavizar de volta para baixo');

    // Simula puxada de mouse para baixo (compensação ativa)
    rig.recoilClimbPitch = 0.04;
    rig.addMouseInput(0, 15, 0.002); // dy = 15 -> pitchDelta = 0.03
    assert.ok(rig.recoilClimbPitch < 0.04, 'Movimento do mouse para baixo deve consumir climb pendente');
  });

  it('3. MagazineDrop: Bloqueio de coleta em andares diferentes (Delta Y)', () => {
    const mag = new MagazineDrop({
      weaponId: 'ar15',
      ammoCount: 30,
      pos: { x: 5, y: 0.1, z: 5 }
    });

    const characterGround = {
      alive: true,
      pos: { x: 5.2, y: 0.1, z: 5.1 }
    };

    const characterUpperFloor = {
      alive: true,
      pos: { x: 5.2, y: 4.0, z: 5.1 } // 4 metros acima no mezanino
    };

    assert.strictEqual(mag.checkPickup(characterGround), true, 'Deve permitir coleta no mesmo nível');
    assert.strictEqual(mag.checkPickup(characterUpperFloor), false, 'Deve bloquear coleta através de andares');
    mag.destroy();
  });

  it('4. GameManager: Seleção contextual do carregador mais próximo', () => {
    const world = new CollisionWorld();
    world.addBox(0, -0.5, 0, 50, 1, 50);

    const mockPlayer = {
      pos: new THREE.Vector3(0, 0, 0),
      alive: true
    };

    const gm = new GameManager({
      scene: new THREE.Scene(),
      world,
      player: mockPlayer,
      weapons: null
    });
    gm.hasStarted = true;

    // Spawna dois carregadores: um a 1.2m e outro a 0.4m
    const magFar = new MagazineDrop({
      weaponId: 'ar15',
      ammoCount: 30,
      pos: { x: 0, y: 0.1, z: 1.2 }
    });

    const magClose = new MagazineDrop({
      weaponId: 'ak47',
      ammoCount: 30,
      pos: { x: 0, y: 0.1, z: 0.4 }
    });

    gm.magazineDrops.push(magFar, magClose);

    let capturedTarget = null;
    const unsub = on('interact:target', e => {
      capturedTarget = e.target;
    });

    gm.update(0.016);
    unsub();

    assert.strictEqual(capturedTarget, magClose, 'Deve priorizar o carregador mais próximo do jogador');
    magFar.destroy();
    magClose.destroy();
  });

  it('5. TouchInput: Vibração mobile data-driven e cleanup', () => {
    let vibeCalledWith = null;
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: (pattern) => {
        vibeCalledWith = pattern;
      },
      writable: true,
      configurable: true
    });

    const touch = new TouchInput({});
    CONFIG.ACCESSIBILITY.vibrationEnabled = true;

    touch.vibrate(18);
    assert.strictEqual(vibeCalledWith, 18, 'Deve disparar navigator.vibrate quando habilitado');

    // Desabilita vibração
    CONFIG.ACCESSIBILITY.vibrationEnabled = false;
    vibeCalledWith = null;
    touch.vibrate(25);
    assert.strictEqual(vibeCalledWith, null, 'Não deve vibrar com vibrationEnabled = false');

    // Reabilita e testa via evento
    CONFIG.ACCESSIBILITY.vibrationEnabled = true;
    emit('weapon:empty', {});
    assert.strictEqual(vibeCalledWith, 35, 'Deve vibrar em resposta a weapon:empty');

    touch.destroy();
    vibeCalledWith = null;
    emit('weapon:empty', {});
    assert.strictEqual(vibeCalledWith, null, 'Após destroy(), listeners de vibração devem ser removidos');
  });

  it('6. AIController: Cone de visão (FOV) e detecção por passos', () => {
    const world = new CollisionWorld();
    world.addBox(0, -0.5, 0, 50, 1, 50);

    const bot = new Bot(1, world, null, 'soldier', 'ar15');
    bot.pos.set(0, 0, 0);
    bot.yaw = 0; // Olhando para +Z (em frente)
    bot.ai.state = 'patrol';

    // Jogador à frente (Z = +10m, dentro do FOV)
    const playerInFront = {
      alive: true,
      pos: new THREE.Vector3(0, 0, 10)
    };
    assert.strictEqual(bot.ai._hasLOS(playerInFront, 10), true, 'Deve avistar jogador à frente');

    // Jogador atrás (Z = -10m, fora do FOV)
    const playerBehind = {
      alive: true,
      pos: new THREE.Vector3(0, 0, -10)
    };
    assert.strictEqual(bot.ai._hasLOS(playerBehind, 10), false, 'Não deve avistar jogador atrás (fora do FOV)');

    // Jogador atrás a curta distância (Z = -2m <= 3.0m, detecção sonora)
    const playerCloseBehind = {
      alive: true,
      pos: new THREE.Vector3(0, 0, -2)
    };
    assert.strictEqual(bot.ai._hasLOS(playerCloseBehind, 2), true, 'Deve detectar jogador próximo por passos/ruído');

    bot.destroy();
  });
});
