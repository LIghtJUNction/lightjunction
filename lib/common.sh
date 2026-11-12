#!/usr/bin/env bash
# Shared command, temporary-path and digest helpers.

if [[ -n "${LIGHTJUNCTION_SHELL_BASE_URL:-}" && ${__PRELOAD_SH_LOADED:-} != 1 ]]; then
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

[[ -n "${__common_sh_loaded:-}" ]] && return 0
__common_sh_loaded=1

err() { printf '%s\n' "$*" >&2; }
has() {
    local cmd
    for cmd do command -v "$cmd" >/dev/null 2>&1 || return 1; done
}
require() {
    local cmd missing=0
    for cmd do
        if ! has "$cmd"; then
            err "Required command not found: $cmd"
            missing=1
        fi
    done
    return "$missing"
}
is_function_name() { [[ "${1:-}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; }
require_function() {
    is_function_name "${1:?}" && declare -F -- "$1" >/dev/null || {
        err "Function not found or invalid name: $1"
        return 1
    }
}
tmpfile() { mktemp "${TMPDIR:-${PREFIX:-}/tmp}/lightjunction.XXXXXX"; }
tmpdir() { mktemp -d "${TMPDIR:-${PREFIX:-}/tmp}/lightjunction.XXXXXX"; }
file_size_bytes() { stat -c%s "${1:?}" 2>/dev/null || stat -f%z "$1" 2>/dev/null; }

# Data digests remain available; downloading scripts does not require a digest.
sha256_file() {
    local output digest
    if has sha256sum; then
        output="$(sha256sum <"${1:?}")" || return
    elif has shasum; then
        output="$(shasum -a 256 <"${1:?}")" || return
    else
        err 'No SHA256 tool found.'
        return 127
    fi
    digest="${output%%[[:space:]]*}"
    [[ "$digest" =~ ^[[:xdigit:]]{64}$ ]] || return 1
    printf '%s\n' "$digest"
}
md5_file() {
    local output digest
    if has md5sum; then
        output="$(md5sum <"${1:?}")" || return
    elif has md5; then
        output="$(md5 -q <"${1:?}")" || return
    else
        err 'No MD5 tool found.'
        return 127
    fi
    digest="${output%%[[:space:]]*}"
    [[ "$digest" =~ ^[[:xdigit:]]{32}$ ]] || return 1
    printf '%s\n' "$digest"
}
