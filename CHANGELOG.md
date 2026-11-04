# 📜 Log de Versões e Histórico de Desenvolvimento (CHANGELOG)
**Projeto:** Arena Blockout (FPS Browser 3D Three.js)  
**Repositório:** [teusbraga/arenablockoutlimited](https://github.com/teusbraga/arenablockoutlimited)  
**Data da última atualização:** 04 de Novembro de 2026  

---

## 📌 Estado Atual das Branches & Tags

| Identificador | Tipo | Commit | Descrição / Propósito |
| :--- | :--- | :--- | :--- |
| **`main`** *(HEAD atual)* | Branch Principal | [`ef5e473`](https://github.com/teusbraga/arenablockoutlimited/commit/ef5e473) | **Milestone 1 — Normalização Canônica e Quitação de Dívida Técnica.** 82/82 testes aprovados. Desoneração do spatial hash (251k células a menos), unificação Three.js 0.186.1, SchemaValidator no boot, WeaponRegistry, isolamento de sombras em lunetas e estabilização de combate. |
| **`backup/headbob-odometria`** | Branch de Backup | [`5e5dcea`](https://github.com/teusbraga/arenablockoutlimited/commit/5e5dcea) | **Versão experimental preservada.** Contém odometria real de passos no solo, curvas convexa parabólica (andar) e lemniscata (correr), sincronização sonora 1:1 de passos e configuração `LOCOMOTION`. |
| **`backup-headbob-odometria`** | Tag Fixa | [`5e5dcea`](https://github.com/teusbraga/arenablockoutlimited/commit/5e5dcea) | Tag imutável apontando para o commit da versão experimental de odometria e passos. |

---

## 🚀 Histórico Cronológico de Versões e Commits

### 🔹 Novembro de 2026

#### [refactor(ui): Remoção de Efeitos Interativos em Botões Placeholders do Menu] — 04/11/2026

* **refactor(ui): `assets/css/main.css`, `index.html` & `src/ui/MenuController.js`** — Desativação de efeitos de hover, active e clique nos cards não atrelados do lobby (Inventário, Loja e Passe):
  * `assets/css/main.css`: Removidos os seletores de `:hover` (elevação `translateY(-3px)`, realce de borda e sombra) e `:active` (`scale(0.96)`) de `.lobby-action-card`. Aplicados `pointer-events: none;`, `cursor: default;` e `user-select: none;` para manter apenas o formato visual estático (mockup) das peças no HUD inferior esquerdo.
  * `index.html`: Removidos os atributos `title` dos botões `#btn-inventory`, `#btn-shop` e `#btn-pass`, evitando tooltips de hover nativos do navegador. Adicionados `tabindex="-1"` e `aria-disabled="true"` para garantir que não capturem foco de teclado.
  * `src/ui/MenuController.js`: Removidos os event listeners de clique associados aos 3 botões que disparavam popup de "RECURSO EM BREVE", mantendo-os puramente visuais como formas estáticas no layout.

#### [fix(render,mobile): Correção de Malhas Piscando (Frustum Culling), Otimização de GPU Vega/Mobile e Calibração de Tier] — 01/11/2026

* **fix(render/culling): `src/view/models/TacticalManContinuous.js` & `src/fx/DecalSystem.js`** — Resolução de malhas piscando (flickering de visibilidade no PWA):
  * `TacticalManContinuous.js`: Revertido o congelamento de matrizes locais (`matrixAutoUpdate = false`) nas subpeças anatômicas do soldado. Por se tratar de uma hierarquia esquelética contínua articulada por juntas dinâmicas, o congelamento local impedia a propagação correta das matrizes e esferas delimitadoras de mundo, fazendo o motor de Frustum Culling do Three.js ocultar/flickerar partes da malha aleatoriamente durante rotações de câmera.
  * `DecalSystem.js`: Adicionada chamada síncrona obrigatória a `mesh.updateMatrix()` logo após `mesh.scale.set(...)` em `spawnDecal()`, e configurado `frustumCulled = false` no pool circular de decalques. Como os decalques utilizam `matrixAutoUpdate = false`, a ausência de `updateMatrix()` mantinha a matriz local na origem (0,0,0) ou na posição do disparo anterior, provocando piscamento visual conforme o jogador movia a visada.
  * `ItalyProps.js`: Adicionada chamada a `g.updateMatrixWorld(true)` após congelar as matrizes em `freezeStaticProps()`, assegurando que todas as matrizes no espaço de mundo de adereços estáticos sejam pré-calculadas integralmente no boot.

* **perf(mobile/tier): `src/ui/MenuController.js` & `src/view/CharacterView.js`** — Correção de inicialização do preset gráfico e LOD de soldados em dispositivos móveis:
  * `MenuController.js`: Corrigida a lógica de boot (`savedPreset || detectedTier || 'medium'`). Anteriormente, aparelhos classificados como `low` eram forçados a iniciar no preset `medium` por falta de mapeamento explícito na expressão ternária.
  * `CharacterView.js`: Em dispositivos móveis táteis com preset `low` ou `potato`, o gerador de soldados agora seleciona automaticamente o modelo leve `_buildBlockySoldier()` (6 malhas por bot em vez de 157). Isso elimina de imediato mais de 600 draw calls em partidas com bots em celulares.
  * `ItalyProps.js`: Em presets `low` e `potato`, a geração de palmeiras (`addPalmTree`) omite cachos decorativos de tâmaras (15 malhas) e reduz a coroa foliar para 6 folhas simples, cortando 32 draw calls por palmeira.

* **perf(gpu/shadows): `src/core/SceneSetup.js`** — Otimização da resolução de Shadow Map (Alívio de GPU integrada Vega e mobile):
  * Calibrada a resolução padrão do mapa de sombras direcional do sol de 2048 para **1024** no desktop e **512** em dispositivos táteis/mobile.
  * A redução de $2048 \times 2048$ para $1024 \times 1024$ reduz em 75% o número de texels de profundidade calculados no passe do `PCFShadowMap`, eliminando o estrangulamento de largura de banda de memória em GPUs integradas (como a Radeon Vega 7 do Ryzen 5 5600G) e atacando diretamente o *Presentation delay*.

* **fix(engine/loop): `src/core/Engine.js`** — Correção de limitação de FPS (Eliminação da queda para 15 FPS e stutter no iOS):
  * Substituído o flip-flop ingênuo `renderTick % 2 === 0` por controle temporal analítico com delta mínimo (`now - lastRender >= 0.0312`).
  * Em telas onde o rAF já roda a 30 Hz (como Safari no iOS com Low Power Mode ou throttling térmico), a limitação antiga dividia 30 por 2 resultando em 15 FPS com 4 passos acumulados de física por frame. A nova verificação garante que a taxa nunca caia para 15 FPS e impede acúmulos excessivos no loop de física (`onFixed`).

#### [perf(core,render,physics): Otimização Extrema de CPU, Limpeza de Stutter e Zero-DOM-Trash] — 01/11/2026

* **perf(ui/dom): `src/ui/HUD.js` & `assets/css/main.css`** — Pool fixo de hitmarkers descentralizados (Zero-DOM-Trash & Zero-Forced-Reflow):
  * Substituída a criação pontual de elementos via `document.createElement('div')` e `.remove()` em `_hit` (disparo de espingarda/pellets) por um pool circular pré-alocado de 32 elementos em container dedicado `#shotgun-hit-pool`.
  * As coordenadas dos pellets agora usam interpolação puramente via `transform: translate3d(...)` acelerada pela GPU, eliminando o recalculo síncrono de geometria na CPU.
  * Extingue o aviso de **`Forced reflow`** do DevTools, achata a contagem de nós do DOM (congelada em ~2.600 nós sem efeito escada) e reduz o tempo de processamento de input (*Processing duration*) de 476 ms para < 5 ms.

* **perf(render/materials): `src/world/ItalyProps.js`** — Cache estático compartilhado de materiais de adereços:
  * Criado repositório cacheado `SHARED_PROPS_MATS` e utilitário `getSharedPropMat(key, factoryFn)`.
  * Substituídas as 14 instanciações repetidas de `new THREE.MeshStandardMaterial` / `MeshBasicMaterial` (lanterna, água da fonte, feno, tâmaras de palmeira, gongo plinker, metal de antena, fiação elétrica, isoladores, postes e caixas d'água) por instâncias compartilhadas.
  * O Three.js passa a consolidar uniformes e reaproveitar os programas WebGL compilados, reduzindo drasticamente o consumo de CPU em `setProgram` (que antes correspondia a 29,5% do tempo total).

* **perf(render/shadows): `src/world/ItalyProps.js`** — Poda seletiva de sombras solares (`castShadow = false`) em micro-props:
  * Desativado `castShadow` em dezenas de geometrias secundárias ou planas coladas a superfícies já sombreadas: peitoris e lintéis de janelas, ombreiras de portas, mísulas de sacada, braço de lanterna, varetas de antenas parabólicas/espinha-de-peixe, cruzetas e transformadores de postes, degraus de escada, placas de sinalização e tampas de caixa d'água.
  * Mantido `castShadow = true` apenas nos volumes principais e silhuetas fundamentais dos modelos (troncos, colunas de concreto, gongo do alvo, cilindros principais).
  * Redução substancial de draw calls no passe de profundidade do Shadow Map solar (`renderBufferDirect`), atacando o *Presentation delay* (que causava até 1.380 ms de engarrafamento no compositor sob baixa performance).

* **perf(ui): `src/ui/CrosshairManager.js` & `assets/css/main.css`** — Zero-DOM-Thrashing e dirty checking estrito a 60 FPS:
  * Implementado cache de dirty checking para `--gap`, `opacity`, `isBlocked`, `left`, `top` e `transform`, eliminando mutações contínuas e redundantes no DOM 60 vezes por segundo.
  * O custo de CPU da crosshair no profiler despencou de 225ms (4.1% da CPU global) para virtualmente 0ms (< 1ms).
  * Removida a transição conflitante `transition: opacity .12s ease;` de `#crosshair` em `assets/css/main.css`, eliminando o overhead de interpolações concorrentes a cada 16ms no motor de estilo do navegador.

* **perf(scene/matrix): `src/world/MapLoader.js`, `src/world/ItalyProps.js`, `src/fx/DecalSystem.js` & `src/view/models/TacticalManContinuous.js`** — Desativação de recomposição de matrizes (`matrixAutoUpdate = false`):
  * `MapLoader.js`: Piso, rampas (wedges), domos e malhas instanciadas (`InstancedMesh`) agora são congeladas com `matrixAutoUpdate = false` e pré-compostas uma única vez (`updateMatrix()`).
  * `ItalyProps.js`: Adicionado método `freezeStaticProps()` que percorre todos os adereços e decorações estáticas geradas no mapa e desliga `matrixAutoUpdate`, preservando o pivô dinâmico de plinkers pendulares.
  * `DecalSystem.js`: Os 128 decalques do pool de crateras e impactos nascem com `matrixAutoUpdate = false`, calculando sua matriz local apenas uma vez ao colidirem com uma superfície.
  * `TacticalManContinuous.js`: Todas as mais de 80 sub-peças rígidas (coletes, bolsos, rádio, capacete, óculos, sola de bota) têm `matrixAutoUpdate = false`, delegando a interpolação cinemática apenas às 16 juntas biomecânicas. Elimina centenas de chamadas desnecessárias a `matrix.compose()` por frame.

* **perf(physics): `src/physics/CollisionWorld.js`** — Zero-Alloc Spatial Hashing e Deduplicação por Stamp:
  * Substituído o hashing de strings ``${cx},${cz}`` por hashing numérico bitwise de inteiros de 32 bits `((cx + 32768) << 16) | ((cz + 32768) & 0xffff)`. Elimina até 1.800 alocações de strings por frame durante raycasts e varreduras físicas.
  * `getNearbyBoxes`: Implementada fast-path para queries de célula única e deduplicação de caixas via `_queryStamp`, eliminando instâncias de `new Set()` e chamadas a `Array.from()` no caminho quente. A taxa de simulação física headless saltou de 17.214 para 31.429 ticks/seg (+82.5% de throughput).

* **perf(events/canvas): `src/core/GameManager.js` & `src/ui/HUD.js`** — Eliminação de eventos por frame e canvas 2D ocioso:
  * `GameManager.js`: `interact:target` agora só é emitido quando o alvo de interação (`interactTarget`) realmente muda de estado, eliminando dezenas de eventos por frame no fixed update e prevenindo updates de DOM repetitivos na HUD.
  * `HUD.js`: O contexto 2D do indicador de dano (`damage-indicator`) agora só executa `clearRect` quando há marcas de dano ativas ou no frame de transição para o estado limpo (`_canvasDirty`), desonerando o rendering de canvas 2D a 60 FPS.

#### [feat(perf): Kit de Sobrevivência Mobile e Preset "Batata" para Celulares de Entrada] — 01/11/2026

* **feat(core): `src/core/DeviceTierDetector.js`** — Detecção heurística e transparente de hardware:
  * Analisa `navigator.deviceMemory`, `navigator.hardwareConcurrency` e suporte a toque para classificar dispositivos em 4 tiers (`potato`, `low`, `medium`, `high`).
  * Sugere automaticamente o preset gráfico mais adequado no primeiro acesso sem sobrecarregar celulares de entrada.

* **feat(render): `src/core/SceneSetup.js` & `src/core/ConfigLoader.js`** — Calibração cirúrgica do pipeline WebGL:
  * Suporte ao preset `potato` com `pixelRatio` rigorosamente travado em 1.0 (eliminando o estrangulamento de fill rate em telas Full HD+ móveis), desativação de sombras (`shadowMap.enabled = false`) e luzes secundárias.
  * Otimização de inicialização com `antialias: false` e `precision: 'mediump'` para dispositivos móveis e touch.
  * Suporte a limites estritos de DPR mantidos durante eventos de resize e rotação de tela.

* **feat(view/character): `src/view/CharacterView.js`** — LOD leve de soldado no modo Batata com hitboxes intactas:
  * Implementado `_buildBlockySoldier()`: soldado tático bloco simplificado com 6-7 meshes (cabeça, capacete, corpo, braços e pernas articuladas) ativado no preset `potato`.
  * Reduz mais de 55 draw calls por bot (economizando ~165 draw calls em partidas com 3 bots), mantendo as hitboxes de headshot e body shot (`part: 'head'` e `part: 'body'`) 100% idênticas ao modelo `TacticalManContinuous`.
  * Preservação total das armas em 1ª pessoa conforme diretiva de congelamento `GEMINI.md`.

* **feat(world/props): `src/world/ItalyProps.js`** — Otimização de adereços cosméticos secundários:
  * No preset `potato`, adereços puramente decorativos sem colisão (`ivy_patch`, `overhead_wires`, `favela_antenna`, `fern_cluster`) são omitidos ou simplificados.
  * Preserva 100% dos colisores físicos e elementos estruturais no `CollisionWorld` (ex: colisão do bosque de bambu).

* **feat(world/materials): `src/world/MaterialFactory.js`** — Modo de renderização rápido para mobile:
  * Adicionado suporte ao modo `'potato'` em `setRenderMode`: zera bump maps, roughness maps e reflexões metálicas, aliviando o custo de fragment shader e microfacetas GGX.

* **feat(core/engine): `src/core/Engine.js`** — Frame pacing e limitador de 30 FPS no render:
  * Suporte à flag `limitRenderFps30` em `CONFIG.GRAPHICS`: divide as chamadas de `renderUpdate` por 2 (30 FPS de renderização visual), mantendo a física de `fixedUpdate` rigorosamente fixa em 60 Hz (`fixedDt = 1/60`) para preservar gunplay, balística e IA.
  * Economiza até 50% de bateria e reduz o aquecimento térmico em celulares fracos.

* **feat(ui): `src/ui/MenuController.js` & `index.html`** — Controles no menu de configurações:
  * Adicionada a opção `🥔 Batata — Extrema Performance (Celulares Fracos)` no seletor de Qualidade Gráfica.
  * Adicionado seletor para `🔋 Limitar Render a 30 FPS` com feedback na HUD e persistência no `localStorage`.

* **test(perf): `test/mobile_potato_optimization_test.js` & `package.json`** — Suíte automatizada de testes:
  * 7 testes cobrindo classificação de hardware, parâmetros estritos de cena, integridade das hitboxes do soldado leve, culling de adereços de props, materiais e cadência de 60 Hz física / 30 FPS render.

#### [fix(maps/favela): Correção da orientação em 90° e física da escada da Casa 1] — 01/11/2026

* **fix(data): `assets/maps/favela.json`** — Ajuste de rotação, largura e coordenadas da escada (`favela_stairs`) da Casa 1:
  * A escada anteriormente posicionada em `pos: [-1.5, 0, 8.5]` com `rotY: 0` subia em direção ao sul e colidia sob a laje frontal de concreto (`c1_slab_east_front`, `Z = 12`), prendendo a cabeça do jogador nos degraus finais.
  * Corrigida a rotação de `+Math.PI / 2` (que a projetava para fora da casa na rua leste) para `-1.5707963267948966` (`-Math.PI / 2`), direcionando a subida para o interior oeste da residência (`-X`).
  * Posicionada em `pos: [-0.05, 0, 11.5]` com `width: 1.0`: os 11 degraus iniciam rente ao piso térreo leste e passam com folga e zero colisão pelo vão aberto da laje (entre `Z = 11.0` e `Z = 12.0`), desembarcando rente e nivelados a $X = -5.0$ sobre a laje oeste (`c1_slab_west`, base $3.80$, topo $4.15$).

* **fix(physics/world): `src/world/ItalyProps.js`** — Sincronização da fórmula trigonométrica de colisão das escadas:
  * Corrigida a projeção do eixo X em `addFavelaStairs`: `const wx = x + (sin * localZ)` (substituindo `-sin * localZ`), equalizando o cálculo do `CollisionWorld` com o Three.js world transform ao rotacionar props em Y.



#### [feat(ui/crosshair): Novos padrões iniciais da mira CS2 (T-Shape Dinâmica, Follow Recoil e Ponto Branco)] — 01/11/2026

* **feat(crosshair): `src/ui/CrosshairManager.js` & `src/ui/MenuController.js`** — Configuração padrão atualizada:
  * Definido `DEFAULT_CROSSHAIR_CONFIG` com os parâmetros competitivos de referência:
    * `style: 't_shape'` — Formato T (CS2 T-Shape, removendo a haste superior para máxima visibilidade de headshots);
    * `mode: 'dynamic'` — Comportamento de dispersão dinâmico com abertura responsiva das hastes em movimento e spray;
    * `dynamicAlignment: true` — Alinhamento dinâmico 3D da mira projetado a partir do cano real da arma na HUD;
    * `followRecoil: true` — Rastreamento dinâmico de recuo e subida de spray;
    * `centerDot: true` — Ponto central (Center Dot) ativado para focalização precisa;
    * `length: 5` — Comprimento das hastes calibrado em 5px;
    * `thickness: 1.5` — Espessura das hastes em 1.5px;
    * `gap: 4` — Espaçamento central calibrado em 4px;
    * `outline: 0` — Contorno escuro desativado (0px);
    * `color: '#ffffff'` — Cor branca de alto contraste (#ffffff);
    * `noFireWarning: false` — Aviso de cano obstruído desativado por padrão;
    * `aimAssist: true` — Assistência de mira mantida ativada.
  * Botão de restauração (`↺ RESTAURAR PADRÃO CS2`) e inicialização limpa (primeira execução / sem `localStorage`) sincronizados com os novos valores padrão.

* **feat(dom/css): `index.html` & `assets/css/main.css`** — Sincronização de marcação e estilos CSS:
  * Atualizados os valores e atributos `selected` dos selects (`#ch-style-select`, `#ch-mode-select`, `#ch-dynamic-align`, `#ch-follow-recoil`, `#ch-center-dot`), sliders (`#ch-length-slider`, `#ch-gap-slider`, `#ch-outline-slider`) e color picker (`#ch-color-picker`).
  * Inserida classe `ch-t-shape` e estilo de exibição do ponto central diretamente nos elementos `#crosshair` e `#crosshair-preview` para evitar qualquer piscar de transição visual durante o boot.
  * Atualizadas as variáveis CSS de fallback (`--ch-color: #ffffff; --ch-len: 5px; --ch-gap: 4px; --ch-shadow: none;`) em `main.css`.

* **test: `test/crosshair_manager.test.js`** — Atualização dos testes unitários de persistência e defaults:
  * Validação explícita de todos os novos valores padrão na instanciação inicial sem storage e verificação da integridade de alternância de configurações.

#### [feat(ui/accessibility): Slider de Tremor de Pulo (Jump Head Shake) no Menu de Configurações] — 01/11/2026

* **feat(ui): `index.html` & `src/ui/MenuController.js`** — Novo controle deslizante de acessibilidade no menu:
  * Inserido o controle `#jumpshake-slider` e indicador `#jumpshake-val` [0% a 100%, step 5%] posicionado estrategicamente junto ao Balanço de Cabeça (Headbob).
  * Persistência contínua no navegador via `localStorage` (`blocky_jumpshake`) e atualização em tempo real de `CONFIG.ACCESSIBILITY.jumpShakeScale`.

* **feat(camera): `src/core/CameraRig.js`** — Modulação paramétrica da cinemática de salto:
  * `triggerJumpTakeoff` e `triggerLandingDip` agora modulam proporcionalmente a flexão inicial, a mola de pouso, o pitch nod e a oscilação elástica por `jumpShakeScale`.
  * Em 0%, neutraliza 100% o tremor e a pancada de aterrissagem sem afetar o headbob de caminhada; em 100%, entrega o efeito biomecânico integral.

* **data(config): `assets/config/gameplay.json` & `src/core/ConfigLoader.js`**:
  * Chave `jumpShakeScale: 1.0` integrada aos defaults de acessibilidade.

* **test: `test/phase14_accessibility_test.js` & `test/jump_kinematics_test.js`**:
  * Cobertura automatizada para neutralização total em 0% e calibração contínua em 50% e 100%.

#### [feat/biomechanics: Tremor de aterrissagem com ação e reação elástica, pancada contundente e cache-bust] — 01/11/2026

* **feat(camera): `src/core/CameraRig.js`** — Implementação do tremor biomecânico elástico com ação e reação:
  1. **Compressão inicial de impacto (Ação):** Ao tocar o solo, o impacto e a inércia da cabeça comprimem as articulações para baixo com pico de até `-7.3 cm` vertical e `-3.7°` de pitch nod.
  2. **Rebote elástico (Reação):** A resposta elástica das articulações e tendões dispara imediatamente o rebote para cima ultrapassando a linha de base em até `+4.8 cm` e `+2.4°` de pitch.
  3. **Oscilação de tremor contundente:** Modelada como oscilação harmônica sobamortecida ($\omega = 16\text{ Hz}$, $\lambda = 11\text{ s}^{-1}$ e duração de 380 ms), gerando 12 alternâncias de fase perceptíveis de cima/baixo que reproduzem a reverberação esquelética.
  4. **Micro-shake concussivo:** Calibrado `shakePos` e `shakeRot` com multiplicador de 0.45 para conferir sensação tátil de pancada no momento do impacto.
  5. **Atenuação no ADS preservada:** No ADS, a perturbação é amortecida em 85-90% para manter a precisão de tiro competitiva protegida.

* **data(config): `assets/config/gameplay.json` & `src/core/ConfigLoader.js`** — Calibração data-driven:
  * `landingDipScale` calibrado para `0.0025`, `landingShakeScale` elevado para `0.45`.

* **fix(cache): `sw.js` & `index.html`** — Invalidação agressiva de cache no navegador:
  * Atualizado `CACHE_NAME` do Service Worker para `'arena-blockout-v4'`, garantindo purga de assets legados cacheados.
  * Adicionada query string versionada `?v=landing-tremor-v3` no script principal de `index.html`.

* **test: `test/jump_kinematics_test.js`** — Nova Suíte 8:
  * Validação analítica do ciclo de ação (compressão $< -5\text{ cm}$), reação (rebote $> +3\text{ cm}$), e contagem de alternâncias de fase cima/baixo.

### 🔹 Outubro de 2026

#### [feat/fix: Som de pancada duplo no impacto de pouso e física de salto com sprint] — 31/10/2026

* **feat(player): `src/entities/Player.js`** — Correção e calibração fina da física de sprint e detecção de pouso:
  1. **Preservação de velocidade no sprint jump:** O jogador que já está sprintando no chão e salta mantém a velocidade e o estado de sprint durante todo o voo (`wantsSprint = this.sprinting ? canSprintBase : (canSprintBase && this.onGround)`). A velocidade não é mais cortada no ar nem aciona freio de recuperação de postura.
  2. **Bloqueio de início de sprint no ar:** Se o jogador estiver no ar (sem estar sprintando previamente) e pressionar Shift, o sprint não é iniciado, eliminando a aceleração irreal no ar.
  3. **Sensibilidade de pouso calibrada (`velY < -1.5`):** Limiar ajustado de `-3.0` para `-1.5` m/s, garantindo que qualquer aterrissagem de salto (em piso plano, rampas, obstáculos ou caixas) acione confiavelmente o `triggerLandingDip` e o evento `player:landing`.

* **feat(audio): `src/audio/procedural/LocomotionAcoustics.js`** — Novo método `synthesizeLanding`:
  * Sintetiza uma pancada orgânica de duplo impacto simulando os 2 pés tocando o solo descompassados (~42 ms de diferença).
  * O pé secundário tem afinação e peso modulados para criar separação acústica realista.

* **feat(audio): `src/audio/AudioSystem.js`** — Roteamento potente de pouso para `impactsGain`:
  * `playLanding(material, velY)` agora encaminha para o barramento `this.impactsGain` (volume padrão 0.45), garantindo corpo, pegada e presença auditiva nítida em vez do volume abafado de 0.05 de passos contínuos.
  * Escala proporcional à velocidade vertical de queda (`clampedSpeed` de 1.5 a 12.0 m/s).

* **feat(audio): `src/audio/procedural/SoundPresets.js`** — Calibração do preset `landing_impact`:
  * Frequência de calcanhar em 85 Hz (grave e contundente), ressonância modal de piso em 150 Hz com Q=2.5, atrito de sola `scuffAmount: 0.65` e peso corporal `bodyWeight: 2.2`.

* **test: `test/jump_kinematics_test.js` & `test/procedural_audio_test.js`** — Suítes de validação automatizadas:
  * Suíte 7 em `jump_kinematics_test.js` cobrindo pouso com emissão de `player:landing`, manutenção de sprint no salto e bloqueio de sprint no ar.
  * Teste 7 em `procedural_audio_test.js` validando o disparo do método `synthesizeLanding` e roteamento para `impactsGain`.

#### [Otimização de Desempenho Mobile — Plano Mestre: Zero-Allocation, Draw Calls e Telemetria] — 31/10/2026

* **perf(scope): `src/weapons/ScopeSystem.js`** — Object Pooling completo no loop da luneta:
  * Declarados 8 vetores estáticos no escopo do módulo (`_vRear`, `_vFront`, `_dir`, `_vUp`, `_target`, `_vCam`, `_qShake`, `_euler`), eliminando ~1.800 alocações `new THREE.Vector3/Quaternion/Euler()` por segundo e os stutters de GC associados.
  * Threshold do segundo passe de câmera (`scopeOn`) alterado de `> 0.01` para `>= 0.55`, eliminando stutter/tranco visual ao iniciar a mira.
  * `scopeCamera.far` reduzido de 150 m para 115 m, alinhado ao fog da cena (sem impacto visual).

* **perf(projectiles): `src/weapons/ProjectileManager.js`** — Pool de resultados de impacto balístico:
  * Adicionados `_hitResult0`, `_hitResult1`, `_hitResult2` como vetores estáticos de módulo; eliminam `new THREE.Vector3()` criados a cada hit/miss em `_estimateImpact` e `_raycastMathBot`.

* **perf(viewmodel): `src/weapons/Viewmodel.js`** — Sombras da arma em 1ª pessoa desativadas:
  * Em `registerModel()`: `model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } })` — corta 120–184 draw calls/frame de todas as armas sem tocar em `src/weapons/models/*.js` (diretiva GEMINI.md preservada).

* **perf(props): `src/world/ItalyProps.js`** — Sombras desativadas em malhas decorativas de alta frequência:
  * `addPalmTree`: 22 folhas (`frond`) e cachos de tâmaras (`berry`) sem `castShadow`/`receiveShadow` — reduz ~44–50 draw calls por palmeira.
  * `addBalcony`: grades laterais finas (`railSideL`) sem `castShadow`.
  * `addWindow`: veneziana plana (`winMesh`) sem `castShadow`.
  * `addFavelaAntenna`: haste UHF (`boom`) sem `castShadow`.

* **feat(graphics): `src/core/SceneSetup.js`** — Perfis gráficos dinâmicos:
  * Método `applyQualityProfile(preset)` com 3 presets (`'low'`, `'medium'`, `'high'`) controlando sombras, luzes, pixelRatio (low ≤1.25, medium ≤1.5, high ≤2.0).
  * Listener `config:graphicsChanged` no EventBus aplica preset sem reload; unsubscribe em `destroy()`.

* **data(config): `assets/config/gameplay.json`** — Bloco `"graphics"` canônico adicionado:
  * Defaults: `preset:"auto"`, `shadows:true`, `shadowResolution:1024`, `maxPixelRatio:1.5`, `scopeResolution:512`, `perfMonitor:false`.

* **feat(config): `src/core/ConfigLoader.js`** — `GRAPHICS` adicionado ao `DEFAULT_CONFIG` e carregado do JSON via `deepMerge`.

* **feat(ui): `src/ui/DevPerfMonitor.js`** — NOVO módulo: Monitor de Telemetria Científica (F3):
  * FPS estável em janela deslizante 0.5 s; métrica `1% Low` (pior 1% dos frame times); JS Frame Time via `performance.now()`; semáforo de Draw Calls (🟢≤50 / 🟡51–90 / 🔴>90); triângulos, texturas e geometrias de `renderer.info`.
  * Ativado/desativado por `F3`; responde a `config:graphicsChanged { perfMonitor }`; `destroy()` com unsubscribe e remoção do DOM.

* **feat(main): `src/main.js`** — Integração do `DevPerfMonitor` no `renderUpdate`:
  * `perfMonitor.begin()` no início do frame; `perfMonitor.end(renderer)` após `renderer.render(scene, camera)`.

* **feat(ui): `index.html`** — Controles gráficos na aba Sistema:
  * `<select id="graphics-preset">` com opções Alta/Média/Mobile; `<select id="perf-monitor-toggle">` para ativar F3.

* **feat(menu): `src/ui/MenuController.js`** — Listeners para `#graphics-preset` e `#perf-monitor-toggle`:
  * Persistência em `localStorage`; emit de `config:graphicsChanged` no boot e a cada alteração.

* **Validação:** `npm test` → 137/137 ✅ | `node --test test/tracer_test.js test/italy_map_test.js test/touch_haptics_ios_test.js` → 8/8 ✅

---

#### [Cinemática Híbrida de Pulo: Takeoff Dip, Pitch Nod e Micro-Shake em Quedas Duras] — 31/10/2026
* **feat(kinematics):** Integração cinemática elegante e discreta entre o sistema de Camera Shake, molas harmônicas e o movimento de pulo do personagem:
  * **Análise Comparativa (Camera Shake vs Mola de Salto):**
    * Diagnosticado que o Camera Shake de recuo/supressão opera como ruído pseudo-harmônico senoidal de alta frequência (~6 a 10 Hz) e é deliberadamente neutralizado na câmera externa durante ADS (`shakeDamp = 0.0`) para preservar a precisão de mira.
    * A mola de pouso (`landingDip`, $k=280, d=26$) atuava exclusivamente no eixo linear $Y$ de translação, deixando a decolagem do pulo 100% rígida e o pouso desprovido de inércia angular cervical.
  * **Takeoff Dip e Pitch Nod na Decolagem (`src/core/CameraRig.js`, `src/entities/Player.js`):**
    * Implementado `triggerJumpTakeoff()` disparado organicamente ao executar o pulo no `Player.js`.
    * Injeta micro-compressão elástica vertical em $Y$ ($\approx -9\text{mm}$, regulada por `CONFIG.PLAYER.takeoffDipScale`) e um micro-pitch nod ($\approx -0.13^\circ$, regulado por mola angular harmônica $k=320, d=28$), conferindo sensação tátil de esforço biomecânico e explosão muscular sem travamento.
  * **Pancada Angular de Impacto, Tremor Biomecânico e Micro-Shake na Aterrissagem (`src/core/CameraRig.js`):**
    * **Tremor Biomecânico Elástico de Ação e Reação:** Implementada oscilação amortecida rápida de 12 Hz ($\omega = 75\text{ rad/s}, \lambda = 16$) simulando a compressão e devolução elástica das articulações e da coluna cervical:
      * No impacto do solo ($t < 25\text{ms}$), a câmera sofre compressão para baixo de $-4.7\text{ cm}$ e $-2.6^\circ$ de pitch.
      * A elasticidade musculoesquelética devolve a força com rebote imediato para cima em $50\text{ms}$ ($+1.5\text{ cm}$ e $+0.7^\circ$).
      * A câmera literalmente oscila/treme verticalmente (baixo $\rightarrow$ cima $\rightarrow$ baixo $\rightarrow$ repouso) ao longo de $180\text{ms}$, produzindo um tremor físico real e nítido.
    * **Correção de Silenciamento de Shake em Fuzis (`src/main.js`):**
      * Corrigida a condição de supressão de shake: antes verificava apenas `isScoped` (zerando `shakeIntensity = 0` permanentemente a cada frame se `rifle_proto`, `vss` ou `scar_h` estivessem em mãos), agora verifica estritamente `isScoped && scopeSystem.scopeOn`, garantindo que armas com luneta sofram shake normal em hipfire e pulos.
      * Micro-shake concussivo triplicado (`landingShakeScale = 0.36`), fornecendo um baque sólido de alta frequência perceptível ($\approx 0.34$ de intensidade) no pulo comum e até $0.60$ em quedas severas.
  * **Blindagem no ADS e Acessibilidade:**
    * No ADS (`isAds = true`), tanto o Pitch Nod quanto o Roll Nod são atenuados em 90% (`adsDamp = 0.10`), preservando a linha de visada em jump-peeks/jump-shots competitivos.
    * Respeita integralmente os multiplicadores de acessibilidade (`CONFIG.ACCESSIBILITY.headbobScale` e `CONFIG.ACCESSIBILITY.shakeScale`).
  * **Configuração Data-Driven (`assets/config/gameplay.json`, `src/core/ConfigLoader.js`):**
    * Adicionados os parâmetros `takeoffDipScale: 0.0018`, `landingPitchNodScale: 0.0075` e `landingShakeScale: 0.36`.
  * **Suíte de Testes Automatizada (`test/jump_kinematics_test.js`, `package.json`):**
    * Criadas 6 suítes de testes unitários e integrados cobrindo dados, estabilização de mola rápida, ativação de micro-shake no pulo comum e em queda severa, amortecimento de ADS, acessibilidade a 0% e integração física com o `Player`.
    * Integrado ao gate principal `npm test` (137/137 testes aprovados).


#### [Correção de Geometria de Rampa 3D (createWedgeGeometry) e Registro de Materiais PBR] — 31/10/2026
* **fix(render):** Resolução do `ReferenceError: createWedgeGeometry is not defined` no carregamento de mapas com rampas em runtime (`src/world/MapLoader.js`):
  * Implementação e exportação da função `createWedgeGeometry(sx, sy, sz, direction)` que gera a malha 3D (`BufferGeometry`) de prisma triangular retilíneo (cunha) para renderização de rampas com 24 vértices, 8 triângulos/5 faces (base, parede vertical posterior, plano inclinado e 2 paredes laterais triangulares).
  * Cálculo analítico e geração de normais por vértice e coordenadas UV em todas as 4 orientações cardinais (`'+z'`, `'-z'`, `'+x'`, `'-x'`), garantindo vetor normal perfeitamente colinear ao plano contínuo de colisão de `CollisionWorld.addRamp`.
* **feat(materials):** Registro e eliminação de fallbacks em `src/world/MaterialFactory.js` (resolvendo o aviso de fallback para `'wall'` e a pendência #10 do `AGENTS.md`):
  * Registro de `caution_yellow`: material amarelo de alta visibilidade e atenção industrial (`#d9a425`) com mapa de bump de concreto (`textures.createConcrete`), roughness 0.60 e mapeamento de coordenadas de mundo (`applyWorldSpaceUV`).
  * Registro de `steel_girder`: aço estrutural / viga metálica industrial com cor de óxido avermelhado (`0xc44527`), metalness 0.65 e roughness 0.55.
* **test(slope):** Expansão de `test/slope_physics_test.js` (Seção 8) cobrindo a instanciação geométrica 3D de `createWedgeGeometry`, validação de propriedades e cores dos novos materiais em `MaterialFactory` e teste integrado de carregamento de cena `THREE.Scene` instanciando com sucesso as 6 rampas e os 2 domos do mapa `grid.json`.

#### [Correção de Alinhamento Dinâmico a Queima-Roupa e Sincronização 1:1 de Projéteis] — 31/10/2026
* **fix(crosshair):** Resolução definitiva do descolamento da crosshair dinâmica em distâncias ultra-curtas e sincronização exata com o ponto de impacto balístico:
  * **Eliminação do Limiar Arbitrário de 0.30m (`src/new_mechanics/BarrelCrosshairAlignment.js`):**
    * Remoção dos filtros rígidos `(pureHit.distance || pureHit.dist) > 0.3` e `(hit.distance || hit.dist) > 0.3` que descartavam qualquer colisão a menos de 30 cm do bocal e atiravam a crosshair para o ponto virtual de 50 metros.
    * Implementação do método `_raycastWorld(origin, dir, maxDist)` com tolerância contínua $\ge 0.001\text{m}$, garantindo rastreamento fidedigno da superfície mesmo com o jogador colado no obstáculo.
  * **Proteção contra Penetração de Bocal em Sólidos (Backup Raycast):**
    * Quando a ponta do cano ultrapassa a face externa de uma AABB ou rampa no `CollisionWorld` (`tmin <= 0`), o método `_raycastWorld` recua a origem de teste em $0.65\text{m}$ (espaço seguro do viewmodel/câmera do jogador) ao longo da linha do cano, detectando com precisão milimétrica a face de entrada do obstáculo.
  * **Projeção Angular Perspectiva Bounded (`_projectToScreen` em `BarrelCrosshairAlignment.js`):**
    * Conversão da projeção de tela para cálculo trigonométrico angular colinear direto baseado no vetor de visada da câmera ($	an(	ext{fov}/2)$ e aspect ratio) com proteção de profundidade para pontos situados atrás da câmera ($	ext{depth} le 0.01	ext{m} ightarrow 50%, 50%$).
    * Bounding seguro com margem de segurança de $24	ext{px}$ nos limites da viewport ($[-1.0 + 	ext{pad}, 1.0 - 	ext{pad}]$), garantindo que a crosshair nunca sofra fuga de coordenadas para fora da tela (runaway para milhares de pixels).
  * **Anti-Inversão Balística de Bocal Penetrado (`getFiringDirection` e `WeaponSystem._fire`):**
    * No método `getFiringDirection(muzzleOrigin, outDir)`, caso a boca do cano penetre a superfície do obstáculo (`aimPointWorld - muzzleOrigin` com produto escalar $le 0$ em relação ao cano), o vetor de tiro não inverte 180° para trás ($+Z$), mantendo-se estritamente colinear e alinhado ao vetor diretor frontal físico do cano (`barrelAimDir`).
    * Alinhamento irrestrito no disparo: `barrelAlignment.getFiringDirection(_muzzleWorld, _dir)` é chamado consistentemente sob `isDynamicAlignment`, eliminando divergências entre o ponto de visada 3D e a trajetória do projétil em qualquer distância (queima-roupa ou espaço aberto).
    * Ponto de spawn protegido a queima-roupa: quando `distanceToTarget <= 0.02	ext{m}`, o projétil nasce $2	ext{cm}$ à frente da face colidida (`originPoint = _pointBlankSpawn`), garantindo detecção imediata no frame 1 pelo `ProjectileManager` com decalques e faíscas.
  * **Suíte de Testes Automatizada Dedicada (`test/point_blank_crosshair_alignment_test.js`, `package.json`):**
    * Adicionados 4 testes automatizados cobrindo AR-15 e P-9 a distâncias de $0.05	ext{m}$ a $2.0	ext{m}$, o pilar do mapa `grid.json`, match espacial 3D $leftrightarrow$ 2D com erro $< 2	ext{px}$ (match $> 99.8%$), e proteção contra inversão balística com bocal penetrado e bounding de tela.
    * Integrado ao gate principal `npm test` (137/137 testes aprovados).
  * **Documentação Técnica (`docs/GITHUB_ISSUES_DRAFT.md`):**
    * Atualizada a Issue 12 com a documentação do diagnóstico e a validação completa da correção.

#### [Física de Terrenos Inclinados, Rampas, Montes e Domos Arredondados com Escorregamento Físico] — 31/10/2026
* **feat(physics):** Implementação completa de física analítica contínua para rampas retilíneas (`RampBox`), pedras arredondadas e montes orgânicos (`EllipsoidDome`), com suporte a caminhada contínua até 45° e escorregamento físico tangencial em declives acentuados (> 45°):
  * **Primitivas de Terreno e Detecção Espacial (`src/physics/CollisionWorld.js`):**
    * Adicionados métodos analíticos `addRamp(cx, cy, cz, sx, sy, sz, direction, meta)` e `addDome(cx, cy, cz, rx, ry, rz, meta)` integrados diretamente ao Spatial Hash Grid ($O(1)$) através de suas AABBs delimitadoras.
    * Suporte a rampas nas 4 direções cardinais (`'+z'`, `'-z'`, `'+x'`, `'-x'`) com pré-cálculo de vetor normal unitário e função contínua de altura de superfície `getSurfaceAt(x, z)`.
    * Suporte a domos e montículos elipsoidais com altura de superfície analítica $y(x, z) = cy + ry \sqrt{1 - q}$ e vetor normal instantâneo via gradiente analítico $\nabla F$ normalizado ($O(1)$).
    * Consulta otimizada `getSlopeSurfaceAt(x, z)` para determinar a superfície de contato mais alta sob o jogador em tempo de execução.
    * Atualização de `overlaps(pos, size, b)`: validação de penetração baseada na superfície contínua, permitindo que a entidade fique sobre o declive sem gerar colisão de parede fantasma.
    * Atualização de `moveAndSlide(pos, size, delta, opts)`:
      * Resolução no eixo Y: determina o piso mais alto (caixa, rampa ou domo), extrai a normal da superfície de contato (`groundNormal`) e avalia o ângulo crítico de transitabilidade `maxWalkSlope` (padrão $0.7071$ correspondente a $45^\circ$).
      * Se $n_y \ge 0.7071$: ativa `res.onGround = true` e `res.isSliding = false`.
      * Se $n_y < 0.7071$: forçado para `res.onGround = false` e ativa `res.isSliding = true`.
      * Resolução nos eixos X e Z: ajuste suave de elevação contínua no contato com superfícies transitáveis (`pos.y = surf.y`), permitindo subidas e descidas suaves sem interrupção de movimento ou engasgos de `stepUp`.
    * Raycast analítico de alta precisão (`raycast`): suporte a testes raio-plano em rampas e raio-elipsoide fechado em domos para disparos de arma e linhas de visão (LOS) sem aproximação por malha gráfica.
  * **Dinâmica de Escorregamento Físico e Controle da Entidade (`src/entities/Character.js`, `src/entities/Player.js`):**
    * Em `Character.applyPhysics`: quando `this.lastMoveRes.isSliding` for ativo, calcula a componente tangencial da gravidade $\vec{a}_{\text{slide}} = \vec{g} - (\vec{g} \cdot \vec{n})\vec{n}$ com magnitude $\|\vec{a}_{\text{slide}}\| = g \sin(\theta)$ e acelera a entidade encosta abaixo; preserva a velocidade tangencial em X e Z (`hitX`/`hitZ` não zeram `vel` durante slide).
    * Em `Player.update`: quando `this.isSliding` for ativo, o pulo é bloqueado (`!this.isSliding`) para impedir escalada de paredões íngremes por pulos repetitivos; aceleração de controle de entrada atenuada para tração de ar reduzida (`airAccel * 0.3`), impedindo subir contra a gravidade de declives acentuados.
  * **Configuração e Dados de Balanceamento (`assets/config/gameplay.json`, `src/core/ConfigLoader.js`):**
    * Adicionados parâmetros canônicos `maxSlopeAngle: 45` e `maxWalkSlope: 0.7071` em `DEFAULT_CONFIG.PLAYER` e `assets/config/gameplay.json`.
  * **Renderização e Props do Mundo (`src/world/ItalyProps.js`, `src/world/MapLoader.js`):**
    * `ItalyProps.addMossyBoulder`: hitboxes de rochas e monólitos com musgo convertidas de caixas retas para `world.addDome`, tornando o cume das rochas pisáveis e suas encostas laterais escorregadias.
    * `MapLoader.js`: suporte a itens `type: "ramp"` e `type: "dome"` em `data.staticGeometry`; geração de malhas visuais Three.js via `createWedgeGeometry` (prisma triangular BufferGeometry) e `SphereGeometry` hemisférica.
  * **Estação Modular de Rampas e Declives no Mapa Grid (`assets/maps/grid.json`):**
    * Implantação da Estação de Rampas e Montes no Quadrante Leste Aberto ($X \in [30, 45], Z \in [10, 38]$), com mais de 8 metros de recuo em relação aos corredores, túneis e pontos de spawn, garantindo layout limpo, espaçoso e sem colisões:
      * **Bateria de Calibração Angular (4 pistas paralelas com entrada alinhada em $Z = 36$):**
        * Rampa 1 ($14.0^\circ$, $n_y \approx 0.970$): declive suave / guia de calçada;
        * Rampa 2 ($26.6^\circ$, $n_y \approx 0.894$): rampa padrão de acesso (caminhada fluida sem pulo);
        * Rampa 3 ($45.0^\circ$, $n_y = 0.7071$): limiar crítico exato de tração;
        * Rampa 4 ($60.3^\circ$, $n_y \approx 0.496$): parede íngreme com sinalização zebrada (`caution_yellow`) e escorregamento físico imediato;
        * Todas as 4 rampas equipadas com plataformas de topo niveladas em $Z = 28$ a $34$;
      * **Passarela Elevada de Dupla Rampa (Overpass Bridge em $X = 33$):**
        * Rampa de subida de $2.0\text{m}$ de altura, deck central plano de $6\text{m}$ de extensão e rampa de descida, permitindo travessia contínua;
      * **Parque dos Montes e Pedras Arredondadas (Mounds / Boulders em $X = 42$):**
        * Monte Suave (diâmetro $5\text{m}$, altura $1.2\text{m}$, transitável) e Monte do Molly (diâmetro $6\text{m}$, altura $2.2\text{m}$, cume transitável e bordas com escorregamento);
      * **Placas de Sinalização Métrica (`distance_sign`):**
        * Placas individuais alinhadas a $1.5\text{m}$ da entrada de cada rampa e em torno dos montes com textos descritivos das inclinações e alturas.
  * **Garantia de Qualidade & Testes Automatizados (`test/slope_physics_test.js`, `package.json`):**
    * Criação da suíte `test/slope_physics_test.js` com 7 seções cobrindo normais, alturas, domos, raycasts, subida/descida contínua em 60 Hz, deslizamento por aceleração tangencial e integração com `MapLoader`. Integrado ao pipeline oficial de testes no `package.json` (`npm test`).

#### [Mata-Mata FFA, Arquitetura de Modos de Jogo (GameMode), Salto Vertical da IA & Placar TAB] — 31/10/2026
* **feat(gameplay & modes):** Implementação completa do modo Mata-Mata Todos contra Todos (FFA Deathmatch) e da Arquitetura Strategy Pattern extensível de Modos de Jogo:
  * **Arquitetura `GameMode` & `DeathmatchMode` (`src/core/modes/GameMode.js`, `src/core/modes/DeathmatchMode.js`):**
    * Criação da classe base canônica `GameMode` encapsulando contratos de regras: `isEnemy(a, b)`, `canDamage(attacker, victim)`, `getSpawnPoint(entity, context)`, `onKill(killer, victim, headshot, extra)`, `getScoreboard()` e `reset()`.
    * Implementação da estratégia `DeathmatchMode` (FFA): toda entidade viva é inimiga de qualquer outra diferente de si mesma, fogo livre sem dano próprio, seleção de spawn por máxima dispersão segura (pondera distância mínima até o inimigo mais próximo e seleciona entre os melhores dentro de 15% de margem de segurança) e pontuação individual de abates e mortes com ordenação por Kills -> K/D -> menos mortes.
    * Suporte polimórfico a `onKill` aceitando tanto argumentos posicionais quanto payload de evento `{ killer, victim, headshot, extra }`.
  * **Combate Mútuo Bot vs Bot & Balística CCD (`src/weapons/ProjectileManager.js`, `src/core/GameManager.js`):**
    * Acoplamento do `GameManager` ao `ProjectileManager` via `setGameManager(this)`.
    * O teste de CCD do projétil agora avalia todos os combatentes inimigos registrados (`bots` e `player`) e valida permissão de dano via `_canDamage(attacker, victim)`.
    * Atribuição canônica de autoria: quando um bot é atingido por outro bot ou pelo jogador, o dano é aplicado via `takeDamage(dmg, part, attackerEntity)`, propagando o causador para o evento `bot:died` e disparando `match:kill` e `match:score_update`.
    * Projéteis físicos que passam raspando em bots agora aplicam supressão tática realista a qualquer combatente que não seja o atirador do tiro.
  * **Identidade Tática & Visual Biomecânico dos Combatentes (`src/entities/Bot.js`, `src/entities/Player.js`, `src/view/CharacterView.js`):**
    * Atribuição de identificadores aos bots: número tático (`botNumber`), codinomes militares dinâmicos (`callsign` sorteado entre Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Ghost, Hawk, Viper, Titan, Reaper, Phantom), distintivo visual de facção (`skinBadge` 🪖 / 👻) e propriedade de mira angular vertical (`pitch`).
    * Identidade do jogador: `name = 'VOCÊ'`, `badge = '🌟'`, flag `isPlayer = true` e rastreamento de `lastAttacker` em `takeDamage(dmg, part, attacker)`.
    * Inclinação biomecânica da coluna: `CharacterView.js` agora aplica rotação vertical em `this.torso.rotation.x = this.character.pitch`, permitindo que bots e soldados mirem para cima e para baixo de forma visualmente autêntica.
  * **Verticalidade 3D da IA, Salto Ativo (Vaulting) & Postura Sniper (`src/ai/AIController.js`, `src/ai/states/EngageState.js`, `src/ai/states/PatrolState.js`):**
    * Novo método `tryVault()` no `AIController`: sonda 0,95m à frente por caixas/props sólidos com altura relativa entre 0,35m e 1,50m (ou marcados com `vaultable: true`). Caso detecte obstáculo transponível ao andar ou colidir, aciona salto intencional `bot.vel.y = 6.0`.
    * Postura de Atirador em Terreno Elevado (`EngageState`): bots posicionados em telhados ou plataformas elevadas (`bot.pos.y > 2.5` com alvo abaixo) mantêm sua posição de vantagem com strafe lateral contido e `forward = 0`, impedindo que corram e caiam pela beirada do prédio; se o HP atingir nível crítico (< 30%), executam salto tático de fuga do parapeito (`bot.vel.y = 6.0`) e entram em estado de evasão (`flee`).
    * Percepção sensorial de áudio expandida: bots agora ouvem disparos de outros bots (`bot:fired`) além do jogador (`weapon:fired`) em um raio de 35 metros, convergindo ativamente para a zona de conflito.
    * Validação modular de spawn em 3D: `GameManager._isPositionClear` agora reconhece telhados e caixas elevadas (`b.max.y <= y + 0.1`) como piso de suporte válido, permitindo spawns naturais em andares superiores e lajes sem rejeição indevida.
  * **Placar Tático com Tecla TAB & Killfeed Universal (`src/core/Input.js`, `src/ui/HUD.js`, `index.html`, `assets/css/main.css`):**
    * Mapeamento de tecla `Tab` no `Input.js` vinculado à ação contínua canônica `'scoreboard'`, com interceptação de `e.preventDefault()` em `keydown` e `keyup` para impedir que o navegador troque o foco do cursor.
    * Modal `#scoreboard-modal` estilizado com tema tático militar translúcido com backdrop blur, bordas metálicas e destaque dourado/azul para a linha do jogador. Exibe colunas de Rank (`#`), Status (Vivo/Morto), Tag/Emblema, Combatente, Abates, Mortes e K/D com 2 casas decimais.
    * Atualização contínua do placar na HUD via `match:score_update` e renderização sob demanda ao segurar `Tab` ou no final da rodada (`round:over`).
    * Killfeed universal no topo esquerdo com ícones e formatação militar: `[BADGE] Atirador ➔ [BADGE] Vítima` com destaque para headshots e cores de borda para kills e mortes do jogador.
  * **Unificação de Spawns & Integração Geral (`src/main.js`):**
    * Unificação automática de `map.playerSpawns` e `map.botSpawns` em um pool comum de pontos de spawn dispersos para o `GameManager` e `DeathmatchMode`.
    * Chamada de `hud.updateScoreboard(input)` sincronizada no loop `renderUpdate`.
  * **Correções e Refinamentos Críticos de Robustez e Visual:**
    * **Killfeed & Autoria do Jogador (`src/core/modes/GameMode.js`, `src/ui/HUD.js`):** Alinhamento das chaves de autoria (`isPlayerKiller` e `isPlayerAttacker`), garantindo que abates realizados pelo jogador humano recebam a borda verde com realce (`.feed-player-killer`); formatação militar canônica com tag `[BOT]` nos combatentes de IA (`[BOT] #01 Viper 🪖 ➔ [BOT] #02 Ghost 👻`).
    * **Ciclo de Vida do Placar TAB & Fim de Rodada (`src/ui/HUD.js`, `src/core/GameManager.js`, `index.html`, `assets/css/main.css`):** Emissão inicial de `match:score_update` no início da partida e reset (eliminando tabela vazia ao abrir o TAB no primeiro segundo); sincronização de status `● VIVO` no respawn de combatentes; eliminação da redundância no nome do jogador (`VOCÊ` em vez de `VOCÊ (VOCÊ)`); exibição em primeiro plano no fim da rodada (`round-over` com `z-index: 300`) com botão "JOGAR DE NOVO" interativo.
    * **Postura Sniper & Vaulting de Obstáculos Finos (`src/ai/states/EngageState.js`, `src/ai/AIController.js`):** Em terreno elevado, o bot sustenta a posição de vantagem com strafe curto quando perde a visão do alvo (`!canSee`), sem avançar pela quina nem cair do telhado; o salto do parapeito (`vel.y = 6.0`) ocorre estritamente ao perder o alvo por tempo prolongado (`losTimer <= 0`) ou com vida crítica (< 30%). O método `tryVault()` agora utiliza sweep delimitador cobrindo sacos de areia e muretas finas (0,2m a 0,4m) com cooldown de 450ms.
    * **Harmonização do Pitch Biomecânico (`src/view/CharacterView.js`):** Unificação dos sinais de rotação vertical da coluna com a convenção do modelo (Three.js +Z), combinando rotação de tronco (`pitch * 0.65`) e pescoço/ombros (`pitch * 0.35`) na mesma direção angular, eliminando torções contraditórias ao mirar para cima e para baixo.
    * **Resiliência de Dano Fallback (`src/core/GameManager.js`):** Normalização da assinatura de `takeDamage` para bots no fallback sem `ProjectileManager` (`bot.takeDamage(dmg, 'body', attacker)`).
  * **Testes e CI (`test/deathmatch_mode_test.js` & `package.json`):**
    * Expansão da suíte `test/deathmatch_mode_test.js` de 11 para 19 testes unitários e de integração, cobrindo retenção de posição sniper, salto de parapeito, sweep de vaulting em caixas finas, sincronização de respawn no placar e autoria de abates.
    * 133/133 testes aprovados no gate `npm test`.

---

### 📘 Guia para Futuros Agentes de IA: Como Criar Novos Modos de Jogo com `GameMode`

Para implementar um novo modo de jogo (ex: **Mata-Mata em Equipe 5v5**, **Defusal / Desarme de Bomba**, **Captura de Ponto / Domination** ou **Campanha Co-op**), siga rigorosamente a arquitetura Strategy Pattern estabelecida:

#### 1. Criar a Subclasse Herdando de `GameMode` (`src/core/modes/SeuModo.js`)
Herde de `GameMode` e sobrescreva apenas os métodos de regra que diferem do padrão:

```javascript
import { GameMode } from './GameMode.js';

export class TeamDeathmatchMode extends GameMode {
  constructor(options = {}) {
    super(options);
    this.id = 'tdm_5v5';
    this.name = 'Team Deathmatch (5v5)';
    this.teams = { alpha: [], bravo: [] };
  }

  // Define se duas entidades são inimigas (jogadores do mesmo time retornam false)
  isEnemy(entityA, entityB) {
    if (!entityA || !entityB || entityA === entityB) return false;
    if (entityA.alive === false || entityB.alive === false) return false;
    return this.getTeam(entityA) !== this.getTeam(entityB);
  }

  // Previne fogo amigo se friendlyFire for false
  canDamage(attacker, victim) {
    if (!attacker || !victim || attacker === victim) return false;
    if (!this.options.friendlyFire && this.getTeam(attacker) === this.getTeam(victim)) {
      return false; // Bloqueia dano entre aliados
    }
    return true;
  }

  // Seleciona o spawn baseado na base do time
  getSpawnPoint(entity, context = {}) {
    const team = this.getTeam(entity);
    const teamSpawns = team === 'alpha' ? context.alphaSpawns : context.bravoSpawns;
    // Utilize context.isPositionClear(x, y, z) para validar o ponto
    return this._selectBestTeamSpawn(teamSpawns, context);
  }

  // Processa o abate para pontuação do time e individual
  onKill(killerOrPayload, victimArg, headshotArg, extraArg) {
    const data = super.onKill(killerOrPayload, victimArg, headshotArg, extraArg);
    // Adiciona pontuação global ao placar do time
    const team = this.getTeam(data.killer);
    if (team) this.teamScores[team]++;
    return data;
  }
}
```

#### 2. Plugar o Modo no `GameManager` (`src/core/GameManager.js` ou `src/main.js`)
O `GameManager` delega 100% das decisões de gameplay para a instância ativa do modo:
```javascript
// Ativação do modo desejado
gameManager.setGameMode(new TeamDeathmatchMode({ friendlyFire: false }));
```

#### 3. Regras Invioláveis do Contrato de Modos
- **Eventos Canônicos:** Não altere os nomes de eventos em `EventBus.js`. Dispare sempre `match:kill`, `match:score_update` e `match:scoreboard`.
- **Compatibilidade Headless:** A lógica de `GameMode` deve ser 100% desacoplada de DOM e WebGL, funcionando em testes Node.js puros e simulação sem render.
- **Payload Objeto:** Sempre passe `{ killer, victim, headshot, extra }` nos eventos emitidos.

---

#### [Interface: SVG de Configurações & Cards de Ação Dinâmicos com Auto-Expansão] — 31/10/2026
* **feat(ui):** Refinamento do botão de configurações e dos cards de ação no lobby principal (`index.html` e `assets/css/main.css`):
  * **SVG de Sliders Horizontais (`#btn-settings`):** Substituição das antigas linhas verticais por um SVG nítido com 3 trilhas horizontais e seletores circulares sólidos (`tune` / `sliders-horizontal`), alinhado 1:1 com o mockup de referência.
  * **Isolamento de Herança no Overlay:** Atualização da regra legada `#overlay button` para `#overlay button:not([class*="lobby-"])`, além de regras dedicadas `#overlay .lobby-icon-btn`, garantindo dimensões 40x40px, cantos arredondados (`border-radius: 10px`), centralização flexbox perfeita e renderização visível do SVG sem corte ou overflow.
  * **Mágica CSS de Auto-Expansão (`.lobby-action-card`):** Conversão da largura fixa de 76px para largura auto-adaptativa com `min-width: 76px; width: auto; padding: 0 14px; white-space: nowrap; box-sizing: border-box;`:
    * Se o texto for curto (ex: "Loja", "Passe", "Shop"), a caixa respeita `min-width: 76px` e permanece com o formato quadrado original idêntico aos cards vizinhos;
    * Se o texto for longo (ex: "Inventário", "Ausrüstung", "Инвентарь"), a caixa cresce fluidamente para as laterais garantindo 14px de respiro lateral, sem tocar as bordas ou cantos arredondados;
    * Adaptação responsiva para telas pequenas com `min-width: 58px; padding: 0 10px`.

#### [Interface: Ajuste Visual do Botão Jogar no Lobby] — 31/10/2026
* **fix(ui):** Ajuste fino de estilização no botão `#btn-play` (`.lobby-play-btn`) no menu principal / lobby (`assets/css/main.css`):
  * **Fundo Cinza:** Fundo atualizado para cinza claro metálico suave (`#cbd5e1`), combinando harmoniosamente com a tonalidade das bordas dos cards e do menu.
  * **Borda Contínua:** Remoção do corte angular `clip-path: polygon(...)` e aplicação de contorno arredondado contínuo (`border-radius: 12px`, `border: 1px solid rgba(255, 255, 255, 0.28)`), eliminando o aspecto de linhas descontínuas causadas pelo recorte poligonal anterior.
  * **Texto em Cinza Escuro:** Tipografia "▶ JOGAR" redefinida para cinza escuro carvão (`#161a20`), idêntico à cor de fundo do card superior de seleção de mapa (`.lobby-map-card`), garantindo alto contraste e leitura cristalina sobre o fundo cinza.
  * **Isolamento de Herança CSS:** Proteção do seletor `#overlay button:not(.lobby-play-btn)` e especificidade `#overlay #btn-play.lobby-play-btn` para prevenir sobreposição de propriedades transparentes do overlay legado.

#### [Interface: Lobby 3D Inspirado no Mockup, Avatar no Spawn com Arma Primária & Modais] — 31/10/2026
* **feat(ui):** Atualização completa da interface do menu principal/lobby baseada no mockup de referência:
  * **Layout Visual do Mockup (`index.html` e `assets/css/main.css`):**
    * **Header Superior:** Perfil do operador com avatar circular com borda dourada e efeito de brilho, codinome editável com persistência no `localStorage` (`#lobby-player-name`, padrão "Player_01"), nível ("Nível 3"), contadores de economia (1.250 moedas de ouro e 50 gemas) e botão de configurações com ícone de sliders.
    * **Inferior Esquerdo:** 3 botões em cards escuros arredondados translúcidos com efeito glassmorphism e ícones SVG nítidos (*Inventário*, *Loja*, *Passe*), integrados com toast de feedback "Recurso em breve".
    * **Inferior Direito:** Card dinâmico de mapa selecionado com thumbnail, título (ex: "Dust Block"), subtítulo ("Mata-Mata · 4 Bots") e chevron de navegação; acompanhado pelo botão "▶ JOGAR" amarelo-ouro vibrante com corte angular chamfered (`clip-path`) e animações de escala e brilho.
    * **Vinheta e Fundo:** Fundo transparente com vinheta radial elegante focando no operador 3D centralizado.
  * **Avatar 3D do Operador no Spawn com Arma Primária (`src/main.js` e `src/view/CharacterView.js`):**
    * Substituição da ilustração 2D central pelo avatar 3D do operador (`TacticalManContinuous` com a skin/camuflagem ativa) em pé na posição de spawn do mapa selecionado.
    * Novo método `CharacterView.setWeaponModel(weaponId)` para trocar dinamicamente a arma 3D nas mãos do soldado em terceira pessoa utilizando os modelos reais de `ItemDrop.builders`, com rotação alinhada e fallback seguro.
    * Enquadramento cinematográfico de câmera em terceira pessoa frontal a 2,4m de distância focando no peito/cabeça do operador com o cenário limpo do mapa de fundo.
    * Transição suave: ao iniciar a partida (`▶ JOGAR`), o modelo em 3ª pessoa é ocultado e a câmera e braços de 1ª pessoa assumem o controle instantaneamente.
  * **Sistema de Modais Glassmorphic (`src/ui/MenuController.js` e `index.html`):**
    * **Modal de Mapa & Loadout (`#modal-map-loadout`):** Abas internas para "Mapa & Partida" (seleção entre os 12 mapas, quantidade de bots e duração) e "Loadout & Skin" (seleção de arma primária, secundária, vitrine 3D interativa e seletores de camuflagem/cores com sincronização em tempo real no avatar do lobby).
    * **Modal de Configurações (`#modal-settings`):** Abas organizadas para "Mira CS2" (todos os controles avançados da mira), "Áudio" (5 sliders de volume do mixer), "Gráficos & Texturas" (modos PBR, bump, escala UV e upload de textura) e "Sistema & Ajustes" (sensibilidade, headbob, tremor, vibração, supressão, modo dev/cheats e tela cheia).
    * **Modal de Pausa In-Game (`#modal-pause`):** Ao apertar ESC ou destrancar o mouse em combate, exibe modal minimalista com linhas finas e opções "Resumir" (retoma combate), "Configurações" (abre modal de settings) e "Sair" (recarrega para o lobby limpo).
  * **Testes e Validação (`test/menu_mockup_integration_test.js` & `package.json`):**
    * Nova suíte automatizada validando estrutura HTML, preservação de 100% dos IDs de controles legados, método dinâmico `CharacterView.setWeaponModel` e controle `Viewmodel.setVisible`.
    * 114/114 testes aprovados no pipeline `npm test`.

#### [Movimentação — Fase 5: Humanização da IA, Inércia dos Bots & Sincronia do NavGrid] — 30/10/2026
* **feat(movement):** Conclusão da Fase 5 do Superplano de Movimentação em `src/ai/AIController.js`, `src/ai/NavGrid.js`, `src/entities/Bot.js`, `src/entities/Character.js` e `test/movement_phase5_test.js`:
  * **Inércia e Aceleração Orgânica dos Bots ($k_{acc} = 18.0$, $k_{dec} = 26.0$):**
    * Substituição da atribuição de velocidade instantânea (`bot.vel.x = desiredMove.x`) por interpolação cinemática contínua em `AIController.js`.
    * Arrancada e manobras aceleram a uma taxa de $18\text{ s}^{-1}$ e frenagens sangram momentum a $26\text{ s}^{-1}$ com parada limpa em zero (sem micro-drift residual), eliminando a sensação de "patinação no gelo" e estalos não-físicos na locomoção dos soldados inimigos.
  * **Grace Period no Detector Anti-Stuck (250 ms):**
    * Adição do temporizador `motionGraceTimer` (0,25s) em `AIController.js`, ativado ao sair da imobilidade.
    * Bloqueio de falsos positivos: o detector de quinas não dispara desengates errôneos nos primeiros 250ms de arrancada enquanto o bot ainda está vencendo a inércia inicial.
  * **Normalização Universal de `stepHeight` (0,35 m) na IA e Física:**
    * Atualização do valor padrão de `stepHeight` em `NavGrid.js` de `0.52` para `0.35` (lendo `CONFIG.PLAYER.stepHeight`), impedindo que a busca A* trace rotas por cima de muretas altas intransponíveis.
    * Normalização de `stepHeight` em `Bot.js` e fallback em `Character.js` para `0.35`, alinhando perfeitamente a física do jogador, a física dos bots e a malha de navegação.
  * **Testes e CI (`test/movement_phase5_test.js` & `package.json`):**
    * Nova suíte automatizada cobrindo: transposição física de obstáculo de 0,30m e bloqueio de 0,50m; curva de aceleração progressiva em 16ms, 83ms e 416ms; frenagem limpa com $k=26$; imunidade do grace period de 250ms e acionamento correto sob bloqueio real. 100% dos testes aprovados no pipeline `npm test`.


#### [Movimentação: Calibração Direcional Tática (Strafe, Recuo & Bloqueio de Sprint para Trás)] — 30/10/2026
* **feat(movement):** Calibração biomecânica de locomoção direcional em `assets/config/gameplay.json`, `src/core/ConfigLoader.js`, `src/entities/Player.js` e `test/movement_directional_test.js`:
  * **Proibição Estrita de Sprint para Trás e Lateral (`Player.js`):**
    * Sprint agora requer obrigatoriamente componente vetorial de movimento para frente ($\vec{w}_{wish} \cdot \vec{fwd} > 0.01$).
    * Tentar sprintar recuando (`S` + `Shift`) ou em strafe puro (`A`/`D` + `Shift`) mantém o operador em marcha tática contida, eliminando a corrida de costas irreal a 24,5 km/h. Sprint permanece ativo em avanço frontal e diagonais frontais (`W+A`, `W+D`).
  * **Elipsoide de Velocidade Direcional (`strafeMul: 0.85`, `backwardMul: 0.75`):**
    * Multiplicadores data-driven adicionados em `gameplay.json` e `ConfigLoader.js`.
    * Cálculo contínuo baseado em elipsoide de locomoção em `Player.js`:
      * Marcha à ré pura (`S`): $75\%$ da velocidade base $\rightarrow$ $3,15\text{ m/s}$ (~11,3 km/h).
      * Strafe lateral puro (`A`/`D`): $85\%$ da velocidade base $\rightarrow$ $3,57\text{ m/s}$ (~12,8 km/h).
      * Marcha frontal pura (`W`): $100\%$ da velocidade base $\rightarrow$ $4,20\text{ m/s}$ (~15,1 km/h).
      * Diagonais interpoladas suavemente em $360^\circ$ sem descontinuidades cinemáticas.
  * **Testes e CI (`test/movement_directional_test.js` & `package.json`):**
    * Nova suíte automatizada validando dados data-driven, velocidades exatas de caminhada em todos os eixos, bloqueio de sprint de costas e lateral, e preservação do sprint frontal/diagonal. 100% dos testes aprovados no pipeline `npm test`.


#### [Movimentação — Fase 4: Camera Impact, Landing Dip, Respawn Orientation & Viewmodel Sync] — 30/10/2026
* **feat(movement):** Implementação da Fase 4 do Superplano de Movimentação em `assets/config/gameplay.json`, `src/core/ConfigLoader.js`, `src/core/CameraRig.js`, `src/entities/Player.js`, `src/new_mechanics/LocomotionSmoothingSystem.js`, `src/weapons/Viewmodel.js` e `test/movement_phase4_test.js`:
  * **Landing Dip Cinestésico (`landingDipScale: 0.0035`):**
    * Adição do parâmetro data-driven `landingDipScale: 0.0035` em `gameplay.json` e `ConfigLoader.js`.
    * Implementação de sub-mola amortecida de impacto vertical ($k = 280, d = 26$) em `CameraRig.js` acionada quando o jogador aterrissa no solo com velocidade vertical $\text{vel.y} < -3.0\text{ m/s}$ (com clamp de segurança em $-12.0\text{ m/s}$).
    * Flexão sutil e realista dos joelhos e da câmera (~1,5 a 5 cm) que estabiliza organicamente sem oscilação perpétua, com atenuação proporcional a `headbobScale` de acessibilidade (desativa completamente se configurado para 0).
  * **Preservação e Restauração de Orientação no Respawn (`spawnYaw`):**
    * `CameraRig.reset(spawnYaw = 0)` agora aceita o ângulo de azimute do ponto de desova e define atomicamente `this.currentYaw = spawnYaw` e `this.targetYaw = spawnYaw`.
    * `Player.js` extrai `spawnYaw` a partir do vetor de coordenadas `[x, y, z, yaw]` do mapa e restaura a orientação inicial tanto no boot quanto no `respawn()`, eliminando o defeito histórico de renascer de costas para o combate.
  * **Trava de Fase 1:1 entre Câmera e Viewmodel (`currentBobPhase`):**
    * Exposição pública da propriedade `get currentBobPhase()` em `CameraRig.js`.
    * `LocomotionSmoothingSystem.js` passa a sincronizar `this.bobPhase = rig.currentBobPhase` quando `rig` é fornecido via `Viewmodel.applySwayFromRig`, unificando a cadência da arma com o movimento da cabeça e eliminando descompasso visual entre olhos e braços.
    * Preservação do fallback autônomo contínuo caso o sistema de locomoção seja executado de forma isolada/headless.
  * **Testes e CI (`test/movement_phase4_test.js` & `package.json`):**
    * Nova suíte automatizada cobrindo: integridade de dados data-driven; `CameraRig.reset(spawnYaw)`; retenção de orientação após morte e respawn do Player; dinâmica da sub-mola de `landingDip`; disparo automático na aterrissagem física após queda livre; trava de fase 1:1 com fallback autônomo. 100% dos testes aprovados no pipeline `npm test`.


#### [Movimentação — Fase 3: Robustez de Colisão, Headroom Check e Unificação do Lean] — 30/10/2026
* **feat(movement):** Implementação da Fase 3 do Superplano de Movimentação em `src/physics/CollisionWorld.js`, `src/entities/Player.js`, `src/core/CameraRig.js` e `test/movement_phase3_test.js`:
  * **Headroom Check Volumétrico (`CollisionWorld.hasHeadroom`):**
    * Adição do método volumétrico de verificação vertical `hasHeadroom(pos, size, targetHeight)` utilizando a AABB completa do jogador via `_anyOverlap` com buffer estático `_headroomTestSize` pré-alocado (zero garbage collection).
    * Bloqueio físico em `Player.js`: ao soltar a tecla de agachar (`crouch`) dentro de dutos, túneis ou sob tetos baixos (< 1.80m), o operador permanece agachado até alcançar área aberta com altura vertical suficiente, eliminando teleporte acidental para cima de tetos ou engasgos na física de colisão.
  * **Unificação e Sincronização do Lean Tático (`Player.js` & `CameraRig.js`):**
    * Eliminação do duplo lerp desconexo (14/s na física + 14/s na câmera). A interpolação de inclinação de tronco agora é calculada exclusivamente em `Player.js` com taxa responsiva de 18/s.
    * `CameraRig.js` rastreia diretamente `player.lean` (`this.currentLean = this.targetLean`), garantindo sincronia 1:1 imediata e em fase entre o tronco do modelo em 3ª pessoa (`CharacterView`) e a visão do operador em 1ª pessoa.
  * **Normalização Estrita de Postura (`crouchAmount`):**
    * Remoção da constante legada desestabilizadora `1.5` ao morrer; `crouchAmount` agora é estritamente limitado no intervalo $[0.0, 1.0]$.
  * **Testes e CI (`test/movement_phase3_test.js` & `package.json`):**
    * Nova suíte automatizada cobrindo: detecção volumétrica de headroom sob teto de 1,40m e liberação sob teto de 2,20m; bloqueio de destravamento de agachamento em túneis com liberação ao sair; interpolação responsiva de lean a 18/s; rastreamento direto e sem atraso secundário no `CameraRig`. 100% dos testes aprovados no pipeline `npm test`.


#### [Movimentação — Fase 2: Física de Salto, Step-Height 0.35m, Coyote Time e Jump Buffer] — 30/10/2026
* **feat(movement):** Implementação da Fase 2 do Superplano de Movimentação em `assets/config/gameplay.json`, `src/core/ConfigLoader.js`, `src/entities/Player.js` e `test/movement_phase2_test.js`:
  * **Arco de Salto Tático e Crível (`jumpSpeed: 6.0 m/s`):**
    * Redução calibrada da velocidade vertical de salto de `7.0 m/s` para `6.0 m/s`. Sob a gravidade canônica de `20 m/s²`, o ápice do salto passou de lunático `1,225 m` para atléticos `0,85–0,90 m`, eliminando a sensação de "gravidade lunar" e permitindo ultrapassar muros de 0,60m a 0,80m com precisão.
  * **Normalização do Degrau Físico (`stepHeight: 0.35 m`):**
    * Ajuste do limite de subida suave (`stepHeight`) de `0.55 m` para `0.35 m` em `gameplay.json` e `ConfigLoader.js`. O jogador agora sobe guias de calçada (0,15m) e degraus de escada (0,30m e 0,35m) sem pressionar pulo, mas é bloqueado rigidamente em blocos de 0,45m e 0,60m, acabando com a anomalia de escalar muretas andando.
  * **Coyote Time (120 ms de Tolerância):**
    * Adição do temporizador `coyoteTimer` (0,12s) que preserva a capacidade de salto por 120 ms após o operador deixar o chão ou correr para fora de quinas de plataformas, eliminando quedas frustrantes no limiar de desníveis.
  * **Jump Buffer (120 ms de Pré-Acionamento) e Fim do Auto-Bhop:**
    * Adição do temporizador `jumpBufferTimer` (0,12s) alimentado via consumo discreto de ação (`input.consumeAction('jump')` / `input.isActionJustPressed`). Se o pulo for pressionado até 120 ms antes de tocar o solo, ele dispara imediatamente no tick do impacto.
    * Substituição da leitura contínua de pulo por ação discreta: segurar a tecla `Espaço` agora realiza apenas um salto e mantém o jogador firme no chão após aterrissar, impedindo bunny-hopping acidental ou involuntário.
  * **Testes e CI (`test/movement_phase2_test.js` & `package.json`):**
    * Nova suíte automatizada validando dados de configuração, altura de ápice em simulação (0,85m–0,90m), física de step-up em 5 alturas de blocos (0.15m a 0.60m), tolerância de coyote time em queda livre, enfileiramento de jump buffer e mitigação do auto-bhop. Testes 100% aprovados.


#### [Movimentação — Fase 1: Escala Métrica, Pacing Tático e Desacoplamento de Postura] — 30/10/2026
* **feat(movement):** Implementação da Fase 1 do Superplano de Movimentação em `assets/config/gameplay.json`, `src/core/ConfigLoader.js`, `src/entities/Player.js`, `src/weapons/WeaponSystem.js` e `test/movement_phase1_test.js`:
  * **Pacing Tático Data-Driven (`gameplay.json` & `ConfigLoader.js`):**
    * Calibração da velocidade de caminhada base (`walkSpeed: 4.2m/s`, ~15,1 km/h) e multiplicador de sprint (`sprintMul: 1.62x`, resultando em 6,80 m/s / ~24,5 km/h), aproximando o ritmo do combate tático a padrões modernos como CS2 e CoD.
    * Ativação e consumo real dos multiplicadores data-driven `crouchMul` (0.50x $\rightarrow$ 2,10 m/s) e `adsMul` (0.48x $\rightarrow$ 2,02 m/s), eliminando a regra hardcoded legada de `0.5x` estático.
    * Inclusão do parâmetro `stanceRecoveryTime: 0.15s` na configuração do jogador.
  * **Desacoplamento e Cooldown de Postura Sprint $\rightarrow$ ADS (`Player.js` & `WeaponSystem.js`):**
    * Adição do temporizador `sprintRecoveryTimer` (0,15s) ativado no momento da transição de sprint para parada/caminhada.
    * Bloqueio sincronizado da mira ativa (ADS) em `Player.js` (linha 120) e `WeaponSystem.js` (linha 431) enquanto `sprintRecoveryTimer > 0`, prevenindo o exploit de "snap-shot" instantâneo em alta velocidade.
    * Correção da ordem de avaliação de estado em `Player.js`: o estado de `crouched` agora é atualizado antes de avaliar `wantsSprint`, impedindo o atraso de 1 tick em transições agachado/em pé.
  * **Eliminação de Código Morto:**
    * Remoção definitiva do bloco inalcançável de passos sonoros em `Player.js` (`if (!this.rig)`), já que todo `Player` instancia `CameraRig` e os passos sonoros canônicos são emitidos no render sincronizados com a passada da câmera.
  * **Testes e CI (`test/movement_phase1_test.js` & `package.json`):**
    * Nova suíte automatizada validando dados de configuração, velocidades finais em simulação física de 60 ticks (Walk 4.20 m/s, Sprint 6.80 m/s, Crouch 2.10 m/s, ADS 2.02 m/s), disparo do `sprintRecoveryTimer` e ausência de resíduos de código morto. 100% dos testes aprovados no pipeline `npm test`.


#### [Mapa Grid de Calibração Métrica & Física, Piso Tabuleiro 1x1m e Circuito de Testes] — 30/10/2026
* **feat(maps):** Implementação completa do mapa de laboratório de calibração física e métrica `assets/maps/grid.json` (100×100m) e ecossistema de testes em `src/world/TextureGenerator.js`, `src/world/MaterialFactory.js`, `src/world/MapLoader.js`, `index.html` e `test/grid_map_test.js`:
  * **Novo Mapa `assets/maps/grid.json` (100×20×100):** Escala de 100 × 100 metros (`bounds: [-50, -50, 50, 50]`) estruturado em 5 estações modulares padronizadas para validação de locomoção, balística, pulos e colisões:
    * *a) Pista de Arrancada (50m):* Corredor livre central de 8m de largura estendendo-se de $z = 40$ até $z = -10$, com pilares marcadores laterais contrastantes em $x = -4$ e $x = 4$ a cada 10 metros ($z = 40, 30, 20, 10, 0, -10$) para aferição de aceleração, velocidade máxima e tempo de corrida/sprint.
    * *b) Estação de Degraus (Step-Up Test com 6 Blocos):* Bateria de degraus progressivos lado a lado de alturas 0,15m (guia de calçada), 0,30m (escada dupla), 0,35m (degrau padrão urbano), 0,45m (bloco médio), 0,60m (obstáculo alto que excede o limiar) e 0,65m (bloqueio total), validando milimetricamente o limiar de subida suave (`stepHeight: 0.55m`).
    * *c) Estação de Pulo & Frestas (Jump & Gaps):* 4 muros de salto de alturas 0,6m, 0,9m, 1,2m e 1,5m com propriedade `vaultable: true`; pista elevada de 1,0m de altura com vãos vazados de 1,0m (pulo curto), 1,8m (pulo em corrida), 2,5m (pulo no limite) e 3,5m (aferição de coyote time e salto impossível).
    * *d) Estação de Corredores e Portas:* 3 corredores paralelos de largura útil 1,0m, 1,5m e 2,5m com paredes de 3m de altura; batente de passagem com abertura de 1,0m de largura por 2,2m de altura e porta interativa em `doors`.
    * *e) Túnel de Teto Baixo (Headroom / Crouch Test):* Túnel de 8m de extensão com teto rígido a 1,40m do piso, bloqueando a entrada do jogador em pé (`height: 1.8m`) e permitindo passagem agachada (`crouchHeight: 1.2m`), garantindo que o jogador permaneça agachado sem teleporte ou atravessar a colisão.
    * *f) Muralha Perimetral:* Enclausuramento da área de 100×100m para confinamento de entidades e projéteis.
  * **Piso Tabuleiro Métrico 1×1m (`grid_1x1` / `dev_grid`):**
    * Novo gerador procedural `createDevGrid()` em `TextureGenerator.js` com padrão xadrez 2×2 (dois tons de cinza concreto `#7e8288` e `#9498a0`), juntas métricas de 1 metro rebaixadas no mapa de relevo (*bump map*), cruzetas submétricas de 0,5m e microagregados de concreto.
    * Registro do material `grid_1x1` e alias `dev_grid` em `MaterialFactory.js` com projeção triplanar `applyWorldSpaceUV(mat, 0.5)`, garantindo que cada ladrilho do solo meça rigorosamente 1,0m × 1,0m no espaço de mundo 3D.
  * **Identificação Textual em Placas (`distance_sign`):**
    * Inclusão de 32 placas 3D em alta visibilidade (amarelo militar com texto preto em negrito) afixadas diante de cada bloco, pilar, degrau, muro, vão, corredor e túnel (ex: `"0m"`, `"10m"`, `"0.15m"`, `"0.35m"`, `"0.60m"`, `"GAP 1.8m"`, `"1.0x2.2m"`, `"1.40m TETO"`).
  * **Resiliência e Normalização no Carregamento (`MapLoader.js`):**
    * Normalização automática de URLs curtas (`"grid"` resolve para `./assets/maps/grid.json`).
    * Suporte a dimensões 3D no mapa (`size: [w, h, d]` extrai largura X e profundidade Z).
    * Normalização resiliente de limites (`bounds: [minX, minZ, maxX, maxZ]` converte para o formato interno do motor `[minX, maxX, minZ, maxZ]`).
  * **Interface do Usuário (`index.html` & `MenuController.js`):**
    * Padronização da opção no `<select id="map-select">` para o caminho relativo `./assets/maps/grid.json` alinhado aos demais mapas do jogo;
    * Migração defensiva e compatibilidade retroativa em `MenuController.getSavedMap()`, convertendo automaticamente valores legados `"grid"` salvos no `localStorage` para `"./assets/maps/grid.json"`;
    * Incremento do Service Worker (`sw.js` para `arena-blockout-v3`) para purgar caches obsoletos de módulos ES do navegador.
  * **Testes & CI (`test/grid_map_test.js` & `package.json`):** Nova suíte de testes de contrato e física (validação de metadados, distâncias de segurança dos spawns > 11m, 6 degraus, muros, vãos, túnel, placas de texto e simulação de física de step-up e teto no `CollisionWorld`). Suíte `npm test` 100% verde (16 scripts e 111 testes aprovados).

#### [Mapa Favela 150x150, Texturas Procedurais Orgânicas e Props de Laje/Vielas] — 26/10/2026
* **feat(maps):** Implementação completa do mapa `favela.json` (150x150), novas texturas procedurais PBR orgânicas e props temáticos de vielas e lajes:
  * **Novo Mapa `assets/maps/favela.json` (150x150):** Escala de 150 × 150 metros (`bounds: [-70, 70, -70, 70]`) com traçado de labirinto orgânico de vielas e becos estreitos (1.8m a 3.0m de largura).
  * **Céu e Atmosfera Ensolarada (Sunny Sky Environment):** Configuração de céu azul celeste ensolarado vibrante (`fogColor: "#4ea8f5"`, `fogNear: 85`, `fogFar: 260`) com iluminação solar intensa (`sunIntensity: 2.2`, `sunColor: "#fffdf0"`) e luz ambiente difusa azul (`ambientIntensity: 1.25`), eliminando a neblina escura padrão e destacando os sobrados sob luz de dia limpo.
  * **Casas com Interior Acessível e Lajes Transitáveis:**
    * *Casa 1 (Casarão da Laje Central):* Térreo de 2 cômodos com portas e janelas abertas, escada de alvenaria interna/externa (`favela_stairs`) levando à laje superior (Y = 3.8m) com muretas de cobertura, caixa d'água azul e puxadinho de zinco.
    * *Casa 2 (Sobrado do Beco do Trapézio):* Geometria angular inspirada no esboço com sala térrea acessível, escada e laje com vista da travessa norte.
    * *Casa 3 (Fortim do Beco do Pixo):* Edifício com interior acessível, escada externa, passarela de madeira suspensa conectando à laje vizinha para combate vertical.
  * **Novas Texturas Procedurais PBR em `TextureGenerator.js` e `MaterialFactory.js`:**
    * `favela_brick`: Tijolo baiano furado terracota aparente sem reboco com argamassa espessa e manchas de queima.
    * `favela_wall_organic`: Reboco tosco com padrões orgânicos complexos (manchas de umidade capilar ascendente na base, mofo/lodo esverdeado, escorrimentos verticais de chuva e partes descascadas com tijolo exposto).
    * `favela_graffiti` / `favela_pixo`: Paredes de reboco com pichações de traço reto brasileiro ("PAZ", "FÉ", "150M"), tags em spray e escorrimentos verticais de tinta fresca.
    * `favela_concrete_slab`: Laje de concreto armado rústico com marcas de tábuas de caixaria de madeira e pontas de vergalhão enferrujado.
    * `favela_alley_floor`: Piso de vielas com cimento batido irregular, remendos de asfalto gasto, canaleta central de esgoto/drenagem e manchas de óleo.
  * **Novos Props 3D em `ItalyProps.js` e `MapLoader.js`:**
    * `favela_antenna`: Antenas UHF espinha de peixe com varetas de alumínio e antenas parabólicas de laje.
    * `overhead_wires`: Fiação elétrica aérea e cabos pretos suspensos com catenária cruzando os becos entre as casas.
    * `utility_pole`: Poste de viela com cruzeta de madeira, 4 isoladores de cerâmica e transformador em balanço.
    * `favela_water_tank`: Autêntica caixa d'água azul de polietileno (1000L) com anéis de reforço, tampa cônica e colisão transitável.
    * `favela_stairs`: Escadas com degraus de 0.35m (compatíveis com o `stepHeight: 0.55m` do jogador para subida suave sem pular).
  * **Integração na Interface:** Disponibilização da opção no seletor de mapas de `index.html`.
  * **Garantia de Qualidade & Testes:** Suíte dedicada `test/favela_map_test.js` com validação de dimensões, spawns com distância de segurança (>11m), integridade de materiais e colisão do mundo. Suíte `npm test` 100% verde (111/111 testes aprovados).

#### [Suporte a Vibração Tátil no PWA de iPhone e Correção de Haptics Mobile] — 26/10/2026
* **feat(haptics):** Suporte nativo ao motor tátil (Taptic Engine) do iPhone (iOS 17.4+ e iOS 18+) para Safari e PWAs instalados na Tela de Início em `src/core/TouchInput.js` e `index.html`:
  * **Ponte Nativa WebKit Switch Bridge (`#ios-haptic-bridge`):** Como o WebKit para iOS não implementa o padrão W3C `navigator.vibrate()`, foi injetada uma ponte nativa estruturada com `<input type="checkbox" switch>` e `<label for="...">` posicionada no DOM para se manter no render tree sem visibilidade ou interferência de ponteiro (`position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; opacity: 0.01; pointer-events: none`). O acionamento programático `.click()` do label faz o WebKit acionar o Taptic Engine físico do iPhone.
  * **Fallback Transparente e Suporte a Padrões de Múltiplos Pulsos:** Em `TouchInput.prototype.vibrate()`, se `navigator.vibrate` não estiver disponível ou retornar falso (iOS), o método delega para `_triggerIOSHaptic()`. Padrões escalonados como arrays (ex: `[40, 30, 40]` de dano sofrido ou `[15, 30, 20]` de fim de recarga) são despachados sequencialmente através de temporizadores sincronizados.
  * **Resposta Tátil Síncrona em Gestos de Toque:** Inclusão de feedback tátil imediato no evento `touchstart` dos botões virtuais de disparo (`btn-touch-fire`, `btn-touch-fire-top`, `btn-touch-fire-left`) e de ação (`btn-touch-reload`, `btn-touch-jump`, `btn-touch-crouch`, `btn-touch-ads`, `btn-touch-smoke`, `btn-touch-cycle`, `btn-touch-firemode`, `btn-touch-interact`, `btn-touch-pause`, `btn-touch-zoom`), cumprindo o requisito de gesto de usuário do WebKit e eliminando qualquer latência percebida.
  * **Confirmação no Menu de Acessibilidade:** Em `MenuController.js`, alternar a opção "Vibração Tátil" para "Ativado" aciona imediatamente um pulso de teste de 25ms para que o jogador sinta a resposta tátil na hora.
* **fix(events):** Correção de evento canônico de recarga e expansão de haptics em `src/core/TouchInput.js`:
  * **Substituição do Evento Inexistente:** O listener de `weapon:reload` (evento inexistente no catálogo canônico) foi substituído pelos eventos canônicos reais `weapon:reload:start` e `weapon:reload:end`.
  * **Adição de Haptics para Ação de Bomba:** Inclusão de listener para `weapon:pump` (ação de bomba da espingarda Winchester Model 1912).
* **test(haptics):** Nova suíte de testes unitários e de integração `test/touch_haptics_ios_test.js` com 6 testes aprovados, cobrindo respeito à configuração de acessibilidade, caminho padrão W3C, fallback WebKit iOS, criação dinâmica da ponte DOM e validação de todos os eventos canônicos ouvidos. Suíte global `npm test` atualizada de 105 para 111 testes verdes.

#### [Sincronização Fiel do HUD, Dynamic Gap Sub-MOA e Alinhamento do Cano 3D] — 26/10/2026
* **fix(crosshair):** Sincronização do HUD e projeção 3D de alta precisão em `BarrelCrosshairAlignment.js` e `CrosshairManager.js`:
  * **Alinhamento do Cano Colinear com Zeroing Analítico:** Em `BarrelCrosshairAlignment.js`, o vetor balístico do cano (`barrelAimDir`) e a direção pura (`pureBarrelDir`) agora incorporam analiticamente a elevação mecânica `weaponDef.zeroingElevation`, garantindo que a projeção da crosshair no modo dinâmico coincida com precisão sub-milimétrica com o ponto real de impacto a 50m.
  * **Compensação Fiel da Coronha (Stock-Pivot) na Mira Pura:** A extração da direção pura do cano (`pureBarrelDir`) desconta com precisão o recuo visual efetivo atenuado no ADS (`effectiveKick = kickRotX * (1.0 - curAds * 0.82)`), mantendo o modo "Alinhamento Dinâmico ON + Follow Recoil OFF" perfeitamente ancorado na orientação física de repouso da arma.
  * **Abertura Dinâmica das Hastes (Dynamic Gap) Sub-MOA:** Calibração da fórmula de dispersão em `CrosshairManager.js` (`dynamicSpreadOffset = Math.max(0, (spread - 0.002) * 380.0)`), eliminando o antigo degrau inerte de `0.010` rad. O retículo agora responde com sensibilidade tática realista tanto em repouso quanto em movimento e rajada sustentada, retornando suavemente no cessar-fogo.
  * **Garantia de Qualidade & Testes:** Suíte completa com 105/105 testes verdes em `npm test`, `test/crosshair_manager.test.js` e `test/alignment_test.js`.

#### [Controle de Recuo Manual Estilo CS2 e Amortecimento do CameraRig] — 26/10/2026
* **fix(camera):** Normalização do controle de recuo manual (estilo CS2 puro) e calibração de estabilidade da câmera em `CameraRig.js`, `ConfigLoader.js` e `gameplay.json`:
  * **Climb 100% Manual (Sobe e Não Volta):** Introdução da chave `autoRecoilRecovery: false` em `gameplay.json` e `CONFIG.GUNPLAY`. No `CameraRig`, o `targetPitch` acumulado pelo recuo (`climbPitch`) não é mais puxado de volta para baixo automaticamente após o cessar-fogo. A mira permanece estritamente onde o recuo a elevou, exigindo que o jogador compense o coice ativamente com o mouse para baixo, exatamente como no Counter-Strike 2.
  * **Amortecimento Estável de Headbob no ADS (90%):** O fator `adsDamp` em `CameraRig.update` foi calibrado de `0.15` para `0.10` (90% de amortecimento do movimento da cabeça ao caminhar mirando), eliminando qualquer sensação de cinetose ou oscilação brusca no horizonte durante o avanço tático em ADS.
  * **Molas Ágeis de Punch sem Tremor Residual:** Calibração dos coeficientes da mola de choque visual (`kRot` de 320/280 para 340/300 e `dRot` de 28/25 para 32/28), propiciando um retorno firme e sem oscilações residuais pós-disparo.
  * **Garantia de Qualidade & Testes:** Novos testes de controle de recuo manual no cessar-fogo em `test/phase3_fixes_test.js` e `test/zeroing_master_weapon_test.js`. Suíte completa com 105/105 testes verdes em `npm test`, `test/alignment_test.js` e `test/locomotion_smoothing_test.js`.

#### [Cinemática Stock-Pivot e Estabilização do Viewmodel em ADS] — 26/10/2026
* **refactor(viewmodel):** Cinemática Stock-Pivot com rotação apoiada no ombro e atenuação tática de recuo e sway no ADS em `src/weapons/Viewmodel.js`:
  * **Pivô Anatômico na Coronha (Stock-Pivot):** A rotação do coice do viewmodel deixa de girar ao redor da origem arbitrária do modelo 3D (que provocava efeito pêndulo na tela) e passa a girar ao redor do ponto de apoio da coronha no ombro direito do operador (`_vStockOffset`), interpolado continuamente entre hipfire `(0.14, -0.16, 0.18)` e ADS `(0.08, -0.16, 0.18)`.
  * **Atenuação da Rotação Angular no ADS (82%):** Ao mirar em ADS, a rotação visual local do viewmodel é atenuada em até 82% (`rotMultiplier = 1.0 - (curAdsAmount * 0.82)`), mantendo o coice linear no ombro (`this.kickPos.z`) enquanto a câmera cuida do choque visual. Isso impede que a retícula ou alça/massa de mira saltem para fora da tela e sejam ocultadas pelo próprio corpo da arma durante rajadas.
  * **Estabilização de Sway e Bobbing no ADS (85%):** No método `applySwayFromRig`, a rotação e o deslocamento de oscilação (bobbing, passos e inércia do olhar) recebem amortecimento tático no ADS (`adsSwayDamp = Math.max(0.12, 1.0 - (curAds * 0.85))`), ancorando a ótica firmemente no centro da tela e preservando uma sutil sensação física de peso sem vibração desestabilizadora no olho do atirador.
  * **Limitação Rígida de Coice Máximo:** Calibração dos limites máximos de subida em `applyKick` (`kickRotX` limitado a `0.020` rad no ADS e `0.075` rad no hipfire; `kickPos.z` limitado a `0.004` no ADS e `0.008` no hipfire), impedindo acúmulo infinito de recuo visual em cadências altas.
  * **Garantia de Qualidade & Testes:** Suíte completa com 103/103 testes verdes em `npm test`, `test/alignment_test.js` e `test/locomotion_smoothing_test.js`.

#### [Desacoplamento e Limpeza da Direção do Disparo] — 26/10/2026
* **fix(gunplay):** Desacoplamento e calibração unificada da direção balística em `WeaponSystem.js` e `Viewmodel.js`:
  * **Alinhamento Ótico no ADS com Zeroing Analítico:** O vetor diretor `_dir` em ADS passa a ser extraído da linha canônica de visada com adição da elevação mecânica $\theta_{\text{zero}}$ pré-calculada (`def.zeroingElevation`). A trajetória viaja em linha reta no espaço 3D, atingindo com precisão sub-milimétrica o centro do retículo aos 50m e reproduzindo o *Height-Over-Bore* realista a queima-roupa ($< 2\text{m}$).
  * **Remoção do Salto Angular no Frame 0:** Removida a mutação instantânea de `mount.rotation.x = this.baseRot.x + this.kickRotX` em `Viewmodel.applyKick`. O recuo agora é processado exclusivamente na interpolação e decaimento contínuo, impedindo que o tiro no frame 0 seja contaminado e arremessado para o teto antes de sair do cano.
  * **Sincronia Estática vs Dinâmica:** No hipfire dinâmico, o disparo segue o cano 3D da arma com a elevação analítica de zeroing; no hipfire estático clássico, a convergência aponta para 50m fixos sem sobreposição de raycasts em obstáculos próximos.
  * **Garantia de Qualidade & Testes:** Suíte completa com 103/103 testes verdes em `npm test`, `test/alignment_test.js` e `test/zeroing_master_weapon_test.js`.

#### [Normalização de Zeroing Analítico Estático & Fim da Convergência Elástica] — 26/10/2026
* **feat(ballistics):** Implementação do modelo de Zeroing Analítico Estático em `MasterWeapon.js` e compilação de dados em `WeaponDefs.js`:
  * **Cálculo Fixo de Elevação Mecânica ($\theta_{\text{zero}}$):** Introdução de `MasterWeapon.calculateZeroingElevation(weaponDef, zeroDistance = 50.0)`. O ângulo mecânico necessário para compensar o *Height-Over-Bore* ($h = \text{sightLocal}.y - \text{muzzleLocal}.y$) e a gravidade na distância zero é pré-calculado analiticamente pela fórmula $\theta_{\text{zero}} = (h / Z) + (g \cdot Z) / (2 \cdot v^2)$ na inicialização da arma em `WeaponDefs.js` (`def.zeroingElevation`), sem qualquer raycast dinâmico no momento do tiro.
  * **Eliminação Definitiva da "Mangueira Elástica":** Remoção do raycast de obstáculo próximo em `MasterWeapon.getConvergenceTarget`. A convergência estática mira rigorosamente na distância zero nominal (50m fixos), abolindo a deflexão diagonal artificial de $5^\circ$ a $8^\circ$ ("tiro chicote") a curta distância e preservando a física de cano rígido e *Height-Over-Bore* realista ($< 2\text{m}$).
  * **Garantia de Qualidade & Testes:** Atualização de `test/zeroing_master_weapon_test.js` com testes unitários para `calculateZeroingElevation` e verificação de convergência sem snap em obstáculos. Suíte completa com 103/103 testes verdes em `npm test`.

#### [Preservação Estrita do Cano Físico 3D & Eliminação de Curvatura de Projétil] — 26/10/2026
* **fix(gunplay):** Normalização canônica da colinearidade entre o cano físico 3D e a trajetória balística (WeaponSystem.js, BarrelCrosshairAlignment.js, Viewmodel.js):
  * **Colinearidade Pura 3D (0.000° de Desvio):** O vetor diretor de disparo _dir em ADS e no Alinhamento Dinâmico (dynamicAlignment) passa a ser extraído estritamente do eixo frontal do cano 3D da arma (mount.matrixWorld * (0, 0, -1)). A bala sai 100% reta da boca do cano no frame 0, eliminando qualquer dobra angular ou discrepância visual em relação à ponta do quebra-chamas e à mira ótica.
  * **Eliminação de Curvatura por Raycast em Obstáculos Próximos:** No modo clássico de retículo estático no centro, a convergência nominal para 50m (MasterWeapon.getConvergenceTarget) deixa de sofrer override por colisão em superfícies próximas (world = null). Isso elimina a deflexão diagonal artificial de 5° a 8° que ocorria ao disparar perto de alvos, paredes ou manequins a 1m–3m no Range.
  * **Remoção de Spray Recoil Artificial em BarrelCrosshairAlignment.js:** Removida a adição vetorial de sprayRecoil.pitch * 0.54 sobre _vMuzzleDir. Como a arma 3D já possui movimentação física completa (sway, bob, inércia, wall compression e kick), a adição isolada de spray empurrava o projétil acima do cano visível. Agora barrelAimDir reflete rigorosamente a orientação 3D do cano.
  * **Sincronização Imediata de Pose Física no Disparo (Frame 0):** Viewmodel.applyKick agora sincroniza instantaneamente mount.rotation.x e mount.position.z no momento do coice, garantindo que o cano já esteja na pose pós-disparo quando a matriz mundial é lida pelo sistema de tiro, eliminando descompassos visuais entre o projétil e o modelo 3D.
  * **Garantia de Qualidade & Testes:** Suíte completa com 103/103 testes verdes em npm test, testes de alinhamento e calibração 100% aprovados (test/alignment_test.js, test/zeroing_master_weapon_test.js).

#### [Correção de Gunplay & HUD Sync] — 26/10/2026
* **data(weapons):** Calibração tática realista de dispersão e recuo 100% orientada a dados em `assets/weapons/weapons.json` e `assets/config/gameplay.json` sem qualquer alteração em scripts (`*.js`):
  * **Dispersão Mecânica Cirúrgica (Sub-MOA no ADS):** Redução do `spreadAds` e `baseSpread` em 60-75% em todas as 10 armas (HK416: 0.0004 rad, SCAR-H: 0.0003 rad, M249: 0.0008 rad, VSS: 0.0001 rad, AK-47: 0.0005 rad), eliminando o "bloom" irrealista e garantindo que o tiro atinja com precisão militar onde a mira ótica/alça aponta.
  * **Agrupamento Crível em Hipfire:** Ajuste de `spreadHip` em ~50-60% (HK416: 0.009 rad, AK-47: 0.011 rad, M249: 0.014 rad, UZI: 0.012 rad), tornando o combate aproximado coeso e letal sem espalhar projéteis fora do cone visual do cano.
  * **Atenuação da Penalidade por Locomoção:** Calibração de `dynamicLoss` (strafe: ~0.006 rad, walk: ~0.004 rad, run: ~0.015 rad) e redução do `swaySpreadImpact` (de 0.45-0.60 para 0.12-0.20), impedindo que passos laterais abram cones artificiais de vários metros a curta distância.
  * **Controle de Rajada Contínua em `gameplay.json`:** Redução de `fireStreakMultiplier` de 0.16 para 0.06, conferindo escalonamento orgânico ao recuo sustentado sem dobrar o coice violentamente em 5 tiros.
* **fix(crosshair):** Resolução definitiva da Issue #10 (Subida excessiva do HUD / Double-Dipping de recuo no modo Dinâmico & Follow Recoil):
  * **Eliminação de Duplicação de Recuo em `CrosshairManager.js`:** Quando `dynamicAlignment` e `followRecoil` estavam ambos ativados, o HUD posicionava `left/top` em `barrelScreenPos` (que já continha a elevação do spray balístico) e em seguida somava novamente o recuo em CSS `transform: translateY(-totalPitch * pixelsPerRad)`. Isso duplicava a subida angular e arremessava a crosshair no teto enquanto os tiros atingiam o centro. O offset de recuo no `transform` agora é zerado quando `dynamicAlignment` está ativo, ancorando a mira com precisão no ponto exato de impacto.
  * **Separação Canônica em `BarrelCrosshairAlignment.js`:** Implementação de `pureScreenPos` (alinhamento físico puro do cano com sway, inércia, bobbing e wall press, sem a subida de spray) e `screenPos` (ponto balístico real com spray). A mira dinâmica utiliza `barrelScreenPos` quando `followRecoil` está ativo, e `pureBarrelScreenPos` quando `followRecoil` está desligado.
  * **Sincronização Instantânea Frame 1:** Inicialização direta de `currentScreenX/Y` na primeira chamada via flag `this.initialized`, eliminando atrasos ou transições a partir do canto (0,0) ou do centro estático. Aumento do `lerpSpeed` para `dt * 45.0`, garantindo $\ge 98\%$ de match espacial instantâneo.
  * **Sincronia Balística em `WeaponSystem.js`:** Se o jogador optar por mira fixa no centro com `followRecoil` ativado (estilo CS2 puro), o disparo físico agora aplica a deflexão de `sprayRecoil` no vetor `_dir` antes do cálculo de convergência focal, garantindo que mesmo no modo clássico a bala acerte onde o follow recoil está apontando.
  * **Garantia de Qualidade & Testes Automatizados:** Atualização dos testes de regressão em `test/crosshair_manager.test.js` e introdução de teste de alta precisão em `test/zeroing_master_weapon_test.js` comprovando match espacial $\ge 98.0\%$ (com erro real medido inferior a 2 pixels / 0.18%) entre a posição da crosshair e o local exato onde as balas impactam. Suíte completa com 103/103 testes verdes.


#### [Governança & Regras de IA] — 25/10/2026
* **docs(governance):** Instituição de diretriz mandatória em `AGENTS.md` (§3.11, §9, §10, §11), `GEMINI.md` (regras locais e globais do assistente) e `PROJECT_MAP.md` (§15, §16) determinando o incremento e atualização estritamente obrigatórios do `CHANGELOG.md` após qualquer alteração em scripts JavaScript (`*.js`) e arquivos de dados/configurações (`*.json`).

#### [Em Andamento / Working Tree] — 25/10/2026
* **feat(maps):** Remasterização completa (Facelift) do mapa `range.json` (Campo de Tiro) para clima aberto e ensolarado:
  * Iluminação solar vibrante com céu azul aberto (`fogColor: #7dc2f5`, visibilidade 280m, `sunIntensity: 2.2`).
  * Implementação de texturização PBR completa com piso de concreto (`concrete`) e baias de tiro organizadas.
  * Adição de bancadas de tiro acústicas com divisórias (`addShootingBench`) e placas de sinalização de distância de 10m a 75m (`addDistanceSign`).
* **feat(textures):** Adição dos geradores procedurais `createShootingTarget` (alvo militar padrão B-27 com anéis concêntricos 1 a 10, zona preta e centro bullseye "X" vermelho) e `createConcrete` em `TextureGenerator.js`.
* **feat(materials):** Registro dos materiais `concrete`, `target` / `target_paper` e `plinker` / `steel_plate` na `MaterialFactory.js` e em `MapLoader.js`.
* **feat(props):** Implementação dos props 3D especializados em `ItalyProps.js`:
  * `addPaperTarget`: suporte de madeira com folhas de papel alvo frontal e traseira, registrando colisor de target.
  * `addPlinkerTarget`: alvo de plinker (cavalete tubular com gongo de aço suspenso) dotado de simulação física de pêndulo harmônico amortecido em tempo real.
* **feat(audio):** Implementação da síntese de som de plinker em `TerminalBallistics.synthesizeBulletHitPlinker` e `AudioSystem.playProceduralPlinkerHit`:
  * Dirac inicial de impacto de chumbo na chapa de aço endurecido.
  * Ressonância tonal inarmônica de alta frequência ("PLIINNNG") com fundamental em 1650 Hz e harmônicos estendidos (>4000 Hz) sustentados por mais de 1.2s.
  * Roteamento automático no evento `shot:world` quando a superfície atingida é `plinker` ou `steel_plate`.
* **feat(ui):** Feedback visual de hitmarker no HUD em impactos contra alvos de papel e plinkers de aço.
* **test:** Criação da suíte `test/range_target_plinker_test.js` cobrindo validação de mapa, geração de texturas, materiais PBR, física pendular do plinker e síntese acústica do chime "PLIINNN".
* **docs(issues):** Registro formal da Issue #11 em `docs/GITHUB_ISSUES_DRAFT.md` e `todo.md`: especificação técnica para quitação de débito de nomenclatura e centralização em `ItalyProps.js` (renomeação para `PropFactory.js` e modularização dos 35 props por domínio arquitetônico, natural, militar e estande).

#### [ef5e473] — 25/10/2026 *(HEAD atual da branch `main`)*
* **fix(physics):** Correção do clipping e afundamento de entidades no chão em `CollisionWorld.getNearbyBoxes()`, garantindo que caixas globais de grande porte (`globalBoxes`) sejam sempre consideradas em consultas de célula única.
* **fix(render):** Atualização do tipo de shadow map para `THREE.PCFShadowMap` em `SceneSetup.js`, removendo aviso de depreciação do Three.js 0.186.1.
* **docs(issues):** Registro formal da Issue #9 (Recoil/climbing recovery) e Issue #10 (Crosshair gap flicker) em `docs/GITHUB_ISSUES_DRAFT.md`.

#### [477dc8a] — 25/10/2026
* **feat(debt-payoff):** Conclusão das Fases 3, 4 e 5 do Roadmap de Engenharia.
* **feat(gameplay):** Recuperação suave de pitch após recuo em `CameraRig.js`; trava estrita de troca de armas e saque em estado de morte em `WeaponSystem.js`; restrição de alcance vertical ($\Delta Y < 1.2\text{m}$) e estabilização de seleção para coleta de carregadores em `MagazineDrop.js`.
* **feat(ai):** Cone de visão angular (110°) e dispersão de balins para espingardas de bots em `AIController.js`.
* **perf(render):** Cache estático de canvas e texturas procedurais em `TacticalManContinuous.js`; desativação de sombras no passe de render de lunetas em `ScopeSystem.js`.
* **refactor(weapons):** Centralização de modelos, miras e drops de chão no `src/weapons/WeaponRegistry.js`.
* **feat(ui):** Bloqueio de troca de loadout durante a partida no menu.

#### [cd7b4a7] — 25/10/2026
* **feat(debt-payoff):** Conclusão da Fase 2 do Roadmap de Engenharia (Observabilidade e Fail-Fast).
* **feat(core):** Validação estrita de schemas de configuração e armas no boot em `src/core/SchemaValidator.js`.
* **feat(core):** Error boundary no loop de renderização com tela de fallback em `src/core/Engine.js`.
* **feat(fx):** Avisos de depuração em `MaterialFactory.js` para materiais ausentes.
* **feat(core):** Catálogo `CANONICAL_EVENTS` em `EventBus.js` com avisos em tempo de execução para eventos não registrados ou sem ouvintes.

#### [2b5c99d] — 25/10/2026
* **feat(debt-payoff):** Conclusão da Fase 1 do Roadmap de Engenharia (Normalização de Contratos).
* **refactor(events):** Padronização universal de payloads do `EventBus` para objetos `{ ... }` em 100% dos emissores e consumidores.
* **refactor(config):** Unificação de nomenclatura de variáveis de movimento (`sprintMul`, `adsMul`, `crouchMul`, `sens`).
* **test:** Adição de testes de integridade para schemas e eventos.

---

#### [5e5dcea] — 15/10/2026 *(Salvo na branch `backup/headbob-odometria` e tag `backup-headbob-odometria`)*
* **feat(locomotion):** Implementação de avanço de fase odimétrico (`dPhase = (Math.PI * distFrame) / stepDist`).
* **feat(camera):** Geometria dupla de Head Bob — Parábola convexa para caminhada (`walkBob`) e Lemniscata de Bernoulli em "8 deitado" para corrida (`sprintBob`).
* **feat(audio):** Sincronização sonora 1:1 disparando `player:footstep` nas fronteiras de fase de impacto ($\pi$ e $2\pi$).
* **feat(config):** Exposição dos parâmetros de locomoção em `CONFIG.LOCOMOTION` em `ConfigLoader.js` e `gameplay.json`.

---

#### [68138c1] — 14/10/2026 *(Estado atual da branch `main`)*
* **feat(fx):** Implementação do `SurfaceEyedropper` para amostragem dinâmica da cor do chão/parede em impactos de projéteis (partículas de poeira e detritos adaptativas ao material atingido).
* Link no GitHub: [commit 68138c1](https://github.com/teusbraga/arenablockoutlimited/commit/68138c176f4c3113ba09535427d5adf7f74410c3)

#### [9b5e649] — 14/10/2026
* **feat(fx):** Desacoplamento dos efeitos sonoros de disparo das armas para reprodução independente.
* **feat(fx):** Implementação de cooldown exponencial para a fumaça residual do cano após rajadas intensas.

#### [f85ed7a] — 14/10/2026
* **feat(weapons):** Padronização visual dos quebra-chamas (Muzzle Flash) com brilho radial no estilo VSS.
* **feat(fx):** Calibração e ajuste fino da fumaça cônica expelida pelo bocal.

#### [2dd1a6a] — 13/10/2026
* **feat(locomotion):** Adição do `LocomotionSmoothingSystem` para transições contínuas e interpolação de animações de movimento do operador.

#### [b69c78d] — 12/10/2026
* **feat(ui):** Vitrine interativa 3D de armas no menu de Loadout com rotação e inspeção de modelos.
* **feat(ai):** Navegação e pathfinding dos bots baseado em NavGrid dinâmico.

#### [47da309] — 12/10/2026
* **perf:** Introdução do pipeline PNG 2D ANTI-LAG™ para atlas e texturas leves sem perda visual.

#### [530d41c] & [e3a55b8] — 12/10/2026
* **docs:** Especificação de engenharia reversa com 50 Requisitos Funcionais (RFs) detalhados.
* **docs:** Criação do plano de testes de QA (`QA_TEST_PLAN.md`) e atualização do `README.md`.

#### [af42a2c] — 12/10/2026 🔒 *(Marco Crítico: Blindagem de Tracers)*
* **feat(tracers):** Definição matemática final dos traçantes balísticos desacoplados de mundo (`lengthMultiplier` 1.4, M249, VSS, Proto, M12).
* **governance:** Estabelecimento formal da diretiva de segurança `GEMINI.md` (congelamento inviolável de traçantes e coordenadas de armas).

#### [1d327c8] — 11/10/2026
* **feat(fx):** Traçantes estilo laser antiaéreo de 6 metros em velocidade real e calibração de armamento (M249, Prototype Rifle, VSS, Shotgun M12).

#### [f0f27a9] — 11/10/2026
* **feat(ui):** Isolamento de estado do HUD e novo radar direcional com indicador de tiros ouvidos.
* **feat(mechanics):** Sistema modular de retículas (CrosshairSystem), assistência de mira (Aim Assist) e trava de input.

#### [b55b4e7] & [e6061e0] — 10/10/2026
* **feat(mechanics):** Implementação de *Weapon Wall Press* (recuo da arma contra a parede ao se aproximar).
* **feat(audio):** Foley sonoro adaptativo com base na velocidade e terreno do jogador.
* **feat(accessibility):** Configurações de acessibilidade data-driven em `gameplay.json`.
* **arch:** Preparação da estrutura de dados para migração/exportação Godot 4.

#### [c20bf62] & [1362dd0] — 09/10/2026
* **feat(ai):** Balanceamento de precisão da IA, mecânica de rajada (burst fire) e comportamento de dispersão (scatter) pós-eliminação.
* **feat(weapons):** Perfis balísticos data-driven em `assets/weapons/ammo.json` e traçantes dinâmicos de bots.

#### [4b4693b] — 08/10/2026
* **revert:** Restauração do código para a versão `d39e680` via `git restore`.

#### [d39e680] — 08/10/2026
* **feat(tracers):** Implementação da técnica de *Muzzle-Pin* para traçantes de armas subsônicas.

#### [39937da] & [b705ddd] — 08/10/2026
* **fix:** Eliminação do stuttering durante compilação assíncrona de shaders e correção de imports Three.js.
* **perf:** Otimização do loop de renderização com restauração de visibilidade consistente de traçantes.

#### [220e9d0] — 07/10/2026
* **feat(ui):** Seleção de armamento primário e secundário integrada na interface de Loadout.

---

## 🛠️ Guia Rápido: Como Navegar Entre as Versões no Git

### 1. Voltar para a versão estável atual (`main`):
```bash
git checkout main
```

### 2. Acessar a versão de testes de Odometria e Head Bob:
```bash
git checkout backup/headbob-odometria
```

### 3. Rodar a bateria de testes automatizados:
```bash
npm test
```

### 4. Inspecionar o histórico resumido no terminal:
```bash
git log --oneline -n 15
```
