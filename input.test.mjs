import test from "node:test";
import assert from "node:assert/strict";
import { TypingInput } from "./input.mjs";
import { GameEngine } from "./engine.mjs";

class FakeInput extends EventTarget {
  value = "";
  selectionStart = 0;
  selectionEnd = 0;

  update(value, eventType = "input", properties = {}) {
    this.value = value;
    this.selectionStart = value.length;
    this.selectionEnd = value.length;
    this.dispatchEvent(Object.assign(new Event(eventType), properties));
  }
}

function setup() {
  const input = new FakeInput();
  const received = [];
  const adapter = new TypingInput(input, (value) => received.push(value));
  return { input, received, adapter };
}

function typingGame() {
  const input = new FakeInput();
  const game = new GameEngine({ mode: 'reading', customText: 'a noite a lua', random: () => .5 }).start();
  let transcript = '';
  const adapter = new TypingInput(input, (text) => {
    for (const letter of text) {
      const before = game.kills;
      if (game.typeChar(letter)) transcript += letter;
      if (game.kills > before) transcript += ' ';
    }
    adapter.format(transcript);
  });
  return { input, game, adapter, transcript: () => transcript };
}

test('completed words receive automatic spaces without requiring a space key', () => {
  const { input, game, transcript } = typingGame();
  for (const letter of 'anoitealua') input.update(input.value + letter);
  assert.equal(input.value, 'a noite a lua ');
  assert.equal(transcript(), input.value);
  assert.equal(game.kills, 4);
  assert.equal(game.mistakes, 0);
  input.update(input.value + ' ');
  assert.equal(input.value, 'a noite a lua ');
});

test('one multiword insertion formats every boundary and rejects wrong letters', () => {
  const { input, game } = typingGame();
  input.update('aznoite a lua');
  assert.equal(input.value, 'a noite a lua ');
  assert.equal(game.kills, 4);
  assert.equal(game.mistakes, 1);
});

test('auto spaces defer native edits through Gboard composition and ignore its final echo', () => {
  const { input, game, transcript } = typingGame();
  const raw = 'anoitealua';
  input.update('', 'compositionstart');
  for (let index = 1; index <= raw.length; index++) input.update(raw.slice(0, index), 'input', { isComposing: true });
  assert.equal(transcript(), 'a noite a lua ');
  assert.equal(input.value, raw);
  assert.equal(game.correct, raw.length);
  input.update(raw, 'compositionend');
  assert.equal(input.value, 'a noite a lua ');
  input.update(raw, 'input', { inputType: 'insertFromComposition' });
  assert.equal(input.value, 'a noite a lua ');
  assert.equal(game.correct, raw.length);
  assert.equal(game.mistakes, 0);
});

test('a missing trailing composition event does not eat the next real letter', () => {
  const { input, game } = typingGame();
  input.update('', 'compositionstart');
  input.update('a', 'input', { isComposing: true });
  input.update('a', 'compositionend');
  input.update('an');
  assert.equal(game.correct, 2);
  assert.equal(input.value, 'a n');
  assert.equal(game.mistakes, 0);
});

test("native input emits typed characters, including repeated letters and words", () => {
  const { input, received } = setup();
  for (const value of ["a", "aa", "aa ", "aa a", "aa aa"]) input.update(value);
  assert.deepEqual(received, ["a", "a", " ", "a", "a"]);
  assert.equal(input.value, "aa aa");
});

test("multi-character and predictive insertions work when event.data is null", () => {
  const { input, received } = setup();
  input.update("pla", "input", { data: null });
  input.update("planeta ", "input", { data: null, inputType: "insertReplacementText" });
  input.update("planeta azul", "input", { data: "azul" });
  assert.deepEqual(received, ["pla", "neta ", "azul"]);
});

test("accent and case corrections do not replay previously typed letters", () => {
  const { input, received } = setup();
  input.update("a");
  input.update("á", "input", { inputType: "insertReplacementText" });
  input.update("A\u0301");
  input.update("Áé");
  input.update("Áéê");
  assert.deepEqual(received, ["a", "é", "ê"]);
});

test("Latin composition streams each appended letter and ignores duplicate final input", () => {
  const { input, received } = setup();
  input.update("", "compositionstart");
  input.update("c", "input", { isComposing: true });
  input.update("ca", "input", { isComposing: true });
  input.update("cão", "input", { isComposing: true });
  assert.deepEqual(received, ["c", "a", "o"]);
  input.update("cão", "compositionend", { data: "cão" });
  input.update("cão", "input", { inputType: "insertFromComposition", data: "cão" });
  input.update("cãoa");
  assert.deepEqual(received, ["c", "a", "o", "a"]);
});

test("Gboard-style word composition fires each key before compositionend", () => {
  const { input, received } = setup();
  input.update("", "compositionstart");
  for (const [index, value] of ["n", "na", "nav", "nave"].entries()) {
    input.update(value, "input", { isComposing: true, inputType: "insertCompositionText" });
    assert.deepEqual(received, Array.from("nave").slice(0, index + 1));
  }
  input.update("nave", "compositionend");
  input.update("nave", "input", { inputType: "insertFromComposition" });
  assert.deepEqual(received, ["n", "a", "v", "e"]);
});

