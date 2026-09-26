/** All document processing happens on this device. Extracted markup is never rendered. */
export const DOCUMENT_LIMITS = Object.freeze({ bytes: 20 * 1024 * 1024, characters: 1_000_000, expandedBytes: 24 * 1024 * 1024, pages: 1500 });

export class DocumentImportError extends Error {
  constructor(code, message = code) { super(message); this.name = 'DocumentImportError'; this.code = code; }
}
const fail = (code) => { throw new DocumentImportError(code); };
const wordCount = (text) => (text.match(/\S+/gu) ?? []).length;

export function normalizeDocumentText(value) {
  return String(value ?? '').normalize('NFC').replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n')
    .replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F\u00AD\u200B\u2060]/gu, '')
    .replace(/\f/gu, '\n\n').replace(/[\t\u00A0 ]+/gu, ' ').replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n').trim();
}

// Chapter labels in all built-in languages, with Arabic, Roman or spelled-out numbers.
const CHAPTER = /^(?:chapter|chapitre|kapitel|cap[ií]tulo|parte|part|teil|book|livro|livre|buch)(?:\s+|\s*[:.—–-]\s*)\S.{0,119}$/iu;
const SECTION = /^(?:secção|seção|sección|seccion|section|abschnitt)\s+\S.{0,119}$/iu;

export function sectionsFromText(value) {
  const text = normalizeDocumentText(value);
  if (!text) return [];
  const sections = [];
  let title = '', kind = 'section', lines = [];
  const flush = () => {
    const body = normalizeDocumentText(lines.join('\n'));
    if (body) sections.push({ title, text: body, kind });
    lines = [];
  };
  for (const line of text.split('\n')) {
    if ((CHAPTER.test(line) || SECTION.test(line)) && line.length <= 140) {
      flush(); title = line; kind = CHAPTER.test(line) ? 'chapter' : 'section';
    } else lines.push(line);
  }
  flush();
  // A heading-only document still contains playable text.
  return sections.length ? sections : [{ title: '', text, kind: 'section' }];
}

function finishDocument({ title, text, sections, format }) {
  const normalized = normalizeDocumentText(text);
  if (!normalized || !/\p{L}|\p{N}/u.test(normalized)) fail('emptyDocument');
  if (normalized.length > DOCUMENT_LIMITS.characters) fail('documentTooLong');
  const cleanedSections = (sections ?? sectionsFromText(normalized))
    .map((section) => ({ title: normalizeDocumentText(section.title).slice(0, 240), text: normalizeDocumentText(section.text), kind: section.kind ?? 'section' }))
    .filter((section) => section.text);
  const body = cleanedSections.map((section) => section.text).join('\n\n');
  if (body.length > DOCUMENT_LIMITS.characters) fail('documentTooLong');
  return {
    title: normalizeDocumentText(title).replace(/\n/gu, ' ').slice(0, 160) || 'Documento',
    text: normalized, sections: cleanedSections, format,
    wordCount: wordCount(body), sectionCount: cleanedSections.length,
  };
}

export function documentFromText(text, title = 'Texto') {
  return finishDocument({ title, text, format: 'txt' });
}

function parseXML(text) {
  if (typeof DOMParser === 'undefined') fail('browserRequired');
  // External/custom entities are neither needed nor accepted. A plain XHTML doctype is fine.
  if (/<!ENTITY\b/iu.test(text)) fail('unsupportedDocument');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName === 'parsererror') fail('invalidDocument');
  return doc;
}
const descendants = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
const attribute = (node, name) => node.getAttribute(name) || node.getAttribute(`w:${name}`) || '';

async function extractArchive(data, format) {
  const { unzipSync, strFromU8 } = await import('./vendor/fflate.mjs');
  let size = 0, entries = 0;
  const archive = unzipSync(data, { filter: (file) => {
    if (++entries > 20_000) fail('documentTooLarge');
    const include = format === 'docx'
      ? /^(?:word\/(?:document|styles)\.xml|docProps\/core\.xml)$/u.test(file.name)
      : /(?:\.(?:xml|opf|ncx|xhtml|html|htm)|^mimetype)$/iu.test(file.name);
    if (include) {
      size += file.originalSize;
      if (!Number.isFinite(size) || size > DOCUMENT_LIMITS.expandedBytes) fail('documentTooLarge');
    }
    return include;
  } });
  return Object.fromEntries(Object.entries(archive).map(([name, bytes]) => [name, strFromU8(bytes)]));
}

function docxParagraphText(paragraph) {
  // Ignore deleted revisions, field instructions and drawings; keep visible run text.
  const visit = (node) => {
    if (['del', 'instrText', 'drawing', 'pict'].includes(node.localName)) return '';
    if (node.localName === 't') return node.textContent;
    if (node.localName === 'tab') return ' ';
    if (node.localName === 'br' || node.localName === 'cr') return '\n';
    return Array.from(node.childNodes).map(visit).join('');
  };
  return normalizeDocumentText(visit(paragraph));
}

