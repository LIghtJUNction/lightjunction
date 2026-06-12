#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/share-file.sh <file> [display-name]

Copies a non-secret file into the public lmm.best share area and prints an
unguessable download URL.

Rules:
- Do not use for private keys, seed phrases, passwords, cookies, tokens, or
  sensitive customer data.
- Links are public to anyone who has the URL.
- Directory listing is disabled by Nginx, but files are not authenticated.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 2
fi

source_file=$1
if [[ ! -f "$source_file" ]]; then
  echo "File not found: $source_file" >&2
  exit 1
fi

share_root=/var/www/lmm.best/share
base_url=https://lmm.best/share

mkdir -p "$share_root"

token=$(openssl rand -hex 16)
target_dir="$share_root/$token"
mkdir -p "$target_dir"

input_name=${2:-$(basename "$source_file")}
safe_name=$(printf '%s' "$input_name" | tr -cs 'A-Za-z0-9._-' '-' | sed 's/^-//; s/-$//')
if [[ -z "$safe_name" ]]; then
  safe_name=file
fi

cp -- "$source_file" "$target_dir/$safe_name"
chmod 0644 "$target_dir/$safe_name"

printf '%s/%s/%s\n' "$base_url" "$token" "$safe_name"
