#!/bin/bash
# os.sh - OS and platform detection utilities
# Usage: source os.sh
#
# Functions:
#   os_detect                           - Print: android, linux, darwin, bsd, windows
#   os_is linux|darwin|android|bsd     - Returns 0 if current OS matches
#   os_is_root                          - Returns 0 if running as root (EUID 0)
#   os_arch                             - Print: x86_64, aarch64, armv7l, arm64
#   os_kernel                           - Print kernel version
#   os_distro                           - Print distro name
#   os_has cmd1 [cmd2...]               - Returns 0 if all commands exist
#   os_require cmd1 [cmd2...]          - Exit 1 if any command missing
#   os_ensure_dir path                  - Create dir if not exists (mkdir -p)
#   os_tmpdir                           - Print temp directory path
#   os_random [count]                   - Print count random hex bytes (default 16)
#   os_sleep seconds                    - Sleep with fractional second support

[[ -n "${__os_sh_loaded:-}" ]] && return 0
__os_sh_loaded=1

os_detect() {
    case "$(uname -o 2>/dev/null || uname -s)" in
        Android)    echo "android" ;;
        Darwin)     echo "darwin" ;;
        Linux)
            if [[ -d /data/data/com.termux/files/home ]]; then
                echo "android"
            else
                echo "linux"
            fi
            ;;
        BSD|NetBSD|OpenBSD|FreeBSD) echo "bsd" ;;
        CYGWIN*|MINGW*|MSYS*)       echo "windows" ;;
        *)                           echo "unknown" ;;
    esac
}

os_is() {
    [[ "$(os_detect)" == "${1:?}" ]]
}

os_is_root() {
    [[ "${EUID:-$(id -u)}" -eq 0 ]]
}

os_arch() {
    local arch
    arch=$(uname -m 2>/dev/null)
    case "$arch" in
        x86_64)       echo "x86_64" ;;
        aarch64|arm64) echo "aarch64" ;;
        armv7l)        echo "armv7l" ;;
        i386|i686)    echo "i386" ;;
        *)            echo "$arch" ;;
    esac
}

os_kernel() {
    uname -r 2>/dev/null || echo "unknown"
}

os_distro() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        source /etc/os-release
        echo "${NAME:-${id:-unknown}}"
    elif [[ -f /etc/alpine-release ]]; then
        echo "alpine"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    elif [[ -d /data/data/com.termux/files/home ]]; then
        echo "termux"
    else
        echo "linux"
    fi
}

os_has() {
    local cmd
    for cmd in "$@"; do
        command -v "$cmd" >/dev/null 2>&1 || return 1
    done
}

os_require() {
    local cmd
    for cmd in "$@"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "Required command not found: $cmd" >&2
            return 1
        fi
    done
}

os_ensure_dir() {
    local dir="${1:?}"
    [[ -d "$dir" ]] || mkdir -p "$dir"
}

os_tmpdir() {
    if [[ -d /tmp ]]; then
        echo "/tmp"
    elif [[ -d /data/data/com.termux/files/home/tmp ]]; then
        echo "/data/data/com.termux/files/home/tmp"
    else
        echo "${TMPDIR:-/tmp}"
    fi
}

os_random() {
    local count="${1:-16}"
    local i
    for ((i = 0; i < count; i++)); do
        printf '%02x' $((RANDOM % 256))
    done
    echo
}

os_sleep() {
    local secs="${1:?}"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import time; time.sleep($secs)"
    elif command -v perl >/dev/null 2>&1; then
        perl -e "select(undef, undef, undef, $secs)"
    else
        sleep "$secs"
    fi
}
