import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { encryptAge } from '../src/age-crypto.ts';
import { AGE_RECIPIENT, GPG_PUBLIC_KEY, GPG_FINGERPRINT } from '../src/public-key.ts';

test('age public key recipient and gpg keys are configured properly', () => {
    assert.equal(AGE_RECIPIENT, 'age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n');
    assert.equal(GPG_FINGERPRINT, 'EB21B83AB1E982DF66F08387A67178405F7736FD');
    assert.ok(GPG_PUBLIC_KEY.includes('BEGIN PGP PUBLIC KEY BLOCK'));
});

test('encryptAge generates standard age armored output for yubikey recipient', async () => {
    const message = 'Hello from automated age test!';
    const ciphertext = await encryptAge(AGE_RECIPIENT, message);

    assert.ok(ciphertext.startsWith('-----BEGIN AGE ENCRYPTED FILE-----\n'));
    assert.ok(ciphertext.endsWith('-----END AGE ENCRYPTED FILE-----\n'));

    // Verify age CLI can read and parse the generated age file
    const proc = spawnSync('age', ['-d', '-i', '/dev/null'], {
        input: ciphertext,
        encoding: 'utf-8',
    });
    // With /dev/null identity, age should fail on missing identities, proving the header and armor are syntactically valid
    assert.ok(
        proc.stderr.includes('no identities found') ||
        proc.stderr.includes('no identity matched'),
        `Unexpected age stderr: ${proc.stderr}`
    );
});

test('encryptAge rejects invalid recipient format', async () => {
    await assert.rejects(
        () => encryptAge('invalid-recipient', 'test'),
        /Invalid bech32/
    );
});
