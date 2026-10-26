# AGENTS.md — Regras operacionais do Arena Blockout: Limited

> **Leia isto antes de qualquer tarefa.** Este arquivo é o contrato de trabalho dos agentes neste repositório.
> O mapa técnico completo está em [`PROJECT_MAP.md`](./PROJECT_MAP.md). Consulte a seção relevante em vez de varrer a árvore inteira.
> **Objetivo:** esta é a última vez que um agente precisa escanear o projeto inteiro. Use o mapa; só faça busca ampla se ele estiver comprovadamente desatualizado.

---

## 1. Ordem de leitura obrigatória

1. Este `AGENTS.md` (regras).
2. `PROJECT_MAP.md` §0 (índice por tarefa) e a seção específica do subsistema.
3. `GEMINI.md` **se** a tarefa tocar armas, modelos, muzzle/sight/eject, tracers, `Effects.js` ou `ammo.json`.
4. `docs/MILESTONE_NORMALIZACAO_E_ROBUSTEZ.md` (Dicionário Canônico e Protocolo Anti-Débito).
5. Os arquivos indicados no mapa. Não abra o restante “por garantia”.

**Não faça:** `Get-ChildItem -Recurse` no projeto inteiro, ler todos os arquivos de `src/`, recompilar o mapa, ou reescrever `PROJECT_MAP.md` sem necessidade. O mapa existe para evitar isso.

**Faça:** confirme o estado atual com comandos baratos quando a tarefa for sensível a linhas:

```powershell
git status --short
git log --oneline -5
Get-ChildItem src -Recurse -File -Filter *.js | Measure-Object
```

Linhas citadas no mapa podem ter deslocado; **nomes de funções e contratos são mais estáveis que números de linha**.

---

## 2. Contexto do projeto (fatos que não podem ser ignorados)

- FPS browser em **Three.js puro**, **ES Modules**, **sem build step**.
- O navegador carrega `index.html` → `src/main.js`; é obrigatório servir por HTTP (`python -m http.server 8000`), nunca abrir via `file://`.
- **Three.js unificado:** navegador e testes usam `three@0.186.1` (importmap em `index.html` e `package.json`).
- **Loop real é 60 Hz** (`Engine.fixedDt = 1/60`), apesar de README/comentários citarem 120 Hz. Não “conserte” para 120 sem solicitação explícita; isso altera gunplay/IA/projéteis.
- **Working tree limpo e consolidado:** O Milestone 1 quitou dívidas acumuladas e consolidou recarga tática, MagazineDrop, QTE e HUD nos commits `2b5c99d`, `cd7b4a7`, `477dc8a` e `ef5e473`.
- **Reset do jogo = reload da página.** Não existe teardown global de cena; classes individuais têm `destroy()`.
- **Sem linter/formatter/typecheck.** O gate é `npm test` + testes extras + validação manual no navegador.

---

## 3. Regras não negociáveis

### 3.1 Separação de camadas e loop
- Física, input de gameplay, IA, armas e regras de partida → `fixedUpdate`.
- Câmera, viewmodel, HUD, efeitos, scope e áudio → `renderUpdate`.
- Respeite a ordem documentada em `PROJECT_MAP.md` §4.4. Não mova `CameraRig.update` para depois do viewmodel, nem `WeaponSystem._fire` para depois da mira.
- Não adicione `requestAnimationFrame` próprio sem necessidade; exceções existentes: `WeaponPreview3D` (vitrine) e `LoadingScreen`.

### 3.2 Dados são a fonte de balanceamento
- Dano, cadência, munição, recuo, spread, penetração, velocidades, FOV, bots e acessibilidade vivem em `assets/**/*.json`.
- Não hardcode números de gameplay se já existe chave. Se a chave não existe, adicione ao schema **e** ao loader **e** ao mapa.
- `initWeaponsFromData` deve rodar antes de qualquer leitura de `WEAPONS`; testes headless começam com `WEAPONS` vazio.
- JSONs são lidos no boot; mudanças em JSON não recarregam em runtime. O menu pode mutar `CONFIG` em runtime (sensibilidade, headbob, cheats), mas isso não persiste no JSON.

