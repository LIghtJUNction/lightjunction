#!/usr/bin/env bash
# Shared local/remote loader. Use import path or import URL.

[[ ${__BASIC_SH_LOADED:-} == 1 ]] && return 0
LIGHTJUNCTION_RAW_BASE="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/${LIGHTJUNCTION_REF:-main}}"
LIGHTJUNCTION_ROOT="${LIGHTJUNCTION_ROOT:-}"
if [[ -z "$LIGHTJUNCTION_ROOT" && -f "${BASH_SOURCE[0]}" ]]; then
    LIGHTJUNCTION_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
fi
__IMPORTED_FILES=()

# Also used when an installer needs to save a helper for later offline execution.
lj_fetch() {
    local file="${1:?Usage: lj_fetch path-or-url}"
    case "$file" in
        http://*|https://*) ;;
        *)
            if [[ -n "$LIGHTJUNCTION_ROOT" && -f "$LIGHTJUNCTION_ROOT/$file" ]]; then
                cat -- "$LIGHTJUNCTION_ROOT/$file"
                return
            fi
            file="${LIGHTJUNCTION_RAW_BASE%/}/$file"
            ;;
    esac
    curl -fsSL --connect-timeout 10 --max-time 120 -- "$file"
}

# Capture the producer PID before a sourced library can start a nested import.
_lj_consume() {
    local producer=$! status=0
    # shellcheck source=/dev/null
    "$@" || status=$?
    wait "$producer" || return
    return "$status"
}

import() {
    local file="${1:?Usage: import path-or-url}" key imported
    # Keep the original five repository arguments, without the old checksum argument.
    if (($# > 1)); then
        file="${5:-https://raw.githubusercontent.com}/${4:-LIghtJUNction}/${3:-lightjunction}/${2:-main}/$file"
    fi
    key="$LIGHTJUNCTION_ROOT|$LIGHTJUNCTION_RAW_BASE|$file"
    for imported in ${__IMPORTED_FILES[@]+"${__IMPORTED_FILES[@]}"}; do
        [[ "$imported" == "$key" ]] && return 0
    done
    _lj_consume source <(lj_fetch "$file") || return
    __IMPORTED_FILES+=("$key")
}

run_script() {
    local file="${1:?Usage: run_script path-or-url [args...]}"
    shift
    export LIGHTJUNCTION_ROOT LIGHTJUNCTION_RAW_BASE
    _lj_consume bash <(lj_fetch "$file") "$@"
}

hook() {
    local name="${1:?}" declaration body
    name="${name%%::*}"
    name="${name%()}"
    [[ "$name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || return 2
    declaration="$(declare -f -- "$name")" || return 1
    body="$(cat)" || return
    if ! declare -F -- "self_$name" >/dev/null; then
        eval "self_$declaration" || return
    fi
    eval "$name() {
        local self=self_$name
$body
    }"
}

__BASIC_SH_LOADED=1
