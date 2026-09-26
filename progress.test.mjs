import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressStore, PROGRESS_KEY, MAX_PROGRESS_BYTES } from './progress.mjs';
import { createCampaign } from './campaign.mjs';
import { documentFromText } from './documentImport.mjs';
import { GameEngine } from './engine.mjs';

const memoryStorage = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }; };
const fixture = () => ({ campaign: createCampaign(documentFromText('Capítulo I\n\nA lua é azul.\n\nCapítulo II\n\nÀ noite, lemos: «Olá!»', 'Uma aventura')), engine: { version: 1, status: 'paused', elapsed: 12.25, readingIndex: 3, enemies: [{ id: 4, word: 'é', typed: 1, x: .2, y: .3 }], targetId: 4, score: 320, lives: 2 }, session: { levelIndex: 0, percent: 37, uiLanguage: 'fr', textLanguage: 'pt', transcript: 'A lua ' } });

test('save and reopen preserves document, target, partial typing, position and stats exactly', () => {
  const storage = memoryStorage(), initial = fixture();
  const writer = createProgressStore(storage);
  assert.equal(writer.save(initial), true);
  initial.engine.score = 9999;
  const saved = createProgressStore(storage).load();
  assert.deepEqual(saved.campaign, initial.campaign);
  assert.deepEqual(saved.session, initial.session);
  assert.deepEqual(saved.engine.enemies, initial.engine.enemies);
  assert.equal(saved.engine.score, 320);
  assert.equal(saved.engine.elapsed, 12.25);
  assert.equal(saved.version, 1);
  assert.ok(saved.savedAt > 0);
});

test('corrupt JSON, unknown versions and inconsistent level offsets cannot resume', () => {
  const storage = memoryStorage(), store = createProgressStore(storage);
  for (const raw of ['{broken', 'null', '{"version":99}', '{"__proto__":{"polluted":true}}']) {
    storage.setItem(PROGRESS_KEY, raw);
    assert.equal(store.load(), null);
    assert.equal(store.error, 'invalidProgress');
  }
  store.save(fixture());
  const saved = store.load(); saved.campaign.levels[0].endWord = 700;
  storage.setItem(PROGRESS_KEY, JSON.stringify(saved));
  assert.equal(store.load(), null);
  assert.equal({}.polluted, undefined);
});

test('blocked or unavailable browser storage never prevents playing', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const store = createProgressStore(storage);
  assert.equal(store.load(), null);
  assert.equal(store.available, false);
  assert.equal(store.error, 'storageUnavailable');
  assert.equal(store.save(fixture()), false);
  assert.equal(store.clear(), false);
  assert.equal(createProgressStore(null).load(), null);
});

test('quota errors keep the previous checkpoint and provide an actionable error', () => {
  const storage = memoryStorage(), store = createProgressStore(storage);
  store.save(fixture()); const previous = storage.getItem(PROGRESS_KEY);
  storage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
  assert.equal(store.save(fixture()), false);
  assert.equal(store.error, 'storageFull');
  assert.equal(storage.getItem(PROGRESS_KEY), previous);
  assert.ok(store.load());
});

test('oversized and non-JSON snapshots fail without overwriting an existing checkpoint', () => {
  const storage = memoryStorage(), store = createProgressStore(storage);
  store.save(fixture()); const previous = storage.getItem(PROGRESS_KEY);
  const oversized = fixture(); oversized.session.transcript = 'x'.repeat(MAX_PROGRESS_BYTES / 2);
  assert.equal(store.save(oversized), false);
  assert.equal(store.error, 'progressTooLarge');
  const invalid = fixture(); invalid.engine.score = Infinity;
  assert.equal(store.save(invalid), false);
  assert.equal(store.error, 'invalidProgress');
  const cycle = fixture(); cycle.session.self = cycle.session;
  assert.equal(store.save(cycle), false);
  assert.equal(storage.getItem(PROGRESS_KEY), previous);
});

test('clear removes only campaign progress', () => {
  const storage = memoryStorage(), store = createProgressStore(storage);
  storage.setItem('orbita-settings', 'preserved'); store.save(fixture());
  assert.equal(store.clear(), true);
  assert.equal(store.load(), null);
  assert.equal(storage.getItem('orbita-settings'), 'preserved');
});

test('real engine resumes the same partial word after persistence and reaches the next chapter', () => {
  const storage = memoryStorage(), store = createProgressStore(storage);
  const campaign = createCampaign(documentFromText('Capítulo I\n\nÁgua azul.\n\nCapítulo II\n\nO fim.'));
  const game = new GameEngine({ mode: 'reading', advanced: true, campaignLevels: campaign.levels, random: () => .5 }).start();
  game.typeChar('Á'); game.tick(.1); game.pause();
  assert.equal(store.save({ campaign, engine: game.snapshot(), session: { typedDisplay: 'Á' } }), true);
  const saved = createProgressStore(storage).load();
  const resumed = GameEngine.fromSnapshot(saved.engine, { random: () => .5 });
  assert.equal(resumed.status, 'paused');
  assert.equal(resumed.correct, 1);
  assert.equal(resumed.enemies[0].progress, 1);
  assert.equal(resumed.elapsed, .1);
  resumed.resume();
  for (const character of 'guaazul.') resumed.typeChar(character);
  assert.equal(resumed.status, 'transition');
  assert.equal(resumed.nextLevel(), true);
  assert.equal(resumed.level, 2);
  assert.equal(resumed.enemies[0].word, 'O');
});
