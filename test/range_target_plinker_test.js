import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { textures } from '../src/world/TextureGenerator.js';
import { materialFactory } from '../src/world/MaterialFactory.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { ItalyProps } from '../src/world/ItalyProps.js';
import { SOUND_PRESETS } from '../src/audio/procedural/SoundPresets.js';
import { TerminalBallistics } from '../src/audio/procedural/TerminalBallistics.js';
import { NoiseBuffers } from '../src/audio/procedural/NoiseBuffers.js';
import { AudioSystem } from '../src/audio/AudioSystem.js';
import { emit } from '../src/core/EventBus.js';

test('Range Map Facelift & PBR Environment Validation', () => {
  const mapPath = path.resolve('assets/maps/range.json');
  assert.ok(fs.existsSync(mapPath), 'range.json deve existir');

  const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  assert.strictEqual(data.id, 'range', 'ID do mapa deve ser range');
  assert.strictEqual(data.pbr, true, 'Mapa deve habilitar PBR');
  assert.strictEqual(data.floorMaterial, 'concrete', 'Piso deve ser concreto');

  // Validação do clima claro e ensolarado
  assert.ok(data.environment, 'Deve possuir configurações de environment');
  assert.strictEqual(data.environment.fogColor, '#7dc2f5', 'Névoa/Céu deve ser azul ensolarado');
  assert.ok(data.environment.fogFar >= 200, 'Visibilidade deve ser ampla e clara (>200m)');
  assert.ok(data.environment.sunIntensity >= 2.0, 'Sol deve ter iluminação ensolarada viva');

  // Validação de alvos e plinkers
  const plinkers = (data.props || []).filter(p => p.type === 'plinker_target');
  const paperTargets = (data.props || []).filter(p => p.type === 'paper_target');
  const staticTargets = (data.staticGeometry || []).filter(g => g.material === 'target');

  assert.ok(plinkers.length >= 5, 'Deve ter no mínimo 5 alvos plinkers posicionados');
  assert.ok(paperTargets.length >= 6, 'Deve ter no mínimo 6 alvos de papel 3D');
  assert.ok(staticTargets.length >= 6, 'Deve ter alvos de estande com textura target na staticGeometry');
});

test('Procedural Target & Concrete Texture Generation', () => {
  assert.strictEqual(typeof textures.createShootingTarget, 'function', 'Deve possuir createShootingTarget');
  assert.strictEqual(typeof textures.createConcrete, 'function', 'Deve possuir createConcrete');

  const targetTex = textures.createShootingTarget(256);
  assert.ok(targetTex, 'Alvo deve retornar bundle de texturas');
  assert.ok('diffuse' in targetTex, 'Alvo deve conter chave diffuse');
  assert.ok('bump' in targetTex, 'Alvo deve conter chave bump');
  assert.ok('roughness' in targetTex, 'Alvo deve conter chave roughness');

  const concreteTex = textures.createConcrete(256);
  assert.ok(concreteTex, 'Concreto deve retornar bundle de texturas');
  assert.ok('diffuse' in concreteTex, 'Concreto deve conter chave diffuse');
  assert.ok('bump' in concreteTex, 'Concreto deve conter chave bump');
});

test('MaterialFactory Target & Plinker PBR Materials', () => {
  materialFactory.initMaterials();

  const matTarget = materialFactory.get('target');
  assert.ok(matTarget, 'Material target deve estar registrado');
  assert.strictEqual(matTarget.type, 'MeshStandardMaterial', 'Target deve ser MeshStandardMaterial');

  const matConcrete = materialFactory.get('concrete');
  assert.ok(matConcrete, 'Material concrete deve estar registrado');
  assert.strictEqual(matConcrete.type, 'MeshStandardMaterial', 'Concrete deve ser MeshStandardMaterial');

  const matPlinker = materialFactory.get('plinker');
  assert.ok(matPlinker, 'Material plinker deve estar registrado');
  assert.ok(matPlinker.metalness >= 0.8, 'Plinker deve ter alto metalness');
});

test('ItalyProps - Paper Target 3D Construction and Collision', () => {
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const props = new ItalyProps(scene, world);

  const group = props.addPaperTarget(0, 0, 10, 0, 1.0);
  assert.ok(group instanceof THREE.Group, 'addPaperTarget deve retornar Group');

  const boxes = world.getNearbyBoxes(-2, 2, 8, 12);
  const targetBox = boxes.find(b => b.meta?.isTarget || b.meta?.material === 'target');
  assert.ok(targetBox, 'Deve registrar colisor do alvo no CollisionWorld');
  assert.strictEqual(targetBox.meta.material, 'target', 'Material do colisor deve ser target');
});

