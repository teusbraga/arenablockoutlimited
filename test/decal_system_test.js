import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { emit } from '../src/core/EventBus.js';
import { DecalSystem } from '../src/fx/DecalSystem.js';

test('DecalSystem Suite - Inicialização, Balística e Anti-Vazamento', async (t) => {
  const scene = new THREE.Scene();
  const decalSystem = new DecalSystem(scene, {
    config: {
      maxDecals: 16, // Reduzido para teste rápido
      lifetime: 10.0,
      fadeDuration: 2.0,
      normalOffset: 0.002
    },
    surfaceImpacts: {
      concrete: {
        decal: { atlasSlot: 'concrete', baseScale: 1.0, roughness: 0.85, metalness: 0.05 }
      },
      metal: {
        decal: { atlasSlot: 'metal', baseScale: 0.8, roughness: 0.35, metalness: 0.85 }
      }
    }
  });

  await t.test('1. Inicialização do Ring Buffer', () => {
    assert.equal(decalSystem.pool.length, 16, 'Pool deve ter exatamente 16 slots alocados');
    assert.equal(decalSystem.poolIdx, 0, 'Ponteiro inicial deve ser 0');
    assert.ok(scene.children.includes(decalSystem.group), 'Grupo de decals deve estar na cena Three.js');

    for (const d of decalSystem.pool) {
      assert.equal(d.active, false, 'Decal deve iniciar inativo');
      assert.equal(d.mesh.visible, false, 'Mesh deve iniciar invisível');
      assert.ok(d.material.polygonOffset, 'Material deve ter polygonOffset ativo contra Z-fighting');
    }
  });

  await t.test('2. Disparo shot:world e Sobrescrita Circular O(1)', () => {
    // Dispara 20 tiros (mais do que a capacidade de 16)
    for (let i = 0; i < 20; i++) {
      emit('shot:world', {
        point: new THREE.Vector3(i * 0.1, 1.5, -5.0),
        normal: { x: 0, y: 0, z: 1 },
        material: 'concrete',
        weapon: { ammo: '5.56x45' }
      });
    }

    assert.equal(decalSystem.pool.length, 16, 'Pool NUNCA deve crescer além de maxDecals (zero-leak)');
    assert.equal(decalSystem.poolIdx, 4, 'Ponteiro deve ter dado a volta (20 % 16 = 4)');

    const activeCount = decalSystem.pool.filter(d => d.active).length;
    assert.equal(activeCount, 16, 'Todos os 16 slots devem estar ativos');

    // Valida que o último decal gerado tem posição e offset corretos
    const lastDecal = decalSystem.pool[3]; // i=19 é gravado no índice 3 (19 % 16)
    assert.equal(lastDecal.active, true);
    assert.equal(lastDecal.mesh.visible, true);
    // Ponto z = -5.0 + normal.z * 0.002 = -4.998
    assert.ok(Math.abs(lastDecal.mesh.position.z - (-4.998)) < 1e-4);
  });

  await t.test('3. Penetração de parede (shot:penetration) cria entrada e saída blowout', () => {
    decalSystem.reset();
    assert.equal(decalSystem.poolIdx, 0);

    emit('shot:penetration', {
      entryPoint: new THREE.Vector3(0, 1.5, 2.0),
      exitPoint: new THREE.Vector3(0, 1.5, 2.2),
      normal: { x: 0, y: 0, z: -1 },
      material: 'concrete',
      weapon: { ammo: '7.62x39' }
    });

    assert.equal(decalSystem.poolIdx, 2, 'Deve ter gerado exatamente 2 decals');
    const entryDecal = decalSystem.pool[0];
    const exitDecal = decalSystem.pool[1];

    assert.ok(entryDecal.active && exitDecal.active, 'Ambos os decals devem estar ativos');
    assert.ok(
      exitDecal.mesh.scale.x > entryDecal.mesh.scale.x * 1.5,
      'Cratera de saída (blowout) deve ser significativamente maior que o furo de entrada'
    );
  });

  await t.test('4. Ricochete angular (shot:ricochet) deforma o decal em elipse', () => {
    decalSystem.reset();

    emit('shot:ricochet', {
      point: new THREE.Vector3(1, 0, 1),
      normal: { x: 0, y: 1, z: 0 },
      material: 'metal',
      weapon: { ammo: '9x19' }
    });

    const ricoDecal = decalSystem.pool[0];
    assert.ok(ricoDecal.active);
    assert.ok(
      ricoDecal.mesh.scale.y > ricoDecal.mesh.scale.x * 2.0,
      'Decal de ricochete deve ser alongado longitudinalmente no eixo de raspão'
    );
  });

  await t.test('5. Ciclo de Vida e Fade-out no update()', () => {
    decalSystem.reset();

    emit('shot:world', {
      point: new THREE.Vector3(0, 1, 0),
      normal: { x: 0, y: 0, z: 1 },
      material: 'concrete'
    });

    const decal = decalSystem.pool[0];
    assert.equal(decal.material.opacity, 1.0, 'Opacidade inicial deve ser 1.0');

    // Avança 8.5 segundos (lifetime é 10.0, fadeDuration é 2.0 -> resta 1.5s, dentro da janela de fade)
    decalSystem.update(8.5);
    assert.ok(decal.active, 'Decal ainda deve estar ativo');
    assert.ok(decal.material.opacity < 0.85 && decal.material.opacity > 0.65, 'Opacidade deve interpolar suavemente');

    // Avança mais 2.0 segundos (tempo total 10.5s > 10.0s)
    decalSystem.update(2.0);
    assert.equal(decal.active, false, 'Decal deve expirar e ficar inativo');
    assert.equal(decal.mesh.visible, false, 'Mesh deve ficar invisível');
  });

  await t.test('6. Reset e Teardown limpo (destroy)', () => {
    decalSystem.reset();
    assert.equal(decalSystem.poolIdx, 0);

    decalSystem.destroy();
    assert.equal(decalSystem.pool.length, 0, 'Pool deve ser esvaziado no destroy');
    assert.equal(decalSystem._unsubscribes.length, 0, 'Unsubscribes devem ser limpos');
    assert.ok(!scene.children.includes(decalSystem.group), 'Grupo deve ser desvinculado da cena');
  });
});
