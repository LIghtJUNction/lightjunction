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

require_command shellcheck

shell_files=()
while IFS= read -r file; do
    shell_files+=("$file")
done < <(find . \
    \( -path './.git' -o -path './node_modules' -o -path './dist' -o -path './.venv' \) -prune \
    -o -type f -name '*.sh' -print | sort)

log "Shell syntax"
for file in "${shell_files[@]}"; do
    bash -n "$file"
done

log "ShellCheck"
shellcheck --severity=warning "${shell_files[@]}"
