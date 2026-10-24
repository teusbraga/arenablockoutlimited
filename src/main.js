import * as THREE from 'three';
import { startEngine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { CONFIG, ConfigLoader } from './core/ConfigLoader.js';
import { GameManager } from './core/GameManager.js';
import { SceneSetup } from './core/SceneSetup.js';

import { loadMap } from './world/MapLoader.js';
import { Player } from './entities/Player.js';
import { Viewmodel, buildHK416, buildP9, buildUZI, buildM249, buildRiflePrototype, buildAK47, buildSW500, buildM12, buildVSS, buildSCARH } from './weapons/Viewmodel.js';
import { ItemDrop } from './world/ItemDrop.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';
import { initWeaponsFromData } from './weapons/WeaponDefs.js';
import { Effects } from './fx/Effects.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { HUD } from './ui/HUD.js';
import { MenuController } from './ui/MenuController.js';
import { ScopeSystem } from './weapons/ScopeSystem.js';
import { on, emit } from './core/EventBus.js';
import { loadingScreen } from './ui/LoadingScreen.js';
import { SmokeGrenadeManager } from './weapons/SmokeGrenadeManager.js';
import { BarrelCrosshairAlignment, TacticalInventorySystem, AimAssistSystem } from './new_mechanics/index.js';

/* =========================================================
   BOOTSTRAP & INICIALIZAÇÃO DO JOGO
   ========================================================= */

(async function boot() {
  try {
    loadingScreen.setProgress(5, 'Inicializando subsistemas e motor...');
    const sceneSetup = new SceneSetup(document.getElementById('app'));
    const { scene, camera, renderer } = sceneSetup;

    // Subsistemas e Input
    const input = new Input(renderer.domElement);
    const hud = new HUD();
    const audio = new AudioSystem();
    const effects = new Effects(scene);

    // 1. Carrega assets Data-Driven (JSONs)
    const assets = await ConfigLoader.loadAll();
    if (assets.weapons) {
      assets.weapons.ammo = assets.ammo;
      assets.weapons.weaponSFX = assets.weaponSFX;
      initWeaponsFromData(assets.weapons);
    }
    if (assets.audio) audio.setSoundBank(assets.audio);
    if (assets.surfaceImpacts) effects.setSurfaceImpacts(assets.surfaceImpacts);

    // 2. Mapa e Jogador
    const mapUrl = MenuController.getSavedMap();
    const map = await loadMap(mapUrl, scene);
    const world = map.world;
    effects.setWorld(world);
    audio.setCamera(camera);
    audio.setWorld(world);
    const smokeManager = new SmokeGrenadeManager({ scene, world, audio });
    const spawn = map.playerSpawns[0];

    const player = new Player(world, map.bounds, spawn, scene);
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
    viewmodel.registerModel('scar_h', buildSCARH);

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
      scar_h: buildSCARH,
    });

    const initialWeapon = MenuController.getSavedWeapon('ar15');
    const secondaryWeapon = MenuController.getSavedSecondaryWeapon('p9');
    viewmodel.equip(initialWeapon);

    // Aplica a skin de soldado salva no jogador (3ª pessoa) e braços (1ª pessoa)
    const savedSoldierSkin = MenuController.getSavedSoldierSkin();
    player.setSoldierSkin(savedSoldierSkin);
    viewmodel.arms?.applySkin(savedSoldierSkin);

    on('player:skinChanged', (skin) => {
      player.setSoldierSkin(skin);
      viewmodel.arms?.applySkin(skin);
    });

    let gameManager = null;
    const weapons = new WeaponSystem({
      camera,
      viewmodel,
      input,
      player,
      world,
      botsProvider: () => (gameManager ? gameManager.bots : []),
      inventory: [initialWeapon, secondaryWeapon === 'none' ? null : secondaryWeapon],
      hud,
    });
    weapons._equip(initialWeapon);
    player.setWeaponManager(weapons);

    // Novas Mecânicas Táticas Integradas:
    const barrelCrosshair = new BarrelCrosshairAlignment({
      camera,
      viewmodel,
      collisionWorld: world,
      defaultZeroDistance: 50.0
    });
    weapons.barrelAlignment = barrelCrosshair;

    const aimAssist = new AimAssistSystem({
      collisionWorld: world,
      botsProvider: () => (gameManager ? gameManager.bots : []),
      crosshairManager: hud.crosshairManager
    });
    player.setAimAssist(aimAssist);

    const inventorySystem = new TacticalInventorySystem({
      primary: weapons.slots[0] || null,
      secondary: weapons.slots[1] || null
    });

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

    // 4. Scope System Unificado (Rifle Prototype, VSS Vintorez & SCAR-H)
    const scopeSystem = new ScopeSystem(renderer, scene);
    if (viewmodel.models['rifle_proto']?.details) {
      scopeSystem.attachWeaponModel('rifle_proto', viewmodel.models['rifle_proto'].details);
    }
    if (viewmodel.models['vss']?.details) {
      scopeSystem.attachWeaponModel('vss', viewmodel.models['vss'].details);
    }
    if (viewmodel.models['scar_h']?.details) {
      scopeSystem.attachWeaponModel('scar_h', viewmodel.models['scar_h'].details);
    }

    // ---------------------------------------------------------
    // SHADER PRE-LOAD WARMUP (Elimina stutter de compilacao)
    // ---------------------------------------------------------
    const dummyDropGroup = new THREE.Group();
    if (ItemDrop && ItemDrop.builders) {
      if (!ItemDrop._stickerGeo) {
        ItemDrop._stickerGeo = new THREE.PlaneGeometry(1.15, 0.80);
        ItemDrop._stickerGeo.rotateX(-Math.PI / 2);
      }
      for (const id in ItemDrop.builders) {
        const stickerMat = ItemDrop.getStickerMaterial(id);
        const dummySticker = new THREE.Mesh(ItemDrop._stickerGeo, stickerMat);
        dummySticker.frustumCulled = false;
        dummyDropGroup.add(dummySticker);
      }
      dummyDropGroup.position.set(0, -999, 0);
      scene.add(dummyDropGroup);
    }

    for (const id in viewmodel.models) {
      viewmodel.models[id].mesh.visible = true; // Força compilação
    }

    loadingScreen.setProgress(94, 'Pré-aquecendo shaders de render...');
    renderer.compile(scene, camera);

    for (const id in viewmodel.models) {
      viewmodel.models[id].mesh.visible = false;
    }
    if (viewmodel.models[weapons.current]) {
      viewmodel.models[weapons.current].mesh.visible = true;
    }
    scene.remove(dummyDropGroup);

    // 5. Interface e Menus
    new MenuController({ input, gameManager, weapons, crosshairManager: hud.crosshairManager, audio });

    // Finaliza a tela de carregamento com transição suave
    loadingScreen.hide();

    // Feedback Tátil Háptico Mobile (Acessibilidade e Imersão)
    const triggerHaptic = (pattern) => {
      if (CONFIG.ACCESSIBILITY?.vibrationEnabled !== false && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(pattern);
        } catch (_) {}
      }
    };
    on('weapon:fired', () => triggerHaptic(18));
    on('player:damaged', () => triggerHaptic([35, 25, 35]));
    on('weapon:empty', () => triggerHaptic(10));

    /* =========================================================
       LOOP PRINCIPAL (GODOT-READY: fixedUpdate vs renderUpdate)
       ========================================================= */
    startEngine({
      // _physics_process: Física, lógica, bot IA, raycast e regras (120Hz)
      fixedUpdate(dt) {
        if (!gameManager.hasStarted || gameManager.roundOver || !input.locked || inventorySystem.isOpen) return;

        player.update(dt, input);
        if (input.isActionJustPressed('throw_smoke')) {
          smokeManager.throw({ camera, player });
        }
        smokeManager.update(dt);
        gameManager.update(dt);
      },

      // _process: Animação visual, sway, partículas, interpolações e render (rAF)
      renderUpdate(alpha, dt) {
        const isScoped = weapons.current === 'rifle_proto' || weapons.current === 'vss' || weapons.current === 'scar_h';
        const isGameplayActive = gameManager.hasStarted && !gameManager.roundOver && input.locked && !inventorySystem.isOpen;

        player.interpolatePosition(alpha);
        player.renderUpdate(alpha, dt);
        gameManager.renderUpdate(alpha, dt);

        // Alternância de Inventário com tecla I (permitida durante a partida antes do fim de rodada)
        if (gameManager.hasStarted && !gameManager.roundOver) {
          if (input.consumeAction('toggle_inventory') || input.isActionJustPressed('toggle_inventory')) {
            const opened = inventorySystem.toggle();
            if (opened) {
              if (document.pointerLockElement) document.exitPointerLock?.();
            } else {
              input.requestLock();
            }
          }
        }

        if (!isGameplayActive) {
          // Fora de combate ativo (Menu Inicial, Pausa, Inventário ou Fim de Rodada):
          // congela completamente o modelo da arma e a câmera para não reagir ao mouse por trás do menu
          if (!gameManager.hasStarted) {
            player.updateCamera(camera, 0);
            viewmodel.updatePose(0, weapons.current, {
              isADS: false,
              isSprinting: false,
              adsAmount: 0,
              reloadProgress: 0,
              ammo: weapons.ammo,
            });
          } else {
            player.rig.applyToCamera(camera);
          }
          effects.update(dt, camera);
        } else {
          // Atualização cinemática da câmera (1ª vs 3ª pessoa)
          player.activeWeaponWeight = weapons.def?.weight || 3.5;
          player.updateCamera(camera, dt);

          // Alternância de visibilidade do viewmodel em 3ª pessoa
          const tpAmount = player.rig?.thirdPersonAmount ?? 0;
          if (viewmodel.mount) {
            // Em 3ª pessoa pura oculta o viewmodel de braços soltos da tela
            viewmodel.mount.visible = (tpAmount < 0.6);
          }

          // Shake da câmera
          const shake = viewmodel.getShake();
          if (shake > 0.002 && player.rig && !isScoped) {
            player.rig.addShake(shake * 0.14);
          }
          if (isScoped && player.rig) {
            player.rig.shakeIntensity = 0;
          }

          // Viewmodel Sway e Pose
          viewmodel.applySwayFromRig(player.rig, dt, weapons.ads, player.sprinting, player.vel, weapons.def, {
            isCrouched: player.crouched,
            adsAmount: weapons.adsAmount,
          });
          viewmodel.updatePose(dt, weapons.current, {
            isADS: weapons.ads,
            isSprinting: player.sprinting,
            adsAmount: weapons.adsAmount,
            reloadProgress: weapons.reloadProgress,
            ammo: weapons.ammo,
            wallCompression: weapons.wallCompression || 0,
          });
          viewmodel.decayFlash(dt);

          // Efeitos visuais e partículas
          effects.update(dt, camera);

          // FOV Dinâmico (Proporcional ao peso contínuo de sprint para transição aveludada)
          const sprintW = viewmodel.locomotion?.sprintWeight ?? (player.sprinting ? 1.0 : 0.0);
          const sprintFovExtra = 8.0 * sprintW;
          const targetFov = weapons.ads
            ? (isScoped ? 60 : (weapons.def?.adsFov || CONFIG.CAMERA.adsFov))
            : (CONFIG.CAMERA.hipFov + sprintFovExtra);
          camera.fov += (targetFov - camera.fov) * Math.min(dt * 26.0, 1.0);
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

          // Mecânica Wardogs: Atualiza a balística 3D do cano e projeção 2D
          const currentSprayRecoil = weapons.getSprayRecoil();
          if (barrelCrosshair && weapons.def) {
            barrelCrosshair.update(weapons.def, weapons.ads, dt, currentSprayRecoil);
          }

          // HUD (CrosshairManager decide se o HUD acompanha o cano/recoil ou fica 100% fixo no centro)
          const hideCrosshair = isScoped && scopeSystem.scopeOn;
          hud.updateCrosshair(
            hideCrosshair ? 1.0 : weapons.adsAmount,
            weapons._currentSpread(),
            player.sprinting,
            weapons.current,
            {
              dt,
              cameraRig: player.rig,
              cameraFov: camera.fov,
              wallCompression: weapons.wallCompression || 0,
              sprayRecoil: currentSprayRecoil,
              barrelScreenPos: barrelCrosshair ? barrelCrosshair.screenPos : null
            }
          );
          hud.update(dt, player.yaw);

          // Áudio 3D Espacial e Oclusão Sonora
          audio.updateListener(camera);
          audio.update(dt);
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
    loadingScreen.hide();
    console.error(err);
    document.body.innerHTML = `<div style="padding:40px;color:#e0574a;font-family:monospace">
      Erro ao carregar: ${err.message}<br><br>
      Sirva o projeto via HTTP (python -m http.server 8000) e abra http://localhost:8000
    </div>`;
  }
})();
