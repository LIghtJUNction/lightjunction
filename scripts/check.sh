#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
    printf '\n==> %s\n' "$*"
}

cleanup_python_bytecode() {
    find scripts tests skills -type f -name '*.py[co]' -delete
    find scripts tests skills -type d -name '__pycache__' -exec rm -rf {} +
}

trap cleanup_python_bytecode EXIT

require_command() {
    local command_name="${1:?}"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command_name" >&2
        exit 127
    fi
}

shell_files=()
while IFS= read -r file; do
    shell_files+=("$file")
done < <(find . \
    \( -path './.git' -o -path './node_modules' -o -path './dist' -o -path './.venv' \) -prune \
    -o -type f -name '*.sh' -print | sort)

require_command shellcheck
require_command uv
require_command npm

log "Shell syntax"
for file in "${shell_files[@]}"; do
    bash -n "$file"
done

log "ShellCheck"
shellcheck --severity=warning "${shell_files[@]}"

log "Python format"
uv run ruff format --check scripts tests skills

log "Python lint"
uv run ruff check scripts tests skills

log "Python types"
uv run mypy

log "Python tests"
uv run pytest

log "Frontend"
npm run check

log "Clean transient Python bytecode"
cleanup_python_bytecode
