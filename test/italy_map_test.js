import fs from 'fs';
import path from 'path';

console.log('==================================================');
console.log('🏛️ TESTE DE VALIDAÇÃO DOS MAPAS REMASTERIZADOS');
console.log('==================================================');

const mapsToTest = [
  { file: 'assets/maps/italy.json', name: 'CS Italy', requiredFloor: 'cobblestones', checkProps: true },
  { file: 'assets/maps/dust.json', name: 'Dust Mirage Remake (Dune)', requiredFloor: 'sand', checkProps: true },
  { file: 'assets/maps/village.json', name: 'Vila Ensolarada (Original)', requiredFloor: 'grass', checkProps: false },
  { file: 'assets/maps/woods.json', name: 'Woods (Original)', requiredFloor: 'grass', checkProps: false }
];

for (const m of mapsToTest) {
  const mapPath = path.resolve(m.file);
  if (!fs.existsSync(mapPath)) {
    console.error(`❌ Arquivo ${m.file} não encontrado!`);
    process.exit(1);
  }

  const raw = fs.readFileSync(mapPath, 'utf8');
  const data = JSON.parse(raw);

  console.log(`\n--- Mapa: "${data.name}" (${m.file}) ---`);
  console.log(`- Dimensões do Piso: [${data.size.join(' x ')}] metros | Material: "${data.floorMaterial}"`);
  console.log(`- Limites do Mundo: [${data.bounds.join(', ')}]`);
  console.log(`- Geometrias Estáticas: ${data.staticGeometry.length} blocos`);
  console.log(`- Props Arquitetônicos: ${data.props?.length || 0} itens`);
  console.log(`- Spawns Jogador: ${data.playerSpawns?.length || 0} | Spawns Bots: ${data.botSpawns?.length || 0}`);

  if (data.floorMaterial !== m.requiredFloor) {
    console.error(`❌ Piso incorreto no mapa ${m.name}: esperado ${m.requiredFloor}, recebido ${data.floorMaterial}`);
    process.exit(1);
  }

  if (!data.staticGeometry || data.staticGeometry.length < 5) {
    console.error(`❌ Geometria estática insuficiente no mapa ${m.name}`);
    process.exit(1);
  }

  if (m.checkProps && (!data.props || data.props.length < 5)) {
    console.error(`❌ Props insuficientes no mapa remasterizado ${m.name}`);
    process.exit(1);
  }

  console.log(`✅ ${m.name} validado com sucesso!`);
}

console.log('\n==================================================');
console.log('🎉 TODOS OS MAPAS REMASTERIZADOS VALIDADOS COM SUCESSO!');
console.log('==================================================');
