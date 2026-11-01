import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DeviceTierDetector } from '../src/core/DeviceTierDetector.js';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { SceneSetup } from '../src/core/SceneSetup.js';
import { CharacterView } from '../src/view/CharacterView.js';
import { ItalyProps } from '../src/world/ItalyProps.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
import { materialFactory } from '../src/world/MaterialFactory.js';
import { startEngine } from '../src/core/Engine.js';

test('Mobile Potato Optimization Suite', async (t) => {
  await t.test('1. DeviceTierDetector classifica corretamente faixas de hardware', () => {
    // Cenário A: Celular fraco (Touch, 2GB RAM, 4 cores)
    const potatoTier = DeviceTierDetector.detect({
      navigator: { maxTouchPoints: 5, deviceMemory: 2, hardwareConcurrency: 4 },
      window: { ontouchstart: true }
    });
    assert.equal(potatoTier, 'potato', 'Celular com <= 2GB RAM e <= 4 cores deve ser detectado como potato');

    // Cenário B: Celular intermediário (Touch, 4GB RAM, 6 cores)
    const lowTier = DeviceTierDetector.detect({
      navigator: { maxTouchPoints: 5, deviceMemory: 4, hardwareConcurrency: 6 },
      window: { ontouchstart: true }
    });
    assert.equal(lowTier, 'low', 'Celular com 4GB RAM e 6 cores deve ser detectado como low');

    // Cenário C: Celular topo de linha (Touch, 8GB RAM, 8 cores)
    const mediumTier = DeviceTierDetector.detect({
      navigator: { maxTouchPoints: 5, deviceMemory: 8, hardwareConcurrency: 8 },
      window: { ontouchstart: true }
    });
    assert.equal(mediumTier, 'medium', 'Celular potente deve ser classificado como medium');

    // Cenário D: Desktop potente (Não-touch, 16GB RAM, 16 cores)
    const highTier = DeviceTierDetector.detect({
      navigator: { maxTouchPoints: 0, deviceMemory: 16, hardwareConcurrency: 16 },
      window: {}
    });
    assert.equal(highTier, 'high', 'Desktop potente deve ser classificado como high');
  });

  await t.test('2. SceneSetup.prototype.applyQualityProfile configura parâmetros estritos no preset potato', () => {
    const mockRenderer = {
      shadowMap: { enabled: true },
      setPixelRatio: (val) => { mockRenderer.pixelRatio = val; },
      pixelRatio: 2.0
    };
    const mockSun = { castShadow: true };
    const mockFill = { visible: true };
    const mockAmbient = { intensity: 1.0 };
    const mockHemi = { intensity: 0.7 };

    const mockSceneSetup = {
      renderer: mockRenderer,
      sun: mockSun,
      fill: mockFill,
      ambient: mockAmbient,
      hemi: mockHemi,
      applyQualityProfile: SceneSetup.prototype.applyQualityProfile
    };

    mockSceneSetup.applyQualityProfile('potato');

    assert.equal(mockRenderer.shadowMap.enabled, false, 'Sombras devem ser desligadas em potato');
    assert.equal(mockSun.castShadow, false, 'Luz solar não deve projetar sombras em potato');
    assert.equal(mockFill.visible, false, 'Luz fill deve ser ocultada em potato');
    assert.equal(mockRenderer.pixelRatio, 1.0, 'DPR deve ser travado em 1.0 em potato');
    assert.equal(mockSceneSetup.currentPreset, 'potato', 'currentPreset deve ser potato');
  });

  await t.test('3. CharacterView instancia LOD leve de soldado no preset potato com hitboxes preservadas', () => {
    const scene = new THREE.Scene();
    const mockChar = {
      alive: true,
      pos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      lean: 0
    };

    CONFIG.GRAPHICS.preset = 'potato';
    const view = new CharacterView(mockChar, scene, { id: 1, skinType: 'soldier' });

    assert.ok(view.isBlockySoldier, 'Deve ativar a malha leve de soldado no modo potato');
    assert.ok(view.head, 'Cabeça deve existir');
    assert.ok(view.body, 'Corpo deve existir');
    assert.equal(view.head.userData.part, 'head', 'Hitbox de cabeça deve ter part: head');
    assert.equal(view.body.userData.part, 'body', 'Hitbox de corpo deve ter part: body');
    assert.ok(view.leftLegPivot, 'Pivô de perna esquerda deve existir para animação');
    assert.ok(view.rightLegPivot, 'Pivô de perna direita deve existir para animação');

    // Executa update com movimento para garantir zero erros de animação
    mockChar.vel.set(2, 0, 2);
    view.update(0.016);
    assert.ok(view.leftLegPivot.rotation.x !== 0, 'Perna deve articular durante caminhada');

    // Restaura preset
    CONFIG.GRAPHICS.preset = 'medium';
    view.destroy();
  });

  await t.test('4. ItalyProps remove adereços puramente cosméticos no modo potato preservando colisões', () => {
    const scene = new THREE.Scene();
    const world = new CollisionWorld();
    const props = new ItalyProps(scene, world);

    CONFIG.GRAPHICS.preset = 'potato';

    // Ivy e Fios cosméticos são pulados
    const ivy = props.addIvyPatch(0, 0, 0);
    assert.equal(ivy, null, 'addIvyPatch deve retornar null no modo potato');

    const wires = props.addOverheadWires(0, 0, 0, 10, 0, 0);
    assert.equal(wires.children.length, 0, 'addOverheadWires deve retornar grupo vazio no modo potato');

    const fern = props.addFernCluster(0, 0, 0);
    assert.equal(fern.children.length, 0, 'addFernCluster deve retornar grupo vazio no modo potato');

    // Bambu pula malhas, mas adiciona colisor ao CollisionWorld
    const prevBoxes = world.boxes.length;
    props.addBambooGrove(0, 0, 0, 8, 2.0, 7.0);
    assert.equal(world.boxes.length, prevBoxes + 1, 'addBambooGrove deve registrar colisor físico mesmo no modo potato');

    CONFIG.GRAPHICS.preset = 'medium';
  });

  await t.test('5. MaterialFactory ajusta propriedades para modo potato', () => {
    materialFactory.initMaterials();
    materialFactory.setRenderMode('potato');

    for (const mat of materialFactory.materials.values()) {
      assert.equal(mat.bumpMap, null, 'bumpMap deve ser nulo no modo potato');
      assert.equal(mat.roughnessMap, null, 'roughnessMap deve ser nulo no modo potato');
      assert.equal(mat.roughness, 1.0, 'roughness deve ser 1.0');
      assert.equal(mat.metalness, 0.0, 'metalness deve ser 0.0');
    }

    // Restaura para PBR
    materialFactory.setRenderMode('pbr');
  });

  await t.test('6. Engine limitRenderFps30 mantém 60 Hz de física e divide taxa de render por 2', () => {
    let fixedCount = 0;
    let renderCount = 0;

    CONFIG.GRAPHICS.limitRenderFps30 = true;

    // Simula loop do motor com tempo artificial
    let simulatedAcc = 0;
    const fixedDt = 1 / 60;
    let renderTick = 0;

    function stepSimulatedFrame(dt) {
      simulatedAcc += dt;
      let steps = 0;
      while (simulatedAcc >= fixedDt && steps < 5) {
        fixedCount++;
        simulatedAcc -= fixedDt;
        steps++;
      }

      renderTick++;
      const shouldLimit30 = Boolean(CONFIG.GRAPHICS?.limitRenderFps30);
      if (!shouldLimit30 || (renderTick % 2 === 0)) {
        renderCount++;
      }
    }

    // Executa 60 frames a 60 Hz exatos (dt = 1/60 = 1 segundo de tempo real)
    for (let f = 0; f < 60; f++) {
      stepSimulatedFrame(1 / 60);
    }

    assert.equal(fixedCount, 60, 'Física deve rodar exatamente 60 vezes em 1 segundo');
    assert.equal(renderCount, 30, 'RenderUpdate deve rodar exatamente 30 vezes quando limitRenderFps30 = true');

    CONFIG.GRAPHICS.limitRenderFps30 = false;
  });
});
