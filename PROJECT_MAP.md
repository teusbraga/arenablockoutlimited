# PROJECT_MAP — Arena Blockout: Limited

> **Finalidade:** este é o mapa canônico do projeto. Ele existe para que agentes e desenvolvedores naveguem sem varrer a árvore inteira.
> **Base:** working tree em `ee33c4f` + alterações não commitadas (reload tático, `MagazineDrop`, áudio, ajustes de HUD e cheat `whoami`). Snapshot final: 2026-10-24 14:28 UTC. Linhas citadas referem-se a esse estado e podem deslocar após edições.
> **Regra de leitura:** para qualquer tarefa, leia a seção específica deste mapa e somente os arquivos nela indicados. Só faça varredura ampla se este mapa estiver comprovadamente desatualizado.

---

## 0. Índice por tarefa (atalho)

| Se a tarefa é... | Leia primeiro | Arquivos que provavelmente serão alterados |
|---|---|---|
| Entender boot/loop | §3, §4 | `src/main.js`, `src/core/Engine.js` |
| Mover/agachar/pular jogador | §7.2, §8.3 | `src/entities/Player.js`, `src/core/ConfigLoader.js` |
| Câmera, recoil, headbob, 3ª pessoa | §7.1, §8.4 | `src/core/CameraRig.js`, `src/entities/Player.js` |
| Arma, dano, spread, recuo | §7.7, §8.5 | `src/weapons/WeaponSystem.js`, `BallisticsCalculator.js`, `assets/weapons/weapons.json` |
| Projétil, CCD, penetração, ricochete | §7.7, §8.5 | `src/weapons/ProjectileManager.js` |
| Adicionar arma | §10.1, §14.1 | JSON + modelo + `Viewmodel` + `main.js` + menu |
| Adicionar mapa | §10.4, §14.2 | `assets/maps/*.json`, `MapLoader.js`, `MaterialFactory.js`, `index.html` |
| Bots, pathfinding, FSM | §7.3, §8.6 | `src/ai/**`, `src/entities/Bot.js` |
| HUD, mira, menus, DOM | §7.10, §11 | `src/ui/**`, `index.html` |
| Reload/QTE/inventário | §8.7, §8.10 | `WeaponSystem.js`, `Input.js`, `TacticalInventorySystem.js` |
| Scope/luneta | §8.8 | `ScopeSystem.js`, modelos com `rearLens` |
| Efeitos, tracers, fumaça | §7.8, §8.5, §13 | `src/fx/Effects.js`, `weapons/sfx/*` (**congelado**: ver `GEMINI.md`) |
| Áudio procedural | §7.9, §8.9 | `src/audio/**`, presets |
| Mapas PBR/texturas | §7.5 | `MaterialFactory`, `TextureGenerator`, `ItalyProps` |
| Rodar/validar | §12 | `package.json`, `test/**`, `tools/test_suite.py` |
| Saber o que está quebrado | §13 | este mapa |

---

## 1. Identidade, stack e restrições

- **Produto:** FPS tático de navegador, visual blocky/low-poly, PWA, com bots, balística física, áudio 100% sintetizado e mapas data-driven.
- **Engine:** Three.js puro, sem engine de física externa. Colisão própria por AABB + spatial hash.
- **Linguagem:** JavaScript ES Modules (`.js`, `"type": "module"`). **Não há build step.** O navegador carrega `src/main.js` diretamente.
- **Three.js:** unificado em `three@0.186.1` no importmap do navegador (`index.html`) e no `package.json` para os testes Node (resolvido no Milestone 1).
- **Servidor:** obrigatório servir por HTTP (ES modules + `fetch`). `python -m http.server 8000` é o caminho documentado.
- **PWA:** `manifest.json` (landscape/standalone) + `sw.js` (network-first com fallback de cache).
- **Entry point:** `index.html` → `<script type="module" src="./src/main.js">` (`index.html:1997`).
- **Persistência:** `localStorage` (chaves em §11.3). Mapas/armas/skins são lidos no boot; menu salva imediatamente.
- **Reset do jogo:** troca de mapa faz `location.reload()` (`MenuController.js:240-243`); fim de rodada usa botão de reload (`HUD.js:319`). Não existe teardown global de cena.
- **Idioma do produto:** PT-BR na UI e nos comentários; identificadores de código em inglês.

### 1.1 Baseline git no momento do mapa

- Último commit: `ee33c4f` (áudio procedural 7.62/AK-47, mixer, remoção de sons arcade).
- Modificados no working tree: `index.html`, `package.json`, `SoundPresets.js`, `WeaponSynthesizer.js`, `GameManager.js`, `Input.js`, `TouchInput.js`, `HUD.js`, `Viewmodel.js`, `WeaponSystem.js`, `models/HK416.js`, `test/procedural_audio_test.js`, `test/third_person_test.js`.
- Novos/untracked: `src/weapons/MagazineDrop.js`, `test/tactical_reload_test.js`.
- **Não reverta nem “limpe” o working tree**: o reload tático e o drop de carregador existem apenas nele.

---

## 2. Estrutura de diretórios

```text
/
├── index.html                  SPA: CSS, HUD DOM, menus, touch, importmap, SW
├── manifest.json               PWA
├── sw.js                       Service Worker network-first
├── package.json                type=module; script test; dep three
├── GEMINI.md                   DIRETIVA CONGELADA de tracers/armas/VFX
├── AGENTS.md                   Regras operacionais para agentes
├── PROJECT_MAP.md              Este arquivo
├── assets/
│   ├── config/                 gameplay.json, audio.json
│   ├── characters/             bots.json
│   ├── weapons/                weapons.json, ammo.json, sfx/*.json
│   ├── maps/                   10 mapas JSON
│   └── ui/                     logos, ícones, favicon
├── src/
│   ├── main.js                 boot + loop + wiring de todos os sistemas
│   ├── core/                   Engine, EventBus, ConfigLoader, SceneSetup, Input, TouchInput, CameraRig, GameManager
│   ├── entities/               Character (base), Player, Bot
│   ├── ai/                     AIController, NavGrid, states/ (FSM)
│   ├── physics/                CollisionWorld (AABB, spatial hash, raycast, moveAndSlide)
│   ├── world/                  MapLoader, Door, ItemDrop, MaterialFactory, TextureGenerator, ItalyProps, SurfaceEyedropper
│   ├── view/                   CharacterView + models/TacticalManContinuous
│   ├── weapons/                WeaponDefs, BallisticsCalculator, WeaponSystem, ProjectileManager, Viewmodel, ViewmodelArms, ScopeSystem, SmokeGrenade*, MagazineDrop, models/*
│   ├── fx/                     Effects (pools de tracer/faísca/fumaça/cartucho/sangue)
│   ├── audio/                  AudioSystem + procedural/ (síntese)
│   ├── ui/                     HUD, CrosshairManager, MenuController, WeaponPreview3D, LoadingScreen
│   └── new_mechanics/          AimAssist, BarrelCrosshairAlignment, LocomotionSmoothing, TacticalInventory (+ planos .md)
├── test/                       24 suítes headless (Node)
├── tools/                      test_suite.py (validador), generate_cargo.py
└── scratch/                    geradores one-off de mapas + patch de index
```

**Excluir de qualquer varredura:** `node_modules/`, `.git/`, `__pycache__/`, `.kilo/worktrees/watery-sled/` (worktree separado e desatualizado).

---

## 3. Boot: sequência exata (`src/main.js`)

O boot é uma IIFE assíncrona (`main.js:28`) com `try/catch` que troca o body por mensagem de erro se algo falhar (`main.js:371-378`).

| Ordem | Linha | O que acontece | Dependências |
|---:|---:|---|---|
| 1 | 30 | `loadingScreen.setProgress(5)` | `ui/LoadingScreen` |
| 2 | 31-32 | `new SceneSetup(#app)` cria renderer, cena, câmera, luzes, resize | `core/SceneSetup` |
| 3 | 35-38 | `Input`, `HUD`, `AudioSystem`, `Effects(scene)` | core/ui/audio/fx |
| 4 | 41-48 | `ConfigLoader.loadAll()`; injeta `ammo`/`weaponSFX` em `weapons`; `initWeaponsFromData`; sound bank; surface impacts | assets JSON |
| 5 | 51-56 | `MenuController.getSavedMap()`; `loadMap()`; `effects.setWorld`; `audio.setCamera/setWorld`; `SmokeGrenadeManager` | `world/MapLoader` |
| 6 | 58-62 | `new Player(world, bounds, spawn, scene)`; posiciona no spawn; câmera inicial | `entities/Player` |
| 7 | 65-75 | `new Viewmodel(camera)` + `registerModel` para 10 armas | `weapons/Viewmodel` + modelos |
| 8 | 78-89 | `ItemDrop.setBuilders({...})` — necessário antes da vitrine 3D | `world/ItemDrop` |
| 9 | 91-98 | Lê arma primária/secundária salvas; equipa; aplica skin no player e nos braços | `MenuController` estáticos |
| 10 | 100-103 | Listener `player:skinChanged` → atualiza corpo 3D e braços | EventBus |
| 11 | 106-117 | `new WeaponSystem(...)`; `weapons._equip(initialWeapon)`; `player.setWeaponManager(weapons)` | `weapons/WeaponSystem` |
| 12 | 120-126 | `BarrelCrosshairAlignment` e `weapons.barrelAlignment` | `new_mechanics` |
| 13 | 128-133 | `AimAssistSystem` e `player.setAimAssist` | new_mechanics + HUD crosshair |
| 14 | 135 | `TacticalInventorySystem` (sem vínculo inicial com slots) | new_mechanics |
| 15 | 137-147 | `GameManager` (bots, drops, timer) + `setDoors` + `effects.setGameManager` | `core/GameManager` |
| 16 | 149-150 | Aplica skin de bot salva | GameManager/Bot |
| 17 | 153-162 | `ScopeSystem`; `attachWeaponModel` para `rifle_proto`, `vss`, `scar_h` | `weapons/ScopeSystem` |
| 18 | 167-196 | **Shader warmup:** cria stickers dummy, torna todos os modelos visíveis, `renderer.compile`, esconde de novo, remove dummy | Three.js |
| 19 | 199 | `new MenuController(...)` (vitrine 3D, abas, sliders) | `ui/MenuController` |
| 20 | 202 | `loadingScreen.hide()` | UI |
| 21 | 205-214 | Haptics mobile em `weapon:fired`, `player:damaged`, `weapon:empty` | `CONFIG.ACCESSIBILITY` |
| 22 | 219-369 | `startEngine({fixedUpdate, renderUpdate})` | `core/Engine` |

**Ordem crítica:** `initWeaponsFromData` **antes** de qualquer `WEAPONS[...]`; `ItemDrop.setBuilders` **antes** de `MenuController`; `Viewmodel.registerModel` **antes** de `equip`; `effects.setGameManager` depois do `GameManager`; `ScopeSystem.attachWeaponModel` depois dos modelos registrados.

---

## 4. Loop principal e ordem de atualização

### 4.1 Engine (`src/core/Engine.js`)

- `startEngine({fixedUpdate, renderUpdate, fixedDt = 1/60, maxFrame = 0.1})` (`Engine.js:1-8`).
- `requestAnimationFrame` → acumulador → até **5 passos fixos** por frame (`Engine.js:28-32`).
- `dt` é limitado a `maxFrame` (`Engine.js:24`).
- `alpha = acc / fixedDt` é passado ao render (`Engine.js:34-35`).
- **Fato:** o passo real é **1/60 s**, pois `main.js` não passa `fixedDt` e `CONFIG.PHYSICS.fixedDt` (1/120) não é consumido. A documentação fala 120 Hz; o runtime do navegador é 60 Hz.

### 4.2 `fixedUpdate` (`main.js:221-230`)

Executa somente se `hasStarted && !roundOver && input.locked && !inventorySystem.isOpen`:

1. `player.update(dt, input)` → inclui `WeaponSystem.update(dt)` no fim.
2. `throw_smoke` just-pressed → `smokeManager.throw`.
3. `smokeManager.update(dt)`.
4. `gameManager.update(dt)` → timer, portas, drops, interação, bots, repulsão.

Dentro de `WeaponSystem.update` (`WeaponSystem.js:289`):
`ProjectileManager.update` → wall press → troca de arma → fire mode → reload/QTE → ADS → progresso de recarga → fogo → fumaça residual → decaimento de spray.

### 4.3 `renderUpdate` (`main.js:233-368`)

1. Calcula `isScoped` e `isGameplayActive`.
2. `player.interpolatePosition`, `player.renderUpdate`, `gameManager.renderUpdate` (bots).
3. Inventário: `I` abre/fecha; ao fechar pede pointer lock (`main.js:242-251`).
4. Fora de gameplay: congela câmera/viewmodel e só atualiza efeitos (`main.js:253-268`).
5. Em gameplay:
   - `player.activeWeaponWeight` e `player.updateCamera`.
   - Oculta viewmodel em 3ª pessoa (`main.js:274-279`).
   - Shake da câmera + supressão de shake em scope.
   - `viewmodel.applySwayFromRig` → `updatePose` → `decayFlash`.
   - `effects.update`.
   - FOV dinâmico (ADS/scope/sprint) (`main.js:308-315`).
   - Scope update/render pass.
   - `barrelCrosshair.update`.
   - `hud.updateCrosshair` + `hud.update`.
   - `audio.updateListener` + `audio.update`.
6. Render principal; se scope ativo: `renderScopePass` antes e `render` (overlay) depois (`main.js:357-367`).

### 4.4 Regras de ordem que não podem ser quebradas

- Física e lógica no `fixedUpdate`; apresentação no `renderUpdate`.
- `CameraRig.update` deve acontecer **antes** de `Viewmodel.applySwayFromRig` (o viewmodel lê `rig.angularVelocity`).
- `WeaponSystem._fire` deve acontecer **antes** de `BarrelCrosshairAlignment.update` no frame (o HUD usa `sprayRecoil`).
- `Effects.update` depois dos eventos do frame (os pools são preenchidos por eventos).
- `ScopeSystem.renderScopePass` antes do render principal e `ScopeSystem.render` depois.

---

## 5. Convenções espaciais e matemáticas

