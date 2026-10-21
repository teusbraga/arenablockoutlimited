import test from 'node:test';
import assert from 'node:assert/strict';
import { CrosshairManager, DEFAULT_CROSSHAIR_CONFIG } from '../src/ui/CrosshairManager.js';
import { AimAssistSystem } from '../src/new_mechanics/AimAssistSystem.js';

test('CrosshairManager - Defaults and Config Persistence', () => {
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  };

  const mockStyle = {
    props: {},
    setProperty(k, v) { this.props[k] = v; },
    getProperty(k) { return this.props[k]; }
  };
  const mockClasses = new Set();
  const mockEl = {
    style: mockStyle,
    classList: {
      add: (c) => mockClasses.add(c),
      remove: (c) => mockClasses.delete(c),
      toggle: (c, cond) => cond ? mockClasses.add(c) : mockClasses.delete(c),
      contains: (c) => mockClasses.has(c)
    },
    querySelector: () => ({ style: {} })
  };

  const cm = new CrosshairManager({ crosshairEl: mockEl });
  assert.equal(cm.config.style, 'cross');
  assert.equal(cm.config.color, '#00ff66');
  assert.equal(cm.config.length, 7);
  assert.equal(cm.config.noFireWarning, false);

  // Alterar e salvar config
  cm.saveConfig({ style: 't_shape', length: 12, color: '#00ffff' });
  assert.equal(cm.config.style, 't_shape');
  assert.equal(cm.config.length, 12);
  assert.equal(cm.config.color, '#00ffff');
  assert.ok(mockClasses.has('ch-t-shape'));
  assert.equal(mockStyle.getProperty('--ch-color'), '#00ffff');

  // Testar recarregamento do storage
  const cm2 = new CrosshairManager({ crosshairEl: mockEl });
  assert.equal(cm2.config.style, 't_shape');
  assert.equal(cm2.config.length, 12);

  cm.destroy();
  cm2.destroy();
});

test('CrosshairManager - Static vs Dynamic Mode Spread', () => {
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
  
  // Modo Dinâmico: gap abre com aumento de spread
  cm.saveConfig({ mode: 'dynamic', gap: 5 });
  cm.update({ dt: 0.016, spread: 0.04, adsAmount: 0 });
  const dynamicGapStr = mockStyle.getProperty('--gap');
  const dynamicGap = parseFloat(dynamicGapStr);
  assert.ok(dynamicGap > 5.0, `Dynamic gap should be > 5, got ${dynamicGap}`);

  // Modo Estático: gap permanece fixo independentemente do spread
  cm.saveConfig({ mode: 'static', gap: 5 });
  cm.update({ dt: 0.016, spread: 0.08, adsAmount: 0 });
  assert.equal(mockStyle.getProperty('--gap'), '5.0px');

  cm.destroy();
});

