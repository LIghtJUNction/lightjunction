#!/bin/bash
# str.sh - String manipulation utilities
# Usage: source str.sh
#
# Functions:
#   str_trim "string"                  - Trim leading/trailing whitespace
#   str_split delim "string"           - Print split parts, one per line
#   str_contains haystack needle       - Returns 0 if substring found
#   str_starts_with string prefix      - Returns 0 if string starts with prefix
#   str_ends_with string suffix        - Returns 0 if string ends with suffix
#   str_replace string from to          - Replace first occurrence
#   str_replace_all string from to     - Replace all occurrences
#   str_repeat char count              - Print char count times
#   str_pad_left string width [char]    - Left-pad with spaces or char
#   str_pad_right string width [char]   - Right-pad with spaces or char
#   str_length "string"                 - Print character length
#   str_upper "string"                  - Convert to uppercase
#   str_lower "string"                 - Convert to lowercase
#   str_hash "string"                  - Print MD5 hash
#   str_sha256 "string"                - Print SHA256 hash
#   str_uuid                           - Generate random UUID v4
#   str_rand [len]                     - Generate random alphanumeric string

# Deduplication guard
[[ -n "${__str_sh_loaded:-}" ]] && return 0
__str_sh_loaded=1

str_trim() {
    local s="${1:?}"
    printf '%s' "$s" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

str_split() {
    local delim="${1:?}" && shift
    local s="$*"
    [[ -z "$s" ]] && return
    while [[ "$s" == *"$delim"* ]]; do
        printf '%s\n' "${s%%"$delim"*}"
        s="${s#*"$delim"}"
    done
    printf '%s\n' "$s"
}

str_contains() {
    [[ "${1:?}" == *"${2:?}"* ]]
}

str_starts_with() {
    [[ "${1:?}" == "${2:?}"* ]]
}

str_ends_with() {
    [[ "${1:?}" == *"${2:?}" ]]
}

str_replace() {
    local s="${1:?}" from="${2:?}" to="${3:?}"
    printf '%s' "${s/$from/$to}"
}

str_replace_all() {
    local s="${1:?}" from="${2:?}" to="${3:?}"
    printf '%s' "${s//$from/$to}"
}

str_repeat() {
    local char="${1:?}" count="${2:?}"
    printf '%*s' "$count" '' | tr ' ' "$char"
}

str_pad_left() {
    local s="${1:?}" width="${2:?}" char="${3:- }"
    printf '%*s' "$width" "$s" | tr ' ' "$char"
}

str_pad_right() {
    local s="${1:?}" width="${2:?}" char="${3:- }"
    printf '%-*s' "$width" "$s" | tr ' ' "$char"
}

str_length() {
    printf '%s' "${1:?}" | wc -c | tr -d ' '
}

str_upper() {
    printf '%s' "${1:?}" | tr '[:lower:]' '[:upper:]'
}

str_lower() {
    printf '%s' "${1:?}" | tr '[:upper:]' '[:lower:]'
}

str_hash() {
    printf '%s' "${1:?}" | md5sum | cut -d' ' -f1
}

str_sha256() {
    printf '%s' "${1:?}" | sha256sum | cut -d' ' -f1
}

str_uuid() {
    # Use /dev/urandom via openssl for cryptographic randomness
    local hex
    hex=$(openssl rand -hex 16)
    local variant
    variant="$(printf '%x' "$((16#${hex:16:1} & 3 | 8))")"
    printf '%s-%s-%s-%s-%s\n' \
        "${hex:0:8}" \
        "${hex:8:4}" \
        "4${hex:13:3}" \
        "${variant}${hex:17:3}" \
        "${hex:20:12}"
}

str_rand() {
    local len="${1:-32}"
    local chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    local result='' i c idx
    for ((i = 0; i < len; i++)); do
        idx=$((RANDOM % ${#chars}))
        c="${chars:$idx:1}"
        result+="$c"
    done
    printf '%s' "$result"
}
