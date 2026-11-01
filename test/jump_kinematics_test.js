import assert from 'assert';
import * as THREE from 'three';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { CameraRig } from '../src/core/CameraRig.js';
import { Player } from '../src/entities/Player.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';

console.log('==================================================');
console.log('🧪 TESTE DE CINEMÁTICA DE PULO, LANDING DIP & SHAKE');
console.log('==================================================');

// -------------------------------------------------------------------
// SUÍTE 1: Configuração Data-Driven do Pulo
// -------------------------------------------------------------------
console.log('\n[Suíte 1] Validando dados de configuração data-driven...');
assert.strictEqual(typeof CONFIG.PLAYER.takeoffDipScale, 'number', 'takeoffDipScale deve ser número');
assert(CONFIG.PLAYER.takeoffDipScale > 0, 'takeoffDipScale deve ser positivo');
assert.strictEqual(typeof CONFIG.PLAYER.landingPitchNodScale, 'number', 'landingPitchNodScale deve ser número');
assert(CONFIG.PLAYER.landingPitchNodScale > 0, 'landingPitchNodScale deve ser positivo');
assert.strictEqual(typeof CONFIG.PLAYER.landingShakeScale, 'number', 'landingShakeScale deve ser número');
assert(CONFIG.PLAYER.landingShakeScale > 0, 'landingShakeScale deve ser positivo');
console.log(`  ✔ takeoffDipScale = ${CONFIG.PLAYER.takeoffDipScale}`);
console.log(`  ✔ landingPitchNodScale = ${CONFIG.PLAYER.landingPitchNodScale}`);
console.log(`  ✔ landingShakeScale = ${CONFIG.PLAYER.landingShakeScale}`);

// -------------------------------------------------------------------
// SUÍTE 2: Decolagem do Salto (Takeoff Dip + Pitch Nod)
// -------------------------------------------------------------------
console.log('\n[Suíte 2] Validando mola e micro-flexão na decolagem (Takeoff Dip)...');
const rig = new CameraRig();
const dummyPlayer = {
  alive: true,
  onGround: true,
  ads: false,
  crouchAmount: 0,
  vel: new THREE.Vector3(0, 0, 0),
  renderPos: new THREE.Vector3(0, 0, 0),
  lean: 0
};

rig.triggerJumpTakeoff();
assert(rig.landingDipVel < 0, `landingDipVel deve ser negativa na decolagem, obtido: ${rig.landingDipVel}`);
assert(rig.jumpPitchNodVel < 0, `jumpPitchNodVel deve ser negativa na decolagem (olhar cede levemente), obtido: ${rig.jumpPitchNodVel}`);

// Avança 2 frames (33ms a 60 FPS)
rig.update(1 / 60, dummyPlayer);
rig.update(1 / 60, dummyPlayer);

assert(rig.landingDip < 0, `landingDip deve flexionar para baixo na decolagem, obtido: ${rig.landingDip}`);
assert(rig.jumpPitchNod < 0, `jumpPitchNod deve inclinar levemente para baixo, obtido: ${rig.jumpPitchNod}`);
console.log(`  ✔ Takeoff flexão vertical: ${(Math.abs(rig.landingDip) * 100).toFixed(2)} cm`);
console.log(`  ✔ Takeoff pitch nod: ${(Math.abs(rig.jumpPitchNod) * (180 / Math.PI)).toFixed(3)} graus`);

// Avança 40 frames para verificar amortecimento total
for (let i = 0; i < 40; i++) {
  rig.update(1 / 60, dummyPlayer);
}
assert.strictEqual(rig.landingDip, 0, 'landingDip deve estabilizar perfeitamente em 0');
assert.strictEqual(rig.jumpPitchNod, 0, 'jumpPitchNod deve estabilizar perfeitamente em 0');
assert.strictEqual(rig.landingDipVel, 0, 'landingDipVel deve estabilizar em 0');
assert.strictEqual(rig.jumpPitchNodVel, 0, 'jumpPitchNodVel deve estabilizar em 0');
console.log('  ✔ Mola de decolagem estabiliza perfeitamente em 0 sem oscilação infinita.');

// -------------------------------------------------------------------
// SUÍTE 3: Tremidinha de Impacto em Pulos e Quedas
// -------------------------------------------------------------------
console.log('\n[Suíte 3] Validando micro-shake táctil no pouso de qualquer pulo...');
rig.reset();

