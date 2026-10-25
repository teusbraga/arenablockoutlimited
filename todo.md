# TODO — Organização e dívida técnica

> Resumo da avaliação de organização do projeto. Não é um projeto caótico: é um protótipo que cresceu rápido e acumulou dívida. A base arquitetural é boa; o que falta é consolidação, documentação confiável e processo.
> Mapa detalhado: [`PROJECT_MAP.md`](./PROJECT_MAP.md), especialmente §13.

---

## O que já está bem resolvido

- Separação clara de camadas: `physics` puro, `core`, `entities`, `weapons`, `ui`, `fx`, `audio`.
- Arquitetura data-driven real para armas, munição, mapas e bots.
- EventBus, pools, spatial hash, CCD, FSM de IA com NavGrid.
- Testes headless relevantes para balística, penetração, áudio espacial e QTE.
- `CollisionWorld` independente de Three.js e código determinístico.

Esses pontos não devem ser reescritos. O trabalho é consolidar em volta deles.

---

## Problemas estruturais

### 1. Arquivos-Deus
| Arquivo | Tamanho | Risco |
|---|---:|---|
| `index.html` | ~2.000 linhas | CSS + HUD + menus + scripts no mesmo arquivo |
| `src/fx/Effects.js` | 2.129 linhas | Muitos pools/eventos no mesmo módulo |
| `src/world/TextureGenerator.js` | 2.591 linhas | 39 geradores sem divisão por domínio |
| `src/view/models/TacticalManContinuous.js` | 2.381 linhas | Modelo + texturas + paletas + helpers |
| `src/world/ItalyProps.js` | 1.397 linhas | 31 props + colisão no mesmo arquivo |
| `src/ui/MenuController.js` | 948 linhas | Loadout, mira, áudio, texturas e sistema juntos |

**Impacto:** navegação cara, merges conflitantes, risco alto em qualquer edição local.

### 2. Documentação divergente do código
- `README.md` lista controles, número de armas e número de suítes desatualizados.
- `HUD.md` e `src/new_mechanics/walkthrough.md` descrevem features que não existem (share codes, sliders RGB/opacidade, integrações).
- `#controls` no `index.html` ainda diz “Q arma / E porta”; o código usa Q/E para lean e F para interagir.
- Documentação aspiracional é pior que ausência de documentação: induz o agente ao erro.

### 3. Código e contratos fantasmas
- **Fase 1 Concluída:** EventBus padronizado com regra de ouro (100% payloads em objetos) e catálogo canônico (`CANONICAL_EVENTS`). `notification` e `player:heal` ativados com listeners.
- **Higienização de Dados:** `weapons.json` higienizado (campos fantasmas `model` e `audioKey` removidos; `ejectLocal` adicionado em todas as 10 armas; `type` presente em todas; defaults de `casingType` e `smokeResidualMax/Color` formalizados no loader `WeaponDefs.js`).
- `gameplay.json` e `CONFIG` normalizados (aliases unificados para `sprintMul`/`sprintMultiplier`, `sens`/`sensitivity`, e `PHYSICS.fixedDt: 0.016667` alinhado a 60 Hz).
- **Fase 2 Concluída:** Mecanismos de Diagnóstico & Modo Dev: `SchemaValidator` no boot (validação de 21 atributos de armas, ammo e gameplay), `EventBus` com Dev Diagnostics (warnings para tópicos não canônicos e disparos no vácuo), `MaterialFactory` com alerta de fallback 'wall', e Error Boundary com Crash Screen no loop principal (`Engine.js`).
- **Fase 3 Concluída:** Estabilização de Bugs & Inconsistências Reais: Trava de troca/recarga de armas durante morte do jogador (`WeaponSystem.js`), amortecimento e recuperação gradual de recuo vertical (*recoil recovery*) no `CameraRig.js`, bloqueio de coleta de carregadores através de andares ($\Delta Y$) e raycast ampliado no solo (`MagazineDrop.js`), priorização contextual do item/carregador mais próximo (`GameManager.js`), vibração háptica mobile via `navigator.vibrate` (`TouchInput.js`), cone de visão (FOV) e detecção sonora em bots (`AIController.js`), e disparo de múltiplos balins de escopeta para bots (`GameManager.js`). Testes integrados em `test/phase3_fixes_test.js`.
- **Fase 4 Concluída:** Pilares Arquiteturais & Otimizações Low-End: Cache estático de texturas procedurais (`faceTexture`, `hairCardTextures`, `shirtTexture`) em `TacticalManContinuous.js` eliminando dezenas de megabytes de VRAM e micro-stutters de GC em mobile; isolamento de sombras no passe offscreen 512x512 de `ScopeSystem.js` garantindo 60 FPS contínuos durante ADS em lunetas telescópicas; e Manifesto Central de Armas (`src/weapons/WeaponRegistry.js`) com Registry Pattern desacoplando e unificando o registro das 10 armas canônicas para `Viewmodel`, `ItemDrop` e `ScopeSystem` em `main.js`. Testes integrados em `test/phase4_architecture_test.js`.
- **Fase 5 Concluída:** Expansão Contínua com Antifragilidade & Limites de Segurança: Trava de loadout pós-início de partida (`loadoutLocked` e `pendingSlots` em `WeaponSystem.js` e `MenuController.js`) eliminando exploit de troca de arma/munição em combate e aplicando alterações no próximo reinício via `applyPendingSlots()`; isolamento do buffer de cheats via teclado atrelado a `CONFIG.DEV_MODE` (`Input.js`) e novo Painel de Desenvolvedor e Cheats integrado à UI do menu (`index.html` e `MenuController.js`); e ciclo de vida com teardown gracioso de entidades, portas e drops sem vazamentos em `GameManager.js` (`destroy()` / `startMatch()`). Testes integrados em `test/phase5_expansion_test.js` (82/82 testes passando).
- Eventos órfãos e campos inertes remanescentes: `shot:tracer`, `weapon:cycle_action`, `crosshair:change`, `crosshair:reset`, maior parte de `SWAY`.

