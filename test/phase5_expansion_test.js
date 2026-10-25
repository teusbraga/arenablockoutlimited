import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import { GameManager } from '../src/core/GameManager.js';
import { Input } from '../src/core/Input.js';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { emit, on } from '../src/core/EventBus.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import fs from 'fs';

// Setup DOM mocks for headless environment
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.document) {
  globalThis.document = {
    getElementById: () => null,
    addEventListener: () => {}
  };
}

describe('Phase 5 - Continuous Expansion & Antifragility', () => {
  // Carrega e compila catalogo de armas data-driven
  const weaponsJson = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
  const ammoJson = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
  initWeaponsFromData({ weapons: weaponsJson.weapons, ammo: ammoJson.ammo });

  const mockViewmodel = {
    registerModel: () => {},
    update: () => {},
    applyKick: () => {},
    flash: () => {},
    triggerFire: () => {},
    startReload: () => {},
    equip: () => {}
  };

  const mockInput = {
    actions: { fire: false, ads: false },
    consumeAction: () => false,
    isActionPressed: () => false
  };

  it('1. WeaponSystem: Trava de Loadout bloqueia troca de arma no meio da partida', () => {
    const mockPlayer = {
      alive: true,
      pos: new THREE.Vector3(0, 0, 0),
      prevPos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      ads: false,
      sprinting: false
    };

    const ws = new WeaponSystem({
      camera: new THREE.PerspectiveCamera(),
      viewmodel: mockViewmodel,
      input: mockInput,
      player: mockPlayer,
      world: new CollisionWorld(),
      botsProvider: () => []
    });

    ws.slots = ['ar15', 'p9'];
    ws._equip('ar15');
    assert.strictEqual(ws.slots[0], 'ar15');
    assert.strictEqual(ws.loadoutLocked, false);

    // Antes da partida iniciar: setSlot altera a arma imediatamente
    const changePre = ws.setSlot(0, 'ak47');
    assert.strictEqual(changePre, true, 'Deve permitir troca no menu pré-partida');
    assert.strictEqual(ws.slots[0], 'ak47');

    // Partida inicia: loadout é travado
    ws.setLoadoutLocked(true);
    assert.strictEqual(ws.loadoutLocked, true);

    // Tentativa de troca mid-game é bloqueada e enfileirada em pendingSlots
    const changeMid = ws.setSlot(0, 'm249');
    assert.strictEqual(changeMid, false, 'Deve recusar troca no meio do combate');
    assert.strictEqual(ws.slots[0], 'ak47', 'Arma ativa não deve ter sido alterada');
    assert.strictEqual(ws.pendingSlots[0], 'm249', 'Arma requisitada deve estar enfileirada');

    // Com force = true (ex: reinício/admin), a trava é contornada
    const changeForced = ws.setSlot(0, 'scar_h', true);
    assert.strictEqual(changeForced, true, 'force=true deve aplicar imediatamente');
    assert.strictEqual(ws.slots[0], 'scar_h');

    ws.destroy();
  });

  it('2. WeaponSystem & GameManager: Aplicação automática de loadout pendente no reinício da partida', () => {
    const mockPlayer = {
      alive: true,
      maxHp: 100,
      hp: 100,
      pos: new THREE.Vector3(0, 0, 0),
      prevPos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      setPosition: () => {},
      ads: false,
      sprinting: false
    };

    const ws = new WeaponSystem({
      camera: new THREE.PerspectiveCamera(),
      viewmodel: mockViewmodel,
      input: mockInput,
      player: mockPlayer,
      world: new CollisionWorld(),
      botsProvider: () => []
    });

    ws.slots = ['ar15', 'p9'];
    ws._equip('ar15');

    const gm = new GameManager({
      scene: new THREE.Scene(),
      world: new CollisionWorld(),
      player: mockPlayer,
      weapons: ws,
      hud: { showDeathScreen: () => {}, showRoundOver: () => {} },
      bounds: [-50, 50, -50, 50],
      playerSpawn: [0, 0.1, 10],
      botSpawns: []
    });

    // Inicia a partida via gm.startMatch()
    gm.startMatch();
    assert.strictEqual(gm.hasStarted, true);
    assert.strictEqual(ws.loadoutLocked, true, 'GameManager deve travar o loadout ao iniciar partida');

    // Jogador altera a secundária no menu durante a partida
    ws.setSlot(1, 'sw500');
    assert.strictEqual(ws.slots[1], 'p9', 'Secundária não deve mudar em jogo');
    assert.strictEqual(ws.pendingSlots[1], 'sw500', 'Nova secundária foi enfileirada');
    assert.strictEqual(ws.hasPendingLoadout(), true);

    // Reinicia a partida
    gm.resetGame();

    assert.strictEqual(ws.slots[1], 'sw500', 'Ao reiniciar o jogo, a arma pendente deve ser aplicada');
    assert.strictEqual(ws.pendingSlots[1], null, 'Fila de pendência deve ser limpa');
    assert.strictEqual(ws.hasPendingLoadout(), false);

    gm.destroy();
    ws.destroy();
  });

  it('3. Input: Cheats via digitação de teclas bloqueados quando DEV_MODE = false', () => {
    const mockCanvas = { addEventListener: () => {} };
    
    // Assegura que DEV_MODE está desativado
    CONFIG.DEV_MODE = false;

    let keydownHandler = null;
    const originalAdd = globalThis.addEventListener;
    globalThis.addEventListener = (type, fn) => {
      if (type === 'keydown') keydownHandler = fn;
    };

    let activatedCheat = null;
    const unsub = on('cheat:activated', e => {
      activatedCheat = e.cheat;
    });

    try {
      const input = new Input(mockCanvas);
      assert.ok(keydownHandler, 'Listener de keydown deve ser registrado');

      // Simula digitação da sequência "whoami" durante gameplay
      const keys = ['w', 'h', 'o', 'a', 'm', 'i'];
      for (const k of keys) {
        keydownHandler({
          key: k,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          code: `Key${k.toUpperCase()}`,
          preventDefault: () => {}
        });
      }

      assert.strictEqual(activatedCheat, null, 'Digitar cheat durante gameplay sem DEV_MODE NÃO deve ativar cheat');

      // Agora ativa CONFIG.DEV_MODE = true e digita novamente
      CONFIG.DEV_MODE = true;
      for (const k of keys) {
        keydownHandler({
          key: k,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          code: `Key${k.toUpperCase()}`,
          preventDefault: () => {}
        });
      }

      assert.strictEqual(activatedCheat, 'whoami', 'Com DEV_MODE ativo, a digitação deve disparar o cheat');

      // Acionamento direto via método programmatico funciona independente de buffer de teclas
      activatedCheat = null;
      input.triggerCheat('whoami');
      assert.strictEqual(activatedCheat, 'whoami', 'triggerCheat deve funcionar via chamada direta de UI/console');

      input.destroy();
    } finally {
      unsub();
      globalThis.addEventListener = originalAdd;
      CONFIG.DEV_MODE = false;
    }
  });

  it('4. GameManager: Teardown completo e destruição sem vazamento de entidades ou traps', () => {
    const mockPlayer = {
      alive: true,
      maxHp: 100,
      hp: 100,
      pos: new THREE.Vector3(0, 0, 0),
      prevPos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      setPosition: () => {}
    };

    const ws = new WeaponSystem({
      camera: new THREE.PerspectiveCamera(),
      viewmodel: mockViewmodel,
      input: mockInput,
      player: mockPlayer,
      world: new CollisionWorld(),
      botsProvider: () => []
    });

    const gm = new GameManager({
      scene: new THREE.Scene(),
      world: new CollisionWorld(),
      player: mockPlayer,
      weapons: ws,
      hud: { showDeathScreen: () => {}, showRoundOver: () => {} },
      bounds: [-50, 50, -50, 50],
      playerSpawn: [0, 0.1, 10],
      botSpawns: []
    });

    gm.startMatch();
    assert.strictEqual(gm.hasStarted, true);
    assert.strictEqual(ws.loadoutLocked, true);

    // Mock drop & mock door
    let dropDestroyed = false;
    gm.itemDrops.push({
      destroy: () => { dropDestroyed = true; }
    });

    let doorDestroyed = false;
    gm.doors.push({
      destroy: () => { doorDestroyed = true; }
    });

    // Executa teardown
    gm.destroy();

    assert.strictEqual(gm.hasStarted, false, 'hasStarted deve ser resetado');
    assert.strictEqual(ws.loadoutLocked, false, 'Loadout deve ser destravado na desmontagem');
    assert.strictEqual(dropDestroyed, true, 'Item drops devem ser destruídos no teardown');
    assert.strictEqual(doorDestroyed, true, 'Doors devem ser destruídas no teardown');
    assert.strictEqual(gm.itemDrops.length, 0);
    assert.strictEqual(gm.doors.length, 0);

    ws.destroy();
  });
});
