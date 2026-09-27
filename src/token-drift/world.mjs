/** Deterministic, DOM-free simulation. Rendering never owns gameplay state. */
export const TAU = Math.PI * 2;
export const WORLD_LIMIT = 34;
export const ISLANDS = Object.freeze([
  { x: 0, z: 8, radius: 5.5, name: '归航港', cost: 0, hue: 0 },
  { x: -15, z: -4, radius: 6, name: '语法花园', cost: 12, hue: 1 },
  { x: 2, z: -19, radius: 6.5, name: '记忆林地', cost: 18, hue: 2 },
  { x: 19, z: -3, radius: 6, name: '回声群岛', cost: 24, hue: 3 },
]);
export function random(seed = 271828) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function createWorld(seed = 271828) {
  const rng = random(seed);
  const tokens = [];
  // Spirals make consecutive pickups readable rather than uniformly scattered.
  ISLANDS.forEach((island, index) => {
    const count = index ? 36 : 12;
    for (let i = 0; i < count; i++) {
      const angle = i * .52 + index;
      const radius = 2.5 + (i % 12) * .34;
      tokens.push({ id: tokens.length, x: island.x + Math.cos(angle) * radius,
        z: island.z + Math.sin(angle) * radius, phase: rng() * TAU, taken: false });
    }
  });
  const enemies = [];
  for (let j = 1; j < ISLANDS.length; j++) {
    for (let i = 0; i < 3; i++) {
      const phase = (i / 3) * TAU + j;
      enemies.push({ island: j, phase, radius: 4.4 + i * 1.7,
        x: 0, z: 0, dead: 0, speed: .26 + i * .07 });
    }
  }
  const state = { seed, phase: 'ready', time: 0, player: { x: 0, z: 11, vx: 0, vz: 0,
    facing: Math.PI, hp: 3, invulnerable: 0, dash: 0, dashCooldown: 0, pulseCooldown: 0 },
    tokens, enemies, beacons: ISLANDS.slice(1).map((i) => ({ ...i, active: false })),
    inventory: 0, collected: 0, score: 0, combo: 0, comboTime: 0, maxCombo: 0,
    pulse: 0, pulseOrigin: { x: 0, z: 0 }, events: [] };
  updateEnemies(state, 0);
  return state;
}
export function startWorld(state) { if (state.phase === 'ready') state.phase = 'playing'; }
export function pauseWorld(state) { if (state.phase === 'playing') state.phase = 'paused'; }
export function resumeWorld(state) { if (state.phase === 'paused') state.phase = 'playing'; }
function emit(state, type, x, z, value = 0) {
  state.events.push({ type, x, z, value });
}
function updateEnemies(state, dt) {
  for (const e of state.enemies) {
    e.dead = Math.max(0, e.dead - dt);
    const island = ISLANDS[e.island];
    const angle = e.phase + state.time * e.speed;
    e.x = island.x + Math.cos(angle) * e.radius;
    e.z = island.z + Math.sin(angle) * e.radius;
  }
}
export function takeToken(state, token) {
  if (token.taken || state.phase !== 'playing') return false;
  token.taken = true;
  state.collected++; state.inventory++;
  state.combo = state.comboTime > 0 ? Math.min(8, state.combo + 1) : 1;
  state.comboTime = 3;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += 10 * state.combo;
  emit(state, 'token', token.x, token.z, state.combo);
  return true;
}
export function dash(state, direction = null) {
  const p = state.player;
  if (state.phase !== 'playing' || p.dashCooldown > 0) return false;
  const length = direction ? Math.hypot(direction.x, direction.z) : 0;
  if (length > .1) p.facing = Math.atan2(direction.x, direction.z);
  p.dash = .27; p.dashCooldown = 1.3;
  p.invulnerable = Math.max(p.invulnerable, .36);
  emit(state, 'dash', p.x, p.z);
  return true;
}
export function pulse(state) {
  const p = state.player;
  if (state.phase !== 'playing' || p.pulseCooldown > 0) return false;
  p.pulseCooldown = 5.5;
  state.pulse = .7;
  state.pulseOrigin = { x: p.x, z: p.z };
  emit(state, 'pulse', p.x, p.z);
  return true;
}
export function advance(state, dt, input = { x: 0, z: 0 }) {
  if (state.phase !== 'playing') return;
  // The caller uses a fixed step. Bound external inputs as a second safety net.
  dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
  if (!dt) return;
  const p = state.player;
  state.time += dt;
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.pulseCooldown = Math.max(0, p.pulseCooldown - dt);
  state.comboTime = Math.max(0, state.comboTime - dt);
  if (!state.comboTime) state.combo = 0;
  state.pulse = Math.max(0, state.pulse - dt);
  let x = Number.isFinite(input.x) ? input.x : 0;
  let z = Number.isFinite(input.z) ? input.z : 0;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  if (p.dash > 0) {
    p.vx = Math.sin(p.facing) * 24; p.vz = Math.cos(p.facing) * 24;
  } else {
    const smooth = 1 - Math.exp(-12 * dt);
    p.vx += (x * 7.5 - p.vx) * smooth;
    p.vz += (z * 7.5 - p.vz) * smooth;
    if (Math.hypot(p.vx, p.vz) > .4) p.facing = Math.atan2(p.vx, p.vz);
  }
  p.x = clamp(p.x + p.vx * dt, -WORLD_LIMIT, WORLD_LIMIT);
  p.z = clamp(p.z + p.vz * dt, -WORLD_LIMIT, WORLD_LIMIT);
  updateEnemies(state, dt);
  const attractRadius = state.pulse > 0 ? 8 : 2.5;
  for (const token of state.tokens) {
    if (token.taken) continue;
    const d = distance(token, p);
    if (d < attractRadius && d > .01) {
      const speed = state.pulse > 0 ? 22 : 5;
      const step = Math.min(d, speed * dt);
      token.x += (p.x - token.x) / d * step;
      token.z += (p.z - token.z) / d * step;
    }
    if (distance(token, p) < 1.1) takeToken(state, token);
  }
  for (const e of state.enemies) {
    if (e.dead > 0) continue;
    if ((p.dash > 0 && distance(e, p) < 2) ||
        (state.pulse > 0 && distance(e, state.pulseOrigin) < 8 * (1 - state.pulse / .7))) {
      e.dead = 8; state.score += 50; emit(state, 'break', e.x, e.z, 50);
    } else if (p.invulnerable <= 0 && distance(e, p) < 1.25) {
      p.hp--; p.invulnerable = 2;
      state.combo = 0; state.comboTime = 0;
      emit(state, 'hit', p.x, p.z);
      if (p.hp <= 0) { state.phase = 'lost'; emit(state, 'lost', p.x, p.z); return; }
    }
  }
  p.dash = Math.max(0, p.dash - dt);
  for (const b of state.beacons) {
    if (!b.active && distance(p, b) < 2.1 && state.inventory >= b.cost) {
      state.inventory -= b.cost; b.active = true;
      state.score += 500; p.hp = Math.min(3, p.hp + 1);
      emit(state, 'beacon', b.x, b.z, state.beacons.filter((v) => v.active).length);
    }
  }
  if (state.beacons.every((b) => b.active) && distance(p, ISLANDS[0]) < 2.5) {
    state.phase = 'won';
    state.score += Math.max(0, 1500 - Math.floor(state.time) * 5);
    emit(state, 'won', p.x, p.z);
  }
}
export function objective(state) {
  const unlit = state.beacons.filter((b) => !b.active);
  if (!unlit.length) return { ...ISLANDS[0], label: '返回归航港', remaining: 0 };
  const nearest = [...unlit].sort((a, b) => distance(a, state.player) - distance(b, state.player))[0];
  return { ...nearest, label: nearest.name, remaining: Math.max(0, nearest.cost - state.inventory) };
}
export function readRecord(storage) {
  try {
    const value = JSON.parse(storage.getItem('lightjunction.token-drift.v1') || '{}');
    return { best: Number.isSafeInteger(value?.best) && value.best > 0 ? Math.min(value.best, 9999999) : 0,
      wins: Number.isSafeInteger(value?.wins) && value.wins > 0 ? Math.min(value.wins, 999999) : 0 };
  } catch { return { best: 0, wins: 0 }; }
}
export function saveRecord(storage, record, state) {
  const next = { best: Math.max(record.best, state.score), wins: record.wins + (state.phase === 'won' ? 1 : 0) };
  try { storage.setItem('lightjunction.token-drift.v1', JSON.stringify(next)); } catch { /* private browsing */ }
  return next;
}
