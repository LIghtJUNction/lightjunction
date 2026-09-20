#!/usr/bin/env bash
# Array helpers. arr_contains takes the needle first; numeric helpers use integers.

[[ -n "${__arr_sh_loaded:-}" ]] && return 0
__arr_sh_loaded=1

arr_join() {
    local delimiter="${1?}" separator='' element
    shift
    for element do
        printf '%s%s' "$separator" "$element"
        separator="$delimiter"
    done
}

arr_contains() {
    local needle="${1?}" element
    shift
    for element do
        [[ "$element" == "$needle" ]] && return 0
    done
    return 1
}

_arr_callback() {
    [[ "${1:-}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] && declare -F -- "$1" >/dev/null
}

arr_map() {
    local callback="${1:?}" element
    shift
    _arr_callback "$callback" || return 2
    for element do
        "$callback" "$element" || return
    done
}

arr_filter() {
    local callback="${1:?}" element status
    shift
    _arr_callback "$callback" || return 2
    for element do
        if "$callback" "$element"; then
            printf '%s\n' "$element"
        else
            status=$?
            ((status == 1)) || return "$status"
        fi
    done
}

arr_sort() { (($# == 0)) || printf '%s\n' "$@" | sort; }
arr_unique() { (($# == 0)) || printf '%s\n' "$@" | sort -u; }

arr_slice() {
    local start="${1:?}" length="${2:-}" values
    [[ "$start" =~ ^[0-9]+$ && ( -z "$length" || "$length" =~ ^[0-9]+$ ) ]] || return 2
    shift 2 || return 2
    values=("$@")
    start=$((10#$start))
    length=${length:-${#values[@]}}
    length=$((10#$length))
    ((start < ${#values[@]} && length > 0)) || return 0
    printf '%s\n' "${values[@]:start:length}"
}

arr_reverse() {
    local values=("$@") i
    for ((i = ${#values[@]} - 1; i >= 0; i--)); do
        printf '%s\n' "${values[i]}"
    done
}

_arr_reduce() {
    local operation="$1" value result=0 first=1 count sign
    shift
    count=$#
    ((count > 0)) || [[ "$operation" == sum ]] || return 1
    for value do
        [[ "$value" =~ ^-?[0-9]+$ ]] || return 2
        sign=1
        if [[ "$value" == -* ]]; then sign=-1; value="${value#-}"; fi
        value=$((sign * 10#$value))
        case "$operation" in
            sum|avg) result=$((result + value)) ;;
            max) if ((first || value > result)); then result=$value; fi ;;
            min) if ((first || value < result)); then result=$value; fi ;;
        esac
        first=0
    done
    if [[ "$operation" == avg ]]; then result=$((result / count)); fi
    printf '%s\n' "$result"
}

arr_sum() { _arr_reduce sum "$@"; }
arr_avg() { _arr_reduce avg "$@"; }
arr_max() { _arr_reduce max "$@"; }
arr_min() { _arr_reduce min "$@"; }
arr_first() { (($# > 0)) || return 1; printf '%s\n' "$1"; }
arr_last() { (($# > 0)) || return 1; printf '%s\n' "${@: -1}"; }
arr_size() { printf '%d\n' "$#"; }
