#!/bin/bash
# file.sh - Filesystem utilities
# Usage: source file.sh
#
# Functions:
#   file_exists path                    - Returns 0 if file/dir exists
#   file_is_file path                   - Returns 0 if regular file
#   file_is_dir path                    - Returns 0 if directory
#   file_is_readable path               - Returns 0 if readable
#   file_is_writable path               - Returns 0 if writable
#   file_read path                      - Print file contents
#   file_read_lines path               - Print with line numbers
#   file_write path content             - Write content (overwrite)
#   file_append path content            - Append content
#   file_copy src dst                   - Copy file
#   file_move src dst                   - Move/rename file
#   file_size path                      - Print human-readable size
#   file_size_bytes path                - Print size in bytes
#   file_count_lines path               - Count lines
#   file_md5 path                       - Print MD5 checksum
#   file_sha256 path                    - Print SHA256 checksum
#   file_extension "filename"           - Print extension (txt, pdf, etc.)
#   file_basename "/path/to/file"       - Print filename
#   file_dirname "/path/to/file"        - Print directory
#   file_temp [suffix]                  - Print temp file path
#   file_backup path                    - Create backup with .bak suffix

[[ -n "${__file_sh_loaded:-}" ]] && return 0
__file_sh_loaded=1

file_exists() {
    [[ -e "${1:?}" ]]
}

file_is_file() {
    [[ -f "${1:?}" ]]
}

file_is_dir() {
    [[ -d "${1:?}" ]]
}

file_is_readable() {
    [[ -r "${1:?}" ]]
}

file_is_writable() {
    [[ -w "${1:?}" ]]
}

file_read() {
    local path="${1:?}"
    [[ -f "$path" ]] && cat "$path"
}

file_read_lines() {
    local path="${1:?}"
    [[ -f "$path" ]] && nl -ba "$path"
}

file_write() {
    local path="${1:?}" content="${2:-}"
    printf '%s' "$content" > "$path"
}

file_append() {
    local path="${1:?}" content="${2:-}"
    printf '%s' "$content" >> "$path"
}

file_copy() {
    local src="${1:?}" dst="${2:?}"
    [[ -f "$src" ]] && cp -f "$src" "$dst"
}

file_move() {
    local src="${1:?}" dst="${2:?}"
    [[ -f "$src" ]] && mv -f "$src" "$dst"
}

file_size() {
    local path="${1:?}"
    [[ ! -e "$path" ]] && echo "0B" && return
    local bytes
    bytes=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path" 2>/dev/null || echo 0)
    if ((bytes < 1024)); then
        echo "${bytes}B"
    elif ((bytes < 1048576)); then
        echo "$((bytes / 1024))KB"
    elif ((bytes < 1073741824)); then
        echo "$((bytes / 1048576))MB"
    else
        echo "$((bytes / 1073741824))GB"
    fi
}

file_size_bytes() {
    local path="${1:?}"
    stat -c%s "$path" 2>/dev/null || stat -f%z "$path" 2>/dev/null || echo 0
}

file_count_lines() {
    local path="${1:?}"
    [[ -f "$path" ]] && wc -l < "$path" | tr -d ' ' || echo 0
}

file_md5() {
    local path="${1:?}"
    [[ -f "$path" ]] || return 1
    md5sum "$path" 2>/dev/null | cut -d' ' -f1 || md5 "$path" | cut -d' ' -f4
}

file_sha256() {
    local path="${1:?}"
    [[ -f "$path" ]] || return 1
    sha256sum "$path" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$path" | cut -d' ' -f1
}

file_extension() {
    local filename="${1:?}"
    printf '%s' "${filename##*.}"
}

file_basename() {
    local path="${1:?}"
    printf '%s' "${path##*/}"
}

file_dirname() {
    local path="${1:?}"
    printf '%s' "${path%/*}"
}

file_temp() {
    local suffix="${1:-}"
    local tmpdir="/tmp"
    [[ -d /data/data/com.termux/files/home/tmp ]] && tmpdir="/data/data/com.termux/files/home/tmp"
    local name
    name=$(od -An -tx1 -N16 /dev/urandom 2>/dev/null | tr -d ' \n' | head -c 32)
    [[ -z "$name" ]] && name="$$"
    printf '%s/%s%s\n' "$tmpdir" "$name" "$suffix"
}

file_backup() {
    local path="${1:?}"
    [[ -f "$path" ]] && cp -f "$path" "${path}.bak"
}
