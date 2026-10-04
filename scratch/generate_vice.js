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
const WALL_HEIGHT = 80;

// Perimeter Boundary Walls (Keep players inside the 2000x2000 area)
staticGeometry.push({ pos: [0, 0, -HALF - WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'concrete_dark' });
staticGeometry.push({ pos: [0, 0, HALF + WALL_THICK/2], size: [MAP_SIZE + WALL_THICK*2, WALL_HEIGHT, WALL_THICK], material: 'concrete_dark' });
staticGeometry.push({ pos: [-HALF - WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'concrete_dark' });
staticGeometry.push({ pos: [HALF + WALL_THICK/2, 0, 0], size: [WALL_THICK, WALL_HEIGHT, MAP_SIZE], material: 'concrete_dark' });

// =========================================================================
// 1. TERRAIN & WATERWAYS (Seamless, clean slabs without floating geometry)
// =========================================================================
// Base ground is grass (Y = 0)
// Ocean (East: X = 650 to 1000)
staticGeometry.push({ pos: [825, 0.02, 0], size: [350, 0.04, MAP_SIZE], material: 'blue_tarp' });

// Washington Beach (East: X = 320 to 650)
staticGeometry.push({ pos: [485, 0.05, 0], size: [330, 0.1, MAP_SIZE], material: 'sand' });

// Ocean Drive Avenue (X = 250 to 310)
staticGeometry.push({ pos: [280, 0.08, 0], size: [60, 0.05, MAP_SIZE], material: 'concrete_dark' });

// Ocean Drive Sidewalks
staticGeometry.push({ pos: [240, 0.15, 0], size: [20, 0.15, MAP_SIZE], material: 'plaster_light', vaultable: true });
staticGeometry.push({ pos: [315, 0.15, 0], size: [10, 0.15, MAP_SIZE], material: 'plaster_light', vaultable: true });

// Intra-coastal River (X = -170 to -30)
staticGeometry.push({ pos: [-100, 0.02, 0], size: [140, 0.04, MAP_SIZE], material: 'blue_tarp' });

// Solid River Seawalls (low curb, easily vaultable/steppable)
staticGeometry.push({ pos: [-172, 0, 0], size: [4, 0.4, MAP_SIZE], material: 'concrete', vaultable: true });
staticGeometry.push({ pos: [-28, 0, 0], size: [4, 0.4, MAP_SIZE], material: 'concrete', vaultable: true });

// =========================================================================
// 2. STARFISH ISLAND & LUXURY VILLA (Accessible Island in the river!)
// =========================================================================
const islX = -100, islZ = 0;
// Island base slab
staticGeometry.push({ pos: [islX, 0.2, islZ], size: [100, 0.4, 160], material: 'grass', vaultable: true });

// Access bridge West (Mainland -> Island)
staticGeometry.push({ pos: [-160, 0.35, 0], size: [25, 0.3, 16], material: 'concrete_dark', vaultable: true });
// Access bridge East (Island -> Vice Beach)
staticGeometry.push({ pos: [-40, 0.35, 0], size: [25, 0.3, 16], material: 'concrete_dark', vaultable: true });

// Luxury Villa (Open plan, 2 floors)
const vX = -100, vZ = 0;
// Swimming pool on the lawn
staticGeometry.push({ pos: [vX + 25, 0.25, vZ], size: [18, 0.05, 30], material: 'blue_tarp' });
staticGeometry.push({ pos: [vX + 25, 0.2, vZ - 17], size: [22, 0.3, 4], material: 'sandstone', vaultable: true });
staticGeometry.push({ pos: [vX + 25, 0.2, vZ + 17], size: [22, 0.3, 4], material: 'sandstone', vaultable: true });

// Villa Floor 1 (Ground)
staticGeometry.push({ pos: [vX - 10, 0.3, vZ], size: [40, 0.2, 50], material: 'wall_white', vaultable: true });
// Villa Pillars (Open breezy ground floor)
staticGeometry.push({ pos: [vX - 28, 0.5, vZ - 23], size: [2, 3.5, 2], material: 'wall_white' });
staticGeometry.push({ pos: [vX - 28, 0.5, vZ + 23], size: [2, 3.5, 2], material: 'wall_white' });
staticGeometry.push({ pos: [vX + 8, 0.5, vZ - 23], size: [2, 3.5, 2], material: 'wall_white' });
staticGeometry.push({ pos: [vX + 8, 0.5, vZ + 23], size: [2, 3.5, 2], material: 'wall_white' });
// Villa Central Core / TV Lounge walls (open doors)
staticGeometry.push({ pos: [vX - 15, 0.5, vZ - 10], size: [10, 3.5, 1], material: 'wall_white' });
staticGeometry.push({ pos: [vX - 15, 0.5, vZ + 10], size: [10, 3.5, 1], material: 'wall_white' });
staticGeometry.push({ pos: [vX - 20, 0.5, vZ], size: [1, 3.5, 20], material: 'fabric_red' });

// Villa Floor 2 Slab
staticGeometry.push({ pos: [vX - 10, 4.0, vZ], size: [40, 0.4, 50], material: 'plaster_light', vaultable: true });
// Villa Roof
staticGeometry.push({ pos: [vX - 10, 7.8, vZ], size: [44, 0.4, 54], material: 'sandstone', vaultable: true });

// Villa Staircase (Smoothly walk from Floor 1 to Floor 2)
const vSteps = 9;
const vRise = 3.7 / vSteps; // ~0.41m
for (let s = 0; s < vSteps; s++) {
  staticGeometry.push({
    pos: [vX + 4, 0.3 + s * vRise, vZ - 15 + s * 1.2],
    size: [4.0, vRise, 1.25],
    material: 'concrete',
    vaultable: true
  });
}
// Villa Floor 2 Railing
staticGeometry.push({ pos: [vX - 10, 4.4, vZ - 24.8], size: [40, 1.0, 0.4], material: 'plaster_light', vaultable: true });
staticGeometry.push({ pos: [vX - 10, 4.4, vZ + 24.8], size: [40, 1.0, 0.4], material: 'plaster_light', vaultable: true });
staticGeometry.push({ pos: [vX + 9.8, 4.4, vZ], size: [0.4, 1.0, 50], material: 'plaster_light', vaultable: true });

// =========================================================================
// 3. FULLY WALKABLE BRIDGES (North & South - Seamless gentle ramps!)
// =========================================================================
function createSolidBridge(zCenter) {
  const bW = 32; // 32m wide bridge deck
  const deckY = 2.4; // 2.4m clearance over water
  
  // West Approach Ramp (Mainland: X = -210 to -170)
  const steps = 6;
  const sRise = deckY / steps; // 0.40m per step (perfect walk!)
  const sLen = 40 / steps;     // ~6.6m per step
  for (let s = 0; s < steps; s++) {
    staticGeometry.push({
      pos: [-210 + s * sLen + sLen/2, s * sRise, zCenter],
      size: [sLen + 0.1, sRise, bW],
      material: 'concrete_dark',
      vaultable: true
    });
  }
  
  // Main Flat Deck across the river (X = -170 to -30, length 140m)
  staticGeometry.push({
    pos: [-100, deckY, zCenter],
    size: [140, 0.6, bW],
    material: 'concrete_dark',
    vaultable: true
  });
  
  // East Approach Ramp (Beach Island: X = -30 to 10)
  for (let s = 0; s < steps; s++) {
    staticGeometry.push({
      pos: [-30 + s * sLen + sLen/2, deckY - (s + 1) * sRise, zCenter],
      size: [sLen + 0.1, sRise, bW],
      material: 'concrete_dark',
      vaultable: true
    });
  }
  
  // Bridge Guardrails (North & South side of bridge)
  staticGeometry.push({ pos: [-100, deckY + 0.6, zCenter - bW/2 + 0.4], size: [160, 1.1, 0.8], material: 'concrete', vaultable: true });
  staticGeometry.push({ pos: [-100, deckY + 0.6, zCenter + bW/2 - 0.4], size: [160, 1.1, 0.8], material: 'concrete', vaultable: true });
  
  // Massive Support Pillars (Down into water)
  staticGeometry.push({ pos: [-140, 0, zCenter], size: [6, deckY, bW - 4], material: 'concrete' });
  staticGeometry.push({ pos: [-100, 0, zCenter], size: [6, deckY, bW - 4], material: 'concrete' });
  staticGeometry.push({ pos: [-60, 0, zCenter], size: [6, deckY, bW - 4], material: 'concrete' });
}

createSolidBridge(-400); // North Bridge
createSolidBridge(400);  // South Bridge

// =========================================================================
// 4. THE OCEAN VIEW HOTEL (Fully open, accessible 5 stories + rooftop!)
// =========================================================================
const hX = 180, hZ = 0;
const hW = 46, hD = 34;
const floorH = 3.6;
const numFloors = 5;

for (let f = 0; f < numFloors; f++) {
  const yBase = f * floorH;
  
  // Floor Slabs (With clean cutout for stairwell at X = hX - 12, Z = hZ - 6 to hZ + 6)
  if (f > 0) {
    // East half of floor (Facing ocean)
    staticGeometry.push({ pos: [hX + 7, yBase, hZ], size: [32, 0.35, hD], material: 'plaster_light', vaultable: true });
    // West wing front
    staticGeometry.push({ pos: [hX - 16, yBase, hZ - 11], size: [14, 0.35, 12], material: 'plaster_light', vaultable: true });
    // West wing back
    staticGeometry.push({ pos: [hX - 16, yBase, hZ + 11], size: [14, 0.35, 12], material: 'plaster_light', vaultable: true });
  } else {
    // Ground floor foundation slab
    staticGeometry.push({ pos: [hX, 0.05, hZ], size: [hW + 6, 0.2, hD + 6], material: 'concrete', vaultable: true });
  }

  // --- WALLS WITH WIDE OPEN ENTRANCES / DOORS ---
  // East Facade (Ocean Drive front):
  if (f === 0) {
    // Ground floor has a HUGE 18-meter wide open main lobby entrance!
    staticGeometry.push({ pos: [hX + hW/2, yBase, hZ - 12], size: [1.0, floorH, 10], material: 'fabric_red' });
    staticGeometry.push({ pos: [hX + hW/2, yBase, hZ + 12], size: [1.0, floorH, 10], material: 'fabric_red' });
    // Entrance header above door
    staticGeometry.push({ pos: [hX + hW/2, yBase + 2.8, hZ], size: [1.0, floorH - 2.8, 14], material: 'fabric_red' });
    // Steps leading down to sidewalk
    staticGeometry.push({ pos: [hX + hW/2 + 2, 0.05, hZ], size: [4, 0.2, 16], material: 'plaster_light', vaultable: true });
  } else {
    // Upper floors: Balconies with open archway (walk out onto balcony!)
    staticGeometry.push({ pos: [hX + hW/2, yBase, hZ - 12], size: [1.0, floorH, 10], material: 'fabric_red' });
    staticGeometry.push({ pos: [hX + hW/2, yBase, hZ + 12], size: [1.0, floorH, 10], material: 'fabric_red' });
    staticGeometry.push({ pos: [hX + hW/2, yBase + 2.6, hZ], size: [1.0, floorH - 2.6, 14], material: 'fabric_red' });
    // Balcony slab jutting out 2.5m toward the ocean
    staticGeometry.push({ pos: [hX + hW/2 + 1.25, yBase, hZ], size: [2.5, 0.35, 14], material: 'plaster_light', vaultable: true });
    // Balcony railing
    staticGeometry.push({ pos: [hX + hW/2 + 2.4, yBase + 0.35, hZ], size: [0.3, 1.0, 14], material: 'wall_white', vaultable: true });
    staticGeometry.push({ pos: [hX + hW/2 + 1.25, yBase + 0.35, hZ - 6.8], size: [2.3, 1.0, 0.3], material: 'wall_white', vaultable: true });
    staticGeometry.push({ pos: [hX + hW/2 + 1.25, yBase + 0.35, hZ + 6.8], size: [2.3, 1.0, 0.3], material: 'wall_white', vaultable: true });
  }

  // West Facade (Back): Open central double door
  staticGeometry.push({ pos: [hX - hW/2, yBase, hZ - 11], size: [1.0, floorH, 12], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX - hW/2, yBase, hZ + 11], size: [1.0, floorH, 12], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX - hW/2, yBase + 2.5, hZ], size: [1.0, floorH - 2.5, 10], material: 'fabric_red' });

  // North Facade: Large window / opening
  staticGeometry.push({ pos: [hX - 14, yBase, hZ - hD/2], size: [18, floorH, 1.0], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX + 14, yBase, hZ - hD/2], size: [18, floorH, 1.0], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX, yBase + 2.4, hZ - hD/2], size: [10, floorH - 2.4, 1.0], material: 'fabric_red' });

  // South Facade: Large window / opening
  staticGeometry.push({ pos: [hX - 14, yBase, hZ + hD/2], size: [18, floorH, 1.0], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX + 14, yBase, hZ + hD/2], size: [18, floorH, 1.0], material: 'fabric_red' });
  staticGeometry.push({ pos: [hX, yBase + 2.4, hZ + hD/2], size: [10, floorH - 2.4, 1.0], material: 'fabric_red' });

  // Interior Columns
  staticGeometry.push({ pos: [hX, yBase, hZ - 8], size: [1.4, floorH, 1.4], material: 'plaster_light' });
  staticGeometry.push({ pos: [hX, yBase, hZ + 8], size: [1.4, floorH, 1.4], material: 'plaster_light' });

  // --- SEAMLESS STAIRWELL (Walk directly up floor to floor!) ---
  const stepsPerFloor = 9;
  const sRise = floorH / stepsPerFloor; // 0.40m per step!
  const stairX = hX - 15;
  const startZ = hZ - 5;
  const sRun = 1.1; // 1.1m long step along Z

  for (let s = 0; s < stepsPerFloor; s++) {
    staticGeometry.push({
      pos: [stairX, yBase + s * sRise, startZ + s * sRun],
      size: [3.8, sRise, sRun + 0.05],
      material: 'concrete',
      vaultable: true
    });
  }
}

