import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogs, supportedLanguages, languageTags, normalizeLanguage, setLanguage, getLanguage, t, translatePage, observeTranslations } from './locale.mjs';
import { languages, messageRows } from './locale-data.mjs';
import { stories } from './stories.mjs';
import { wordsFromText } from './engine.mjs';

afterEach(() => setLanguage('pt'));
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('all five catalogs have every message and the same interpolation parameters', () => {
  assert.deepEqual(Object.keys(catalogs), ['pt', 'en', 'fr', 'de', 'es']);
  assert.equal(new Set(messageRows.map(row => row[0])).size, messageRows.length, 'duplicate source messages');
  for (const row of messageRows) {
    assert.equal(row.length, languages.length, `missing column for ${row[0]}`);
    for (const translation of row) {
      assert.ok(typeof translation === 'string' && translation.trim(), `empty translation of ${row[0]}`);
      assert.deepEqual(placeholders(translation), placeholders(row[0]), `parameters for ${translation}`);
    }
  }
  for (const code of Object.keys(catalogs)) assert.deepEqual(Object.keys(catalogs[code]), Object.keys(catalogs.pt));
});

test('switches directly between every language and back to Portuguese', () => {
  const play = { pt: 'Jogar', en: 'Play', fr: 'Jouer', de: 'Spielen', es: 'Jugar' };
  for (const code of ['en', 'fr', 'de', 'es', 'pt']) {
    assert.equal(setLanguage(code), code);
    assert.equal(getLanguage(), code);
    assert.equal(t('Jogar'), play[code]);
  }
});

test('regional language tags normalize safely, invalid saved preferences fall back', () => {
  assert.equal(normalizeLanguage('FR-fr'), 'fr');
  assert.equal(normalizeLanguage('pt_BR'), 'pt');
  assert.equal(normalizeLanguage('unknown'), 'pt');
  assert.equal(normalizeLanguage(null), 'pt');
  assert.equal(setLanguage('de-DE'), 'de');
  assert.equal(languageTags[getLanguage()], 'de-DE');
  assert.equal(supportedLanguages.fr, 'Français');
});

test('unknown content is preserved and parameters are substituted literally', () => {
  setLanguage('de');
  assert.equal(t('A custom book title'), 'A custom book title');
  assert.equal(t('ALVO: {word} · {progress}/{length}', { word: '$&<é!>', progress: 2, length: 6 }), 'ZIEL: $&<é!> · 2/6');
  assert.equal(t('Nível {number}'), 'Level {number}', 'missing parameters are visible, not silently erased');
});

test('translated HUD includes lives, streaks, accuracy and target without changing the target text', () => {
  setLanguage('fr');
  assert.equal(t('2 vidas'), '2 vies');
  assert.equal(t('10 LETRAS SEGUIDAS ↗'), '10 LETTRES DE SUITE ↗');
  assert.equal(t('98% · ESPAÇOS AUTO'), '98% · ESPACES AUTO');
  assert.equal(t('ALVO: Música! · 2/7'), 'CIBLE : Música! · 2/7');
  assert.equal(t('NÍVEL 02 · PRIMEIRO SINAL'), 'NIVEAU 02 · PREMIER SIGNAL');
  assert.equal(t('01 / VALE VERDE'), '01 / VALLÉE VERTE');
});

test('new campaign templates and composite status messages translate', () => {
  setLanguage('es');
  assert.equal(t('Capítulo {number}', { number: 6 }), 'Capítulo 6');
  assert.equal(t('{count} palavras', { count: 124 }), '124 palabras');
  assert.equal(t('normal · campanha · teu texto'), 'normal · campaña · tu texto');
  assert.equal(t('SECTOR 07 · SISTEMA ÓRBITA'), 'SECTOR 07 · SISTEMA ÓRBITA');
  setLanguage('de');
  assert.equal(t('Nível {current} de {total}', { current: 2, total: 10 }), 'Level 2 von 10');
});

test('both fables are available in all text languages, independent of UI language', () => {
  for (const story of Object.values(stories)) {
    assert.deepEqual(Object.keys(story).sort(), Object.keys(supportedLanguages).sort());
    for (const code of Object.keys(supportedLanguages)) {
      const { title, text } = story[code];
      assert.ok(title.length > 5);
      assert.ok(wordsFromText(text).length >= 90, `${title} must be a playable story`);
      assert.equal(text, text.normalize('NFC'));
      assert.match(text, /[!?]/);
    }
    const french = story.fr.text;
    setLanguage('de');
    assert.equal(story.fr.text, french);
    assert.equal(t(story.fr.title), story.fr.title);
  }
});

