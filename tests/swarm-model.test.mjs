import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom, createScene, createSwarm, stepSwarm } from '../site/swarm-model.mjs';

const viewport = { width: 960, height: 640 };
const sample = (seed) => {
  const random = createRandom(seed);
  return Array.from({ length: 20 }, () => random());
};

function advance(particles, frames, options = {}) {
  let result = particles;
  for (let frame = 0; frame < frames; frame += 1) {
    result = stepSwarm(result, { ...viewport, dt: 1 / 60, time: frame / 60, ...options });
  }
  return result;
}

function assertWithin(particles, width, height) {
  for (const particle of particles) {
    for (const property of ['x', 'y', 'vx', 'vy', 'phase', 'burst']) {
      assert.ok(Number.isFinite(particle[property]), `${property} must stay finite`);
    }
    assert.ok(particle.x >= 0 && particle.x <= width);
    assert.ok(particle.y >= 0 && particle.y <= height);
  }
}

test('seeded visits reproduce motion and vary composition without dropping sections', () => {
  assert.deepEqual(sample('visit-a'), sample('visit-a'));
  assert.notDeepEqual(sample('visit-a'), sample('visit-b'));
  assert.ok(sample(0).every(value => value >= 0 && value < 1));
  const a = createSwarm({ seed: 'visit-a', ...viewport });
  const b = createSwarm({ seed: 'visit-a', ...viewport });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, createSwarm({ seed: 'visit-b', ...viewport }));
  assert.deepEqual(advance(a, 20), advance(b, 20));
  const scenes = [0, 1, 2].map(index => createScene('visit-a', index));
  assert.equal(new Set(scenes.map(scene => scene.variant)).size, 3);
  assert.deepEqual(scenes[0], createScene('visit-a', 0));
  assert.notDeepEqual(scenes[0], createScene('visit-b', 0));
  for (const scene of scenes) {
    assert.ok(scene.phase >= 0 && scene.phase < 1);
    assert.ok(scene.direction === -1 || scene.direction === 1);
  }
});

test('cursors converge around the current visible module', () => {
  const particles = createSwarm({ seed: 9, count: 32, ...viewport });
  const target = { x: 720, y: 420 };
  const averageDistance = values => values.reduce((sum, item) => sum + Math.hypot(item.x - target.x, item.y - target.y), 0) / values.length;
  const result = advance(particles, 480, { targets: [target] });
  assert.ok(averageDistance(result) < averageDistance(particles) / 3);
  assert.ok(averageDistance(result) < 70);
});

test('empty targets, invalid target points and a resized viewport stay finite', () => {
  const particles = createSwarm({ seed: 12, count: 48, ...viewport });
  const result = advance(particles, 240, { width: 320, height: 180, targets: [] });
  assertWithin(result, 320, 180);
  assertWithin(stepSwarm(result, { width: 1, height: 1, dt: Infinity, time: NaN, targets: [{ x: NaN, y: 20 }, null] }), 1, 1);
});

test('a long suspended frame cannot launch cursors across the viewport', () => {
  const particles = createSwarm({ seed: 4, ...viewport });
  const result = stepSwarm(particles, { ...viewport, dt: 300, time: 300, targets: [{ x: 480, y: 320 }] });
  assertWithin(result, viewport.width, viewport.height);
  result.forEach((particle, index) => {
    assert.ok(Math.hypot(particle.x - particles[index].x, particle.y - particles[index].y) <= 12.01);
  });
});

test('pointer attraction changes motion and pressing scatters only briefly', () => {
  const base = createSwarm({ seed: 3, count: 1, ...viewport }).map(particle => ({ ...particle, x: 400, y: 320, vx: 0, vy: 0 }));
  const pointer = { x: 470, y: 320, active: true, pressed: false };
  const options = { ...viewport, dt: 1 / 60, targets: [{ x: 400, y: 320 }] };
  const idle = stepSwarm(base, options);
  const attracted = stepSwarm(base, { ...options, pointer });
  const scattered = stepSwarm(base, { ...options, pointer: { ...pointer, pressed: true } });
  assert.ok(attracted[0].vx > idle[0].vx);
  assert.ok(scattered[0].vx < idle[0].vx);
  const held = advance(scattered, 90, { targets: options.targets, pointer: { ...pointer, pressed: true } });
  assert.equal(held[0].burst, 0);
});

test('updates preserve caller input and bound population', () => {
  const particles = createSwarm({ seed: 7, count: 10000, ...viewport });
  assert.equal(particles.length, 64);
  assert.equal(createSwarm({ count: -1 }).length, 0);
  const snapshot = structuredClone(particles);
  const targets = Object.freeze([Object.freeze({ x: 250, y: 120 })]);
  particles.forEach(Object.freeze);
  Object.freeze(particles);
  const updated = stepSwarm(particles, { ...viewport, targets });
  assert.deepEqual(particles, snapshot);
  assert.notStrictEqual(updated, particles);
  assert.notStrictEqual(updated[0], particles[0]);
  assert.deepEqual(stepSwarm([], { ...viewport, targets: [] }), []);
});
