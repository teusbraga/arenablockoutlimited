# Guia Definitivo de Migração para Godot 4.x (FPS Blocky)

> **🎯 FINALIDADE DESTE DOCUMENTO:**
> Este arquivo foi elaborado para servir como a **Bíblia de Transcrição** para o agente ou desenvolvedor que for portar o projeto **FPS Blocky** do protótipo web (JavaScript/Three.js) para a **Godot Engine 4.x**.
> 
> **STATUS DA BASE JS:** **CONGELADA (FROZEN)**. Todas as mecânicas experimentais foram validadas, integradas e aprovadas em suíte de testes automatizados. Daqui para frente, não há novas mecânicas a serem inventadas no JS — o foco é portabilidade e afinamento fino de valores.

---

## 📑 Índice
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Tabela de Equivalência de Classes e Nós](#2-tabela-de-equivalência-de-classes-e-nós)
3. [Código Congelado vs Código Reutilizável](#3-código-congelado-vs-código-reutilizável)
4. [Especificação Completa das Mecânicas](#4-especificação-completa-das-mecânicas)
   - 4.1 [Balística Realista, Drag e Gravidade](#41-balística-realista-drag-e-gravidade)
   - 4.2 [CCD Sweep e Projéteis em Pool](#42-ccd-sweep-e-projéteis-em-pool)
   - 4.3 [Supressão Tática (Near-Miss)](#43-supressão-tática-near-miss)
   - 4.4 [Penetração de Paredes (Wallbang)](#44-penetração-de-paredes-wallbang)
   - 4.5 [Ricochete Físico Angular](#45-ricochete-físico-angular)
   - 4.6 [Câmera 1ª / 3ª Pessoa com Spring Arm Anti-Clipping](#46-câmera-1ª--3ª-pessoa-com-spring-arm-anti-clipping)
   - 4.7 [Soldado Blocky e Articulação Procedural de Mira](#47-soldado-blocky-e-articulação-procedural-de-mira)
   - 4.8 [Granada de Fumaça M18 (Cooldown e Cortina Volumétrica)](#48-granada-de-fumaça-m18)
   - 4.9 [Áudio Espacial 3D e Oclusão Acústica Geométrica](#49-áudio-espacial-3d-e-oclusão-acústica-geométrica)
   - 4.10 [Inteligência Artificial (FSM dos Bots)](#410-inteligência-artificial-fsm-dos-bots)
   - 4.11 [Muzzle Flash Data-Driven e Mascaramento de Tracer](#411-muzzle-flash-data-driven-e-mascaramento-de-tracer)
   - 4.12 [Weapon Wall Press e Inclinação Tática (Lean)](#412-weapon-wall-press-e-inclinação-tática-lean)
5. [Mapeamento de Configurações Data-Driven (JSON -> Godot)](#5-mapeamento-de-configurações-data-driven)
6. [Passo a Passo da Migração no Godot 4](#6-passo-a-passo-da-migração-no-godot-4)

---

## 1. Visão Geral da Arquitetura

O protótipo no navegador foi propositalmente desenhado para emular a estrutura de nós e ciclos de atualização da **Godot Engine**:

```
+-------------------------------------------------------------+
|                        GAME MANAGER                         |
+-------------------------------------------------------------+
         |                                           |
         v                                           v
+-------------------------------+   +-------------------------------+
| _physics_process(delta)       |   | _process(delta)               |
| (Física travada: 60/120Hz)    |   | (Visual variável: VSync/rAF)  |
|-------------------------------|   |-------------------------------|
| - Movimentação do Jogador     |   | - Interpolação de Câmera      |
| - Projétil CCD Sweep          |   | - Animações de Locomoção      |
| - IA dos Bots & FSM           |   | - Sway / Bobbing do Viewmodel |
| - Detecção de Supressão       |   | - Shaders de Vinheta & HUD    |
| - Temporizador de Smoke       |   | - Panning & Oclusão Sonora    |
+-------------------------------+   +-------------------------------+
```

---

## 2. Tabela de Equivalência de Classes e Nós

| Componente JS Web | Equivalente Godot 4.x | Tipo / Nó Base | Observações |
|---|---|---|---|
| `Engine.js` | Loop Nativo do Godot | `Main Loop` | `fixedUpdate` vira `_physics_process(delta)`; `renderUpdate` vira `_process(delta)`. |
| `EventBus.js` | Autoload Singleton `EventBus.gd` | `Node` | Sinais globais (`signal player_damaged`, `signal bot_suppressed`, etc.). |
| `ConfigLoader.js` | Autoload `GameConfig.gd` | `Node` | Carrega `gameplay.json` e `audio.json` via `FileAccess.get_file_as_string`. |
| `CollisionWorld.js` | `World3D.direct_space_state` | `PhysicsServer3D` | Raycasting nativo com `PhysicsRayQueryParameters3D`. |
| `Player.js` | `Player.tscn` | `CharacterBody3D` | `move_and_slide()`, velocidade vetorial e controle de HP. |
| `CameraRig.js` | `CameraRig.tscn` | `Node3D` -> `SpringArm3D` -> `Camera3D` | Spring arm com raycast de esfera para 3ª pessoa anti-clipping. |
| `Bot.js` | `Bot.tscn` | `CharacterBody3D` | Modelo visual + hitbox com colisores de cabeça e corpo. |
| `AIController.js` | `AIController.gd` | `Node` (FSM) | Estados: `patrol`, `search`, `engage`, `flee`. |
| `ProjectileManager.js` | `ProjectileManager.gd` | `Node3D` (Pool) | Pool com 128 instâncias reutilizáveis de projétil físico contínuo. |
| `BallisticsCalculator.js`| `BallisticsCalculator.gd` | `RefCounted` (Estático) | Funções matemáticas puras de arrasto, penetração e dano terminal. |
| `WeaponSystem.js` | `WeaponSystem.gd` | `Node3D` | Gerencia slots 1 e 2, ciclo de disparo, recarga e dispersão. |
| `SmokeGrenade.js` | `SmokeGrenade.tscn` | `RigidBody3D` ou `Node3D` | Balística de lançamento, quiques físicos e cortina de partículas. |
| `AudioSystem.js` | `AudioSystem.gd` + Audio Buses | `Node` / `AudioServer` | `AudioStreamPlayer3D` para sons posicionais e filtro passa-baixa para oclusão. |
| `CharacterView.js` | `BlockySoldier.tscn` | `Node3D` (.gltf) | Malha tática importada de arquivo 3D com articulação de mira (`pitch`). |
| `HUD.js` | `HUD.tscn` | `CanvasLayer` | Nós `Control`, `ProgressBar`, `Label` e `ColorRect` com shader de blur/vinheta. |

---

## 3. Código Congelado vs Código Reutilizável

### ❄️ CÓDIGO CONGELADO / DESCARTÁVEL (Não portar literalmente):
- **`src/weapons/models/*.js` (`buildHK416`, `buildAK47`, etc.):**  
  Estas funções geram malhas procedurais montando cubos com Three.js puro. **Descarte-as**. Na Godot, utilize modelos 3D padrão `.gltf` ou `.fbx`.
- **`src/world/TextureGenerator.js` & `src/world/MaterialFactory.js`:**  
  Geração procedural em Canvas 2D HTML5 com ruído Perlin. **Descarte-as**. Na Godot, crie materiais nativos `StandardMaterial3D` ou `ORMMaterial3D` com texturas `.png` ou `.webp`.
- **`src/world/ItalyProps.js`:**  
  Geração em código de arcos e caixotes. Na Godot, crie cenas de props reutilizáveis (`PropCrate.tscn`, `PropArch.tscn`).

### 🔥 CÓDIGO 100% REAPROVEITÁVEL (Transcrever lógica e matemática):
- Fórmulas de balística em `BallisticsCalculator.js`.
- Loop de física contínua CCD e detecção de proximidade em `ProjectileManager.js`.
- Máquina de estados finitos (FSM) em `AIController.js`.
- Arquivos de dados: `assets/weapons/weapons.json`, `assets/weapons/ammo.json`, `assets/config/gameplay.json`, `assets/config/audio.json` e todos os arquivos em `assets/maps/*.json`.

---

## 4. Especificação Completa das Mecânicas

### 4.1 Balística Realista, Drag e Gravidade
- **Gravidade Dinâmica:** $9.8\,\text{m/s}^2$ por padrão, modular por munição (`bulletDrop`).
- **Arrasto Aerodinâmico (`drag`):**
  $$\vec{v}_{t+1} = \vec{v}_t \times \max(0, 1 - \text{drag} \cdot \Delta t)$$
- **Vento Global:** Vetor tridimensional $(\text{wind}_x, 0, \text{wind}_z)$ que acelera o projétil lateralmente a cada tick de física.
- **Velocidade do Som:** $343\,\text{m/s}$ para cálculo de atraso acústico realista (`distance / 343.0`).

### 4.2 CCD Sweep e Projéteis em Pool
- O projétil é simulado em passos discretos de Continuous Collision Detection (CCD):
  - Em cada tick de física, guarda `prev_pos = pos`.
  - Calcula o deslocamento `step_vec = vel * dt` e distância `step_dist = length(step_vec)`.
  - Executa um raycast físico entre `prev_pos` e `prev_pos + step_vec`.
  - Se houver colisão (entidade ou parede), o impacto ocorre exatamente no ponto do raycast (`hit_point`), sem risco de túnel quântico mesmo a $900\,\text{m/s}$.

### 4.3 Supressão Tática (Near-Miss)
- **Raio de Ação:** $2.40\,\text{metros}$ em relação à cabeça da entidade alvo.
- **Momento da Verificação:** Avaliado em **todos os passos** de trajetória, incluindo o trajeto antes da bala atingir uma parede ou sofrer ricochete.
- **Cálculo Ponto-para-Segmento:**
  $$t = \text{clamp}\left(\frac{(\vec{P}_{\text{cabeça}} - \vec{A}) \cdot (\vec{B} - \vec{A})}{\|\vec{B} - \vec{A}\|^2}, 0, 1\right)$$
  $$\vec{P}_{\text{mais\_próximo}} = \vec{A} + t \cdot (\vec{B} - \vec{A})$$
  $$\text{distância} = \|\vec{P}_{\text{mais\_próximo}} - \vec{P}_{\text{cabeça}}\|$$
- **Efeitos no Jogador:**
  - **Vinheta de Visão de Túnel:** `ColorRect` com shader radial escuro e `blur` de fundo de $2.5\,\text{px}$. Ativação em $0.04\,\text{s}$ e fade suave de $0.45\,\text{s}$.
  - **Flinch e Shake:** Kick angular aleatório na câmera (`addFlinch`) e tremor de tela (`addShake`).
  - **Áudio:** Estalo supersônico posicional 3D (`bullet_whizby`) disparado nas coordenadas de $\vec{P}_{\text{mais\_próximo}}$.
- **Efeitos nos Bots:**
  - Incremento de `suppressionLevel` proporcional à proximidade.
  - Redução de até $55\%$ na chance de acerto dos tiros do bot.
  - Alerta imediato se em patrulha (`patrol` $\to$ `search`) e pânico para buscar cobertura se sob fogo pesado (`engage` $\to$ `flee`).

### 4.4 Penetração de Paredes (Wallbang)
- **Resistência por Material:**
  - Madeira (`wood`): `0.35`
  - Sacos de areia / gesso / terra (`dirt` / `sandbag`): `0.50`
  - Concreto / tijolo / pedra (`concrete` / `brick`): `1.10`
  - Metal / chapa de aço (`metal` / `steel`): `2.40`
- **Condição de Penetração:**
  $$\text{Poder Necessário} = \text{Espessura da Parede (m)} \times \text{Resistência do Material}$$
  $$\text{Se } \text{penetrationsRemaining} > 0 \text{ e } \text{penetrationPower} \ge \text{Poder Necessário} \implies \text{Penetra}$$
- **Penalidade:** O projétil emerge do outro lado da parede com perda de velocidade ($25\%$ a $40\%$) e redução proporcional no dano letal.

### 4.5 Ricochete Físico Angular
- **Condição de Disparo:**
  - Superfície dura (`metal`, `concrete`, `stone`).
  - Ângulo de incidência rasante: $\theta < 25^\circ$ ($\vec{d}_{\text{tiro}} \cdot \vec{n}_{\text{parede}} > -0.42$).
- **Reflexão do Vetor:**
  $$\vec{v}' = (\vec{v} - 2(\vec{v} \cdot \vec{n})\vec{n}) \times 0.60 + \text{jitter}$$
- O projétil continua vivo e mortal após rebater, gerando faíscas visuais e estalo sonoro metálico.

### 4.6 Câmera 1ª / 3ª Pessoa com Spring Arm Anti-Clipping
- **Alternância:** Tecla **`V`** no teclado ou botão touch **`3ªP`**.
- **Terceira Pessoa:** Câmera posicionada a $2.4\,\text{m}$ atrás do jogador com offset sobre o ombro direito ($+0.45\,\text{m}$ em X, $+0.22\,\text{m}$ em Y).
- **Spring Arm:** Em Godot, utilize o nó nativo `SpringArm3D` com um `SphereShape3D` (raio $0.15\,\text{m}$). Se uma parede sólida entrar entre a câmera e o soldado, a câmera é encurtada instantaneamente, impedindo que a visão vaze pela parede.
- **Ocultação de Viewmodel:** Em 3ª pessoa, ocultar os braços de 1ª pessoa. Em 1ª pessoa, ocultar a malha do próprio jogador.

### 4.7 Soldado Blocky e Articulação Procedural de Mira
- O modelo do soldado possui grupos articulados para a cabeça/pescoço e braços/fuzil.
- Conforme o jogador olha para cima ou para baixo, o `pitch` vertical da câmera é aplicado na rotação local dos ossos/grupos da cabeça e dos braços. Outros jogadores/bots enxergam o soldado apontando a arma fielmente na direção da mira.
- Locomoção procedural: alternância das pernas baseada na velocidade horizontal e inclinação tática (`lean` de $-0.18\,\text{rad}$ / $+0.18\,\text{rad}$ nas teclas Q/E).

### 4.8 Granada de Fumaça M18
- **Ativação:** Tecla **`U`** ou botão touch **`SMOKE`**.
- **Regras Imutáveis:**
  - **Duração da Fumaça:** Exatamente **$10\,\text{segundos}$**.
  - **Cooldown de Lançamento:** Exatamente **$30\,\text{segundos}$** (bloqueio contra spam acidental).
- **Emissão Sonora:** Chiado contínuo sob pressão (`smoke_hiss`) espacializado e ocluído por paredes.
- **Representação em Godot:** `GPUParticles3D` volumétricas ou malhas esféricas transparentes com shader de desvanecimento nos últimos $2.5\,\text{s}$.

### 4.9 Áudio Espacial 3D e Oclusão Acústica Geométrica
- Emissores sonoros usam posicionamento HRTF no espaço 3D.
- **Oclusão por Paredes:** Um raycast entre a câmera (ouvinte) e o emissor sonoro detecta paredes:
  - **Livre:** Frequência de corte aberta ($13.000\,\text{Hz} - 14.000\,\text{Hz}$). Som limpo e nítido.
  - **Ocluído:** Filtro passa-baixa ativo ($550\,\text{Hz}$) e atenuação de volume. Som abafado realista ("muffled").
- Em Godot: configure um barramento `OccludedAudio` no `AudioServer` com o efeito `AudioEffectLowPassFilter`, ou altere o cutoff do player sonoro dinamicamente.

### 4.10 Inteligência Artificial (FSM dos Bots)
- **Estados da FSM:**
  - `patrol`: Anda aleatoriamente entre waypoints em velocidade moderada.
  - `search`: Alerta sonoro ou de proximidade; investiga o último local conhecido do jogador.
  - `engage`: Linha de visão direta; posiciona-se, mira na altura do peito ($y + 1.4$) e atira em rajadas com dispersão calibrada.
  - `flee`: HP baixo ou supressão severa ($>0.65$); corre na direção oposta ao jogador buscando cantos seguros.
- **Disparos dos Bots:** Instanciam projéteis físicos reais no `ProjectileManager` com `owner = "bot"`, gerando supressão física real no jogador.

### 4.11 Muzzle Flash Data-Driven e Mascaramento de Tracer
- Cada munição em `ammo.json` define seu `flashProfile` (`size`, `opacity`, `duration`, `maskElasticOffset`).
- Armas de cano curto ou próximas aos olhos (ex: P9 e UZI) possuem flashes maiores para mascarar a linha elástica inicial do traçante em movimentações rápidas de mira.
- Armas longas ou silenciadas (ex: VSS) possuem flash mínimo.

### 4.12 Weapon Wall Press e Inclinação Tática (Lean)
- **Wall Press:** Raycast frontal a partir da câmera detectando paredes a menos de $0.50\,\text{m}$. A arma recolhe contra o peito, bloqueando o modo ADS e o disparo caso encostada na parede.
- **Lean Tático (Q/E):** Deslocamento lateral de $\pm 0.28\,\text{m}$ e rotação de $\pm 0.08\,\text{rad}$ na câmera para espiar esquinas sem expor o corpo inteiro.

---

## 5. Mapeamento de Configurações Data-Driven

Ao migrar para Godot, copie os arquivos da pasta `assets/` diretamente para o projeto Godot (`res://assets/`):

1. **`assets/weapons/weapons.json`:**  
   Define todas as 9 armas (dano base, capacidade de carregador, cadência RPM, tempos de recarga, peso, FOV em ADS, padrão de recuo procedimental e offset de bocal `muzzleLocal`).
2. **`assets/weapons/ammo.json`:**  
   Define os tipos de munição balística, penetração de blindagem/madeira/concreto, chance de ricochete, velocidade de saída, drop por gravidade e perfil visual (`tracerProfile` e `flashProfile`).
3. **`assets/config/gameplay.json`:**  
   Configurações gerais do jogador, sensibilidade, constantes de movimento (`walkSpeed`, `sprintSpeed`, `jumpForce`), dimensões da cápsula e limites de câmera.
4. **`assets/config/audio.json`:**  
   Frequências e características sintéticas dos efeitos sonoros (usados como referência para importar samples `.wav` / `.ogg` correspondentes na Godot).
5. **`assets/maps/*.json` (`range.json`, `dust.json`, `italy.json`, `woods.json`, etc.):**  
   Estrutura geométrica completa dos mapas (dimensões, limites de arena, posições dos blocos de colisão, materiais e pontos de spawn de jogadores e bots).

---

## 6. Passo a Passo da Migração no Godot 4

### Etapa 1: Configuração do Projeto
- Versão recomendada: **Godot 4.3+**.
- Em `Project Settings -> Physics -> Common`:
  - Definir `Physics Ticks per Second` como `60` ou `120` (para equivaler aos 120Hz do protótipo).
- Criar Collision Layers:
  - Layer 1: `World` (Pisos, paredes e obstáculos estáticos)
  - Layer 2: `Player` (Cápsula de colisão do jogador)
  - Layer 3: `Bots` (Cápsulas e hitboxes dos bots)
  - Layer 4: `Projectiles` (Projéteis físicos)
  - Layer 5: `Interactables` (Armas dropadas, portas)

### Etapa 2: Autoloads Globais
- Criar `EventBus.gd` como Autoload com os sinais do projeto (`player_damaged`, `bot_fired`, `weapon_fired`, `player_suppression`, etc.).
- Criar `GameData.gd` como Autoload para carregar os arquivos JSON de `res://assets/`.

### Etapa 3: Sistema de Balística (`ProjectileManager`)
- Crie um nó `ProjectileManager` instanciado na raiz da cena do mundo.
- Implemente o Object Pool de 128 instâncias com os métodos `spawn()` e `_physics_process(delta)`.
- Aplique o algoritmo de CCD Sweep via `get_world_3d().direct_space_state.intersect_ray()`.
- Transcreva os métodos `_check_suppression()`, `_check_wallbang()` e `_check_ricochet()`.

### Etapa 4: Jogador e Câmera (`Player.tscn`)
- Crie um `CharacterBody3D` com `CollisionShape3D` (cápsula: raio $0.3\,\text{m}$, altura $1.8\,\text{m}$).
- Adicione um nó pivot de cabeça com `Camera3D` para 1ª pessoa e `SpringArm3D` com `Camera3D` para 3ª pessoa.
- Implemente `move_and_slide()` consumindo os eixos `move_forward`, `move_back`, `move_left`, `move_right`.
- Conecte as ações `toggle_perspective` (tecla V), `throw_smoke` (tecla U) e `lean_left`/`lean_right` (teclas Q/E).

### Etapa 5: Bots e FSM (`Bot.tscn`)
- Crie um `CharacterBody3D` com nós de colisão separados para `Body` e `Head` (para detecção de headshot).
- Implemente o script `AIController.gd` com a máquina de estados (`patrol`, `search`, `engage`, `flee`).
- Integre a penalidade de supressão no método de mira e disparo.

### Etapa 6: Áudio Espacial e Oclusão
- Configure um barramento `SpatialEffects` com `AudioEffectLowPassFilter`.
- Nos nós de som dos disparos e granada de fumaça, utilize `AudioStreamPlayer3D` com modelo de atenuação por distância e faça um raycast de teste de oclusão antes de emitir o som.

### Etapa 7: Interface e HUD
- Crie a cena `HUD.tscn` como `CanvasLayer`.
- Implemente um `ColorRect` em tela cheia com shader de Vinheta e Blur para o efeito de supressão tática conectado ao sinal `EventBus.player_suppression`.
- Exiba indicadores de munição, vida, killfeed e crosshair tático.

---

> **✅ CONCLUSÃO:**  
> A lógica mecânica do projeto está 100% resolvida, testada matematicamente e documentada. Qualquer agente ou programador seguindo este guia conseguirá recriar o jogo fielmente na Godot 4 em tempo recorde.
