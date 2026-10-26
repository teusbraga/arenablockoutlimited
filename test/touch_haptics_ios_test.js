import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TouchInput } from '../src/core/TouchInput.js';
import { CONFIG } from '../src/core/ConfigLoader.js';
import { emit, CANONICAL_EVENTS } from '../src/core/EventBus.js';

describe('TouchInput & iOS Haptics (Taptic Engine) Suite', () => {
  let originalNavigatorDescriptor;
  let originalDocument;
  let mockInput;

  beforeEach(() => {
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    originalDocument = globalThis.document;

    mockInput = {
      actions: {},
      _actionQueue: new Set(),
      pressAction(a) { this.actions[a] = true; },
      releaseAction(a) { this.actions[a] = false; }
    };

    CONFIG.ACCESSIBILITY = {
      vibrationEnabled: true
    };
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
    globalThis.document = originalDocument;
  });

  function setMockNavigator(navObj) {
    Object.defineProperty(globalThis, 'navigator', {
      value: navObj,
      configurable: true,
      writable: true
    });
  }

  test('1. Respeita CONFIG.ACCESSIBILITY.vibrationEnabled quando desativado', () => {
    CONFIG.ACCESSIBILITY.vibrationEnabled = false;

    let vibrateCalled = false;
    setMockNavigator({
      vibrate: () => { vibrateCalled = true; return true; }
    });

    let labelClicked = false;
    const touch = new TouchInput(mockInput);
    touch._iosHapticLabel = {
      click: () => { labelClicked = true; }
    };

    touch.vibrate(20);

    assert.strictEqual(vibrateCalled, false, 'navigator.vibrate não deve ser chamado quando desativado');
    assert.strictEqual(labelClicked, false, 'iOS haptic label não deve ser clicado quando desativado');
    touch.destroy();
  });

  test('2. Executa navigator.vibrate quando disponível no navegador padrão (Android / Chrome)', () => {
    let capturedPattern = null;
    setMockNavigator({
      vibrate: (p) => {
        capturedPattern = p;
        return true;
      }
    });

    let labelClicked = false;
    const touch = new TouchInput(mockInput);
    touch._iosHapticLabel = {
      click: () => { labelClicked = true; }
    };

    touch.vibrate(18);

    assert.strictEqual(capturedPattern, 18, 'navigator.vibrate deve receber o padrão correto');
    assert.strictEqual(labelClicked, false, 'Fallback de iOS não deve disparar se navigator.vibrate teve sucesso');
    touch.destroy();
  });

  test('3. Fallback para iOS WebKit / Safari / PWA (quando navigator.vibrate é undefined)', () => {
    setMockNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15'
    });

    let clickCount = 0;
    const mockLabel = {
      click: () => { clickCount++; }
    };

    const touch = new TouchInput(mockInput);
    touch._iosHapticLabel = mockLabel;

    touch.vibrate(25);

    assert.strictEqual(clickCount, 1, 'iOS haptic label deve ser clicado uma vez para vibração simples');
    touch.destroy();
  });

  test('4. Suporte a padrões de múltiplos pulsos (array) no iOS Taptic Engine', async () => {
    setMockNavigator({});
    let clicks = 0;

    const mockLabel = {
      click: () => { clicks++; }
    };

    const touch = new TouchInput(mockInput);
    touch._iosHapticLabel = mockLabel;

    // Padrão [pulso1, pausa, pulso2]
    touch.vibrate([30, 20, 30]);

    assert.strictEqual(clicks, 1, 'Primeiro pulso deve ser imediato');

    // Aguarda o término da pausa para o segundo pulso
    await new Promise(r => setTimeout(r, 65));

    assert.strictEqual(clicks, 2, 'Segundo pulso deve ser disparado após o delay');
    touch.destroy();
  });

  test('5. Criação automática da ponte DOM (ios-haptic-bridge) sob demanda', () => {
    const createdElements = [];
    let appendedChild = null;

    globalThis.document = {
      getElementById: (id) => null,
      createElement: (tag) => {
        const el = {
          tag,
          style: {},
          attributes: {},
          children: [],
          setAttribute: (k, v) => { el.attributes[k] = v; },
          appendChild: (c) => { el.children.push(c); }
        };
        createdElements.push(el);
        return el;
      },
      body: {
        appendChild: (child) => { appendedChild = child; }
      }
    };

    const touch = new TouchInput(mockInput);
    const label = touch._ensureIOSHapticBridge();

    assert.ok(label, 'Deve retornar o label criado');
    assert.strictEqual(label.id, 'ios-haptic-label');
    assert.strictEqual(label.htmlFor, 'ios-haptic-switch');
    assert.ok(appendedChild, 'O container da ponte deve ser anexado ao document.body');
    touch.destroy();
  });

  test('6. Eventos canônicos acionam vibração corretamente e nenhum evento inválido é utilizado', () => {
    const touch = new TouchInput(mockInput);
    const vibrationHistory = [];
    touch.vibrate = (p) => {
      vibrationHistory.push(p);
    };

    emit('weapon:fired', {});
    emit('weapon:empty', {});
    emit('weapon:reload:start', {});
    emit('weapon:reload:end', {});
    emit('weapon:pump', {});
    emit('player:damaged', { dmg: 15 });

    assert.deepStrictEqual(vibrationHistory, [
      18,
      35,
      25,
      [15, 30, 20],
      22,
      [40, 30, 40]
    ], 'Todos os eventos canônicos esperados devem despachar suas vibrações específicas');

    // Valida que todos os eventos ouvidos constam em CANONICAL_EVENTS
    const canonicalSet = new Set(CANONICAL_EVENTS);
    const listenedEvents = [
      'weapon:fired',
      'player:damaged',
      'weapon:empty',
      'weapon:reload:start',
      'weapon:reload:end',
      'weapon:pump'
    ];

    for (const evt of listenedEvents) {
      assert.ok(canonicalSet.has(evt), `O evento "${evt}" deve ser estritamente canônico`);
    }

    touch.destroy();
  });
});