### 4. Sistemas paralelos sem dono único
- **Mira:** `CameraRig`, `WeaponSystem`, `BarrelCrosshairAlignment`, `CrosshairManager` e `AimAssistSystem` influenciam o mesmo resultado.
- **Locomoção:** `Player`, `CameraRig`, `Viewmodel` e `LocomotionSmoothingSystem`; a doc alega integrações que não existem.
- **Dano:** status balístico, projétil, hitboxes e supressão se cruzam sem uma camada única de resolução.

### 5. Processo e validação fragmentados
- `npm test` cobre 15 scripts, mas 8 testes relevantes ficam fora do gate.
- `tools/test_suite.py` falha porque `audio.json` está vazio (áudio é procedural).
- Sem linter, formatter ou typecheck.
- Three.js divergente: `0.160.0` no navegador via importmap, `^0.186.1` nos testes.
- Working tree com feature inteira não commitada (reload tático, `MagazineDrop`, `whoami`), o que torna qualquer limpeza arriscada.

### 6. Nomenclatura e organização acumuladas
- `new_mechanics/` virou gaveta de sistemas distintos.
- `models/*` mistura builder + classe de física inline.
- `MagazineDrop.js` está em `weapons/`, embora pareça `world/`.
- Comentários com encoding inconsistente e mistura de PT/EN.

---

## Backlog priorizado

### P0 — Antes de qualquer refatoração
- [x] Commitar o trabalho em andamento (reload tático, `MagazineDrop`, QTE, `whoami`) ou registrar claramente que é intocável. (Commit `51f11ea`)
- [x] Não rodar `git checkout -- .`, `git restore .` ou `git clean -fd`.
- [x] Confirmar com o usuário quais “defeitos” são intencionais antes de corrigi-los (`PROJECT_MAP.md` §13).

### P1 — Confiabilidade
- [x] Adicionar os 8 testes restantes ao `npm test`. (Gate unificado com 25 suítes no total)
- [x] Corrigir ou aposentar `tools/test_suite.py` (ele não representa o estado atual). (Atualizado para validar áudio procedural e SoundPresets)
- [x] Implementar listener de `notification` na HUD **ou** substituir todos os usos por `hud:popup` e remover o evento. (Listener ativado em HUD.js)
- [x] Remover eventos e campos mortos, ou implementar os consumidores. (`def.type` formalizado nas 10 armas, listeners órfãos podados)
- [x] Unificar a versão de Three.js entre navegador e testes. (Unificado para 0.186.1 via importmap no index.html e package.json)
- [x] Otimizar spatial hash do piso e degrau em CollisionWorld (251k células eliminadas, _tryStepUp em O(1))
- [x] Corrigir Service Worker (sw.js v2 com limpeza e normalização de URLs sem inchaço de _t=Date.now())
- [x] Limpar duplicação de métodos setWorld/setGameManager em Effects.js (Claude Sonnet Ponto 4)

