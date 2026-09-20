import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, LEVEL_NAMES, normalizeText, wordsFromText } from './engine.mjs';

const create = (options = {}) => new GameEngine({ random: () => 0.5, ...options }).start();
const advance = (game, seconds) => {
  for (let remaining = seconds; remaining > 0.000001; remaining -= 0.1) game.tick(Math.min(0.1, remaining));
};
const enemy = (id, word, y = 0.5, progress = 0) => ({ id, word, progress, x: id / 10, y, speed: 0.01 });

test('normalizes accents and extracts words without discarding short words', () => {
  assert.equal(normalizeText('ÓRBITA, AÇÃO e CÉU'), 'orbita, acao e ceu');
  assert.deepEqual(wordsFromText('Olá, a lua! 123 • ação-céu'), ['ola', 'a', 'lua', 'acao', 'ceu']);
  assert.deepEqual(wordsFromText(null), []);
});

test('starts with a playable enemy and restarts all session counters', () => {
  const game = new GameEngine({ customText: 'lua', random: () => 0.5 });
  assert.equal(game.status, 'ready');
  assert.equal(game.accuracy, 100);
  assert.equal(game.wpm, 0);
  game.start();
  assert.equal(game.enemies.length, 1);
  assert.equal(game.drainEvents()[0].type, 'wave');
  game.typeChar('l');
  advance(game, 1);
  game.start();
  assert.equal(game.status, 'playing');
  assert.equal(game.score, 0);
  assert.equal(game.elapsed, 0);
  assert.equal(game.correct, 0);
  assert.equal(game.lives, 3);
  assert.equal(game.enemies[0].progress, 0);
  assert.equal(game.enemies[0].word, 'lua');
});

test('selects the nearest matching enemy and preserves its lock through mistakes', () => {
  const game = create();
  game.enemies = [enemy(101, 'lua', 0.2), enemy(102, 'luz', 0.7), enemy(103, 'sol', 0.9)];
  assert.equal(game.typeChar('L'), true);
  assert.equal(game.targetId, 102);
  assert.equal(game.typeChar('s'), false);
  assert.equal(game.targetId, 102);
  assert.equal(game.enemies[1].progress, 1);
  assert.equal(game.enemies[2].progress, 0);
  assert.equal(game.mistakes, 1);
  assert.equal(game.typeChar('ú'), true);
  assert.equal(game.typeChar('z'), true);
  assert.equal(game.targetId, null);
  assert.equal(game.enemies.some((entry) => entry.id === 102), false);
  assert.equal(game.kills, 1);
  assert.equal(game.correct, 3);
  assert.equal(game.accuracy, 75);
  assert.equal(game.bestStreak, 2);
  assert.equal(game.drainEvents().filter((entry) => entry.type === 'destroy').length, 1);
  assert.deepEqual(game.drainEvents(), []);
});

test('releasing a target retains progress and allows resuming with its next letter', () => {
  const game = create();
  game.enemies = [enemy(101, 'lua'), enemy(102, 'sol')];
  game.typeChar('l');
  game.releaseTarget();
  game.typeChar('s');
  assert.equal(game.targetId, 102);
  game.releaseTarget();
  assert.equal(game.typeChar('u'), true);
  assert.equal(game.targetId, 101);
  assert.equal(game.enemies[0].progress, 2);
  assert.equal(game.enemies[1].progress, 1);
});

test('backspace, spaces, punctuation, and multi-letter input have no score side effects', () => {
  const game = create({ customText: 'lua' });
  for (const input of ['Backspace', '\b', '', ' ', '.', 'lu', '😊', null]) assert.equal(game.typeChar(input), false);
  assert.equal(game.mistakes, 0);
  assert.equal(game.correct, 0);
  assert.equal(game.typeChar('x'), false);
  assert.equal(game.mistakes, 1);
  assert.equal(game.targetId, null);
});

test('pause freezes movement, spawn timing, typing and metrics until resumed', () => {
  const game = create({ customText: 'lua' });
  advance(game, 1);
  game.pause();
  const snapshot = JSON.stringify({ enemies: game.enemies, elapsed: game.elapsed, score: game.score });
  advance(game, 10);
  assert.equal(game.typeChar('l'), false);
  assert.equal(JSON.stringify({ enemies: game.enemies, elapsed: game.elapsed, score: game.score }), snapshot);
  game.resume();
  assert.equal(game.typeChar('l'), true);
  assert.equal(game.wpm, 12);
  game.tick(0.1);
  assert.ok(game.elapsed > 1);
});

