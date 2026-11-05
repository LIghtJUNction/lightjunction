import { createRandom, createScene, createSwarm, stepSwarm } from './swarm-model.mjs';

const palette = ['#d5f4a2', '#9fc7ef', '#c2b0ec', '#e5aa8d', '#dce3d6', '#90c5ac'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function freshSeed(browser) {
  const value = new Uint32Array(1);
  if (browser.crypto?.getRandomValues) return browser.crypto.getRandomValues(value)[0];
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** The reading area, rather than document order, decides where the swarm works. */
export function activeRegion(regions, height) {
  const focus = height * .45;
  let best = null;
  let distance = Infinity;
  for (const region of regions) {
    const { top, bottom } = region.rect;
    if (bottom <= 0 || top >= height) continue;
    const next = Math.abs(clamp(focus, top, bottom) - focus);
    if (next < distance) { best = region; distance = next; }
  }
  return best;
}

/** A point travelling around an actual, measured element, outside its text. */
export function edgePoint(rect, phase, padding = 12) {
  const left = rect.left - padding;
  const top = rect.top - padding;
  const width = Math.max(1, rect.width + padding * 2);
  const height = Math.max(1, rect.height + padding * 2);
  const perimeter = 2 * (width + height);
  let position = ((phase % 1 + 1) % 1) * perimeter;
  if (position < width) return { x: left + position, y: top };
  position -= width;
  if (position < height) return { x: left + width, y: top + position };
  position -= height;
  if (position < width) return { x: left + width - position, y: top + height };
  return { x: left, y: top + height - (position - width) };
}

/** Optional decoration: failed Canvas support leaves the complete HTML profile. */
export function initSwarm(root, browser) {
  if (!browser.requestAnimationFrame || !root.querySelector('[data-scene]')) return null;
  const canvas = root.createElement('canvas');
  let context;
  try { context = canvas.getContext('2d'); } catch { return null; }
  if (!context) return null;

  const media = browser.matchMedia?.('(prefers-reduced-motion: reduce)');
  const contrast = browser.matchMedia?.('(forced-colors: active)');
  const controls = root.querySelector('.scene-controls');
  const regenerate = root.getElementById('recompose');
  const toggle = root.getElementById('motion-toggle');
  const status = root.getElementById('scene-status');
  const sections = [...root.querySelectorAll('[data-scene]')];
  const projectList = root.querySelector('.project-list');
  const projects = projectList ? [...projectList.children] : [];
  const records = sections.map((element, index) => ({
    element, index,
    items: [...element.querySelectorAll('[data-build], h1, h2, .list-link, .gratitude > p, .encrypted-contact > p, pre')]
      .filter(item => !item.parentElement.closest('[data-build]')),
  }));
  const cleanups = [];
  const pointer = { x: 0, y: 0, active: false, pressed: false };
  let seed = freshSeed(browser);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let visibleItems = [];
  let active = null;
  let seen = new Set();
  let construction = new Map();
  let request = 0;
  let previous = 0;
  let pointerTime = 0;
  let dirty = true;
  let suspended = false;
  let disposed = false;
  let userPaused = null;

  canvas.className = 'swarm-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.body.append(canvas);

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    cleanups.push(() => target?.removeEventListener?.(type, listener, options));
  }
  function paused() { return Boolean(contrast?.matches || (userPaused ?? media?.matches)); }
  function unavailable() { return disposed || suspended || root.hidden; }
  function language() { return root.documentElement.lang.startsWith('zh') ? 'zh' : 'en'; }

  function updateControls() {
    const stopped = paused();
    root.documentElement.dataset.motion = stopped ? 'paused' : 'running';
    toggle?.setAttribute('aria-pressed', String(stopped));
    const label = toggle?.querySelector('span');
    if (label) {
      label.dataset.en = stopped ? 'Resume motion' : 'Pause motion';
      label.dataset.zh = stopped ? '继续动态' : '暂停动态';
      label.textContent = label.dataset[language()];
    }
  }
  function clearConstruction() {
    for (const item of construction.keys()) item.classList.remove('is-assembling');
    construction.clear();
  }
  function arrange() {
    const order = [...projects];
    const randomOrder = createRandom(seed ^ 0x52c6a1);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(randomOrder() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    // Move the existing links, keeping reading and keyboard order identical.
    if (projectList) projectList.append(...order);
    for (const record of records) {
      record.scene = createScene(seed, record.index);
      const random = createRandom((seed + record.index * 997) >>> 0);
      record.element.dataset.layout = String(record.scene.variant);
      record.element.style.setProperty('--note-offset', `${Math.round(random() * 28)}px`);
    }
    canvas.dataset.edition = seed.toString(16).padStart(8, '0');
  }
  function resize() {
    const nextWidth = Math.max(1, browser.innerWidth);
    const nextHeight = Math.max(1, browser.innerHeight);
    const nextDpr = Math.min(browser.devicePixelRatio || 1, 1.5);
    if (width === nextWidth && height === nextHeight && dpr === nextDpr) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = createSwarm({ seed, width, height, count: width < 660 ? 22 : 48 });
  }
  function measure(now) {
    resize();
    const regions = records.map(record => ({ ...record, rect: record.element.getBoundingClientRect() }));
    active = activeRegion(regions, height);
    canvas.dataset.scene = active?.element.id || '';
    visibleItems = [];
    for (const record of regions) {
      if (record.rect.bottom <= 0 || record.rect.top >= height) continue;
      for (const item of record.items) {
        const rect = item.getBoundingClientRect();
        if (rect.bottom <= 8 || rect.top >= height - 8 || rect.width <= 0 || rect.height <= 0) continue;
        if (record.index === active?.index) visibleItems.push({ item, rect });
        const building = construction.get(item);
        if (building) building.rect = rect;
        if (seen.has(item)) continue;
        seen.add(item);
        // Content is immediately usable; only the first visible presentation animates.
        if (paused() || item.contains(root.activeElement)) continue;
        const random = createRandom((seed + record.index * 997 + record.items.indexOf(item) * 71) >>> 0);
        const delay = Math.round(random() * 180);
        item.style.setProperty('--build-delay', `${delay}ms`);
        item.classList.add('is-assembling');
        construction.set(item, { rect, start: now, delay, duration: 1250 + random() * 200 });
      }
    }
    dirty = false;
  }
  function targetsAt(time) {
    const direction = active?.scene?.direction || 1;
    const phase = active?.scene?.phase || 0;
    return visibleItems.slice(0, 12).flatMap(({ rect }, index) => {
      // Teams trace different edges, then drift in the margins as the section settles.
      return [0, .43].map(offset => {
        const point = edgePoint(rect, phase + offset + index * .19 + time * .035 * direction, 14);
        return { x: clamp(point.x, 12, width - 12), y: clamp(point.y, 12, height - 12) };
      });
    });
  }
  function drawConstruction(now) {
    for (const [item, build] of construction) {
      const progress = (now - build.start) / build.duration;
      if (progress >= 1) {
        item.classList.remove('is-assembling');
        construction.delete(item);
        continue;
      }
      const { left, top, width: w, height: h } = build.rect;
      if (top + h <= 0 || top >= height) continue;
      const opacity = Math.sin(clamp(progress, 0, 1) * Math.PI) * .3;
      context.globalAlpha = opacity;
      context.strokeStyle = palette[records.findIndex(record => record.element.contains(item)) % palette.length];
      context.lineWidth = .7;
      context.strokeRect(left - 6, top - 6, w + 12, h + 12);
      const tip = edgePoint(build.rect, progress, 6);
      context.fillStyle = context.strokeStyle;
      context.fillRect(tip.x - 2, tip.y - 2, 4, 4);
      context.globalAlpha = opacity * .35;
      context.beginPath();
      context.moveTo(left - 22, top - 6);
      context.lineTo(left + w + 22, top - 6);
      context.stroke();
    }
  }
  function draw(now) {
    context.clearRect(0, 0, width, height);
    if (contrast?.matches) return;
    if (!paused()) drawConstruction(now);
    const busy = construction.size > 0;
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(Math.atan2(particle.vy || -.2, particle.vx || .2) + Math.PI * .27);
      const size = width < 660 ? .52 : .64;
      context.scale(size, size);
      context.globalAlpha = (busy ? .78 : .5) * (index % 4 === 0 ? 1 : .8);
      context.fillStyle = palette[index % palette.length];
      context.strokeStyle = '#0d0f0e';
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, 14);
      context.lineTo(4, 10);
      context.lineTo(7, 16);
      context.lineTo(10, 14.5);
      context.lineTo(7, 8.5);
      context.lineTo(13, 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
    context.globalAlpha = 1;
  }
  function schedule() {
    if (!request && !unavailable()) request = browser.requestAnimationFrame(frame);
  }
  function stop() {
    if (request) browser.cancelAnimationFrame(request);
    request = 0;
    previous = 0;
    pointer.active = pointer.pressed = false;
  }
  function frame(now) {
    request = 0;
    if (unavailable()) return;
    if (dirty) measure(now);
    const dt = previous ? (now - previous) / 1000 : 1 / 60;
    previous = now;
    if (now - pointerTime > 1600 && !pointer.pressed) pointer.active = false;
    if (!paused()) {
      particles = stepSwarm(particles, { dt, time: now / 1000, width, height, pointer, targets: targetsAt(now / 1000) });
    }
    draw(now);
    if (!paused()) schedule();
  }
  function refresh() {
    if (disposed) return;
    dirty = true;
    updateControls();
    schedule();
  }
  function motionChanged() {
    stop();
    clearConstruction();
    refresh();
  }
  function recompose() {
    clearConstruction();
    seed = freshSeed(browser);
    seen = new Set();
    arrange();
    particles = createSwarm({ seed, width, height, count: width < 660 ? 22 : 48 });
    if (status) status.textContent = language() === 'zh' ? '新的构图已就绪。' : 'A new arrangement is ready.';
    refresh();
  }
  function track(event) {
    if (paused() || event.isPrimary === false) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    pointerTime = browser.performance.now();
  }
  function release(event) {
    pointer.pressed = false;
    if (event?.pointerType === 'touch' || event?.type === 'pointercancel') pointer.active = false;
  }

  arrange();
  updateControls();
  if (controls) controls.hidden = false;
  listen(regenerate, 'click', recompose);
  listen(toggle, 'click', () => { userPaused = !paused(); motionChanged(); });
  listen(browser, 'scroll', refresh, { passive: true });
  listen(browser, 'resize', refresh, { passive: true });
  listen(browser, 'pointermove', track, { passive: true });
  listen(browser, 'pointerdown', event => {
    track(event);
    if (!paused() && event.isPrimary !== false) pointer.pressed = true;
  }, { passive: true });
  listen(browser, 'pointerup', release, { passive: true });
  listen(browser, 'pointercancel', release, { passive: true });
  listen(browser, 'pointerout', event => { if (!event.relatedTarget) pointer.active = pointer.pressed = false; });
  listen(browser, 'blur', () => { pointer.active = pointer.pressed = false; });
  listen(root, 'visibilitychange', () => { if (root.hidden) stop(); else refresh(); });
  listen(browser, 'pagehide', () => { suspended = true; stop(); });
  listen(browser, 'pageshow', () => { suspended = false; refresh(); });
  listen(media, 'change', () => { userPaused = null; motionChanged(); });
  listen(contrast, 'change', motionChanged);
  listen(root, 'focusin', event => {
    // Keyboard focus must never wait for an entrance animation.
    for (const item of construction.keys()) {
      if (item.contains(event.target)) {
        item.classList.remove('is-assembling');
        construction.delete(item);
      }
    }
  });
  if (browser.ResizeObserver) {
    const observer = new browser.ResizeObserver(refresh);
    observer.observe(root.querySelector('.page'));
    cleanups.push(() => observer.disconnect());
  }
  root.fonts?.ready?.then(() => { if (!disposed) refresh(); });
  refresh();

  return {
    refresh,
    recompose,
    dispose() {
      disposed = true;
      stop();
      clearConstruction();
      cleanups.forEach(cleanup => cleanup());
      canvas.remove();
      if (controls) controls.hidden = true;
      delete root.documentElement.dataset.motion;
    },
  };
}
