#!/bin/bash

_msg() {
    local lvl=$1 col=$2 msg=$3
    printf "${C_DIM}%s${C_RESET} ${col}%-5s${C_RESET} %b\n" "$(date +%H:%M:%S)" "$lvl" "$msg" >&2
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