# Plano de Refatoração Arquitetural (Preparação para Godot)

> **⚠️ REGRA GLOBAL DE AGENTE:** 
> 1. Este arquivo é um **LOG CONTÍNUO**. **NUNCA APAGUE** passos criados anteriormente.
> 2. Ao finalizar uma tarefa, apenas marque com `[x]` ou `(CONCLUÍDO)` na frente do passo correspondente.
> 3. Passe imediatamente para o próximo item aberto.
> 4. Novas adições devem seguir a numeração sequencial (Fase 4, Fase 5, etc.) no final do arquivo.

**Objetivo Central:** Transformar o protótipo em uma base limpa onde a Lógica (Modelo/Física) seja completamente agnóstica em relação à Visão (Renderização/Three.js), preparando os scripts para conversão direta para GDScript (Godot).

> **🧊 DIRETRIZ DE CÓDIGO LEGADO (FROZEN):**
> O diretório `src/weapons/models/*.js` (HK416, AK47, etc.) contém geração procedural de malhas (Three.js estrito). Na Godot, usaremos modelos `.gltf`. Portanto, **NÃO REFATORE** nem otimize esses arquivos. Eles são código descartável e só existem para validação visual provisória.

**Regras para Agentes Implementadores:**
1. Leia o arquivo `DEFECTS_AND_VULNERABILITIES.md` e resolva a FASE 1 primeiro.
2. Não quebre as mecânicas atuais. Valide cada mudança.
3. Use a abordagem do Estrangulador: refatore módulos por partes.

---

## 🟢 FASE 1: Estabilização e Assepsia
*Alvo: Limpar o lixo ativo antes de mover a estrutura principal. Refira-se ao arquivo de vulnerabilidades.*
1. [x] **Limpeza de Ciclo de Vida:** Implementar `destroy()` no `Bot.js` (limpar EventBus, Materials, Textures). Atualizar `GameManager.js` para chamar isso. (CONCLUÍDO)
2. [x] **Eliminar Funções Nativas Assíncronas:** Trocar `setInterval` em `Player.js:die()` por contador delta time. (CONCLUÍDO)
3. [x] **Pool de Vetores:** Remover `new THREE.Vector3()` de dentro de `_fire()` em `WeaponSystem.js` e do loop `AIController.js`. (CONCLUÍDO)

---

## 🟡 FASE 2: Desmembramento do "God Object" (Separação `_physics_process` vs `_process`)
*Alvo: Separar o Fixed Update do Render Update, o que é mandatório na arquitetura da Godot.*

### Passo 2.1: Adaptação do Motor Base [x] (CONCLUÍDO)
- **Alvo:** `src/core/Engine.js`
- **Ação:** Modificar a assinatura de `startEngine({ update, render })` para `startEngine({ fixedUpdate, renderUpdate })`. O `fixedUpdate(dt)` continua rodando no acumulador travado a 120Hz. O `renderUpdate(alpha, dtReal)` roda apenas 1 vez por quadro (requestAnimationFrame) com o deltaTime fluído da tela.

### Passo 2.2: A "Cirurgia" no `main.js` [x] (CONCLUÍDO)
- **Alvo:** `src/main.js`
- **Ação:** Quebrar o bloco monolítico em dois ciclos distintos:
  - **`fixedUpdate(dt)`**: Contém APENAS cálculo puro.
    - `player.update(dt, input)`
    - `weapons.update(dt)`
    - `gameManager.update(dt)`
  - **`renderUpdate(alpha, dt)`**: Contém APENAS animação e cosmética.
    - Lerp do FOV (`camera.fov += ...`)
    - `player.updateCamera(camera, dt)`
    - `viewmodel.updatePose` e `viewmodel.applySwayFromRig`
    - `effects.update(dt, camera)`
    - `hud.update(dt)`
    - `scopeSystem.update(dt)`
    - Chamadas de renderização (ex: `renderer.render()`).

### Passo 2.3: Extração de Controllers (Fim do God Script) [x] (CONCLUÍDO)
- **Alvo:** `src/main.js`
- **Ação:**
  - Extrair os eventos de clique, teclado e sliders do HTML para um novo arquivo `src/ui/MenuController.js`.
  - Extrair luzes (`AmbientLight`, `DirectionalLight`, Sombras) e céu para um `src/core/SceneSetup.js`.
  - O `main.js` deve ser apenas o elo condutor de menos de 100 linhas.

---

## 🟠 FASE 3: Isolamento Matemático (GDScript Ready)
*Alvo: Purificar a física e hitboxes das dependências diretas de nós visuais.*

### Passo 3.1: Purificar Caixas de Colisão [x] (CONCLUÍDO)
- **Alvo:** `src/physics/CollisionWorld.js` e `src/world/MapLoader.js`
- **Ação:** Garantir que o CollisionWorld lide APENAS com limites numéricos abstratos (AABB `x,y,z, sx,sy,sz`). O motor de física não deve ter nenhuma propriedade "Mesh" grudada em suas instâncias.

### Passo 3.2: Otimizar o Carregamento Visual do Mapa [x] (CONCLUÍDO)
- **Alvo:** `src/world/MapLoader.js`
- **Ação:** Refazer a construção de blocos visuais usando `THREE.InstancedMesh`. Em vez de instanciar o material "wall" N vezes, cria-se uma instância apenas, alinhando com as hitboxes abstratas do `CollisionWorld`.

### Passo 3.3: Isolar Hitscan (Raycaster) [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/WeaponSystem.js`
- **Ação:** O array de colisões de raycast não deve varrer diretamente os nós 3D complexos da renderização. Construir um array limpo de hitboxes injetados pelo `GameManager`, aproximando o comportamento da função de colisão no PhysicsSpace3D da Godot.

