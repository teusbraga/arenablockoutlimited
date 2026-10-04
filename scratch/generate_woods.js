const fs = require('fs');
const path = require('path');

// Seeded PRNG for reproducible natural generation
let seed = 12345;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randRange(min, max) {
  return min + rand() * (max - min);
}

const staticGeometry = [];

// Boundary Walls (300x300 arena perimeter)
const MAP_SIZE = 300;
const HALF = MAP_SIZE / 2; // 150
const WALL_THICK = 10;
const WALL_HEIGHT = 16;

// North Wall
staticGeometry.push({ pos: [0, 0, -HALF - WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'stone' });
// South Wall
staticGeometry.push({ pos: [0, 0, HALF + WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'stone' });
// West Wall
staticGeometry.push({ pos: [-HALF - WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'stone' });
// East Wall
staticGeometry.push({ pos: [HALF + WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'stone' });

// ==========================================
// 1. MORRINHO 1 (Higher Hill - Stepped Stairs)
// Center: X = -50, Z = -40
// ==========================================
const h1X = -50, h1Z = -40;
const stepH = 0.45; // Step height player can easily walk up

const hill1Tiers = [
  { size: 70, y: 0 },
  { size: 58, y: 0.45 },
  { size: 46, y: 0.90 },
  { size: 34, y: 1.35 },
  { size: 24, y: 1.80 },
  { size: 14, y: 2.25 },
];

for (const t of hill1Tiers) {
  staticGeometry.push({
    pos: [h1X, t.y, h1Z],
    size: [t.size, stepH, t.size],
    material: t.y > 1.5 ? 'dirt' : 'grass',
    vaultable: true
  });
}

// Rock cover on top of Hill 1 (Peak at Y = 2.70)
staticGeometry.push({ pos: [h1X - 3, 2.70, h1Z - 2], size: [2.5, 1.4, 2.0], material: 'stone', vaultable: true });
staticGeometry.push({ pos: [h1X + 2, 2.70, h1Z + 1], size: [3.0, 1.2, 2.2], material: 'stone', vaultable: true });
staticGeometry.push({ pos: [h1X - 1, 2.70 + 1.2, h1Z + 1], size: [1.8, 1.0, 1.6], material: 'stone', vaultable: true }); // Stacked rock

// ==========================================
// 2. MORRINHO 2 (Lower Hill - Stepped Stairs)
// Center: X = 60, Z = 50
// ==========================================
const h2X = 60, h2Z = 50;
const hill2Tiers = [
  { size: 56, y: 0 },
  { size: 44, y: 0.45 },
  { size: 32, y: 0.90 },
  { size: 20, y: 1.35 },
];

for (const t of hill2Tiers) {
  staticGeometry.push({
    pos: [h2X, t.y, h2Z],
    size: [t.size, stepH, t.size],
    material: 'grass',
    vaultable: true
  });
}

// Rock cover on top of Hill 2 (Peak at Y = 1.80)
staticGeometry.push({ pos: [h2X - 2, 1.80, h2Z - 1], size: [2.8, 1.3, 1.8], material: 'stone', vaultable: true });
staticGeometry.push({ pos: [h2X + 2, 1.80, h2Z + 2], size: [2.2, 1.1, 2.4], material: 'stone', vaultable: true });

// ==========================================
// 3. DIRT PATHS & ROADS
// ==========================================
staticGeometry.push({ pos: [0, 0, 0], size: [160, 0.05, 12], material: 'dirt' });
staticGeometry.push({ pos: [0, 0, 0], size: [12, 0.05, 160], material: 'dirt' });
staticGeometry.push({ pos: [-20, 0, -20], size: [80, 0.05, 8], material: 'dirt' });

// ==========================================
// 4. TREES (Natural Dispersion across Woods)
// ==========================================
function isNearHill(x, z) {
  const d1 = Math.hypot(x - h1X, z - h1Z);
  const d2 = Math.hypot(x - h2X, z - h2Z);
  return d1 < 22 || d2 < 18; // Don't block hill peaks completely
}

const TREE_COUNT = 160;
let treesAdded = 0;

while (treesAdded < TREE_COUNT) {
  const tx = randRange(-HALF + 15, HALF - 15);
  const tz = randRange(-HALF + 15, HALF - 15);

  // Avoid spawning inside center roads or hill tops
  if (Math.abs(tx) < 10 && Math.abs(tz) < 10) continue;
  if (isNearHill(tx, tz)) continue;

  const trunkH = randRange(4.5, 6.5);
  const trunkW = randRange(0.7, 1.1);
  const folW = randRange(3.2, 4.8);
  const folH = randRange(3.8, 5.5);
  const isLight = rand() > 0.4;

  // Trunk
  staticGeometry.push({
    pos: [tx, 0, tz],
    size: [trunkW, trunkH, trunkW],
    material: 'trunk'
  });

  // Foliage top
  staticGeometry.push({
    pos: [tx, trunkH - 0.8, tz],
    size: [folW, folH, folW],
    material: isLight ? 'foliage_light' : 'foliage'
  });

  treesAdded++;
}

// ==========================================
// 5. ROCK FORMATIONS & PILES (Cover & Jumpable)
// ==========================================
const ROCK_COUNT = 65;
let rocksAdded = 0;

while (rocksAdded < ROCK_COUNT) {
  const rx = randRange(-HALF + 20, HALF - 20);
  const rz = randRange(-HALF + 20, HALF - 20);

  if (Math.abs(rx) < 8 && Math.abs(rz) < 8) continue;

  const rxSize = randRange(1.8, 3.5);
  const rySize = randRange(0.9, 1.6);
  const rzSize = randRange(1.8, 3.5);
  const mat = rand() > 0.3 ? 'stone' : 'concrete_dark';

  // Base Rock
  staticGeometry.push({
    pos: [rx, 0, rz],
    size: [rxSize, rySize, rzSize],
    material: mat,
    vaultable: true
  });

  // 30% chance to stack a second rock on top to create jumpable/climbable cover
  if (rand() > 0.70) {
    staticGeometry.push({
      pos: [rx + randRange(-0.4, 0.4), rySize, rz + randRange(-0.4, 0.4)],
      size: [rxSize * 0.75, rySize * 0.85, rzSize * 0.75],
      material: 'stone',
      vaultable: true
    });
  }

  rocksAdded++;
}

// ==========================================
// 6. SPAWN POINTS & MAP METADATA
// ==========================================
const woodsMap = {
  id: "woods",
  name: "Woods 300x300 (Bosque & Colinas)",
  size: [MAP_SIZE, MAP_SIZE],
  bounds: [-HALF + 5, HALF - 5, -HALF + 5, HALF - 5],
  floorMaterial: "grass",
  environment: {
    fogColor: "#6b8e63",
    fogNear: 50,
    fogFar: 260
  },
  playerSpawns: [
    [0, 1, 100],
    [-100, 1, 0],
    [100, 1, 0],
    [0, 1, -100],
    [h1X, 3.2, h1Z], // Top of Hill 1
    [h2X, 2.3, h2Z]  // Top of Hill 2
  ],
  botSpawns: [
    [-80, 1, -80],
    [80, 1, -80],
    [-80, 1, 80],
    [80, 1, 80],
    [-120, 1, 0],
    [120, 1, 0],
    [0, 1, -120],
    [0, 1, 120],
    [h1X + 10, 1.5, h1Z - 10],
    [h2X - 10, 1.0, h2Z + 10]
  ],
  staticGeometry
};

const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'woods.json');
fs.writeFileSync(outputPath, JSON.stringify(woodsMap, null, 2));
console.log(`Woods map generated successfully at ${outputPath}! Static geometry items: ${staticGeometry.length}`);
