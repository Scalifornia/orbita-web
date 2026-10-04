import {loadProfile,saveProfile,SkillSession,practiceWords,unlockAchievements,career} from './skill-model.mjs?v=20261005c';
import {RUNS,OFFICE_WORDS,dailyChallenge,bossLevels,shareResult,THREATS,BOSSES} from './missions.mjs?v=20261005c';
import {PremiumArt,dangerLevel}from './premium-art.mjs?v=20261005c';
import {renderProfile,renderRunResult,downloadResult}from './premium-ui.mjs?v=20261005c';
import { drawThreat } from './office-art.mjs?v=20261005c';
import { GameEngine, normalizeText, wordsFromText } from './engine.mjs?v=20261005c';
import { TypingInput } from './input.mjs';
import { stories } from './stories.mjs';
import { setupMenu } from './interface.mjs?v=20261005c';
import { translatePage, t, setLanguage, supportedLanguages, languageTags, previewWords } from './locale.mjs?v=20261005c';
import { Adventure } from './adventure.mjs?v=20261005c';
import { setupReader } from './reader.mjs?v=20261005c';
import { createCampaign } from './campaign.mjs';
import { setupLibrary } from './library.mjs?v=20261005c';
import { documentFromText } from './documentImport.mjs';
import { SceneRenderer } from './scenery.mjs?v=20261005c';
import { LevelTransition } from './transitions.mjs?v=20261005c';
import { loadMusicFile, saveMusicFile } from './music-store.mjs';
import { GameAudio } from './audio.mjs?v=20261005c';
import { WORLD_PRESETS } from './worlds.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const field = $('field');
const input = $('typingInput');
let reducedMotion = readSaved('boring-reduced-motion',false) || matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;

const modeNames = { reading: 'texto seguido', arcade: 'palavras soltas' };
const difficultyNames = { normal: 'normal', hard: 'difícil', extreme: 'extremo' };

function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
let difficulty = readSaved('orbita-difficulty', 'normal');
if (!Object.hasOwn(difficultyNames, difficulty)) difficulty = 'normal';
let mode = readSaved('orbita-mode', 'reading');
if (!Object.hasOwn(modeNames, mode)) mode = 'reading';
let progression = readSaved('orbita-progression', 'campaign');
if (!['campaign', 'endless'].includes(progression)) progression = 'campaign';
let customText = readSaved('orbita-text', '');
if (typeof customText !== 'string') customText = '';
let uiLanguage = readSaved('boring-office-ui-language-v2', 'en');
if (!Object.hasOwn(supportedLanguages,uiLanguage)) uiLanguage='en';
let textOverride=readSaved('boring-text-override','auto');if(textOverride!=='auto'&&!Object.hasOwn(supportedLanguages,textOverride))textOverride='auto';
let textLanguage = textOverride==='auto'?uiLanguage:textOverride;
if (!Object.hasOwn(supportedLanguages,textLanguage)) textLanguage='en';
let world = readSaved('orbita-world-v2', 'office');
if (!['office','earth','space'].includes(world)) world='office';
let story = readSaved('orbita-story-v2', 'office');
if (!stories[story]) story = 'hare';
let advanced = readSaved('orbita-advanced', false) === true;
setLanguage(uiLanguage);
let soundOn = readSaved('orbita-sound', true) === true;
let musicVolume = Math.min(1, Math.max(0, Number(readSaved('orbita-music-volume', 0.25)) || 0));
let sfxVolume = Math.min(1, Math.max(0, Number(readSaved('orbita-sfx-volume', 0.5)) || 0));
const sound = new GameAudio({ enabled: soundOn, musicVolume, sfxVolume, musicStyle:readSaved('boring-music-style','auto') });
sound.setScene('menu');
let audioReady = false;
let menuUI = null;
const adventure = new Adventure();
const reader = setupReader();
const scenery = new SceneRenderer();
const premiumArt=new PremiumArt();
const profileStorage=(()=>{try{return localStorage;}catch{return null;}})();
let profile=loadProfile(profileStorage),skill=null,activeSeconds=0,runKind='campaign',runIdentity=null,lastResult=null,sessionFinished=false;
let adaptiveOn=readSaved('boring-adaptive',true),quality=readSaved('boring-quality','auto'),palette=readSaved('boring-palette','classic');
let targetOfferedAt=0,lastOfferedId=null;
let menuConfig=null;
let impactUntil=0,levelStartMistakes=0,nearMissUntil=0,previousSkillHud=-1;

const transition = new LevelTransition();
let transitionPaused = false, saveTimer = null;
let game = new GameEngine();
let width = 1, height = 1, lastTime = 0, clock = 0;
let projectiles = [], particles = [], rings = [];
let glyphFragments = [], destroyedLetters = new Map();
let ghosts = new Map(), snapshots = new Map(), flashes = new Map();
let toastUntil = 0, damageFlash = 0, lastReadingKey = '', lastHudKey = '';
let textTokens = [];
let resultBest = 0;
let typedDisplay = '', pendingFinish = null;
let snapshotTargetId = null;
const playerShip = new Image();
playerShip.src = './assets/player-ship.png';
const tank = new Image(); tank.src = './assets/tank-player.png';

