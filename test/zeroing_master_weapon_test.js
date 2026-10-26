import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { MasterWeapon, MASTER_DEFAULTS } from '../src/weapons/MasterWeapon.js';
import { WeaponSystem } from '../src/weapons/WeaponSystem.js';
import { BallisticsCalculator } from '../src/weapons/BallisticsCalculator.js';
import { CameraRig } from '../src/core/CameraRig.js';
import { CrosshairManager } from '../src/ui/CrosshairManager.js';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { initWeaponsFromData } from '../src/weapons/WeaponDefs.js';
import { BarrelCrosshairAlignment } from '../src/new_mechanics/BarrelCrosshairAlignment.js';

test('MasterWeapon - Baseline Canonical & Zeroing Mode Detection', () => {
  assert.equal(MASTER_DEFAULTS.zeroDistance, 50.0);
  assert.equal(MASTER_DEFAULTS.intrinsicSpread, 0.0);
  assert.equal(MASTER_DEFAULTS.baseGravity, 9.8);

  // Detecção por nome de mapa Range
  assert.equal(MasterWeapon.isZeroingMode('range'), true);
  assert.equal(MasterWeapon.isZeroingMode('./assets/maps/range.json'), true);
  assert.equal(MasterWeapon.isZeroingMode('Campo de Tiro'), true);
  assert.equal(MasterWeapon.isZeroingMode('dust'), false);
  assert.equal(MasterWeapon.isZeroingMode('italy'), false);

  // Detecção via flag de configuração
  CONFIG.ZEROING.zeroingMode = true;
  assert.equal(MasterWeapon.isZeroingMode('dust'), true);
  CONFIG.ZEROING.zeroingMode = false;
  assert.equal(MasterWeapon.isZeroingMode('dust'), false);
});

test('MasterWeapon - Zeroing Mode Neutralizes Spread, Recoil and Sway', () => {
  const dummyDef = {
    id: 'test_gun',
    spreadHip: 0.035,
    spreadAds: 0.005,
    recoilPitch: 0.02,
    recoilYaw: 0.005,
    ballistics: {
      external: {
        recoil: { vertical: 0.02, horizontal: 0.005 }
      }
    }
  };

  // Modo Normal: spread, recoil e sway têm valores maiores que zero
  const normalSpread = BallisticsCalculator.calculateCurrentSpread(dummyDef, {
    isAds: false,
    speedRatio: 1.0,
    isStrafing: true,
    isSprinting: false,
    precisionPenalty: 0.03,
    swayAmount: 0.002,
    zeroingMode: false
  });
  assert.ok(normalSpread > 0.01, `Spread normal esperado > 0.01, obteve ${normalSpread}`);

  const normalRecoil = BallisticsCalculator.calculateRecoilImpulse(dummyDef, 3, false, false);
  assert.ok(normalRecoil.pitch > 0);

  const normalSway = BallisticsCalculator.calculateSway(dummyDef, 1.0, false, 0, false);
  assert.ok(normalSway.amplitude > 0);

  // Modo Zeroing (Calibração): Todos os debuffs são estritamente 0.0
  const zeroSpread = BallisticsCalculator.calculateCurrentSpread(dummyDef, {
    isAds: false,
    speedRatio: 1.0,
    isStrafing: true,
    isSprinting: false,
    precisionPenalty: 0.03,
    swayAmount: 0.002,
    zeroingMode: true
  });
  assert.equal(zeroSpread, 0.0, 'Spread em modo zeroing deve ser 0.0');

  const zeroRecoil = BallisticsCalculator.calculateRecoilImpulse(dummyDef, 5, false, true);
  assert.deepEqual(zeroRecoil, { pitch: 0, yaw: 0, kickbackZ: 0 }, 'Recoil em modo zeroing deve ser 0');

  const zeroSway = BallisticsCalculator.calculateSway(dummyDef, 1.0, false, 0, true);
  assert.deepEqual(zeroSway, { x: 0, y: 0, amplitude: 0 }, 'Sway em modo zeroing deve ser 0');
});