---

## 🟣 FASE 4: Padronização Contratual de Ciclo de Vida (Lifecycle & Clean Tear-Down)
*Alvo: Erradicar acoplamentos remanescentes e garantir destruição/reset limpos de todos os subsistemas.*

### Passo 4.1: Capacidade de Limpeza do Barramento Central [x] (CONCLUÍDO)
- **Alvo:** `src/core/EventBus.js`
- **Ação:** Adicionar suporte a `clearBus(type = null)` para que reinicializações ou mudanças de mapa possam desregistrar ouvintes de uma só vez ou por tópico.

### Passo 4.2: Implementação Uniforme do Contrato `destroy()` [x] (CONCLUÍDO)
- **Alvo:** `AudioSystem.js`, `HUD.js`, `Effects.js`, `ScopeSystem.js`, `SceneSetup.js`, `MenuController.js`, `GameManager.js`, `Player.js`
- **Ação:** Todos os subsistemas agora guardam seus `unsubs` do EventBus e possuem método `destroy()`, liberando áudio, render targets, buffers de partículas, timers de tela e listeners DOM de resize/wheel.

### Passo 4.3: Validação Estática e Integridade de Módulos [x] (CONCLUÍDO)
- **Alvo:** Código-fonte integral em `src/`
- **Ação:** Verificação estrita de sintaxe via `node --check` em todos os módulos, preservando 100% da integridade operacional do jogo.

## 🔵 FASE 5: Inversão de Dependência, InputMap e Desacoplamento Visual
*Alvo: Espelhar a hierarquia de nós da Godot (Scene Tree) e isolar completamente o Character de nós Three.js.*

### Passo 5.0: Limpeza Estrutural (Scripts e Redundâncias) [x] (CONCLUÍDO)
- **Alvo:** Raiz do projeto e `src/core/Config.js`
- **Ação:**
  - Mover os scripts python soltos na raiz (`generate_cargo.py`, `test_suite.py`) para uma nova pasta `tools/`.
  - Remover o arquivo redundante `src/core/Config.js` e atualizar todos os arquivos que o importavam para importar diretamente de `src/core/ConfigLoader.js`.

### Passo 5.1: Abstração do Input (Padrão InputMap / Action Buffer) [x] (CONCLUÍDO)
- **Alvo:** `src/core/Input.js`
- **Ação:** 
  - Mapear teclas do DOM para nomes abstratos de ações configuráveis (`move_forward`, `move_back`, `jump`, `fire`, `ads`, `reload`).
  - Implementar métodos padrão Godot: `isActionPressed(action)`, `isActionJustPressed(action)` / `consumeAction(action)`.
  - Desacoplar leitura de eventos de teclado/mouse da lógica de estado puro.

### Passo 5.2: Inversão de Dependência de Armas (`Character` é dono do `WeaponManager`) [x] (CONCLUÍDO)
- **Alvo:** `src/entities/Character.js`, `src/weapons/WeaponSystem.js`, `src/main.js`
- **Ação:**
  - `Character` passa a instanciar e ser dono de um `WeaponManager` (componente filho).
  - O `main.js` não deve orquestrar armas soltas. `player.update(dt)` gerencia o `player.weaponManager`.
  - Como `Bot` também herda de `Character`, bots ganham a mesma capacidade de portar armas de forma simétrica.

### Passo 5.3: Remoção do "Lixo" Visual do Bot e Player (`CharacterView`) [x] (CONCLUÍDO)
- **Alvo:** `src/entities/Character.js`, `src/entities/Bot.js`, novo `src/view/CharacterView.js`
- **Ação:**
  - Extrair criação de `THREE.Mesh`, materiais e hierarquias 3D de dentro de `Character` e `Bot`.
  - `Character` mantém apenas física, posição `(x, y, z)`, hitbox matemática e estado.
  - `CharacterView` (View) apenas acompanha a entidade lógica no `renderUpdate` para atualizar malhas na cena.

---

## ⚡ FASE 6: Escala Física (Particionamento Espacial no `CollisionWorld`)
*Alvo: Erradicar o gargalo O(N) nas checagens de colisão e raycasts sem quebrar a física.*

### Passo 6.1: Grid Espacial (Spatial Hash Grid) [x] (CONCLUÍDO)
- **Alvo:** `src/physics/CollisionWorld.js`
- **Ação:**
  - Dividir o mundo em células 2D/3D (ex: grades de 4x4 metros).
  - Inserir caixas de colisão apenas nas células que elas tocam.
  - No `moveAndSlide` e `raycast`, testar interseção apenas contra caixas das células relevantes (redução de O(N) para O(1) médio).

---

## 🧠 FASE 7: IA Tática para Bots (Finite State Machine / FSM)
*Alvo: Mudar a IA ingênua para uma arquitetura orientada a estados modular (1:1 com nós de Behavior da Godot).*

### Passo 7.1: Máquina de Estados Finita (FSM) [x] (CONCLUÍDO)
- **Alvo:** `src/ai/AIController.js`, novo diretório `src/ai/states/`
- **Ação:**
  - Quebrar o `switch(this.state)` em classes de estado: `PatrolState`, `EngageState`, `CoverState`, `FleeState`, `SearchState`.
  - Implementar suporte à audição de tiros (bots escutam disparos via `EventBus` e mudam para `SearchState` na direção do som).
  - Bots recuam ou procuram cobertura (*cover*) quando HP < 30%.
  - Bots utilizam o `WeaponManager` unificado para atirar, recarregar e sofrer dispersão real da arma.

---

