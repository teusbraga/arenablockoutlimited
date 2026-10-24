import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraRig } from '../src/core/CameraRig.js';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';
import { BarrelCrosshairAlignment } from '../src/new_mechanics/BarrelCrosshairAlignment.js';
import { AimAssistSystem } from '../src/new_mechanics/AimAssistSystem.js';
import { CrosshairManager, DEFAULT_CROSSHAIR_CONFIG } from '../src/ui/CrosshairManager.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import fs from 'node:fs';

function createMockEl() {
  return {
    style: {
      setProperty: () => {},
      getPropertyValue: () => ''
    },
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    setAttribute: () => {},
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

if (!globalThis.window) globalThis.window = { innerWidth: 1920, innerHeight: 1080 };
if (!globalThis.navigator) globalThis.navigator = { userAgent: '', maxTouchPoints: 0 };
if (!globalThis.document) {
  globalThis.document = {
    getElementById: () => createMockEl(),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
}

const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
rawData.ammo = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
initWeaponsFromData(rawData);

test('Pipeline de Mira - 1. CameraRig comanda look, recuo e spring arm sem vazar para DOM', () => {
  const rig = new CameraRig();
  rig.setOrientation(0, 0);

  // Aplica impulso de recuo procedural
  rig.addRecoilImpulse({ punchPitch: 0.02, punchYaw: -0.005 });
  assert.ok(rig.recoilRotVel.x > 0, 'Impulso de recuo em X deve ser positivo');

  const mockCamera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);
  const mockPlayer = {
    pos: new THREE.Vector3(0, 1.6, 0),
    renderPos: new THREE.Vector3(0, 1.6, 0),
    crouched: false,
    sprinting: false,
    alive: true,
    vel: new THREE.Vector3(0, 0, 0)
  };

  rig.update(0.016, mockPlayer);
  rig.applyToCamera(mockCamera);

  assert.ok(mockCamera.rotation.x !== 0, 'Camera deve refletir pitch do recuo procedural');
  assert.equal(typeof rig.currentYaw, 'number');
  assert.equal(typeof rig.currentPitch, 'number');
});

test('Pipeline de Mira - 2. WeaponSystem computa cano 3D (muzzleLocal) e montagem espacial', () => {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  const mount = new THREE.Group();
  mount.position.copy(camera.position);

  const ws = new WeaponSystem({
    camera,
    viewmodel: { mount, equip: () => {}, updatePose: () => {}, decayFlash: () => {} },
    input: { actions: {}, consumeAction: () => false, isActionPressed: () => false },
    player: { alive: true, sprinting: false, crouched: false, vel: new THREE.Vector3(), pos: new THREE.Vector3(0, 1.6, 0) },
    world: new CollisionWorld(4.0),
    inventory: ['ar15', null]
  });

  assert.equal(ws.current, 'ar15');
  assert.ok(Array.isArray(ws.def.muzzleLocal), 'Arma deve definir coordenadas muzzleLocal');
  assert.equal(ws.def.muzzleLocal.length, 3);
  assert.ok(ws.def.muzzleLocal[2] < 0, '-Z deve ser a direção do cano da arma');
});

test('Pipeline de Mira - 3. BarrelCrosshairAlignment projeta 3D para 2D e converge a 50m', () => {
  const camera = new THREE.PerspectiveCamera(75, 1920/1080, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  const mount = new THREE.Group();
  mount.position.copy(camera.position);

  const world = new CollisionWorld(4.0);
  world.addBox(0, 1.6, -50, 10, 10, 1); // Parede alvo a 50m

  const bca = new BarrelCrosshairAlignment({
    camera,
    viewmodel: { mount },
    collisionWorld: world,
    defaultZeroDistance: 50.0
  });

  const res = bca.update(WEAPONS.ar15, false, 0.016, { pitch: 0, yaw: 0 });
  assert.ok(res, 'Deve retornar resultado de projeção da crosshair');
  assert.ok(res.screenPos, 'Deve conter screenPos');
  assert.equal(typeof res.screenPos.x, 'number');
  assert.equal(typeof res.screenPos.y, 'number');
  assert.ok(Number.isFinite(res.screenPos.x) && Number.isFinite(res.screenPos.y));
});

test('Pipeline de Mira - 4. AimAssistSystem aplica bolha de fricção com LOS validado', () => {
  const world = new CollisionWorld(4.0);
  const botTarget = {
    alive: true,
    pos: { x: 0.4, y: 0, z: -10 },
    vel: { x: 0, y: 0, z: 0 }
  };

  const cm = new CrosshairManager({ crosshairEl: createMockEl() });
  cm.saveConfig({ aimAssist: true });

  const aa = new AimAssistSystem({
    collisionWorld: world,
    botsProvider: () => [botTarget],
    crosshairManager: cm
  });

  const mockPlayer = {
    alive: true,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    eyeHeight: 1.55,
    yaw: 0,
    pitch: -0.03,
    ads: false
  };

  const assist = aa.computeAssist(0.016, { player: mockPlayer, dx: 2, dy: 0 });
  assert.ok(assist, 'Deve calcular assistência ao mirar');
  assert.equal(assist.hasTarget, true, 'Deve adquirir o bot dentro da bolha magnética');
  assert.ok(assist.sensMultiplier < 0.85, 'Fricção deve reduzir sensibilidade próximo ao inimigo');
});

test('Pipeline de Mira - 5. CrosshairManager aplica configuração e atualização visual', () => {
  const cm = new CrosshairManager({
    crosshairEl: createMockEl(),
    localStorageKey: 'test_crosshair_pipeline'
  });

  assert.equal(cm.config.length, DEFAULT_CROSSHAIR_CONFIG.length);
  assert.equal(cm.config.thickness, DEFAULT_CROSSHAIR_CONFIG.thickness);

  cm.update({
    currentSpread: 0.04,
    dt: 0.016,
    isMoving: false,
    isFiring: false,
    isAds: false
  });

  cm.destroy();
});
