#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CANONICAL_CONTEXT="$ROOT_DIR/skills/opensource-small-pr/scripts/context.sh"

if [[ ! -x "$CANONICAL_CONTEXT" ]]; then
    printf 'Canonical open-source context script is missing or not executable: %s\n' "$CANONICAL_CONTEXT" >&2
    exit 1
fi

exec "$CANONICAL_CONTEXT" "$@"