| Conceito | Convenção | Evidência |
|---|---|---|
| Posição de entidade | **Pés / bottom-center**; `pos.y` é o chão | `CollisionWorld.js:4-6`, `Character.applyPhysics` |
| Tamanho de entidade | extents totais `{x,y,z}` | `Character.js:14` |
| Mundo | Y para cima; bounds `[minX,maxX,minZ,maxZ]` | `MapLoader.js:151` |
| Câmera/Player yaw | yaw 0 olha para **-Z**; forward `(-sin(yaw),0,-cos(yaw))` | `Player.js:130` |
| Bot yaw | yaw 0 move para **+Z**; `desiredMove=(sin(yaw),cos(yaw))` | `AIController.js:135-138` |
| Modelo do player | `CharacterView` soma `+PI` ao yaw da câmera | `CharacterView.js:243-246` |
| Arma (mount) | -Z é o cano; +Z é a coronha; +Y topo; +X direita | `ViewmodelArms.js:6-15` |
| `muzzleLocal`/`sightLocal`/`ejectLocal` | coordenadas locais do mount da arma | `weapons.json`, `Viewmodel.js:486-519` |
| Câmera Three.js | rotação `YXZ` | `CameraRig.applyToCamera` |
| Static geometry | AABB **sem rotação**; `pos` = base; centro Y = `pos.y + size.y/2` | `MapLoader.js:155-167` |
| Props | podem ter `rotY`; colisão é registrada por `ItalyProps` caso a caso | `MapLoader.js:206-309` |
| Porta | pivô na borda esquerda; colisor sólido só quando quase fechada | `Door.js:14-50` |
| Raycast | slab method; retorna `{box, distance, exitDistance, thickness, normal, point}` | `CollisionWorld.js:228-303` |

**Regra:** nunca usar mesh/Three.js para colisão de gameplay. Use `CollisionWorld.raycast/moveAndSlide`; `THREE.Raycaster` só existe para hitboxes de bots no `ProjectileManager` quando há WebGL (`ProjectileManager.js:345-358`).

---

## 6. Grafo de dependências de alto nível

```text
index.html
  └─ src/main.js
       ├─ core: SceneSetup, Input, ConfigLoader, GameManager, EventBus
       ├─ world: MapLoader → CollisionWorld, Door, MaterialFactory, ItalyProps, SurfaceEyedropper
       ├─ entities: Player → Character → CameraRig + CharacterView → TacticalManContinuous
       │             Bot → Character + AIController → NavGrid + FSM states + CharacterView
       ├─ weapons: Viewmodel → models/* + ViewmodelArms + LocomotionSmoothing
       │           WeaponSystem → WeaponDefs + BallisticsCalculator + ProjectileManager
       │           ScopeSystem → EventBus + renderer
       │           MagazineDrop, SmokeGrenade(Manager)
       ├─ fx: Effects → EventBus + SurfaceEyedropper + RiflePrototype.SMOKE_TEX
       ├─ audio: AudioSystem → procedural/(NoiseBuffers, WeaponSynthesizer, TerminalBallistics, PlayerTraumaAcoustics, LocomotionAcoustics, SoundPresets)
       ├─ ui: HUD → CrosshairManager; MenuController → WeaponPreview3D → ItemDrop + TacticalManContinuous
       └─ new_mechanics: BarrelCrosshairAlignment, AimAssistSystem, TacticalInventorySystem, LocomotionSmoothingSystem
```

**Camadas:** `core` não importa `ui`/`weapons` (exceto `GameManager` importando `Bot`, `ItemDrop`, `MagazineDrop`, `WEAPONS`); `physics` é puro (sem Three.js); `weapons` importa `core`; `ui` importa quase tudo; `new_mechanics` importa `core` e é consumido por `main`/`Player`/`Viewmodel`.

---

## 7. Catálogo de módulos

Cada linha: responsabilidade, exports principais, dependências e consumidores.

### 7.1 `src/core/`

#### `Engine.js`
- **Responsabilidade:** loop de timestep fixo com interpolação (`alpha`) e Error Boundary com overlay de crash screen.
- **Exporta:** `startEngine`, `showCrashScreen`.
- **Depende:** nada.
- **Consumido por:** `main.js`.
- **Chaves:** `fixedDt` default 1/60, clamp `maxFrame`, 5 subpassos, captura exceções no loop e exibe crash overlay no navegador.

#### `EventBus.js`
- **Responsabilidade:** pub/sub global síncrono com catálogo canônico e diagnósticos de dev mode.
- **Exporta:** `on(type, fn) → unsubscribe`, `off`, `emit`, `CANONICAL_EVENTS`, `isCanonicalEvent`, `setDevMode`, `isDevMode`.
- **Comportamento:** `emit` normaliza payload para objeto; em dev mode (`CONFIG.DEV_MODE = true`), emite warnings para eventos disparados no vácuo (0 ouvintes) ou tópicos não canônicos.
- **Consumido por:** praticamente todos os sistemas.

#### `SchemaValidator.js`
- **Responsabilidade:** validador leve em JS puro executado no boot e em testes.
- **Exporta:** `SchemaValidator` (`validateWeapons`, `validateAmmo`, `validateAll`).
- **Comportamento:** verifica obrigatoriedade e integridade de todos os 21 atributos de armas e campos de balística (internal, external, terminal).

#### `ConfigLoader.js`
- **Responsabilidade:** defaults + merge dos JSONs de gameplay/bots/armas e acionamento do SchemaValidator no boot.
- **Exporta:** `DEFAULT_CONFIG`, `CONFIG` (singleton mutável), `ConfigLoader`, `SchemaValidator`.
- **Depende:** `SchemaValidator` e `fetch` de JSONs.
  - `assets/config/gameplay.json`
  - `assets/characters/bots.json`
  - `assets/weapons/weapons.json`
  - `assets/weapons/ammo.json`
  - `assets/config/audio.json`
  - `assets/weapons/sfx/{default,ar15,ak47,scar_h,rifle_proto,uzi,sw500,m249,vss,p9,m12}_sfx.json`
  - `assets/weapons/sfx/surface_impacts.json`
- **Mapeamento gameplay → CONFIG:** `player.*` (`:93-105`), `camera.*` (`:106-111`), `sway` e `gunplay` e `accessibility` via `deepMerge` (`:112-120`), bots (`:124-126`).
- **Retorno:** `{config, weapons, ammo, audio, weaponSFX, surfaceImpacts}` (`:150-157`).
- **Atenção:** `CONFIG` é o mesmo objeto mutado pelo menu (sensibilidade, headbob, shake, cheats). Mudanças em JSON só valem no boot.

#### `SceneSetup.js` (102 linhas)
- **Responsabilidade:** renderer/cena/câmera/luzes/fog/resize.
- **Exporta:** `SceneSetup`.
- **Chaves:** WebGLRenderer com antialias, pixel ratio limitado em touch (`:14-20`), shadows PCFSoft (`:21-22`), ACES tone mapping (`:23-25`), câmera 0.03–250 (`:32-37`), luzes ambiente/hemi/sol/fill (`:44-68`), flash de ambiente em `weapon:fired` (`:79-85`).

#### `GameManager.js` (539 linhas)
- **Responsabilidade:** regras de partida, timer, bots, drops, interação, kill combo.
- **Exporta:** `GameManager`.
- **Depende:** `Bot`, `ItemDrop`, `MagazineDrop`, `CONFIG`, `EventBus`, `WEAPONS`.
- **Estado:** `bots`, `doors`, `itemDrops`, `magazineDrops`, `hasStarted`, `roundOver`, `roundDuration=210`, `killCombo`.
- **Eventos que ouve:** `bot:fired` → spawna projétil (`:52-81`); `bot:died` → kill + drop + respawn (`:84-96`); `weapon:magazine_dropped` → spawna carregador (`:97-99`).
- **Métodos-chave:** `spawnItemDrop` (máx. 2 drops, FIFO) (`:103`), `spawnMagazineDrop` (máx. 16) (`:123`), `_isPositionClear` (`:183`), `_findClearSpawnPos` (`:229`), `scheduleBotRespawn` (`:283`), `finalizeBotRespawn` (`:295`), `setBotCount` (0–20) (`:334`), `setBotSkin` (`:347`), `resetGame` (`:359`), `update` (`:400`), `registerKill` (`:525`), `endRound` (`:534`).
- **Interação:** alvo = porta OU carregador OU drop; `F` (`interact`) resolve (`:461-493`).
- **Colisão player-bot:** repulsão horizontal < 0.8 m (`:511-521`).

#### `Input.js` (491 linhas)
- **Responsabilidade:** input desktop + ponte para touch; ações contínuas e discretas; pointer lock; cheats.
- **Exporta:** `Input`.
- **Depende:** `EventBus`, `TouchInput`, `CONFIG`.
- **Bindings atuais (`:50-71`):**
  `WASD/setas` mover, `Space` pular, `Shift` sprint, `C` agachar, `Mouse0` atirar, `Mouse2` ADS, `R` reload, `Q` lean left, `E` lean right, `1/2` slots, `F` interagir, `B` fire mode, `U` smoke, `I` inventário.
- **Não há binding para:** Tab, scroll do mouse, Ctrl, G, Escape, **V** (perspectiva saiu da tecla e virou cheat `whoami`).
- **Ações canônicas:** snake_case e camelCase via `ACTION_ALIASES` (`:16-51`) e Proxy (`:85-95`).
- **Reload tap/hold:** pressionar R enfileira `qte_interact`; segurar ≥250 ms enfileira `reload_tactical`/`reload_hold`; soltar sem hold enfileira `reload_speed`/`reload_tap`/`reload` (`:197-235`). `clearReloadQueue` limpa tudo (`:266`). `pressAction`/`releaseAction` são a API usada também pelo touch (`:197/236`).
- **Eventos que ouve:** QTE start/result/stop, `weapon:reload:end`, `round:over`, `game:reset`, `inventory:opened/closed` (`:292-334`).
- **Cheats (`:114-160`):** buffer de digitação + API global `window.cheat(name)` / `window.whoami()` (`:108-111`).
  - `gettherefast` (walkSpeed 52/accel 150; re-digitar restaura)
  - `professionalkiller` (alterna munição infinita)
  - `baguvix` (alterna god mode; ao ativar cura)
  - `whoami` (alterna 1ª/3ª pessoa; **substitui a antiga tecla V**)
- **Pointer lock:** `requestLock` com fallback mobile e `navigator.keyboard.lock` (`:444-470`); perda de lock limpa estado (`:434-443`).
- **Consumo:** `consumeMouseDelta` (`:473`), `consumeAction` (`:483`).

#### `TouchInput.js` (379 linhas)
- **Responsabilidade:** joystick esquerdo, look direito, botões touch.
- **Detecção mobile:** exige touch **e** `(pointer: coarse)` ou UA móvel (`:7-9`).
- **Joystick:** deadzone 10 px; sprint automático >75% (`:65-95`).
- **Look:** `sensFactor = 2.8 * CONFIG.CAMERA.sensMultiplier` (`:134`).
- **Botões:** `btn-touch-fire`, `-fire-top`, `-fire-left`, `-ads` (toggle), `-jump`, `-crouch` (toggle), `-reload`, `-smoke`, `-cycle`, `-firemode`, `-interact`, `-pause`, `-zoom` (`:361-369`). O botão `-perspective` foi removido junto com a tecla V.
- **Eventos:** `input:zoom-toggle` (`:354`), `input:lock` (`:342`), escuta `interact:target` para exibir botão (`:375`).

#### `CameraRig.js` (460 linhas)
- **Responsabilidade:** camada cinética da câmera (intenção → inércia → recoil → bob → 1ª/3ª pessoa).
- **Exporta:** `CameraRig`.
- **Depende:** `CONFIG`.
- **Camadas:** target yaw/pitch (`:44-46`), current/inércia (`:48-55`), punch/coice/shake (`:58-64`), bob/lean/flinch/perspectiva (`:70-93`).
- **Métodos:** `addMouseInput` (`:99`), `addRecoilImpulse` (`:114`), `addShake` (`:145`), `setOrientation` (`:151`), `togglePerspective` (`:189`), `reset` (`:204`), `update` (`:227`), `applyToCamera` (`:450`).
- **Update:** smoothDamp yaw/pitch; climb com controle 100% manual (autoRecoilRecovery: false por padrão, estilo CS2); amortecimento de 90% do headbob no ADS (adsDamp = 0.10); molas ágeis de recoil em subpassos de 2 ms (340/32); shake; eye height/crouch; death roll; lean; spring-arm de 3ª pessoa com raycast.
- **Não usa** `CONFIG.SWAY` (molas são hardcoded 280/25 e 240/24).

### 7.2 `src/entities/`

#### `Character.js` (89 linhas)
- **Base de Player e Bot.**
- **Estado:** `pos`, `prevPos`, `renderPos`, `vel`, `yaw`, `size`, `onGround`, `hp/maxHp`, `alive`, `weaponManager`.
- **Métodos:** `savePreviousState`, `setPosition`, `interpolatePosition`, `setWeaponManager`, `updateWeapons`, `applyPhysics` (gravidade + `moveAndSlide` + step), `takeDamage`, `die`, `respawn`.
- **Convenção:** `pos` = pés; tamanho é extent total.

#### `Player.js` (336 linhas)
- **Responsabilidade:** locomoção, look, ADS, lean, pulo, regen, respawn, perspectiva (via cheat `whoami`), view 3ª pessoa.
- **Depende:** `Character`, `CONFIG`, `EventBus`, `CameraRig`, `CharacterView`.
- **Cria:** `rig` (`:22`), `view` (`:27`), listeners de ADS/tiro/cheat (`:44-61`).
- **Update (`:93`):** respawn timer; look (aim assist + sensitivity ADS/scope); WASD; sprint/crouch; lean; jump; aceleração/atrito; crouch height; física; bounds; passos; regen; `updateWeapons`. A perspectiva **não** é mais lida do input aqui; só o cheat `whoami` (`:54-61`) chama `togglePerspective`.
- **Sensibilidade:** `CONFIG.CAMERA.sens * sensMultiplier * adsSensMul * customSensMul` (`:117`).
- **Velocidade:** walk; sprint ×1.75; crouch/ADS ×0.5 (hardcoded, ignora `crouchMul`/`adsMul` do JSON) (`:167-174`).
- **Câmera:** `updateCamera` chama `rig.update` + `applyToCamera` e emite passos quando `rig.stepTriggered` (`:261-271`).
- **Dano:** flinch + `player:damaged` antes do god mode (`:271-283`).
- **Morte/respawn:** 3 s via `respawnTimer` (`:285-320`).
- **3ª pessoa:** `togglePerspective` emite `player:perspective_changed` + `hud:popup` (`:236-247`).

