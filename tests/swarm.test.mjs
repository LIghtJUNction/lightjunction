import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { initSwarm } from '../site/swarm.mjs';

const reveal = element => Number(element.style.getPropertyValue('--build-reveal') || 0);
const state = element => element.dataset.buildState;
const unfinished = element => state(element) && state(element) !== 'done';

function assertReadable(element) {
  assert.ok(!unfinished(element), `${element.id || element.tagName} must be revealed`);
  assert.equal(element.style.getPropertyValue('--build-reveal'), '');
  assert.equal(element.style.getPropertyValue('clip-path'), '');
  assert.notEqual(element.getAttribute('aria-hidden'), 'true');
  assert.equal(element.hidden, false);
}

function fixture(t, { reduced = false, forcedColors = false, canvas = true } = {}) {
  const browser = new Window();
  const root = browser.document;
  root.documentElement.lang = 'en';
  root.body.innerHTML = `<main class="page">
    <section id="about" data-scene>
      <span id="intro-divider" data-build="line" aria-hidden="true"></span>
      <h1 id="intro-title">Prewritten identity</h1>
      <p id="intro-copy" data-build="text">Prepared content, revealed by the construction crew.</p>
      <a id="contact-link" class="list-link" href="mailto:lightjunction.me@gmail.com" data-build="card">Contact</a>
    </section>
    <section id="work" data-scene>
      <h2 id="work-title">Projects</h2>
      <ul class="project-list">
        <li><a id="project-a" class="list-link project" href="https://github.com/LIghtJUNction/cortexfs">CortexFS</a></li>
        <li><a id="project-b" class="list-link project" href="https://github.com/LIghtJUNction/MagicNet">MagicNet</a></li>
        <li><a id="project-c" class="list-link project" href="https://github.com/LIghtJUNction/LightFlow">LightFlow</a></li>
        <li><a id="project-d" class="list-link project" href="https://github.com/LIghtJUNction/OniMods">OniMods</a></li>
      </ul>
    </section>
    </main><div class="scene-controls" hidden>
    <button id="recompose">Recompose</button><button id="motion-toggle"><span></span></button>
    </div><p id="scene-status"></p>`;
  let hidden = false;
  let scroll = 0;
  let clock = 0;
  let seed = 12345;
  Object.defineProperty(root, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(browser, 'scrollY', { configurable: true, get: () => scroll });
  Object.defineProperty(browser.performance, 'now', { configurable: true, value: () => clock });
  Object.defineProperty(browser, 'crypto', { configurable: true, value: {
    getRandomValues(values) { values[0] = seed++; return values; },
  } });
  browser.innerWidth = 900;
  browser.innerHeight = 700;
  browser.ResizeObserver = undefined;
  const media = new browser.EventTarget();
  media.matches = reduced;
  const contrast = new browser.EventTarget();
  contrast.matches = forcedColors;
  browser.matchMedia = query => query.includes('reduced-motion') ? media : contrast;
  const frames = new Map();
  let id = 0;
  browser.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  browser.cancelAnimationFrame = key => frames.delete(key);
  let positions = [];
  const context = Object.fromEntries(['setTransform', 'save', 'restore', 'rotate', 'scale',
    'strokeRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'closePath', 'fill',
    'setLineDash', 'arc', 'fillText', 'rect', 'clip', 'roundRect', 'quadraticCurveTo']
    .map(name => [name, () => {}]));
  context.measureText = text => ({ width: text.length * 6 });
  context.clearRect = () => { positions = []; };
  context.translate = (x, y) => positions.push({ x, y });
  browser.HTMLCanvasElement.prototype.getContext = () => canvas ? context : null;
  const rects = {
    about: [80, 80, 680, 540],
    'intro-divider': [100, 92, 600, 1],
    'intro-title': [100, 140, 580, 130],
    'intro-copy': [100, 310, 450, 70],
    'contact-link': [100, 450, 400, 80],
    work: [80, 900, 680, 600],
    'work-title': [100, 940, 400, 60],
    'project-a': [100, 1040, 280, 150],
    'project-b': [420, 1040, 280, 150],
    'project-c': [100, 1240, 280, 150],
    'project-d': [420, 1240, 280, 150],
  };
  for (const [name, [left, top, width, height]] of Object.entries(rects)) {
    root.getElementById(name).getBoundingClientRect = () => ({
      left, top: top - scroll, width, height, right: left + width, bottom: top + height - scroll,
    });
  }
  const scene = initSwarm(root, browser);
  t.after(() => { scene?.dispose(); browser.happyDOM.abort(); });
  const f = {
    root, browser, scene, frames, media, contrast, context,
    get: id => root.getElementById(id),
    frame(step = 16) {
      clock += step;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(clock));
      return positions;
    },
    until(predicate, message = 'expected construction state', limit = 12000) {
      for (let elapsed = 0; elapsed < limit && !predicate(); elapsed += 16) f.frame();
      assert.ok(predicate(), message);
    },
    drain() {
      f.until(() => frames.size === 0, 'construction must stop requesting frames when visible work is complete');
    },
    event(type) { browser.dispatchEvent(new browser.Event(type)); },
    scrollTo(offset) { scroll = offset; f.event('scroll'); },
    visibility(value) { hidden = value; root.dispatchEvent(new browser.Event('visibilitychange')); },
  };
  return f;
}

