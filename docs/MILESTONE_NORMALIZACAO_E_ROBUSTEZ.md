# 🏆 Milestone 1 — Normalização Canônica, Robustez e Quitação de Dívida Técnica

> **Data de Conclusão:** 25 de Outubro de 2026  
> **Commits Principais:** [`2b5c99d`](https://github.com/teusbraga/arenablockoutlimited/commit/2b5c99d) (Fase 1), [`cd7b4a7`](https://github.com/teusbraga/arenablockoutlimited/commit/cd7b4a7) (Fase 2), [`477dc8a`](https://github.com/teusbraga/arenablockoutlimited/commit/477dc8a) (Fase 3, 4, 5) e [`ef5e473`](https://github.com/teusbraga/arenablockoutlimited/commit/ef5e473) (Fix Issue #9).  
> **Status:** 82/82 Testes Automatizados Aprovados (9 suítes completas em ~730ms).  
> **Objetivo:** Registrar o fim da fase de "vibecoding desgovernado", consolidar o vocabulário canônico do projeto e definir o **Protocolo Anti-Débito** para os próximos ciclos de desenvolvimento.

---

## 🧭 1. O que este Milestone Conquistou

Após 40 dias de experimentação intensa com diferentes versões de LLMs (Gemini 3.1 a 3.8, Nemotron, Claude e DeepSeek), o código acumulou inconsistências de nomenclatura, campos mortos e lógicas anestesiadas por fallbacks silenciosos.

Este Milestone consolidou a **engenharia real** da engine em 5 frentes:

1. **Normalização de Contratos:** Fim dos conflitos de dados entre arquivos JSON e scripts de gameplay.
2. **Mecanismos de Diagnóstico (*Fail-Fast*):** O projeto deixou de falhar em silêncio. Erros de schema, eventos desconhecidos e quedas no loop principal agora geram alertas visuais imediatos.
3. **Estabilização de Combate:** Recoil recovery suave implementado no `CameraRig`, bloqueio estrito de troca de armas e saque durante a tela de morte, e travas 3D na coleta de itens e carregadores no solo.
4. **Otimizações Drásticas para Low-End:** Cache estático de texturas procedurais nos bots (eliminando a criação contínua de 60 canvases), isolamento de sombras no passe de lunetas (`ScopeSystem`) e desoneração do spatial hash no `CollisionWorld` (eliminando 251.000 células estáticas de piso no heap).
5. **Manifesto Central de Armas:** Criação do `WeaponRegistry.js`, unificando em um só local o registro de modelos 3D, drops de solo e miras telescópicas.

---

## 📖 2. Dicionário Canônico de Variáveis e Dados

Para evitar que diferentes agentes de IA ou novas sessões reintroduzam nomes conflitantes, este é o **vocabulário oficial e imutável** do projeto:

### 2.1 Configurações de Movimento e Jogador (`gameplay.json` e `CONFIG.PLAYER`)
| Variável Oficial | Onde Vive | Significado | Não Usar (Depreciado) |
| :--- | :--- | :--- | :--- |
| `sprintMul` | `CONFIG.PLAYER.sprintMul` | Multiplicador de velocidade ao correr (padrão: 1.75) | `sprintMultiplier` solto |
| `adsMul` | `CONFIG.PLAYER.adsMul` | Multiplicador de velocidade ao mirar em ADS (padrão: 0.5) | `adsMultiplier` solto |
| `crouchMul` | `CONFIG.PLAYER.crouchMul` | Multiplicador de velocidade agachado (padrão: 0.5) | `crouchMultiplier` solto |
| `sens` | `CONFIG.PLAYER.sens` | Sensibilidade do mouse/olhar | `sensitivity` solto |
| `fixedDt` | `CONFIG.PHYSICS.fixedDt` | Timestep fixo do loop de simulação (estritamente `0.016667` = 60 Hz) | `0.008333` (120 Hz) |

### 2.2 Estrutura Canônica de Armas (`weapons.json` e `WeaponRegistry.js`)
Toda arma no arsenal deve possuir obrigatoriamente:
- `id`, `name`, `type` (`"rifle"` | `"smg"` | `"pistol"` | `"shotgun"` | `"sniper"` | `"heavy"`).
- `ammo`, `magSize`, `fireInterval`, `reloadTime`.
- Coordenadas de bocal e miras: `muzzleLocal`, `sightLocal`, `ejectLocal`, `adsSightDistance`.
- Poses de primeira pessoa: `hipPos`, `hipRot`, `adsRot`, `sprintPos`, `sprintRot`.
- Bloco `ballistics` com `internal`, `external` e `terminal`.
- **Atenção:** Os campos históricos `model`, `audioKey`, `casingType` e `smokeResidualMax` foram expurgados ou centralizados no compilador; não os reinsira no JSON.

### 2.3 Regra Universal do Barramento de Eventos (`EventBus.js`)
- **Regra de Ouro:** **100% dos eventos devem transmitir um objeto `{ ... }` como payload**.
  - ❌ `emit('weapon:select_slot', 1)` (Proibido)
  - ✅ `emit('weapon:select_slot', { slot: 1 })` (Obrigatório)
  - ❌ `emit('input:lock', true)` (Proibido)
  - ✅ `emit('input:lock', { locked: true })` (Obrigatório)
- **Catálogo Oficial:** Todo novo evento deve ser adicionado ao array `CANONICAL_EVENTS` em `src/core/EventBus.js`. No modo de depuração (`CONFIG.DEV_MODE = true`), o barramento emite aviso no console se um evento não registrado ou sem ouvintes for disparado no vácuo.

---

## 📦 3. O que Ficou Pendente (E por que não é crítico)

Identificamos a existência de **3 Arquivos-Deus (God Objects)** no projeto:
- `src/fx/Effects.js` (~2.100 linhas)
- `src/world/TextureGenerator.js` (~2.500 linhas)
- `src/world/ItalyProps.js` (~1.400 linhas)

**Por que não foram quebrados agora?**
Esses arquivos reúnem lógicas que estão **estáveis, cobertas por 82 testes e funcionando sem vazamentos de memória**. Uma quebra forçada neste momento introduziria alto risco de regressão visual sem ganho imediato de jogabilidade. Eles serão modularizados gradualmente em subpastas por domínio conforme novas necessidades visuais surgirem.

---

## 🛡️ 4. O Protocolo Anti-Débito (Regras para os Próximos Ciclos)

Para que você e os futuros agentes de IA nunca mais acumulem débitos técnicos nos próximos passos de evolução, todo incremento deve obedecer a este **checklist de 5 regras**:

### 🔹 Regra 1: A Fonte Única da Verdade (Data-Driven Real)
- Nunca coloque números mágicos de gameplay em arquivos JavaScript (dano, cadência, velocidade, recuo, raios).
- Se o valor afeta o balanceamento, **ele deve viver no JSON correspondente** (`weapons.json`, `ammo.json` ou `gameplay.json`) e ser consumido via `CONFIG` ou `WEAPONS`.

### 🔹 Regra 2: Cadastro de Arsenal Exclusivo no `WeaponRegistry`
- Nunca registre modelos de armas em múltiplos lugares do `main.js`.
- Qualquer nova arma entra no projeto registrando seu modelo, drops e miras exclusivamente em [`src/weapons/WeaponRegistry.js`](../src/weapons/WeaponRegistry.js). O `main.js` consome o registro automaticamente.

### 🔹 Regra 3: Ciclo "Spike & Sanitize" para Novas Features
- Você continua livre para usar IA para criar mecânicas rápidas (*vibecoding*).
- Porém, assim que a mecânica for aprovada no navegador:
  1. Formalize as propriedades novas no schema;
  2. Adicione os eventos no catálogo `CANONICAL_EVENTS`;
  3. Remova qualquer `console.log` de depuração temporário.

### 🔹 Regra 4: O Teste da Quebra Deliberada (Anti-Falso Verde)
- Ao implementar uma nova regra ou correção, não confie em testes que sempre passam.
- Comente a sua correção de propósito: o teste **tem que falhar em vermelho**. Se continuar verde com o código quebrado, o teste é uma fraude e deve ser reescrito.

### 🔹 Regra 5: O Portão dos 82 Testes (`npm test`)
- Nenhum commit deve ser realizado sem rodar previamente:
  ```bash
  npm test
  ```
- O gatekeeper são os **82 testes das 9 suítes**. Se 81 passarem e 1 falhar, o trabalho está incompleto.
