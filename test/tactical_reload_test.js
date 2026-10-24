import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';
import { MagazineDrop } from '../src/weapons/MagazineDrop.js';
import { on } from '../src/core/EventBus.js';
import { Input } from '../src/core/Input.js';
import fs from 'node:fs';

if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.navigator) globalThis.navigator = { userAgent: '', maxTouchPoints: 0 };
if (!globalThis.addEventListener) globalThis.addEventListener = () => {};
if (!globalThis.document) globalThis.document = { addEventListener: () => {}, getElementById: () => null };

const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
rawData.ammo = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
initWeaponsFromData(rawData);

function createMockEnvironment(weaponId = 'ar15') {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const mount = new THREE.Group();
  const mockViewmodel = {
    mount,
    equip: () => {},
    triggerReload: () => {},
    updatePose: () => {},
    decayFlash: () => {},
  };
  const mockInput = {
    actions: { fire: false, ads: false, reload: false },
    _actions: {},
    consumeAction(name) {
      if (this._actions[name]) {
        this._actions[name] = false;
        return true;
      }
      return false;
    },
    isActionPressed() { return false; },
    press(name) { this._actions[name] = true; },
    clearReloadQueue() { this._actions = {}; }
  };
  const mockPlayer = {
    alive: true,
    sprinting: false,
    crouched: false,
    vel: new THREE.Vector3(),
    pos: new THREE.Vector3(0, 0, 0),
  };
  const mockWorld = {
    raycast: () => null,
  };

  const ws = new WeaponSystem({
    camera,
    viewmodel: mockViewmodel,
    input: mockInput,
    player: mockPlayer,
    world: mockWorld,
    botsProvider: () => [],
    inventory: [weaponId, null],
  });

  return { ws, mockInput, mockPlayer, mockViewmodel };
}

test('Tactical Reload - Speed Reload (Emergency Drop Mag < 1s)', () => {
  const { ws } = createMockEnvironment();
  assert.equal(ws.current, 'ar15');
  ws.ammo = 12; // 12 bullets left in magazine
  assert.equal(ws.getReserveMags('ar15'), 3);

  let droppedEvent = null;
  const unsubDrop = on('weapon:magazine_dropped', e => { droppedEvent = e; });

  ws.startReload('speed');
  assert.equal(ws.reloading, true);
  assert.equal(ws.reloadType, 'speed');
  assert.ok(ws.reloadDuration < 1.0, `Recarga simples rápida deve durar menos de 1s (atual: ${ws.reloadDuration}s)`);
  assert.equal(ws.ammo, 12);

  // Advance time to 40% of reload (ejection point)
  const dt = (ws.reloadDuration * 0.40);
  ws.update(dt);

  assert.ok(droppedEvent, 'Deve ter emitido evento de magazine_dropped');
  assert.equal(droppedEvent.ammoCount, 12, 'Carregador caído deve ter exatamente as 12 balas restantes');
  assert.equal(droppedEvent.weaponId, 'ar15');
  assert.equal(ws.getReserveMags('ar15'), 2, 'Deve ter consumido 1 carregador da reserva');
  assert.equal(ws.ammo, 0, 'Arma fica sem carregador após ejeção');

  // Advance to 85% of reload (insertion point)
  ws.update(ws.reloadDuration * 0.45);
  assert.equal(ws.ammo, WEAPONS.ar15.magSize, 'Munição restaurada após nova inserção');

  // Finish reload
  ws.update(ws.reloadDuration * 0.20);
  assert.equal(ws.reloading, false);

  unsubDrop();
});