#### `Bot.js` (129 linhas)
- **Responsabilidade:** entidade inimiga + view + IA.
- **Depende:** `Character`, `AIController`, `CharacterView`, EventBus.
- **Cria:** `ai = new AIController(this, world)` (`:18`), `view` (`:21`).
- **Getters de compatibilidade:** `root`, `body`, `head` (`:27-37`).
- **Update:** `ai.update` → lean → `applyPhysics` (`:48-64`).
- **Render:** interpola + `view.update` (`:66-75`).
- **Dano/morte:** `bot:damaged`, `bot:died` com headshot (`:77-93`).
- **Hittables:** `[body, head]` para raycast (`:122-128`).

### 7.3 `src/ai/`

#### `AIController.js` (354 linhas)
- **Responsabilidade:** FSM, GPS A*, LOS, supressão, tiro.
- **Depende:** `CONFIG`, `EventBus`, `WEAPONS`, `NavGrid`, estados.
- **Cria/reusa:** `world.navGrid ||= new NavGrid(world)` (`:26`).
- **FSM:** `patrol`, `engage`, `search`, `flee` (`:60-67`).
- **Métodos:** `clearPath` (`:73`), `navigateTo` (repath 550–900 ms; waypoints <0.72 m; anti-stuck) (`:84`), `_updateStuckDetector` (`:141`), `applySuppression` (`:183`), `_bindPlayerDied` (`:193`), `changeState` (`:203`), `_bindAudioSensory` (ouve tiros <35 m e vai para search) (`:214`), `update` (`:240`), `_hasLOS` (`:285`), `_faceTowards` (`:296`), `_fire` (`:303`).
- **LOS:** só a cada ~100 ms + jitter; **ignora FOV** (`CONFIG.BOTS.fov` não é usado), então bots veem 360° dentro do range.
- **Tiro:** calcula `hitChance` por distância e supressão; acerto mira no peito; erro desvia 0.6–2.3 m; emite estritamente `bot:fired` (projétil, áudio espacial 3D e flash local) (`:340-353`).

#### `NavGrid.js` (397 linhas)
- **Responsabilidade:** grid esparso 1 m, A* 8 direções, string pulling, cache.
- **Depende:** EventBus (`door:toggle` limpa cache).
- **Métodos:** `worldToGrid/gridToWorld`, `isCellWalkable` (cache 24k), `isWorldWalkable`, `_findNearestWalkable`, `hasDirectWalkableLine`, `findPath` (max 450 iterações; atalho de linha reta), `_smoothPath`, `findRandomWalkablePoint`, heap push/pop.
- **Custo:** ~0.15 ms por rota no teste de 100 buscas.

#### `states/`
- `AIState.js`: interface `enter/update/exit`.
- `PatrolState.js`: escolhe ponto aleatório 7–20 m e navega a 75% da walk speed.
- `EngageState.js`: HP <30 e dist <20 → flee; sem LOS por `losMemory` → search; strafe, avanço/recuo, lean aleatório, burst 2–4 tiros para auto, cadência para semi.
- `SearchState.js`: vai ao último ponto conhecido por `searchTime`.
- `FleeState.js`: ponto oposto ao player 11–16 m; volta a engage se ver e dist >28.

### 7.4 `src/physics/CollisionWorld.js` (304 linhas)
- **Responsabilidade:** AABBs puras + spatial hash (`cellSize=4`) + `moveAndSlide` + raycast slab.
- **Exporta:** `CollisionWorld`.
- **Sem dependência de Three.js.**
- **`addBox(cx,cy,cz,sx,sy,sz,meta)`:** centro + tamanho; `meta.solid !== false`, `meta.material`, `vaultable` (flag sem uso de gameplay).
- **`moveAndSlide(pos,size,delta,{stepHeight})`:** resolve Y, X, Z; step-up; retorna `{onGround,hitCeiling,hitWall,hitX,hitZ,groundMaterial}`.
- **`raycast`:** ignora não sólidos; retorna espessura e normal.
- **Limite:** `effectiveDist = min(maxDist, 400)` (`:230`).
- **Convenção:** `pos` = pés; `size` = extents.

### 7.5 `src/world/`

#### `MapLoader.js` (329 linhas)
- **Responsabilidade:** parse do JSON, criação de `CollisionWorld`, chão, `InstancedMesh` por material, props, portas.
- **Depende:** `CollisionWorld`, `Door`, `materialFactory`, `ItalyProps`, `loadingScreen`, `surfaceEyedropper`.
- **Detecção PBR:** `data.pbr || props.length > 0 || id in {dust, italy, woods}` (`:91`).
- **Fluxo:** preload de materiais necessários (`:97-111`); fog (`:125-134`); chão visual + colisão (`:137-149`); agrupa static por material e cria `InstancedMesh` (`:154-203`); props via switch de 31 tipos (`:206-309`); portas (`:312-321`); retorna `{world, doors, bounds, materialFactory, playerSpawns, botSpawns}`.
- **Campos ignorados:** `ambientLight`, `directionalLight`, `type` de static, rotação de static.
- **`PROP_MATERIAL_DEPS` (`:10-47`):** define materiais texturizados por tipo de prop.
- **Fallback de material:** nome desconhecido → `wall` (`MaterialFactory.get`).

#### `Door.js` (52 linhas)
- Pivô esquerdo; colisor próprio; `toggle` emite `door:toggle`; `update` anima 3.2 rad/s e alterna `solid` quando abertura <20%.

#### `ItemDrop.js` (408 linhas)
- **Drop de arma no chão:** por padrão usa **adesivo 2D** (canvas) para zero lag; modo 3D existe (`use3DModel`).
- **Estáticos:** `builders`, `_templates`, `_stickerMats`, `_stickerGeo`; `setBuilders`, `prepareTemplate`, `getStickerMaterial`, `_drawWeaponSilhouette2D`.
- **Trigger:** box `solid:false, isTrigger:true` no `CollisionWorld` (`:253-258`).
- **Pickup:** distância horizontal <1.4 m (`:380-384`); destruição remove box e mesh.

#### `MaterialFactory.js` (780 linhas)
- **Responsabilidade:** catálogo lazy de 51 materiais PBR com UV world-space triplanar.
- **Exporta:** `MaterialFactory`, singleton `materialFactory`.
- **Depende:** `TextureGenerator`, `SurfaceEyedropper`.
- **`applyWorldSpaceUV` (`:25-116`):** injeta shader custom para `map` e `bumpMap`; triplanar por normal.
- **`initMaterials` (`:121-658`):** registra 51 receitas (lista em §10.5).
- **`get` (`:664`):** lazy; fallback `wall`.
- **`preloadMaterials` (`:686`):** cede a thread entre texturas.
- **`applyExternalTexture` (`:712`):** PNG/JPG em material.
- **Modos:** `pbr`, `flat_textures`, `color_only` (`:741`); bump (`:758`); UV scale (`:770`).

#### `TextureGenerator.js` (2591 linhas)
- **Responsabilidade:** 39 geradores procedurais (canvas 2D) de albedo/bump/roughness.
- **Exporta:** `TextureGenerator`, singleton `textures`.
- **Utilidades:** `pseudoRandom`, `valueNoise`, `fbm`, `createCanvas`, `toTexture`, `loadFromURL`, `loadFromFile`.
- **Geradores:** cobblestones, rustic wood door, shutters, roof tiles, ivy, wine barrel/crate, awning, stone arch, grass, dirt path, tree bark, oak foliage, sand dunes, sandstone, adobe, arabic rug, palm fronds/trunk, military crate, oil barrel, jungle floor, mossy rock, jungle bark, jungle fern, bamboo, camo tarp, sandbags, corrugated iron, shooting_target, concrete.

#### `ItalyProps.js` (1740 linhas)
- **Responsabilidade:** props arquitetônicos procedurais e seus colisores.
- **Exporta:** `ItalyProps`.
- **Depende:** `materialFactory`.
- **35 métodos** (`addWindow`, `addRusticDoorFrame`, `addStoneArchway`, `addBalcony`, `addIvyPatch`, `addWineBarrel`, `addWineCrate`, `addMarketStall`, `addStreetLantern`, `addTextureShowcaseWall`, `addVillageTree`, `addRusticFence`, `addVillageWell`, `addChimney`, `addHayBale`, `addPalmTree`, `addArabicArch`, `addArabicRugWall`, `addMilitaryCrate`, `addOilBarrel`, `addDesertTarp`, `addWaterTank`, `addGiantJungleTree`, `addFallenLog`, `addFernCluster`, `addBambooGrove`, `addSandbagBunker`, `addJungleWatchtower`, `addAncientRuins`, `addMilitaryCamoTent`, `addMossyBoulder`, `addPaperTarget`, `addPlinkerTarget`, `addShootingBench`, `addDistanceSign`). Plinkers possuem física pendular harmônica amortecida e reagem a `shot:world`.

#### `SurfaceEyedropper.js` (201 linhas)
- **Responsabilidade:** amostrar a cor exata da textura no ponto de impacto (projeção triplanar idêntica ao shader).
- **Exporta:** `SurfaceEyedropper`, singleton `surfaceEyedropper`.
- **Métodos:** `registerMaterial`, `_extractImageData`, `registerBuffer` (testes), `sampleColor`, `generateJitteredColors`, `clear`.
- **Consumido por:** `Effects` (poeira de impacto) e `MaterialFactory`.

### 7.6 `src/view/`

#### `CharacterView.js` (340 linhas)
- **Responsabilidade:** representação 3D de player/bot; animação procedural; hitboxes.
- **Depende:** `TacticalManContinuous`.
- **Modos:** `soldier` (modelo tático) ou `ghost` (fantasma estilo Pac-Man).
- **Cria:** root, head/body hitboxes com `userData` (`:56-62`, `:110-111`), arma 3ª pessoa no peito (`:129-167`).
- **Animação:** pernas/quadril/joelhos, respiração da arma, lean, pitch, yaw do corpo com twist de torso (`:178-308`).
- **Skin:** `applySoldierSkin` (`:310`).
- **Destroy:** descarta geometria/material/textura (`:316-339`).

#### `models/TacticalManContinuous.js` (2381 linhas)
- **Responsabilidade:** modelo do soldado em partes (cabeça, tronco/colete, braços/mãos, pelve, pernas/botas), texturas procedurais, paletas.
- **Exporta:** `createCharacter`, `createCharacterMaterials`, `applyPaletteToMaterials`, `applyPaletteToCharacter`, `createTacticalArm`, `TACTICAL_PALETTES`, `createProceduralFaceTexture`, `createHairCardTextures`, `default`.
- **Contrato:** retorna `THREE.Group` com `userData.joints` (`:2337-2376`): `pelvis`, `hipLeft/Right`, `thigh*`, `knee*`, `shin*`, `ankle*`, `foot*`, `toes*`, `spineLower`, `chest`, `neck`, `head`, `shoulder*`, `upperArm*`, `elbow*`, `forearm*`, `wrist*`, `hand*`.
- **Uso:** `CharacterView` e `WeaponPreview3D` (soldado); `ViewmodelArms` usa `createTacticalArm` + materiais.

### 7.7 `src/weapons/`

#### `WeaponDefs.js` (218 linhas)
- **Fonte de verdade:** `assets/weapons/weapons.json` + `ammo.json` + `sfx/*.json`; **sem fallback hardcoded de armas**.
- **Exporta:** `MODS`, `BASE_WEAPONS`, `normalizeBallistics`, `AMMO_TYPES`, `DEFAULT_SFX`, `WEAPON_SFX`, `compileWeapons`, `WEAPONS`, `initWeaponsFromData`.
- **Pipeline (`compileWeapons:121`):** clona base → aplica ammo (tracer, velocidade, penetração, ricochete) → `normalizeBallistics` → aplica mods (`recoilMul`, `spreadMul`, `adsTimeMul`, `adsFov`, `adsSightDistance`, `tracerProfile`) → merge de `sfx` (`flash/smoke/barrelHeat/impactDustOverride`).
- **`initWeaponsFromData` (`:207`):** limpa e repopula `WEAPONS` in-place; chamar **uma vez no boot** e nos testes.
- **Defaults de balística:** `normalizeBallistics` (`:11-67`).

#### `MasterWeapon.js` (68 linhas)
- **Stateless & Motor Canônico.**
- **`isZeroingMode(mapName)`:** Ativo no mapa `range` (`Campo de Tiro`) ou via `CONFIG.ZEROING.zeroingMode`.
- **`calculateZeroingElevation(weaponDef, zeroDistance = 50.0)`:** Calcula o ângulo analítico exato θ_zero = (h / Z) + (g · Z) / (2 · v²) compensando o Height-Over-Bore (h) e queda gravitacional a 50m.
- **`getConvergenceTarget(camPos, camForward, zeroDist, world)`:** Ponto focal fixo no infinito/distância zero (50m padrão), sem raycast de colisão dinâmica próximo, eliminando o efeito chicote ("mangueira elástica").
- **`computeShotDirection(muzzleWorld, targetPoint)`:** Vetor diretor unificado colinear entre o bocal e o alvo focal, eliminando desvio de paralaxe tanto em Hipfire quanto em ADS com height-over-bore realista a curta distância.

#### `BallisticsCalculator.js` (192 linhas)
- **Stateless.**
- **`calculateCurrentSpread` (`:14`):** base + sway + perda por movimento (cap 0.035) + penalty; ADS reduz 50%; em repouso usa 100% da precisão intrínseca; suporta `zeroingMode` (retorna 0.0).
- **`calculateRecoilImpulse` (`:72`):** streak multiplier, ADS scales, patterns (`kick_right`, `linear_left`, `spray_wide`, `vertical_snap`, `heavy_churn`, `standard`); suporta `zeroingMode` (retorna 0).
- **`calculateSway` (`:130`):** Lissajous; suporta `zeroingMode` (retorna 0).
- **`calculateTerminalImpact` (`:155`):** falloff por distância + `dropY = 0.5*g*t²`.

