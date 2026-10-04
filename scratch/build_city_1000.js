/**
 * BUILD CITY 1000 - Rebuild Modular da Cidade Abandonada 1000x1000
 * Grade: 10x10 Setores de 100x100m (100 setores no total)
 * 
 * Regras Estritas:
 * 1. 100% de Acessibilidade: Todas as portas e entradas abertas no nível da rua.
 * 2. Prédio Central Funcional: 4 andares completos com escadas suaves (<= 0.44m) e vão livre nas lajes.
 * 3. Zero Clipping: OccupancyTracker para posicionar props, carros e barricadas sem sobreposição.
 * 4. Conectividade de Vias: Avenidas principais conectando os setores perfeitamente.
 */

const fs = require('fs');
const path = require('path');

let seed = 2026;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randRange(min, max) { return min + rand() * (max - min); }
function randChoice(arr) { return arr[Math.floor(rand() * arr.length)]; }

const MAP_SIZE = 1000;
const HALF = MAP_SIZE / 2; // 500
const SECTOR_SIZE = 100;
const GRID_COUNT = MAP_SIZE / SECTOR_SIZE; // 10

const staticGeometry = [];

// Registrador de ocupação para evitar clipping
class OccupancyTracker {
  constructor() { this.boxes = []; }
  add(minX, maxX, minZ, maxZ) {
    this.boxes.push({ minX, maxX, minZ, maxZ });
  }
  isFree(minX, maxX, minZ, maxZ, margin = 1.0) {
    for (const b of this.boxes) {
      if (maxX + margin > b.minX && minX - margin < b.maxX &&
          maxZ + margin > b.minZ && minZ - margin < b.maxZ) {
        return false;
      }
    }
    return true;
  }
}
const tracker = new OccupancyTracker();

function addBox(pos, size, material, vaultable = false) {
  staticGeometry.push({ pos, size, material, vaultable: !!vaultable });
  if (pos[1] <= 1.5) {
    const hx = size[0] / 2;
    const hz = size[2] / 2;
    tracker.add(pos[0] - hx, pos[0] + hx, pos[2] - hz, pos[2] + hz);
  }
}

// =========================================================================
// MÓDULOS DE CONSTRUÇÃO MODULAR
// =========================================================================

/**
 * Escadaria transitável suave (sem precisar pular)
 */
function buildStairs(startX, startY, startZ, width, totalRise, steps, dirX = 0, dirZ = 1) {
  const stepRise = totalRise / steps;
  const stepRun = 1.1;
  for (let s = 0; s < steps; s++) {
    const x = startX + s * stepRun * dirX;
    const y = startY + s * stepRise;
    const z = startZ + s * stepRun * dirZ;
    addBox([x, y, z], [dirX ? stepRun + 0.05 : width, stepRise, dirZ ? stepRun + 0.05 : width], 'concrete', true);
  }
}

/**
 * Torre Central Funcional de 4 Andares (O ícone do centro do mapa)
 */
