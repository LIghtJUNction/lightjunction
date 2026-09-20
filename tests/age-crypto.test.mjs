import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptAge } from '../src/age-crypto.ts';
import { AGE_RECIPIENT, GPG_PUBLIC_KEY, GPG_FINGERPRINT } from '../src/public-key.ts';

test('age public key recipient and gpg keys are configured properly', () => {
    assert.equal(AGE_RECIPIENT, 'age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n');
    assert.equal(GPG_FINGERPRINT, 'EB21B83AB1E982DF66F08387A67178405F7736FD');
    assert.ok(GPG_PUBLIC_KEY.includes('BEGIN PGP PUBLIC KEY BLOCK'));
});

test('encryptAge armor and recipient stanzas parse with the age CLI', async (t) => {
    const message = 'Hello from automated age test!';
    const ciphertext = await encryptAge(AGE_RECIPIENT, message);

    assert.ok(ciphertext.startsWith('-----BEGIN AGE ENCRYPTED FILE-----\n'));
    assert.ok(ciphertext.endsWith('-----END AGE ENCRYPTED FILE-----\n'));

    const directory = mkdtempSync(join(tmpdir(), 'lightjunction-age-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const identity = join(directory, 'identity.txt');
    const keygen = spawnSync('age-keygen', ['-o', identity], {
        encoding: 'utf-8',
        timeout: 5000,
    });
    assert.ifError(keygen.error);
    assert.equal(keygen.status, 0, keygen.stderr);

    // An empty identity file fails before ciphertext parsing. A valid unrelated
    // identity reaches recipient matching without requiring the user's YubiKey.
    // This checks format parsing, not successful decryption or payload integrity.
    const proc = spawnSync('age', ['-d', '-i', identity], {
        input: ciphertext,
        encoding: 'utf-8',
        timeout: 5000,
    });
    assert.ifError(proc.error);
    assert.equal(proc.status, 1, proc.stderr);
    assert.equal(proc.stdout, '');
    assert.match(proc.stderr, /no identity matched/);

    // A malformed file must fail differently, not pass the same identity check.
    const malformed = spawnSync('age', ['-d', '-i', identity], {
        input: 'not an age file\n',
        encoding: 'utf-8',
        timeout: 5000,
    });
    assert.ifError(malformed.error);
    assert.equal(malformed.status, 1, malformed.stderr);
    assert.equal(malformed.stdout, '');
    assert.doesNotMatch(malformed.stderr, /no identity matched|no secret keys found/);
});

test('encryptAge rejects invalid recipient format', async () => {
    await assert.rejects(
        () => encryptAge('invalid-recipient', 'test'),
        /Invalid bech32/
    );
});