test('unavailable Canvas preserves readable content and hidden enhancement controls', t => {
  const f = fixture(t, { canvas: false });
  assert.equal(f.scene, null);
  assert.equal(f.get('intro-title').textContent, 'Prewritten identity');
  assert.equal(f.get('contact-link').getAttribute('href'), 'mailto:lightjunction.me@gmail.com');
  assertReadable(f.get('intro-title'));
  assert.equal(f.root.querySelector('.build-item'), null);
  assert.equal(f.root.querySelector('.scene-controls').hidden, true);
  assert.equal(f.root.querySelector('canvas'), null);
  assert.equal(f.frames.size, 0);
});

test('text is queued before the first frame, then revealed only after its frame is drawn', t => {
  const f = fixture(t);
  const title = f.get('intro-title');
  assert.equal(state(title), 'queued');
  assert.equal(reveal(title), 0);
  assert.equal(title.textContent, 'Prewritten identity');
  assert.notEqual(title.getAttribute('aria-hidden'), 'true');
  f.until(() => state(title) === 'frame', 'a cursor must draw the title frame before revealing text');
  assert.equal(reveal(title), 0);
  f.until(() => state(title) === 'write' && reveal(title) > 0, 'the writing action must progressively reveal the title');
  assert.ok(reveal(title) < 1);
  f.drain();
  assertReadable(title);
  assertReadable(f.get('contact-link'));
  assert.equal(f.frames.size, 0);
});

test('divider drawing reveals the line during the drag and leaves no idle cursors', t => {
  const f = fixture(t);
  const line = f.get('intro-divider');
  f.until(() => state(line) === 'frame' && reveal(line) > 0, 'divider must grow as its cursor drags');
  assert.ok(reveal(line) < 1);
  f.drain();
  assert.equal(state(line), 'done');
  assert.deepEqual(f.frame(1000), [], 'finished work must not leave a decorative cursor swarm');
  f.event('pointermove');
  assert.equal(f.frames.size, 0, 'an idle pointer move must not restart animation');
});

test('offscreen content stays queued until it enters the viewport', t => {
  const f = fixture(t);
  f.drain();
  const title = f.get('work-title');
  assert.equal(state(title), 'queued');
  assert.equal(reveal(title), 0);
  assert.equal(f.root.querySelector('canvas').dataset.scene, 'about');
  f.scrollTo(850);
  f.until(() => state(title) === 'frame');
  assert.equal(reveal(title), 0, 'offscreen time must not count as construction time');
  assert.equal(f.root.querySelector('canvas').dataset.scene, 'work');
  f.drain();
  for (const id of ['work-title', 'project-a', 'project-b', 'project-c', 'project-d']) assertReadable(f.get(id));
});

test('a partially built module resumes where it stopped after leaving the viewport', t => {
  const f = fixture(t);
  const title = f.get('intro-title');
  f.until(() => state(title) === 'write' && reveal(title) > .2);
  f.scrollTo(850);
  f.frame();
  const stoppedReveal = reveal(title);
  f.drain();
  assert.equal(reveal(title), stoppedReveal, 'work outside the viewport must pause');
  f.scrollTo(0);
  f.frame();
  assert.equal(state(title), 'write');
  assert.ok(reveal(title) < 1, 'returning must not instantly finish a paused module');
  f.drain();
  assertReadable(title);
});