### 3.3 Colisão e espaço
- Colisão de gameplay é **somente** `CollisionWorld` (AABB + spatial hash). Nunca use meshes/`THREE.Raycaster` para colisão de mundo.
- `pos` de entidade = **pés** (bottom-center); `size` = extents totais.
- `staticGeometry` de mapa é **AABB sem rotação**; `pos.y` é a base; o loader centraliza em `y + size.y/2`.
- Player yaw 0 olha para **-Z**; bot yaw 0 move para **+Z**. Não unifique sem revisar `CharacterView` e `AIController`.
- Arma em 1ª pessoa: **-Z é o cano**, +Y topo, +X direita.

### 3.4 Armas, modelos e VFX (diretiva congelada)
`GEMINI.md` congela:
- `muzzleLocal`, `sightLocal`, `ejectLocal` e posições/rotações dos modelos;
- o sistema de tracers de `Effects.js` (origem no cano, frame-a-frame, zero curvature/strafe lag);
- perfis de tracer de `ammo.json` (`lengthMultiplier`, `beamLength`, `realSpeed`, `trackOrigin`, `flashProfile`);
- o pipeline `weapon:fired → spawn tracer → muzzle flash → smoke`.

**Não altere esses itens sem autorização explícita do usuário.** Se a tarefa exigir, cite `GEMINI.md` no resultado e peça confirmação.

Contratos de modelo:
- Builder retorna `THREE.Group` **ou** `{ group, physics?, opticBody?, rearLens?, frontLens? }`.
- Armas com luneta precisam de `rearLens`, `frontLens`, `opticBody` e entrada em `main.js` (`attachWeaponModel`).
- `Viewmodel.registerModel` aceita os dois formatos.
- Se o modelo tiver `physics`, o `Viewmodel` delega animação de recarga/ciclo a ele.

### 3.5 EventBus
- Nomes no padrão `dominio:acao` (`weapon:*`, `player:*`, `bot:*`, `round:*`, `inventory:*`, `input:*`).
- Emita **um objeto** como payload; nunca múltiplos argumentos.
- Todo `on` deve guardar o unsubscribe e desfazer em `destroy()`.
- `emit` engole exceções de listener; erros aparecem no console, não quebram o loop.
- `notification` **não tem listener** hoje. Para feedback visível use `hud:popup`. Se for implementar `notification`, faça o listener na HUD e teste.
- Não crie evento por frame; use estado/`update`.

### 3.6 Ciclo de vida e memória
- Todo sistema com listeners/recursos deve ter `destroy()`: unsubscribe, `dispose()` de geometria/material/textura, remover do DOM/event listeners.
- Pools e vetores pré-alocados são obrigatórios em caminhos quentes (`update`, `_fire`, `_spawn*`, `raycast` por frame).
- Não aloque `new THREE.Vector3/Matrix4/Color` por frame em `Effects`, `WeaponSystem`, `ProjectileManager`, `AIController`, `CameraRig`.
- Não adicione `clearBus` global; a ausência é intencional.

### 3.7 Performance
- `ProjectileManager`: pool de 256; CCD; não aumente sem benchmark.
- `Effects`: pools fixos; não crie meshes por tiro.
- `MaterialFactory`/`TextureGenerator`: lazy; não pré-gere todas as texturas no boot.
- Mapas grandes: `InstancedMesh` por material; não converta para meshes individuais.
- IA: LOS a ~10 Hz; A* com cache e limite de iterações; não rode A* por bot por frame.
- Não adicione dependências npm sem autorização; o projeto tem só `three`.

### 3.8 UI/DOM
- IDs novos devem existir em `index.html` e ser cacheados uma vez; não consulte `document` em loop.
- Respeite `body.in-gameplay`: elementos de combate somem em menu/pausa/inventário/morte/fim de rodada.
- Não duplique markup de HUD; use `HUD`/`CrosshairManager`.
- Controles reais estão em `Input.js:50-71`; `README.md` e `#controls` estão defasados (Q/E = lean; F = interagir; V removido; perspectiva = cheat `whoami`).
- `ESC` não fecha inventário; o texto do modal está errado. Não propague essa suposição.

