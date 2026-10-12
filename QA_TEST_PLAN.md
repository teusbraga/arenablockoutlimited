# 📋 Plano Mestre de Testes de QA — Arena Blockout: Limited
> **Base de Referência:** [`ENGINEERING_SPEC.md`](./ENGINEERING_SPEC.md) & [`README_CLONE.md`](./README_CLONE.md)  
> **Destinatários:** Equipe de QA, Engenharia de Software, SDETs e Release Managers  
> **Versão do Documento:** 1.0 (Produção / Release Candidate)  
> **Classificação:** Documento Técnico de Garantia da Qualidade (QA)

---

## 1. Sumário Executivo & Objetivos de Qualidade

Este documento define o **Plano Mestre de Testes (Master Test Plan)** para validação funcional, não-funcional, de regressão e de conformidade do jogo **Arena Blockout: Limited**.

### 1.1 Objetivos de Qualidade
1. **Determinismo Físico e Balístico:** Garantir que o loop desacoplado (120Hz physics / rAF render) opere sem tunelamento balístico (CCD), com detecção milimétrica de impacto e resposta consistente entre plataformas.
2. **Estabilidade de Framerate (Zero-Lag):** Assegurar 60+ FPS em navegadores desktop modernos e 45+ FPS em dispositivos mobile intermediários, auditando pooling de objetos, zero-allocations por frame e ausência de recompilações de shaders.
3. **Blindagem Regressiva dos Traçantes:** Validar a diretiva de desacoplamento de traçantes e muzzles, impedindo que novas alterações provoquem o efeito elástico ("banana whip").
4. **Resiliência PWA / Offline:** Validar ciclo de vida offline-first, registro de Service Worker e estabilidade em execução sem servidor.

---

## 2. Taxonomia de Criticidade e Severidade de Defeitos

| Nível de Criticidade | Sigla | Critério de Classificação | SLA de Correção | Critério de Release |
|---|:---:|---|---|---|
| **Bloqueador** | **P0** | Crash total do browser/tab, tela branca (WSOD), falha no boot de shaders/Three.js, travamento infinito na `LoadingScreen`, perda do ponteiro/input, loop de exceções no rAF. | Imediato (< 4h) | **Zero P0 tolerado para Release** |
| **Crítico** | **P1** | Regressão nos traçantes (tiro banana/chicote), tunelamento de balas através de paredes sólidas sem wallbang, falha de colisão em chão (cair no void), bots não reagindo, freeze ao pausar. | < 24h | **Zero P1 tolerado para Release** |
| **Alto** | **P2** | Falha de carregamento de áudio espacial, cálculo incorreto de spread em ADS, descompasso entre retículo e cano em 3D, porta não abrindo, drop de arma inacessível. | < 48h | Máx. 1 P2 com contorno documentado |
| **Médio** | **P3** | Textura triplanar com desalinhamento sutil, erro cosmético no HUD (ex: K/D não incrementando visualmente em tempo real até o fim do round), atraso na animação de ejeção de cápsula. | Sprint corrente | Tolerado com plano de ação |
| **Baixo / Trivial** | **P4** | Variação de cor de 1-2% na casca do cartucho de espingarda, texto informativo desalinhado por 2px em tela 4K, micro-jitter visual imperceptível a 120 FPS. | Backlog futuro | Liberado |

---

## 3. Matriz de Cobertura e Rastreabilidade de Requisitos (RTM)

Mapeamento direto dos Requisitos Funcionais de [`ENGINEERING_SPEC.md`](./ENGINEERING_SPEC.md) para as Suítes de Teste:

