import { GameEngine, wordsFromText } from './engine.mjs';
import { createCampaign, campaignProgress } from './campaign.mjs';
import { createProgressStore } from './progress.mjs';

export class Adventure {
  constructor(storage) {
    this.store = createProgressStore(storage);
    this.campaign = null;
    this.settings = null;
    this.record = this.store.load();
    this._validateRecord();
  }

  _validateRecord() {
    if (!this.record) return;
    try { this._restore(this.record); } catch { this.record = null; }
  }

  _restore(record) {
    const settings = record.session.settings;
    if (!settings || !['pt', 'en', 'fr', 'de', 'es'].includes(settings.textLanguage) || !['space', 'earth', 'office'].includes(settings.world) ||
      record.engine.options?.mode !== 'reading' || record.engine.options?.progression !== 'campaign' ||
      Boolean(settings.advanced) !== record.engine.options.advanced) throw new Error('Invalid adventure settings');
    return GameEngine.fromSnapshot({ ...record.engine, options: { ...record.engine.options, customText: '', campaignLevels: record.campaign.levels } });
  }

  begin(document, settings) {
    const campaign = createCampaign(document, { language: settings.textLanguage, targetWords: 20, shortRounds: settings.story !== 'office' || document.title !== 'Boring Office' });
    // A symbols-only section has no playable targets in basic writing. Preserve
    // the source's chapter numbers, but recompute the playable boundaries.
    campaign.levels = campaign.levels.filter(level => wordsFromText(level.text, settings.advanced).length);
    if (!campaign.levels.length) throw new Error('emptyDocument');
    let offset = 0;
    for (let index = 0; index < campaign.levels.length; index++) {
      const level = campaign.levels[index];
      level.startWord = offset; offset += level.wordCount; level.endWord = offset;
      level.isChapterEnd = !campaign.levels[index + 1] || campaign.levels[index + 1].chapterIndex !== level.chapterIndex;
    }
    campaign.totalWords = offset;
    const sessionSettings = { ...settings, advanced: Boolean(settings.advanced), mode: 'reading', progression: 'campaign' };
    const engine = new GameEngine({ ...sessionSettings, campaignLevels: campaign.levels }).start();
    // Only replace an existing adventure after the new document is playable.
    this.settings = sessionSettings; this.campaign = campaign;
    this.save(engine, '');
    return engine;
  }

  resume() {
    if (!this.record) return null;
    const engine = this._restore(this.record);
    this.campaign = this.record.campaign;
    this.settings = { ...this.record.session.settings };
    return { engine, settings: this.settings, typedDisplay: this.record.session.typedDisplay || '' };
  }

  save(engine, typedDisplay = '') {
    if (!this.campaign) return true;
    if (engine.status === 'won') return this.complete();
    if (!['playing', 'paused', 'transition', 'over'].includes(engine.status)) return true;
    const snapshot = engine.snapshot({ retryAfterLoss: true });
    // Keep document text once in the record; recreate engine options on load.
    snapshot.options.campaignLevels = null; snapshot.options.customText = '';
    const value = { campaign: this.campaign, engine: snapshot, session: { settings: { ...this.settings }, typedDisplay: String(typedDisplay).slice(-240) } };
    const saved = this.store.save(value);
    if (saved) this.record = { ...value, version: 1, savedAt: Date.now() };
    return saved;
  }

  complete() { this.record = null; return this.store.clear(); }
  detach() { this.campaign = null; this.settings = null; }

  percent(engine) {
    if (!this.campaign) return 0;
    const level = this.campaign.levels[engine.level - 1];
    return level ? campaignProgress(this.campaign, engine.level - 1, engine.levelProgress * level.wordCount) : 100;
  }

  summary() {
    const saved = this.record;
    if (!saved) return null;
    const levelIndex = saved.engine.state.wave - 1, level = saved.campaign.levels[levelIndex];
    const tokens = wordsFromText(level.text, saved.session.settings.advanced).length;
    return { title: saved.campaign.title, chapter: level.chapterIndex + 1, level: levelIndex + 1,
      percent: campaignProgress(saved.campaign, levelIndex, (saved.engine.state.readingIndex / tokens) * level.wordCount) };
  }
}
