# ⚡ Arena Blockout Limited (FPS Blocky 3D)

> **Tactical Browser FPS Engine** construída do zero em **Three.js** e **Vanilla ES Modules** (zero bundlers, zero dependências de compilação). Desenvolvida para alta performance tanto no **Desktop** quanto no **Mobile** (via Vercel), combinando gunplay tático com arquitetura **100% Data-Driven**.

![Three.js](https://img.shields.io/badge/Three.js-r160-black?style=flat-square&logo=three.js)
![JavaScript](https://img.shields.io/badge/ES6+-Vanilla%20Modules-yellow?style=flat-square&logo=javascript)
![WebGL](https://img.shields.io/badge/WebGL-2.0%20PBR-blue?style=flat-square)
![Mobile](https://img.shields.io/badge/Mobile-Touch%20Controls%20(Vercel)-green?style=flat-square)
![Architecture](https://img.shields.io/badge/Architecture-Data--Driven%20JSON-orange?style=flat-square)

---

## 📖 Visão Geral do Projeto

O **Arena Blockout Limited** nasceu como um protótipo de validação mecânica de tiro em primeira pessoa (blockout / greyboxing) e evoluiu para uma **Engine Modular de FPS Tático** completa para web. 

O projeto prioriza **jogabilidade responsiva (60 FPS cravados)**, fidelidade mecânica de tiro inspirada em simuladores táticos modernos (Tarkov/Insurgency) e acessibilidade extrema: pode ser jogado no navegador do computador ou do smartphone diretamente pela nuvem.

---

## 🏆 Desafios Ultrapassados & Marcos de Engenharia

### 1. Desacoplamento Monolítico ➔ Arquitetura Data-Driven
* **O Problema:** No início, configurações de armas, física do jogador, soundbank e inteligência artificial dos bots estavam misturados e espalhados por centenas de linhas de código JavaScript imperativo com números mágicos.
* **A Solução:** Criamos uma camada de abstração em [`src/core/ConfigLoader.js`](./src/core/ConfigLoader.js) e [`src/weapons/WeaponDefs.js`](./src/weapons/WeaponDefs.js). Todos os parâmetros de balanceamento, física, IA e áudio agora residem em arquivos `.json` na pasta `assets/`. A engine conta com **Deep Merge Fallback**: se um modder cometer um erro de sintaxe ou apagar uma chave em um JSON, o jogo preenche com valores seguros em memória sem travar a execução.

### 2. O Monumento HK416: Modelagem Procedural PBR
* **O Desafio:** Criar um rifle militar de alta fidelidade visual sem carregar modelos externos pesados (`.gltf` ou `.fbx`) que atrasassem o carregamento no browser.
* **A Conquista:** O modelo da **Heckler & Koch HK416** foi construído matematicamente com primitivas geométricas Three.js no arquivo dedicado [`src/weapons/models/HK416.js`](./src/weapons/models/HK416.js):
  - **Upper & Lower Receiver:** Perfil elevado característico do pistão HK, flared magwell, seletor de tiro tático, pinos de desmontagem e bolt catch.
  - **Quad-Rail Picatinny:** Trilhos 3D com dentes usinados individualmente e janelas de arrefecimento em baixo relevo.
  - **Câmara de Ejeção Ativa:** Ferrolho cromado usinado e cartucho em latão dourado visível através da janela de ejeção aberta.
  - **Miras Diópter Concêntricas:** Alça rotativa traseira e anel dianteiro (*hooded sight*) com ponto central de trítio neon funcional, perfeitamente alinhados na transição para mira de ferro (ADS).
  - **Acabamento Militar PBR:** Materiais com micro-rugosidade e alto brilho metálico simulando liga de alumínio anodizado militar.

### 3. Cross-Platform Nativo: Celular via Vercel + Desktop
* **O Desafio:** Os navegadores mobile de smartphone não suportam a API de *Pointer Lock* (captura de cursor do mouse) e possuem comportamentos indesejados de sistema (pull-to-refresh, zoom por pinça, rolagem de página).
* **A Conquista:**
  - Criação do [`src/core/TouchInput.js`](./src/core/TouchInput.js): Um joystick virtual dinâmico flutuante (*Dynamic Floating Joystick*) no polegar esquerdo, touchpad de mira livre com aceleração no lado direito e botões táteis ergonômicos de disparo, pulo, agachamento, recarga e mira (ADS).
  - Bypass inteligente de Pointer Lock em dispositivos touch.
  - Suporte total a `100dvh` (Dynamic Viewport Height) e bloqueio estrito de gestos acidentais no CSS (`touch-action: none`).
  - Clamping inteligente de resolução gráfica (`devicePixelRatio` travado em 1.5 no mobile) para garantir 60 FPS estáveis mesmo em dispositivos intermediários.

### 4. Áudio 100% Sintetizado em Tempo Real (Zero Assets de Áudio)
* O jogo **não faz download de arquivos MP3 ou WAV**. Todos os disparos, recargas, passos, impactos de bala e headshots são sintetizados proceduralmente em tempo real pelo navegador usando a `Web Audio API` (osciladores harmônicos, filtros passa-faixa e envelopes ADSR) configurados no [`assets/config/audio.json`](./assets/config/audio.json).

---

## 🎯 Features & Game Feel

* **Física de Viewmodel Orgânica:**
  * **Spring-Damper Sway:** Inércia de mola de mouse que atrasa a arma suavemente em rotações bruscas.
  * **Lissajous Breathing Curve:** Movimentação orgânica da mira simulando a respiração e oscilação dos braços do operador no ADS.
  * **Kickback & Recoil Pitch/Yaw:** Recuo com deslocamento traseiro e elevação do cano proporcional ao calibre da arma.
  * **Draw Animation:** Animação de subida suave ao alternar ou sacar o armamento.
* **HUD Tático & UI Reativa:**
  * **Indicador Direcional de Dano:** Canvas 2D projetado no centro da tela que desenha arcos vermelhos calculados com base na rotação da câmera, apontando a direção exata de onde partiram os disparos inimigos.
  * **Crosshair Dinâmico:** Expande com a dispersão de movimento/disparo e transita suavemente para invisível durante o ADS.
  * **Killfeed & Popups de Combo:** Anuncia Double Kills, Triple Kills e Headshots em tempo real.
* **IA Tática:**
  * Bots equipados com busca de linha de visão via raycasting, audição de passos, patrulha inteligente e tempo de reação calibrável.
* **Interação com o Cenário:**
  * Portas funcionais que abrem e fecham com animação suave pressionando `[E]` ou tocando no botão tátil de porta.

---

## 🛠️ Guia de Modding (100% JSON)

Qualquer pessoa pode clonar o projeto e alterar completamente a jogabilidade, armas e gráficos **apenas editando arquivos JSON**, sem precisar compilar código:

| Arquivo | O Que Você Pode Modificar? |
| :--- | :--- |
| [`assets/config/gameplay.json`](./assets/config/gameplay.json) | Velocidade de caminhada, multiplicador de corrida, gravidade, força do pulo, FOV normal e de mira, sensibilidade do mouse/toque, inércia de mola da arma. |
| [`assets/weapons/weapons.json`](./assets/weapons/weapons.json) | Dano no corpo/cabeça, cadência de tiro, tamanho do pente, tempo de recarga, precisão hipfire/ADS, recuo horizontal/vertical e attachments. |
| [`assets/characters/bots.json`](./assets/characters/bots.json) | Vida dos inimigos, velocidade de movimento, raio de visão, tempo de reação, memória de perseguição e dano das armas dos bots. |
| [`assets/config/audio.json`](./assets/config/audio.json) | Frequências (Hz), duração, tipos de onda (sawtooth, square, noise) e ganho de cada disparo ou efeito sonoro. |
| [`assets/maps/range.json`](./assets/maps/range.json) | Posição e dimensões dos blocos do mapa, pontos de spawn do jogador e dos bots, iluminação e portas. |

---

## 🎮 Controles

### Desktop (Teclado & Mouse)
| Comando | Ação |
| :---: | :--- |
| `W, A, S, D` | Movimentação |
| `Mouse` | Olhar / Mirar |
| `Botão Esquerdo` | Disparar |
| `Botão Direito` | Mira Precisa (ADS Toggle) |
| `Shift` | Correr (Sprint) |
| `C` | Agachar |
| `Espaço` | Pular |
| `R` | Recarregar arma |
| `Q` | Alternar entre HK416 e Pistola P-9 |
| `E` | Interagir / Abrir e fechar portas |
| `Esc` | Pausar partida / Abrir menu |

### Mobile (Smartphones & Tablets)
* **Polegar Esquerdo (Lado Esquerdo da Tela):** Analógico Virtual Flutuante (arraste além de 75% para correr automaticamente).
* **Polegar Direito (Lado Direito da Tela):** Touchpad de mira livre (arraste o dedo para girar a câmera).
* **Botões Táteis:** Disparo (🔥), Mira ADS (🎯), Pulo (🦘), Agacho (🔻), Recarga (🔄), Troca de Arma (🔫) e Interação de Porta (🚪).

---

## 🚀 Como Executar Localmente

Como a engine é construída com **Pure ES Modules**, basta qualquer servidor web estático para rodar o projeto localmente:

### Usando Python:
```bash
# Na raiz do projeto:
python -m http.server 8000
```
Abra o navegador em: **`http://localhost:8000`**

### Usando VS Code (Live Server):
Clique com o botão direito em `index.html` e selecione **"Open with Live Server"**.

### Deploy no Vercel / GitHub Pages:
Basta fazer push para o seu repositório no GitHub. Nenhum comando de build ou configuração adicional é necessário (arquivo `index.html` estático nativo).

---

## 📁 Estrutura do Projeto

```text
├── index.html                   # Entrypoint com UI, viewport 100dvh e touch styling
├── assets/                      # Camada de Dados (100% Modificável)
│   ├── characters/bots.json     # Balanceamento da IA
│   ├── config/audio.json        # Soundbank sintético
│   ├── config/gameplay.json     # Física, câmera e game feel
│   ├── maps/range.json          # Geometria do mapa e spawns
│   └── weapons/weapons.json     # Atributos, cadências e poses das armas
└── src/                         # Código-Fonte Modular
    ├── ai/                      # Lógica de controle e tomada de decisão dos bots
    ├── audio/                   # Sintetizador Web Audio API reativo
    ├── core/                    # Engine loop, ConfigLoader, EventBus, Input e GameManager
    ├── entities/                # Player, Bot e classes base
    ├── fx/                      # Efeitos de partículas, tracers e flashes
    ├── physics/                 # Sistema de colisão AABB e raycasting
    ├── ui/                      # HUD dinâmico, Damage Indicator e Killfeed
    ├── weapons/                 # Viewmodel, física de sway/recoil e WeaponSystem
    │   └── models/              # Modelagem procedural de armas (HK416 e P9)
    └── world/                   # MapLoader e portas interativas
```

---

## 📜 Licença

Desenvolvido para fins comemorativos e de validação arquitetural. Sinta-se livre para clonar, criar novos mapas, balancear armas e expandir a engine! 🚀
