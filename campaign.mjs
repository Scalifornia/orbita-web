import { normalizeDocumentText, sectionsFromText, DOCUMENT_LIMITS } from './documentImport.mjs';

const countWords = (text) => (text.match(/\S+/gu) ?? []).length;

function sentences(text, language) {
  if (typeof Intl.Segmenter === 'function') {
    try { return [...new Intl.Segmenter(language, { granularity: 'sentence' }).segment(text)].map((part) => part.segment.trim()).filter(Boolean); } catch { /* Unsupported locale uses fallback. */ }
  }
  return text.match(/[^.!?]+(?:[.!?]+["'”’»)]*(?:\s+|$)|$)/gu)?.map((value) => value.trim()).filter(Boolean) ?? [text];
}

function sectionBlocks(text, target, language) {
  const paragraphs = text.split(/\n\s*\n/gu).filter(Boolean);
  const units = paragraphs.flatMap((paragraph) => {
    if (countWords(paragraph) <= target * 2.2) return [{ text: paragraph, paragraphEnd: true }];
    const parts = sentences(paragraph, language);
    return parts.map((part, index) => ({ text: part, paragraphEnd: index === parts.length - 1 }));
  });
  const blocks = []; let textBuffer = '', words = 0, paragraphEnd = false;
  const flush = () => { if (textBuffer) blocks.push({ text: textBuffer, wordCount: words }); textBuffer = ''; words = 0; };
  for (const unit of units) {
    const size = countWords(unit.text);
    // Prefer the nearest natural break once we have a useful amount of text.
    if (words >= target * .55 && Math.abs(target - words) <= Math.abs(target - words - size)) flush();
    textBuffer += `${textBuffer ? (paragraphEnd ? '\n\n' : ' ') : ''}${unit.text}`;
    words += size; paragraphEnd = unit.paragraphEnd;
    if (words >= target) flush();
  }
  flush();
  const last = blocks.at(-1), previous = blocks.at(-2);
  if (previous && last.wordCount < target * .3 && previous.wordCount + last.wordCount <= target * 1.5) {
    previous.text += `\n\n${last.text}`; previous.wordCount += last.wordCount; blocks.pop();
  }
  return blocks;
}

function textHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}

/** Levels never cross chapter/page boundaries or split a sentence mid-way. */
export function createCampaign(document, { targetWords = 100, language = 'pt' } = {}) {
  if (!document || typeof document.text !== 'string') throw new TypeError('A text document is required.');
  if (document.text.length > DOCUMENT_LIMITS.characters) throw new RangeError('Document is too long.');
  const target = Number.isFinite(targetWords) ? Math.max(20, Math.min(500, Math.round(targetWords))) : 100;
  const locale = typeof language === 'string' && language.length < 30 ? language : 'pt';
  const title = normalizeDocumentText(document.title || 'Documento').replace(/\n/gu, ' ').slice(0, 160);
  const sections = Array.isArray(document.sections) && document.sections.length ? document.sections : sectionsFromText(document.text);
  const levels = []; let totalWords = 0, chapterIndex = -1, chapter = '';
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex], body = normalizeDocumentText(section.text);
    if (!body) continue;
    if (section.kind === 'chapter' || chapterIndex < 0) { chapterIndex++; chapter = section.title || title; }
    const blocks = sectionBlocks(body, target, locale);
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      levels.push({
        id: `level-${levels.length + 1}`, title: section.title || chapter || title, chapter, chapterIndex, sectionIndex,
        sectionKind: section.kind ?? 'section', text: block.text, wordCount: block.wordCount,
        startWord: totalWords, endWord: totalWords + block.wordCount,
        isChapterEnd: false,
      });
      totalWords += block.wordCount;
    }
  }
  if (!levels.length) throw new RangeError('Document is empty.');
  levels.forEach((level, index) => { level.isChapterEnd = !levels[index + 1] || levels[index + 1].chapterIndex !== level.chapterIndex; });
  const id = `document-${textHash(`${locale}\u0000${title}\u0000${target}\u0000${levels.map((level) => level.text).join('\n\n')}`)}`;
  return { version: 1, id, title, language: locale, format: document.format || 'txt', levels, totalWords, chapterCount: chapterIndex + 1 };
}

/** Consumed words include a missed word, so reading progress never moves backwards. */
export function campaignProgress(campaign, levelIndex = 0, consumedWords = 0) {
  if (!campaign?.levels?.length || !Number.isFinite(campaign.totalWords) || campaign.totalWords <= 0) return 0;
  if (levelIndex >= campaign.levels.length) return 100;
  const level = campaign.levels[Math.max(0, Math.floor(levelIndex) || 0)];
  const consumed = Number.isFinite(consumedWords) ? Math.min(level.wordCount, Math.max(0, consumedWords)) : 0;
  return Math.min(100, Math.max(0, Math.floor((level.startWord + consumed) / campaign.totalWords * 100)));
}
