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

## 9. Requisitos Funcionais

### RF-01 — Motor de Renderização
- [ ] Renderização 3D via WebGL com Three.js
- [ ] Dual-rate game loop: física 120Hz / render variável
- [ ] Fog atmosférico linear configurável por mapa
- [ ] Iluminação três-pontos com sombras suaves (PCFSoftShadow)
- [ ] ToneMapping cinematográfico (ACES)

### RF-02 — Física e Colisão
- [ ] Motor AABB com Spatial Hash Grid 2D
- [ ] `moveAndSlide` com resolução de eixos desacoplados (Y→X→Z)
- [ ] Step-Up automático (degraus até 0.55m)
- [ ] Detecção de material do chão para footstep audio
- [ ] Raycast Slab Method com thickness e normal de retorno
- [ ] Interpolação de posição para renderização desacoplada do tick físico

### RF-03 — Mundo e Mapa
- [ ] Carregamento de mapas via JSON
- [ ] Geometria estática agrupada em InstancedMesh por material
- [ ] Shader Triplanar World-Space UV (sem esticamento em caixas)
- [ ] Geração procedural de texturas PBR via Canvas 2D
- [ ] Props compostos com hitboxes sincronizadas
- [ ] Portas interativas com AABB dinâmico (abre/fecha)
- [ ] Items no chão com trigger pickup e animação de flutuação

### RF-04 — Sistema de Armas
- [ ] 9 armas com estatísticas únicas configuradas em JSON
- [ ] 2 slots táticos simultâneos
- [ ] Dois modos de fogo: Auto e Semi por arma
- [ ] Munição rastreada por arma
- [ ] Sistema de recuo multi-eixo com spray patterns únicos
- [ ] Spread dinâmico (ADS, hip, movimento, sprint, sway, heat)
- [ ] CCD de projéteis (sem tunelamento em paredes finas)
- [ ] Penetração de parede por material e potência do calibre
- [ ] Ricochete angular em superfícies duras
- [ ] Supressão tática por near-miss (flinch, tunnel vision)
- [ ] Traçantes visuais desacoplados (zero rubber-band)
- [ ] Viewmodel 3D com springs de massa-dependente
- [ ] Mira telescópica PIP com shaders GLSL (scope camera, barrel distortion, aberração cromática)
- [ ] Muzzle flash volumétrico (4 planos cruzados + PointLight)
- [ ] Granada de fumaça com física de bounce + nuvem volumétrica 10s

### RF-05 — Modelos de Arma 3D Procedurais
- [ ] AK-47: magazine banana 5 segmentos, guidão frontal, alça de mira
- [ ] HK416: quad-rail Picatinny, HK diopter, P-MAG 30rd
- [ ] M249 SAW: ammo box, belt articulada de 6 balas, bipod
- [ ] P-9: slide blowback animado, slide lock, 3-dot tritium sights
- [ ] Rifle Prototype: red dot optic PIP-ready, bolt BCG animado
- [ ] S&W 500: cilindro de 6 câmaras indexável, hammer animado, compensator
- [ ] UZI: folding stock, grip safety, selector switch
- [ ] VSS Vintorez: supressor integral 0.54m, PSO-1 scope com PIP
- [ ] Winchester M12: pump-action FSM 5 estados, corncob forend, 12 torus ribs

### RF-06 — IA de Bots
- [ ] FSM de 4 estados: Patrol, Engage, Search, Flee
- [ ] Visão throttled (10Hz, LOS raycast)
- [ ] Audição de disparos por rádio (EventBus)
- [ ] Supressão balística afetando comportamento e precisão
- [ ] Strafe tático em Engage (alternado 0.6–1.8s)
- [ ] Peek procedural (lean esquerda/direita)
- [ ] Burst fire para armas automáticas
- [ ] Sistema de spawn com zona de exclusão (props, player, outros bots)
- [ ] Lock-in de respawn com cooldown de 4s
- [ ] Skin Soldier (4 camuflagens táticas) e Ghost

### RF-07 — HUD e Interface
- [ ] Health, ammo, arma ativa, fire mode, slot pills
- [ ] Round timer, K/D scoreboard, killfeed (max 5 itens)
- [ ] Damage indicator 2D radial (canvas, deduplicação angular)
- [ ] Hitmarker + headshot indicator
- [ ] Hitmarkers descentralizados para shotgun (posição real dos pellets)
- [ ] Screen flash vermelho (dano) + blur de supressão com direcionalidade
- [ ] Mira customizável CS2-style (3 eixos independentes)
- [ ] Inventory modal tático (gear slots + grid 4×4)
- [ ] Tela de morte com countdown de respawn
- [ ] Tela de fim de round com stats finais
- [ ] Menu principal com tabs de configuração

### RF-08 — Áudio
- [ ] Síntese procedural via Web Audio API (zero assets de áudio)
- [ ] Sons únicos por arma: rifle_proto, sw500, m12, pump-action
- [ ] Footstep dinâmico por material de superfície (4+ materiais)
- [ ] Spatial audio HRTF 3D com rolloff
- [ ] Oclusão por raycast (lowpass filter quando atrás de parede)
- [ ] Loop espacial de smoke grenade com fade-out exponencial

### RF-09 — Input e Controles
- [ ] Desktop: WASD + mouse + pointer lock
- [ ] Mobile: joystick flutuante + look touchpad + botões táticos
- [ ] Lean tático Q/E
- [ ] Alternância 1ª/3ª pessoa (V)
- [ ] Cheat codes bufferizados
- [ ] Sensibilidade configurável

### RF-10 — PWA e Offline
- [ ] Web App Manifest (nome, ícones, orientação landscape)
- [ ] Service Worker com cache Network-First
- [ ] Instalável em Android, iOS e desktop
- [ ] 503 controlado quando offline e sem cache

### RF-11 — Match e GameManager
- [ ] Rounds cronometrados com timer configurável
- [ ] Kill combo counter (Double Kill, Triple Kill, Headshot)
- [ ] Drops de loot ao matar bot (máx 2 drops simultâneos)
- [ ] Coleta de arma do chão por proximidade
- [ ] Anti-clipping repulsivo entre bots e jogador
- [ ] Interação contextual com portas e drops

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
