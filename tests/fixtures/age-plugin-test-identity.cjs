#!/usr/bin/env node
// Test-only PIV software identity. The reference age CLI handles the file format;
// Node/OpenSSL independently unwraps the browser's PIV-P256 recipient stanza.
const assert = require('node:assert/strict');
const { createDecipheriv, createECDH, createHash, hkdfSync } = require('node:crypto');
const { createInterface } = require('node:readline');

async function main() {
    assert.equal(process.argv[2], '--age-plugin=identity-v1');
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(process.env.LIGHTJUNCTION_TEST_PIV_KEY, 'hex'));
    const publicKey = ecdh.getPublicKey(undefined, 'compressed');
    const tag = createHash('sha256').update(publicKey).digest().subarray(0, 4)
        .toString('base64').replace(/=+$/, '');
    const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    const lines = input[Symbol.asyncIterator]();
    async function line() {
        const next = await lines.next();
        assert.equal(next.done, false, 'unexpected end of plugin protocol');
        return next.value;
    }
    async function stanza() {
        const first = await line();
        assert.ok(first.startsWith('-> '), 'invalid plugin command');
        const body = [];
        let part;
        do {
            part = await line();
            body.push(part);
        } while (part.length === 64);
        return { args: first.slice(3).split(' '), body: Buffer.from(body.join(''), 'base64') };
    }
    const matches = [];
    for (;;) {
        const command = await stanza();
        const [name, index, type, keyTag, ephemeral] = command.args;
        if (name === 'done') break;
        if (name === 'recipient-stanza' && type === 'piv-p256' && keyTag === tag) {
            assert.equal(command.args.length, 5);
            assert.equal(command.body.length, 32);
            const share = Buffer.from(ephemeral, 'base64');
            assert.equal(share.length, 33);
            const key = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(share),
                Buffer.concat([share, publicKey]), 'piv-p256', 32));
            const decipher = createDecipheriv('chacha20-poly1305', key, Buffer.alloc(12),
                { authTagLength: 16 });
            decipher.setAuthTag(command.body.subarray(16));
            const fileKey = Buffer.concat([decipher.update(command.body.subarray(0, 16)),
                decipher.final()]);
            matches.push({ index, fileKey });
        }
    }
    for (const { index, fileKey } of matches) {
        process.stdout.write(`-> file-key ${index}\n${fileKey.toString('base64').replace(/=+$/, '')}\n`);
        assert.deepEqual((await stanza()).args, ['ok']);
    }
    process.stdout.write('-> done\n\n');
    input.close();
    process.stdin.destroy();
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
    process.stdin.destroy();
});