### 3.9 Áudio
- Áudio é **100% procedural**; `assets/config/audio.json` está vazio e não é banco de sons.
- Use os buses existentes (`weaponsGain`, `foleyGain`, `footstepsGain`, `impactsGain`, `traumaGain`) e `createSpatialDestination` para fontes 3D.
- O `AudioContext` só nasce após gesto do usuário (`_ensure`); não force no boot.
- Bots emitem estritamente `bot:fired` para áudio espacial 3D e muzzle flash local (resolvido no commit `80fd818`). O evento `weapon:fired` é reservado com exclusividade ao jogador em primeira pessoa.

### 3.10 Git e escopo
- **Não faça commit, amend, push ou PR** sem pedido explícito.
- Não reverta mudanças não commitadas; elas contêm features em andamento.
- Não refatore “de passagem”. Faça a menor mudança que resolve a tarefa.
- Não edite `.kilo/agent-manager.json` nem arquivos de worktree alheios.
- Ignore `.kilo/worktrees/` e `node_modules/` em buscas; worktrees são cópias isoladas e podem estar desatualizadas.
- Não altere `GEMINI.md` sem autorização.
- Se precisar atualizar documentação, atualize a seção correspondente de `PROJECT_MAP.md` no mesmo trabalho.

### 3.11 Incremento obrigatório do CHANGELOG
- **Regra obrigatória:** Sempre que qualquer script JavaScript (`.js`) ou dado de configuração/balanceamento (`.json`) for modificado, adicionado ou refatorado, o agente **deve obrigatoriamente** incrementar e documentar a alteração no `CHANGELOG.md` no mesmo turno de trabalho.
- O registro deve seguir o formato padronizado do projeto (`feat:`, `fix:`, `perf:`, `refactor:`, `data:`, etc.), discriminando os arquivos afetados e o impacto na mecânica, render, física, IA, áudio ou dados.
- Nenhuma tarefa que envolva arquivos `.js` ou `.json` é dada como pronta (DoD) sem o devido registro no `CHANGELOG.md`.

---

## 4. Mapa de propriedade (quem manda em quê)

| Domínio | Dono técnico | Arquivos centrais | Não mexa sem ler |
|---|---|---|---|
| Boot/loop | `main.js` + `Engine.js` | `src/main.js`, `src/core/Engine.js` | `PROJECT_MAP.md` §3-4 |
| Config | `ConfigLoader.js` | `src/core/ConfigLoader.js`, `assets/config/*.json` | §10.6 |
| Input/pointer/touch | `Input.js` | `src/core/Input.js`, `TouchInput.js` | §11.4 |
| Movimento | `Player.js` + `CameraRig.js` | `src/entities/Player.js`, `src/core/CameraRig.js` | §5, §8.3-4 |
| Armas | `WeaponSystem.js` | `WeaponSystem`, `WeaponDefs`, `BallisticsCalculator` | `GEMINI.md` |
| Projéteis/dano | `ProjectileManager.js` | `ProjectileManager`, `ammo.json` | §8.5 |
| Viewmodel/poses | `Viewmodel.js` | `Viewmodel`, `ViewmodelArms`, `models/*` | §7.7, §14.1 |
| Scope | `ScopeSystem.js` | `ScopeSystem`, modelos com lentes | §8.8 |
| IA | `AIController.js` | `ai/**`, `Bot.js` | §7.3, §8.6 |
| Colisão | `CollisionWorld.js` | `physics/CollisionWorld.js` | §5 |
| Mapas/PBR | `MapLoader.js` | `MapLoader`, `MaterialFactory`, `TextureGenerator`, `ItalyProps` | §10.4-5 |
| Personagem | `CharacterView.js` | `view/**` | §7.6 |
| HUD | `HUD.js` | `HUD`, `index.html` | §11 |
| Menus/config UI | `MenuController.js` | `MenuController`, `WeaponPreview3D` | §11 |
| Mira | `CrosshairManager.js` | `CrosshairManager`, `BarrelCrosshairAlignment` | §7.10, §13.13 |
| Aim assist | `AimAssistSystem.js` | `new_mechanics/AimAssistSystem.js` | §7.11 |
| Inventário | `TacticalInventorySystem.js` | `new_mechanics/TacticalInventorySystem.js`, `HUD` | §8.10 |
| Áudio | `AudioSystem.js` | `audio/**` | §7.9 |
| VFX | `Effects.js` | `fx/Effects.js`, `weapons/sfx/*` | `GEMINI.md` |
| Testes | `package.json` | `test/**` | §12 |

