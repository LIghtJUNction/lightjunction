#!/usr/bin/env bash
# Decrypt dual-encrypted message (OpenPGP / GPG or age YubiKey).
set -euo pipefail

input_source="${1:-}"

if [[ -n "$input_source" && "$input_source" != "-" ]]; then
    if [[ ! -f "$input_source" ]]; then
        printf 'Error: File not found: %s\n' "$input_source" >&2
        exit 1
    fi
    raw_content="$(cat "$input_source")"
else
    raw_content="$(cat)"
fi

# Extract age block if present
age_block=""
if [[ "$raw_content" =~ (-----BEGIN AGE ENCRYPTED FILE-----[[:space:]]*[A-Za-z0-9+/=[:space:]]+[[:space:]]*-----END AGE ENCRYPTED FILE-----) ]]; then
    age_block="${BASH_REMATCH[1]}"
fi

# Extract PGP block if present
pgp_block=""
if [[ "$raw_content" =~ (-----BEGIN PGP MESSAGE-----[[:space:]]*[A-Za-z0-9+/=[:space:]]+[[:space:]]*-----END PGP MESSAGE-----) ]]; then
    pgp_block="${BASH_REMATCH[1]}"
fi

# 1. Try age with YubiKey identity
if [[ -n "$age_block" ]] && command -v age >/dev/null 2>&1; then
    if command -v age-plugin-yubikey >/dev/null 2>&1; then
        yubikey_id="$(age-plugin-yubikey --identity 2>/dev/null || true)"
        if [[ -n "$yubikey_id" ]]; then
            id_file="$(mktemp)"
            printf '%s\n' "$yubikey_id" > "$id_file"
            if decrypted="$(printf '%s\n' "$age_block" | age -d -i "$id_file" 2>/dev/null)"; then
                rm -f "$id_file"
                printf '%s\n' "$decrypted"
                exit 0
            fi
            rm -f "$id_file"
        fi
    fi

    # Try default age identity file if available
    default_age_keys="${HOME}/.config/age/keys.txt"
    if [[ -f "$default_age_keys" ]]; then
        if decrypted="$(printf '%s\n' "$age_block" | age -d -i "$default_age_keys" 2>/dev/null)"; then
            printf '%s\n' "$decrypted"
            exit 0
        fi
    fi
fi

# 2. Try GPG
if command -v gpg >/dev/null 2>&1; then
    gpg_input="${pgp_block:-$raw_content}"
    if decrypted="$(printf '%s\n' "$gpg_input" | gpg --decrypt --quiet 2>/dev/null)"; then
        printf '%s\n' "$decrypted"
        exit 0
    fi
fi

# 3. If silent decryption failed, retry age or gpg interactively so PIN/passphrase prompt is visible
if [[ -n "$age_block" ]] && command -v age >/dev/null 2>&1; then
    if command -v age-plugin-yubikey >/dev/null 2>&1; then
        yubikey_id="$(age-plugin-yubikey --identity 2>/dev/null || true)"
        if [[ -n "$yubikey_id" ]]; then
            id_file="$(mktemp)"
            printf '%s\n' "$yubikey_id" > "$id_file"
            printf '%s\n' "$age_block" | age -d -i "$id_file"
            rm -f "$id_file"
            exit 0
        fi
    fi
fi

if command -v gpg >/dev/null 2>&1; then
    gpg_input="${pgp_block:-$raw_content}"
    printf '%s\n' "$gpg_input" | gpg --decrypt
    exit 0
fi

printf 'Unable to decrypt message: neither age with YubiKey nor GPG succeeded.\n' >&2
exit 1
