# 📜 Log de Versões e Histórico de Desenvolvimento (CHANGELOG)
**Projeto:** Arena Blockout (FPS Browser 3D Three.js)  
**Repositório:** [teusbraga/arenablockoutlimited](https://github.com/teusbraga/arenablockoutlimited)  
**Data da última atualização:** 30 de Outubro de 2026  

---

## 📌 Estado Atual das Branches & Tags

| Identificador | Tipo | Commit | Descrição / Propósito |
| :--- | :--- | :--- | :--- |
| **`main`** *(HEAD atual)* | Branch Principal | [`ef5e473`](https://github.com/teusbraga/arenablockoutlimited/commit/ef5e473) | **Milestone 1 — Normalização Canônica e Quitação de Dívida Técnica.** 82/82 testes aprovados. Desoneração do spatial hash (251k células a menos), unificação Three.js 0.186.1, SchemaValidator no boot, WeaponRegistry, isolamento de sombras em lunetas e estabilização de combate. |
| **`backup/headbob-odometria`** | Branch de Backup | [`5e5dcea`](https://github.com/teusbraga/arenablockoutlimited/commit/5e5dcea) | **Versão experimental preservada.** Contém odometria real de passos no solo, curvas convexa parabólica (andar) e lemniscata (correr), sincronização sonora 1:1 de passos e configuração `LOCOMOTION`. |
| **`backup-headbob-odometria`** | Tag Fixa | [`5e5dcea`](https://github.com/teusbraga/arenablockoutlimited/commit/5e5dcea) | Tag imutável apontando para o commit da versão experimental de odometria e passos. |

---

## 🚀 Histórico Cronológico de Versões e Commits

### 🔹 Outubro de 2026

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
