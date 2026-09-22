import * as THREE from 'three';
import { startEngine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { CONFIG } from './core/Config.js';
import { ConfigLoader } from './core/ConfigLoader.js';
import { emit, on } from './core/EventBus.js';
import { GameManager } from './core/GameManager.js';

import { loadMap } from './world/MapLoader.js';
import { Player } from './entities/Player.js';
import { Viewmodel, buildHK416, buildP9, buildUZI, buildM249 } from './weapons/Viewmodel.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';
import { initWeaponsFromData } from './weapons/WeaponDefs.js';
import { Effects } from './fx/Effects.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { HUD } from './ui/HUD.js';

/* =========================================================
   BOOTSTRAP & CONFIGURAÇÕES DATA-DRIVEN
   ========================================================= */

const app = document.getElementById('app');

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
// Clampa o pixel ratio a 1.5 em telas retina/mobile para garantir 60 FPS estáveis
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c2530);
scene.fog = new THREE.Fog(0x1c2530, 40, 110);

const camera = new THREE.PerspectiveCamera(
  CONFIG.CAMERA.hipFov, innerWidth / innerHeight, 0.03, 250
);
scene.add(camera);

// Iluminação
const ambient = new THREE.AmbientLight(0x9aa8bc, 1.05);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xbfd0e0, 0x2a2620, 0.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe9c8, 1.7);
sun.position.set(14, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
fill.position.set(-12, 10, -10);
scene.add(fill);

// Input & Subsistemas
const input = new Input(renderer.domElement);
const hud = new HUD();
const audio = new AudioSystem();
const effects = new Effects(scene);

(async function boot() {
  try {
    // 1. Carrega todos os assets Data-Driven (JSONs)
    const assets = await ConfigLoader.loadAll();
    if (assets.weapons) {
      initWeaponsFromData(assets.weapons);
    }
    if (assets.audio) {
      audio.setSoundBank(assets.audio);
    }

    // 2. Seletores de Assets do Menu
    const mapSelect = document.getElementById('map-select');
    const weaponSelect = document.getElementById('weapon-select');
    const botSkinSelect = document.getElementById('bot-skin-select');

    const savedMap = localStorage.getItem('blocky_map');
    if (savedMap && mapSelect) mapSelect.value = savedMap;

    const savedWep = localStorage.getItem('blocky_weapon');
    if (savedWep && weaponSelect) weaponSelect.value = savedWep;

    const savedSkin = localStorage.getItem('blocky_botskin');
    if (savedSkin && botSkinSelect) botSkinSelect.value = savedSkin;

    const currentMapUrl = mapSelect ? mapSelect.value : './assets/maps/village.json';

    // Carrega Mapa selecionado
    const map = await loadMap(currentMapUrl, scene);
    const world = map.world;
    const spawn = map.playerSpawns[0];

    const player = new Player(world, map.bounds);
    player.pos.set(spawn[0], spawn[1], spawn[2]);

    // 3. Inicializa Viewmodel e Registra Modelos
    const viewmodel = new Viewmodel(camera);
    viewmodel.registerModel('ar15', buildHK416); // Monumento HK416
    viewmodel.registerModel('p9', buildP9);
    viewmodel.registerModel('uzi', buildUZI);
    viewmodel.registerModel('m249', buildM249);

    const initialWeapon = weaponSelect ? weaponSelect.value : 'ar15';
    viewmodel.equip(initialWeapon);

    // 4. GameManager
    let gameManager = null;

    // 5. Sistema de Armas
    const weapons = new WeaponSystem({
      camera,
      viewmodel,
      input,
      player,
      world,
      botsProvider: () => (gameManager ? gameManager.bots : []),
    });
    weapons._equip(initialWeapon);

    gameManager = new GameManager({
      scene,
      world,
      player,
      weapons,
      botSpawns: map.botSpawns,
      bounds: map.bounds,
    });
    gameManager.setDoors(map.doors);

    if (botSkinSelect) {
      gameManager.setBotSkin(botSkinSelect.value);
    }

    /* =========================================================
       UI DO MENU (start + pause + mobile + seletores)
       ========================================================= */
    const botSlider = document.getElementById('bot-count');
    const botSliderVal = document.getElementById('bot-count-val');
    const timeSlider = document.getElementById('round-time');
    const timeSliderVal = document.getElementById('round-time-val');
    const btnResume = document.getElementById('btn-resume');
    const btnReset = document.getElementById('btn-reset');
    const overlayElRef = document.getElementById('overlay');

    mapSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_map', mapSelect.value);
      location.reload();
    });

    weaponSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_weapon', weaponSelect.value);
      weapons._equip(weaponSelect.value);
    });

    botSkinSelect?.addEventListener('change', () => {
      localStorage.setItem('blocky_botskin', botSkinSelect.value);
      gameManager.setBotSkin(botSkinSelect.value);
    });

    botSlider.addEventListener('input', () => {
      botSliderVal.textContent = botSlider.value;
      if (gameManager.hasStarted) {
        gameManager.setBotCount(parseInt(botSlider.value, 10));
      }
    });

    timeSlider.addEventListener('input', () => {
      const s = parseInt(timeSlider.value, 10);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      timeSliderVal.textContent = `${m}:${String(sec).padStart(2, '0')}`;
      gameManager.setRoundDuration(s);
    });

    btnResume.addEventListener('click', async () => {
      await input.requestLock();
    });

    btnReset.addEventListener('click', () => {
      gameManager.resetGame();
    });

    overlayElRef.addEventListener('click', async (e) => {
      if (e.target.closest('input, button, select')) return;
      await input.requestLock();
    });

    // Sincronização unificada do menu (Desktop PointerLock e Mobile Touch)
    on('input:lock', locked => {
      if (locked) {
        if (!gameManager.hasStarted) {
          gameManager.hasStarted = true;
          gameManager.setBotCount(parseInt(botSlider.value, 10));
        }
        overlayElRef.classList.add('hidden');
        document.getElementById('menu-start').style.display = 'none';
        document.getElementById('menu-pause').style.display = 'flex';
        document.getElementById('overlay-title').textContent = 'PAUSADO';
      } else if (gameManager.hasStarted && !gameManager.roundOver) {
        overlayElRef.classList.remove('hidden');
        document.getElementById('menu-start').style.display = 'none';
        document.getElementById('menu-pause').style.display = 'flex';
        document.getElementById('overlay-title').textContent = 'PAUSADO';
      }
    });

    /* =========================================================
       LOOP PRINCIPAL (FIXED & RENDER)
       ========================================================= */
    startEngine({
      update(dt) {
        if (!gameManager.hasStarted || !input.locked) return;

        player.update(dt, input);
        weapons.update(dt);
        gameManager.update(dt);

        // Atualização da câmera
        player.updateCamera(camera, dt);

        // Viewmodel
        viewmodel.applySwayFromLook(dt, player.yaw, player.pitch, weapons.ads, player.sprinting, player.vel);
        viewmodel.updatePose(dt, weapons.current, {
          isADS: weapons.ads,
          isSprinting: player.sprinting,
          adsAmount: weapons.adsAmount,
          reloadProgress: weapons.reloadProgress,
        });
        viewmodel.decayFlash(dt);

        // FX
        effects.update(dt);

        // FOV Dinâmico
        const targetFov = weapons.ads
          ? (weapons.def?.adsFov || CONFIG.CAMERA.adsFov)
          : (player.sprinting ? CONFIG.CAMERA.hipFov + 8 : CONFIG.CAMERA.hipFov);
        camera.fov += (targetFov - camera.fov) * Math.min(dt * 12, 1);
        camera.updateProjectionMatrix();

        // HUD Crosshair & Indicadores
        hud.updateCrosshair(weapons.ads, weapons._currentSpread(), player.sprinting);
        hud.update(dt, player.yaw);
      },

      render() {
        renderer.render(scene, camera);
      },
    });

  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="padding:40px;color:#e0574a;font-family:monospace">
      Erro ao carregar: ${err.message}<br><br>
      Sirva o projeto via HTTP (python -m http.server 8000) e abra http://localhost:8000
    </div>`;
  }
})();

// Resize responsivo dinâmico (suporta 100dvh e rotação mobile)
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Flash ambiente seguro para tiro
const BASE_AMBIENT = 1.05;
on('weapon:fired', () => {
  ambient.intensity = BASE_AMBIENT + 0.35;
  clearTimeout(window.__ambFlashT);
  window.__ambFlashT = setTimeout(() => {
    ambient.intensity = BASE_AMBIENT;
  }, 60);
});