// Rooftop Terrace (At top of 5th floor)
const roofY = numFloors * floorH; // 18.0m
staticGeometry.push({ pos: [hX, roofY, hZ], size: [hW, 0.4, hD], material: 'plaster_light', vaultable: true });

// Rooftop Parapet (1.1m high, cover for snipers)
staticGeometry.push({ pos: [hX, roofY + 0.4, hZ - hD/2], size: [hW, 1.1, 0.6], material: 'fabric_red', vaultable: true });
staticGeometry.push({ pos: [hX, roofY + 0.4, hZ + hD/2], size: [hW, 1.1, 0.6], material: 'fabric_red', vaultable: true });
staticGeometry.push({ pos: [hX - hW/2, roofY + 0.4, hZ], size: [0.6, 1.1, hD], material: 'fabric_red', vaultable: true });
staticGeometry.push({ pos: [hX + hW/2, roofY + 0.4, hZ], size: [0.6, 1.1, hD], material: 'fabric_red', vaultable: true });

// Rooftop Stair Penthouse (Doorway out to roof!)
staticGeometry.push({ pos: [hX - 15, roofY + 0.4, hZ - 7], size: [6, 2.6, 1], material: 'concrete' });
staticGeometry.push({ pos: [hX - 15, roofY + 0.4, hZ + 7], size: [6, 2.6, 1], material: 'concrete' });
staticGeometry.push({ pos: [hX - 18, roofY + 0.4, hZ], size: [1, 2.6, 14], material: 'concrete' });
staticGeometry.push({ pos: [hX - 15, roofY + 3.0, hZ], size: [7, 0.3, 15], material: 'concrete_dark' });