### P2 — Redução de arquivos-Deus
- [x] Extrair CSS e HUD de `index.html` para arquivos próprios, mantendo o importmap. (1294 linhas extraídas para `assets/css/main.css`, index.html caiu para 701 linhas)
- [ ] Dividir `Effects.js` em `tracers`, `smoke`, `sparks`, `casings`, `blood`.
- [ ] Dividir `TextureGenerator.js` por domínio (italy, dust, woods, urban).
- [ ] Dividir `ItalyProps.js` por categoria (arquitetura, vegetação, militar).
- [ ] Separar builders de armas das classes de física.
- [ ] Quebrar `MenuController` em controladores por aba.

### P3 — Consolidação de sistemas
- [x] Definir um único ponto de decisão para mira (câmera + cano + HUD + aim assist). (Formalizado em `docs/PIPELINES.md` e coberto por `test/mira_pipeline_test.js`)
- [x] Definir um único ponto de resolução de dano (projétil → entidade → eventos). (Formalizado em `docs/PIPELINES.md` e coberto por `test/damage_pipeline_test.js`)
- [ ] Integrar de verdade ou remover `LocomotionSmoothingSystem` dos documentos que o anunciam como integrado.
- [ ] Revisar `new_mechanics/` e renomear para domínios reais.

### P4 — Documentação
- [x] Reescrever `README.md` a partir de `PROJECT_MAP.md`.
- [x] Corrigir `HUD.md` e `walkthrough.md` ou marcá-los como históricos.
- [x] Atualizar `#controls` no `index.html`.
- [x] Manter `PROJECT_MAP.md` §13 como registro vivo de divergências.

