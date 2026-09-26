/** Normalize typed Portuguese text to the letters used by the game. */
export function normalizeText(text) {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Basic words are accent-insensitive; advanced tokens preserve every non-space character. */
export function wordsFromText(text, advanced = false) {
  if (advanced) return String(text ?? '').normalize('NFC').match(/\S+/gu) ?? [];
  return normalizeText(text).match(/[\p{L}]+/gu) ?? [];
}

const WORDS = [
  ['asa', 'ar', 'boa', 'ceu', 'cor', 'dia', 'eco', 'fim', 'fio', 'flor', 'gato', 'ilha', 'jogo', 'lago', 'lar', 'lua', 'luz', 'mar', 'nave', 'onda', 'ouro', 'paz', 'raio', 'rio', 'riso', 'sal', 'sol', 'som', 'teia', 'teto', 'urso', 'vida', 'voo'],
  ['abrigo', 'astro', 'areia', 'brisa', 'bosque', 'campo', 'caminho', 'chuva', 'cometa', 'dança', 'desvio', 'espaco', 'estrela', 'foguete', 'farol', 'galaxia', 'guitarra', 'horizonte', 'inverno', 'jardim', 'janela', 'livro', 'luzir', 'meteoro', 'montanha', 'nebulosa', 'orbita', 'oceano', 'planeta', 'ponte', 'quintal', 'reflexo', 'riscar', 'saturno', 'silencio', 'tesouro', 'trilho', 'universo', 'viagem', 'vento'],
  ['amanhecer', 'aventura', 'borboleta', 'constelacao', 'descoberta', 'equilibrio', 'explorador', 'fotografia', 'gravidade', 'imaginar', 'labirinto', 'luminoso', 'movimento', 'navegador', 'observador', 'paisagem', 'primavera', 'relampago', 'satelite', 'tempestade', 'travessia', 'velocidade'],
].map((group) => group.map(normalizeText));

const SETTINGS = {
  normal: { lifetime: 15, spawnInterval: 2.4 },
  hard: { lifetime: 11.5, spawnInterval: 1.8 },
  extreme: { lifetime: 8.5, spawnInterval: 1.3 },
};
export const LEVEL_NAMES = Object.freeze([
  'Primeiro sinal', 'Campo de estrelas', 'Rota lunar', 'Chuva de meteoros',
  'Mar de luz', 'Cinturão de asteroides', 'Vento solar', 'Salto orbital',
  'Horizonte distante', 'Coração da galáxia',
]);
const LANES = [0.12, 0.272, 0.424, 0.576, 0.728, 0.88];
const MAX_FRAME_SECONDS = 0.1;

/**
 * Rendering-independent typing game. Coordinates run from 0 to 1. tick() clamps
 * long frames to 100 ms, so returning from a hidden tab cannot instantly kill you.
 * Custom words stay in their supplied order and repeat. The renderer fits long tokens.
 */
export class GameEngine {
  constructor({ difficulty = 'normal', customText = '', mode = 'arcade', progression = 'campaign', advanced = false, campaignLevels = null, random = Math.random } = {}) {
    this.advanced = advanced;
    this.mode = mode === 'reading' ? 'reading' : 'arcade';
    this.progression = progression === 'endless' ? 'endless' : 'campaign';
    this.difficulty = Object.hasOwn(SETTINGS, difficulty) ? difficulty : 'normal';
    this._settings = SETTINGS[this.difficulty];
    this._random = typeof random === 'function' ? random : Math.random;
    this._sourceText = customText;
    this._levels = Array.isArray(campaignLevels) ? campaignLevels.map(level => ({ ...level, words: wordsFromText(level.text, advanced) })).filter(level => level.words.length) : null;
    if (!this._levels?.length) this._levels = null;
    this._customWords = this._levels ? this._levels[0].words : wordsFromText(customText, advanced);
    this._reset();
  }

  _reset() {
    this.status = 'ready';
    if (this._levels) this._customWords = this._levels[0].words;
    this.enemies = [];
    this.targetId = null;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.levelKills = 0;
    this.kills = 0;
    this.correct = 0;
    this.mistakes = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.elapsed = 0;
    // Absolute sequence position, including words lost; callers can wrap this
    // index by their source word count when displaying a repeating passage.
    this.readingIndex = 0;
    this._nextId = 1;
    this._customIndex = 0;
    this._events = [];
    this._fatalTarget = null;
    this._spawnCountdown = this._spawnInterval;
  }

  get accuracy() {
    const attempts = this.correct + this.mistakes;
    return attempts === 0 ? 100 : (100 * this.correct) / attempts;
  }

  get wpm() {
    return this.elapsed > 0 ? (this.correct / 5) / (this.elapsed / 60) : 0;
  }

  get level() {
    return this.wave;
  }

  get levelGoal() {
    return this._levels ? this._customWords.length : 8 + (this.level - 1) * 2;
  }

  get levelProgress() {
    return Math.min(1, Math.max(0, (this._levels ? this.readingIndex : this.levelKills) / this.levelGoal));
  }

  get levelTitle() {
    return this._levels ? this._levels[this.level - 1].title : LEVEL_NAMES[(this.level - 1) % LEVEL_NAMES.length];
  }

  get speedMultiplier() {
    const completedLevels = this.level - 1 + this.levelProgress;
    // Books can contain thousands of sections. Keep their pace learnable and
    // bounded instead of applying the ten-level arcade curve indefinitely.
    if (this._levels) return 1 + 1.5 * (1 - Math.exp(-completedLevels / 20));
    // Progress within each level also raises the pace, avoiding a sudden jump
    // at its boundary. Endless play additionally accelerates with active time.
    return this.progression === 'endless'
      ? 1 + completedLevels * 0.075 + 0.5 * Math.log1p(this.elapsed / 40)
      : Math.pow(1.08, completedLevels);
  }

  /** Absolute speed percentage: 100 means the starting pace. */
  get speedPercent() {
    return Math.round(this.speedMultiplier * 100);
  }

  get _spawnInterval() {
    return Math.max(0.55, this._settings.spawnInterval / this.speedMultiplier);
  }

  get _maxEnemies() {
    return Math.min(6, 3 + Math.floor((this.wave - 1) / 2));
  }

  _roll() {
    const value = Number(this._random());
    return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
  }

  start() {
    this._reset();
    this.status = 'playing';
    this._announceLevel();
    this._spawnEnemy();
    return this;
  }

  pause() {
    if (this.status === 'playing') this.status = 'paused';
  }

  resume() {
    if (this.status === 'paused') this.status = 'playing';
  }

  releaseTarget() {
    if (this.mode === 'reading') return;
    this.targetId = null;
  }

  _announceLevel() {
    this._events.push({ type: 'wave', wave: this.wave, level: this.level, title: this.levelTitle, goal: this.levelGoal, x: 0.5, y: 0.3 });
  }

  _syncReadingTarget() {
    if (this.mode !== 'reading') return;
    const oldest = this.enemies.reduce((first, enemy) => !first || enemy.id < first.id ? enemy : first, null);
    this.targetId = oldest?.id ?? null;
  }

  _keepReadingOrder() {
    if (this.mode !== 'reading') return;
    const ordered = [...this.enemies].sort((a, b) => a.id - b.id);
    for (let index = 1; index < ordered.length; index += 1) {
      ordered[index].y = Math.min(ordered[index].y, ordered[index - 1].y - 0.08);
    }
  }

  _chooseWord() {
    if (this._customWords.length) {
      const word = this._customWords[this._customIndex % this._customWords.length];
      this._customIndex += 1;
      return word;
    }
    const pool = WORDS.slice(0, this.wave >= 5 ? 3 : this.wave >= 2 ? 2 : 1).flat();
    const occupiedLetters = new Set(this.enemies.map((enemy) => enemy.word[enemy.progress]));
    const occupiedWords = new Set(this.enemies.map((enemy) => enemy.word));
    const preferred = pool.filter((word) => !occupiedLetters.has(word[0]) && !occupiedWords.has(word));
    const candidates = preferred.length ? preferred : pool.filter((word) => !occupiedWords.has(word));
    const choices = candidates.length ? candidates : pool;
    return choices[Math.floor(this._roll() * choices.length)];
  }

  _spawnEnemy() {
    if (this._levels && this._customIndex >= this._customWords.length) return;
    const sequenceIndex = this._customWords.length ? this._customIndex : this.mode === 'reading' ? this._nextId - 1 : -1;
    const word = this._chooseWord();
    const availableLanes = LANES.filter((lane) => !this.enemies.some((enemy) => Math.abs(enemy.x - lane) < 0.06));
    const lanes = availableLanes.length ? availableLanes : LANES;
    const x = lanes[Math.floor(this._roll() * lanes.length)];
    const baseLifetime = this._settings.lifetime;
    // Longer practice words receive more time, especially helpful with mobile input.
    const lengthAllowance = Math.max(0, word.length - 5) * 0.65;
    const lifetime = baseLifetime * (this.mode === 'reading' ? 1 : 0.9 + this._roll() * 0.2) + lengthAllowance;
    // Store base speed so the current pace affects every target already flying.
    // Position constraints keep reading words ordered without permanently slowing
    // later short words after a long word has been completed.
    const speed = 1 / lifetime;
    this.enemies.push({ id: this._nextId++, sequenceIndex, word, progress: 0, x, y: 0.025, speed });
    this._keepReadingOrder();
    this._syncReadingTarget();
  }

  tick(dtSeconds) {
    if (this.status !== 'playing' || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    const dt = Math.min(dtSeconds, MAX_FRAME_SECONDS);
    this.elapsed += dt;
    const pace = this.speedMultiplier;
    for (const enemy of this.enemies) enemy.y += enemy.speed * pace * dt;
    this._keepReadingOrder();
    const escaped = this.enemies.filter((enemy) => enemy.y >= 1);
    this.enemies = this.enemies.filter((enemy) => enemy.y < 1);
    for (const enemy of escaped) {
      if (this.targetId === enemy.id) this.targetId = null;
      this.lives -= 1;
      this.streak = 0;
      if (this.mode === 'reading') this.readingIndex += 1;
      this._events.push({ type: 'damage', enemyId: enemy.id, sequenceIndex: enemy.sequenceIndex, word: enemy.word, x: enemy.x, y: 1, lives: this.lives });
      if (this.lives === 0) {
        this._fatalTarget = { ...enemy };
        this.status = 'over';
        this.targetId = null;
        this._events.push({ type: 'over', score: this.score, wave: this.wave, level: this.level, accuracy: this.accuracy, wpm: this.wpm, x: 0.5, y: 0.5 });
        return;
      }
    }
    if (this._completeDocumentLevel()) return;
    this._syncReadingTarget();
    this._spawnCountdown -= dt;
    // Reserve the vertical gap before emitting the next reading word.
    const readingHasRoom = this.mode !== 'reading' || this.enemies.every((enemy) => enemy.y >= 0.105);
    if ((this._spawnCountdown <= 0 || (this.mode === 'reading' && this.enemies.length === 0)) && this.enemies.length < this._maxEnemies && readingHasRoom) {
      this._spawnEnemy();
      this._spawnCountdown = this._spawnInterval;
    }
  }

  /** Returns true for a correct letter; nonletter input is ignored entirely. */
  typeChar(char) {
    if (this.status !== 'playing') return false;
    const letter = this.advanced ? String(char).normalize('NFC') : normalizeText(char);
    if (this.advanced ? !/^\S$/u.test(letter) : !/^[\p{L}]$/u.test(letter)) return false;
    this._syncReadingTarget();
    let target = this.enemies.find((enemy) => enemy.id === this.targetId);
    if (!target && this.mode !== 'reading') {
      this.targetId = null;
      target = this.enemies
        .filter((enemy) => enemy.word.slice(enemy.progress, enemy.progress + letter.length) === letter)
        .sort((left, right) => right.y - left.y || left.id - right.id)[0];
      if (target) this.targetId = target.id;
    }
    if (!target || target.word.slice(target.progress, target.progress + letter.length) !== letter) {
      this.mistakes += 1;
      this.streak = 0;
      this._events.push({ type: 'miss', enemyId: target?.id ?? null, letter, x: target?.x ?? 0.5, y: target?.y ?? 0.96 });
      return false;
    }
    target.progress += letter.length;
    this.correct += 1;
    this.streak += 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.score += 10 + Math.min(20, Math.floor(this.streak / 10) * 2);
    this._events.push({ type: 'hit', enemyId: target.id, word: target.word, progress: target.progress, letter, x: target.x, y: target.y });
    if (target.progress === target.word.length) {
      this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
      this.targetId = null;
      this.kills += 1;
      this.levelKills += 1;
      if (this.mode === 'reading') this.readingIndex += 1;
      this.score += 25 * this.wave;
      this._events.push({ type: 'destroy', enemyId: target.id, sequenceIndex: target.sequenceIndex, word: target.word, x: target.x, y: target.y });
      if (this._completeDocumentLevel()) return true;
      if (!this._levels && this.levelKills >= this.levelGoal) {
        if (this.progression === 'campaign' && this.level === LEVEL_NAMES.length) {
          this.status = 'won';
          this._events.push({ type: 'victory', score: this.score, wave: this.wave, level: this.level, title: this.levelTitle, accuracy: this.accuracy, wpm: this.wpm, x: 0.5, y: 0.5 });
          return true;
        }
        this.wave += 1;
        this.levelKills = 0;
        this._spawnCountdown = Math.min(this._spawnCountdown, this._spawnInterval);
        this._announceLevel();
      }
      // Keep a target available, even when a player clears the screen quickly.
      if (this.enemies.length === 0) {
        this._spawnEnemy();
        this._spawnCountdown = this._spawnInterval;
      }
      this._syncReadingTarget();
    }
    return true;
  }

  _completeDocumentLevel() {
    if (!this._levels || this.enemies.length || this._customIndex < this._customWords.length) return false;
    const last = this.level === this._levels.length;
    this.status = last ? 'won' : 'transition';
    this.targetId = null;
    this._events.push({ type: last ? 'victory' : 'levelComplete', level: this.level, title: this.levelTitle,
      chapterEnd: this._levels[this.level - 1].isChapterEnd, score: this.score, accuracy: this.accuracy, wpm: this.wpm, x: .5, y: .5 });
    return true;
  }

  nextLevel() {
    if (this.status !== 'transition' || !this._levels || this.level >= this._levels.length) return false;
    this.wave += 1; this.levelKills = 0; this.readingIndex = 0; this._customIndex = 0;
    this._customWords = this._levels[this.level - 1].words;
    this.lives = Math.min(3, this.lives + 1);
    this.status = 'playing'; this._spawnCountdown = this._spawnInterval;
    this._announceLevel(); this._spawnEnemy(); return true;
  }

  snapshot({ retryAfterLoss = false } = {}) {
    const fields = ['status','targetId','score','lives','wave','levelKills','kills','correct','mistakes','streak','bestStreak','elapsed','readingIndex','_nextId','_customIndex','_spawnCountdown'];
    const state = Object.fromEntries(fields.map(key => [key, this[key]]));
    const enemies = this.enemies.map(enemy => ({...enemy}));
    // Continuing a document after losing retries the fatal word, including its
    // accepted prefix. Never let an empty final page turn a loss into victory.
    if (retryAfterLoss && this._levels && this.status === 'over' && this._fatalTarget) {
      const target = { ...this._fatalTarget, y: .45 };
      state.status = 'paused'; state.lives = 3; state.streak = 0;
      state.readingIndex = Math.max(0, state.readingIndex - 1); state.targetId = target.id;
      enemies.unshift(target);
      for (let i = 1; i < enemies.length; i++) enemies[i].y = Math.min(enemies[i].y, enemies[i - 1].y - .08);
    }
    return { version: 1, options: {difficulty:this.difficulty, customText:this._sourceText, mode:this.mode, progression:this.progression, advanced:this.advanced,
      campaignLevels:this._levels?.map(({words,...level}) => level) ?? null}, state, enemies };
  }

  static fromSnapshot(snapshot, {random = Math.random} = {}) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.options || !snapshot.state || !Array.isArray(snapshot.enemies)) throw new Error('Invalid saved game');
    const game = new GameEngine({...snapshot.options,random});
    const state = snapshot.state;
    const integerFields = ['score','lives','wave','levelKills','kills','correct','mistakes','streak','bestStreak','readingIndex','_nextId','_customIndex'];
    if (integerFields.some(key => !Number.isSafeInteger(state[key]) || state[key] < 0) || !Number.isFinite(state.elapsed) || state.elapsed < 0 || !Number.isFinite(state._spawnCountdown) || state.lives > 3 || state.wave < 1 || (game._levels && state.wave > game._levels.length) || snapshot.enemies.length > 6) throw new Error('Invalid saved game');
    if (!['playing','paused','transition'].includes(state.status)) throw new Error('Saved game is not resumable');
    if (snapshot.enemies.some(e => !e || typeof e.word !== 'string' || !e.word || !Number.isSafeInteger(e.id) || e.id < 1 || e.id >= state._nextId || !Number.isSafeInteger(e.progress) || e.progress < 0 || e.progress >= e.word.length || !Number.isFinite(e.x) || e.x < 0 || e.x > 1 || !Number.isFinite(e.y) || e.y >= 1 || !Number.isFinite(e.speed) || e.speed <= 0)) throw new Error('Invalid saved targets');
    if (new Set(snapshot.enemies.map(e => e.id)).size !== snapshot.enemies.length ||
      (state.targetId !== null && !snapshot.enemies.some(e => e.id === state.targetId)) || state.lives < 1) throw new Error('Invalid saved targets');
    if (game._levels) {
      const words = game._levels[state.wave - 1].words;
      if (snapshot.options.campaignLevels.length !== game._levels.length || state._customIndex > words.length || state.readingIndex > state._customIndex ||
        state.levelKills > state.readingIndex) throw new Error('Invalid saved document position');
      if (state.status === 'transition' && (state.wave >= game._levels.length || snapshot.enemies.length || state._customIndex !== words.length || state.readingIndex !== words.length)) throw new Error('Invalid saved level boundary');
      if (game.mode === 'reading') {
        const ordered = [...snapshot.enemies].sort((a, b) => a.id - b.id);
        if (ordered.length !== state._customIndex - state.readingIndex || ordered.some((enemy, index) => {
          const sequence = state.readingIndex + index;
          const prefix = enemy.word.slice(0, enemy.progress);
          return enemy.sequenceIndex !== sequence || enemy.word !== words[sequence] || /[\uD800-\uDBFF]$/u.test(prefix);
        }) || (state.status !== 'transition' && state.readingIndex === words.length)) throw new Error('Invalid saved document targets');
      }
    } else if (state.status === 'transition') throw new Error('Invalid saved level boundary');
    for (const key of [...integerFields,'elapsed','_spawnCountdown','targetId']) game[key] = state[key];
    if (game._levels) game._customWords = game._levels[game.level - 1].words;
    game.enemies = snapshot.enemies.map(e => ({...e}));
    game.status = state.status === 'transition' ? 'transition' : 'paused';
    game._events = []; game._syncReadingTarget(); return game;
  }

  drainEvents() {
    const events = this._events;
    this._events = [];
    return events;
  }
}
