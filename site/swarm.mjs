import { createRandom, createScene, createBuildTask, sampleBuildTask } from './swarm-model.mjs';

const palette = ['#a9c7ff', '#d5f4a2', '#c7b0f5', '#f0b492', '#8ed5c3', '#e5bad7'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const buildSelector = '[data-build], h1, h2, .list-link, .gratitude > p, .encrypted-contact > p, pre';

function freshSeed(browser) {
  const value = new Uint32Array(1);
  if (browser.crypto?.getRandomValues) return browser.crypto.getRandomValues(value)[0];
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** The reading area, rather than document order, decides which crew works first. */
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

/** Read rendered text rows without splitting, cloning or changing the prepared HTML. */
function textRows(root, browser, element, bounds) {
  const rows = [];
  try {
    const walker = root.createTreeWalker(element, browser.NodeFilter?.SHOW_TEXT || 4);
    const range = root.createRange();
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        const top = rect.top - bounds.top;
        const left = rect.left - bounds.left;
        const row = rows.find(value => Math.abs(value.top - top) < Math.min(value.height, rect.height) * .55);
        if (row) {
          const right = Math.max(row.left + row.width, left + rect.width);
          const bottom = Math.max(row.top + row.height, top + rect.height);
          row.left = Math.min(row.left, left);
          row.top = Math.min(row.top, top);
          row.width = right - row.left;
          row.height = bottom - row.top;
        } else rows.push({ left, top, width: rect.width, height: rect.height });
      }
    }
  } catch { return []; }
  return rows.sort((a, b) => a.top - b.top);
}