// Rooftop Bar & Sunbed Covers
staticGeometry.push({ pos: [hX + 10, roofY + 0.4, hZ - 6], size: [4, 1.0, 8], material: 'sandstone', vaultable: true });
staticGeometry.push({ pos: [hX + 10, roofY + 0.4, hZ + 6], size: [3, 1.2, 3], material: 'crate', vaultable: true });

// =========================================================================
// 5. ACCESSIBLE MULTI-STORY DOWNTOWN PARKING GARAGE (X = -360, Z = 0)
// =========================================================================
const gX = -360, gZ = 0;
const gW = 60, gD = 50;
const gFloorH = 4.2;

for (let gf = 0; gf < 3; gf++) {
  const gyBase = gf * gFloorH;
  
  // Floor Slab
  if (gf > 0) {
    // Cutout for the ramp along North side
    staticGeometry.push({ pos: [gX, gyBase, gZ + 6], size: [gW, 0.4, gD - 12], material: 'concrete', vaultable: true });
  } else {
    staticGeometry.push({ pos: [gX, 0.05, gZ], size: [gW, 0.2, gD], material: 'concrete', vaultable: true });
  }
  
  // Open Industrial Pillars
  for (let px = -22; px <= 22; px += 22) {
    for (let pz = -18; pz <= 18; pz += 18) {
      staticGeometry.push({ pos: [gX + px, gyBase, gZ + pz], size: [2.0, gFloorH, 2.0], material: 'steel_girder' });
    }
  }
  
  // Low Outer Crash Barriers (1.0m, vaultable)
  if (gf > 0) {
    staticGeometry.push({ pos: [gX, gyBase + 0.4, gZ + gD/2 - 0.4], size: [gW, 1.0, 0.8], material: 'caution_yellow', vaultable: true });
    staticGeometry.push({ pos: [gX - gW/2 + 0.4, gyBase + 0.4, gZ], size: [0.8, 1.0, gD], material: 'caution_yellow', vaultable: true });
    staticGeometry.push({ pos: [gX + gW/2 - 0.4, gyBase + 0.4, gZ], size: [0.8, 1.0, gD], material: 'caution_yellow', vaultable: true });
  }
  
  // Walkable / Drivable Ramps to next floor!
  if (gf < 2) {
    const rSteps = 10;
    const rRise = gFloorH / rSteps; // ~0.42m
    const rRun = 3.5;
    for (let rs = 0; rs < rSteps; rs++) {
      staticGeometry.push({
        pos: [gX - 18 + rs * rRun, gyBase + rs * rRise, gZ - gD/2 + 6],
        size: [rRun + 0.1, rRise, 10],
        material: 'concrete_dark',
        vaultable: true
      });
    }
  }
}

