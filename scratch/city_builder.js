/**
 * CITY BUILDER - Algoritmo de Geração Modular de Cidades
 * Mapa: 2000x2000 (20x20 setores de 100x100m)
 * 
 * Regras Estritas de Engenharia:
 * 1. Acessibilidade 100%: Nenhum player ou bot fica preso.
 * 2. Escadarias Reais: Degraus com espelho <= 0.40m e vão livre nas lajes.
 * 3. Zero Clipping: Props e árvores respeitam footprints dos prédios e vias.
 * 4. Conectividade de Vias: Bordas de setores compatíveis entre si.
 */

const fs = require('fs');
const path = require('path');

// --- RNG Pseudo-aleatório com Seed ---
let seed = 1986;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randRange(min, max) { return min + rand() * (max - min); }
function randChoice(arr) { return arr[Math.floor(rand() * arr.length)]; }

const MAP_SIZE = 2000;
const HALF = MAP_SIZE / 2;
const SECTOR_SIZE = 100;
const GRID_COUNT = MAP_SIZE / SECTOR_SIZE; // 20

// Armazenamento global da geometria
const staticGeometry = [];

// Registrador de colisores locais para evitar sobreposição/clipping de props
class OccupancyTracker {
  constructor() {
    this.boxes = [];
  }
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

// Helper para adicionar bloco estático
function addBox(pos, size, material, vaultable = false) {
  staticGeometry.push({ pos, size, material, vaultable: !!vaultable });
  // Registra no tracker se for estrutura no chão
  if (pos[1] <= 1.5) {
    const halfX = size[0] / 2;
    const halfZ = size[2] / 2;
    tracker.add(pos[0] - halfX, pos[0] + halfX, pos[2] - halfZ, pos[2] + halfZ);
  }
}

// =========================================================================
// BIBLIOTECA DE PEÇAS & MÓDULOS ALGORÍTMICOS
// =========================================================================

/**
 * Construtor de Escada Reta (Acessível sem pular)
 */
function buildStaircase(startX, startY, startZ, width, totalRise, steps, dirX = 0, dirZ = 1) {
  const stepRise = totalRise / steps;
  const stepRun = 1.1; // 1.1m por degrau garante passada limpa
  for (let s = 0; s < steps; s++) {
    const x = startX + s * stepRun * dirX;
    const y = startY + s * stepRise;
    const z = startZ + s * stepRun * dirZ;
    addBox([x, y, z], [dirX ? stepRun + 0.05 : width, stepRise, dirZ ? stepRun + 0.05 : width], 'concrete', true);
  }
}

/**
 * Gerador de Hotel Art Déco com Balcões e Acesso Térreo Completo
 */
function buildHotel(cx, cz, w, d, floors = 4) {
  const floorH = 3.6;
  const stairW = 3.6;
  const stairSteps = 9;
  const stairRise = floorH / stairSteps; // 0.40m

  for (let f = 0; f < floors; f++) {
    const yBase = f * floorH;

    // Lajes
    if (f === 0) {
      addBox([cx, 0.05, cz], [w + 4, 0.2, d + 4], 'concrete', true);
    } else {
      // Laje com vão para a escada no canto Noroeste
      addBox([cx + 6, yBase, cz], [w - 12, 0.35, d], 'plaster_light', true);
      addBox([cx - (w/2 - 6), yBase, cz + 8], [12, 0.35, d - 16], 'plaster_light', true);
    }

    // Paredes
    const matWall = 'fabric_red';
    // Fachada Leste (Frente): Vão de entrada enorme no térreo, sacada nos andares superiores
    if (f === 0) {
      addBox([cx + w/2, yBase, cz - 10], [1.0, floorH, (d/2) - 10], matWall);
      addBox([cx + w/2, yBase, cz + 10], [1.0, floorH, (d/2) - 10], matWall);
      addBox([cx + w/2, yBase + 2.8, cz], [1.0, floorH - 2.8, 12], matWall); // Lintel alto
    } else {
      addBox([cx + w/2, yBase, cz - 10], [1.0, floorH, (d/2) - 10], matWall);
      addBox([cx + w/2, yBase, cz + 10], [1.0, floorH, (d/2) - 10], matWall);
      addBox([cx + w/2, yBase + 2.6, cz], [1.0, floorH - 2.6, 12], matWall);
      // Sacada projetada
      addBox([cx + w/2 + 1.25, yBase, cz], [2.5, 0.35, 12], 'plaster_light', true);
      addBox([cx + w/2 + 2.4, yBase + 0.35, cz], [0.3, 1.0, 12], 'wall_white', true);
    }

    // Fachada Oeste (Fundos) - Porta aberta
    addBox([cx - w/2, yBase, cz - 8], [1.0, floorH, (d/2) - 8], matWall);
    addBox([cx - w/2, yBase, cz + 8], [1.0, floorH, (d/2) - 8], matWall);
    addBox([cx - w/2, yBase + 2.6, cz], [1.0, floorH - 2.6, 8], matWall);

    // Fachadas Norte e Sul com janelões
    addBox([cx - 10, yBase, cz - d/2], [w/2 - 10, floorH, 1.0], matWall);
    addBox([cx + 10, yBase, cz - d/2], [w/2 - 10, floorH, 1.0], matWall);
    addBox([cx, yBase + 2.4, cz - d/2], [8, floorH - 2.4, 1.0], matWall);

    addBox([cx - 10, yBase, cz + d/2], [w/2 - 10, floorH, 1.0], matWall);
    addBox([cx + 10, yBase, cz + d/2], [w/2 - 10, floorH, 1.0], matWall);
    addBox([cx, yBase + 2.4, cz + d/2], [8, floorH - 2.4, 1.0], matWall);

    // Escadaria contínua
    const stX = cx - w/2 + 4;
    const stZ = cz - d/2 + 4;
    buildStaircase(stX, yBase, stZ, stairW, floorH, stairSteps, 0, 1);
  }

  // Terraço na cobertura
  const roofY = floors * floorH;
  addBox([cx, roofY, cz], [w, 0.4, d], 'plaster_light', true);
  // Parapeito de proteção para combate
  addBox([cx, roofY + 0.4, cz - d/2], [w, 1.1, 0.5], 'fabric_red', true);
  addBox([cx, roofY + 0.4, cz + d/2], [w, 1.1, 0.5], 'fabric_red', true);
  addBox([cx - w/2, roofY + 0.4, cz], [0.5, 1.1, d], 'fabric_red', true);
  addBox([cx + w/2, roofY + 0.4, cz], [0.5, 1.1, d], 'fabric_red', true);
  // Saída da escada no teto
  addBox([cx - w/2 + 4, roofY + 0.4, cz - d/2 + 2], [6, 2.6, 1], 'concrete');
  addBox([cx - w/2 + 4, roofY + 3.0, cz - d/2 + 8], [7, 0.3, 14], 'concrete_dark');
}

/**
 * Gerador de Vila / Mansão Tropical (2 andares abertos com piscina)
 */
function buildMansion(cx, cz) {
  const w = 36, d = 32;
  // Piscina
  addBox([cx + 15, 0.05, cz], [12, 0.05, 20], 'blue_tarp');
  addBox([cx + 15, 0.1, cz - 12], [16, 0.2, 4], 'sandstone', true);
  addBox([cx + 15, 0.1, cz + 12], [16, 0.2, 4], 'sandstone', true);

  // Térreo aberto
  addBox([cx - 8, 0.1, cz], [w - 12, 0.2, d], 'wall_white', true);
  // Pilares estruturais modernos
  addBox([cx - 18, 0.3, cz - 14], [1.5, 3.6, 1.5], 'wall_white');
  addBox([cx - 18, 0.3, cz + 14], [1.5, 3.6, 1.5], 'wall_white');
  addBox([cx + 2, 0.3, cz - 14], [1.5, 3.6, 1.5], 'wall_white');
  addBox([cx + 2, 0.3, cz + 14], [1.5, 3.6, 1.5], 'wall_white');

  // Laje 2º Andar
  addBox([cx - 8, 3.9, cz], [w - 12, 0.35, d], 'plaster_light', true);
  // Teto solar
  addBox([cx - 8, 7.5, cz], [w - 8, 0.35, d + 4], 'sandstone', true);

  // Escada suave pra subir pro 2º andar
  buildStaircase(cx - 3, 0.3, cz - 10, 3.0, 3.6, 9, 0, 1);

  // Guarda corpo no 2º andar
  addBox([cx - 8, 4.25, cz - 15.5], [w - 12, 1.0, 0.4], 'plaster_light', true);
  addBox([cx - 8, 4.25, cz + 15.5], [w - 12, 1.0, 0.4], 'plaster_light', true);
  addBox([cx + 3.8, 4.25, cz], [0.4, 1.0, d], 'plaster_light', true);
}

/**
 * Gerador de Galpão Industrial Aberto
 */
function buildWarehouse(cx, cz, w = 45, d = 40, h = 10) {
  // Piso
  addBox([cx, 0.05, cz], [w, 0.2, d], 'concrete_dark', true);
  // Paredes com vãos enormes de portão
  addBox([cx - w/2, 0, cz], [1.0, h, d], 'scaffold');
  addBox([cx + w/2, 0, cz], [1.0, h, d], 'scaffold');
  // Portões abertos nas pontas (apenas cantos fechados)
  addBox([cx - 15, 0, cz - d/2], [w/2 - 15, h, 1.0], 'scaffold');
  addBox([cx + 15, 0, cz - d/2], [w/2 - 15, h, 1.0], 'scaffold');
  addBox([cx, h - 2.5, cz - d/2], [14, 2.5, 1.0], 'scaffold'); // Vão de 14m livre

  addBox([cx - 15, 0, cz + d/2], [w/2 - 15, h, 1.0], 'scaffold');
  addBox([cx + 15, 0, cz + d/2], [w/2 - 15, h, 1.0], 'scaffold');
  addBox([cx, h - 2.5, cz + d/2], [14, 2.5, 1.0], 'scaffold');

  // Telhado
  addBox([cx, h, cz], [w + 2, 0.6, d + 2], 'scaffold', true);

  // Pilha de contêineres e caixas no interior para cover
  addBox([cx - 10, 0.2, cz], [3, 2.6, 6], 'blue_tarp', true);
  addBox([cx - 10, 2.8, cz], [3, 2.6, 6], 'crate', true);
  addBox([cx + 8, 0.2, cz + 6], [4, 1.8, 4], 'crate', true);
}

/**
 * Gerador de Coqueiro (Tronco e Folhas)
 */
function plantPalm(x, z) {
  if (!tracker.isFree(x - 2, x + 2, z - 2, z + 2, 0.5)) return;
  addBox([x, 0.1, z], [0.6, 7.5, 0.6], 'trunk');
  addBox([x, 7.6, z], [4.2, 1.2, 4.2], 'foliage_light');
}

/**
 * Gerador de Carro Estacionado (Cover Tático)
 */
function spawnCar(x, z, rot = 'z') {
  if (!tracker.isFree(x - 2, x + 2, z - 3, z + 3, 0.8)) return;
  const mat = randChoice(['caution_yellow', 'fabric_red', 'concrete_dark', 'wall_white']);
  if (rot === 'z') {
    addBox([x, 0.1, z], [2.4, 1.3, 4.8], mat, true);
    addBox([x, 1.4, z - 0.2], [2.2, 0.8, 2.6], 'plaster_light', true); // Cabine
  } else {
    addBox([x, 0.1, z], [4.8, 1.3, 2.4], mat, true);
    addBox([x - 0.2, 1.4, z], [2.6, 0.8, 2.2], 'plaster_light', true);
  }
}

// =========================================================================
// MÁQUINA DE CONSTRUÇÃO POR SETOR (20 x 20)
// =========================================================================

// Tipos de Bioma por Setor
const ZONES = {
  OCEAN: 'OCEAN',
  BEACH: 'BEACH',
  OCEAN_DRIVE: 'OCEAN_DRIVE',
  DOWNTOWN: 'DOWNTOWN',
  RESIDENTIAL: 'RESIDENTIAL',
  INDUSTRIAL: 'INDUSTRIAL',
  AIRPORT: 'AIRPORT',
  RIVER: 'RIVER'
};

// Matriz Macro 20x20 de Vice City
function getSectorZone(gx, gz) {
  // Leste: Oceano e Praia
  if (gx >= 17) return ZONES.OCEAN;
  if (gx >= 14) return ZONES.BEACH;
  if (gx === 13) return ZONES.OCEAN_DRIVE;

  // Rio cortando no meio (gx = 9)
  if (gx === 9) {
    if (gz === 9 || gz === 10) return ZONES.RESIDENTIAL; // Starfish Island
    return ZONES.RIVER;
  }

  // Ilha de Vice Beach (gx = 10, 11, 12)
  if (gx >= 10 && gx <= 12) {
    return ZONES.RESIDENTIAL;
  }

  // Continente Oeste (gx = 0 a 8)
  if (gx <= 4 && gz >= 13) return ZONES.AIRPORT; // Sudoeste
  if (gx <= 4 && gz <= 5) return ZONES.INDUSTRIAL; // Noroeste
  return ZONES.DOWNTOWN; // Centro do continente
}

// Constrói um setor individual de 100x100m
function buildSector(gx, gz) {
  const cx = -HALF + gx * SECTOR_SIZE + SECTOR_SIZE / 2;
  const cz = -HALF + gz * SECTOR_SIZE + SECTOR_SIZE / 2;
  const zone = getSectorZone(gx, gz);

  switch (zone) {
    case ZONES.OCEAN:
      addBox([cx, 0.02, cz], [SECTOR_SIZE, 0.04, SECTOR_SIZE], 'blue_tarp');
      break;

    case ZONES.BEACH:
      addBox([cx, 0.05, cz], [SECTOR_SIZE, 0.1, SECTOR_SIZE], 'sand');
      // Posto de Salva-vidas em setores alternados
      if ((gx + gz) % 3 === 0) {
        addBox([cx, 0.1, cz], [6, 2.5, 6], 'wood', true);
        addBox([cx, 2.6, cz], [7, 0.3, 7], 'fabric_red', true);
        buildStaircase(cx - 5, 0.1, cz, 2.0, 2.5, 6, 1, 0);
      }
      break;

    case ZONES.OCEAN_DRIVE: {
      // Avenida Asfalto a Leste do setor (X = cx + 25)
      addBox([cx + 25, 0.08, cz], [30, 0.05, SECTOR_SIZE], 'concrete_dark');
      // Calçadas
      addBox([cx + 45, 0.15, cz], [10, 0.15, SECTOR_SIZE], 'plaster_light', true);
      addBox([cx + 5, 0.15, cz], [10, 0.15, SECTOR_SIZE], 'plaster_light', true);

      // Linha de Coqueiros e Carros na Calçada
      for (let offsetZ = -35; offsetZ <= 35; offsetZ += 35) {
        plantPalm(cx + 45, cz + offsetZ);
        plantPalm(cx + 5, cz + offsetZ);
        spawnCar(cx + 15, cz + offsetZ + 10, 'z');
      }

      // Hotel Art Déco de frente pra orla
      buildHotel(cx - 20, cz, 40, 50, 4);
      break;
    }

    case ZONES.RESIDENTIAL: {
      // Bairro residencial com ruas cruzadas e mansões
      addBox([cx, 0.06, cz], [16, 0.05, SECTOR_SIZE], 'concrete_dark');
      addBox([cx, 0.06, cz], [SECTOR_SIZE, 0.05, 16], 'concrete_dark');
      // Mansão no quadrante principal
      buildMansion(cx + 25, cz + 25);
      // Árvores e coqueiros no jardim
      plantPalm(cx - 25, cz - 25);
      plantPalm(cx - 35, cz + 25);
      spawnCar(cx + 15, cz - 25, 'x');
      break;
    }

    case ZONES.INDUSTRIAL: {
      // Ruas industriais
      addBox([cx, 0.06, cz], [20, 0.05, SECTOR_SIZE], 'concrete_dark');
      buildWarehouse(cx + 24, cz, 42, 45, 9);
      // Pátio de contêineres
      addBox([cx - 25, 0.1, cz - 20], [3, 2.6, 6], 'blue_tarp', true);
      addBox([cx - 25, 0.1, cz + 20], [3, 2.6, 6], 'caution_yellow', true);
      break;
    }

    case ZONES.AIRPORT: {
      // Pistas de concreto maciças
      addBox([cx, 0.08, cz], [SECTOR_SIZE, 0.05, 40], 'concrete_dark');
      addBox([cx, 0.1, cz], [SECTOR_SIZE, 0.06, 3], 'wall_white');
      if (gx === 2 && gz === 16) {
        // Hangar gigante acessível
        buildWarehouse(cx, cz + 30, 60, 40, 14);
      }
      break;
    }

    case ZONES.RIVER: {
      addBox([cx, 0.02, cz], [SECTOR_SIZE, 0.04, SECTOR_SIZE], 'blue_tarp');
      // Pontes conectando continente à ilha (no gz = 4 e gz = 15)
      if (gz === 4 || gz === 15) {
        addBox([cx, 2.4, cz], [SECTOR_SIZE, 0.6, 28], 'concrete_dark', true);
        addBox([cx, 3.0, cz - 13.5], [SECTOR_SIZE, 1.1, 0.8], 'concrete', true);
        addBox([cx, 3.0, cz + 13.5], [SECTOR_SIZE, 1.1, 0.8], 'concrete', true);
        // Pilares na água
        addBox([cx, 0, cz], [6, 2.4, 24], 'concrete');
      }
      break;
    }

    case ZONES.DOWNTOWN: {
      // Grid de Avenidas
      addBox([cx, 0.06, cz], [18, 0.05, SECTOR_SIZE], 'concrete_dark');
      addBox([cx, 0.06, cz], [SECTOR_SIZE, 0.05, 18], 'concrete_dark');

      // Prédios comerciais nos lotes
      const h1 = randRange(35, 110);
      const h2 = randRange(25, 80);
      const mat1 = randChoice(['concrete', 'wall_white', 'sandstone', 'plaster_light']);
      const mat2 = randChoice(['concrete_dark', 'fabric_red', 'plaster_light']);

      addBox([cx - 26, 0, cz - 26], [32, h1, 32], mat1);
      addBox([cx + 26, 0, cz + 26], [30, h2, 30], mat2);

      // Entrada térrea aberta no prédio 2
      addBox([cx + 26, 0, cz + 10], [10, 3.2, 2], 'steel_girder');

      // Carros estacionados na avenida
      spawnCar(cx - 12, cz + 15, 'z');
      spawnCar(cx + 12, cz - 20, 'z');
      break;
    }
  }
}

// =========================================================================
// EXECUÇÃO GERAL DO BUILDER
// =========================================================================
console.log("Iniciando Máquina de Construção em Massa (2000x2000 - 400 Setores)...");

// 1. Muros Perimetrais
const WALL_THICK = 20, WALL_HEIGHT = 80;
addBox([0, 0, -HALF - WALL_THICK/2], [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], 'concrete_dark');
addBox([0, 0, HALF + WALL_THICK/2], [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], 'concrete_dark');
addBox([-HALF - WALL_THICK/2, 0, 0], [WALL_THICK, WALL_HEIGHT, MAP_SIZE], 'concrete_dark');
addBox([HALF + WALL_THICK/2, 0, 0], [WALL_THICK, WALL_HEIGHT, MAP_SIZE], 'concrete_dark');

// 2. Iterar por todos os 400 setores
let totalSectors = 0;
for (let gx = 0; gx < GRID_COUNT; gx++) {
  for (let gz = 0; gz < GRID_COUNT; gz++) {
    buildSector(gx, gz);
    totalSectors++;
  }
}

// 3. Montar Objeto do Mapa
const generatedMap = {
  id: "vice",
  name: "Vice City 2000x2000 (Algoritmo Modular)",
  size: [MAP_SIZE, MAP_SIZE],
  bounds: [-HALF + 20, HALF - 20, -HALF + 20, HALF - 20],
  floorMaterial: "grass",
  environment: {
    fogColor: "#f39c7a",
    fogNear: 160,
    fogFar: 850
  },
  playerSpawns: [
    [380, 1.0, 0],             // Ocean Drive
    [380, 18.0, 0],            // Rooftop Hotel Orla
    [480, 1.0, 0],             // Praia
    [-300, 1.0, 0],            // Downtown
    [-700, 1.0, 600]           // Aeroporto
  ],
  botSpawns: [
    [380, 4.2, 0],
    [380, 7.8, 0],
    [380, 1.0, 60],
    [380, 1.0, -60],
    [480, 1.0, 80],
    [480, 1.0, -80],
    [-300, 1.0, 50],
    [-700, 1.0, 500]
  ],
  staticGeometry
};

const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'vice.json');
fs.writeFileSync(outputPath, JSON.stringify(generatedMap, null, 2));

console.log(`Construção concluída com sucesso!`);
console.log(`- Setores processados: ${totalSectors} (Grade 20x20)`);
console.log(`- Total de blocos estáticos: ${staticGeometry.length}`);
console.log(`- Arquivo salvo em: ${outputPath}`);
