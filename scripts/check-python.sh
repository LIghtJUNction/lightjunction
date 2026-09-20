#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=scripts/lib/check-common.sh
source "$(dirname -- "${BASH_SOURCE[0]}")/lib/check-common.sh"
require_command uv
# Avoid creating bytecode instead of deleting pre-existing caches in an EXIT trap.
export PYTHONDONTWRITEBYTECODE=1

log 'Python format'
uv run ruff format --check scripts tests .agents/skills
log 'Python lint'
uv run ruff check scripts tests .agents/skills
log 'Python types'
uv run mypy
log 'Python tests'
uv run pytest