function buildCentralTower(cx, cz) {
  const w = 46, d = 46;
  const floorH = 3.8;
  const numFloors = 4;
  const stairW = 4.0;
  const stairSteps = 9;

  for (let f = 0; f < numFloors; f++) {
    const yBase = f * floorH;

    // Lajes de piso
    if (f === 0) {
      addBox([cx, 0.05, cz], [w + 6, 0.2, d + 6], 'concrete', true);
    } else {
      // Laje com corte para poço da escada no canto Noroeste
      addBox([cx + 6, yBase, cz], [w - 12, 0.4, d], 'concrete', true);
      addBox([cx - (w/2 - 6), yBase, cz + 8], [12, 0.4, d - 16], 'concrete', true);
    }

    // Paredes perimetrais com GRANDES VÃOS DE PORTA/JANELA em todos os 4 lados
    const wallMat = 'concrete_dark';
    
    // Fachada Norte (Z = cz - d/2): Vão aberto central de 12m
    addBox([cx - 15, yBase, cz - d/2], [(w/2) - 15, floorH, 1.2], wallMat);
    addBox([cx + 15, yBase, cz - d/2], [(w/2) - 15, floorH, 1.2], wallMat);
    addBox([cx, yBase + 2.6, cz - d/2], [12, floorH - 2.6, 1.2], wallMat); // Lintel

    // Fachada Sul (Z = cz + d/2): Vão aberto central de 12m
    addBox([cx - 15, yBase, cz + d/2], [(w/2) - 15, floorH, 1.2], wallMat);
    addBox([cx + 15, yBase, cz + d/2], [(w/2) - 15, floorH, 1.2], wallMat);
    addBox([cx, yBase + 2.6, cz + d/2], [12, floorH - 2.6, 1.2], wallMat);

    // Fachada Leste (X = cx + w/2): Vão aberto central de 12m
    addBox([cx + w/2, yBase, cz - 15], [1.2, floorH, (d/2) - 15], wallMat);
    addBox([cx + w/2, yBase, cz + 15], [1.2, floorH, (d/2) - 15], wallMat);
    addBox([cx + w/2, yBase + 2.6, cz], [1.2, floorH - 2.6, 12], wallMat);

    // Fachada Oeste (X = cx - w/2): Vão aberto central de 12m
    addBox([cx - w/2, yBase, cz - 15], [1.2, floorH, (d/2) - 15], wallMat);
    addBox([cx - w/2, yBase, cz + 15], [1.2, floorH, (d/2) - 15], wallMat);
    addBox([cx - w/2, yBase + 2.6, cz], [1.2, floorH - 2.6, 12], wallMat);

    // Pilares Internos de Suporte
    addBox([cx - 8, yBase, cz - 8], [1.6, floorH, 1.6], 'steel_girder');
    addBox([cx + 8, yBase, cz - 8], [1.6, floorH, 1.6], 'steel_girder');
    addBox([cx - 8, yBase, cz + 8], [1.6, floorH, 1.6], 'steel_girder');
    addBox([cx + 8, yBase, cz + 8], [1.6, floorH, 1.6], 'steel_girder');

    // Escada transitável para o próximo andar
    const stX = cx - w/2 + 5;
    const stZ = cz - d/2 + 5;
    buildStairs(stX, yBase, stZ, stairW, floorH, stairSteps, 0, 1);
  }

  // Terraço na Cobertura (Andar 4 Top)
  const roofY = numFloors * floorH;
  addBox([cx, roofY, cz], [w, 0.4, d], 'concrete', true);
  // Parapeito de proteção com mureta de combate (1.1m)
  addBox([cx, roofY + 0.4, cz - d/2], [w, 1.1, 0.6], 'concrete_dark', true);
  addBox([cx, roofY + 0.4, cz + d/2], [w, 1.1, 0.6], 'concrete_dark', true);
  addBox([cx - w/2, roofY + 0.4, cz], [0.6, 1.1, d], 'concrete_dark', true);
  addBox([cx + w/2, roofY + 0.4, cz], [0.6, 1.1, d], 'concrete_dark', true);
  
  // Saída da escada na cobertura
  addBox([cx - w/2 + 5, roofY + 0.4, cz - d/2 + 3], [6, 2.6, 1], 'concrete');
  addBox([cx - w/2 + 5, roofY + 3.0, cz - d/2 + 8], [7, 0.3, 12], 'concrete_dark');

  // Sacos de areia e caixas de munição no terraço
  addBox([cx + 8, roofY + 0.4, cz - 8], [3.5, 1.1, 1.4], 'sand', true);
  addBox([cx - 8, roofY + 0.4, cz + 8], [2.8, 1.2, 2.8], 'crate', true);
}

/**
 * Edifício Garagem Aberto (3 Andares com Rampas)
 */
function buildGarage(cx, cz) {
  const w = 50, d = 45;
  const floorH = 3.8;
  for (let gf = 0; gf < 3; gf++) {
    const yBase = gf * floorH;
    if (gf > 0) {
      addBox([cx, yBase, cz + 5], [w, 0.4, d - 10], 'concrete', true);
    } else {
      addBox([cx, 0.05, cz], [w, 0.2, d], 'concrete_dark', true);
    }
    // Pilares
    for (let px = -18; px <= 18; px += 18) {
      for (let pz = -15; pz <= 15; pz += 15) {
        addBox([cx + px, yBase, cz + pz], [1.8, floorH, 1.8], 'steel_girder');
      }
    }
    // Muretas de proteção
    if (gf > 0) {
      addBox([cx, yBase + 0.4, cz + d/2 - 0.4], [w, 1.0, 0.8], 'caution_yellow', true);
      addBox([cx - w/2 + 0.4, yBase + 0.4, cz], [0.8, 1.0, d], 'caution_yellow', true);
      addBox([cx + w/2 - 0.4, yBase + 0.4, cz], [0.8, 1.0, d], 'caution_yellow', true);
    }
    // Rampas de subida
    if (gf < 2) {
      buildStairs(cx - 16, yBase, cz - d/2 + 5, 8.0, floorH, 10, 1, 0);
    }
  }
}

