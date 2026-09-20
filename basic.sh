#!/usr/bin/env bash
# Source once, then import a URL + SHA256, or use the legacy repository arguments.

[[ -n "${__BASIC_SH_LOADED:-}" ]] && return 0
__BASIC_SH_LOADED=1
__IMPORTED_FILES=()

verify_sha256() {
    local file="${1:?}" expected="${2:?}" actual
    actual="$(openssl dgst -sha256 "$file")" || return
    actual="${actual##* }"
    [[ "$actual" == "$expected" ]] && return 0
    printf 'import: SHA256 mismatch for %s\n' "$file" >&2
    printf '  expected: %s\n  actual:   %s\n' "$expected" "$actual" >&2
    return 1
}

require_remote_integrity() {
    local url="${1:?}" expected="${2:-}"
    if [[ -z "$expected" ]]; then
        printf 'import: refusing URL without required SHA256: %s\n' "$url" >&2
        return 1
    fi
    [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || {
        printf 'import: expected a lowercase SHA256 digest\n' >&2
        return 2
    }
}

import() {
    local file="${1:?}" url sha256 imported content
    case "$file" in
        https://*|http://*) url="$file"; sha256="${2:-}" ;;
        *) url="${5:-https://raw.githubusercontent.com}/${4:-lightjunction}/${3:-lightjunction}/${2:-main}/$file"
           sha256="${6:-}" ;;
    esac
    require_remote_integrity "$url" "$sha256" || return
    for imported in "${__IMPORTED_FILES[@]}"; do
        [[ "$imported" == "$url $sha256" ]] && return 0
    done
    # The sentinel preserves trailing newlines; a failed/partial download is never sourced.
    content="$(curl -fsSL --connect-timeout 10 --max-time 120 -- "$url" && printf '.')" || return
    content="${content%.}"
    verify_sha256 <(printf '%s' "$content") "$sha256" || return
    # shellcheck source=/dev/null
    source <(printf '%s' "$content") || return
    __IMPORTED_FILES+=("$url $sha256")
}

hook() {
    local func_name="${1:?}" declaration body
    func_name="${func_name%%::*}"
    func_name="${func_name%()}"
    [[ "$func_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || {
        printf 'hook: invalid function name: %s\n' "$func_name" >&2
        return 2
    }
    declaration="$(declare -f -- "$func_name")" || {
        printf "hook: function '%s' not found\n" "$func_name" >&2
        return 1
    }
    body="$(cat)" || return
    # Copy the original body, not a call back into the function being replaced.
    if ! declare -F -- "self_$func_name" >/dev/null; then
        eval "self_$declaration" || return
    fi
    eval "$func_name() {
        local self=self_$func_name
$body
    }"
}
