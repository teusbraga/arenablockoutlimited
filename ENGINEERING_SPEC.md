# Arena Blockout — Documento de Engenharia & Arquitetura
### Levantamento de Requisitos por Engenharia Reversa
> Produzido por análise cega do código-fonte. Simula o ponto de vista de um engenheiro que quer clonar o produto do zero.

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Arquitetura de Alto Nível](#3-arquitetura-de-alto-nível)
4. [Módulos e Subsistemas](#4-módulos-e-subsistemas)
   - 4.1 [Core Engine](#41-core-engine)
   - 4.2 [Mundo e Física](#42-mundo-e-física)
   - 4.3 [Sistema de Armas](#43-sistema-de-armas)
   - 4.4 [IA e Entidades](#44-ia-e-entidades)
   - 4.5 [Efeitos Visuais (FX)](#45-efeitos-visuais-fx)
   - 4.6 [Interface e HUD](#46-interface-e-hud)
   - 4.7 [Sistema de Áudio](#47-sistema-de-áudio)
   - 4.8 [Novas Mecânicas](#48-novas-mecânicas)
5. [Catálogo de Armas](#5-catálogo-de-armas)
6. [Sistema de Dados (Data-Driven)](#6-sistema-de-dados-data-driven)
7. [EventBus — Barramento de Eventos](#7-eventbus--barramento-de-eventos)
8. [Fluxo de Inicialização](#8-fluxo-de-inicialização)
9. [Requisitos Funcionais](#9-requisitos-funcionais)
10. [Requisitos Não-Funcionais](#10-requisitos-não-funcionais)
11. [Estrutura de Diretórios Recomendada](#11-estrutura-de-diretórios-recomendada)

---

## 1. Visão Geral do Produto

**Arena Blockout: Limited** é um **FPS (First-Person Shooter) 3D para navegador web**, jogável sem instalação, com suporte a dispositivos móveis (PWA). O jogo se inspira visivelmente em Counter-Strike (layout de mapa, identidade visual blocky), mas com mecânicas de balística e sistemas táticos de jogos modernos como *Escape from Tarkov* e *CS2*.

### Características Identificadas

| Característica | Detalhe |
|---|---|
| Perspectiva | Primeira pessoa (1ª), com alternância opcional para 3ª pessoa |
| Modo de Jogo | PvE solo — Jogador vs Bots em rounds cronometrados |
| Mapa Identificado | "CS Italy" — Inspirado no mapa Italy do Counter-Strike |
| Bots | IA com FSM de 4 estados (Patrulha, Combate, Busca, Fuga) |
| Armas Jogáveis | 9 armas únicas, 2 slots táticos simultâneos |
| Plataforma | Navegador Web (Chrome, Firefox, Edge, Safari) |
| Mobile | PWA instalável com controles touch virtuais |
| Offline | Service Worker com cache Network-First |
| Idioma | Interface em Português (BR) |

---

## 2. Stack Tecnológica

```
Renderer:        Three.js v0.186+   (WebGL, sem engine externa)
Linguagem:       JavaScript ES Modules (tipo "module")
Runtime:         Navegador Web / Node.js para testes headless
Física:          Custom AABB + Spatial Hash Grid (vanilla JS)
Áudio:           Web Audio API (síntese procedural, sem arquivos mp3)
Texturas:        Canvas 2D API (geração procedural em CPU)
PWA:             Web App Manifest + Service Worker (cache offline)
Testes:          Node.js test runner (headless, 12 suítes)
Dep. de Produção: three ^0.186.1 (única dep. de runtime)
```

**Não há:**
- Framework de UI (React, Vue, Angular)
- Biblioteca de física externa (Cannon.js, Rapier, Ammo.js)
- Assets de modelos 3D externos (.gltf, .obj, .fbx)
- Assets de texturas externos (.png, .jpg) — exceto opcionalmente por upload do usuário
- Assets de áudio externos (.mp3, .ogg) — síntese procedural total

---

## 3. Arquitetura de Alto Nível

```
┌──────────────────────────────────────────────────────────────────────┐
│                      NAVEGADOR / PWA                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                         index.html                              │  │
│  │  Canvas #app │ HUD DOM │ Menus DOM │ Mobile Controls DOM        │  │
│  └───────────────────────┬────────────────────────────────────────┘  │
│                          │ ES Modules                                  │
│  ┌───────────────────────▼────────────────────────────────────────┐  │
│  │                        src/main.js                              │  │
│  │              Bootstrap assíncrono + Game Loop                   │  │
│  └──┬──────────────┬─────────────┬──────────────┬─────────────────┘  │
│     │              │             │              │                      │
│  ┌──▼──┐      ┌────▼────┐  ┌────▼────┐  ┌─────▼──────┐             │
│  │Core │      │ World & │  │Weapons  │  │Entities &  │             │
│  │Engine│     │Physics  │  │& FX     │  │AI          │             │
│  └──┬──┘      └────┬────┘  └────┬────┘  └─────┬──────┘             │
│     │              │             │              │                      │
│     └──────────────┴─────────────┴──────────────┘                    │
│                              │                                        │
│                         EventBus.js                                   │
│                    (Pub/Sub, zero dependências)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Dual-Rate Game Loop

O motor executa dois loops desacoplados, seguindo o padrão "Fix Your Timestep" de Glenn Fiedler:

```
requestAnimationFrame
        │
        ▼
   Engine.frame()
        │
        ├─── Acumula delta time
        │
        ├─── fixedUpdate (até 5 sub-steps / frame)
        │    ├── 120 Hz deterministico
        │    ├── Física de personagens (moveAndSlide)
        │    ├── CCD de projéteis
        │    ├── IA dos bots (throttled 10 Hz)
        │    └── GameManager (round, spawns, interações)
        │
        └─── renderUpdate (taxa variável — rAF)
             ├── Interpolação de posição (alpha = acc/fixedDt)
             ├── CameraRig (springs, recoil, headbob)
             ├── Viewmodel (sway, muzzle flash)
             ├── HUD (ammo, hp, timer)
             ├── BarrelCrosshairAlignment
             └── ScopeSystem (render pass PIP)
```

---

## 4. Módulos e Subsistemas

### 4.1 Core Engine

#### `Engine.js` — Motor de Loop
- Implementa acumulador de tempo fixo com "spiral-of-death guard" (máximo 5 sub-steps por frame)
- `fixedDt` configurável (padrão `1/60`, sobrescrito para `1/120` em `CONFIG.PHYSICS`)
- Recebe callbacks `fixedUpdate(dt)` e `renderUpdate(alpha, dt)`

#### `EventBus.js` — Barramento Pub/Sub
- `Map<string, Set<Function>>` — zero dependências
- `on(type, fn)` → retorna unsubscribe closure
- `emit(type, detail)` — síncrono, com `try/catch` por handler
- Atua como sistema nervoso central do projeto inteiro

#### `ConfigLoader.js` — Configuração Data-Driven
- `DEFAULT_CONFIG` hardcoded como fallback seguro
- Carrega JSONs remotos via `Promise.allSettled` (tolerante a falhas)
- `deepMerge(target, source)` recursivo
- Categorias: `PLAYER`, `CAMERA`, `PHYSICS`, `BOTS`, `SWAY`, `GUNPLAY`, `ACCESSIBILITY`, `CHEATS`

#### `CameraRig.js` — Sistema Cinético de Câmera
- Spring analyticamente amortecido (`smoothDamp` — critically damped)
- Camadas de motion:
  - **L0:** Intent (mouse → targetYaw/targetPitch)
  - **L1:** Inércia de cabeça + rate limits de rotação
  - **L1.5:** Lean tático (Q/E) com offset lateral
  - **L2:** Recuo (pitch climb permanente + punch elástico 500Hz sub-step)
  - **L3/L4:** angularVelocity exposto para sway do viewmodel
  - **Locomotion:** Headbob (roll, pitch, translação) por superfície
- Perspectiva 1ª/3ª pessoa via Spring-Arm com raycast anti-clip

#### `Input.js` — Input Unificado Desktop
- Proxy JavaScript transparente sobre mapeamento de teclas
- Action aliases: camelCase e snake_case unificados
- Queue de ações discretas (`isActionJustPressed`)
- Accumulation de mouse delta (`consumeMouseDelta`)
- Pointer Lock + Keyboard Lock (`navigator.keyboard.lock`)
- Cheat codes bufferizados: `GETTHEREFAST`, `PROFESSIONALKILLER`, `BAGUVIX`

#### `TouchInput.js` — Controles Mobile
- Joystick analógico flutuante (left half da tela)
  - Auto-sprint acima de 75% de travel
- Look touchpad (right half da tela)
- Botões: Atirar (3 posições), ADS, Agachar, Recarregar, Trocar Arma, Granada de Fumaça, Interagir, Pausar

#### `SceneSetup.js` — Pipeline de Renderização
- WebGLRenderer: `powerPreference: 'high-performance'`, `PCFSoftShadowMap`, `ACESFilmicToneMapping`, espaço sRGB
- Three-point lighting rig: Ambient + Hemisphere + Directional Sun (com shadow frustum calibrado) + Fill
- Muzzle flash ambiental: ao escutar `weapon:fired`, pulsa a `AmbientLight` por 45ms

#### `SceneSetup` — Configurações
```
pixelRatio:  min(devicePixelRatio, 2.0)  // otimizado mobile
shadowMap:   PCFSoftShadowMap
toneMapping: ACESFilmicToneMapping
fog:         Linear (configurado por mapa no italy.json)
```

---

### 4.2 Mundo e Física

#### `CollisionWorld.js` — Motor de Física AABB
- **100% agnóstico** de Three.js — opera em vetores escalares puros
- Spatial Hash Grid 2D (`cellSize = 4.0m`)
- AABB por convenção de bottom-center (`pos = pés da entidade`)

**Algoritmos implementados:**
- `moveAndSlide(pos, size, delta, opts)`: resolução desacoplada Y → X → Z
  - Detecção de chão (`onGround`), teto (`hitCeiling`), material do chão (`groundMaterial`)
  - Step-Up automático para degraus (altura configurável, padrão `0.55m`)
- `raycast(origin, dir, maxDist)`: Slab Method (Kay-Kajiya)
  - Retorna `{ box, distance, exitDistance, thickness, normal, point }`
  - Usado por: balística, penetração de parede, audio occlusion

**Metadados por box:**
```javascript
{ solid: bool, vaultable: bool, meta: { material, isTrigger, itemDrop, ... } }
```

#### `MapLoader.js` — Carregador de Mapas JSON
- Pipeline completo: fetch → parse → texturas → geometrias → colisão
- **Instanced Meshes**: agrupa geometrias estáticas do mesmo material em um único `THREE.InstancedMesh` por draw call
- **Triplanar Shader**: injeta world-space UV via `onBeforeCompile` para eliminar esticamentos
- Retorna: `{ world, doors, bounds, materialFactory, playerSpawns, botSpawns }`

**Estrutura de `italy.json` (mapa):**
```json
{
  "name": "CS Italy (Texture Test Map)",
  "size": [64, 64],
  "bounds": [-30, 30, -30, 30],
  "floorMaterial": "cobblestones",
  "environment": { "fogColor": "#d6be9c", "fogNear": 48, "fogFar": 120 },
  "staticGeometry": [ ...blocos com material, posição, vaultable ],
  "props": [ ...instâncias de props compostos ],
  "doors": [ ...portas interativas ],
  "playerSpawns": [ [x, y, z], ... ],
  "botSpawns": [ [x, y, z], ... ]
}
```

#### `MaterialFactory.js` — Catálogo PBR Lazy
- Instanciação sob demanda (sem freeze no boot)
- Shader Triplanar World-Space UV via `onBeforeCompile`:
  ```glsl
  vec2 getWorldProjectedUV() {
    vec3 n = abs(vWorldNormalVec);
    if (n.y > 0.6)      return vWorldPos.xz * scale;
    else if (n.x > 0.6) return vWorldPos.zy * scale;
    else                return vWorldPos.xy * scale;
  }
  ```
- Modos: `pbr` (diffuse + bump + roughness), `flat_textures`, `color_only`

#### `TextureGenerator.js` — Gerador Procedural de Texturas
Gera texturas PBR inteiramente no canvas HTML5 2D (sem imagens externas):
- **Noise:** `pseudoRandom` (hash 32-bit determinístico), `valueNoise` (Hermite), `fbm` (fractal Brownian motion)
- **Catálogo de Texturas CS Italy:** cobblestones, peeling wall, rustic wood door, window shutters, roof tiles, ivy foliage, wine barrel, wine crate, striped awning, stone arch
- **Outros Biomas:** grass, dirt, sand, stone, jungle, military

#### `Door.js` — Portas Dinâmicas
- Estado: `closed → opening → open → closing`
- Pivot lateral (dobradiça), ângulo de abertura `~99°` (PI × 0.55 rad), velocidade `3.2 rad/s`
- AABB no `CollisionWorld` — sólida apenas quando `openness < 0.2`
- `interactRange = 2.2m`, evento `door:toggle`

#### `ItalyProps.js` — Fábrica de Props Compostos
Cria grupos Three.js com hitboxes sincronizadas no `CollisionWorld`:
- **CS Italy:** janelas com venezianas, arcos de pedra, sacadas, hera, barris de vinho, barracas de feira, lanternas de rua (com `PointLight` real)
- **Village:** árvores, cercas rústicas, poço, chaminé, fardos de feno
- **Desert/Dust:** palmeiras procedurais (22 folhas), arcos árabes, caixotes militares, barris de óleo
- **Woods/Jungle:** árvores gigantes (14m, raízes sapopembas), guarita escalável, ruínas antigas, tenda camo

#### `ItemDrop.js` — Itens no Chão
- Hitbox trigger desacoplada no `CollisionWorld` (`solid: false, isTrigger: true`)
- Visual: modelo 3D cacheado, halo emissivo no solo (cor por categoria), animação de flutuação + rotação
- Coleta por distância 2D (`< 1.4m`)
- Limite de 2 drops simultâneos no mundo

---

### 4.3 Sistema de Armas

#### `WeaponDefs.js` — Compilador de Definições
Pipeline de compilação imutável em boot:
1. Clona definição base do `weapons.json`
2. Sobrescreve parâmetros balísticos com dados do `ammo.json`
3. Aplica modificações de acessórios (mods)
4. Normaliza via `normalizeBallistics()`
5. Expõe dicionário `WEAPONS` consumido por todos os sistemas

#### `WeaponSystem.js` — Controller de Armas do Jogador
- **Inventário:** 2 slots táticos (`slot0`, `slot1`)
- **Modos de Fogo:** `auto` / `semi` por arma (persistido por `fireModeByWeapon`)
- **Rastreamento de Balas:** `ammoByWeapon` por weapon ID
- **Wall Compression:** `0→1` — se `> 0.45`, bloqueia disparo e exibe "CANO OBSTRUÍDO"
- **Strafe Compensation:** offset cinemático `player.pos - player.prevPos` para eliminar jitter traçante
- **Spray Recoil:** acumulador CS2-style de pitch/yaw persistente

**Fluxo de `_fire()`:**
1. Verifica wall compression
2. Decrementa munição, seta cooldown
3. `BallisticsCalculator.calculateRecoilImpulse()` → entrega para `CameraRig`
4. Kick no viewmodel + muzzle flash + animação de slide
5. `muzzleLocal` + `ejectLocal` → coordenadas de mundo
6. Spawna projéteis em `ProjectileManager`
7. Para shotgun: 1 pellet central + 6 em cone concêntrico

#### `BallisticsCalculator.js` — Calculadora Balística Pura (Stateless)
- `calculateCurrentSpread(def, state)`: spread base + ADS damping + strafe + sprint + sway + heat
- `calculateRecoilImpulse(def, consecutiveShots, isAds)`: pitch, yaw, Z-kickback com spray patterns únicos por arma:
  - `kick_right` (AK-47), `linear_left` (HK416), `spray_wide` (UZI), `vertical_snap` (P-9), `heavy_churn` (M249), `standard`
- `calculateSway(def, time, isAds, speedRatio)`: curvas harmônicas de Lissajous
- `calculateTerminalImpact(def, distance, hitPart)`: falloff linear de dano + queda balística

#### `ProjectileManager.js` — Simulação Balística CCD
- Pool de 256 `Projectile` pré-alocados
- **CCD Sweep:** `vel.y -= g × dt`, drag, wind vector, sweep de `prevPos → nextPos`
- **Hit Detection híbrido:**
  - WebGL: raycasting contra meshes Three.js
  - Headless: AABB slab method contra bounding box do bot (0.9m × 1.85m), classifica `head` (≥ 1.35m) ou `body`
- **Penetração de Paredes (Wallbang):**
  - Resistência por material: Madeira 0.35, Sandbag/Reboco 0.50, Concreto/Pedra 1.10, Metal/Aço 2.40
  - Se `penetrationPower ≥ thickness × resistance` → passa com -25% a -40% de velocidade
- **Ricochete Angular:** superfícies duras, ângulo < 25°, reflexão vetorial com 40% de perda cinética
- **Supressão Tática:** projétil a < 2.4m → camera shake, tunnel vision, `player:suppression`
- **Traçante Desacoplado:** `tracer:fire` emitido no frame 0 com ponto de impacto estimado

#### `Viewmodel.js` — Viewmodel 3D em 1ª Pessoa
Hierarquia: `camera → swayGroup → mount → [modelos 3D, flashLight, flashGroup]`
- **Spring Dynamics:** massa do arma afeta K/D do spring, `massFactor = weight/3.5kg`
- **Pose Blending:** `hip → ads → sprint` com wall-press (+75° de barril vertical)
- **Muzzle Flash Volumétrico:** 4 planos cruzados aditivos + PointLight dinâmico

#### `ScopeSystem.js` — Mira Telescópica PIP
- Camera 2 (`scopeCamera`) com FOV `2° – 30°`
- Render Target `512×512` offscreen
- **GLSL Shader:**
  - Barrel distortion: `uv = 0.5 + p × (1 - 0.10 × r²)`
  - Aberração cromática: offsets RGB `ca = p × 0.006 × r²`
  - Shading de paredes do tubo com parallax
- **Reticles:**
  - `duplex`: SVG crosshair com mil-ticks + ponto vermelho central
  - `pso1`: Reticle autentica PSO-1 soviética com chevrons de alcance (100–400m) e rangefinder
- Sensibilidade trigonométrica: `tan(FOV_scope/2) / tan(FOV_ads/2)`

#### `SmokeGrenade.js` / `SmokeGrenadeManager.js`
- Física: lançamento a `15m/s` + `[0, 2.8, 0]`, gravidade `-9.8 m/s²`, até 3 ricochetes
- Detona após 3 ricochetes OU 1.3s de voo
- Nuvem: 14 puffs icosaédricos expandindo até `4.2m` de raio, duração `10s`
- Cooldown de lançamento: `30s`

---

### 4.4 IA e Entidades

#### `Character.js` — Classe Base de Entidade
- `pos`, `prevPos`, `renderPos` para interpolação fixed-step
- `size: Vector3(0.6, 1.8, 0.6)` AABB de colisão
- `applyPhysics(dt, stepHeight)` → `world.moveAndSlide()`
- Suporte a `takeDamage`, `die`, `respawn`

#### `Player.js` — Entidade do Jogador
- Componentes: `CameraRig (this.rig)`, `CharacterView (this.view)`
- Estados: `sprinting`, `crouched`, `ads`, `lean/targetLean` (Q/E tático), `crouchAmount` (interpolado)
- Regeneração de vida após delay (`regenDelay`)
- Godmode via `CONFIG.CHEATS.godMode`
- Emite: `player:damaged`, `player:hp`, `player:footstep`, `player:respawn_tick`

#### `Bot.js` — Entidade Bot
- `skinType: 'soldier' | 'ghost'`
- Componentes: `AIController (this.ai)`, `CharacterView (this.view)`
- `lean/targetLean` para espiar em cantos
- `hittables()` → retorna meshes para raycast com `userData: { type:'character', part:'head'|'body' }`

#### `AIController.js` — Cérebro da IA
**Sensores:**
- **Visão Throttled (10 Hz):** raycast `bot.pos.y+1.4 → player.pos.y+1.4` a cada 100ms ± jitter
- **Audição:** escuta `weapon:fired`; se em patrulha e < 35m → `lastKnownPlayerPos` → SearchState
- **Supressão Balística:** `applySuppression(intensity)` — acumula e penaliza precisão em até 55%

**Disparo:**
- Calcula muzzle em world space via quaternion do bot
- Precisão por distância + penalidade de supressão
- Quasi-miss: projeta vetor a 0.6–2.3m da cabeça do player → gera supressão tática

#### Máquina de Estados (FSM)

```
PatrolState ──(canSee)──────────────────────► EngageState
     ▲                                              │
     │                                    (lost + 1.6s memória)
     │                                              │
     │                                              ▼
     │                                         SearchState
     │                                              │
     │                                    (expirou searchTime=3.5s)
     │                                              │
     └──────────────────────────────────────────────┘
                                                    ▼
                                               FleeState
                                          (hp<30 ou supressão>0.65)
```

| Estado | Comportamento Chave |
|---|---|
| **Patrol** | Navega para alvo aleatório (~16m raio), 70% walkSpeed |
| **Engage** | Strafe tático alternado (0.6–1.8s), controle de distância (avança >14m, recua <5m), burst fire auto (2–4 tiros), lean procedural |
| **Search** | Vai a `lastKnownPlayerPos` a 100% walkSpeed, máx 3.5s |
| **Flee** | Foge oposto ao player com scatter angular, sprint speed, 3–5s |

#### `CharacterView.js` — Modelo Visual 3D
**Tipos de skin:**
1. **Soldier:** 4 paletas de camuflagem, colete tático, capacete balístico, óculos táticos, modelo de rifle em blocos
2. **Ghost:** cúpula esférica, corpo cilíndrico, olhos esféricos

**Animação Procedural:**
- Ciclo de passos alternado com oscilação do tronco
- Lean tático: rotação Z + translação X (~11.5° / 15cm)
- Pitch vertical: pescoço e braços seguem o ângulo de mira
- **Torso Twist:** pernas alinham com vetor de movimento; tronco pode girar ±72° desacoplado

**Spawning (via `GameManager`):**
- Valida pontos pré-definidos → busca aleatória (mín. 3m de props, 11m do player, 2.5m de outros bots)
- Lock-in de respawn: reserva coordenada por 4s de cooldown

---

### 4.5 Efeitos Visuais (FX)

#### `Effects.js` — Sistema de Partículas com Object Pooling

| Pool | Capacidade | Descrição |
|---|---|---|
| Tracers | 120 | Cilindros concêntricos (core filament + glow halo) com ring buffer temporal de 8 amostras |
| Sparks | 80 | Esferas com gravidade, drag, bounce no chão |
| Proto Sparks | 90 | `THREE.Points` buffer geometry, scatter de muzzle |
| Muzzle Smoke | 40 | Cone de descarga + smoke residual térmico |
| Proto Smoke | 16 | Billboard camera-facing, textura radial procedural |
| Shell Casings | 24 | Cartucho de latão + shell 12ga vermelha, com física de tumble e bounce |
| Blood Voxels | 180 | `InstancedMesh` GPU draw único, 6 tons carmesim, parábola balística |
| Ghost Smoke | 60 | Poof de cartoon para bots ghost |

**Modos de Traçante:**
- `swipe` (CS2 FlashTracer): head viaja ~19ms, tail segue com delay, colinear no world space
- `photographic`: modelo de exposição de câmera com persistência retinal
- `laser`: plasma beam, ~11ms, zero strafe lag
- `streak/parabola`: ponto de bala visível com drop gravitacional

---

### 4.6 Interface e HUD

#### `HUD.js` — Display Principal
- **Health:** `#hp-num`, `#hp-hud` com flash animado
- **Ammo Counter:** `#ammo-num`, `#ammo-max`
- **Weapon Slots:** pills clicáveis `#slot-1-pill`, `#slot-2-pill`, indicador de fire mode
- **Scoreboard:** K/D + timer de round
- **Killfeed:** máx 5 itens, auto-fade, combo popups (Double Kill, Triple Kill, Headshot)
- **Damage Indicator 2D:** canvas radial, arco de 0.32rad (damage) / 0.24rad (suppression), deduplicação angular (< 23° de diferença)
- **Screen Overlays:** flash vermelho de dano, blur de supressão, tela de morte, tela de fim de round
- **Hitmarkers:** standard + shotgun descentralizado (coordenadas de tela reais de cada pellet)
- **Inventory Modal:** slots de equipamento + grid 4×4 de mochila

#### `CrosshairManager.js` — Mira Customizável CS2-Style
- Persistido em `localStorage` (`blocky_crosshair_settings`)
- CSS Custom Properties (`--ch-color`, `--ch-len`, `--ch-thick`, `--ch-gap`, `--ch-shadow`)
- Shapes: `cross`, `t_shape`, `none`
- **3 eixos independentes de atualização:**
  1. **Modo (Dispersão):** `static` (gap fixo) vs `dynamic` (gap abre com spread: `(spread - 0.015) × 450`)
  2. **Alinhamento 3D do Cano:** projeção 2D do muzzle world → screen vs centrado
  3. **Follow Recoil:** translação em px do spray acumulado (`pixelsPerRad = screenH / (2 × tan(FOV/2))`)
- Exibe `#crosshair-no-fire` quando `wallCompression > 0.45`

#### `MenuController.js` — Menu Principal
- Tabs: General, Áudio/Vídeo, Controles/Crosshair, Texturas
- Seleção de mapa, arma primária, arma secundária, skin de bot
- Sliders: quantidade de bots, duração do round, sensibilidade, headbob, screen shake, vibração mobile
- Seletor de Texture Mode: `pbr`, `flat_textures`, `color_only`
- Upload de textura custom
- Configuração completa de crosshair sincronizada com `CrosshairManager`

#### `LoadingScreen.js` — Tela de Carregamento Tático
- Barra de progresso com texto de status por etapa
- "PRONTO PARA COMBATE" → fade-out suave após 280ms

---

### 4.7 Sistema de Áudio

#### `AudioSystem.js` — Motor de Áudio Procedural
**Síntese Web Audio API** — zero arquivos de áudio:

| Som | Técnica |
|---|---|
| Rifle Prototype | Buffer de ruído → lowpass 2400Hz → sine sweep 165→48Hz |
| SW500 Magnum | Shockwave resonante 3200→160Hz + sub-bass 130→25Hz + sawtooth crack |
| M12 Shotgun | Explosive 4200→220Hz + thump 140→30Hz + snap 320→45Hz |
| Pump-action rack | Back: triangle slide + square clack / Forward: square lock + sine thud |
| Dry fire | Square click 900Hz |
| Passos por superfície | Triangle (madeira), Square (metal), Sine (areia), Triangle (concreto) |

**3D Spatial Audio:**
- `PannerNode` com modelo HRTF, `distanceModel: 'inverse'`, refDist 2m, maxDist 60m
- **Oclusão por Raycast:** linha de visão no `CollisionWorld` → se ocluído: lowpass biquad 13–14kHz → 550Hz, Q 1.3–1.4, gain -60%
- Loops espaciais contínuos (smoke hiss) com fade-out exponencial 2s

---

### 4.8 Novas Mecânicas

#### `AimAssistSystem.js` — Aim Assist (Gamepad/Mobile)
- **Bubble de Fricção:** 56–58% redução de sensibilidade quando crosshair entra em `~15°` do inimigo
- **Magnetismo Rotacional:** puxa yaw/pitch para o peitoral (`targetHeightOffset = 1.18–1.24m`) com lead de velocidade (`0.042s`)
- **Inner Deadzone:** `~0.37°` — permite micro-ajustes para headshot sem lutar contra o magnetismo
- **ADS Snap-In:** janela de 0.15s de convergência rápida ao entrar em ADS
- Performance: O(N) screening, zero allocations, máx 1 raycast por frame

#### `BarrelCrosshairAlignment.js` — Alinhamento Cano ↔ Mira
- Extrai posição do muzzle via `Viewmodel.mount.localToWorld(muzzleLocal)`
- **Projeção 1 (Sway/Parallax):** projeta vetor do barrel no mundo → `camera.project()` → coordenadas 2D do `#crosshair`
- **Projeção 2 (Balística):** calcula `getFiringDirection()` real incluindo recuo → garante que balas saiam exatamente para onde a mira aponta

#### `TacticalInventorySystem.js` — Inventário Tático
- Slots de equipamento: Arma Primária, Secundária, Colete (Classe 3, 50 de durabilidade), Capacete (Classe 2, 30 de durabilidade), Mochila (grid 4×4)
- 16 slots de storage: ammo stackável (5.56mm, 9mm), medikit (+50 HP), granadas de fumaça
- Peso máximo: `40.0 kg`

---

## 5. Catálogo de Armas

| ID | Nome | Base Real | Categoria | Calibre | Magazine | Cadência | Physics Class |
|---|---|---|---|---|---|---|---|
| `ak47` | AK-47 | AK-47 / AKM | Assault Rifle | 7.62x39mm Soviet | 30 | 0.10s | Viewmodel Spring |
| `ar15` | HK416 | HK416 A5 | Assault Carbine | 5.56x45mm NATO | 30 | 0.09s | Viewmodel Spring |
| `m249` | M249 SAW | FN Minimi M249 | Light Machine Gun | 5.56x45mm NATO linked | 100 | 0.082s | Viewmodel Spring |
| `p9` | P-9 | FN Five-seveN / Glock | Pistol | 5.7x28mm FN | 12 | 0.16s | `P9Physics` (slide blowback) |
| `rifle_proto` | Rifle Prototype | AAC Honey Badger / SIG MCX | Assault Carbine | Energy Cell | 30 | 0.085s | `PrototypePhysics` (bolt BCG) |
| `sw500` | S&W 500 | S&W Model 500 (8.38" bbl) | Heavy Revolver | .500 S&W Magnum | 6 | 1.10s | `SW500Physics` (cylinder + hammer) |
| `uzi` | UZI | IMI UZI | Submachine Gun | 9x19mm Para | 32 | 0.065s | Viewmodel Spring |
| `vss` | VSS Vintorez | VSS Vintorez | Integrally Suppressed DMR | 9x39mm SP-5 | 20 | 0.085s | `VSSPhysics` (bolt + PSO-1 scope PIP) |
| `m12` | Winchester M12 | Winchester Model 1912 Trench Gun | Pump Shotgun | 12 Gauge (7 pellets) | 6 | 0.65s | `M12Physics` (pump FSM 5 estados) |

### Acessórios Identificados
- `heavyBarrel`: recoil ×0.8, adsTime ×1.2, spread ×0.85
- `lightGrip`: adsTime ×0.8, spread ×1.1
- `redDot`: adsFov 50°, adsSightDistance 0.28m

---

## 6. Sistema de Dados (Data-Driven)

### `assets/weapons/weapons.json`
Parâmetros por arma:
- **Mecânicos:** `auto`, `fireModes[]`, `weight`, `fireInterval`, `magSize`, `reloadTime`, `pellets`, `pelletSpread`
- **Espaciais (vectors 3D):** `hipPos`, `hipRot`, `adsRot`, `sprintPos`, `sprintRot`, `sightLocal`, `muzzleLocal`, `ejectLocal`, `adsSightDistance`
- **Recuo:** `recoilPitch`, `recoilYaw`, `recoilYawBias`, `spreadHip`, `spreadAds`, `kickbackZ`, `kickRotFactor`
- **Fumaça:** `smokeConeOpacity`, `smokeResidualMax`, `smokeResidualColor`
- **Balística:** objeto tri-fase `internal`, `external`, `terminal`

### `assets/weapons/ammo.json`
Parâmetros por calibre:
- `bulletSpeed` (m/s), `bulletDrop` (m/s²), `penetrationPower` (0.0–1.0), `maxPenetrations`, `ricochetChance`
- `tracerProfile`: `style`, `ttl`, `headSpeed`, `streakLength`, `lengthMultiplier`, cores, raios, brilho
- `flashProfile`: tamanho, opacidade, intensidade de luz, duração

### `assets/maps/italy.json`
- `staticGeometry[]`, `props[]`, `doors[]`, `playerSpawns[]`, `botSpawns[]`, `environment{}`

### `assets/configs/gameplay.json`, `bots.json`, `audio.json`
- Parâmetros de jogo, configurações de bot, parâmetros de síntese de áudio

---

## 7. EventBus — Barramento de Eventos

### Eventos de Armas
| Evento | Origem | Payload |
|---|---|---|
| `weapon:equipped` | WeaponSystem | `{ id, name, fireMode }` |
| `weapon:ammo` | WeaponSystem | `{ ammo, max }` |
| `weapon:firemode` | WeaponSystem | `{ fireMode, canToggle }` |
| `weapon:slots` | WeaponSystem | `{ slots, currentSlot }` |
| `weapon:reload:start` | WeaponSystem | — |
| `weapon:reload:end` | WeaponSystem | — |
| `weapon:empty` | WeaponSystem | — |
| `weapon:fired` | WeaponSystem | `{ weapon, muzzleWorld, ejectWorld, forward, ... }` |
| `weapon:smoke:residual` | WeaponSystem | `{ muzzleWorld, count, color }` |
| `weapon:pump` | M12Physics | `{ stage: 'back'|'forward' }` |
| `weapon:manual_eject_fx` | M12Physics | `{ pos, dir }` |

### Eventos Balísticos
| Evento | Origem | Payload |
|---|---|---|
| `tracer:fire` | ProjectileManager | `{ origin, end, speed, color, profile, ... }` |
| `shot:bot` | ProjectileManager | `{ point, headshot, killed, distance, soundDelay, ... }` |
| `shot:world` | ProjectileManager | `{ point, box, material, normal, distance, soundDelay }` |
| `shot:penetration` | ProjectileManager | `{ entryPoint, exitPoint, material, thickness, ... }` |
| `shot:ricochet` | ProjectileManager | `{ point, normal, material, distance, ... }` |
| `player:suppression` | ProjectileManager | `{ pos, source, intensity, distance }` |
| `bot:suppressed` | ProjectileManager | `{ bot, intensity, distance }` |

### Eventos de Jogo
| Evento | Origem | Payload |
|---|---|---|
| `player:damaged` | Player | `{ dmg, from }` |
| `player:hp` | Player/GameManager | `{ hp, max }` |
| `player:footstep` | Player | `{ material }` |
| `player:respawn_tick` | Player | `{ t }` |
| `bot:damaged` | Bot | `{ id, part }` |
| `bot:died` | GameManager | `{ bot }` |
| `bot:fired` | AIController | `{ bot, dir, weapon }` |
| `round:timer` | GameManager | `{ time }` |
| `round:over` | GameManager | `{ winner, stats }` |
| `game:reset` | GameManager | — |
| `kill:combo` | GameManager | `{ count, headshot }` |
| `interact:target` | GameManager | `{ type, label }` |
| `notification` | GameManager | `{ text }` |
| `door:toggle` | Door | `{ id }` |
| `smoke:thrown` | SmokeGrenadeManager | `{ remainingCooldown }` |
| `smoke:bounce` | SmokeGrenade | — |
| `smoke:detonate` | SmokeGrenade | `{ id, pos, duration }` |
| `smoke:stop` | SmokeGrenade | `{ id }` |

### Eventos de Input/UI
| Evento | Origem |
|---|---|
| `input:lock` | Input |
| `input:zoom-toggle` | TouchInput |
| `inventory:toggle` | Input/TouchInput |
| `hud:popup` | Input (cheats) |
| `cheat:activated` | Input |

---

## 8. Fluxo de Inicialização

```
async boot() {
  1. ConfigLoader.loadAll()         // JSONs de config
  2. LoadingScreen.show(mapName)    // Tela de loading
  3. SceneSetup()                   // Three.js renderer, camera, luzes
  4. Input(), TouchInput()          // Input unificado
  5. AudioSystem()                  // Web Audio context
  6. loadMap(url, scene)            // MapLoader → CollisionWorld, props, doors
     ├── MaterialFactory.preloadMaterials()  // TextureGenerator PBR
     ├── InstancedMesh por material
     ├── ItalyProps (compostos + hitboxes)
     └── CollisionWorld populado
  7. Player(world, scene, camera)   // Entidade do jogador
  8. WeaponDefs.initWeaponsFromData()  // Compilar WEAPONS dict
  9. WeaponSystem(), ProjectileManager()  // Armas e balística
  10. buildWeaponModels()           // Modelos 3D procedurais de armas
  11. Viewmodel(), ScopeSystem()    // Viewmodel + PIP scope
  12. Effects(scene, world)         // Sistema de partículas
  13. HUD(), CrosshairManager()     // Interface
  14. GameManager(bots, world, ...)  // Bots, rounds, drops
  15. new_mechanics: BarrelAlignment, AimAssist, Inventory
  16. SmokeGrenadeManager()
  17. MenuController()
  18. LoadingScreen.hide()
  19. startEngine({ fixedUpdate, renderUpdate, fixedDt: 1/120 })
}
```

---

## 9. Levantamento Detalhado de Requisitos Funcionais (RFs)

### 9.1 Motor, Loop & Renderização
- **RF-01 (Dual-Rate Desacoplado):** O motor deve executar um loop desacoplado com simulação física fixa a 120Hz (`fixedDt = 1/120s`) e renderização variável atrelada ao `requestAnimationFrame` da GPU.
- **RF-02 (Spiral-of-Death Guard):** O acumulador de tempo do motor deve limitar a no máximo 5 sub-passos de física por frame para evitar travamento da aba do navegador em quedas severas de framerate.
- **RF-03 (Interpolação de Estado Visual):** Todas as entidades dinâmicas (jogador, bots e projéteis) devem armazenar `prevPos` e interpolar `renderPos` usando o fator $\alpha = \text{acc} / \text{fixedDt}$.
- **RF-04 (Pipeline Gráfico Otimizado):** O renderizador WebGL deve configurar `ACESFilmicToneMapping`, `PCFSoftShadowMap` e limitar `pixelRatio` a no máximo 2.0 para preservar taxa de quadros em telas de alta densidade/mobile.
- **RF-05 (Iluminação Dinâmica de Disparo):** O sistema deve escutar o evento `weapon:fired` e pulsar a intensidade da luz ambiente global em até 45ms para sincronizar o flash de disparo com o cenário.

### 9.2 Cinemática de Câmera (CameraRig)
- **RF-06 (Amortecimento Crítico Analítico):** A inércia de cabeça e rotação deve ser resolvida via mola criticamente amortecida (`smoothDamp`) sem overshoot numérico.
- **RF-07 (Decomposição do Recuo de Câmera):** O impulso de recuo deve ser decomposto matematicamente em:
  1. *Pitch Climb Permanente:* Subida angular angular cumulativa no eixo Y.
  2. *Punch Elástico Angular:* Oscilação elástica em sub-passos de 500Hz que retorna à posição original.
  3. *Kickback Linear:* Deslocamento de ombro nos eixos Y e Z proporcional à potência da munição.
- **RF-08 (Transmissão de Velocidade Angular):** O CameraRig deve expor continuamente sua velocidade angular real (`angularVelocity`) para consumo da inércia do Viewmodel e retículos.
- **RF-09 (Sistema de Lean Tático):** Ao acionar Q/E, a câmera deve transicionar suavemente a inclinação angular Z em $\pm 11.5^\circ$ e transladar o eixo X lateral em 15cm com rebaixamento do tronco.
- **RF-10 (Headbob Físico por Superfície):** A oscilação da câmera ao andar/correr deve modular frequência e amplitude com base na velocidade e no material do piso, suportando escala de acessibilidade de 0% a 120%.
- **RF-11 (Spring-Arm Anti-Clip em 3ª Pessoa):** Ao alternar para terceira pessoa (tecla V), o braço de câmera deve executar raycast contra o `CollisionWorld` e encurtar a distância instantaneamente se houver parede atrás do jogador.

### 9.3 Dinâmica de Viewmodel & Poses
- **RF-12 (Mola Acoplada à Massa da Arma):** A inércia do Viewmodel em primeira pessoa deve derivar suas constantes de mola $K$ e amortecimento $D$ diretamente do peso da arma em quilogramas ($K = 22.0 / \text{mass}^{0.45}$, $D = 9.5 / \text{mass}^{0.35}$).
- **RF-13 (Alinhamento Procedural de ADS):** A posição de mira da arma deve ser calculada matematicamente alinhando a coordenada local da alça/massa (`sightLocal`) exatamente ao centro do viewport da câmera a uma distância configurável (`adsSightDistance`).
- **RF-14 (Wall-Press & Obstrução do Cano):** Ao aproximar o cano da arma a menos de 45cm de uma parede (`wallCompression > 0.45`):
  1. A arma deve erguer-se visualmente $+75^\circ$ no eixo X e inclinar $-15^\circ$ em direção ao peito.
  2. A mira em ADS deve ser bloqueada.
  3. Disparos devem ser impedidos, disparando clique seco e emitindo alerta HUD `"CANO OBSTRUÍDO PELA PAREDE"`.
- **RF-15 (Animação Procedural de Ejeção de Estojos):** Ao disparar, cápsulas físicas de latão ou cartuchos vermelhos de espingarda 12ga devem ser ejetados a partir de `ejectLocal` com velocidade angular de tumble (28 rad/s) e quicar elasticamente no chão.

### 9.4 Sistema de Traçantes (Tracers / FlashTracers)
- **RF-16 (Desacoplamento Espacial Total):** O traçante balístico deve ser instanciado no frame 0 no espaço de mundo (World Space) entre o bocal da arma naquele instante e o ponto de impacto estimado, sem amarrar sua cauda ao cano em movimento.
- **RF-17 (Geometria Concêntrica Dual-Layer):** O traçante deve consistir em dois cilindros concêntricos:
  1. *Núcleo (Core):* Filamento central incandescente branco de alta intensidade.
  2. *Envoltório (Glow Envelope):* Halo cromático saturado simulando a dispersão atmosférica e retinal com gradiente exponencial $\text{pow}(t, 1.4)$.
- **RF-18 (Calibração de Sweetspot de Strafe):** O traçante deve suportar o fator `lengthMultiplier` calibrado (1.3 a 1.5, nominal 1.4 na M249) para produzir o visual de feixe estendido sem revelar atraso cinemático em movimentos laterais rápidos.
- **RF-19 (Muzzle Flash Volumétrico Orto-Cruzado):** O quebra-chamas deve ser composto por 4 planos cruzados aditivos com rotação e escala jittered, acompanhado de luz pontual e máscara de deslocamento elástico (`maskElasticOffset`).
- **RF-20 (Múltiplos Estilos de Feixe):** O renderizador de traçantes deve suportar perfis data-driven intercambiáveis:
  - `swipe`: Cabeça avança a $0.35$ da velocidade e cauda estica/retrai estilo CS2.
  - `photographic`: Simulação de tempo de exposição de obturador e persistência retinal pós-impacto.
  - `laser`: Feixe instantâneo contínuo com atenuação por opacidade.
  - `parabola`: Feixe acoplado com queda gravitacional em arco.

### 9.5 Balística Externa & Terminal
- **RF-21 (Swept-Ray Continuous Collision Detection):** Projéteis devem avançar no espaço fatiando cada frame de 120Hz em um segmento de raio entre `prevPos` e `nextPos`, eliminando tunelamento através de paredes finas.
- **RF-22 (Queda Gravitacional & Arrasto Aerodinâmico):** Cada projétil deve integrar gravidade específica do calibre ($v_y -= g \cdot dt$), coeficiente de arrasto (`drag`) e vetor de vento global.
- **RF-23 (Degradação de Headshot por Distância):** Se a queda balística por gravidade ($\Delta y = 0.5 \cdot g \cdot t^2$) for superior a 0.25m no momento do impacto contra um bot, o acerto deve ser rebaixado de `head` para `body`.
- **RF-24 (Penetração Balística por Densidade / Wallbang):** Ao atingir uma parede:
  - O sistema deve verificar a resistência do material (madeira: 0.35, reboco: 0.50, pedra/concreto: 1.10, metal: 2.40).
  - Se $\text{penetrationPower} \ge \text{espessura} \times \text{resistência}$, o projétil deve emergir da face oposta, perdendo de 25% a 40% da velocidade e 35% de dano.
- **RF-25 (Ricochete Físico Angular):** Tiros rasantes contra superfícies duras (ângulo $< 25^\circ$) devem refletir o vetor de velocidade pela normal geométrica $\vec{v}' = \vec{v} - 2(\vec{v} \cdot \vec{n})\vec{n}$, dissipando 40% da energia cinética e mantendo o projétil vivo.
- **RF-26 (Supressão Balística Near-Miss):** Tiros passando a menos de 2.4m da cabeça de um bot ou jogador devem calcular a distância mínima do segmento e aplicar flinch, câmera shake e acúmulo de supressão tática.

### 9.6 Óptica Telescópica (Scope PIP)
- **RF-27 (Dual-Camera Picture-In-Picture):** Miras telescópicas devem utilizar uma segunda câmera (`scopeCamera`) com FOV estreito ($2^\circ$ a $30^\circ$) renderizando em um `WebGLRenderTarget` de 512x512.
- **RF-28 (Shader de Lente Personalizado):** A superfície da lente deve aplicar um shader GLSL contendo:
  - Distorção em barril: $\text{uv} = 0.5 + p \cdot (1.0 - 0.10 \cdot r^2)$.
  - Aberração cromática radial com dispersão RGB: $\text{ca} = p \cdot 0.006 \cdot r^2$.
  - Shading de profundidade das paredes internas do tubo com paralaxe do olho.
- **RF-29 (Retículas Funcionais Vetoriais):** O sistema óptico deve suportar retícula duplex militar e retícula soviética PSO-1 com escala estadiamétrica funcional de 100m a 400m e chevrons de alcance.
- **RF-30 (Ajuste Trigonométrico de Sensibilidade):** A rotação do mouse durante a mira em scope deve ser reescalonada proporcionalmente pelo fator $\tan(\text{FOV}_{\text{scope}} / 2) / \tan(\text{FOV}_{\text{ads}} / 2)$.

### 9.7 Sistema de Miras (Crosshair Manager)
- **RF-31 (Projeção 3D do Cano na Tela):** O retículo do HUD deve ser capaz de seguir as coordenadas 2D resultantes da projeção de mundo da ponta do cano (`muzzleLocal`), permitindo que a mira acompanhe o sway e recoil real no espaço (estilo *Tarkov*).
- **RF-32 (Mira CS2 em 3 Eixos Independentes):** O gerenciador de mira deve operar 3 eixos de configuração desacoplados:
  - *Eixo 1 (Dispersão):* Gap estático ou dinâmico proporcional ao spread da arma.
  - *Eixo 2 (Alinhamento):* Centralizado ou projetado pelo cano.
  - *Eixo 3 (Follow Recoil):* Deslocamento angular na tela compensando o spray acumulado em tempo real.
- **RF-33 (Ponto Central e T-Shape):** Suporte a ponto central independente (`ch-dot`), formato tradicional em cruz e formato em T (remoção da barra superior).

### 9.8 Interface, HUD & Feedback Tático
- **RF-34 (Indicador 2D Radial de Dano):** O canvas do HUD deve desenhar arcos radiais indicando a direção de origem do dano e supressão em relação ao yaw da câmera, com deduplicação angular para impactos recebidos a menos de $23^\circ$.
- **RF-35 (Hitmarkers Descentralizados para Shotgun):** Ao disparar espingardas, hitmarkers individuais devem ser spawnados nas coordenadas de tela exatas onde cada pellet colidiu com o inimigo.
- **RF-36 (Modal de Inventário Tático):** Sistema com slots de equipamento primário/secundário, capacete classe 2, colete classe 3 e grade de mochila 4x4 com controle cumulativo de peso (máximo 40kg).
- **RF-37 (Tela de Carregamento Tática):** Overlay com monitoramento granular de progresso percentual na pré-compilação de texturas PBR, shaders e inicialização de geometria.

### 9.9 Inteligência Artificial & Comportamento
- **RF-38 (FSM de 4 Estados):** Bots devem operar sob uma máquina de estados finitos estruturada:
  - `PatrolState`: Navegação reativa a 70% de velocidade de marcha.
  - `EngageState`: Strafe lateral alternado (0.6s a 1.8s), controle de distância (5m a 14m), peek tático e rajadas (burst fire).
  - `SearchState`: Deslocamento até a última posição conhecida do jogador com temporizador de 3.5s.
  - `FleeState`: Fuga acelerada em direção oposta sob baixa vida ou alta supressão.
- **RF-39 (Visão Throttled a 10Hz):** Sensores de linha de visão (LOS) dos bots devem executar raycast a cada ~100ms com jitter, e não a cada tick de física, preservando ciclos de CPU.
- **RF-40 (Sensibilidade Acústica dos Bots):** Disparos efetuados pelo jogador a menos de 35 metros de distância devem quebrar imediatamente o estado de patrulha do bot e transicioná-lo para busca.
- **RF-41 (Procedural Bot Torso Twist):** O modelo visual dos bots deve desacoplar as pernas do tronco, permitindo rotação da arma e cabeça de até $\pm 72^\circ$ antes de girar a base das pernas.

### 9.10 Áudio Procedural & Síntese Web Audio
- **RF-42 (Síntese Sonora Sem Assets):** Todos os efeitos sonoros de disparos, recuo, cliques mecânicos e impactos devem ser sintetizados em tempo real via Web Audio API (`AudioContext`) sem uso de arquivos de áudio externos.
- **RF-43 (Oclusão Acústica Tridimensional):** Sons espaciais emitidos atrás de paredes sólidas devem ser detectados via raycast e filtrados por um filtro biquad passa-baixas (frequência de corte reduzida de 13kHz para 550Hz e atenuação de ganho em 60%).
- **RF-44 (Passos por Material de Superfície):** O som dos passos do jogador deve sintetizar curvas de onda específicas dependendo do material detectado no piso sob os pés (madeira, metal, areia/grama, concreto/pedra).

### 9.11 Equipamento Especial & Granadas
- **RF-45 (Simulação Balística da Granada de Fumaça M18):** Lançamento de cilindro com velocidade inicial de 15 m/s, gravidade de -9.8 m/s² e ricochetes elásticos, detonando após 3 quiques ou 1.3s de voo.
- **RF-46 (Nuvem Volumétrica de Fumaça):** Ao detonar, criar nuvem de 14 puffs icosaédricos procedurais expandindo até 4.2 metros de raio por exatamente 10.0 segundos, bloqueando linha de visão dos bots e dissipando nos últimos 2.5s.

### 9.12 Mobile, Acessibilidade & PWA
- **RF-47 (Controles Virtuais Mobile Multi-Touch):** Interface touch com joystick flutuante analógico na esquerda (com auto-sprint a 75% de curso) e touchpad de mira na direita com botões simultâneos de disparo e ADS.
- **RF-48 (Modulação de Acessibilidade Data-Driven):** Sliders independentes no menu de configurações permitindo modular intensidade de headbob (0% a 120%), screen shake (0% a 100%) e vibração tátil no celular via `navigator.vibrate`.
- **RF-49 (Arquitetura PWA Offline-First):** O jogo deve registrar Service Worker com estratégia Network-First e cache local de assets (`arena-blockout-v1`), permitindo carregamento e execução completa sem conexão à internet.
- **RF-50 (Orientação Forçada Landscape):** Bloqueio estrito de orientação em modo paisagem via manifesto PWA e CSS para garantir layout tático em dispositivos móveis.

---

## 10. Requisitos Não-Funcionais

### Performance
- Máximo 1 raycast de aim assist por frame
- Object pooling em todos os sistemas de partículas (zero allocações em runtime)
- InstancedMesh para geometrias repetidas (single draw call por material)
- Pixel ratio máximo 2.0 (otimização mobile)
- Physics throttle: LOS de bots a ~10Hz (não 60Hz)
- Spatial Hash Grid para consultas de colisão O(1) médio

### Determinismo e Testabilidade
- `CollisionWorld` 100% agnóstico de Three.js (portável para Node.js)
- `BallisticsCalculator` stateless puro (unit-testável)
- 12 suítes de testes headless no `package.json`
- Resultados reproduzíveis com mesmo seed/delta

### Extensibilidade
- Nova arma: adicionar entrada em `weapons.json` + `ammo.json` + model JS
- Novo mapa: JSON com `staticGeometry`, `props`, `doors`, `spawns`
- Nova textura PBR: método no `TextureGenerator`
- Novo prop: factory method no `ItalyProps` equivalente

### Segurança
- Sem backend (single-player offline)
- Sem comunicação de rede além do fetch de assets estáticos
- Service Worker filtra apenas GET e HTTP(S)

---

## 11. Estrutura de Diretórios Recomendada

```
/
├── index.html               # SPA + HUD DOM + Import Map
├── manifest.json            # PWA manifest
├── sw.js                    # Service Worker offline
├── package.json             # "type":"module", deps: three
│
├── assets/
│   ├── maps/
│   │   └── italy.json       # Definição do mapa CS Italy
│   ├── weapons/
│   │   ├── weapons.json     # Base de dados das armas
│   │   └── ammo.json        # Base de dados dos calibres
│   └── configs/
│       ├── gameplay.json    # Parâmetros de jogo
│       ├── bots.json        # Configurações de IA
│       └── audio.json       # Parâmetros de síntese
│
├── src/
│   ├── main.js              # Bootstrap + game loop
│   │
│   ├── core/
│   │   ├── Engine.js        # Fixed-timestep loop
│   │   ├── EventBus.js      # Pub/Sub zero-dep
│   │   ├── ConfigLoader.js  # Data-driven config
│   │   ├── GameManager.js   # Match, spawns, round rules
│   │   ├── CameraRig.js     # Kinetic camera + springs
│   │   ├── Input.js         # Desktop input
│   │   ├── TouchInput.js    # Mobile virtual controls
│   │   └── SceneSetup.js    # Three.js pipeline
│   │
│   ├── world/
│   │   ├── MapLoader.js     # JSON → Three.js + CollisionWorld
│   │   ├── MaterialFactory.js  # PBR lazy + triplanar shader
│   │   ├── TextureGenerator.js # Canvas 2D procedural textures
│   │   ├── ItalyProps.js    # Composite prop factory
│   │   ├── Door.js          # Interactive door entity
│   │   └── ItemDrop.js      # Loot drop entity
│   │
│   ├── physics/
│   │   └── CollisionWorld.js  # AABB + Spatial Hash + Raycast
│   │
│   ├── entities/
│   │   ├── Character.js     # Base entity (physics, hp)
│   │   ├── Player.js        # Player entity + input
│   │   └── Bot.js           # Bot entity bridge
│   │
│   ├── ai/
│   │   ├── AIController.js  # Bot brain (sensors, FSM, firing)
│   │   └── states/
│   │       ├── AIState.js   # Base state class
│   │       ├── PatrolState.js
│   │       ├── EngageState.js
│   │       ├── SearchState.js
│   │       └── FleeState.js
│   │
│   ├── view/
│   │   └── CharacterView.js # 3D model + procedural animation
│   │
│   ├── weapons/
│   │   ├── WeaponDefs.js        # Compiler: JSON → WEAPONS dict
│   │   ├── WeaponSystem.js      # Player gunplay controller
│   │   ├── BallisticsCalculator.js  # Pure math (stateless)
│   │   ├── ProjectileManager.js     # CCD simulation
│   │   ├── Viewmodel.js             # First-person viewmodel
│   │   ├── ScopeSystem.js           # PIP telescopic optics
│   │   ├── ScopeRenderTargetSystem.js  # Legacy re-export
│   │   ├── SmokeGrenade.js          # M18 smoke canister
│   │   ├── SmokeGrenadeManager.js   # Smoke deployment + cooldown
│   │   └── models/
│   │       ├── AK47.js
│   │       ├── HK416.js
│   │       ├── M249.js
│   │       ├── P9.js
│   │       ├── RiflePrototype.js
│   │       ├── SW500.js
│   │       ├── UZI.js
│   │       ├── VSS.js
│   │       └── Winchester1912.js
│   │
│   ├── fx/
│   │   └── Effects.js       # Object-pooled particle systems
│   │
│   ├── audio/
│   │   └── AudioSystem.js   # Web Audio procedural synthesis
│   │
│   ├── ui/
│   │   ├── HUD.js           # Gameplay display
│   │   ├── CrosshairManager.js  # CS2-style crosshair
│   │   ├── MenuController.js    # Main menu + settings
│   │   └── LoadingScreen.js     # Loading overlay
│   │
│   └── new_mechanics/
│       ├── index.js                    # Module facade
│       ├── AimAssistSystem.js          # Friction + magnetism
│       ├── BarrelCrosshairAlignment.js # Barrel → screen projection
│       └── TacticalInventorySystem.js  # Gear + backpack grid
│
└── test/
    ├── headless_sim.js
    ├── ballistics_test.js
    ├── projectile_test.js
    ├── penetration_ricochet_test.js
    ├── italy_map_test.js
    ├── phase14_accessibility_test.js
    ├── loading_system_test.js
    ├── audio_spatial_occlusion_test.js
    ├── tracer_test.js
    ├── tracer_flash_profile_test.js
    ├── third_person_test.js
    ├── woods_texture_test.js
    └── crosshair_manager.test.js
```

---

*Documento gerado por análise de engenharia reversa do código-fonte. Versão 1.0 — Outubro de 2026.*
