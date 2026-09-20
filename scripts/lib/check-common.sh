#!/usr/bin/env bash
# Shared setup for local/CI checks. Callers choose their own shell options.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd -- "$ROOT_DIR" || return

log() { printf '\n==> %s\n' "$*"; }
require_command() {
    local name
    for name do
        command -v "$name" >/dev/null 2>&1 || { printf 'Missing required command: %s\n' "$name" >&2; return 127; }
    done
}