#### `WeaponSystem.js` (825 linhas)
- **Responsabilidade:** slots, munição, recarga/QTE, fire modes, ADS, wall press, spread, disparo, recoil, muzzle/eject, spawn de projéteis.
- **Depende:** `WEAPONS`, `BallisticsCalculator`, `MasterWeapon`, `ProjectileManager`, `CONFIG`, EventBus.
- **Estado:** `slots[2]`, `currentSlot`, `current`, `ammo`, `ammoByWeapon`, `reserveMagsByWeapon` (default 3), `fireModeByWeapon`, QTE, `wallCompression`, `sprayRecoil`, `sustainedFireDuration`, `smokeCooldown*`.
- **API:** `_equip` (`:134`), `toggleFireMode` (`:170`), `cycle` (`:183`), `selectSlot` (`:192`), `setSlot` (`:204`), `pickupWeapon` (`:222`), `getReserveMags/addReserveMag` (`:230/234`), `startReload` (`:243`), `update` (`:289`), `getSprayRecoil` (`:531`), `reloadProgress` (`:535`), `_currentSpread` (`:540`), `_fire` (`:558`), `getMuzzlePosition` (`:805`), `destroy` (`:819`).
- **Recarga:** speed = 0.85 s, descarta carregador em 35% e decrementa reserva; tactical = 4.0 s com QTE de 1.8 s (sweet spot 45–70%), acerto encerra na hora; **tactical não decrementa reserva** (§13.7).
- **Cadência:** `def.fireInterval`; auto usa `input.actions.fire` contínuo; semi usa fila `consumeAction('fire')`.
- **Auto-reload:** ao ficar com 0 e ter reserva, chama `reload()` (speed) sem input (`:478-480`).
- **Wall press:** raycast da câmera até `barrelLength + 0.18`; comprime ADS e bloqueia tiro se `noFireWarning` (`:295-311`, `:558-568`).
- **Disparo:** recoil no Rig → kick/flash no Viewmodel → muzzle/eject no mundo → `weapon:fired` → spread → pellets → `ProjectileManager.spawn`.
- **Origem do projétil:** `_muzzleWorld` unificado tanto em Hipfire quanto em ADS, convergindo a 50 m (ou alinhamento dinâmico se ativo) com compensação cinemática `GEMINI.md` intacta (`:698-720`).
- **Sincronização de matriz:** `this.viewmodel.mount.updateWorldMatrix(true, true)` antes do cálculo de saída da bala.
- **Recoil climbing sustentado:** `recoveryDelay` dinâmico (`fireInterval * 2.2`) repassado ao `CameraRig.addRecoilImpulse`.

#### `ProjectileManager.js` (674 linhas)
- **Responsabilidade:** pool de 256 projéteis, CCD sweep, gravidade/drag/vento, dano terminal, penetração, ricochete, supressão, tracer estimado.
- **Exporta:** `SPEED_OF_SOUND=343`, `Projectile`, `ProjectileManager`.
- **Spawn (`:99`):** copia origem/direção/velocidade; emite `projectile:spawned`; para projéteis rápidos emite `tracer:fire` com impacto estimado.
- **Update (`:299`):** forças → deslocamento → hitbox de bots (Raycaster se há meshes; matemático se headless) → raycast do mundo → resolve entidade/mundo → ricochete → penetração → `shot:*` → supressão.
- **Dano:** `calculateTerminalImpact` + `damageMultiplier`; head→body se drop >0.25 m.
- **Penetração:** resistência por material: wood 0.35, sandbag/dirt/plaster 0.50, concrete/stone/brick 1.10, metal 2.40; requer `penetrationPower >= espessura*resistência`.
- **Ricochete:** superfícies duras + ângulo rasante; perde 40% de velocidade e 45% de dano.
- **Supressão:** raio 2.4 m da cabeça; player recebe flinch/shake + evento; bots recebem `applySuppression`.
- **Headless:** hitboxes matemáticas AABB 0.9×1.85 m; head acima de 1.35 m.

#### `Viewmodel.js` (568 linhas)
- **Responsabilidade:** pose/spring/sway/recoil/flash do modelo em 1ª pessoa.
- **Depende:** `CONFIG`, `WEAPONS`, builders dos 10 modelos, `LocomotionSmoothingSystem`, `ViewmodelArms`.
- **Re-exporta builders** (`:19`).
- **Estrutura:** `swayGroup` → `mount` → modelo + flash light/mesh + arms.
- **Métodos:** `registerModel` (`:171`, aceita `Group` ou `{group, physics}`), `equip` (`:181`), `triggerFire/reload` (`:208/214`), `applyKick` (`:224`), `applySwayFromRig` (`:243`), `updatePose` (`:355`), `_adsPos` (`:486`), `flash` (`:493`), `decayFlash` (`:546`).
- **Pose:** hip/ADS/sprint de `weapons.json`; blend contínuo; cinemática Stock-Pivot com rotação apoiada no ombro; atenuação de 82% do recuo visual e 85% de sway/bobbing no ADS; recoil decai por peso; wall press; reload dip; magazine mesh animation; draw animation; physics própria quando existe.
- **Flash:** consome `def.sfx.flash`; fallback por arma; VSS/P9/M12 sem flash.

#### `ViewmodelArms.js` (328 linhas)
- **Responsabilidade:** braços táticos em 1ª pessoa com IK analítico 2-bone e sockets por arma.
- **Depende:** `TacticalManContinuous`.
- **Sockets (`:16-72`):** um por arma; P9/SW500 são 1 mão.
- **Métodos:** `setWeapon` (`:134`), `_solveArmIK` (`:143`), `_solvePose` (`:217`), `update` (`:309`), `setVisible` (`:313`), `applySkin` (`:317`), `destroy` (`:323`).
- **Regra:** adicionar arma exige socket novo ou cai no `DEFAULT_SOCKET`.

#### `MagazineDrop.js` (145 linhas, untracked)
- **Carregador descartado na recarga rápida.**
- **Mesh:** HK416 usa `createHK416MagazineMesh`; outras armas usam caixa procedural por tipo.
- **Física:** gravidade simples + raycast de chão; para em `floorY`; ring verde.
- **Pickup:** <1.4 m; `collected` evita duplicação.
- **Consumido por:** `GameManager` via `weapon:magazine_dropped`.

#### `ScopeSystem.js` (755 linhas)
- **Responsabilidade:** luneta com segunda câmera + RenderTarget + shader de lente + retículo SVG.
- **Exporta:** `SCOPE_CONFIG`, `rad`, `ScopeSystem`.
- **Depende:** Three.js + EventBus.
- **Ativa para:** `rifle_proto`, `vss`, `scar_h` (via `main.js`).
- **Métodos:** `attachWeaponModel` (`:359`), `setActiveWeapon` (`:374`), `apparentZoom` (`:389`), `getSensitivityFactor` (`:394`), `update` (`:400`), `renderScopePass` (`:546`), `render` (`:604`), `onResize` (`:745`).
- **Contrato do modelo:** `details.rearLens`, `details.frontLens`, `details.opticBody` (RiflePrototype, SCARH, VSS).
- **Render:** esconde o modelo da arma, renderiza a cena na `scopeRT`, restaura, desenha o disco 2D com scissor e sincroniza lente/reticle HTML.

#### `ScopeRenderTargetSystem.js` (6 linhas)
- Alias de compatibilidade: reexporta `ScopeSystem` e `SCOPE_CONFIG`.

#### `SmokeGrenade.js` / `SmokeGrenadeManager.js`
- Granada M18: voo com gravidade, até 3 quiques, detona após 1.2–1.3 s; cortina de 14 puffs por 10 s; emite `smoke:detonate/stop/bounce`.
- Manager: cooldown 30 s; lança da câmera +0.35 m; `canThrow`, `getRemainingSeconds`, `getCooldownRatio`, `throw`, `update`, `reset`.
- **Não há HUD de cooldown**; só popup e som.

#### `models/*.js` (10 armas)
| ID | Builder | Retorno | Physics própria | Detalhes de scope |
|---|---|---|---|---|
| `ar15` | `buildHK416` | `Group` | não | — |
| `ak47` | `buildAK47` | `Group` | não | — |
| `uzi` | `buildUZI` | `Group` | não | — |
| `m249` | `buildM249` | `Group` | não | — |
| `p9` | `buildP9` | `{group, physics}` | `P9Physics` | — |
| `sw500` | `buildSW500` | `{group, physics}` | `SW500Physics` | — |
| `m12` | `buildWinchester1912` | `{group, physics}` | `M12Physics` | — |
| `vss` | `buildVSS` | `{group, physics, opticBody, rearLens, frontLens}` | `VSSPhysics` | sim |
| `rifle_proto` | `buildRiflePrototype` | `{group, physics, opticBody, rearLens, frontLens}` | `PrototypePhysics` | sim |
| `scar_h` | `buildSCARH` | `{group, physics, opticBody, rearLens, frontLens}` | `PrototypePhysics` | sim |

- Todos usam materiais/geometrias procedurais; vários exportam materiais (`M_AK_*`, `M_HK_*`, `M_SW_*`, `M_W12_*`).
- `RiflePrototype.js` também exporta `GLOW_TEX`, `SMOKE_TEX` (usados por `Effects` e `P9`).
- **GEMINI.md congela** `muzzleLocal`, `sightLocal`, `ejectLocal`, posições e esses modelos.

### 7.8 `src/fx/`

#### `Effects.js` (2129 linhas)
- **Responsabilidade:** pools de tracers, faíscas, fumaça, cartuchos, sangue voxel, fumaça fantasma, poeira de superfície.
- **Depende:** EventBus, `SMOKE_TEX` de RiflePrototype, `WEAPONS`, `surfaceEyedropper`.
- **Perfis:** `DEFAULT_SWIPE_PROFILE` (`:38`), `DEFAULT_PHOTOGRAPHIC_PROFILE` (`:61`), `DEFAULT_TRACER_PROFILE` (`:82`), `DEFAULT_SURFACE_IMPACTS` (`:84`).
- **Pools:** `MAX_TRACERS=120`, `MAX_SPARKS=80`, `MAX_SMOKE=160`, `MAX_CASINGS=24`, `MAX_BLOOD_VOXELS=80`, `MAX_GHOST_SMOKE=60`.
- **Eventos que ouve (`:618-711`):** `tracer:fire`, `projectile:spawned` (físico), `shot:tracer`, `shot:world`, `shot:ricochet`, `shot:penetration`, `shot:bot`, `bot:died`, `weapon:fired`, `weapon:manual_eject_fx`, `weapon:smoke:residual`.
- **Métodos:** `_spawnFlashTracer`, `_spawnTracer`, `_initPools`, `setWorld`, `setGameManager`, `_resolveMaterialKey`, `_spawnProtoSparks/Smoke`, `_spawnCasing`, `_spawnImpact`, `_spawnMuzzleSmoke`, `_spawnBarrelHeatSmoke`, `_spawnSurfaceImpactDust`, `_spawnSoldierBloodVoxels`, `_spawnGhostDeathSmoke`, `update`.
- **Tracers:** estilos `swipe`, `laser`, `streak`, `photographic`; parâmetros vêm de `weaponDef.tracerProfile` (ammo.json).
- **Congelado por `GEMINI.md`.**

#### `DecalSystem.js` e `ProceduralDecalAtlas.js`
- **Responsabilidade:** marcas de impacto de projétil (Shot Decals) tridimensionais procedurais em quads orientados com `polygonOffset`.
- **Atlas Procedural:** gera no boot Texture Atlas (Diffuse + Alpha) com slots por material (`concrete`, `metal`, `wood`, `dirt`) e Normal Map procedural derivado via filtro Sobel a partir do mapa de relevo/altura.
- **Pool Circular (Ring Buffer):** pool pré-alocado O(1) de 128 quads reutilizados continuamente (zero alocação no loop de disparo).
- **Balística Dinâmica:**
  - `shot:world`: impacto com fuligem, anel de fratura e amostragem de cor milimétrica via `SurfaceEyedropper.js`.
  - `shot:penetration`: entrada com fuligem + saída blowout 1.65x maior sem fuligem.
  - `shot:ricochet`: sulco de raspão elíptico esticado na direção tangencial de reflexão.
  - `game:reset`: desativa e oculta todos os decals do pool.
- **Fade-out:** decaimento suave de opacidade nos últimos segundos de vida útil em `renderUpdate`.
- **Configuração:** `assets/config/gameplay.json` (`decals`) e `assets/weapons/sfx/surface_impacts.json` (`decal`).

### 7.9 `src/audio/`

#### `AudioSystem.js` (814 linhas)
- **Responsabilidade:** mixer, voz procedural, espacialização HRTF, oclusão, ducking, loops de fumaça, dano/trauma.
- **Depende:** EventBus + módulos `procedural/`.
- **Criação lazy do AudioContext** (`_ensure`, `:77`) — só após gesto do usuário.
- **Grafo (`:98`):** compressor → master; `weaponsGain` e `foleyGain` → compressor; `footstepsGain`/`impactsGain`/`traumaGain` → foley.
- **Volumes:** master/weapons/footsteps/impacts/trauma; persistidos em `localStorage` (`blocky_vol_*`); preset inicial `blocky_audio_preset_v2`.
- **Espacial:** `updateListener` (`:311`), `checkOcclusion` (`:349`), `createSpatialDestination` (HRTF + lowpass de oclusão + ar) (`:367`), `startSmokeHiss` (`:441`), `update` (`:543`).
- **Disparos:** `playProceduralShot(weaponId, destination)` (`:586`); mapeia `m12`, `sw500`, `ar15/m249/rifle_proto`, `ak47`, `scar_h`, `uzi`, `vss`, `p9`, fallback 5.56.
- **Eventos que ouve (`:689-795`):** `weapon:fired`, `bot:fired`, `weapon:empty`, `weapon:pump`, `weapon:reload:start/end`, `shot:world/penetration/ricochet`, `player:damaged`, `player:footstep`, `smoke:detonate/stop`.
- **Ducking:** `triggerAcousticDucking` (`:217`).

#### `procedural/`
- `NoiseBuffers.js`: buffers white/pink/brown persistidos; `createSource`.
- `SoundPresets.js`: `SOUND_PRESETS` calibrados (rifle 556/308, AK, 9 mm, Uzi, VSS, SW500, shotgun, mecânica de slide/pump/mag).
- `WeaponSynthesizer.js` (1752 linhas): 14 métodos de síntese (rifle 556/308, AK, 9 mm, Uzi, VSS, SW500, shotgun, slide pull/release, pump back/forward, load shell, mag STANAG/AK).
- `TerminalBallistics.js`: impactos em areia/madeira/alvenaria/metal.
- `PlayerTraumaAcoustics.js`: impacto em kevlar com intensidade de dano.
- `LocomotionAcoustics.js`: passos por material.

### 7.10 `src/ui/`

