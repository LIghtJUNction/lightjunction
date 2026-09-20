import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AGE_RECIPIENT, GPG_FINGERPRINT } from '../src/public-key.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('downloadable age recipient matches the browser encryption key', () => {
    // A plain, newline-terminated recipient file works directly with age -R.
    assert.equal(read('../public/age-recipients.txt'), `${AGE_RECIPIENT}\n`);
});

test('English and Chinese contact instructions publish the configured age key', () => {
    for (const path of ['../README.md', '../README.zh.md']) {
        const markdown = read(path);
        assert.ok(markdown.includes(`\n${AGE_RECIPIENT}\n`), path);
        assert.ok(markdown.includes('(public/age-recipients.txt)'), path);
        assert.ok(markdown.includes('age -R age-recipients.txt -o message.txt.age message.txt'), path);
    }
});

test('terminal contact reuses shared public keys instead of hardcoded copies', () => {
    const terminal = read('../src/terminal.ts');
    assert.ok(!terminal.includes(AGE_RECIPIENT));
    assert.ok(!terminal.includes(GPG_FINGERPRINT));
    assert.ok(terminal.includes('escapeHtml(AGE_RECIPIENT)'));
    assert.ok(terminal.includes('escapeHtml(GPG_FINGERPRINT)'));
    assert.ok(terminal.includes('navigator.clipboard.writeText(AGE_RECIPIENT)'));
});
