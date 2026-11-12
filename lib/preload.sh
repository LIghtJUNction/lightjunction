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

# Keep category/function pairs without requiring associative arrays (Bash 3.2).
__PRELOAD_FUNCTIONS=()
_preload_register() {
    local category="${1:?}" name entry
    local retained=()
    shift
    for name do
        retained=()
        for entry in ${__PRELOAD_FUNCTIONS[@]+"${__PRELOAD_FUNCTIONS[@]}"}; do
            [[ "${entry#*:}" == "$name" ]] || retained+=("$entry")
        done
        __PRELOAD_FUNCTIONS=("${retained[@]}" "$category:$name")
    done
}

funcs() {
    local category='' include_private=0 categories_only=0 argument entry group name
    local previous=''
    for argument do
        case "$argument" in
            -a) include_private=1 ;;
            -c) categories_only=1 ;;
            -h)
                printf '%s\n' 'Usage: funcs [category] [-a] [-c]'
                return 0 ;;
            -*) printf 'Unknown option: %s\n' "$argument" >&2; return 2 ;;
            *)
                [[ -z "$category" ]] || return 2
                category="$argument" ;;
        esac
    done
    for entry in ${__PRELOAD_FUNCTIONS[@]+"${__PRELOAD_FUNCTIONS[@]}"}; do
        group="${entry%%:*}"
        name="${entry#*:}"
        [[ -z "$category" || "$group" == "$category" ]] || continue
        [[ "$include_private" == 1 || "$name" != _* ]] || continue
        typeset -f "$name" >/dev/null || continue
        printf '%s %s\n' "$group" "$name"
    done | LC_ALL=C sort | while read -r group name; do
        if [[ "$group" != "$previous" ]]; then
            if [[ "$categories_only" == 1 ]]; then
                printf '%s\n' "$group"
            else
                printf '%s:\n' "$group"
            fi
            previous="$group"
        fi
        [[ "$categories_only" == 1 ]] || printf '  %s\n' "$name"
    done
}

_preload_register preload import funcs _preload_consume _preload_register

__PRELOAD_SH_LOADED=1