test('advanced foreign texts preserve punctuation, diacritics and opening Spanish question marks', () => {
  const tokens = wordsFromText(stories.hare.es.text, true);
  assert.ok(tokens.includes('"¿Hacemos'));
  assert.ok(tokens.includes('señal,'));
  assert.ok(wordsFromText(stories.lion.de.text, true).includes('Löwe'));
  assert.ok(wordsFromText(stories.hare.fr.text, true).includes('répondit'));
});

test('localization imports and safe DOM entry points work without a browser', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.doesNotThrow(() => translatePage());
  assert.doesNotThrow(() => observeTranslations()());
});

// A small DOM surface lets these browser-facing regressions run under node --test
// without adding a production or test dependency to the static GitHub Pages app.
function fixture() {
  const doc = { nodeType: 9, title: 'Órbita — Cada letra conta.', documentElement: {}, querySelector() { return null; } };
  function element(tag, attrs = {}, children = []) {
    const node = { nodeType: 1, tagName: tag.toUpperCase(), ownerDocument: doc, attrs: { ...attrs }, children,
      hasAttribute(name) { return Object.hasOwn(this.attrs, name); },
      getAttribute(name) { return this.attrs[name] ?? null; },
      setAttribute(name, value) { this.attrs[name] = value; },
      closest(selector) {
        for (let current = this; current; current = current.parentElement) {
          if (selector.split(',').some(part => part === current.tagName?.toLowerCase() ||
            part === `#${current.attrs?.id}` || part === '[data-no-i18n]' && current.hasAttribute('data-no-i18n') ||
            part === '[translate="no"]' && current.attrs?.translate === 'no')) return current;
        }
        return null;
      },
    };
    for (const child of children) child.parentElement = node;
    return node;
  }
  const text = nodeValue => ({ nodeType: 3, nodeValue, ownerDocument: doc });
  doc.createTreeWalker = (root, _show, filter) => {
    const list = [];
    function visit(node) { for (const child of node.children ?? []) { if (filter.acceptNode(child) === 2) continue; list.push(child); visit(child); } }
    visit(root); let index = 0;
    return { currentNode: null, nextNode() { this.currentNode = list[index++]; return this.currentNode ?? null; } };
  };
  const button = element('button', { 'aria-label': 'Jogar' }, [text(' Jogar ')]);
  const counter = element('span', {}, [text('2 vidas')]);
  const target = element('span', {}, [text('ALVO: $&Música! · 2/9')]);
  const content = element('div', { 'data-no-i18n': '' }, [text('Jogar')]);
  const reading = element('div', { id: 'readingText' }, [text('Música')]);
  const custom = element('textarea', { placeholder: 'Escreve ou cola aqui o teu texto…' }, [text('Jogar')]);
  doc.body = element('body', {}, [button, counter, target, content, reading, custom]);
  return { doc, button, counter, target, content, reading, custom, text, element };
}

test('DOM translation round trips without losing original text, whitespace, attributes or literal symbols', () => {
  const { doc, button, counter, target } = fixture();
  setLanguage('fr'); translatePage(doc);
  assert.equal(button.children[0].nodeValue, ' Jouer ');
  assert.equal(button.attrs['aria-label'], 'Jouer');
  assert.equal(counter.children[0].nodeValue, '2 vies');
  assert.equal(target.children[0].nodeValue, 'CIBLE : $&Música! · 2/9');
  assert.equal(doc.documentElement.lang, 'fr-FR');
  assert.equal(doc.title, 'Órbita — Chaque lettre compte.');
  setLanguage('de'); translatePage(doc);
  assert.equal(button.children[0].nodeValue, ' Spielen ');
  assert.equal(counter.children[0].nodeValue, '2 Leben');
  setLanguage('pt'); translatePage(doc);
  assert.equal(button.children[0].nodeValue, ' Jogar ');
  assert.equal(doc.title, 'Órbita — Cada letra conta.');
});

test('DOM translation preserves user documents, text language and native language choices', () => {
  const { doc, content, reading, custom } = fixture();
  setLanguage('en'); translatePage(doc);
  assert.equal(content.children[0].nodeValue, 'Jogar');
  assert.equal(reading.children[0].nodeValue, 'Música');
  assert.equal(custom.children[0].nodeValue, 'Jogar');
  assert.equal(custom.attrs.placeholder, 'Write or paste your text here…');
});

test('DOM changes and already translated dynamic messages can change language again', () => {
  const { doc, button, counter } = fixture();
  setLanguage('fr'); translatePage(doc);
  button.children[0].nodeValue = t('Continuar');
  counter.children[0].nodeValue = '1 vidas';
  translatePage(doc);
  assert.equal(button.children[0].nodeValue, 'Continuer');
  assert.equal(counter.children[0].nodeValue, '1 vie');
  setLanguage('es'); translatePage(doc);
  assert.equal(button.children[0].nodeValue, 'Continuar');
  assert.equal(counter.children[0].nodeValue, '1 vida');
});

