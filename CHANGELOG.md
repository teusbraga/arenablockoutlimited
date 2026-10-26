# 📜 Log de Versões e Histórico de Desenvolvimento (CHANGELOG)
**Projeto:** Arena Blockout (FPS Browser 3D Three.js)  
**Repositório:** [teusbraga/arenablockoutlimited](https://github.com/teusbraga/arenablockoutlimited)  
**Data da última atualização:** 25 de Outubro de 2026  

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
