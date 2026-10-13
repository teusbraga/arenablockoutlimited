# 🎮 Backlog de Ideias Mecânicas Táticas (Arena Blockout)

> Documento de referência com propostas mecânicas avançadas para futura expansão, mantendo compatibilidade direta com a arquitetura `fixedUpdate(120Hz)` / Godot-ready do projeto.

---

## 1. 🦿 Movimentação Tática Avançada

### 1.1 Slide Tático (Deslize no Solo)
* **Ativação:** Pressionar `Ctrl` (Crouch) durante um sprint ativo (`Shift`).
* **Dinâmica Física:**
  * O jogador entra em estado cinemático com impulso baseado no momento linear atual.
  * Altura da AABB colapsa temporariamente para ~0.8m.
  * Fricção diferenciada no solo (`slideFriction`) com decaimento suave até atingir a velocidade normal de agachado ou parar.
  * Dispersão de tiro acentuada (`hipSpread * 2.2`) e aumento do recuo da arma durante o deslizamento.
  * Câmera aplica inclinação angular leve e abaixamento sincronizado no `CameraRig`.

### 1.2 Mantle / Vault (Transposição e Escalada de Muretas)
* **Ativação:** Pular (`Espaço`) colado a um obstáculo de altura média (entre 0.6m e 1.4m).
* **Detecção Geométrica:**
  * Raycast frontal na altura da cintura para detectar a barreira.
  * Raycast superior reverso para verificar se o topo do obstáculo está livre e plano.
* **Execução:**
  * Transição cinemática suave da câmera e da posição vertical do jogador (`Player.js`).
  * Desativação momentânea de disparo durante a subida (com arma abaixada ou erguida).

### 1.3 Prone (Rastejo Completo)
* **Ativação:** Tecla `Z` para alternar entre em pé/agachado e deitado.
* **Hitbox & Cinemática:**
  * AABB reduzida para 0.40m de altura.
  * Velocidade máxima de locomoção drasticamente reduzida (1.2 m/s).
  * Estabilidade máxima: redução de 60% no recuo e na oscilação de respiração (*sway*).
  * Incapaz de correr (`sprint`) sem antes transitar de volta para agachado/em pé.

### 1.4 Polimento de Inércia de Pulo/Aterrissagem & Sprint-to-Fire (Fine-Tuning da Locomoção)
* **Status Atual:** 80% implementado pelo [`LocomotionSmoothingSystem.js`](file:///c:/Users/Mateus/Desktop/Projetos/FPS%20BROWSER/deepseek/fps%20blocky/src/new_mechanics/LocomotionSmoothingSystem.js) (janela de 70-90ms, sem estalos e com abertura rápida de ADS).
* **Tweaks Restantes:**
  * **Landing Dip:** Afundamento vertical elástico do modelo da arma ao tocar no chão após queda ou salto.
  * **Curva Hermite S-Curve por Peso:** Armas pesadas (M249) com início de movimento mais cadenciado e pistolas com linearidade pura.
  * **Sprint-to-Fire Time:** Delay analítico para erguer o cano ao disparar no meio da corrida.
  * **Especificação Técnica:** [`src/new_mechanics/locomotion_smoothing_system.md`](file:///c:/Users/Mateus/Desktop/Projetos/FPS%20BROWSER/deepseek/fps%20blocky/src/new_mechanics/locomotion_smoothing_system.md).


---

## 2. 🎒 Gestão Tática de Armas & Recarga Realista

### 2.1 Inspeção Procedural de Arma
* **Ativação:** Tecla `F` ou `Y` (ou botão de menu no mobile).
* **Animação Procedural:**
  * O `Viewmodel.js` gira a arma suavemente no eixo local (pitch e roll), exibindo o ferrolho/câmara e laterais do armamento.
  * Interrompível instantaneamente por ações de disparo, mira (ADS) ou troca de arma.

### 2.2 Recarga Tática vs. Recarga Vazia (One in the Chamber)
* **Recarga Tática (Munição no Carregador > 0):**
  * Mantém 1 bala na câmara do fuzil/pistola (`mag + 1`).
  * Ciclo de recarga mais rápido: apenas desconecta o carregador gasto e insere o novo.
* **Recarga Vazia (Munição = 0):**
  * Ciclo de recarga mais longo: insere o carregador e obriga a puxar o ferrolho / acionar o *bolt catch* (com áudio sintetizado adicional de manipulação mecânica).

### 2.3 Saque Rápido de Secundária (Fast Sidearm Draw)
* **Ativação:** Toque duplo em `2` ou comando rápido de emergência quando a arma primária esvazia.
* **Mecânica:**
  * O operador solta a arma primária no sling (transição direta sem guardar) e saca a pistola secundária na metade do tempo convencional de `swapTime`.

---

## 3. 💣 Equipamentos & Utilitários Táticos

### 3.1 Granada Fragmentária Físico-Balística (HE Grenade)
* **Ativação:** Tecla `G`.
* **Física & Balística:**
  * Arremesso físico com arco parabólico, gravidade real e quique cinemático com coeficiente de restituição no `CollisionWorld.js`.
  * Fusível temporal de 3.5 segundos com temporizador no `fixedUpdate`.
* **Cálculo de Dano & Oclusão:**
  * Raio letal central e decaimento linear de dano em área.
  * Teste de raycast contra a geometria do mapa: paredes e coberturas sólidas barram totalmente os fragmentos e a onda de choque.
* **VFX/Áudio:**
  * Partículas de detonação com fumaça escura, estilhaços e som sintetizado com sub-bass profundo e ringing agudo.

### 3.2 Flashbang (Granada de Atordoamento)
* **Detonação:**
  * Clarão branco com intensidade dependente do vetor de visão do alvo (olhar direto = 100% cegueira; olhar para o lado = desorientação parcial).
  * Efeito sonoro de *Tinnitus* (zumbido senoidal contínuo abafando outros sons do jogo via filtro passa-baixa no `AudioSystem.js`).

### 3.3 Kit Médico & Bandagem
* **Canalização Tática:**
  * Tempo de aplicação (ex: 3 a 5 segundos) com desativação temporária da empunhadura da arma.
  * Recuperação de vida fracionada com parada de penalidades de dano.

---

## 4. 🪖 Equipamento & Proteção Corporal (Armadura / Hitboxes Zonais)

### 4.1 Hitboxes Segmentadas por Regiões Anatômicas
* **Cabeça (Head):** Multiplicador de dano 2.5x (geralmente letal com calibres de fuzil).
* **Tórax (Chest):** Multiplicador 1.0x (base da balística).
* **Membros (Arms / Legs):** Multiplicador 0.7x; tiros nas pernas podem aplicar penalidade temporária de sprint/mobilidade.

### 4.2 Blindagem Balística & Durabilidade de Coletes / Capacetes
* **Classes de Armadura:**
  * Níveis de proteção (ex: Classe 2, 3, 4, 5) comparados com o poder de penetração de cada calibre (`ammo.json`).
* **Absorção vs Perfuração:**
  * Projéteis de baixo calibre (ex: 9x19mm) ricocheteiam ou têm o dano absorvido pelo colete, degradando a durabilidade da armadura sem ferir o HP interno.
  * Projéteis de alto calibre (ex: 7.62x39mm, .500 Magnum) perfuram blindagens leves causando dano integral.
