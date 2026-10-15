# 📜 Log de Versões e Histórico de Desenvolvimento (CHANGELOG)
**Projeto:** Arena Blockout (FPS Browser 3D Three.js)  
**Repositório:** [teusbraga/arenablockoutlimited](https://github.com/teusbraga/arenablockoutlimited)  
**Data da última atualização:** 15 de Outubro de 2026  

---

## 📌 Estado Atual das Branches & Tags

| Identificador | Tipo | Commit | Descrição / Propósito |
| :--- | :--- | :--- | :--- |
| **`main`** *(HEAD atual)* | Branch Principal | [`68138c1`](https://github.com/teusbraga/arenablockoutlimited/commit/68138c176f4c3113ba09535427d5adf7f74410c3) | **Versão estável atual online.** Inclui amostragem dinâmica de poeira de impacto (`SurfaceEyedropper`), desacoplamento de SFX, cooldown de fumaça de cano, muzzle flashes padronizados e suavização de locomoção. |
| **`backup/headbob-odometria`** | Branch de Backup | [`5e5dcea`](https://github.com/teusbraga/arenablockoutlimited/commit/5e5dcea) | **Versão experimental preservada.** Contém odometria real de passos no solo, curvas convexa parabólica (andar) e lemniscata (correr), sincronização sonora 1:1 de passos e configuração `LOCOMOTION`. |
| **`backup-headbob-odometria`** | Tag Fixa | [`5e5dcea`](https://github.com/teusbraga/arenablockoutlimited/commit/5e5dcea) | Tag imutável apontando para o commit da versão experimental de odometria e passos. |

---

## 🚀 Histórico Cronológico de Versões e Commits

### 🔹 Outubro de 2026

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
