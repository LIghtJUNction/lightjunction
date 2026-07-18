#!/bin/bash
# basic.sh - Core import() function and hook system

__IMPORTED_FILES=()

verify_sha256() {
    local file="${1:?}" expected="${2:?}" actual
    actual="$(openssl dgst -sha256 "$file" | awk '{print $2}')"
    if [[ "$actual" != "$expected" ]]; then
        printf 'import: SHA256 mismatch for %s\n' "$file" >&2
        printf '  expected: %s\n  actual:   %s\n' "$expected" "$actual" >&2
        rm -f -- "$file"
        return 1
    fi
}

require_remote_integrity() {
    local url="${1:?}" expected="${2:-}"
    [[ -n "$expected" ]] && return 0
    printf 'import: refusing URL without required SHA256: %s\n' "$url" >&2
    return 1
}

import() {
    local file="${1:?}" branch="${2:-main}" repo="${3:-lightjunction}"
    local user="${4:-lightjunction}" base_url="${5:-https://raw.githubusercontent.com}"
    local sha256="${6:-}" url="$base_url/$user/$repo/$branch/$file"
    local imported tmpfile status

    for imported in "${__IMPORTED_FILES[@]}"; do
        [[ "$imported" == "$url" ]] && return 0
    done
    require_remote_integrity "$url" "$sha256" || return 1

    tmpfile="$(mktemp)" || return 1
    if ! curl -fsSL --connect-timeout 10 --max-time 120 "$url" -o "$tmpfile"; then
        rm -f -- "$tmpfile"
        printf 'import: failed to download %s\n' "$url" >&2
        return 1
    fi
    if ! verify_sha256 "$tmpfile" "$sha256"; then
        return 1
    fi

    # shellcheck source=/dev/null
    if source "$tmpfile"; then
        status=0
    else
        status=$?
    fi
    rm -f -- "$tmpfile"
    ((status == 0)) || return "$status"
    __IMPORTED_FILES+=("$url")
}

hook() {
    local func_decl="${1:?}" func_name body
    func_name="${func_decl%%::*}"
    func_name="${func_name%%()}"

    if ! declare -f "$func_name" >/dev/null 2>&1; then
        printf "hook: function '%s' not found\n" "$func_name" >&2
        return 1
    fi
    if ! declare -f "self_$func_name" >/dev/null 2>&1; then
        eval "self_$func_name() { $func_name \"\$@\"; }"
    fi
    body="$(cat)"
    eval "$func_name() {
        local self=self_$func_name
$body
    }"
}
