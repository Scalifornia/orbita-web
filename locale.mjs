import { catalogs, languages } from './locale-data.mjs';

export { catalogs, previewWords } from './locale-data.mjs';
export const supportedLanguages = Object.freeze(Object.fromEntries(languages.map(({ code, label }) => [code, label])));
export const languageTags = Object.freeze(Object.fromEntries(languages.map(({ code, tag }) => [code, tag])));
let language = 'pt';

export function normalizeLanguage(value) {
  const code = String(value ?? '').toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(supportedLanguages, code) ? code : 'pt';
}
export function getLanguage() { return language; }
export function setLanguage(value) { language = normalizeLanguage(value); return language; }

const upperKeys = new Map(Object.keys(catalogs.pt).map(key => [key.toUpperCase(), key]));
const translatedSources = new Map();
for (const catalog of Object.values(catalogs)) {
  for (const [source, translated] of Object.entries(catalog)) {
    if (!translatedSources.has(translated)) translatedSources.set(translated, source);
    if (!translatedSources.has(translated.toUpperCase())) translatedSources.set(translated.toUpperCase(), source.toUpperCase());
  }
}
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.keys(catalogs.pt).filter(key => key.includes('{')).map(source => ({
  source,
  variants: [...new Set(Object.values(catalogs).map(catalog => catalog[source]))].map(template => {
    const names = [];
    const expression = template.split(/(\{\w+\})/).map(part => {
      if (!/^\{\w+\}$/.test(part)) return escapePattern(part);
      const name = part.slice(1, -1); names.push(name);
      return ['word', 'title'].includes(name) ? '(.+?)' : '([\\d.,]+)';
    }).join('');
    return { pattern: new RegExp(`^${expression}$`, 'u'), names };
  }),
}));

function interpolate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

const singularCounts = Object.freeze({
  '{count} vidas': '1 vida', '{count} palavras': '1 palavra',
  '{count} níveis': '1 nível', '{count} capítulos': '1 capítulo',
});

/** Translate exact messages; parameters are plain text and are never interpreted as HTML. */
export function t(value, parameters = {}) {
  const source = String(value ?? '');
  if (source === '1 vidas') return t('1 vida', parameters);
  if (Number(parameters.count) === 1 && Object.hasOwn(singularCounts, source)) return catalogs[language][singularCounts[source]];
  if (Object.hasOwn(catalogs[language], source)) return interpolate(catalogs[language][source], parameters);
  const upperKey = upperKeys.get(source);
  if (upperKey) return interpolate(catalogs[language][upperKey].toLocaleUpperCase(languageTags[language]), parameters);
  // Compatibility with the original HUD's already-interpolated Portuguese strings.
  // Anchored patterns never translate the player's word or arbitrary substrings.
  for (const { source: key, variants } of templates) {
    for (const { pattern, names } of variants) {
      const match = source.match(pattern);
      if (!match) continue;
      const values = Object.fromEntries(names.map((name, i) => [name, name === 'title' ? t(match[i + 1]) : match[i + 1]]));
      return t(key, values);
    }
  }
  if (source.includes(' · ')) return source.split(' · ').map(part => t(part)).join(' · ');
  const level = source.match(/^(\d+\s*\/\s*)(.+)$/u);
  if (level) return level[1] + t(level[2]);
  return source;
}

function canonicalSource(value) {
  if (Object.hasOwn(catalogs.pt, value) || upperKeys.has(value)) return value;
  if (translatedSources.has(value)) return translatedSources.get(value);
  for (const { source, variants } of templates) {
    for (const { pattern, names } of variants) {
      const match = value.match(pattern);
      if (match) return interpolate(source, Object.fromEntries(names.map((name, i) => [name,
        name === 'title' ? canonicalSource(match[i + 1]) : match[i + 1],
      ])));
    }
  }
  if (value.includes(' · ')) return value.split(' · ').map(canonicalSource).join(' · ');
  const level = value.match(/^(\d+\s*\/\s*)(.+)$/u);
  return level ? level[1] + canonicalSource(level[2]) : value;
}

const originals = new WeakMap();
const excluded = 'script,style,[data-no-i18n],[translate="no"],#readingText,#typedEcho,#story,#rankingList,#rankingConfig,#documentPreview';
const attributes = ['aria-label', 'placeholder', 'title', 'alt'];

function localize(node, key, value, write) {
  if (typeof value !== 'string' || !value.trim()) return;
  let record = originals.get(node);
  if (!record) { record = {}; originals.set(node, record); }
  if (!record[key] || value !== record[key].last) {
    const trimmed = value.trim();
    record[key] = { source: value.replace(trimmed, () => canonicalSource(trimmed)), last: value };
  }
  const source = record[key].source;
  const trimmed = source.trim();
  const next = source.replace(trimmed, () => t(trimmed));
  record[key].last = next;
  if (value !== next) write(next);
}

function isExcluded(node) {
  const element = node.nodeType === 1 ? node : node.parentElement;
  return Boolean(element?.closest(node.nodeType === 3 ? `${excluded},textarea` : excluded));
}
function translateNode(node) {
  if (!node || isExcluded(node)) return;
  if (node.nodeType === 3) localize(node, 'text', node.nodeValue, value => { node.nodeValue = value; });
  if (node.nodeType === 1) {
    for (const attr of attributes) {
      if (node.hasAttribute(attr)) localize(node, attr, node.getAttribute(attr), value => node.setAttribute(attr, value));
    }
  }
}
function translateTree(root) {
  if (!root || isExcluded(root)) return;
  translateNode(root);
  const doc = root.ownerDocument ?? root;
  if (root.nodeType === 3 || typeof doc.createTreeWalker !== 'function') return;
  // Reject story/document subtrees entirely: neither UI language nor observation
  // should touch text being typed or imported by the player.
  const walker = doc.createTreeWalker(root, 1 | 4, { acceptNode: node => isExcluded(node) ? 2 : 1 });
  while (walker.nextNode()) translateNode(walker.currentNode);
}

/** Safe to import/call from Node tests. Browser callers may pass a smaller subtree. */
export function translatePage(root = globalThis.document) {
  if (!root) return;
  const doc = root.ownerDocument ?? root;
  if (root === doc) {
    if (doc.documentElement) doc.documentElement.lang = languageTags[language];
    if (doc.title) localize(doc, 'title', doc.title, value => { doc.title = value; });
    const description = doc.querySelector?.('meta[name="description"]');
    if (description) localize(description, 'content', description.content, value => { description.content = value; });
    translateTree(doc.body);
  } else translateTree(root);
}

/** Observe only changed subtrees, so score updates never rescan the whole page. */
export function observeTranslations(doc = globalThis.document) {
  const Observer = doc?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (!doc?.body || !Observer) return () => {};
  let queued = false;
  let active = true;
  const dirty = new Set();
  const observer = new Observer(records => {
    for (const record of records) {
      if (isExcluded(record.target)) continue;
      if (record.type === 'childList') {
        for (const node of record.addedNodes) if (!isExcluded(node)) dirty.add(node);
      } else dirty.add(record.target);
    }
    if (!dirty.size || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!active) return;
      const nodes = [...dirty]; dirty.clear();
      for (const node of nodes) if (node.isConnected !== false) translateTree(node);
    });
  });
  observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  return () => { active = false; observer.disconnect(); dirty.clear(); };
}

if (globalThis.document?.body) observeTranslations(globalThis.document);
else globalThis.document?.addEventListener('DOMContentLoaded', () => observeTranslations(globalThis.document), { once: true });