test('MasterWeapon - 3D Focal Convergence & Height-Over-Bore at Point-Blank vs 50m', () => {
  const camPos = new THREE.Vector3(0, 1.6, 0);
  const camForward = new THREE.Vector3(0, 0, -1);
  const muzzleWorld = new THREE.Vector3(0.14, 1.45, -0.4); // 15cm abaixo e 14cm à direita

  const world = new CollisionWorld(4.0);

  // 1. Em espaço aberto: alvo a 50m
  const target50 = MasterWeapon.getConvergenceTarget(camPos, camForward, 50.0, world);
  assert.equal(target50.x, 0);
  assert.equal(target50.y, 1.6);
  assert.equal(target50.z, -50.0);

  const dir = MasterWeapon.computeShotDirection(muzzleWorld, target50);
  // O vetor deve apontar em direção a -Z, ligeiramente para a esquerda (-X) e para cima (+Y)
  assert.ok(dir.z < -0.99);
  assert.ok(dir.x < 0, 'Deve convergir lateralmente');
  assert.ok(dir.y > 0, 'Deve subir para compensar o desnível do cano');

  // Trajetória a 50m deve cruzar exatamente o centro (X = 0, Y = 1.6)
  const distToTarget = muzzleWorld.distanceTo(target50);
  const hitPoint50 = muzzleWorld.clone().addScaledVector(dir, distToTarget);
  assert.ok(Math.abs(hitPoint50.x - 0.0) < 0.0001, 'X deve bater no centro a 50m');
  assert.ok(Math.abs(hitPoint50.y - 1.6) < 0.0001, 'Y deve bater no centro a 50m');

  // 2. A curta distância (queima-roupa a 2m), o projétil atinge abaixo da visada da mira (height-over-bore)
  const hitPoint2m = muzzleWorld.clone().addScaledVector(dir, 2.0);
  assert.ok(hitPoint2m.y < 1.6, 'A 2m a bala deve estar abaixo da mira (height-over-bore)');
  assert.ok(hitPoint2m.y > 1.45, 'A bala deve estar subindo em direção ao ponto zero');

  // 3. Com obstáculo a 10m: o ponto de convergência é a superfície física do obstáculo
  world.addBox(0, 1.6, -10, 2, 2, 1);
  const targetWall = MasterWeapon.getConvergenceTarget(camPos, camForward, 50.0, world);
  assert.ok(Math.abs(targetWall.z - (-9.5)) < 0.01 || Math.abs(targetWall.z - (-10.5)) < 0.6);
});

test('CameraRig - Issue #9: Recoil Climbing Sustained Across Rapid Bursts with recoveryDelay', () => {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const rig = new CameraRig(camera);
  const mockPlayer = {
    ads: false,
    activeWeaponWeight: 3.5,
    vel: { x: 0, y: 0, z: 0 },
    pos: { x: 0, y: 0, z: 0 },
    renderPos: { x: 0, y: 0, z: 0 },
    alive: true,
    onGround: true,
    sprinting: false,
    crouched: false
  };

  // Simula disparo com cadência rápida (~100ms por tiro) e recoveryDelay dinâmico (0.24s)
  const recoveryDelay = 0.24;

  // Tiro 1
  rig.addRecoilImpulse({
    climbPitch: 0.015,
    climbYaw: 0,
    recoveryDelay
  });
  const pitchAfterShot1 = rig.targetPitch;
  assert.ok(pitchAfterShot1 > 0.01);

  // Passa 80ms (tempo que no bug antigo já começava a decair)
  rig.update(0.08, mockPlayer);
  assert.equal(rig.targetPitch, pitchAfterShot1, 'Pitch não deve decair em 80ms porque recoveryDelay é 0.24s');

  // Tiro 2 da rajada antes do delay expirar (no instante 100ms)
  rig.update(0.02, mockPlayer); // total 100ms
  rig.addRecoilImpulse({
    climbPitch: 0.015,
    climbYaw: 0,
    recoveryDelay
  });

  assert.ok(rig.targetPitch > pitchAfterShot1 + 0.01, 'Pitch deve acumular durante a rajada (climbing)');

  // Espera a rajada terminar completamente (passa 0.35s sem novos tiros)
  const peakPitch = rig.targetPitch;
  rig.update(0.35, mockPlayer);
  assert.ok(rig.targetPitch < peakPitch, 'Após cessar a rajada e expirar o delay, o pitch deve começar a recuperar suavemente');
});

test('CrosshairManager - Issue #10: Dynamic Gap Smoothing Eliminates 35ms Strobe', () => {
  const mockStyle = {
    props: {},
    setProperty(k, v) { this.props[k] = v; },
    getProperty(k) { return this.props[k]; }
  };
  const mockEl = {
    style: mockStyle,
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector: () => null
  };

  const cm = new CrosshairManager({ crosshairEl: mockEl });
  cm.saveConfig({ mode: 'dynamic', gap: 5 });

  // Expansão por tiro (spread sobe para 0.04)
  cm.update({ dt: 0.016, spread: 0.04, adsAmount: 0 });
  const openGap = parseFloat(mockStyle.getProperty('--gap'));
  assert.ok(openGap > 5.0);

  // Spread decai repentinamente para o mínimo em 1 frame
  cm.update({ dt: 0.016, spread: 0.001, adsAmount: 0 });
  const decayedGap = parseFloat(mockStyle.getProperty('--gap'));

  // Não deve cair instantaneamente para 5.0px (amortecimento inercial elimina estroboscópio)
  assert.ok(decayedGap > 5.0, `Gap no frame 1 de decaimento deve ser amortecido (> 5.0), obteve ${decayedGap}`);
  assert.ok(decayedGap < openGap, `Gap deve estar reduzindo suavemente, obteve ${decayedGap} vs ${openGap}`);

  cm.destroy();
});

