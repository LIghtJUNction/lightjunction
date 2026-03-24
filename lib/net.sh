#!/bin/bash
# net.sh - Network utilities
# Usage: source net.sh
#
# Functions:
#   net_check host [port]              - Returns 0 if host:port is reachable
#   net_download url [output]         - Download with curl, show progress
#   net_http_get url                    - GET request, print body
#   net_http_post url [data]            - POST request, print body
#   net_http_status url                 - Print HTTP status code
#   net_is_online                       - Returns 0 if internet is reachable
#   net_public_ip                       - Print public IP address
#   net_dns_lookup hostname             - Resolve hostname to IP
#   net_wait_for host port [timeout]   - Retry until reachable
#   net_github_latest user repo         - Print latest release tag

[[ -n "${__net_sh_loaded:-}" ]] && return 0
__net_sh_loaded=1

net_check() {
    local host="${1:?}" port="${2:-80}"
    if command -v nc >/dev/null 2>&1; then
        nc -z -w5 "$host" "$port" >/dev/null 2>&1
    elif command -v timeout >/dev/null 2>&1; then
        timeout 5 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
    else
        curl -s --connect-timeout 5 "http://$host:$port" >/dev/null 2>&1
    fi
}

net_download() {
    local url="${1:?}" output="${2:-}"
    local opts="-fsSL"
    if [[ -t 1 ]] && [[ "${NON_INTERACTIVE:-0}" -eq 0 ]]; then
        opts="-#fsSL"
    fi
    if [[ -n "$output" ]]; then
        curl $opts -o "$output" "$url"
    else
        curl $opts "$url"
    fi
}

net_http_get() {
    local url="${1:?}"
    curl -fsSL "$url"
}

net_http_post() {
    local url="${1:?}" data="${2:-}"
    curl -fsSL -X POST -d "$data" "$url"
}

net_http_status() {
    local url="${1:?}"
    curl -s -o /dev/null -w '%{http_code}' "$url"
}

net_is_online() {
    net_check 8.8.8.8 53 || net_check 1.1.1.1 443
}

net_public_ip() {
    local ips=(
        "https://api.ipify.org"
        "https://icanhazip.com"
        "https://ifconfig.me/ip"
        "https://checkip.amazonaws.com"
    )
    local ip result
    for ip in "${ips[@]}"; do
        result=$(curl -fsSL --connect-timeout 5 "$ip" 2>/dev/null) && printf '%s' "$result" && return 0
    done
    echo "offline"
    return 1
}

net_dns_lookup() {
    local hostname="${1:?}"
    if command -v getent >/dev/null 2>&1; then
        getent hosts "$hostname" | awk '{print $2; exit}'
    elif command -v nslookup >/dev/null 2>&1; then
        nslookup "$hostname" | awk '/^Address: / {print $2; exit}'
    else
        ping -c1 -W1 "$hostname" 2>/dev/null | grep -oP '\(\K[^)]+' | head -1
    fi
}

net_wait_for() {
    local host="${1:?}" port="${2:?}" timeout="${3:-30}"
    local elapsed=0 interval=1
    while ! net_check "$host" "$port"; do
        os_sleep "$interval" 2>/dev/null || sleep "$interval"
        elapsed=$((elapsed + interval))
        if ((elapsed >= timeout)); then
            return 1
        fi
    done
    return 0
}

net_github_latest() {
    local user="${1:?}" repo="${2:?}"
    local url="https://api.github.com/repos/$user/$repo/releases/latest"
    net_http_get "$url" | grep '"tag_name"' | head -1 | grep -oP '"[^"]*"' | tr -d '"'
}
