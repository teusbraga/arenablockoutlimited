import { execSync } from 'child_process';

const issues = [
  {
    title: 'fix(camera): corrigir climbing acumulativo no recuo da câmera e implementar recoil recovery',
    labels: ['bug'],
    body: `### 🎯 Descrição
Durante rajadas contínuas de disparo com armas automáticas (ex: M249, AK-47, HK416), a câmera sobe sem parar (*pitch climbing*) até atingir o limite vertical máximo (\`pitchLimit\`), sem qualquer retorno elástico ou amortecido ao ponto de origem pré-disparo quando o jogador interrompe o tiro.

### 🔍 Causa Raiz
No arquivo \`src/core/CameraRig.js\` (linhas 124-128), o método \`addRecoilImpulse\` injeta \`this.targetPitch += climbPitch\` diretamente no pitch de orientação. Como não existe um acumulador de compensação temporal (*recoil recovery*) no loop \`update()\`, a subida torna-se irreversível sem que o jogador arraste o mouse manualmente para baixo.

### 📋 Passos para Reproduzir
1. Iniciar qualquer mapa com arma automática (ex: M249 SAW ou AK-47).
2. Manter pressionado o botão de disparo por 2 a 3 segundos sem mover o mouse.
3. Observar que a mira sobe até o teto e fica travada no limite superior sem retornar.

### ✅ Comportamento Esperado
- O disparo deve elevar a mira;
- Ao cessar o fogo, uma fração calibrada do recuo vertical (*recoil recovery rate*) deve amortecer e puxar a mira suavemente de volta para a posição original, respeitando correções ativas manuais do jogador.

### 🛠️ Proposta de Solução
1. Separar o pitch manual do mouse de um acumulador \`recoilClimbCurrent\`.
2. No método \`update(dt)\` do \`CameraRig\`, aplicar decaimento suave \`smoothDamp\` ou \`lerp\` no \`recoilClimbCurrent\` quando \`isFiring\` for falso.
3. Garantir que movimentos intencionais de mouse para baixo cancelem o retorno proporcionalmente para evitar *over-correction*.`
  },
  {
    title: 'fix(weapons): bloquear troca de arma e seleção de slots quando o jogador estiver morto',
    labels: ['bug'],
    body: `### 🎯 Descrição
Quando o jogador tem sua vida zerada e entra na tela de morte com a contagem de respawn ativa, ainda é possível pressionar as teclas \`1\`, \`2\`, \`Q\` ou girar a roda do mouse para trocar de arma. Isso ativa áudios mecânicos de saque, atualiza a pose do viewmodel no chão e gera descompasso na cena.

### 🔍 Causa Raiz
No arquivo \`src/weapons/WeaponSystem.js\` (linhas 192-220), os métodos \`selectSlot(idx)\` e \`setSlot()\` não verificam \`this.player.alive\`. Da mesma forma, o listener do barramento \`weapon:select_slot\` opera sem checagem de estado de vida do operador.

### 📋 Passos para Reproduzir
1. Entrar em uma partida e ser abatido por um bot.
2. Durante a contagem regressiva da tela de morte ("Você foi abatido"), pressionar teclas \`1\` ou \`2\`.
3. Os sons de saque tocam e a arma do jogador troca no modelo 3D.

### ✅ Comportamento Esperado
- Ao morrer (\`player:died\`), todos os comandos e atalhos de seleção de slot ou troca de armas devem ser estritamente ignorados até o respawn completo do jogador.

### 🛠️ Proposta de Solução
Adicionar cláusula de guarda inicial em \`selectSlot()\`, \`setSlot()\`, \`pickupWeapon()\` e \`cycleWeapon()\`:
\`\`\`javascript
if (!this.player || !this.player.alive) return;
\`\`\``
  },
  {
    title: 'fix(physics): corrigir colisão vertical de MagazineDrop e cálculo 3D de proximidade na coleta',
    labels: ['bug'],
    body: `### 🎯 Descrição
Carregadores ejetados durante a recarga rápida (\`reload_speed\`) podem cair através do chão em rampas/degraus ou ficar flutuando. Além disso, o jogador consegue coletar carregadores posicionados em andares diferentes (acima ou abaixo), e quando há múltiplos carregadores no chão, o prompt de interação oscila ou seleciona o item errado.

### 🔍 Causa Raiz
1. Em \`src/weapons/MagazineDrop.js\` (linhas 100-107), o raycast de detecção de solo possui alcance fixo de apenas 1.5 metros a partir da posição instantânea do magazine.
2. Em \`checkPickup(character)\`, a verificação de distância é feita puramente em 2D horizontal: \`Math.hypot(px - this.pos.x, pz - this.pos.z) < 1.4\`, ignorando a coordenada vertical Y.
3. Em \`src/core/GameManager.js\` (linhas 449-459), o laço guarda \`nearMag = mag\` do último elemento avaliado que satisfaça a condição, em vez do item com menor distância euclidiana real.

### 📋 Passos para Reproduzir
1. Executar recarga rápida (\`reload_speed\`) em rampas, escadas ou beiradas de plataformas.
2. O carregador pode atravessar a geometria para o infinito ou flutuar no ar.
3. Posicionar-se em um andar superior e pressionar [F] sobre o ponto de projeção do carregador no andar de baixo.

### ✅ Comportamento Esperado
- O carregador deve assentar solidamente sobre qualquer geometria estática;
- A coleta só deve ser autorizada se a diferença de altura $|dy| < 1.2\\text{m}$;
- A interação deve selecionar deterministicamente o carregador mais próximo do jogador no espaço 3D.`
  },
  {
    title: 'fix(crosshair): alinhar retícula dinâmica com o eixo mecânico puro do cano sem incorporar spray',
    labels: ['bug'],
    body: `### 🎯 Descrição
Quando a opção "Mira Dinâmica" (\`dynamicAlignment\`) está ligada, a retícula na tela sofre solavancos bruscos e desalinha durante o disparo contínuo, tornando o controle visual caótico.

### 🔍 Causa Raiz
Conforme documentado no \`PROJECT_MAP.md\` §13.13 e em \`src/new_mechanics/BarrelCrosshairAlignment.js\` (linhas 154-155), o algoritmo projeta na tela \`this.aimPointWorld\`, o qual já recebeu o offset angular da dispersão balística (*spread/spray*), em vez de projetar o ponto mecânico puro do cano (\`this.pureAimPointWorld\`).

### 📋 Passos para Reproduzir
1. Ativar a mira dinâmica nas configurações de crosshair.
2. Disparar em hipfire com fuzil automático ou metralhadora.
3. A retícula salta bruscamente pela tela acompanhando cada tiro com spray em vez da orientação física da arma.

### ✅ Comportamento Esperado
- A retícula dinâmica deve acompanhar suavemente a inclinação física do cano (sway, inércia de movimento e recuo do corpo da arma);
- A dispersão balística de tiro deve apenas abrir a folga (gap) das barras da retícula no \`CrosshairManager\`.`
  },
  {
    title: 'fix(viewmodel): corrigir eixos de rotação ortonormal do IK da mão esquerda em armas de duas mãos',
    labels: ['bug'],
    body: `### 🎯 Descrição
Ao empunhar armas primárias com guarda-mão (HK416, AK-47, M249, Winchester M12), as falanges e juntas da mão esquerda aparentam torção e posicionamento anti-anatômico, atravessando o cano ou apontando para direções incorretas.

### 🔍 Causa Raiz
No arquivo \`src/weapons/ViewmodelArms.js\` (linhas 183-191), a base vetorial do solver IK da mão esquerda (\`_solveArmIK\`) assume inversão direta dos eixos locais, que entram em conflito com as orientações dos ossos criados em \`TacticalManContinuous.js\`.

### 📋 Passos para Reproduzir
1. Equipar HK416 ou AK-47 em 1ª pessoa.
2. Observar o modelo da mão esquerda segurando o guarda-mão da arma.
3. Os dedos aparecem torcidos de forma não natural.

### ✅ Comportamento Esperado
- A mão esquerda deve envolver organicamente o guarda-mão ou calha, com o polegar acima e os demais quatro dedos tangentes à face inferior/lateral da arma.`
  },
  {
    title: 'fix(mobile): implementar integração com navigator.vibrate para disparo, recarga e dano',
    labels: ['bug', 'accessibility'],
    body: `### 🎯 Descrição
No menu de acessibilidade do jogo há um controle para ativar/desativar "Vibração", e o arquivo \`gameplay.json\` contém \`"vibrationEnabled": true\`. No entanto, em dispositivos móveis (Android/Chrome PWA), nenhuma vibração física ocorre em nenhuma circunstância.

### 🔍 Causa Raiz
A propriedade \`CONFIG.ACCESSIBILITY.vibrationEnabled\` é apenas armazenada no estado; a API nativa de haptics do navegador (\`navigator.vibrate\`) não é invocada em nenhum arquivo do projeto (\`TouchInput.js\` ou \`WeaponSystem.js\`).

### 📋 Passos para Reproduzir
1. Acessar o jogo via dispositivo móvel Android com vibração habilitada no menu.
2. Disparar armas, recarregar ou sofrer dano de bots.
3. Nenhum feedback háptico é emitido pelo smartphone.

### ✅ Comportamento Esperado
- Disparos: pulso tátil ultracurto (10-15ms);
- Dano sofrido de bots: pulso médio com padrão tático (60ms);
- Recargas ou QTE: pulso duplo suave (20ms, pausa 30ms, 20ms);
- Respeitar estritamente a preferência do usuário no menu.`
  },
  {
    title: 'feat(gameplay): bloquear alteração de armas no menu durante a partida em andamento',
    labels: ['enhancement'],
    body: `### 🎯 Descrição
Em qualquer momento da partida, o jogador pode pausar ou abrir o menu e alterar os seletores de arma primária e secundária, o que invoca \`WeaponSystem.setSlot()\` e equipa instantaneamente uma arma nova com carregadores cheios, contornando a economia de munição e os drops do cenário.

### 🔍 Causa Raiz
\`MenuController.js\` escuta os seletores de arma e chama \`weapons.setSlot()\` diretamente, sem consultar se a partida já foi iniciada ou se o jogador está em combate.

### 📋 Passos para Reproduzir
1. Iniciar uma partida contra bots.
2. Abrir o menu em tempo de execução e alterar o seletor da arma primária de \`ar15\` para \`m249\`.
3. A nova arma é equipada instantaneamente com munição cheia em pleno combate.

### ✅ Comportamento Esperado
- A escolha livre de armamento deve ocorrer apenas no lobby pré-partida;
- Uma vez que o round comece, os seletores no menu devem ser desabilitados/bloqueados com um aviso ("Armamento travado durante a partida. Colete armas no chão com [F]").`
  },
  {
    title: 'refactor(core): isolar atalhos de depuração e cheats na aba de Desenvolvedor do Menu',
    labels: ['enhancement'],
    body: `### 🎯 Descrição
Atualmente, qualquer usuário jogando uma partida pública comum pode ativar a perspectiva de 3ª pessoa e funções de depuração digitando sequências de teclas como \`whoami\`.

### 🔍 Causa Raiz
Os atalhos de cheat estão ouvindo diretamente eventos globais do teclado em \`Input.js\` e \`main.js\` sem checar se o ambiente é desenvolvimento (\`DEV_MODE\`).

### 📋 Passos para Reproduzir
1. Durante uma partida comum, digitar a sequência de letras \`whoami\`.
2. A perspectiva muda para terceira pessoa sem nenhuma restrição de privilégio.

### ✅ Comportamento Esperado
- Partidas comuns devem ter atalhos de cheat desativados;
- Comandos de inspeção e depuração devem residir exclusivamente dentro de uma aba dedicada de "Desenvolvedor" no \`MenuController\`, ativável apenas por flag explícita.`
  }
];

async function main() {
  const credOutput = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8'
  });
  const tokenMatch = credOutput.match(/password=(.+)/);
  if (!tokenMatch) {
    throw new Error('Não foi possível obter o token do Git Credential Manager.');
  }
  const token = tokenMatch[1].trim();
  const repo = 'teusbraga/arenablockoutlimited';

  console.log(`Conectado ao GitHub via Git Credential Manager.`);
  console.log(`Iniciando criação de ${issues.length} issues no repositório ${repo}...\n`);

  for (let i = 0; i < issues.length; i++) {
    const item = issues[i];
    console.log(`[${i + 1}/${issues.length}] Criando: "${item.title}"...`);

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'node-script',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(item)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Erro ao criar issue ${i + 1} (${res.status}): ${err}`);
      continue;
    }

    const data = await res.json();
    console.log(`   ✅ Sucesso! Issue #${data.number}: ${data.html_url}`);
  }

  console.log('\n🎉 Todas as issues foram processadas com sucesso!');
}

main().catch(console.error);
