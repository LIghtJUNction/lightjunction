import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ISLANDS, WORLD_LIMIT, random, createWorld, startWorld, pauseWorld, resumeWorld,
  advance, takeToken, dash, pulse, objective, readRecord, saveRecord } from '../src/token-drift/world.mjs';

const tick = (w, seconds, input) => { for (let i=0;i<Math.round(seconds*60);i++) advance(w,1/60,input); };
const playing = () => { const w=createWorld();startWorld(w);return w; };

test('same seed creates exactly the same world, including enemy positions',()=>{
  assert.deepEqual(createWorld(42),createWorld(42));
  assert.notDeepEqual(createWorld(42).tokens,createWorld(43).tokens);
  const rng=random(23);for(let i=0;i<1000;i++){const n=rng();assert.ok(n>=0&&n<1);}
});
test('all beacons are affordable and all tokens are within the world boundary',()=>{
  const w=createWorld();assert.ok(w.tokens.length>w.beacons.reduce((sum,b)=>sum+b.cost,0));
  for(const t of w.tokens){assert.ok(Math.abs(t.x)<WORLD_LIMIT);assert.ok(Math.abs(t.z)<WORLD_LIMIT);}
  assert.equal(new Set(w.tokens.map(t=>t.id)).size,w.tokens.length);
});
test('the title screen does not advance gameplay or accept abilities',()=>{
  const w=createWorld(), snapshot=structuredClone(w);advance(w,1,{x:1,z:1});
  assert.equal(dash(w),false);assert.equal(pulse(w),false);assert.equal(takeToken(w,w.tokens[0]),false);
  assert.deepEqual(w,snapshot);
});
test('pickup counts once, caps combo at 8, and accumulates score',()=>{
  const w=playing();for(const token of w.tokens.slice(0,12))assert.equal(takeToken(w,token),true);
  assert.equal(w.inventory,12);assert.equal(w.collected,12);assert.equal(w.combo,8);assert.equal(w.maxCombo,8);
  const score=w.score;assert.equal(takeToken(w,w.tokens[0]),false);assert.equal(w.score,score);assert.equal(w.inventory,12);
});
test('movement is normalized, finite, bounded, and independent of token animation',()=>{
  const a=playing(),b=playing();a.tokens=[];b.tokens=[];
  tick(a,2,{x:1,z:0});tick(b,2,{x:1,z:1});
  assert.ok(Math.abs(Math.hypot(a.player.x,a.player.z-11)-Math.hypot(b.player.x,b.player.z-11))<.001);
  tick(a,20,{x:1,z:0});assert.equal(a.player.x,WORLD_LIMIT);
  advance(a,NaN,{x:NaN,z:Infinity});assert.ok(Number.isFinite(a.player.x));
  const t=a.time;advance(a,99);assert.ok(a.time-t<=.051);
});
test('combo expires and restarts at one',()=>{
  const w=playing();takeToken(w,w.tokens[20]);w.player.x=33;w.player.z=33;
  tick(w,3.1);assert.equal(w.combo,0);takeToken(w,w.tokens[21]);assert.equal(w.combo,1);
});
test('pausing freezes all simulation and resuming continues',()=>{
  const w=playing();tick(w,.2);pauseWorld(w);const snapshot=structuredClone(w);
  tick(w,8,{x:1,z:1});assert.equal(dash(w),false);assert.equal(pulse(w),false);assert.deepEqual(w,snapshot);
  resumeWorld(w);tick(w,.2,{x:1,z:0});assert.ok(w.time>snapshot.time);
});
test('dash has a cooldown and grants temporary collision immunity',()=>{
  const w=playing();assert.equal(dash(w,{x:1,z:0}),true);assert.equal(dash(w),false);
  assert.ok(w.player.invulnerable>0);const x=w.player.x;tick(w,.2);assert.ok(w.player.x-x>4);
  tick(w,1.2);assert.equal(dash(w),true);
});
test('pulse attracts distant tokens and cannot be spammed',()=>{
  const w=playing();w.tokens=[{id:0,x:w.player.x+6,z:w.player.z,phase:0,taken:false}];
  assert.equal(pulse(w),true);assert.equal(pulse(w),false);tick(w,.5);assert.equal(w.inventory,1);
  tick(w,5.1);assert.equal(pulse(w),true);
});
test('red noise harms once during the invulnerability window',()=>{
  const w=playing(),e=w.enemies[0];e.speed=0;w.player.x=e.x;w.player.z=e.z;w.tokens=[];
  tick(w,.05);assert.equal(w.player.hp,2);tick(w,1);assert.equal(w.player.hp,2);
  tick(w,1.1);assert.equal(w.player.hp,1);
});
test('dash destroys noise and awards score rather than taking damage',()=>{
  const w=playing(),e=w.enemies[0];e.speed=0;w.player.x=e.x;w.player.z=e.z;w.tokens=[];
  dash(w,{x:1,z:0});advance(w,1/60);assert.ok(e.dead>0);assert.equal(w.player.hp,3);assert.equal(w.score,50);
});
test('empty inventory does not activate a beacon, exact cost is spent only once',()=>{
  const w=playing(),b=w.beacons[0];w.enemies=[];w.tokens=[];w.player.x=b.x;w.player.z=b.z;
  advance(w,1/60);assert.equal(b.active,false);w.inventory=b.cost;w.player.hp=2;
  advance(w,1/60);assert.equal(b.active,true);assert.equal(w.inventory,0);assert.equal(w.player.hp,3);
  const score=w.score;tick(w,1);assert.equal(w.score,score);
});
test('all three beacons and return home are required; victory score is granted once',()=>{
  const w=playing();w.enemies=[];
  // Use actual collectible supply, not fabricated starting inventory.
  for(const t of w.tokens)takeToken(w,t);
  for(const b of w.beacons){w.player.x=b.x;w.player.z=b.z;advance(w,1/60);}
  assert.equal(w.phase,'playing');assert.ok(w.beacons.every(b=>b.active));assert.equal(objective(w).cost,0);
  w.player.x=ISLANDS[0].x;w.player.z=ISLANDS[0].z;advance(w,1/60);assert.equal(w.phase,'won');
  const score=w.score;tick(w,10);assert.equal(w.score,score);
});
test('depleted shield ends the run and a new world clears all runtime state',()=>{
  const w=playing(),e=w.enemies[0];w.player.hp=1;w.player.x=e.x;w.player.z=e.z;advance(w,1/60);
  assert.equal(w.phase,'lost');const fresh=createWorld();assert.equal(fresh.player.hp,3);assert.equal(fresh.collected,0);
  assert.ok(fresh.tokens.every(t=>!t.taken));assert.ok(fresh.beacons.every(b=>!b.active));
});
test('missing, corrupt, denied and malicious storage values are safe',()=>{
  assert.deepEqual(readRecord(null),{best:0,wins:0});
  for(const value of ['broken','null','[]','{"best":-1,"wins":"9"}'])assert.deepEqual(readRecord({getItem:()=>value}),{best:0,wins:0});
  const w=playing();w.score=50;assert.equal(saveRecord(null,{best:10,wins:0},w).best,50);
  const local={};const storage={getItem:k=>local[k],setItem:(k,v)=>local[k]=v};w.phase='won';
  saveRecord(storage,{best:10,wins:0},w);assert.deepEqual(readRecord(storage),{best:50,wins:1});
});
test('game entry is local, accessible, and points to the preserved archive',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const id of ['voxel-world','start-button','pause-button','resume-button','joystick','dash-button','pulse-button','help-dialog','fallback'])assert.ok(ids.includes(id));
  assert.ok(html.includes('./archive.html'));assert.ok(html.includes('<noscript>'));assert.ok(html.includes('aria-live="polite"'));
  assert.ok(!/<script[^>]*src="https?:/.test(html));
  const config=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');assert.ok(config.includes("archive: 'archive.html'"));
});
