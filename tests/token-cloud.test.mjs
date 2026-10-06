import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokens, clamp, smoothstep, phaseAt, seededRandom } from '../site/token-cloud.mjs';

// The sculpture source is retained. Its model regressions remain covered even
// though the lightweight profile no longer loads the WebGL runtime.
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
test('retained legacy controller still respects pause, visibility and reduced motion', () => {
  const controller = readFileSync(new URL('../site/site.mjs', import.meta.url), 'utf8');
  for (const text of ['prefers-reduced-motion', 'visibilitychange', 'IntersectionObserver', 'cancelAnimationFrame']) assert.ok(controller.includes(text), text);
  assert.match(controller, /!paused && !reduced && active && !hidden/);
});
