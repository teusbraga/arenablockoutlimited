import * as THREE from 'three';
import { startEngine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { CONFIG, ConfigLoader } from './core/ConfigLoader.js';
import { GameManager } from './core/GameManager.js';
import { SceneSetup } from './core/SceneSetup.js';

import { loadMap } from './world/MapLoader.js';
import { Player } from './entities/Player.js';
import { Viewmodel, buildHK416, buildP9, buildUZI, buildM249, buildRiflePrototype, buildAK47, buildSW500, buildM12, buildVSS } from './weapons/Viewmodel.js';
import { ItemDrop } from './world/ItemDrop.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';
import { initWeaponsFromData } from './weapons/WeaponDefs.js';
import { Effects } from './fx/Effects.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { HUD } from './ui/HUD.js';
import { MenuController } from './ui/MenuController.js';
import { ScopeSystem } from './weapons/ScopeSystem.js';

/* =========================================================
   BOOTSTRAP & INICIALIZAÇÃO DO JOGO
   ========================================================= */

(async function boot() {
  try {
    const sceneSetup = new SceneSetup(document.getElementById('app'));
    const { scene, camera, renderer } = sceneSetup;

    // Subsistemas e Input
    const input = new Input(renderer.domElement);
    const hud = new HUD();
    const audio = new AudioSystem();
    const effects = new Effects(scene);

    // 1. Carrega assets Data-Driven (JSONs)
    const assets = await ConfigLoader.loadAll();
    if (assets.weapons) initWeaponsFromData(assets.weapons);
    if (assets.audio) audio.setSoundBank(assets.audio);

    // 2. Mapa e Jogador
    const mapUrl = MenuController.getSavedMap();
    const map = await loadMap(mapUrl, scene);
    const world = map.world;
    effects.setWorld(world);
    const spawn = map.playerSpawns[0];

    const player = new Player(world, map.bounds, spawn);
    player.setPosition(spawn[0], spawn[1], spawn[2]);
    player.updateCamera(camera, 0.016);

    // 3. Viewmodel e Armas
    const viewmodel = new Viewmodel(camera);
    viewmodel.registerModel('ar15', buildHK416);
    viewmodel.registerModel('ak47', buildAK47);
    viewmodel.registerModel('p9', buildP9);
    viewmodel.registerModel('sw500', buildSW500);
    viewmodel.registerModel('m12', buildM12);
    viewmodel.registerModel('uzi', buildUZI);
    viewmodel.registerModel('m249', buildM249);
    viewmodel.registerModel('rifle_proto', buildRiflePrototype);
    viewmodel.registerModel('vss', buildVSS);

    // Registra construtores 3D para drops de armas no chão
    ItemDrop.setBuilders({
      ar15: buildHK416,
      ak47: buildAK47,
      p9: buildP9,
      sw500: buildSW500,
      m12: buildM12,
      uzi: buildUZI,
      m249: buildM249,
      rifle_proto: buildRiflePrototype,
      vss: buildVSS,
    });

    const initialWeapon = MenuController.getSavedWeapon('ar15');
    const secondaryWeapon = MenuController.getSavedSecondaryWeapon('p9');
    viewmodel.equip(initialWeapon);

    let gameManager = null;
    const weapons = new WeaponSystem({
      camera,
      viewmodel,
      input,
      player,
      world,
      botsProvider: () => (gameManager ? gameManager.bots : []),
      inventory: [initialWeapon, secondaryWeapon === 'none' ? null : secondaryWeapon],
    });
    weapons._equip(initialWeapon);
    player.setWeaponManager(weapons);

    gameManager = new GameManager({
      scene,
      world,
      player,
      weapons,
      botSpawns: map.botSpawns,
      playerSpawn: spawn,
      bounds: map.bounds,
    });
    gameManager.setDoors(map.doors);
    effects.setGameManager(gameManager);

    const savedBotSkin = MenuController.getSavedBotSkin();
    if (savedBotSkin) gameManager.setBotSkin(savedBotSkin);

    // 4. Scope System Unificado (Rifle Prototype & VSS Vintorez)
    const scopeSystem = new ScopeSystem(renderer, scene);
    if (viewmodel.models['rifle_proto']?.details) {
      scopeSystem.attachWeaponModel('rifle_proto', viewmodel.models['rifle_proto'].details);
    }
    if (viewmodel.models['vss']?.details) {
      scopeSystem.attachWeaponModel('vss', viewmodel.models['vss'].details);
    }

    // ---------------------------------------------------------
    // SHADER PRE-LOAD WARMUP (Elimina stutter de compilacao)
    // ---------------------------------------------------------
    const dummyDropGroup = new THREE.Group();
    if (ItemDrop && ItemDrop.builders) {
      if (!ItemDrop._templates) ItemDrop._templates = {};
      for (const id in ItemDrop.builders) {
        if (!ItemDrop._templates[id]) {
          try {
            const res = ItemDrop.builders[id]();
            ItemDrop._templates[id] = res.group ?? res;
          } catch(e) {}
        }
        if (ItemDrop._templates[id]) {
          dummyDropGroup.add(ItemDrop._templates[id]);
        }
      }
      dummyDropGroup.position.set(0, -999, 0);
      scene.add(dummyDropGroup);
    }

    for (const id in viewmodel.models) {
      viewmodel.models[id].mesh.visible = true; // Força compilação
    }

    renderer.compile(scene, camera);

    for (const id in viewmodel.models) {
      viewmodel.models[id].mesh.visible = false;
    }
    if (viewmodel.models[weapons.current]) {
      viewmodel.models[weapons.current].mesh.visible = true;
    }
    scene.remove(dummyDropGroup);

    // 5. Interface e Menus
    new MenuController({ input, gameManager, weapons });

    /* =========================================================
       LOOP PRINCIPAL (GODOT-READY: fixedUpdate vs renderUpdate)
       ========================================================= */
    startEngine({
      // _physics_process: Física, lógica, bot IA, raycast e regras (120Hz)
      fixedUpdate(dt) {
        if (!gameManager.hasStarted || !input.locked) return;

        player.update(dt, input);
        gameManager.update(dt);
      },

      // _process: Animação visual, sway, partículas, interpolações e render (rAF)
      renderUpdate(alpha, dt) {
        const isScoped = weapons.current === 'rifle_proto' || weapons.current === 'vss';

        player.interpolatePosition(alpha);
        gameManager.renderUpdate(alpha, dt);

        if (!gameManager.hasStarted) {
          player.updateCamera(camera, dt);
          viewmodel.updatePose(dt, weapons.current, {
            isADS: false,
            isSprinting: false,
            adsAmount: 0,
            reloadProgress: 0,
            ammo: weapons.ammo,
          });
        } else {
          // Atualização cinemática da câmera
          player.activeWeaponWeight = weapons.def?.weight || 3.5;
          player.updateCamera(camera, dt);

          // Shake da câmera
          const shake = viewmodel.getShake();
          if (shake > 0.002 && player.rig && !isScoped) {
            player.rig.addShake(shake * 0.14);
          }
          if (isScoped && player.rig) {
            player.rig.shakeIntensity = 0;
          }

          // Viewmodel Sway e Pose
          viewmodel.applySwayFromRig(player.rig, dt, weapons.ads, player.sprinting, player.vel, weapons.def);
          viewmodel.updatePose(dt, weapons.current, {
            isADS: weapons.ads,
            isSprinting: player.sprinting,
            adsAmount: weapons.adsAmount,
            reloadProgress: weapons.reloadProgress,
            ammo: weapons.ammo,
          });
          viewmodel.decayFlash(dt);

          // Efeitos visuais e partículas
          effects.update(dt, camera);

          // FOV Dinâmico
          const targetFov = weapons.ads
            ? (isScoped ? 60 : (weapons.def?.adsFov || CONFIG.CAMERA.adsFov))
            : (player.sprinting ? CONFIG.CAMERA.hipFov + 8 : CONFIG.CAMERA.hipFov);
          camera.fov += (targetFov - camera.fov) * Math.min(dt * 12, 1);
          camera.updateProjectionMatrix();

          // Scope System Unificado
          if (isScoped) {
            scopeSystem.setActiveWeapon(weapons.current);
            scopeSystem.update(dt, camera, weapons.ads, player.rig, viewmodel);
            player.customSensMul = scopeSystem.getSensitivityFactor();
          } else {
            scopeSystem.update(dt, camera, false, player.rig, viewmodel);
            player.customSensMul = 1.0;
          }

          // HUD
          const hideCrosshair = isScoped && scopeSystem.scopeOn;
          hud.updateCrosshair(hideCrosshair ? 1.0 : weapons.adsAmount, weapons._currentSpread(), player.sprinting, weapons.current);
          hud.update(dt, player.yaw);
        }

        // Renderização Three.js
        const activeScopedModel = viewmodel.models[weapons.current]?.mesh;

        if (isScoped && scopeSystem.scopeOn) {
          scopeSystem.renderScopePass(activeScopedModel);
        }

        renderer.render(scene, camera);

        if (isScoped && scopeSystem.scopeOn) {
          scopeSystem.render(camera);
        }
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
