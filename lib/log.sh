#!/usr/bin/env bash
# Literal messages on stderr. Works with or without lib/env.sh.

if [[ -n "${LIGHTJUNCTION_SHELL_BASE_URL:-}" && ${__PRELOAD_SH_VERSION:-} != 2 ]]; then
    if [[ -n "${ZSH_VERSION:-}" ]]; then
        # zsh does not expose a waitable PID for process substitution.
        __preload_body="$(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")" || return
        # shellcheck source=/dev/null
        . <(printf '%s\n' "$__preload_body") || return
        unset __preload_body
    else
        # shellcheck source=/dev/null
        . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh") || return
        wait "$!" || return
    fi
    [[ ${__PRELOAD_SH_LOADED:-} == 1 ]] || return 1
fi

[[ -n "${__LOG_SH_LOADED:-}" ]] && return 0
__LOG_SH_LOADED=1

_log() {
    local minimum="$1" level="$2" color="$3" configured="${LOG_LEVEL:-3}"
    shift 3
    [[ "$configured" =~ ^[0-4]$ ]] || return 2
    ((configured >= minimum)) || return 0
    printf '%b%s%b %b%-5s%b %s\n' "${C_DIM:-}" "$(date +%H:%M:%S)" "${C_RESET:-}" \
        "$color" "$level" "${C_RESET:-}" "$*" >&2
}

err() { _log 1 ERR "${C_RED:-}" "$@"; }
warn() { _log 2 WARN "${C_YELLOW:-}" "$@"; }
ok() { _log 3 OK "${C_GREEN:-}" "$@"; }
info() { _log 3 INFO "${C_BLUE:-}" "$@"; }
debug() { _log 4 DEBUG "${C_PURPLE:-}" "$@"; }

line() {
    local width="${WIDTH:-80}" divider="${S_DIVIDER:--}" i
    [[ "$width" =~ ^[0-9]+$ ]] || return 2
    printf '%b' "${C_DIM:-}" >&2
    for ((i = 0; i < 10#$width; i++)); do printf '%s' "${divider:0:1}" >&2; done
    printf '%b\n' "${C_RESET:-}" >&2
}

if [[ ${__PRELOAD_SH_LOADED:-} == 1 ]]; then
    _preload_register log \
        _log err warn ok info debug line
fi