---

## 5. Contratos de dados que você não pode quebrar

### 5.1 Arma (`weapons.json`)
Obrigatórios para não quebrar pose/tiro:
`id`, `name`, `ammo`, `fireInterval`, `magSize`, `reloadTime`, `fireModes`,
`hipPos`, `hipRot`, `adsRot`, `adsSightDistance`,
`sprintPos`, `sprintRot`, `sightLocal`, `muzzleLocal`, `ejectLocal`,
`adsFov`, `spreadHip`, `spreadAds`, `ballistics`.

- `adsPos` **não** existe no JSON: é derivado de `sightLocal` + `adsSightDistance` por `Viewmodel._adsPos`.

- `id` é a chave de `WEAPONS` e o nome do builder/modelo/áudio.
- `mods` aplicam multiplicadores em `compileWeapons`.
- **`type`, `model`, `audioKey`, `smokeResidual*` não são consumidos.** Não dependa deles.
- O builder 3D e o socket de mãos são registrados por **id**, não por `model`.

### 5.2 Munição (`ammo.json`)
Obrigatórios: `bulletSpeed`, `bulletDrop`, `penetrationPower`, `maxPenetrations`, `ricochetChance`, `tracerColor`, `tracerProfile`.
`tracerProfile` alimenta `Effects`; `flashProfile.maskElasticOffset` é o único campo de flash usado dali (o flash visual vem de `sfx.flash`).

### 5.3 Mapa
Essenciais: `size` e `playerSpawns` (o jogo usa `playerSpawns[0]`); `botSpawns` para spawnar bots.
`staticGeometry` e `floorMaterial` têm defaults; `bounds` é derivado de `size` se omitido.
- `staticGeometry` = AABB; `pos` = base; sem rotação.
- Props: apenas tipos do switch de `MapLoader`; tipos novos exigem `ItalyProps` + case.
- PBR: todo material precisa existir em `MaterialFactory`; senão cai em `wall` silenciosamente.
- `ambientLight`/`directionalLight` são ignorados pelo loader.

### 5.4 Config
- `CONFIG` é mutável e compartilhado; menu altera em runtime.
- `CONFIG.PHYSICS` não é consumido.
- Várias chaves de `SWAY`, `PLAYER.crouchMul/adsMul`, `BOTS.fov/damage*` não são usadas. Não assuma que existem só porque estão no JSON.

---

## 6. Playbooks (caminho mínimo)

### 6.1 Nova arma
1. `assets/weapons/weapons.json` (copie `ar15` e ajuste).
2. `assets/weapons/ammo.json` (reutilize ou crie perfil).
3. `assets/weapons/sfx/<id>_sfx.json` + adicionar id em `ConfigLoader.js` (`sfxIds`).
4. `src/weapons/models/<Nome>.js` (Group ou `{group, physics}`).
5. `src/weapons/Viewmodel.js` (import/reexport) + `src/main.js` (`registerModel` + `ItemDrop.setBuilders`).
6. `src/weapons/ViewmodelArms.js` (socket) ou aceite o default.
7. `index.html` (opção no select).
8. Luneta? retorne lentes e registre em `main.js`.
9. Valide: `npm test`, `node test/tracer_flash_profile_test.js`, navegador.

