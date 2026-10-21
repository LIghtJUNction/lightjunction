import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STRIDE, createTimeline, limitPoints, spring, brush, morphPoint } from '../site/particle-math.mjs';
import { mountSculpture } from '../site/particle-text.mjs';

const point = (x, y = 0) => new Float32Array([x, y, 0, 23, 23, 23, 255]);
const close = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('timeline rejects missing scenes and invalid durations', () => {
  for (const scenes of [[], [1]]) for (const hold of [0, -1, NaN, Infinity]) {
    assert.throws(() => createTimeline(scenes, { hold }));
  }
  for (const morph of [0, -1, NaN, Infinity]) assert.throws(() => createTimeline([1], { morph }));
  assert.throws(() => createTimeline([]));
});
test('timeline holds readable text, scatters, reforms, and loops', () => {
  const t = createTimeline(['original', 'other'], { hold: 9, morph: 2 });
  assert.equal(t.at(8.9).mix, 0);
  assert.equal(t.at(10).mix, .5);
  assert.equal(t.at(11).from, 'other');
  assert.equal(t.at(22).from, 'original');
  for (const invalid of [NaN, Infinity, -99]) assert.deepEqual(t.at(invalid), t.at(0));
});
test('one scene and manual selections remain fixed', () => {
  assert.equal(createTimeline(['one']).at(10).mix, 0);
  const t = createTimeline(['a', 'b']);
  for (const selection of [0, 1, -2, 20, NaN]) assert.equal(t.at(99, selection).mix, 0);
  assert.equal(t.at(1, 20).from, 'b');
});
test('particle budgets sample the whole field without modifying it', () => {
  const points = new Float32Array(Array.from({ length: 100 }, (_, i) => [...point(i)]).flat());
  const original = points.slice();
  const sampled = limitPoints(points, 10);
  assert.equal(sampled.length, 10 * STRIDE);
  assert.equal(sampled[0], 0); assert.equal(sampled[9 * STRIDE], 90);
  assert.deepEqual(points, original);
  assert.equal(limitPoints(points, 100), points);
  assert.equal(limitPoints(points, 0).length, 0);
});
test('morph endpoints land exactly on the old and new words', () => {
  const a = point(10, 4), b = point(300, 90), out = new Float32Array(STRIDE);
  morphPoint(a, b, 0, 1, 0, out); assert.deepEqual(out, a);
  morphPoint(a, b, 0, 1, 1, out); assert.deepEqual(out, b);
  morphPoint(a, b, 0, 1, .5, out); assert.notEqual(out[2], 0);
  assert.deepEqual(a, point(10, 4)); assert.deepEqual(b, point(300, 90));
});
test('unequal glyph counts and empty text stay finite', () => {
  const a = point(10), b = new Float32Array([...point(20), ...point(40), ...point(60)]);
  const out = new Float32Array(STRIDE);
  for (const from of [a, new Float32Array()]) for (const to of [b, new Float32Array()]) {
    const count = Math.max(from.length, to.length) / STRIDE;
    for (let i = 0; i < count; i++) for (const mix of [0, .2, .5, 1]) {
      morphPoint(from, to, i, count, mix, out);
      assert.ok(out.every(Number.isFinite));
      assert.ok(out[6] >= 0 && out[6] <= 255);
    }
  }
});
test('scatter offsets are stable instead of flickering random numbers', () => {
  const a = new Float32Array(STRIDE), b = new Float32Array(STRIDE);
  morphPoint(point(1), point(2), 0, 1, .5, a);
  morphPoint(point(1), point(2), 0, 1, .5, b);
  assert.deepEqual(a, b);
});
test('spring returns to the text and does not depend on frame rate', () => {
  const end = fps => {
    const state = new Float32Array([45, -20, 125, -80]);
    for (let i = 0; i < fps; i++) spring(state, 0, 1 / fps);
    return state;
  };
  const a = end(30), b = end(60), c = end(120);
  for (let i = 0; i < 4; i++) { close(a[i], b[i]); close(b[i], c[i]); assert.ok(Math.abs(a[i]) < .001); }
});
test('paused spring, invalid dt, and long stalls are bounded', () => {
  const original = new Float32Array([12, 8, 2, 3]);
  for (const dt of [0, NaN, Infinity, -1]) {
    const a = original.slice(); spring(a, 0, dt); assert.deepEqual(a, original);
  }
  const a = original.slice(), b = original.slice();
  spring(a, 0, 30); spring(b, 0, .08); assert.deepEqual(a, b);
});
test('fast pointer swipes affect the whole swept segment', () => {
  const state = new Float32Array(4);
  brush(state, 0, 50, 5, { previousX: 0, previousY: 0, x: 100, y: 0, vx: 1600, vy: 0 }, 1 / 60);
  assert.ok(state[2] > 0); assert.ok(state[3] > 0);
  const far = new Float32Array(4);
  brush(far, 0, 50, 100, { previousX: 0, previousY: 0, x: 100, y: 0, vx: 1600, vy: 0 }, 1 / 60);
  assert.deepEqual(far, new Float32Array(4));
});
test('stationary and zero-dt brushes stay finite', () => {
  const state = new Float32Array(4), p = { previousX: 5, previousY: 5, x: 5, y: 5, vx: 0, vy: 0 };
  brush(state, 0, 5, 5, p, 1 / 30); assert.ok(state.every(Number.isFinite));
  const copy = state.slice(); brush(state, 0, 8, 9, p, 0); assert.deepEqual(state, copy);
});
test('module imports without a browser and empty mount is safe', () => {
  assert.equal(mountSculpture(null), null);
});
test('the original profile markup keeps semantic text, links, and translations', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<h1 id="intro-title" data-en="I'm LightJunction"/);
  assert.match(html, /mailto:lightjunction\.me@gmail\.com/);
  assert.match(html, /id="language-toggle"/);
  assert.match(html, /data-en="Encrypted contact" data-zh="加密联系"/);
  assert.doesNotMatch(html, /particle-ready|<canvas/);
});
