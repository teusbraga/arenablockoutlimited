import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import * as THREE from 'three';

import { SchemaValidator } from '../src/core/SchemaValidator.js';
import { emit, on, setDevMode, CANONICAL_EVENTS, isCanonicalEvent } from '../src/core/EventBus.js';
import { materialFactory } from '../src/world/MaterialFactory.js';
import { startEngine, showCrashScreen } from '../src/core/Engine.js';

test('Phase 2 Diagnostics - SchemaValidator on weapons.json', () => {
  const weaponsData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
  const res = SchemaValidator.validateWeapons(weaponsData.weapons);

  assert.equal(res.valid, true, 'Todas as 10 armas de weapons.json devem passar sem erros na validação');
  assert.equal(res.errors.length, 0);
});

test('Phase 2 Diagnostics - SchemaValidator detects missing ballistic and top-level fields', () => {
  const badWeapons = {
    test_gun: {
      id: 'test_gun',
      name: 'Test Gun',
      // Faltando type, ammo, muzzleLocal, ballistics, etc.
      ballistics: {
        internal: { adsTime: 0.2 }, // Faltando fireInterval, reloadTime
        external: {
          recoil: { vertical: 0.01 }, // Faltando horizontal, recoveryTime
          sway: { base: 0.002 }, // Faltando speed
          precision: { baseSpread: 0.001 } // Faltando recoveryTime
        },
        terminal: {
          damageBody: 20,
          damageHead: 40,
          bulletDrop: 9.8
          // Faltando bulletSpeed
        }
      }
    }
  };

  const loggedErrors = [];
  const originalError = console.error;
  console.error = (...args) => loggedErrors.push(args.join(' '));

  try {
    const res = SchemaValidator.validateWeapons(badWeapons);
    assert.equal(res.valid, false, 'Arma incompleta deve falhar na validação');
    assert.ok(res.errors.some(e => e.includes("campo 'terminal.bulletSpeed' ausente!")), 'Deve alertar especificamente sobre terminal.bulletSpeed ausente');
    assert.ok(res.errors.some(e => e.includes("campo 'muzzleLocal' ausente!")), 'Deve alertar sobre muzzleLocal ausente');
    assert.ok(res.errors.some(e => e.includes("campo 'type' ausente!")), 'Deve alertar sobre type ausente');
    assert.ok(loggedErrors.length > 0, 'Deve ter logado erros no console.error');
  } finally {
    console.error = originalError;
  }
});

test('Phase 2 Diagnostics - EventBus Dev Diagnostics (Phantom events and unknown topics)', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    setDevMode(false);
    // Em modo normal (produção): sem warnings
    emit('weapon:empty', {});
    assert.equal(warnings.length, 0, 'Com DEV_MODE desativado não deve emitir warnings');

    // Ativa DEV_MODE
    setDevMode(true);

    // 1. Evento canônico sem listeners (disparo no vácuo / evento fantasma)
    emit('player:perspective_changed', { mode: 'third' });
    assert.ok(
      warnings.some(w => w.includes('[EventBus] Disparado no vácuo (0 listeners): player:perspective_changed')),
      'Deve emitir warning de evento disparado no vácuo'
    );

    // 2. Tópico não canônico / desconhecido
    emit('unregistered:ghost_event', { data: 123 });
    assert.ok(
      warnings.some(w => w.includes("[EventBus] Tópico desconhecido / não canônico: 'unregistered:ghost_event'")),
      'Deve emitir warning de tópico não canônico'
    );
  } finally {
    setDevMode(false);
    console.warn = originalWarn;
  }
});

test('Phase 2 Diagnostics - MaterialFactory Fallback Warning', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const unknownMatName = 'non_existent_texture_test_999';
    const mat = materialFactory.get(unknownMatName);

    assert.ok(mat, 'MaterialFactory deve retornar um material fallback');
    assert.ok(
      warnings.some(w => w.includes(`[MaterialFactory] Material '${unknownMatName}' não registrado; usando fallback 'wall'.`)),
      'Deve emitir warning de material não registrado com fallback para wall'
    );
  } finally {
    console.warn = originalWarn;
  }
});

test('Phase 2 Diagnostics - Engine Loop Error Boundary & Crash Screen', () => {
  let queuedCb = null;
  globalThis.requestAnimationFrame = (fn) => {
    queuedCb = fn;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {
    queuedCb = null;
  };

  // Mock DOM
  const mockElements = new Map();
  globalThis.document = {
    getElementById: (id) => mockElements.get(id) || null,
    createElement: (tag) => {
      const el = {
        id: '',
        style: {},
        innerHTML: '',
        addEventListener: () => {}
      };
      return el;
    },
    body: {
      appendChild: (el) => {
        if (el.id) mockElements.set(el.id, el);
      }
    }
  };

  let caughtError = null;
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const engine = startEngine({
      fixedUpdate: () => {
        throw new Error('Falha simulada na física!');
      },
      renderUpdate: () => {},
      onError: (err) => {
        caughtError = err;
      }
    });

    // Frame 1
    queuedCb(100);
    // Frame 2: dt = 0.05s >= fixedDt -> aciona fixedUpdate que lança erro
    queuedCb(150);

    assert.ok(caughtError, 'O Error Boundary deve interceptar a exceção do loop');
    assert.equal(caughtError.message, 'Falha simulada na física!');
    assert.ok(mockElements.has('engine-crash-screen'), 'Deve instanciar a crash screen no DOM');
    assert.ok(mockElements.get('engine-crash-screen').innerHTML.includes('Falha simulada na física!'));

    engine.stop();
  } finally {
    console.error = originalConsoleError;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    delete globalThis.document;
  }
});
