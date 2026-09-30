import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createTokens, clamp, smoothstep, phaseAt, seededRandom } from '../site/token-cloud.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html'), controller = read('site/site.mjs'), config = read('vite.config.ts');

test('seeded model is reproducible and differs for different seeds', () => {
  assert.deepEqual(createTokens(200), createTokens(200));
  assert.notDeepEqual(createTokens(200, 1), createTokens(200, 2));
  const r = seededRandom(3); for (let i=0;i<1000;i++) assert.ok(r() >= 0 && r() < 1);
});
test('all three morph targets and instance attributes are finite', () => {
  for (const count of [1,430,800,1450]) { const mesh=createTokens(count); assert.equal(mesh.length,count*13); assert.ok(mesh.every(Number.isFinite)); }
});
test('invalid particle budgets are rejected', () => {
  for (const count of [-1,0,1.1,10001,NaN]) assert.throws(()=>createTokens(count),RangeError);
});
test('explosion has five bounded, separated strata', () => {
  const data=createTokens(1450), layers=new Set();
  for (let i=0;i<1450;i++) { const y=data[i*13+4]; const layer=Math.round(y/.94);layers.add(layer);assert.ok(Math.abs(y-layer*.94)<.081); }
  assert.deepEqual([...layers].sort(),[-1,-2,0,1,2].sort());
});
test('LJ letters have an actual horizontal separation', () => {
  const data=createTokens(1000); let left=0,right=0;
  for(let i=0;i<1000;i++){ const x=data[i*13+6],y=data[i*13+7];assert.ok(x<=-.399 || x>=0);assert.ok(y>=-1.36 && y<=1.36);x<0?left++:right++; }
  assert.ok(left>200 && right>200);
});
test('scroll interpolation is bounded and continuous', () => {
  assert.equal(clamp(-1),0);assert.equal(clamp(2),1);assert.equal(smoothstep(.1,.9,-3),0);assert.equal(smoothstep(.1,.9,3),1);
  assert.ok(Math.abs(smoothstep(.1,.9,.5)-.5)<1e-10);
  assert.equal(phaseAt(0),0);assert.equal(phaseAt(.29),1);assert.equal(phaseAt(.7),2);assert.equal(phaseAt(1),2);
});
test('one entry point excludes old multipage site and public-directory copies', () => {
  assert.match(config,/publicDir:\s*false/);assert.match(config,/input:\s*'index\.html'/);
  assert.doesNotMatch(config,/junctionPage|battlefieldChrome|archive:\s|frontier:\s|rogue:\s/);
  assert.doesNotMatch(html,/(?:href|src)=["'][^"']*(?:archive|frontier|rogue)\.html/);
});
test('static HTML exposes identity, real projects and contact without JavaScript', () => {
  for(const text of ['<h1>','CortexFS','MagicNet','LightFlow','OniMods','mailto:lightjunction.me@gmail.com']) assert.ok(html.includes(text));
  assert.equal((html.match(/class="project"/g)||[]).length,4);
  assert.match(html,/<html lang="zh-CN">/);assert.match(html,/rel="canonical"/);
});
test('all local stylesheet and script entry points exist', () => {
  for(const match of html.matchAll(/(?:src|href)="(\.\/site\/[^"#]+)"/g)) assert.ok(existsSync(new URL(`../${match[1]}`,import.meta.url)),match[1]);
  assert.doesNotMatch(controller,/https?:\/\//);
  assert.doesNotMatch(read('site/token-cloud.mjs'),/https?:\/\//);
});
test('external tabs have opener isolation and visible source links', () => {
  for(const link of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(link[0],/rel="noopener noreferrer"/);
  assert.match(html,/class="sources"/);
  assert.doesNotMatch(html,/lightjunction\.com|localhost|example\.com/);
});
test('motion is user-controllable and stops when hidden or offscreen', () => {
  for(const text of ['prefers-reduced-motion','visibilitychange','IntersectionObserver','cancelAnimationFrame','aria-pressed','webgl','CanvasCloud']) assert.ok(controller.includes(text),text);
  assert.match(controller,/!paused && !reduced && active && !hidden/);
  assert.match(html,/id="motion-toggle"[^>]*aria-pressed="false"/);
});
test('clipboard failure is truthful and navigation handles deep links', () => {
  assert.match(controller,/await navigator\.clipboard\.writeText/);
  assert.match(controller,/请长按或选中复制/);
  assert.match(controller,/location\.hash === '#about'/);
  assert.match(controller,/hashchange/);
  assert.match(html,/role="status" aria-live="polite"/);
});
