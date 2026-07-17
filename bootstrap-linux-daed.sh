#!/usr/bin/env bash
# Compatibility entrypoint for the Linux daed bootstrap module.

set -euo pipefail

BOOTSTRAP_FEATURES="${BOOTSTRAP_FEATURES:-network-daed}"
export BOOTSTRAP_FEATURES

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/bootstrap-linux.sh" ]]; then
    exec "$SCRIPT_DIR/bootstrap-linux.sh" "$@"
fi

FIRST_PARTY_RAW_BASE="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main"
REMOTE_BASE_URL="${LIGHTJUNCTION_RAW_BASE:-$FIRST_PARTY_RAW_BASE}"
BOOTSTRAP_LINUX_PIN="3edc49087ca521d62bd24f69b2c33c39b6a8ea52232891018317a7fd1adf03fb"
expected_sha256="${LIGHTJUNCTION_BOOTSTRAP_LINUX_SHA256:-}"
if [[ "$REMOTE_BASE_URL" == "$FIRST_PARTY_RAW_BASE" && -z "$expected_sha256" ]]; then
    expected_sha256="$BOOTSTRAP_LINUX_PIN"
fi
if [[ -z "$expected_sha256" ]]; then
    printf 'Refusing unverified bootstrap from custom source: %s\n' "$REMOTE_BASE_URL" >&2
    exit 1
fi

tmp="$(mktemp)"
trap 'rm -f -- "$tmp"' EXIT HUP INT TERM
curl -fsSL --connect-timeout 10 "$REMOTE_BASE_URL/bootstrap-linux.sh" -o "$tmp"
actual_sha256="$(openssl dgst -sha256 "$tmp" | awk '{print $2}')"
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
    printf 'bootstrap-linux.sh SHA256 mismatch.\n' >&2
    exit 1
fi
bash "$tmp" "$@"
