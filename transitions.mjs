/** Short, clock-driven level transition. No timers: the game can pause safely. */
export const TRANSITION_TIMING = Object.freeze({ pause: .10, out: .18, summary: .67, in: .25 });
const clamp = (value) => Math.min(1, Math.max(0, value));
const ease = (value) => value * value * (3 - 2 * value);

export function transitionFrame(elapsed, { chapter = false, reducedMotion = false } = {}) {
  const time = Math.max(0, Number(elapsed) || 0);
  const pause = TRANSITION_TIMING.pause;
  const out = reducedMotion ? 0 : TRANSITION_TIMING.out;
  const summary = chapter ? .97 : TRANSITION_TIMING.summary;
  const fadeIn = reducedMotion ? 0 : TRANSITION_TIMING.in;
  const reveal = pause + out, release = reveal + summary, duration = release + fadeIn;
  let phase = 'pause', opacity = 0;
  if (time >= duration) phase = 'done';
  else if (time >= release) { phase = 'in'; opacity = 1 - ease(clamp((time - release) / fadeIn)); }
  else if (time >= reveal) { phase = 'summary'; opacity = 1; }
  else if (time >= pause) { phase = 'out'; opacity = ease(clamp((time - pause) / out)); }
  return {
    phase, opacity, duration, progress: clamp(time / duration),
    active: phase !== 'done', showSummary: phase === 'summary',
    // Switch the level while the screen is covered, once, then fade it in.
    readyToAdvance: time >= release,
  };
}

export class LevelTransition {
  constructor() { this.clear(); }
  start(time, payload = {}, options = {}) {
    this.startedAt = Number.isFinite(time) ? time : 0;
    this.payload = payload; this.options = options; this.advanced = false;
  }
  sample(time) {
    if (this.startedAt === null) return { active: false, phase: 'done', opacity: 0, showSummary: false, advance: false, payload: null };
    const frame = transitionFrame(time - this.startedAt, this.options);
    const advance = frame.readyToAdvance && !this.advanced;
    if (advance) this.advanced = true;
    return { ...frame, advance, payload: this.payload };
  }
  clear() { this.startedAt = null; this.payload = null; this.options = {}; this.advanced = false; }
}
