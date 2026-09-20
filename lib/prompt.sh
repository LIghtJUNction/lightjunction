#!/usr/bin/env bash
# Prompts read /dev/tty, never the script's stdin. Callers keep REPLY local.

[[ -n "${__prompt_sh_loaded:-}" ]] && return 0
__prompt_sh_loaded=1

_prompt_read() {
    if [[ "${1:-}" == secret ]]; then
        IFS= read -r -s REPLY 2>/dev/null </dev/tty
    else
        IFS= read -r REPLY 2>/dev/null </dev/tty
    fi
}

prompt_yesno() {
    local message="${1:?}" default="${2:-n}" REPLY
    if [[ "${NON_INTERACTIVE:-0}" == 1 ]]; then
        [[ "$default" == y || "$default" == Y || "$default" == yes ]]
        return
    fi
    while true; do
        printf '%s [y/n, default %s]: ' "$message" "$default" >&2
        _prompt_read || return 1
        case "${REPLY:-$default}" in
            y|Y|yes|YES) return 0 ;;
            n|N|no|NO) return 1 ;;
            *) printf 'Please answer y or n.\n' >&2 ;;
        esac
    done
}

prompt_choice() {
    local message="${1:?}" REPLY='' count i=1 option
    shift
    count=$#
    ((count > 0)) || return 2
    if [[ "${NON_INTERACTIVE:-0}" != 1 ]]; then
        printf '%s\n' "$message" >&2
        for option do printf '  %s) %s\n' "$i" "$option" >&2; i=$((i + 1)); done
        printf '> ' >&2
        _prompt_read || return 1
    fi
    if [[ "$REPLY" =~ ^[1-9][0-9]*$ && ${#REPLY} -le ${#count} ]] && ((REPLY <= count)); then
        printf '%s\n' "${!REPLY}"
    else
        printf '%s\n' "$1"
    fi
}

prompt_input() {
    local label="${1:?}" default="${2:-}" REPLY=''
    if [[ "${NON_INTERACTIVE:-0}" != 1 ]]; then
        printf '%s [%s]: ' "$label" "$default" >&2
        _prompt_read || return 1
    fi
    printf '%s\n' "${REPLY:-$default}"
}

prompt_password() {
    local REPLY=''
    [[ "${NON_INTERACTIVE:-0}" != 1 ]] || return 1
    printf '%s: ' "${1:-Password}" >&2
    if ! _prompt_read secret; then printf '\n' >&2; return 1; fi
    printf '\n' >&2
    printf '%s\n' "$REPLY"
}

prompt_menu() {
    local message="${1:?}" REPLY='' entry
    shift
    (($# > 0)) || return 2
    if [[ "${NON_INTERACTIVE:-0}" != 1 ]]; then
        printf '%s\n' "$message" >&2
        for entry do printf '  %s) %s\n' "${entry%%:*}" "${entry#*:}" >&2; done
        printf '> ' >&2
        _prompt_read || return 1
        for entry do
            if [[ "$REPLY" == "${entry%%:*}" ]]; then printf '%s\n' "${entry#*:}"; return 0; fi
        done
    fi
    printf '%s\n' "${1#*:}"
}

prompt_spinner() {
    local message="${1:?}" pid i=0 status=0 chars='|/-\\'
    shift
    (($# > 0)) || return 2
    if [[ "${NON_INTERACTIVE:-0}" == 1 || ! -t 2 ]]; then "$@"; return; fi
    "$@" <&0 &
    pid=$!
    while kill -0 "$pid" 2>/dev/null; do
        printf '\r%s %s' "$message" "${chars:i++ % ${#chars}:1}" >&2
        sleep 0.1
    done
    wait "$pid" || status=$?
    printf '\r\033[2K' >&2
    return "$status"
}

prompt_progress() {
    local current="${1:?}" total="${2:?}" label="${3:-}" filled bar empty
    [[ "$current" =~ ^[0-9]+$ && "$total" =~ ^[1-9][0-9]*$ ]] || return 2
    current=$((10#$current))
    ((current <= total)) || current=$total
    filled=$((40 * current / total))
    printf -v bar '%*s' "$filled" ''
    printf -v empty '%*s' "$((40 - filled))" ''
    if [[ -t 2 && "${NON_INTERACTIVE:-0}" != 1 ]]; then printf '\r' >&2; fi
    printf '%s [%s%s] %3d%%' "$label" "${bar// /#}" "${empty// /-}" "$((100 * current / total))" >&2
    if ((current == total)) || [[ ! -t 2 || "${NON_INTERACTIVE:-0}" == 1 ]]; then printf '\n' >&2; fi
    return 0
}

prompt_confirm() { prompt_yesno "${1:?}" n; }
