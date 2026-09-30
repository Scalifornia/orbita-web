import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, campaignProgress } from './campaign.mjs';
import { documentFromText } from './documentImport.mjs';

const paragraph = (length, word = 'palavra') => `${Array(length).fill(word).join(' ')}.`;
const flat = (text) => text.replace(/\s+/gu, ' ').trim();

test('chapter headings in five languages remain ordered and never share a level', () => {
  const text = ['Capítulo 1', 'Chapter II', 'Chapitre 3', 'Kapitel IV', 'Capítulo cinco'].map((title, index) => `${title}\n\n${paragraph(25, `palavra${index}`)}`).join('\n\n');
  const campaign = createCampaign(documentFromText(text, 'Livro'));
  assert.equal(campaign.chapterCount, 5);
  assert.equal(campaign.levels.length, 5);
  assert.equal(campaign.totalWords, 125);
  campaign.levels.forEach((level, i) => {
    assert.equal(level.chapterIndex, i);
    assert.equal(level.isChapterEnd, true);
    assert.equal(level.startWord, i * 25);
    assert.equal(level.endWord, (i + 1) * 25);
  });
});

test('nearby paragraph boundaries take priority over exact hundred-word cuts', () => {
  const paragraphs = [paragraph(65, 'a'), paragraph(40, 'b'), paragraph(85, 'c'), paragraph(45, 'd')];
  const campaign = createCampaign(documentFromText(paragraphs.join('\n\n')));
  assert.deepEqual(campaign.levels.map((level) => level.wordCount), [105, 85, 45]);
  assert.equal(flat(campaign.levels.map((level) => level.text).join(' ')), flat(paragraphs.join(' ')));
  for (const text of paragraphs) assert.ok(campaign.levels.some((level) => level.text.includes(text)));
});

test('a long paragraph splits only at complete sentence boundaries and retains punctuation', () => {
  const source = Array.from({ length: 10 }, (_, i) => paragraph(35, `Sentença${i}`)).join(' ');
  const campaign = createCampaign(documentFromText(source));
  assert.ok(campaign.levels.length > 2);
  assert.equal(campaign.totalWords, 350);
  assert.equal(flat(campaign.levels.map((level) => level.text).join(' ')), source);
  campaign.levels.forEach((level) => assert.match(level.text, /\.$/u));
});

test('one long sentence is retained whole instead of making an artificial break', () => {
  const source = paragraph(350);
  const campaign = createCampaign(documentFromText(source));
  assert.equal(campaign.levels.length, 1);
  assert.equal(campaign.levels[0].text, source);
});

test('page boundaries remain separate inside a chapter and preserve source word offsets', () => {
  const sections = [
    { title: 'Chapter One', kind: 'chapter', text: paragraph(60) },
    { title: '2', kind: 'page', text: paragraph(50) },
    { title: 'Chapter Two', kind: 'chapter', text: paragraph(20) },
  ];
  const campaign = createCampaign({ title: 'Book', text: sections.map((s) => s.text).join('\n\n'), sections, format: 'pdf' });
  assert.deepEqual(campaign.levels.map((l) => l.isChapterEnd), [false, true, true]);
  assert.deepEqual(campaign.levels.map((l) => l.chapterIndex), [0, 0, 1]);
  assert.deepEqual(campaign.levels.map((l) => l.startWord), [0, 60, 110]);
});

test('campaign IDs are stable and reflect source and segmentation choices', () => {
  const document = documentFromText(paragraph(100), 'A história');
  assert.equal(createCampaign(document).id, createCampaign(document).id);
  assert.notEqual(createCampaign(document).id, createCampaign(document, { language: 'en' }).id);
  assert.notEqual(createCampaign(document).id, createCampaign(document, { targetWords: 80 }).id);
});

test('campaign progress uses completed source words and clamps invalid positions', () => {
  const source = { title: 'Book', text: 'a b c d', sections: [{ title: 'A', text: 'a b', kind: 'chapter' }, { title: 'B', text: 'c d', kind: 'chapter' }] };
  const campaign = createCampaign(source);
  assert.equal(campaignProgress(campaign), 0);
  assert.equal(campaignProgress(campaign, 0, 1), 25);
  assert.equal(campaignProgress(campaign, 1, 1), 75);
  assert.equal(campaignProgress(campaign, 1, 99), 100);
  assert.equal(campaignProgress(campaign, 99), 100);
  assert.equal(campaignProgress(campaign, -1, -1), 0);
  assert.equal(campaignProgress(null), 0);
});

test('empty documents fail without manufacturing levels', () => {
  assert.throws(() => createCampaign({ title: 'Empty', text: '' }), RangeError);
  assert.throws(() => createCampaign(null), TypeError);
});

test('short rounds bound long sentences to twenty words without losing accents or punctuation', () => {
 const source=Array.from({length:53},(_,i)=>`ação${i},`).join(' ');
 const campaign=createCampaign(documentFromText(source),{targetWords:20,shortRounds:true});
 assert.deepEqual(campaign.levels.map(l=>l.wordCount),[20,20,13]);
 assert.equal(campaign.levels.map(l=>l.text).join(' '),source);
});
