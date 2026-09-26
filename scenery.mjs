/** Bounded, canvas-only scenery. Times are seconds on the game's paused clock. */
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fract = (value) => value - Math.floor(value);
const seed = (index, salt = 0) => fract(Math.sin(index * 127.1 + salt * 311.7 + 17) * 43758.5453);

export const ENTRY_DURATION = 0.72;
export function entryProgress(time, enteredAt, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(enteredAt)) return 1;
  return 1 - (1 - clamp((time - enteredAt) / ENTRY_DURATION, 0, 1)) ** 3;
}

export class SceneRenderer {
  constructor() {
    this.enteredAt = -Infinity;
    this.lastTime = null;
    this.travel = 0;
    this.stars = Array.from({ length: 148 }, (_, i) => ({
      x: seed(i), y: seed(i, 1), depth: .25 + seed(i, 2) * .75,
      phase: seed(i, 3) * TAU, size: i % 19 === 0 ? 1.4 : .45 + seed(i, 4) * .55,
    }));
    this.ground = Array.from({ length: 34 }, (_, i) => ({
      x: seed(i, 6), y: seed(i, 7), side: i % 2 ? 1 : -1, variation: seed(i, 8),
    }));
  }

  enter(time) { this.enteredAt = Number.isFinite(time) ? time : 0; }

