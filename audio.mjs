const TRACKS = {
  menu: new URL('./assets/menu-loop.wav', import.meta.url),
  game: new URL('./assets/binary-groove.wav', import.meta.url),
};
export const MUSIC_LIBRARY = Object.freeze([
  { id: 'calm', title: 'Chills · Holizna', url: new URL('./assets/chills.m4a', import.meta.url) },
  { id: 'jazz', title: 'Quirky Jazz · Spring Spring', url: new URL('./assets/quirky-jazz.m4a', import.meta.url) },
  { id: 'synth', title: 'Synthwave House Loop · Fupi', url: new URL('./assets/synthwave-house.m4a', import.meta.url) },
  { id:'ambient',title:'Singularity Calm · Vitalezzz',url:new URL('./assets/singularity-calm.m4a',import.meta.url) },
  { id:'action',title:'Singularity Action · Vitalezzz',url:new URL('./assets/singularity-action.m4a',import.meta.url) },
  { id:'dnb',title:'Black Diamond · Joth',url:new URL('./assets/black-diamond.m4a',import.meta.url) },
  { id:'jungle',title:'Final Hour · isaiah658',url:new URL('./assets/final-hour.m4a',import.meta.url) },
  { id:'electro',title:'Electronic Outlaw · Zane Little',url:new URL('./assets/electronic-outlaw.m4a',import.meta.url) },
]);
const SHOT = new URL('./assets/missile_launch.wav', import.meta.url);
const clamp = (value, low, high, fallback) => Number.isFinite(Number(value)) ? Math.min(high, Math.max(low, Number(value))) : fallback;

/**
 * Music and combat effects reuse the supplied local files. Brief event cues
 * are synthesised so feedback stays immediate even while samples are loading.
 * Constructing this class never starts audio or downloads a file. Call unlock()
 * directly from a click/tap; it creates/resumes AudioContext before returning.
 * Scene requests may precede unlock. Music loading observes the latest scene,
 * so a slow response cannot restart music after pause, mute or a scene change.
 */
export class GameAudio {
  constructor({ enabled = true, musicVolume = 0.25, sfxVolume = 0.5, musicStyle = 'original' } = {}) {
    this.enabled = Boolean(enabled);
    this.musicVolume = clamp(musicVolume, 0, 1, 0.25);
    this.sfxVolume = clamp(sfxVolume, 0, 1, 0.5);
    this.scene = 'menu';
    this.musicStyle = ['auto','original','custom',...MUSIC_LIBRARY.map(track=>track.id)].includes(musicStyle) ? musicStyle : 'auto';
    this.musicLevel = 1; this.musicWorld = 'office'; this.musicShift = 0;
    this.intensity = 1;
    this.context = null;
    this._unlocked = false;
    this._buffers = new Map();
    this._musicGeneration = 0;
    this._music = null;
    this._musicVoices = new Set();
    this._effects = new Set();
    this._offsets = { menu: 0, game: 0 };
    this._shotBuffer = null;
    this._shotRequested = false;
    this._lastShot = -Infinity;
    this._lastHit = -Infinity;
    this._lastCombo = -Infinity;
    this._lastDestroy = -Infinity;
    this._lastDamage = -Infinity;
  }

