/*! Copyright (C) 2026 LIghtJUNction; SPDX-License-Identifier: AGPL-3.0-or-later
 * DOM typography adapter for particle-sculpture-skill. See particle-NOTICE.md.
 */
import { STRIDE, clamp, hash, smooth, createTimeline, limitPoints, spring, brush, morphPoint } from './particle-math.mjs';

const owners = new WeakMap();
const CSS = `
.particle-ready { -webkit-text-fill-color: transparent; }
.particle-ready ::selection { -webkit-text-fill-color: var(--ink); }
.particle-canvas { position: fixed; top: 0; z-index: 6; pointer-events: none; touch-action: pan-y pinch-zoom; }
.particle-controls { display: inline-flex; gap: 4px; align-items: center; }
.particle-control { display: inline-flex; align-items: center; justify-content: center; width: 30px; min-height: 40px; color: var(--muted); }
.particle-control:hover { color: var(--ink); }
.particle-control svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; }
.particle-native { -webkit-text-fill-color: currentColor; }
@media print, (forced-colors: active) {
  .particle-ready { -webkit-text-fill-color: currentColor; }
  .particle-canvas, .particle-controls { display: none !important; }
}
`;

/** Sample actual laid-out text, including each wrapped line, without replacing it. */
function capture(root, mask, budget) {
  const doc = root.ownerDocument, win = doc.defaultView, rect = root.getBoundingClientRect();
  const left = Math.max(0, Math.floor(rect.left + win.scrollX - 40));
  const top = Math.floor(rect.top + win.scrollY);
  const width = Math.ceil(Math.min(win.innerWidth, rect.width + 80));
  const height = Math.ceil(Math.max(root.scrollHeight, rect.height));
  // A large zoom or unexpected document cannot allocate an unbounded bitmap.
  if (width <= 0 || height <= 0 || width * height * 9 > 8_000_000) throw new Error('Text surface exceeds its buffer budget.');
  const scale = 3;
  mask.width = width * scale; mask.height = height * scale;
  const ctx = mask.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Text sampling unavailable.');
  ctx.scale(scale, scale);
  const heading = root.querySelector('h1');
  const menu = root.querySelector('details[open] .elsewhere-menu');
  const cover = menu?.getBoundingClientRect();
  const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  const styles = new Map();
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.textContent.trim() || parent.closest('svg, script, style, .particle-controls') || heading?.contains(node)) continue;
    if (parent.closest('details:not([open]) .elsewhere-menu')) continue;
    let style = styles.get(parent);
    if (!style) { style = win.getComputedStyle(parent); styles.set(parent, style); }
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    // Native row hover hides metadata to make room for its arrow.
    if (parent.closest('.row-meta') && parent.closest('.list-link')?.matches(':hover, :focus-visible')) continue;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    const metrics = ctx.measureText('Mg');
    const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
    const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
    let offset = 0;
    for (const char of node.textContent) {
      range.setStart(node, offset); offset += char.length; range.setEnd(node, offset);
      if (!char.trim()) continue;
      const box = range.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (cover && !menu.contains(node) && box.right > cover.left && box.left < cover.right && box.bottom > cover.top && box.top < cover.bottom) continue;
      const baseline = box.top + (box.height - ascent - descent) / 2 + ascent;
      ctx.fillText(char, box.left + win.scrollX - left, baseline + win.scrollY - top);
    }
  }
  function sample() {
    const { data } = ctx.getImageData(0, 0, mask.width, mask.height);
    const points = [];
    // 1 CSS-pixel lattice keeps small text readable. A bounded, shallow extrusion gives the text depth.
    for (let y = 1; y < mask.height; y += 3) for (let x = 1; x < mask.width; x += 3) {
      const i = (y * mask.width + x) * 4;
      if (data[i + 3] < 42) continue;
      points.push(x / scale + left, y / scale + top, (hash(i) - .5) * 1.2,
        data[i], data[i + 1], data[i + 2], Math.min(255, data[i + 3] * 1.35));
    }
    return new Float32Array(points);
  }
  const body = sample();
  const titles = [];
  if (heading) {
    const style = win.getComputedStyle(heading), box = heading.getBoundingClientRect();
    const language = doc.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
    const original = heading.textContent;
    // Only phrases already on this page. The semantic H1 stays available to readers.
    const phrases = [original, root.querySelector('.intro strong')?.textContent,
      'AI & agents', root.querySelectorAll('.intro p')[2]?.querySelector('strong')?.textContent].filter(Boolean);
    for (const text of phrases) {
      ctx.clearRect(0, 0, width, height);
      const size = parseFloat(style.fontSize);
      ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
      ctx.fillStyle = style.color;
      ctx.letterSpacing = style.letterSpacing;
      const factor = Math.min(1, box.width / Math.max(1, ctx.measureText(text).width));
      ctx.font = `${style.fontWeight} ${size * factor}px ${style.fontFamily}`;
      const metrics = ctx.measureText(text);
      const line = parseFloat(style.lineHeight) || size * 1.35;
      const ascent = metrics.fontBoundingBoxAscent ?? size * .8;
      const descent = metrics.fontBoundingBoxDescent ?? size * .2;
      ctx.fillText(text, box.left + win.scrollX - left,
        box.top + win.scrollY - top + (line - ascent - descent) / 2 + ascent);
      titles.push({ text, points: sample() });
    }
    // Language is part of the capture identity even when both locales share a term.
    titles.language = language;
  }
  const titleBudget = Math.min(Math.floor(budget * .25), Math.max(0, ...titles.map(t => t.points.length / STRIDE)));
  for (const title of titles) title.points = limitPoints(title.points, titleBudget);
  return { body: limitPoints(body, budget - titleBudget), titles, left, top, width, height };
}

