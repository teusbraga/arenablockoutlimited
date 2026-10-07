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
