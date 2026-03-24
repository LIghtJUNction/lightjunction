#!/bin/bash
# crypto.sh - Crypto utilities (GPG + OpenSSL)
# Usage: import lib/crypto.sh
#
# === GPG Functions (uses your key EB21B83AB1E982DF66F08387A67178405F7736FD) ===
#   gpg_encrypt [message] [recipient_key]
#   gpg_decrypt [ciphertext]
#
# === OpenSSL RSA Functions ===
#   rsa_encrypt [plaintext] [pubkey_pem_path]
#   rsa_decrypt [ciphertext_b64] [privkey_pem_path]
#   rsa_sign [message] [privkey_pem_path]
#   rsa_verify [message] [signature_b64] [pubkey_pem_path]
#   rsa_gen_keys [privkey_path] [pubkey_path] [bits]
#
# === Password-based Crypto ===
#   aes_encrypt [text] [password]
#   aes_decrypt [text] [password]
#
# === Utils ===
#   hash [text] [sha256|sha512|md5]
#   b64_enc [text]
#   b64_dec [text]
#   random [length]

# Default GPG key (your public key for encryption)
DEFAULT_GPG_KEY="EB21B83AB1E982DF66F08387A67178405F7736FD"
DEFAULT_PRIVKEY="$HOME/.ssh/id_rsa"
DEFAULT_PUBKEY="$HOME/.ssh/id_rsa.pub"

[[ -n "${__CRYPTO_SH_LOADED:-}" ]] && return 0
__CRYPTO_SH_LOADED=1

# ==================== GPG (use your key directly) ====================

gpg_encrypt() {
    local msg="${1:?Usage: gpg_encrypt <message> [key_id]}"
    local key="${2:-$DEFAULT_GPG_KEY}"
    echo -n "$msg" | gpg --batch --yes --encrypt --armor --recipient "$key" 2>/dev/null
}

gpg_decrypt() {
    local ciphertext="${1:?Usage: gpg_decrypt <ciphertext>}"
    echo -n "$ciphertext" | gpg --batch --yes --decrypt 2>/dev/null
}

# ==================== OpenSSL RSA ====================

rsa_encrypt() {
    local text="${1:?Usage: rsa_encrypt <text> [pubkey_path]}"
    local pubkey="${2:-$DEFAULT_PUBKEY}"
    [[ -f "$pubkey" ]] || { echo "Error: pubkey not found: $pubkey" >&2; return 1; }
    echo -n "$text" | openssl rsautl -encrypt -pubin -inkey "$pubkey" -out /dev/stdout | openssl base64 -A
}

rsa_decrypt() {
    local data="${1:?Usage: rsa_decrypt <b64_data> [privkey_path]}"
    local privkey="${2:-$DEFAULT_PRIVKEY}"
    [[ -f "$privkey" ]] || { echo "Error: privkey not found: $privkey" >&2; return 1; }
    echo -n "$data" | openssl base64 -d -A | openssl rsautl -decrypt -inkey "$privkey"
}

rsa_sign() {
    local msg="${1:?Usage: rsa_sign <message> [privkey_path]}"
    local privkey="${2:-$DEFAULT_PRIVKEY}"
    [[ -f "$privkey" ]] || { echo "Error: privkey not found: $privkey" >&2; return 1; }
    echo -n "$msg" | openssl dgst -sha256 -sign "$privkey" | openssl base64 -A
}

rsa_verify() {
    local msg="${1:?Usage: rsa_verify <message> <sig_b64> <pubkey_path}"
    local sig_b64="$2"
    local pubkey="${3:?}"
    [[ -f "$pubkey" ]] || { echo "Error: pubkey not found: $pubkey" >&2; return 1; }
    local tmp; tmp=$(mktemp)
    echo -n "$sig_b64" | openssl base64 -d -A > "$tmp"
    echo -n "$msg" | openssl dgst -sha256 -verify "$pubkey" -signature "$tmp"
    rm -f "$tmp"
}

rsa_gen_keys() {
    local priv="${1:-$HOME/.ssh/id_rsa}"
    local pub="${2:-$priv.pub}"
    local bits="${3:-2048}"
    openssl genrsa -out "$priv" "$bits" 2>/dev/null && \
    openssl rsa -in "$priv" -pubout -out "$pub" 2>/dev/null && \
    echo "Private: $priv" && echo "Public: $pub"
}

# ==================== AES Password-based ====================

aes_encrypt() {
    local text="${1:?Usage: aes_encrypt <text> [password]}"
    local pass="${2:-password}"
    echo -n "$text" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"$pass" | openssl base64 -A
}

aes_decrypt() {
    local text="${1:?Usage: aes_decrypt <text> [password]}"
    local pass="${2:-password}"
    echo -n "$text" | openssl base64 -d -A | openssl enc -aes-256-cbc -pbkdf2 -d -pass pass:"$pass"
}

# ==================== Utils ====================

hash() {
    local text="${1:?Usage: hash <text> [sha256|sha512|md5]}"
    local algo="${2:-sha256}"
    echo -n "$text" | openssl dgst -"$algo" | awk '{print $2}'
}

b64_enc() {
    openssl base64 -A <<< "$1"
}

b64_dec() {
    openssl base64 -d -A <<< "$1"
}

random() {
    local len="${1:-32}"
    openssl rand -base64 "$len" | tr -d '=' | tr '/+' '_-' | head -c "$len"
}