// Pouso de pulo padrão (vy = -5.6 m/s)
rig.triggerLandingDip(-5.6);
assert(rig.landingDipVel < 0, 'landingDipVel deve ser acionada no pouso comum');
assert(rig.jumpPitchNodVel < 0, 'jumpPitchNodVel deve ser acionada no pouso comum');
assert(rig.shakeIntensity > 0, `Pouso de pulo padrão DEVE ativar micro-shake táctil (tremidinha), obtido: ${rig.shakeIntensity}`);
const normalJumpShake = rig.shakeIntensity;
console.log(`  ✔ Pulo padrão em piso plano: Tremidinha táctil ativada com intensidade = ${normalJumpShake.toFixed(4)}`);

// Queda dura de grande altura (vy = -10.0 m/s)
rig.reset();
rig.triggerLandingDip(-10.0);
assert(rig.shakeIntensity > normalJumpShake, `Queda de grande altura deve produzir shake mais intenso que pulo normal, obtido: ${rig.shakeIntensity} vs ${normalJumpShake}`);
console.log(`  ✔ Queda dura de altura: Micro-shake amplificado para intensidade = ${rig.shakeIntensity.toFixed(4)}`);

// Simula decaimento do shake
const initialShake = rig.shakeIntensity;
rig.update(0.1, dummyPlayer);
assert(rig.shakeIntensity < initialShake, 'Shake deve decair com o tempo');
console.log('  ✔ Micro-shake de impacto decai exponencialmente conforme o padrão do CameraRig.');

// -------------------------------------------------------------------
// SUÍTE 4: Blindagem Tática no ADS (Mira Aberta)
// -------------------------------------------------------------------
console.log('\n[Suíte 4] Validando blindagem de estabilidade no ADS (mira aberta)...');
rig.reset();
rig.triggerJumpTakeoff();

const adsPlayer = {
  alive: true,
  onGround: true,
  ads: true,
  crouchAmount: 0,
  vel: new THREE.Vector3(0, 0, 0),
  renderPos: new THREE.Vector3(0, 0, 0),
  lean: 0
};

rig.update(1 / 60, adsPlayer);
assert(Math.abs(rig.effectiveJumpPitchNod) <= Math.abs(rig.jumpPitchNod) * 0.11,
  `No ADS, effectiveJumpPitchNod deve sofrer atenuação de 90% (adsDamp = 0.10), obtido: ${rig.effectiveJumpPitchNod} vs ${rig.jumpPitchNod}`);
console.log(`  ✔ ADS Dampening: raw nod = ${rig.jumpPitchNod.toFixed(5)} -> effective ADS nod = ${rig.effectiveJumpPitchNod.toFixed(5)} (90% amortecido)`);

// -------------------------------------------------------------------
// SUÍTE 5: Acessibilidade (Headbob, Shake e JumpShake Sliders)
// -------------------------------------------------------------------
console.log('\n[Suíte 5] Validando respeito aos controles de acessibilidade...');
CONFIG.ACCESSIBILITY.headbobScale = 0.0;
CONFIG.ACCESSIBILITY.shakeScale = 0.0;
rig.reset();

rig.triggerJumpTakeoff();
assert.strictEqual(rig.landingDipVel, 0, 'Quando headbobScale = 0, takeoff dip vel deve ser 0');
assert.strictEqual(rig.jumpPitchNodVel, 0, 'Quando headbobScale = 0, takeoff pitch nod vel deve ser 0');

rig.triggerLandingDip(-9.0);
assert.strictEqual(rig.landingDipVel, 0, 'Quando headbobScale = 0, landing dip vel deve ser 0');
assert.strictEqual(rig.jumpPitchNodVel, 0, 'Quando headbobScale = 0, landing pitch nod vel deve ser 0');
assert.strictEqual(rig.shakeIntensity, 0, 'Quando shakeScale = 0, shakeIntensity deve permanecer 0 mesmo em quedas duras');
console.log('  ✔ Opções de acessibilidade headbob e shake em 0% neutralizam os efeitos cinemáticos.');

// Teste do Slider Dedicado: Jump Shake Head (0% a 100%)
CONFIG.ACCESSIBILITY.headbobScale = 1.0;
CONFIG.ACCESSIBILITY.shakeScale = 1.0;
CONFIG.ACCESSIBILITY.jumpShakeScale = 0.0;
rig.reset();

