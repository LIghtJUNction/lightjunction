// Pure construction choreography. Positions use CSS pixels; time uses milliseconds.
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const mix = (from, to, progress) => from + (to - from) * progress;
const ease = progress => progress * progress * (3 - 2 * progress);

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

function measuredRect(rect = {}) {
  return {
    left: clamp(finite(rect?.left), -100000, 100000),
    top: clamp(finite(rect?.top), -100000, 100000),
    width: clamp(finite(rect?.width, 1), 1, 100000),
    height: clamp(finite(rect?.height, 1), 1, 100000),
  };
}

/** A finite job, not an orbit: approach → drag a frame → reveal its content → leave. */
export function createBuildTask({ seed = 0, index = 0, rect, kind = 'text', origin } = {}) {
  const bounds = measuredRect(rect);
  const type = ['text', 'card', 'line'].includes(kind) ? kind : 'text';
  const random = createRandom(`${seed}:build:${index}:${type}`);
  const duration = (minimum, variation) => Math.round(minimum + random() * variation);
  const durations = type === 'line'
    ? { approach: duration(220, 80), frame: duration(620, 140), write: 0, settle: duration(150, 40) }
    : type === 'card'
      ? { approach: duration(310, 90), frame: duration(700, 140), write: duration(850, 130), settle: duration(220, 40) }
      : { approach: duration(280, 80), frame: duration(580, 120), write: duration(800, 100), settle: duration(180, 40) };
  return {
    kind: type,
    rect: bounds,
    durations,
    duration: Object.values(durations).reduce((sum, value) => sum + value, 0),
    color: Math.floor(random() * 6),
    // Keep approach paths attached to the measured element when the page scrolls.
    originOffset: {
      x: finite(origin?.x, Math.max(8, bounds.left - 60 - random() * 60)) - bounds.left,
      y: finite(origin?.y, Math.max(8, bounds.top - 25 - random() * 50)) - bounds.top,
    },
  };
}

function blank(stage, reveal = 0, opacity = 1) {
  return { stage, reveal, done: stage === 'done', opacity, cursors: [], lines: [], box: null, handles: [], caret: null, rowIndex: null };
}

function cursor(task, x, y, role, pressed = true, offset = 0) {
  return { x, y, role, pressed, color: (task.color + offset) % 6 };
}

function drag(task, rect, progress) {
  const { left, top, width, height } = rect;
  if (task.kind === 'line') {
    const y = top + height / 2;
    const end = { x: left + width * progress, y };
    return {
      ...blank('frame', progress),
      cursors: [cursor(task, end.x, end.y, 'frame'), cursor(task, left, y, 'align', true, 1)],
      lines: [{ x1: left, y1: y, x2: end.x, y2: end.y, role: 'draw' }],
      handles: [{ x: left, y }, end],
    };
  }
  const box = { left, top, width: width * progress, height: height * progress };
  const right = left + box.width;
  const bottom = top + box.height;
  const result = {
    ...blank('frame'),
    box,
    cursors: [cursor(task, right, bottom, 'frame'), cursor(task, right, top, 'align', true, 1)],
    lines: [{ x1: left - 16, y1: top, x2: right, y2: top, role: 'guide' }],
    handles: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }],
  };
  if (task.kind === 'card') {
    result.cursors.push(cursor(task, left, bottom, 'align', true, 2));
    result.lines.push({ x1: left, y1: top - 16, x2: left, y2: bottom, role: 'guide' });
  }
  return result;
}

function write(task, rect, progress) {
  const { left, top, width, height } = rect;
  const result = drag(task, rect, 1);
  const x = left + width * progress;
  result.stage = 'write';
  result.reveal = progress;
  result.caret = { x, y: top, height };
  // Range-measured text rows let the cursor type successive lines, not wipe a paragraph.
  const rows = task.kind === 'text' && Array.isArray(task.rows)
    ? task.rows.filter(row => row && Number.isFinite(row.width) && row.width > 0 && Number.isFinite(row.height) && row.height > 0).map(measuredRect)
    : [];
  if (rows.length) {
    let remaining = rows.reduce((sum, row) => sum + row.width, 0) * progress;
    let index = 0;
    while (index < rows.length - 1 && remaining >= rows[index].width) {
      remaining -= rows[index].width;
      index += 1;
    }
    const row = rows[index];
    result.rowIndex = index;
    result.caret = { x: left + row.left + clamp(remaining, 0, row.width), y: top + row.top, height: row.height };
  }
  result.cursors = [
    cursor(task, result.caret.x, result.caret.y + result.caret.height, 'type'),
    cursor(task, left + width, top, 'align', false, 1),
  ];
  return result;
}

/** Sample the same timeline for both DOM visibility and the workers drawing it. */
export function sampleBuildTask(task, elapsedMs = 0) {
  const elapsed = elapsedMs === Infinity ? task.duration : Math.max(0, finite(elapsedMs));
  if (elapsed >= task.duration) return blank('done', 1, 0);
  const rect = measuredRect(task.rect);
  const { approach, frame, write: writing, settle } = task.durations;
  if (elapsed < approach) {
    const progress = ease(elapsed / approach);
    const result = blank('approach', 0, clamp(elapsed / Math.min(100, approach), 0, 1));
    const destination = { x: rect.left, y: rect.top + (task.kind === 'line' ? rect.height / 2 : 0) };
    const count = task.kind === 'card' ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      result.cursors.push(cursor(task,
        mix(rect.left + task.originOffset.x + index * 22, destination.x, progress),
        mix(rect.top + task.originOffset.y + index * 18, destination.y, progress),
        index === 0 ? 'frame' : 'align', false, index));
    }
    return result;
  }
  if (elapsed < approach + frame) return drag(task, rect, ease((elapsed - approach) / frame));
  if (elapsed < approach + frame + writing) return write(task, rect, ease((elapsed - approach - frame) / writing));
  const result = task.kind === 'line' ? drag(task, rect, 1) : write(task, rect, 1);
  result.stage = 'settle';
  result.opacity = 1 - ease(clamp((elapsed - approach - frame - writing) / settle, 0, 1));
  result.cursors = result.cursors.map(value => ({ ...value, pressed: false }));
  return result;
}