| ID Requisito | Subsistema Coberto | Criticidade | Tipo de Teste | Suíte / Procedimento de Teste |
|---|---|:---:|---|---|
| **RF-01** | Motor de Renderização & Dual-Rate Loop | **P0** | Automatizado + Manual | `headless_sim.js` / TC-ENG-01, TC-ENG-02 |
| **RF-02** | Física AABB, Spatial Hash & moveAndSlide | **P0** | Automatizado | `phase14_accessibility_test.js` / TC-PHY-01, TC-PHY-02 |
| **RF-03** | Carregamento de Mapas & Texturas PBR | **P1** | Automatizado | `italy_map_test.js`, `woods_texture_test.js` / TC-MAP-01 |
| **RF-04** | Balística CCD, Penetração & Ricochete | **P0** | Automatizado + Visual | `projectile_test.js`, `penetration_ricochet_test.js` |
| **RF-05** | Modelos 3D Procedurais & Viewmodels | **P1** | Automatizado + Visual | `tracer_flash_profile_test.js` / TC-WEP-01 |
| **RF-06** | IA dos Bots (FSM, Throttling & Supressão) | **P1** | Automatizado | `headless_sim.js`, `penetration_ricochet_test.js` |
| **RF-07** | HUD, Damage Indicator & Crosshair CS2 | **P1** | Automatizado + Manual | `crosshair_manager.test.js` / TC-HUD-01 |
| **RF-08** | Áudio Procedural Web Audio & Oclusão 3D | **P2** | Automatizado + Auditivo | `audio_spatial_occlusion_test.js` / TC-AUD-01 |
| **RF-09** | Input Desktop & Virtual Touch Controls | **P1** | Manual (Dispositivo) | TC-INP-01, TC-INP-02 |
| **RF-10** | PWA, Service Worker & Offline Cache | **P1** | Manual (Lighthouse/DevTools) | TC-PWA-01 |
| **RF-11** | GameManager, Match Lifecycle & Loot Drops | **P1** | Automatizado | `headless_sim.js` / TC-GGM-01 |

---

## 4. Estrutura das Suítes de Teste Automatizadas (Headless CI/CD)

As suítes abaixo executam via `npm test` sem dependência de GPU/DOM real, utilizando mocks matemáticos e simulação desacoplada:

```
npm test
  ├── test/headless_sim.js                 [Valida ciclo do GameManager, loop e bots]
  ├── test/ballistics_test.js              [Valida matemática pura de spread, recoil e sway]
  ├── test/projectile_test.js              [Valida sweep CCD e hitboxes de cabeça/tronco]
  ├── test/penetration_ricochet_test.js    [Valida wallbang, ricochete e supressão acústica]
  ├── test/italy_map_test.js               [Valida integridade do JSON de mapa e colisões]
  ├── test/phase14_accessibility_test.js   [Valida headbob data-driven, shake e wall press]
  ├── test/loading_system_test.js          [Valida resiliência de loading e lazy-materials]
  ├── test/audio_spatial_occlusion_test.js [Valida raycast de oclusão e smoke grenade]
  ├── test/tracer_flash_profile_test.js    [Valida integridade data-driven de traçantes]
  ├── test/third_person_test.js            [Valida interpolação de rig e spring-arm anti-clip]
  ├── test/woods_texture_test.js           [Valida gerador procedural PBR de materiais]
  └── test/crosshair_manager.test.js       [Valida 3 eixos de mira, dot e follow recoil]
```

---

## 5. Especificação Detalhada dos Casos de Teste (Test Cases)

### 5.1 Subsistema: Motor & Ciclo de Vida (Core Engine)

#### TC-ENG-01: Estabilidade do Acumulador de Fixed Timestep
- **Prioridade:** P0 (Bloqueador)
- **Pré-condição:** Jogo executando com render a 60Hz e taxa de física a 120Hz (`fixedDt = 1/120`).
- **Passo a Passo:**
  1. Forçar queda brusca de performance injetando uma carga artificial de 200ms na thread de UI via DevTools CPU Throttling (6x slowdown).
  2. Monitorar a execução do método `Engine.frame(nowMs)`.
- **Resultado Esperado:** O limitador `maxFrame` (spiral-of-death guard) deve limitar os sub-steps a no máximo 5 iterações por frame, impedindo o travamento completo da aba do navegador.
- **Evidência de Sucesso:** Ausência de "Page Unresponsive" e retomada fluida do loop assim que a carga cessa.

#### TC-ENG-02: Interpolação de Posição Visual (Alpha Blending)
- **Prioridade:** P1 (Crítico)
- **Pré-condição:** Jogador e bots movimentando-se em linha reta a 5.0 m/s em display de 144Hz.
- **Passo a Passo:**
  1. Capturar o vetor `renderPos` de cada entidade durante o callback `renderUpdate(alpha, dt)`.
  2. Verificar a aplicação da fórmula: $\text{renderPos} = \text{prevPos} \cdot (1 - \alpha) + \text{pos} \cdot \alpha$.