rig.triggerJumpTakeoff();
assert.strictEqual(rig.landingDipVel, 0, 'Quando jumpShakeScale = 0 (0%), takeoff dip deve ser 0');
assert.strictEqual(rig.jumpPitchNodVel, 0, 'Quando jumpShakeScale = 0 (0%), takeoff pitch nod deve ser 0');

rig.triggerLandingDip(-5.7);
assert.strictEqual(rig.landingDipVel, 0, 'Quando jumpShakeScale = 0 (0%), landing dip deve ser 0');
assert.strictEqual(rig.jumpPitchNodVel, 0, 'Quando jumpShakeScale = 0 (0%), pitch nod deve ser 0');
assert.strictEqual(rig.landingTremorAmpY, 0, 'Quando jumpShakeScale = 0 (0%), amplitude de tremor Y deve ser 0');
assert.strictEqual(rig.shakeIntensity, 0, 'Quando jumpShakeScale = 0 (0%), shakeIntensity de impacto deve ser 0');
console.log('  ✔ Slider Jump Head Shake em 0% desativa completamente tremor, compressão e pancada de pulo.');

// Modulação a 50%:
CONFIG.ACCESSIBILITY.jumpShakeScale = 0.50;
rig.reset();
rig.triggerLandingDip(-5.7);
const amp50 = rig.landingTremorAmpY;

CONFIG.ACCESSIBILITY.jumpShakeScale = 1.0;
rig.reset();
rig.triggerLandingDip(-5.7);
const amp100 = rig.landingTremorAmpY;

assert(Math.abs((amp50 / amp100) - 0.50) < 0.01, `jumpShakeScale = 0.50 deve gerar exatamente 50% da amplitude, obtido: ${(amp50 / amp100).toFixed(3)}`);
console.log(`  ✔ Modulação contínua do Slider Jump Shake (50% = ${amp50.toFixed(4)} vs 100% = ${amp100.toFixed(4)}) validada com precisão.`);

// Restaura defaults de acessibilidade
CONFIG.ACCESSIBILITY.headbobScale = 1.0;
CONFIG.ACCESSIBILITY.shakeScale = 1.0;
CONFIG.ACCESSIBILITY.jumpShakeScale = 1.0;

// -------------------------------------------------------------------
// SUÍTE 6: Integração Física com Player (Decolagem e Queda Livre)
// -------------------------------------------------------------------
console.log('\n[Suíte 6] Validando integração de física contínua no Player...');
const world = new CollisionWorld(4.0);
world.addBox(0, 0, 0, 20, 0.2, 20); // Piso em y=0

const player = new Player(world, [-10, 10, -10, 10], [0, 0.1, 0]);
player.onGround = true;

const jumpInput = {
  actions: { jump: true },
  consumeAction: (act) => {
    if (act === 'jump' && jumpInput.actions.jump) {
      jumpInput.actions.jump = false;
      return true;
    }
    return false;
  },
  consumeMouseDelta: () => ({ dx: 0, dy: 0 })
};

// Tick 1: Player no chão aperta Jump -> decolagem aciona triggerJumpTakeoff
player.update(1 / 60, jumpInput);
assert.strictEqual(player.onGround, false, 'Player não deve estar no chão após pular');
assert(player.rig.landingDipVel < 0 || player.rig.jumpPitchNodVel < 0, 'triggerJumpTakeoff deve ter sido acionado na decolagem do Player');
console.log('  ✔ Player ao pular aciona organicamente o Takeoff Dip e Pitch Nod no CameraRig.');

// -------------------------------------------------------------------
// SUÍTE 7: Validação de Aterrissagem (player:landing) e Sprint Salto
// -------------------------------------------------------------------
console.log('\n[Suíte 7] Validando física de salto com sprint e evento de aterrissagem...');
const { on } = await import('../src/core/EventBus.js');

let landingEmitted = false;
let landingPayload = null;
const unsub = on('player:landing', (data) => {
  landingEmitted = true;
  landingPayload = data;
});

// Simula queda até tocar o chão
for (let i = 0; i < 40; i++) {
  player.update(1 / 60, {
    actions: {},
    consumeAction: () => false,
    consumeMouseDelta: () => ({ dx: 0, dy: 0 })
  });
}

assert.strictEqual(player.onGround, true, 'Player deve tocar o solo após queda');
assert.strictEqual(landingEmitted, true, 'Evento player:landing deve ser emitido ao tocar o solo');
assert(landingPayload.velY < -1.5, 'velY deve registrar velocidade de impacto');
console.log(`  ✔ Impacto no solo detectado com velY = ${landingPayload.velY.toFixed(2)} m/s e evento player:landing disparado.`);
unsub();

