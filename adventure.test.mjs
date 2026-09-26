import test from 'node:test';
import assert from 'node:assert/strict';
import { Adventure } from './adventure.mjs';
import { GameEngine } from './engine.mjs';
import { PROGRESS_KEY } from './progress.mjs';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
};
const settings = { textLanguage: 'pt', uiLanguage: 'fr', world: 'earth', difficulty: 'normal', advanced: true };
const documentOf = (texts = ['É🙂, sol!', 'Lua.']) => ({ title: 'Aventura', format: 'txt', text: texts.join('\n\n'),
  sections: texts.map((text, index) => ({ kind: 'chapter', title: `Capítulo ${index + 1}`, text })) });
function typeWord(engine) {
  const enemy = engine.enemies.find(target => target.id === engine.targetId);
  assert.ok(enemy, 'there is a reading target');
  for (const char of enemy.word.slice(enemy.progress)) assert.equal(engine.typeChar(char), true);
}

 test('continue restores exact partial Unicode word, target positions, metrics and language separation', () => {
  const storage = memoryStorage(), first = new Adventure(storage);
  const engine = first.begin(documentOf(), settings);
  engine.tick(.1); engine.typeChar('É'); engine.typeChar('🙂'); engine.typeChar('x');
  assert.equal(first.save(engine, 'É🙂'), true);
  const snapshot = engine.snapshot();
  const reopened = new Adventure(storage), resumed = reopened.resume();
  assert.equal(resumed.engine.status, 'paused');
  assert.deepEqual(resumed.engine.enemies, snapshot.enemies);
  assert.equal(resumed.engine.enemies[0].progress, 3);
  assert.equal(resumed.engine.elapsed, snapshot.state.elapsed);
  assert.equal(resumed.engine.score, snapshot.state.score);
  assert.equal(resumed.engine.mistakes, 1);
  assert.equal(resumed.settings.textLanguage, 'pt'); assert.equal(resumed.settings.uiLanguage, 'fr');
  assert.equal(resumed.typedDisplay, 'É🙂');
  resumed.engine.resume(); assert.equal(resumed.engine.typeChar(','), true);
  assert.equal(resumed.engine.kills, 1); assert.equal(resumed.engine.enemies[0].word, 'sol!');
});

test('saved level boundary waits for one advance and preserves the next chapter', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  const engine = adventure.begin(documentOf(), settings);
  typeWord(engine); typeWord(engine);
  assert.equal(engine.status, 'transition'); assert.equal(adventure.percent(engine), 66);
  assert.equal(adventure.save(engine, 'É🙂, sol! '), true);
  const reopened = new Adventure(storage);
  assert.deepEqual(reopened.summary(), { title: 'Aventura', chapter: 1, level: 1, percent: 66 });
  const { engine: restored } = reopened.resume();
  assert.equal(restored.status, 'transition'); restored.tick(1);
  assert.equal(restored.level, 1);
  assert.equal(restored.nextLevel(), true); assert.equal(restored.nextLevel(), false);
  assert.equal(restored.enemies[0].word, 'Lua.'); assert.equal(restored.readingIndex, 0);
  reopened.save(restored);
  assert.equal(new Adventure(storage).summary().chapter, 2);
});

test('saving a completed campaign clears Continue and cannot revive the prior checkpoint', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  const engine = adventure.begin(documentOf(['Fim.']), settings);
  assert.ok(new Adventure(storage).summary()); typeWord(engine);
  assert.equal(engine.status, 'won'); assert.equal(adventure.percent(engine), 100);
  assert.equal(adventure.save(engine, 'Fim. '), true);
  assert.equal(adventure.summary(), null); assert.equal(storage.getItem(PROGRESS_KEY), null);
  assert.equal(new Adventure(storage).resume(), null);
});

test('Continue after fatal final word retries its accepted prefix instead of awarding victory', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  const engine = adventure.begin(documentOf(['Lua.']), settings);
  engine.typeChar('L'); engine.lives = 1; engine.enemies[0].y = .999; engine.tick(.1);
  assert.equal(engine.status, 'over'); assert.equal(engine.enemies.length, 0);
  const score = engine.score, elapsed = engine.elapsed;
  assert.equal(adventure.save(engine, 'L'), true);
  assert.equal(engine.status, 'over'); assert.equal(engine.lives, 0, 'saving does not revive the active game');
  const restored = new Adventure(storage).resume().engine;
  assert.equal(restored.status, 'paused'); assert.equal(restored.lives, 3);
  assert.equal(restored.readingIndex, 0); assert.equal(restored.enemies[0].word, 'Lua.');
  assert.equal(restored.enemies[0].progress, 1); assert.equal(restored.score, score); assert.equal(restored.elapsed, elapsed);
  restored.resume(); restored.tick(.1); assert.equal(restored.status, 'playing');
  typeWord(restored); assert.equal(restored.status, 'won');
});