- **Resultado Esperado:** O movimento não deve apresentar stuttering, micro-teleportes ou jitter visual perceptível.

---

### 5.2 Subsistema: Física & Colisão (CollisionWorld)

#### TC-PHY-01: Prevenção de Tunelamento (Continuous Collision Detection)
- **Prioridade:** P0 (Bloqueador)
- **Pré-condição:** Jogador disparando a arma `vss` ou `rifle_proto` com velocidades entre 290 m/s e 900 m/s contra parede delgada de concreto de 0.10m.
- **Passo a Passo:**
  1. Posicionar a origem do projétil a 2.0m da parede.
  2. Integrar o passo do projétil no `ProjectileManager`.
  3. Auditar a linha de segmento `prevPos → nextPos` versus a caixa AABB no `CollisionWorld`.
- **Resultado Esperado:** O raycast swept-volume deve interceptar o ponto exato da face da parede sem permitir que o projétil atravesse sem checagem de penetração.

#### TC-PHY-02: Mecânica de Step-Up e Transposição de Degraus
- **Prioridade:** P1 (Crítico)
- **Pré-condição:** Jogador caminhando em direção a um bloco com altura $\le 0.55\text{m}$ (banco ou guia de calçada).
- **Passo a Passo:**
  1. Pressionar `W` (avançar) contra o degrau sem saltar (`Space`).
  2. Executar `world.moveAndSlide`.
- **Resultado Esperado:** O método `_tryStepUp` deve elevar suavemente a caixa de colisão da entidade sobre o degrau e mantê-la no solo (`onGround = true`), sem interrupção de velocidade horizontal. Obstáculos $> 0.55\text{m}$ devem bloquear o movimento.

---

### 5.3 Subsistema: Armas, Balística & Óptica (Weapons & Ballistics)

#### TC-WEP-01: Blindagem de Traçantes & Desacoplamento de Flicks (Diretiva GEMINI.md)
- **Prioridade:** P0 (Bloqueador)
- **Pré-condição:** Jogador equipado com a metralhadora `m249` disparando continuamente.
- **Passo a Passo:**
  1. Iniciar disparo contínuo (spray).
  2. Executar giros rápidos de mouse (flicks de 180° a 5000°/s) e strafes laterais vigorosos (A/D alternados).
  3. Inspecionar visualmente os feixes renderizados pelo `Effects.js` (pool de `FlashTracer`).
- **Resultado Esperado:**
  - O traçante balístico deve nascer exatamente na ponta do quebra-chamas (`muzzleLocal`) no frame 0.
  - O traçante deve manter trajetória **100% reta e colinear no espaço de mundo**.
  - **FALHA IMEDIATA:** Traçantes curvando-se em 90 graus como banana ("tiro chicote"), descolando-se no ar ou acompanhando a câmera após o disparo.

#### TC-WEP-02: Wallbang e Resistência Específica de Materiais
- **Prioridade:** P1 (Crítico)
- **Pré-condição:** Bot posicionado atrás de anteparos de diferentes materiais:
  - Material 1: Madeira (resistência 0.35, espessura 0.15m)
  - Material 2: Concreto armado (resistência 1.10, espessura 1.50m)
- **Passo a Passo:**
  1. Disparar com projétil 5.56mm NATO (`penetrationPower = 0.55`).
  2. Verificar emissão do evento `shot:penetration` e registro de dano no bot.
- **Resultado Esperado:**
  - O tiro atravessa a madeira sofrendo desaceleração de 25%–40% e atinge o bot com dano atenuado.
  - O tiro é totalmente bloqueado e absorvido pelo concreto de 1.50m, gerando fagulhas na face de entrada e zero dano no bot.

#### TC-WEP-03: Ricochete Angular em Ângulos Rasantes
- **Prioridade:** P1 (Crítico)
- **Pré-condição:** Parede de metal/pedra com normal perpendicular.
- **Passo a Passo:**
  1. Disparar contra a parede com ângulo de incidência rasante ($< 25^\circ$, $\text{dot} < 0.42$).
  2. Monitorar reflexão vetorial do projétil e emissão do evento `shot:ricochet`.