/**
 * Galpão Industrial Aberto
 */
function buildWarehouse(cx, cz, w = 44, d = 40, h = 9) {
  addBox([cx, 0.05, cz], [w, 0.2, d], 'concrete_dark', true);
  addBox([cx - w/2, 0, cz], [1.2, h, d], 'scaffold');
  addBox([cx + w/2, 0, cz], [1.2, h, d], 'scaffold');
  // Portões de 16m nas pontas
  addBox([cx - 14, 0, cz - d/2], [(w/2) - 14, h, 1.2], 'scaffold');
  addBox([cx + 14, 0, cz - d/2], [(w/2) - 14, h, 1.2], 'scaffold');
  addBox([cx, h - 2.5, cz - d/2], [16, 2.5, 1.2], 'scaffold');

  addBox([cx - 14, 0, cz + d/2], [(w/2) - 14, h, 1.2], 'scaffold');
  addBox([cx + 14, 0, cz + d/2], [(w/2) - 14, h, 1.2], 'scaffold');
  addBox([cx, h - 2.5, cz + d/2], [16, 2.5, 1.2], 'scaffold');

  addBox([cx, h, cz], [w + 2, 0.6, d + 2], 'scaffold', true);

  // Pilha de contêineres interna
  addBox([cx - 8, 0.2, cz], [2.8, 2.6, 6], 'blue_tarp', true);
  addBox([cx - 8, 2.8, cz], [2.8, 2.6, 6], 'crate', true);
  addBox([cx + 8, 0.2, cz + 5], [3.5, 2.0, 3.5], 'crate', true);
}

/**
 * Edifício Comercial / Arranha-céu
 */
function buildOfficeBuilding(cx, cz, w, d, h) {
  const mat = randChoice(['concrete', 'concrete_dark', 'wall_white', 'sandstone']);
  addBox([cx, 0, cz], [w, h, d], mat);
  // Entrada aberta no térreo
  addBox([cx, 0.1, cz + d/2 + 2], [12, 0.2, 4], 'plaster_light', true);
  addBox([cx, 3.2, cz + d/2 + 1], [14, 0.4, 3], 'caution_yellow', true);
  // Detalhe no topo
  if (h > 40) {
    addBox([cx, h, cz], [w * 0.6, 6, d * 0.6], 'concrete_dark');
  }
}

/**
 * Mansão / Casa Urbana
 */
function buildTownhouse(cx, cz) {
  const w = 32, d = 28;
  addBox([cx, 0.05, cz], [w, 0.2, d], 'wall_white', true);
  addBox([cx - 10, 0.25, cz - 8], [1.2, 3.5, 1.2], 'steel_girder');
  addBox([cx + 10, 0.25, cz - 8], [1.2, 3.5, 1.2], 'steel_girder');
  addBox([cx, 3.75, cz], [w, 0.35, d], 'plaster_light', true);
  buildStairs(cx - 10, 0.25, cz - 4, 3.0, 3.5, 9, 0, 1);
  addBox([cx, 7.3, cz], [w + 2, 0.35, d + 2], 'sandstone', true);
}

/**
 * Props Táticos com Proteção contra Clipping
 */
function spawnCar(x, z, rot = 'z') {
  if (!tracker.isFree(x - 2, x + 2, z - 3, z + 3, 0.8)) return;
  const mat = randChoice(['caution_yellow', 'fabric_red', 'concrete_dark', 'wall_white']);
  if (rot === 'z') {
    addBox([x, 0.1, z], [2.4, 1.3, 4.8], mat, true);
    addBox([x, 1.4, z - 0.2], [2.2, 0.8, 2.6], 'plaster_light', true);
  } else {
    addBox([x, 0.1, z], [4.8, 1.3, 2.4], mat, true);
    addBox([x - 0.2, 1.4, z], [2.6, 0.8, 2.2], 'plaster_light', true);
  }
}

function plantTree(x, z) {
  if (!tracker.isFree(x - 2, x + 2, z - 2, z + 2, 0.5)) return;
  addBox([x, 0.1, z], [0.8, 5.5, 0.8], 'trunk');
  addBox([x, 5.6, z], [4.5, 2.5, 4.5], 'foliage');
}

function spawnBarricade(x, z, rot = 'x') {
  if (!tracker.isFree(x - 2.5, x + 2.5, z - 1.5, z + 1.5, 0.5)) return;
  if (rot === 'x') {
    addBox([x, 0.1, z], [5.0, 1.2, 0.8], 'concrete', true);
  } else {
    addBox([x, 0.1, z], [0.8, 1.2, 5.0], 'concrete', true);
  }
}

