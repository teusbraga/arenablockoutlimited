# Defeitos e Vulnerabilidades (Hit List)

> **⚠️ REGRA GLOBAL DE AGENTE:** 
> 1. Este arquivo é um **LOG CONTÍNUO**. **NUNCA APAGUE** passos criados anteriormente.
> 2. Ao corrigir uma vulnerabilidade, apenas marque o checkbox com `[x]` ou escreva `(CONCLUÍDO)` na frente do título.
> 3. Novas vulnerabilidades descobertas devem ser adicionadas com numeração sequencial (## 4, ## 5, etc.) no final do arquivo.

Este documento atua como um rastreador de dívida técnica, bugs ocultos, vazamentos de memória (Memory Leaks) e gargalos de performance no código atual. A resolução destes itens é a **FASE 1** essencial para estabilizar o protótipo antes de qualquer grande reestruturação.

## 1. Vazamentos de Memória (Memory Leaks) e Ciclo de Vida
- [x] **EventBus Órfãos nos Bots** (CONCLUÍDO)
  - *Arquivo Alvo:* `src/entities/Bot.js` / `src/core/GameManager.js`
  - *Problema:* O evento `on('bot:fired', this._onFired)` é registrado no construtor do Bot. Quando `GameManager` remove um bot (ex: via `setBotCount`), o `EventBus` retém a referência.
  - *Ação:* Criar método `destroy()` no Bot que invoque `off('bot:fired', this._onFired)`. Garantir que o GameManager chame `destroy()` ao remover bots.
- [x] **Limpeza Incompleta da VRAM (Texturas e Materiais)** (CONCLUÍDO)
  - *Arquivo Alvo:* `src/core/GameManager.js`
  - *Problema:* Ao remover itens da cena, o código atual faz apenas `geometry.dispose()`. Os objetos `Material` e `Texture` ficam alocados na placa de vídeo (VRAM).
  - *Ação:* Embutir no método `destroy()` do Bot (e onde mais houver remoção) o descarte completo: `material.dispose()` e `material.map.dispose()`.
- [x] **Timers Assíncronos Vazando** (CONCLUÍDO)
  - *Arquivo Alvo:* `src/entities/Player.js` (método `die()`)
  - *Problema:* O uso de `setInterval` nativo para a tela de morte. Se a partida for resetada no meio da contagem, o timer sobrevive e revive o jogador aleatoriamente.
  - *Ação:* Eliminar o `setInterval`. Criar uma variável `this.respawnTimer` e decréscer via `dt` dentro da função `update()`.

## 2. GC Thrashing (Micro-Stutters de Garbage Collector)
- [x] **Alocações Intensivas no Loop de Tiro** (CONCLUÍDO)
  - *Arquivo Alvo:* `src/weapons/WeaponSystem.js` (método `_fire()`)
  - *Problema:* A cada disparo (ou cada balim de escopeta), são instanciados múltiplos `new THREE.Vector3()` e feitas cópias (`.clone()`). Com armas automáticas, isso gera milhares de objetos descartáveis, forçando o navegador a pausar o jogo para limpar a memória.
  - *Ação:* Criar vetores estáticos de rascunho no topo do arquivo (ex: `const _tempMuzzle = new THREE.Vector3()`) e reaproveitá-los usando `.copy()`, `.add()` e `.set()`.
- [x] **Alocações no Comportamento da IA** (CONCLUÍDO)
  - *Arquivo Alvo:* `src/ai/AIController.js` (métodos `_hasLOS`, `_search`)
  - *Problema:* Criação de instâncias e arrays a cada tick do loop da IA.
  - *Ação:* Mesma abordagem: *Object Pooling* de variáveis locais usando vetores estáticos definidos fora do construtor.

## 3. Gargalos de Renderização (Draw Calls)
- [x] **Carregamento Ingênuo de Mapas** (CONCLUÍDO)
  - *Arquivo Alvo:* `src/world/MapLoader.js`
  - *Problema:* Para cada parede/cubo do JSON do mapa, um novo `BoxGeometry` e um novo `MeshStandardMaterial` são criados. Isso explode o número de draw calls na GPU.
  - *Ação:* Substituído por `THREE.InstancedMesh` agrupando blocos por material com geometria unitária compartilhada e instanciamento por matrizes. Redução maciça de draw calls na GPU.