### 6.2 Novo mapa
1. JSON conforme §5.3.
2. Materiais: `MaterialFactory` + `TextureGenerator` + `PROP_MATERIAL_DEPS` se necessário.
3. Props novos: `ItalyProps` + switch.
4. Spawns e bounds coerentes; distância mínima player↔bots >11 m.
5. `index.html` (`#map-select`).
6. Valide schema + navegador; se possível amplie `italy_map_test`.

### 6.3 Novo evento
1. Nome `dominio:acao`, payload objeto.
2. Emissor no sistema de origem; listener no consumidor.
3. Guarde unsubscribe e desfaça em `destroy`.
4. Atualize `PROJECT_MAP.md` §9.
5. Teste headless se o consumidor for testável sem DOM.

### 6.4 Novo controle/menu
1. `index.html` (ID + aba).
2. `MenuController` (cache + listener + persistência).
3. Estado em `CONFIG`/`CrosshairManager`/`AudioSystem`.
4. Leitura no sistema de gameplay, não no menu.
5. Restauração no boot.
6. Teste com mock DOM quando possível.

### 6.5 Ajuste de gunplay
- Dano/penetração/velocidade → `weapons.json.ballistics.terminal` + `ammo.json`.
- Cadência/mag/reload → `weapons.json`.
- Spread/recuo/sway → `weapons.json.ballistics.external` + `BallisticsCalculator`.
- Não toque em tracers/modelos (congelado).

### 6.6 IA
- FSM em `src/ai/states/`; transições em `AIController`.
- Pathfinding sempre via `NavGrid`; não mova bots por linha reta ignorando colisão.
- LOS custa caro: mantenha throttle e early-exit.
- Não use `CONFIG.BOTS.fov` até implementá-lo de fato.

---

## 7. Verificação obrigatória

### 7.1 Comandos
```bash
npm test
node test/alignment_test.js
node test/bot_gps_pathfinding_test.js
node test/locomotion_smoothing_test.js
node --test test/muzzle_flash_smoke_test.js test/soldier_skin_test.js test/surface_eyedropper_test.js test/tracer_test.js test/weapon_sfx_data_driven_test.js
```

- `npm test` cobre 15 scripts e é o gate principal.
- Os 8 testes acima **não** estão no `npm test`; rode-os se tocar em mira, GPS, locomoção, fumaça, skin, eyedropper, tracer ou SFX.
- `python tools/test_suite.py` **falha hoje** porque `audio.json` não tem 10 sons (áudio é procedural). Não use como gate; não “conserte” o JSON só para agradar o script sem alinhar com o usuário.

### 7.2 Manual (obrigatório para mudanças visuais/UI/áudio/render)
1. Sirva por HTTP (`python -m http.server 8000`).
2. Abra no navegador, capture pointer lock, jogue 30 s.
3. Verifique console (sem erros), HUD, mira, recarga, troca de arma, menu, inventário, tela de morte.
4. Teste mobile/DevTools touch se tocar em `TouchInput`/CSS.
5. Para scope, teste `rifle_proto`, `vss`, `scar_h`.
6. Para mapas, teste spawn, colisão, props e PBR.

### 7.3 Performance
- Se tocar em loop/partículas/IA, observe FPS e console.
- Não introduza alocação por frame; reutilize vetores/pools.
- Não aumente pools sem benchmark.

---

## 8. Armadilhas conhecidas (leia antes de “corrigir”)