test('Tactical Reload - Retention Reload with QTE Success Completes Immediately', () => {
  const { ws, mockInput } = createMockEnvironment();
  ws.ammo = 7;
  assert.equal(ws.getReserveMags('ar15'), 3);

  let qteStarted = false;
  let qteResult = null;
  let reloadEnded = false;
  const unsubStart = on('weapon:qte:start', () => { qteStarted = true; });
  const unsubRes = on('weapon:qte:result', e => { qteResult = e; });
  const unsubEnd = on('weapon:reload:end', () => { reloadEnded = true; });

  ws.startReload('tactical');
  assert.equal(ws.reloading, true);
  assert.equal(ws.reloadType, 'tactical');
  assert.equal(ws.reloadDuration, 4.0, 'Recarga tática com retenção dura 4s por padrão se errar o tempo');
  assert.ok(qteStarted, 'Deve ter iniciado QTE no HUD');
  assert.equal(ws.qteActive, true);

  // Advance to sweet spot (~55% of QTE)
  ws.update(ws.qteDuration * 0.55);
  mockInput.press('qte_interact');

  // Process input
  ws.update(0.01);
  assert.ok(qteResult, 'QTE deve ter emitido resultado');
  assert.equal(qteResult.success, true, 'Deve ter registrado acerto no QTE');
  assert.equal(ws.qteActive, false);
  assert.equal(ws.reloading, false, 'Recarga deve TERMINAR IMEDIATAMENTE ao acertar o tempo!');
  assert.equal(ws.ammo, WEAPONS.ar15.magSize, 'Arma imediatamente restaurada ao acertar o tempo');
  assert.ok(reloadEnded, 'Deve ter emitido weapon:reload:end');

  unsubStart();
  unsubRes();
  unsubEnd();
});

test('Tactical Reload - Retention Reload with QTE Failure Takes 4.0s', () => {
  const { ws } = createMockEnvironment();
  ws.ammo = 5;

  let qteResult = null;
  const unsubRes = on('weapon:qte:result', e => { qteResult = e; });

  ws.startReload('tactical');
  assert.equal(ws.reloadDuration, 4.0);

  // Let QTE expire without striking
  ws.update(ws.qteDuration * 1.05);
  assert.ok(qteResult);
  assert.equal(qteResult.success, false, 'Deve ter falhado o QTE por expiração');
  assert.equal(ws.reloading, true, 'Deve continuar a recarga lenta de 4s');

  // At 2.0s (50%), ammo is not yet restored
  assert.equal(ws.ammo, 5);

  // Advance past 78% (3.12s)
  ws.update(2.0);
  assert.equal(ws.ammo, WEAPONS.ar15.magSize, 'Munição restaurada aos 78% dos 4s');

  // Advance to 4.0s total
  ws.update(1.0);
  assert.equal(ws.reloading, false, 'Recarga completa após 4.0s');

  unsubRes();
});

test('Tactical Reload - Protection Against Zero Reserves Prevents Auto-Reload Click Loop', () => {
  const { ws } = createMockEnvironment('p9');
  ws.reserveMagsByWeapon['p9'] = 0;
  ws.ammo = 0;

  let emptyNotifiedCount = 0;
  const unsub = on('weapon:empty', () => { emptyNotifiedCount++; });

  // Simulate game loop running with 0 ammo and 0 reserves
  for (let i = 0; i < 30; i++) {
    ws.update(0.016);
  }

  assert.equal(ws.reloading, false, 'Não deve iniciar recarga sem reservas');
  assert.equal(emptyNotifiedCount, 0, 'Não deve ficar em loop infinito chamando weapon:empty a cada frame');

  unsub();
});

test('MagazineDrop - Lifecycle, Physics and Anti-Duplication Pickup', () => {
  const scene = new THREE.Scene();
  const magDrop = new MagazineDrop({
    scene,
    weaponId: 'ar15',
    ammoCount: 14,
    maxAmmo: 30,
    pos: { x: 2, y: 1.5, z: 2 }
  });

  assert.equal(magDrop.weaponId, 'ar15');
  assert.equal(magDrop.ammoCount, 14);
  assert.equal(magDrop.collected, false);

  // Simulate falling
  magDrop.update(0.1);
  assert.ok(magDrop.pos.y < 1.5, 'Carregador deve cair com gravidade');

  // Settle on floor
  for (let i = 0; i < 20; i++) magDrop.update(0.1);
  assert.equal(magDrop.isResting, true, 'Carregador deve repousar no chão');
  assert.equal(magDrop.pos.y, 0.05);

  // Check pickup proximity
  const farPlayer = { pos: new THREE.Vector3(10, 0, 10), alive: true };
  assert.equal(magDrop.checkPickup(farPlayer), false);

  const nearPlayer = { pos: new THREE.Vector3(2.2, 0, 2.1), alive: true };
  assert.equal(magDrop.checkPickup(nearPlayer), true);

  // Destroy on pickup
  magDrop.destroy();
  assert.equal(magDrop.collected, true);
  assert.equal(magDrop.checkPickup(nearPlayer), false, 'Não pode ser coletado novamente (anti-duplicação)');
});

