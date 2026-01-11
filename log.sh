#!/bin/bash

_LAST_MSG=""
_LAST_LVL=""
_REPEAT_CNT=0
_msg() {
    local lvl=$1 col=$2 msg=$3
    local now=$(date +%H:%M:%S)
    if [[ "$msg" == "$_LAST_MSG" && "$lvl" == "$_LAST_LVL" ]]; then
        ((_REPEAT_CNT++))
        if [[ "$NON_INTERACTIVE" -eq 0 && -n "$C_UP" ]]; then
            printf "${C_UP}${C_CLEAR_LINE}${C_DIM}%s${C_RESET} ${col}%-5s${C_RESET} %b ${C_DIM}(x%d)${C_RESET}\n" \
                "$now" "$lvl" "$msg" "$((_REPEAT_CNT + 1))" >&2
            return
        fi
    else
        _REPEAT_CNT=0
    fi
    local display_lvl=$lvl
    if [[ "$lvl" == "$_LAST_LVL" && $_REPEAT_CNT -eq 0 ]]; then
        display_lvl="     " 
    fi
    printf "${C_DIM}%s${C_RESET} ${col}%-5s${C_RESET} %b\n" "$now" "$display_lvl" "$msg" >&2
    _LAST_MSG="$msg"
    _LAST_LVL="$lvl"
}

err()   { [[ ${LOG_LEVEL:-3} -ge 1 ]] && _msg "ERR"   "$C_RED"    "$1"; }
warn()  { [[ ${LOG_LEVEL:-3} -ge 2 ]] && _msg "WARN"  "$C_YELLOW" "$1"; }
ok()    { [[ ${LOG_LEVEL:-3} -ge 3 ]] && _msg "OK"    "$C_GREEN"  "$1"; }
info()  { [[ ${LOG_LEVEL:-3} -ge 3 ]] && _msg "INFO"  "$C_BLUE"   "$1"; }
debug() { [[ ${LOG_LEVEL:-3} -ge 4 ]] && _msg "DEBUG" "$C_PURPLE" "$1"; }
line() {
    printf "${C_DIM}%*s${C_RESET}\n" "${WIDTH:-80}" '' | tr ' ' "${S_DIVIDER:--}" >&2
}

export -f err warn ok info debug line