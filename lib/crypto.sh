#!/bin/bash
# crypto.sh - Crypto utilities using OpenSSL
# Usage: import lib/crypto.sh
#
# Functions:
#   crypto_rsa_encrypt [plaintext] [pubkey_path]
#   crypto_rsa_decrypt [ciphertext_b64] [privkey_path]
#   crypto_aes_encrypt [plaintext] [password]
#   crypto_aes_decrypt [ciphertext_b64] [password]
#   crypto_hash [string] [sha256|sha512|md5]
#   crypto_random [length]
#   crypto_b64_enc [string]
#   crypto_b64_dec [string]
#   crypto_gen_keys [privkey_path] [pubkey_path] [bits]

# Default keys (embedded)
DEFAULT_PUBKEY=""
DEFAULT_PRIVKEY="$HOME/.ssh/id_rsa"

[[ -n "${__CRYPTO_SH_LOADED:-}" ]] && return 0
__CRYPTO_SH_LOADED=1

# === RSA ===

crypto_rsa_encrypt() {
    local plaintext="${1:?Usage: crypto_rsa_encrypt <text> [pubkey]}"
    local pubkey="${2:-$DEFAULT_PUBKEY}"
    echo -n "$plaintext" | openssl rsautl -encrypt -pubin -inkey "$pubkey" -out /dev/stdout | openssl base64 -A
}

crypto_rsa_decrypt() {
    local ciphertext="${1:?Usage: crypto_rsa_decrypt <b64_ciphertext> [privkey]}"
    local privkey="${2:-$DEFAULT_PRIVKEY}"
    echo -n "$ciphertext" | openssl base64 -d -A | openssl rsautl -decrypt -inkey "$privkey"
}

crypto_rsa_sign() {
    local message="${1:?Usage: crypto_rsa_sign <message> [privkey]}"
    local privkey="${2:-$DEFAULT_PRIVKEY}"
    echo -n "$message" | openssl dgst -sha256 -sign "$privkey" | openssl base64 -A
}

crypto_rsa_verify() {
    local message="${1:?Usage: crypto_rsa_verify <message> <signature_b64> <pubkey>}"
    local sig_b64="$2"
    local pubkey="${3:?}"
    local tmp; tmp=$(mktemp)
    echo -n "$sig_b64" | openssl base64 -d -A > "$tmp"
    echo -n "$message" | openssl dgst -sha256 -verify "$pubkey" -signature "$tmp"
    rm -f "$tmp"
}

# === AES ===

crypto_aes_encrypt() {
    local plaintext="${1:?Usage: crypto_aes_encrypt <text> [password]}"
    local password="${2:-password}"
    echo -n "$plaintext" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"$password" | openssl base64 -A
}

crypto_aes_decrypt() {
    local ciphertext="${1:?Usage: crypto_aes_decrypt <b64_ciphertext> [password]}"
    local password="${2:-password}"
    echo -n "$ciphertext" | openssl base64 -d -A | openssl enc -aes-256-cbc -pbkdf2 -d -pass pass:"$password"
}

# === Hash ===

crypto_hash() {
    local text="${1:?Usage: crypto_hash <text> [sha256|sha512|md5]}"
    local algo="${2:-sha256}"
    echo -n "$text" | openssl dgst -"$algo" | awk '{print $2}'
}

# === Utils ===

crypto_random() {
    local len="${1:-32}"
    openssl rand -base64 "$len" | tr -d '=' | tr '/+' '_-' | head -c "$len"
}

crypto_b64_enc() {
    echo -n "$1" | openssl base64 -A
}

crypto_b64_dec() {
    echo -n "$1" | openssl base64 -d -A
}

crypto_gen_keys() {
    local privkey="${1:-$HOME/.ssh/id_rsa}"
    local pubkey="${2:-$privkey.pub}"
    local bits="${3:-2048}"
    openssl genrsa -out "$privkey" "$bits" 2>/dev/null
    openssl rsa -in "$privkey" -pubout -out "$pubkey" 2>/dev/null
    echo "Priv: $privkey"
    echo "Pub:  $pubkey"
}
