import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { p256 } from "@noble/curves/nist.js";
import { base64nopad, bech32 } from "@scure/base";
import { armor, Encrypter, Stanza } from "age-encryption";

/** Encrypt for the existing age-plugin-yubikey PIV-P256 recipient. */
export async function encryptAge(
    recipientString: string,
    plaintext: string | Uint8Array,
): Promise<string> {
    const { prefix, bytes: recipient } = bech32.decodeToBytes(recipientString);
    if (prefix !== "age1yubikey" || recipient.length !== 33) {
        throw new Error("Expected an age YubiKey PIV-P256 recipient");
    }
    const publicKey = p256.Point.fromBytes(recipient).toBytes(false);
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("SubtleCrypto is not available in this environment");
    const recipientKey = await subtle.importKey(
        "raw", Uint8Array.from(publicKey),
        { name: "ECDH", namedCurve: "P-256" }, false, [],
    );
    const tag = base64nopad.encode(new Uint8Array(
        await subtle.digest("SHA-256", Uint8Array.from(recipient)),
    ).subarray(0, 4));

    const encrypter = new Encrypter();
    encrypter.addRecipient({
        async wrapFileKey(fileKey: Uint8Array): Promise<Stanza[]> {
            const ephemeral = await subtle.generateKey(
                { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
            );
            const ephemeralPublic = p256.Point.fromBytes(new Uint8Array(
                await subtle.exportKey("raw", ephemeral.publicKey),
            )).toBytes(true);
            const sharedSecret = await subtle.deriveBits(
                { name: "ECDH", public: recipientKey }, ephemeral.privateKey, 256,
            );
            const salt = new Uint8Array(66);
            salt.set(ephemeralPublic);
            salt.set(recipient, 33);
            const material = await subtle.importKey(
                "raw", sharedSecret, "HKDF", false, ["deriveBits"],
            );
            const wrapKey = new Uint8Array(await subtle.deriveBits({
                name: "HKDF", hash: "SHA-256", salt,
                info: new TextEncoder().encode("piv-p256"),
            }, material, 256));
            return [new Stanza(
                ["piv-p256", tag, base64nopad.encode(ephemeralPublic)],
                chacha20poly1305(wrapKey, new Uint8Array(12)).encrypt(fileKey),
            )];
        },
    });
    // Delegate the header MAC, random payload nonce, STREAM chunks, and armor.
    return armor.encode(await encrypter.encrypt(plaintext));
}