/** A bounded construction queue. Every visible cursor belongs to an unfinished job. */
export function initSwarm(root, browser) {
  function releaseBoot() { delete root.documentElement.dataset.construction; }
  if (!browser.requestAnimationFrame || !root.querySelector('[data-scene]')) { releaseBoot(); return null; }
  const canvas = root.createElement('canvas');
  let context;
  try { context = canvas.getContext('2d'); } catch { releaseBoot(); return null; }
  if (!context) { releaseBoot(); return null; }

  const media = browser.matchMedia?.('(prefers-reduced-motion: reduce)');
  const contrast = browser.matchMedia?.('(forced-colors: active)');
  const controls = root.querySelector('.scene-controls');
  const regenerate = root.getElementById('recompose');
  const toggle = root.getElementById('motion-toggle');
  const status = root.getElementById('scene-status');
  const projectList = root.querySelector('.project-list');
  const projects = projectList ? [...projectList.children] : [];
  const records = [...root.querySelectorAll('[data-scene]')].map((element, index) => ({ element, index }));
  const jobs = records.flatMap(record => [...record.element.querySelectorAll(buildSelector)]
    .filter(element => !element.parentElement.closest('[data-build]'))
    .map(element => ({ element, record, kind: element.dataset.build === 'line' ? 'line'
      : element.matches('.list-link, pre, [data-build="card"]') ? 'card' : 'text', state: 'queued', task: null, elapsed: 0, visible: false })));
  jobs.forEach((job, index) => { job.index = index; });
  const cleanups = [];
  const handoffs = [];
  let seed = freshSeed(browser);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let active = null;
  let request = 0;
  let previous = null;
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
  function focused(job) { return job.element.contains(root.activeElement); }

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
  function finish(job) {
    job.state = 'done';
    job.task = null;
    job.element.dataset.buildState = 'done';
    job.element.style.removeProperty('--build-reveal');
    job.element.style.removeProperty('clip-path');
  }
  function finishAll() {
    jobs.forEach(finish);
    handoffs.length = 0;
    canvas.dataset.state = 'idle';
  }
  function prepare() {
    handoffs.length = 0;
    for (const job of jobs) {
      job.element.classList.add('build-item');
      job.task = null;
      job.elapsed = 0;
      job.lastSample = null;
      job.element.style.removeProperty('clip-path');
      if (paused() || focused(job)) { finish(job); continue; }
      job.state = 'queued';
      job.element.dataset.buildState = 'queued';
      job.element.style.setProperty('--build-reveal', '0');
    }
    root.documentElement.dataset.construction = 'active';
  }
  function arrange() {
    const focusedElement = root.activeElement;
    const order = [...projects];
    const random = createRandom(seed ^ 0x52c6a1);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    if (projectList) projectList.append(...order);
    if (focusedElement?.isConnected && root.activeElement !== focusedElement) focusedElement.focus?.({ preventScroll: true });
    for (const record of records) {
      record.element.dataset.layout = String(createScene(seed, record.index).variant);
      record.element.style.setProperty('--note-offset', `${Math.round(random() * 28)}px`);
    }
    canvas.dataset.edition = seed.toString(16).padStart(8, '0');
  }
  function measure() {
    const nextWidth = Math.max(1, browser.innerWidth);
    const nextHeight = Math.max(1, browser.innerHeight);
    const nextDpr = Math.min(browser.devicePixelRatio || 1, 1.5);
    if (width !== nextWidth || height !== nextHeight || dpr !== nextDpr) {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const regions = records.map(record => ({ ...record, rect: record.element.getBoundingClientRect() }));
    active = activeRegion(regions, height);
    canvas.dataset.scene = active?.element.id || '';
    for (const job of jobs) {
      const rect = job.element.getBoundingClientRect();
      job.visible = rect.width > 0 && rect.height > 0 && rect.bottom > 8 && rect.top < height - 8;
      job.rect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      if (!job.visible || job.state === 'done') continue;
      job.rows = job.kind === 'text' ? textRows(root, browser, job.element, job.rect) : [];
      if (job.task) { job.task.rect = job.rect; job.task.rows = job.rows; }
    }
    dirty = false;
  }
  function startJobs() {
    const busy = jobs.filter(job => job.visible && job.task && job.state !== 'done');
    const capacity = Math.max(0, (width < 660 ? 2 : 4) - busy.length);
    const pending = jobs.filter(job => job.visible && job.state === 'queued')
      .sort((a, b) => Number(b.record.index === active?.index) - Number(a.record.index === active?.index)
        || a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    for (const [slot, job] of pending.slice(0, capacity).entries()) {
      const origin = handoffs.shift() || { x: clamp(job.rect.left - 48 - slot * 16, 18, width - 18), y: clamp(job.rect.top + 65 + slot * 22, 18, height - 18) };
      job.task = createBuildTask({ seed, index: job.index, rect: job.rect, kind: job.kind, origin });
      job.task.rows = job.rows;
      job.elapsed = -slot * 65;
      job.state = 'approach';
      busy.push(job);
    }
    return busy;
  }
  function reveal(job, sample) {
    job.element.dataset.buildState = sample.stage;
    job.element.style.setProperty('--build-reveal', sample.reveal.toFixed(5));
    if (sample.rowIndex !== null && sample.reveal < 1 && sample.caret) {
      const rows = job.task.rows;
      const row = rows[sample.rowIndex];
      const before = sample.rowIndex ? (rows[sample.rowIndex - 1].top + rows[sample.rowIndex - 1].height + row.top) / 2 : 0;
      const after = rows[sample.rowIndex + 1]?.top ?? job.rect.height;
      const x = clamp(sample.caret.x - job.rect.left, 0, job.rect.width);
      const top = clamp(before, 0, job.rect.height);
      const bottom = clamp(after, top, job.rect.height);
      job.element.style.clipPath = `polygon(0 0, 100% 0, 100% ${top}px, ${x}px ${top}px, ${x}px ${bottom}px, 0 ${bottom}px)`;
    } else job.element.style.removeProperty('clip-path');
  }
  function drawCursor(cursor, sample, color) {
    context.save();
    context.translate(cursor.x, cursor.y);
    context.fillStyle = color;
    context.strokeStyle = '#0d0f0e';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(1, 17);
    context.lineTo(5.5, 12.5);
    context.lineTo(9, 20);
    context.lineTo(12, 18.5);
    context.lineTo(8.5, 11.5);
    context.lineTo(15, 10);
    context.closePath();
    context.fill();
    context.stroke();
    if (cursor.pressed) {
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
    if (cursor.role === 'align' || sample.stage === 'approach' || sample.stage === 'settle') return;
    const label = language() === 'zh'
      ? (cursor.role === 'type' ? '排字' : sample.box ? '拖框' : '画线')
      : (cursor.role === 'type' ? 'Type' : sample.box ? 'Frame' : 'Draw');
    context.font = '10px "IBM Plex Mono", monospace';
    const w = context.measureText(label).width + 12;
    const x = clamp(cursor.x + 14, 4, width - w - 4);
    const y = clamp(cursor.y + 17, 4, height - 21);
    context.fillStyle = color;
    context.fillRect(x, y, w, 18);
    context.fillStyle = '#0d0f0e';
    context.fillText(label, x + 6, y + 12);
  }
  function drawJob(job, sample) {
    const color = palette[job.task.color];
    context.globalAlpha = sample.opacity;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1.15;
    if (sample.box) {
      const box = sample.box;
      context.globalAlpha = sample.opacity * .055;
      context.fillRect(box.left, box.top, box.width, box.height);
      context.globalAlpha = sample.opacity * .9;
      context.strokeRect(box.left, box.top, box.width, box.height);
      context.globalAlpha = sample.opacity * .22;
      context.setLineDash([3, 5]);
      context.beginPath();
      context.moveTo(18, box.top);
      context.lineTo(width - 18, box.top);
      context.moveTo(box.left, Math.max(18, box.top - 70));
      context.lineTo(box.left, Math.min(height - 18, job.rect.top + job.rect.height + 70));
      context.stroke();
      context.setLineDash([]);
    }
    for (const line of sample.lines) {
      context.globalAlpha = sample.opacity * (line.role === 'guide' ? .45 : .95);
      context.beginPath();
      context.moveTo(line.x1, line.y1);
      context.lineTo(line.x2, line.y2);
      context.stroke();
    }
    context.globalAlpha = sample.opacity;
    for (const handle of sample.handles) {
      context.fillStyle = '#0d0f0e';
      context.fillRect(handle.x - 2.5, handle.y - 2.5, 5, 5);
      context.strokeRect(handle.x - 2.5, handle.y - 2.5, 5, 5);
    }
    if (sample.caret && sample.stage === 'write') {
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(sample.caret.x, sample.caret.y);
      context.lineTo(sample.caret.x, sample.caret.y + sample.caret.height);
      context.stroke();
    }
    for (const cursor of sample.cursors) drawCursor(cursor, sample, palette[cursor.color]);
    context.globalAlpha = 1;
  }
  function schedule() {
    if (!request && !unavailable()) request = browser.requestAnimationFrame(frame);
  }
  function stop() {
    if (request) browser.cancelAnimationFrame(request);
    request = 0;
    previous = null;
  }
  function frame(now) {
    request = 0;
    if (unavailable()) return;
    try {
      if (dirty) measure();
      const dt = previous === null ? 0 : clamp(now - previous, 0, 80);
      previous = now;
      context.clearRect(0, 0, width, height);
      if (paused()) { finishAll(); previous = null; return; }
      for (const job of startJobs()) {
        if (focused(job)) { finish(job); continue; }
        job.elapsed += dt;
        const sample = sampleBuildTask(job.task, job.elapsed);
        if (sample.done) {
          const cursor = job.lastSample?.cursors[0];
          if (cursor) handoffs.push({ x: cursor.x, y: cursor.y });
          finish(job);
          continue;
        }
        job.state = sample.stage;
        reveal(job, sample);
        drawJob(job, sample);
        job.lastSample = sample;
      }
      const working = jobs.some(job => job.visible && job.state !== 'done');
      canvas.dataset.state = working ? 'building' : 'idle';
      if (working) schedule();
      else previous = null;
    } catch {
      // A failed enhancement must never leave prepared content concealed.
      dispose();
    }
  }
  function refresh() {
    if (disposed) return;
    dirty = true;
    updateControls();
    schedule();
  }
  function motionChanged() {
    stop();
    if (paused()) finishAll();
    refresh();
  }
  function recompose() {
    if (disposed) return;
    stop();
    seed = freshSeed(browser);
    arrange();
    prepare();
    if (status) status.textContent = language() === 'zh' ? '正在重新搭建当前画面。' : 'Rebuilding the current view.';
    refresh();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    finishAll();
    for (const job of jobs) {
      job.element.classList.remove('build-item');
      delete job.element.dataset.buildState;
    }
    cleanups.forEach(cleanup => cleanup());
    canvas.remove();
    if (controls) controls.hidden = true;
    delete root.documentElement.dataset.motion;
    releaseBoot();
  }

  try {
    arrange();
    prepare();
    updateControls();
    if (controls) controls.hidden = false;
    listen(regenerate, 'click', recompose);
    listen(toggle, 'click', () => { userPaused = !paused(); motionChanged(); });
    listen(browser, 'scroll', refresh, { passive: true });
    listen(browser, 'resize', refresh, { passive: true });
    listen(root, 'visibilitychange', () => { if (root.hidden) stop(); else refresh(); });
    listen(browser, 'pagehide', () => { suspended = true; stop(); });
    listen(browser, 'pageshow', () => { suspended = false; refresh(); });
    listen(media, 'change', () => { userPaused = null; motionChanged(); });
    listen(contrast, 'change', motionChanged);
    listen(canvas, 'contextlost', dispose);
    listen(root, 'focusin', event => {
      for (const job of jobs) {
        if (job.element.contains(event.target) || event.target === job.record.element) finish(job);
      }
      refresh();
    });
    if (browser.ResizeObserver) {
      const observer = new browser.ResizeObserver(refresh);
      observer.observe(root.querySelector('.page'));
      cleanups.push(() => observer.disconnect());
    }
    root.fonts?.ready?.then(() => { if (!disposed) refresh(); });
    refresh();
  } catch { dispose(); return null; }

  return { refresh, recompose, dispose };
}
