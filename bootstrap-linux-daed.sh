#!/usr/bin/env bash
# Compatibility entrypoint for the Linux daed bootstrap module.

set -euo pipefail

BOOTSTRAP_FEATURES="${BOOTSTRAP_FEATURES:-network-daed}"
export BOOTSTRAP_FEATURES

if [[ -f "$(dirname "$0")/bootstrap-linux.sh" ]]; then
    exec "$(dirname "$0")/bootstrap-linux.sh" "$@"
fi

exec bash -c "$(curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh)" "$@"