// =========================================================================
// 6. ESCOBAR AIRPORT & OPEN HANGAR (Southwest: X = -700, Z = 600)
// =========================================================================
// Runway
staticGeometry.push({ pos: [-700, 0.08, 600], size: [160, 0.05, 600], material: 'concrete_dark' });
staticGeometry.push({ pos: [-700, 0.1, 600], size: [4, 0.06, 540], material: 'wall_white' });

// Giant Open Airplane Hangar (Walk right inside for shelter!)
const hngX = -580, hngZ = 600;
const hngW = 50, hngD = 60, hngH = 14;
// Side Walls
staticGeometry.push({ pos: [hngX - hngW/2, 0, hngZ], size: [1.2, hngH, hngD], material: 'scaffold' });
staticGeometry.push({ pos: [hngX + hngW/2, 0, hngZ], size: [1.2, hngH, hngD], material: 'scaffold' });
// Roof
staticGeometry.push({ pos: [hngX, hngH, hngZ], size: [hngW + 2, 0.8, hngD], material: 'scaffold', vaultable: true });
// Crates and tool boxes inside hangar for tactical cover
staticGeometry.push({ pos: [hngX - 15, 0, hngZ - 10], size: [4, 2.5, 4], material: 'crate', vaultable: true });
staticGeometry.push({ pos: [hngX + 15, 0, hngZ + 12], size: [3, 2.2, 8], material: 'metal_barrel', vaultable: true });

