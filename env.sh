#!/usr/bin/env bash
# shellcheck disable=SC2034
# Terminal defaults only. STRICT_MODE=1 explicitly opts into set -euo pipefail.

[[ -n "${__ENV_SH_LOADED:-}" ]] && return 0
__ENV_SH_LOADED=1
: "${SCRIPT_PATH:=${BASH_SOURCE[0]:-}}"
if [[ -z "${SCRIPT_DIR:-}" && -f "$SCRIPT_PATH" ]]; then
    SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_PATH")" && pwd)"
fi
: "${SCRIPT_DIR:=$PWD}"
if [[ -n "${CI:-}" || ! -t 0 ]]; then
    : "${NON_INTERACTIVE:=1}"
else
    : "${NON_INTERACTIVE:=0}"
fi

C_UP='' C_CLEAR_LINE='' C_RESET='' C_BOLD='' C_DIM='' C_ITALIC='' C_UNDERLINE=''
C_CURSOR_OFF='' C_CURSOR_ON=''
_lj_index=30
for _lj_color in BLACK RED GREEN YELLOW BLUE PURPLE CYAN WHITE; do
    printf -v "C_$_lj_color" '%s' ''
    printf -v "B_$_lj_color" '%s' ''
    printf -v "BG_$_lj_color" '%s' ''
    if [[ -t 1 && -z "${NO_COLOR:-}" && "${TERM:-dumb}" != dumb ]]; then
        printf -v "C_$_lj_color" '\033[0;%dm' "$_lj_index"
        printf -v "B_$_lj_color" '\033[1;%dm' "$_lj_index"
        printf -v "BG_$_lj_color" '\033[%dm' "$((_lj_index + 10))"
    fi
    _lj_index=$((_lj_index + 1))
done
unset _lj_color _lj_index
if [[ -n "$C_RED" ]]; then
    C_UP=$'\033[1A' C_CLEAR_LINE=$'\033[2K\r'
    C_RESET=$'\033[0m' C_BOLD=$'\033[1m' C_DIM=$'\033[2m'
    C_ITALIC=$'\033[3m' C_UNDERLINE=$'\033[4m'
    C_CURSOR_OFF=$'\033[?25l' C_CURSOR_ON=$'\033[?25h'
fi
case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
    *UTF-8*|*utf8*) : "${S_STEP:=➜}" "${S_DOT:=•}" "${S_DIVIDER:=──}" ;;
    *) : "${S_STEP:=->}" "${S_DOT:=*}" "${S_DIVIDER:=--}" ;;
esac

review_then_run() {
    local script="${1:?}" reply
    shift
    [[ -r "$script" && -f "$script" ]] || return 1
    if [[ "${1:-}" == --confirm ]]; then
        shift
    else
        [[ -t 0 && -t 1 ]] || { printf 'Review requires a terminal; use --confirm for an already-reviewed script.\n' >&2; return 1; }
        if command -v less >/dev/null 2>&1; then less -- "$script" || return; else cat -- "$script" || return; fi
        printf 'Run this script? [y/N] ' >&2
        IFS= read -r reply </dev/tty || return
        case "$reply" in y|Y|yes|YES) ;; *) return 1 ;; esac
    fi
    bash -- "$script" "$@"
}

if [[ "${STRICT_MODE:-0}" == 1 ]]; then set -euo pipefail; fi
