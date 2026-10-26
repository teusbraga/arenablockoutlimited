# 🔒 DIRETIVA GERAL INVIOLÁVEL: SISTEMA DE TRACERS, ARMAS E EFEITOS VISUAIS

> **STATUS:** CONGELADO / PRODUÇÃO (LOCKED)  
> **APLICAÇÃO:** OBRIGATÓRIA PARA TODOS OS AGENTES DE IA E DESENVOLVEDORES  
> **DATA DE BLINDAGEM:** 12 de Outubro de 2026  

---

## 🚫 REGRA DE OURO: NÃO ALTERAR ESTE SUBSISTEMA

Fica **terminantemente proibido** modificar, refatorar, reescrever, reparametrizar ou "otimizar" direta ou indiretamente:

1. **Os Traçantes (Tracers / FlashTracers):**
   - Arquivo principal: `src/fx/Effects.js` (especialmente pools de tracers, `_updateTracers`, shaders/materiais dos traçantes).
   - Configurações data-driven: `assets/weapons/ammo.json` (todos os campos `tracerProfile`, `lengthMultiplier`, `streakLength`, `ttl`, `headSpeed`, `flashProfile`).
   - Mapeamento e testes: `test/tracer_test.js` e `src/weapons/ProjectileManager.js` (fluxo `tracer:fire`).

2. **Modelos 3D das Armas & Muzzle Coordinates:**
   - Diretório: `src/weapons/models/` (ex: `M249.js`, `RiflePrototype.js`, `VSS.js`, `ShotgunM12.js`, `SW500.js`, etc.).
   - Arquivo de definição: `assets/weapons/weapons.json` (especificamente `muzzleLocal`, `sightLocal`, `ejectLocal`, `hipPos`, `adsPos`).
   - Não alterar comprimentos de canos, pontas de quebra-chamas (flash hiders) nem rotações locais dos modelos.

3. **Sistemas Interligados que Afetam o Disparo:**
   - `src/weapons/WeaponSystem.js`: não reintroduzir `originTracker` dinâmico em tempo real nem mudar a compensação cinemática de strafe (`fixedUpdate` vs `renderUpdate`).
   - `src/new_mechanics/BarrelCrosshairAlignment.js` e miras do HUD.

---

## 🧠 CONTEXTO TÉCNICO & LIÇÃO APRENDIDA (POST-MORTEM)

- **O Problema Histórico:** Durante giros rápidos de mouse (flick) e deslocamento lateral do jogador (strafe), qualquer tentativa de amarrar a cauda do traçante ao cano da arma em tempo real resulta em **traçantes elásticos, curvados em 90 graus como banana ("tiro chicote") ou tiros saindo flutuando no ar**.
- **A Solução Validada e Aprovada:** 
  - O traçante balístico é **100% desacoplado** e viaja em linha reta colinear no espaço de mundo.
  - O bocal no frame 0 sincroniza perfeitamente com a ponta do quebra-chamas (`muzzleLocal`).
  - O `lengthMultiplier` calibrado entre **1.3 e 1.5** (atualmente **1.4**) na M249 produz o visual de feixe estendido sem revelar descompasso de strafe.
  - O Muzzle Flash volumétrico mascara a saída da bala nos primeiros centímetros.

---

## 🛑 CHECKLIST DE REVISÃO ANTES DE QUALQUER COMMIT

Qualquer PR, comando ou edição que tocar nos arquivos abaixo **deve ser rejeitado** se alterar a mecânica dos traçantes:
- [ ] `src/fx/Effects.js` (seção de traçantes)
- [ ] `assets/weapons/ammo.json`
- [ ] `assets/weapons/weapons.json` (posições de `muzzleLocal`)
- [ ] `src/weapons/models/*.js`

**Qualquer nova arma ou mecânica deve usar a infraestrutura existente como caixa preta, sem alterar os algoritmos centrais já blindados.**

---

## 📝 REGRA GERAL OBRIGATÓRIA: INCREMENTO DO CHANGELOG

Toda e qualquer alteração realizada em **scripts JavaScript (`*.js`)** ou **arquivos de dados e configurações (`*.json`)** em qualquer subsistema do projeto (armas, balística, FX, IA, física, áudio, UI ou core) exige **obrigatoriamente o incremento e atualização do `CHANGELOG.md`** no mesmo turno de trabalho, especificando os arquivos modificados e seus impactos. Nenhuma tarefa que envolva código ou dados é considerada concluída sem esse registro.