## 🟤 FASE 8: Sistema de Loot in-Game e Weapon Drops
*Alvo: Permitir que armas sejam dropadas no chão ao morrer e coletadas por outras entidades.*

### Passo 8.1: Entidade `ItemDrop` (Física + Visual) [x] (CONCLUÍDO)
- **Alvo:** novo `src/world/ItemDrop.js`, `src/physics/CollisionWorld.js`
- **Ação:**
  - Objeto com AABB de gatilho (trigger) no chão, contendo metadados da arma (`weaponId`, munição no pente).
  - Representação visual simples no chão (mesh da arma ou caixa de loot).

### Passo 8.2: Mecânica de Drop e Coleta [x] (CONCLUÍDO)
- **Alvo:** `src/core/GameManager.js`, `src/entities/Player.js`, `src/entities/Bot.js`
- **Ação:**
  - Ao morrer (`die()`), a entidade solta sua arma equipada instanciando um `ItemDrop` na posição.
  - O Player possui slots limitados (ex: Primária e Secundária). Ao se aproximar de um `ItemDrop`, pode coletar (substituindo a arma atual ou preenchendo slot vazio).

---

## ⚫ FASE 9: Validação "Headless" (Prova de Fogo Server/Multiplayer)
*Alvo: Comprovar que todo o ecossistema roda de forma autônoma sem DOM e sem WebGL/Three.js.*

### Passo 9.1: Teste de Simulação Headless [x] (CONCLUÍDO)
- **Alvo:** novo `test/headless_sim.js` (executável via `node test/headless_sim.js`)
- **Ação:**
  - Instanciar `CollisionWorld`, `GameManager`, bots com IA e jogador simulado sem criar `renderer` ou canvas.
  - Rodar 600 ticks de `fixedUpdate(1/120)` em Node.js puro.
  - Validar movimentação, decisão da FSM e tiros puramente na memória (logs de terminal).
  - Conclusão: prova definitiva de compatibilidade para Servidor Dedicado / Godot.

---

## 🟣 FASE 10: Módulo de Balística Avançada (Interna, Externa e Terminal)
*Alvo: Sistema desacoplado e data-driven para balística, precisão dinâmica, recuo e queda de projétil.*

### Passo 10.1: Expansão do Schema Base de Dados (`weapons.json` & `WeaponDefs.js`) [x] (CONCLUÍDO)
- **Alvo:** `assets/weapons/weapons.json`, `src/weapons/WeaponDefs.js`
- **Ação:**
  - Estruturar metadados de balística (interna, externa e terminal) para as armas com suporte opcional / defensivo.
  - Garantir backward compatibility no `WeaponDefs.js` com valores padrão (fallbacks) caso alguma chave seja omitida.

### Passo 10.2: Motor Matemático `BallisticsCalculator.js` [x] (CONCLUÍDO)
- **Alvo:** novo `src/weapons/BallisticsCalculator.js`
- **Ação:**
  - Implementar cálculos puros e sem estado (stateless):
    - `calculateCurrentSpread`: precisão base em zero sway + perda dinâmica por movimento (walk, run, strafe) e disparo contínuo + recuperação temporal.
    - `calculateRecoilImpulse`: recuo vertical/horizontal e recoil pattern dependente de sequência de disparos e tempo de recuperação.
    - `calculateSway`: oscilação natural do cano parada e multiplicador em ADS.
    - `calculateTerminalImpact`: queda de dano por distância e compensação parabólica de queda de projétil (bullet drop).

### Passo 10.3: Integração no `WeaponSystem.js` [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/WeaponSystem.js`
- **Ação:**
  - Delegar dispersão, recoil, sway e dano para o `BallisticsCalculator`.
  - Gerenciar temporizadores de recuperação de precisão e recoil de forma determinística por arma.
  - Aplicar dispersão e balística terminal (queda de projétil e atenuação de dano por distância).

### Passo 10.4: Validação Headless & Resiliência Antifrágil [x] (CONCLUÍDO)
- **Alvo:** `test/headless_sim.js`, `test/ballistics_test.js`
- **Ação:**
  - Validar integridade e testar que a deleção de nós opcionais do JSON não quebra o sistema.

---

## 🟣 FASE 11: Sistema de Projéteis Físicos e CCD (Continuous Collision Detection)
*Alvo: Simulação balística realista com projéteis físicos (Object Pool), trajetória parabólica com gravidade/vento, colisão contínua (CCD sweep raycast) e atraso acústico no hitmarker.*

### Passo 11.1: Gerenciador de Projéteis com Object Pool (`ProjectileManager.js`) [x] (CONCLUÍDO)
- **Alvo:** novo `src/weapons/ProjectileManager.js`
- **Ação:**
  - Criar pool pré-alocado de instâncias de projétil (evita Garbage Collection e congelamentos em mobile/low-end).
  - Suporte a velocidade vetorial inicial baseada em `bulletSpeed` do JSON, gravidade configurável (`bulletDrop`), arrasto do ar (drag) e vento vetorial global.
  - Implementar método `spawn(origin, direction, weaponDef, owner)` e `update(dt)`.

### Passo 11.2: Detecção de Colisão Contínua (CCD Sweep) & Resolução de Dano [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/ProjectileManager.js`
- **Ação:**
  - Em cada sub-passo de simulação, testar o segmento `P_ant -> P_atual` via raycast no `CollisionWorld` e hitboxes de bots/jogadores.
  - Prevenir "tunneling" (balas atravessando alvos velozes entre frames).
  - Delegar cálculo de atenuação de dano terminal e penetração para o `BallisticsCalculator`.

