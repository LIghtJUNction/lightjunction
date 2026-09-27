import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIONS, PROJECTS, SAVE_KEY, freshSave, readSave, persist, routeFromHash, createWorld, travel, tick, pulse, visit, distance, createCircuit, rotateCircuit, circuitSolved, repair, collectMemory } from '../src/junction/world.mjs';
const advance=(world,n=60,input={})=>{for(let i=0;i<n;i++)tick(world,1/60,input);};
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
test('every section is an addressable place, with legacy deep links mapped deliberately',()=>{
  assert.equal(STATIONS.length,8);assert.equal(new Set(STATIONS.map(s=>s.id)).size,8);
  for(const station of STATIONS)assert.equal(routeFromHash('#'+station.id),station.id);
  for(const [hash,id] of [['#top','about'],['#language','about'],['#model','about'],['#principles','about'],['#workbench','terminal'],['#projects','work'],['#explore','home']])assert.equal(routeFromHash(hash),id);
  for(const hash of ['#unknown','#constructor','#__proto__','#toString','#%ZZ',''])assert.equal(routeFromHash(hash),'home');
});
test('empty progress never locks travel or content',()=>{
  for(const station of STATIONS){const w=createWorld();assert.ok(travel(w,station.id,true));assert.ok(distance(w.player,station)<6);assert.deepEqual(w.save.repaired,[]);assert.deepEqual(w.save.collected,[]);}
});
test('keyboard movement is normalized, bounded, and finite after invalid input',()=>{
  const a=createWorld(),b=createWorld();advance(a,60,{x:1,z:0});advance(b,60,{x:1,z:1});assert.ok(Math.abs(distance(a.player,{x:0,z:5})-distance(b.player,{x:0,z:5}))<1e-8);
  tick(a,NaN,{x:Infinity,z:NaN});assert.ok(Number.isFinite(a.player.x));assert.ok(Number.isFinite(a.player.z));
  advance(a,1000,{x:1,z:1});assert.equal(a.player.x,43);assert.equal(a.player.z,37);
});
test('long frames are clamped and manual movement cancels auto travel',()=>{
  const w=createWorld();tick(w,30,{x:1,z:0});assert.equal(w.time,.05);assert.ok(w.player.x<=.45);
  travel(w,'work');assert.ok(w.target);tick(w,1/60,{z:1});assert.equal(w.target,null);
});
test('automatic routes reach their facilities without overshooting',()=>{
  for(const station of STATIONS){const w=createWorld();travel(w,station.id);advance(w,1000);assert.equal(w.target,null);assert.equal(w.nearest,station.id);assert.ok(w.save.visited.includes(station.id));}
});
test('unknown destinations do not change state; visits are idempotent',()=>{
  const w=createWorld(),initial=structuredClone(w);assert.equal(travel(w,'missing'),false);assert.equal(visit(w,'missing'),false);assert.deepEqual(w,initial);visit(w,'work');visit(w,'work');assert.deepEqual(w.save.visited,['work']);
});
test('42 uniquely identified shards can each be collected only once',()=>{
  const w=createWorld();assert.equal(new Set(w.shards.map(s=>s.id)).size,42);
  for(const shard of w.shards){w.player.x=shard.x;w.player.z=shard.z;tick(w,1/60);}assert.equal(w.save.collected.length,42);advance(w,300);assert.equal(w.save.collected.length,42);
});
test('scan extends collection radius with a cooldown, without altering real balances',()=>{
  const w=createWorld();w.shards=[{id:0,x:3,z:5}];tick(w,0);assert.equal(w.save.collected.length,0);assert.ok(pulse(w));assert.equal(pulse(w),false);tick(w,1/60);assert.deepEqual(w.save.collected,[0]);advance(w,60);assert.ok(pulse(w));assert.equal('balance' in w.save,false);
});
test('every project circuit is solvable using only rotations',()=>{
  for(let p=0;p<PROJECTS.length;p++){const c=createCircuit(p);assert.equal(circuitSolved(c),false);for(let i=0;i<4;i++)for(let j=0;j<c.target[i];j++)rotateCircuit(c,i);assert.ok(circuitSolved(c));const before=structuredClone(c);rotateCircuit(c,-1);rotateCircuit(c,9);assert.deepEqual(c,before);}
});
test('project repairs and memories grant once and reject unknown IDs',()=>{
  const w=createWorld();for(const p of PROJECTS){assert.ok(repair(w,p.id));assert.equal(repair(w,p.id),false);}assert.equal(repair(w,'fake'),false);for(let i=0;i<3;i++){assert.ok(collectMemory(w,i));assert.equal(collectMemory(w,i),false);}assert.equal(collectMemory(w,3),false);
});
test('a round-trip persists exploration but never message text, circuits or input',()=>{
  const storage=memory(),w=createWorld();travel(w,'about',true);collectMemory(w,1);repair(w,'LightFlow');assert.ok(persist(storage,w.save));assert.deepEqual(readSave(storage),w.save);assert.equal(storage.getItem('token-frontier.record'),undefined);assert.ok(storage.getItem(SAVE_KEY));
});
test('corrupt, unavailable and denied storage retain a usable world',()=>{
  for(const value of ['null','[]','broken','{"version":2}'])assert.deepEqual(readSave({getItem:()=>value}),freshSave());
  const denied={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};assert.deepEqual(readSave(denied),freshSave());assert.equal(persist(denied,freshSave()),false);assert.equal(persist(undefined,freshSave()),false);
});
test('save parser validates types, deduplicates IDs and discards foreign fields',()=>{
  const s=readSave({getItem:()=>JSON.stringify({version:1,visited:['work','work','constructor'],collected:[0,0,-1,42,'1'],repaired:['LightFlow','fake'],memories:[0,2,99,'1'],muted:'false',reducedMotion:1,plaintext:'must not persist'})});
  assert.deepEqual(s.visited,['work']);assert.deepEqual(s.collected,[0]);assert.deepEqual(s.repaired,['LightFlow']);assert.deepEqual(s.memories,[0,2]);assert.equal(s.muted,true);assert.equal(s.reducedMotion,false);assert.equal('plaintext' in s,false);
});
