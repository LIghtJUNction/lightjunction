#!/usr/bin/env bash
# String helpers: literal delimiters/replacements; lengths follow the caller's locale.

[[ -n "${__str_sh_loaded:-}" ]] && return 0
__str_sh_loaded=1

str_trim() {
    local value="${1?}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

str_split() {
    local delimiter="${1:?}" value="${2-}"
    while [[ "$value" == *"$delimiter"* ]]; do
        printf '%s\n' "${value%%"$delimiter"*}"
        value="${value#*"$delimiter"}"
    done
    printf '%s\n' "$value"
}

str_contains() { [[ "${1?}" == *"${2?}"* ]]; }
str_starts_with() { [[ "${1?}" == "${2?}"* ]]; }
str_ends_with() { [[ "${1?}" == *"${2?}" ]]; }

_str_replace() {
    local all="$1" value="${2?}" from="${3:?}" to="${4?}"
    while [[ "$value" == *"$from"* ]]; do
        printf '%s%s' "${value%%"$from"*}" "$to"
        value="${value#*"$from"}"
        [[ "$all" == 1 ]] || break
    done
    printf '%s' "$value"
}

str_replace() { _str_replace 0 "$@"; }
str_replace_all() { _str_replace 1 "$@"; }

str_repeat() {
    local value="${1?}" count="${2:?}" i
    [[ "$count" =~ ^[0-9]+$ ]] || return 2
    for ((i = 0; i < 10#$count; i++)); do printf '%s' "$value"; done
}

_str_pad() {
    local side="$1" value="${2?}" width="${3:?}" character="${4- }" count
    [[ "$width" =~ ^[0-9]+$ && ${#character} == 1 ]] || return 2
    count=$((10#$width - ${#value}))
    if [[ "$side" == right ]]; then printf '%s' "$value"; fi
    if ((count > 0)); then str_repeat "$character" "$count"; fi
    if [[ "$side" == left ]]; then printf '%s' "$value"; fi
}

str_pad_left() { _str_pad left "$@"; }
str_pad_right() { _str_pad right "$@"; }
str_length() { local value="${1?}"; printf '%s' "${#value}"; }
str_upper() { printf '%s' "${1?}" | tr '[:lower:]' '[:upper:]'; }
str_lower() { printf '%s' "${1?}" | tr '[:upper:]' '[:lower:]'; }

_str_digest() {
    local algorithm="$1" value="${2?}" digest
    digest="$(printf '%s' "$value" | openssl dgst "-$algorithm")" || return
    printf '%s\n' "${digest##* }"
}

str_hash() { _str_digest md5 "$@"; }
str_sha256() { _str_digest sha256 "$@"; }

str_uuid() {
    local hex variant
    hex="$(openssl rand -hex 16)" || return
    variant="$(printf '%x' "$((16#${hex:16:1} & 3 | 8))")"
    printf '%s-%s-4%s-%s%s-%s\n' "${hex:0:8}" "${hex:8:4}" "${hex:13:3}" "$variant" "${hex:17:3}" "${hex:20:12}"
}

# Non-secret labels only. Use openssl rand directly for tokens or credentials.
str_rand() {
    local length="${1:-32}" alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' i
    [[ "$length" =~ ^[0-9]+$ ]] || return 2
    for ((i = 0; i < 10#$length; i++)); do
        printf '%s' "${alphabet:RANDOM % ${#alphabet}:1}"
    done
}
