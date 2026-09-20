#!/usr/bin/env bash
# Shared command, temporary-path and digest helpers.

[[ -n "${__lj_common_sh_loaded:-}" ]] && return 0
__lj_common_sh_loaded=1

lj_err() { printf '%s\n' "$*" >&2; }
lj_has() {
    local cmd
    for cmd do command -v "$cmd" >/dev/null 2>&1 || return 1; done
}
lj_require() {
    local cmd missing=0
    for cmd do
        if ! lj_has "$cmd"; then
            lj_err "Required command not found: $cmd"
            missing=1
        fi
    done
    return "$missing"
}
lj_is_function_name() { [[ "${1:-}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; }
lj_require_function() {
    lj_is_function_name "${1:?}" && declare -F -- "$1" >/dev/null || {
        lj_err "Function not found or invalid name: $1"
        return 1
    }
}
lj_tmpfile() { mktemp "${TMPDIR:-${PREFIX:-}/tmp}/lightjunction.XXXXXX"; }
lj_tmpdir() { mktemp -d "${TMPDIR:-${PREFIX:-}/tmp}/lightjunction.XXXXXX"; }
lj_file_size_bytes() { stat -c%s "${1:?}" 2>/dev/null || stat -f%z "$1" 2>/dev/null; }

# Data digests remain available; downloading scripts does not require a digest.
lj_sha256_file() {
    local output digest
    if lj_has sha256sum; then
        output="$(sha256sum <"${1:?}")" || return
    elif lj_has shasum; then
        output="$(shasum -a 256 <"${1:?}")" || return
    else
        lj_err 'No SHA256 tool found.'
        return 127
    fi
    digest="${output%%[[:space:]]*}"
    [[ "$digest" =~ ^[[:xdigit:]]{64}$ ]] || return 1
    printf '%s\n' "$digest"
}
lj_md5_file() {
    local output digest
    if lj_has md5sum; then
        output="$(md5sum <"${1:?}")" || return
    elif lj_has md5; then
        output="$(md5 -q <"${1:?}")" || return
    else
        lj_err 'No MD5 tool found.'
        return 127
    fi
    digest="${output%%[[:space:]]*}"
    [[ "$digest" =~ ^[[:xdigit:]]{32}$ ]] || return 1
    printf '%s\n' "$digest"
}