  unlock() {
    try {
      if (!this.context) {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return Promise.resolve(false);
        this.context = new AudioContextClass({ latencyHint: 'interactive' });
        const context = this.context;
        this._master = context.createGain();
        this._musicBus = context.createGain();
        this._musicDuck = context.createGain();
        this._sfxBus = context.createGain();
        this._compressor = context.createDynamicsCompressor();
        this._compressor.threshold.value = -12;
        this._compressor.knee.value = 9;
        this._compressor.ratio.value = 3;
        this._compressor.attack.value = 0.003;
        this._compressor.release.value = 0.15;
        this._master.gain.value = this.enabled ? 0.85 : 0;
        this._musicBus.gain.value = this.musicVolume;
        this._sfxBus.gain.value = this.sfxVolume;
        this._musicBus.connect(this._musicDuck);
        this._musicDuck.connect(this._master);
        this._sfxBus.connect(this._master);
        this._master.connect(this._compressor);
        this._compressor.connect(context.destination);
      }
      this._unlocked = true;
      // Keep resume in this synchronous part of the user's gesture handler.
      const resumed = this.context.state === 'running' ? Promise.resolve() : this.context.resume();
      if (!this._shotRequested) {
        this._shotRequested = true;
        this._load(new URL('./assets/explosion.mp3', import.meta.url)).then(buffer => { this._explosionBuffer = buffer; this._explosionOffset = this._audibleOffset(buffer); }).catch(() => {});
        this._load(SHOT).then((buffer) => {
          if (buffer) this._shotBuffer = this._trimShot(buffer);
        }).catch(() => {});
      }
      return Promise.resolve(resumed).then(() => {
        this._requestMusic();
        return this.context.state === 'running';
      }).catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.context) {
      this._ramp(this._master.gain, this.enabled ? 0.85 : 0, 0.035);
      if (!this.enabled) this._stopEffects();
    }
    this._requestMusic();
  }

  setMusicVolume(value) {
    this.musicVolume = clamp(value, 0, 1, this.musicVolume);
    if (this.context) this._ramp(this._musicBus.gain, this.musicVolume, 0.06);
    this._requestMusic();
  }

  setSfxVolume(value) {
    this.sfxVolume = clamp(value, 0, 1, this.sfxVolume);
    if (this.context) this._ramp(this._sfxBus.gain, this.sfxVolume, 0.035);
  }

  setScene(scene) {
    if (!['menu', 'game', 'paused', 'off'].includes(scene)) return;
    this.scene = scene;
    if (scene === 'paused' || scene === 'off') this._stopEffects();
    this._requestMusic();
  }

  setMusicStyle(style) {
    if (!['auto','original','custom',...MUSIC_LIBRARY.map(track=>track.id)].includes(style)) return;
    this.musicStyle=style; this.musicShift=0; this._requestMusic();
  }

  setMusicContext(level, world) {
    const nextLevel=Math.max(1,Math.floor(Number(level)||1));
    const nextWorld=['office','earth','space'].includes(world)?world:'office';
    if (this.musicLevel===nextLevel && this.musicWorld===nextWorld) return;
    this.musicLevel=nextLevel; this.musicWorld=nextWorld; this._requestMusic();
  }

  nextMusic() {
    if (['original','custom'].includes(this.musicStyle)) this.musicStyle='auto';
    if (this.musicStyle==='auto') this.musicShift++;
    else this.musicStyle=MUSIC_LIBRARY[(MUSIC_LIBRARY.findIndex(track=>track.id===this.musicStyle)+1)%MUSIC_LIBRARY.length].id;
    this._requestMusic();
  }

  async setCustomMusic(file) {
    if (!this.context || !file) throw new Error('Audio unavailable');
    const request = (this._customRequest || 0) + 1;
    this._customRequest = request;
    const buffer = await this.context.decodeAudioData(await file.arrayBuffer());
    if (request !== this._customRequest) return false;
    if (this.customTrack) this._buffers.delete(this.customTrack.key);
    const key = `custom:${request}`;
    this.customTrack = {key,url:key,title:file.name};
    this._buffers.set(key,Promise.resolve(buffer));
    this.setMusicStyle('custom');
    return true;
  }

  clearCustomMusic() {
    this._customRequest = (this._customRequest || 0) + 1;
    if (this.customTrack) this._buffers.delete(this.customTrack.key);
    this.customTrack = null;
    if (this.musicStyle === 'custom') this.setMusicStyle('auto');
  }

