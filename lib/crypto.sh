#!/usr/bin/env bash
# GPG/OpenSSL helpers. Pipeline failures stay local to each operation.

if [[ -n "${LIGHTJUNCTION_SHELL_BASE_URL:-}" && ${__PRELOAD_SH_VERSION:-} != 2 ]]; then
    if [[ -n "${ZSH_VERSION:-}" ]]; then
        # zsh does not expose a waitable PID for process substitution.
        __preload_body="$(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")" || return
        # shellcheck source=/dev/null
        . <(printf '%s\n' "$__preload_body") || return
        unset __preload_body
    else
        # shellcheck source=/dev/null
        . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh") || return
        wait "$!" || return
    fi
    [[ ${__PRELOAD_SH_LOADED:-} == 1 ]] || return 1
fi

[[ -n "${__CRYPTO_SH_LOADED:-}" ]] && return 0
__CRYPTO_SH_LOADED=1
DEFAULT_GPG_KEY="${DEFAULT_GPG_KEY:-EB21B83AB1E982DF66F08387A67178405F7736FD}" # gitleaks:allow -- public fingerprint
DEFAULT_PRIVKEY="${DEFAULT_PRIVKEY:-$HOME/.ssh/id_rsa}"
DEFAULT_PUBKEY="${DEFAULT_PUBKEY:-$HOME/.ssh/id_rsa.pub}"
RSA_V2_PREFIX='LJ-RSA-V2:'

gpg_encrypt() {
    local message="${1?Usage: gpg_encrypt <message> [key_id]}" key="${2:-$DEFAULT_GPG_KEY}"
    printf '%s' "$message" | gpg --batch --yes --encrypt --armor --recipient "$key"
}

gpg_decrypt() { printf '%s' "${1:?}" | gpg --batch --yes --decrypt; }

rsa_encrypt() (
    set -o pipefail
    local text="${1?Usage: rsa_encrypt <text> [pubkey_path]}" pubkey="${2:-$DEFAULT_PUBKEY}" encoded
    [[ -f "$pubkey" ]] || {
        printf 'Error: pubkey not found: %s\n' "$pubkey" >&2
        return 1
    }
    encoded="$(printf '%s' "$text" | openssl pkeyutl -encrypt -pubin -inkey "$pubkey" \
        -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -pkeyopt rsa_mgf1_md:sha256 |
        openssl base64 -A)" || return
    printf '%s%s\n' "$RSA_V2_PREFIX" "$encoded"
)

rsa_decrypt() (
    set -o pipefail
    local envelope="${1:?}" privkey="${2:-$DEFAULT_PRIVKEY}" encoded padding digest_options=()
    [[ -f "$privkey" ]] || {
        printf 'Error: privkey not found: %s\n' "$privkey" >&2
        return 1
    }
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
)

rsa_sign() (
    set -o pipefail
    local message="${1?}" privkey="${2:-$DEFAULT_PRIVKEY}"
    [[ -f "$privkey" ]] || {
        printf 'Error: privkey not found: %s\n' "$privkey" >&2
        return 1
    }
    printf '%s' "$message" | openssl dgst -sha512 -sign "$privkey" | openssl base64 -A
)

rsa_verify() (
    set -o pipefail
    local message="${1?}" signature="${2:?}" pubkey="${3:?}"
    [[ -f "$pubkey" ]] || {
        printf 'Error: pubkey not found: %s\n' "$pubkey" >&2
        return 1
    }
    printf '%s' "$message" | openssl dgst -sha512 -verify "$pubkey" \
        -signature <(printf '%s' "$signature" | openssl base64 -d -A)
)

