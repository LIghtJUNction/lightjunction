#!/bin/bash
: "${SCRIPT_PATH:=${BASH_SOURCE[0]}}"
: "${SCRIPT_DIR:=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)}"
[[ -n "${CI:-}" || ! -t 0 ]] && : "${NON_INTERACTIVE:=1}" || : "${NON_INTERACTIVE:=0}"
export LC_ALL=C
if [[ "${NO_COLOR:-0}" -ne 0 || "${TERM:-}" == "dumb" || ! -t 1 ]]; then
    C_RESET="" C_BOLD="" C_DIM="" C_ITALIC="" C_UNDERLINE=""
    C_BLACK="[ ] " C_RED="✘ " C_GREEN="✔ " C_YELLOW="⚠ " C_BLUE="ℹ " C_PURPLE="☂ " C_CYAN="❄ " C_WHITE="✉ "
    B_BLACK="" B_RED="" B_GREEN="" B_YELLOW="" B_BLUE="" B_PURPLE="" B_CYAN="" B_WHITE=""
    BG_BLACK="" BG_RED="" BG_GREEN="" BG_YELLOW="" BG_BLUE="" BG_PURPLE="" BG_CYAN="" BG_WHITE=""
    C_CURSOR_OFF="" C_CURSOR_ON="" C_CLEAR_LINE=""
else
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