  drawBackground(ctx, { width, height, time = 0, world = 'space', playing = false, speed = 1, reducedMotion = false }) {
    if (!(width > 0 && height > 0)) return;
    const dt = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, .08);
    this.lastTime = time;
    if (!reducedMotion) this.travel += dt * (playing ? .55 + clamp(speed, .5, 4) * .45 : .25);
    const motion = reducedMotion ? 0 : this.travel;
    ctx.save();
    if (world === 'earth') this._earth(ctx, width, height, motion, reducedMotion ? 0 : time);
    else this._space(ctx, width, height, motion, reducedMotion ? 0 : time, playing, speed);
    this._defenceLine(ctx, width, height, world);
    ctx.restore();
  }

  _space(ctx, w, h, motion, time, playing, speed) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#080c20'); sky.addColorStop(.6, '#10122b'); sky.addColorStop(1, '#071622');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const drift = Math.sin(motion * .045) * w * .025;
    const cloud = ctx.createRadialGradient(w * .72 + drift, h * .19, 0, w * .6 + drift, h * .26, w * .68);
    cloud.addColorStop(0, '#67319a50'); cloud.addColorStop(.43, '#38358b28'); cloud.addColorStop(1, '#17255100');
    ctx.fillStyle = cloud; ctx.fillRect(0, 0, w, h);
    const light = ctx.createRadialGradient(w * .22, h * .68, 0, w * .22, h * .68, w * .6);
    light.addColorStop(0, '#08738a22'); light.addColorStop(1, '#08243400');
    ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);

    // A distant ringed world moves far more slowly than foreground particles.
    const px = w * .80 + drift * .25, py = h * .19, radius = Math.min(w * .14, 105);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-.36);
    ctx.strokeStyle = '#a883f02b'; ctx.lineWidth = .75;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(0, 0, radius * (1.6 + i * .13), radius * (.34 + i * .065), 0, 0, TAU); ctx.stroke();
    }
    const planet = ctx.createLinearGradient(0, -radius, 0, radius);
    planet.addColorStop(0, '#c985a426'); planet.addColorStop(.5, '#62407542'); planet.addColorStop(1, '#171930');
    ctx.fillStyle = planet; ctx.strokeStyle = '#bc87e540';
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();

    for (const star of this.stars) {
      const y = fract(star.y + motion * (.005 + star.depth * .027)) * h;
      const x = fract(star.x + Math.sin(motion * .028) * .008 * star.depth) * w;
      const twinkle = .78 + Math.sin(time * (1.0 + star.depth) + star.phase) * .22;
      ctx.globalAlpha = (.22 + star.depth * .43) * twinkle;
      ctx.fillStyle = star.depth > .76 ? '#ddefff' : star.phase > 3 ? '#c0b9ff' : '#7aaec3';
      const streak = playing ? Math.min(7, clamp(speed, .5, 4) * star.depth * 2.2) : .2;
      ctx.fillRect(x, y, star.size, star.size + streak);
      if (star.size > 1.3) {
        ctx.globalAlpha *= .35; ctx.fillRect(x - 3, y + .5, 7, .6); ctx.fillRect(x + .4, y - 2, .6, 5);
      }
    }
    ctx.globalAlpha = 1;
    // One short meteor every eleven seconds; no timers or growing particle pool.
    const cycle = Math.floor(time / 11), meteor = time % 11 - 7.8;
    if (time > 0 && meteor >= 0 && meteor < .7) {
      const p = meteor / .7, x = (seed(cycle, 20) * .5 + .08 + p * .33) * w, y = (.05 + p * .18) * h;
      ctx.globalAlpha = Math.sin(p * Math.PI) * .44;
      const tail = ctx.createLinearGradient(x - 65, y - 26, x, y);
      tail.addColorStop(0, '#b8edff00'); tail.addColorStop(1, '#d5f8ff');
      ctx.strokeStyle = tail; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 65, y - 26); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const horizon = h * .72;
    ctx.strokeStyle = '#6387c014'; ctx.lineWidth = .6;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(w * .5 + i * 12, horizon); ctx.lineTo(w * .5 + i * w * .24, h); ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const p = fract(i / 8 + motion * .065), y = horizon + p * p * (h - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const vignette = ctx.createRadialGradient(w / 2, h * .4, w * .15, w / 2, h * .5, Math.max(w, h) * .7);
    vignette.addColorStop(0, '#02071600'); vignette.addColorStop(1, '#02071670');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  }

  _earth(ctx, w, h, motion, time) {
    const horizon = h * .34;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#122832'); sky.addColorStop(.3, '#586953'); sky.addColorStop(.44, '#203c30'); sky.addColorStop(1, '#101f1c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const sunX = w * .8, sunY = h * .14;
    const glow = ctx.createRadialGradient(sunX, sunY, 1, sunX, sunY, Math.min(w * .3, 170));
    glow.addColorStop(0, '#eaca8859'); glow.addColorStop(.24, '#d5ba7238'); glow.addColorStop(1, '#d5ba7200');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h * .5);
    ctx.fillStyle = '#dfc99466'; ctx.beginPath(); ctx.arc(sunX, sunY, Math.min(w * .047, 26), 0, TAU); ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      const base = h * (.25 + layer * .064), phase = motion * (.005 + layer * .008);
      ctx.fillStyle = ['#3b554b', '#29483c', '#203d32'][layer];
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 16; x += 16) {
        const z = x / Math.max(160, w * .3) + phase;
        ctx.lineTo(x, base + Math.sin(z + layer * 1.8) * h * .027 + Math.sin(z * 2.1 + layer) * h * .012);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    }
    // A perspective lane and terrain bands move towards the player. Their
    // curvature is deliberately slight so enemy words retain a quiet backdrop.
    const bend = Math.sin(motion * .075) * w * .028;
    const centre = (depth) => w * .5 + bend * (1 - depth) ** 2;
    const laneWidth = (depth) => w * (.02 + depth * .34);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const p = i / 24; ctx.lineTo(centre(p) - laneWidth(p), horizon + p * (h - horizon)); }
    for (let i = 24; i >= 0; i--) { const p = i / 24; ctx.lineTo(centre(p) + laneWidth(p), horizon + p * (h - horizon)); }
    ctx.closePath(); ctx.fillStyle = '#8175552f'; ctx.fill();
    for (let i = 0; i < 20; i++) {
      const p = fract(i / 20 + motion * .07), depth = p * p, y = horizon + depth * (h - horizon);
      ctx.globalAlpha = .06 + depth * .14;
      ctx.strokeStyle = i % 2 ? '#a5ae7b' : '#060f0c'; ctx.lineWidth = .6 + depth * 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(centre(depth) - laneWidth(depth), y); ctx.moveTo(centre(depth) + laneWidth(depth), y); ctx.lineTo(w, y); ctx.stroke();
      if (i % 2 === 0) {
        ctx.strokeStyle = '#c5bc8c'; ctx.globalAlpha *= .85;
        for (const side of [-1, 1]) {
          const x = centre(depth) + side * laneWidth(depth) * .53;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 1.5, y + 2 + depth * 9); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    for (const item of this.ground) {
      const p = fract(item.y + motion * .037), depth = p * p;
      const y = horizon + depth * (h - horizon), x = centre(depth) + item.side * (.08 + item.x * .68) * w * (.12 + depth);
      const size = 2 + depth * (12 + item.variation * 22);
      ctx.globalAlpha = .3 + depth * .4;
      ctx.fillStyle = item.variation > .5 ? '#254932' : '#38543a';
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .42, y); ctx.lineTo(x - size * .42, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#142b23'; ctx.fillRect(x - size * .05, y, size * .1, size * .24);
    }
    // Subtle bounded pollen/dust; no flashing or motion under reduced motion.
    for (let i = 0; i < 18; i++) {
      const depth = seed(i, 25), y = fract(seed(i, 24) + motion * (.006 + depth * .01)) * h;
      const x = fract(seed(i, 23) + Math.sin(time * .3 + i) * .008) * w;
      ctx.globalAlpha = .06 + depth * .10; ctx.fillStyle = '#ecdbaa'; ctx.fillRect(x, y, .6 + depth, .6 + depth);
    }
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, h * .6, 0, h);
    shade.addColorStop(0, '#07131000'); shade.addColorStop(1, '#07131066'); ctx.fillStyle = shade; ctx.fillRect(0, h * .6, w, h * .4);
  }

  _defenceLine(ctx, w, h, world) {
    ctx.strokeStyle = world === 'earth' ? '#c6d29155' : '#74d6f23d';
    ctx.lineWidth = .8; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.moveTo(16, h - 68); ctx.lineTo(w - 16, h - 68); ctx.stroke(); ctx.setLineDash([]);
  }

  drawPlayer(ctx, { width, height, time = 0, world = 'space', playing = false, reducedMotion = false, position = { x: width / 2, y: height - 46 }, shooting = false, ship, tank }) {
    const progress = entryProgress(time, this.enteredAt, reducedMotion);
    const arrival = (1 - progress) * 145;
    const motion = reducedMotion ? 0 : time;
    ctx.save(); ctx.translate(position.x, position.y + arrival);
    ctx.globalAlpha = .2 + progress * .8;
    if (world === 'earth') this._tank(ctx, width, motion, playing, shooting, tank, reducedMotion);
    else this._ship(ctx, width, motion, playing, shooting, ship, reducedMotion, progress);
    ctx.restore();
  }

  _tank(ctx, w, time, playing, shooting, image, reducedMotion) {
    const size = w < 480 ? 75 : 90;
    ctx.save(); ctx.scale(size / 90, size / 90);
    ctx.fillStyle = '#030b0966'; ctx.beginPath(); ctx.ellipse(0, 17, 43, 15, 0, 0, TAU); ctx.fill();
    if (playing && !reducedMotion) {
      for (let i = 0; i < 12; i++) {
        const p = fract(time * .8 + i / 12), side = i % 2 ? 1 : -1;
        ctx.globalAlpha = (1 - p) * .1; ctx.fillStyle = '#cebb7f';
        ctx.beginPath(); ctx.ellipse(side * (23 + p * 15), 20 + p * 35, 3 + p * 10, 2 + p * 6, .3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const bounce = playing ? Math.sin(time * 19) * .45 : 0;
    ctx.translate(0, bounce + (shooting ? 1 : 0));
    if (image?.complete && image.naturalWidth) ctx.drawImage(image, -45, -65, 90, 100);
    else {
      ctx.fillStyle = '#18281b'; ctx.fillRect(-25, -28, 13, 61); ctx.fillRect(12, -28, 13, 61);
      ctx.fillStyle = '#789361'; ctx.fillRect(-19, -31, 38, 58); ctx.fillStyle = '#a2ad76'; ctx.fillRect(-11, -18, 22, 26); ctx.fillRect(-3, -59, 6, 48);
    }
    // Cool metal edge and a warm ground light unify the supplied sprite.
    ctx.fillStyle = '#e7d5a733'; ctx.fillRect(-27, 20, 6, 2); ctx.fillRect(21, 20, 6, 2);
    if (shooting) {
      ctx.shadowColor = '#ffd477'; ctx.shadowBlur = reducedMotion ? 0 : 13;
      ctx.fillStyle = '#fff5c6'; ctx.beginPath(); ctx.moveTo(0, -81); ctx.lineTo(6, -65); ctx.lineTo(0, -69); ctx.lineTo(-6, -65); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  _ship(ctx, w, time, playing, shooting, image, reducedMotion, progress) {
    const size = w < 480 ? 74 : 96;
    ctx.save();
    if (!reducedMotion) { ctx.translate(Math.sin(time * 1.1) * 1.2, Math.sin(time * 1.7) * 1.1); ctx.rotate(Math.sin(time * .8) * .012 * progress); }
    const glow = ctx.createRadialGradient(0, 9, 0, 0, 9, size * .72);
    glow.addColorStop(0, shooting ? '#65ebff60' : '#398fd82c'); glow.addColorStop(.55, '#7065ec12'); glow.addColorStop(1, '#582aff00');
    ctx.fillStyle = glow; ctx.fillRect(-size, -size, size * 2, size * 2);
    const flame = (playing ? 17 : 9) + Math.sin(time * 18) * 2;
    for (const dx of [-size * .16, size * .16]) {
      const exhaust = ctx.createLinearGradient(dx, size * .25, dx, size * .43 + flame);
      exhaust.addColorStop(0, '#dafdffff'); exhaust.addColorStop(.25, '#59dffff0'); exhaust.addColorStop(1, '#8870ff00');
      ctx.fillStyle = exhaust; ctx.beginPath(); ctx.moveTo(dx - 4, size * .25); ctx.quadraticCurveTo(dx - 2, size * .41, dx, size * .43 + flame); ctx.quadraticCurveTo(dx + 2, size * .41, dx + 4, size * .25); ctx.fill();
    }
    if (image?.complete && image.naturalWidth) {
      ctx.shadowColor = '#397edf'; ctx.shadowBlur = reducedMotion ? 0 : 7;
      ctx.drawImage(image, -size / 2, -size * .43, size, size * .869); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#b6e7f2'; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(22, 19); ctx.lineTo(0, 12); ctx.lineTo(-22, 19); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#448ba6'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(5, 7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
    }
    if (shooting) {
      ctx.shadowColor = '#5affef'; ctx.shadowBlur = reducedMotion ? 0 : 12; ctx.fillStyle = '#f1ffff';
      ctx.beginPath(); ctx.ellipse(0, -size * .43, 2.4, 6, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
