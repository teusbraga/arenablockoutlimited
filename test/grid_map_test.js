import fs from 'fs';
import path from 'path';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';

console.log('==================================================');
console.log('📐 TESTE DO MAPA DE CALIBRAÇÃO MÉTRICA E FÍSICA (GRID)');
console.log('==================================================');

const mapPath = path.resolve('assets/maps/grid.json');
if (!fs.existsSync(mapPath)) {
  console.error('❌ Arquivo assets/maps/grid.json não encontrado!');
  process.exit(1);
}

const raw = fs.readFileSync(mapPath, 'utf8');
const data = JSON.parse(raw);

console.log(`\n--- 1. Validação de Metadados e Contrato ---`);
console.log(`- Nome: "${data.name}"`);
console.log(`- ID: "${data.id}"`);
console.log(`- Dimensões do Piso: [${data.size.join(' x ')}] | Material: "${data.floorMaterial}"`);
console.log(`- Limites Declarados: [${data.bounds.join(', ')}]`);

if (data.id !== 'grid' || data.name !== 'Metric Calibration Grid') {
  console.error('❌ ID ou Nome incorreto no grid.json');
  process.exit(1);
}

if (data.floorMaterial !== 'grid_1x1' && data.floorMaterial !== 'dev_grid' && data.floorMaterial !== 'concrete') {
  console.error(`❌ Material do piso inválido: ${data.floorMaterial}`);
  process.exit(1);
}

console.log(`\n--- 2. Validação de Spawns e Distância de Segurança (>11m) ---`);
const playerSpawn = data.playerSpawns[0];
console.log(`- Player Spawn: [${playerSpawn.join(', ')}]`);

for (let i = 0; i < data.botSpawns.length; i++) {
  const botSpawn = data.botSpawns[i];
  const dist = Math.hypot(botSpawn[0] - playerSpawn[0], botSpawn[2] - playerSpawn[2]);
  console.log(`- Bot Spawn ${i + 1}: [${botSpawn.join(', ')}] -> Distância do Player: ${dist.toFixed(1)}m`);
  if (dist < 11.0) {
    console.error(`❌ Distância insuficiente entre Player e Bot Spawn ${i + 1} (${dist}m < 11m)`);
    process.exit(1);
  }
}

console.log(`\n--- 3. Validação das 5 Estações Métricas e Geometrias ---`);
const geoms = data.staticGeometry || [];
console.log(`- Total de blocos estáticos: ${geoms.length}`);

// a) Pista de Arrancada (Pilares marcadores nas laterais x = -4 e x = 4)
const dragPillars = geoms.filter(g => g.type === 'pillar' || (Math.abs(Math.abs(g.pos[0]) - 4) < 0.1 && g.size[1] >= 1.9));
console.log(`- Pilares da Pista de Arrancada: ${dragPillars.length} pilares encontrados`);
if (dragPillars.length < 10) {
  console.error(`❌ Pilares insuficientes na pista de arrancada: esperado >= 10, encontrado ${dragPillars.length}`);
  process.exit(1);
}

// b) Estação de Degraus (6 degraus progressivos: 0.15, 0.30, 0.35, 0.45, 0.60, 0.65)
const steps = geoms.filter(g => g.type === 'step' || (g.pos[2] === 25 && g.size[2] === 3.0));
console.log(`- Degraus da Estação Step-Up: ${steps.length} degraus`);
const expectedStepHeights = [0.15, 0.30, 0.35, 0.45, 0.60, 0.65];
for (const h of expectedStepHeights) {
  const found = steps.find(s => Math.abs(s.size[1] - h) < 0.01);
  if (!found) {
    console.error(`❌ Degrau de altura ${h}m não encontrado!`);
    process.exit(1);
  }
}
console.log(`✅ Todos os 6 degraus de calibração (0.15m a 0.65m) confirmados!`);

// c) Estação de Pulo & Frestas (Muros de 0.6, 0.9, 1.2, 1.5 e Vãos 1.0, 1.8, 2.5, 3.5)
const expectedWallHeights = [0.6, 0.9, 1.2, 1.5];
for (const wh of expectedWallHeights) {
  const foundWall = geoms.find(g => Math.abs(g.size[1] - wh) < 0.01 && g.pos[2] === 10);
  if (!foundWall) {
    console.error(`❌ Muro de salto de altura ${wh}m não encontrado!`);
    process.exit(1);
  }
}
console.log(`✅ Muros de salto de 0.6m a 1.5m confirmados!`);

const platforms = geoms.filter(g => g.type === 'platform');
console.log(`- Plataformas de salto elevadas: ${platforms.length}`);
if (platforms.length < 5) {
  console.error(`❌ Plataformas insuficientes para os vãos de salto: ${platforms.length}`);
  process.exit(1);
}

// d) Corredores e Portas (1.0m, 1.5m, 2.5m e porta 1.0x2.2m)
const doorLintel = geoms.find(g => g.type === 'roof' && Math.abs(g.pos[1] - 2.2) < 0.05 && Math.abs(g.size[0] - 1.0) < 0.05);
if (!doorLintel) {
  console.error(`❌ Viga superior (lintel) de batente de porta 1.0m x 2.2m não encontrada!`);
  process.exit(1);
}
console.log(`✅ Batente e abertura útil de porta 1.0m x 2.2m confirmados!`);