async function importDocx(data, title) {
  const archive = await extractArchive(data, 'docx');
  if (!archive['word/document.xml']) fail('invalidDocument');
  const doc = parseXML(archive['word/document.xml']);
  const headingStyles = new Set(['Heading1', 'Heading2', 'Title', 'Ttulo1', 'Titre1', 'berschrift1']);
  if (archive['word/styles.xml']) {
    for (const style of descendants(parseXML(archive['word/styles.xml']), 'style')) {
      const name = attribute(descendants(style, 'name')[0] ?? style, 'val');
      if (/^(heading|title|t[ií]tulo|titre|überschrift)\s*[12]?$/iu.test(name) || descendants(style, 'outlineLvl').some((level) => Number(attribute(level, 'val')) <= 1)) {
        headingStyles.add(attribute(style, 'styleId'));
      }
    }
  }
  const sections = []; let current = { title: '', kind: 'section', text: '' };
  for (const paragraph of descendants(doc, 'p')) {
    // A paragraph nested inside a text box would otherwise be included twice.
    let ancestor = paragraph.parentElement, nested = false;
    while (ancestor) { if (ancestor.localName === 'p') { nested = true; break; } ancestor = ancestor.parentElement; }
    if (nested) continue;
    const text = docxParagraphText(paragraph);
    if (!text) continue;
    const style = descendants(paragraph, 'pStyle')[0];
    const heading = text.length <= 200 && ((style && headingStyles.has(attribute(style, 'val'))) || CHAPTER.test(text));
    if (heading) {
      if (current.text) sections.push(current);
      current = { title: text, kind: 'chapter', text: '' };
    } else current.text += `${current.text ? '\n\n' : ''}${text}`;
  }
  if (current.text) sections.push(current);
  if (archive['docProps/core.xml']) {
    const metadataTitle = descendants(parseXML(archive['docProps/core.xml']), 'title')[0]?.textContent;
    if (metadataTitle?.trim()) title = metadataTitle;
  }
  return finishDocument({ title, text: sections.map((s) => `${s.title ? `${s.title}\n\n` : ''}${s.text}`).join('\n\n'), sections, format: 'docx' });
}