test('escaped enemies cost lives and game over stops subsequent updates', () => {
  const game = create();
  game.enemies = [enemy(101, 'lua', 0.9999), enemy(102, 'sol', 0.9999), enemy(103, 'ar', 0.9999)];
  game.typeChar('l');
  game.tick(0.1);
  assert.equal(game.lives, 0);
  assert.equal(game.status, 'over');
  assert.equal(game.targetId, null);
  assert.equal(game.streak, 0);
  const events = game.drainEvents();
  assert.equal(events.filter((event) => event.type === 'damage').length, 3);
  assert.equal(events.at(-1).type, 'over');
  const elapsed = game.elapsed;
  game.resume();
  game.tick(0.1);
  assert.equal(game.elapsed, elapsed);
  assert.equal(game.typeChar('a'), false);
});

test('eight destroyed words complete level one and immediately replace an empty field', () => {
  const game = create({ customText: 'a' });
  for (let i = 0; i < 8; i += 1) {
    assert.equal(game.typeChar('a'), true);
    assert.ok(game.enemies.length > 0);
  }
  assert.equal(game.wave, 2);
  assert.equal(game.kills, 8);
  assert.equal(game.bestStreak, 8);
  assert.equal(game.level, 2);
  assert.equal(game.levelGoal, 10);
  assert.equal(game.levelKills, 0);
  assert.equal(game.levelProgress, 0);
  assert.deepEqual(game.drainEvents().filter((event) => event.type === 'wave').map((event) => event.wave), [1, 2]);
});

test('custom text keeps source order, repeats, and retains long words', () => {
  const game = create({ customText: 'É, lua! pneumoultramicroscopicossilicovulcanoconiose — sol.' });
  for (const expected of ['e', 'lua', 'pneumoultramicroscopicossilicovulcanoconiose', 'sol', 'e']) {
    assert.equal(game.enemies[0].word, expected);
    for (const char of expected) assert.equal(game.typeChar(char), true);
  }
  const fallback = create({ customText: '123 😊 pneumoultramicroscopicossilicovulcanoconiose' });
  assert.equal(fallback.enemies[0].word, 'pneumoultramicroscopicossilicovulcanoconiose');
});

test('fixed random sources are deterministic and each difficulty changes travel time', () => {
  const a = create();
  const b = create();
  advance(a, 10);
  advance(b, 10);
  assert.deepEqual(a.enemies, b.enemies);
  assert.ok(a.enemies.every((entry) => entry.x >= 0.12 && entry.x <= 0.88));
  assert.equal(new Set(a.enemies.map((entry) => entry.x)).size, a.enemies.length);
  assert.equal(new Set(a.enemies.map((entry) => entry.word[0])).size, a.enemies.length);
  const normal = create({ difficulty: 'normal' });
  const hard = create({ difficulty: 'hard' });
  const extreme = create({ difficulty: 'extreme' });
  assert.ok(normal.enemies[0].speed < hard.enemies[0].speed);
  assert.ok(hard.enemies[0].speed < extreme.enemies[0].speed);
  assert.equal(1 / normal.enemies[0].speed, 15);
  assert.equal(1 / hard.enemies[0].speed, 11.5);
  assert.equal(1 / extreme.enemies[0].speed, 8.5);
  assert.equal(create({ difficulty: 'easy' }).difficulty, 'normal');
  assert.equal(create({ difficulty: 'unknown' }).difficulty, 'normal');
});

test('long or invalid time steps cannot jump the game forward, and crowd is bounded', () => {
  const game = create({ customText: 'a', progression: 'endless' });
  const y = game.enemies[0].y;
  for (const dt of [NaN, Infinity, -1, 0]) game.tick(dt);
  assert.equal(game.elapsed, 0);
  game.tick(600);
  assert.equal(game.elapsed, 0.1);
  assert.ok(game.enemies[0].y - y < 0.01);
  for (let i = 0; i < 100; i += 1) game.typeChar('a');
  assert.ok(game.wave > 6);
  for (let i = 0; i < 300; i += 1) {
    for (const entry of game.enemies) entry.speed = 0;
    game.tick(0.1);
    assert.ok(game.enemies.length <= 6);
  }
  assert.equal(game.enemies.length, 6);
});