// =========================================================================
// 7. BEACH LIFEGUARD TOWERS & BOARDWALKS (Washington Beach)
// =========================================================================
for (let bz = -700; bz <= 700; bz += 350) {
  const lgX = 420;
  // 4 Stilts
  staticGeometry.push({ pos: [lgX - 2.5, 0, bz - 2.5], size: [0.5, 3.2, 0.5], material: 'wood' });
  staticGeometry.push({ pos: [lgX + 2.5, 0, bz - 2.5], size: [0.5, 3.2, 0.5], material: 'wood' });
  staticGeometry.push({ pos: [lgX - 2.5, 0, bz + 2.5], size: [0.5, 3.2, 0.5], material: 'wood' });
  staticGeometry.push({ pos: [lgX + 2.5, 0, bz + 2.5], size: [0.5, 3.2, 0.5], material: 'wood' });
  // Tower Platform
  staticGeometry.push({ pos: [lgX, 3.2, bz], size: [8, 0.3, 8], material: 'wood', vaultable: true });
  // Little Hut
  staticGeometry.push({ pos: [lgX, 3.5, bz], size: [5, 2.5, 5], material: 'plaster_light' });
  // Roof
  staticGeometry.push({ pos: [lgX, 6.0, bz], size: [6.5, 0.4, 6.5], material: 'fabric_red' });
  // Access Steps from sand
  const lgSteps = 8;
  const lgRise = 3.2 / lgSteps; // 0.40m
  for (let ls = 0; ls < lgSteps; ls++) {
    staticGeometry.push({
      pos: [lgX - 5 - ls * 0.9, ls * lgRise, bz],
      size: [0.95, lgRise, 2.5],
      material: 'wood',
      vaultable: true
    });
  }
}

