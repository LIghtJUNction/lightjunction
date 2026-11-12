#!/usr/bin/env bash
# Shared cloud import entrypoint. Safe to source repeatedly in the same shell.
[[ ${__PRELOAD_SH_VERSION:-} == 2 ]] && return 0
export LIGHTJUNCTION_SHELL_BASE_URL="${LIGHTJUNCTION_SHELL_BASE_URL:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"
if [[ ${__PRELOAD_SH_LOADED:-} != 1 ]]; then __PRELOAD_IMPORTED=(); fi

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

# Setup scripts run in Bash so they cannot change the caller's shell state.
bootstrap() {
    local target='' script body base="${LIGHTJUNCTION_SHELL_BASE_URL%/}"
    case "${1:-}" in
        -h|--help)
            printf '%s\n' 'Usage: bootstrap [linux|macbook] [script arguments...]' \
                'Without a target, detect Linux/Termux or macOS.' \
                'Example: bootstrap linux --help'
            return 0 ;;
        linux|macbook) target="$1"; shift ;;
        ''|--*) ;;
        *) printf 'Unknown bootstrap target: %s\n' "$1" >&2; return 2 ;;
    esac
    if [[ -z "$target" ]]; then
        case "$(uname -s)" in
            Linux) target=linux ;;
            Darwin) target=macbook ;;
            *) printf 'Unsupported platform; select a bootstrap target explicitly.\n' >&2
               return 2 ;;
        esac
    fi
    case "$target" in
        linux) script=bootstrap-linux.sh ;;
        macbook) script=bootstrap-macbook.sh ;;
    esac
    body="$(curl -fsSL "$base/$script")" || return
    LIGHTJUNCTION_RAW_BASE="$base" LIGHTJUNCTION_ROOT='' \
        LIGHTJUNCTION_SHELL_BASE_URL="$base" bash <(printf '%s\n' "$body") "$@"
}

# Keep category/function pairs without requiring associative arrays (Bash 3.2).
if [[ ${__PRELOAD_SH_LOADED:-} != 1 ]]; then __PRELOAD_FUNCTIONS=(); fi
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

_preload_register preload import funcs bootstrap _preload_consume _preload_register

__PRELOAD_SH_VERSION=2
__PRELOAD_SH_LOADED=1
