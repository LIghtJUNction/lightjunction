import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const svg = readFileSync(new URL('../public/readme-hero.svg', import.meta.url), 'utf8');
// Parse attributes independently of their order; missing particles must never pass vacuously.
const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
);
const pixels = [...svg.matchAll(/<rect\b[^>]*\/>/g)]
  .map(([tag]) => attributes(tag))
  .filter((attrs) => (attrs.class ?? '').split(/\s+/).includes('p'))
  .map((attrs) => {
    const vars = Object.fromEntries([...attrs.style.matchAll(/--([xyuvd]):(-?[\d.]+)(px|s)/g)]
      .map(([, key, value, unit]) => {
        assert.equal(unit, key === 'd' ? 's' : 'px');
        return [key, Number(value)];
      }));
    for (const key of ['x', 'y', 'u', 'v', 'd']) assert.ok(Number.isFinite(vars[key]), key);
    assert.equal(attrs.width, '10');
    assert.equal(attrs.height, '10');
    return { ...vars, homeX: Number(attrs.x), homeY: Number(attrs.y) };
  });

// Approved 5x9 bitmap rows. The two t glyphs now have a full-width crossbar.
const glyphs = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111', '00000', '00000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111', '00000', '00000'],
  g: ['00000', '00000', '01111', '10001', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001', '00000', '00000'],
  t: ['00100', '00100', '11111', '00100', '00100', '00100', '00011', '00000', '00000'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100', '00000', '00000'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110', '00000', '00000'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001', '00000', '00000'],
  c: ['00000', '00000', '01111', '10000', '10000', '10000', '01111', '00000', '00000'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110', '00000', '00000'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110', '00000', '00000'],
  n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001', '00000', '00000'],
};

test('the vector pixels spell LIghtJUNction exactly, with no duplicate cells', () => {
  const expected = [];
  [...'LIghtJUNction'].forEach((letter, index) => {
    glyphs[letter].forEach((row, y) => {
      [...row].forEach((bit, x) => {
        if (bit === '1') expected.push([63 + index * 84 + x * 14, 166 + y * 14]);
      });
    });
  });
  assert.equal(pixels.length, 172);
  assert.deepEqual(pixels.map(({ homeX, homeY }) => [homeX, homeY]), expected);
  assert.equal(new Set(pixels.map(({ homeX, homeY }) => `${homeX},${homeY}`)).size, pixels.length);
});

test('the image is accessible, lightweight and self-contained', () => {
  assert.match(svg, /viewBox="0 0 1200 460"/);
  assert.match(svg, /role="img" aria-labelledby="title desc"/);
  assert.match(svg, /<title id="title">LIghtJUNction — Co-founder of api\.lmm\.best<\/title>/);
  assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
  assert.ok(Buffer.byteLength(svg) < 32 * 1024);
  // Small identity labels use system text; the animated wordmark stays vector pixels.
  assert.doesNotMatch(svg, /<(?:script|foreignObject|image|filter|animate|set)\b/i);
  assert.doesNotMatch(svg, /(?:href|src)\s*=|\bon\w+\s*=|@import|@font-face|data:image/i);
  for (const [, target] of svg.matchAll(/url\(([^)]+)\)/g)) {
    assert.match(target, /^#[\w-]+$/);
    assert.ok(svg.includes(`id="${target.slice(1)}"`));
  }
});

test('all effects share the same infinite period and a complete opening/closing hold', () => {
  const animations = [...svg.matchAll(/animation:\s*([^;]+);/g)]
    .map(([, declaration]) => declaration).filter((value) => value !== 'none');
  assert.equal(animations.length, 3);
  for (const value of animations) assert.match(value, /^[\w-]+ 16s [^;]*infinite$/);
  assert.match(svg, /0%,22%,82%,100% \{ transform: translate\(0,0\) scale\(1\); opacity: 1; \}/);
  assert.match(svg, /0%,27%,76%,100% \{ opacity: 0; \}/);
  assert.match(svg, /0%,22% \{ stroke-dashoffset: 1040; opacity: 0; \}/);
  assert.match(svg, /78%,100% \{ stroke-dashoffset: 0; opacity: 0; \}/);
  assert.equal(pixels.length, 172);
  for (const { d } of pixels) assert.ok(d <= 0 && -d < 16 * .22);
});

test('every trajectory stays in the wordmark area, clear of the persistent identity', () => {
  assert.equal(pixels.length, 172);
  for (const { homeX, homeY, x, y, u, v } of pixels) {
    // These correspond to every flow keyframe, including both drifting-cloud poses.
    // Scale is <= 1 and the cubic-bezier y controls are within [0,1], so no overshoot.
    const offsets = [[0, 0], [x * .3, y * .5], [x, y], [u, v], [x * .22, y * .12]];
    for (const [ox, oy] of offsets) {
      assert.ok(homeX + ox >= 40 && homeX + ox + 10 <= 1160, `horizontal clipping at ${homeX},${homeY}`);
      assert.ok(homeY + oy >= 99 && homeY + oy + 10 <= 307, `identity overlap at ${homeX},${homeY}`);
    }
  }
  assert.match(svg, /33% \{ transform: translate\(calc\(var\(--x\)\*\.3\),calc\(var\(--y\)\*\.5\)\) scale\(\.86\)/);
  assert.match(svg, /44% \{ transform: translate\(var\(--x\),var\(--y\)\) scale\(\.52\)/);
  assert.match(svg, /58% \{ transform: translate\(var\(--u\),var\(--v\)\) scale\(\.64\)/);
  assert.match(svg, /70% \{ transform: translate\(calc\(var\(--x\)\*\.22\),calc\(var\(--y\)\*\.12\)\) scale\(\.88\)/);
});

test('reduced motion disables every effect and leaves the complete wordmark', () => {
  const reduced = svg.split('@media (prefers-reduced-motion: reduce)')[1]?.split('</style>')[0];
  assert.ok(reduced, 'reduced-motion override is required');
  assert.match(reduced, /\.p,\.cloud,\.signal \{ animation: none; \}/);
  assert.match(reduced, /\.p \{ transform: none; opacity: 1; \}/);
  assert.match(reduced, /\.cloud,\.signal \{ display: none; \}/);
});