function archivePath(base, href) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(href)) fail('invalidDocument');
  let decoded;
  try { decoded = decodeURIComponent(href.split(/[?#]/u)[0]); } catch { fail('invalidDocument'); }
  const parts = (base.slice(0, base.lastIndexOf('/') + 1) + decoded).split('/'), out = [];
  for (const part of parts) {
    if (part === '..') { if (!out.length) fail('invalidDocument'); out.pop(); }
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

function xhtmlSections(doc, fallbackTitle) {
  const root = descendants(doc, 'body')[0] ?? doc.documentElement;
  const sections = []; let current = { title: fallbackTitle, kind: 'chapter', text: '' };
  let buffer = '';
  const flushParagraph = () => { const text = normalizeDocumentText(buffer); if (text) current.text += `${current.text ? '\n\n' : ''}${text}`; buffer = ''; };
  const visit = (node) => {
    if (node.nodeType === 3) { buffer += node.textContent; return; }
    if (node.nodeType !== 1) return;
    const tag = node.localName.toLowerCase();
    if (['script', 'style', 'nav', 'svg', 'audio', 'video', 'head'].includes(tag) || node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return;
    if (/^h[12]$/u.test(tag)) {
      flushParagraph();
      if (current.text) sections.push(current);
      current = { title: normalizeDocumentText(node.textContent).slice(0, 240) || fallbackTitle, kind: 'chapter', text: '' }; return;
    }
    if (tag === 'br') { buffer += '\n'; return; }
    const block = ['p', 'div', 'section', 'article', 'blockquote', 'li', 'h3', 'h4', 'h5', 'h6', 'tr'].includes(tag);
    if (block) flushParagraph();
    if (tag === 'td' || tag === 'th') buffer += ' ';
    Array.from(node.childNodes).forEach(visit);
    if (block) flushParagraph();
  };
  visit(root); flushParagraph(); if (current.text) sections.push(current);
  return sections;
}

async function importEpub(data, title) {
  const archive = await extractArchive(data, 'epub');
  if (!archive['META-INF/container.xml']) fail('invalidDocument');
  if (archive['META-INF/encryption.xml'] && /<(?:\w+:)?EncryptedData\b/u.test(archive['META-INF/encryption.xml'])) {
    // EPUB font obfuscation does not prevent text import. Encrypted content does.
    const encryption = parseXML(archive['META-INF/encryption.xml']);
    const encryptedText = descendants(encryption, 'CipherReference').some((node) => /\.(?:xhtml|html|htm|xml|opf)(?:$|[?#])/iu.test(node.getAttribute('URI') ?? ''));
    if (encryptedText) fail('protectedDocument');
  }
  const container = parseXML(archive['META-INF/container.xml']);
  const packagePath = descendants(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!packagePath || !archive[packagePath]) fail('invalidDocument');
  const packageDoc = parseXML(archive[packagePath]);
  const metadataTitle = descendants(packageDoc, 'title')[0]?.textContent;
  if (metadataTitle?.trim()) title = metadataTitle;
  const manifest = new Map(descendants(packageDoc, 'item').map((node) => [node.getAttribute('id'), node]));
  const sections = [];
  for (const item of descendants(packageDoc, 'itemref')) {
    if (item.getAttribute('linear') === 'no') continue;
    const entry = manifest.get(item.getAttribute('idref'));
    if (!entry || !(entry.getAttribute('media-type') ?? '').match(/(?:xhtml\+xml|text\/html)/u)) continue;
    if ((entry.getAttribute('properties') ?? '').split(/\s+/u).includes('nav')) continue;
    const path = archivePath(packagePath, entry.getAttribute('href') ?? '');
    if (!archive[path]) fail('invalidDocument');
    const chapter = parseXML(archive[path]);
    const chapterTitle = descendants(chapter, 'title')[0]?.textContent ?? '';
    sections.push(...xhtmlSections(chapter, chapterTitle));
  }
  return finishDocument({ title, text: sections.map((s) => `${s.title ? `${s.title}\n\n` : ''}${s.text}`).join('\n\n'), sections, format: 'epub' });
}

/** PDF.js lines become paragraphs, preserving larger vertical gaps. */
export function textFromPdfItems(items) {
  const lines = []; let current = '', previous = null, lineY = null, lineHeight = 12;
  const flush = (gap = false) => { if (current.trim()) lines.push(current.trim()); if (gap && lines.at(-1) !== '') lines.push(''); current = ''; };
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5], height = Math.abs(item.height || item.transform?.[3] || 12);
    if (lineY !== null && Number.isFinite(y) && Math.abs(y - lineY) > Math.max(2, height * .35)) {
      flush(Math.abs(y - lineY) > Math.max(height, lineHeight) * 1.55); previous = null;
    }
    if (current && item.str && !/\s$/u.test(current) && !/^\s/u.test(item.str)) {
      const previousRight = (previous?.transform?.[4] ?? 0) + (previous?.width ?? 0);
      const gap = (item.transform?.[4] ?? previousRight) - previousRight;
      if (!previous || gap > Math.max(1, height * .08)) current += ' ';
    }
    current += item.str; lineY = Number.isFinite(y) ? y : lineY; lineHeight = height; previous = item;
    if (item.hasEOL) { flush(); previous = null; }
  }
  flush();
  return normalizeDocumentText(lines.join('\n').replace(/(\p{L})-\n(?=\p{Ll})/gu, '$1').replace(/([^\n])\n(?=[^\n])/gu, '$1 '));
}

async function importPdf(data, title) {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true, disableFontFace: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > DOCUMENT_LIMITS.pages) fail('documentTooLarge');
    const metadata = await pdf.getMetadata().catch(() => null);
    if (metadata?.info?.Title?.trim()) title = metadata.info.Title;
    const sections = []; let length = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = textFromPdfItems(content.items);
      page.cleanup(); length += text.length;
      if (length > DOCUMENT_LIMITS.characters) fail('documentTooLong');
      if (text) {
        const chapters = sectionsFromText(text);
        if (chapters.some((section) => section.kind === 'chapter')) sections.push(...chapters);
        else sections.push({ title: String(number), text, kind: 'page' });
      }
    }
    if (!sections.length) fail('scannedPdf');
    return finishDocument({ title, text: sections.map((s) => s.text).join('\n\n'), sections, format: 'pdf' });
  } catch (error) {
    if (error.name === 'PasswordException') fail('protectedDocument');
    throw error;
  } finally { await task.destroy(); }
}

/** Import a browser File. Supports TXT, text PDFs, unencrypted DOCX and EPUB. */
export async function importDocument(file) {
  if (!file || typeof file.arrayBuffer !== 'function') fail('invalidDocument');
  if (file.size > DOCUMENT_LIMITS.bytes) fail('documentTooLarge');
  const format = String(file.name ?? '').split('.').pop().toLowerCase();
  if (!['txt', 'pdf', 'docx', 'epub'].includes(format)) fail('unsupportedFormat');
  const title = String(file.name ?? '').replace(/\.[^.]+$/u, '');
  try {
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > DOCUMENT_LIMITS.bytes) fail('documentTooLarge');
    const data = new Uint8Array(buffer);
    if (format === 'txt') {
      const encoding = data[0] === 0xff && data[1] === 0xfe ? 'utf-16le' : data[0] === 0xfe && data[1] === 0xff ? 'utf-16be' : 'utf-8';
      let text = new TextDecoder(encoding).decode(data);
      if (encoding === 'utf-8' && text.includes('\ufffd')) text = new TextDecoder('windows-1252').decode(data);
      return documentFromText(text, title);
    }
    if (format === 'pdf') return await importPdf(data, title);
    if (format === 'docx') return await importDocx(data, title);
    return await importEpub(data, title);
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    throw new DocumentImportError('invalidDocument');
  }
}