#### `HUD.js` (574 linhas)
- **Responsabilidade:** toda a HUD in-game; assina ~30 eventos.
- **Depende:** EventBus, `WEAPONS`, `CrosshairManager`.
- **IDs cacheados (`:7-44`):** `kills`, `deaths`, `hp-num`, `ammo-num/max`, `weapon-name`, `hitmarker`, `crosshair`, `prompt`, `overlay`, `killfeed`, `kill-popup`, `screen-flash`, `suppression-overlay`, `death-screen`, `respawn-txt`, `damage-indicator`, `round-timer`, `fire-mode`, `slot-1/2-pill`, `inventory-modal`, `inv-*`, `reload-qte`, `qte-*`.
- **Máquina de visibilidade:** `syncGameplayUIVisibility` (`:70`) alterna `body.in-gameplay`; CSS oculta elementos fora de combate (`index.html:40-54`).
- **Listeners (`:101-303`):** HP, dano, supressão, ammo, equip, QTE, firemode, slots, `shot:bot`, `bot:died`, `player:died/respawn`, `respawn_tick`, `game:reset`, `kill:combo`, `round:timer`, `hud:popup`, `round:over`, `input:lock`, `interact:target`.
- **Inventário (`:322-385`):** abre/fecha modal, renderiza gear/grid, botão fechar emite `inventory:toggle`.
- **Hitmarker (`:399`):** central ou descentralizado para shotgun.
- **Directional damage (`:502-573`):** canvas 280×280, arcos âmbar (supressão) e vermelho (dano), dedupe ~23°.
- **Nota:** eventos `notification` **não são ouvidos** por ninguém (§13.3).

#### `CrosshairManager.js` (232 linhas)
- **Responsabilidade:** config/persistência e posicionamento da mira em 3 eixos independentes.
- **Exporta:** `DEFAULT_CROSSHAIR_CONFIG`, `CrosshairManager`.
- **Config:** `style`, `mode`, `dynamicAlignment`, `followRecoil`, `centerDot`, `length`, `thickness`, `gap`, `outline`, `color`, `noFireWarning`, `aimAssist`.
- **Persistência:** `localStorage.blocky_crosshair_settings`.
- **Eixos:** gap dinâmico (`:181-187`), posição pelo cano (`:189-196`), offset de recoil (`:198-230`).
- **`isBlocked`:** `wallCompression > 0.45 && noFireWarning` (`:159-170`).
- **Eventos:** ouve `crosshair:change/reset`; emite `crosshair:updated`.

#### `MenuController.js` (948 linhas)
- **Responsabilidade:** menu inicial/pausa, abas, loadout, skins, mira, áudio, texturas, sistema, pointer lock, vitrine.
- **Depende:** `CONFIG`, EventBus, `materialFactory`, `DEFAULT_CROSSHAIR_CONFIG`, `WeaponPreview3D`.
- **Presets:** `SOLDIER_SKIN_PRESETS` (10) e `DEFAULT_SOLDIER_SKIN` (`:7-118`).
- **Statics:** `getSavedMap/Weapon/Secondary/BotSkin/SoldierSkin`, `saveSoldierSkin`.
- **Abas:** `loadout`, `match`, `textures`, `crosshair`, `audio`, `system` (`index.html:1531-1536`).
- **Controles:** mapa (reload), armas (slots + preview), bots (contagem/skin), tempo, sensibilidade, headbob, shake, vibração, supressão, textura (modo/bump/UV/imagem), mira (todos os campos), áudio (5 volumes), fullscreen.
- **Pointer lock:** `input:lock` inicia partida na primeira captura, mostra/esconde overlay (`:518-559`); clique no overlay retoma (`:460-464`).
- **Tecla T:** alterna modos de textura (`:473-495`).

#### `WeaponPreview3D.js` (734 linhas)
- **Responsabilidade:** vitrine 3D do loadout; usa templates do `ItemDrop`.
- **Depende:** `WEAPONS`, `ItemDrop`, `createCharacter`.
- **Métodos:** `_initThree`, `_getGlowColor`, `_getOrBuildTemplate`, `setWeapon`, `showSoldier`, `updateSoldierSkin`, `setAutoRotate`, `setDragMode`, `resetView`, `setActive`, `_updateLoopState`, `_updateAndRender`, `destroy`.
- **Loop próprio:** só roda quando `isActive` e aba loadout visível (`:655-721`).

#### `LoadingScreen.js` (61 linhas)
- `show`, `setProgress`, `hide`; singleton `loadingScreen`; tolerante a DOM ausente.

### 7.11 `src/new_mechanics/`

| Arquivo | Responsabilidade | Integração |
|---|---|---|
| `AimAssistSystem.js` | Friction bubble + rotational pull + ADS/fire snap; 1 raycast/frame | `Player.update` (`:119-124`), `CrosshairManager.config.aimAssist` |
| `BarrelCrosshairAlignment.js` | Projeta cano 3D → ponto 3D → tela; fornece direção de tiro | `main.renderUpdate` e `WeaponSystem._fire` |
| `LocomotionSmoothingSystem.js` | Pesos contínuos idle/walk/sprint/crouch/ADS, fase incremental, inércia | `Viewmodel` (único consumidor real) |
| `TacticalInventorySystem.js` | Gear, mochila 4×4 (16 slots), peso 40 kg, usar item | `main` instancia; HUD renderiza; `I` alterna |
| `index.js` | Reexports | `main.js` |

- **AimAssist:** ativo por padrão (`aimAssist: true`); parâmetros no próprio arquivo (`:71-86`); não move a câmera se o jogador está parado sem olhar/atirar.
- **BarrelAlignment:** calcula `screenPos` a partir de `aimPointWorld` (com spray), apesar do comentário mencionar ponto “puro” (`:154-182`).
- **Inventory:** `addItem` **não é chamado** por pickups; `useItem` emite `player:heal` que não tem listener (§13.5). Gear primária/secundária só sincroniza ao receber `weapon:slots`, emitido depois do inventory ser criado → pode iniciar nulo.

### 7.12 Dados e assets

Detalhado em §10.

### 7.13 Testes, tools e scratch

Detalhado em §12.

---

## 8. Fluxos ponta a ponta

### 8.1 Boot
`index.html` → `main.js` → `ConfigLoader` → `loadMap` → `Player`/`Viewmodel`/`WeaponSystem` → `GameManager` → `ScopeSystem` → warmup → `MenuController` → `startEngine`.
Detalhes e ordem crítica em §3.

### 8.2 Partida/pausa/fim
- Primeiro `input:lock` → `gameManager.hasStarted = true` e `setBotCount` (`MenuController.js:535-540`).
- `roundTimeLeft` decrementa em `GameManager.update`; a cada segundo emite `round:timer`; em 0 → `endRound` → `round:over` (Input destrava, HUD mostra tela final).
- Reset: `btn-reset` → `resetGame` + `requestLock`; fim de rodada → `restart-btn` → `location.reload()`.

### 8.3 Locomoção do Player
Input contínuo → `Player.update`:
1. respawn timer;
2. look (mouse/touch + aim assist + sensibilidade);
3. wish direction com yaw;
4. sprint (não ADS/agachado e com movimento), crouch, lean, jump;
5. speed (walk/sprint/0.5x);
6. aceleração/atrito;
7. `size.y` por crouch;
8. `Character.applyPhysics` (gravidade + `moveAndSlide`);
9. clamp de bounds;
10. passos (via rig no render);
11. regen;
12. `WeaponSystem.update`.
13. Perspectiva: apenas cheat `whoami` (não há tecla V).

### 8.4 Câmera
`Player.updateCamera` (render) → `CameraRig.update`:
- smoothDamp yaw/pitch com `CONFIG.CAMERA` (ADS mais lento e com peso da arma);
- molas de recoil em subpassos de 2 ms;
- shake com `ACCESSIBILITY.shakeScale` (zero no ADS);
- flinch decai;
- headbob com `ACCESSIBILITY.headbobScale` e 85% de atenuação no ADS;
- eye height/crouch/morte;
- lean;
- 1ª/3ª pessoa (`thirdPersonAmount`) com spring-arm raycast.
`applyToCamera` escreve posição e rotação `YXZ`.

### 8.5 Disparo completo
1. `Input` enfileira/sustenta `fire`.
2. `WeaponSystem.update` decide `wantsFire`, cooldown, ammo.
3. `_fire`:
   - bloqueio de parede (opcional);
   - decrementa ammo, `fireInterval`;
   - atualiza streak/precisionPenalty;
   - `BallisticsCalculator.calculateRecoilImpulse`;
   - acumula `sprayRecoil`;
   - `CameraRig.addRecoilImpulse`;
   - `Viewmodel.applyKick/flash/triggerFire`;
   - calcula câmera+muzzle+eject (com compensação de strafe entre prevPos/pos);
   - direção: ADS câmera; hip convergência 50 m ou `barrelAlignment`;
   - aplica wall press ao vetor;
   - emite `weapon:fired` (áudio, VFX, ambient flash, scope shake, flash 3ª pessoa);
   - aplica spread + pellets;
   - `ProjectileManager.spawn` por pellet.
4. `ProjectileManager.update` (no próximo `WeaponSystem.update`): CCD → impacto.
5. Impacto em bot: `calculateTerminalImpact` → `bot.takeDamage` → `shot:bot` → HUD hitmarker, Effects faísca, Audio? (não há som de carne; só `shot:world` tem som).
6. Impacto no mundo: `shot:world` → Effects poeira/faísca + Audio impacto + SurfaceEyedropper.
7. Penetração/ricochete: eventos próprios + continua vivo.
8. Bot morre: `bot:died` → GameManager (kill/drop/respawn), HUD (killfeed/kills), Effects (sangue/fumaça).

### 8.6 Bot/IA
1. `Bot.update` → `AIController.update`.
2. LOS a 10 Hz; se vê → last known + engage.
3. FSM:
   - patrol: ponto aleatório via NavGrid;
   - engage: face, strafe, avanço/recuo, lean, burst;
   - search: último ponto;
   - flee: ponto oposto.
4. `navigateTo` → A* + waypoints + anti-stuck.
5. `_fire` → `bot:fired` → GameManager spawna projétil com `bot.weaponId`, toca áudio espacial 3D e flash local.
6. Projétil atinge player → dano terminal → `player:takeDamage` → HUD/áudio/flinch.
7. Supressão near-miss → `player:suppression`/`bot:suppressed`.

### 8.7 Recarga
- Tap R: `reload_speed`/`reload_tap`/`reload` na fila → `startReload('speed')` (0.85 s).
- Hold R ≥250 ms: `reload_tactical`/`reload_hold` → `startReload('tactical')` (4.0 s + QTE 1.8 s).
- Speed: em 35% emite `weapon:magazine_dropped` (GameManager cria `MagazineDrop`), zera ammo e decrementa reserva; em 78% recarrega; em 100% `weapon:reload:end`.
- Tactical: em 35% guarda no bolso (sem decrementar reserva); QTE no sweet spot 45–70% encerra imediatamente; erro/esgotar = 4 s; em 78% recarrega.
- Sem reserva: `notification` + `weapon:empty` (mas `notification` não é exibido).
- Auto-reload ao esvaziar (speed).

### 8.8 Scope
- Armas com scope: `rifle_proto`, `vss`, `scar_h`.
- `WeaponSystem.update` calcula `adsAmount`; `main` chama `scopeSystem.update` todo frame.
- `ScopeSystem` interpola `adsT`; acima de 0.65 mostra overlay; renderiza cena na `scopeRT` com `scopeCamera` alinhada às lentes 3D; desenha disco com shader; sincroniza SVG/reticle e HUD de zoom.
- Sensibilidade reduzida por `getSensitivityFactor` → `player.customSensMul`.

### 8.9 Áudio
- `weapon:fired` → disparo procedural no bus de armas + ducking.
- `bot:fired` → disparo espacial HRTF + ducking se <4.5 m.
- `shot:world/penetration/ricochet` → impacto procedural por material com atraso sônico.
- `player:damaged` → kevlar/trauma.
- `player:footstep` → passo por material.
- `smoke:detonate/stop` → loop espacial com oclusão.
- **Tiro de bot:** tratado exclusivamente via `bot:fired`, com áudio posicional 3D (`AudioSystem.js:700`) desacoplado do áudio 2D do jogador (§13.4).

### 8.10 Inventário
- `I` → `inventorySystem.toggle()` (main) → `inventory:opened/closed` → Input destrava, HUD mostra modal, MenuController esconde overlay.
- Fechar: `I` ou botão; `ESC` **não** fecha (§13.9).
- Grid: clicar item médico emite `inventory:use_item` → `TacticalInventorySystem.useItem` → `player:heal` (sem listener).
- Armas no gear: só leitura de `weapon:slots`; trocar arma no inventário não é suportado.

### 8.11 Interação/drops
- `GameManager.update` calcula `nearDoor || nearMag || nearDrop` e emite `interact:target`.
- `F`: porta alterna; carregador adiciona reserva; arma troca o slot atual e dropa a antiga.
- Drops de arma têm limite 2 (FIFO); carregadores 16.
- Dano de bot → drop da arma do bot com munição cheia.

### 8.12 Granada de fumaça
- `U` (just-pressed) ou botão touch → `smokeManager.throw`.
- Cooldown 30 s; voo ~1.2 s; cortina 10 s; `smoke:detonate` inicia loop de áudio; `smoke:stop` encerra.
- A fumaça é visual: **não bloqueia LOS de bots, raycast de tiro nem áudio** (apenas o som é ocluído por geometria).

### 8.13 Mapa/PBR
- `loadMap` busca com cache-buster `?_t=`.
- PBR: `materialFactory.initMaterials` + preload somente do necessário.
- Static: agrupado por material → `InstancedMesh` + AABBs.
- Props: `ItalyProps` switch.
- Portas: `Door`.
- Chão: plane visual + AABB.
- Fog do JSON.
- `SurfaceEyedropper` registra materiais para poeira colorida.

### 8.14 Menu/config
- Mapa: salva e recarrega.
- Armas: `localStorage` + `weapons.setSlot` + preview.
- Bots: skin recria bots; count só depois de started.
- Tempo: `setRoundDuration`.
- Sens/headbob/shake: mutam `CONFIG` + storage.
- Texturas: `materialFactory` (sem persistência; volta ao PBR no reload).
- Mira: `CrosshairManager.saveConfig` + storage.
- Áudio: `AudioSystem` + storage.
- Fullscreen/PWA.

---

## 9. Catálogo do EventBus