### Passo 11.3: Integração com `WeaponSystem.js` e `AIController.js` [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/WeaponSystem.js`, `src/ai/AIController.js`
- **Ação:**
  - Substituir raycast hitscan instantâneo pelo spawn de projéteis com velocidade real e dispersão aplicada.
  - Garantir disparo tanto para armas convencionais quanto espingardas (pellets independentes com dispersão cônica).

### Passo 11.4: Sistema de Áudio Acústico com Atraso Sônico [x] (CONCLUÍDO)
- **Alvo:** `src/audio/AudioSystem.js`
- **Ação:**
  - Enfileirar reprodução de som de impacto / hitmarker com atraso acústico proporcional à distância (`dist / 343.0` s) para tiros a longa distância.

### Passo 11.5: Tracers Parabólicos Dinâmicos & Validação Visual e Headless [x] (CONCLUÍDO)
- **Alvo:** `src/fx/Effects.js`, `test/projectile_test.js`, `test/headless_sim.js`
- **Ação:**
  - Atualizar traçantes visuais para acompanhar a posição real em voo e a curva parabólica das balas.
  - Criar testes unitários e de simulação headless demonstrando tempo de voo e taxa de quadros estável (>30k ticks/seg).




## FASE 12: Layout Mobile Ergon�mico (Estilo PUBG)
- **Objetivo**: Traduzir refer�ncias do PUBG Mobile em CSS e PWA Mobile touch.
- **A��es**: Ajustar index.html e TouchInput.js [x] (CONCLU�DO)

## FASE 13: Evolução Tática, Controles, Inventário de 2 Armas, Drops 3D e Lean
- **Objetivo**: Implementar controles táticos refinados (lean, rebinds, mobile), inventário restrito a 2 slots com troca de drop, drops 3D giratórios, bots com armas randômicas, mira ótica da VSS unificada e tracers visíveis.

