# Órbita — Espaço e Terra v3

Jogo de escrita e naves para o navegador, a partir da ideia do protótipo `escreve.py`. Usa o teclado do computador ou o teclado nativo do telemóvel. O programa Python e os recursos originais permanecem intactos.

## Jogar online

**[Abrir o Órbita](https://scalifornia.github.io/orbita-web/)** — no computador ou no telemóvel, sem instalar nada. A publicação usa GitHub Pages a partir de `main`, pasta raiz.

O ranking fica guardado por navegador e dispositivo. Os resultados do endereço local não são transferidos automaticamente para o endereço online.

## Jogar localmente

No PyCharm, abre **jogar.py** nesta pasta e executa-o. Só precisa de Python 3, sem instalar bibliotecas. O navegador abre automaticamente.

No telemóvel, liga-te à mesma rede Wi-Fi do computador e abre o endereço local indicado no terminal. O computador e o servidor têm de continuar ligados. Esta opção local serve para testar alterações antes de as publicar.

Em alternativa, abre um terminal nesta pasta:

```sh
python3 -m http.server 8765 --bind 0.0.0.0
```

No computador: [abrir o jogo](http://localhost:8765). O jogo deve abrir através do servidor, em vez de abrir o `index.html` diretamente.

## Cenários e idiomas

Escolhe **Espaço** para jogar com a nave ou **Terra** para jogar com o tanque num cenário de colinas e floresta, com títulos de níveis próprios. Terra seleciona inicialmente O Leão e o Rato; Espaço seleciona A Lebre e a Tartaruga. Podes escolher qualquer conto em ambos.

Os menus e os textos estão disponíveis em **português e inglês**, com seletores independentes: podes manter as instruções em português e praticar leitura em inglês. Selecionar um conto substitui o texto personalizado ativo.

## Modos e níveis

- **Texto seguido:** dois contos tradicionais, em adaptações próprias: **A Lebre e a Tartaruga** e **O Leão e o Rato**, com a palavra atual e as seguintes visíveis. Os alvos seguem a ordem da leitura. É possível usar o próprio texto.
- **Palavras soltas:** a primeira letra escolhe um alvo compatível; termina a palavra ou toca em ↺ para libertar o alvo. O progresso de cada palavra fica guardado.
- **Campanha:** 10 níveis, com metas de 8, 10, 12… até 26 palavras; são 170 palavras completas para vencer. A velocidade sobe com o progresso e os alvos em curso continuam entre níveis.
- **Infinito:** continua para além do nível 10 e acelera com o tempo ativo e o progresso. A aceleração também afeta as naves que já estão no ecrã. A pausa suspende o tempo e a aceleração.

**Normal é a dificuldade de entrada**, agora mais rápida do que a versão anterior: o tempo base de queda passou de 26 para 15 segundos. Difícil começa com 11,5 segundos e Extremo com 8,5. Palavras longas recebem tempo adicional; a velocidade indicada no jogo aumenta estes ritmos ao longo da partida.

Tens três vidas, pontuação, sequência de acertos, precisão e palavras por minuto. Uma letra errada não apaga o progresso: escreve a letra certa para continuar. Cada letra explode quando o disparo lhe chega; o último impacto destrói a nave. Em Texto seguido, a faixa de leitura conserva as palavras completas.

## Escrever e ouvir

Os espaços aparecem automaticamente entre palavras. Na escrita **básica**, maiúsculas e acentos são simplificados; pontuação e números são ignorados. Na **avançada**, é necessário escrever exatamente as maiúsculas, acentos, números, pontuação e símbolos de cada palavra. Apagar não anula disparos. O texto repete ao chegar ao fim; palavras longas são conservadas e ajustadas à largura disponível. Durante a composição de acentos em modo avançado, o disparo espera pela confirmação do carácter.

O campo de escrita é real e a área do jogo adapta-se ao teclado. Durante a composição do teclado nativo, o seu conteúdo é preservado; o texto visível apresenta as letras aceites e os espaços automáticos sem interromper essa composição.

A música vem ativada por predefinição, mas só pode começar depois do primeiro toque ou tecla. Usa **Ouvir música do menu**, o botão de som ou **Áudio** para controlar a reprodução. Em Áudio, os volumes da música e dos tiros/explosões são independentes.

O **ranking local** guarda as dez melhores partidas de cada configuração, com pontos, precisão, palavras por minuto e data. Os resultados são separados por dificuldade, texto seguido/palavras soltas, campanha/infinito, cenário, idioma do texto, escrita básica/avançada e conto ou conteúdo personalizado. Não é um ranking online. Preferências e texto ficam neste navegador, quando o armazenamento está disponível.

## Nave, sons e personalização

Os recursos utilizados pelo jogo estão em `assets/`:

- `player-ship.png`: cópia da nave original `spaceship_new.png`.
- `missile_launch.wav`: cópia do som original do míssil. Cada tiro reproduz um trecho curto do ataque do som.
- `menu-loop.wav`: música original gerada localmente, com 40 segundos a 96 BPM.
- `binary-groove.wav`: versão mono a 22 050 Hz da faixa fornecida `786224__alien_i_trust__alien-i-trust-binary-groove-gift-track-free-download.wav`, usada durante o jogo. O original permanece intacto.
- `explosion.mp3`: som fornecido para a destruição de palavras.
- `tank-player.png`: adaptação transparente, vista de cima, da imagem fornecida `tank.png`. O original permanece intacto.
- `game-loop.wav`: faixa anterior, conservada como recurso.

Podes substituir estas cópias mantendo os nomes e formatos. Para a nave, usa um PNG com fundo transparente. Os ficheiros originais fora desta pasta não são alterados.

Para voltar a gerar as duas músicas:

```sh
python3 tools/generate_audio.py
```

O gerador precisa de NumPy; jogar não precisa. Também volta a copiar `../Assets/missile_launch.wav` para a pasta do jogo.

## Validação

A suite tem 48 testes de regras, campanha completa, infinito, dificuldade, ordem de leitura, teclado/composição, espaços automáticos e áudio:

```sh
node --test engine.test.mjs input.test.mjs audio.test.mjs
```

O fluxo base foi verificado em Chrome automatizado, incluindo texto seguido, texto personalizado, pausa, composição e ecrã de 390 px com altura reduzida. A validação num iPhone ou Android físico com o respetivo teclado nativo ainda está por fazer.

A versão online usa GitHub Pages; para desenvolver, também podes usar o servidor local. As músicas e imagens são locais; as fontes usam Google Fonts, com alternativas quando não há rede. Palavras por minuto usa cinco letras por palavra e exclui o tempo em pausa.

## Organização

- `index.html` e `style.css`: menus e layout.
- `main.mjs`: desenho, efeitos, leitura e ligação aos controlos.
- `engine.mjs`: regras de jogo independentes do desenho.
- `input.mjs`: entrada de texto do teclado real.
- `audio.mjs`: músicas, disparos, efeitos e volumes.
- `jogar.py`: servidor local e abertura do jogo.

- `stories.mjs`: adaptações próprias dos contos de Esopo em português e inglês.
- `locale.mjs`: tradução dos menus e mensagens.
