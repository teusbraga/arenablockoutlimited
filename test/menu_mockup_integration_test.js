import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { CharacterView } from '../src/view/CharacterView.js';
import { Viewmodel } from '../src/weapons/Viewmodel.js';

test('Menu Mockup & Lobby Architecture - HTML Structure & Preserved IDs', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  // 1. Header do Lobby
  assert.ok(html.includes('class="lobby-header"'), 'Deve possuir .lobby-header');
  assert.ok(html.includes('id="lobby-player-name"'), 'Deve possuir #lobby-player-name editável');
  assert.ok(html.includes('class="lobby-level"'), 'Deve possuir .lobby-level');
  assert.ok(html.includes('lobby-currency-badge'), 'Deve possuir badges de economia');
  assert.ok(html.includes('id="btn-settings"'), 'Deve possuir #btn-settings');

  // 2. Ações Inferiores Esquerdas
  assert.ok(html.includes('id="btn-inventory"'), 'Deve possuir #btn-inventory');
  assert.ok(html.includes('id="btn-shop"'), 'Deve possuir #btn-shop');
  assert.ok(html.includes('id="btn-pass"'), 'Deve possuir #btn-pass');

  // 3. Card de Mapa & Botão JOGAR
  assert.ok(html.includes('id="lobby-map-card"'), 'Deve possuir #lobby-map-card');
  assert.ok(html.includes('id="lobby-map-name"'), 'Deve possuir #lobby-map-name');
  assert.ok(html.includes('id="lobby-map-sub"'), 'Deve possuir #lobby-map-sub');
  assert.ok(html.includes('id="btn-play"'), 'Deve possuir #btn-play');

  // 4. Modais
  assert.ok(html.includes('id="modal-map-loadout"'), 'Deve possuir #modal-map-loadout');
  assert.ok(html.includes('id="modal-settings"'), 'Deve possuir #modal-settings');
  assert.ok(html.includes('id="modal-pause"'), 'Deve possuir #modal-pause');
  assert.ok(html.includes('id="btn-resume-pause"'), 'Deve possuir #btn-resume-pause');
  assert.ok(html.includes('id="btn-settings-pause"'), 'Deve possuir #btn-settings-pause');
  assert.ok(html.includes('id="btn-quit-pause"'), 'Deve possuir #btn-quit-pause');

  // 5. IDs Críticos de Configuração Preservados
  const requiredIds = [
    'weapon-select',
    'weapon-secondary-select',
    'map-select',
    'bot-count',
    'round-time',
    'ch-style-select',
    'ch-mode-select',
    'vol-master-slider',
    'vol-weapons-slider',
    'texture-mode-select',
    'sens-slider',
    'dev-mode-toggle'
  ];
  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `Deve preservar o controle com id='${id}'`);
  }
});

test('CharacterView - setWeaponModel dinâmico', () => {
  const scene = new THREE.Scene();
  const mockCharacter = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
  const view = new CharacterView(mockCharacter, scene, { id: 1, skinType: 'soldier' });

  assert.ok(view.gunGroup, 'Deve possuir gunGroup');
  assert.ok(typeof view.setWeaponModel === 'function', 'Deve implementar setWeaponModel');

  // Troca para ar15 / fallback
  view.setWeaponModel('ar15');
  assert.ok(view.gunGroup.children.length > 0, 'gunGroup deve conter malhas após setWeaponModel(ar15)');

  // Troca para ak47
  view.setWeaponModel('ak47');
  assert.ok(view.gunGroup.children.length > 0, 'gunGroup deve conter malhas após setWeaponModel(ak47)');

  // Troca para arma inexistente deve acionar fallback seguro sem lançar exceção
  view.setWeaponModel('arma_inexistente_xyz');
  assert.ok(view.gunGroup.children.length > 0, 'gunGroup deve usar fallback seguro');
});

test('Viewmodel - setVisible controla visibilidade de braços 1ª pessoa', () => {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  const vm = new Viewmodel(camera);

  assert.ok(typeof vm.setVisible === 'function', 'Deve implementar setVisible');

  vm.setVisible(false);
  assert.strictEqual(vm.swayGroup.visible, false, 'swayGroup deve ficar invisível quando setVisible(false)');

  vm.setVisible(true);
  assert.strictEqual(vm.swayGroup.visible, true, 'swayGroup deve ficar visível quando setVisible(true)');
});
