import fs from 'fs';
import { initWeaponsFromData, WEAPONS, normalizeBallistics } from '../src/weapons/WeaponDefs.js';
import { BallisticsCalculator } from '../src/weapons/BallisticsCalculator.js';

console.log('==================================================');
console.log('🎯 TESTE DE BALÍSTICA E RESILIÊNCIA ANTIFRÁGIL');
console.log('==================================================');

// 1. Carregar armas do arquivo JSON real
const rawData = JSON.parse(fs.readFileSync('assets/weapons/weapons.json', 'utf8'));
initWeaponsFromData(rawData);

console.log(`[WeaponDefs] ${Object.keys(WEAPONS).length} armas carregadas e compiladas.`);

// 2. Testar balística para cada arma
for (const [id, wep] of Object.entries(WEAPONS)) {
  const b = wep.ballistics;
  if (!b) throw new Error(`Arma ${id} não possui bloco de balística!`);

  const idleSpread = BallisticsCalculator.calculateCurrentSpread(wep, { isAds: true, speedRatio: 0 });
  const runSpread = BallisticsCalculator.calculateCurrentSpread(wep, { isAds: false, speedRatio: 1.5, isSprinting: true });
  const recoil = BallisticsCalculator.calculateRecoilImpulse(wep, 3, false);
  const sway = BallisticsCalculator.calculateSway(wep, 1.0, true, 0);
  const impactClose = BallisticsCalculator.calculateTerminalImpact(wep, 10, 'body');
  const impactFar = BallisticsCalculator.calculateTerminalImpact(wep, 80, 'body');

  console.log(`\n--- Arma: ${wep.name} (${id}) ---`);
  console.log(`  Dispersão: Idle ADS: ${idleSpread.toFixed(4)} rad | Corrida Hip: ${runSpread.toFixed(4)} rad`);
  console.log(`  Recoil (Tiro 3): Pitch: ${recoil.pitch.toFixed(4)} | Yaw: ${recoil.yaw.toFixed(4)} (Pattern: ${b.external.recoil.pattern})`);
  console.log(`  Sway (ADS): Amp: ${sway.amplitude.toFixed(5)}`);
  console.log(`  Impacto Terminal: 10m: Dano ${impactClose.finalDamage} (Drop: ${impactClose.dropY.toFixed(3)}m) | 80m: Dano ${impactFar.finalDamage} (Drop: ${impactFar.dropY.toFixed(3)}m)`);
}

// 3. Prova de Fogo: Deletar propriedades e nós inteiros para comprovar Antifragilidade
console.log('\n==================================================');
console.log('🛡️ TESTE DE RESILIÊNCIA A CHAVES AUSENTES / APAGADAS');
console.log('==================================================');

const mutilatedConfigs = [
  { name: 'Sem bloco ballistics', cfg: { id: 'test_m1', name: 'Mutilated 1' } },
  { name: 'Sem external/sway', cfg: { id: 'test_m2', ballistics: { external: {} } } },
  { name: 'Sem external/recoil', cfg: { id: 'test_m3', ballistics: { external: { sway: {} } } } },
  { name: 'Sem external/precision', cfg: { id: 'test_m4', ballistics: { external: { recoil: {} } } } },
  { name: 'Sem terminal', cfg: { id: 'test_m5', ballistics: { terminal: {} } } },
  { name: 'Objeto vazio {}', cfg: {} },
  { name: 'Null', cfg: null }
];

for (const testCase of mutilatedConfigs) {
  try {
    const normalized = normalizeBallistics(testCase.cfg || {});
    const wep = { ...(testCase.cfg || {}), ballistics: normalized };
    
    // Testa todos os cálculos
    const spread = BallisticsCalculator.calculateCurrentSpread(wep, { isAds: true, speedRatio: 1.0, isStrafing: true });
    const recoil = BallisticsCalculator.calculateRecoilImpulse(wep, 5, false);
    const sway = BallisticsCalculator.calculateSway(wep, 2.5, false, 1.2);
    const terminal = BallisticsCalculator.calculateTerminalImpact(wep, 50, 'head');

    console.log(`  ✅ [${testCase.name}]: PASSOU sem erro. Spread: ${spread.toFixed(4)}, Recoil Pitch: ${recoil.pitch.toFixed(4)}, Dano: ${terminal.finalDamage}`);
  } catch (err) {
    console.error(`  ❌ [${testCase.name}]: FALHOU com erro:`, err);
    process.exit(1);
  }
}

console.log('\n==================================================');
console.log('🎉 TODOS OS TESTES DE BALÍSTICA E RESILIÊNCIA PASSARAM!');
console.log('==================================================\n');