test('CrosshairManager - 4 Combinations of Dynamic Alignment (ON/OFF) & Follow Recoil (ON/OFF)', () => {
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

  // 1. Combo (dynamicAlignment: OFF, followRecoil: OFF) -> 100% Paradona no Centro (50%, 50%, 0px, 0px)
  cm.saveConfig({ dynamicAlignment: false, followRecoil: false, mode: 'dynamic', gap: 5 });
  cm.update({
    dt: 0.016,
    spread: 0.05,
    cameraRig: { recoilRot: { x: 0.05, y: -0.02 }, flinchPitch: 0, flinchYaw: 0 },
    sprayRecoil: { pitch: 0.08, yaw: -0.03 },
    barrelScreenPos: { x: 820.4, y: 410.8 },
    cameraFov: 75
  });
  assert.equal(mockStyle.left, '50%', 'Combo (OFF, OFF) deve travar left em 50%');
  assert.equal(mockStyle.top, '50%', 'Combo (OFF, OFF) deve travar top em 50%');
  assert.equal(mockStyle.transform, 'translate(calc(-50% + 0.0px), calc(-50% + 0.0px))');
  assert.equal(cm.currentRecoilOffset.x, 0);
  assert.equal(cm.currentRecoilOffset.y, 0);
  assert.ok(parseFloat(mockStyle.getProperty('--gap')) > 5.0, 'Modo dinâmico (--gap) deve continuar abrindo normalmente');

  // 2. Combo (dynamicAlignment: ON, followRecoil: OFF) -> Segue o cano (left/top = barrelScreenPos), mas ignora sprayRecoil (transform = 0px)
  cm.saveConfig({ dynamicAlignment: true, followRecoil: false });
  cm.update({
    dt: 0.016,
    spread: 0.05,
    cameraRig: { recoilRot: { x: 0.06, y: -0.03 }, flinchPitch: 0, flinchYaw: 0 },
    sprayRecoil: { pitch: 0.09, yaw: -0.04 },
    barrelScreenPos: { x: 820.4, y: 410.8 },
    cameraFov: 75
  });
  assert.equal(mockStyle.left, '820.4px', 'Combo (ON, OFF) deve posicionar left na projeção do cano');
  assert.equal(mockStyle.top, '410.8px', 'Combo (ON, OFF) deve posicionar top na projeção do cano');
  assert.equal(mockStyle.transform, 'translate(calc(-50% + 0.0px), calc(-50% + 0.0px))', 'Combo (ON, OFF) não deve somar offset de recuo');
  assert.equal(cm.currentRecoilOffset.x, 0);
  assert.equal(cm.currentRecoilOffset.y, 0);

  // 3. Combo (dynamicAlignment: OFF, followRecoil: ON) -> Ancorado no centro (left/top = 50%), mas sobe com sprayRecoil no transform
  cm.saveConfig({ dynamicAlignment: false, followRecoil: true });
  for (let i = 0; i < 15; i++) {
    cm.update({
      dt: 0.016,
      sprayRecoil: { pitch: 0.07, yaw: -0.02 },
      cameraRig: { recoilRot: { x: 0.02, y: -0.01 }, flinchPitch: 0, flinchYaw: 0 },
      barrelScreenPos: { x: 820.4, y: 410.8 },
      cameraFov: 75
    });
  }
  assert.equal(mockStyle.left, '50%', 'Combo (OFF, ON) deve manter left fixo em 50% ignorando barrelScreenPos');
  assert.equal(mockStyle.top, '50%', 'Combo (OFF, ON) deve manter top fixo em 50% ignorando barrelScreenPos');
  assert.ok(cm.currentRecoilOffset.y < -30, `Combo (OFF, ON) deve elevar a crosshair pelo sprayRecoil (> 30px, got ${cm.currentRecoilOffset.y})`);
  assert.ok(cm.currentRecoilOffset.x !== 0, 'Combo (OFF, ON) deve aplicar desvio horizontal de yaw');

  // 4. Combo (dynamicAlignment: ON, followRecoil: ON) -> Segue o cano (left/top = barrelScreenPos) E soma o sprayRecoil no transform
  cm.saveConfig({ dynamicAlignment: true, followRecoil: true });
  cm.update({
    dt: 0.016,
    sprayRecoil: { pitch: 0.07, yaw: -0.02 },
    cameraRig: { recoilRot: { x: 0.02, y: -0.01 }, flinchPitch: 0, flinchYaw: 0 },
    barrelScreenPos: { x: 945.2, y: 512.6 },
    cameraFov: 75
  });
  assert.equal(mockStyle.left, '945.2px', 'Combo (ON, ON) deve aplicar left do cano');
  assert.equal(mockStyle.top, '512.6px', 'Combo (ON, ON) deve aplicar top do cano');
  assert.ok(cm.currentRecoilOffset.y < -30, 'Combo (ON, ON) deve manter o deslocamento de sprayRecoil no transform');

  // Desligar ambos retorna imediatamente ao centro absoluto
  cm.saveConfig({ dynamicAlignment: false, followRecoil: false });
  assert.equal(mockStyle.left, '50%');
  assert.equal(mockStyle.top, '50%');
  assert.equal(cm.currentRecoilOffset.x, 0);
  assert.equal(cm.currentRecoilOffset.y, 0);

  cm.destroy();
});

test('CrosshairManager - No Fire Warning Behavior and Inhabitation', () => {
  const mockClasses = new Set();
  const mockEl = {
    style: { setProperty() {} },
    classList: {
      add: (c) => mockClasses.add(c),
      remove: (c) => mockClasses.delete(c),
      toggle: (c, cond) => cond ? mockClasses.add(c) : mockClasses.delete(c)
    },
    querySelector: () => null
  };
  const mockWarningStyle = {};
  const mockWarningEl = {
    style: mockWarningStyle
  };

  const cm = new CrosshairManager({ crosshairEl: mockEl, noFireEl: mockWarningEl });

  // Caso 1: Parede livre (wallCompression = 0)
  cm.saveConfig({ noFireWarning: true });
  cm.update({ wallCompression: 0.1 });
  assert.equal(cm.isBlocked, false);
  assert.equal(mockWarningStyle.display, 'none');

  // Caso 2: Obstrução por parede (wallCompression = 0.6) com warning ativado
  cm.update({ wallCompression: 0.6 });
  assert.equal(cm.isBlocked, true);
  assert.equal(mockWarningStyle.display, 'flex');
  assert.ok(mockClasses.has('ch-blocked'));

  // Caso 3: Obstrução com warning desativado
  cm.saveConfig({ noFireWarning: false });
  cm.update({ wallCompression: 0.6 });
  assert.equal(cm.isBlocked, false);
  assert.equal(mockWarningStyle.display, 'none');
  assert.ok(!mockClasses.has('ch-blocked'));

  cm.destroy();
});

