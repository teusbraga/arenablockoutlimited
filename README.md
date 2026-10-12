# 🔫 Arena Blockout

> **Browser-native tactical FPS with ballistic simulation, procedural weapons, and AI opponents — zero install required.**

[![Tests](https://img.shields.io/badge/tests-13%20suites-green)]()
[![Three.js](https://img.shields.io/badge/three.js-0.186%2B-blue)]()
[![PWA](https://img.shields.io/badge/PWA-installable-blueviolet)]()
[![Platform](https://img.shields.io/badge/platform-web%20%7C%20mobile-lightgrey)]()
[![License](https://img.shields.io/badge/license-MIT-orange)]()

A single-player FPS built entirely on **Three.js + Web APIs** — no Unity, no Unreal, no external physics engine, no audio files, no 3D model files. Every weapon mesh is constructed procedurally. Every texture is generated on a 2D canvas. Every sound is synthesized via Web Audio API.

---

## 📸 What You're Building

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [ CS Italy-inspired map — cobblestones, archways ]    │
│                                                         │
│   [HK416 viewmodel] ─── [PIP scope on VSS Vintorez]     │
│                                                         │
│   Bots with 4-state FSM patrol the streets             │
│   Ricochet, wallbang, suppression effects active        │
│   Procedural PBR textures, triplanar world UV          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Platform:** Browser (Chrome, Firefox, Edge, Safari) + PWA installable  
**Controls:** Mouse + keyboard (desktop) | Virtual joystick + touch (mobile)  
**Mode:** Solo PvE — timed rounds against AI bots

---

## ✨ Feature Set

### 🗺️ World
- JSON-defined maps with static geometry, props, and spawn points
- Instanced rendering (one draw call per material)
- Triplanar world-space UV shader — no texture stretching on any box shape
- 100% procedural PBR textures (Canvas 2D, no image files)
- Interactive doors with dynamic AABB collision
- Loot drop system with floating animation and category-color halo
- Multi-biome prop library: CS Italy · Village · Desert · Jungle

### 🔫 Weapons (9 guns)
| Gun | Type | Unique Feature |
|---|---|---|
| AK-47 | Assault Rifle | Banana mag (5-segment trigonometric arc), right-pull spray |
| HK416 | Assault Carbine | Monolithic quad-rail, hooded front sight, linear-left spray |
| M249 SAW | Light Machine Gun | 100-round ammo box, 6-bullet articulated belt, bipod |
| P-9 | Pistol | Animated slide blowback, slide-lock on empty |
| Rifle Prototype | Assault Carbine | Red dot PIP-ready optic, animated left-side charging handle |
| S&W 500 Magnum | Heavy Revolver | Indexable 6-chamber cylinder, dramatic 1.1s recoil curve |
| UZI | Submachine Gun | Folding stock, wide oscillating spray pattern |
| VSS Vintorez | Suppressed DMR | 0.54m integral suppressor, PSO-1 Soviet scope with PIP |
| Winchester M12 | Pump Shotgun | 5-state pump FSM, corncob forend, 7 pellets |

### 🤖 AI Bots
- **4-State FSM:** Patrol → Engage → Search → Flee
- Throttled LOS raycast (~10Hz, zero framerate impact)
- Tactical strafing + lean peek in Engage state
- Burst fire for automatic weapons
- Ballistic suppression system affecting accuracy and state transitions
- Sound-reactive: transitions to Search on hearing gunfire within 35m

### 🎯 Ballistics
- **CCD (Continuous Collision Detection)** — bullets can't tunnel through thin walls
- **Wallbang penetration** — material resistance per surface type (wood, concrete, metal)
- **Angular ricochet** — shallow-angle deflections on hard surfaces
- **Tactical suppression** — near-miss bullets cause camera flinch and tunnel vision
- **Decoupled tracers** — visually correct at any mouse speed, zero "banana whip" artifacts
- **Bullet drop** — gravity affects trajectory over distance

### 🎨 Visual Effects (Object Pooled, Zero Runtime Allocations)
- Tracers: `swipe` (CS2-style) · `photographic` · `laser`
- Shell casings with physics: brass rifle + red 12-gauge
- Blood voxels: GPU instanced InstancedMesh, 6-tone palette, ballistic arcs
- Muzzle smoke: discharge cone + barrel heat residual
- Smoke grenade: 14 procedural puffs, 4.2m radius, 10s duration

### 🔊 Audio (100% Procedural Web Audio Synthesis)
- Unique synthesizer per weapon (noise buffers + exponential frequency sweeps)
- Dynamic footstep audio by surface material (wood, metal, sand, concrete)
- 3D HRTF spatial audio with distance rolloff
- **Wall occlusion** — sounds behind cover get low-pass filtered (13kHz → 550Hz)

### 📱 Mobile
- Dynamic floating analog joystick (left half of screen)
- Camera look touchpad (right half of screen)
- 3 fire button positions, ADS toggle, crouch, reload, smoke, interact
- Auto-sprint at >75% joystick travel
- PWA installable — landscape locked

---

## 🛠️ Tech Stack

```
Renderer:       Three.js 0.186+ (WebGL)
Language:       JavaScript ES Modules (no transpiler needed)
Physics:        Custom AABB + Spatial Hash Grid (vanilla JS)
Audio:          Web Audio API (procedural synthesis)
Textures:       HTML5 Canvas 2D API (procedural generation)
Networking:     None — single-player offline
PWA:            Web App Manifest + Service Worker
Tests:          Node.js test runner (headless, 13 suites)
Runtime dep:    three@^0.186.1 (only production dependency)
```

**What we deliberately avoid:**
- ❌ External physics engine (Cannon.js, Rapier, Ammo.js)
- ❌ External 3D model files (.gltf, .obj, .fbx)
- ❌ External audio files (.mp3, .ogg)
- ❌ External texture files (.png, .jpg)
- ❌ UI framework (React, Vue, Angular)
- ❌ Build tools / bundlers (runs directly in browser via import maps)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for tests only)
- A modern browser (Chrome 90+, Firefox 88+, Safari 15+)

### Running Locally
```bash
# Clone the repo
git clone https://github.com/your-org/arena-blockout.git
cd arena-blockout

# No build step! Just serve the files statically
npx serve .
# or
python -m http.server 8080
# or use VS Code Live Server

# Open http://localhost:8080
```

### Running Tests
```bash
npm install   # installs three.js for headless tests
npm test      # runs all 13 headless simulation suites
```

---

## 📁 Project Structure

```
/
├── index.html               # SPA shell: HUD DOM, menus, mobile controls, import map
├── manifest.json            # PWA manifest (landscape, standalone, icons)
├── sw.js                    # Service Worker: Network-First cache strategy
├── package.json             # "type":"module", deps: three only
│
├── assets/
│   ├── maps/italy.json      # CS Italy map definition
│   ├── weapons/
│   │   ├── weapons.json     # All 9 weapons: stats, spatial vectors, ballistics
│   │   └── ammo.json        # 9 calibers: velocity, drop, penetration, tracer style
│   └── configs/
│       ├── gameplay.json    # Player, camera, physics tuning
│       ├── bots.json        # AI difficulty and count
│       └── audio.json       # Audio synthesis parameters
│
├── src/
│   ├── main.js              # Async boot sequence + game loop registration
│   ├── core/                # Engine, EventBus, Config, Input, Camera
│   ├── world/               # MapLoader, MaterialFactory, TextureGenerator, Props
│   ├── physics/             # CollisionWorld (AABB + Spatial Hash + Raycast)
│   ├── entities/            # Character (base), Player, Bot
│   ├── ai/                  # AIController + FSM states (Patrol/Engage/Search/Flee)
│   ├── view/                # CharacterView (3D model + procedural animation)
│   ├── weapons/             # WeaponSystem, Ballistics, Viewmodel, Scope, Smoke
│   │   └── models/          # 9 procedural weapon models (AK47, HK416, M249, ...)
│   ├── fx/                  # Effects (tracer pools, sparks, casings, blood voxels)
│   ├── audio/               # AudioSystem (Web Audio procedural synthesis)
│   ├── ui/                  # HUD, CrosshairManager, MenuController, LoadingScreen
│   └── new_mechanics/       # AimAssist, BarrelAlignment, TacticalInventory
│
└── test/                    # 13 headless test suites
```

---

## 🗺️ Adding a New Map

Create `assets/maps/yourmap.json`:

```json
{
  "name": "Your Map Name",
  "size": [64, 64],
  "bounds": [-30, 30, -30, 30],
  "floorMaterial": "cobblestones",
  "environment": {
    "fogColor": "#d6be9c",
    "fogNear": 48,
    "fogFar": 120
  },
  "staticGeometry": [
    {
      "pos": [0, 0, 0], "size": [60, 0.2, 60],
      "material": "cobblestones"
    },
    {
      "pos": [-29, 2, 0], "size": [1, 4, 60],
      "material": "stone"
    }
  ],
  "props": [
    { "type": "market_stall", "pos": [5, 0, 3], "rot": 0 }
  ],
  "doors": [
    { "pos": [-4, 0, 8], "width": 1.2, "height": 2.4, "rot": 0 }
  ],
  "playerSpawns": [[0, 0.1, -20]],
  "botSpawns": [[0, 0.1, 10], [5, 0.1, 15], [-5, 0.1, 15]]
}
```

---

## 🔫 Adding a New Weapon

**Step 1:** Add entry to `assets/weapons/weapons.json`:
```json
{
  "id": "mp5",
  "name": "MP5",
  "caliber": "9mm_para",
  "auto": true,
  "fireModes": ["auto", "semi"],
  "weight": 2.5,
  "fireInterval": 0.075,
  "magSize": 30,
  "reloadTime": 2.2,
  "muzzleLocal": [0, 0.012, -0.25],
  "sightLocal": [0, 0.058, -0.18],
  "ejectLocal": [0.02, 0.022, -0.02],
  "hipPos": [0.12, -0.13, -0.27],
  "adsRot": [0, 0, 0],
  "sprintPos": [0.20, -0.23, -0.30],
  "sprintRot": [0.55, -0.40, 0.16],
  "adsSightDistance": 0.38,
  "recoilPitch": 0.016,
  "recoilYaw": 0.006,
  "recoilYawBias": 0.0,
  "spreadHip": 0.030,
  "spreadAds": 0.008,
  "kickbackZ": 0.006,
  "ballistics": {
    "internal": {},
    "external": {},
    "terminal": {}
  }
}
```

**Step 2:** Create `src/weapons/models/MP5.js`:
```javascript
import * as THREE from 'three';

export function buildMP5() {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, metalness: 0.85, roughness: 0.30
  });

  // Receiver
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.038, 0.050, 0.20),
    steelMat
  );
  group.add(receiver);

  // Barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.18, 8),
    steelMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.008, -0.19);
  group.add(barrel);

  // ... (add grip, stock, magazine, sights)

  return group;
}
```

**Step 3:** Register in `src/main.js`:
```javascript
import { buildMP5 } from './weapons/models/MP5.js';
// Add to weapon model builder registry
weaponBuilders['mp5'] = buildMP5;
```

---

## 🎮 Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | WASD | Left joystick |
| Look | Mouse | Right touchpad |
| Fire | Left Mouse Button | Fire button (right) |
| ADS (Aim Down Sight) | Right Mouse Button | ADS toggle button |
| Reload | R | Reload button |
| Crouch | Ctrl / C | Crouch toggle |
| Sprint | Shift | Auto at >75% joystick |
| Lean Left / Right | Q / E | — |
| Switch Weapon | 1, 2, Scroll, Tab | Weapon button |
| Throw Smoke | G | Smoke button |
| Interact | F | Interact button |
| Toggle Perspective | V | — |
| Inventory | I | Inventory button |
| Pause / Menu | Esc | Pause button |

---

## 🏗️ Architecture Overview

### Dual-Rate Game Loop
```
requestAnimationFrame
  └─ Engine.frame(nowMs)
       ├─ fixedUpdate × N  (1/120s steps, physics deterministic)
       │    ├─ Player.update(dt, input)
       │    ├─ Bot[i].update(dt, player)
       │    ├─ WeaponSystem.fixedUpdate(dt)
       │    ├─ ProjectileManager.tick(dt)
       │    └─ GameManager.update(dt)
       └─ renderUpdate(alpha, dt)  (variable rate)
            ├─ CameraRig.update(dt) + applyToCamera()
            ├─ Viewmodel.update(alpha, dt)
            ├─ BarrelCrosshairAlignment.update()
            ├─ ScopeSystem.render(renderer)
            └─ HUD.update()
```

### EventBus — Decoupled Communication
All systems communicate through a central pub/sub bus:
```javascript
// Emit
EventBus.emit('weapon:fired', { weapon, muzzleWorld, forward });

// Subscribe
EventBus.on('weapon:fired', ({ muzzleWorld }) => {
  effects.spawnMuzzleFlash(muzzleWorld);
  audio.playWeaponSound(weapon.id);
  scene.ambientLight.intensity = 0.8; // brief flash
});
```

### Collision World (Pure AABB, No Three.js dependency)
```javascript
const world = new CollisionWorld(cellSize=4.0);

// Add static geometry
world.addBox(cx, cy, cz, sx, sy, sz, { material: 'cobblestones' });

// Move entity with slide response
const res = world.moveAndSlide(entity.pos, entity.size, delta);
// res: { onGround, hitCeiling, groundMaterial }

// Raycast (Slab Method)
const hit = world.raycast(origin, direction, maxDistance);
// hit: { box, distance, exitDistance, thickness, normal, point }
```

---

## 🧪 Testing

The project uses **headless Node.js tests** — no browser or DOM required for physics, ballistics, and AI:

```bash
npm test
```

| Suite | What It Tests |
|---|---|
| `headless_sim.js` | Full simulation tick without renderer |
| `ballistics_test.js` | Spread, recoil, sway math |
| `projectile_test.js` | CCD projectile movement |
| `penetration_ricochet_test.js` | Wallbang and ricochet physics |
| `italy_map_test.js` | Map parsing and collision registration |
| `phase14_accessibility_test.js` | A11y: keyboard nav, ARIA, contrast |
| `loading_system_test.js` | Asset loading pipeline |
| `audio_spatial_occlusion_test.js` | Spatial audio + wall occlusion |
| `tracer_test.js` | Tracer profile validation |
| `tracer_flash_profile_test.js` | Flash profile parameters |
| `third_person_test.js` | Camera spring-arm collision |
| `woods_texture_test.js` | Procedural texture generation |
| `crosshair_manager.test.js` | Crosshair config + rendering |

---

## 📋 Implementation Roadmap

### Phase 1 — Foundation
- [ ] `EventBus.js` — pub/sub messaging
- [ ] `ConfigLoader.js` — data-driven JSON config with fallbacks
- [ ] `Engine.js` — fixed-timestep accumulator loop
- [ ] `SceneSetup.js` — Three.js renderer + lighting
- [ ] `CollisionWorld.js` — AABB + Spatial Hash + Raycast

### Phase 2 — World
- [ ] `TextureGenerator.js` — procedural PBR textures (noise, fBm)
- [ ] `MaterialFactory.js` — lazy PBR catalog + triplanar shader
- [ ] `MapLoader.js` — JSON → InstancedMesh + CollisionWorld
- [ ] `Door.js` — dynamic AABB door
- [ ] `ItalyProps.js` — composite prop factory

### Phase 3 — Player
- [ ] `Character.js` — base entity physics
- [ ] `CameraRig.js` — spring camera + recoil layers
- [ ] `Input.js` + `TouchInput.js` — unified input
- [ ] `Player.js` — movement, crouch, lean, sprint

### Phase 4 — Weapons Core
- [ ] `WeaponDefs.js` — JSON compiler
- [ ] `BallisticsCalculator.js` — pure math (spread, recoil, sway)
- [ ] `ProjectileManager.js` — CCD simulation, penetration, ricochet, suppression
- [ ] `WeaponSystem.js` — inventory, fire loop, wall compression

### Phase 5 — Weapon Models
- [ ] `Viewmodel.js` — spring rig + pose blending
- [ ] 9 procedural weapon models (AK47 → Winchester M12)
- [ ] `ScopeSystem.js` — PIP render target + GLSL lens shader

### Phase 6 — AI
- [ ] `AIController.js` — throttled LOS, audio response, suppression
- [ ] FSM states: PatrolState, EngageState, SearchState, FleeState
- [ ] `CharacterView.js` — soldier/ghost models + torso twist animation
- [ ] `Bot.js` — entity bridge
- [ ] Spawn system in `GameManager.js`

### Phase 7 — FX & Audio
- [ ] `Effects.js` — tracer pools, sparks, casings, blood voxels, smoke
- [ ] `AudioSystem.js` — Web Audio synthesis per weapon + spatial HRTF + occlusion

### Phase 8 — UI
- [ ] `HUD.js` — health, ammo, damage indicator canvas, killfeed
- [ ] `CrosshairManager.js` — 3-axis CS2-style crosshair
- [ ] `MenuController.js` — settings, loadout, texture mode
- [ ] `LoadingScreen.js`

### Phase 9 — Advanced Mechanics
- [ ] `AimAssistSystem.js` — friction bubble + magnetism (mobile/gamepad)
- [ ] `BarrelCrosshairAlignment.js` — barrel → screen projection
- [ ] `TacticalInventorySystem.js` — gear slots + backpack grid
- [ ] `SmokeGrenade.js` + `SmokeGrenadeManager.js`

### Phase 10 — PWA & Polish
- [ ] `manifest.json` + `sw.js` (Service Worker offline cache)
- [ ] Mobile controls refinement
- [ ] `GameManager.js` — match rules, round timer, loot drops
- [ ] 13 headless test suites

---

## 🎨 Design Notes

### Why Procedural Everything?

**Textures:** Canvas 2D generation on CPU is fast at boot (< 200ms for all materials), produces deterministic results across all platforms, and requires zero server bandwidth after the Service Worker caches the JS. The pseudoRandom hash (`(x * 374761393) ^ (y * 668265263)`) is ~9× faster than `Math.sin` with no periodicity artifacts.

**Weapons:** Procedural Three.js geometry means:
- Zero HTTP requests for mesh files
- Full parametric control (change `muzzleLocal` without re-exporting from Blender)
- PBR materials with shared instances (zero redundant shader compilations)

**Audio:** Web Audio synthesis means the game can be "installed" from a < 50KB JS payload and produce gun sounds with no audio assets whatsoever. Synthesis parameters live in `audio.json` and can be tuned without touching code.

### Tracer Design (Critical)
The visual bullet tracers **must be completely decoupled** from the projectile physics:
- Emit `tracer:fire` on frame 0 with an estimated impact point
- The tracer travels in a straight world-space line from muzzle to impact
- **Never** pin the tracer tail to the live muzzle position during flight
- This prevents "banana whip" artifacts during fast mouse flicks and strafing

### Fixed Timestep + Interpolation
```
Physics runs at 120Hz (fixedDt = 1/120)
Rendering runs at display rate (60, 120, 144Hz...)

Entity.savePreviousState()     // before physics tick
Entity.applyPhysics(dt)        // physics tick
Entity.interpolatePosition(alpha) // alpha = accumulator / fixedDt
```
This gives perfectly smooth motion at any frame rate.

---

## 📄 License

MIT — Build whatever you want with this.

---

*Built with Three.js, Canvas 2D, Web Audio API, and zero external runtime dependencies.*
