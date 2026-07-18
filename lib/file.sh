#!/bin/bash
# file.sh - Portable filesystem utilities

[[ -n "${__file_sh_loaded:-}" ]] && return 0
__file_sh_loaded=1

file_exists() { [[ -e "${1:?}" ]]; }
file_is_file() { [[ -f "${1:?}" ]]; }
file_is_dir() { [[ -d "${1:?}" ]]; }
file_is_readable() { [[ -r "${1:?}" ]]; }
file_is_writable() { [[ -w "${1:?}" ]]; }

file_read() {
    local path="${1:?}"
    [[ -f "$path" ]] && cat -- "$path"
}

file_read_lines() {
    local path="${1:?}"
    [[ -f "$path" ]] && nl -ba -- "$path"
}

file_mode() {
    local path="${1:?}"
    stat -c '%a' -- "$path" 2>/dev/null || stat -f '%Lp' -- "$path" 2>/dev/null
}

file_write() {
    local path="${1:?}" content="${2:-}" directory tmp mode=""
    directory="$(dirname -- "$path")"
    mkdir -p -- "$directory"
    tmp="$(mktemp "$directory/.file-write.XXXXXX")" || return 1
    if [[ -e "$path" ]]; then
        mode="$(file_mode "$path")" || {
            rm -f -- "$tmp"
            return 1
        }
    fi
    if ! printf '%s' "$content" > "$tmp"; then
        rm -f -- "$tmp"
        return 1
    fi
    if [[ -n "$mode" ]] && ! chmod "$mode" "$tmp"; then
        rm -f -- "$tmp"
        return 1
    fi
    mv -f -- "$tmp" "$path"
}

file_append() {
    local path="${1:?}" content="${2:-}"
    printf '%s' "$content" >> "$path"
}

file_copy() {
    local src="${1:?}" dst="${2:?}"
    [[ -f "$src" ]] && cp -f -- "$src" "$dst"
}

file_move() {
    local src="${1:?}" dst="${2:?}"
    [[ -f "$src" ]] && mv -f -- "$src" "$dst"
}

file_size_bytes() {
    local path="${1:?}"
    stat -c '%s' -- "$path" 2>/dev/null || stat -f '%z' -- "$path" 2>/dev/null || printf '0\n'
}

file_size() {
    local path="${1:?}" bytes
    [[ -e "$path" ]] || { printf '0B\n'; return; }
    bytes="$(file_size_bytes "$path")"
    if ((bytes < 1024)); then
        printf '%sB\n' "$bytes"
    elif ((bytes < 1048576)); then
        printf '%sKB\n' "$((bytes / 1024))"
    elif ((bytes < 1073741824)); then
        printf '%sMB\n' "$((bytes / 1048576))"
    else
        printf '%sGB\n' "$((bytes / 1073741824))"
    fi
}

file_count_lines() {
    local path="${1:?}"
    [[ -f "$path" ]] && wc -l < "$path" | tr -d ' ' || printf '0\n'
}

file_md5() {
    local path="${1:?}" output digest
    [[ -f "$path" ]] || return 1
    if command -v md5sum >/dev/null 2>&1; then
        output="$(md5sum "$path")" || return 1
        digest="${output%%[[:space:]]*}"
    elif command -v md5 >/dev/null 2>&1; then
        output="$(md5 -q "$path")" || return 1
        digest="${output%%[[:space:]]*}"
    else
        return 1
    fi
    [[ "$digest" =~ ^[[:xdigit:]]{32}$ ]] || return 1
    printf '%s\n' "$digest"
}

file_sha256() {
    local path="${1:?}" output digest
    [[ -f "$path" ]] || return 1
    if command -v sha256sum >/dev/null 2>&1; then
        output="$(sha256sum "$path")" || return 1
    elif command -v shasum >/dev/null 2>&1; then
        output="$(shasum -a 256 "$path")" || return 1
    else
        return 1
    fi
    digest="${output%%[[:space:]]*}"
    [[ "$digest" =~ ^[[:xdigit:]]{64}$ ]] || return 1
    printf '%s\n' "$digest"
}

file_extension() { local filename="${1:?}"; printf '%s' "${filename##*.}"; }
file_basename() { local path="${1:?}"; basename -- "$path"; }
file_dirname() { local path="${1:?}"; dirname -- "$path"; }

file_temp() {
    local suffix="${1:-}" tmpdir="${TMPDIR:-/tmp}" name
    [[ -d /data/data/com.termux/files/home/tmp ]] && tmpdir=/data/data/com.termux/files/home/tmp
    name="$(openssl rand -hex 16 2>/dev/null || printf '%s' "$$.$RANDOM")"
    printf '%s/%s%s\n' "$tmpdir" "$name" "$suffix"
}

file_backup() {
    local path="${1:?}"
    [[ -f "$path" ]] && cp -f -- "$path" "${path}.bak"
}
