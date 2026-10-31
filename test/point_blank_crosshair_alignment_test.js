import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';
import { BarrelCrosshairAlignment } from '../src/new_mechanics/BarrelCrosshairAlignment.js';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';

// Inicializa dados de armas
const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
rawData.ammo = JSON.parse(fs.readFileSync('assets/weapons/ammo.json', 'utf8'));
initWeaponsFromData(rawData);

test('Alinhamento Dinâmico a Queima-Roupa - HK416 & P-9 contra Paredes (0.05m a 2.0m)', () => {
  const world = new CollisionWorld(4.0);
  // Parede estática com face frontal em z = -1.5
  world.addBox(0, 2, -2, 10, 4, 1);

  const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 1000);
  const mount = new THREE.Group();
  camera.add(mount);

  for (const wepId of ['ar15', 'p9']) {
    const def = WEAPONS[wepId];

    // Testa distâncias variando de 2.0m até queima-roupa extremo (0.05m da face da parede)
    for (const distToWall of [2.0, 1.0, 0.6, 0.4, 0.35, 0.31, 0.30, 0.25, 0.15, 0.05]) {
      camera.position.set(0, 1.6, -1.5 + distToWall);
      camera.lookAt(0, 1.6, -10);
      camera.updateMatrixWorld(true);

      const barrelLength = def?.barrelLength || (def?.type === 'pistol' ? 0.32 : 0.55);
      const safetyBuffer = 0.18;
      const maxDetectionDist = barrelLength + safetyBuffer;
      const wallHit = world.raycast(camera.position, new THREE.Vector3(0, 0, -1), maxDetectionDist);
      const hitDist = wallHit ? wallHit.distance : Infinity;
      let wallCompression = 0;
      if (wallHit && hitDist < maxDetectionDist) {
        wallCompression = Math.max(0, Math.min(1.0, (maxDetectionDist - hitDist) / Math.max(0.15, safetyBuffer)));
      }

      mount.position.set(def.hipPos[0], def.hipPos[1], def.hipPos[2]);
      mount.rotation.set(def.hipRot[0], def.hipRot[1], def.hipRot[2]);
      if (wallCompression > 0.001) {
        mount.position.z += wallCompression * 0.20;
        mount.position.y += wallCompression * 0.08;
        mount.position.x -= wallCompression * 0.03;
        mount.rotation.x += wallCompression * 1.31;
        mount.rotation.y -= wallCompression * 0.26;
        mount.rotation.z += wallCompression * 0.12;
      }
      mount.updateMatrixWorld(true);

      const bca = new BarrelCrosshairAlignment({
        camera,
        viewmodel: { mount, kickRotX: 0 },
        collisionWorld: world,
        defaultZeroDistance: 50.0
      });

      // Assenta a interpolação do primeiro frame
      for (let t = 0; t < 10; t++) {
        bca.update(def, false, 0.016);
      }

      // 1. Deve adquirir target físico na parede (sem descartar por corte arbitrário <= 0.3m)
      assert.equal(bca.hasTarget, true, `${wepId} a ${distToWall}m deve ter hasTarget = true`);
      assert.ok(bca.distanceToTarget < 50.0, `${wepId} a ${distToWall}m não pode usar fallback de 50m`);

      // 2. Coordenadas de tela devem ser estritamente números válidos e finitos
      assert.ok(Number.isFinite(bca.screenPos.x));
      assert.ok(Number.isFinite(bca.screenPos.y));
      assert.ok(Number.isFinite(bca.pureScreenPos.x));
      assert.ok(Number.isFinite(bca.pureScreenPos.y));

      // 3. O ponto 3D do alvo deve estar exatamente na face da parede (z = -1.5)
      assert.ok(Math.abs(bca.aimPointWorld.z - (-1.5)) < 0.001, `Impacto z deve ser -1.5 na parede, obteve ${bca.aimPointWorld.z}`);
    }
  }
});

test('Alinhamento Dinâmico a Queima-Roupa - Pilar de Grid (Cenário do Screenshot do Usuário)', () => {
  const world = new CollisionWorld(4.0);
  // Pilar concreto escuro em (-4, 0, 30) de grid.json (base y=0, altura 2, x: -4.3..-3.7, z: 29.7..30.3)
  world.addBox(-4, 1, 30, 0.6, 2, 0.6);

  const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 1000);
  const mount = new THREE.Group();
  camera.add(mount);

  // Jogador colado no pilar: x = -4, olho y = 1.6, z = 30.6 (a 30cm da face frontal z = 30.3)
  camera.position.set(-4, 1.6, 30.6);
  camera.lookAt(-4, 1.6, 20.6);
  camera.updateMatrixWorld(true);

  const ar15Def = WEAPONS.ar15;
  mount.position.set(ar15Def.hipPos[0], ar15Def.hipPos[1], ar15Def.hipPos[2]);
  mount.rotation.set(0, 0, 0);
  mount.updateMatrixWorld(true);

  const bca = new BarrelCrosshairAlignment({
    camera,
    viewmodel: { mount, kickRotX: 0 },
    collisionWorld: world,
    defaultZeroDistance: 50.0
  });

  for (let t = 0; t < 10; t++) {
    bca.update(ar15Def, false, 0.016);
  }

  // A face do pilar está em z = 30.3. O bocal da AR15 (alcance 0.81m) penetra a face.
  // O sistema robusto deve detectar a face frontal (z = 30.3) via backup raycast
  assert.equal(bca.hasTarget, true, 'Deve encontrar a face do pilar mesmo com penetração do cano');
  assert.ok(Math.abs(bca.aimPointWorld.z - 30.3) < 0.001, `Impacto deve ser na face z=30.3, obteve ${bca.aimPointWorld.z}`);
  assert.ok(bca.screenPos.y > 0 && bca.screenPos.y < 1080, `Crosshair deve estar dentro da tela, obteve y=${bca.screenPos.y}`);
});

