# 🏃 LocomotionSmoothingSystem — Arquitetura de Suavização e Transições de Animação

> **Status:** Operacional (Fase 1: 80% do problema resolvido com sucesso)  
> **Arquivo Fonte:** [`src/new_mechanics/LocomotionSmoothingSystem.js`](file:///c:/Users/Mateus/Desktop/Projetos/FPS%20BROWSER/deepseek/fps%20blocky/src/new_mechanics/LocomotionSmoothingSystem.js)  
> **Alvos Integrados:** `Viewmodel.js`, `CameraRig.js`, `main.js` (Dynamic FOV), `CharacterView.js` (3ª pessoa e Bots).

---

## 🎯 1. Problema Resolvido

No modelo legado, a transição entre **Idle (Parado)**, **Walk (Andando)**, **Sprint (Correndo)** e **ADS (Mirando)** sofria de:
1. **Quebra de Fase Trigonométrica (`time * freq`):** Trocar de frequência multiplicando pelo tempo acumulado em segundos gerava saltos instantâneos de centenas de radianos na malha da arma (teletransporte de tela em 1 frame).
2. **Degrau Seco de Amplitude:** Parar de andar (`speed <= 0.1`) zerava o bobbing instantaneamente e causava um degrau vertical seco de $5\,\text{mm}$.
3. **Alternância Binária de Pose:** O alvo da pose saltava abruptamente entre `hipPos` e `sprintPos` ao soltar Shift ou WASD.
4. **Câmera Inclinada Congelada:** O `CameraRig` congelava a fase ao parar de andar, mantendo o ângulo torto enquanto decaía.

O `LocomotionSmoothingSystem` resolveu isso desacoplando a cinemática física e mantendo **pesos contínuos normalizados**, **acumulador de fase incremental** e **respostas rápidas e responsivas**.

---

## 🧭 2. Arquitetura do Sistema

```mermaid
flowchart TD
    subgraph Input [Entradas Cinemáticas por Frame]
        V[Velocidade Real XZ - player.vel]
        S[Flag Sprint - player.sprinting]
        A[Flag & Progresso ADS - weapons.ads / adsAmount]
        C[Agachamento - player.crouched]
    end

    subgraph LocomotionSmoothingSystem [LocomotionSmoothingSystem (70-90ms)]
        Filtro[Filtro Passa-Baixas da Velocidade: speedLerp = 32 s⁻¹]
        Pesos[Pesos Contínuos: idleWeight, walkWeight, sprintWeight]
        Integrador[Integrador de Fase: dPhase = dt * freq]
        Inercia[Inércia Longitudinal: accelInertiaZ e accelInertiaPitch]
    end

    subgraph Consumidores [Consumidores de Apresentação]
        VM["Viewmodel.js (Multi-Pose Blending, Weapon Bob, Breathing, Inércia)"]
        CR["CameraRig.js (Headbob Suave, 85% ADS Dampening, Zero-Freeze Settle)"]
        FOV["main.js (Dynamic FOV Proporcional ao sprintWeight)"]
        CV["CharacterView.js (moveBlend para Soldado 3D e Bots)"]
    end

    Input --> LocomotionSmoothingSystem
    LocomotionSmoothingSystem --> VM
    LocomotionSmoothingSystem --> CR
    LocomotionSmoothingSystem --> FOV
    LocomotionSmoothingSystem --> CV
```

---

## ⚙️ 3. Tabela de Parâmetros e Calibração Atual

| Parâmetro | Valor Atual | Descrição / Efeito | Janela Temporal |
| :--- | :--- | :--- | :--- |
| `blendRate` | `28.0` | Taxa de decaimento analítico dos pesos primários ($w_{\text{idle}}, w_{\text{walk}}, w_{\text{sprint}}$) | **~70-90ms** ($89.4\%$ em 80ms) |
| `speedLerp` | `32.0` | Taxa de resposta da velocidade do jogador | **~60-75ms** |
| `accelInertiaZ` | `20.0` | Retorno da mola de inércia longitudinal da arma (arrancada/frenagem) | **~80-100ms** |
| `accelInertiaPitch` | `20.0` | Retorno do pitch de inércia da arma | **~80-100ms** |
| `bobAmount` rate | `22.0` | Subida e descida da amplitude de bobbing da arma | **~75-90ms** |
| `locoOffsetY` rate | `24.0` | Interpolação do offset vertical de locomoção (elimina degrau de 5mm) | **~70-85ms** |
| `basePos` lerp (Viewmodel) | `26.0` (Hip) / `16..30` (ADS) | Velocidade de interpolação entre poses Hipfire e Sprint | **~75-85ms** (Hip) / **Original** (ADS) |
| `CameraRig` bob rate | `24.0` | Subida e decaimento do headbob da câmera | **~70-85ms** |
| `CameraRig` ADS damp | `0.15` | Fator de atenuação do balanço da câmera ao mirar (85% de redução) | Imediato no ADS |
| `CameraRig` phase settle | `8.0` | Velocidade residual para completar o passo suavemente ao parar | Suave |

---

## 🔮 4. Roteiro de Fine Tuning & Próximos Polimentos (Os 20% Restantes)

Para os próximos passos de polimento estético e sensação de jogabilidade ("game feel"), os seguintes pontos foram mapeados para calibragem fina:

### 4.1. Curva de Transição Não-Linear (Ease-In / Ease-Out Hermite)
- **Situação Atual:** A interpolação usa decaimento exponencial puro ($1 - e^{-k \cdot dt}$).
- **Polimento Proposto:** Aplicar uma curva Hermite (`smoothstep(0, 1, weight)`) nas poses de armas pesadas (ex: M249 SAW de 7.5kg), conferindo uma sensação de "peso inicial lento com assentamento firme no ombro", enquanto armas leves (P9, UZI) mantêm a resposta linear rápida.

### 4.2. Inércia Vertical de Pulo e Aterrissagem (Jump Lift & Landing Dip)
- **Situação Atual:** A arma reage à aceleração horizontal ($XZ$). Ao pular ou cair de uma mureta, a aterrissagem física do jogador é absorvida sem que o modelo da arma afunde levemente.
- **Polimento Proposto:** Capturar a velocidade vertical $\Delta v_y$ no momento em que `onGround` transita para `true` e injetar um impulso elástico para baixo no `Viewmodel.swayGroup.position.y` ($\sim -0.015\,\text{m}$) que retorne por mola em ~120ms (estilo Modern Warfare / Tarkov).

### 4.3. Sprint-to-Fire Delay & Curva de Interrupção por Disparo
- **Situação Atual:** Disparar durante a corrida é bloqueado com `!player.sprinting`.
- **Polimento Proposto:** Adicionar uma penalidade calibrada de tempo para erguer o cano ao puxar o gatilho correndo (*sprint-to-fire time*, ex: 120ms em pistolas, 240ms na M249), com animação de puxada rápida de emergência.

### 4.4. Transição de Saque Rápido (Weapon Swap Dip Blend)
- **Situação Atual:** O saque usa `drawAmount` com decaimento exponencial simples.
- **Polimento Proposto:** Integrar o `drawAmount` ao `LocomotionSmoothingSystem` para que a arma nova surja de baixo com compensação de passo caso o jogador esteja correndo enquanto troca de arma.

### 4.5. Calibração Diferenciada por Classe de Arma (Data-Driven em `weapons.json`)
- Permitir que cada arma declare em seu JSON tempos específicos de transição:
  - Pistolas / SMGs: transições em **60-75ms** (agilidade máxima).
  - Fuzis de Assalto / Snipers: transições em **75-90ms** (calibração padrão atual).
  - LMGs (M249): transições em **100-120ms** (sensação de peso e inércia militar).

---

## 🔒 5. Diretivas de Blindagem Respeitadas
- Nenhuma alteração foi realizada em shaders, traçantes (`Effects.js`), `ammo.json` ou modelos 3D (`muzzleLocal`/`sightLocal`).
- Todo o sistema opera exclusivamente nas camadas de apresentação procedural da arma, câmera e corpo.
