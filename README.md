# Boring Office


Jogo de escrita para computador e telemóvel. Esta evolução está na branch `codex/orbita-evolution`. Joga em [GitHub Pages](https://scalifornia.github.io/orbita-web/). A publicação acompanha esta branch de evolução; `main` conserva a baseline anterior.

## Começar

O menu tem **Jogar** e **Opções**. Continuar, documentos e ranking estão nas opções. Em Opções escolhe cenário, conto, idioma do texto, escrita básica/exata, dificuldade e modo. O idioma do jogo atualiza menus e textos pré-programados: português, inglês, francês, alemão e espanhol. Os documentos importados conservam o original. Há duas adaptações próprias de fábulas de Esopo em cada idioma.

Para testar esta branch localmente, executa `python3 jogar.py` ou `python3 -m http.server 8766 --bind 127.0.0.1` e abre http://127.0.0.1:8766/. Não abras o HTML diretamente. Não é necessário instalar pacotes para jogar.

## Campanhas e documentos

**Texto seguido + Campanha** percorre a história ou documento até ao fim, sem repetir palavras. Podes colar texto ou importar TXT, PDF com texto selecionável, DOCX e EPUB. A extração acontece no dispositivo, sem enviar documentos a um servidor. A pré-visualização permite conferir o texto e o título antes de jogar.

Os capítulos e secções conservam a ordem. Os documentos são divididos em blocos curtos; os monólogos de escritório respeitam as frases completas. A passagem de nível inclui uma pausa curta, fade e resumo de pontos, precisão, palavras por minuto e progresso. O tanque ou nave entram em cena a cada nível.

Limites: ficheiros até 20 MB, texto até 1 milhão de caracteres, conteúdo expandido até 24 MB e PDFs até 1500 páginas. PDFs digitalizados precisam de OCR externo; documentos protegidos não são suportados. Extração de PDFs com colunas pode exigir correção na pré-visualização. As bibliotecas locais e respetivas licenças estão em `vendor/`.

## Continuar

Uma campanha fica guardada neste navegador: documento, capítulo, nível, posição, letras já aceites e estatísticas. **Guardar e sair** ou reabrir o jogo permite continuar. O idioma e o cenário da campanha são recuperados. Uma campanha nova substitui a anterior; ao concluir, o botão Continuar desaparece. Após Game Over, Continuar repõe três vidas e retoma a posição, sem saltar a palavra fatal. O armazenamento é local e limitado; o jogo mostra uma mensagem se não conseguir guardar. Limpar os dados do navegador apaga o progresso. Guardados locais e online não se transferem entre endereços ou dispositivos.

## Mecânica preservada

- Cada letra certa lança um disparo; explosões e fragmentos acompanham o impacto.
- A escrita básica simplifica maiúsculas/acentos e ignora números/pontuação. A avançada exige maiúsculas, acentos, pontuação e símbolos exatos. Os espaços são automáticos.
- Palavras soltas conserva a campanha original de 10 níveis (8, 10, … 26 alvos). Infinito repete o texto e acelera com o tempo ativo.
- Há três vidas. Uma letra errada quebra a sequência, mas não apaga as letras aceites. Esc pausa no computador.
- O ranking guarda dez partidas por configuração neste navegador; não é um ranking global.

## Imagem, áudio e mobile

Espaço inclui estrelas com profundidade e meteoros; Terra tem relevo, vegetação e poeira. A preferência de movimento reduzido é respeitada. Efeitos e partículas têm limites para controlar o custo de desenho. Livros longos têm aceleração progressiva limitada a 2,5×.

Mantêm-se os sprites e sons fornecidos: nave, tanque, Binary Groove, Missile Launch e Explosion. Existem controlos separados para música e efeitos, com feedback de combo, mudança de nível, vitória e Game Over. O áudio só começa após um gesto, conforme as regras dos navegadores.

O campo de escrita usa o teclado nativo e preserva composição de acentos. O layout adapta-se ao espaço visível quando o teclado abre. Testes em 390 px e altura reduzida não substituem a validação num iPhone e Android físicos, que permanece pendente.

## Validação

```sh
node --test engine.test.mjs input.test.mjs audio.test.mjs
node --test *.test.mjs
```

A suite inclui regras originais, campanhas finitas, divisão natural, capítulos, importação, limites, progresso corrompido/armazenamento cheio, recuperação de palavras parciais, cinco idiomas, áudio, cenários e transições. O teste opcional `documentImport.browser.test.mjs` requer Playwright e Chrome indicados pelas variáveis `ORBITA_PLAYWRIGHT_PATH` e `ORBITA_CHROME_PATH`; sem elas é explicitamente ignorado. Foi verificada a importação real dos três formatos estruturados num navegador, incluindo que conteúdos embutidos de EPUB não são executados nem descarregados.

## Módulos

- `engine.mjs`: regras e recuperação de estado; `input.mjs`: teclado/composição.
- `documentImport.mjs`, `campaign.mjs`, `progress.mjs`, `adventure.mjs`: importação, divisões e progresso.
- `library.mjs`, `interface.mjs`, `locale.mjs`, `locale-data.mjs`: menus e idiomas.
- `scenery.mjs`, `transitions.mjs`, `audio.mjs`: cenários, transições e sons.
- `main.mjs`: ligação dos módulos e efeitos de combate.
- `index.html`, `style.css`, `evolution.css`: estrutura e apresentação.

## Atualização de leitura e interface — setembro de 2026

- Idioma no canto superior direito, escolha Espaço/Terra no menu e botões de opções com maior contraste. O menu usa toda a área disponível antes de jogar.
- “Ler o texto completo” abre um leitor com navegação por secções, parágrafos preservados e tamanho de letra ajustável, sem o limite de 5000 caracteres da pequena pré-visualização. Durante o jogo, abre na secção atual e pausa a partida.
- Texto seguido com letras maiores, mais contexto e palavra atual destacada.
- Resumos de nível duram 3,3 segundos e de capítulo 4,1 segundos, além da breve espera pelo último impacto. O botão Próximo nível permite avançar antes; a entrada do veículo recomeça após a transição.
- Explosion mantém o ficheiro fornecido, com ataque preservado, cauda até 1,6 segundos e música atenuada no impacto. O painel de áudio inclui um teste de explosão.
- A publicação GitHub Pages pode seguir diretamente `codex/orbita-evolution`, sem merge em `main`, mantendo o histórico de cada atualização no GitHub.


### Atualização 1 outubro 2026
- Início com Jogar e Opções; importação, continuar, áudio e ranking nas opções.
- Novo cenário Escritório e conto satírico original nos cinco idiomas; Espaço, Terra e as duas fábulas continuam disponíveis.
- Novas campanhas: 20 palavras por nível, transição automática de 1,2 s e aumento de velocidade a cada nível (limitado a 2,5×). Partidas antigas conservam os seus níveis guardados.
- Em ecrãs até 700 px, a história e os painéis de texto adicionais ficam ocultos; o teclado nativo e as palavras no campo continuam disponíveis.


## Identidade Boring Office — 2 outubro 2026

O escritório é o cenário principal, com dez monólogos originais sobre trabalho nos cinco idiomas. O seletor do topo atualiza menus e textos pré-programados; documentos importados nunca são traduzidos. As falas do escritório respeitam frases completas.

Cada transição tem entrada de 4,5 s, leitura integral por pelo menos 8 s (ajustada a 150 palavras/minuto + 2 s) e saída de 4,5 s. Movimento reduzido elimina os fades, mas conserva a leitura. Próximo nível permite saltar voluntariamente.

Cenários: Escritório usa leitura básica em campanha; Espaço propõe sobrevivência rápida com alvos livres; Terra propõe leitura exata com pontuação. As opções de cada cenário são recuperadas ao alternar.


## Atualização visual — 4 outubro 2026

- Protagonista exclusivo visto de trás, com auscultadores, secretária, café e teclado que dispara.
- Seis alvos originais no escritório: email urgente, papelada, impressora, relógio, folha de cálculo e chefia.
- Os níveis alternam entre open space, reunião, arquivo, copa, servidores e direção, com arquitetura e paletas diferentes. O ciclo repete-se após seis níveis.
- Espaço e Terra passam a ter seis silhuetas de inimigos e variação visual por nível.
- Referências de conceção: [ZType](https://zty.pe/) (escrita e combate), [Going Under](https://store.steampowered.com/app/1154810/Going_Under/) (sátira do escritório). Arte procedural original, sem copiar imagens ou código.
- Publicar cada etapa jogável em `codex/orbita-evolution`, após testes e inspeção visual. Não implica uma tarefa automática permanente.


## Ajustes — 4 outubro 2026
- Passagem de nível automática após exatamente 8 segundos de resumo totalmente visível, sem precisar de clicar. O contador indica os segundos restantes. Pausar ou sair da página suspende a contagem.
- Inglês como idioma inicial com uma nova preferência de idioma; as escolhas seguintes ficam guardadas. Textos pré-programados acompanham o idioma, documentos pessoais conservam o original.
- Esta duração substitui as transições anteriores com fades de 4,5 segundos.


## Pausa à medida — 4 outubro 2026
- Idioma junto de Jogar; barra superior com Escritório/Terra/Espaço, escrita Normal/Expert e importação direta.
- Coluna lateral com convite à importação, dificuldade, texto seguido/palavras soltas e campanha/infinito. O botão de importação abre a escolha de ficheiro e depois a pré-visualização existente.
- Três músicas CC0 adicionais: Chills (Holizna), Quirky Jazz (Spring Spring) e Synthwave House Loop (Fupi). Créditos e fontes em assets/MUSIC-CREDITS.md e no painel Áudio.
- Variedade automática por nível e cenário, escolha de ambiente e Próxima música; banda sonora original disponível. As músicas são carregadas só após um gesto e em função da seleção. Cerca de 2,8 MB adicionais no total, com excertos AAC para controlar memória e dados móveis.
- Regressões de áudio cobrem troca de música, carregamentos atrasados, pausa, silêncio e recuperação de volume. Seleções de idioma e modo sincronizam os atalhos com as opções.
