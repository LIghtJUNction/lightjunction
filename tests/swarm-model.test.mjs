import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom, createScene, createBuildTask, sampleBuildTask } from '../site/swarm-model.mjs';

const rect = { left: 80, top: 120, width: 480, height: 160 };
const task = (options = {}) => createBuildTask({ seed: 'visit-a', index: 2, rect, ...options });
const sequence = seed => {
  const random = createRandom(seed);
  return Array.from({ length: 20 }, () => random());
};
const stageTime = (job, stage, fraction = .5) => {
  let elapsed = 0;
  for (const [name, duration] of Object.entries(job.durations)) {
    if (name === stage) return elapsed + duration * fraction;
    elapsed += duration;
  }
  throw new Error(`Unknown stage ${stage}`);
};

test('seeded visits vary construction timing and composition reproducibly', () => {
  assert.deepEqual(sequence('visit-a'), sequence('visit-a'));
  assert.notDeepEqual(sequence('visit-a'), sequence('visit-b'));
  assert.ok(sequence(0).every(value => value >= 0 && value < 1));
  assert.deepEqual(task(), task());
  assert.notDeepEqual(task(), task({ seed: 'visit-b' }));
  assert.deepEqual(sampleBuildTask(task(), 760), sampleBuildTask(task(), 760));
  const scenes = [0, 1, 2].map(index => createScene('visit-a', index));
  assert.equal(new Set(scenes.map(scene => scene.variant)).size, 3);
  assert.deepEqual(scenes[0], createScene('visit-a', 0));
  assert.notDeepEqual(scenes[0], createScene('visit-b', 0));
});

test('text and cards stay concealed until their workers have dragged the frame', () => {
  for (const kind of ['text', 'card']) {
    const job = task({ kind });
    const approaching = sampleBuildTask(job, stageTime(job, 'approach'));
    assert.equal(approaching.stage, 'approach');
    assert.equal(approaching.reveal, 0);
    assert.equal(approaching.box, null);
    const drawing = sampleBuildTask(job, stageTime(job, 'frame', .65));
    assert.equal(drawing.stage, 'frame');
    assert.equal(drawing.reveal, 0);
    assert.ok(drawing.box.width > 0 && drawing.box.width < rect.width);
    assert.ok(drawing.box.height > 0 && drawing.box.height < rect.height);
    const lead = drawing.cursors.find(cursor => cursor.role === 'frame');
    assert.equal(lead.x, drawing.box.left + drawing.box.width);
    assert.equal(lead.y, drawing.box.top + drawing.box.height);
    assert.equal(lead.pressed, true);
    for (const line of drawing.lines) {
      assert.ok(drawing.cursors.some(cursor => cursor.x === line.x2 && cursor.y === line.y2 && cursor.pressed));
    }
    const writing = sampleBuildTask(job, stageTime(job, 'write'));
    assert.equal(writing.stage, 'write');
    assert.deepEqual(writing.box, rect);
    assert.ok(writing.reveal > 0 && writing.reveal < 1);
    assert.equal(writing.caret.x, rect.left + rect.width * writing.reveal);
    const writer = writing.cursors.find(cursor => cursor.role === 'type');
    assert.equal(writer.x, writing.caret.x);
    assert.equal(writer.y, writing.caret.y + writing.caret.height);
    assert.ok(job.duration >= 1800 && job.duration <= 2500);
  }
});

test('a line appears only as far as the cursor has dragged, including thin rules', () => {
  const job = task({ kind: 'line', rect: { ...rect, height: 1 } });
  for (const fraction of [.1, .4, .9]) {
    const sample = sampleBuildTask(job, stageTime(job, 'frame', fraction));
    const lead = sample.cursors.find(cursor => cursor.role === 'frame');
    const line = sample.lines.find(line => line.role === 'draw');
    assert.equal(sample.stage, 'frame');
    assert.ok(sample.reveal > 0 && sample.reveal < 1);
    assert.equal(line.x2, rect.left + rect.width * sample.reveal);
    assert.equal(lead.x, line.x2);
    assert.equal(lead.y, line.y2);
    assert.equal(sample.box, null);
    assert.equal(sample.caret, null);
  }
});