test('CrosshairManager - Independent Center Dot and Lines (Dot-Only & Cross-Only)', () => {
  const mockClasses = new Set();
  const mockDotStyle = {};
  const mockEl = {
    style: { setProperty() {}, opacity: '1' },
    classList: {
      add: (c) => mockClasses.add(c),
      remove: (c) => mockClasses.delete(c),
      toggle: (c, cond) => cond ? mockClasses.add(c) : mockClasses.delete(c),
      contains: (c) => mockClasses.has(c)
    },
    querySelector: (sel) => sel === '.ch-dot' ? { style: mockDotStyle } : null
  };

  const cm = new CrosshairManager({ crosshairEl: mockEl });

  // 1. Dot-Only: style = 'none', centerDot = true
  cm.saveConfig({ style: 'none', centerDot: true });
  assert.equal(mockDotStyle.display, 'block', 'Dot deve ser exibido mesmo quando style for none');
  assert.ok(mockClasses.has('ch-no-lines'), 'Deve aplicar classe ch-no-lines para esconder as hastes');
  assert.ok(!mockClasses.has('ch-hidden'), 'Não deve esconder o elemento inteiro se o dot estiver ativo');

  cm.update({ dt: 0.016, adsAmount: 0 });
  assert.notEqual(mockEl.style.opacity, '0', 'Opacidade não deve ser zerada se o dot estiver ativo');

  // 2. Cross-Only: style = 'cross', centerDot = false
  cm.saveConfig({ style: 'cross', centerDot: false });
  assert.equal(mockDotStyle.display, 'none', 'Dot deve sumir quando centerDot for false');
  assert.ok(!mockClasses.has('ch-no-lines'), 'Não deve esconder as linhas quando style for cross');
  assert.ok(!mockClasses.has('ch-hidden'));

  // 3. Tudo desligado: style = 'none', centerDot = false
  cm.saveConfig({ style: 'none', centerDot: false });
  assert.equal(mockDotStyle.display, 'none');
  assert.ok(mockClasses.has('ch-no-lines'));
  assert.ok(mockClasses.has('ch-hidden'), 'Deve esconder o elemento inteiro quando ambos estiverem desligados');

  cm.update({ dt: 0.016, adsAmount: 0 });
  assert.equal(mockEl.style.opacity, '0', 'Opacidade deve ser zerada se ambos estiverem desligados');

  cm.destroy();
});

test('AimAssistSystem - Friction Bubble, Rotational Pull, LOS Wall Occlusion & TRUE/NONE Toggle', () => {
  const mockEl = {
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector: () => null
  };
  const cm = new CrosshairManager({ crosshairEl: mockEl });
  assert.equal(cm.config.aimAssist, true, 'Default aimAssist deve ser true (ON)');

  // Bot vivo a 10 metros à frente, levemente deslocado à direita (x = +0.4, z = -10)
  const mockBot = {
    alive: true,
    pos: { x: 0.4, y: 0, z: -10 },
    vel: { x: 0, y: 0, z: 0 }
  };

  let wallBlocking = false;
  const mockWorld = {
    raycast: () => wallBlocking ? { distance: 3.0, point: { x: 0, y: 1.5, z: -3 } } : null
  };

  const aa = new AimAssistSystem({
    collisionWorld: mockWorld,
    botsProvider: () => [mockBot],
    crosshairManager: cm
  });

  const mockPlayer = {
    alive: true,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 3.5, y: 0, z: 0 }, // Jogador em movimento (strafe)
    eyeHeight: 1.55,
    yaw: 0,                      // Olhando reto para -Z (0, 0, -1)
    pitch: -0.03,
    ads: false
  };

  // 1. Com aimAssist = TRUE (Ativado) e visão limpa: deve detectar o bot, reduzir sensibilidade (Friction) e puxar yaw para a direita (< 0)
  cm.saveConfig({ aimAssist: true });
  const resOn = aa.computeAssist(0.016, { player: mockPlayer, dx: 2, dy: 0 });
  assert.equal(resOn.hasTarget, true, 'Deve adquirir o bot dentro da bolha magnética');
  assert.ok(resOn.sensMultiplier < 0.85, `Friction Slowdown deve reduzir a sensibilidade sobre o alvo (got ${resOn.sensMultiplier})`);
  assert.ok(resOn.deltaYaw < 0, `Rotational Assist deve puxar o yaw em direção ao bot à direita (got ${resOn.deltaYaw})`);

  // 2. Com parede bloqueando a visão (LOS Occlusion): não deve ativar Aim Assist através de paredes
  wallBlocking = true;
  const resBlocked = aa.computeAssist(0.016, { player: mockPlayer, dx: 2, dy: 0 });
  assert.equal(resBlocked.hasTarget, false, 'Não deve grudar em inimigo atrás de parede');
  assert.equal(resBlocked.sensMultiplier, 1.0);
  assert.equal(resBlocked.deltaYaw, 0);
  wallBlocking = false;

  // 3. Com aimAssist = 'none' (Desativado no menu): zero interferência
  cm.saveConfig({ aimAssist: 'none' });
  assert.equal(aa.isEnabled(), false, 'aimAssist = none deve desativar o sistema');
  const resOff = aa.computeAssist(0.016, { player: mockPlayer, dx: 2, dy: 0 });
  assert.equal(resOff.hasTarget, false);
  assert.equal(resOff.sensMultiplier, 1.0);
  assert.equal(resOff.deltaYaw, 0);
  assert.equal(resOff.deltaPitch, 0);

  cm.destroy();
});
