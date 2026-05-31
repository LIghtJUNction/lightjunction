#!/bin/bash
# arr.sh - Array and associative array utilities
# Usage: source arr.sh
#
# Functions:
#   arr_join delim "${arr[@]}"         - Join array elements with delimiter
#   arr_contains "${arr[@]}" needle    - Returns 0 if element exists
#   arr_map "func" "${arr[@]}"         - Apply function to each element
#   arr_filter "func" "${arr[@]}"      - Keep elements where func returns 0
#   arr_sort "${arr[@]}"               - Sort and print one per line
#   arr_unique "${arr[@]}"             - Remove duplicates
#   arr_slice start len "${arr[@]}"    - Extract slice
#   arr_reverse "${arr[@]}"            - Reverse array
#   arr_sum "${nums[@]}"              - Sum numeric array
#   arr_avg "${nums[@]}"              - Average of numeric array
#   arr_max "${nums[@]}"               - Maximum value
#   arr_min "${nums[@]}"               - Minimum value
#   arr_first "${arr[@]}"              - Print first element
#   arr_last "${arr[@]}"               - Print last element
#   arr_size "${arr[@]}"               - Print array size

[[ -n "${__arr_sh_loaded:-}" ]] && return 0
__arr_sh_loaded=1

# shellcheck source=lib/common.sh
source "${BASH_SOURCE[0]%/*}/common.sh"

arr_join() {
    local delim="${1:?}" && shift
    local IFS="$delim"
    printf '%s' "$*"
}

arr_contains() {
    local needle="${1:?}" && shift
    local e
    for e in "$@"; do
        [[ "$e" == "$needle" ]] && return 0
    done
    return 1
}

arr_map() {
    local func="${1:?}" && shift
    lj_require_function "$func" || return 1
    local e
    for e in "$@"; do
        "$func" "$e"
    done
}

arr_filter() {
    local func="${1:?}" && shift
    lj_require_function "$func" || return 1
    local e
    for e in "$@"; do
        if "$func" "$e"; then
            printf '%s\n' "$e"
        fi
    done
}

arr_sort() {
    printf '%s\n' "$@" | sort
}

arr_unique() {
    printf '%s\n' "$@" | sort -u
}

arr_slice() {
    local start="${1:?}" len="${2:-}" count=0
    shift 2 || true
    if [[ -z "$len" ]]; then
        len=$(($# - start))
    fi
    for e in "$@"; do
        if ((count >= start && count < start + len)); then
            printf '%s\n' "$e"
        fi
        ((count++))
    done
}

arr_reverse() {
    local arr=("$@")
    local i
    for ((i = ${#arr[@]} - 1; i >= 0; i--)); do
        printf '%s\n' "${arr[$i]}"
    done
}

arr_sum() {
    local total=0 e
    for e in "$@"; do
        ((total += e))
    done
    printf '%s\n' "$total"
}

arr_avg() {
    local sum=0 count=$# e
    for e in "$@"; do
        ((sum += e))
    done
    if ((count > 0)); then
        printf '%s\n' $((sum / count))
    fi
}

arr_max() {
    (($# > 0)) || return 1
    local max="$1" e
    for e in "$@"; do
        [[ "$e" -gt "$max" ]] && max="$e"
    done
    printf '%s\n' "$max"
}

arr_min() {
    (($# > 0)) || return 1
    local min="$1" e
    for e in "$@"; do
        [[ "$e" -lt "$min" ]] && min="$e"
    done
    printf '%s\n' "$min"
}

arr_first() {
    printf '%s\n' "${1?}"
}

arr_last() {
    printf '%s\n' "${@: -1}"
}

arr_size() {
    printf '%d\n' "$#"
}