### P5 — Issues e Defeitos do Estado Atual (Com Issues GitHub Abertas)
- [x] **[BUG]** Corrigir o climbing da câmera on recoil ([Issue #1](https://github.com/teusbraga/arenablockoutlimited/issues/1)) — `CameraRig.js` acumula `climbPitch` sem compensação/recoil recovery. (CONCLUÍDO na Fase 3)
- [x] **[BUG]** Corrigir bug de trocar armas depois que morrer ([Issue #2](https://github.com/teusbraga/arenablockoutlimited/issues/2)) — `WeaponSystem.js` sem checagem de `player.alive`. (CONCLUÍDO na Fase 3)
- [x] **[BUG]** Corrigir bug dos carregadores no chão ([Issue #3](https://github.com/teusbraga/arenablockoutlimited/issues/3)) — `MagazineDrop.js` com raycast limitado, falta de checagem Y em pickup e seleção instável. (CONCLUÍDO na Fase 3)
- [ ] **[BUG]** Corrigir a crosshair dinâmica ([Issue #4](https://github.com/teusbraga/arenablockoutlimited/issues/4)) — `BarrelCrosshairAlignment.js` projeta ponto com spray em vez do eixo mecânico puro. *(Protegido por GEMINI.md/AGENTS.md pitfall #11)*
- [ ] **[BUG]** Corrigir os dedos esquerdos de cada viewmodel ([Issue #5](https://github.com/teusbraga/arenablockoutlimited/issues/5)) — `ViewmodelArms.js` com distorção de rotação de juntas no IK.
- [x] **[BUG]** Corrigir falta de vibração em mobile ([Issue #6](https://github.com/teusbraga/arenablockoutlimited/issues/6)) — `CONFIG.ACCESSIBILITY.vibrationEnabled` existe mas `navigator.vibrate` nunca é invocado. (CONCLUÍDO na Fase 3)
- [x] **[DEFEITO]** Criar mecanismo para impedir jogador de trocar de arma depois de iniciar a partida ([Issue #7](https://github.com/teusbraga/arenablockoutlimited/issues/7)) — trava de loadout pós-spawn no `WeaponSystem`/`MenuController`. (CONCLUÍDO na Fase 5)
- [x] **[DEFEITO/SEGURANÇA]** Limitar acesso via atalho e cheats dentro da gameplay e colocar apenas em opções de dev no menu ([Issue #8](https://github.com/teusbraga/arenablockoutlimited/issues/8)) — restringir `whoami` e comandos de depuração. (CONCLUÍDO na Fase 5)

### P6 — Arsenal, Balística, Animações e Viewmodels
- [ ] Melhorar a fumaça do cano e usar ribbon 3D do protótipo importado *(⚠️ Atenção GEMINI.md: verificar congelamento de VFX de Effects.js e muzzle pipeline antes de integrar)*.
- [ ] Criar rotina própria de carregamento da M12 (pump-action recarregando cartucho por cartucho, com interrupção por disparo).
- [ ] Configuração personalizada de cada arma (acessórios, miras e mods individuais data-driven).
- [ ] Melhorar balística efetiva da gameplay (penetração realística, queda parabólica refinada e dissipação de energia).
- [ ] Melhorar animação dos modelos (transições mais fluidas de poses e ações mecânicas).
- [ ] Melhorar animação de morte dos bots e player (transição suave de ragdoll/colapso cinemático).
- [ ] Melhorar os modelos segurando arma em 3rd person (sockets de mão e empunhadura alinhados no `CharacterView`).
- [ ] Melhorar geometria dos modelos 3D com descontinuidade (ajuste de quinas, vértices e bevels procedurais).
- [ ] Criar viewmodel com visão dos pés (renderização de corpo inferior em 1ª pessoa ao olhar para baixo).
- [ ] Melhorar headbob e camera rig (suavização de oscilação ao andar/correr sem enjoo de movimento).
- [ ] Melhorar suavização de movimento dos modelos de soldado (`LocomotionSmoothingSystem` aplicado à interpolação de terceiros).
- [ ] Revisão de áudios adicionados (balanceamento de volumes nos buses e refinamento de transientes procedurais).

### P7 — Gameplay, Modos de Jogo, Campanha Solo & Roguelike
- [ ] Criar campanha solo com save e dinheiro em `localStorage`.
- [ ] Criar loja de equipamentos na campanha solo (compra/venda de armas, munições e utilitários).
- [ ] Criar sistema de salas rogue like (geração modular de setores com progressão e recompensas).
- [ ] Criar novos mapas death match (layouts competitivos com zonas de cobertura e rotas simétricas).
- [ ] Criar uso efetivo de inventário (gestão em tempo real de itens táticos, coletes, munição e consumíveis).
- [ ] Criar missões diárias e notificações (desafios periódicos com feedback na HUD via `hud:popup`).

### P8 — Menus, UI, Level Design e PWA Mobile
- [ ] Melhorar o layout do menu inicial (organização visual moderna, abas táticas e fluidez no loadout).
- [ ] Limitar mapas para jogadores comuns no menu e liberar todos apenas para devs (sistema de permissão/flag).
- [ ] Introduzir novas texturas criadas no showroom (`TextureGenerator.js` e materiais PBR ampliados).
- [ ] Melhorar árvores e props de plantas (`ItalyProps.js` com vegetação refinada e colisores precisos).
- [ ] Explorar opções de novas funcionalidades no PWA para mobile (instalação offline aprimorada, orientação de tela, fullscreen lock).

### P9 — Otimização Low-End, Infraestrutura, Backend Local & Tooling
- [ ] Criar estratégias de otimização agressiva para ambiente low-end (LOD adaptativo, limitação de draw calls e corte de resolução dinâmica).
- [ ] Planejar diminuição do tamanho do projeto no Vercel (limpeza de assets pesados e otimização de deploy estático).
- [ ] Planejar introdução de novas tecnologias com post-processing e Three Mesh BVH (`three-mesh-bvh` para aceleração espacial de raycasts).
- [ ] Criar API para back-end local para criar servidor particular de partidas online (servidor Node/WebSocket headless dedicado).
- [ ] Colocar skill de Playwright CLI (automação de testes e2e de interface e validação visual de browser).

---

## O que não fazer

- Não reescrever o projeto “do zero”.
- Não trocar a arquitetura data-driven.
- Não mover `CollisionWorld` para Three.js.
- Não tocar em tracers, `muzzleLocal`, `sightLocal`, `ejectLocal` ou `ammo.json` sem autorização (`GEMINI.md`).
- Não aumentar pools nem adicionar dependências sem benchmark/autorização.
- Não refatorar e corrigir bugs no mesmo commit.

---

## Critério de conclusão

- [ ] `npm test` cobre todos os testes relevantes e passa.
- [ ] Nenhum evento/campo morto conhecido permanece sem decisão.
- [ ] Documentação principal bate com o código.
- [ ] Nenhum arquivo de gameplay acima de ~800 linhas sem justificativa.
- [ ] Working tree limpo ou com WIP explicitamente isolado.
- [ ] `PROJECT_MAP.md` atualizado nas seções afetadas.
