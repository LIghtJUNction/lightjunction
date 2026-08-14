#!/usr/bin/env bash
# fetch-ssh-pub-key.sh - Fetch the lightjunction SSH public key from GPG
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/fetch-ssh-pub-key.sh | bash
#   bash fetch-ssh-pub-key.sh --output "$HOME/.ssh/lightjunction.pub"

set -euo pipefail

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
KEYSERVER="${LIGHTJUNCTION_GPG_KEYSERVER:-hkps://keyserver.ubuntu.com}"
OUTPUT_PATH="${LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT:-}"

usage() {
    cat <<'EOF'
Usage: fetch-ssh-pub-key.sh [--output PATH]

Fetch the lightjunction SSH public key through GPG and print it to stdout.
Use --output PATH to write it atomically to a file instead.
Set LIGHTJUNCTION_GPG_KEYSERVER to use another OpenPGP keyserver.
EOF
}

die() {
    printf '%s\n' "$*" >&2
    exit 1
}

while (($#)); do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -o|--output)
            (($# >= 2)) || die "--output requires a file path"
            [[ -z "$OUTPUT_PATH" ]] || die "Output path specified more than once"
            OUTPUT_PATH="$2"
            shift 2
            ;;
        --output=*)
            [[ -n "${1#*=}" ]] || die "--output requires a file path"
            [[ -z "$OUTPUT_PATH" ]] || die "Output path specified more than once"
            OUTPUT_PATH="${1#*=}"
            shift
            ;;
        --)
            shift
            (($# == 0)) || die "Unexpected argument: $1"
            ;;
        *)
            die "Unexpected argument: $1"
            ;;
    esac
done

GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null || true)}"
[[ -n "$GPG_PATH" ]] || die "GPG not found"
[[ -n "$KEYSERVER" ]] || die "GPG keyserver is empty"

if ! "$GPG_PATH" --batch --keyserver "$KEYSERVER" --recv-keys "$KEY_ID" >/dev/null; then
    die "Could not fetch GPG key $KEY_ID from $KEYSERVER"
fi

if ! ssh_key="$("$GPG_PATH" --batch --export-ssh-key "$KEY_ID")"; then
    die "Could not export an SSH public key from GPG key $KEY_ID"
fi
[[ "$ssh_key" == ssh-* ]] || die "GPG did not export a valid SSH public key"

if [[ -z "$OUTPUT_PATH" || "$OUTPUT_PATH" == "-" ]]; then
    printf '%s\n' "$ssh_key"
    exit 0
fi

[[ ! -d "$OUTPUT_PATH" ]] || die "Output path is a directory: $OUTPUT_PATH"
output_dir="$(dirname -- "$OUTPUT_PATH")"
[[ -d "$output_dir" ]] || die "Output directory does not exist: $output_dir"
output_name="$(basename -- "$OUTPUT_PATH")"
tmp="$(mktemp "$output_dir/.${output_name}.XXXXXX")" || die "Could not create temporary output file"
cleanup() {
    rm -f -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

printf '%s\n' "$ssh_key" >"$tmp"
chmod 0644 "$tmp"
mv -f -- "$tmp" "$OUTPUT_PATH"
trap - EXIT HUP INT TERM
printf 'SSH public key written to %s\n' "$OUTPUT_PATH" >&2
