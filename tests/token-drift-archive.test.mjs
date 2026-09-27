import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSection, junctionPage, battlefieldChrome } from '../scripts/junction-site.mjs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shell='<!doctype html><body><main id="junction"><canvas id="junction-scene"></canvas></main><!-- JUNCTION_ARTIFACTS --><script type="module" src="/src/junction/app.mjs"></script></body>';
const archive='<body><header class="old-nav">Old portfolio</header><main class="story-wall"><section id="model"><section>nested preserved markup</section></section><section id="challenge-two"><img src="/junction-ii.png">Original public artifact</section><section id="shaders"><canvas data-shader-canvas></canvas></section></main><section id="secure-card"><textarea id="secure-message"></textarea><button id="encrypt-now">Encrypt</button></section><section id="result-overlay" aria-hidden="true"><pre id="result-content"></pre></section><script type="module" src="/src/terminal.ts"></script></body>';
test('world transform removes the portfolio shell instead of renaming its navigation',()=>{
  const html=junctionPage(shell,archive);assert.ok(html.includes('id="junction-scene"'));assert.ok(html.includes('/src/junction/app.mjs'));
  for(const old of ['old-nav','Old portfolio','story-wall','/src/terminal.ts','frontier-archive'])assert.ok(!html.includes(old));
});
test('balanced section extraction preserves nested markup byte for byte',()=>{
  assert.equal(extractSection(archive,'model'),'<section id="model"><section>nested preserved markup</section></section>');
  const html=junctionPage(shell,archive);for(const id of ['model','challenge-two','shaders','secure-card','result-overlay'])assert.equal(extractSection(html,id),extractSection(archive,id));
});
test('encryption composer and result live outside the hidden instrument bank',()=>{
  const html=junctionPage(shell,archive),bankEnd=html.indexOf('</div>',html.indexOf('id="station-payloads"'));
  assert.ok(html.indexOf('id="secure-card"')>bankEnd);assert.ok(html.indexOf('id="result-overlay"')>bankEnd);assert.ok(html.includes('id="toast"'));
});
test('transform is idempotent and missing payloads fail visibly at build time',()=>{
  const once=junctionPage(shell,archive);assert.equal(junctionPage(once,archive),once);
  assert.throws(()=>junctionPage('<body></body>',archive),/payload mount/);
  assert.throws(()=>junctionPage(shell,archive.replace('id="shaders"','id="removed"')),/Missing required/);
  assert.throws(()=>extractSection('<section id="shaders">','shaders'),/Unclosed/);
  assert.throws(()=>extractSection(archive,'shaders.*'),/Invalid/);
});
test('battle return navigation changes without modifying simulation mounts',()=>{
  const game='<nav><a href="./rogue.html" aria-current="page">无尽防线</a><a href="./archive.html#contact">通讯</a></nav><canvas id="voxel-world"></canvas><script type="module" src="/src/token-drift/frontier-app.mjs"></script>';
  const html=battlefieldChrome(game);assert.ok(html.includes('href="./#home"'));assert.ok(html.includes('href="./#contact"'));
  assert.equal(html.slice(html.indexOf('<canvas')),game.slice(game.indexOf('<canvas')));
});
test('both website addresses build the same world, and combat has its own stable address',()=>{
  const config=read('vite.config.ts');for(const marker of ["order: 'pre'","file === 'index.html' || file === 'archive.html'",'junctionPage(shell, archive)',"frontier: 'frontier.html'","archive: 'archive.html'"])assert.ok(config.includes(marker),marker);
  const html=read('index.html');for(const id of ['junction-scene','world-dock','station-dialog','map-dialog','settings-dialog','startup-fallback'])assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('<noscript>'));assert.ok(!html.includes('frontier-app.mjs'));assert.ok(!html.includes('story-wall'));
});
test('real protected source survives the shipped transform exactly',()=>{
  const original=read('archive.html'),html=junctionPage(read('index.html'),original);
  for(const id of ['model','challenge-two','shaders','secure-card','result-overlay'])assert.equal(extractSection(html,id),extractSection(original,id));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const marker of ['secure-message','encrypt-now','result-copy','result-github','result-close','data-shader-engine="singularity"','data-shader-engine="ink"','data-shader-engine="fold"','./junction-ii.png'])assert.ok(html.includes(marker),marker);
  assert.equal((html.match(/data-shader-canvas/g)||[]).length,4);assert.ok(!html.includes('/src/terminal.ts'));
});
test('world runtime uses original crypto and shaders lazily, never a hidden portfolio iframe',()=>{
  const code=read('src/junction/app.mjs');for(const marker of ["import('../secure-card.ts')",'initSecureCard',"import('../shader-gallery.ts')",'mountShaderShowcase','returnPayloads','quietClosures','visibilitychange','pointercancel','UPGRADES','readFrontierRecord'])assert.ok(code.includes(marker),marker);
  assert.ok(!code.includes('innerHTML'));assert.ok(!code.includes('iframe'));
  const css=read('src/junction/world.css');for(const marker of ['prefers-reduced-motion','secure-card','shader-gallery','flight-stick','station-dialog'])assert.ok(css.includes(marker));
});
