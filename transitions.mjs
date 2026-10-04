/** Short, clock-driven level transition. No timers: the game can pause safely. */
export const TRANSITION_TIMING = Object.freeze({ duration: 8 });
const clamp = (value) => Math.min(1, Math.max(0, value));

/** Eight seconds of fully visible reading, then an automatic next level. */
export function transitionFrame(elapsed) {
  const time = Math.max(0, Number(elapsed) || 0);
  const duration = TRANSITION_TIMING.duration;
  const active = time < duration;
  return {
    phase: active ? 'summary' : 'done', opacity: active ? 1 : 0,
    duration, remaining: Math.max(0, duration - time), progress: clamp(time / duration),
    active, showSummary: active, readyToAdvance: !active,
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