- **Resultado Esperado:** O projétil deve refletir no ângulo especificado com perda de 40% da energia cinética, emitir som de ricochete espacializado e continuar sua trajetória física.

#### TC-WEP-04: Obstrução do Cano contra a Parede (Wall Press / No-Fire)
- **Prioridade:** P1 (Crítico)
- **Pré-condição:** Jogador colado frontalmente a uma parede sólida (`wallCompression > 0.45`).
- **Passo a Passo:**
  1. Tentar mirar em ADS (botão direito) e disparar (botão esquerdo).
- **Resultado Esperado:**
  - A arma deve erguer-se visualmente a $+75^\circ$ apontando para cima.
  - O retículo deve exibir aviso `#crosshair-no-fire` e classe `.ch-blocked`.
  - Disparos devem ser bloqueados, emitindo som de gatilho seco (`weapon:empty`) e notificação HUD `"CANO OBSTRUÍDO PELA PAREDE"`.

#### TC-WEP-05: Óptica Telescópica PIP (Picture-In-Picture) na VSS Vintorez
- **Prioridade:** P2 (Alto)
- **Pré-condição:** Jogador equipado com `vss` acionando ADS.
- **Passo a Passo:**
  1. Mirar com o fuzil VSS Vintorez.
  2. Observar a ativação da `scopeCamera` e renderização no `WebGLRenderTarget` de 512x512.
- **Resultado Esperado:**
  - A lente deve exibir a retícula soviética PSO-1 com chevrons funcionais.
  - O shader deve aplicar aberração cromática nas bordas radiais e leve distorção barril.
  - A sensibilidade do mouse deve ser reescalonada proporcionalmente pelo fator trigonométrico de FOV.

#### TC-WEP-06: Máquina de Estados da Espingarda Winchester M12
- **Prioridade:** P1 (Crítico)
- **Pré-condição:** Jogador equipado com a `m12` (Winchester 1912).
- **Passo a Passo:**
  1. Disparar uma vez.
  2. Acompanhar a sequência de animação e eventos da classe `M12Physics`.
- **Resultado Esperado:** A espingarda deve transitar estritamente pela sequência: `RECOIL` → `PUMP_BACK` (100ms) → `PUMP_PAUSE` (ejeção física do cartucho vermelho 12ga via `weapon:manual_eject_fx`) → `PUMP_FWD` (150ms, som de travamento) → `IDLE`.

---

### 5.4 Subsistema: Inteligência Artificial & Entidades (AI & Entities)

#### TC-AI-01: Transição de Estados da FSM do Bot
- **Prioridade:** P1 (Crítico)
- **Passo a Passo:**
  1. Iniciar round com bot em estado `PatrolState`.
  2. Fazer o jogador cruzar a linha de visão do bot a 12 metros de distância.
  3. Jogador esconder-se atrás de uma parede sólida.
  4. Aguardar 3.5 segundos sem reaparecer.
- **Resultado Esperado:**
  - Passo 2: O bot transiciona para `EngageState`, executando strafe tático e disparos em rajada.
  - Passo 3: O bot perde a visão, mantém memória por 1.6s e entra em `SearchState`, deslocando-se até `lastKnownPlayerPos`.
  - Passo 4: Expirado o temporizador de busca, o bot retorna pacificamente para `PatrolState`.

#### TC-AI-02: Impacto da Supressão Balística nos Bots
- **Prioridade:** P2 (Alto)
- **Passo a Passo:**
  1. Disparar sucessivos tiros raspando a cabeça do bot (distância entre 0.6m e 1.5m) sem acertá-lo diretamente.
  2. Auditar a variável `suppressionLevel` do `AIController`.
- **Resultado Esperado:** A precisão do bot deve degradar em até 55%. Ao acumular supressão $> 0.65$, o bot deve ter 40% de chance de abortar o combate e acionar `FleeState`.

#### TC-AI-03: Throttling de Visão e Performance de CPU
- **Prioridade:** P1 (Crítico)
- **Passo a Passo:**
  1. Configurar partida com 12 bots simultâneos no mapa `cs_italy`.
  2. Monitorar chamadas ao método `world.raycast` originadas pelo `AIController`.