### 9.1 Eventos vivos (emissor → consumidores)

| Evento | Emitido por | Consumido por | Payload relevante |
|---|---|---|---|
| `input:lock` | Input, TouchInput | HUD, MenuController | `{ locked }` (boolean) |
| `input:zoom-toggle` | TouchInput | ScopeSystem | — |
| `weapon:fired` | WeaponSystem | AudioSystem, Effects, SceneSetup, Player, ScopeSystem | `weapon/weaponId, muzzleWorld, ejectWorld, forward/right/up, ads, streak` |
| `bot:fired` | AIController | GameManager, AudioSystem, Bot | `bot, player, dist, hit, muzzleWorld, endPos, dir` |
| `weapon:empty` | WeaponSystem, SmokeManager | AudioSystem | — |
| `weapon:pump` | Winchester1912 | AudioSystem | `stage` |
| `weapon:reload:start` | WeaponSystem | AudioSystem | `type, weaponId` |
| `weapon:reload:end` | WeaponSystem | AudioSystem, Input, HUD | `weaponId, type` |
| `weapon:qte:start/update/result/stop` | WeaponSystem | HUD, Input | progresso/sweet spot/sucesso |
| `weapon:ammo` | WeaponSystem, GameManager | HUD | `ammo, max, reserve` |
| `weapon:equipped` | WeaponSystem | HUD | `id, name, fireMode` |
| `weapon:firemode` | WeaponSystem | HUD | `fireMode, canToggle` |
| `weapon:slots` | WeaponSystem | HUD, TacticalInventorySystem | `slots, currentSlot` |
| `weapon:magazine_dropped` | WeaponSystem | GameManager | `weaponId, ammoCount, maxAmmo, pos` |
| `weapon:smoke:residual` | WeaponSystem | Effects | `muzzleWorld, weapon, count, ratio, color` |
| `weapon:manual_eject_fx` | Winchester1912 | Effects | `ejectWorld, right, up, forward, isShotgun` |
| `weapon:select_slot` | HUD | WeaponSystem | `{ slotIdx, slot }` |
| `weapon:cycle_action` | (ninguém) | WeaponSystem | — |
| `projectile:spawned` | ProjectileManager | Effects | `projectile` |
| `tracer:fire` | ProjectileManager | Effects | origem/fim/velocidade/cor/perfil |
| `shot:world` | ProjectileManager | Effects, AudioSystem, DecalSystem | `point, material, normal, distance, soundDelay` |
| `shot:bot` | ProjectileManager | Effects, HUD | `point, headshot, killed, distance, screenX/Y` |
| `shot:ricochet` | ProjectileManager | Effects, AudioSystem, DecalSystem | `point, normal, material` |
| `shot:penetration` | ProjectileManager | Effects, AudioSystem, DecalSystem | `entryPoint, exitPoint, material, thickness` |
| `shot:tracer` | (ninguém) | Effects | — |
| `player:hp` | Player, GameManager | HUD | `hp, max` |
| `player:damaged` | Player | HUD, AudioSystem, main (haptics) | `dmg, source, playerPos` |
| `player:suppression` | ProjectileManager | HUD | `pos, source, sourcePos, playerPos, intensity` |
| `player:died` | Player | AIController, HUD | — |
| `player:respawn` | Player | HUD | — |
| `player:respawn_tick` | Player | HUD | `{ seconds, count }` |
| `player:footstep` | Player | AudioSystem | `pos, material` |
| `player:ads` | WeaponSystem | Player | `ads` |
| `player:skinChanged` | MenuController | main | `{ skin }` |
| `player:perspective_changed` | Player | (ninguém) | `mode, isThirdPerson` |
| `player:heal` | TacticalInventorySystem | (ninguém) | `amount` |
| `bot:alerted` | AIController | (ninguém) | `bot` |
| `bot:damaged` | Bot | (ninguém) | `bot, dmg, part` |
| `bot:died` | Bot | GameManager, Effects, HUD | `bot, headshot` |
| `bot:suppressed` | ProjectileManager | (ninguém) | `bot, intensity, distance` |
| `game:reset` | GameManager | HUD, Input | — |
| `round:timer` | GameManager | HUD | `{ seconds, timeLeft }` |
| `round:over` | GameManager | HUD, Input | — |
| `kill:combo` | GameManager | HUD | `combo, headshot` |
| `notification` | WeaponSystem, GameManager, TacticalInventorySystem | (ninguém) | `message` |
| `hud:popup` | Input, MenuController, Player, WeaponSystem, SmokeManager | HUD | `text, color, duration` |
| `interact:target` | GameManager | HUD, TouchInput | `{ target }` (objeto ou `null`) |
| `inventory:opened/closed/changed` | TacticalInventorySystem | HUD, Input, MenuController | gear/storage |
| `inventory:toggle` | HUD | TacticalInventorySystem | — |
| `inventory:use_item` | HUD | TacticalInventorySystem | `{ slotIdx, idx }` |
| `inventory:item_dropped` | TacticalInventorySystem | (ninguém) | `item, slotIdx` |
| `crosshair:change/reset` | (MenuController chama direto) | CrosshairManager | config |
| `crosshair:updated` | CrosshairManager | (ninguém) | config |
| `cheat:activated` | Input | WeaponSystem, Player | `cheat, active` |
| `door:toggle` | Door | NavGrid | `door` |
| `smoke:detonate/stop/bounce/thrown` | SmokeGrenade/Manager | AudioSystem (`detonate/stop`) | pos/id/duration |
| `toggle_inventory` | Input (ação, não evento) | main consome | — |

### 9.2 Eventos mortos / sem emissor

Confirmados por cruzamento de `emit`/`on`:
- Sem **listener**: `bot:alerted`, `bot:damaged`, `bot:suppressed`, `player:perspective_changed`, `crosshair:updated`, `inventory:item_dropped`, `smoke:bounce`, `smoke:thrown`, `weapon:cycle`. (`notification` e `player:heal` foram ativados no commit `80fd818`).
- Sem **emissor** (listener órfão): `shot:tracer`, `weapon:cycle_action`, `crosshair:change`, `crosshair:reset`.
- **Padronização Fase 1 Concluída:** Todo evento do EventBus transporta estritamente um objeto `{ ... }`, com catálogo canônico em `EventBus.js` (`CANONICAL_EVENTS`).

---

## 10. Dados (schemas e consumo)

### 10.1 `assets/weapons/weapons.json`
Topo: `{ weapons: {id: {...}}, mods: {id: {...}} }`.

Campos por arma e quem consome:

| Campo | Consumido por | Observação |
|---|---|---|
| `id`, `name` | HUD, UI, logs | `id` é a chave de `WEAPONS` |
| `auto`, `fireModes` | WeaponSystem, AI | modo inicial = `fireModes[0]` |
| `weight` | Viewmodel (massa), CameraRig | |
| `damageBody/Head` | fallback terminal | `ballistics.terminal` vence |
| `fireInterval`, `magSize`, `reloadTime` | WeaponSystem/AI | |
| `spreadHip/Ads` | BallisticsCalculator | |
| `recoilPitch/Yaw/YawBias` | BallisticsCalculator | fallback se `ballistics.external.recoil` ausente |
| `adsFov` | main (FOV) | |
| `adsSightDistance`, `hipPos`, `hipRot`, `adsRot`, `sprintPos`, `sprintRot` | Viewmodel | obrigatórios para pose |
| `sightLocal`, `muzzleLocal`, `ejectLocal` | Viewmodel, WeaponSystem, Scope, BarrelAlignment | **congelados** |
| `kickbackZ`, `kickRotFactor` | Viewmodel/WeaponSystem | |
| `smokeConeOpacity/Scale` | Effects | |
| `pellets`, `pelletSpread` | WeaponSystem | shotgun |
| `ejectCasings`, `casingType` | WeaponSystem/Effects | |
| `mods` | compileWeapons | aplica multiplicadores |
| `ballistics.internal/external/terminal` | Ballistics, Projectile, WeaponSystem | núcleo do gunplay |
| `ammo` | compileWeapons | chave em `ammo.json` |
| `type` | HUD, UI, Drops | presente em todas as 10 armas (`rifle`, `sniper`, `smg`, `heavy`, `pistol`, `shotgun`) |
| `smokeResidualMax/Color` | WeaponSystem | formalizado com defaults em `WeaponDefs.js` |
| `model`, `audioKey` | **removidos** | eliminados na Fase 1 por serem fantasmas históricos |

Armas atuais (10):

| ID | Nome | Munição | Auto | Fire interval | Mag | Reload | Dano corpo/cabeça | Peso |
|---|---|---|---:|---:|---:|---:|---:|---:|
| ar15 | HK416 | 5.56_nato | sim | 0.09 | 30 | 1.65 | 24/52 | 3.4 |
| ak47 | AK-47 | 7.62_soviet | sim | 0.10 | 30 | 1.80 | 34/75 | 3.8 |
| rifle_proto | Rifle Prototype | energy_cell | sim | 0.085 | 30 | 1.65 | 24/52 | 4.8 |
| scar_h | FN SCAR-H | 7.62_soviet | sim | 0.10 | 20 | 1.85 | 38/84 | 3.7 |
| uzi | UZI | 9mm_para | sim | 0.065 | 32 | 1.30 | 18/38 | 2.4 |
| m249 | M249 SAW | 5.56_linked | sim | 0.082 | 100 | 4.20 | 28/62 | 7.8 |
| p9 | P-9 | 5.7_fn | não | 0.16 | 12 | 1.15 | 40/75 | 0.95 |
| sw500 | S&W 500 Magnum | 500_magnum | não | 1.10 | 6 | 2.20 | 160/360 | 2.1 |
| m12 | Winchester 1912 | 12_gauge | não | 0.65 | 6 | 2.50 | 22/51 | 3.4 |
| vss | VSS Vintorez | 9x39_sp5 | sim | 0.085 | 20 | 1.90 | 42/90 | 2.6 |

- `rifle_proto` não aparece no `<select>` do menu; só via drop/bot.
- `mods` existentes: `heavyBarrel` (recoil 0.8, adsTime 1.2, spread 0.85), `lightGrip` (adsTime 0.8, spread 1.1), `redDot` (adsFov 50, sight 0.28). Usados por ar15 (heavy), uzi (light); `redDot` não é usado por nenhuma arma.

### 10.2 `assets/weapons/ammo.json`
9 munições: `5.56_nato`, `5.56_linked`, `7.62_soviet`, `energy_cell`, `9mm_para`, `5.7_fn`, `500_magnum`, `12_gauge`, `9x39_sp5`.

Campos: `name`, `bulletSpeed`, `bulletDrop`, `penetrationPower`, `maxPenetrations`, `ricochetChance`, `tracerColor`, `tracerProfile`.
`tracerProfile`: `style` (`swipe|laser|streak|photographic|parabola`), `ttl`, `headSpeed`, `streakLength`, `fadeInEnd`, `fadeOutStart`, `coreRadius`, `glowRadius`, `coreColor`, `glowColor`, `coreBrightness`, `glowBrightness`, `maxOpacity`, `width`, `trackOrigin`, `beamLength`, `realSpeed`, `lengthMultiplier`, `flashProfile.{size,opacity,lightIntensity,lightDistance,color,duration,maskElasticOffset}`.
**Uso real:** quase tudo em `Effects`; `flashProfile` só tem `maskElasticOffset` lido por Effects e o restante é mesclado em `finalWep.flashProfile`, mas o muzzle flash do Viewmodel usa `def.sfx.flash` (não `flashProfile`).

### 10.3 `assets/weapons/sfx/*.json`
11 perfis (`default`, `ar15`, `ak47`, `scar_h`, `rifle_proto`, `uzi`, `sw500`, `m249`, `vss`, `p9`, `m12`) + `surface_impacts.json`.
Blocos: `flash`, `smoke`, `barrelHeat`, `impactDustOverride`.
- `flash` → `Viewmodel.flash` (tamanho, cor, luz, opacidade, duração, jitter).
- `smoke` → `Effects._spawnMuzzleSmoke` (partículas, alcance, spread, crescimento, drag, buoyancy, spin, vida).
- `barrelHeat` → `Effects._spawnBarrelHeatSmoke`.
- `impactDustOverride` → `Effects._spawnSurfaceImpactDust`.
- `surface_impacts.json` → paletas/contagem/velocidade por material (`concrete`, `stone`, `wood`, `dirt`, `sand`, `grass`, `metal`, `glass`, `default`).

### 10.4 Mapas (`assets/maps/*.json`)

Esquema:
```json
{
  "name": "string (loading screen)",
  "id": "string opcional (força PBR: dust|italy|woods)",
  "pbr": true,
  "size": [largura, profundidade],
  "bounds": [minX, maxX, minZ, maxZ],
  "floorMaterial": "nome",
  "environment": { "fogColor": "#hex", "fogNear": 45, "fogFar": 130 },
  "staticGeometry": [
    { "type": "wall", "pos": [x, yBase, z], "size": [sx, sy, sz], "material": "stone", "vaultable": false }
  ],
  "props": [
    { "type": "window", "pos": [x, y, z], "rotY": 0, "width": 1.4, "height": 2.0 }
  ],
  "doors": [
    { "pos": [x, y, z], "width": 1.1, "height": 2.2 }
  ],
  "playerSpawns": [[x, y, z]],
  "botSpawns": [[x, y, z]]
}
```
- `staticGeometry.type` é ignorado (só material importa).
- Sem rotação de static; AABB puro.
- `size` e `playerSpawns` são essenciais; `bounds` é derivado de `size` se omitido; `floorMaterial` default `floor`.
- `ambientLight`/`directionalLight` existem em alguns JSONs mas são ignorados.
- Props suportados: 31 tipos do switch `MapLoader.js:210-307`; tipos desconhecidos são silenciosamente ignorados.
- Para PBR, todo `material` precisa existir em `MaterialFactory`; senão cai em `wall`.

Mapas atuais:

| Arquivo | Nome | Size | Bounds | Static | Props | Doors | PBR |
|---|---|---:|---|---:|---:|---:|---|
| `dust.json` | Dust Block | 80×80 | ±38 | 21 | 42 | 4 | sim (id) |
| `italy.json` | CS Italy | 64×64 | ±30 | 24 | 39 | 2 | sim (props) |
| `woods.json` | Woods 300 | 300×300 | ±145 | 426 | 0 | 0 | sim (`pbr`) |
| `village.json` | Vila Ensolarada | 70×70 | ±34 | 56 | 0 | 4 | não |
| `lisbon.json` | Lisboa | 300×300 | ±145 | 103 | 60 | 4 | sim (props) |
| `cargo.json` | Cargo | 120×120 | ±58 | 100 | 0 | 0 | não |
| `vertigo.json` | Vertigo | 80×80 | ±35 | 83 | 0 | 0 | não |
| `city.json` | Cidade Abandonada | 1000×1000 | ±485 | 2201 | 0 | 0 | não |
| `vice.json` | Vice City | 2000×2000 | ±980 | 5908 | 0 | 0 | não |
| `range.json` | Campo de Tiro (Sunny Remake) | 56×96 | [-28,28,-48,48] | 42 | 27 | 0 | sim (PBR) |

### 10.5 Materiais PBR (`MaterialFactory`)

54 nomes registrados:
`cobblestones`, `floor`, `wall_peeling_ochre`, `wall`, `wall_peeling_terra`, `wall_white`, `stone`, `roof`, `door_wood`, `window_shutter`, `ivy_foliage`, `wine_barrel`, `crate`, `wood`, `awning_red`, `dirt`, `path`, `grass`, `trunk`, `foliage`, `foliage_light`, `sand`, `sand_dark`, `sandstone`, `plaster_light`, `fabric_red`, `arabic_rug`, `fabric_green`, `palm_frond`, `palm_trunk`, `military_crate`, `oil_barrel`, `metal_barrel`, `blue_tarp`, `iron_grill`, `fence`, `scaffold`, `jungle_floor`, `woods_floor`, `mossy_rock`, `rock`, `jungle_bark`, `jungle_fern`, `fern`, `bamboo`, `camo_tarp`, `camo`, `sandbags`, `corrugated_iron`, `rusty_metal`, `concrete_dark`, `concrete`, `target`, `plinker`.

- **Não existem** `caution_yellow`, `steel_girder` → fallback `wall`. (Concreto e alvos foram implementados).
- `Lisbon` usa `caution_yellow`, `metal_barrel` (existe), `steel_girder` → dois fallbacks.
- `applyWorldSpaceUV` escala por material (0.35–0.45).

### 10.6 Configurações
- `gameplay.json` → `CONFIG.PLAYER/CAMERA/PHYSICS/SWAY/GUNPLAY/ACCESSIBILITY`.
- `bots.json` → `CONFIG.BOTS` (merge direto).
- `audio.json` → `{sounds:{}}` (vazio; o áudio é procedural, o banco não é usado).

Chaves de CONFIG padronizadas na Fase 1:
- Player: `height`, `crouchHeight`, `eyeHeight`, `eyeCrouch`, `walkSpeed`, `sprintMul` (alias `sprintMultiplier`), `crouchMul` (alias `crouchMultiplier`), `adsMul` (alias `adsMultiplier`), `accel`, `airAccel`, `friction`, `jumpSpeed`, `gravity`, `stepHeight`, `regenDelay`, `regenRate`.
- Camera: `hipFov`, `adsFov`, `sens` (alias `sensitivity`), `sensMultiplier`, `adsSensMul` (alias `adsSensitivityMultiplier`), `pitchLimit`, `smoothTime`, `adsSmoothTime`, `maxTurningRate`.
- Physics: `fixedDt` (padronizado para `1/60` = 0.016667s, alinhado ao loop real da Engine), `maxFrame`.
- Bots: `walkSpeed`, `sprintSpeed`, `viewRange`, `reactionTime`, `losMemory`, `searchTime`, `fireInterval`, `respawnTime`; `hitAccuracy*` no fallback antigo.
- Accessibility: `headbobScale`, `shakeScale`, `vibrationEnabled`, `suppressionEnabled`.
- Cheats: `godMode`, `infiniteAmmo`.
- **Não lidas:** `PLAYER.radius`, maior parte de `SWAY` (Locomotion usa só `walkBobFrequency/sprintBobFrequency`), `BOTS.fov`, `BOTS.damageBody/Head`, `BOTS.maxHp`.

---

## 11. UI, DOM e persistência

### 11.1 Camadas e telas (`index.html`)
- CSS: `:root` `:24`; isolamento `body:not(.in-gameplay)` `:40-54`; HUD minimalista `:56+`; loading `:1235-1328`; body a partir de `:1320`.
- Telas: `#loading-screen`, `#app`, `#screen-flash`, `#suppression-overlay`, `#damage-indicator`, `#kill-popup`, `#killfeed`, `#death-screen`, `#roundover-screen`, `#inventory-modal`, `#hud`, `#crosshair`, `#crosshair-no-fire`, `#lens` + `#reticle`, `#hitmarker`, `#prompt`, `#mobile-controls`, `#orientation-warning`, `#overlay`.
- Menu: 6 abas (`loadout`, `match`, `textures`, `crosshair`, `audio`, `system`, `:1531-1536`) e painéis `data-panel`.
- Controles touch: joystick + 13 botões (`:1486-1510`; botões `:1494-1506`).
- Importmap `:1979-1984`; module `:1986`; SW `:1987-1994`.

### 11.2 IDs importantes
HUD/combate: `hud`, `hp-hud`, `hp-num`, `weapon-hud`, `weapon-name`, `fire-mode`, `ammo-num`, `ammo-max`, `slot-1-pill`, `slot-2-pill`, `round-timer`, `kills`, `deaths`, `killfeed`, `hitmarker`, `prompt`, `death-screen`, `respawn-txt`, `roundover-screen`, `final-stats`, `restart-btn`, `screen-flash`, `suppression-overlay`, `damage-indicator`, `kill-popup`, `crosshair`, `crosshair-no-fire`, `lens`, `reticle`, `scopeHud`, `scope-zoom-text`, `scope-fov-text`, `reload-qte`, `qte-*`.
Inventário: `inventory-modal`, `inv-weight-lbl`, `inv-slot-pri`, `inv-slot-sec`, `inv-grid-container`, `inv-btn-close`.
Menu: `overlay`, `menu-start`, `menu-pause`, `btn-resume`, `btn-reset`, `map-select`, `weapon-select`, `weapon-secondary-select`, `bot-skin-select`, `bot-count`, `round-time`, `sens-slider`, `headbob-slider`, `shake-slider`, `vibration-toggle`, `suppression-toggle`, `texture-mode-select`, `bump-slider`, `uv-scale-slider`, `custom-tex-*`, `ch-*`, `vol-*`, `soldier-*`, `weapon-preview-*`.
Loading: `loading-screen`, `loading-map-name`, `loading-bar`, `loading-status`, `loading-percent`.

**IDs referenciados mas ausentes no HTML:** `hp-fill`, `ammo-fill` (HUD os guarda como `null`; não são usados). `#hud` contém `controls` com texto desatualizado.

### 11.3 Chaves de `localStorage`

| Chave | Conteúdo | Quem grava |
|---|---|---|
| `blocky_map` | URL do mapa | MenuController |
| `blocky_weapon` | arma primária | MenuController |
| `blocky_weapon_secondary` | arma secundária | MenuController |
| `blocky_botskin` | `soldier`/`ghost` | MenuController |
| `blocky_soldier_skin` | JSON da skin | MenuController |
| `blocky_sens` | multiplicador de sensibilidade | MenuController |
| `blocky_headbob` | escala 0–2 | MenuController |
| `blocky_shake` | escala 0–2 | MenuController |
| `blocky_vibration` | `true`/`false` | MenuController |
| `blocky_suppression` | `true`/`false` | MenuController |
| `blocky_crosshair_settings` | JSON da mira | CrosshairManager |
| `blocky_vol_master/weapons/footsteps/impacts/trauma` | 0–1 | AudioSystem |
| `blocky_audio_preset_v2` | flag de migração | AudioSystem |

### 11.4 Controles reais vs documentados

| Ação | Código (`Input.js`) | UI `#controls` | README |
|---|---|---|---|
| Mover | WASD/setas | WASD | OK |
| Sprint | Shift | Shift | OK |
| Agachar | **C (segurar)** | C | diz Ctrl/C |
| Pular | Space | Space | OK |
| Atirar | LMB | LMB | OK |
| ADS | RMB (segurar) | RMB | OK |
| Reload | R (tap/hold) | R | OK |
| Lean | **Q/E** | diz Q arma / E porta | Q/E |
| Interagir | **F** | diz E porta | F |
| Trocar arma | 1/2 | diz Q arma | 1/2/Tab/scroll |
| Fire mode | B | B | não lista |
| Perspectiva | cheat `whoami` (digitar) ou `window.whoami()` | não lista | V (obsoleto) |
| Smoke | U | U | diz G |
| Inventário | I | I | I |
| Pausa | ESC (pointer lock) | ESC | OK |

**Conclusão:** `README.md` e `#controls` estão defasados; a fonte é `Input.js:54-75`.

---

## 12. Testes, ferramentas e comandos

### 12.1 Comandos

```bash
npm install                 # instala three para os testes Node
npm test                    # 15 scripts da suíte principal
node test/<arquivo>.js      # testes standalone
node --test test/<arquivo>.test.js
python tools/test_suite.py  # validador de JSON/imports (ATUALMENTE FALHA, §13.8)
```

### 12.2 Suítes e cobertura

Incluídas em `npm test`:

| Arquivo | Cobre |
|---|---|
| `headless_sim.js` | GameManager+Bot+Player+CollisionWorld por 600 ticks; prova ausência de DOM/WebGL |
| `ballistics_test.js` | 10 armas, spread/recoil/sway/terminal, resiliência a campos ausentes |
| `projectile_test.js` | CCD, dano, atraso sônico, 100 projéteis |
| `penetration_ricochet_test.js` | wallbang, concreto, ricochete, supressão player/bot |
| `italy_map_test.js` | integridade de italy/dust/village/woods |
| `phase14_accessibility_test.js` | headbob/shake, material de chão, wall press, no-fire |
| `loading_system_test.js` | LoadingScreen headless + lazy materials |
| `audio_spatial_occlusion_test.js` | oclusão, smoke 10 s/30 s |
| `procedural_audio_test.js` | presets, grafo, ducking, kevlar, mixer |
| `tracer_flash_profile_test.js` | flashProfile em todas as munições + proporção |
| `third_person_test.js` | 1ª/3ª pessoa + spring arm |
| `woods_texture_test.js` | materiais PBR do woods |
| `crosshair_manager.test.js` | config, 4 combinações, no-fire, dot, aim assist/LOS |
| `tactical_man_integration_test.js` | joints do modelo, arms IK, M12, hitboxes |
| `tactical_reload_test.js` | speed/tactical QTE, MagazineDrop, tap/hold |

**Fora do `npm test` (rodam e passam, mas não são gate):**
`alignment_test.js`, `bot_gps_pathfinding_test.js`, `locomotion_smoothing_test.js`, `muzzle_flash_smoke_test.js`, `soldier_skin_test.js`, `surface_eyedropper_test.js`, `tracer_test.js`, `weapon_sfx_data_driven_test.js`, `phase2_diagnostics_test.js`.

### 12.3 Ferramentas
- `tools/test_suite.py`: valida JSONs e imports ES; espera ≥10 sons em `audio.json`, o que **não** corresponde ao estado atual (procedural).
- `tools/generate_cargo.py`: gera `assets/maps/cargo.json`.
- `scratch/`: `build_city_1000.js`, `city_builder.js`, `generate_city.js`, `generate_vice.js`, `generate_woods.js`, `update_index.js` — geradores one-off, não fazem parte do runtime.
- **Sem linter, formatter, typecheck ou bundler configurado.** O gate real é `npm test` + teste manual no navegador.

---

## 13. Divergências conhecidas, riscos e dívida técnica

> Estes itens são comportamento observado no código/testes, não suposições. Não “corrija” sem confirmar com o usuário; vários são intencionais ou congelados.

### 13.1 Loop a 60 Hz, não 120 Hz
`Engine.js:6` default `1/60`; `main.js:219` não passa `fixedDt`; `CONFIG.PHYSICS.fixedDt=1/120` não é lido. README/QA e alguns comentários dizem 120 Hz. Impacto: cadência de física, projectiles e IA é 60 Hz.

### 13.2 Three.js divergente [RESOLVIDO]
Navegador e testes unificados em `three@0.186.1` no importmap de `index.html` e `package.json`. Shadow maps atualizados para `PCFShadowMap` (`PCFSoftShadowMap` descontinuado no Three moderno).

### 13.3 `notification` não tem listener [RESOLVIDO]
`HUD.js` agora implementa listener de `notification` direcionando o texto para `_showKillPopup(message, '#ffaa00', 1800)`, ativando feedback visual de munição, carregadores, modo de disparo e avisos de inventário.

### 13.4 Tiro de bot toca áudio de player [RESOLVIDO]
`AIController._fire` emitia `weapon:fired` desnecessariamente. Removido; `bot:fired` já aciona áudio espacial 3D (`AudioSystem.js:700`) e flash 3D do modelo do bot sem poluir o bus de áudio estéreo 2D do jogador.

### 13.5 Medkit não cura [RESOLVIDO]
`Player.js` agora assina `player:heal`, incrementando HP até o teto de `maxHp` e emitindo `player:hp` para sincronização imediata na HUD.

### 13.6 Inventário não sincroniza gear no boot [RESOLVIDO]
`TacticalInventorySystem` agora recebe `{ primary: weapons.slots[0], secondary: weapons.slots[1] }` no construtor em `main.js`, garantindo slots preenchidos desde o frame 0.

### 13.7 Recarga tática não consome reserva [RESOLVIDO]
Tanto a recarga tática por QTE bem-sucedido quanto a recarga tática tradicional completa agora decrementam corretamente 1 unidade da reserva de carregadores do jogador (`reserveMagsByWeapon`).

### 13.8 `tools/test_suite.py` falha [RESOLVIDO]
Script atualizado para reconhecer a arquitetura de áudio 100% procedural sem exigir sons estáticos no JSON. Integrado ao gate principal `npm run check`.

### 13.9 `ESC` não fecha inventário [RESOLVIDO]
Texto do rodapé do modal no `index.html` corrigido para "Pressione [I] para retornar ao combate", alinhado aos bindings de `Input.js`.

### 13.10 `def.type` não existe nos dados [RESOLVIDO]
Chave `"type"` adicionada a todas as 10 armas em `assets/weapons/weapons.json` (`rifle`, `smg`, `heavy`, `shotgun`, `pistol`, `sniper`), eliminando fallbacks manuais por string.

