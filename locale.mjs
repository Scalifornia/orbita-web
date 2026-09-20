let language = 'pt';
const dictionary = {
'TERRA · MISSÃO FLORESTA':'EARTH · FOREST MISSION','O TEU TANQUE':'YOUR TANK','Como jogar':'How to play','Áudio':'Audio','Controlos':'Controls','Órbita, início':'Orbit, home','Desativar som':'Mute sound','Ativar som':'Enable sound',
'LIGAÇÃO ESTABELECIDA / 02':'CONNECTION ESTABLISHED / 02','Entra':'Enter','na':'the','órbita.':'orbit.','Dedos rápidos. Reflexos acesos.':'Fast fingers. Sharp reflexes.','Cada letra é um impacto.':'Every letter makes an impact.',
'A TUA NAVE':'YOUR VEHICLE','A tua nave':'Your ship','O teu tanque':'Your tank','PROPULSÃO IÓNICA · ONLINE':'SYSTEMS · ONLINE','O TEU RECORDE':'YOUR BEST','Neste navegador · modo normal':'This browser · normal mode',
'Escolhe um alvo.':'Choose a target.','Escreve a primeira letra.':'Type the first letter.','Completa a palavra.':'Complete the word.','Cada letra dispara.':'Every letter fires.','Mantém o ritmo.':'Keep the rhythm.','Protege as tuas 3 vidas.':'Protect your 3 lives.',
'SISTEMAS PRONTOS.':'SYSTEMS READY.','PT · V.02':'EN · V.03','Jogo Órbita':'Orbit game','PONTOS':'SCORE','NÍVEL':'LEVEL','VELOCIDADE':'SPEED','ESCUDO':'SHIELD','3 vidas':'3 lives','Pausar jogo':'Pause game',
'Naves inimigas com palavras. Escreve as letras para as destruir.':'Targets carry words. Type their letters to destroy them.','SECTOR 07':'SECTOR 07','SISTEMA ÓRBITA':'ORBIT SYSTEM','TODOS OS SISTEMAS ONLINE':'ALL SYSTEMS ONLINE',
'Escreve rápido.':'Type quickly.','Brilha mais alto.':'Shine brighter.','Uma letra. Um disparo. Uma explosão.':'One letter. One shot. One explosion.','Entra no próximo nível.':'Enter the next level.',
'Idioma dos menus':'Menu language','Idioma do texto':'Text language','Cenário':'Setting','Espaço':'Space','Terra':'Earth','Conto':'Story','Escrita':'Writing','Básica · acentos opcionais':'Basic · optional accents','Avançada · escrita exata':'Advanced · exact typing',
'Avançada: copia maiúsculas, acentos, pontuação e símbolos. Os espaços são automáticos.':'Advanced: copy capitals, accents, punctuation and symbols. Spaces are automatic.',
'Progressão':'Progression','Campanha':'Campaign','10 níveis':'10 levels','Infinito':'Endless','Sempre a acelerar':'Always accelerating','Modo de jogo':'Game mode','Texto seguido':'Read in order','Palavras soltas':'Separate words','Dificuldade':'Difficulty','Normal':'Normal','Difícil':'Hard','Extremo':'Extreme',
'Iniciar missão':'Start mission','Ranking local ↗':'Local leaderboard ↗','Ranking local':'Local leaderboard','Usar o meu texto':'Use my text','Usar o meu texto +':'Use my text +','O teu texto está pronto ✓':'Your text is ready ✓','Ouvir música do menu':'Play menu music','NEON DRIFT · música ativa':'NEON DRIFT · music playing',
'RESPIRA. O ESPAÇO PODE ESPERAR.':'TAKE A BREATH. THE MISSION CAN WAIT.','Missão em pausa.':'Mission paused.','Retoma quando estiveres pronto.':'Resume when you are ready.','Continuar missão':'Resume mission','Voltar ao início':'Back to menu',
'A PRÓXIMA VAGA É TUA.':'THE NEXT WAVE IS YOURS.','Missão terminada.':'Mission complete.','Órbita conquistada.':'Orbit conquered.','10 NÍVEIS. MISSÃO CUMPRIDA.':'10 LEVELS. MISSION ACCOMPLISHED.','NOVO RECORDE. BEM VOADO.':'NEW BEST. WELL PLAYED.','NOVO RECORDE NESTA PARTIDA.':'NEW BEST THIS ROUND.',
'PRECISÃO':'ACCURACY','PAL./MIN':'WPM','Mais uma missão':'Play again','A TUA HISTÓRIA':'YOUR STORY','Escreve as palavras das naves. Os espaços são automáticos.':'Type the target words. Spaces are automatic.','O teu teclado é o comando.':'Your keyboard is the controller.','Libertar alvo':'Release target','COMPUTADOR OU TELEMÓVEL. TU ESCOLHES.':'DESKTOP OR MOBILE. YOUR CHOICE.','SEM PRESSA. ATÉ COMEÇAR.':'TAKE YOUR TIME. UNTIL YOU START.',
'MENOS SCROLL. MAIS SKILL.':'LESS SCROLL. MORE SKILL.','Uma letra de cada vez.':'One letter at a time.','Fechar ajuda':'Close help','MANUAL DE VOO':'PLAYER GUIDE','É só escrever.':'Just type.',
'Em':'In','Texto seguido':'Read in order',', acompanha a história e escreve a palavra destacada. Em':', follow the story and type the highlighted word. In',', a primeira letra escolhe a nave mais próxima que começa por essa letra.':', the first letter selects the nearest target beginning with it.',
'Continua a escrever a palavra para disparar. Uma letra errada quebra a sequência, mas podes continuar com a letra certa.':'Keep typing to fire. A wrong letter breaks your streak, but you can continue with the correct letter.',
'Se uma nave passar a linha de defesa, perdes uma vida. Tens três.':'If a target crosses the defence line, you lose a life. You have three.',
'No telemóvel, toca em':'On mobile, tap', 'para abrir o teu teclado. Se o fechares, toca no campo de escrita. Na escrita básica, os acentos são opcionais. Na avançada, copia também maiúsculas, acentos, pontuação e símbolos.':'to open your keyboard. If you close it, tap the typing field. Basic writing accepts optional accents. Advanced writing requires capitals, accents, punctuation and symbols.',
'Os':'The','espaços aparecem automaticamente':'spaces appear automatically','ao terminar cada palavra. Em':'after each word. In',', conquista 10 níveis. Em':', complete 10 levels. In',', a velocidade aumenta com o tempo. Normal é a dificuldade de entrada; Difícil e Extremo sobem o ritmo.':', speed increases over time. Normal is the starting difficulty; Hard and Extreme increase the pace.',
'Usa':'Use','para libertar o alvo. No computador,':'to release the target. On desktop,','pausa a partida. O recorde fica guardado neste navegador, por dificuldade e tipo de texto.':'pauses the game. Records are saved in this browser for each game configuration.',
'Pronto para descolar':'Ready to play','Fechar texto personalizado':'Close custom text','A TUA MISSÃO, AS TUAS PALAVRAS':'YOUR MISSION, YOUR WORDS','Traz o teu texto.':'Bring your own text.',
'Cola um texto e treina com as tuas palavras, pela ordem em que aparecem. Ao chegar ao fim, o texto recomeça.':'Paste a text to practise its words in order. The text repeats when you reach the end.','Texto de treino':'Practice text','Escreve ou cola aqui o teu texto…':'Write or paste your text here…',
'Na escrita básica, os acentos são simplificados e a pontuação é ignorada. Na avançada, copia todos os caracteres de cada palavra. Os espaços são automáticos. O texto fica apenas neste dispositivo.':'Basic writing simplifies accents and ignores punctuation. Advanced writing requires every character in each word. Spaces are automatic. Your text stays on this device.',
'Usar este texto':'Use this text','Voltar às palavras do jogo':'Use the selected story','Fechar áudio':'Close audio','FREQUÊNCIA NÉON':'NEON FREQUENCY','Sente o ritmo.':'Feel the rhythm.',
'Ambiente no menu e Binary Groove durante a missão. Missile Launch acompanha os tiros; Explosion toca quando uma palavra é destruída.':'Ambient menu music and Binary Groove during missions. Missile Launch plays for shots; Explosion plays when a word is destroyed.',
'Música':'Music','Tiros e explosões':'Shots and explosions','Ativar áudio':'Enable audio','O som começa após o primeiro toque ou clique. Podes desligá-lo no ícone de altifalante.':'Audio starts after your first tap or click. Mute it with the speaker icon.',
'Fechar':'Close','As 10 melhores partidas nesta configuração, guardadas neste navegador.':'The best 10 games with this configuration, saved in this browser.','Ainda não há partidas nesta configuração.':'No games with this configuration yet.','Não foi possível guardar o ranking neste navegador.':'The leaderboard could not be saved in this browser.',
'Acompanha o texto.':'Follow the text.','Escreve a palavra destacada.':'Type the highlighted word.','normal':'normal','difícil':'hard','extremo':'extreme','campanha':'campaign','infinito':'endless','texto seguido':'read in order','palavras soltas':'separate words','teu texto':'your text','Avançada':'Advanced','Básica':'Basic','Texto personalizado':'Custom text','pontos':'points','pal./min':'wpm',
'Escreve a palavra destacada…':'Type the highlighted word…','Escreve uma palavra para disparar…':'Type a word to fire…','O teclado perdeu o foco. Toca em continuar para retomar.':'The keyboard lost focus. Tap resume to continue.','A missão ficou em pausa enquanto estavas fora.':'The mission paused while you were away.','Acrescenta pelo menos uma palavra.':'Add at least one word.',
'ESCOLHE UMA PALAVRA E COMEÇA A ESCREVER':'CHOOSE A WORD AND START TYPING','LINHA DE DEFESA':'DEFENCE LINE',
'Primeiro sinal':'First signal','Campo de estrelas':'Star field','Rota lunar':'Lunar route','Chuva de meteoros':'Meteor shower','Mar de luz':'Sea of light','Cinturão de asteroides':'Asteroid belt','Vento solar':'Solar wind','Salto orbital':'Orbital jump','Horizonte distante':'Distant horizon','Coração da galáxia':'Heart of the galaxy',
'Vale verde':'Green valley','Trilho do bosque':'Forest trail','Ponte antiga':'Old bridge','Colina dourada':'Golden hill','Rio tranquilo':'Quiet river','Montanha azul':'Blue mountain','Floresta profunda':'Deep forest','Caminho de pedra':'Stone path','Horizonte verde':'Green horizon','Regresso a casa':'Homecoming'
};
export function t(value) {
  if (language === 'pt') return value;
  if (dictionary[value]) return dictionary[value];
  let result = value.replace(/ESPAÇOS AUTO/g, 'AUTO SPACES').replace(/LETRAS SEGUIDAS/g,'CHARACTER STREAK').replace(/^ALVO:/,'TARGET:').replace(/^NÍVEL /,'LEVEL ').replace(/ vidas$/,' lives');
  for (const [pt,en] of Object.entries(dictionary)) {
    if (result.includes(pt.toUpperCase()) && pt.length > 6) result = result.replaceAll(pt.toUpperCase(), en.toUpperCase());
  }
  if (value.includes(' · ')) result = result.split(' · ').map(part => dictionary[part] || part).join(' · ');
  return result;
}
const originals = new WeakMap();
function localize(node, key, value, write) {
  let record = originals.get(node); if (!record) { record = {}; originals.set(node, record); }
  if (!record[key] || value !== record[key].last) record[key] = { source: value, last: value };
  const source = record[key].source;
  const trimmed = source.trim();
  const next = trimmed ? source.replace(trimmed, t(trimmed)) : source;
  record[key].last = next;
  if (value !== next) write(next);
}
export function setLanguage(value) { language = value === 'en' ? 'en' : 'pt'; }
export function translatePage() {
  document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script,style,textarea,#readingText,#typedEcho,#story,#rankingList,#rankingConfig')) continue;
    localize(node, 'text', node.nodeValue, value => { node.nodeValue = value; });
  }
  for (const node of document.querySelectorAll('[aria-label],[placeholder],[title]')) {
    for (const attr of ['aria-label','placeholder','title']) if (node.hasAttribute(attr)) localize(node, attr, node.getAttribute(attr), value => node.setAttribute(attr,value));
  }
}
let queued = false;
new MutationObserver(() => {
  if (queued) return; queued = true;
  queueMicrotask(() => { queued = false; translatePage(); });
}).observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['placeholder','aria-label','title'] });