- **Resultado Esperado:** As checagens de linha de visão (LOS) devem ocorrer a uma cadência controlada de ~10 Hz (intervalos de ~100ms com jitter), e não a cada tick de 120Hz ou frame de rAF, preservando a CPU.

---

### 5.5 Subsistema: Interface, HUD & Acessibilidade (UI / HUD)

#### TC-HUD-01: Indicador 2D Radial de Dano e Supressão
- **Prioridade:** P1 (Crítico)
- **Passo a Passo:**
  1. Posicionar o jogador voltado para o Norte ($Yaw = 0^\circ$).
  2. Receber disparo vindo do Leste ($Yaw = 90^\circ$).
  3. Receber rajada contínua de 5 disparos no mesmo quadrante.
- **Resultado Esperado:**
  - O canvas `#damage-indicator` deve desenhar um arco vermelho a 90° à direita do centro.
  - Disparos recebidos com diferença angular inferior a 23° (dot $> 0.92$) devem ser deduplicados, estendendo o tempo de fade-out do arco existente em vez de desenhar arcos sobrepostos.

#### TC-HUD-02: Os 3 Eixos do Crosshair CS2 (Follow Recoil & Barrel Projection)
- **Prioridade:** P1 (Crítico)
- **Passo a Passo:**
  1. Configurar mira com modo Dinâmico, Alinhamento de Cano ATIVADO e Follow Recoil ATIVADO.
  2. Movimentar-se, agachar e efetuar spray contínuo de 20 tiros com a AK-47.
- **Resultado Esperado:**
  - **Eixo 1 (Dispersão):** O gap da mira deve expandir conforme o cálculo de spread.
  - **Eixo 2 (Cano):** A mira deve deslocar-se na tela acompanhando a projeção 2D do cano físico 3D durante o sway/bobbing.
  - **Eixo 3 (Follow Recoil):** O retículo deve subir e compensar visualmente o pitch/yaw acumulado do spray.

#### TC-HUD-03: Moduladores de Acessibilidade (Headbob & Screen Shake ±20%)
- **Prioridade:** P2 (Alto)
- **Passo a Passo:**
  1. No menu de configurações, ajustar slider de Headbob para 0%, depois 80%, 100% e 120%.
  2. Ajustar slider de Screen Shake para 0% e 100%.
  3. Movimentar-se e disparar armas pesadas (SW500).
- **Resultado Esperado:** Em 0%, a oscilação da câmera deve ser nula ($len = 0$). Os valores intermediários devem obedecer linearmente às proporções matemáticas calibradas sem causar enjoo de movimento (cinetose).

---

### 5.6 Subsistema: Áudio Espacial & Oclusão (Audio System)

#### TC-AUD-01: Oclusão Acústica por Parede (Lowpass Filter Raycast)
- **Prioridade:** P2 (Alto)
- **Passo a Passo:**
  1. Iniciar disparo ou detonação de granada de fumaça em uma sala adjacente com parede sólida interposta.
  2. Monitorar os nós de áudio Web Audio do `AudioSystem`.
- **Resultado Esperado:**
  - O raycast de oclusão deve detectar a obstrução sólida.
  - O som deve ser roteado pelo filtro biquad lowpass, cortando as frequências agudas de ~13kHz para $\le 550\text{Hz}$ e atenuando o ganho em 60%–65%.
  - Ao contornar a parede e obter linha de visão desobstruída, o filtro deve reabrir instantaneamente para o espectro completo.

---

### 5.7 Subsistema: Controles Mobile, PWA & Resiliência (Mobile / PWA)

#### TC-MOB-01: Controles Virtuais Multi-Touch & Auto-Sprint
- **Prioridade:** P1 (Crítico)
- **Passo a Passo:**
  1. Acessar o jogo via dispositivo touchscreen (Chrome Android ou Safari iOS em modo paisagem).
  2. Arrastar o joystick virtual esquerdo além de 75% do raio máximo ($45\text{px}$).
  3. Simultaneamente, arrastar o touchpad direito para mirar e pressionar o botão de disparo.
