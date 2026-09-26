import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from './audio.mjs';

class Parameter {
  constructor(value = 1) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  constructor() {
    this.gain = new Parameter(); this.frequency = new Parameter(); this.Q = new Parameter();
  }
  connect() {}
  disconnect() { this.disconnected = true; }
}
class Source extends Node {
  constructor(context) { super(); this.context = context; this.loop = false; }
  start(at = 0, offset = 0) { this.started = { at, offset }; this.context.started.push(this); }
  stop(at = 0) { this.stopAt = at; }
}
function buffer(duration = 1, rate = 1000) {
  const data = new Float32Array(Math.round(duration * rate));
  return { duration, sampleRate: rate, length: data.length, getChannelData: () => data };
}
class AudioContextMock {
  static instances = [];
  constructor() {
    this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 1000;
    this.started = []; this.destination = new Node(); AudioContextMock.instances.push(this);
  }
  resume() { this.resumeCalled = true; this.state = 'running'; return Promise.resolve(); }
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createBufferSource() { return new Source(this); }
  createOscillator() { return new Source(this); }
  createBuffer(channels, length, rate) { return buffer(length / rate, rate); }
  createDynamicsCompressor() {
    const node = new Node();
    for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Parameter();
    return node;
  }
  decodeAudioData(bytes) { return Promise.resolve(bytes); }
  advance(time) {
    this.currentTime = time;
    for (const source of this.started) if (!source.ended && source.stopAt <= time) { source.ended = true; source.onended?.(); }
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(t) {
  const oldContext = globalThis.AudioContext;
  const oldFetch = globalThis.fetch;
  const requests = new Map();
  AudioContextMock.instances = [];
  globalThis.AudioContext = AudioContextMock;
  globalThis.fetch = (url) => new Promise((resolve) => requests.set(String(url).split('/').pop(), resolve));
  t.after(() => { globalThis.AudioContext = oldContext; globalThis.fetch = oldFetch; });
  return {
    requests,
    async resolve(name, data = buffer(name === 'menu-loop.wav' ? 40 : 30)) {
      assert.ok(requests.has(name), `Requested ${name}`);
      requests.get(name)({ ok: true, arrayBuffer: () => Promise.resolve(data) });
      await flush();
    },
  };
}

test('does not create context or fetch files until a user unlock; resume is called synchronously', async (t) => {
  const { requests } = setup(t);
  const audio = new GameAudio();
  audio.setScene('game'); audio.setMusicVolume(0.2); audio.setEnabled(true);
  assert.equal(AudioContextMock.instances.length, 0);
  assert.equal(requests.size, 0);
  const result = audio.unlock();
  assert.equal(AudioContextMock.instances.length, 1);
  assert.equal(audio.context.resumeCalled, true);
  assert.equal(await result, true);
  assert.deepEqual([...requests.keys()].sort(), ['binary-groove.wav', 'explosion.mp3', 'missile_launch.wav']);
});

test('a stale menu download cannot replace a newer game scene', async (t) => {
  const io = setup(t);
  const audio = new GameAudio(); await audio.unlock();
  audio.setScene('game');
  await io.resolve('menu-loop.wav');
  assert.equal(audio.context.started.length, 0);
  await io.resolve('binary-groove.wav');
  assert.equal(audio._music.scene, 'game');
  assert.equal(audio.context.started.filter((source) => source.loop).length, 1);
});

test('pausing during a pending download prevents late playback', async (t) => {
  const io = setup(t);
  const audio = new GameAudio(); audio.setScene('game'); await audio.unlock();
  audio.setScene('paused');
  await io.resolve('binary-groove.wav');
  assert.equal(audio.context.started.length, 0);
  assert.equal(audio.effect('shot'), false);
});

test('mute during loading stays silent; enabling starts only the latest scene', async (t) => {
  const io = setup(t);
  const audio = new GameAudio(); await audio.unlock();
  audio.setEnabled(false);
  await io.resolve('menu-loop.wav');
  assert.equal(audio.context.started.length, 0);
  audio.setEnabled(true); await flush();
  assert.equal(audio._music.scene, 'menu');
  assert.equal(audio.context.started.length, 1);
});

test('crossfades scenes, reuses current playback, and resumes from its paused offset', async (t) => {
  const io = setup(t);
  const audio = new GameAudio(); await audio.unlock(); await io.resolve('menu-loop.wav');
  const menu = audio._music;
  audio.context.advance(2);
  audio.setScene('game'); await io.resolve('binary-groove.wav');
  const game = audio._music;
  assert.ok(menu.source.stopAt > 2 && menu.source.stopAt < 2.5);
  assert.ok(game.source.started.at >= 2);
  audio.setScene('game'); await flush();
  assert.equal(audio._music, game);
  audio.context.advance(5);
  audio.setScene('paused');
  assert.equal(audio._music, null);
  assert.ok(game.source.stopAt > 5 && game.source.stopAt < 5.25);
  const expectedOffset = 5 - game.startsAt;
  audio.context.advance(8);
  audio.setScene('game'); await flush();
  assert.ok(Math.abs(audio._music.offset - expectedOffset) < 1e-9);
  assert.equal(audio._musicVoices.size, 1);
});

test('trims the real shot to a faded transient and caps repeated same-frame effects', async (t) => {
  const io = setup(t);
  const audio = new GameAudio(); audio.setScene('game'); await audio.unlock();
  const original = buffer(1.875, 44100);
  const data = original.getChannelData(0);
  for (let i = 4410; i < data.length; i++) data[i] = Math.sin(i * 0.2) * 0.9;
  await io.resolve('missile_launch.wav', original);
  assert.equal(audio._shotBuffer.duration, 0.22);
  const transient = audio._shotBuffer.getChannelData(0);
  assert.equal(Math.abs(transient[0]), 0);
  assert.equal(Math.abs(transient[transient.length - 1]), 0);
  assert.ok(Math.max(...transient.map(Math.abs)) <= 0.641);
  assert.equal(audio.effect('shot'), true);
  for (let i = 0; i < 100; i++) assert.equal(audio.effect('shot'), false);
  assert.equal(audio._effects.size, 1);
  audio.context.advance(0.03);
  assert.equal(audio.effect('shot'), true);
  audio.setEnabled(false);
  assert.equal(audio.effect('shot'), false);
  for (const voice of audio._effects) assert.ok(voice.source.stopAt <= 0.05);
});

test('uses a synthesised shot when the sample has not arrived and clamps live volume controls', async (t) => {
  setup(t);
  const audio = new GameAudio(); await audio.unlock();
  assert.equal(audio.effect('shot'), true);
  assert.equal(audio.context.started[0].type, 'triangle');
  audio.setMusicVolume(5); audio.setSfxVolume(-4);
  assert.equal(audio._musicBus.gain.value, 1);
  assert.equal(audio._sfxBus.gain.value, 0);
  audio.setMusicVolume(NaN); assert.equal(audio.musicVolume, 1);
  audio.setScene('off'); assert.equal(audio.effect('victory'), false);
});

test('word destruction plays the supplied explosion and respects mute and pause', async (t) => {
  const requests = setup(t); const audio = new GameAudio(); await audio.unlock();
  const explosion = buffer(.8); await requests.resolve('explosion.mp3', explosion);
  assert.equal(audio.effect('destroy'), true);
  assert.equal(audio.context.started.at(-1).buffer, explosion);
  audio.setScene('paused'); assert.equal(audio.effect('destroy'), false);
  audio.setScene('game'); audio.setEnabled(false); assert.equal(audio.effect('destroy'), false);
});

test('new event cues are silent before unlock and respect pause, mute and off', async (t) => {
  setup(t); const audio = new GameAudio();
  for (const cue of ['combo', 'gameover', 'start']) assert.equal(audio.effect(cue), false);
  await audio.unlock();
  for (const scene of ['paused', 'off']) {
    audio.setScene(scene);
    for (const cue of ['combo', 'gameover', 'start']) assert.equal(audio.effect(cue), false);
  }
  audio.setScene('game'); audio.setEnabled(false);
  for (const cue of ['combo', 'gameover', 'start']) assert.equal(audio.effect(cue), false);
  assert.equal(audio.context.started.length, 0);
});

test('combo is rate limited and game over is a finite descending cue', async (t) => {
  setup(t); const audio = new GameAudio(); await audio.unlock();
  assert.equal(audio.effect('combo', 2), true);
  assert.equal(audio.context.started.length, 3);
  assert.equal(audio.effect('combo', 2), false);
  audio.context.advance(.4);
  assert.equal(audio.effect('combo', 3), true);
  audio.context.advance(1);
  const before = audio.context.started.length;
  assert.equal(audio.effect('gameover'), true);
  const notes = audio.context.started.slice(before);
  assert.equal(notes.length, 4);
  assert.ok(notes.every((note, i) => i === 0 || note.frequency.value < notes[i - 1].frequency.value));
  assert.ok(notes.every(note => note.stopAt > note.started.at && note.stopAt < 2));
  audio.context.advance(2);
  assert.equal(audio._effects.size, 0);
});

test('explosion overlap is bounded and its tail stops within one second', async (t) => {
  const io = setup(t); const audio = new GameAudio(); await audio.unlock();
  await io.resolve('explosion.mp3', buffer(8));
  assert.equal(audio.effect('destroy'), true);
  assert.equal(audio.effect('destroy'), false);
  assert.ok(audio.context.started.at(-1).stopAt < 1);
  assert.equal(audio.effect('damage'), true);
  assert.equal(audio.effect('damage'), false);
  for (let i = 0; i < 30; i++) audio.effect('gameover');
  assert.ok(audio._effects.size <= 18);
  audio.context.advance(2);
  assert.equal(audio._effects.size, 0);
});

test('event ducking does not overwrite separate player volume preferences', async (t) => {
  const io = setup(t); const audio = new GameAudio({ musicVolume: .17, sfxVolume: .63 }); await audio.unlock();
  await io.resolve('menu-loop.wav');
  audio.effect('victory');
  assert.equal(audio.musicVolume, .17); assert.equal(audio._musicBus.gain.value, .17);
  assert.equal(audio.sfxVolume, .63); assert.equal(audio._sfxBus.gain.value, .63);
  // The scheduled recovery ends at full level on its dedicated bus.
  assert.equal(audio._musicDuck.gain.value, 1);
  audio.setScene('paused'); assert.equal(audio._musicDuck.gain.value, 1);
});
