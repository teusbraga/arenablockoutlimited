import assert from 'assert';
import * as THREE from 'three';
import { AudioSystem } from '../src/audio/AudioSystem.js';
import { SmokeGrenadeManager } from '../src/weapons/SmokeGrenadeManager.js';
import { SmokeGrenade } from '../src/weapons/SmokeGrenade.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';

console.log('--- TESTE: Áudio Espacial 3D, Oclusão Geométrica e Smoke Grenade ---');

// 1. Teste de Oclusão Geométrica do Áudio
{
  const world = new CollisionWorld();
  // Parede centrada em (5, 2, 0) com sx=2, sy=4, sz=10 (ocupa x: 4..6, y: 0..4, z: -5..5)
  world.addBox(5, 2, 0, 2, 4, 10);

  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.7, 0); // Ouvinte em (0, 1.7, 0)
  camera.lookAt(10, 1.7, 0);

  const audio = new AudioSystem();
  audio.setCamera(camera);
  audio.setWorld(world);

  // Fonte atrás da parede: (10, 1.7, 0)
  const soundBehindWall = new THREE.Vector3(10, 1.7, 0);
  const isOccludedBehind = audio.checkOcclusion(soundBehindWall);
  assert.strictEqual(isOccludedBehind, true, 'O som atrás de parede sólida deve ser ocluído (true)');

  // Fonte em linha de visão desobstruída: (2, 1.7, 0)
  const soundInSight = new THREE.Vector3(2, 1.7, 0);
  const isOccludedInSight = audio.checkOcclusion(soundInSight);
  assert.strictEqual(isOccludedInSight, false, 'O som sem obstrução não deve ser ocluído (false)');

  console.log('✓ Raycast de oclusão acústica 3D validado com sucesso.');
}

// 2. Teste do SmokeGrenadeManager e Regras de Cooldown / Duração
{
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  const audio = new AudioSystem();

  const manager = new SmokeGrenadeManager({
    scene,
    world,
    audio
  });

  const dummyCamera = new THREE.PerspectiveCamera();
  dummyCamera.position.set(0, 1.7, 0);
  const dummyPlayer = { pos: new THREE.Vector3(0, 1.7, 0) };

  // Arremesso 1: Deve ser bem-sucedido
  const thrown1 = manager.throw({ camera: dummyCamera, player: dummyPlayer });
  assert.strictEqual(thrown1, true, 'Primeiro arremesso deve ser aceito');
  assert.strictEqual(manager.grenades.length, 1, 'Deve haver 1 granada ativa');
  assert.strictEqual(manager.cooldown, 30.0, 'O cooldown inicial deve ser rigorosamente 30 segundos');

  // Arremesso 2 (imediato): Deve falhar devido ao cooldown
  const thrown2 = manager.throw({ camera: dummyCamera, player: dummyPlayer });
  assert.strictEqual(thrown2, false, 'Arremesso em cooldown deve ser bloqueado');
  assert.strictEqual(manager.grenades.length, 1, 'Não deve criar granada extra');
  assert.strictEqual(manager.getRemainingSeconds(), 30, 'Restante deve indicar 30 segundos');

  // Simular passagem de tempo: 5 segundos
  manager.update(5);
  assert.strictEqual(Math.round(manager.cooldown), 25, 'Após 5s, cooldown restante deve ser 25s');
  assert.strictEqual(manager.grenades.length, 1, 'Granada ainda deve estar ativa após 5s');

  // Simular mais 7 segundos (total 12s): granada voa (~1.2s) + fica ativa por 10s (total ~11.2s)
  manager.update(7);
  assert.strictEqual(manager.grenades.length, 0, 'Granada deve dissipar e se remover após seus 10s de fumaça');
  assert.strictEqual(Math.round(manager.cooldown), 18, 'Cooldown restante deve ser 18s');

  // Passar mais 19s para zerar o cooldown de 30s
  manager.update(19);
  assert.strictEqual(manager.cooldown, 0, 'Cooldown deve zerar');
  assert.strictEqual(manager.canThrow(), true, 'Deve poder lançar novamente');

  // Arremesso 3: Deve ser aceito novamente
  const thrown3 = manager.throw({ camera: dummyCamera, player: dummyPlayer });
  assert.strictEqual(thrown3, true, 'Após 30 segundos, novo arremesso deve ser permitido');
  assert.strictEqual(manager.cooldown, 30.0, 'Novo cooldown de 30s deve ser engatilhado');

  console.log('✓ SmokeGrenadeManager: Regra de 10s de fumaça e 30s de cooldown comprovadas.');
}

// 3. Teste Físico e Ciclo de Vida da SmokeGrenade
{
  const scene = new THREE.Scene();
  const world = new CollisionWorld();
  // Chão em y=0: centro (0, -0.5, 0), tamanho 20x1x20
  world.addBox(0, -0.5, 0, 20, 1, 20);

  const startPos = new THREE.Vector3(0, 1.7, 0);
  const forward = new THREE.Vector3(0, 0, -1);
  const grenade = new SmokeGrenade({
    pos: startPos,
    dir: forward,
    scene,
    world,
    audio: null
  });

  assert.strictEqual(grenade.duration, 10.0, 'Duração configurada deve ser 10s');
  assert.strictEqual(grenade.state, 'flying', 'Deve iniciar no estado de voo');

  // Simula 1.5s de física para tocar o solo e detonar
  for (let i = 0; i < 90; i++) {
    grenade.update(1 / 60);
  }
  assert.strictEqual(grenade.state, 'active', 'Granada deve ter detonado e ativado a fumaça');

  // Simula 10.2 segundos de fumaça ativa
  for (let i = 0; i < 620; i++) {
    grenade.update(1 / 60);
  }
  assert.strictEqual(grenade.state, 'done', 'Granada deve expirar e entrar em estado done após 10 segundos');

  console.log('✓ Balística, quique, detonação volumétrica e término da SmokeGrenade verificados.');
}

console.log('🎉 TODOS OS TESTES DE ÁUDIO ESPACIAL E SMOKE GRENADE PASSARAM COM SUCESSO!\n');
