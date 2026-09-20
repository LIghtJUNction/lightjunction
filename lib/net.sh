#!/usr/bin/env bash
# Network helpers. Download-to-file replaces the target only after curl succeeds.

[[ -n "${__net_sh_loaded:-}" ]] && return 0
__net_sh_loaded=1
NET_CONNECT_TIMEOUT="${NET_CONNECT_TIMEOUT:-10}"
NET_MAX_TIME="${NET_MAX_TIME:-120}"

_net_curl() {
    local url="${1:?}"
    local opts=(-fsSL --connect-timeout "$NET_CONNECT_TIMEOUT" --max-time "$NET_MAX_TIME")
    shift
    [[ "$url" != -* ]] || return 2
    if [[ "${NET_PROGRESS:-0}" == 1 && -t 1 && "${NON_INTERACTIVE:-0}" == 0 ]]; then
        opts[0]=-#fsSL
    fi
    curl "${opts[@]}" "$@" "$url"
}

net_check() {
    local host="${1:?}" port="${2:-80}" timeout="${3:-5}"
    if command -v timeout >/dev/null 2>&1; then
        timeout "$timeout" bash -c 'exec 3<>"/dev/tcp/$1/$2"' bash "$host" "$port" 2>/dev/null
    elif command -v nc >/dev/null 2>&1; then
        nc -z -w "$timeout" "$host" "$port" >/dev/null 2>&1
    else
        curl -s --connect-timeout "$timeout" --max-time "$timeout" -- "http://$host:$port" >/dev/null 2>&1
    fi
}

net_download() (
    local url="${1:?}" output="${2:-}" directory tmp
    if [[ -z "$output" ]]; then NET_PROGRESS=1 _net_curl "$url"; return; fi
    directory="$(dirname -- "$output")" || return
    mkdir -p -- "$directory" || return
    [[ ! -d "$output" ]] || return 2
    tmp="$(mktemp "$directory/.net-download.XXXXXX")" || return
    trap 'rm -f -- "$tmp"' EXIT
    NET_PROGRESS=1 _net_curl "$url" -o "$tmp" || return
    mv -f -- "$tmp" "$output"
)

net_http_get() { _net_curl "${1:?}"; }
net_http_post() { _net_curl "${1:?}" --data-raw "${2:-}"; }
net_http_status() { _net_curl "${1:?}" --no-fail --no-location -o /dev/null -w '%{http_code}'; }
net_is_online() { net_check 1.1.1.1 443 || net_check 8.8.8.8 53; }

net_public_ip() {
    local url result
    for url in https://api.ipify.org https://icanhazip.com https://ifconfig.me/ip https://checkip.amazonaws.com; do
        if result="$(NET_CONNECT_TIMEOUT=5 NET_MAX_TIME=10 net_http_get "$url" 2>/dev/null)" && [[ -n "$result" ]]; then
            printf '%s' "$result"
            return 0
        fi
    done
    printf 'offline\n'
    return 1
}

net_dns_lookup() {
    local hostname="${1:?}" result
    if command -v getent >/dev/null 2>&1; then
        result="$(getent hosts "$hostname")" || return
        printf '%s\n' "$result" | awk 'NF {print $1; found=1; exit} END {exit !found}'
    elif command -v nslookup >/dev/null 2>&1; then
        result="$(nslookup "$hostname")" || return
        printf '%s\n' "$result" | awk '
            /^Name:/ {answer=1}
            answer && /^Address([[:space:]][0-9]+)?:[[:space:]]/ {
                sub(/^[^:]*:[[:space:]]*/, ""); print; found=1; exit
            }
            END {exit !found}'
    else
        printf 'net_dns_lookup: install getent or nslookup\n' >&2
        return 127
    fi
}

net_wait_for() {
    local host="${1:?}" port="${2:?}" duration="${3:-30}" deadline remaining
    [[ "$duration" =~ ^[1-9][0-9]*$ ]] || return 2
    deadline=$((SECONDS + duration))
    while ((SECONDS < deadline)); do
        remaining=$((deadline - SECONDS))
        ((remaining <= 5)) || remaining=5
        if net_check "$host" "$port" "$remaining"; then return 0; fi
        ((SECONDS < deadline)) || break
        sleep 1
    done
    return 1
}

net_github_latest() {
    local user="${1:?}" repo="${2:?}" response
    command -v jq >/dev/null 2>&1 || { printf 'net_github_latest: jq is required\n' >&2; return 127; }
    response="$(net_http_get "https://api.github.com/repos/$user/$repo/releases/latest")" || return
    jq -er '.tag_name | select(type == "string" and length > 0)' <<<"$response"
}
