#!/usr/bin/env bash
set -euo pipefail
umask 077

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

share_root=${SHARE_ROOT:-/srv/share-lmm-best/files}
base_url=${SHARE_BASE_URL:-https://share.lmm.best}
base_url=${base_url%/}

mkdir -p "$share_root"

token=$(openssl rand -hex 16)
target_dir="$share_root/$token"
mkdir -p "$target_dir"
complete=0
cleanup() {
  if [[ "$complete" -eq 0 ]]; then
    rm -rf -- "$target_dir" || true
  fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

input_name=${2:-$(basename "$source_file")}
safe_name=$(printf '%s' "$input_name" | tr -cs 'A-Za-z0-9._-' '-' | sed 's/^-//; s/-$//')
if [[ -z "$safe_name" ]]; then
  safe_name="file"
fi
if [[ "$safe_name" == "." || "$safe_name" == ".." ]]; then
  echo "Refusing unsafe display name: $safe_name" >&2
  exit 2
fi

install -m 0644 -- "$source_file" "$target_dir/$safe_name"
complete=1

printf '%s/%s/%s\n' "$base_url" "$token" "$safe_name"
