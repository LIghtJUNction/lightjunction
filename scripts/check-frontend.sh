#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
    printf '\n==> %s\n' "$*"
}

require_command() {
    local command_name="${1:?}"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command_name" >&2
        exit 127
    fi
}

require_command npm

log "Frontend typecheck + interaction tests + build"
npm run check