### Passo 13.1: Rebind de Teclado & Botões Touch Especializados [x] (CONCLUÍDO)
- **Alvo:** src/core/Input.js, src/core/TouchInput.js, index.html
- **Ações:**
  - Rebind de interação: mudar tecla de interação de E para F.
  - Adicionar ações de inclinação leanLeft (Q) e leanRight (E) no Input.js.
  - Criar novo botão de tiro no canto superior direito apenas no mobile (#btn-touch-fire-top) para suporte a pegada claw/4 dedos.
  - Tornar o botão de interação touch (#btn-touch-interact) contextual: visível apenas quando próximo a portas ou drops de armas (interact:target).

### Passo 13.2: Menu de Configurações Mobile Master-Detail (1/4 Navegação + 3/4 Conteúdo) [x] (CONCLUÍDO)
- **Alvo:** index.html, src/ui/MenuController.js
- **Ações:**
  - Estilização responsiva em telas pequenas: menu lateral em 1/4 da tela com abas e 3/4 para conteúdo (sensibilidade, arma, áudio, etc.).
  - Adequação de toques e sliders para ergonomia mobile.

### Passo 13.3: Sistema de Lean / Inclinação de Tronco (Player e Bots) [x] (CONCLUÍDO)
- **Alvo:** src/entities/Player.js, src/weapons/Viewmodel.js, src/ai/AIController.js
- **Ações:**
  - Implementar transição suave de lean no Player.js com offset lateral da câmera e inclinação angular suave (oll/eixo Z).
  - Inclinar viewmodel da arma proporcionalmente com inércia natural.
  - Implementar lógica na IA dos bots para realizar peek/lean em quinas e coberturas durante combate.

### Passo 13.4: Sistema de Inventário de 2 Armas (Slots 1 e 2) & Mecânica de Substituição de Drop [x] (CONCLUÍDO)
- **Alvo:** src/weapons/WeaponSystem.js, src/core/GameManager.js, src/ui/HUD.js
- **Ações:**
  - Limitar inventário do jogador a 2 slots: [slot1, slot2].
  - O jogador inicia somente com a arma escolhida (slot 1); slot 2 vazio.
  - Teclas 1 e 2 (e toque no HUD/Touch) selecionam estritamente o slot ativo.
  - Ao interagir (F ou touch) com um drop no chão:
    - Se o slot atual estiver vazio, equipa no slot.
    - Se já tiver arma em mãos, dropa a arma atual no chão e equipa a nova no slot ativo.
  - Atualizar HUD com indicadores dos 2 slots de arma e munição individual.

### Passo 13.5: Bots com Armas Randômicas & Drop 3D Giratório no Chão [x] (CONCLUÍDO)
- **Alvo:** src/core/GameManager.js, src/world/ItemDrop.js
- **Ações:**
  - Sortear armas variadas do catálogo para os bots na inicialização.
  - Ao morrer, bot dropa a arma específica que estava empunhando.
  - No ItemDrop.js, instanciar modelo/silhueta 3D representativa da arma girando suavemente (otation.y += dt * 1.5) e flutuando com oscilação senoidal suave.

### Passo 13.6: Unificação do Scope da VSS (Sistema ScopeSystem) [x] (CONCLUÍDO)
- **Alvo:** src/weapons/ScopeSystem.js, src/weapons/WeaponSystem.js
- **Ações:**
  - Eliminar mira antiga/de teste da VSS.
  - Integrar VSS ao ScopeSystem utilizando a ótica/render target dinâmico e retículo iluminado com telemetria e zoom variável.

### Passo 13.7: Refinamento Visual de Tracers Físicos (Legibilidade e Contraste) [x] (CONCLUÍDO)
- **Alvo:** src/fx/Effects.js
- **Ações:**
  - Ajustar contraste, espessura, opacidade e curva temporal do traçante no Effects.js para garantir alta visibilidade cinematográfica em movimento sem estagnação no ar.

### Passo 13.8: Sistema Completo de FlashTracers Desacoplados (CS2-Style) & Muzzle Tracking Dinâmico [x] (CONCLUÍDO)
- **Alvo:** `src/fx/Effects.js`, `src/weapons/ProjectileManager.js`, `src/weapons/WeaponSystem.js`, `assets/weapons/weapons.json`
- **Ações:**
  - Desacoplamento do tracer visual da física contínua do projétil (FlashTracer com raycast síncrono no disparo).
  - Correção de opacidade/visibilidade no Frame 0 eliminando pop-in e atrasos de renderização.
  - Refatoração dos perfis de tracer para parametrização intuitiva (`streakLength`, `style: 'swipe' | 'streak'`) totalmente editáveis por arma no JSON.
  - Implementação do `originTracker` dinâmico para rastreamento em tempo real da ponta do cano (Viewmodel Mount) no espaço de mundo, eliminando a desconexão visual durante strafes e movimentação veloz.

---

## FASE 14: Polimento Físico, Contato com Paredes & Acessibilidade [x] (CONCLUÍDO)

### Passo 14.1: Weapon Wall Press & Obstrução Balística [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/WeaponSystem.js`, `src/weapons/Viewmodel.js`, `src/physics/CollisionWorld.js`
- **Ações:**
  - Raycast contínuo na direção frontal da câmera iniciando a detecção e recolhimento **50cm antes do cano encostar na parede** (`barrelLength + 0.50m`).
  - Cálculo de `wallCompression` proporcional (0.0 a 1.0) com amortecimento suave (`dt * 14`).
  - No `Viewmodel.js`:
    - Elevação do cano em **+75 graus** para cima (`rotation.x += wallCompression * 1.31 rad`).
    - Rotação sutil de **15 graus** em direção ao jogador/peito (`rotation.y -= wallCompression * 0.26 rad`).
    - Recuo em Z (`+0.20m`), elevação física em Y (`+0.08m`) e leve inclinação de apoio (banking em Z).
  - Bloqueio automático de ADS quando `wallCompression >= 0.45`.
  - Penalidade progressiva de dispersão hipfire proporcional à compressão.
  - Bloqueio total de disparo se `wallCompression > 0.85` com emissão de alerta HUD `'CANO OBSTRUÍDO PELA PAREDE'` e som de clique mecânico sem gasto de munição.

### Passo 14.2: Foley de Passos por Material [x] (CONCLUÍDO)
- **Alvo:** `src/physics/CollisionWorld.js`, `src/world/MapLoader.js`, `src/entities/Character.js`, `src/entities/Player.js`, `src/audio/AudioSystem.js`, `assets/config/audio.json`
- **Ações:**
  - `CollisionWorld.moveAndSlide` registra o material do bloco de suporte no contato vertical (`res.groundMaterial = box.meta?.material || 'floor'`).
  - `MapLoader.js` repassa os metadados de material (`cobblestones`, `wood`, `metal`, `sand`, `grass`, `concrete`) para o `CollisionWorld`.
  - `Character.js` propaga `groundMaterial` durante a simulação de física em 120Hz.
  - Evento `'player:footstep'` emite `{ pos, material }`.
  - `AudioSystem.js` sintetiza proceduralmente o som de passos adaptando frequência base, ruído de impacto e ressonância de acordo com o material (`wood`: ressonância oca mais grave; `metal`: click metálico em alta frequência; `dirt`/`sand`: fricção granular abafada; `concrete`: estalo seco clássico).

### Passo 14.3: Sliders de Acessibilidade & Persistência Local [x] (CONCLUÍDO)
- **Alvo:** `assets/config/gameplay.json`, `src/core/ConfigLoader.js`, `index.html`, `src/ui/MenuController.js`
- **Ações:**
  - Adicionado bloco `"accessibility": { "headbobScale": 1.0, "shakeScale": 1.0, "vibrationEnabled": true }` nos dados globais.
  - `ConfigLoader.js` inicializa e mescla configurações de acessibilidade.
  - `index.html` e `MenuController.js` vinculam os controles na aba de Ajustes do Menu com persistência em `localStorage`:
    - Balanço de Cabeça (Headbob): slider 0% a 200%.
    - Tremor de Câmera (Shake): slider 0% a 200%.
    - Vibração Tátil Mobile: seletor Ativada / Desativada.

### Passo 14.4: Modulação Data-Driven de Headbob & Shake (±20%) [x] (CONCLUÍDO)
- **Alvo:** `src/core/CameraRig.js`, `src/weapons/Viewmodel.js`, `test/phase14_accessibility_test.js`
- **Ações:**
  - `CameraRig.js` modula `bobAmt` e `shakePos`/`shakeRot` multiplicando `CONFIG.ACCESSIBILITY.headbobScale` e `CONFIG.ACCESSIBILITY.shakeScale`.
  - `Viewmodel.js` modula a amplitude de balanço da arma de acordo com a escala de acessibilidade.
  - Testes unitários validam matematicamente a variação de ±20% (0.80x e 1.20x) e anulação total (0.0x).

### Passo 14.5: Feedback Tátil Háptico Mobile [x] (CONCLUÍDO)
- **Alvo:** `src/main.js`
- **Ações:**
  - Integração com `navigator.vibrate` nos eventos do EventBus (`weapon:fired` com 18ms, `player:damaged` com padrão `[35, 25, 35]ms`, `weapon:empty` com 10ms).
  - Respeita rigorosamente a configuração de acessibilidade do usuário.

---

## FASE 15: Remasterização Visual PBR Procedural, Props Arquitetônicos & Loading Screen [x] (CONCLUÍDO)

### Passo 15.1: Gerador de Texturas Procedurais & PBR Maps (`TextureGenerator.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/world/TextureGenerator.js`
- **Ações:**
  - Síntese algorítmica em Canvas 2D de alta performance sem requerer downloads pesados de imagens externas:
    - Mapas de Albedo/Diffuse, Bump (relevo normalizado) e Roughness/Alpha.
    - Superfícies cobertas: paralelepípedos de rua (`cobblestones`), reboco toscano descascado (`peeling wall` ocre e terracota), madeira de porta/caixote, telhas curvas de terracota, arenito do deserto, folhagens com transparência (`alphaTest`), tábuas de caixote e ferro fundido.
  - Resiliente em Node.js/headless com fallbacks seguros.

### Passo 15.2: Fábrica de Materiais Triplanar com Lazy Loading (`MaterialFactory.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/world/MaterialFactory.js`, `test/loading_system_test.js`
- **Ações:**
  - Mapeamento World-Space UV (Triplanar Shader Injection): injeção de shader GLSL que calcula as coordenadas UV a partir da posição no mundo (`vWorldPos`), impedindo estiramento em caixas/paredes de qualquer proporção ou escala.
  - Lazy Loading sob demanda: registro instantâneo de 50 receitas de materiais com compilação diferida, garantindo zero-lag na inicialização.
  - Pré-carregamento assíncrono durante a tela de loading (`preloadMaterials`) cedendo tempo de execução para a thread principal atualizar o DOM.
  - Suporte a 3 modos de renderização em tempo real: `pbr` (completo), `flat_textures` (sem relevo) e `color_only` (estilo blocky retrô).
  - Suporte ao carregamento e teste de texturas externas em tempo real (PNG/JPG/WebP) via File API.

### Passo 15.3: Props Arquitetônicos Modulares & Mapa CS Italy (`ItalyProps.js`, `italy.json`) [x] (CONCLUÍDO)
- **Alvo:** `src/world/ItalyProps.js`, `assets/maps/italy.json`, `test/italy_map_test.js`
- **Ações:**
  - Biblioteca completa de props modulares para arquitetura urbana italiana:
    - Arcos de pedra, varandas com corrimão de ferro trabalhado, janelas com venezianas, portas rústicas de madeira, toldos listrados de feira, barris de vinho, caixas de carga, luminárias suspensas e videiras/heras em paredes.
  - Criação do mapa `italy.json` (CS Italy) com iluminação toscana, névoa atmosférica, rua de paralelepípedos, prédios com reboco descascado e pontos de spawn balanceados.
  - Remasterização de `dust.json`, `village.json` e `woods.json` com props ambientais.

### Passo 15.4: Tela de Carregamento Tática (`LoadingScreen.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/ui/LoadingScreen.js`, `index.html`, `src/world/MapLoader.js`, `src/main.js`
- **Ações:**
  - Tela de carregamento imersiva com barra de progresso em tempo real, percentual (0% a 100%), nome do mapa ativo e mensagens descritivas do pipeline.
  - Transição suave com animação CSS `fade-out` ao completar o setup de cena e materiais.
  - Resiliência total para testes headless e ambientes sem nó de documento.

### Passo 15.5: Controles de Textura e PBR no Menu (`MenuController.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/ui/MenuController.js`, `index.html`
- **Ações:**
  - Criação da aba **🎨 TEXTURAS** no menu de pausa/inicial:
    - Seletor de Modo de Renderização (PBR Procedural, Albedo Puro, Cores Sólidas).
    - Slider de Intensidade de Relevo Bump (0.00 a 0.12).
    - Slider de Escala de Repetição UV World-Space (0.10 a 1.00).
    - Interface para carregar e inspecionar qualquer imagem externa local em materiais selecionados.

---

## 🔴 FASE 16: Áudio Espacial 3D, Oclusão Acústica por Raycast & Granada de Fumaça (Tier S/A) [x] (CONCLUÍDO)

### Passo 16.1: Listener e Panning 3D HRTF (`AudioSystem.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/audio/AudioSystem.js`, `src/main.js`
- **Ações:**
  - Vinculação de `audio.setCamera(camera)` e `audio.setWorld(world)`.
  - Atualização contínua do ouvinte no Web Audio API (`ctx.listener`) com posição 3D e orientação vetorial `forward` / `up` no `renderUpdate` do loop principal.
  - PannerNode com algoritmo `'HRTF'`, atenuação `'inverse'`, distância de referência e rolloff físico realista para sons no ambiente.

### Passo 16.2: Oclusão Acústica Geométrica Dinâmica (`AudioSystem.checkOcclusion`) [x] (CONCLUÍDO)
- **Alvo:** `src/audio/AudioSystem.js`
- **Ações:**
  - Raycast contínuo pelo `CollisionWorld` entre a posição do ouvinte (câmera) e o emissor sonoro.
  - Filtro biquad passa-baixa dinâmico (`lowpass`):
    - Em linha de visão desobstruída: frequência de corte aberta em 13.000 Hz a 14.000 Hz (áudio nítido e estalado).
    - Obstruído por parede sólida/porta: frequência de corte atenuada exponencialmente para 550 Hz com corte suave de volume (som abafado/"muffled").
  - Rampa temporal via `setTargetAtTime` para eliminar qualquer ruído ou estalo na transição ao contornar esquinas e portas.

### Passo 16.3: Granada de Fumaça M18 com Cortina Volumétrica (`SmokeGrenade.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/SmokeGrenade.js`, `assets/config/audio.json`
- **Ações:**
  - Balística parabólica de lançamento (velocidade inicial 15 m/s + arco) e detecção contínua de colisão com quiques dinâmicos (`smoke:bounce`) em pisos e paredes.
  - Canister verde-oliva detalhado com anel amarelo e detonador metálico.
  - Cortina de fumaça volumétrica e rotacional com 14 esferas translúcidas, expansão suave e fade-out gradual nos últimos 2.5s.
  - **Duração rigorosa de 10 segundos** de fumaça ativa.
  - Emissão contínua de ruído aerado sob pressão (`smoke:hiss`) modulado no espaço 3D para testar a oclusão por paredes.

### Passo 16.4: Smoke Grenade Manager e Cooldown de 30s (`SmokeGrenadeManager.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/SmokeGrenadeManager.js`, `src/core/Input.js`, `src/core/TouchInput.js`, `index.html`
- **Ações:**
  - Acionamento via **tecla `U`** no teclado ou botão touch **`SMOKE`** no mobile.
  - **Cooldown de exatamente 30 segundos** com bloqueio de spam acidental, aviso sonoro de gatilho vazio (`weapon:empty`) e prompt no HUD (`"FUMAÇA EM COOLDOWN (Xs)"`).
  - Suporte completo no HUD do PC (`index.html`) e mapeamento móvel via `TouchInput`.

### Passo 16.5: Suíte de Testes Automatizada (`test/audio_spatial_occlusion_test.js`) [x] (CONCLUÍDO)
- **Alvo:** `test/audio_spatial_occlusion_test.js`, `package.json`
- **Ações:**
  - Validação headless do raycast de oclusão acústica (atrás de parede = `true`, visão limpa = `false`).
  - Validação do cooldown rigoroso de 30 segundos e descarte automático da fumaça aos 10 segundos.
  - Integrado ao `npm test` oficial com 100% de aprovação.

---

## 🟠 FASE 17: Muzzle Flash Data-Driven e Mascaramento de Efeito Elástico de Tracer (Tier S/A) [x] (CONCLUÍDO)

### Passo 17.1: Especificação de `flashProfile` em `ammo.json` [x] (CONCLUÍDO)
- **Alvo:** `assets/weapons/ammo.json`, `src/weapons/WeaponDefs.js`
- **Ações:**
  - Inserção do bloco `flashProfile` em todas as munições dentro de cada `tracerProfile`:
    - `size`, `opacity`, `lightIntensity`, `lightDistance`, `color`, `duration` e `maskElasticOffset`.
  - Regra de calibração rigorosa conforme a posição do bocal (`muzzleLocal`): armas com cano mais curto/colado ao corpo (ex: P9 a -0.11m e UZI a -0.22m) recebem flash substancialmente maior (`size: 0.42 / 0.38`, `lightIntensity: 15 / 13`, `maskElasticOffset: 0.09 / 0.075`) para mascarar a emergência e o efeito de estiramento elástico em viradas bruscas de mouse.
  - Armas com canos longos ou silenciadas (ex: VSS com silenciador integrado a -0.69m) recebem flash mínimo (`size: 0.12`, `opacity: 0.28`, `lightIntensity: 2.0`).
  - Compilação automática e propagação transparente via `compileWeapons()` e `initWeaponsFromData()`.

### Passo 17.2: Muzzle Flash Visual Volumétrico no Viewmodel (`Viewmodel.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/Viewmodel.js`, `src/weapons/WeaponSystem.js`
- **Ações:**
  - Instanciação de quads cruzados com material aditivo (`flashGroup`, `flashMesh1`, `flashMesh2`, `flashMesh3`) no mount do viewmodel.
  - Posicionamento dinâmico automático e alinhamento no vetor `muzzleLocal` da arma ativa com offset de máscara para frente.
  - `flash(def)` atualizado para consumir parâmetros do `flashProfile` compilado (escala, opacidade, intensidade da luz e cor espectral).
  - Fade-out suave em `decayFlash(dt)`.

### Passo 17.3: Mascaramento Dinâmico de Origem nos Estilos de Tracer (`Effects.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/fx/Effects.js`
- **Ações:**
  - Integração de `maskElasticOffset` na cauda/origem dos traçantes nos estilos `photographic` e `laser`.
  - Elimina a linha hiper-fechada "elástica" no bocal durante rajadas automáticas com rotação rápida de mouse.

### Passo 17.4: Teste Automatizado de Integridade e Proporção (`test/tracer_flash_profile_test.js`) [x] (CONCLUÍDO)
- **Alvo:** `test/tracer_flash_profile_test.js`, `package.json`
- **Ações:**
  - Validação da presença e tipos do `flashProfile` em 100% das munições.
  - Verificação de herança e compilação em todas as armas do `weapons.json`.
  - Comprovação matemática da proporção (P9/UZI > AR15/Proto > VSS).
  - Integrado ao `npm test` oficial com 100% de aprovação.

---

## 🟢 FASE 18: Modelo do Soldado Blocky no Player & Câmera em 3ª Pessoa (Tecla V) [x] (CONCLUÍDO)

### Passo 18.1: Integração do Soldado Blocky no Player (`CharacterView.js` & `Player.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/entities/Player.js`, `src/view/CharacterView.js`, `src/main.js`
- **Ações:**
  - Instanciação de `CharacterView` completa do Soldado Blocky no `Player` com malha militar tática (uniforme, colete com bolsas de munição, capacete com óculos de combate, pernas articuladas e fuzil blocky nas mãos).
  - Articulação completa de pescoço (`headGroup`) e braços (`armsGroup`) sincronizada em tempo real com o `pitch` da mira (olhar para cima/baixo), permitindo ver o soldado apontando a arma verticalmente na mesma direção da retícula.
  - Animação procedural completa herdada de locomoção (passadas alternadas das pernas, bobbing do tronco, respiração em repouso e inclinação tática de lean `Q/E`).
  - Muzzle flash sincronizado em 3ª pessoa disparado através do evento `weapon:fired`.

### Passo 18.2: Mecânica de Alternância de Perspectiva (Tecla `V` e Mobile `3ªP`) [x] (CONCLUÍDO)
- **Alvo:** `src/core/Input.js`, `src/core/TouchInput.js`, `index.html`, `src/entities/Player.js`
- **Ações:**
  - Mapeamento dedicado da tecla **`V`** (`toggle_perspective`) no `Input.js`.
  - Botão tátil **`3ªP`** adicionado no HUD mobile (`TouchInput.js`).
  - Mensagem de popup no HUD indicando `"3ª PESSOA ATIVADA"` e `"1ª PESSOA ATIVADA"`.

### Passo 18.3: Câmera Over-the-Shoulder com Spring-Arm Anti-Clipping (`CameraRig.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/core/CameraRig.js`, `src/main.js`
- **Ações:**
  - Transição contínua e suave (`thirdPersonAmount`) entre a visão em primeira pessoa e terceira pessoa.
  - Câmera posicionada a 2.4 metros atrás do jogador com leve deslocamento tático sobre o ombro direito (`tpOffsetRight = 0.45m`, `tpOffsetY = 0.22m`).
  - **Spring Arm com Raycast Físico no `CollisionWorld`:** caso uma parede ou obstáculo sólido fique entre a câmera e o soldado, a câmera é projetada instantaneamente para a frente, impedindo clipping e visão vazada através de superfícies sólidas.
  - Em 3ª pessoa o viewmodel de braços soltos da 1ª pessoa é ocultado automaticamente, evitando sobreposição de malhas.

### Passo 18.4: Suíte de Testes Automatizada (`test/third_person_test.js`) [x] (CONCLUÍDO)
- **Alvo:** `test/third_person_test.js`, `package.json`
- **Ações:**
  - Validação headless do estado inicial em 1ª pessoa.
  - Validação do acionamento via `togglePerspective()`.
  - Validação da interpolação suave e do offset over-the-shoulder.
  - Validação do Spring Arm encurtando a distância contra paredes sólidas.
  - Integrado ao `npm test` oficial com 100% de aprovação.

---

## 🟢 FASE 19: Supressão Tática (Near-Miss) & Balística Física de Bots [x] (CONCLUÍDO)

### Passo 19.1: Projéteis Físicos de Bots no CCD (`AIController.js` & `GameManager.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/ai/AIController.js`, `src/core/GameManager.js`
- **Ações:**
  - `AIController._fire` exporta `muzzleWorld`, `dir` e `pos` com dispersão calibrada para raspar rente à cabeça ($0.6\,\text{m}$ a $2.3\,\text{m}$).
  - `GameManager` conecta `bot:fired` diretamente a `this.weapons.projectileManager.spawn({ owner: 'bot', ... })`.
  - Disparos de bots agora viajam como entidades físicas contínuas com CCD, gravidade e velocidade balística real.

### Passo 19.2: Detecção Universal de Near-Miss (`ProjectileManager._checkSuppression`) [x] (CONCLUÍDO)
- **Alvo:** `src/weapons/ProjectileManager.js`
- **Ações:**
  - Implementação do método central `_checkSuppression(p, startPos, endPos, entityHit)`.
  - Verificação executada em todos os passos da trajetória balística (vôo livre, ricochete, penetração e antes de impactos em obstáculos sólidos).
  - Flags por projétil (`hasSuppressedPlayer`, `suppressedBots`) para garantir gatilho único por projétil sem duplicidade.

### Passo 19.3: Feedback Tático Audiovisual & Visão de Túnel (`HUD.js`, `index.html`, `AudioSystem.js`) [x] (CONCLUÍDO)
- **Alvo:** `src/ui/HUD.js`, `index.html`, `src/audio/AudioSystem.js`, `src/core/CameraRig.js`
- **Ações:**
  - Vinheta periférica escura com `backdrop-filter: blur(2.5px)` simulando visão de túnel sob fogo cerrado.
  - Câmera sacode e aplica flinch direcional com kick aleatório no `CameraRig`.
  - Áudio espacial 3D dispara estalo supersônico (`bullet_whizby`) na coordenada exata de aproximação da bala.
  - Transição imediata (`0.04s`) e fade-out tático suave (`0.45s`).

### Passo 19.4: Suíte de Validação de Supressão (`test/penetration_ricochet_test.js`) [x] (CONCLUÍDO)
- **Alvo:** `test/penetration_ricochet_test.js`
- **Ações:**
  - Teste 4: Projétil do jogador passando a $<1.5\,\text{m}$ da cabeça do bot aciona `bot:suppressed` e reduz precisão da IA.
  - Teste 5: Projétil de bot passando a $0.8\,\text{m}$ do jogador e colidindo com parede logo atrás aciona `player:suppression`, flinch e camera shake.
  - Integrado ao `npm test` oficial com 100% de aprovação.

---

# 🏁 MARCO FINAL: TODAS AS MECÂNICAS EXPERIMENTAIS CONCLUÍDAS E INTEGRADAS
> **🔒 STATUS DA BASE JAVASCRIPT: CONGELADA PARA TRANSIÇÃO GODOT 4.X**
> Todas as mecânicas planejadas para a prova de conceito estão 100% integradas, testadas e estáveis.
> A partir deste ponto, o desenvolvimento passa para:
> 1. Upgrades e afinamento de parâmetros (data-driven).
> 2. Transcrição arquitetural direta para Godot 4.x (GDScript/C#).
> Consulte o arquivo `GODOT_MIGRATION_GUIDE.md` para as instruções completas de transferência.