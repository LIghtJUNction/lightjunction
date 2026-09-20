#!/usr/bin/env bash
set -euo pipefail

BASE="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/${LIGHTJUNCTION_REF:-main}}"
LOCAL_ROOT="${LIGHTJUNCTION_ROOT:-$(dirname -- "${BASH_SOURCE[0]:-}")}"
if [[ -f "$LOCAL_ROOT/basic.sh" ]]; then
    # shellcheck source=basic.sh
    source "$LOCAL_ROOT/basic.sh"
else
    # shellcheck source=/dev/null
    source <(curl -fsSL --connect-timeout 10 --max-time 120 -- "$BASE/basic.sh")
    wait "$!"
fi
[[ ${__BASIC_SH_LOADED:-} == 1 ]] || { printf 'Could not load basic.sh\n' >&2; exit 1; }

export BOOTSTRAP_FEATURES="${BOOTSTRAP_FEATURES:-network-daed}"
run_script bootstrap-linux.sh "$@"
