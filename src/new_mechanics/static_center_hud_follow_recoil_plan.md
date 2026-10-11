# 🎯 Plano: Mira Fixa no Centro do HUD com Follow Recoil Desativado (Preservando Balística do Cano e Cam Climbing)

## 1. Diagnóstico do Comportamento Atual

Atualmente, mesmo quando o jogador desativa a opção **Seguir Recuo (Follow Recoil)** no menu:
1. O módulo `BarrelCrosshairAlignment.js` (linhas 149–153) continua sobrescrevendo diretamente `this.crosshairEl.style.left` e `this.crosshairEl.style.top` a cada frame no loop de renderização (`main.js`).
2. Por causa disso, a crosshair no HUD continua se movendo na tela acompanhando o sway/kick do cano 3D, em vez de ficar **100% parada no centro da tela**.
3. Além disso, o `sprayRecoil` acumulado estava sendo aplicado apenas visualmente no `CrosshairManager`, sem ser somado à orientação 3D do cano no `BarrelCrosshairAlignment`, criando duas fontes separadas de movimento no DOM (`left/top` vs `transform`).

---

## 2. Comportamento Desejado (Regra de Ouro)

| Sistema / Camada | Follow Recoil = `OFF` (Desativado) | Follow Recoil = `ON` (Ativado) |
| :--- | :--- | :--- |
| **HUD (`#crosshair`)** | **100% Fixa no Centro da Tela** (`left: 50%`, `top: 50%`, `transform: translate(-50%, -50%)`). Não sai do lugar com sway nem recuo. | **Móvel em Tempo Real:** Acompanha na tela a direção exata do cano + subida e padrão do spray. |
| **Balística & Tracers (`WeaponSystem` + `BarrelCrosshairAlignment`)** | **Seguem o Cano 3D:** Tiros e tracers continuam saindo da boca do cano e indo exatamente para onde o cano + spray apontam no mundo (`aimPointWorld`). | **Seguem o Cano 3D:** Tiros e tracers vão exatamente para onde o cano (e a crosshair na tela) apontam. |
| **Câmera (`CameraRig`)** | **Cam Climbing Ativo:** A câmera sobe normalmente com o recuo (`climbPitch` / `climbYaw`) e punch. | **Cam Climbing Ativo:** A câmera sobe normalmente com o recuo (`climbPitch` / `climbYaw`) e punch. |

---

## 3. Mudanças Propostas

```mermaid
flowchart TD
    subgraph Backend ["Física & Balística (Sempre Ativos)"]
        CAM["CameraRig: Cam Climbing (climbPitch / climbYaw)"]
        WS["WeaponSystem: Acumula sprayRecoil & Dispara Projéteis/Tracers"]
        BCA["BarrelCrosshairAlignment: Calcula aimPointWorld 3D (Cano + Spray) e screenPos 2D"]
        WS --> BCA
        BCA -->|aimPointWorld| WS
    end

    subgraph HUD ["Apresentação Visual (CrosshairManager.js)"]
        CM{"Follow Recoil Ativo?"}
        BCA -->|screenPos & sprayRecoil| CM
        CM -->|SIM (ON)| MOV["Move #crosshair na tela seguindo Cano + Spray"]
        CM -->|NÃO (OFF)| FIX["Trava #crosshair 100% parada no centro (50%, 50%)"]
    end
```

### 3.1. `src/new_mechanics/BarrelCrosshairAlignment.js` [MODIFY]
- **Remover a manipulação direta do DOM (`style.left` / `style.top`)** de dentro do `BarrelCrosshairAlignment.update()`, delegando o controle visual do `#crosshair` exclusivamente ao `CrosshairManager`.
- **Incorporar `sprayRecoil` na direção 3D do cano (`barrelAimDir`):**
  - Receber `sprayRecoil = { pitch, yaw }` no `update(weaponDef, isADS, dt, sprayRecoil)`.
  - Aplicar a deflexão angular do spray no vetor `barrelAimDir` antes do raycast de `aimPointWorld`.
  - Dessa forma, os tiros e tracers sempre respeitam o cano e o spray real da arma em 3D, e a projeção 2D (`this.screenPos`) reflete exatamente onde os tiros estão indo.

```javascript
// Em BarrelCrosshairAlignment.js:
// Remove a escrita direta em this.crosshairEl.style.left / top
// Apenas calcula aimPointWorld, barrelAimDir e screenPos (x, y)
```

---

### 3.2. `src/ui/CrosshairManager.js` [MODIFY]
- Tornar o `CrosshairManager` o **único responsável por posicionar o `#crosshair` no HUD**:
  - **Quando `cfg.followRecoil === false` (Desativado):**
    - Força imediatamente:
      ```javascript
      this.currentRecoilOffset.x = 0;
      this.currentRecoilOffset.y = 0;
      this.el.style.left = '50%';
      this.el.style.top = '50%';
      this.el.style.transform = 'translate(-50%, -50%)';
      ```
    - A mira fica **absolutamente estática na posição central do HUD**, sem qualquer deslocamento de sway, cano ou spray (apenas abrindo o `--gap` se estiver no modo `dynamic`).
  - **Quando `cfg.followRecoil === true` (Ativado):**
    - Posiciona a mira usando o deslocamento combinado do cano (`barrelScreenPos`) e do recuo de spray (`sprayRecoil` + `cameraRig`), garantindo rastreio fluido e fiel ao ponto de impacto dos tiros e tracers.

---

### 3.3. `src/main.js` & `src/ui/HUD.js` [MODIFY]
- Em `src/main.js`:
  1. Atualizar primeiro o `barrelCrosshair.update(weapons.def, weapons.ads, dt, weapons.getSprayRecoil())` para obter o `aimPointWorld` e o `screenPos` atualizados do frame.
  2. Em seguida, chamar `hud.updateCrosshair(..., { dt, cameraRig: player.rig, cameraFov: camera.fov, wallCompression: weapons.wallCompression || 0, sprayRecoil: weapons.getSprayRecoil(), barrelScreenPos: barrelCrosshair.screenPos })`.

---

### 3.4. `test/crosshair_manager.test.js` [MODIFY]
- Adicionar verificação explícita garantindo que:
  - Com `followRecoil: false`, `style.left` é `'50%'`, `style.top` é `'50%'` e `style.transform` é `'translate(-50%, -50%)'` (zero deslocamento na tela, mesmo quando há `sprayRecoil` alto ou `barrelScreenPos` deslocado).
  - Com `followRecoil: true`, a mira acompanha normalmente o recuo e o cano.

---

## 4. Plano de Verificação

### Testes Automatizados
- Executar `npm test` para validar todas as suítes de balística, CCD, mapas e crosshair (`test/crosshair_manager.test.js`).

### Verificação Manual
1. **Follow Recoil OFF:**
   - Desativar *Seguir Recuo (Follow Recoil)* na aba **🎯 MIRA**.
   - Mover a câmera rapidamente, andar e atirar em rajada (spray):
     - A crosshair deve ficar **100% cravada no centro da tela**.
     - A câmera deve continuar subindo normalmente (*cam climbing*).
     - As balas e os tracers devem continuar saindo do cano e indo na direção para onde o cano aponta.
2. **Follow Recoil ON:**
   - Ativar *Seguir Recuo (Follow Recoil)* na aba **🎯 MIRA**.
   - Atirar em rajada: a crosshair deve se mover na tela acompanhando o cano e a subida do spray onde os tiros/tracers batem.
