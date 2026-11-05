// Pure motion model. Positions use CSS pixels and all times use seconds.
const TAU = Math.PI * 2;
const MAX_PARTICLES = 64;
const NEIGHBORS = 12;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const dimension = value => Math.max(1, finite(value, 1));

export function createRandom(seed = 0) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state = Math.imul(state ^ character.codePointAt(0), 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScene(seed, sectionIndex = 0) {
  const index = Math.max(0, Math.trunc(finite(sectionIndex)));
  const orderRandom = createRandom(`${seed}:layouts`);
  const variants = [0, 1, 2];
  for (let i = variants.length - 1; i > 0; i -= 1) {
    const j = Math.floor(orderRandom() * (i + 1));
    [variants[i], variants[j]] = [variants[j], variants[i]];
  }
  const random = createRandom(`${seed}:scene:${index}`);
  return {
    variant: variants[index % variants.length],
    direction: random() < 0.5 ? -1 : 1,
    phase: random(),
    spread: 0.8 + random() * 0.4,
    tempo: 0.85 + random() * 0.3,
    anchor: { x: 0.2 + random() * 0.6, y: 0.2 + random() * 0.6 },
  };
}

export function createSwarm({ seed = 0, count = 48, width = 1, height = 1 } = {}) {
  const random = createRandom(`${seed}:swarm`);
  const w = dimension(width);
  const h = dimension(height);
  const length = clamp(Math.floor(finite(count, 48)), 0, MAX_PARTICLES);
  return Array.from({ length }, (_, id) => {
    const phase = random() * TAU;
    return {
      id,
      x: random() * w,
      y: random() * h,
      vx: Math.cos(phase) * 24,
      vy: Math.sin(phase) * 24,
      phase,
      hue: Math.floor(random() * 360),
      size: 0.8 + random() * 0.4,
      group: id % 6,
      burst: 0,
      wasPressed: false,
    };
  });
}

export function stepSwarm(particles, {
  dt = 1 / 60, time = 0, width = 1, height = 1,
  pointer = {}, targets = [], progress = 1,
} = {}) {
  const step = clamp(finite(dt), 0, 0.05);
  const clock = finite(time);
  const w = dimension(width);
  const h = dimension(height);
  const points = (Array.isArray(targets) ? targets : [])
    .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .slice(0, MAX_PARTICLES);
  const source = (Array.isArray(particles) ? particles : []).slice(0, MAX_PARTICLES);
  const pressed = Boolean(pointer?.pressed);
  const active = Boolean(pointer?.active) && Number.isFinite(pointer?.x) && Number.isFinite(pointer?.y);
  const assembly = clamp(finite(progress, 1), 0, 1);
  // Cap the population and sample at most 12 neighbors per cursor: O(n * 12).
  return source.map((particle, index) => {
    const phase = finite(particle.phase, index * 2.399963);
    const x = clamp(finite(particle.x, w / 2), 0, w);
    const y = clamp(finite(particle.y, h / 2), 0, h);
    let vx = finite(particle.vx);
    let vy = finite(particle.vy);
    const burst = pressed && !particle.wasPressed ? 0.38 : Math.max(0, finite(particle.burst) - step);
    const target = points[index % points.length];
    const orbit = clock * 0.65 + phase;
    const tx = target ? clamp(target.x, 0, w) : w * (0.5 + Math.cos(orbit * 0.47) * 0.28);
    const ty = target ? clamp(target.y, 0, h) : h * (0.5 + Math.sin(orbit * 0.39) * 0.28);
    const spring = 3.4 + assembly * 1.6;
    let ax = (tx + Math.cos(orbit) * 9 - x) * spring;
    let ay = (ty + Math.sin(orbit) * 9 - y) * spring;
    const neighbors = Math.min(NEIGHBORS, source.length - 1);
    for (let j = 1; j <= neighbors; j += 1) {
      const other = source[(index + j) % source.length];
      let dx = x - finite(other.x, w / 2);
      let dy = y - finite(other.y, h / 2);
      const distance = Math.hypot(dx, dy);
      if (distance >= 32) continue;
      if (distance < 0.001) {
        dx = Math.cos(phase + j);
        dy = Math.sin(phase + j);
      }
      const force = (1 - Math.min(distance, 32) / 32) * 105 / Math.max(1, distance);
      ax += dx * force;
      ay += dy * force;
    }
    if (active) {
      let dx = pointer.x - x;
      let dy = pointer.y - y;
      const distance = Math.hypot(dx, dy);
      const reach = burst > 0 ? 280 : 220;
      if (distance < reach) {
        if (distance < 0.001) {
          dx = Math.cos(phase);
          dy = Math.sin(phase);
        }
        const strength = burst > 0 ? -1800 * burst / 0.38 : 360;
        const force = strength * (1 - distance / reach) / Math.max(1, distance);
        ax += dx * force;
        ay += dy * force;
      }
    }
    const damping = Math.exp(-3.2 * step);
    vx = (vx + ax * step) * damping;
    vy = (vy + ay * step) * damping;
    const speed = Math.hypot(vx, vy);
    if (speed > 240) { vx *= 240 / speed; vy *= 240 / speed; }
    const nextX = clamp(x + vx * step, 0, w);
    const nextY = clamp(y + vy * step, 0, h);
    if ((nextX === 0 && vx < 0) || (nextX === w && vx > 0)) vx *= -0.3;
    if ((nextY === 0 && vy < 0) || (nextY === h && vy > 0)) vy *= -0.3;
    return { ...particle, x: nextX, y: nextY, vx, vy, phase, burst, wasPressed: pressed };
  });
}
