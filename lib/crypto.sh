#!/bin/bash
# crypto.sh - GPG and OpenSSL cryptographic helpers

DEFAULT_GPG_KEY="EB21B83AB1E982DF66F08387A67178405F7736FD"
DEFAULT_PRIVKEY="$HOME/.ssh/id_rsa"
DEFAULT_PUBKEY="$HOME/.ssh/id_rsa.pub"
RSA_V2_PREFIX='LJ-RSA-V2:'

[[ -n "${__CRYPTO_SH_LOADED:-}" ]] && return 0
__CRYPTO_SH_LOADED=1

gpg_encrypt() {
    local message="${1:?Usage: gpg_encrypt <message> [key_id]}"
    local key="${2:-$DEFAULT_GPG_KEY}"
    printf '%s' "$message" | gpg --batch --yes --encrypt --armor --recipient "$key"
}

gpg_decrypt() {
    local ciphertext="${1:?Usage: gpg_decrypt <ciphertext>}"
    printf '%s' "$ciphertext" | gpg --batch --yes --decrypt
}

rsa_encrypt() {
    local text="${1:?Usage: rsa_encrypt <text> [pubkey_path]}"
    local pubkey="${2:-$DEFAULT_PUBKEY}" encoded
    [[ -f "$pubkey" ]] || { printf 'Error: pubkey not found: %s\n' "$pubkey" >&2; return 1; }
    encoded="$(printf '%s' "$text" | openssl pkeyutl -encrypt -pubin -inkey "$pubkey" \
        -pkeyopt rsa_padding_mode:oaep \
        -pkeyopt rsa_oaep_md:sha256 \
        -pkeyopt rsa_mgf1_md:sha256 | openssl base64 -A)" || return 1
    printf '%s%s\n' "$RSA_V2_PREFIX" "$encoded"
}

rsa_decrypt() {
    local envelope="${1:?Usage: rsa_decrypt <ciphertext> [privkey_path]}"
    local privkey="${2:-$DEFAULT_PRIVKEY}" encoded padding digest_options=()
    [[ -f "$privkey" ]] || { printf 'Error: privkey not found: %s\n' "$privkey" >&2; return 1; }

    if [[ "$envelope" == "$RSA_V2_PREFIX"* ]]; then
        encoded="${envelope#"$RSA_V2_PREFIX"}"
        padding=oaep
        digest_options=(-pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256)
    else
        encoded="$envelope"
        padding=pkcs1
        printf 'Warning: decrypting legacy RSA PKCS#1 v1.5 ciphertext; re-encrypt with rsa_encrypt.\n' >&2
    fi
    printf '%s' "$encoded" | openssl base64 -d -A | openssl pkeyutl -decrypt -inkey "$privkey" \
        -pkeyopt "rsa_padding_mode:$padding" "${digest_options[@]}"
}

rsa_sign() {
    local message="${1:?Usage: rsa_sign <message> [privkey_path]}"
    local privkey="${2:-$DEFAULT_PRIVKEY}"
    [[ -f "$privkey" ]] || { printf 'Error: privkey not found: %s\n' "$privkey" >&2; return 1; }
    printf '%s' "$message" | openssl dgst -sha512 -sign "$privkey" | openssl base64 -A
}

rsa_verify() {
    local message="${1:?Usage: rsa_verify <message> <signature> <pubkey_path>}"
    local signature="${2:?Usage: rsa_verify <message> <signature> <pubkey_path>}"
    local pubkey="${3:?Usage: rsa_verify <message> <signature> <pubkey_path>}" tmp status=0
    [[ -f "$pubkey" ]] || { printf 'Error: pubkey not found: %s\n' "$pubkey" >&2; return 1; }
    tmp="$(mktemp)" || return 1
    printf '%s' "$signature" | openssl base64 -d -A > "$tmp"
    printf '%s' "$message" | openssl dgst -sha512 -verify "$pubkey" -signature "$tmp" || status=$?
    rm -f -- "$tmp"
    return "$status"
}

rsa_gen_keys() {
    local private_key="${1:-$HOME/.ssh/id_rsa}" public_key="${2:-${1:-$HOME/.ssh/id_rsa}.pub}"
    local bits="${3:-4096}"
    openssl genrsa -out "$private_key" "$bits" >/dev/null 2>&1 &&
        openssl rsa -in "$private_key" -pubout -out "$public_key" >/dev/null 2>&1 &&
        printf 'Private: %s\nPublic: %s\n' "$private_key" "$public_key"
}

aes_encrypt() {
    local text="${1:?Usage: aes_encrypt <text> <password>}"
    local password="${2:?Usage: aes_encrypt <text> <password>}"
    printf '%s' "$text" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
        --symmetric --armor --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 \
        --s2k-count 65011712 --compress-algo none --force-mdc --output - 3<<<"$password"
}

aes_decrypt() {
    local ciphertext="${1:?Usage: aes_decrypt <text> <password>}"
    local password="${2:?Usage: aes_decrypt <text> <password>}"
    if [[ "$ciphertext" == '-----BEGIN PGP MESSAGE-----'* ]]; then
        printf '%s' "$ciphertext" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
            --decrypt --output - 3<<<"$password"
        return
    fi
    if [[ "${LIGHTJUNCTION_ALLOW_LEGACY_CBC:-0}" != "1" ]]; then
        printf 'Refusing legacy unauthenticated AES-CBC ciphertext. Set LIGHTJUNCTION_ALLOW_LEGACY_CBC=1 only for migration.\n' >&2
        return 1
    fi
    printf 'Warning: decrypting legacy unauthenticated AES-CBC ciphertext.\n' >&2
    printf '%s' "$ciphertext" | openssl base64 -d -A | LJ_OPENSSL_PASSWORD="$password" \
        openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -d -pass env:LJ_OPENSSL_PASSWORD
}

hash() {
    local text="${1:?Usage: hash <text> [sha256|sha512|md5]}" algorithm="${2:-sha256}"
    case "$algorithm" in sha256|sha512|md5) ;; *) printf 'Unsupported hash: %s\n' "$algorithm" >&2; return 2 ;; esac
    printf '%s' "$text" | openssl dgst "-$algorithm" | awk '{print $2}'
}

b64_enc() { printf '%s' "${1:-}" | openssl base64 -A; }
b64_dec() { printf '%s' "${1:-}" | openssl base64 -d -A; }

random() {
    local length="${1:-32}" value
    [[ "$length" =~ ^[1-9][0-9]*$ ]] || return 2
    value="$(openssl rand -hex "$((length + 1))")"
    printf '%s' "${value:0:length}"
}