- **Resultado Esperado:**
  - O personagem deve transicionar automaticamente para `sprint` ao ultrapassar 75% de curso do joystick.
  - Ações de olhar e atirar devem funcionar simultaneamente sem conflito de identificadores de toque (`Touch.identifier`).

#### TC-PWA-01: Execução Offline e Cache de Recursos
- **Prioridade:** P1 (Crítico)
- **Passo a Passo:**
  1. Carregar o jogo uma vez com conexão ativa.
  2. Desativar a conexão (modo avião / Offline no DevTools).
  3. Recarregar a página (`F5`).
- **Resultado Esperado:**
  - O Service Worker (`sw.js`) deve interceptar as requisições e responder via Cache Storage namespace `arena-blockout-v1`.
  - O jogo deve inicializar completamente, carregar o mapa `italy.json`, gerar texturas procedurais e iniciar a partida sem conexão de rede.

---

## 6. Procedimentos de Teste de Performance e profiling (Benchmarks)

| Métrica de Performance | Ferramenta de Medição | Meta Aceitável (Desktop) | Meta Aceitável (Mobile) | Limite Crítico (Bug P1) |
|---|---|---|---|---|
| **Framerate Médio** | Chrome DevTools FPS Meter | $\ge 60$ FPS constante | $\ge 45$ FPS constante | $< 30$ FPS |
| **Draw Calls por Frame** | Three.js `renderer.info.render.calls` | $\le 45$ calls | $\le 35$ calls | $> 70$ calls |
| **Tempo de Tick Físico** | `console.time('fixedUpdate')` | $\le 2.5\text{ms}$ | $\le 4.5\text{ms}$ | $> 8.3\text{ms}$ (estoura 120Hz) |
| **Alocação de Memória / Frame** | Performance Profiler (Memory heap) | Zero allocations em loop | Zero allocations em loop | Crescimento contínuo (Memory Leak) |
| **Tempo de Boot & Loading** | `performance.now()` total | $\le 1200\text{ms}$ | $\le 2500\text{ms}$ | $> 4000\text{ms}$ |

---

## 7. Checklist de Regressão Obrigatório Pré-Release (Go / No-Go)

Antes de aprovar qualquer build para produção, a equipe de QA deve validar obrigatoriamente:

- [ ] `npm test` executado e reportando **100% de aprovação (13 suítes verdes)**.
- [ ] **Diretiva de Traçantes (Locked):** Nenhuma alteração foi realizada em `src/fx/Effects.js`, `assets/weapons/ammo.json` ou muzzles de `src/weapons/models/*.js`.
- [ ] Disparo com flick violento de mouse testado com M249 e HK416 (sem traçante curvo).
- [ ] Wallbangs testados em madeira e concreto na Itália.
- [ ] Partida completa de 3 minutos jogada do início ao fim com vitória/derrota e scoreboard correto.
- [ ] Teste em modo Offline (Service Worker ativado).
- [ ] Teste de toque mobile executado em aparelho real ou emulador com touch múltiplo.
- [ ] Console do navegador com **zero erros ou warnings não capturados** durante toda a sessão.

---

## 8. Roteiro de Reporte de Bugs (Template para QA)

Ao encontrar um defeito, a equipe de QA deve preencher o card com a seguinte estrutura:

```markdown
### [TAG-SUBSISTEMA] Título Sucinto do Problema
* **Criticidade:** [P0 / P1 / P2 / P3 / P4]
* **Ambiente de Teste:** Chrome 128 / Windows 11 / 1920x1080 @ 144Hz (ou Mobile iPhone 15 Safari)
* **Requisito Impactado:** RF-XX (ex: RF-04 Balística)

#### Passos para Reproduzir:
1. Equipar a arma X.
2. Posicionar-se nas coordenadas [X, Y, Z] do mapa italy.
3. Executar a ação Y.

#### Comportamento Observado:
Descrever o que aconteceu (ex: Projétil atravessou parede de concreto de 1.5m sem perda de velocidade).

#### Comportamento Esperado:
Descrever o que a especificação dita (ex: O concreto de 1.5m deve absorver o projétil completamente conforme RF-04).

#### Anexos / Logs:
Print do console, gravação em vídeo ou saída do teste automatizado correspondente.
```
