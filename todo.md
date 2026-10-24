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
- Eventos sem listener: `notification`, `player:heal`, `bot:damaged`, `player:perspective_changed`, `shot:tracer`, `weapon:cycle_action` e outros (`PROJECT_MAP.md` §9.2).
- `notification` é o mais grave: mensagens de “sem carregador”, “slot vazio” e “modo de disparo” nunca aparecem.
- `def.type` é testado em `WeaponSystem`, `ItemDrop`, `WeaponPreview3D` e `MagazineDrop`, mas não existe em `weapons.json`.
- Campos não consumidos: `model`, `audioKey`, `smokeResidualMax/Color`, boa parte de `CONFIG.SWAY`, `PLAYER.crouchMul/adsMul`, `BOTS.fov/damage*`, `PHYSICS.fixedDt`.

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
- [ ] Unificar a versão de Three.js entre navegador e testes.
- [ ] Adicionar lint/format/typecheck mínimos (sem build step).

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
