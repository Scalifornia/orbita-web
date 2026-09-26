export const PROGRESS_KEY = 'orbita.progress.v1';
export const PROGRESS_VERSION = 1;
export const MAX_PROGRESS_BYTES = 4 * 1024 * 1024;

function safeJSON(value, depth = 0) {
  if (depth > 40) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => safeJSON(item, depth + 1));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.entries(value).every(([key, item]) => !['__proto__', 'prototype', 'constructor'].includes(key) && safeJSON(item, depth + 1));
  }
  return false;
}

export function isValidCampaign(campaign) {
  if (!campaign || typeof campaign !== 'object' || typeof campaign.id !== 'string' || !campaign.id || campaign.id.length > 160 ||
      typeof campaign.title !== 'string' || !campaign.title || campaign.title.length > 240 ||
      !Array.isArray(campaign.levels) || !campaign.levels.length || campaign.levels.length > 20_000 ||
      !Number.isSafeInteger(campaign.totalWords) || campaign.totalWords <= 0) return false;
  let expectedStart = 0;
  for (const level of campaign.levels) {
    if (!level || typeof level.text !== 'string' || !level.text.trim() || level.text.length > 1_000_000 ||
        !Number.isSafeInteger(level.wordCount) || level.wordCount <= 0 ||
        level.wordCount !== (level.text.match(/\S+/gu) ?? []).length ||
        level.startWord !== expectedStart || level.endWord !== expectedStart + level.wordCount ||
        !Number.isSafeInteger(level.chapterIndex) || level.chapterIndex < 0) return false;
    expectedStart = level.endWord;
  }
  return expectedStart === campaign.totalWords;
}

function validRecord(value) {
  return value?.version === PROGRESS_VERSION && Number.isSafeInteger(value.savedAt) && value.savedAt > 0 &&
    isValidCampaign(value.campaign) && value.engine && typeof value.engine === 'object' && !Array.isArray(value.engine) &&
    value.session && typeof value.session === 'object' && !Array.isArray(value.session) && safeJSON(value);
}

/** A single atomic record retains the source plus the engine's exact resumable snapshot. */
export function createProgressStore(storage) {
  let backend = storage, error = null;
  if (storage === undefined) {
    try { backend = globalThis.localStorage; } catch { backend = null; }
  }
  let available = Boolean(backend && typeof backend.getItem === 'function' && typeof backend.setItem === 'function');
  return {
    get available() { return available; },
    get error() { return error; },
    save({ campaign, engine, session = {} } = {}) {
      const record = { version: PROGRESS_VERSION, savedAt: Date.now(), campaign, engine, session };
      try {
        if (!validRecord(record)) { error = 'invalidProgress'; return false; }
        const data = JSON.stringify(record);
        if (data.length * 2 > MAX_PROGRESS_BYTES) { error = 'progressTooLarge'; return false; }
        if (!available) { error = 'storageUnavailable'; return false; }
        backend.setItem(PROGRESS_KEY, data); error = null; return true;
      } catch (cause) {
        error = cause?.name === 'QuotaExceededError' ? 'storageFull' : 'storageUnavailable';
        if (error === 'storageUnavailable') available = false;
        return false;
      }
    },
    load() {
      if (!available) { error = 'storageUnavailable'; return null; }
      try {
        const raw = backend.getItem(PROGRESS_KEY);
        if (!raw) { error = null; return null; }
        if (raw.length * 2 > MAX_PROGRESS_BYTES) { error = 'invalidProgress'; return null; }
        let record;
        try { record = JSON.parse(raw); } catch { error = 'invalidProgress'; return null; }
        if (!validRecord(record)) { error = 'invalidProgress'; return null; }
        error = null; return record;
      } catch { available = false; error = 'storageUnavailable'; return null; }
    },
    clear() {
      if (!available) { error = 'storageUnavailable'; return false; }
      try { backend.removeItem(PROGRESS_KEY); error = null; return true; }
      catch { available = false; error = 'storageUnavailable'; return false; }
    },
  };
}