// =========================================================================
// 8. PALM TREES (Neatly aligned along Ocean Drive sidewalk - no clipping!)
// =========================================================================
for (let pz = -920; pz <= 920; pz += 40) {
  // East sidewalk palm line
  staticGeometry.push({ pos: [315, 0.15, pz], size: [0.6, 7.5, 0.6], material: 'trunk' });
  staticGeometry.push({ pos: [315, 7.6, pz], size: [4.5, 1.2, 4.5], material: 'foliage_light' });
  
  // West sidewalk palm line
  staticGeometry.push({ pos: [245, 0.15, pz], size: [0.6, 7.5, 0.6], material: 'trunk' });
  staticGeometry.push({ pos: [245, 7.6, pz], size: [4.5, 1.2, 4.5], material: 'foliage_light' });
}

// =========================================================================
// 9. DOWNTOWN GRID & SKYSCRAPERS (Organized clean city blocks)
// =========================================================================
const cityMats = ['concrete', 'concrete_dark', 'wall_white', 'sandstone', 'plaster_light', 'fabric_red'];

// City block intervals (Avoiding parking garage, roads, airport, river)
const xBlocks = [-900, -780, -660, -520, -260];
const zBlocks = [-850, -650, -450, -250, 150, 350, 550, 750];

for (const bx of xBlocks) {
  for (const bz of zBlocks) {
    // Leave airport runway clear
    if (bx <= -660 && bz >= 300) continue;
    // Leave bridges and garage clear
    if (Math.abs(bz - (-400)) < 40 || Math.abs(bz - 400) < 40) continue;
    if (Math.abs(bx - gX) < 50 && Math.abs(bz - gZ) < 40) continue;

    const bW = randRange(35, 65);
    const bD = randRange(35, 65);
    const bH = randRange(30, 140); // Impressive skyline
    const mat = cityMats[Math.floor(rand() * cityMats.length)];

    // Solid skyscraper tower
    staticGeometry.push({
      pos: [bx, 0, bz],
      size: [bW, bH, bD],
      material: mat
    });

    // Decorative stepped rooftop crown
    if (bH > 60) {
      staticGeometry.push({
        pos: [bx, bH, bz],
        size: [bW * 0.6, 10, bD * 0.6],
        material: 'concrete_dark'
      });
      staticGeometry.push({
        pos: [bx, bH + 10, bz],
        size: [bW * 0.3, 12, bD * 0.3],
        material: 'steel_girder'
      });
    }
  }
}