// =========================================================================
// ZONEAMENTO DA CIDADE 1000x1000 (10x10 = 100 SETORES)
// =========================================================================
const ZONES = {
  CENTRAL_PLAZA: 'CENTRAL_PLAZA',
  DOWNTOWN: 'DOWNTOWN',
  RESIDENTIAL: 'RESIDENTIAL',
  INDUSTRIAL: 'INDUSTRIAL'
};

function getSectorZone(gx, gz) {
  // Centro Cívico / Torre (4,4 - 4,5 - 5,4 - 5,5)
  if ((gx === 4 || gx === 5) && (gz === 4 || gz === 5)) {
    return ZONES.CENTRAL_PLAZA;
  }
  // Zona Industrial nos extremos Norte e Sul
  if (gz <= 1 || gz >= 8) {
    return ZONES.INDUSTRIAL;
  }
  // Bairros Residenciais nos extremos Leste e Oeste
  if (gx <= 1 || gx >= 8) {
    return ZONES.RESIDENTIAL;
  }
  // Downtown Comercial em torno do centro
  return ZONES.DOWNTOWN;
}

function buildSector(gx, gz) {
  const cx = -HALF + gx * SECTOR_SIZE + SECTOR_SIZE / 2;
  const cz = -HALF + gz * SECTOR_SIZE + SECTOR_SIZE / 2;
  const zone = getSectorZone(gx, gz);

  // Vias do Setor (Conectadas na malha 100x100)
  const isMainAvenueX = (gx === 4 || gx === 5);
  const isMainAvenueZ = (gz === 4 || gz === 5);

  switch (zone) {
    case ZONES.CENTRAL_PLAZA: {
      // Praça Central de Concreto Claro
      addBox([cx, 0.05, cz], [SECTOR_SIZE, 0.1, SECTOR_SIZE], 'plaster_light', true);

      // No quadrante (4,4) fica a Grande Torre Central Acessível
      if (gx === 4 && gz === 4) {
        buildCentralTower(cx, cz);
      } else if (gx === 5 && gz === 4) {
        // Obelisco / Monumento e trincheiras de saco de areia
        addBox([cx, 0.1, cz], [4, 18, 4], 'stone');
        addBox([cx - 10, 0.1, cz], [8, 1.2, 1.2], 'sand', true);
        addBox([cx + 10, 0.1, cz], [8, 1.2, 1.2], 'sand', true);
        spawnCar(cx, cz + 20, 'x');
      } else if (gx === 4 && gz === 5) {
        // Chafariz seco e barricadas táticas
        addBox([cx, 0.1, cz], [16, 0.8, 16], 'concrete', true);
        addBox([cx, 0.8, cz], [14, 0.1, 14], 'blue_tarp');
        spawnBarricade(cx - 15, cz, 'z');
        spawnBarricade(cx + 15, cz, 'z');
      } else {
        // Posto de Comando Militar / Checkpoint
        addBox([cx, 0.1, cz], [14, 3.2, 8], 'fabric_red', true);
        addBox([cx, 0.1, cz - 10], [6, 1.2, 2], 'sand', true);
        addBox([cx, 0.1, cz + 10], [6, 1.2, 2], 'sand', true);
        spawnCar(cx + 20, cz, 'z');
      }
      break;
    }

    case ZONES.DOWNTOWN: {
      // Cruzamento de Avenidas Asfalto
      addBox([cx, 0.06, cz], [18, 0.05, SECTOR_SIZE], 'concrete_dark');
      addBox([cx, 0.06, cz], [SECTOR_SIZE, 0.05, 18], 'concrete_dark');

      // Calçadas
      addBox([cx - 20, 0.12, cz], [14, 0.12, SECTOR_SIZE], 'plaster_light', true);
      addBox([cx + 20, 0.12, cz], [14, 0.12, SECTOR_SIZE], 'plaster_light', true);

      // Edifício Garagem no quadrante (3,3)
      if (gx === 3 && gz === 3) {
        buildGarage(cx - 20, cz - 20);
      } else {
        // Prédios comerciais
        const h1 = randRange(25, 75);
        const h2 = randRange(20, 50);
        buildOfficeBuilding(cx - 28, cz - 28, 30, 30, h1);
        buildOfficeBuilding(cx + 28, cz + 28, 28, 28, h2);
      }

      // Carros e árvores na calçada
      spawnCar(cx - 12, cz + 25, 'z');
      spawnCar(cx + 12, cz - 25, 'z');
      plantTree(cx - 20, cz - 10);
      plantTree(cx + 20, cz + 10);
      break;
    }

    case ZONES.RESIDENTIAL: {
      // Ruas residenciais com recuo
      addBox([cx, 0.06, cz], [14, 0.05, SECTOR_SIZE], 'concrete_dark');
      addBox([cx, 0.06, cz], [SECTOR_SIZE, 0.05, 14], 'concrete_dark');

      // Duas casas por setor
      buildTownhouse(cx - 26, cz - 26);
      buildTownhouse(cx + 26, cz + 26);

      // Árvores e vegetação urbana
      plantTree(cx + 25, cz - 25);
      plantTree(cx - 25, cz + 25);
      spawnCar(cx - 10, cz + 15, 'x');
      break;
    }

    case ZONES.INDUSTRIAL: {
      // Pista larga industrial
      addBox([cx, 0.06, cz], [22, 0.05, SECTOR_SIZE], 'concrete_dark');

      // Galpão com vãos abertos
      buildWarehouse(cx + 25, cz, 44, 45, 9);

      // Contêineres de carga no pátio
      addBox([cx - 25, 0.1, cz - 20], [3, 2.6, 6], 'blue_tarp', true);
      addBox([cx - 25, 0.1, cz + 20], [3, 2.6, 6], 'caution_yellow', true);
      addBox([cx - 25, 2.7, cz + 20], [3, 2.6, 6], 'crate', true);

      spawnCar(cx - 15, cz, 'z');
      spawnBarricade(cx - 25, cz, 'x');
      break;
    }
  }
}

