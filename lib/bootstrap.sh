#!/usr/bin/env bash
# Common installer operations. No network calls or temporary directories on source.

[[ ${__lj_bootstrap_sh_loaded:-} == 1 ]] && return 0
__lj_bootstrap_sh_loaded=1
LJ_TMP_ROOT=''
SUDO=()
# shellcheck disable=SC2034
if ((EUID != 0)); then SUDO=(sudo); fi

log() { printf '==> %s\n' "$*" >&2; }
info() { log "$@"; }
ok() { printf 'OK %s\n' "$*" >&2; }
warn() { printf 'WARN %s\n' "$*" >&2; }
die() { printf 'ERR %s\n' "$*" >&2; exit 1; }
command_exists() { command -v "${1:?}" >/dev/null 2>&1; }

# Call in the parent shell so command substitutions share one private directory.
init_tmp_dirs() {
    [[ -d "$LJ_TMP_ROOT" ]] || LJ_TMP_ROOT="$(mktemp -d "${TMPDIR:-${PREFIX:-}/tmp}/lightjunction-bootstrap.XXXXXX")"
}
make_tmp_dir() {
    [[ -n "$LJ_TMP_ROOT" ]] || { warn 'Call init_tmp_dirs before make_tmp_dir.'; return 1; }
    mktemp -d "$LJ_TMP_ROOT/tmp.XXXXXX"
}
cleanup_tmp_dirs() {
    if [[ -n "$LJ_TMP_ROOT" ]]; then rm -rf -- "$LJ_TMP_ROOT"; fi
}
require_sudo() {
    ((EUID == 0)) && return 0
    command_exists sudo || die 'sudo is required when not running as root.'
    sudo -v
}
is_interactive() { [[ -t 0 && -t 1 && ${NON_INTERACTIVE:-0} != 1 ]]; }
ask_yes_no() {
    local prompt="${1:?}" default="${2:-n}" answer
    if ! is_interactive; then [[ "$default" == y ]]; return; fi
    printf '%s [y/n, default %s] ' "$prompt" "$default" >&2
    IFS= read -r answer || return 1
    [[ ${answer:-$default} == [Yy] ]]
}
probe_url() {
    local label="${1:?}" url="${2:?}" elapsed
    if elapsed="$(curl -fsSL --connect-timeout 5 --max-time 10 -o /dev/null -w '%{time_total}' -- "$url" 2>/dev/null)"; then
        ok "$label reachable in ${elapsed}s"
    else
        warn "$label unreachable: $url"
        return 1
    fi
}
select_fastest_url() {
    local original="${1:?}" url elapsed best_url='' best_time=''
    for url in "$original" "https://gh.llkk.cc/$original" "https://gh-proxy.com/$original" \
        "https://ghproxy.net/$original" "https://github.moeyy.xyz/$original"; do
        if ! elapsed="$(curl -fsSL --range 0-0 --connect-timeout 8 --max-time 20 -o /dev/null -w '%{time_total}' -- "$url" 2>/dev/null)"; then
            continue
        fi
        if [[ -z "$best_time" ]] || awk -v a="$elapsed" -v b="$best_time" 'BEGIN {exit !(a < b)}'; then
            best_time="$elapsed"
            best_url="$url"
        fi
    done
    [[ -n "$best_url" ]] || return 1
    printf '%s\n' "$best_url"
}
github_release_asset_url() {
    local owner="${1:?}" repo="${2:?}" tag="${3:?}" asset="${4:?}" response
    command_exists jq || { warn 'jq is required for release metadata.'; return 127; }
    response="$(curl -fsSL --connect-timeout 10 --max-time 30 \
        -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' \
        "https://api.github.com/repos/$owner/$repo/releases/tags/$tag")" || return
    jq -er --arg asset "$asset" '
        [.assets[]? | select(.name == $asset)] | select(length == 1) | .[0].browser_download_url
        | select(type == "string" and startswith("https://"))
    ' <<<"$response"
}
strip_managed_block() {
    local file="${1:?}" begin="${2:?}" end="${3:?}"
    [[ -f "$file" ]] || return 0
    awk -v begin="$begin" -v end="$end" '
        $0 == begin { if (inside || seen++) bad=1; inside=1; next }
        $0 == end { if (!inside || closed++) bad=1; inside=0; next }
        !inside {print}
        END { if (bad || inside || seen != closed) exit 1 }
    ' "$file"
}
validate_managed_markers() { strip_managed_block "$@" >/dev/null; }
append_managed_block() (
    local file="${1:?}" begin="${2:?}" end="${3:?}" body="${4-}" suffix="${5:-.bak}" link depth=0 tmp
    while [[ -L "$file" ]]; do
        depth=$((depth + 1)); ((depth <= 40)) || return 1
        link="$(readlink "$file")" || return
        if [[ "$link" == /* ]]; then file="$link"; else file="$(dirname -- "$file")/$link"; fi
    done
    [[ ! -e "$file" || -f "$file" ]] || return 1
    validate_managed_markers "$file" "$begin" "$end" || {
        warn "Malformed managed markers in $file; refusing to modify it."
        return 1
    }
    mkdir -p -- "$(dirname -- "$file")" || return
    tmp="$(mktemp "$(dirname -- "$file")/.managed-block.XXXXXX")" || return
    trap 'rm -f -- "$tmp"' EXIT
    if [[ -f "$file" ]]; then
        cp -p -- "$file" "$tmp" || return
        strip_managed_block "$file" "$begin" "$end" >"$tmp" || return
    fi
    printf '%s\n%s\n%s\n' "$begin" "$body" "$end" >>"$tmp" || return
    if [[ -f "$file" ]]; then
        cmp -s "$tmp" "$file" && return 0
        if [[ ! -e "$file$suffix" && ! -L "$file$suffix" ]]; then cp -p -- "$file" "$file$suffix" || return; fi
    fi
    mv -f -- "$tmp" "$file"
)