test('reduced motion reveals all content and never begins a construction loop', t => {
  const f = fixture(t, { reduced: true });
  f.drain();
  for (const id of ['intro-title', 'contact-link', 'work-title', 'project-a']) assertReadable(f.get(id));
  assert.equal(f.get('motion-toggle').getAttribute('aria-pressed'), 'true');
  f.scrollTo(850);
  f.drain();
  assert.equal(f.frames.size, 0);
  f.media.matches = false;
  f.media.dispatchEvent(new f.browser.Event('change'));
  f.drain();
  assertReadable(f.get('work-title'));
});

test('forced colors reveals all content and leaves the renderer idle', t => {
  const f = fixture(t, { forcedColors: true });
  f.drain();
  assertReadable(f.get('intro-title'));
  assertReadable(f.get('work-title'));
  assert.equal(f.frames.size, 0);
  assert.equal(f.get('motion-toggle').getAttribute('aria-pressed'), 'true');
});

test('manual pause reveals queued content, and resume does not hide it again', t => {
  const f = fixture(t);
  f.until(() => state(f.get('intro-title')) === 'frame');
  f.get('motion-toggle').click();
  f.drain();
  for (const id of ['intro-title', 'contact-link', 'work-title', 'project-a']) assertReadable(f.get(id));
  f.root.documentElement.lang = 'zh-CN';
  f.scene.refresh();
  assert.equal(f.get('motion-toggle').textContent, '继续动态');
  f.drain();
  f.get('motion-toggle').click();
  f.drain();
  assertReadable(f.get('intro-title'));
  assert.equal(f.get('motion-toggle').getAttribute('aria-pressed'), 'false');
});

test('keyboard focus reveals a queued link immediately and recompose preserves focus', t => {
  const f = fixture(t);
  const link = f.get('project-a');
  assert.equal(state(link), 'queued');
  link.focus();
  assert.equal(f.root.activeElement, link);
  assertReadable(link);
  f.scene.recompose();
  assert.equal(f.root.activeElement, link);
  assertReadable(link);
  assert.equal(link.getAttribute('href'), 'https://github.com/LIghtJUNction/cortexfs');
});

test('recompose uses a new seed and starts new construction without replacing prepared links', t => {
  const f = fixture(t);
  f.drain();
  const canvas = f.root.querySelector('canvas');
  const edition = canvas.dataset.edition;
  const links = [...f.root.querySelectorAll('.project-list a')];
  f.get('recompose').click();
  assert.notEqual(canvas.dataset.edition, edition);
  assert.equal(state(f.get('intro-title')), 'queued');
  assert.equal(reveal(f.get('intro-title')), 0);
  assert.equal(f.root.querySelectorAll('.project-list a').length, links.length);
  for (const link of links) assert.ok(link.isConnected, 'recompose must preserve each real link');
  f.drain();
  assertReadable(f.get('intro-title'));
});

test('visibility and back-forward cache suspend construction without consuming elapsed time', t => {
  const f = fixture(t);
  const title = f.get('intro-title');
  f.until(() => state(title) === 'write' && reveal(title) > .2);
  f.visibility(true);
  assert.equal(f.frames.size, 0);
  const progress = reveal(title);
  f.frame(10000);
  f.event('scroll');
  assert.equal(f.frames.size, 0);
  f.visibility(false);
  f.frame();
  assert.equal(state(title), 'write');
  assert.ok(reveal(title) >= progress && reveal(title) < 1);
  f.event('pagehide');
  assert.equal(f.frames.size, 0);
  f.frame(10000);
  f.event('scroll');
  assert.equal(f.frames.size, 0);
  f.event('pageshow');
  f.frame();
  assert.equal(state(title), 'write');
  f.drain();
  assertReadable(title);
});

test('disposal reveals pending content and removes event-driven rendering', t => {
  const f = fixture(t);
  f.frame();
  f.scene.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.root.querySelector('canvas'), null);
  assert.equal(f.root.querySelector('.scene-controls').hidden, true);
  assertReadable(f.get('intro-title'));
  assertReadable(f.get('work-title'));
  f.event('pageshow');
  f.event('scroll');
  f.get('recompose').click();
  assert.equal(f.frames.size, 0);
});

test('a drawing failure fails open instead of leaving prepared content clipped', t => {
  const f = fixture(t);
  f.context.stroke = () => { throw new Error('Lost drawing context'); };
  assert.doesNotThrow(() => f.drain());
  assertReadable(f.get('intro-title'));
  assertReadable(f.get('work-title'));
  assert.equal(f.frames.size, 0);
  assert.equal(f.root.querySelector('canvas'), null);
  assert.equal(f.root.querySelector('.scene-controls').hidden, true);
});