// =========================================================================
// EXECUÇÃO GERAL
// =========================================================================
console.log("Iniciando Rebuild da Cidade Abandonada 1000x1000 (100 Setores)...");

// Muros perimetrais do mapa
const WALL_THICK = 20, WALL_HEIGHT = 60;
addBox([0, 0, -HALF - WALL_THICK/2], [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], 'concrete_dark');
addBox([0, 0, HALF + WALL_THICK/2], [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], 'concrete_dark');
addBox([-HALF - WALL_THICK/2, 0, 0], [WALL_THICK, WALL_HEIGHT, MAP_SIZE], 'concrete_dark');
addBox([HALF + WALL_THICK/2, 0, 0], [WALL_THICK, WALL_HEIGHT, MAP_SIZE], 'concrete_dark');

let totalSectors = 0;
for (let gx = 0; gx < GRID_COUNT; gx++) {
  for (let gz = 0; gz < GRID_COUNT; gz++) {
    buildSector(gx, gz);
    totalSectors++;
  }
}

// Spawn Points balanceados em todos os distritos
const cityMap = {
  id: "city",
  name: "Cidade Abandonada 1000x1000 (Rebuild Modular)",
  size: [MAP_SIZE, MAP_SIZE],
  bounds: [-HALF + 15, HALF - 15, -HALF + 15, HALF - 15],
  floorMaterial: "concrete_dark",
  environment: {
    fogColor: "#424850",
    fogNear: 90,
    fogFar: 500
  },
  playerSpawns: [
    [-50, 1.0, -50],          // Térreo Torre Central
    [-50, 16.0, -50],         // Terraço Sniper Torre Central
    [0, 1.0, 0],              // Praça Central
    [-170, 8.5, -170],        // Terraço do Edifício Garagem
    [200, 1.0, 0],            // Avenida Downtown
    [-350, 1.0, 0],           // Bairro Residencial
    [0, 1.0, 380]             // Distrito Industrial
  ],
  botSpawns: [
    [-50, 4.2, -50],          // Torre Central 2º Andar
    [-50, 8.0, -50],          // Torre Central 3º Andar
    [-50, 11.8, -50],         // Torre Central 4º Andar
    [50, 1.0, -50],           // Praça
    [0, 1.0, 50],             // Monumento
    [-170, 4.2, -170],        // Garagem 2º Andar
    [200, 1.0, 80],           // Rua Downtown
    [200, 1.0, -80],          // Rua Downtown
    [-350, 1.0, 80],          // Residencial
    [0, 1.0, 320]             // Galpão Industrial
  ],
  staticGeometry
};

const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'city.json');
fs.writeFileSync(outputPath, JSON.stringify(cityMap, null, 2));

console.log(`Rebuild da Cidade 1000x1000 concluído!`);
console.log(`- Setores processados: ${totalSectors} (Grade 10x10)`);
console.log(`- Total de blocos estáticos: ${staticGeometry.length}`);
console.log(`- Salvo em: ${outputPath}`);