  currentTrack() {
    if (this.musicStyle === 'custom' && this.customTrack) return this.customTrack;
    if (this.scene !== 'game' || this.musicStyle === 'original') return {url:TRACKS[this.scene],key:this.scene,title:this.scene==='game'?'Binary Groove':'Original · Menu'};
    let id = this.musicStyle;
    if (id === 'auto' || id === 'custom') {
      const pool = this.musicLevel < 3 ? ['calm','jazz','ambient'] : this.musicLevel < 5 ? ['synth','action','original'] : this.musicLevel < 8 ? ['dnb','jungle'] : ['jungle','electro','dnb'];
      const start = this.musicLevel < 3 ? 1 : this.musicLevel < 5 ? 3 : this.musicLevel < 8 ? 5 : 8;
      id = pool[(this.musicLevel-start+this.musicShift+{office:0,earth:1,space:2}[this.musicWorld])%pool.length];
    }
    if (id === 'original') return {url:TRACKS.game,key:'game',title:'Binary Groove'};
    const track = MUSIC_LIBRARY.find(track=>track.id===id) || MUSIC_LIBRARY[0];
    return {...track,key:track.id};
  }

  setIntensity(value) {
    // Keep musical pitch and tempo stable; harder play adds a little brightness.
    this.intensity = clamp(value, 0.5, 4, 1);
    if (this._music?.filter) this._ramp(this._music.filter.frequency, this._cutoff(), 0.6);
  }

  _cutoff() {
    return this.scene === 'game' ? Math.min(13000, 8000 + (this.intensity - 1) * 1700) : 7800;
  }

  _ramp(parameter, value, duration) {
    const now = this.context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
    parameter.linearRampToValueAtTime(value, now + duration);
  }

  _load(url) {
    const key = String(url);
    if (!this._buffers.has(key)) {
      const request = fetch(key).then((response) => {
        if (!response.ok) throw new Error('Audio asset unavailable');
        return response.arrayBuffer();
      }).then((bytes) => this.context.decodeAudioData(bytes)).catch(() => null);
      this._buffers.set(key, request);
    }
    return this._buffers.get(key);
  }

  _requestMusic() {
    const generation = ++this._musicGeneration;
    if (!this.context || !this._unlocked) return;
    const wanted = this.enabled && this.musicVolume > 0 && TRACKS[this.scene] ? this.scene : null;
    const track = this.currentTrack();
    if (!wanted) {
      this._retireMusic(this._music, 0.16);
      for (const voice of this._musicVoices) this._retireMusic(voice, 0.16);
      return;
    }
    if (this.context.state !== 'running' || (this._music?.scene === wanted && this._music?.trackKey === track.key)) return;
    this._load(track.url).then((buffer) => {
      if (!buffer || generation !== this._musicGeneration || !this.enabled || this.scene !== wanted || this.context.state !== 'running') return;
      this._startMusic(wanted, buffer, track.key);
    }).catch(() => {});
  }

  _startMusic(scene, buffer, trackKey = scene) {
    // Retire previous transitions before starting the next crossfade.
    for (const voice of this._musicVoices) {
      if (voice !== this._music) this._retireMusic(voice, 0.01, true);
    }
    this._retireMusic(this._music, 0.38);
    const context = this.context;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = this._cutoff();
    filter.Q.value = 0.55;
    const startsAt = context.currentTime + 0.012;
    const offset = (this._offsets[trackKey] || 0) % buffer.duration;
    gain.gain.setValueAtTime(0, context.currentTime);
    // Keep the supplied groove below the UI/typing cues without modifying the
    // player's volume setting; the menu has a slightly fuller level.
    gain.gain.linearRampToValueAtTime(scene === 'game' ? 0.82 : 0.92, startsAt + 0.38);
    source.connect(filter); filter.connect(gain); gain.connect(this._musicBus);
    const voice = { source, gain, filter, scene, trackKey, startsAt, offset, buffer, retired: false };
    this._musicVoices.add(voice);
    this._music = voice;
    source.onended = () => {
      this._musicVoices.delete(voice);
      if (this._music === voice) this._music = null;
      source.disconnect(); filter.disconnect(); gain.disconnect();
    };
    source.start(startsAt, offset);
  }

