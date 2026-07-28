#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
    printf '\n==> %s\n' "$*"
}

cleanup_python_bytecode() {
    log "Clean transient Python bytecode"
    find scripts tests .agents/skills -type f -name '*.py[co]' -delete
    find scripts tests .agents/skills -type d -name '__pycache__' -exec rm -rf {} +
}

trap cleanup_python_bytecode EXIT

require_command() {
    local command_name="${1:?}"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command_name" >&2
        exit 127
    fi
}

require_command uv

log "Python format"
uv run ruff format --check scripts tests .agents/skills

log "Python lint"
uv run ruff check scripts tests .agents/skills

log "Python types"
uv run mypy

log "Python tests"
uv run pytest