/** One animation owner for all page text. No per-letter DOM and no per-frame layout. */
export function mountSculpture(root) {
  if (!root) return null;
  if (owners.has(root)) return owners.get(root);
  const doc = root.ownerDocument, win = doc.defaultView;
  const canvas = doc.createElement('canvas'), mask = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || !win.ResizeObserver || !win.IntersectionObserver || !win.matchMedia) return null;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = win.matchMedia('(forced-colors: active)');
  const fine = win.matchMedia('(hover: hover) and (pointer: fine)');
  const style = doc.createElement('style'); style.textContent = CSS;
  doc.head.append(style);
  canvas.className = 'particle-canvas'; canvas.setAttribute('aria-hidden', 'true');
  doc.body.append(canvas);
  const controls = doc.createElement('span'); controls.className = 'particle-controls';
  function button(path) {
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'particle-control';
    // Fixed, local SVG only. User or translation text never goes through innerHTML.
    b.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
    controls.append(b); return b;
  }
  const next = button('M2 4h2l8 8h2M2 12h2l8-8h2M11 2l3 2-3 2M11 10l3 2-3 2');
  const pause = button('M5 3v10M11 3v10');
  root.querySelector('.navigation')?.prepend(controls);
  const listeners = [];
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  let frame = null, last = 0, clock = 0, titleClock = 0, frames = 0;
  let disposed = false, visible = true, dirty = true, layoutDirty = true, morphDirty = false;
  let paused = win.navigator.connection?.saveData === true, selecting = false;
  let surface = null, timeline = null, transition = null, titleTransition = null, image, pixels, depth;
  let ratio = 1, viewLeft = 0, viewWidth = 0, viewHeight = 0;
  let currentTitle = '', maxOffset = 0, drawnPoints = 0, scrollX = 0, scrollY = 0;
  let springs = new Float32Array(0);
  const scratch = new Float32Array(STRIDE);
  const pointer = { x: 0, y: 0, previousX: 0, previousY: 0, vx: 0, vy: 0, radius: 48, active: false };
  const target = { x: 0, y: 0, active: false };
  const mobile = () => !fine.matches || win.innerWidth <= 660;
  const motion = () => !paused && !reduced.matches && !forced.matches && !selecting;
  const state = () => reduced.matches ? 'reduced' : paused ? 'paused' : 'playing';
  function labels() {
    const zh = doc.documentElement.lang.startsWith('zh');
    next.title = zh ? '变换文字' : 'Change text'; next.setAttribute('aria-label', next.title);
    pause.title = zh ? (paused ? '继续粒子动画' : '暂停粒子动画') : (paused ? 'Resume particles' : 'Pause particles');
    pause.setAttribute('aria-label', pause.title); pause.setAttribute('aria-pressed', String(paused));
    pause.querySelector('path').setAttribute('d', paused ? 'M5 3l8 5-8 5Z' : 'M5 3v10M11 3v10');
    next.disabled = reduced.matches; pause.disabled = reduced.matches;
  }
  function schedule() {
    if (frame === null && !disposed && visible && !doc.hidden && !forced.matches && !selecting) frame = win.requestAnimationFrame(render);
  }
  function refresh(morph = false) { layoutDirty = true; morphDirty ||= morph; dirty = true; schedule(); }
  function resetClock() {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null; last = 0; target.active = false; pointer.active = false;
    dirty = true; labels(); schedule();
  }
  function resizeBitmap() {
    const rect = root.getBoundingClientRect();
    const newLeft = Math.max(0, Math.floor(rect.left - 40));
    const newWidth = Math.ceil(Math.min(win.innerWidth, rect.width + 80));
    const newHeight = Math.ceil(win.innerHeight);
    const dpr = 1.5; // Supersample tiny glyphs, still within the skill's DPR cap.
    if (image && newWidth === viewWidth && newHeight === viewHeight && dpr === ratio) { viewLeft = newLeft; canvas.style.left = `${newLeft}px`; return; }
    viewLeft = newLeft; viewWidth = newWidth; viewHeight = newHeight; ratio = dpr;
    canvas.style.left = `${viewLeft}px`; canvas.style.width = `${viewWidth}px`; canvas.style.height = `${viewHeight}px`;
    canvas.width = Math.ceil(viewWidth * ratio); canvas.height = Math.ceil(viewHeight * ratio);
    if (canvas.width * canvas.height > 4_000_000) throw new Error('Viewport exceeds its buffer budget.');
    image = ctx.createImageData(canvas.width, canvas.height);
    pixels = new Uint32Array(image.data.buffer); depth = new Float32Array(pixels.length);
  }
  function rebuild() {
    resizeBitmap();
    const fresh = capture(root, mask, mobile() ? 22000 : 60000);
    const old = surface;
    const localeChanged = old && old.titles.language !== fresh.titles.language;
    if (localeChanged && motion()) {
      const t = titleTransition ? {
        from: { points: titleTransition.from }, to: { points: titleTransition.to },
        mix: smooth(clamp((clock - titleTransition.start) / 1.6, 0, 1)),
      } : timeline.at(titleClock);
      const n = Math.max(t.from.points.length, t.to.points.length) / STRIDE;
      const points = new Float32Array(n * STRIDE);
      for (let i = 0; i < n; i++) {
        morphPoint(t.from.points, t.to.points, i, n, t.mix, scratch, 95);
        points.set(scratch, i * STRIDE);
      }
      titleTransition = { from: points, to: fresh.titles[0].points, start: clock };
    }
    surface = fresh; timeline = createTimeline(fresh.titles.length ? fresh.titles : [{ text: '', points: new Float32Array() }]);
    // A locale/layout change starts from the visible field, including a mid-morph.
    if (old && (morphDirty || transition) && motion()) {
      let from = old.body;
      if (transition) {
        const n = Math.max(transition.from.length, transition.to.length) / STRIDE;
        const snapshot = new Float32Array(n * STRIDE);
        const mix = smooth(clamp((clock - transition.start) / 1.6, 0, 1));
        for (let i = 0; i < n; i++) {
          morphPoint(transition.from, transition.to, i, n, mix, scratch, 38);
          snapshot.set(scratch, i * STRIDE);
        }
        from = snapshot;
      }
      transition = { from, to: fresh.body, start: clock };
    } else transition = null;
    if (old?.titles.language !== fresh.titles.language) titleClock = 0;
    const count = Math.max(fresh.body.length, transition?.from.length || 0) / STRIDE
      + Math.max(titleTransition?.from.length / STRIDE || 0, ...fresh.titles.map(t => t.points.length / STRIDE));
    // Store offsets separately from immutable rest geometry.
    if (springs.length !== count * 4) springs = new Float32Array(count * 4);
    labels(); layoutDirty = false; morphDirty = false;
  }
  function dot(x, y, z, r, g, b, a) {
    const px = Math.round((x - viewLeft - scrollX) * ratio), py = Math.round((y - scrollY) * ratio);
    const size = Math.max(1, Math.round(ratio));
    if (px < 0 || py < 0 || px + size > canvas.width || py + size > canvas.height) return;
    const color = (clamp(a, 0, 255) << 24) | (clamp(b, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(r, 0, 255);
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const p = (py + dy) * canvas.width + px + dx;
      if (z >= depth[p]) { pixels[p] = color; depth[p] = z; }
    }
  }
  function drawField(from, to, mix, base, dt, animate, spread, budget = 60000) {
    const count = Math.min(budget, Math.max(from.length, to.length) / STRIDE);
    const cloud = Math.sin(Math.PI * mix);
    for (let i = 0; i < count; i++) {
      morphPoint(from, to, i, count, mix, scratch, spread);
      const s = (base + i) * 4;
      let x = scratch[0], y = scratch[1], z = scratch[2];
      // A bounded perspective around each dot preserves the original text layout.
      x += z * cloud * .22; y -= z * cloud * .1;
      if (animate) {
        if (pointer.active && y - scrollY > -60 && y - scrollY < viewHeight + 60) brush(springs, s, x - scrollX, y - scrollY, pointer, dt);
        spring(springs, s, dt);
      }
      x += springs[s] || 0; y += springs[s + 1] || 0;
      maxOffset = Math.max(maxOffset, Math.abs(springs[s] || 0), Math.abs(springs[s + 1] || 0));
      dot(x, y, z, scratch[3], scratch[4], scratch[5], scratch[6]);
    }
    return count;
  }
  function render(now) {
    frame = null;
    if (disposed || doc.hidden || !visible || selecting || forced.matches) return;
    const interval = mobile() ? 1000 / 30 : 1000 / 60;
    const elapsed = last ? Math.min(80, now - last) : 0;
    if (!dirty && last && elapsed + .5 < interval) { schedule(); return; }
    last = now;
    const animate = motion(), dt = elapsed / 1000;
    if (animate) { clock += dt; titleClock += dt; }
    try {
      if (layoutDirty) rebuild();
      pointer.previousX = pointer.x; pointer.previousY = pointer.y;
      if (animate) {
        const follow = 1 - Math.exp(-elapsed / 75), velocity = 1 - Math.exp(-elapsed / 110);
        pointer.x += (target.x - pointer.x) * follow; pointer.y += (target.y - pointer.y) * follow;
        pointer.vx += (clamp((pointer.x - pointer.previousX) / Math.max(dt, .001), -1600, 1600) - pointer.vx) * velocity;
        pointer.vy += (clamp((pointer.y - pointer.previousY) / Math.max(dt, .001), -1600, 1600) - pointer.vy) * velocity;
      }
      pointer.active = animate && target.active;
      pixels.fill(0); depth.fill(-Infinity); maxOffset = 0; scrollX = win.scrollX; scrollY = win.scrollY;
      const bodyMix = transition ? smooth(clamp((clock - transition.start) / 1.6, 0, 1)) : 0;
      const title = timeline.at(reduced.matches ? 0 : titleClock);
      const titleCount = Math.max(titleTransition?.from.length || title.from.points.length, titleTransition?.to.length || title.to.points.length) / STRIDE;
      const bodyCount = drawField(transition?.from || surface.body, transition?.to || surface.body, bodyMix, 0, dt, animate, 38, (mobile() ? 22000 : 60000) - titleCount);
      currentTitle = title.mix < .5 ? title.from.text : title.to.text;
      const titleMix = titleTransition ? smooth(clamp((clock - titleTransition.start) / 1.6, 0, 1)) : title.mix;
      drawnPoints = bodyCount + drawField(titleTransition?.from || title.from.points, titleTransition?.to || title.to.points, titleMix, bodyCount, dt, animate, 95);
      if (titleTransition && titleMix === 1) titleTransition = null;
      if (bodyMix === 1) transition = null;
      ctx.putImageData(image, 0, 0); frames++;
      root.classList.add('particle-ready'); canvas.hidden = false;
      dirty = false;
      if (animate) schedule();
    } catch (error) {
      // No missing/blank text if a browser cannot rasterize or allocate the effect.
      dispose(); win.console.warn('Particle text disabled; the HTML profile remains available.', error);
    }
  }
  function move(event) {
    if (!motion() || (event.pointerType === 'touch' && !event.isPrimary)) return;
    if (!target.active) {
      pointer.x = pointer.previousX = event.clientX; pointer.y = pointer.previousY = event.clientY;
      pointer.vx = pointer.vy = 0;
    }
    target.x = event.clientX; target.y = event.clientY; target.active = true;
    pointer.radius = event.pointerType === 'touch' ? 58 : 48; schedule();
  }
  const leave = () => { target.active = false; };
  on(root, 'pointermove', move, { passive: true });
  on(root, 'pointerdown', move, { passive: true });
  for (const event of ['pointerleave', 'pointercancel', 'pointerup']) on(root, event, leave, { passive: true });
  // No preventDefault, pointer capture, wheel handler, or touch-action:none.
  on(root, 'touchstart', event => { if (event.touches.length > 1) leave(); }, { passive: true });
  on(win, 'scroll', () => { leave(); dirty = true; schedule(); }, { passive: true });
  on(win, 'resize', () => refresh());
  on(root, 'toggle', () => refresh(), true);
  let hover = null;
  const interaction = event => {
    const candidate = event.target.closest?.('a, button, summary');
    if (candidate !== hover) { hover = candidate; refresh(); }
  };
  on(root, 'pointerover', interaction, { passive: true }); on(root, 'focusin', interaction);
  on(root, 'pointerleave', () => { hover = null; refresh(); }, { passive: true });
  on(root, 'focusout', () => refresh());
  on(doc, 'visibilitychange', resetClock);
  on(reduced, 'change', () => { if (reduced.matches) { titleClock = 0; transition = titleTransition = null; springs.fill(0); } resetClock(); });
  on(forced, 'change', () => { root.classList.toggle('particle-ready', !forced.matches); canvas.hidden = forced.matches; resetClock(); });
  on(doc, 'selectionchange', () => {
    selecting = !doc.getSelection()?.isCollapsed;
    root.classList.toggle('particle-ready', !selecting && Boolean(surface)); canvas.hidden = selecting;
    resetClock();
  });
  on(pause, 'click', () => { paused = !paused; resetClock(); });
  on(next, 'click', () => {
    if (reduced.matches || !timeline) return;
    // Keep pause a true freeze. Next explicitly resumes before starting a transition.
    paused = false;
    const index = Math.floor(titleClock / timeline.duration);
    titleClock = index * timeline.duration + 9;
    resetClock();
  });
  const mutation = new win.MutationObserver(records => {
    if (records.some(r => !controls.contains(r.target))) refresh(records.some(r => r.type === 'characterData' || r.type === 'childList'));
  });
  mutation.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open'] });
  const theme = new win.MutationObserver(() => refresh(true));
  theme.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'lang'] });
  const resize = new win.ResizeObserver(() => refresh()); resize.observe(root);
  const intersection = new win.IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resetClock(); }); intersection.observe(root);
  on(doc.fonts, 'loadingdone', () => refresh());
  on(win, 'pagehide', event => { if (!event.persisted) dispose(); else resetClock(); });
  on(win, 'pageshow', resetClock);
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) win.cancelAnimationFrame(frame); frame = null;
    for (const remove of listeners) remove();
    mutation.disconnect(); theme.disconnect(); resize.disconnect(); intersection.disconnect();
    root.classList.remove('particle-ready'); canvas.remove(); controls.remove(); style.remove();
    mask.width = mask.height = canvas.width = canvas.height = 0;
    surface = transition = titleTransition = timeline = image = pixels = depth = null; springs = new Float32Array();
    drawnPoints = 0; owners.delete(root);
  }
  const owner = {
    pause(value = !paused) { paused = Boolean(value); resetClock(); },
    inspect() { return { state: state(), visible, frames, clock, titleClock, currentTitle, maxOffset,
      points: drawnPoints,
      budget: mobile() ? 22000 : 60000, pixelRatio: ratio, transitioning: Boolean(transition || titleTransition), disposed }; },
    dispose,
  };
  owners.set(root, owner); labels(); schedule();
  return owner;
}
