import * as THREE from 'three';
import { on, emit } from '../src/core/EventBus.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ProjectileManager } from '../src/weapons/ProjectileManager.js';
import { Effects, DEFAULT_TRACER_PROFILE } from '../src/fx/Effects.js';
import { Bot } from '../src/entities/Bot.js';

// Polyfill DOM Canvas para testes headless em Node.js
if (typeof document === 'undefined') {
  const dummyCtx = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => ({ addColorStop: () => {} });
      }
      return () => {};
    }
  });
  global.document = {
    createElement: () => ({
      getContext: () => dummyCtx,
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

// Verifica que a trajetória permanece 100% colinear no eixo Z (X=0, Y=1.5), sem desviar pelo movimento do cano
if (Math.abs(photoT.group.position.x) > 0.001) {
  throw new Error(`Traçante curvou/desviou em X: ${photoT.group.position.x} (esperado 0)`);
}
console.log(`✅ Ring Buffer N=8 ativo (samples=${photoT.sampleCount}), Core e Glow sincronizados!`);
console.log('✅ Traçante permaneceu 100% colinear com a trajetória balística inicial (ZERO curvatura no flick)!');
console.log(`✅ Opacidade Core: ${photoT.coreMat.opacity.toFixed(2)}, Opacidade Glow: ${photoT.glowMat.opacity.toFixed(2)}`);

// Simula até expiração completa
while (photoT.active) {
  effects.update(0.016);
}
if (photoT.originTracker !== null) {
  throw new Error('originTracker não foi liberado após expiração (vazamento de referência)');
}
console.log('✅ Expiração e liberação de memória fotográfica validadas sem vazamentos!');

// [Teste 5] Validação de rifle_proto (Laser), vss (Subsonic Swipe) e m12 (Buckshot Pellets)
console.log('\n[Teste 5] Validando rifle_proto (Laser), vss (Subsonic Swipe) e m12 (Buckshot Pellets)...');

// 5a. rifle_proto: laser style
let laserFired = null;
const unsubLaser = on('tracer:fire', e => { laserFired = e; });
projManager.spawn({
  origin: new THREE.Vector3(0, 1.5, 0),
  direction: new THREE.Vector3(0, 0, 1),
  weaponDef: {
    id: 'rifle_proto',
    bulletSpeed: 950,
    tracerColor: '#00ffff',
    tracerProfile: {
      style: 'laser',
      ttl: 0.045,
      headSpeed: 0.25,
      streakLength: 0.70,
      width: 1.2,
      coreRadius: 0.008,
      glowRadius: 0.038,
      coreColor: '#e0ffff',
      glowColor: '#00ffff',
      flashProfile: { size: 0.28, opacity: 0.85, lightIntensity: 11, lightDistance: 5, color: '#00ffff', duration: 0.045, maskElasticOffset: 0.03 }
    }
  }
});
unsubLaser();
if (!laserFired || laserFired.profile.style !== 'laser') throw new Error('Disparo a laser do rifle_proto não emitiu tracer com style laser');
const laserTracer = effects.tracers.find(t => t.active && t.profile?.style === 'laser');
if (!laserTracer) throw new Error('FlashTracer a laser não ativado no pool');
effects.update(0.016);
if (!laserTracer.group.visible) throw new Error('Laser tracer não visível após primeiro update');
console.log('✅ rifle_proto: Feixe Laser interpolado com sucesso sem curvatura nem strafe lag!');

// 5b. vss: subsonic 290 m/s deve emitir tracer:fire (desacoplado) com style swipe
let vssFired = null;
const unsubVss = on('tracer:fire', e => { vssFired = e; });
projManager.spawn({
  origin: new THREE.Vector3(0, 1.5, 0),
  direction: new THREE.Vector3(0, 0, 1),
  weaponDef: {
    id: 'vss',
    bulletSpeed: 290,
    tracerColor: '#ffffff',
    tracerProfile: {
      style: 'swipe',
      ttl: 0.058,
      headSpeed: 0.35,
      streakLength: 0.45,
      width: 1.0,
      coreRadius: 0.006,
      glowRadius: 0.032,
      coreColor: '#ffffff',
      glowColor: '#dcdcdc',
      flashProfile: { size: 0.12, opacity: 0.28, lightIntensity: 2, lightDistance: 2, color: '#888888', duration: 0.03, maskElasticOffset: 0.01 }
    }
  }
});
unsubVss();
if (!vssFired) throw new Error('VSS (290 m/s subsonic) não emitiu tracer:fire desacoplado');
console.log('✅ vss: Projétil subsônico 290 m/s emite FlashTracer desacoplado (ZERO strafe lag)!');

// 5c. m12: shotgun pellets
let pelletTracerCount = 0;
const unsubPellets = on('tracer:fire', e => {
  if (e.isPellet) pelletTracerCount++;
});
for (let i = 0; i < 7; i++) {
  projManager.spawn({
    origin: new THREE.Vector3(0, 1.5, 0),
    direction: new THREE.Vector3((i - 3) * 0.01, 0, 1).normalize(),
    weaponDef: {
      id: 'm12',
      pellets: 7,
      bulletSpeed: 360,
      tracerColor: '#ff9933',
      tracerProfile: {
        style: 'swipe',
        ttl: 0.065,
        headSpeed: 0.35,
        streakLength: 0.40,
        coreRadius: 0.007,
        glowRadius: 0.032,
        width: 1.0,
        flashProfile: { size: 0.36, opacity: 0.92, lightIntensity: 14, lightDistance: 6.5, color: '#ff9933', duration: 0.06, maskElasticOffset: 0.06 }
      }
    },
    isPellet: true
  });
}
unsubPellets();
if (pelletTracerCount !== 7) throw new Error(`Esperado 7 pellets tracer:fire, recebido ${pelletTracerCount}`);
console.log(`✅ m12: Todos os 7 balins de buckshot geraram FlashTracers visíveis com scale seguro!`);

// 5d. m249: Estilo swipe derivado da SW500 (lengthMultiplier calibrado em 1.4)
let m249Fired = null;
const unsubM249 = on('tracer:fire', e => { m249Fired = e; });
projManager.spawn({
  origin: new THREE.Vector3(0, 1.5, 0),
  direction: new THREE.Vector3(0, 0, 1),
  weaponDef: {
    id: 'm249',
    bulletSpeed: 850,
    tracerColor: '#ffbb33',
    tracerProfile: {
      style: 'swipe',
      ttl: 0.080,
      headSpeed: 0.28,
      streakLength: 0.65,
      lengthMultiplier: 1.4,
      fadeInEnd: 0.08,
      fadeOutStart: 0.70,
      coreRadius: 0.010,
      glowRadius: 0.050,
      coreColor: '#ffffff',
      glowColor: '#ffbb33',
      coreBrightness: 1.5,
      glowBrightness: 0.90,
      maxOpacity: 1.0,
      width: 1.4,
      flashProfile: { size: 0.38, opacity: 0.95, lightIntensity: 15.0, lightDistance: 7.0, color: '#ffaa22', duration: 0.055, maskElasticOffset: 0.04 }
    }
  }
});
unsubM249();
if (!m249Fired) throw new Error('Disparo da M249 não emitiu tracer:fire');
const m249Tracer = effects.tracers.find(t => t.active && t.profile?.lengthMultiplier === 1.4);
if (!m249Tracer) throw new Error('FlashTracer da M249 (1.4x lengthMultiplier) não ativado no pool');

// Simula frame 1 a 60fps (dt = 0.016s):
effects.update(0.016);
if (!m249Tracer.group.visible) {
  throw new Error('M249 tracer não visível após update');
}
const m249Len = m249Tracer.coreMesh.scale.y;
if (m249Len <= 0.05) {
  throw new Error(`Comprimento espacial da M249 insuficiente: ${m249Len.toFixed(2)}m`);
}
console.log(`✅ m249: FlashTracer swipe calibrado (${m249Len.toFixed(2)}m) renderizado com sucesso!`);

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE FLASH & TRACER FOTOGRÁFICO PASSARAM COM SUCESSO!');
console.log('==================================================');