test('multiline text is typed in row order and its cursor follows the current line', () => {
  const job = task();
  job.rows = [
    { left: 0, top: 0, width: 300, height: 44 },
    { left: 12, top: 52, width: 100, height: 44 },
  ];
  const first = sampleBuildTask(job, stageTime(job, 'write', .5));
  assert.equal(first.rowIndex, 0);
  assert.deepEqual(first.caret, { x: rect.left + 200, y: rect.top, height: 44 });
  const second = sampleBuildTask(job, stageTime(job, 'write', .8));
  assert.equal(second.rowIndex, 1);
  assert.ok(second.caret.x > rect.left + 12 && second.caret.x < rect.left + 112);
  assert.equal(second.caret.y, rect.top + 52);
  assert.equal(second.caret.height, 44);
  const writer = second.cursors.find(cursor => cursor.role === 'type');
  assert.equal(writer.x, second.caret.x);
  assert.equal(writer.y, second.caret.y + second.caret.height);
  job.rect = { ...rect, left: rect.left + 17, top: rect.top - 80 };
  const translated = sampleBuildTask(job, stageTime(job, 'write', .8));
  assert.equal(translated.rowIndex, 1);
  assert.equal(translated.caret.x, second.caret.x + 17);
  assert.equal(translated.caret.y, second.caret.y - 80);
  const finished = sampleBuildTask(job, stageTime(job, 'settle', 0));
  assert.equal(finished.rowIndex, 1);
  assert.equal(finished.caret.x, job.rect.left + 112);
  assert.equal(finished.reveal, 1);
});

test('scrolling and resizing keep every frame corner and reveal frontier on the measured DOM', () => {
  const job = task({ kind: 'card', origin: { x: 30, y: 50 } });
  const times = ['approach', 'frame', 'write'].map(stage => stageTime(job, stage));
  const before = times.map(time => sampleBuildTask(job, time));
  job.rect = { ...rect, left: rect.left + 25, top: rect.top - 75 };
  times.forEach((time, index) => {
    const after = sampleBuildTask(job, time);
    assert.equal(after.reveal, before[index].reveal);
    after.cursors.forEach((cursor, cursorIndex) => {
      assert.equal(cursor.x, before[index].cursors[cursorIndex].x + 25);
      assert.equal(cursor.y, before[index].cursors[cursorIndex].y - 75);
    });
  });
  job.rect = { left: 16, top: 40, width: 320, height: 220 };
  const writing = sampleBuildTask(job, stageTime(job, 'write', .7));
  assert.deepEqual(writing.box, job.rect);
  assert.equal(writing.caret.x, job.rect.left + job.rect.width * writing.reveal);
  assert.equal(writing.caret.height, job.rect.height);
});

test('completed workers release their handles, disappear and never orbit the finished page', () => {
  for (const kind of ['text', 'card', 'line']) {
    const job = task({ kind });
    const settling = sampleBuildTask(job, stageTime(job, 'settle'));
    assert.equal(settling.reveal, 1);
    assert.equal(settling.stage, 'settle');
    assert.ok(settling.opacity > 0 && settling.opacity < 1);
    assert.ok(settling.cursors.every(cursor => !cursor.pressed));
    for (const time of [job.duration, job.duration + 50000, Infinity]) {
      const done = sampleBuildTask(job, time);
      assert.equal(done.done, true);
      assert.equal(done.reveal, 1);
      assert.equal(done.opacity, 0);
      assert.deepEqual(done.cursors, []);
      assert.deepEqual(done.lines, []);
      assert.deepEqual(done.handles, []);
      assert.equal(done.box, null);
      assert.equal(done.caret, null);
    }
  }
});

test('sampling is immutable, monotonic and finite across late or invalid frame times', () => {
  const job = task();
  const snapshot = structuredClone(job);
  Object.freeze(job.rect);
  Object.freeze(job.durations);
  Object.freeze(job.originOffset);
  Object.freeze(job);
  let last = 0;
  for (let time = 0; time <= job.duration + 30; time += 17) {
    const sample = sampleBuildTask(job, time);
    assert.ok(sample.reveal >= last && sample.reveal <= 1);
    last = sample.reveal;
    assert.ok(sample.cursors.length <= 3);
    for (const cursor of sample.cursors) {
      assert.ok(Number.isFinite(cursor.x) && Number.isFinite(cursor.y));
    }
  }
  assert.deepEqual(job, snapshot);
  assert.deepEqual(sampleBuildTask(job, -100), sampleBuildTask(job, 0));
  assert.deepEqual(sampleBuildTask(job, NaN), sampleBuildTask(job, 0));
  const invalid = task({ rect: { left: NaN, top: Infinity, width: -10, height: 0 }, origin: { x: NaN, y: Infinity } });
  const sample = sampleBuildTask(invalid, stageTime(invalid, 'write'));
  assert.deepEqual(sample.box, { left: 0, top: 0, width: 1, height: 1 });
  assert.equal(sample.caret.height, 1);
  assert.ok(sample.cursors.every(cursor => Number.isFinite(cursor.x) && Number.isFinite(cursor.y)));
});