test('reading mode selects only the oldest word and immediately follows source order', () => {
  const game = create({ mode: 'reading', customText: 'A lua brilha' });
  assert.equal(game.readingIndex, 0);
  assert.equal(game.targetId, game.enemies[0].id);
  advance(game, 3);
  assert.deepEqual(game.enemies.map((entry) => entry.word), ['a', 'lua']);
  assert.deepEqual(game.enemies.map((entry) => entry.sequenceIndex), [0, 1]);
  const oldestId = game.targetId;
  game.releaseTarget();
  assert.equal(game.targetId, oldestId);
  assert.equal(game.typeChar('l'), false);
  assert.equal(game.targetId, oldestId);
  assert.equal(game.enemies[1].progress, 0);
  assert.equal(game.mistakes, 1);
  assert.equal(game.readingIndex, 0);
  assert.equal(game.typeChar('a'), true);
  assert.equal(game.readingIndex, 1);
  assert.equal(game.enemies.find((entry) => entry.id === game.targetId).word, 'lua');
  for (const char of 'lua') assert.equal(game.typeChar(char), true);
  assert.equal(game.readingIndex, 2);
  assert.equal(game.enemies.find((entry) => entry.id === game.targetId).word, 'brilha');
  assert.deepEqual(game.drainEvents().filter((event) => event.type === 'destroy').map((event) => event.sequenceIndex), [0, 1]);
});

test('reading mode advances past damaged words while holding following words back', () => {
  const game = create({ mode: 'reading', customText: 'lua sol mar' });
  advance(game, 10);
  assert.equal(game.enemies.length, 3);
  const ordered = [...game.enemies];
  // Even a later word with a much faster speed cannot overtake its predecessor.
  ordered[0].y = 0.999;
  ordered[1].y = 0.999;
  ordered[2].y = 0.999;
  ordered[1].speed = 5;
  ordered[2].speed = 10;
  game.tick(0.1);
  assert.equal(game.lives, 2);
  assert.equal(game.readingIndex, 1);
  assert.equal(game.targetId, ordered[1].id);
  assert.ok(game.enemies[1].y <= game.enemies[0].y - 0.08);
  assert.equal(game.typeChar('l'), false);
  for (const char of 'sol') assert.equal(game.typeChar(char), true);
  assert.equal(game.readingIndex, 2);
  assert.equal(game.targetId, ordered[2].id);
  const resolved = game.drainEvents().filter((event) => ['destroy', 'damage'].includes(event.type));
  assert.deepEqual(resolved.map((event) => [event.type, event.sequenceIndex]), [['damage', 0], ['destroy', 1]]);
});

test('reading sequence indices remain absolute when the passage repeats and reset on restart', () => {
  const game = create({ mode: 'reading', customText: 'a e' });
  for (const char of ['a', 'e', 'a', 'e', 'a']) game.typeChar(char);
  assert.equal(game.readingIndex, 5);
  assert.equal(game.enemies[0].word, 'e');
  assert.equal(game.enemies[0].sequenceIndex, 5);
  game.start();
  assert.equal(game.readingIndex, 0);
  assert.equal(game.enemies[0].sequenceIndex, 0);
  assert.equal(game.targetId, game.enemies[0].id);
  const arcade = create({ customText: 'a' });
  arcade.typeChar('a');
  assert.equal(arcade.mode, 'arcade');
  assert.equal(arcade.readingIndex, 0);
});

