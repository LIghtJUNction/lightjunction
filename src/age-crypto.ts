import { chacha20poly1305 } from "@noble/ciphers/chacha.js";

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function toBufferSource(bytes: Uint8Array): BufferSource {
    return bytes as unknown as BufferSource;
}

function bech32Decode(bech: string): Uint8Array {
    const pos = bech.lastIndexOf("1");
    if (pos < 1 || pos + 7 > bech.length) {
        throw new Error("Invalid bech32 string");
    }
    const data: number[] = [];
    for (let i = pos + 1; i < bech.length; i++) {
        const char = bech[i];
        if (!char) throw new Error("Missing character");
        const val = CHARSET.indexOf(char);
        if (val === -1) throw new Error(`Invalid bech32 char: ${char}`);
        data.push(val);
    }
    // Exclude 6 checksum characters
    const payload5 = data.slice(0, -6);
    let acc = 0;
    let bits = 0;
    const out: number[] = [];
    for (const v of payload5) {
        acc = (acc << 5) | v;
        bits += 5;
        while (bits >= 8) {
            bits -= 8;
            out.push((acc >> bits) & 0xff);
        }
    }
    return new Uint8Array(out);
}

// NIST P-256 Curve Parameters
const P =
    0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const A = -3n;
const B =
    0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let res = 1n;
    let cur = base % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) res = (res * cur) % mod;
        cur = (cur * cur) % mod;
        e /= 2n;
    }
    return res;
}

function decompressP256(compBytes: Uint8Array): Uint8Array {
    if (compBytes.length !== 33) {
        throw new Error("Expected 33 bytes for compressed P-256 public key");
    }
    const prefix = compBytes[0];
    if (prefix !== 0x02 && prefix !== 0x03) {
        throw new Error("Invalid compressed public key prefix");
    }
    let xHex = "";
    for (let i = 1; i < 33; i++) {
        const b = compBytes[i];
        if (b === undefined) throw new Error("Index out of bounds");
        xHex += b.toString(16).padStart(2, "0");
    }
    const x = BigInt("0x" + xHex);
    const rhs = (modPow(x, 3n, P) + A * x + B) % P;
    // For p = 3 mod 4, sqrt(rhs) = rhs^((p+1)/4) mod p
    let y = modPow(rhs, (P + 1n) / 4n, P);
    if (y % 2n !== BigInt(prefix & 1)) {
        y = (P - y) % P;
    }
    const uncompressed = new Uint8Array(65);
    uncompressed[0] = 0x04;
    uncompressed.set(compBytes.subarray(1), 1);
    const yHex = y.toString(16).padStart(64, "0");
    for (let i = 0; i < 32; i++) {
        uncompressed[33 + i] = parseInt(yHex.slice(i * 2, i * 2 + 2), 16);
    }
    return uncompressed;
}

function base64Unpadded(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b !== undefined) binary += String.fromCharCode(b);
    }
    return btoa(binary).replace(/=+$/, "");
}

function getSubtleCrypto(): SubtleCrypto {
    if (typeof window !== "undefined" && window.crypto?.subtle) {
        return window.crypto.subtle;
    }
    if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
        return globalThis.crypto.subtle;
    }
    throw new Error("SubtleCrypto is not available in this environment");
}

function getRandomValues(array: Uint8Array): Uint8Array {
    const cryptoObj =
        typeof window !== "undefined" && window.crypto
            ? window.crypto
            : globalThis.crypto;
    if (!cryptoObj?.getRandomValues) {
        throw new Error("crypto.getRandomValues is not available");
    }
    (cryptoObj.getRandomValues as (arr: Uint8Array) => Uint8Array)(array);
    return array;
}

/**
 * Encrypt a plaintext message for an age YubiKey PIV-P256 recipient string.
 * Output is standard age ASCII armor compatible with `age -d -i <yubikey-identity>`.
 */
