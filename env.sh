#!/bin/bash
# shellcheck disable=SC2034
# env.sh - Terminal environment and color setup
# Usage: import env.sh

# Deduplication guard (must be first)
[[ -n "${__ENV_SH_LOADED:-}" ]] && return 0
__ENV_SH_LOADED=1

if [[ -z "${SCRIPT_PATH:-}" && -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" && "${BASH_SOURCE[0]}" != "-" ]]; then
    SCRIPT_PATH="${BASH_SOURCE[0]}"
fi
if [[ -z "${SCRIPT_DIR:-}" && -n "${SCRIPT_PATH:-}" && -f "$SCRIPT_PATH" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
fi
: "${SCRIPT_PATH:=}"
: "${SCRIPT_DIR:=$PWD}"
[[ -n "${CI:-}" || ! -t 0 ]] && : "${NON_INTERACTIVE:=1}" || : "${NON_INTERACTIVE:=0}"
export LC_ALL=C
if [[ "${NO_COLOR:-0}" -ne 0 || "${TERM:-}" == "dumb" || ! -t 1 ]]; then
    C_UP="\033[1A"
    C_CLEAR_LINE="\033[2K\r"
    C_RESET="" C_BOLD="" C_DIM="" C_ITALIC="" C_UNDERLINE=""
    C_BLACK="[ ] " C_RED="✘ " C_GREEN="✔ " C_YELLOW="⚠ " C_BLUE="ℹ " C_PURPLE="☂ " C_CYAN="❄ " C_WHITE="✉ "
    B_BLACK="" B_RED="" B_GREEN="" B_YELLOW="" B_BLUE="" B_PURPLE="" B_CYAN="" B_WHITE=""
    BG_BLACK="" BG_RED="" BG_GREEN="" BG_YELLOW="" BG_BLUE="" BG_PURPLE="" BG_CYAN="" BG_WHITE=""
    C_CURSOR_OFF="" C_CURSOR_ON="" C_CLEAR_LINE=""
else
    C_UP="" C_CLEAR_LINE=""
    C_RESET="\033[0m" C_BOLD="\033[1m" C_DIM="\033[2m" C_ITALIC="\033[3m" C_UNDERLINE="\033[4m"
    C_BLACK="\033[0;30m" C_RED="\033[0;31m" C_GREEN="\033[0;32m" C_YELLOW="\033[0;33m" C_BLUE="\033[0;34m" C_PURPLE="\033[0;35m" C_CYAN="\033[0;36m" C_WHITE="\033[0;37m"
    B_BLACK="\033[1;30m" B_RED="\033[1;31m" B_GREEN="\033[1;32m" B_YELLOW="\033[1;33m" B_BLUE="\033[1;34m" B_PURPLE="\033[1;35m" B_CYAN="\033[1;36m" B_WHITE="\033[1;37m"
    BG_BLACK="\033[40m"  BG_RED="\033[41m"  BG_GREEN="\033[42m"  BG_YELLOW="\033[43m"  BG_BLUE="\033[44m"  BG_PURPLE="\033[45m"  BG_CYAN="\033[46m"  BG_WHITE="\033[47m"
    C_CURSOR_OFF="\033[?25l" C_CURSOR_ON="\033[?25h" C_CLEAR_LINE="\033[2K"
fi
if [[ "${LANG:-}" == *UTF-8* ]]; then
    : "${S_STEP:="➜"}" : "${S_DOT:="•"}" : "${S_DIVIDER:="──"}"
else
    : "${S_STEP:="->"}" : "${S_DOT:="*"}" : "${S_DIVIDER:="--"}"
fi

[[ "${STRICT_MODE:-1}" -eq 1 ]] && set -euo pipefail

# ==================== SCRIPT REVIEW ====================
# Show a saved script via less and prompt for TTY confirmation.
# Expects the script path as $1.
# Returns 0 if confirmed to run, 1 otherwise.
# Usage: review_then_run <script_path> [--confirm]
review_then_run() {
    local scratch="${1:?}"; shift

    if [[ -t 0 && "${1:-}" != "--confirm" ]]; then
        printf '\n\033[1;33m=== Script Review Required ===\033[0m\n'
        printf 'Review the script below. Press \033[1;32mq\033[0m to quit without running,\n'
        printf 'or \033[1;32mG\033[0m then \033[1;32mq\033[0m to jump to end and quit.\n'
        printf 'To skip review: Ctrl+C and re-run with \033[1;36m--confirm\033[0m flag.\n'
        printf '\033[1;31m=== END OF REVIEW ===\033[0m\n\n'

        less -+X -P "Press q to quit (script will NOT run)" -- "$scratch"
        local less_tty; less_tty=$(tty 2>/dev/null)
        if [[ -z "$less_tty" || ! -t 1 ]]; then
            printf '\033[1;31mError: Not a terminal. Cannot read confirmation.\033[0m\n'
            printf 'Re-run with: \033[1;36m--confirm\033[0m to skip review.\n'
            return 1
        fi
        printf '\n\033[1;32mProceed with execution? [y/N]\033[0m: '
        read -r reply < "$less_tty"
        case "$reply" in
            [yY][eE][sS]|[yY]) ;;
            *) printf 'Aborted.\n'; return 1 ;;
        esac
        printf '\033[1;32mRunning...\033[0m\n'
    fi
    bash -- "$scratch"
}
