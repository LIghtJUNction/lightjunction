#!/usr/bin/env bash
# Filesystem helpers. Writes are atomic; temporary files are private and created.

[[ -n "${__file_sh_loaded:-}" ]] && return 0
__file_sh_loaded=1

file_exists() { [[ -e "${1:?}" ]]; }
file_is_file() { [[ -f "${1:?}" ]]; }
file_is_dir() { [[ -d "${1:?}" ]]; }
file_is_readable() { [[ -r "${1:?}" ]]; }
file_is_writable() { [[ -w "${1:?}" ]]; }
file_read() { cat -- "${1:?}"; }
file_read_lines() { nl -ba -- "${1:?}"; }

file_mode() {
    stat -c '%a' -- "${1:?}" 2>/dev/null || stat -f '%Lp' -- "$1" 2>/dev/null
}

file_write() (
    local path="${1:?}" content="${2:-}" directory tmp mode=''
    [[ ! -d "$path" && ! -L "$path" ]] || return 2
    directory="$(dirname -- "$path")" || return
    mkdir -p -- "$directory" || return
    tmp="$(mktemp "$directory/.file-write.XXXXXX")" || return
    trap 'rm -f -- "$tmp"' EXIT
    if [[ -e "$path" ]]; then mode="$(file_mode "$path")" || return; fi
    printf '%s' "$content" >"$tmp" || return
    if [[ -n "$mode" ]]; then chmod "$mode" "$tmp" || return; fi
    mv -f -- "$tmp" "$path"
)

file_append() { printf '%s' "${2:-}" >>"${1:?}"; }
file_copy() { [[ -f "${1:?}" ]] && cp -f -- "$1" "${2:?}"; }
file_move() { [[ -f "${1:?}" ]] && mv -f -- "$1" "${2:?}"; }
file_size_bytes() { stat -c '%s' -- "${1:?}" 2>/dev/null || stat -f '%z' -- "$1" 2>/dev/null; }

file_size() {
    local bytes
    [[ -e "${1:?}" ]] || { printf '0B\n'; return; }
    bytes="$(file_size_bytes "$1")" || return
    if ((bytes < 1024)); then printf '%sB\n' "$bytes"
    elif ((bytes < 1048576)); then printf '%sKB\n' "$((bytes / 1024))"
    elif ((bytes < 1073741824)); then printf '%sMB\n' "$((bytes / 1048576))"
    else printf '%sGB\n' "$((bytes / 1073741824))"; fi
}

file_count_lines() { [[ -f "${1:?}" ]] && wc -l <"$1" | tr -d ' ' || printf '0\n'; }

_file_digest() {
    local algorithm="$1" path="${2:?}" output
    [[ -f "$path" ]] || return 1
    # Hash stdin so filenames containing backslashes cannot change the output format.
    if command -v "${algorithm}sum" >/dev/null 2>&1; then
        output="$("${algorithm}sum" <"$path")" || return
    elif [[ "$algorithm" == sha256 ]] && command -v shasum >/dev/null 2>&1; then
        output="$(shasum -a 256 <"$path")" || return
    elif [[ "$algorithm" == md5 ]] && command -v md5 >/dev/null 2>&1; then
        output="$(md5 -q <"$path")" || return
    else
        return 127
    fi
    output="${output%%[[:space:]]*}"
    case "$algorithm" in
        sha256) [[ "$output" =~ ^[[:xdigit:]]{64}$ ]] || return 1 ;;
        md5) [[ "$output" =~ ^[[:xdigit:]]{32}$ ]] || return 1 ;;
    esac
    printf '%s\n' "$output"
}

file_md5() { _file_digest md5 "${1:?}"; }
file_sha256() { _file_digest sha256 "${1:?}"; }
file_extension() { local name="${1:?}"; name="${name##*/}"; case "$name" in ?*.*) printf '%s' "${name##*.}" ;; esac; }
file_basename() { basename -- "${1:?}"; }
file_dirname() { dirname -- "${1:?}"; }

file_temp() {
    local suffix="${1:-}" directory="${TMPDIR:-${PREFIX:+$PREFIX/tmp}}" temporary
    [[ "$suffix" != */* ]] || return 2
    temporary="$(mktemp "${directory:-/tmp}/lightjunction.XXXXXX")" || return
    if [[ -n "$suffix" ]]; then
        # ln refuses an existing destination; unlike mv it cannot overwrite a collision.
        if ! ln -- "$temporary" "$temporary$suffix"; then rm -f -- "$temporary"; return 1; fi
        rm -f -- "$temporary"
        temporary+="$suffix"
    fi
    printf '%s\n' "$temporary"
}

file_backup() { [[ -f "${1:?}" ]] && cp -p -- "$1" "$1.bak"; }
