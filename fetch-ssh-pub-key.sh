#!/usr/bin/env bash
# Fetch the lightjunction OpenPGP certificate and its SSH authentication public key.
set -euo pipefail

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
KEY_URL="${LIGHTJUNCTION_GPG_URL:-https://github.com/LIghtJUNction.gpg}"
KEYSERVER="${LIGHTJUNCTION_GPG_KEYSERVER:-}"
OUTPUT_PATH="${LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT:-}"
work=''
output_tmp=''

usage() {
    cat <<'EOF'
Usage: fetch-ssh-pub-key.sh [--output PATH]

Import/update the public OpenPGP certificate from GitHub, check its primary
fingerprint, and print the SSH authentication public key. No private key or
YubiKey is needed. --output PATH atomically saves the SSH public key instead.

LIGHTJUNCTION_GPG_URL       HTTPS certificate URL (default: GitHub .gpg)
LIGHTJUNCTION_GPG_KEYSERVER Explicitly use a keyserver instead (legacy mode)
GNUPGHOME                  Destination GnuPG home (default: GnuPG's default)
EOF
}

die() { printf '%s\n' "$*" >&2; exit 1; }
cleanup() {
    [[ -z "$work" ]] || rm -rf -- "$work"
    [[ -z "$output_tmp" ]] || rm -f -- "$output_tmp"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

while (($#)); do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        -o|--output)
            (($# >= 2)) && [[ -n "$2" ]] || die '--output requires a file path'
            [[ -z "$OUTPUT_PATH" ]] || die 'Output path specified more than once'
            OUTPUT_PATH="$2"; shift 2 ;;
        --output=*)
            [[ -n "${1#*=}" ]] || die '--output requires a file path'
            [[ -z "$OUTPUT_PATH" ]] || die 'Output path specified more than once'
            OUTPUT_PATH="${1#*=}"; shift ;;
        --) shift; (($# == 0)) || die "Unexpected argument: $1" ;;
        *) die "Unexpected argument: $1" ;;
    esac
done

if [[ -n "$OUTPUT_PATH" && "$OUTPUT_PATH" != '-' ]]; then
    [[ ! -d "$OUTPUT_PATH" ]] || die "Output path is a directory: $OUTPUT_PATH"
    output_dir="$(dirname -- "$OUTPUT_PATH")"
    [[ -d "$output_dir" ]] || die "Output directory does not exist: $output_dir"
fi
GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null || true)}"
[[ -n "$GPG_PATH" ]] || die 'GPG not found'

if [[ -n "$KEYSERVER" ]]; then
    # Retain the explicitly selected keyserver workflow for existing callers.
    "$GPG_PATH" --batch --keyserver "$KEYSERVER" --recv-keys "$KEY_ID" >/dev/null \
        || die "Could not fetch GPG key $KEY_ID from $KEYSERVER"
else
    [[ "$KEY_URL" == https://* ]] || die 'GPG public key URL must use HTTPS'
    command -v curl >/dev/null || die 'curl not found'
    work="$(mktemp -d)"
    mkdir -m 700 "$work/gnupg"
    curl -fsSL --proto '=https' --proto-redir '=https' --connect-timeout 10 \
        --max-time 60 --retry 2 "$KEY_URL" -o "$work/download.gpg" \
        || die "Could not download GPG public key from $KEY_URL"
    # Inspect without importing. Never import secret material or trust a subkey
    # fingerprint as the primary identity. GitHub can return multiple certificates.
    "$GPG_PATH" --no-options --no-autostart --homedir "$work/gnupg" --batch --with-colons \
        --show-keys "$work/download.gpg" >"$work/listing" \
        || die 'Downloaded data is not a valid OpenPGP public certificate'
    awk -F: -v expected="$KEY_ID" '
        $1 == "sec" || $1 == "ssb" { secret = 1 }
        $1 == "pub" { primary = 1; next }
        $1 == "sub" { primary = 0 }
        $1 == "fpr" && primary { if ($10 == expected) found = 1; primary = 0 }
        END { exit (secret || !found) }
    ' "$work/listing" || die "Public key fingerprint mismatch (expected $KEY_ID), or secret key supplied"
    "$GPG_PATH" --no-options --no-autostart --homedir "$work/gnupg" --batch \
        --import "$work/download.gpg" >/dev/null
    "$GPG_PATH" --no-options --no-autostart --homedir "$work/gnupg" --batch --armor \
        --export "$KEY_ID" >"$work/selected.asc"
    [[ -s "$work/selected.asc" ]] || die 'Expected public certificate could not be exported'
    "$GPG_PATH" --batch --import "$work/selected.asc" >/dev/null \
        || die 'Could not import the public certificate'
fi

ssh_key="$("$GPG_PATH" --batch --export-ssh-key "$KEY_ID")" \
    || die "Could not export an SSH public key from GPG key $KEY_ID"
[[ "$ssh_key" == ssh-* && "$ssh_key" != *$'\n'* ]] \
    || die 'GPG did not export a valid SSH public key'
if [[ -z "$OUTPUT_PATH" || "$OUTPUT_PATH" == '-' ]]; then
    printf '%s\n' "$ssh_key"
else
    output_tmp="$(mktemp "$output_dir/.lightjunction-pub.XXXXXX")"
    printf '%s\n' "$ssh_key" >"$output_tmp"
    chmod 0644 "$output_tmp"
    mv -f -- "$output_tmp" "$OUTPUT_PATH"
    output_tmp=''
    printf 'SSH public key written to %s\n' "$OUTPUT_PATH" >&2
fi
