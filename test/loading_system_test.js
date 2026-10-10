import { loadingScreen, LoadingScreen } from '../src/ui/LoadingScreen.js';
import { materialFactory, MaterialFactory } from '../src/world/MaterialFactory.js';

console.log('==================================================');
console.log('⏳ TESTE DE TELA DE CARREGAMENTO & LAZY MATERIALS');
console.log('==================================================');

// 1. Validando LoadingScreen sem DOM (Headless/Node)
console.log('\n[Teste 1] Validando LoadingScreen em ambiente Headless...');
try {
  loadingScreen.show('TESTE MAPA');
  loadingScreen.setProgress(50, 'Carregando...');
  loadingScreen.hide();
  console.log('✅ LoadingScreen funciona com resiliência pura sem document/DOM!');
} catch (e) {
  console.error('❌ Falha no LoadingScreen headless:', e);
  process.exit(1);
}

// 2. Validando LoadingScreen com mock DOM
console.log('\n[Teste 2] Validando LoadingScreen com Mock DOM...');
const screenEl = {
  classList: {
    classes: [],
    add(c) { this.classes.push(c); },
    remove(c) { this.classes = this.classes.filter(x => x !== c); },
    contains(c) { return this.classes.includes(c); }
  }
};
const mockElements = {
  'loading-screen': screenEl,
  'loading-map-name': { textContent: '' },
  'loading-bar': { style: { width: '' } },
  'loading-status': { textContent: '' },
  'loading-percent': { textContent: '' }
};
globalThis.document = {
  getElementById(id) {
    return mockElements[id] || null;
  }
};

const ls = new LoadingScreen();
ls.show('DUST DUNE');
if (mockElements['loading-map-name'].textContent !== 'DUST DUNE') {
  console.error('❌ Nome do mapa não foi atualizado no DOM');
  process.exit(1);
}

ls.setProgress(42.8, 'Compilando texturas...');
if (mockElements['loading-percent'].textContent !== '43%' || mockElements['loading-bar'].style.width !== '43%') {
  console.error('❌ Percentual incorreto:', mockElements['loading-percent'].textContent);
  process.exit(1);
}
if (mockElements['loading-status'].textContent !== 'Compilando texturas...') {
  console.error('❌ Mensagem de status incorreta');
  process.exit(1);
}

ls.hide();
if (mockElements['loading-percent'].textContent !== '100%') {
  console.error('❌ Hide não completou progresso para 100%');
  process.exit(1);
}
console.log('✅ LoadingScreen atualiza corretamente todos os nós da árvore DOM!');

// 3. Validando Lazy Registration do MaterialFactory
console.log('\n[Teste 3] Validando Lazy Loading no MaterialFactory...');
const mf = new MaterialFactory();
mf.initMaterials();

if (mf.factories.size < 20) {
  console.error(`❌ Menos de 20 fábricas de materiais registradas: ${mf.factories.size}`);
  process.exit(1);
}

if (mf.materials.size !== 0) {
  console.error(`❌ initMaterials instanciou materiais antecipadamente! Total gerado: ${mf.materials.size}`);
  process.exit(1);
}
console.log(`✅ Zero-lag confirmado: ${mf.factories.size} receitas registradas, 0 materiais gerados antecipadamente!`);

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE CARREGAMENTO PASSARAM!');
console.log('==================================================');