test('ItalyProps - Plinker Target Pendulum Physics & Hit Reaction', () => {
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const props = new ItalyProps(scene, world);

  const plinker = props.addPlinkerTarget(0, 0, 15, 0, 0.28, 1.75);
  assert.ok(plinker, 'Plinker target deve ser instanciado');
  assert.strictEqual(plinker.angle, 0, 'Ângulo inicial de repouso deve ser 0');
  assert.strictEqual(plinker.angularVel, 0, 'Velocidade angular inicial deve ser 0');

  // Disparo simulado atingindo o plinker
  plinker.hit({ weapon: { ballistics: { terminal: { damage: 45 } } } });
  assert.ok(plinker.angularVel < 0, 'Tiro deve aplicar impulso negativo balançando o alvo para trás');

  const initialVel = plinker.angularVel;
  // Avança física 100ms
  plinker.update(0.1);
  assert.ok(plinker.angle < 0, 'Alvo deve ter rotacionado para trás');
  assert.notStrictEqual(plinker.mesh?.rotation?.x, 0, 'A rotação 3D da malha deve acompanhar o pêndulo');

  // Amortecimento ao longo de 4 segundos
  for (let i = 0; i < 240; i++) {
    plinker.update(1 / 60);
  }
  assert.ok(Math.abs(plinker.angle) < 0.05, 'Pêndulo deve amortecer e estabilizar perto de zero após 4s');

  plinker.destroy();
});

test('Procedural Audio - Plinker Ping "PLIINNN" Synthesizer', () => {
  assert.ok(SOUND_PRESETS.bullet_hit_plinker, 'Deve possuir preset bullet_hit_plinker');
  assert.ok(SOUND_PRESETS.bullet_hit_plinker.gongFreq >= 1500, 'Frequência do gongo deve ser brilhante (~1650 Hz)');
  assert.ok(SOUND_PRESETS.bullet_hit_plinker.ringDecay >= 1.0, 'Ressonância do gongo deve sustentar > 1.0s');

  // Mock de AudioContext
  let oscillatorsCreated = 0;
  let gainsCreated = 0;
  let freqsSet = [];

  const mockCtx = {
    currentTime: 0,
    createOscillator() {
      oscillatorsCreated++;
      return {
        type: 'sine',
        frequency: {
          setValueAtTime(v) { freqsSet.push(v); },
          exponentialRampToValueAtTime() {}
        },
        connect() {},
        start() {},
        stop() {}
      };
    },
    createGain() {
      gainsCreated++;
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {}
        },
        connect() {}
      };
    },
    createBiquadFilter() {
      return {
        type: 'bandpass',
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {}
      };
    }
  };

  const noiseBuffers = new NoiseBuffers();
  // Buffer simulado
  noiseBuffers.white = { length: 100 };
  noiseBuffers.createSource = () => ({
    connect() {},
    start() {},
    stop() {}
  });

  const ballistics = new TerminalBallistics(noiseBuffers);
  assert.strictEqual(typeof ballistics.synthesizeBulletHitPlinker, 'function', 'Deve possuir synthesizeBulletHitPlinker');

  ballistics.synthesizeBulletHitPlinker(SOUND_PRESETS.bullet_hit_plinker, mockCtx, {});
  assert.ok(oscillatorsCreated >= 3, 'Deve gerar pelo menos 3 harmônicos tonais para o PLIINNNG do gongo');
  assert.ok(freqsSet.some(f => f >= 1500 && f <= 1800), 'Deve incluir a frequência fundamental do gongo (~1650 Hz)');
  assert.ok(freqsSet.some(f => f > 4000), 'Deve incluir harmônicos superiores metálicos (>4000 Hz)');
});

test('AudioSystem - EventBus shot:world dispatches Plinker sound', () => {
  const audio = new AudioSystem();
  let plinkerSoundCalled = false;

  audio.playProceduralPlinkerHit = (pos, delay) => {
    plinkerSoundCalled = true;
  };

  emit('shot:world', {
    material: 'plinker',
    point: { x: 0, y: 1.5, z: 10 },
    box: { meta: { isPlinker: true } }
  });

  assert.strictEqual(plinkerSoundCalled, true, 'Disparo em plinker deve acionar som de plinker');
  audio.destroy();
});
