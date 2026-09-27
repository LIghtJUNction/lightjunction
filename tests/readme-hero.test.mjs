import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const svg = readFileSync(new URL('../public/readme-hero.svg', import.meta.url), 'utf8');
const pixels = [...svg.matchAll(/<rect width="9" height="9" class="p ([abcd])" x="([\d.]+)" y="([\d.]+)" style="--x:(-?[\d.]+)px;--y:(-?[\d.]+)px;--d:-([\d.]+)s"\/>/g)]
  .map(([, group, x, y, dx, dy, delay]) => ({ group, x: +x, y: +y, dx: +dx, dy: +dy, delay: +delay }));

// Original 5x9 bitmap rows; this catches changed casing, missing pixels and duplicate cells.
const glyphs = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111', '00000', '00000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111', '00000', '00000'],
  g: ['00000', '00000', '01111', '10001', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001', '00000', '00000'],
  t: ['00100', '00100', '11110', '00100', '00100', '00100', '00011', '00000', '00000'],
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
        if (bit === '1') expected.push([177.5 + index * 66 + x * 11, 168 + y * 11]);
      });
    });
  });
  assert.equal(pixels.length, 170);
  assert.deepEqual(pixels.map(({ x, y }) => [x, y]), expected);
  assert.equal(new Set(pixels.map(({ x, y }) => `${x},${y}`)).size, pixels.length);
});

test('the image is accessible, lightweight and self-contained', () => {
  assert.match(svg, /viewBox="0 0 1200 430"/);
  assert.match(svg, /role="img" aria-labelledby="title desc"/);
  assert.match(svg, /<title id="title">LIghtJUNction<\/title>/);
  assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
  assert.ok(Buffer.byteLength(svg) < 32 * 1024);
  assert.doesNotMatch(svg, /<(?:script|foreignObject|image|text|animate|set)\b/i);
  assert.doesNotMatch(svg, /(?:href|src)\s*=|\bon\w+\s*=|@import|@font-face|data:image/i);
  for (const [, target] of svg.matchAll(/url\(([^)]+)\)/g)) {
    assert.match(target, /^#[\w-]+$/);
    assert.ok(svg.includes(`id="${target.slice(1)}"`));
  }
});

test('all effects share the same infinite period and a complete opening/closing hold', () => {
  assert.equal([...svg.matchAll(/animation: [\w-]+ 14s [^;]*infinite;/g)].length, 3);
  assert.match(svg, /0%,18%,82%,100% \{ transform: translate\(0,0\) scale\(1\); opacity: 1; \}/);
  assert.match(svg, /0%,25%,76%,100% \{ opacity: 0; \}/);
  assert.match(svg, /0%,18%,82%,100% \{ opacity: \.72; transform: scale\(1\); \}/);
  for (const { delay } of pixels) assert.ok(delay >= 0 && delay < 14 * .18);
});

test('every trajectory stays inside the canvas, including cloud drift and recall', () => {
  const drift = { a: [28, -16], b: [-24, 20], c: [18, 26], d: [-34, -12] };
  for (const { group, x, y, dx, dy } of pixels) {
    const [a, b] = drift[group];
    // Scale is never greater than one. Convex easing stays between these keyframes.
    const offsets = [[0, 0], [dx * .34, dy * .48], [dx, dy], [dx + a, dy + b], [dx * .36, dy * -.24]];
    for (const [ox, oy] of offsets) {
      assert.ok(x + ox >= 24 && x + ox + 9 <= 1176, `horizontal clipping at ${x},${y}`);
      assert.ok(y + oy >= 24 && y + oy + 9 <= 406, `vertical clipping at ${x},${y}`);
    }
  }
});

test('reduced motion disables every effect and leaves the complete wordmark', () => {
  assert.match(svg, /@media \(prefers-reduced-motion: reduce\)\s*\{/);
  assert.match(svg, /\.p,\.echo,\.seed \{ animation: none; \}/);
  assert.match(svg, /\.p \{ transform: none; opacity: 1; \}/);
  assert.match(svg, /\.echo \{ display: none; \}/);
});