// e) Túnel de Teto Baixo (1.40m de altura, 8m de extensão)
const tunnelRoof = geoms.find(g => g.type === 'roof' && Math.abs(g.pos[1] - 1.40) < 0.05 && Math.abs(g.size[2] - 8.0) < 0.05);
if (!tunnelRoof) {
  console.error(`❌ Teto de túnel de 1.40m de altura ou 8m de extensão não encontrado!`);
  process.exit(1);
}
console.log(`✅ Túnel de teto baixo com 1.40m de headroom e 8m de extensão confirmado!`);

console.log(`\n--- 4. Validação de Placas Identificadoras de Texto (distance_sign) ---`);
const signs = data.props.filter(p => p.type === 'distance_sign');
console.log(`- Total de placas com texto: ${signs.length}`);

const requiredTexts = [
  '0m', '10m', '20m', '30m', '40m', '50m',
  '0.15m', '0.30m', '0.35m', '0.45m', '0.60m', '0.65m',
  '0.6m', '0.9m', '1.2m', '1.5m',
  'GAP 1.0m', 'GAP 1.8m', 'GAP 2.5m', 'GAP 3.5m',
  '1.0m', '1.5m', '2.5m', '1.0x2.2m',
  '1.40m TETO', 'CROUCH'
];

for (const reqText of requiredTexts) {
  const foundSign = signs.find(s => s.text === reqText);
  if (!foundSign) {
    console.error(`❌ Placa com texto "${reqText}" não encontrada nos props!`);
    process.exit(1);
  }
}
console.log(`✅ Todas as 26 placas identificadoras com texto estão presentes e corretas!`);

console.log(`\n--- 5. Simulação de Física e Step-Up no CollisionWorld ---`);
const world = new CollisionWorld(4.0);
world.addBox(0, -0.5, 0, 100, 1, 100, { material: 'grid_1x1' });

for (const item of geoms) {
  const [x, y, z] = item.pos;
  const [sx, sy, sz] = item.size;
  world.addBox(x, y + sy / 2, z, sx, sy, sz, { vaultable: !!item.vaultable, material: item.material });
}

// Validação física de step-up:
// Um jogador caminhando em direção aos degraus com gravidade e stepHeight = 0.55m:
const playerSize = { x: 0.7, y: 1.8, z: 0.7 };
const stepHeight = 0.55;

// Teste degrau 0.35m (deve subir com step-up)
const pos35 = { x: -21, y: 0.05, z: 27.0 };
const deltaZ = { x: 0, y: -0.1, z: -0.6 };
const res35 = world.moveAndSlide(pos35, playerSize, deltaZ, { stepHeight });
if (pos35.y < 0.34) {
  console.error(`❌ Falha no step-up do degrau 0.35m: pos.y = ${pos35.y}`);
  process.exit(1);
}
console.log(`✅ Step-up no degrau 0.35m funciona perfeitamente (atingiu y = ${pos35.y.toFixed(2)}m)!`);

// Teste degrau 0.60m (deve bloquear o step-up, pois 0.60 > 0.55)
const pos60 = { x: -15, y: 0.05, z: 27.0 };
const res60 = world.moveAndSlide(pos60, playerSize, deltaZ, { stepHeight });
if (pos60.y > 0.1 || !res60.hitZ) {
  console.error(`❌ Degrau 0.60m não deveria permitir step-up automático! (pos.y = ${pos60.y})`);
  process.exit(1);
}
console.log(`✅ Degrau 0.60m bloqueia step-up automático corretamente como obstáculo intransponível!`);

// Teste túnel 1.40m:
// Jogador em pé (altura 1.8m) tenta entrar no túnel em z = 0.5
const posStanding = { x: 32.0, y: 0.0, z: 0.5 };
const deltaTunnel = { x: 0, y: 0, z: -1.0 };
world.moveAndSlide(posStanding, playerSize, deltaTunnel, { stepHeight });
if (posStanding.z < -0.1) {
  console.error(`❌ Jogador em pé (1.8m) não deveria conseguir entrar no túnel de 1.40m!`);
  process.exit(1);
}
console.log(`✅ Jogador em pé bloqueado pelo teto de 1.40m do túnel!`);

// Jogador agachado (altura 1.2m) tenta entrar no túnel
const playerCrouchSize = { x: 0.7, y: 1.2, z: 0.7 };
const posCrouch = { x: 32.0, y: 0.0, z: 0.5 };
world.moveAndSlide(posCrouch, playerCrouchSize, deltaTunnel, { stepHeight });
if (posCrouch.z > 0.0) {
  console.error(`❌ Jogador agachado (1.2m) deveria conseguir entrar no túnel de 1.40m!`);
  process.exit(1);
}
console.log(`✅ Jogador agachado (1.2m) entra suavemente no túnel com headroom de 1.40m!`);

console.log('\n==================================================');
console.log('🎉 SUCESSO: Mapa Grid 100% validado em métricas, contratos e física!');
console.log('==================================================');