// Ocean Drive Coastal Hotels (Lined up neatly behind the west sidewalk)
for (let oz = -900; oz <= 900; oz += 80) {
  // Skip the Ocean View Hotel zone!
  if (Math.abs(oz - hZ) < 50) continue;

  const oW = randRange(35, 45);
  const oD = randRange(40, 60);
  const oH = randRange(25, 60);
  const mat = cityMats[Math.floor(rand() * cityMats.length)];

  staticGeometry.push({
    pos: [170, 0, oz],
    size: [oW, oH, oD],
    material: mat
  });
  
  // Neon canopy / overhang over the sidewalk
  staticGeometry.push({
    pos: [205, 3.5, oz],
    size: [12, 0.4, oD * 0.7],
    material: 'fabric_red',
    vaultable: true
  });
}

// =========================================================================
// 10. TACTICAL STREET COVER & VEHICLES (Cleanly placed, no clipping)
// =========================================================================
// Parked blocky sedans and sports cars along Ocean Drive curbs
for (let cz = -860; cz <= 860; cz += 70) {
  if (Math.abs(cz) < 30) continue;
  staticGeometry.push({ pos: [255, 0.1, cz], size: [2.6, 1.4, 5.0], material: 'caution_yellow', vaultable: true });
  staticGeometry.push({ pos: [305, 0.1, cz + 30], size: [2.6, 1.4, 5.0], material: 'fabric_red', vaultable: true });
}

// Concrete planters with small shrubs along sidewalks
for (let pz = -880; pz <= 880; pz += 60) {
  staticGeometry.push({ pos: [233, 0.15, pz], size: [2.0, 0.8, 2.0], material: 'concrete', vaultable: true });
  staticGeometry.push({ pos: [233, 0.95, pz], size: [1.6, 1.2, 1.6], material: 'foliage', vaultable: true });
}

// =========================================================================
// 11. MAP METADATA & 100% ACCESSIBLE OPEN SPAWNS
// =========================================================================
const viceMap = {
  id: "vice",
  name: "Vice City 2000x2000 (Afronta GTA 6)",
  size: [MAP_SIZE, MAP_SIZE],
  bounds: [-HALF + 20, HALF - 20, -HALF + 20, HALF - 20],
  floorMaterial: "grass",
  environment: {
    fogColor: "#f39c7a", // Retro Miami sunset pastel neon
    fogNear: 160,
    fogFar: 850
  },
  playerSpawns: [
    [hX + 32, 1.0, 0],         // On the grand Ocean Drive entrance steps of Ocean View Hotel
    [hX, 1.0, 0],              // Inside the breezy open hotel lobby
    [hX, roofY + 1.0, 0],      // On the hotel rooftop terrace overlooking the beach!
    [280, 1.0, 0],             // Right on Ocean Drive avenue
    [400, 1.0, 0],             // Out on Washington Beach sand
    [islX, 1.0, 0],            // On Starfish Island next to the luxury villa
    [-100, 3.5, -400],         // On the North Bridge deck
    [gX, 9.0, 0],              // On the Downtown Parking Garage Rooftop
    [-700, 1.0, 600]           // Escobar Airport runway
  ],
  botSpawns: [
    [hX + 10, 4.2, 0],         // Hotel Floor 2 Balcony
    [hX + 10, 7.8, 0],         // Hotel Floor 3 Balcony
    [hX + 10, 11.4, 0],        // Hotel Floor 4 Balcony
    [hX, roofY + 1.0, 10],     // Hotel Rooftop
    [280, 1.0, 80],            // Ocean Drive
    [280, 1.0, -80],           // Ocean Drive
    [420, 1.0, 100],           // Beach
    [420, 1.0, -100],          // Beach
    [islX + 20, 1.0, 10],      // Starfish Island
    [-100, 3.5, 400],          // South Bridge deck
    [gX, 4.8, 10],             // Parking Garage Floor 2
    [gX, 9.0, -10],            // Parking Garage Roof
    [hngX, 1.0, hngZ],         // Inside the Airport Hangar
    [-520, 1.0, 0],            // Downtown Avenue
    [-700, 1.0, 500]           // Airport
  ],
  staticGeometry
};

const outputPath = path.join(__dirname, '..', 'assets', 'maps', 'vice.json');
fs.writeFileSync(outputPath, JSON.stringify(viceMap, null, 2));
console.log(`Pristine Vice City 2000x2000 map generated! Static items: ${staticGeometry.length}`);