### 13.11 Campos de arma não consumidos
`model`, `audioKey`, `smokeResidualMax`, `smokeResidualColor` não são lidos. `smokeResidual` usa cor fixa `#ffffff` e `count:1` (`WeaponSystem.js:509-515`). `flashProfile` da munição só contribui com `maskElasticOffset`; o flash visual vem de `sfx.flash`.

### 13.12 Materiais PBR ausentes em Lisbon
`lisbon.json` usa `caution_yellow` e `steel_girder`, que não existem em `MaterialFactory`; caem no fallback `wall` silenciosamente. `concrete` também não existe como fábrica (só `concrete_dark`).

### 13.13 `BarrelCrosshairAlignment` e Sincronização 98%+ de Impacto [RESOLVIDO]
Resolvida a divergência entre ponto puro e balístico. `BarrelCrosshairAlignment.js` agora projeta e expõe separadamente `pureScreenPos` (projeção física do cano com sway e inércia sem subida de spray) e `screenPos` (projeção balística completa com spray). No `CrosshairManager.js`, quando `dynamicAlignment` está ativo, o `transform` adicional de recuo é zerado para eliminar o double-dipping que jogava a mira no teto. Com isso, no modo dinâmico + follow recoil, o HUD atinge $\ge 98\%$ de match espacial comprovado com o ponto exato de impacto dos projéteis.

### 13.14 Documentação histórica divergente
`src/new_mechanics/walkthrough.md` cita share codes, sliders RGB/opacidade e “12 suítes”; `README.md` lista controles e “9 armas”/“13 suítes”; `HUD.md` cita IDs `#btn-fire` etc. que não existem. **Código é a fonte de verdade.** `GEMINI.md` é a única diretiva formal congelada.

### 13.15 Eventos mortos
Ver §9.2. Ao adicionar UI/feedback, prefira `hud:popup` (funciona) ou implemente o listener de `notification` antes de usá-lo.

### 13.16 Limites e comportamentos “escondidos”
- `GameManager` limita drops de arma a 2 e carregadores a 16; `setBotCount` aceita 0–20, UI 0–10.
- Bots veem 360° (FOV ignorado) dentro de `viewRange` e LOS só é checado a ~10 Hz.
- Granada de fumaça é puramente visual; não bloqueia tiro/IA/raycast.
- Pulo é contínuo (segurar Space pula repetidamente); agachar no desktop é segurar C.
- `AimAssist` vem ligado por padrão.
- `Engine` roda no máximo 5 subpassos; em quedas de FPS a simulação desacelera.
- Não há teardown global: trocar mapa/fim de rodada recarrega a página.
- `player:perspective_changed` é emitido mas não consumido; a UI usa `hud:popup`.
- Perspectiva em 3ª pessoa só é acessível pelo cheat `whoami` (digite ou chame `window.whoami()`); a tecla V e o botão touch foram removidos.

### 13.17 Working tree parcial [RESOLVIDO]
Todo o trabalho pendente de reload tático, drop de carregadores, QTE, áudio procedural e cheat whoami foi commitado com segurança em `51f11ea`. O working tree foi normalizado e protegido por 25 suítes automatizadas.

### 13.18 Troca de armas permitida após a morte do jogador [RESOLVIDO]
`WeaponSystem.js` agora valida `this.player.alive` em `selectSlot`, `cycle`, `setSlot`, `pickupWeapon`, `toggleFireMode` e `startReload`, além de esvaziar a fila de ações pendentes durante o estado de morte para evitar trocas acidentais e sons de equipar na tela de respawn.

### 13.19 Acúmulo descontrolado de climbing no recuo da câmera [RESOLVIDO]
`CameraRig.js` agora rastreia o recuo de subida em `recoilClimbPitch` e executa recuperação angular suave (recoil recovery) gradual após o término da rajada, além de deduzir proporcionalmente o recuo quando o jogador compensa ativamente puxando o mouse para baixo.

### 13.20 Instabilidade de física e coleta em `MagazineDrop` [RESOLVIDO]
`MagazineDrop.js` agora verifica a diferença vertical ($\Delta Y$) impedindo coletas através de andares/tetos diferentes, amplia a sondagem de solo para 15m e `GameManager.js` seleciona estritamente o carregador e drop mais próximos do jogador via `distanceTo`.

### 13.21 Configuração fantasma de vibração em mobile [RESOLVIDO]
`TouchInput.js` agora consome `CONFIG.ACCESSIBILITY.vibrationEnabled` e aciona `navigator.vibrate` com pulsos hápticos dedicados para disparo de arma, dano recebido pelo jogador, clique de munição esgotada e recarga, com cleanup em `destroy()`.

### 13.22 Deformação de rotação de juntas nos dedos esquerdos do Viewmodel
`ViewmodelArms.js:183-191` inverte os eixos do IK da mão esquerda em relação aos ossos de `TacticalManContinuous.js`, resultando em rotação anatômica distorcida dos dedos ao redor dos guarda-mãos das armas primárias.

### 13.23 Falta de trava de loadout com partida em andamento [RESOLVIDO]
`WeaponSystem.js` agora possui `loadoutLocked` ativado automaticamente quando `GameManager.startMatch()` inicia a partida. Chamadas a `setSlot()` durante o combate enfileiram a alteração em `pendingSlots` com notificação visual na HUD, aplicando a nova arma apenas no reinício da rodada/partida (`resetGame()`).

### 13.24 Cheats e depuração expostos durante gameplay [RESOLVIDO]
`Input.js` agora restringe a detecção de cheats no buffer de digitação de teclas a `CONFIG.DEV_MODE === true`. Foi integrado um Painel Dev & Cheats interativo na aba Ajustes do menu (`index.html` e `MenuController.js`) com botões dedicados e persistência via `localStorage`.

### 13.25 Recoil climbing neutralizado precocemente durante rajadas [RESOLVIDO]
Issue #9 no GitHub. `recoilRecoveryDelay = 0.08s` em `CameraRig.js` era menor que a cadência das armas (88–105ms), forçando a mira para baixo entre tiros consecutivos de uma mesma rajada e anulando o climbing. Resolvido com `recoveryDelay` dinâmico (`fireInterval * 2.2` ou mínimo de 0.24s) passado via `addRecoilImpulse()`, sustentando a subida cumulativa durante rajadas contínuas.

### 13.26 Piscar estroboscópico de 35ms na retícula dinâmica [RESOLVIDO]
Issue #10 no GitHub. O salto binário de `isResting` (0.0015 para 0.025 rad) somado ao decaimento em 2 frames da penalidade e ausência de lerp no `--gap` abriam e fechavam a mira de forma espasmódica. Resolvido com cálculo proporcional contínuo em `BallisticsCalculator.calculateCurrentSpread` e amortecimento inercial assimétrico (`lerpSpeed: 28.0` subida, `10.0` decaimento) em `CrosshairManager.js`.

### 13.27 Baseline Canônica MasterWeapon e Modo Zeroing no mapa Range [RESOLVIDO]
Arquitetura de balística pura desacoplada dos debuffs de armas individuais. Módulo `MasterWeapon.js` fornece baseline de 100% de precisão intrínseca, gravidade vertical pura e convergência tridimensional a 50m (`getConvergenceTarget` e `computeShotDirection`). No mapa Range (`range.json`) ou via `CONFIG.ZEROING.zeroingMode`, debuffs de dispersão, recuo e oscilação são desativados para calibração de miras e auditoria de modelos 3D, preservando rigorosamente a blindagem cinemática e de traçantes do `GEMINI.md`.

---

## 14. Playbooks de alteração

### 14.1 Adicionar arma
1. `assets/weapons/weapons.json`: entrada completa (copie `ar15` e ajuste `id`, `name`, `ammo`, stats, `ballistics`, poses, `muzzleLocal/sightLocal/ejectLocal`, `fireModes`, `mods`).
2. `assets/weapons/ammo.json`: reutilize uma munição existente ou crie uma; se criar, defina `tracerProfile`.
3. `assets/weapons/sfx/<id>_sfx.json`: copie `default_sfx.json`; **adicione o id em `ConfigLoader.js:133`** (`sfxIds`) senão o perfil não carrega.
4. `src/weapons/models/<Nome>.js`: builder retornando `Group` ou `{group, physics, ...}`; exporte.
5. `src/weapons/WeaponRegistry.js`: registre a arma com `{ builder, hasScope }` (povoa automaticamente `Viewmodel`, `ItemDrop` e `ScopeSystem`).
6. `src/weapons/ViewmodelArms.js`: socket `WEAPON_HAND_SOCKETS['<id>']` ou aceite o default.
7. `src/ui/WeaponPreview3D.js` / `ItemDrop` glow: se quiser cor por classe, ajuste (não há `type`).
8. `index.html`: opção no `#weapon-select` / `#weapon-secondary-select`.
9. Scope: se a arma tiver luneta, retorne `rearLens/frontLens/opticBody` e adicione ao `attachWeaponModel` em `main.js`.
10. Testes: `ballistics_test` varre `WEAPONS`; rode `npm test` + `node test/tracer_flash_profile_test.js`.

### 14.2 Adicionar mapa
1. Crie `assets/maps/<nome>.json` seguindo §10.4; `pos` de static é base; sem rotação.
2. Materiais: use nomes de §10.5 ou adicione a fábrica em `MaterialFactory.initMaterials` + gerador em `TextureGenerator`; registre em `PROP_MATERIAL_DEPS` se usar props.
3. Props: use tipos do switch `MapLoader.js:210-307`; se criar novo, adicione método em `ItalyProps` e case no switch.
4. Spawns: `playerSpawns` e `botSpawns`; garanta >11 m do player para bots.
5. `index.html`: opção em `#map-select`.
6. Teste: `node test/italy_map_test.js` (ele valida 4 mapas; adicione o novo se quiser cobertura) e abra no navegador.
7. Para PBR, `pbr:true` ou `props` não vazio; para mapas simples, sem props (usa `MATERIALS` legado).

### 14.3 Adicionar evento
1. Nomeie no padrão `dominio:acao` (`weapon:*`, `player:*`, `bot:*`, `round:*`, `inventory:*`).
2. Emita objeto (nunca múltiplos args).
3. Registre `on` no construtor e guarde o unsubscribe; desfaça em `destroy`.
4. Documente em §9 e no `AGENTS.md`.
5. Evite eventos por frame; use estado/update para alta frequência.

### 14.4 Ajustar gameplay
- Dano/velocidade/penetração → `weapons.json` (`ballistics.terminal`) + `ammo.json`.
- Cadência/mag/reload → `weapons.json`.
- Spread/recuo → `weapons.json` (`ballistics.external`) + `BallisticsCalculator`.
- Movimento/pulo/regen → `gameplay.json` (`CONFIG.PLAYER`).
- Bots → `bots.json` (`CONFIG.BOTS`).
- Headbob/shake → `gameplay.json` + menu/storage.
- FOV → `gameplay.json` + `main.js` (ADS/scope).
- Nunca duplique números em código se já existe chave de dados; se a chave não existe, adicione ao schema e ao loader.

### 14.5 Adicionar controle de UI
1. `index.html`: ID + markup na aba correta (`data-panel`).
2. `MenuController`: cache do elemento em `_bindDOM`/`_bind*UI`, listener, persistência.
3. `CONFIG` ou `CrosshairManager.config`/`AudioSystem.volumes` como estado.
4. Se afetar gameplay, leia no sistema correspondente (não no menu diretamente).
5. Restaure o valor salvo no boot.
6. Adicione teste headless com mock DOM quando possível (`loading_system_test`, `crosshair_manager.test`).

### 14.6 Adicionar VFX/áudio
- VFX: adicione pool em `Effects`, assine um evento existente, evite alocações por frame.
- Áudio: adicione preset em `SoundPresets`, método em `WeaponSynthesizer`/`TerminalBallistics`, roteie pelo bus correto (`weaponsGain`, `foleyGain`, `impactsGain`, `traumaGain`).
- **Não toque** na seção de tracers de `Effects.js` nem em `ammo.json` sem autorização explícita (`GEMINI.md`).

---

## 15. Checklist de definição de pronto (DoD)

- [ ] A mudança respeita a separação `fixedUpdate`/`renderUpdate`.
- [ ] Nenhum `on` novo sem unsubscribe em `destroy`.
- [ ] Nenhuma alocação nova em caminho quente (`update`, `_fire`, `_spawn*` por frame).
- [ ] Dados de balanceamento em JSON, não hardcoded (ou justificativa explícita).
- [ ] Nomes de DOM existentes; sem IDs duplicados; `body.in-gameplay` preservado.
- [ ] Armas: `muzzleLocal/sightLocal/ejectLocal` intactos; `GEMINI.md` respeitado.
- [ ] Mapas: AABB, bounds, spawns, materiais válidos.
- [ ] `npm test` verde; testes extras relevantes verdes.
- [ ] Teste manual no navegador via HTTP (não `file://`).
- [ ] `CHANGELOG.md` atualizado obrigatoriamente se scripts `.js` ou dados `.json` foram alterados.
- [ ] Documentação atualizada (`PROJECT_MAP.md`/`DEFECTS_AND_VULNERABILITIES.md` conforme o caso).
- [ ] Nenhum commit sem pedido explícito.

---

## 16. Manutenção deste mapa

- Atualize a seção afetada **no mesmo commit** da mudança de arquitetura.
- Se mover/renomear arquivo, atualize §2, §6, §7 e os atalhos §0.
- Se adicionar/remover evento, atualize §9.
- Se alterar schema JSON, atualize §10.
- Se alterar scripts `.js` ou dados `.json`, incremente obrigatoriamente o `CHANGELOG.md`.
- Se descobrir divergência nova, registre em §13 com evidência (`arquivo:linha`).
- Este mapa não substitui `GEMINI.md` (diretiva congelada) nem `AGENTS.md` (regras operacionais).

### 13.28 Desacoplamento de Gunplay, Zeroing Analítico, Stock-Pivot e Recuo CS2 [RESOLVIDO]
Normalização completa da cadeia de tiro: eliminação da convergência elástica em obstáculos próximos por substituição pelo cálculo analítico θ_zero a 50m em `MasterWeapon.js`; desacoplamento do frame 0 em `WeaponSystem.js`; cinemática de recuo Stock-Pivot com rotação ao redor do ombro direito e atenuação de 82% no ADS em `Viewmodel.js`; e controle de recuo 100% manual sem auto-recuperação pós-cessar fogo no `CameraRig.js` (estilo Counter-Strike 2).
