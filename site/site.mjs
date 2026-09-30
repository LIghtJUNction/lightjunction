import { TokenCloud, CanvasCloud, clamp, phaseAt } from './token-cloud.mjs';

const root = document.documentElement;
const experience = document.querySelector('.experience');
const scene = document.querySelector('#scene');
let canvas = document.querySelector('#token-canvas');
const panels = [...document.querySelectorAll('[data-panel]')];
const motionButton = document.querySelector('#motion-toggle');
const scatterButton = document.querySelector('#scatter');
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const names = ['FORMATION', 'DECONSTRUCTION', 'CONNECTION'];
let cloud, current = 0, target = 0, phase = -1, active = true, hidden = document.hidden;
let paused = false, reduced = reducedQuery.matches, raf = 0, last = 0, time = 0, burst = 0;
const pointer = [0, 0], pointerTarget = [0, 0];
root.classList.add('enhanced');

function fallback() {
  try {
    const replacement = canvas.cloneNode(); canvas.replaceWith(replacement); canvas = replacement;
    cloud = new CanvasCloud(canvas, { count: innerWidth < 760 ? 430 : 850 });
    root.dataset.renderer = 'canvas'; cloud.render({ progress: current }); scene.classList.add('is-ready');
  } catch {
    root.classList.add('no-webgl'); scene.classList.remove('is-ready');
    scatterButton.disabled = true; motionButton.disabled = true;
  }
}
try {
  cloud = new TokenCloud(canvas, { count: innerWidth < 760 ? 800 : 1450, onFailure: fallback });
  cloud.render(); root.dataset.renderer = 'webgl'; scene.classList.add('is-ready');
} catch (error) { fallback(); }

function readProgress() {
  const rect = experience.getBoundingClientRect();
  const travel = Math.max(1, experience.offsetHeight - document.querySelector('.story-stage').offsetHeight);
  target = clamp(-rect.top / travel);
}
function updatePanels(progress) {
  const next = phaseAt(progress);
  if (next !== phase) {
    phase = next; root.dataset.phase = String(phase);
    panels.forEach((panel, index) => {
      const visible = index === phase;
      panel.classList.toggle('is-active', visible);
      panel.setAttribute('aria-hidden', String(!visible)); panel.inert = !visible;
      panel.style.opacity = visible ? '1' : '0';
      panel.style.visibility = visible ? 'visible' : 'hidden';
      panel.style.pointerEvents = visible ? 'auto' : 'none';
    });
    document.querySelector('#phase-number').textContent = String(phase + 1).padStart(2, '0');
    document.querySelector('#phase-name').textContent = names[phase];
    if (cloud && !cloud.lost) cloud.resize();
  }
  if (!reduced && !paused) {
    const start = [0, .29, .7][phase], end = [.29, .7, 1.18][phase];
    const local = (progress - start) / (end - start);
    const opacity = phase === 0 ? clamp((1 - local) * 5) : Math.min(clamp(local * 7), clamp((1 - local) * 7));
    panels[phase].style.opacity = String(Math.max(.04, opacity));
    panels[phase].style.transform = `translateY(${(1 - opacity) * 18}px)`;
  } else { panels[phase].style.opacity = '1'; panels[phase].style.transform = 'none'; }
  document.querySelector('#phase-progress').style.width = `${progress * 100}%`;
  document.querySelector('#coordinate').textContent = progress.toFixed(3);
}
function requestFrame() { if (!raf && !hidden) raf = requestAnimationFrame(frame); }
function frame(timestamp) {
  raf = 0;
  if (root.dataset.renderer === 'canvas' && timestamp - last < 32 && !reduced && !paused) { requestFrame(); return; }
  const dt = Math.min(.06, last ? (timestamp - last) / 1000 : .016); last = timestamp;
  const shouldAnimate = !paused && !reduced && active && !hidden;
  current += (target - current) * (shouldAnimate ? 1 - Math.exp(-dt * 10) : 1);
  if (Math.abs(target - current) < .00005) current = target;
  if (shouldAnimate) {
    time += dt;
    for (let i = 0; i < 2; i++) pointer[i] += (pointerTarget[i] - pointer[i]) * (1 - Math.exp(-dt * 5));
    burst *= Math.exp(-dt * 2.5);
  }
  updatePanels(current);
  if (cloud && !cloud.lost && active) cloud.render({ progress: current, time, pointer, burst, reduced: reduced || paused });
  if (shouldAnimate || Math.abs(current - target) > .00005) requestFrame();
}
function syncMotion() {
  root.dataset.motion = reduced ? 'reduced' : paused ? 'paused' : 'running';
  const stopped = paused || reduced;
  motionButton.setAttribute('aria-pressed', String(stopped));
  motionButton.setAttribute('aria-label', reduced ? '系统已启用减少动态效果' : stopped ? '恢复动态' : '暂停动态');
  motionButton.title = motionButton.getAttribute('aria-label');
  document.querySelector('#motion-icon').textContent = stopped ? '▷' : 'Ⅱ';
  scatterButton.disabled = reduced || paused || !cloud || cloud.lost;
  motionButton.disabled = reduced || !cloud || cloud.lost;
  last = 0; requestFrame();
}
motionButton.addEventListener('click', () => { if (reduced) return; paused = !paused; syncMotion(); });
scatterButton.addEventListener('click', () => { if (!paused && !reduced) { burst = 1.4; requestFrame(); } });
reducedQuery.addEventListener('change', event => { reduced = event.matches; syncMotion(); });
window.addEventListener('scroll', () => { readProgress(); requestFrame(); }, { passive: true });
window.addEventListener('resize', () => { readProgress(); if (cloud && !cloud.lost) cloud.resize(); requestFrame(); }, { passive: true });
window.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || reduced || paused || !active) return;
  pointerTarget[0] = (event.clientX / innerWidth - .5) * 2;
  pointerTarget[1] = (event.clientY / innerHeight - .5) * 2;
}, { passive: true });
document.addEventListener('pointerleave', () => { pointerTarget[0] = pointerTarget[1] = 0; });
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden; last = 0;
  if (hidden) { cancelAnimationFrame(raf); raf = 0; } else { readProgress(); requestFrame(); }
});
const observer = new IntersectionObserver(entries => {
  active = entries[0].isIntersecting;
  if (active) { last = 0; requestFrame(); }
}, { threshold: 0 });
observer.observe(experience);

// The About anchor represents a point on the native scroll timeline, not the pinned panel's DOM offset.
function navigateAbout(behavior = 'smooth') {
  const travel = experience.offsetHeight - document.querySelector('.story-stage').offsetHeight;
  window.scrollTo({ top: experience.offsetTop + travel * .46, behavior: reduced ? 'instant' : behavior });
}
document.querySelectorAll('a[href="#about"]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault(); history.pushState(null, '', '#about'); navigateAbout();
}));
window.addEventListener('hashchange', () => { if (location.hash === '#about') navigateAbout('instant'); });
if (location.hash === '#about') requestAnimationFrame(() => navigateAbout('instant'));

const email = 'lightjunction.me@gmail.com';
document.querySelector('#copy-email').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(email); status.textContent = '邮箱已复制。';
  } catch {
    status.textContent = `请长按或选中复制：${email}`;
  }
});
window.addEventListener('pagehide', event => {
  cancelAnimationFrame(raf); raf = 0;
  // Back-forward cache keeps this document alive; do not discard its GPU resources.
  if (!event.persisted) { observer.disconnect(); cloud?.destroy(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) { hidden = false; last = 0; readProgress(); requestFrame(); } });
readProgress(); syncMotion(); updatePanels(target); requestFrame();