test('observation only visits changed UI subtrees and ignores gameplay content', async () => {
  const { doc, button, reading, text } = fixture();
  let callback;
  let disconnected = false;
  doc.defaultView = { MutationObserver: class {
    constructor(fn) { callback = fn; }
    observe() {}
    disconnect() { disconnected = true; }
  } };
  const stop = observeTranslations(doc);
  setLanguage('fr');
  const added = text('Continuar'); added.parentElement = button;
  button.children.push(added);
  callback([{ type: 'childList', target: button, addedNodes: [added] }, { type: 'characterData', target: reading.children[0] }]);
  await Promise.resolve();
  assert.equal(added.nodeValue, 'Continuer');
  assert.equal(button.children[0].nodeValue, ' Jogar ', 'unmodified nodes were not rescanned');
  assert.equal(reading.children[0].nodeValue, 'Música');
  stop(); assert.equal(disconnected, true);
});

test('new interface and document import status copy have translations in every catalog', () => {
  const source = readFileSync(new URL('./library.mjs', import.meta.url), 'utf8');
  const messages = [...source.matchAll(/(?:t\(|status\(|\w+:)\s*'([^']+)'/g)].map(match => match[1]).filter(value => /[ \u00c0-\u024f]/.test(value));
  for (const message of messages) for (const catalog of Object.values(catalogs)) assert.ok(Object.hasOwn(catalog, message), message);
  for (const message of ['Jogar','Continuar','Opções','Carregar texto/documento','Uma palavra de cada vez.','Uma aventura inteira.']) {
    for (const catalog of Object.values(catalogs)) assert.ok(Object.hasOwn(catalog, message));
  }
});

test('all five languages translate every changing HUD field and switch back cleanly', () => {
  const samples = [
    'NÍVEL 03 · CAMPO DE ESTRELAS', '03 / TRILHO DO BOSQUE',
    '3 vidas', '2 vidas', '1 vidas', '0 vidas', '10 LETRAS SEGUIDAS ↗',
    '99.5% · ESPAÇOS AUTO', 'ALVO: "¿Música?" · 0/10',
    'normal · campanha · teu texto', 'Nível 2 de 8', 'Capítulo 6', '37% concluído',
  ];
  const { doc, text, element } = fixture();
  const nodes = samples.map(value => text(value));
  doc.body = element('body', {}, nodes);
  for (const language of ['en', 'fr', 'de', 'es', 'pt']) {
    setLanguage(language); translatePage(doc);
    for (let i = 0; i < nodes.length; i++) assert.equal(nodes[i].nodeValue, t(samples[i]), `${language}: ${samples[i]}`);
  }
});

test('single remaining life and single campaign counts use singular labels', () => {
  const expected = {
    pt: ['1 vida', '1 palavra', '1 nível', '1 capítulo'],
    en: ['1 life', '1 word', '1 level', '1 chapter'],
    fr: ['1 vie', '1 mot', '1 niveau', '1 chapitre'],
    de: ['1 Leben', '1 Wort', '1 Level', '1 Kapitel'],
    es: ['1 vida', '1 palabra', '1 nivel', '1 capítulo'],
  };
  for (const language of Object.keys(expected)) {
    setLanguage(language);
    assert.deepEqual(['{count} vidas', '{count} palavras', '{count} níveis', '{count} capítulos'].map(source => t(source, { count: 1 })), expected[language]);
    assert.equal(t('1 níveis'), expected[language][2]);
  }
});

test('all current HTML text and accessible labels have catalog coverage', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const literals = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1].trim());
  literals.push(...[...html.matchAll(/(?:aria-label|placeholder|title|alt)="([^"]+)"/g)].map(match => match[1]));
  const intentionallyUntranslated = new Set([
    'ÓRBITA', 'Esc', ...Object.values(supportedLanguages),
    ...Object.values(stories).flatMap(story => Object.values(story).map(item => item.title)),
  ]);
  for (const source of literals.filter(text => /\p{L}/u.test(text))) {
    if (intentionallyUntranslated.has(source) || Object.hasOwn(catalogs.pt, source)) continue;
    const translated = Object.keys(catalogs).filter(code => code !== 'pt').some(code => { setLanguage(code); return t(source) !== source; });
    assert.ok(translated, `Missing UI source message: ${source}`);
  }
});

test('menu target sample words follow text language independently', async () => {
  const { previewWords } = await import('./locale.mjs');
  assert.deepEqual(Object.keys(previewWords), Object.keys(supportedLanguages));
  for (const words of Object.values(previewWords)) assert.deepEqual(Object.keys(words), ['space', 'earth', 'discover', 'horizon']);
  setLanguage('de');
  assert.equal(previewWords.fr.earth, 'forêt');
  assert.equal(previewWords.es.discover, 'descubrir');
});
