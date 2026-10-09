import * as THREE from 'three';
import { on, emit } from '../src/core/EventBus.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';
import { Effects, DEFAULT_TRACER_PROFILE } from '../src/fx/Effects.js';
import { Bot } from '../src/entities/Bot.js';

// Polyfill DOM Canvas para testes headless em Node.js
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {}
      }),
      width: 64,
      height: 64
    })
  };
}

console.log('==================================================');
console.log('🔫 TESTE DE TRACERS DESACOPLADOS (FLASH TRACER CS2)');
console.log('==================================================');

const scene = new THREE.Scene();
const world = new CollisionWorld(4.0);
world.addBox(0, 1.5, 30, 4, 4, 1); // Parede a 30m

const effects = new Effects(scene, world);

// [Teste 1] Validação de sanitização e invariantes matemáticas
console.log('\n[Teste 1] Validando sanitização e invariantes do profile...');
const invalidProfile = {
  ttl: -0.1,
  headSpeed: 0,
  tailDelay: 1.5,
  fadeInEnd: 0.9,
  fadeOutStart: 0.2, // Colisão: fadeInEnd > fadeOutStart
  width: -0.5
};

const safe = effects._sanitizeProfile(invalidProfile, '#123456');
if (safe.ttl <= 0) throw new Error('TTL não pode ser <= 0');
if (safe.headSpeed <= 0) throw new Error('headSpeed não pode ser <= 0');
if (safe.fadeInEnd >= safe.fadeOutStart) throw new Error('fadeInEnd deve ser menor que fadeOutStart');
if (safe.width <= 0) throw new Error('width deve ser positivo');
if (safe.color !== '#123456') throw new Error('fallbackColor não foi aplicado');
console.log('✅ Invariantes matemáticas sanitizadas e seguras!');

// [Teste 2] Disparo desacoplado pelo ProjectileManager
console.log('\n[Teste 2] Validando emissão de tracer:fire no ProjectileManager...');
let tracerFiredEvent = null;
on('tracer:fire', e => { tracerFiredEvent = e; });

const projManager = new ProjectileManager({ world });
const origin = new THREE.Vector3(0, 1.5, 0);
const dir = new THREE.Vector3(0, 0, 1);

projManager.spawn({
  origin,
  direction: dir,
  weaponDef: {
    id: 'hk416',
    tracerColor: '#ffd27f',
    bulletSpeed: 880,
    tracerProfile: {
      ttl: 0.06,
      headSpeed: 0.35,
      tailDelay: 0.55,
      width: 1.2,
      color: '#ffd27f'
    }
  }
});

if (!tracerFiredEvent) throw new Error('Evento tracer:fire não foi emitido no spawn');
if (tracerFiredEvent.end.z < 29.0 || tracerFiredEvent.end.z > 31.0) {
  throw new Error(`Impacto estimado incorreto: Z=${tracerFiredEvent.end.z} (esperado ~30m)`);
}
console.log(`✅ Evento tracer:fire emitido! Ponto final estimado na parede: Z=${tracerFiredEvent.end.z.toFixed(2)}m`);

// [Teste 3] Ciclo de vida e interpolação no Effects
console.log('\n[Teste 3] Validando ciclo de vida visual no Effects.update...');
const activeTracers = effects.tracers.filter(t => t.active && t.mode === 'flash');
if (activeTracers.length === 0) throw new Error('Nenhum FlashTracer ativo no pool de efeitos');

const tracer = activeTracers[0];
const dt = 0.016; // ~1 frame a 60fps
effects.update(dt);

if (tracer.mesh.scale.x !== 1.2 || tracer.mesh.scale.z !== 1.2) {
  throw new Error(`Scale de largura incorreto: ${tracer.mesh.scale.x} (esperado 1.2)`);
}
if (tracer.mesh.scale.y <= 0) {
  throw new Error('Comprimento de tracer (scale.y) não expandiu');
}
console.log(`✅ Frame 1 renderizado com sucesso: Comprimento=${tracer.mesh.scale.y.toFixed(2)}m, Largura=${tracer.mesh.scale.x}`);

// Simula frames até expiração
let timeElapsed = dt;
while (tracer.active && timeElapsed < 0.2) {
  effects.update(dt);
  timeElapsed += dt;
}

if (tracer.active) throw new Error('Tracer permaneceu ativo após TTL');
console.log(`✅ FlashTracer expirou e foi reciclado no pool perfeitamente em ${timeElapsed.toFixed(3)}s!`);

// [Teste 4] Validação Fotográfica: Ring Buffer N=8, Core + Glow e Muzzle Tracking
console.log('\n[Teste 4] Validando modelo fotográfico com Ring Buffer N=8 e Core+Glow...');

let currentMuzzle = new THREE.Vector3(0, 1.5, 0);
const muzzleTracker = (outVec) => outVec.copy(currentMuzzle);

projManager.spawn({
  origin: currentMuzzle.clone(),
  originTracker: muzzleTracker,
  direction: new THREE.Vector3(0, 0, 1),
  weaponDef: {
    id: 'photo_rifle',
    bulletSpeed: 700,
    tracerProfile: {
      exposureTime: 0.028,
      persistenceTime: 0.040,
      coreRadius: 0.007,
      glowRadius: 0.038,
      coreBrightness: 1.0,
      glowBrightness: 0.50,
      glowColor: '#44ff88',
      trackOrigin: true
    }
  }
});

const photoTracers = effects.tracers.filter(t => t.active && t.mode === 'flash');
if (photoTracers.length === 0) throw new Error('Tracer fotográfico não ativado no pool');
const photoT = photoTracers[photoTracers.length - 1];

// Simula frame 1: desloca o muzzle ligeiramente (simulando sway da arma)
currentMuzzle.set(0.05, 1.52, 0.02);
effects.update(0.016);

if (!photoT.samples || photoT.samples.length !== 8) {
  throw new Error('Ring Buffer N=8 não inicializado');
}
if (!photoT.coreMesh || !photoT.glowMesh) {
  throw new Error('Camadas concêntricas Core + Glow ausentes');
}
if (photoT.coreMat.opacity <= 0 || photoT.glowMat.opacity <= 0) {
  throw new Error('Opacidade fotográfica não calculada');
}
console.log(`✅ Ring Buffer N=8 ativo (samples=${photoT.sampleCount}), Core e Glow sincronizados!`);
console.log(`✅ Opacidade Core: ${photoT.coreMat.opacity.toFixed(2)}, Opacidade Glow: ${photoT.glowMat.opacity.toFixed(2)}`);

// Simula até expiração completa
while (photoT.active) {
  effects.update(0.016);
}
if (photoT.originTracker !== null) {
  throw new Error('originTracker não foi liberado após expiração (vazamento de referência)');
}
console.log('✅ Expiração e liberação de memória fotográfica validadas sem vazamentos!');

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE FLASH & TRACER FOTOGRÁFICO PASSARAM COM SUCESSO!');
console.log('==================================================');

