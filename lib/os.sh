#!/usr/bin/env bash
# Linux, macOS and Termux helpers. No package installs or global shell changes.

[[ -n "${__os_sh_loaded:-}" ]] && return 0
__os_sh_loaded=1

os_detect() {
    if [[ -n "${TERMUX_VERSION:-}" || "${PREFIX:-}" == */com.termux*/files/usr ]]; then
        printf 'android\n'
        return
    fi
    case "$(uname -s)" in
        Linux) if [[ "$(uname -o 2>/dev/null)" == Android ]]; then printf 'android\n'; else printf 'linux\n'; fi ;;
        Darwin) printf 'darwin\n' ;;
        *BSD|DragonFly) printf 'bsd\n' ;;
        CYGWIN*|MINGW*|MSYS*) printf 'windows\n' ;;
        *) printf 'unknown\n' ;;
    esac
}

os_is() { [[ "$(os_detect)" == "${1:?}" ]]; }
os_is_root() { [[ "${EUID:-$(id -u)}" -eq 0 ]]; }
os_kernel() { uname -r; }

os_arch() {
    local arch
    arch="$(uname -m)" || return
    case "$arch" in
        arm64) arch=aarch64 ;;
        i686) arch=i386 ;;
    esac
    printf '%s\n' "$arch"
}

os_distro() (
    if os_is android; then
        printf 'termux\n'
    elif [[ -r /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        printf '%s\n' "${NAME:-${ID:-unknown}}"
    else
        os_detect
    fi
)

os_has() {
    local command
    for command do command -v "$command" >/dev/null 2>&1 || return 1; done
}

os_require() {
    local command missing=0
    for command do
        if ! os_has "$command"; then
            printf 'Required command not found: %s\n' "$command" >&2
            missing=1
        fi
    done
    return "$missing"
}

os_ensure_dir() { mkdir -p -- "${1:?}"; }
os_tmpdir() { local directory="${TMPDIR:-${PREFIX:+$PREFIX/tmp}}"; printf '%s\n' "${directory:-/tmp}"; }

os_random() {
    local count="${1:-16}"
    [[ "$count" =~ ^[0-9]+$ ]] || return 2
    openssl rand -hex "$count"
}

os_sleep() {
    [[ "${1:-}" =~ ^[0-9]+([.][0-9]+)?$ ]] || return 2
    sleep "$1"
}
