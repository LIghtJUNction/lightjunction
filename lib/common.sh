#!/usr/bin/env bash
# common.sh - shared helpers for lightjunction shell libraries

[[ -n "${__lj_common_sh_loaded:-}" ]] && return 0
__lj_common_sh_loaded=1

lj_err() {
    printf '%s\n' "$*" >&2
}

lj_has() {
    local cmd
    for cmd in "$@"; do
        command -v "$cmd" >/dev/null 2>&1 || return 1
    done
}

lj_require() {
    local cmd missing=0
    for cmd in "$@"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            lj_err "Required command not found: $cmd"
            missing=1
        fi
    done
    ((missing == 0))
}

lj_is_function_name() {
    [[ "${1:-}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]
}

lj_require_function() {
    local name="${1:?}"
    if ! lj_is_function_name "$name"; then
        lj_err "Invalid function name: $name"
        return 1
    fi
    if ! declare -f "$name" >/dev/null 2>&1; then
        lj_err "Function not found: $name"
        return 1
    fi
}

lj_tmpfile() {
    mktemp "${TMPDIR:-/tmp}/lightjunction.XXXXXX"
}

lj_tmpdir() {
    mktemp -d "${TMPDIR:-/tmp}/lightjunction.XXXXXX"
}

lj_file_size_bytes() {
    local path="${1:?}"
    stat -c%s "$path" 2>/dev/null || stat -f%z "$path" 2>/dev/null
}

lj_sha256_file() {
    local path="${1:?}"
    sha256sum "$path" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$path" | awk '{print $1}'
}

lj_md5_file() {
    local path="${1:?}"
    md5sum "$path" 2>/dev/null | awk '{print $1}' || md5 -q "$path" 2>/dev/null
}