  _retireMusic(voice, duration, force = false) {
    if (!voice || (voice.retired && !force)) return;
    const now = this.context.currentTime;
    if (!voice.retired) this._offsets[voice.trackKey] = (voice.offset + Math.max(0, now - voice.startsAt)) % voice.buffer.duration;
    voice.retired = true;
    if (this._music === voice) this._music = null;
    this._ramp(voice.gain.gain, 0, duration);
    try { voice.source.stop(now + duration + 0.015); } catch {}
  }

  _audibleOffset(buffer) {
    if(!buffer)return 0;
    const data=buffer.getChannelData(0);let peak=0;
    for(const value of data)peak=Math.max(peak,Math.abs(value));
    const threshold=Math.max(.002,peak*.025);
    const onset=data.findIndex(value=>Math.abs(value)>=threshold);
    return Math.max(0,(onset-128)/buffer.sampleRate);
  }

  async previewExplosion() {
    const buffer=await this._load(new URL('./assets/explosion.mp3',import.meta.url));
    this._explosionBuffer=buffer;this._explosionOffset=this._audibleOffset(buffer);
    const previous=this.scene;this.scene='menu';
    this._lastDestroy=-Infinity;const played=this.effect('destroy');this.scene=previous;return played;
  }

  _trimShot(buffer) {
    const channel = buffer.getChannelData(0);
    let peak = 0;
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    if (peak < 0.001) return null;
    const threshold = Math.max(0.003, peak * 0.035);
    let start = 0;
    for (; start < channel.length; start++) if (Math.abs(channel[start]) >= threshold) break;
    start = Math.max(0, start - Math.round(buffer.sampleRate * 0.003));
    const length = Math.min(channel.length - start, Math.round(buffer.sampleRate * 0.22));
    if (length <= 0) return null;
    const result = this.context.createBuffer(1, length, buffer.sampleRate);
    const output = result.getChannelData(0);
    let trimmedPeak = 0;
    for (let i = 0; i < length; i++) trimmedPeak = Math.max(trimmedPeak, Math.abs(channel[start + i]));
    const volume = Math.min(3, 0.64 / Math.max(trimmedPeak, 0.01));
    const attack = Math.max(1, Math.round(buffer.sampleRate * 0.003));
    const release = Math.max(1, Math.round(buffer.sampleRate * 0.045));
    for (let i = 0; i < length; i++) output[i] = channel[start + i] * volume * Math.min(1, i / attack, (length - 1 - i) / release);
    return result;
  }

  _register(source, gain, extra = null) {
    if (this._effects.size >= 18) {
      const oldest = this._effects.values().next().value;
      this._ramp(oldest.gain.gain, 0, 0.008);
      try { oldest.source.stop(this.context.currentTime + 0.01); } catch {}
      this._effects.delete(oldest);
    }
    const voice = { source, gain, extra };
    this._effects.add(voice);
    source.onended = () => {
      this._effects.delete(voice);
      source.disconnect(); gain.disconnect(); extra?.disconnect();
    };
  }

  _stopEffects() {
    if (!this.context) return;
    for (const voice of this._effects) {
      this._ramp(voice.gain.gain, 0, 0.015);
      try { voice.source.stop(this.context.currentTime + 0.02); } catch {}
    }
    if (this._musicDuck) this._ramp(this._musicDuck.gain, 1, .08);
  }