test('campaign completes ten titled levels, wins once, and retains unfinished targets', () => {
  const game = create({ customText: 'a', mode: 'reading' });
  assert.equal(game.progression, 'campaign');
  assert.equal(LEVEL_NAMES.length, 10);
  for (let level = 1; level <= 10; level += 1) {
    assert.equal(game.level, level);
    const goal = 8 + (level - 1) * 2;
    assert.equal(game.levelGoal, goal);
    for (let word = 0; word < goal - 1; word += 1) assert.equal(game.typeChar('a'), true);
    assert.equal(game.levelKills, goal - 1);
    assert.ok(game.levelProgress > 0 && game.levelProgress < 1);
    // A second, unfinished target survives the transition (or final victory).
    advance(game, 3);
    const survivor = game.enemies[1];
    assert.ok(survivor);
    assert.equal(game.typeChar('a'), true);
    assert.ok(game.enemies.includes(survivor));
  }
  assert.equal(game.status, 'won');
  assert.equal(game.level, 10);
  assert.equal(game.levelProgress, 1);
  assert.equal(game.levelKills, 26);
  assert.equal(game.kills, 170);
  const elapsed = game.elapsed;
  const positions = game.enemies.map((entry) => entry.y);
  game.tick(0.1);
  assert.equal(game.typeChar('a'), false);
  game.resume();
  assert.equal(game.status, 'won');
  assert.equal(game.elapsed, elapsed);
  assert.deepEqual(game.enemies.map((entry) => entry.y), positions);
  const events = game.drainEvents();
  const announcements = events.filter((event) => event.type === 'wave');
  assert.deepEqual(announcements.map((event) => event.title), LEVEL_NAMES);
  assert.equal(events.filter((event) => event.type === 'victory').length, 1);
  assert.equal(events.at(-1).type, 'victory');
  game.start();
  assert.equal(game.status, 'playing');
  assert.equal(game.level, 1);
  assert.equal(game.levelKills, 0);
  assert.equal(game.speedPercent, 100);
});

test('endless continues beyond ten levels without victory', () => {
  const game = create({ customText: 'a', progression: 'endless' });
  for (let i = 0; i < 200; i += 1) assert.equal(game.typeChar('a'), true);
  assert.ok(game.level > 10);
  assert.equal(game.status, 'playing');
  assert.equal(game.kills, 200);
  assert.ok(game.speedPercent > 100);
  assert.equal(game.drainEvents().some((event) => event.type === 'victory'), false);
});

test('endless time increases speed of an existing target smoothly and freezes during pause', () => {
  const game = create({ customText: 'lua sol', progression: 'endless' });
  const target = game.enemies[0];
  const originalY = target.y;
  game.tick(0.1);
  const initialDelta = target.y - originalY;
  const initialPace = game.speedMultiplier;
  advance(game, 4);
  const before = target.y;
  game.tick(0.1);
  assert.ok(target.y - before > initialDelta);
  assert.ok(game.enemies.includes(target));
  assert.ok(game.speedMultiplier > initialPace);
  const pausedPace = game.speedMultiplier;
  const pausedY = target.y;
  game.pause();
  advance(game, 60);
  assert.equal(game.speedMultiplier, pausedPace);
  assert.equal(target.y, pausedY);
  game.resume();
  game.tick(0.1);
  assert.ok(game.speedMultiplier > pausedPace);
  assert.ok(game.speedMultiplier - pausedPace < 0.01);
});

test('campaign speeds up surviving targets with level progress and gives long words extra time', () => {
  const game = create({ customText: 'a lua' });
  advance(game, 2.5);
  const survivor = game.enemies[1];
  const before = survivor.y;
  game.tick(0.1);
  const originalDelta = survivor.y - before;
  const originalPace = game.speedMultiplier;
  game.typeChar('a');
  assert.ok(game.speedMultiplier > originalPace);
  const secondBefore = survivor.y;
  game.tick(0.1);
  assert.ok(survivor.y - secondBefore > originalDelta);
  const short = create({ customText: 'lua' });
  const long = create({ customText: 'constelacao' });
  assert.ok(long.enemies[0].speed < short.enemies[0].speed);
});

test('advanced typing requires case, accents, punctuation, numbers and symbols', () => {
  const game = create({ mode: 'reading', advanced: true, customText: 'É, 50% €2! 😊' });
  assert.equal(game.typeChar('e'), false);
  assert.equal(game.typeChar('é'), false);
  assert.equal(game.typeChar('E'), false);
  assert.equal(game.typeChar('E\u0301'), true);
  assert.equal(game.kills, 0);
  assert.equal(game.typeChar(','), true);
  for (const token of ['50%', '€2!', '😊']) for (const char of token) assert.equal(game.typeChar(char), true);
  assert.equal(game.kills, 4);
  assert.equal(game.mistakes, 3);
  assert.equal(game.enemies[0].word, 'É,');
});
