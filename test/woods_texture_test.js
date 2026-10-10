import fs from 'fs';
import path from 'path';
import { materialFactory } from '../src/world/MaterialFactory.js';

console.log('==================================================');
console.log('🌲 TESTE DE TEXTURIZAÇÃO PBR DO MAPA WOODS');
console.log('==================================================');

const woodsPath = path.resolve('assets/maps/woods.json');
const raw = fs.readFileSync(woodsPath, 'utf8');
const data = JSON.parse(raw);

console.log(`- Nome do Mapa: "${data.name}"`);
console.log(`- Dimensões: ${data.size.join('x')}m`);
console.log(`- PBR Ativo: ${data.pbr === true ? 'SIM' : 'NÃO'}`);
console.log(`- Total de Blocos: ${data.staticGeometry.length}`);

if (data.pbr !== true) {
  console.error('❌ Woods deve ter "pbr": true');
  process.exit(1);
}

materialFactory.initMaterials();

// Validar floor
const floorMat = materialFactory.get(data.floorMaterial);
if (!floorMat || floorMat.userData?.worldUVScale === undefined) {
  console.error('❌ Material do chão não possui mapeamento WorldSpaceUV:', data.floorMaterial);
  process.exit(1);
}
console.log(`✅ Chão "${data.floorMaterial}" configurado com WorldSpaceUV.`);

// Validar todos os blocos do staticGeometry
const materialsFound = new Set();
data.staticGeometry.forEach(g => materialsFound.add(g.material));

for (const matName of materialsFound) {
  const mat = materialFactory.get(matName);
  if (!mat) {
    console.error(`❌ Material "${matName}" não encontrado na MaterialFactory!`);
    process.exit(1);
  }
  if (mat.userData?.worldUVScale === undefined) {
    console.error(`❌ Material "${matName}" em Woods precisa de WorldSpaceUV para evitar esticamento em blocos!`);
    process.exit(1);
  }
  console.log(`✅ Material "${matName}" -> ${mat.type} (WorldUVScale: ${mat.userData.worldUVScale})`);
}

console.log('\n==================================================');
console.log('🎉 TODAS AS TEXTURAS DO MAPA WOODS VALIDADAS COM SUCESSO!');
console.log('==================================================');