const earthLevels = ['Vale verde', 'Trilho do bosque', 'Ponte antiga', 'Colina dourada', 'Rio tranquilo', 'Montanha azul', 'Floresta profunda', 'Caminho de pedra', 'Horizonte verde', 'Regresso a casa'];
function levelTitle(level) { return game.boss?t(BOSSES[game.boss.id].name):adventure.campaign ? game.levelTitle : t(world === 'office' ? 'RECURSOS DESUMANOS' : world === 'earth' ? earthLevels[(level - 1) % 10] : game.levelTitle); }
function recordKey() {
  if(!['campaign','endless'].includes(runKind))return `boring-best-${runKind}-${runIdentity?.day||''}-${textLanguage}-${advanced}-${runKind==='daily'?'fixed':`${difficulty}-${world}-${customText?textHash(customText):'default'}`}`;
  return `orbita-v3-best-${difficulty}-${mode}-${progression}-${world}-${textLanguage}-${advanced}-${adventure.campaign ? adventure.campaign.id : customText ? 'custom-' + textHash(customText) : story}`;
}
function textHash(value) { let hash = 2166136261; for (const char of value) hash = Math.imul(hash ^ char.codePointAt(0), 16777619); return (hash >>> 0).toString(16); }
function rankingKey() { return recordKey().replace('best', 'ranking'); }
function rankingRows() { const rows = readSaved(rankingKey(), []); return Array.isArray(rows) ? rows.filter(row => row && Number.isFinite(row.score) && Number.isFinite(row.accuracy) && Number.isFinite(row.wpm) && typeof row.date === 'string').slice(0, 10) : []; }
function showRanking() {
  $('rankingConfig').textContent = [t(world === 'office' ? 'Escritório' : world === 'earth' ? 'Terra' : 'Espaço'), textLanguage.toUpperCase(), t(advanced ? 'Avançada' : 'Básica'), t(difficultyNames[difficulty]), t(modeNames[mode]), t(progression === 'campaign' ? 'Campanha' : 'Infinito'), customText ? t('Texto personalizado') : stories[story][textLanguage].title].join(' · ');
  const rows = rankingRows(); $('rankingList').replaceChildren();
  for (const row of rows) { const li = document.createElement('li'); li.textContent = `${row.score} ${t('pontos')} · ${Math.round(row.accuracy)}% · ${Math.round(row.wpm)} ${t('pal./min')} · ${new Date(row.date).toLocaleDateString(languageTags[uiLanguage])}`; $('rankingList').append(li); }
  $('rankingStatus').textContent = rows.length ? '' : t('Ainda não há partidas nesta configuração.');
  $('optionsDialog').close(); $('rankingDialog').showModal();
}
function updateMenu() {
  for (const select of document.querySelectorAll('[data-setting]')) select.value = ({difficulty,mode,progression})[select.dataset.setting];
  document.querySelectorAll('[data-writing]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.writing==='advanced')===advanced)));

  document.body.classList.toggle('earth', world === 'earth');
  document.body.classList.toggle('office', world === 'office');
  $('worldDescription').textContent=t(world==='office'?'Uma pausa. Uma tarefa de cada vez. Sem reuniões.':world==='space'?'Sobrevive às vagas: alvos livres, ritmo rápido e missão infinita.':'Abranda e afina a escrita: história seguida com pontuação e acentos exatos.');
  document.querySelectorAll('[data-world]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.world===world)));
  document.querySelector('.field-coordinate').textContent = world === 'office' ? 'RECURSOS DESUMANOS' : world === 'earth' ? 'TERRA · MISSÃO FLORESTA' : 'SECTOR 07 · SISTEMA ÓRBITA';
  lastHudKey = '';
  document.querySelector('.ship-card .eyebrow').textContent = world === 'earth' ? 'O TEU TANQUE' : 'A TUA NAVE';
  document.querySelector('.ship-card img').src = world === 'earth' ? tank.src : playerShip.src;
  document.querySelector('.ship-card img').alt = t(world === 'earth' ? 'O teu tanque' : 'A tua nave');
  document.querySelector('.ship-card strong').textContent = world === 'earth' ? 'TANK' : 'INTERCEPTOR';
  for (const [id, value] of Object.entries({uiLanguage, world, story, writing: advanced ? 'advanced' : 'basic'})) $(id).value = value;
  for (const option of $('story').options) option.textContent = stories[option.value][textLanguage].title;
  document.querySelectorAll('[data-difficulty]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.difficulty === difficulty)));
  document.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  document.querySelectorAll('[data-progression]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.progression === progression)));
  $('recordValue').textContent = String(Number(readSaved(recordKey(), 0)) || 0).padStart(5, '0');
  $('recordCaption').textContent = `${difficultyNames[difficulty]} · ${progression === 'campaign' ? 'campanha' : 'infinito'}${customText ? ' · teu texto' : ''}`;
  $('customButton').textContent = 'Carregar texto/documento';
  $('campaignLengthLabel').textContent=t(mode==='reading'?'História completa':'10 níveis');
  const savedAdventure = adventure.summary();
  menuUI?.sync({language:uiLanguage, summary: `${t(world === 'office' ? 'Escritório' : world === 'earth' ? 'Terra' : 'Espaço')} · ${customText ? t('Texto personalizado') : stories[story][textLanguage].title}`, resume:savedAdventure ? `${savedAdventure.title} · ${t('Capítulo {number}',{number:savedAdventure.chapter})} · ${Math.round(savedAdventure.percent)}%` : ''});
  const instruction = document.querySelector('.instructions p');
  instruction.replaceChildren(
    document.createTextNode(mode === 'reading' ? 'Acompanha o texto.' : 'Escolhe um alvo.'),
    document.createElement('br'),
    Object.assign(document.createElement('b'), { textContent: mode === 'reading' ? 'Escreve a palavra destacada.' : 'Escreve a primeira letra.' }),
  );
}

function resizeViewport() {
  const view = window.visualViewport;
  document.documentElement.style.setProperty('--view-height', `${view?.height ?? window.innerHeight}px`);
  document.documentElement.style.setProperty('--view-top', `${view?.offsetTop ?? 0}px`);
  $('viewport').classList.toggle('compact', (view?.height ?? innerHeight) < 560);
}
function resizeCanvas() {
  const rect = field.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
new ResizeObserver(resizeCanvas).observe(field);
window.addEventListener('resize', resizeViewport);
window.visualViewport?.addEventListener('resize', resizeViewport);
window.visualViewport?.addEventListener('scroll', resizeViewport);
resizeViewport();

function unlockAudio() {
  if (!soundOn) return;
  sound.unlock().then((ready) => {
    audioReady = ready;
    updateSoundButton();
  }).catch(() => { audioReady = false; updateSoundButton(); });
}
function tone(type) { sound.effect(type); }
function updateSoundButton() {
  $('menuMusicLabel').textContent = soundOn && audioReady ? 'NEON DRIFT · música ativa' : 'Ouvir música do menu';
  $('menuMusicButton').classList.toggle('playing', soundOn && audioReady);
  $('soundButton').setAttribute('aria-label', soundOn ? 'Desativar som' : 'Ativar som');
  $('soundButton').setAttribute('aria-pressed', String(soundOn));
  $('soundButton').classList.toggle('muted',!soundOn);
  $('soundWaves').setAttribute('d', soundOn ? 'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14' : 'm16 9 5 6m0-6-5 6');
}
$('soundButton').addEventListener('click', () => {
  soundOn = !soundOn; sound.setEnabled(soundOn); save('orbita-sound', soundOn); unlockAudio(); updateSoundButton();
});

function snapshot() {
  snapshotTargetId = game.targetId;
  for (const enemy of game.enemies) snapshots.set(enemy.id, { ...enemy });
}
function point(enemy) {
  let fontSize = width < 480 ? 15 : 17;
  ctx.font = `500 ${fontSize}px monospace`;
  const measured = ctx.measureText(enemy.word || '').width;
  if (measured > width - 60) fontSize *= (width - 60) / measured;
  ctx.font = `500 ${fontSize}px "Space Grotesk", monospace`;
  const half = ctx.measureText(enemy.word || '').width / 2 + 18;
  const x = Math.max(half + 7, Math.min(width - half - 7, enemy.x * width));
  const top = Math.min(52, height * 0.18);
  const travel = Math.max(36, height - top - 100);
  return { x, y: top + enemy.y * travel, fontSize, half };
}
function shipPosition() { return { x: width / 2, y: height - (width < 480 ? 44 : 43) }; }

function updateTypedEcho() {
  const echo = $('typedEcho');
  echo.textContent = typedDisplay || t(input.placeholder);
  echo.classList.toggle('placeholder', !typedDisplay);
  echo.scrollLeft = echo.scrollWidth;
}
function endTypedFragment() {
  if (typedDisplay && !typedDisplay.endsWith(' ')) typedDisplay += ' ';
  typing.format(typedDisplay); typing.applyFormat(); updateTypedEcho();
}

const typing = new TypingInput(input, (text) => {
  if (game.status !== 'playing' || transition.startedAt !== null) { typing.format(typedDisplay); return; }
  for (const char of (advanced ? text.normalize('NFC') : normalizeText(text))) {
    if (advanced ? !/^\S$/u.test(char) : !/^[\p{L}]$/u.test(char)) continue;
    snapshot();
    const before=game.enemies.find(e=>e.id===game.targetId)||game.enemies.filter(e=>e.word.slice(e.progress,e.progress+char.length)===char).sort((a,b)=>b.y-a.y||a.id-b.id)[0];
    const expected=before?.word.slice(before.progress,before.progress+char.length)||null;
    const correct=game.typeChar(char);
    skill?.record({typed:char,expected,correct,time:clock*1000,wordId:before?.id,reaction:correct&&before?.progress===char.length?Math.max(0,mode==='reading'?(clock-targetOfferedAt)*1000:(game.elapsed-before.born)*1000):null});
    if(correct)typedDisplay+=char;
    handleEvents();
  }
  if (typedDisplay.length > 240) typedDisplay = typedDisplay.slice(typedDisplay.indexOf(' ', typedDisplay.length - 220) + 1);
  typing.format(typedDisplay);
  updateTypedEcho();
  updateHud();
  queueSave();
});

function focusInput() {
  input.disabled = false;
  input.focus({ preventScroll: true });
  input.setSelectionRange(input.value.length, input.value.length);
}
function settings() { return {difficulty,mode,progression,advanced,world,textLanguage,story,officeTactics:world==='office',mobile:coarsePointer}; }
function saveProgress() {
  clearTimeout(saveTimer); saveTimer=null;
  if (!adventure.campaign) return;
  const saved=adventure.save(game,typedDisplay);
  menuUI?.status(saved ? '' : 'Não foi possível guardar o progresso.');
}
function queueSave() { if (adventure.campaign && !saveTimer) saveTimer=setTimeout(saveProgress,250); }
function setReadingSource() {
  const source=adventure.campaign?.levels[game.level-1]?.text || game._levels?.[game.level-1]?.text || game._sourceText || customText || stories[story][textLanguage].text;
  textTokens=advanced ? wordsFromText(source,true) : (source.normalize('NFC').match(/\p{L}+[\p{M}]*(?:[^\p{L}\p{N}]*|$)/gu)||[]);
  lastReadingKey='';
}
function activateGame(restoredText='') {
  skill=new SkillSession({profile,mode:runKind});activeSeconds=0;sessionFinished=false;levelStartMistakes=game.mistakes;previousSkillHud=-1;
  sound.setRetro(runKind==='retro');document.body.classList.toggle('retro',runKind==='retro');
  transition.clear(); transitionPaused=false;
  projectiles=[];particles=[];rings=[];ghosts.clear();snapshots.clear();flashes.clear();
  lastHudKey='';lastReadingKey='';damageFlash=0;
  glyphFragments=[];destroyedLetters.clear();typedDisplay=restoredText;pendingFinish=null;
  resultBest=Number(readSaved(recordKey(),0))||0;
  typing.exact=advanced;typing.reset();typing.format(typedDisplay);typing.applyFormat();setReadingSource();
  $('startPanel').hidden=true;$('resultPanel').hidden=true;$('pausePanel').hidden=true;$('levelCompletion').hidden=true;
  $('readBookButton').hidden=mode!=='reading';$('readingStrip').hidden=mode!=='reading';$('typingDock').classList.toggle('reading',mode==='reading');
  $('campaignProgress').hidden=!adventure.campaign;
  // Keep focus synchronous with the initiating tap for mobile Safari.
  focusInput();unlockAudio();sound.setScene('game');scenery.enter(clock);tone('start');
  $('pauseButton').disabled=false;$('releaseButton').disabled=mode==='reading';
  input.placeholder=t(mode==='reading'?'Escreve a palavra destacada…':'Escreve uma palavra para disparar…');
  handleEvents();updateHud();updateTypedEcho();translatePage();
}
function beginDocument(document,officeFinal=false) {
  finishSkill(false);
  runKind='campaign';runIdentity=null;
  mode='reading';progression='campaign';
  game=adventure.begin(document,settings());
  if(officeFinal){const extra=bossLevels(textLanguage,advanced).filter(l=>l.boss==='monday');let offset=adventure.campaign.totalWords;const chapter=Math.max(...adventure.campaign.levels.map(l=>l.chapterIndex))+1;for(const l of extra){l.startWord=offset;offset+=l.wordCount;l.endWord=offset;l.chapterIndex=chapter;}adventure.campaign.levels.push(...extra);adventure.campaign.totalWords=offset;game=new GameEngine({...settings(),mode:'reading',campaignLevels:adventure.campaign.levels}).start();}
  updateMenu();activateGame();saveProgress();
}
function startGame() {
  finishSkill(false);
  textLanguage=textOverride==='auto'?uiLanguage:textOverride;
  runKind='campaign';runIdentity=null;
  const source=customText || stories[story][textLanguage].text;
  if(mode==='reading' && progression==='campaign') {
    beginDocument(documentFromText(source,customText?t('Texto personalizado'):stories[story][textLanguage].title),!customText&&world==='office'&&story==='office');return;
  }
  adventure.detach();runKind=progression==='endless'?'endless':'campaign';game=new GameEngine({...settings(),customText:source}).start();activateGame();
}
function continueGame() {
  finishSkill(false);
  runKind='campaign';runIdentity=null;
  $('optionsDialog').close();
  const saved=adventure.resume();if(!saved)return;
  ({difficulty,world,textLanguage,story,advanced}=saved.settings);mode='reading';progression='campaign';
  game=saved.engine;if(game.status==='paused')game.resume();
  updateMenu();activateGame(saved.typedDisplay);
  if(game.status==='transition')beginTransition();
}
function pause(reason='Retoma quando estiveres pronto.') {
  if (!['playing','transition'].includes(game.status) || transitionPaused) return;
  if(game.status==='transition')transitionPaused=true;else game.pause();
  saveProgress();sound.setScene('paused');$('pauseReason').textContent=t(reason);
  $('pausePanel').hidden=false;$('levelCompletion').hidden=true;$('pauseButton').disabled=true;
  input.blur();$('resumeButton').focus({preventScroll:true});
}
function resume() {
  if(game.status!=='paused'&&!transitionPaused)return;
  if(game.status==='paused')game.resume();transitionPaused=false;
  $('pausePanel').hidden=true;$('pauseButton').disabled=false;
  focusInput();unlockAudio();sound.setScene('game');
}
function menu() {
  finishSkill(false);document.body.classList.remove('retro');sound.setRetro(false);if(menuConfig){({difficulty,mode,progression,advanced,world,story}=menuConfig);menuConfig=null;}
  saveProgress();adventure.detach();transition.clear();transitionPaused=false;
  runKind=progression==='endless'?'endless':'campaign';runIdentity=null;
  game=new GameEngine();sound.setScene('menu');
  glyphFragments=[];destroyedLetters.clear();typedDisplay='';pendingFinish=null;
  projectiles=[];particles=[];rings=[];ghosts.clear();snapshots.clear();flashes.clear();
  $('pausePanel').hidden=true;$('resultPanel').hidden=true;$('startPanel').hidden=false;$('levelCompletion').hidden=true;
  $('campaignProgress').hidden=true;$('readingStrip').hidden=true;$('typingDock').classList.remove('reading');
  $('pauseButton').disabled=true;$('releaseButton').disabled=true;
  typing.reset();input.disabled=true;input.placeholder=t('O teu teclado é o comando.');
  $('waveToast').classList.remove('visible');toastUntil=0;
  lastHudKey='';updateMenu();updateHud();updateTypedEcho();translatePage();
  $('startButton').focus({preventScroll:true});
}
function beginTransition() {
  const level=adventure.campaign?.levels[game.level-1]||game._levels?.[game.level-1];if(!level)return;
  $('completionTag').textContent=t('Pausa merecida. Sem pedir autorização.');
  $('completionTitle').textContent=game.boss?t(level.title):level.title;
  $('completionStats').textContent=`${game.score} ${t('pontos')} · ${Math.round(game.accuracy)}% · ${Math.round(game.wpm)} ${t('pal./min')}`;
  const percent=Math.round(adventure.campaign?adventure.percent(game):100*game.level/(game._levels?.length||1));
  $('completionFill').style.width=`${percent}%`;$('completionProgress').textContent=`${percent}%`;
  $('completionText').textContent=level.text;
  transition.start(clock,{}, {chapter:level.isChapterEnd,reducedMotion,readingWords:level.wordCount});saveProgress();
}
function advanceLevel() {
  if(game.status!=='transition')return;
  game.nextLevel();setReadingSource();lastHudKey='';
  typing.reset();typedDisplay='';updateTypedEcho();handleEvents();saveProgress();
}

function finish() {
  finishSkill(game.status==='won');
  const rows = [...rankingRows(), { score: game.score, accuracy: game.accuracy, wpm: game.wpm, date: new Date().toISOString() }].sort((a, b) => b.score - a.score || b.accuracy - a.accuracy).slice(0, 10);
  const rankingSaved = save(rankingKey(), rows);
  input.blur(); input.disabled = true;
  $('pauseButton').disabled = true; $('releaseButton').disabled = true;
  const isBest = game.score > resultBest;
  const saved = isBest ? save(recordKey(), game.score) : true;
  $('resultTag').textContent = isBest ? (saved ? 'NOVO RECORDE. BEM VOADO.' : 'NOVO RECORDE NESTA PARTIDA.') : 'A PRÓXIMA VAGA É TUA.';
  const victory = game.status === 'won';
  $('resultHeading').textContent = victory ? 'Turno terminado. Recuperaste a tua vida.' : 'A produtividade foi dar uma volta.';
  if (victory) { $('resultTag').textContent = t(adventure.campaign ? 'Campanha concluída' : '10 NÍVEIS. MISSÃO CUMPRIDA.'); if(adventure.campaign)adventure.complete(); } else saveProgress();
  sound.setScene('menu');
  tone(victory ? 'victory' : 'gameover');
  $('resultScore').textContent = game.score.toLocaleString(languageTags[uiLanguage]);
  $('resultWave').textContent = game.wave;
  $('resultAccuracy').textContent = `${Math.round(game.accuracy)}%`;
  $('resultWpm').textContent = Math.round(game.wpm);
  if(runKind==='boss'&&victory)$('resultTag').textContent=t('HOJE NÃO, SEGUNDA-FEIRA');
  if(game.sessionSeconds&&victory)$('resultTag').textContent=t('Pausa concluída. O trabalho pode esperar.');
  $('resultPanel').classList.toggle('personal-best',isBest);
  $('resultPanel').hidden = false;
  if (!rankingSaved) $('resultTag').textContent = t('Não foi possível guardar o ranking neste navegador.');
  $('retryButton').focus({ preventScroll: true });
  updateMenu();
}

function handleEvents() {
  for (const event of game.drainEvents()) {
    if (event.type === 'hit') {
      const origin = shipPosition();
      projectiles.push({ enemyId: event.enemyId, progress: event.progress, letterIndex: event.progress - event.letter.length, x: origin.x, y: origin.y - 27, age: 0, duration: 0.1 + Math.min(0.065, height / 7000), done: false, finish: false });
      flashes.set('ship', clock + 0.08);
      tone('shot');
      if(game.streak>0 && game.streak%20===0) { sound.effect('combo',Math.min(5,game.streak/20));$('combo').classList.remove('combo-pop');void $('combo').offsetWidth;$('combo').classList.add('combo-pop'); }
    } else if (event.type === 'destroy') {
      impactUntil=clock+(game.boss?.phase===3?.3:.12);
      typedDisplay += ' ';
      const enemy = snapshots.get(event.enemyId);
      if(enemy?.y>.78){nearMissUntil=clock+1.2;}
      if (enemy) ghosts.set(event.enemyId, { ...enemy, progress: enemy.word.length });
      const shot = projectiles.findLast((item) => item.enemyId === event.enemyId);
      if (shot) shot.finish = true;
    } else if (event.type === 'miss') {
      $('typingDock').classList.add('error');
      flashes.set('error', clock + 0.18); tone('miss');
    } else if (event.type === 'damage') {
      if (event.enemyId === snapshotTargetId) endTypedFragment();
      const position = point(event);
      burst(position.x, Math.min(height - 35, position.y), true, '#ff845e');
      damageFlash = 0.28; tone('damage');
    } else if (event.type === 'levelComplete') {
      noteLevel();beginTransition();
    } else if (event.type === 'coffee') {
      $('waveToast').textContent=t('CAFÉ: 5 SEGUNDOS DE PAZ.');$('waveToast').classList.add('visible');toastUntil=clock+2;tone('combo');
    } else if (event.type === 'wave') {
      levelStartMistakes=game.mistakes;
      scenery.enter(clock);
      $('waveToast').textContent = `NÍVEL ${String(event.level).padStart(2, '0')} · ${levelTitle(event.level).toUpperCase()}`;
      $('waveToast').classList.add('visible'); toastUntil = clock + 2.4;
      if(game.boss){$('waveToast').textContent=t(BOSSES[game.boss.id].name)+' · '+t('Fase')+' '+game.boss.phase;tone('level');}else if (event.level > 1) tone('level');
    } else if (event.type === 'over' || event.type === 'victory') {
      if(event.type==='victory'&&!event.timed)noteLevel();
      input.disabled = true; $('pauseButton').disabled = true;
      pendingFinish = clock + 0.65;
    }
  }
}

function updateReading() {
  if (mode !== 'reading' || !textTokens.length) return;
  const index = game.readingIndex || 0;
  const target = game.enemies.find((enemy) => enemy.id === game.targetId) || game.enemies[0];
  const key = `${index}:${target?.progress || 0}`;
  if (key === lastReadingKey) return;
  lastReadingKey = key;
  const fragment = document.createDocumentFragment();
  for (let offset = Math.max(-8, -index); offset <= 35; offset++) {
    if(adventure.campaign && index+offset>=textTokens.length)break;
    const token = textTokens[(index + offset) % textTokens.length];
    const span = document.createElement('span');
    span.className = offset < 0 ? 'read-done' : offset === 0 ? 'read-current' : '';
    if (offset === 0) {
      const accepted = document.createElement('span');
      accepted.className = 'read-letter';
      accepted.textContent = token.slice(0, target?.progress || 0);
      span.append(accepted, document.createTextNode(token.slice(target?.progress || 0)));
    } else span.textContent = token;
    fragment.append(span, document.createTextNode(' '));
  }
  $('readingText').replaceChildren(fragment);
  const current = $('readingText').querySelector('.read-current');
  if (current) {
    const top = current.getBoundingClientRect().top - $('readingText').getBoundingClientRect().top;
    $('readingText').scrollTop = Math.max(0, $('readingText').scrollTop + top - 28);
  }
}
function updateHud() {
  const target = game.enemies.find((enemy) => enemy.id === game.targetId);
  if(target?.id!==lastOfferedId){lastOfferedId=target?.id;targetOfferedAt=clock;}
  const key = `${game.score}:${game.wave}:${game.lives}:${game.mistakes}:${game.streak}:${target?.id}:${target?.progress}:${game.status}:${game.speedPercent}`;
  if (key === lastHudKey) return;
  lastHudKey = key;
  const configuring = !['playing','paused','transition'].includes(game.status);
  document.querySelectorAll('[data-world],[data-writing],select[data-setting]').forEach(control=>{control.disabled=!configuring;});
  $('scoreValue').textContent = String(game.score).padStart(5, '0');
  $('waveValue').textContent = String(game.wave).padStart(2, '0');
  $('speedValue').textContent = `${game.speedMultiplier.toFixed(2)}×`;
  $('levelName').textContent = `${String(game.level).padStart(2, '0')} / ${levelTitle(game.level).toUpperCase()}`;
  $('levelCount').textContent = `${adventure.campaign ? game.readingIndex : game.levelKills} / ${game.levelGoal}`;
  $('levelFill').style.width = `${game.levelProgress * 100}%`;
  sound.setIntensity(game.speedMultiplier);
  $('shields').setAttribute('aria-label', `${game.lives} vidas`);
  [...$('shields').children].forEach((element, index) => element.classList.toggle('lost', index >= game.lives));
  $('accuracyValue').textContent = `${Math.round(game.accuracy)}% · ESPAÇOS AUTO`;
  $('combo').textContent = game.streak >= 5 ? `${game.streak} LETRAS SEGUIDAS ↗` : '';
  $('targetHint').textContent = game.status === 'ready' ? 'COMPUTADOR OU TELEMÓVEL. TU ESCOLHES.' : target ? `ALVO: ${target.word} · ${target.progress}/${target.word.length}` : 'ESCOLHE UMA PALAVRA E COMEÇA A ESCREVER';
  if(adventure.campaign) { $('campaignTitle').textContent=adventure.campaign.title;$('campaignPercent').textContent=`${Math.round(adventure.percent(game))}%`; }
  updateReading();
}

function burst(x, y, big = false, color = '#58f3ff') {
  const count = reducedMotion||lowQuality() ? 5 : big ? 38 : 12;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (big ? 45 : 20) + Math.random() * (big ? 130 : 55);
    const life = big ? 0.35 + Math.random() * 0.35 : 0.15 + Math.random() * 0.2;
    if(particles.length>=180)particles.shift();
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color, size: big ? 1 + Math.random() * 2 : 1 });
  }
  if (big) rings.push({ x, y, age: 0, color });
}
function letterPoint(enemy, index) {
  const position = point(enemy);
  ctx.font = `500 ${position.fontSize}px "Space Grotesk", monospace`;
  const textWidth = ctx.measureText(enemy.word).width;
  const prefixWidth = ctx.measureText(enemy.word.slice(0, index)).width;
  const letterWidth = ctx.measureText(Array.from(enemy.word.slice(index))[0] || '').width;
  return { ...position, x: position.x - textWidth / 2 + prefixWidth + letterWidth / 2, y: position.y + 32 - position.fontSize * .35, letterWidth };
}
function explodeLetter(enemy, index, position) {
  if (!destroyedLetters.has(enemy.id)) destroyedLetters.set(enemy.id, new Set());
  const destroyed = destroyedLetters.get(enemy.id);
  if (destroyed.has(index)) return;
  destroyed.add(index);
  burst(position.x, position.y, false, '#b4ff39');
  rings.push({ x: position.x, y: position.y, age: 0, color: '#a779ff', small: true });
  for (let piece = 0; piece < (reducedMotion ? 2 : 6); piece++) {
    const angle = piece * Math.PI / 3 + Math.random() * .4;
    glyphFragments.push({ char: Array.from(enemy.word.slice(index))[0], x: position.x, y: position.y,
      vx: Math.cos(angle) * (28 + Math.random() * 46), vy: Math.sin(angle) * 45 - 12,
      age: 0, piece, rotation: 0, spin: (Math.random() - .5) * 5,
      fontSize: position.fontSize, letterWidth: position.letterWidth });
  }
  glyphFragments = glyphFragments.slice(lowQuality()?-30:-120);
}
function updateEffects(dt) {
  for (const ghost of ghosts.values()) ghost.y += ghost.speed * game.speedMultiplier * dt;
  for (const shot of projectiles) {
    shot.age += dt;
    const enemy = game.enemies.find((item) => item.id === shot.enemyId) || ghosts.get(shot.enemyId) || snapshots.get(shot.enemyId);
    if (!enemy) { shot.done = true; continue; }
    const destination = letterPoint(enemy, shot.letterIndex);
    const source = shipPosition();
    const fraction = Math.min(1, shot.age / shot.duration);
    shot.x = source.x + (destination.x - source.x) * fraction;
    shot.y = source.y - 27 + (destination.y - source.y + 27) * fraction;
    shot.angle = Math.atan2(destination.y - source.y, destination.x - source.x);
    if (fraction >= 1) {
      shot.done = true;
      explodeLetter(enemy, shot.letterIndex, destination);
      if (shot.finish) {
        const centre = point(enemy);
        burst(centre.x, centre.y, true, '#ff8939');
        burst(centre.x, centre.y, false, '#c672ff');
        ghosts.delete(shot.enemyId); snapshots.delete(shot.enemyId); flashes.delete(shot.enemyId);
        tone('destroy');
      } else {
        flashes.set(shot.enemyId, clock + 0.1); tone('hit');
      }
    }
  }
  projectiles = projectiles.filter((shot) => !shot.done);
  for (const particle of particles) {
    particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt;
    particle.vx *= Math.exp(-3 * dt); particle.vy *= Math.exp(-3 * dt);
  }
  particles = particles.filter((particle) => particle.life > 0).slice(-280);
  for (const fragment of glyphFragments) {
    fragment.age += dt; fragment.x += fragment.vx * dt; fragment.y += fragment.vy * dt;
    fragment.vy += 45 * dt; fragment.rotation += fragment.spin * dt;
  }
  glyphFragments = glyphFragments.filter((fragment) => fragment.age < .5);
  rings.forEach((ring) => { ring.age += dt; }); rings = rings.filter((ring) => ring.age < 0.45);
  if ((flashes.get('error') || 0) < clock) $('typingDock').classList.remove('error');
  if (toastUntil && clock > toastUntil) { $('waveToast').classList.remove('visible'); toastUntil = 0; }
  damageFlash = Math.max(0, damageFlash - dt);
}

function drawBackground(time) {
  sound.setMusicContext(game.level,world);
  const musicTitle=sound.currentTrack().title;
  if($('musicNow').textContent!==musicTitle)$('musicNow').textContent=musicTitle;

  scenery.drawBackground(ctx,{width,height,time,world,level:game.level,playing:game.status==='playing',speed:game.speedMultiplier,reducedMotion});
  if(world==='office'||runKind==='retro')premiumArt.draw(ctx,{width,height,time,level:game.level,retro:runKind==='retro',reducedMotion,combo:game.streak,boss:game.boss});
}
function drawShip(time) {
  if(runKind==='retro'){premiumArt.drawRetroPlayer(ctx,{...shipPosition(),time:reducedMotion?0:time,shooting:(flashes.get('ship')||0)>clock,reducedMotion});return;}
  scenery.drawPlayer(ctx,{width,height,time,world,playing:game.status==='playing',reducedMotion,position:shipPosition(),shooting:(flashes.get('ship')||0)>clock,ship:playerShip,tank});
}
function drawEnemy(enemy, demo = false) {
  const { x, y, fontSize, half } = point(enemy);
  const active = !demo && enemy.id === game.targetId;
  const flash = (flashes.get(enemy.id) || 0) > clock;
  const neon = active ? '#ff9853' : world === 'earth' ? '#b5ce87' : enemy.id % 2 ? '#b688ff' : '#59dfff';
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = demo ? .55 : 1;
  ctx.fillStyle = active ? '#5b263e' : '#252b58'; ctx.strokeStyle = neon; ctx.lineWidth = 1;
  ctx.shadowColor = neon; ctx.shadowBlur = reducedMotion ? 0 : active ? 12 : 6;
  if (flash) ctx.fillStyle = '#bcffeb';
  const art={world,id:enemy.archetype?THREATS[enemy.archetype]?.art??enemy.id:enemy.id,time:reducedMotion?0:clock,active,flash};if(runKind==='retro')premiumArt.drawRetroThreat(ctx,art);else drawThreat(ctx,art);ctx.shadowBlur=0;
  ctx.fillStyle = active ? '#bbff4b' : '#64deff'; ctx.fillRect(-2, -2, 4, 4);
  if(enemy.archetype==='urgent'||enemy.archetype==='deadline'){ctx.fillStyle=THREATS[enemy.archetype].color;ctx.font='bold 12px monospace';ctx.fillText(enemy.archetype==='urgent'?'!':'⌛',22,-20);}
  const textY = 32;
  ctx.font = `500 ${fontSize}px "Space Grotesk", monospace`;
  const textWidth = ctx.measureText(enemy.word).width;
  ctx.fillStyle = active ? '#181933f5' : '#0b1027eb'; ctx.strokeStyle = active ? '#b8ff698e' : '#a681ff60';
  ctx.beginPath(); ctx.roundRect(-textWidth / 2 - 10, textY - fontSize, textWidth + 20, fontSize + 11, 4); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'left';
  const destroyed = destroyedLetters.get(enemy.id);
  let index = 0;
  for (const glyph of enemy.word) {
    const left = -textWidth / 2 + ctx.measureText(enemy.word.slice(0, index)).width;
    if (destroyed?.has(index)) {
      ctx.fillStyle = '#69d7d038'; ctx.fillRect(left, textY + 2, Math.max(3, ctx.measureText(glyph).width - 2), 1);
    } else {
      ctx.fillStyle = index < enemy.progress ? '#baff62' : '#f4f2ff';
      if(active&&index===enemy.progress){ctx.fillStyle='#87ede1';ctx.fillRect(left,textY+4,Math.max(4,ctx.measureText(glyph).width-1),2);ctx.fillStyle='#fff';}
      ctx.fillText(glyph, left, textY);
    }
    index += glyph.length;
  }
  if (active) {
    ctx.strokeStyle = '#5ceeff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-half - 4, 0); ctx.lineTo(-half - 4, -10); ctx.lineTo(-half + 3, -10); ctx.moveTo(half + 4, 0); ctx.lineTo(half + 4, -10); ctx.lineTo(half - 3, -10); ctx.stroke();
  }
  ctx.restore();
}
function drawEffects() {
  for (const shot of projectiles) {
    ctx.save(); ctx.translate(shot.x, shot.y); ctx.rotate(shot.angle);
    const trail = ctx.createLinearGradient(-42, 0, 5, 0); trail.addColorStop(0, '#b366ff00'); trail.addColorStop(.5, '#bc5fff80'); trail.addColorStop(1, '#8bffff');
    ctx.fillStyle = trail; ctx.fillRect(-42, -1.5, 45, 3);
    ctx.shadowColor = '#31d8ff'; ctx.shadowBlur = reducedMotion ? 0 : 12;
    ctx.fillStyle = '#efffff'; ctx.fillRect(0, -2, 7, 4); ctx.restore();
  }
  for (const fragment of glyphFragments) {
    ctx.save(); ctx.translate(fragment.x, fragment.y); ctx.rotate(fragment.rotation);
    ctx.globalAlpha = Math.max(0, 1 - fragment.age / .5);
    const w = fragment.letterWidth + 4, h = fragment.fontSize + 4;
    const col = fragment.piece % 2, row = Math.floor(fragment.piece / 2);
    ctx.beginPath(); ctx.rect(-w / 2 + col * w / 2, -h / 2 + row * h / 3, w / 2 + 1, h / 3 + 1); ctx.clip();
    ctx.font = `500 ${fragment.fontSize}px "Space Grotesk", monospace`;
    ctx.textAlign = 'center'; ctx.fillStyle = '#d9ff72';
    ctx.shadowColor = '#a4ff32'; ctx.shadowBlur = reducedMotion ? 0 : 6;
    ctx.fillText(fragment.char, 0, fragment.fontSize * .35); ctx.restore();
  }
  for (const particle of particles) {
    ctx.globalAlpha = particle.life / particle.max; ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  for (const ring of rings) {
    ctx.globalAlpha = 1 - ring.age / .45; ctx.strokeStyle = ring.color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ring.x, ring.y, 3 + ring.age * (ring.small ? 38 : 110), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (damageFlash && !reducedMotion) { ctx.fillStyle = `rgba(255,105,69,${damageFlash * .35})`; ctx.fillRect(0, 0, width, height); }
}
function frame(timestamp) {
  const dt = Math.min((timestamp - (lastTime || timestamp)) / 1000, 0.05);
  lastTime = timestamp;
  const frozen = game.status === 'paused' || transitionPaused || document.hidden;
  if (!frozen) clock += dt;
  snapshot();if(!frozen && transition.startedAt===null){if(game.status==='playing'){activeSeconds+=dt;if(skill)game.pressure=skill.pressure(game.pressure,dt,{fixed:runKind==='daily'||!adaptiveOn,mobile:coarsePointer});}game.tick(dt);}handleEvents();
  if(!frozen && transition.startedAt!==null) {
    const step=transition.sample(clock);if(step.advance){advanceLevel();focusInput();}
    $('completionProgress').textContent=`${Math.ceil(step.remaining ?? 0)} s`;
    $('levelCompletion').hidden=!step.active;$('levelCompletion').style.opacity=step.opacity;
    for(const element of $('levelCompletion').children)element.style.visibility=step.showSummary?'visible':'hidden';
    if(!step.active){transition.clear();scenery.enter(clock);}
  }
  if (!frozen) updateEffects(dt);
  if (pendingFinish !== null && clock >= pendingFinish) { pendingFinish = null; finish(); }
  updateHud(); drawBackground(reducedMotion ? 0 : clock);
  if (game.status === 'ready') {
    drawEnemy({ id: -1, word: world === 'office' ? stories.office[textLanguage].text.split(/\s+/u)[0] : previewWords[textLanguage][world], progress: 0, x: .16, y: .18 + Math.sin((reducedMotion?0:clock) * .2) * .025 }, true);
    drawEnemy({ id: -2, word: previewWords[textLanguage].discover, progress: 0, x: .85, y: .49 + Math.sin((reducedMotion?0:clock) * .25) * .025 }, true);
    drawEnemy({ id: -3, word: previewWords[textLanguage].horizon, progress: 0, x: .19, y: .79 }, true);
  } else {
    ctx.save();if(!reducedMotion&&!lowQuality()&&impactUntil>clock)ctx.translate(Math.sin(clock*65)*1.5,Math.cos(clock*51)*1);
    for (const enemy of game.enemies) drawEnemy(enemy);
    for (const ghost of ghosts.values()) drawEnemy(ghost);
    ctx.restore();
  }
  drawShip(clock); drawEffects();
  updateMissionHud();
  const danger=dangerLevel(game.enemies);sound.setGameplayLayers({danger,boss:Boolean(game.boss),combo:game.streak});
  if(danger>.78){ctx.strokeStyle='#ffbd87';ctx.lineWidth=3;ctx.strokeRect(3,3,width-6,height-6);ctx.fillStyle='#ffcf96';ctx.font='bold 11px monospace';ctx.textAlign='right';ctx.fillText('! '+t('PRAZO A CHEGAR'),width-12,height-12);}
  if(nearMissUntil>clock){ctx.fillStyle='#abebd0';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(t('MESMO A TEMPO.'),width/2,height-75);}
  // Bound snapshots after missed enemies while retaining in-flight targets.
  const retained = new Set([...game.enemies.map((enemy) => enemy.id), ...ghosts.keys(), ...projectiles.map((shot) => shot.enemyId)]);
  for (const id of snapshots.keys()) if (!retained.has(id)) snapshots.delete(id);
  for (const id of destroyedLetters.keys()) if (!retained.has(id)) destroyedLetters.delete(id);
  requestAnimationFrame(frame);
}

$('startButton').addEventListener('click', startGame);
$('retryButton').addEventListener('click', () => runKind!=='campaign'?launchRun(runKind):adventure.record ? continueGame() : startGame());
$('continueButton').addEventListener('click',continueGame);
$('nextLevelButton').addEventListener('click',()=>{if(game.status!=='transition'||transitionPaused)return;advanceLevel();transition.clear();$('levelCompletion').hidden=true;scenery.enter(clock);focusInput();});
$('pauseButton').addEventListener('click', () => pause());
$('resumeButton').addEventListener('click', resume);
$('exitButton').addEventListener('click', menu);
$('menuButton').addEventListener('click', menu);
$('releaseButton').addEventListener('click', () => { game.releaseTarget(); endTypedFragment(); focusInput(); updateHud(); });
for (const id of ['releaseButton', 'soundButton', 'nextLevelButton']) {
  $(id).addEventListener('pointerdown', (event) => {
    if (['playing','transition'].includes(game.status)) event.preventDefault();
  });
}
canvas.addEventListener('pointerdown', () => { if (game.status === 'playing') focusInput(); });
input.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.preventDefault(); });
input.addEventListener('blur', () => {
  if (['playing','transition'].includes(game.status)) pause('O teclado perdeu o foco. Toca em continuar para retomar.');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause('A missão ficou em pausa enquanto estavas fora.'); sound.setScene('paused'); }
  else sound.setScene(game.status === 'playing' ? 'game' : game.status === 'paused' ? 'paused' : 'menu');
});
window.addEventListener('pagehide',saveProgress);
window.addEventListener('blur', () => { if (!coarsePointer) pause('A missão ficou em pausa enquanto estavas fora.'); });
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (game.status === 'playing' || (game.status==='transition'&&!transitionPaused)) { event.preventDefault(); pause(); }
  else if (game.status === 'paused'||transitionPaused) { event.preventDefault(); resume(); }
});
document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => { difficulty = button.dataset.difficulty; save('orbita-difficulty', difficulty); updateMenu(); }));
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => { mode = button.dataset.mode; save('orbita-mode', mode); updateMenu(); }));
document.querySelectorAll('[data-progression]').forEach((button) => button.addEventListener('click', () => { progression = button.dataset.progression; save('orbita-progression', progression); updateMenu(); }));
$('menuMusicButton').addEventListener('click', () => {
  soundOn = true;
  sound.setEnabled(soundOn); sound.setScene('menu'); save('orbita-sound', soundOn);
  unlockAudio(); updateSoundButton();
});
$('musicStyle').value=sound.musicStyle;
$('musicStyle').addEventListener('change',()=>{sound.setMusicStyle($('musicStyle').value);save('boring-music-style',sound.musicStyle);unlockAudio();});
$('nextMusicButton').addEventListener('click',()=>{sound.nextMusic();$('musicStyle').value=sound.musicStyle;save('boring-music-style',sound.musicStyle);unlockAudio();});
function syncCustomMusic() {
  const option=$('musicStyle').querySelector('[value="custom"]');
  option.disabled=!sound.customTrack;
  $('removeMusicButton').hidden=!sound.customTrack;
  $('musicStyle').value=sound.musicStyle;
}
let musicImportGeneration=0;
$('uploadMusicButton').addEventListener('click',()=>{$('musicFile').value='';$('musicFile').click();});
$('musicFile').addEventListener('change',async()=>{
  const file=$('musicFile').files[0];if(!file)return;
  const generation=++musicImportGeneration;
  if(file.size>50*1024*1024){$('musicUploadStatus').textContent=t('Escolhe um ficheiro de áudio até 50 MB.');return;}
  $('musicUploadStatus').textContent=t('A preparar a tua música…');
  try {
    await sound.unlock();
    if(!await sound.setCustomMusic(file)||generation!==musicImportGeneration)return;
    const stored=await saveMusicFile(file);
    save('boring-music-style','custom');syncCustomMusic();
    $('musicUploadStatus').textContent=t(stored?'Música carregada e guardada neste navegador.':'Música carregada para esta sessão. Não foi possível guardá-la.');
  } catch {if(generation===musicImportGeneration)$('musicUploadStatus').textContent=t('Não foi possível abrir esta música. Experimenta MP3, WAV ou M4A.');}
});
$('removeMusicButton').addEventListener('click',async()=>{
  musicImportGeneration++;sound.clearCustomMusic();syncCustomMusic();save('boring-music-style',sound.musicStyle);
  await saveMusicFile(null);$('musicUploadStatus').textContent='';
});
loadMusicFile().then(async file=>{
  if(!file||musicImportGeneration)return;
  // Restoring needs an AudioContext; decode after the next authorised gesture.
  const restore=async()=>{
    if(musicImportGeneration)return;
    musicImportGeneration++;
    const style=sound.musicStyle;
    await sound.unlock();
    try {await sound.setCustomMusic(file);if(style!=='custom')sound.setMusicStyle(style);syncCustomMusic();}catch{sound.clearCustomMusic();syncCustomMusic();}
  };
  document.addEventListener('pointerdown',restore,{once:true});
  document.addEventListener('keydown',restore,{once:true});
});
$('optionsAudioButton').addEventListener('click',()=>{$('optionsDialog').close();$('audioDialog').showModal();});
$('audioSettingsButton').addEventListener('click', () => { pause(); $('audioDialog').showModal(); });
$('audioListenButton').addEventListener('click', () => {
  soundOn = true; sound.setEnabled(true); save('orbita-sound', true);
  if (game.status !== 'playing') sound.setScene('menu');
  unlockAudio(); updateSoundButton();
});
$('audioDialog').addEventListener('close', () => {
  sound.setScene(game.status === 'playing' ? 'game' : game.status === 'paused' ? 'paused' : 'menu');
});
for (const [id, value] of [['musicVolume', musicVolume], ['sfxVolume', sfxVolume]]) {
  $(id).value = Math.round(value * 100); $(`${id}Label`).textContent = `${Math.round(value * 100)}%`;
  $(id).addEventListener('input', () => {
    const volume = Number($(id).value) / 100;
    $(`${id}Label`).textContent = `${Math.round(volume * 100)}%`;
    if (id === 'musicVolume') { musicVolume = volume; sound.setMusicVolume(volume); save('orbita-music-volume', volume); }
    else { sfxVolume = volume; sound.setSfxVolume(volume); save('orbita-sfx-volume', volume); }
  });
}
// Music can begin only after a gesture; unlock synchronously on the first one.
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });
$('helpButton').addEventListener('click', () => { pause(); $('helpDialog').showModal(); });
const library=setupLibrary({getLanguage:()=>textLanguage,onStart:beginDocument,onRead:campaign=>reader.open(campaign),onDefault:()=>{customText='';save('orbita-text','');updateMenu();}});
$('readBookButton').addEventListener('click',()=>{pause();reader.open(adventure.campaign || createCampaign(documentFromText(game._sourceText || customText || stories[story][textLanguage].text,runKind==='boss'?'BOSS RUSH':customText?t('Texto personalizado'):stories[story][textLanguage].title)),Math.max(0,adventure.campaign?game.level-1:0));});
$('testExplosionButton').addEventListener('click',async()=>{soundOn=true;save('orbita-sound',true);sound.setEnabled(true);if(sfxVolume===0){sfxVolume=.5;sound.setSfxVolume(.5);save('orbita-sfx-volume',.5);$('sfxVolume').value=50;$('sfxVolumeLabel').textContent='50%';}await sound.unlock();sound.previewExplosion();updateSoundButton();translatePage();});
for(const button of document.querySelectorAll('[data-world]'))button.addEventListener('click',()=>{pause();$('world').value=button.dataset.world;$('world').dispatchEvent(new Event('change'));});
document.querySelectorAll('[data-writing]').forEach(button=>button.addEventListener('click',()=>{pause();$('writing').value=button.dataset.writing;$('writing').dispatchEvent(new Event('change'));}));
document.querySelectorAll('[data-setting]').forEach(select=>select.addEventListener('change',()=>{pause();document.querySelector(`[data-${select.dataset.setting}="${select.value}"]`).click();}));
document.querySelectorAll('[data-upload]').forEach(button=>button.addEventListener('click',()=>{pause();$('optionsDialog').close();library.open(customText);$('documentFile').value='';$('documentFile').click();}));
$('customButton').addEventListener('click',()=>{$('optionsDialog').close();library.open(customText);});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));

