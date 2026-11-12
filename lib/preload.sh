#!/usr/bin/env bash
# Shared cloud import entrypoint. Safe to source repeatedly in the same shell.
[[ ${__PRELOAD_SH_LOADED:-} == 1 ]] && return 0
export LIGHTJUNCTION_SHELL_BASE_URL="${LIGHTJUNCTION_SHELL_BASE_URL:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"
__PRELOAD_IMPORTED=()

_preload_consume() {
    local producer=$! result=0
    # shellcheck source=/dev/null
    . "$1" || result=$?
    wait "$producer" || return
    return "$result"
}

import() {
    local body
    local name="${1:?Usage: import library}" url imported
    case "$name" in
        http://*|https://*) url="$name" ;;
        *)
            name="${name#lib/}"
            name="${name%.sh}"
            [[ "$name" =~ ^[a-zA-Z0-9_-]+$ ]] || return 2
            url="${LIGHTJUNCTION_SHELL_BASE_URL%/}/lib/$name.sh"
            ;;
    esac
    for imported in ${__PRELOAD_IMPORTED[@]+"${__PRELOAD_IMPORTED[@]}"}; do
        [[ "$imported" == "$url" ]] && return 0
    done
    if [[ -n "${ZSH_VERSION:-}" ]]; then
        body="$(curl -fsSL "$url")" || return
        # shellcheck source=/dev/null
        . <(printf '%s\n' "$body") || return
    else
        _preload_consume <(curl -fsSL "$url") || return
    fi
    __PRELOAD_IMPORTED+=("$url")
}

__PRELOAD_SH_LOADED=1
