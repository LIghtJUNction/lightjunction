#!/usr/bin/env bash
# Shared cloud import entrypoint. Safe to source repeatedly in the same shell.
[[ ${__PRELOAD_SH_LOADED:-} == 1 ]] && return 0
export LIGHTJUNCTION_SHELL_BASE_URL="${LIGHTJUNCTION_SHELL_BASE_URL:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"
__PRELOAD_IMPORTED=()

_preload_consume() {
    local producer=$! status=0
    # shellcheck source=/dev/null
    . "$1" || status=$?
    wait "$producer" || return
    return "$status"
}

import() {
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
    _preload_consume <(curl -fsSL "$url") || return
    __PRELOAD_IMPORTED+=("$url")
}

__PRELOAD_SH_LOADED=1