export async function encryptAge(
    recipientString: string,
    plaintext: string | Uint8Array,
): Promise<string> {
    const subtle = getSubtleCrypto();

    const recipientPubComp = bech32Decode(recipientString);
    const recipientPubUncomp = decompressP256(recipientPubComp);

    const recipientKey = await subtle.importKey(
        "raw",
        toBufferSource(recipientPubUncomp),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
    );

    const ephKeyPair = await subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"],
    );
    const ephPubRaw = new Uint8Array(
        await subtle.exportKey("raw", ephKeyPair.publicKey),
    );
    const ephPubComp = new Uint8Array(33);
    const lastByte = ephPubRaw[64];
    if (lastByte === undefined) throw new Error("Invalid ephemeral key length");
    ephPubComp[0] = lastByte % 2 === 0 ? 0x02 : 0x03;
    ephPubComp.set(ephPubRaw.subarray(1, 33), 1);

    const sharedSecretBits = await subtle.deriveBits(
        { name: "ECDH", public: recipientKey },
        ephKeyPair.privateKey,
        256,
    );
    const sharedSecret = new Uint8Array(sharedSecretBits);

    const hashBuffer = await subtle.digest(
        "SHA-256",
        toBufferSource(recipientPubComp),
    );
    const tag = base64Unpadded(new Uint8Array(hashBuffer).subarray(0, 4));
    const ephShare = base64Unpadded(ephPubComp);

    const salt = new Uint8Array(66);
    salt.set(ephPubComp, 0);
    salt.set(recipientPubComp, 33);

    const hkdfKey = await subtle.importKey(
        "raw",
        toBufferSource(sharedSecret),
        "HKDF",
        false,
        ["deriveBits"],
    );
    const wrapKeyBits = await subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: toBufferSource(salt),
            info: toBufferSource(new TextEncoder().encode("piv-p256")),
        },
        hkdfKey,
        256,
    );
    const wrapKey = new Uint8Array(wrapKeyBits);

    const fileKey = getRandomValues(new Uint8Array(16));
    const zeroNonce = new Uint8Array(12);
    const wrappedKey = chacha20poly1305(wrapKey, zeroNonce).encrypt(fileKey);
    const wrappedKeyB64 = base64Unpadded(wrappedKey);

    let headerStr = `age-encryption.org/v1\n-> piv-p256 ${tag} ${ephShare}\n${wrappedKeyB64}\n--- `;

    const fileKeyHkdf = await subtle.importKey(
        "raw",
        toBufferSource(fileKey),
        "HKDF",
        false,
        ["deriveBits"],
    );
    const macKeyBits = await subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: toBufferSource(new Uint8Array(0)),
            info: toBufferSource(new TextEncoder().encode("header")),
        },
        fileKeyHkdf,
        256,
    );
    const macKey = await subtle.importKey(
        "raw",
        macKeyBits,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const macSig = await subtle.sign(
        "HMAC",
        macKey,
        toBufferSource(new TextEncoder().encode(headerStr)),
    );
    const mac = base64Unpadded(new Uint8Array(macSig));
    headerStr += `${mac}\n`;

    const payloadKeyBits = await subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: toBufferSource(new Uint8Array(0)),
            info: toBufferSource(new TextEncoder().encode("payload")),
        },
        fileKeyHkdf,
        256,
    );
    const payloadKey = new Uint8Array(payloadKeyBits);
    const payloadNonce = new Uint8Array(12);
    payloadNonce[11] = 0x01;

    const plaintextBytes =
        typeof plaintext === "string"
            ? new TextEncoder().encode(plaintext)
            : plaintext;
    const payloadEncrypted = chacha20poly1305(
        payloadKey,
        payloadNonce,
    ).encrypt(plaintextBytes);

    const headerBytes = new TextEncoder().encode(headerStr);
    const combined = new Uint8Array(
        headerBytes.length + payloadEncrypted.length,
    );
    combined.set(headerBytes, 0);
    combined.set(payloadEncrypted, headerBytes.length);

    let binary = "";
    for (let i = 0; i < combined.length; i++) {
        const b = combined[i];
        if (b !== undefined) binary += String.fromCharCode(b);
    }
    const b64 = btoa(binary);
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += 64) {
        lines.push(b64.slice(i, i + 64));
    }
    return `-----BEGIN AGE ENCRYPTED FILE-----\n${lines.join("\n")}\n-----END AGE ENCRYPTED FILE-----\n`;
}
