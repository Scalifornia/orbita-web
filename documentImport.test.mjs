import test from 'node:test';
import assert from 'node:assert/strict';
import { importDocument, documentFromText, normalizeDocumentText, sectionsFromText, textFromPdfItems, DOCUMENT_LIMITS } from './documentImport.mjs';

const file = (name, content) => { const data = typeof content === 'string' ? new TextEncoder().encode(content) : content; return { name, size: data.byteLength, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }; };

test('pasted text preserves paragraph breaks, accents, numbers and punctuation', () => {
  const source = '\uFEFFCapítulo I\r\n\r\nA raposa disse: “Olá, leão!”\r\n\r\n  São 20% mais!\tEstá bem?\u0000';
  const document = documentFromText(source, 'O livro');
  assert.equal(document.title, 'O livro');
  assert.equal(document.sections.length, 1);
  assert.equal(document.sections[0].title, 'Capítulo I');
  assert.equal(document.sections[0].text, 'A raposa disse: “Olá, leão!”\n\nSão 20% mais! Está bem?');
  assert.equal(document.format, 'txt');
  assert.equal(document.wordCount, 10);
});

test('TXT import recognizes UTF-8 and UTF-16 byte order marks', async () => {
  const utf8 = await importDocument(file('História.TXT', 'Olá!\n\nAção e emoção.'));
  assert.equal(utf8.title, 'História');
  assert.equal(utf8.text, 'Olá!\n\nAção e emoção.');
  const text = 'É uma história.';
  const data = new Uint8Array(2 + text.length * 2); data.set([255, 254]);
  const view = new DataView(data.buffer);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  assert.equal((await importDocument(file('Livro.txt', data))).text, text);
});

test('older Western text files retain accented letters', async () => {
  assert.equal((await importDocument(file('legado.txt', new Uint8Array([79, 108, 225, 33])))).text, 'Olá!');
});

test('imports reject unsupported, oversized, empty and invalid archive files', async () => {
  for (const [input, code] of [
    [file('script.html', '<p>Hello</p>'), 'unsupportedFormat'],
    [{ ...file('big.txt', 'hello'), size: DOCUMENT_LIMITS.bytes + 1 }, 'documentTooLarge'],
    [file('empty.txt', ' \n\n '), 'emptyDocument'],
    [file('broken.docx', 'not a zip'), 'invalidDocument'],
  ]) await assert.rejects(importDocument(input), (error) => error.code === code);
});

test('chapter extraction retains a preface and chapter order', () => {
  const sections = sectionsFromText('Um prefácio.\n\nCapítulo 1 — O início\n\nPrimeira parte.\n\nCapítulo 2\n\nO fim.');
  assert.deepEqual(sections.map((s) => s.title), ['', 'Capítulo 1 — O início', 'Capítulo 2']);
  assert.deepEqual(sections.map((s) => s.kind), ['section', 'chapter', 'chapter']);
  assert.equal(sections[2].text, 'O fim.');
});

test('normalization removes layout noise while preserving intentional line breaks', () => {
  assert.equal(normalizeDocumentText(' A\u00a0B\tC \r\n\r\n\r\n D\u00adE\u200b\u0000\nF '), 'A B C\n\nDE\nF');
});

test('PDF text joins wrapped lines and preserves paragraphs and hyphenated wraps', () => {
  const item = (str, y, x = 0, hasEOL = true) => ({ str, transform: [12, 0, 0, 12, x, y], height: 12, width: str.length * 6, hasEOL });
  const text = textFromPdfItems([item('Uma aven-', 100), item('tura na floresta.', 86), item('Outro parágrafo.', 55)]);
  assert.equal(text, 'Uma aventura na floresta.\n\nOutro parágrafo.');
});

test('PDF separate text runs use spacing without breaking words into letters', () => {
  const items = [
    { str: 'O', transform: [12, 0, 0, 12, 0, 100], width: 6, height: 12 },
    { str: 'l', transform: [12, 0, 0, 12, 6, 100], width: 3, height: 12 },
    { str: 'á', transform: [12, 0, 0, 12, 9, 100], width: 6, height: 12 },
    { str: 'mundo!', transform: [12, 0, 0, 12, 20, 100], width: 36, height: 12, hasEOL: true },
  ];
  assert.equal(textFromPdfItems(items), 'Olá mundo!');
});
