import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { applyLanguage, readLanguage, copyEmail } from '../site/profile.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('site/profile.css');
const script = read('site/profile.mjs');

test('static profile exposes identity, six real projects, and contact without JS', () => {
  assert.match(html, /<h1\b[^>]*>I'm LightJunction<\/h1>/);
  for (const text of ['msg', 'LMM API', 'CortexFS', 'MagicNet', 'LightFlow', 'OniMods']) {
    assert.ok(html.includes(text), text);
  }
  assert.equal((html.match(/class="list-link(?: project)?"/g) || []).length, 6);
  assert.match(html, /href="mailto:lightjunction\.me@gmail\.com"/);
  assert.doesNotMatch(html, /<canvas\b|<iframe\b|contenteditable=/i);
});

test('new entry points exist and do not load the legacy 3D runtime', () => {
  for (const [, path] of html.matchAll(/(?:src|href)="(\.\/site\/[^"#]+)"/g)) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
  }
  assert.match(html, /src="\.\/site\/profile\.mjs"/);
  assert.doesNotMatch(html, /site\/(?:site|token-cloud)\.(?:mjs|css)/);
  assert.doesNotMatch(script, /requestAnimationFrame|setInterval|fetch\(|https?:\/\//);
  assert.doesNotMatch(css, /@import|@font-face|url\(/);
});

test('every external tab has opener isolation and no placeholder destinations', () => {
  for (const [link] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    assert.match(link, /rel="noopener noreferrer"/);
    assert.match(link, /href="https:\/\//);
  }
  assert.doesNotMatch(html, /example\.com|localhost|href="#"|javascript:/i);
});

test('all fragment links and SVG symbol references resolve to unique IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, fragment] of html.matchAll(/\bhref="#([^"]+)"/g)) {
    assert.ok(ids.includes(fragment), fragment);
  }
  for (const id of ['about', 'work', 'contact', 'workbench']) assert.ok(ids.includes(id));
});

test('public contact downloads and the existing donation destination are retained', () => {
  assert.match(html, /href="\.\/pubkey\.asc" download/);
  assert.match(html, /href="\.\/age-recipients\.txt" download/);
  assert.match(html, /https:\/\/donate\.lmm\.best\/\?project=lightjunction/);
});

test('profile metadata uses its real deployment URL and a light theme', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="theme-color" content="#ffffff">/);
  assert.match(html, /rel="canonical" href="https:\/\/lightjunction\.github\.io\/lightjunction\/"/);
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css, /max-width:\s*576px/);
});

test('responsive layout, reduced motion and visible keyboard focus are explicit', () => {
  assert.match(css, /@media \(max-width: 660px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(html, /class="skip-link" href="#about"/);
  assert.match(html, /id="about"[^>]*tabindex="-1"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
});

test('JS-only controls start hidden while the native disclosure remains usable', () => {
  for (const id of ['language-toggle', 'copy-email']) {
    assert.match(html, new RegExp(`<button[^>]*id="${id}"[^>]*hidden`));
  }
  assert.match(html, /<details[^>]*id="elsewhere"/);
  assert.match(html, /<summary>/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /menu\.querySelector\('summary'\)\.focus\(\)/);
});

test('every translatable element has both languages', () => {
  const tags = [...html.matchAll(/<[^>]*\bdata-(?:en|zh)(?:-label)?="[^>]*>/g)];
  assert.ok(tags.length > 40);
  for (const [tag] of tags) {
    const isLabel = /data-(?:en|zh)-label=/.test(tag);
    assert.match(tag, isLabel ? /data-en-label="[^"]+"/ : /data-en="[^"]+"/);
    assert.match(tag, isLabel ? /data-zh-label="[^"]+"/ : /data-zh="[^"]+"/);
  }
});

test('reading a stored language tolerates unavailable and blocked storage', () => {
  assert.equal(readLanguage(undefined), 'en');
  assert.equal(readLanguage({ getItem: () => 'zh' }), 'zh');
  assert.equal(readLanguage({ getItem: () => 'unknown' }), 'en');
  assert.equal(readLanguage({ getItem: () => { throw new Error('blocked'); } }), 'en');
});

test('language application changes text, document language and accessible names', () => {
  const text = { dataset: { en: 'Projects', zh: '项目' }, textContent: '' };
  const label = { dataset: { enLabel: 'Email', zhLabel: '邮件' }, setAttribute(key, value) { this[key] = value; } };
  const toggle = { setAttribute(key, value) { this[key] = value; } };
  const root = {
    documentElement: {},
    querySelectorAll: selector => selector === '[data-en][data-zh]' ? [text] : [label],
    getElementById: () => toggle,
  };
  assert.equal(applyLanguage(root, 'zh'), 'zh');
  assert.equal(root.documentElement.lang, 'zh-CN');
  assert.equal(text.textContent, '项目');
  assert.equal(label['aria-label'], '邮件');
  assert.equal(toggle.textContent, 'EN');
  assert.equal(applyLanguage(root, 'invalid'), 'en');
  assert.equal(root.documentElement.lang, 'en');
  assert.equal(text.textContent, 'Projects');
  assert.equal(label['aria-label'], 'Email');
  assert.equal(toggle.textContent, '中文');
});

test('clipboard reports success only after the requested email is written', async () => {
  let written;
  const clipboard = { writeText: async value => { written = value; } };
  assert.equal(await copyEmail(clipboard, 'lightjunction.me@gmail.com'), true);
  assert.equal(written, 'lightjunction.me@gmail.com');
});

test('clipboard denial, missing APIs and incomplete implementations return failure', async () => {
  assert.equal(await copyEmail(undefined, 'test'), false);
  assert.equal(await copyEmail({}, 'test'), false);
  assert.equal(await copyEmail({ writeText: async () => { throw new Error('denied'); } }, 'test'), false);
});

test('translations use textContent and async feedback is invalidated on language changes', () => {
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|eval\(/);
  assert.match(script, /version !== feedbackVersion/);
  assert.match(script, /无法自动复制，请选中邮箱手动复制/);
  assert.match(script, /pagehide/);
});