// Teste de Sprint Salto:
const sprintPlayer = new Player(world, [-10, 10, -10, 10], [0, 0.1, 0]);
sprintPlayer.onGround = true;

const sprintInput = {
  isActionPressed: (a) => a === 'sprint' || a === 'move_forward',
  isActionJustPressed: () => false,
  consumeAction: () => false,
  consumeMouseDelta: () => ({ dx: 0, dy: 0 })
};

// 1. Sprint no chão
sprintPlayer.update(1 / 60, sprintInput);
assert.strictEqual(sprintPlayer.sprinting, true, 'Sprint deve ativar no chão');

// 2. Salto durante o sprint deve MANTER sprint no ar
sprintPlayer.vel.y = 6.0;
sprintPlayer.onGround = false;
sprintPlayer.update(1 / 60, sprintInput);
assert.strictEqual(sprintPlayer.sprinting, true, 'Sprint deve continuar ativo durante o salto (não cortar velocidade)');
console.log('  ✔ Pular durante o sprint preserva a velocidade e o estado de sprint no ar.');

// 3. Tentar iniciar sprint no ar sem estar correndo antes deve falhar
const airPlayer = new Player(world, [-10, 10, -10, 10], [0, 5.0, 0]);
airPlayer.onGround = false;
airPlayer.sprinting = false;
airPlayer.update(1 / 60, sprintInput);
assert.strictEqual(airPlayer.sprinting, false, 'Sprint não deve começar no ar');
console.log('  ✔ Tentar iniciar sprint no ar é bloqueado com sucesso.');

// -------------------------------------------------------------------
// SUÍTE 8: Tremor Biomecânico de Ação e Reação (Rebote Cima e Baixo)
// -------------------------------------------------------------------
console.log('\n[Suíte 8] Validando oscilação elástica de ação e reação (rebote para cima e para baixo)...');
const tremorRig = new CameraRig();
tremorRig.triggerLandingDip(-5.7);

let minOffsetY = 0;
let maxOffsetY = 0;
let minPitch = 0;
let maxPitch = 0;
let alternationsY = 0;
let lastSignY = 0;

for (let frame = 0; frame < 30; frame++) {
  tremorRig.update(1 / 60, dummyPlayer);
  const y = tremorRig.landingTremorOffsetY;
  const p = tremorRig.landingTremorPitch;

  if (y < minOffsetY) minOffsetY = y;
  if (y > maxOffsetY) maxOffsetY = y;
  if (p < minPitch) minPitch = p;
  if (p > maxPitch) maxPitch = p;

  const currentSign = Math.sign(y);
  if (currentSign !== 0 && lastSignY !== 0 && currentSign !== lastSignY) {
    alternationsY++;
  }
  if (currentSign !== 0) lastSignY = currentSign;
}

assert(minOffsetY < -0.05, `Compressão para baixo (ação) deve ser perceptível (< -5cm), obtido: ${(minOffsetY * 100).toFixed(2)}cm`);
assert(maxOffsetY > 0.03, `Rebote para cima (reação) deve ultrapassar a linha de base (> +3cm), obtido: ${(maxOffsetY * 100).toFixed(2)}cm`);
assert(minPitch < -0.04, `Pancada angular para baixo (pitch nod) deve ser nítida (< -2.3°), obtido: ${(minPitch * 180 / Math.PI).toFixed(2)}°`);
assert(maxPitch > 0.02, `Rebote angular para cima deve ultrapassar o horizonte (> +1.1°), obtido: ${(maxPitch * 180 / Math.PI).toFixed(2)}°`);
assert(alternationsY >= 3, `Deve alternar oscilando para cima e para baixo pelo menos 3 vezes (tremor), obtido: ${alternationsY} alternâncias`);

console.log(`  ✔ Compressão de impacto (Ação): ${(minOffsetY * 100).toFixed(1)} cm | Pitch: ${(minPitch * 180 / Math.PI).toFixed(1)}°`);
console.log(`  ✔ Rebote elástico (Reação): +${(maxOffsetY * 100).toFixed(1)} cm | Pitch: +${(maxPitch * 180 / Math.PI).toFixed(1)}°`);
console.log(`  ✔ Tremor com ${alternationsY} alternâncias completas de fase cima/baixo.`);

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE CINEMÁTICA DE PULO PASSARAM COM SUCESSO!');
console.log('==================================================');
