import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { WeaponRegistry } from '../src/weapons/WeaponRegistry.js';
import {
  getSharedFaceTexture,
  getSharedHairCardTextures,
  getSharedShirtTexture,
  createCharacterMaterials
} from '../src/view/models/TacticalManContinuous.js';
import { ScopeSystem } from '../src/weapons/ScopeSystem.js';

// Setup DOM mocks for headless environment
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};
if (!globalThis.innerWidth) globalThis.innerWidth = 1920;
if (!globalThis.innerHeight) globalThis.innerHeight = 1080;
if (!globalThis.document) {
  globalThis.document = {
    getElementById: () => null,
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => new Proxy({
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createLinearGradient: () => ({ addColorStop: () => {} }),
            measureText: () => ({ width: 10 }),
            getImageData: () => ({ data: new Uint8ClampedArray(4) })
          }, {
            get: (target, prop) => {
              if (prop in target) return target[prop];
              return () => {};
            }
          })
        };
      }
      return {};
    },
    addEventListener: () => {}
  };
}

describe('Phase 4 - Architectural Pillars & Low-End Optimization', () => {

  it('1. WeaponRegistry: 10 armas canônicas e metadados de luneta', () => {
    const expectedWeapons = [
      'ar15', 'ak47', 'p9', 'sw500', 'm12',
      'uzi', 'm249', 'rifle_proto', 'vss', 'scar_h'
    ];

    for (const id of expectedWeapons) {
      assert.strictEqual(WeaponRegistry.has(id), true, `Arma '${id}' deve estar registrada no WeaponRegistry`);
      const builder = WeaponRegistry.getBuilder(id);
      assert.strictEqual(typeof builder, 'function', `Builder de '${id}' deve ser uma função`);
    }

    const scopeWeapons = WeaponRegistry.getScopeWeaponIds();
    assert.deepStrictEqual(scopeWeapons.sort(), ['rifle_proto', 'scar_h', 'vss'].sort(), 'Deve listar exatamente as 3 armas com luneta');
  });

  it('2. WeaponRegistry: Povoamento automático de Viewmodel e ItemDrops', () => {
    const registeredInViewmodel = {};
    const mockViewmodel = {
      registerModel: (id, builder) => {
        registeredInViewmodel[id] = builder;
      }
    };

    let itemDropBuilders = null;
    const mockItemDrop = {
      setBuilders: (builders) => {
        itemDropBuilders = builders;
      }
    };

    WeaponRegistry.populateViewmodel(mockViewmodel);
    assert.strictEqual(Object.keys(registeredInViewmodel).length, 10, 'Deve registrar todas as 10 armas no viewmodel');

    WeaponRegistry.populateItemDrops(mockItemDrop);
    assert.ok(itemDropBuilders, 'Deve povoar os builders em ItemDrop');
    assert.strictEqual(Object.keys(itemDropBuilders).length, 10, 'Deve conter os 10 builders em ItemDrop');
  });

  it('3. TacticalManContinuous: Cache estático de texturas (Zero duplicação na VRAM)', () => {
    // 1. Texturas compartilhadas retornam sempre a mesma instância
    const face1 = getSharedFaceTexture(THREE);
    const face2 = getSharedFaceTexture(THREE);
    assert.strictEqual(face1, face2, 'getSharedFaceTexture deve retornar a mesma instância em cache');

    const hair1 = getSharedHairCardTextures(THREE);
    const hair2 = getSharedHairCardTextures(THREE);
    assert.strictEqual(hair1, hair2, 'getSharedHairCardTextures deve retornar a mesma instância em cache');

    const shirt1 = getSharedShirtTexture(THREE);
    const shirt2 = getSharedShirtTexture(THREE);
    assert.strictEqual(shirt1, shirt2, 'getSharedShirtTexture deve retornar a mesma instância em cache');

    // 2. Materiais criados para múltiplos soldados compartilham a mesma textura
    const matsSoldierA = createCharacterMaterials(THREE, { paletteIndex: 0 });
    const matsSoldierB = createCharacterMaterials(THREE, { paletteIndex: 1 });

    assert.strictEqual(matsSoldierA.faceMat.map, matsSoldierB.faceMat.map, 'Soldados devem compartilhar a textura de rosto');
    assert.strictEqual(matsSoldierA.hairCardMat.map, matsSoldierB.hairCardMat.map, 'Soldados devem compartilhar hair card map');
    assert.strictEqual(matsSoldierA.greyCombatShirtMat.map, matsSoldierB.greyCombatShirtMat.map, 'Soldados devem compartilhar camisa tática');
  });

  it('4. ScopeSystem: Isolamento e suspensão de sombras durante passe offscreen', () => {
    let shadowStateDuringRender = null;
    const mockRenderer = {
      shadowMap: { enabled: true },
      setRenderTarget: () => {},
      render: () => {
        shadowStateDuringRender = mockRenderer.shadowMap.enabled;
      }
    };

    const mockScene = new THREE.Scene();
    const scope = new ScopeSystem(mockRenderer, mockScene);

    // Mock dos detalhes da arma
    const mockDetails = {
      rearLens: new THREE.Object3D(),
      frontLens: new THREE.Object3D(),
      opticBody: new THREE.Object3D()
    };
    scope.attachWeaponModel('rifle_proto', mockDetails);
    scope.scopeOn = true;
    scope.adsT = 1.0;

    const mockMainCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    scope.mainCameraRef = mockMainCamera;
    scope.renderScopePass(new THREE.Object3D());

    assert.strictEqual(shadowStateDuringRender, false, 'Sombras devem ser desabilitadas durante o render offscreen da luneta');
    assert.strictEqual(mockRenderer.shadowMap.enabled, true, 'Sombras do renderer principal devem ser restauradas após o passe da luneta');
  });

});