test('Alinhamento Dinâmico e Disparo em WeaponSystem - Match de Projétil a Queima-Roupa', () => {
  const world = new CollisionWorld(4.0);
  world.addBox(0, 1.6, -1.5, 5, 5, 0.5); // Face frontal em z = -1.25

  const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 1000);
  camera.position.set(0, 1.6, 0); // 1.25m da face da parede
  camera.lookAt(0, 1.6, -10);
  camera.updateMatrixWorld(true);

  const mount = new THREE.Group();
  camera.add(mount);
  mount.position.set(WEAPONS.ar15.hipPos[0], WEAPONS.ar15.hipPos[1], WEAPONS.ar15.hipPos[2]);
  mount.rotation.set(0, 0, 0);
  mount.updateMatrixWorld(true);

  const bca = new BarrelCrosshairAlignment({
    camera,
    viewmodel: { mount, kickRotX: 0 },
    collisionWorld: world,
    defaultZeroDistance: 50.0
  });

  const mockInput = { isDown: () => false, isPressed: () => false, actions: { fire: true }, consumeAction: () => {} };
  const mockPlayer = {
    pos: new THREE.Vector3(0, 0, 0),
    prevPos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),
    pitch: 0,
    yaw: 0,
    rig: null,
    recoilModifier: 1.0,
    sprinting: false
  };

  const ws = new WeaponSystem({
    camera,
    viewmodel: { mount, equip: () => {}, updatePose: () => {}, decayFlash: () => {}, applyKick: () => {}, flash: () => {}, triggerFire: () => {} },
    input: mockInput,
    player: mockPlayer,
    world,
    inventory: ['ar15', null],
    hud: {
      crosshairManager: {
        config: { dynamicAlignment: true, followRecoil: true }
      }
    }
  });
  ws.barrelAlignment = bca;

  // Disparo em modo dinâmico
  ws.fireCooldown = 0;
  ws.update(0.016);
  bca.update(ws.def, false, 0.016, ws.sprayRecoil);

  // Projeta o ponto de impacto do projétil na tela e compara com a crosshair
  const hitPoint = bca.aimPointWorld;
  const proj = hitPoint.clone().project(camera);
  const impactScreenX = (proj.x * 0.5 + 0.5) * 1920;
  const impactScreenY = (-(proj.y * 0.5) + 0.5) * 1080;

  const errorDist = Math.hypot(impactScreenX - bca.screenPos.x, impactScreenY - bca.screenPos.y);
  assert.ok(errorDist < 2.0, `Crosshair deve coincidir perfeitamente com impacto a queima-roupa (erro: ${errorDist.toFixed(2)}px)`);

  ws.destroy();
});

test('Alinhamento Dinâmico - Penetração de Cano e Proteção de Bounding na Tela', () => {
  const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 1000);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -10);
  camera.updateMatrixWorld(true);

  const mount = new THREE.Group();
  camera.add(mount);
  mount.position.set(0.12, -0.13, -0.28);
  mount.updateMatrixWorld(true);

  const bca = new BarrelCrosshairAlignment({
    camera,
    viewmodel: { mount, kickRotX: 0 },
    collisionWorld: { raycast: () => null },
    defaultZeroDistance: 50.0
  });

  // 1. Simula boca do cano penetrando 4cm dentro da superfície (z = -0.54 vs superfície em z = -0.50)
  bca.aimPointWorld.set(0.12, 1.48, -0.50);
  bca.barrelAimDir.set(0, 0, -1);
  const penetratedMuzzle = new THREE.Vector3(0.12, 1.48, -0.54);
  const fireDir = new THREE.Vector3();
  bca.getFiringDirection(penetratedMuzzle, fireDir);

  // A direção do tiro NUNCA pode inverter para +Z quando o cano penetra a superfície
  assert.ok(fireDir.z < -0.9, `Direção do tiro deve continuar para frente (-Z), obteve z=${fireDir.z}`);

  // 2. Projeção em tela de ponto a queima-roupa extremo (< near clip) deve permanecer com coordenadas finitas e na tela
  const outScreen = { x: 0, y: 0 };
  bca._projectToScreen(new THREE.Vector3(0.12, 1.48, -0.02), outScreen, 1920, 1080);
  assert.ok(Number.isFinite(outScreen.x) && outScreen.x >= 0 && outScreen.x <= 1920, `Screen X deve ser válido: ${outScreen.x}`);
  assert.ok(Number.isFinite(outScreen.y) && outScreen.y >= 0 && outScreen.y <= 1080, `Screen Y deve ser válido: ${outScreen.y}`);
});