test('Tactical Reload - Input Tap R triggers Speed Reload (< 1s)', () => {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const mockViewmodel = {
    mount: new THREE.Group(),
    equip: () => {},
    triggerReload: () => {},
    updatePose: () => {},
    decayFlash: () => {},
  };
  const input = new Input({ addEventListener: () => {} });
  const player = {
    alive: true,
    sprinting: false,
    crouched: false,
    vel: new THREE.Vector3(),
    pos: new THREE.Vector3(0, 0, 0),
  };
  const world = { raycast: () => null };

  const ws = new WeaponSystem({
    camera,
    viewmodel: mockViewmodel,
    input,
    player,
    world,
    botsProvider: () => [],
    inventory: ['ar15', null],
  });

  ws.ammo = 10;

  // Tap R: pressed and released in < 250ms
  input.pressAction('reload');
  input.releaseAction('reload');

  ws.update(0.016);
  assert.equal(ws.reloading, true, 'Deve iniciar recarga após soltar R');
  assert.equal(ws.reloadType, 'speed', 'Tap R deve iniciar Speed Reload');
  assert.ok(ws.reloadDuration < 1.0, 'Speed reload deve durar menos de 1s');
  assert.equal(ws.qteActive, false, 'Speed Reload não possui QTE');
});

test('Tactical Reload - Input Hold R triggers Tactical QTE, Needle Strike Finishes Instantly Without Secondary Reload', async () => {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const mockViewmodel = {
    mount: new THREE.Group(),
    equip: () => {},
    triggerReload: () => {},
    updatePose: () => {},
    decayFlash: () => {},
  };
  const input = new Input({ addEventListener: () => {} });
  const player = {
    alive: true,
    sprinting: false,
    crouched: false,
    vel: new THREE.Vector3(),
    pos: new THREE.Vector3(0, 0, 0),
  };
  const world = { raycast: () => null };

  const ws = new WeaponSystem({
    camera,
    viewmodel: mockViewmodel,
    input,
    player,
    world,
    botsProvider: () => [],
    inventory: ['p9', null],
  });

  ws.ammo = 4;

  // 1. Hold R: Key pressed down
  input.pressAction('reload');

  for (let i = 0; i < 4; i++) {
    input.consumeMouseDelta();
    ws.update(0.016);
  }
  assert.equal(ws.reloading, false, 'Não deve disparar recarga antes dos 250ms de hold');

  // 2. Wait until hold timer triggers (260ms)
  await new Promise(r => setTimeout(r, 260));
  ws.update(0.016);

  assert.equal(ws.reloading, true, 'Deve iniciar recarga após segurar R por >= 250ms');
  assert.equal(ws.reloadType, 'tactical', 'Segurar R deve ativar Tactical Retention Reload');
  assert.equal(ws.reloadDuration, 4.0, 'Duração padrão é 4s se não acertar');
  assert.equal(ws.qteActive, true, 'Minigame QTE deve estar ativo');

  // 3. Releasing initial hold does NOT start speed reload
  input.releaseAction('reload');
  ws.update(0.016);
  assert.equal(ws.reloadType, 'tactical');

  // 4. Advance QTE to sweet spot (55% of duration)
  ws.update(ws.qteDuration * 0.55);
  assert.ok(ws.qteProgress >= ws.qteSweetSpotStart && ws.qteProgress <= ws.qteSweetSpotEnd, 'Agulha na zona de sucesso');

  // 5. Strike R during sweet spot
  input.pressAction('reload');
  ws.update(0.016);

  assert.equal(ws.qteSuccess, true, 'Deve registrar acerto na agulha');
  assert.equal(ws.qteActive, false, 'QTE encerra após acerto');
  assert.equal(ws.reloading, false, 'Recarga deve finalizar imediatamente ao acertar o tempo!');
  assert.equal(ws.ammo, WEAPONS.p9.magSize, 'Munição da P9 cheia');

  // 6. Release R after the QTE strike - MUST NOT trigger another reload!
  input.releaseAction('reload');
  ws.update(0.016);
  assert.equal(ws.reloading, false, 'Não deve engatilhar uma segunda recarga fantasma ao soltar R do QTE');
});