rsa_gen_keys() (
    local private_key="${1:-$HOME/.ssh/id_rsa}" public_key="${2:-${1:-$HOME/.ssh/id_rsa}.pub}" bits="${3:-4096}"
    local private_name="${private_key##*/}" public_name="${public_key##*/}"
    local private_dir="${private_key%/*}" public_dir="${public_key%/*}"
    local private_stage="" public_stage="" public_published=0 complete=0
    umask 077
    [[ "$private_dir" != "$private_key" ]] || private_dir=.
    [[ "$public_dir" != "$public_key" ]] || public_dir=.
    private_dir="$(cd -P -- "${private_dir:-/}" && printf '%s/' "$PWD")" || return
    public_dir="$(cd -P -- "${public_dir:-/}" && printf '%s/' "$PWD")" || return
    private_key="$private_dir$private_name"
    public_key="$public_dir$public_name"
    if [[ "$private_key" == "$public_key" || -e "$private_key" || -L "$private_key" || -e "$public_key" || -L "$public_key" ]]; then
        printf 'Refusing existing or identical RSA key destinations.\n' >&2
        return 1
    fi
    _rsa_gen_cleanup() {
        local result=$?
        # The final link may have succeeded just before a signal, without
        # returning to set complete. Preserve a fully published matching pair.
        if [[ ! -L "$private_key" && "$private_key" -ef "$private_stage/key" && ! -L "$public_key" && "$public_key" -ef "$public_stage/key" ]]; then
            complete=1
        fi
        # Never unlink a published private key. Public rollback checks its
        # staged inode; arbitrary same-UID path replacement is not serialized.
        if [[ "$complete" == 0 && "$public_published" == 1 && ! -L "$public_key" && "$public_key" -ef "$public_stage/key" ]]; then
            rm -f -- "$public_key" || printf 'Warning: RSA public-key rollback failed.\n' >&2
        fi
        if [[ -n "$private_stage" ]]; then
            rm -rf -- "$private_stage" || printf 'Warning: RSA private staging cleanup failed.\n' >&2
        fi
        if [[ -n "$public_stage" ]]; then
            rm -rf -- "$public_stage" || printf 'Warning: RSA public staging cleanup failed.\n' >&2
        fi
        return "$result"
    }
    trap _rsa_gen_cleanup EXIT
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
    private_stage="$(mktemp -d "$private_dir/.rsa-private.XXXXXXXX")" || return
    public_stage="$(mktemp -d "$public_dir/.rsa-public.XXXXXXXX")" || return
    openssl genrsa -out "$private_stage/key" "$bits" >/dev/null 2>&1 || return
    openssl rsa -in "$private_stage/key" -pubout -out "$public_stage/key" >/dev/null 2>&1 || return
    chmod 600 "$private_stage/key" || return
    chmod 644 "$public_stage/key" || return
    # POSIX link calls link(2) with exactly two absolute paths. An existing
    # destination (including a directory or symlink) is never overwritten.
    # Stage on each target filesystem; publish public first, private last.
    public_published=1
    link "$public_stage/key" "$public_key" || return
    link "$private_stage/key" "$private_key" || return
    complete=1
    printf 'Private: %s\nPublic: %s\n' "$private_key" "$public_key"
)

aes_encrypt() {
    local text="${1?}" password="${2:?}"
    printf '%s' "$text" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
        --symmetric --armor --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 \
        --s2k-count 65011712 --compress-algo none --force-mdc --output - 3<<<"$password"
}

aes_decrypt() (
    set -o pipefail
    local ciphertext="${1:?}" password="${2:?}"
    if [[ "$ciphertext" == '-----BEGIN PGP MESSAGE-----'* ]]; then
        printf '%s' "$ciphertext" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
            --decrypt --output - 3<<<"$password"
        return
    fi
    if [[ "${LIGHTJUNCTION_ALLOW_LEGACY_CBC:-0}" != 1 ]]; then
        printf 'Refusing legacy unauthenticated AES-CBC ciphertext. Set LIGHTJUNCTION_ALLOW_LEGACY_CBC=1 only for migration.\n' >&2
        return 1
    fi
    printf 'Warning: decrypting legacy unauthenticated AES-CBC ciphertext.\n' >&2
    printf '%s' "$ciphertext" | openssl base64 -d -A | OPENSSL_PASSWORD="$password" \
        openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -d -pass env:OPENSSL_PASSWORD
)

hash() {
    local text="${1?}" algorithm="${2:-sha256}" output
    case "$algorithm" in sha256 | sha512 | md5) ;; *)
        printf 'Unsupported hash: %s\n' "$algorithm" >&2
        return 2
        ;;
    esac
    output="$(printf '%s' "$text" | openssl dgst "-$algorithm")" || return
    printf '%s\n' "${output##* }"
}

b64_enc() { printf '%s' "${1:-}" | openssl base64 -A; }
b64_dec() { printf '%s' "${1:-}" | openssl base64 -d -A; }
random() {
    local length="${1:-32}" value
    [[ "$length" =~ ^[1-9][0-9]*$ ]] || return 2
    value="$(openssl rand -hex "$(((length + 1) / 2))")" || return
    printf '%s' "${value:0:length}"
}

if [[ ${__PRELOAD_SH_LOADED:-} == 1 ]]; then
    _preload_register crypto \
        gpg_encrypt gpg_decrypt rsa_encrypt rsa_decrypt rsa_sign rsa_verify rsa_gen_keys aes_encrypt aes_decrypt hash b64_enc b64_dec random
fi
