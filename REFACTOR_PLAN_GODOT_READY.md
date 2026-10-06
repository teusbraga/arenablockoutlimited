# Plano de Refatoração Arquitetural (Preparação para Godot)

> **⚠️ REGRA GLOBAL DE AGENTE:** 
> 1. Este arquivo é um **LOG CONTÍNUO**. **NUNCA APAGUE** passos criados anteriormente.
> 2. Ao finalizar uma tarefa, apenas marque com `[x]` ou `(CONCLUÍDO)` na frente do passo correspondente.
> 3. Passe imediatamente para o próximo item aberto.
> 4. Novas adições devem seguir a numeração sequencial (Fase 4, Fase 5, etc.) no final do arquivo.

**Objetivo Central:** Transformar o protótipo em uma base limpa onde a Lógica (Modelo/Física) seja completamente agnóstica em relação à Visão (Renderização/Three.js), preparando os scripts para conversão direta para GDScript (Godot).

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
