import { drawThreat, officeRoom, drawOfficeRoom } from './office-art.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneRenderer, entryProgress, ENTRY_DURATION } from './scenery.mjs';
import { LevelTransition, transitionFrame } from './transitions.mjs';

function canvasMock() {
  const calls = [], stack = [];
  const ctx = { calls, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, shadowBlur: 0,
    save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, shadowBlur: this.shadowBlur }); },
    restore() { assert.ok(stack.length, 'save/restore balanced'); Object.assign(this, stack.pop()); },
    createLinearGradient(...args) { calls.push(['linearGradient', ...args]); return { addColorStop() {} }; },
    createRadialGradient(...args) { calls.push(['radialGradient', ...args]); return { addColorStop() {} }; },
  };
  for (const op of ['strokeRect', 'fillRect', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'fill', 'stroke', 'translate', 'rotate', 'scale', 'setLineDash', 'quadraticCurveTo', 'drawImage']) {
    ctx[op] = (...args) => {
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${op} received a finite coordinate`);
      calls.push([op, ...args]);
    };
  }
  ctx.balanced = () => assert.equal(stack.length, 0);
  return ctx;
}

const base = { width: 390, height: 420, time: 0, world: 'space', playing: true, speed: 1, reducedMotion: false };

test('entry settles within a second, never overshoots, and skips movement when reduced', () => {
  assert.ok(ENTRY_DURATION < 1);
  assert.equal(entryProgress(4, 5), 0);
  assert.equal(entryProgress(5, 5), 0);
  assert.ok(entryProgress(5.36, 5) > .5);
  assert.equal(entryProgress(6, 5), 1);
  assert.equal(entryProgress(5, 5, true), 1);
  assert.equal(entryProgress(5, -Infinity), 1);
});

test('both scenery worlds and image/fallback players render in compact and desktop canvases', () => {
  for (const world of ['space', 'earth', 'office']) for (const width of [390, 980]) for (const hasImage of [false, true]) {
    const scene = new SceneRenderer(), ctx = canvasMock(); scene.enter(0);
    const opts = { ...base, world, width, time: 8.1, shooting: true, position: { x: width / 2, y: 370 } };
    if (hasImage) opts.ship = opts.tank = { complete: true, naturalWidth: 100 };
    scene.drawBackground(ctx, opts); scene.drawPlayer(ctx, opts); ctx.balanced();
    assert.equal(ctx.globalAlpha, 1);
    assert.ok(ctx.calls.length < 1200, 'drawing budget stays bounded');
    assert.equal(ctx.calls.some(call => call[0] === 'drawImage'), hasImage && world !== 'office');
  }
});

test('movement follows game time, freezes with it, and does not accumulate particles', () => {
  const scene = new SceneRenderer(), ctx = canvasMock();
  scene.drawBackground(ctx, base);
  scene.drawBackground(ctx, { ...base, time: .05 });
  const distance = scene.travel;
  assert.ok(distance > 0);
  scene.drawBackground(ctx, { ...base, time: .05 }); assert.equal(scene.travel, distance);
  for (let i = 1; i <= 100; i++) scene.drawBackground(ctx, { ...base, time: i * .05 });
  assert.equal(scene.stars.length, 148); assert.equal(scene.ground.length, 34);
});

test('reduced motion yields identical static backgrounds even as time advances', () => {
  for (const world of ['space', 'earth', 'office']) {
    const scene = new SceneRenderer(), first = canvasMock(), second = canvasMock();
    scene.drawBackground(first, { ...base, world, reducedMotion: true });
    scene.drawBackground(second, { ...base, world, time: 23, reducedMotion: true });
    assert.deepEqual(second.calls, first.calls);
    assert.equal(scene.travel, 0);
  }
});

test('level summary stays fully visible for eight seconds then advances automatically', () => {
 for(const options of [{},{reducedMotion:true},{readingWords:60},{chapter:true}]) {
  for(const time of [0,.2,4,7.999]) {
   const frame=transitionFrame(time,options);
   assert.equal(frame.phase,'summary');assert.equal(frame.opacity,1);
   assert.equal(frame.readyToAdvance,false);assert.equal(frame.duration,8);
  }
  const done=transitionFrame(8,options);
  assert.equal(done.active,false);assert.equal(done.readyToAdvance,true);
  assert.equal(done.remaining,0);
 }
});

test('transition advances once even with a dropped frame and can be reset', () => {
  const transition = new LevelTransition();
  assert.equal(transition.sample(1).active, false);
  transition.start(10, { score: 200 });
  assert.equal(transition.sample(10.5).advance, false);
  const skipped = transition.sample(40);
  assert.equal(skipped.advance, true); assert.equal(skipped.active, false); assert.equal(skipped.payload.score, 200);
  assert.equal(transition.sample(40).advance, false);
  transition.start(20); assert.equal(transition.sample(20).advance, false);
  transition.clear(); assert.equal(transition.sample(30).advance, false);
});

test('reduced-motion transitions show summary without a fade or invalid values', () => {
  for (const time of [0, .1, .5, .77, 1, 3]) {
    const state = transitionFrame(time, { reducedMotion: true });
    assert.ok(Number.isFinite(state.opacity)); assert.ok([0, 1].includes(state.opacity));
    assert.ok(!['out', 'in'].includes(state.phase));
  }
});


test('six office rooms and all threat silhouettes render at mobile and desktop sizes', () => {
  const rooms = new Set();
  for (let level=1; level<=6; level++) {
    rooms.add(officeRoom(level).kind);
    for (const width of [320, 980]) {
      const ctx=canvasMock();drawOfficeRoom(ctx,width,420,level,4);ctx.balanced();
      assert.ok(ctx.calls.length<1000);
    }
  }
  assert.equal(rooms.size,6);
  assert.equal(officeRoom(7),officeRoom(1));
  for (const world of ['office','earth','space']) {
    const signatures=new Set();
    for (let id=-6;id<6;id++) {
      const ctx=canvasMock();drawThreat(ctx,{world,id,time:0,active:true,flash:true});ctx.balanced();
      signatures.add(JSON.stringify(ctx.calls));
    }
    assert.ok(signatures.size>=6);
  }
});