test("accent and case rewrites during streamed composition do not create new shots", () => {
  const { input, received } = setup();
  input.update("", "compositionstart");
  input.update("a", "input", { isComposing: true });
  input.update("á", "input", { isComposing: true });
  input.update("A\u0301", "input", { isComposing: true });
  input.update("Ás", "input", { isComposing: true });
  assert.deepEqual(received, ["a", "s"]);
  input.update("Ás", "compositionend");
  input.update("Ás");
  assert.deepEqual(received, ["a", "s"]);
});

test("non-Latin composition sends only its final candidate", () => {
  const { input, received } = setup();
  input.update("", "compositionstart");
  input.update("に", "input", { isComposing: true });
  input.update("にほ", "input", { isComposing: true });
  input.update("日本", "input", { isComposing: true });
  assert.deepEqual(received, []);
  input.update("日本", "compositionend");
  input.update("日本", "input", { inputType: "insertFromComposition" });
  assert.deepEqual(received, ["日本"]);
});

test("candidate replacement defers the remaining composition until commit", () => {
  const { input, received } = setup();
  input.update("", "compositionstart");
  input.update("ca", "input", { isComposing: true });
  input.update("co", "input", { isComposing: true });
  input.update("cor", "input", { isComposing: true });
  assert.deepEqual(received, ["ca"]);
  input.update("cor", "compositionend");
  input.update("cor", "input", { inputType: "insertFromComposition" });
  assert.deepEqual(received, ["ca", "or"]);
});

test("long-press accent composition does not duplicate the already committed base", () => {
  const { input, received } = setup();
  input.update("a");
  input.update("a", "compositionstart");
  input.update("á", "input", { isComposing: true });
  input.update("á", "compositionend");
  input.update("á", "input", { data: "á" });
  assert.deepEqual(received, ["a"]);
});

test("compositionend before final value update still emits the final input once", () => {
  const { input, received } = setup();
  input.update("", "compositionstart");
  input.update("", "compositionend", { data: "é" });
  input.update("é", "input", { inputType: "insertFromComposition" });
  assert.deepEqual(received, ["é"]);
});

test("backspace, range deletion, and selection replacement use actual value changes", () => {
  const { input, received } = setup();
  input.update("abcd");
  input.update("abc", "input", { inputType: "deleteContentBackward" });
  input.update("ac", "input", { inputType: "deleteContentForward" });
  input.update("aXYc", "input", { inputType: "insertText" });
  input.update("aZc", "input", { inputType: "insertReplacementText" });
  input.update("ac");
  assert.deepEqual(received, ["abcd", "XY", "Z"]);
});

test("buffer cleanup waits for a whitespace boundary and supports the following letter", () => {
  const { input, received } = setup();
  const longWord = "a".repeat(257);
  input.update(longWord);
  assert.equal(input.value, longWord);
  input.update(`${longWord} `);
  assert.equal(input.value, "");
  input.update("a");
  assert.deepEqual(received, [longWord, " ", "a"]);
});

test("long composition commit retains its value through the trailing input event", () => {
  const { input, received } = setup();
  const longText = `${"a".repeat(257)} `;
  input.update("", "compositionstart");
  input.update(longText, "input", { isComposing: true });
  input.update(longText, "compositionend");
  assert.equal(input.value, longText);
  input.update(longText, "input", { inputType: "insertFromComposition" });
  assert.equal(input.value, "");
  input.update("b");
  assert.deepEqual(received, [longText, "b"]);
});

test("reset permits a repeated first letter and destroy removes listeners", () => {
  const { input, received, adapter } = setup();
  input.update("a");
  adapter.reset();
  input.update("a");
  adapter.destroy();
  input.update("ab");
  assert.deepEqual(received, ["a", "a"]);
});

test("reset during composition discards its pending commit and trailing input", () => {
  const { input, received, adapter } = setup();
  input.update("", "compositionstart");
  input.update("に", "input", { isComposing: true });
  adapter.reset();
  input.update("日本", "compositionend");
  input.update("日本", "input", { inputType: "insertFromComposition" });
  input.update("b");
  assert.deepEqual(received, ["b"]);
});

test("reset stops streaming an in-flight Latin composition into the next game", () => {
  const { input, received, adapter } = setup();
  input.update("", "compositionstart");
  input.update("n", "input", { isComposing: true });
  adapter.reset();
  input.update("na", "input", { isComposing: true });
  input.update("nav", "input", { isComposing: true });
  input.update("nave", "compositionend");
  input.update("nave", "input", { inputType: "insertFromComposition" });
  input.update("b");
  assert.deepEqual(received, ["n", "b"]);
});

test('exact input waits for committed accents and emits punctuation without duplicate IME tail', () => {
  const { input, received, adapter } = setup(); adapter.exact = true;
  input.update('', 'compositionstart');
  input.update('e', 'input', { isComposing: true });
  input.update('é', 'input', { isComposing: true });
  assert.deepEqual(received, []);
  input.update('é', 'compositionend');
  input.update('é', 'input', { inputType: 'insertFromComposition' });
  input.update('é,50%');
  assert.deepEqual(received, ['é', ',50%']);
});