  _duckMusic(duration = .3, level = .7) {
    if (!this._musicDuck) return;
    const now = this.context.currentTime;
    const gain = this._musicDuck.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else { gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now); }
    gain.linearRampToValueAtTime(level, now + .025);
    gain.linearRampToValueAtTime(1, now + duration);
  }

  _tone(from, to, duration, volume = 0.15, wave = 'triangle', delay = 0) {
    const context = this.context;
    const source = context.createOscillator();
    const gain = context.createGain();
    const time = context.currentTime + delay;
    source.type = wave;
    source.frequency.setValueAtTime(Math.max(20, from), time);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.008, duration / 5));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(gain); gain.connect(this._sfxBus);
    this._register(source, gain);
    source.start(time); source.stop(time + duration + 0.015);
  }

  _noise(duration, volume, cutoff = 1000) {
    const context = this.context;
    const length = Math.round(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration); filter.Q.value = 0.65;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this._sfxBus);
    this._register(source, gain, filter);
    source.start(now); source.stop(now + duration + 0.015);
  }

  effect(type, strength = 1) {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.scene === 'paused' || this.scene === 'off') return false;
    const now = this.context.currentTime;
    if (type === 'shot') {
      if (now - this._lastShot < 0.024) return false;
      this._lastShot = now;
      if (this._shotBuffer) {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = this._shotBuffer; gain.gain.value = 0.43;
        source.connect(gain); gain.connect(this._sfxBus);
        this._register(source, gain); source.start(now);
      } else this._tone(880, 180, 0.11, 0.19, 'triangle');
    } else if (type === 'hit') {
      if (now - this._lastHit < 0.025) return false;
      this._lastHit = now;
      this._tone(310, 130, 0.065, 0.095, 'sine');
    } else if (type === 'destroy') {
      if (now - this._lastDestroy < .04) return false;
      this._lastDestroy = now;
      this._duckMusic(.55, .5);
      if (this._explosionBuffer) {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = this._explosionBuffer;
        // Several word explosions may overlap: shorten their tail, preserving
        // the actual supplied sample and its attack instead of a loud wash.
        const duration = Math.min(1.6, this._explosionBuffer.duration-(this._explosionOffset||0));
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(.85, now + .005);
        gain.gain.setValueAtTime(.85, now + Math.min(.18,duration*.3));
        gain.gain.exponentialRampToValueAtTime(.0001, now + Math.max(.02, duration));
        source.connect(gain); gain.connect(this._sfxBus);
        this._register(source, gain); source.start(now,this._explosionOffset||0); source.stop(now + duration + .015);
      } else { this._noise(0.28, 0.3, 1700); this._tone(118, 34, 0.24, 0.18, 'sine'); }
    } else if (type === 'damage') {
      if (now - this._lastDamage < .12) return false;
      this._lastDamage = now;
      this._duckMusic(.45, .6);
      this._noise(0.36, 0.32, 1000); this._tone(190, 42, 0.36, 0.19, 'triangle');
    } else if (type === 'miss') {
      this._tone(150, 110, 0.075, 0.10, 'sine');
    } else if (type === 'level') {
      this._duckMusic(.6, .67);
      [0, 4, 7, 12].forEach((note, index) => this._tone(330 * 2 ** (note / 12), 330 * 2 ** (note / 12), 0.22, 0.11, 'triangle', index * 0.075));
    } else if (type === 'combo') {
      if (now - this._lastCombo < .32) return false;
      this._lastCombo = now;
      const root = 440 * 2 ** ((clamp(strength, 1, 5, 1) - 1) / 12);
      this._duckMusic(.25, .82);
      [1, 1.5, 2].forEach((ratio, index) => this._tone(root * ratio, root * ratio * 1.01, .15, .075, 'sine', index * .045));
    } else if (type === 'start') {
      [262, 392, 523].forEach((note, index) => this._tone(note, note, .17, .08, 'sine', index * .07));
    } else if (type === 'victory') {
      this._duckMusic(1.15, .5);
      [0, 4, 7, 12, 16, 19].forEach((note, index) => this._tone(262 * 2 ** (note / 12), 262 * 2 ** (note / 12), 0.42, 0.13, 'triangle', index * 0.11));
    } else if (type === 'gameover') {
      this._duckMusic(.9, .48);
      [330, 262, 196, 131].forEach((note, index) => this._tone(note, note * .96, .35, .10, 'triangle', index * .12));
    } else return false;
    return true;
  }
}
