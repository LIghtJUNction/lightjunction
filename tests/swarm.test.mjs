import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { initSwarm } from '../site/swarm.mjs';

function fixture(t, { reduced = false, canvas = true } = {}) {
  const browser = new Window();
  const root = browser.document;
  root.documentElement.lang = 'en';
  root.body.innerHTML = `<main class="page"><section id="about" data-scene>
    <h1>Prewritten identity</h1><a href="mailto:lightjunction.me@gmail.com" data-build>Contact</a>
    </section></main><div class="scene-controls" hidden>
    <button id="recompose">Recompose</button><button id="motion-toggle"><span></span></button>
    </div><p id="scene-status"></p>`;
  let hidden = false;
  Object.defineProperty(root, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(browser, 'crypto', { configurable: true, value: {
    getRandomValues(values) { values[0] = 12345; return values; },
  } });
  browser.innerWidth = 900;
  browser.innerHeight = 700;
  browser.ResizeObserver = undefined;
  const media = new browser.EventTarget();
  media.matches = reduced;
  const contrast = new browser.EventTarget();
  contrast.matches = false;
  browser.matchMedia = query => query.includes('reduced-motion') ? media : contrast;
  const frames = new Map();
  let id = 0;
  browser.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  browser.cancelAnimationFrame = key => frames.delete(key);
  let positions = [];
  const context = Object.fromEntries(['setTransform', 'save', 'restore', 'rotate', 'scale',
    'strokeRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'closePath', 'fill']
    .map(name => [name, () => {}]));
  context.clearRect = () => { positions = []; };
  context.translate = (x, y) => positions.push({ x, y });
  browser.HTMLCanvasElement.prototype.getContext = () => canvas ? context : null;
  for (const element of root.querySelectorAll('[data-scene], h1, [data-build]')) {
    element.getBoundingClientRect = () => ({ left: 100, top: 100, width: 400, height: 180, right: 500, bottom: 280 });
  }
  const scene = initSwarm(root, browser);
  t.after(() => { scene?.dispose(); browser.happyDOM.abort(); });
  return {
    root, browser, scene, frames, media,
    frame(now = 16) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(now));
      return positions;
    },
    event(type, options = {}) { browser.dispatchEvent(new browser.PointerEvent(type, options)); },
    visibility(value) { hidden = value; root.dispatchEvent(new browser.Event('visibilitychange')); },
  };
}

test('unavailable Canvas preserves readable content and hidden enhancement controls', t => {
  const f = fixture(t, { canvas: false });
  assert.equal(f.scene, null);
  assert.equal(f.root.querySelector('h1').textContent, 'Prewritten identity');
  assert.equal(f.root.querySelector('a').getAttribute('href'), 'mailto:lightjunction.me@gmail.com');
  assert.equal(f.root.querySelector('.scene-controls').hidden, true);
  assert.equal(f.root.querySelector('canvas'), null);
  assert.equal(f.frames.size, 0);
});

test('reduced motion draws once, and scroll draws once without starting a loop', t => {
  const f = fixture(t, { reduced: true });
  assert.equal(f.frames.size, 1);
  f.frame();
  assert.equal(f.frames.size, 0);
  assert.equal(f.root.querySelector('.is-assembling'), null);
  assert.equal(f.root.getElementById('motion-toggle').getAttribute('aria-pressed'), 'true');
  f.event('scroll');
  f.event('scroll');
  assert.equal(f.frames.size, 1);
  f.frame(32);
  assert.equal(f.frames.size, 0);
  f.media.matches = false;
  f.media.dispatchEvent(new f.browser.Event('change'));
  f.frame(48);
  assert.equal(f.frames.size, 1);
});

test('manual pause remains idle after scroll and refresh updates the translated control', t => {
  const f = fixture(t);
  f.frame();
  assert.equal(f.frames.size, 1);
  f.root.getElementById('motion-toggle').click();
  f.frame(32);
  assert.equal(f.frames.size, 0);
  f.event('scroll');
  f.frame(48);
  assert.equal(f.frames.size, 0);
  f.root.documentElement.lang = 'zh-CN';
  f.scene.refresh();
  assert.equal(f.root.getElementById('motion-toggle').textContent, '继续动态');
  f.frame(64);
  assert.equal(f.frames.size, 0);
});

test('visibility, back-forward cache lifecycle and disposal cancel or resume the loop', t => {
  const f = fixture(t);
  f.frame();
  f.visibility(true);
  assert.equal(f.frames.size, 0);
  f.event('scroll');
  assert.equal(f.frames.size, 0);
  f.visibility(false);
  assert.equal(f.frames.size, 1);
  f.frame(32);
  f.event('pagehide');
  assert.equal(f.frames.size, 0);
  f.event('scroll');
  assert.equal(f.frames.size, 0);
  f.event('pageshow');
  assert.equal(f.frames.size, 1);
  f.scene.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.root.querySelector('canvas'), null);
  assert.equal(f.root.querySelector('.scene-controls').hidden, true);
  f.event('pageshow');
  f.event('scroll');
  assert.equal(f.frames.size, 0);
});

test('pointer cancellation removes both attraction and pressed scattering', t => {
  const control = fixture(t);
  const cancelled = fixture(t);
  cancelled.event('pointerdown', { clientX: 300, clientY: 300, pointerType: 'touch', isPrimary: true });
  cancelled.event('pointercancel', { pointerType: 'touch', isPrimary: true });
  assert.deepEqual(cancelled.frame(16), control.frame(16));
  assert.deepEqual(cancelled.frame(32), control.frame(32));
});
