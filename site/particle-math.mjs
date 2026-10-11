/*! Copyright (C) 2026 LIghtJUNction; SPDX-License-Identifier: AGPL-3.0-or-later
 * Timeline adapted from particle-sculpture-skill/assets/runtime/timeline.js.
 * See particle-NOTICE.md. No runtime dependencies.
 */
export const STRIDE = 7; // x, y, depth, red, green, blue, coverage
export const smooth = x => x * x * (3 - 2 * x);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** The skill's shared hold/scatter/reform clock, independent of wall time. */
export function createTimeline(scenes, { hold = 9, morph = 1.6 } = {}) {
  if (!scenes.length || !Number.isFinite(hold) || !Number.isFinite(morph) || hold <= 0 || morph <= 0) {
    throw new Error('Provide at least one scene and positive finite hold/morph durations.');
  }
  const duration = hold + morph;
  return {
    scenes, duration,
    at(seconds, selected = null) {
      const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
      if (selected !== null) {
        const index = clamp(Math.floor(Number.isFinite(selected) ? selected : 0), 0, scenes.length - 1);
        return { from: scenes[index], to: scenes[index], mix: 0, index };
      }
      const index = Math.floor(time / duration) % scenes.length;
      const phase = time % duration;
      return { from: scenes[index], to: scenes[(index + 1) % scenes.length], index,
        mix: scenes.length === 1 ? 0 : smooth(clamp((phase - hold) / morph, 0, 1)) };
    },
  };
}

/** Even sampling retains the whole sentence, not just its first characters. */
export function limitPoints(points, budget) {
  const count = points.length / STRIDE;
  const size = Math.max(0, Math.min(count, Math.floor(budget)));
  if (size === count) return points;
  const result = new Float32Array(size * STRIDE);
  for (let i = 0; i < size; i++) {
    const from = Math.floor(i * count / size) * STRIDE;
    result.set(points.subarray(from, from + STRIDE), i * STRIDE);
  }
  return result;
}

/** Exact critically damped spring. dt is seconds; position is CSS pixels. */
export function spring(state, index, dt) {
  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, .08);
  const omega = 20, decay = Math.exp(-omega * step);
  for (let axis = 0; axis < 2; axis++) {
    const p = state[index + axis], v = state[index + axis + 2];
    const c = v + omega * p;
    state[index + axis] = (p + c * step) * decay;
    state[index + axis + 2] = (v - omega * c * step) * decay;
  }
}

/** Swept brush: even a fast swipe hits the particles between input events. */
export function brush(state, index, x, y, pointer, dt) {
  const dx = pointer.x - pointer.previousX, dy = pointer.y - pointer.previousY;
  const length2 = dx * dx + dy * dy;
  const t = length2 ? clamp(((x - pointer.previousX) * dx + (y - pointer.previousY) * dy) / length2, 0, 1) : 0;
  const rx = x - pointer.previousX - dx * t, ry = y - pointer.previousY - dy * t;
  const distance = Math.hypot(rx, ry), radius = pointer.radius || 48;
  if (distance >= radius) return;
  const weight = (1 - distance / radius) ** 2;
  const force = 18000 * weight * clamp(dt, 0, .08);
  const norm = Math.max(distance, 1);
  state[index + 2] += (rx / norm + clamp(pointer.vx, -1600, 1600) / 750) * force;
  state[index + 3] += (ry / norm + clamp(pointer.vy, -1600, 1600) / 750) * force;
}

/** Stable correspondence and 3D scatter; never modifies either rest field. */
export function morphPoint(from, to, index, count, mix, output, spread = 45) {
  const aCount = from.length / STRIDE, bCount = to.length / STRIDE;
  const a = aCount ? Math.floor(index * aCount / count) * STRIDE : 0;
  const b = bCount ? Math.floor(index * bCount / count) * STRIDE : 0;
  const m = clamp(mix, 0, 1), cloud = Math.sin(Math.PI * m);
  for (let k = 0; k < STRIDE; k++) {
    const av = aCount ? from[a + k] : (k === 6 ? 0 : to[b + k]);
    const bv = bCount ? to[b + k] : (k === 6 ? 0 : from[a + k]);
    output[k] = av + (bv - av) * m;
  }
  // The envelope is zero at both endpoints, including when scene sizes differ.
  if (cloud < .000001) return;
  output[0] += (hash(index + 1) - .5) * spread * cloud;
  output[1] += (hash(index + 902) - .5) * spread * cloud;
  output[2] += (hash(index + 2901) - .5) * spread * 2 * cloud;
}
