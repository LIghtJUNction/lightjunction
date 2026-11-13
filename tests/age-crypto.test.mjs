import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createECDH, createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { bech32 } from '@scure/base';
import { Decrypter } from 'age-encryption';
import { encryptAge } from '../src/age-crypto.ts';
import { AGE_RECIPIENT, GPG_PUBLIC_KEY, GPG_FINGERPRINT } from '../src/public-key.ts';

function softwareIdentity(t) {
    const directory = mkdtempSync(join(tmpdir(), 'lightjunction-age-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const recipient = bech32.encode('age1yubikey',
        bech32.toWords(ecdh.getPublicKey(undefined, 'compressed')));
    const identity = join(directory, 'identity.txt');
    writeFileSync(identity, bech32.encode('age-plugin-lightjunctiontest-', [0, 4])
        .toUpperCase() + '\n', { mode: 0o600 });
    const plugin = join(directory, 'age-plugin-lightjunctiontest');
    copyFileSync(new URL('./fixtures/age-plugin-test-identity.cjs', import.meta.url), plugin);
    chmodSync(plugin, 0o700);
    return {
        recipient,
        decrypt(input) {
            const result = spawnSync('age', ['-d', '-i', identity], {
                input, timeout: 10000, maxBuffer: 2 * 1024 * 1024,
                env: {
                    ...process.env,
                    PATH: directory + delimiter + process.env.PATH,
                    LIGHTJUNCTION_TEST_PIV_KEY: ecdh.getPrivateKey().toString('hex'),
                },
            });
            assert.ifError(result.error);
            return result;
        },
    };
}

function binaryFile(armored) {
    assert.ok(armored.startsWith('-----BEGIN AGE ENCRYPTED FILE-----\n'));
    assert.ok(armored.endsWith('-----END AGE ENCRYPTED FILE-----\n'));
    const bytes = Buffer.from(armored.split('\n').slice(1, -2).join(''), 'base64');
    const footer = bytes.indexOf('\n--- ');
    assert.ok(footer > 0);
    const payload = bytes.indexOf('\n', footer + 1) + 1;
    assert.ok(payload > footer);
    return { bytes, footer, payload };
}

test('age public key recipient and gpg keys are configured properly', () => {
    assert.equal(AGE_RECIPIENT, 'age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n');
    assert.equal(GPG_FINGERPRINT, 'EB21B83AB1E982DF66F08387A67178405F7736FD');
    assert.ok(GPG_PUBLIC_KEY.includes('BEGIN PGP PUBLIC KEY BLOCK'));
});

for (const length of [0, 1, 42, 65535, 65536, 65537, 131089]) {
    test('reference age CLI decrypts ' + length + ' bytes with a software PIV identity', async (t) => {
        const identity = softwareIdentity(t);
        const plaintext = Buffer.from(Array.from({ length }, (_, i) => i % 251));
        const armored = await encryptAge(identity.recipient, plaintext);
        const result = identity.decrypt(armored);
        assert.equal(result.status, 0, result.stderr.toString());
        assert.deepEqual(result.stdout, plaintext);
        const { bytes, payload } = binaryFile(armored);
        const chunks = Math.max(1, Math.ceil(length / 65536));
        assert.equal(bytes.length - payload, 16 + length + 16 * chunks);
    });
}

test('reference age CLI decrypts UTF-8 text and fresh payload nonces differ', async (t) => {
    const identity = softwareIdentity(t);
    const plaintext = 'Hello, 你好 🌌\n';
    const first = await encryptAge(identity.recipient, plaintext);
    const second = await encryptAge(identity.recipient, plaintext);
    for (const armored of [first, second]) {
        const result = identity.decrypt(armored);
        assert.equal(result.status, 0, result.stderr.toString());
        assert.equal(result.stdout.toString(), plaintext);
    }
    const a = binaryFile(first);
    const b = binaryFile(second);
    assert.notDeepEqual(a.bytes.subarray(a.payload, a.payload + 16),
        b.bytes.subarray(b.payload, b.payload + 16));
});

test('reference age CLI rejects modified headers, nonces, chunks, and truncation', async (t) => {
    const identity = softwareIdentity(t);
    const { bytes, footer, payload } = binaryFile(await encryptAge(identity.recipient,
        Buffer.alloc(2 * 65536 + 17, 0x41)));
    const badMAC = Buffer.from(bytes);
    badMAC[footer + 5] = badMAC[footer + 5] === 65 ? 66 : 65;
    const badNonce = Buffer.from(bytes);
    badNonce[payload] ^= 1;
    const badPayload = Buffer.from(bytes);
    badPayload[badPayload.length - 1] ^= 1;
    const start = payload + 16;
    const chunk = 65536 + 16;
    const reordered = Buffer.concat([bytes.subarray(0, start),
        bytes.subarray(start + chunk, start + 2 * chunk),
        bytes.subarray(start, start + chunk), bytes.subarray(start + 2 * chunk)]);
    const cases = {
        'header MAC': badMAC, nonce: badNonce, 'payload tag': badPayload,
        reordered, truncated: bytes.subarray(0, bytes.length - 1),
        'missing final chunk': bytes.subarray(0, start + 2 * chunk),
        appended: Buffer.concat([bytes, Buffer.of(0)]),
    };
    for (const [name, input] of Object.entries(cases)) {
        const result = identity.decrypt(input);
        assert.equal(result.status, 1, name + ': ' + result.stderr);
        assert.doesNotMatch(result.stderr.toString(), /no identity matched/, name);
    }
});

test('reference age CLI cannot decrypt a different PIV recipient', async (t) => {
    const identity = softwareIdentity(t);
    const result = identity.decrypt(await encryptAge(AGE_RECIPIENT, 'wrong identity'));
    assert.equal(result.status, 1, result.stderr.toString());
    assert.match(result.stderr.toString(), /no identity matched/);
});

test('encryptAge rejects invalid encodings, checksums, prefixes, and curve points', async () => {
    await assert.rejects(() => encryptAge('invalid-recipient', 'test'));
    const last = AGE_RECIPIENT.at(-1);
    await assert.rejects(() => encryptAge(AGE_RECIPIENT.slice(0, -1) +
        (last === 'q' ? 'p' : 'q'), 'test'), /checksum/i);
    const decoded = bech32.decode(AGE_RECIPIENT);
    await assert.rejects(() => encryptAge(bech32.encode('other', decoded.words), 'test'),
        /Expected an age YubiKey/);
    const invalidPoint = Buffer.alloc(33, 0xff);
    invalidPoint[0] = 2;
    await assert.rejects(() => encryptAge(bech32.encode('age1yubikey',
        bech32.toWords(invalidPoint)), 'test'));
});

const vectors = [
    'stream_empty_payload', 'stream_last_chunk_full', 'stream_two_chunks', 'stream_three_chunks',
    'hmac_bad', 'hmac_extra_space', 'stream_no_nonce', 'stream_no_final',
    'stream_two_final_chunks', 'stream_last_chunk_empty',
];
for (const name of vectors) {
    test('official CCTV age vector: ' + name, async () => {
        const fixture = readFileSync(new URL('./fixtures/age-cctv/' + name, import.meta.url));
        const separator = fixture.indexOf('\n\n');
        assert.ok(separator > 0);
        const meta = Object.fromEntries(fixture.subarray(0, separator).toString().split('\n')
            .map((line) => [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)]));
        const body = fixture.subarray(separator + 2);
        const ciphertext = meta.compressed === 'zlib' ? inflateSync(body) : body;
        const decrypter = new Decrypter();
        decrypter.addIdentity(meta.identity);
        if (meta.expect === 'success') {
            const plaintext = await decrypter.decrypt(ciphertext);
            assert.equal(createHash('sha256').update(plaintext).digest('hex'), meta.payload);
        } else {
            assert.ok(['header failure', 'HMAC failure', 'payload failure'].includes(meta.expect));
            await assert.rejects(() => decrypter.decrypt(ciphertext), (error) => {
                assert.doesNotMatch(error.message, /no identity matched/);
                return true;
            });
        }
    });
}