test('loss recovery retains following words and reading order', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  const engine = adventure.begin(documentOf(['um dois três quatro cinco']), { ...settings, advanced: false });
  for (let i = 0; i < 28; i++) engine.tick(.1);
  assert.ok(engine.enemies.length > 1);
  engine.typeChar('u'); engine.lives = 1; engine.enemies[0].y = .999; engine.tick(.1);
  const following = engine.enemies.map(enemy => enemy.word);
  adventure.save(engine, 'u');
  const restored = new Adventure(storage).resume().engine;
  assert.deepEqual(restored.enemies.map(enemy => enemy.word), ['um', ...following]);
  assert.equal(restored.enemies[0].progress, 1);
  for (let i = 1; i < restored.enemies.length; i++) assert.ok(restored.enemies[i].y <= restored.enemies[i - 1].y - .079);
});

test('basic writing filters unplayable sections and repairs chapter boundaries without renumbering source chapters', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  const source = documentOf(['árvore', '123 !!!', '456 ???', 'fim']);
  source.sections[1].kind = 'page';
  const engine = adventure.begin(source, { ...settings, advanced: false });
  assert.equal(adventure.campaign.levels.length, 2); assert.equal(adventure.campaign.totalWords, 2);
  assert.deepEqual(adventure.campaign.levels.map(level => level.isChapterEnd), [true, true]);
  assert.deepEqual(adventure.campaign.levels.map(level => [level.startWord, level.endWord]), [[0, 1], [1, 2]]);
  assert.equal(engine.enemies[0].word, 'arvore');
  typeWord(engine); engine.nextLevel(); adventure.save(engine);
  const reopened = new Adventure(storage);
  assert.equal(reopened.summary().chapter, 3); assert.equal(reopened.summary().percent, 50);
  assert.equal(reopened.resume().engine.enemies[0].word, 'fim');
  const advanced = new Adventure(memoryStorage()); advanced.begin(source, settings);
  assert.equal(advanced.campaign.levels.length, 4, 'symbols remain playable in advanced writing');
});

test('an unplayable new document leaves the current campaign and saved Continue intact', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  adventure.begin(documentOf(), settings);
  const campaign = adventure.campaign, record = storage.getItem(PROGRESS_KEY), options = adventure.settings;
  assert.throws(() => adventure.begin(documentOf(['123 !!!']), { ...settings, advanced: false }), /emptyDocument/);
  assert.equal(adventure.campaign, campaign); assert.equal(adventure.settings, options);
  assert.equal(storage.getItem(PROGRESS_KEY), record);
});

test('detaching preserves saved Continue and arcade saves cannot overwrite it', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  adventure.begin(documentOf(), settings); const record = storage.getItem(PROGRESS_KEY);
  adventure.detach(); assert.ok(adventure.summary());
  const arcade = new GameEngine().start(); adventure.save(arcade);
  assert.equal(storage.getItem(PROGRESS_KEY), record);
});

test('corrupt document positions, source targets and mismatched writing mode cannot resume', () => {
  const storage = memoryStorage(), adventure = new Adventure(storage);
  adventure.begin(documentOf(), settings);
  const original = JSON.parse(storage.getItem(PROGRESS_KEY));
  const corrupt = [
    value => { value.engine.state.readingIndex = 99; },
    value => { value.engine.enemies[0].word = 'different'; },
    value => { value.engine.enemies[0].sequenceIndex = 8; },
    value => { value.engine.enemies[0].progress = 2; }, // between emoji surrogate halves
    value => { value.engine.state.status = 'transition'; },
    value => { value.session.settings.advanced = false; },
  ];
  for (const change of corrupt) {
    const value = structuredClone(original); change(value); storage.setItem(PROGRESS_KEY, JSON.stringify(value));
    const loaded = new Adventure(storage); assert.equal(loaded.summary(), null); assert.equal(loaded.resume(), null);
  }
});

test('long document campaigns approach a bounded pace while arcade progression keeps its baseline', () => {
  const levels = Array.from({ length: 400 }, (_, i) => ({ title: `Chapter ${i}`, text: 'a' }));
  const engine = new GameEngine({ mode: 'reading', campaignLevels: levels }).start();
  let prior = engine.speedMultiplier;
  for (let i = 0; i < 399; i++) {
    engine.typeChar('a'); assert.equal(engine.status, 'transition');
    assert.ok(engine.speedMultiplier >= prior && engine.speedMultiplier <= 2.5);
    prior = engine.speedMultiplier; engine.nextLevel();
  }
  assert.ok(engine.speedMultiplier > 2.4 && engine.speedMultiplier <= 2.5);
  const arcade = new GameEngine().start(); arcade.wave = 10;
  assert.equal(arcade.speedMultiplier, 1.08 ** 9);
});
