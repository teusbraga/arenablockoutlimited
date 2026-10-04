const fs = require('fs');
const path = require('path');

let seed = 54321;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randRange(min, max) {
  return min + rand() * (max - min);
}

const staticGeometry = [];

const MAP_SIZE = 1000;
const HALF = MAP_SIZE / 2; // 500
const WALL_THICK = 15;
const WALL_HEIGHT = 25;

// Perimeter Boundary Walls
staticGeometry.push({ pos: [0, 0, -HALF - WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'concrete_dark' });
staticGeometry.push({ pos: [0, 0, HALF + WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'concrete_dark' });
staticGeometry.push({ pos: [-HALF - WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'concrete_dark' });
staticGeometry.push({ pos: [HALF + WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'concrete_dark' });

// ==========================================
// 1. MAIN AVENUES & ROADS (Asphalt & Concrete)
// ==========================================
// Central North-South Avenue
staticGeometry.push({ pos: [0, 0.01, 0], size: [20, 0.05, MAP_SIZE], material: 'concrete_dark' });
// Central East-West Avenue
staticGeometry.push({ pos: [0, 0.01, 0], size: [MAP_SIZE, 0.05, 20], material: 'concrete_dark' });
// 3rd Main Avenue (Parallel Avenue at X = -180)
staticGeometry.push({ pos: [-180, 0.01, 0], size: [18, 0.05, MAP_SIZE], material: 'concrete_dark' });
// 4th Secondary Avenue (Parallel Avenue at Z = 180)
staticGeometry.push({ pos: [0, 0.01, 180], size: [MAP_SIZE, 0.05, 18], material: 'concrete_dark' });

// ==========================================
// 2. CENTER BUILDING (4-STORY FUNCTIONAL TOWER)
// Center at X = 0, Z = 0. Size: 32m x 32m.
// Floors:
// Floor 1: Y = 0 to 3.5
// Floor 2: Y = 3.5 to 7.0
// Floor 3: Y = 7.0 to 10.5
// Floor 4: Y = 10.5 to 14.0
// Roof: Y = 14.0 with parapet
// Stairwell gap: X = -12 to -4, Z = -12 to -4
// ==========================================
const bX = 0, bZ = 0;
const bW = 32, bD = 32;
const floorH = 3.5;
const wallThick = 0.5;

// Build 4 Floors
for (let f = 0; f < 4; f++) {
  const yBase = f * floorH;

  // Floor Slab (divided into 2 sections to leave a 6m x 6m stairwell gap at X: -14 to -8, Z: -14 to -8)
  if (f > 0) {
    // Main slab section A (Right side)
    staticGeometry.push({
      pos: [bX + 4, yBase, bZ],
      size: [24, 0.3, bD],
      material: 'concrete',
      vaultable: true
    });
    // Main slab section B (Left front side)
    staticGeometry.push({
      pos: [bX - 11, yBase, bZ + 5],
      size: [10, 0.3, 22],
      material: 'concrete',
      vaultable: true
    });
  }

  // Outer Walls with Window Openings
  // North Wall (Z = bZ - bD/2)
  staticGeometry.push({ pos: [bX - 10, yBase, bZ - bD/2], size: [12, floorH, wallThick], material: 'concrete_dark' });
  staticGeometry.push({ pos: [bX + 10, yBase, bZ - bD/2], size: [12, floorH, wallThick], material: 'concrete_dark' });
  // Window Lintel North
  staticGeometry.push({ pos: [bX, yBase + 2.2, bZ - bD/2], size: [8, floorH - 2.2, wallThick], material: 'concrete_dark' });

  // South Wall (Z = bZ + bD/2)
  staticGeometry.push({ pos: [bX - 10, yBase, bZ + bD/2], size: [12, floorH, wallThick], material: 'concrete_dark' });
  staticGeometry.push({ pos: [bX + 10, yBase, bZ + bD/2], size: [12, floorH, wallThick], material: 'concrete_dark' });
  // Window Lintel South
  staticGeometry.push({ pos: [bX, yBase + 2.2, bZ + bD/2], size: [8, floorH - 2.2, wallThick], material: 'concrete_dark' });

  // East Wall (X = bX + bW/2)
  staticGeometry.push({ pos: [bX + bW/2, yBase, bZ - 10], size: [wallThick, floorH, 12], material: 'concrete_dark' });
  staticGeometry.push({ pos: [bX + bW/2, yBase, bZ + 10], size: [wallThick, floorH, 12], material: 'concrete_dark' });
  // Window Lintel East
  staticGeometry.push({ pos: [bX + bW/2, yBase + 2.2, bZ], size: [wallThick, floorH - 2.2, 8], material: 'concrete_dark' });

  // West Wall (X = bX - bW/2)
  staticGeometry.push({ pos: [bX - bW/2, yBase, bZ - 10], size: [wallThick, floorH, 12], material: 'concrete_dark' });
  staticGeometry.push({ pos: [bX - bW/2, yBase, bZ + 10], size: [wallThick, floorH, 12], material: 'concrete_dark' });
  // Window Lintel West
  staticGeometry.push({ pos: [bX - bW/2, yBase + 2.2, bZ], size: [wallThick, floorH - 2.2, 8], material: 'concrete_dark' });

  // Interior Support Pillars
  staticGeometry.push({ pos: [bX - 5, yBase, bZ - 5], size: [1.2, floorH, 1.2], material: 'steel_girder' });
  staticGeometry.push({ pos: [bX + 5, yBase, bZ - 5], size: [1.2, floorH, 1.2], material: 'steel_girder' });
  staticGeometry.push({ pos: [bX - 5, yBase, bZ + 5], size: [1.2, floorH, 1.2], material: 'steel_girder' });
  staticGeometry.push({ pos: [bX + 5, yBase, bZ + 5], size: [1.2, floorH, 1.2], material: 'steel_girder' });

  // STAIRWELL STEPS for floor f -> f+1 (Step height 0.45m so player walks seamlessly!)
  const stepsPerFloor = 8;
  const stepRise = floorH / stepsPerFloor; // ~0.4375m
  const stairX = bX - 11;
  const startZ = bZ - 14;

  for (let s = 0; s < stepsPerFloor; s++) {
    staticGeometry.push({
      pos: [stairX, yBase + s * stepRise, startZ + s * 0.95],
      size: [3.5, stepRise, 1.0],
      material: 'concrete',
      vaultable: true
    });
  }
}

// Roof Slab (Floor 5 Top)
const roofY = 4 * floorH; // 14.0m
staticGeometry.push({ pos: [bX, roofY, bZ], size: [bW, 0.4, bD], material: 'concrete', vaultable: true });

// Roof Parapet Wall (Protective cover for snipers on roof)
staticGeometry.push({ pos: [bX, roofY + 0.4, bZ - bD/2], size: [bW, 1.2, 0.4], material: 'concrete_dark', vaultable: true });
staticGeometry.push({ pos: [bX, roofY + 0.4, bZ + bD/2], size: [bW, 1.2, 0.4], material: 'concrete_dark', vaultable: true });
staticGeometry.push({ pos: [bX - bW/2, roofY + 0.4, bZ], size: [0.4, 1.2, bD], material: 'concrete_dark', vaultable: true });
staticGeometry.push({ pos: [bX + bW/2, roofY + 0.4, bZ], size: [0.4, 1.2, bD], material: 'concrete_dark', vaultable: true });

// Sandbag / Crate cover on roof
staticGeometry.push({ pos: [bX + 4, roofY + 0.4, bZ - 4], size: [3.0, 1.1, 1.2], material: 'sand', vaultable: true });
staticGeometry.push({ pos: [bX - 6, roofY + 0.4, bZ + 5], size: [2.5, 1.2, 2.5], material: 'crate', vaultable: true });

// ==========================================
// 3. ABANDONED CITY BLOCKS & BUILDINGS (1000x1000 Grid)
// ==========================================
const materials = ['concrete', 'concrete_dark', 'wall_white', 'sandstone', 'plaster_light'];

const buildingCount = 140;
let bAdded = 0;

while (bAdded < buildingCount) {
  const bx = randRange(-HALF + 40, HALF - 40);
  const bz = randRange(-HALF + 40, HALF - 40);

  // Keep clear of roads and center building
  if (Math.abs(bx) < 35 && Math.abs(bz) < 35) continue; // Center building zone
  if (Math.abs(bx) < 18 || Math.abs(bz) < 18) continue; // Central avenues
  if (Math.abs(bx + 180) < 16 || Math.abs(bz - 180) < 16) continue; // Parallel avenues

  const width = randRange(14, 28);
  const depth = randRange(14, 28);
  const height = randRange(8, 22); // 2 to 6 stories
  const mat = materials[Math.floor(rand() * materials.length)];

  // Building Shell
  staticGeometry.push({
    pos: [bx, 0, bz],
    size: [width, height, depth],
    material: mat
  });

  // Roof parapet / roof detail
  if (rand() > 0.5) {
    staticGeometry.push({
      pos: [bx, height, bz],
      size: [width - 1.5, 0.8, depth - 1.5],
      material: 'concrete_dark'
    });
  }

  bAdded++;
}

// ==========================================
// 4. URBAN PROPS & DEBRIS (Abandoned Cars, Barricades, Containers)
// ==========================================
const propCount = 180;
let pAdded = 0;

while (pAdded < propCount) {
  const px = randRange(-HALF + 25, HALF - 25);
  const pz = randRange(-HALF + 25, HALF - 25);

  if (Math.abs(px) < 18 && Math.abs(pz) < 18) continue; // Don't block center building entrance completely

  const pType = rand();

  if (pType < 0.35) {
    // Abandoned Wrecked Car / Truck
    const carLength = randRange(4.2, 6.0);
    staticGeometry.push({ pos: [px, 0, pz], size: [2.1, 1.4, carLength], material: 'metal_barrel', vaultable: true });
    staticGeometry.push({ pos: [px, 1.4, pz - 0.3], size: [1.9, 0.9, carLength * 0.5], material: 'concrete_dark', vaultable: true });
  } else if (pType < 0.65) {
    // Concrete Barrier Wall (Jersey Barrier)
    staticGeometry.push({ pos: [px, 0, pz], size: [3.8, 1.2, 0.8], material: 'concrete', vaultable: true });
  } else if (pType < 0.85) {
    // Cargo Container / Stacked Crates
    const cMat = rand() > 0.5 ? 'blue_tarp' : 'crate';
    staticGeometry.push({ pos: [px, 0, pz], size: [2.6, 2.6, 6.0], material: cMat, vaultable: true });
  } else {
    // Construction Scaffold / Wood Debris
    staticGeometry.push({ pos: [px, 0, pz], size: [2.2, 3.5, 2.2], material: 'scaffold', vaultable: true });
  }

  pAdded++;
}

// ==========================================
// 5. SPAWNS & MAP DATA
// ==========================================
const cityMap = {
  id: "city",
  name: "Cidade Abandonada 1000x1000",
  size: [MAP_SIZE, MAP_SIZE],
  bounds: [-HALF + 10, HALF - 10, -HALF + 10, HALF - 10],
  floorMaterial: "concrete_dark",
  environment: {
    fogColor: "#424850",
    fogNear: 80,
    fogFar: 450
  },
  playerSpawns: [
    [0, 1, 14],            // Inside Ground Floor of Center Building
    [0, 14.5, 0],          // On Roof of 4-Story Center Building!
    [100, 1, 100],
    [-100, 1, -100],
    [-180, 1, 180],
    [180, 1, -180]
  ],
  botSpawns: [
    [0, 7.5, 0],           // Floor 3 of Center Building
    [0, 11.0, 0],          // Floor 4 of Center Building
    [50, 1, 50],
    [-50, 1, -50],
    [150, 1, 150],
    [-150, 1, -150],
    [250, 1, 0],
    [-250, 1, 0],
    [0, 1, 250],
    [0, 1, -250]
  ],
  staticGeometry
};

const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'city.json');
fs.writeFileSync(outputPath, JSON.stringify(cityMap, null, 2));
console.log(`City 1000x1000 map generated successfully at ${outputPath}! Total static items: ${staticGeometry.length}`);
