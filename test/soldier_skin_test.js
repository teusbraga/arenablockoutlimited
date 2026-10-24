import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import createCharacter, {
  createCharacterMaterials,
  applyPaletteToMaterials,
  applyPaletteToCharacter,
  TACTICAL_PALETTES
} from '../src/view/models/TacticalManContinuous.js';
import { ViewmodelArms } from '../src/weapons/ViewmodelArms.js';
import { CharacterView } from '../src/view/CharacterView.js';
import { Player } from '../src/entities/Player.js';
import {
  SOLDIER_SKIN_PRESETS,
  DEFAULT_SOLDIER_SKIN,
  MenuController
} from '../src/ui/MenuController.js';

describe('Soldier Skin & Character Color Customization Suite', () => {

  it('SOLDIER_SKIN_PRESETS contém presets com todas as propriedades necessárias', () => {
    assert.ok(DEFAULT_SOLDIER_SKIN, 'DEFAULT_SOLDIER_SKIN deve existir');
    assert.strictEqual(DEFAULT_SOLDIER_SKIN.preset, 'woodland');

    const expectedPresets = ['woodland', 'urban', 'desert', 'specops', 'mercenary', 'arctic', 'crimson', 'navy', 'hazard', 'custom'];
    for (const key of expectedPresets) {
      const p = SOLDIER_SKIN_PRESETS[key];
      assert.ok(p, `Preset ${key} deve existir em SOLDIER_SKIN_PRESETS`);
      assert.ok(p.uniform, `Preset ${key} deve ter cor uniform`);
      assert.ok(p.vest, `Preset ${key} deve ter cor vest`);
      assert.ok(p.pads, `Preset ${key} deve ter cor pads`);
      assert.ok(p.skinTone, `Preset ${key} deve ter cor skinTone`);
    }
  });

  it('createCharacterMaterials suporta paleta customizada e tom de pele', () => {
    const customSkin = {
      uniform: '#5a1f24',
      sheenColor: '#8a333b',
      vest: '#281316',
      pads: '#140c0d',
      skinTone: '#5a3d28',
    };

    const mats = createCharacterMaterials(THREE, { palette: customSkin });
    assert.ok(mats, 'Materiais devem ser criados');
    assert.strictEqual(mats.oliveCombatMat.color.getHexString(), '5a1f24');
    assert.strictEqual(mats.oliveCombatMat.sheenColor.getHexString(), '8a333b');
    assert.strictEqual(mats.vestMainMat.color.getHexString(), '281316');
    assert.strictEqual(mats.polymerHardPadMat.color.getHexString(), '140c0d');
    assert.strictEqual(mats.skinMat.color.getHexString(), '5a3d28');
  });

  it('applyPaletteToMaterials atualiza materiais existentes dinamicamente em tempo real', () => {
    const mats = createCharacterMaterials(THREE);
    assert.notStrictEqual(mats.oliveCombatMat.color.getHexString(), 'cdd6db');

    // Aplica Arctic Snow
    const arctic = SOLDIER_SKIN_PRESETS.arctic;
    applyPaletteToMaterials(mats, arctic);

    assert.strictEqual(mats.oliveCombatMat.color.getHexString(), 'cdd6db');
    assert.strictEqual(mats.vestMainMat.color.getHexString(), '7b878f');
    assert.strictEqual(mats.polymerHardPadMat.color.getHexString(), '383e43');
    assert.strictEqual(mats.skinMat.color.getHexString(), 'e6be9f');
  });

  it('applyPaletteToCharacter altera as cores do modelo 3D do personagem', () => {
    const character = createCharacter(THREE);
    assert.ok(character.userData.mats, 'Modelo do personagem deve expor mats em userData');

    applyPaletteToCharacter(character, {
      uniform: '#ff0000',
      vest: '#00ff00',
      pads: '#0000ff',
      skinTone: '#ffffff'
    });

    const mats = character.userData.mats;
    assert.strictEqual(mats.oliveCombatMat.color.getHexString(), 'ff0000');
    assert.strictEqual(mats.vestMainMat.color.getHexString(), '00ff00');
    assert.strictEqual(mats.polymerHardPadMat.color.getHexString(), '0000ff');
    assert.strictEqual(mats.skinMat.color.getHexString(), 'ffffff');
  });

  it('ViewmodelArms.applySkin altera as mangas e pele dos braços em primeira pessoa', () => {
    const mount = new THREE.Group();
    const arms = new ViewmodelArms(mount);

    assert.ok(arms.mats, 'ViewmodelArms deve possuir mats');
    arms.applySkin({
      uniform: '#232f3e',
      skinTone: '#9e6e4f'
    });

    assert.strictEqual(arms.mats.oliveCombatMat.color.getHexString(), '232f3e');
    assert.strictEqual(arms.mats.skinMat.color.getHexString(), '9e6e4f');

    arms.destroy();
  });

  it('CharacterView e Player propagam a skin selecionada para o modelo em 3ª pessoa', () => {
    const scene = new THREE.Scene();
    const fakeWorld = { addBody: () => {}, removeBody: () => {}, testSphere: () => null };
    const player = new Player(fakeWorld, [-50, -50, 50, 50], [0, 0, 0], scene);

    assert.ok(player.view, 'Player deve ter CharacterView');
    assert.ok(player.view.tactical, 'CharacterView deve conter modelo tático');

    player.setSoldierSkin({
      uniform: '#666128',
      vest: '#2d2c1c',
      pads: '#15150f',
      skinTone: '#c4987e'
    });

    const mats = player.view.tactical.userData.mats;
    assert.strictEqual(mats.oliveCombatMat.color.getHexString(), '666128');
    assert.strictEqual(mats.vestMainMat.color.getHexString(), '2d2c1c');
    assert.strictEqual(mats.polymerHardPadMat.color.getHexString(), '15150f');

    player.destroy();
  });

  it('MenuController salva e recupera a skin do localStorage com integridade', () => {
    // Mock do localStorage
    const storage = {};
    globalThis.localStorage = {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    };

    // Caso 1: Vazio retorna padrão
    const initial = MenuController.getSavedSoldierSkin();
    assert.strictEqual(initial.preset, 'woodland');

    // Caso 2: Salva custom e recupera
    const testSkin = {
      preset: 'specops',
      name: 'Spec-Ops Dark',
      uniform: '#1f2327',
      vest: '#151719',
      pads: '#0a0c0d',
      skinTone: '#c4987e'
    };
    MenuController.saveSoldierSkin(testSkin);

    const loaded = MenuController.getSavedSoldierSkin();
    assert.strictEqual(loaded.preset, 'specops');
    assert.strictEqual(loaded.uniform, '#1f2327');
    assert.strictEqual(loaded.vest, '#151719');
    assert.strictEqual(loaded.pads, '#0a0c0d');
  });

});