| # | Fato | Evidência |
|---|---|---|
| 1 | Loop é 60 Hz, não 120 | `Engine.js:6`, `main.js:219` |
| 2 | Navegador/testes usam Three diferente [RESOLVIDO] | Unificado em `three@0.186.1` no `index.html` e `package.json` |
| 3 | `notification` não tem listener | `PROJECT_MAP.md` §9.2 |
| 4 | Tiro de bot [RESOLVIDO] | Emite estritamente `bot:fired`; `weapon:fired` foi removido no commit `80fd818` |
| 5 | Medkit emite `player:heal` sem listener | `TacticalInventorySystem.js:175` |
| 6 | Inventário pode iniciar com gear nulo | `main.js` cria inventory depois de `weapon:slots` |
| 7 | Recarga tática não consome reserva | `WeaponSystem.js:395-412` |
| 8 | `ESC` não fecha inventário | `Input.js` sem Escape |
| 9 | `def.type` não existe nos JSONs [RESOLVIDO] | Normalizado em `weapons.json` e `WeaponRegistry.js` |
| 10 | Materiais de Lisbon caem em `wall` | `caution_yellow`, `steel_girder` ausentes |
| 11 | `dynamicAlignment` usa ponto com spray, não “puro” | `BarrelCrosshairAlignment.js:154-155` |
| 12 | Fumaça não bloqueia tiro/IA/LOS | Granada é visual |
| 13 | Bots veem 360° (FOV ignorado) [RESOLVIDO] | `AIController._hasLOS` agora valida cone angular de visão (110°) |
| 14 | `player:perspective_changed` não tem listener | §9.2 |
| 15 | Documentação histórica diverge do código | README/walkthrough/HUD.md |
| 16 | `tools/test_suite.py` falha | `audio.json` vazio |
| 17 | Trabalho não commitado no working tree [RESOLVIDO] | Limpo e consolidado no Milestone 1 |

**Regra:** se a tarefa for “corrigir” um destes itens, confirme com o usuário e registre o impacto. Vários são intencionais ou estão em área congelada.

---

## 9. Definição de pronto (DoD)

- [ ] Li a seção do mapa e os arquivos indicados; não varri o projeto inteiro.
- [ ] A mudança é a menor possível e não refatora áreas vizinhas.
- [ ] `fixedUpdate`/`renderUpdate` respeitados.
- [ ] Protocolo Anti-Débito seguido ([`docs/MILESTONE_NORMALIZACAO_E_ROBUSTEZ.md`](./docs/MILESTONE_NORMALIZACAO_E_ROBUSTEZ.md)).
- [ ] Nenhum listener novo sem unsubscribe; eventos usam payload objeto `{ ... }` e constam em `CANONICAL_EVENTS`.
- [ ] Nenhuma alocação nova em caminho quente.
- [ ] Dados de balanceamento em JSON (ou justificativa).
- [ ] Novas armas registradas exclusivamente via `src/weapons/WeaponRegistry.js`.
- [ ] Contratos de arma/mapa/evento preservados.
- [ ] `GEMINI.md` respeitado.
- [ ] `npm test` verde (82/82 testes); testes extras relevantes verdes.
- [ ] Teste manual no navegador (se visual/UI/áudio/render).
- [ ] `PROJECT_MAP.md` atualizado se arquitetura/schema/evento mudou.
- [ ] `CHANGELOG.md` incrementado e atualizado obrigatoriamente se scripts `.js` ou dados `.json` foram alterados.
- [ ] Nenhum commit/push sem pedido explícito.
- [ ] Resultado final informa: o que mudou, arquivos, validações e riscos.

---

## 10. Manutenção do mapa e das regras

- Mudou a arquitetura? Atualize `PROJECT_MAP.md` (seções §2, §6, §7).
- Mudou schema? Atualize §10.
- Mudou evento? Atualize §9.
- Descobriu divergência? Registre em §13 com `arquivo:linha`.
- Mudou o fluxo de trabalho dos agentes? Atualize este `AGENTS.md`.
- **Alterou scripts `.js` ou dados `.json`?** Incremente e registre obrigatoriamente a alteração no `CHANGELOG.md`.
- **Não reescreva o mapa inteiro** para uma mudança local; edite a seção afetada.

---

## 11. Comportamento esperado do agente

- Seja direto e técnico; não faça perguntas desnecessárias.
- Se a tarefa for ambígua, escolha a interpretação mais conservadora e declare a suposição.
- Não invente arquivos, APIs, eventos ou campos de JSON; confirme no código/mapa.
- Não adicione logs permanentes, debug visual ou cheats novos sem pedido.
- Não altere o estilo global, nomes públicos ou estrutura de pastas sem pedido.
- Se encontrar um bloqueio real, pare e explique com evidência; não contorne silenciosamente.
- Ao concluir, entregue um resumo curto: arquivos alterados, validações executadas, pendências e confirme a atualização do `CHANGELOG.md`.
