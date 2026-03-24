#!/bin/bash
# prompt.sh - Interactive prompt utilities
# Usage: source prompt.sh
#
# Functions:
#   prompt_yesno "message" [default]     - Returns 0=yes, 1=no
#   prompt_choice "msg" opt1 opt2...    - Print selected choice
#   prompt_input "label" [default]       - Read user input
#   prompt_password "label"              - Read password (no echo)
#   prompt_menu "label" 1:opt 2:opt...  - Numbered menu selection
#   prompt_spinner "msg" cmd [args...]  - Show spinner while running
#   prompt_progress current total "label" - Render progress bar
#   prompt_confirm "message"             - Confirm prompt

[[ -n "${__prompt_sh_loaded:-}" ]] && return 0
__prompt_sh_loaded=1

prompt_yesno() {
    local msg="${1:?}" default="${2:-}"
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        case "$default" in
            y|Y|yes)  return 0 ;;
            n|N|no)   return 1 ;;
            *)        return 1 ;;
        esac
    fi
    local prompt="$msg"
    case "$default" in
        y|Y|yes) prompt+=" [Y/n]: " ;;
        n|N|no)  prompt+=" [y/N]: " ;;
        *)       prompt+=" [y/n]: " ;;
    esac
    while true; do
        printf '%s' "$prompt" >&2
        read -r answer </dev/tty 2>/dev/null || { echo "tty read failed" >&2; return 1; }
        answer=${answer:-$default}
        case "$answer" in
            y|Y|yes) return 0 ;;
            n|N|no) return 1 ;;
            *) echo "Please answer y or n" >&2 ;;
        esac
    done
}

prompt_choice() {
    local msg="${1:?}" && shift
    local opts=("$@")
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        printf '%s\n' "${opts[0]}"
        return
    fi
    local i=1 opt
    echo "$msg" >&2
    for opt in "${opts[@]}"; do
        echo "  $i) $opt" >&2
        ((i++))
    done
    printf '> ' >&2
    local choice
    read -r choice </dev/tty 2>/dev/null
    if [[ -z "$choice" ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt ${#opts[@]} ]]; then
        printf '%s\n' "${opts[0]}"
    else
        printf '%s\n' "${opts[$((choice - 1))]}"
    fi
}

prompt_input() {
    local label="${1:?}" default="${2:-}"
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        printf '%s\n' "$default"
        return
    fi
    if [[ -n "$default" ]]; then
        printf '%s [%s]: ' "$label" "$default" >&2
    else
        printf '%s: ' "$label" >&2
    fi
    local answer
    read -r answer </dev/tty 2>/dev/null
    printf '%s\n' "${answer:-$default}"
}

prompt_password() {
    local label="${1:-Password}"
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        return 1
    fi
    printf '%s: ' "$label" >&2
    # shellcheck disable=SC2034
    read -r -s answer </dev/tty 2>/dev/null
    echo >&2
    printf '%s\n' "$answer"
}

prompt_menu() {
    local msg="${1:?}" && shift
    local entries=("$@")
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        echo "${entries[0]}" | cut -d: -f2
        return
    fi
    local i=1 entry key val
    echo "$msg" >&2
    for entry in "${entries[@]}"; do
        key="${entry%%:*}"
        val="${entry#*:}"
        echo "  $key) $val" >&2
    done
    printf '> ' >&2
    local choice
    read -r choice </dev/tty 2>/dev/null
    for entry in "${entries[@]}"; do
        key="${entry%%:*}"
        val="${entry#*:}"
        if [[ "$choice" == "$key" ]]; then
            printf '%s\n' "$val"
            return 0
        fi
    done
    printf '%s\n' "${entries[0]}" | cut -d: -f2
}

prompt_spinner() {
    local msg="${1:?}" && shift
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        "$@" 2>&1
        return $?
    fi
    local chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local pid=$!
    local i=0
    printf ' %s ' "$msg" >&2
    while kill -0 "$pid" 2>/dev/null; do
        printf '\b\b%s\b ' "${chars:$i:1}" >&2
        i=$(( (i + 1) % ${#chars} ))
        sleep 0.1
    done
    printf '\b\b  \b\b\n' >&2
    wait "$pid"
}

prompt_progress() {
    local current="${1:?}" total="${2:?}" label="${3:-}"
    local width=40
    local percent=$((current * 100 / total))
    local filled=$((width * current / total))
    local empty=$((width - filled))
    local bar
    bar=$(printf '%*s' "$filled" '' | tr ' ' '█')
    bar+=$(printf '%*s' "$empty" '' | tr ' ' '░')
    printf '\r%s [%s] %3d%% ' "$label" "$bar" "$percent" >&2
    ((current >= total)) && echo >&2
}

prompt_confirm() {
    local msg="${1:?}"
    if [[ "${NON_INTERACTIVE:-0}" -eq 1 ]]; then
        echo "$msg" >&2
        return 1
    fi
    prompt_yesno "$msg" || {
        echo "Cancelled." >&2
        return 1
    }
}