test('WeaponSystem & Crosshair - Issue #10: Monotonic Cumulative Spray Bloom Without Inter-Shot Decay (CS2 Feel)', () => {
  const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
  initWeaponsFromData(rawData);
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const mount = new THREE.Group();
  const mockInput = {
    actions: { fire: true, ads: false },
    consumeAction: (act) => act === 'fire',
    isActionPressed: () => false
  };
  const mockPlayer = {
    alive: true,
    sprinting: false,
    crouched: false,
    vel: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    prevPos: new THREE.Vector3(),
    rig: null
  };

  const ws = new WeaponSystem({
    camera,
    viewmodel: { mount, equip: () => {}, updatePose: () => {}, decayFlash: () => {}, applyKick: () => {}, flash: () => {}, triggerFire: () => {} },
    input: mockInput,
    player: mockPlayer,
    world: new CollisionWorld(4.0),
    inventory: ['ar15', null]
  });

  // Tiro 1
  ws.update(0.016);
  const penaltyShot1 = ws.precisionPenalty;
  const sprayPitchShot1 = ws.sprayRecoil.pitch;
  assert.ok(penaltyShot1 > 0, 'Tiro 1 deve aplicar penalidade');
  assert.ok(sprayPitchShot1 > 0, 'Tiro 1 deve aplicar spray recoil');

  // Simula 4 frames entre tiros consecutivos (durante a cadência, t = 64ms < ceaseDelay)
  for (let i = 0; i < 4; i++) {
    ws.update(0.016);
  }

  // Não deve decair durante a rajada ativa (elimina efeito sanfona / estroboscópico)
  assert.equal(ws.precisionPenalty, penaltyShot1, 'Penalidade de precisão não pode decair entre tiros da mesma rajada');
  assert.equal(ws.sprayRecoil.pitch, sprayPitchShot1, 'Spray recoil não pode decair entre tiros da mesma rajada');

  // Tiro 2 da rajada (acumula cumulativamente como no CS)
  ws.fireCooldown = 0;
  ws.update(0.016);
  assert.ok(ws.precisionPenalty > penaltyShot1, 'Tiro 2 deve aumentar a dispersão cumulativamente');
  assert.ok(ws.sprayRecoil.pitch > sprayPitchShot1, 'Tiro 2 deve aumentar o recuo acumulado cumulativamente');

  // Cessar-fogo: solta o gatilho e espera ceaseDelay passar (> 250ms)
  mockInput.actions.fire = false;
  for (let i = 0; i < 20; i++) { // 320ms sem atirar
    ws.update(0.016);
  }

  // Agora sim deve recuperar suavemente em direção a zero
  assert.ok(ws.precisionPenalty < penaltyShot1, 'Após cessar-fogo, precisão deve recuperar');
  assert.ok(ws.sprayRecoil.pitch < sprayPitchShot1, 'Após cessar-fogo, spray recoil deve recuperar');

  ws.destroy();
});
test('Crosshair & Bullet Impact - 98%+ Spatial Match in Dynamic Alignment & Follow Recoil Mode', () => {
  const camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.1, 1000);
  camera.position.set(0, 1.6, 0);
  camera.updateMatrixWorld(true);

  const mount = new THREE.Group();
  camera.add(mount);
  mount.position.set(0.14, -0.15, -0.3);
  mount.updateMatrixWorld(true);

  const world = new CollisionWorld(4.0);
  world.addBox(0, 1.6, -20, 50, 20, 2);

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
    inventory: ['m249', null],
    hud: {
      crosshairManager: {
        config: { dynamicAlignment: true, followRecoil: true }
      }
    }
  });
  ws.barrelAlignment = bca;

  // Dispara uma rajada contínua de 5 tiros simulando combate
  for (let shot = 1; shot <= 5; shot++) {
    ws.fireCooldown = 0;
    ws.update(0.016);
    bca.update(ws.def, false, 0.016, ws.sprayRecoil);

    const hit = world.raycast(bca.muzzleWorld, bca.barrelAimDir, 100);
    const hp = hit ? hit.point : bca.aimPointWorld;
    const hitPoint = new THREE.Vector3(hp.x, hp.y, hp.z);

    const proj = hitPoint.project(camera);
    const impactScreenX = (proj.x * 0.5 + 0.5) * 1920;
    const impactScreenY = (-(proj.y * 0.5) + 0.5) * 1080;

    const errorDist = Math.hypot(impactScreenX - bca.screenPos.x, impactScreenY - bca.screenPos.y);
    const matchPct = 100 * (1 - errorDist / 1080);

    // O match precisa ser rigorosamente >= 98% conforme especificação do usuário
    assert.ok(
      matchPct >= 98.0,
      `Tiro ${shot}: Match da crosshair com o impacto da bala (${matchPct.toFixed(2)}%) deve ser >= 98.0% (erro: ${errorDist.toFixed(2)}px)`
    );
  }

  ws.destroy();
});
