import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { frontierArchive } from '../scripts/frontier-archive.mjs';
const fixture = '<html><head><title>LIghtJUNction | Independent digital assistant</title></head><body><header><nav class="site-nav" aria-label="Story index"><a>About</a><a>Work</a><a>Studies</a><a>Index</a><a>Contact</a></nav></header><main><section id="challenge-two">Original public artifact</section><section id="secure-card"><textarea id="secure-message"></textarea><button id="encrypt-now">Encrypt</button></section></main><script type="module" src="/src/terminal.ts"></script></body></html>';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('archive is a redesigned site surface, not a second untouched landing page',()=>{
  const html=frontierArchive(fixture);
  assert.ok(html.includes('<body class="frontier-archive">'));
  assert.ok(html.includes('基地档案馆 / LIghtJUNction'));
  for(const label of ['无尽防线','基地','项目','研究室','终端','通讯','frontier-codex-button','frontier-record'])assert.ok(html.includes(label));
  assert.ok(html.includes('href="./"'));
});
test('archive integration preserves protected article, composer, and original scripts exactly',()=>{
  const original=fixture.slice(fixture.indexOf('<main>'));
  assert.equal(frontierArchive(fixture).slice(frontierArchive(fixture).indexOf('<main>')),original);
});
test('archive transformation is idempotent and rejects a changed shell instead of silently dropping it',()=>{
  const once=frontierArchive(fixture);assert.equal(frontierArchive(once),once);
  assert.throws(()=>frontierArchive('<html><body><main>unknown template</main></body></html>'),/template changed/);
});
test('archive codex uses the actual economy, unit, enemy and upgrade definitions',()=>{
  const code=read('src/frontier-archive.mjs');
  for(const def of ['TOWERS','UNITS','ENEMIES','UPGRADES','readFrontierRecord'])assert.ok(code.includes(def));
  assert.ok(code.includes("from './token-drift/frontier-world.mjs'"));
  assert.ok(code.includes('dialog.showModal()'));assert.ok(code.includes('dialog.close()'));
  assert.ok(!code.includes('innerHTML'));assert.ok(!code.includes('fetch('));
});
test('shared archive styles cover projects, studies, terminal, exhibits and encrypted contact',()=>{
  const css=read('src/frontier-archive.css');
  for(const name of ['frontier-archive','project-card','shader','terminal','exhibit','secure','contact','prefers-reduced-motion'])assert.ok(css.includes(name),name);
  const config=read('vite.config.ts');assert.ok(config.includes("order: 'pre'"));assert.ok(config.includes('frontierArchive(html)'));assert.ok(config.includes("src: '/src/frontier-archive.mjs'"));
});
const archiveURL=new URL('../archive.html',import.meta.url);
test('the real archive template retains its secure composer and Challenge II across the build transform', {skip:!existsSync(archiveURL)},()=>{
  const original=readFileSync(archiveURL,'utf8'),html=frontierArchive(original);
  for(const id of ['challenge-two','secure-card','secure-message','encrypt-now','result-overlay','exhibit-dialog','btn-contact-message'])assert.ok(html.includes(`id="${id}"`),id);
  const marker='<section class="exhibit-dialog"';
  assert.ok(original.includes(marker));assert.equal(html.slice(html.indexOf(marker)),original.slice(original.indexOf(marker)));
  assert.equal((html.match(/id="frontier-record"/g)||[]).length,1);
});