$('rankingButton').addEventListener('click', showRanking);
for (const id of ['uiLanguage', 'world', 'story', 'writing']) $(id).addEventListener('change', () => {
  if (id === 'uiLanguage') { pause(); uiLanguage = $(id).value; setLanguage(uiLanguage); textLanguage=textOverride==='auto'?uiLanguage:textOverride; save('boring-office-ui-language-v2', uiLanguage); save('orbita-text-language', textLanguage); }

  if (id === 'world') {
    save('boring-profile-'+world,{mode,progression,difficulty,advanced,story});
    world=$(id).value;
    const remembered=readSaved('boring-profile-'+world,null), preset=WORLD_PRESETS[world];
    ({mode,progression,difficulty,advanced,story}=preset);
    if(remembered && ['reading','arcade'].includes(remembered.mode) && ['campaign','endless'].includes(remembered.progression) && difficultyNames[remembered.difficulty] && stories[remembered.story]) ({mode,progression,difficulty,advanced,story}=remembered);
    save('orbita-world-v2',world);save('orbita-story-v2',story);
    save('orbita-mode',mode);save('orbita-progression',progression);save('orbita-difficulty',difficulty);save('orbita-advanced',advanced);
  }
  if (id === 'story') { story = $(id).value; customText = ''; save('orbita-story-v2', story); save('orbita-text', ''); }
  if (id === 'writing') { advanced = $(id).value === 'advanced'; save('orbita-advanced', advanced); }
  updateMenu(); translatePage(); updateTypedEcho();
});
for (const id of ['uiLanguage']) {
  $(id).replaceChildren(...Object.entries(supportedLanguages).map(([value,label]) => { const option=document.createElement('option');option.value=value;option.textContent=label;return option; }));
}
function noteLevel(){
  if(game.mistakes===levelStartMistakes&&game.levelKills>0)profile.perfectLevels++;
  if(game.boss?.phase===3&&skill&&!skill.bosses.includes(game.boss.id))skill.bosses.push(game.boss.id);
  saveProfile(profile,profileStorage);
}
function finishSkill(won){
 if(!skill||sessionFinished||skill.attempts<1)return;
 sessionFinished=true;lastResult=skill.finish({seconds:activeSeconds,score:game.score,combo:game.bestStreak,won});
 const earned=unlockAchievements(profile);const stored=saveProfile(profile,profileStorage);
 $('profileSaveStatus').textContent=stored?'':t('Não foi possível guardar o progresso.');
 renderRunResult(lastResult,profile,earned);renderProfile(profile);applyPalette();$('calibrationNudge').hidden=profile.calibrated;
}
function launchRun(kind){
 if(!RUNS[kind])return;
 finishSkill(false);for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 if(kind==='campaign'){menuConfig=null;world='office';story='office';mode='reading';progression='campaign';startGame();return;}
 if(!menuConfig)menuConfig={difficulty,mode,progression,advanced,world,story};
 runKind=kind;runIdentity=null;adventure.detach();
 textLanguage=textOverride==='auto'?uiLanguage:textOverride;
 if(['train','calibration','boss','daily','retro'].includes(kind))world='office';
 let words=(OFFICE_WORDS[textLanguage]||OFFICE_WORDS.en).split(' '),random=Math.random;
 if(kind==='daily'){const challenge=dailyChallenge(new Date(),textLanguage);runIdentity=challenge;words=challenge.words;random=challenge.random;difficulty=challenge.difficulty;advanced=false;}
 if(kind==='train')words=practiceWords(words,profile);
 const text=customText&&!['daily','train','calibration','boss'].includes(kind)?customText:words.join(' ');
 mode=['train','calibration','boss'].includes(kind)?'reading':'arcade';if(kind==='calibration')advanced=false;progression='endless';
 game=new GameEngine({...settings(),mobile:kind==='daily'?false:coarsePointer,training:['train','calibration'].includes(kind),mode,progression,customText:kind==='boss'?bossLevels(textLanguage,advanced).map(level=>level.text).join(' '):text,random,sessionSeconds:RUNS[kind].seconds,officeTactics:kind!=='calibration'&&world==='office',campaignLevels:kind==='boss'?bossLevels(textLanguage,advanced):null}).start();
 if(kind==='calibration'||kind==='train'){game.difficulty='normal';game._settings={lifetime:25,spawnInterval:2.8};}
 updateMenu();activateGame();
}
function updateMissionHud(){
 const key=Math.floor(clock*4);if(key===previousSkillHud)return;previousSkillHud=key;
 $('missionHud').hidden=game.status==='ready';
 const remaining=game.sessionSeconds?Math.max(0,Math.ceil(game.sessionSeconds-game.elapsed)):null;
 $('runClock').textContent=remaining!==null?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:t('O TECLADO É O COMANDO');
 $('bossStatus').textContent=game.boss?t(BOSSES[game.boss.id].name)+' · '+t('Fase')+' '+game.boss.phase+' · '+Math.round(100*(1-game.levelProgress))+'%':runKind==='daily'?runIdentity?.day||'':`${Math.round(game.wpm)} WPM`;
 $('flowStatus').textContent=game.elapsed<game.coffeeUntil?t('CAFÉ: 5 SEGUNDOS DE PAZ.'):game.streak>=50?t('PRODUTIVIDADE EXCESSIVA'):game.streak>=20?t('EM FOCO'):'';
}
function openProfile(){pause();$('optionsDialog').close();renderProfile(profile);$('profileDialog').showModal();}
$('profileButton').addEventListener('click',openProfile);$('optionsProfileButton').addEventListener('click',openProfile);
for(const id of ['missionsButton','optionsMissionsButton'])$(id).addEventListener('click',()=>{pause();$('optionsDialog').close();$('missionsDialog').showModal();});
for(const button of document.querySelectorAll('[data-run]'))button.addEventListener('click',()=>launchRun(button.dataset.run));
$('shareResultButton').addEventListener('click',()=>{if(lastResult)downloadResult(lastResult,runIdentity?`DAILY ${runIdentity.day} · ${textLanguage.toUpperCase()}`:runKind.toUpperCase());});
input.addEventListener('beforeinput',e=>{if(e.inputType?.startsWith('delete')&&game.status==='playing')skill?.correction();});
$('gameTextLanguage').value=textOverride;
$('gameTextLanguage').addEventListener('change',()=>{textOverride=$('gameTextLanguage').value;textLanguage=textOverride==='auto'?uiLanguage:textOverride;save('boring-text-override',textOverride);updateMenu();});
$('adaptiveToggle').checked=adaptiveOn;$('adaptiveToggle').addEventListener('change',()=>{adaptiveOn=$('adaptiveToggle').checked;save('boring-adaptive',adaptiveOn);});
document.body.classList.toggle('reduce-motion',reducedMotion);$('motionToggle').checked=reducedMotion;$('motionToggle').addEventListener('change',()=>{reducedMotion=$('motionToggle').checked;document.body.classList.toggle('reduce-motion',reducedMotion);save('boring-reduced-motion',reducedMotion);});
for(const [id,key,cls]of [['contrastToggle','boring-contrast','high-contrast'],['crtToggle','boring-crt','crt']]){const value=readSaved(key,false);$(id).checked=value;document.body.classList.toggle(cls,value);$(id).addEventListener('change',()=>{save(key,$(id).checked);document.body.classList.toggle(cls,$(id).checked);});}
$('qualitySetting').value=quality;$('qualitySetting').addEventListener('change',()=>{quality=$('qualitySetting').value;save('boring-quality',quality);});
function lowQuality(){return quality==='low'||(quality==='auto'&&(coarsePointer||reducedMotion));}
function applyPalette(){const mint=$('paletteSetting').querySelector('[value="mint"]'),sunset=$('paletteSetting').querySelector('[value="sunset"]');mint.disabled=profile.perfectLevels<1;sunset.disabled=profile.trophies.length<1;if((palette==='mint'&&mint.disabled)||(palette==='sunset'&&sunset.disabled))palette='classic';document.body.dataset.palette=palette;$('paletteSetting').value=palette;}
$('paletteSetting').addEventListener('change',()=>{palette=$('paletteSetting').value;save('boring-palette',palette);applyPalette();});applyPalette();renderProfile(profile);$('calibrationNudge').hidden=profile.calibrated;
menuUI = setupMenu({languages:supportedLanguages,getLanguage:()=>uiLanguage,onLanguage:value=>{$('uiLanguage').value=value;$('uiLanguage').dispatchEvent(new Event('change'));},onOptions:()=>{$('optionsDialog').showModal();}});
updateMenu(); updateSoundButton(); updateHud(); updateTypedEcho(); translatePage();
requestAnimationFrame(frame);
