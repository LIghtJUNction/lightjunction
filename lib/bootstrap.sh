#!/usr/bin/env bash
# bootstrap.sh - shared helpers for executable bootstrap scripts

[[ -n "${__lj_bootstrap_sh_loaded:-}" ]] && return 0
__lj_bootstrap_sh_loaded=1

if ! declare -f lj_err >/dev/null 2>&1; then
    if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" && "${BASH_SOURCE[0]}" != "-" && -f "${BASH_SOURCE[0]%/*}/common.sh" ]]; then
        # shellcheck source=lib/common.sh
        source "${BASH_SOURCE[0]%/*}/common.sh"
    elif [[ -f "lib/common.sh" ]]; then
        # shellcheck source=lib/common.sh
        source "lib/common.sh"
    else
        lj_err() { printf '%s\n' "$*" >&2; }
    fi
fi

LJ_TMP_ROOT="${TMPDIR:-/tmp}/lightjunction-bootstrap.$$"
SUDO=()
# shellcheck disable=SC2034 # Exported by convention for scripts sourcing this helper.
[[ "$(id -u)" -ne 0 ]] && SUDO=(sudo)

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
info() { log "$@"; }
ok() { printf '\033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

make_tmp_dir() {
    local dir
    mkdir -p "$LJ_TMP_ROOT"
    dir="$(mktemp -d "$LJ_TMP_ROOT/tmp.XXXXXX")"
    printf '%s\n' "$dir"
}

cleanup_tmp_dirs() {
    [[ -n "${LJ_TMP_ROOT:-}" && -d "$LJ_TMP_ROOT" ]] && rm -rf "$LJ_TMP_ROOT"
    return 0
}

require_sudo() {
    if [[ "$(id -u)" -eq 0 ]]; then
        return
    fi
    command_exists sudo || die "sudo is required when not running as root."
    sudo -v
}

is_interactive() {
    [[ -t 0 && -t 1 ]]
}

ask_yes_no() {
    local prompt="${1:?}" default="${2:-n}" answer suffix
    if [[ "$default" == "y" ]]; then
        suffix="[Y/n]"
    else
        suffix="[y/N]"
    fi

    if ! is_interactive; then
        [[ "$default" == "y" ]]
        return
    fi

    printf '%s %s ' "$prompt" "$suffix"
    read -r answer || answer=""
    answer="${answer:-$default}"
    [[ "$answer" =~ ^[Yy]$ ]]
}

probe_url() {
    local label="${1:?}" url="${2:?}" elapsed
    elapsed="$(curl -L --fail --silent --show-error --connect-timeout 5 --max-time 10 -o /dev/null -w '%{time_total}' "$url" 2>/dev/null || true)"
    if [[ -n "$elapsed" ]]; then
        ok "$label reachable in ${elapsed}s"
        return 0
    fi
    warn "$label unreachable: $url"
    return 1
}

select_fastest_url() {
    local original="${1:?}"
    local candidates=(
        "$original"
        "https://gh.llkk.cc/$original"
        "https://gh-proxy.com/$original"
        "https://ghproxy.net/$original"
        "https://github.moeyy.xyz/$original"
    )
    local url elapsed best_url="" best_time=""

    log "Testing GitHub download mirrors" >&2
    for url in "${candidates[@]}"; do
        elapsed="$(curl -L --fail --silent --show-error --range 0-0 --connect-timeout 8 --max-time 20 -o /dev/null -w '%{time_total}' "$url" 2>/dev/null || true)"
        if [[ -z "$elapsed" ]]; then
            warn "Mirror unavailable: $url"
            continue
        fi

        ok "Mirror ${elapsed}s: $url" >&2
        if [[ -z "$best_time" ]] || awk "BEGIN { exit !($elapsed < $best_time) }"; then
            best_time="$elapsed"
            best_url="$url"
        fi
    done

    [[ -n "$best_url" ]] || die "No usable GitHub mirror found."
    printf '%s\n' "$best_url"
}

append_managed_block() {
    local file="${1:?}" begin="${2:?}" end="${3:?}" body="${4:?}"
    local tmp
    mkdir -p "$(dirname "$file")"
    touch "$file"

    tmp="$(mktemp)"
    awk -v begin="$begin" -v end="$end" '
        $0 == begin { skip = 1; next }
        $0 == end { skip = 0; next }
        !skip { print }
    ' "$file" >"$tmp"

    {
        printf '\n%s\n' "$begin"
        printf '%s\n' "$body"
        printf '%s\n' "$end"
    } >>"$tmp"

    if cmp -s "$tmp" "$file"; then
        rm -f "$tmp"
        ok "Managed block already up to date in $file"
        return
    fi

    chmod --reference="$file" "$tmp" 2>/dev/null || true
    mv -f "$tmp" "$file"
    ok "Updated $file"
}
