const fs = require('fs');
const path = require('path');

let seed = 1986; // Vice City year
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randRange(min, max) {
  return min + rand() * (max - min);
}

const staticGeometry = [];

const MAP_SIZE = 2000;
const HALF = MAP_SIZE / 2; // 1000
const WALL_THICK = 20;
const WALL_HEIGHT = 100;

// Perimeter Boundary Walls
staticGeometry.push({ pos: [0, 0, -HALF - WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'concrete_dark' });
staticGeometry.push({ pos: [0, 0, HALF + WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'concrete_dark' });
staticGeometry.push({ pos: [-HALF - WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'concrete_dark' });
staticGeometry.push({ pos: [HALF + WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'concrete_dark' });

// ==========================================
// 1. MACRO REGIONS: OCEAN, BEACH, RIVER
// ==========================================
// Base floor is grass.

// Ocean (East side)
staticGeometry.push({ pos: [700, -0.5, 0], size: [600, 1.0, MAP_SIZE], material: 'blue_tarp' });

// Beach (Washington Beach)
staticGeometry.push({ pos: [350, 0, 0], size: [100, 0.2, MAP_SIZE], material: 'sand' });
staticGeometry.push({ pos: [450, -0.2, 0], size: [100, 0.4, MAP_SIZE], material: 'sand' }); // slopes slightly into water

// Ocean Drive Avenue
staticGeometry.push({ pos: [270, 0.02, 0], size: [60, 0.05, MAP_SIZE], material: 'concrete_dark' }); // 60m wide road
// West sidewalk of Ocean Drive
staticGeometry.push({ pos: [230, 0.1, 0], size: [20, 0.2, MAP_SIZE], material: 'plaster_light' });

// Intra-coastal River (Separating Vice Beach from Mainland)
staticGeometry.push({ pos: [-100, -0.5, 0], size: [160, 1.0, MAP_SIZE], material: 'blue_tarp' });

// River embankments
staticGeometry.push({ pos: [-180, 0, 0], size: [10, 0.5, MAP_SIZE], material: 'concrete' });
staticGeometry.push({ pos: [-20, 0, 0], size: [10, 0.5, MAP_SIZE], material: 'concrete' });

// ==========================================
// 2. BRIDGES (Connecting Beach Island to Mainland)
// ==========================================
function buildBridge(zPos) {
  // Arching bridge over the river (-180 to -20)
  const bStart = -180;
  const bEnd = -20;
  const bLen = bEnd - bStart;
  const span = 16;
  const bWidth = 40;
  
  // Create an arched bridge using steps
  for(let i=0; i<span; i++) {
    const xCenter = bStart + (bLen / span) * (i + 0.5);
    const progress = i / (span - 1);
    // parabola peak at middle
    const yHeight = Math.sin(progress * Math.PI) * 12; // 12m high arch
    
    // Bridge Deck Step
    staticGeometry.push({ pos: [xCenter, yHeight, zPos], size: [(bLen/span) + 0.1, 1.0, bWidth], material: 'concrete_dark', vaultable: true });
    
    // Pillars reaching down to water if yHeight > 1
    if (yHeight > 1.5) {
      staticGeometry.push({ pos: [xCenter, yHeight/2, zPos - bWidth/2 + 2], size: [2, yHeight, 4], material: 'concrete' });
      staticGeometry.push({ pos: [xCenter, yHeight/2, zPos + bWidth/2 - 2], size: [2, yHeight, 4], material: 'concrete' });
    }
  }
}
buildBridge(-300); // North Bridge
buildBridge(300);  // South Bridge

// ==========================================
// 3. MAINLAND ROADS (Downtown Grid)
// ==========================================
// Highway / Main Avenues
for(let z = -800; z <= 800; z += 400) {
  staticGeometry.push({ pos: [-550, 0.05, z], size: [700, 0.1, 30], material: 'concrete_dark' });
}
for(let x = -800; x <= -200; x += 300) {
  staticGeometry.push({ pos: [x, 0.05, 0], size: [30, 0.1, MAP_SIZE], material: 'concrete_dark' });
}

// Airport Runway (Escobar Intl) South West
staticGeometry.push({ pos: [-700, 0.08, 600], size: [150, 0.1, 600], material: 'concrete_dark' });
staticGeometry.push({ pos: [-700, 0.1, 600], size: [4, 0.12, 500], material: 'wall_white' }); // Runway center line

// ==========================================
// 4. PALM TREES & PROPS (Ocean Drive)
// ==========================================
for(let z = -950; z <= 950; z += 30) {
  // Left palm
  staticGeometry.push({ pos: [240, 0, z], size: [0.8, 14, 0.8], material: 'trunk' });
  staticGeometry.push({ pos: [240, 14, z], size: [9, 1.5, 9], material: 'foliage_light' });
  // Right palm
  staticGeometry.push({ pos: [290, 0, z], size: [0.8, 14, 0.8], material: 'trunk' });
  staticGeometry.push({ pos: [290, 14, z], size: [9, 1.5, 9], material: 'foliage_light' });
}

// ==========================================
// 5. ACCESSIBLE MULTI-STORY HOTEL (Vice Beach)
// Ocean Drive Hotel (X = 180, Z = 0)
// ==========================================
const hX = 180, hZ = 0;
const hW = 60, hD = 40;
const floorH = 4.0;
const wallT = 1.0;

for (let f = 0; f < 6; f++) {
  const yBase = f * floorH;
  
  // Floor Slabs
  if (f > 0) {
    // Leave a hole for the grand staircase in the center back
    staticGeometry.push({ pos: [hX + 15, yBase, hZ], size: [30, 0.4, hD], material: 'plaster_light', vaultable: true }); // Right half
    staticGeometry.push({ pos: [hX - 20, yBase, hZ - 10], size: [20, 0.4, 20], material: 'plaster_light', vaultable: true }); // Left front
    staticGeometry.push({ pos: [hX - 20, yBase, hZ + 15], size: [20, 0.4, 10], material: 'plaster_light', vaultable: true }); // Left back side
  }
  
  // Outer Walls with giant open balconies facing the ocean (East side)
  // West Wall (Back)
  staticGeometry.push({ pos: [hX - hW/2, yBase, hZ], size: [wallT, floorH, hD], material: 'fabric_red' });
  // North Wall
  staticGeometry.push({ pos: [hX, yBase, hZ - hD/2], size: [hW, floorH, wallT], material: 'fabric_red' });
  // South Wall
  staticGeometry.push({ pos: [hX, yBase, hZ + hD/2], size: [hW, floorH, wallT], material: 'fabric_red' });
  // East Wall (Balconies facing Ocean Drive - leaving gaps)
  staticGeometry.push({ pos: [hX + hW/2, yBase, hZ - 15], size: [wallT, floorH, 10], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX + hW/2, yBase, hZ + 15], size: [wallT, floorH, 10], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX + hW/2, yBase + 3, hZ], size: [wallT, 1.0, 20], material: 'fabric_red' }); // Lintel over balcony
  staticGeometry.push({ pos: [hX + hW/2, yBase + 0.5, hZ], size: [wallT, 1.0, 20], material: 'plaster_light', vaultable:true }); // Balcony railing
  
  // Grand Staircase (Stepped approach)
  // Going up from yBase to yBase + 4.0
  const steps = 9;
  const stRise = floorH / steps; // ~0.44m
  for (let s = 0; s < steps; s++) {
    staticGeometry.push({
      pos: [hX - 20, yBase + s * stRise, hZ + 5],
      size: [6, stRise, 6],
      material: 'concrete',
      vaultable: true
    });
  }
}

// Roof of Hotel
const roofY = 6 * floorH;
staticGeometry.push({ pos: [hX, roofY, hZ], size: [hW, 0.4, hD], material: 'plaster_light', vaultable: true });
// Roof Parapet
staticGeometry.push({ pos: [hX, roofY + 0.6, hZ - hD/2], size: [hW, 1.2, 0.5], material: 'fabric_red', vaultable: true });
staticGeometry.push({ pos: [hX, roofY + 0.6, hZ + hD/2], size: [hW, 1.2, 0.5], material: 'fabric_red', vaultable: true });
staticGeometry.push({ pos: [hX - hW/2, roofY + 0.6, hZ], size: [0.5, 1.2, hD], material: 'fabric_red', vaultable: true });
staticGeometry.push({ pos: [hX + hW/2, roofY + 0.6, hZ], size: [0.5, 1.2, hD], material: 'fabric_red', vaultable: true });


// ==========================================
// 6. CITY BLOCKS & SKYSCRAPERS (Mainland & Coast)
// ==========================================
const bMaterials = ['concrete', 'wall_white', 'sandstone', 'plaster_light', 'fabric_red', 'concrete_dark'];

// Generate Vice Beach Hotels (Ocean Drive line)
for(let z = -900; z <= 900; z += 90) {
  if (Math.abs(z) < 40) continue; // Skip the accessible hotel area
  const hW = randRange(30, 50);
  const hD = randRange(30, 60);
  const hH = randRange(20, 60); // 5 to 15 stories
  const mat = bMaterials[Math.floor(rand() * bMaterials.length)];
  
  staticGeometry.push({ pos: [170, 0, z], size: [hW, hH, hD], material: mat });
}

// Generate Downtown Skyscrapers
for (let i = 0; i < 200; i++) {
  const bx = randRange(-950, -250);
  const bz = randRange(-950, 950);
  
  // Keep off airport and main roads
  if (bx < -550 && bz > 300) continue; // Airport
  
  const w = randRange(20, 60);
  const d = randRange(20, 60);
  const h = randRange(30, 180); // Massive skyscrapers
  const mat = bMaterials[Math.floor(rand() * bMaterials.length)];
  
  staticGeometry.push({ pos: [bx, 0, bz], size: [w, h, d], material: mat });
  
  // Roof block
  if (rand() > 0.5) {
    staticGeometry.push({ pos: [bx, h, bz], size: [w*0.5, h*0.1, d*0.5], material: 'concrete_dark' });
  }
}

// ==========================================
// 7. URBAN COVER & PROPS
// ==========================================
// Scatter buses, containers, construction around the map for tactical cover
for (let i = 0; i < 250; i++) {
  const px = randRange(-950, 950);
  const pz = randRange(-950, 950);
  
  // Don't put props in the water
  if (px > 650 || (px > -150 && px < -50)) continue;
  
  const type = rand();
  if (type < 0.4) {
    // Abandoned Bus / Truck
    staticGeometry.push({ pos: [px, 0, pz], size: [3.2, 3.2, 12], material: 'caution_yellow', vaultable: true });
  } else if (type < 0.7) {
    // Shipping Containers
    staticGeometry.push({ pos: [px, 0, pz], size: [2.5, 2.6, 6], material: 'blue_tarp', vaultable: true });
    if (rand() > 0.5) staticGeometry.push({ pos: [px, 2.6, pz], size: [2.5, 2.6, 6], material: 'crate', vaultable: true });
  } else {
    // Concrete Barricade
    staticGeometry.push({ pos: [px, 0, pz], size: [5, 1.2, 1], material: 'concrete', vaultable: true });
  }
}

// ==========================================
// 8. SPAWNS & METADATA
// ==========================================
const viceMap = {
  id: "vice",
  name: "Vice City 2000x2000 (Afronta GTA 6)",
  size: [MAP_SIZE, MAP_SIZE],
  bounds: [-HALF + 10, HALF - 10, -HALF + 10, HALF - 10],
  floorMaterial: "grass",
  environment: {
    fogColor: "#e89982", // Retro synthwave / Miami sunset pastel orange/pink
    fogNear: 150,
    fogFar: 800 // Let them see far!
  },
  playerSpawns: [
    [hX - 25, 2, hZ],        // Ground floor of Ocean View Hotel
    [hX, 25, hZ],            // Roof of Ocean View Hotel!
    [270, 2, 0],             // On Ocean Drive
    [400, 2, 0],             // On the Beach
    [-150, 14, -300],        // On the North Bridge!
    [-550, 2, 0],            // Downtown
    [-700, 2, 600]           // Airport Runway
  ],
  botSpawns: [
    [hX, 6, hZ],             // Floor 2 of Hotel
    [hX, 10, hZ],            // Floor 3 of Hotel
    [hX, 18, hZ],            // Floor 5 of Hotel
    [270, 2, 150],           // Ocean Drive
    [270, 2, -150],          // Ocean Drive
    [450, 2, 200],           // Beach
    [450, 2, -200],          // Beach
    [-150, 14, 300],         // South Bridge
    [-400, 2, 100],          // Mainland
    [-400, 2, -100],         // Mainland
    [-700, 2, 700],          // Airport
    [-700, 2, 500]           // Airport
  ],
  staticGeometry
};

const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'vice.json');
fs.writeFileSync(outputPath, JSON.stringify(viceMap, null, 2));
console.log(`Vice City 2000x2000 map generated successfully at ${outputPath}! Total static items: ${staticGeometry.length}`);
