# 📋 Issues Abertas no GitHub (Estado Atual / Commit c175475)

> Este arquivo reúne as especificações técnicas e links diretos das **8 issues abertas com sucesso no repositório GitHub** [`teusbraga/arenablockoutlimited`](https://github.com/teusbraga/arenablockoutlimited/issues).

---

## 📌 Resumo das Issues Abertas

| # | Link no GitHub | Título | Subsistema | Severidade | Labels |
|---|---|---|---|---|---|
| 1 | [#1](https://github.com/teusbraga/arenablockoutlimited/issues/1) | `fix(camera): corrigir climbing acumulativo no recuo da câmera e implementar recoil recovery` | Câmera / Gunplay | Alta | `bug` |
| 2 | [#2](https://github.com/teusbraga/arenablockoutlimited/issues/2) | `fix(weapons): bloquear troca de arma e seleção de slots quando o jogador estiver morto` | Armas / Integridade | Alta | `bug` |
| 3 | [#3](https://github.com/teusbraga/arenablockoutlimited/issues/3) | `fix(physics): corrigir colisão vertical de MagazineDrop e cálculo 3D de proximidade na coleta` | Física / World / Interação | Média | `bug` |
| 4 | [#4](https://github.com/teusbraga/arenablockoutlimited/issues/4) | `fix(crosshair): alinhar retícula dinâmica com o eixo mecânico puro do cano sem incorporar spray` | HUD / Mira | Média | `bug` |
| 5 | [#5](https://github.com/teusbraga/arenablockoutlimited/issues/5) | `fix(viewmodel): corrigir eixos de rotação ortonormal do IK da mão esquerda em armas de duas mãos` | Viewmodel / 3D / IK | Média | `bug` |
| 6 | [#6](https://github.com/teusbraga/arenablockoutlimited/issues/6) | `fix(mobile): implementar integração com navigator.vibrate para disparo, recarga e dano` | Mobile / Acessibilidade | Média | `bug`, `accessibility` |
| 7 | [#7](https://github.com/teusbraga/arenablockoutlimited/issues/7) | `feat(gameplay): bloquear alteração de armas no menu durante a partida em andamento` | UI / Regras de Partida | Média | `enhancement` |
| 8 | [#8](https://github.com/teusbraga/arenablockoutlimited/issues/8) | `refactor(core): isolar atalhos de depuração e cheats na aba de Desenvolvedor do Menu` | Core / Menu / Dev | Média | `enhancement` |
| 9 | [#9](https://github.com/teusbraga/arenablockoutlimited/issues/9) | `fix(physics): corrigir perda de colisão (clipping) e afundamento em globalBoxes e degraus` | Física / Colisão / Spatial Hash | Crítica | `bug`, `physics` |
| 10 | [#10](https://github.com/teusbraga/arenablockoutlimited/issues/10) | `fix(crosshair): amortecer dynamic gap e eliminar estroboscópio de ~35ms no repouso` | HUD / Mira | Baixa | `bug`, `ui` |
| 11 | [#11](https://github.com/teusbraga/arenablockoutlimited/issues/11) | `refactor(world): renomear e desacoplar ItalyProps para PropFactory global do ecossistema de mapas` | World / Arquitetura / Props | Média | `refactor`, `tech-debt` |

---

### Issue 1: [BUG] Climbing acumulativo de recuo na câmera sem retorno (Recoil Recovery)

**Título:**
`fix(camera): corrigir climbing acumulativo no recuo da câmera e implementar recoil recovery`

**Labels:** `bug`, `camera`, `gunplay`, `needs-test`

#### Descrição
Durante rajadas contínuas de disparo com armas automáticas (ex: M249, AK-47, HK416), a câmera sobe sem parar (*pitch climbing*) até atingir o limite vertical máximo (`pitchLimit`), sem qualquer retorno elástico ou amortecido ao ponto de origem pré-disparo quando o jogador interrompe o tiro.

#### Causa Raiz
No arquivo [`src/core/CameraRig.js`](../src/core/CameraRig.js#L124-L128), o método `addRecoilImpulse` injeta `this.targetPitch += climbPitch` diretamente no pitch de orientação. Como não existe um acumulador de compensação temporal (*recoil recovery*) no loop `update()`, a subida torna-se irreversível sem que o jogador arraste o mouse manualmente para baixo.

#### Comportamento Esperado
- O disparo deve elevar a mira;
- Ao cessar o fogo, uma fração calibrada do recuo vertical (*recoil recovery rate*) deve amortecer e puxar a mira suavemente de volta para a posição original, respeitando correções ativas manuais do jogador.

#### Passos para Reproduzir
1. Iniciar qualquer mapa com arma automática (ex: M249 SAW ou AK-47).
2. Manter pressionado o botão de disparo por 2 a 3 segundos sem mover o mouse.
3. Observar que a mira sobe até o teto e fica travada no limite superior sem retornar.

#### Proposta de Correção
1. Separar o pitch manual do mouse de um acumulador `recoilClimbCurrent`.
2. No método `update(dt)` do `CameraRig`, aplicar decaimento suave `smoothDamp` ou `lerp` no `recoilClimbCurrent` quando `isFiring` for falso.
3. Garantir que movimentos intencionais de mouse para baixo cancelem o retorno proporcionalmente para não causar *over-correction*.

---

### Issue 2: [BUG] Troca de armas permitida após a morte do jogador

**Título:**
`fix(weapons): bloquear troca de arma e seleção de slots quando o jogador estiver morto`

**Labels:** `bug`, `weapons`, `gameplay`

#### Descrição
Quando o jogador tem sua vida zerada e entra na tela de morte com a contagem de respawn ativa, ainda é possível pressionar as teclas `1`, `2`, `Q` ou girar a roda do mouse para trocar de arma. Isso ativa áudios mecânicos de saque, atualiza a pose do viewmodel no chão e gera descompasso na cena.

#### Causa Raiz
No arquivo [`src/weapons/WeaponSystem.js`](../src/weapons/WeaponSystem.js#L192-L220), os métodos `selectSlot(idx)` e `setSlot()` não verificam `this.player.alive`. Da mesma forma, o listener do barramento `weapon:select_slot` opera sem checagem de estado de vida do operador.

#### Comportamento Esperado
- Ao morrer (`player:died`), todos os comandos e atalhos de seleção de slot ou troca de armas devem ser estritamente ignorados até o respawn completo do jogador.

#### Passos para Reproduzir
1. Entrar em uma partida e ser abatido por um bot.
2. Durante a contagem regressiva da tela de morte ("Você foi abatido"), pressionar teclas `1` ou `2`.
3. Os sons de saque tocam e a arma do jogador troca no modelo 3D.

#### Proposta de Correção
Adicionar cláusula de guarda inicial em `selectSlot()`, `setSlot()`, `pickupWeapon()` e `cycleWeapon()`:
```javascript
if (!this.player || !this.player.alive) return;
```

---

### Issue 3: [BUG] Carregadores descartados atravessam superfícies, flutuam e falham em coletas agrupadas

**Título:**
`fix(physics): corrigir colisão vertical de MagazineDrop e cálculo 3D de proximidade na coleta`

**Labels:** `bug`, `physics`, `inventory`, `weapons`

#### Descrição
Carregadores ejetados durante a recarga rápida (`reload_speed`) podem cair através do chão em rampas/degraus ou ficar flutuando. Além disso, o jogador consegue coletar carregadores posicionados em andares diferentes (acima ou abaixo), e quando há múltiplos carregadores no chão, o prompt de interação oscila ou seleciona o item errado.

#### Causa Raiz
1. Em [`src/weapons/MagazineDrop.js`](../src/weapons/MagazineDrop.js#L100-L107), o raycast de detecção de solo possui alcance fixo de apenas 1.5 metros a partir da posição instantânea do magazine.
2. Em `checkPickup(character)`, a verificação de distância é feita puramente em 2D horizontal: `Math.hypot(px - this.pos.x, pz - this.pos.z) < 1.4`, ignorando a coordenada vertical Y.
3. Em [`src/core/GameManager.js`](../src/core/GameManager.js#L449-L459), o laço guarda `nearMag = mag` do último elemento avaliado que satisfaça a condição, em vez do item com menor distância euclidiana real.

#### Comportamento Esperado
- O carregador deve assentar solidamente sobre qualquer geometria estática;
- A coleta só deve ser autorizada se a diferença de altura $\Delta Y$ for inferior a 1.2m;
- A interação deve selecionar deterministicamente o carregador mais próximo do jogador.

---

### Issue 4: [BUG] Crosshair Dinâmica desalinhada e projetando ponto balístico com spray

**Título:**
`fix(crosshair): alinhar retícula dinâmica com o eixo mecânico puro do cano sem incorporar spray`

**Labels:** `bug`, `ui`, `crosshair`, `ballistics`

#### Descrição
Quando a opção "Mira Dinâmica" (`dynamicAlignment`) está ligada, a retícula na tela sofre solavancos bruscos e desalinha durante o disparo contínuo, tornando o controle visual caótico.

#### Causa Raiz
Conforme documentado no `PROJECT_MAP.md` §13.13 e em [`src/new_mechanics/BarrelCrosshairAlignment.js`](../src/new_mechanics/BarrelCrosshairAlignment.js#L154-L155), o algoritmo projeta na tela `this.aimPointWorld`, o qual já recebeu o offset angular da dispersão balística (*spread/spray*), em vez de projetar o ponto mecânico puro do cano (`this.pureAimPointWorld`).

#### Comportamento Esperado
- A retícula dinâmica deve acompanhar suavemente a inclinação física do cano (sway, inércia de movimento e recuo do corpo da arma), enquanto a dispersão de tiro deve apenas abrir a abertura (gap) das barras da retícula no `CrosshairManager`.

---

### Issue 5: [BUG] Dedos da mão esquerda deformados nos Viewmodels em primeira pessoa

**Título:**
`fix(viewmodel): corrigir eixos de rotação ortonormal do IK da mão esquerda em armas de duas mãos`

**Labels:** `bug`, `visual`, `viewmodel`, `animation`

#### Descrição
Ao empunhar armas primárias com guarda-mão (HK416, AK-47, M249, Winchester M12), as falanges e juntas da mão esquerda aparentam torção e posicionamento anti-anatômico, atravessando o cano ou apontando para direções incorretas.

#### Causa Raiz
No arquivo [`src/weapons/ViewmodelArms.js`](../src/weapons/ViewmodelArms.js#L183-L191), a base vetorial do solver IK da mão esquerda (`_solveArmIK`) assume inversão direta dos eixos locais, que entram em conflito com as orientações dos ossos criados em `TacticalManContinuous.js`.

#### Comportamento Esperado
- A mão esquerda deve envolver organicamente o guarda-mão ou calha, com o polegar acima e os demais quatro dedos tangentes à face inferior/lateral da arma.

---

### Issue 6: [BUG] Falta de vibração tátil (Haptic Feedback) em dispositivos móveis

**Título:**
`fix(mobile): implementar integração com navigator.vibrate para disparo, recarga e dano`

**Labels:** `bug`, `mobile`, `accessibility`, `input`

#### Descrição
No menu de acessibilidade do jogo há um controle para ativar/desativar "Vibração", e o arquivo `gameplay.json` contém `"vibrationEnabled": true`. No entanto, em dispositivos móveis (Android/Chrome PWA), nenhuma vibração física ocorre em nenhuma circunstância.

#### Causa Raiz
A propriedade `CONFIG.ACCESSIBILITY.vibrationEnabled` é apenas armazenada no estado; a API nativa de haptics do navegador (`navigator.vibrate`) não é invocada em nenhum arquivo do projeto.

#### Comportamento Esperado
- Ao disparar armas no mobile: pulso ultra-curto (10-15ms);
- Ao tomar tiro/dano de bots: pulso médio com padrão tático (60ms);
- Ao concluir recarga ou QTE: pulso duplo suave (20ms, pausa 30ms, 20ms).
- Respeitar estritamente a preferência do usuário configurada no menu.

---

### Issue 7: [DEFEITO] Ausência de trava de loadout com partida em andamento

**Título:**
`feat(gameplay): bloquear alteração de armas no menu durante a partida em andamento`

**Labels:** `enhancement`, `ui`, `gameplay`, `loadout`

#### Descrição
Em qualquer momento da partida, o jogador pode pausar ou abrir o menu e alterar os seletores de arma primária e secundária, o que invoca `WeaponSystem.setSlot()` e equipa instantaneamente uma arma nova com carregadores cheios, contornando a economia de munição e os drops do cenário.

#### Causa Raiz
`MenuController.js` escuta os seletores de arma e chama `weapons.setSlot()` diretamente, sem consultar se a partida já foi iniciada ou se o jogador está em combate.

#### Comportamento Esperado
- A escolha livre de armamento deve ocorrer apenas no lobby pré-partida;
- Uma vez que o round comece, os seletores no menu devem ser desabilitados/bloqueados com um aviso ("Armamento travado durante a partida. Colete armas no chão com [F]").

---

### Issue 8: [SEGURANÇA] Cheats e atalhos de depuração acessíveis durante gameplay comum

**Título:**
`refactor(core): isolar atalhos de depuração e cheats na aba de Desenvolvedor do Menu`

**Labels:** `security`, `input`, `ui`, `dev`

#### Descrição
Atualmente, qualquer usuário jogando uma partida pública comum pode ativar a perspectiva de 3ª pessoa e funções de depuração digitando sequências de teclas como `whoami`.

#### Causa Raiz
Os atalhos de cheat estão ouvindo diretamente eventos globais do teclado em `Input.js` e `main.js` sem checar se o ambiente é desenvolvimento (`DEV_MODE`).

#### Comportamento Esperado
- Partidas comuns devem ter atalhos de cheat desativados;
- Comandos de inspeção e depuração devem residir exclusivamente dentro de uma aba dedicada de "Desenvolvedor" no `MenuController`, ativável apenas por flag explícita.

---

### Issue 9: [BUG] Perda de colisão vertical (clipping) e afundamento em globalBoxes e degraus

**Título:**
`fix(physics): corrigir perda de colisão (clipping) e afundamento em globalBoxes e degraus`

**Labels:** `bug`, `physics`, `collision`, `critical`

#### Descrição
Ao andar ou tomar o segundo passo em qualquer mapa, o jogador e os bots atravessam a superfície do chão e caem no vazio infinito. Ao mesmo tempo, em degraus e blocos baixos, a movimentação perde a ancoragem de solo e afunda nas caixas estáticas.

Além disso, o console do navegador registra o aviso de renderização:
`THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`

#### Causa Raiz
1. **Early Return em `CollisionWorld.getNearbyBoxes` (`src/physics/CollisionWorld.js:100-103`):**
   A otimização de spatial hash introduziu `globalBoxes` para caixas com mais de 64 células (ex: o chão plano do mapa). Contudo, em consultas que cabem dentro de uma única célula de 4 metros (`minCx === maxCx && minCz === maxCz`), a função executa um `return cell ? Array.from(cell) : [];` prematuro antes de iterar e anexar `this.globalBoxes`. Como resultado, quase todo passo normal do jogador dentro de uma célula local não recebe o chão no array de caixas relevantes de `moveAndSlide`, fazendo a gravidade derrubar o personagem através do solo.
2. **Cálculo analítico de altura em `_tryStepUp` (`src/physics/CollisionWorld.js:220-246`):**
   A rotina analítica não realizava o teste de intersecção tridimensional completo com as caixas vizinhas, selecionando caixas inferiores ou o próprio chão e alterando `pos.y` para coordenadas inadequadas.
3. **Depreciação de ShadowMap no Three.js 0.186 (`src/core/SceneSetup.js:21`):**
   `THREE.PCFSoftShadowMap` foi removido na versão 0.186 do Three.js em favor de `THREE.PCFShadowMap`.

#### Passos para Reproduzir
1. Iniciar qualquer mapa (ex: `cargo` ou `vice`) e dar 2 passos para frente.
2. Observar que a colisão de solo deixa de ser avaliada e o personagem afunda no vazio.
3. Abrir o DevTools (F12) e observar o aviso de remoção do `PCFSoftShadowMap`.

#### Comportamento Esperado
- O jogador e os bots devem caminhar de forma contínua e estável sobre o chão sem qualquer afundamento ou travamento de gravidade;
- As caixas massivas em `globalBoxes` devem ser retornadas em todas as chamadas de `getNearbyBoxes()`, mesmo nas consultas de célula única;
- O mapa de sombras deve utilizar `THREE.PCFShadowMap` sem disparar warnings no console.

#### Proposta de Correção
1. Em `CollisionWorld.js:100-103`, unificar a adição de `globalBoxes` antes de retornar o resultado:
```javascript
let candidatesList = [];
if (minCx === maxCx && minCz === maxCz) {
  const cell = this.grid.get(this._hash(minCx, minCz));
  if (cell) candidatesList = Array.from(cell);
} else {
  const candidates = new Set();
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const cell = this.grid.get(this._hash(cx, cz));
      if (cell) {
        for (const box of cell) candidates.add(box);
      }
    }
  }
  candidatesList = Array.from(candidates);
}

if (this.globalBoxes && this.globalBoxes.length > 0) {
  for (let i = 0; i < this.globalBoxes.length; i++) {
    const gb = this.globalBoxes[i];
    if (maxX >= gb.min.x && minX <= gb.max.x && maxZ >= gb.min.z && minZ <= gb.max.z) {
      candidatesList.push(gb);
    }
  }
}
return candidatesList;
```
2. Restaurar a rotina comprovada de descida em `_tryStepUp` com teste rigoroso de `this.overlaps(pos, size, b)`.
3. Em `src/core/SceneSetup.js:21`, substituir `THREE.PCFSoftShadowMap` por `THREE.PCFShadowMap`.

---

### Issue 11: [TECH-DEBT] Renomear e modularizar ItalyProps para PropFactory global do ecossistema de mapas

**Título:**
`refactor(world): renomear e desacoplar ItalyProps para PropFactory global do ecossistema de mapas`

**Labels:** `refactor`, `world`, `architecture`, `tech-debt`, `good-first-issue`

#### Descrição
O arquivo [`src/world/ItalyProps.js`](../src/world/ItalyProps.js) nasceu originalmente para construir e instanciar elementos cenográficos específicos do mapa **CS Italy** (janelas venezianas, peitoris de pedra, arcos rústicos, sacadas e toldos).

Entretanto, conforme o ecossistema do jogo expandiu com novos mapas temáticos, **todos os novos props procedurais foram sendo empilhados dentro do mesmo arquivo `ItalyProps.js`**:
* **Vila Ensolarada:** `addVillageTree`, `addRusticFence`, `addVillageWell`, `addChimney`, `addHayBale`.
* **Dust Mirage:** `addPalmTree`, `addArabicArch`, `addArabicRugWall`, `addMilitaryCrate`, `addOilBarrel`, `addDesertTarp`, `addWaterTank`.
* **Woods (Selva Tropical):** `addGiantJungleTree`, `addFallenLog`, `addFernCluster`, `addBambooGrove`, `addSandbagBunker`, `addJungleWatchtower`, `addAncientRuins`, `addMilitaryCamoTent`, `addMossyBoulder`.
* **Range (Campo de Tiro):** `addPaperTarget`, `addPlinkerTarget` (com simulação física pendular), `addShootingBench`, `addDistanceSign`.

Atualmente, `ItalyProps.js` ultrapassa **1.700 linhas de código e 35 métodos heterogêneos**, atuando como a **Fábrica Global de Props 3D do Jogo**, mas carregando um nome de mapa específico.

#### Impacto na Manutenção e Débito Técnico
1. **Confusão de Domínio e Falsa Sinalização:** Desenvolvedores e agentes de IA que precisam adicionar props a mapas como `woods`, `dust` ou `range` hesitam ao abrir um arquivo chamado `ItalyProps`, questionando se existe outra fábrica de props ou se devem criar novos arquivos paralelos.
2. **Arquivo-Deus (God Class):** O arquivo acumula arquitetura toscana, vegetação tropical, caixas militares modernas e física/áudio interativo de alvos de tiro sem divisão de responsabilidade.
3. **Acoplamento no `MapLoader.js`:** O [`src/world/MapLoader.js`](../src/world/MapLoader.js) instancia explicitamente `new ItalyProps(scene, world)` para mapas que nada têm a ver com a temática da Itália.

#### Comportamento Esperado
- A fábrica central de props deve ter nome agnóstico a mapas específicos (ex: `PropFactory.js` ou `WorldProps.js`);
- Os métodos de construção de props devem ser organizados por domínio temático;
- O `MapLoader` e o `PROJECT_MAP.md` devem referenciar uma nomenclatura canônica clara;
- Deve ser mantido um alias ou re-export retrocompatível (`export { PropFactory as ItalyProps }`) para evitar quebra de integrações em andamento.

#### Plano de Refatoração Proposto
1. **Criação do diretório modular `src/world/props/`:**
   * `ArchitecturalProps.js`: portas, janelas, arcos de pedra, sacadas, chaminés, toldos e vitrines.
   * `NatureProps.js`: árvores (vila e selva), palmeiras, troncos caídos, samambaias, bambuzais e rochas/monólitos.
   * `MilitaryProps.js`: caixotes militares, barris de óleo, bunkers de sacos de areia, tanques d'água, tendas e torres de vigia.
   * `RangeProps.js`: alvos de papel (`addPaperTarget`), alvos pendulares de plinker (`addPlinkerTarget`), bancadas de tiro e sinalização métrica.
2. **Criação de `src/world/PropFactory.js`:**
   * Atua como fachada unificada (*Facade Pattern*) instanciando e expondo as categorias de props acima, recebendo `(scene, world)`.
3. **Retrocompatibilidade Temporária:**
   * `src/world/ItalyProps.js` passa a ser um arquivo de re-export deprecado apontando para `PropFactory`.
4. **Atualização das Chamadas:**
   * Atualizar `src/world/MapLoader.js` para importar e instanciar `PropFactory`.
   * Atualizar referências e tabelas do `PROJECT_MAP.md` (§7.5 e §4).
5. **Validação de Testes:**
   * Garantir que `npm test` e todas as suítes de mapas permaneçam 100% verdes.
