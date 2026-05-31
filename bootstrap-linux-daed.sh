#!/usr/bin/env bash
# Bootstrap daed on Linux with mirror-aware GitHub downloads.

set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

DAED_RELEASE_TAGS=("${DAED_VERSION:-v1.23.0}" v1.21.1 v1.15.0)
CACHYOS_REPO_URL="https://mirror.cachyos.org/cachyos-repo.tar.xz"

SUDO=()
if [[ "$(id -u)" -ne 0 ]]; then
    SUDO=(sudo)
fi

require_linux() {
    [[ "$(uname -s)" == "Linux" ]] || die "This script only supports Linux."
}

require_sudo() {
    if [[ "$(id -u)" -eq 0 ]]; then
        return
    fi
    command -v sudo >/dev/null 2>&1 || die "sudo is required when not running as root."
    sudo -v
}

os_id() {
    . /etc/os-release 2>/dev/null || true
    printf '%s\n' "${ID:-unknown}"
}

os_like() {
    . /etc/os-release 2>/dev/null || true
    printf '%s %s\n' "${ID:-unknown}" "${ID_LIKE:-}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_system_report() {
    log "System report"
    printf 'User: %s\n' "${USER:-$(id -un 2>/dev/null || printf unknown)}"
    printf 'Host: %s\n' "$(hostname 2>/dev/null || printf unknown)"
    printf 'OS: %s\n' "$(awk -F= '/^PRETTY_NAME=/ { gsub(/"/, "", $2); print $2 }' /etc/os-release 2>/dev/null || printf unknown)"
    printf 'Kernel: %s\n' "$(uname -a)"
    printf 'Arch: %s\n' "$(uname -m)"
    printf 'Init: %s\n' "$(ps -p 1 -o comm= 2>/dev/null || printf unknown)"
    printf 'Virt: %s\n' "$(systemd-detect-virt 2>/dev/null || printf none)"
    printf 'Shell: %s\n' "${SHELL:-unknown}"
    printf 'PATH: %s\n' "$PATH"
    printf 'Disk: %s\n' "$(df -h / | awk 'NR == 2 { print $4 " free of " $2 }')"
    printf 'Memory: %s\n' "$(free -h 2>/dev/null | awk '/^Mem:/ { print $7 " available of " $2 }' || printf unknown)"
    printf 'Package managers:'
    command_exists apt-get && printf ' apt'
    command_exists dnf && printf ' dnf'
    command_exists yum && printf ' yum'
    command_exists zypper && printf ' zypper'
    command_exists pacman && printf ' pacman'
    command_exists paru && printf ' paru'
    command_exists yay && printf ' yay'
    command_exists apk && printf ' apk'
    command_exists xbps-install && printf ' xbps'
    command_exists emerge && printf ' portage'
    command_exists nix-env && printf ' nix'
    command_exists docker && printf ' docker'
    command_exists podman && printf ' podman'
    printf '\n'
    printf 'Default route: %s\n' "$(ip route show default 2>/dev/null | head -n 1 || printf unknown)"
    printf 'IPv4 addresses:\n'
    ip -br addr show 2>/dev/null || true
    printf 'DNS: %s\n' "$(awk '/^nameserver/ { print $2 }' /etc/resolv.conf 2>/dev/null | tr '\n' ' ')"
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

check_internet_access() {
    log "Checking internet access"
    local domestic_ok=1 international_ok=1 github_ok=1
    probe_url "Baidu" "https://www.baidu.com/" && domestic_ok=0
    probe_url "Cloudflare" "https://www.cloudflare.com/" && international_ok=0
    probe_url "GitHub" "https://github.com/" && github_ok=0

    if [[ "$domestic_ok" -ne 0 ]]; then
        warn "Domestic connectivity check failed; fix DNS/network before installing daed."
    fi
    if [[ "$international_ok" -ne 0 || "$github_ok" -ne 0 ]]; then
        warn "International internet or GitHub is not directly reachable; GitHub release downloads will use tested mirrors."
    fi
}

require_systemd() {
    if [[ "$(ps -p 1 -o comm= 2>/dev/null || true)" != "systemd" ]]; then
        warn "PID 1 is not systemd. daed can still be installed, but service enable/start may fail."
    fi
}

ensure_base_tools() {
    command_exists curl || die "curl is required to download daed."
    command_exists awk || die "awk is required."
    command_exists tar || die "tar is required."
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

download_release_asset() {
    local asset="${1:?}" output="${2:?}" tag original url
    for tag in "${DAED_RELEASE_TAGS[@]}"; do
        original="https://github.com/daeuniverse/daed/releases/download/$tag/$asset"
        if url="$(select_fastest_url "$original" 2>/dev/null)"; then
            log "Downloading $asset from daed $tag via $url"
            curl -fL --retry 3 --connect-timeout 15 -o "$output" "$url"
            return
        fi
        warn "No reachable $asset asset for daed $tag"
    done
    die "Could not find a reachable daed release asset: $asset"
}

install_daed_deb() {
    local arch tmp deb
    arch="$(uname -m)"
    tmp="$(mktemp -d)"
    deb="$tmp/daed.deb"
    download_release_asset "installer-daed-linux-$arch.deb" "$deb"
    log "Installing daed deb package"
    if command_exists apt-get; then
        "${SUDO[@]}" apt-get update
        "${SUDO[@]}" apt-get install -y "$deb"
    else
        "${SUDO[@]}" dpkg -i "$deb"
    fi
    rm -rf "$tmp"
}

install_daed_rpm() {
    local arch tmp rpm
    arch="$(uname -m)"
    tmp="$(mktemp -d)"
    rpm="$tmp/daed.rpm"
    download_release_asset "installer-daed-linux-$arch.rpm" "$rpm"
    log "Installing daed rpm package"
    if command_exists dnf; then
        "${SUDO[@]}" dnf install -y "$rpm"
    elif command_exists yum; then
        "${SUDO[@]}" yum localinstall -y "$rpm"
    elif command_exists zypper; then
        "${SUDO[@]}" zypper --non-interactive install "$rpm"
    else
        die "No supported RPM package manager found."
    fi
    rm -rf "$tmp"
}

install_daed_arch() {
    command_exists pacman || die "pacman was not found on this Arch-like system."

    configure_cachyos_repo

    log "Installing daed with pacman"
    if "${SUDO[@]}" pacman -Sy --needed --noconfirm daed; then
        return
    fi
    warn "pacman could not install daed from configured repositories."

    if command_exists paru; then
        log "Trying AUR package: daed-bin via paru"
        paru -S --needed --noconfirm daed-bin
        return
    fi

    if command_exists yay; then
        log "Trying AUR package: daed-bin via yay"
        yay -S --needed --noconfirm daed-bin
        return
    fi

    die "Arch detected but daed is not available from pacman and no paru/yay AUR helper was found."
}

configure_cachyos_repo() {
    if [[ "$(os_id)" == "cachyos" ]] || grep -q '^\[cachyos\]' /etc/pacman.conf 2>/dev/null; then
        ok "CachyOS repository already configured"
        if command_exists cachyos-rate-mirrors; then
            log "Ranking CachyOS mirrors"
            "${SUDO[@]}" cachyos-rate-mirrors || warn "cachyos-rate-mirrors failed; continuing with existing mirrorlist."
        fi
        return
    fi

    local tmp installer
    tmp="$(mktemp -d)"
    log "Configuring CachyOS repositories for Arch-based Linux"
    curl -fL --retry 3 --connect-timeout 15 -o "$tmp/cachyos-repo.tar.xz" "$CACHYOS_REPO_URL"
    tar -C "$tmp" -xf "$tmp/cachyos-repo.tar.xz"
    installer="$(find "$tmp" -maxdepth 3 -type f -name 'cachyos-repo.sh' -print -quit)"
    if [[ -z "$installer" ]]; then
        rm -rf "$tmp"
        die "CachyOS repository installer was not found in downloaded archive."
    fi
    chmod +x "$installer"

    (
        cd "$(dirname "$installer")"
        "${SUDO[@]}" ./cachyos-repo.sh
    )
    rm -rf "$tmp"
    ok "CachyOS repository configured"
}

install_daed_alpine() {
    warn "Alpine Linux does not have a first-class daed package path in this script."
    install_daed_container_fallback
}

install_daed_void() {
    warn "Void Linux does not have a first-class daed package path in this script."
    install_daed_container_fallback
}

install_daed_gentoo() {
    warn "Gentoo does not have a first-class daed package path in this script."
    install_daed_container_fallback
}

install_daed_nix() {
    warn "Nix/NixOS support is detected, but this script does not mutate NixOS configuration."
    install_daed_container_fallback
}

install_daed_container_fallback() {
    if command_exists docker; then
        warn "Falling back to Docker is not yet automated because daed needs host networking/TUN/system integration."
        die "Use a native Debian/RPM/Arch-based install path, or install daed manually from https://github.com/daeuniverse/daed/releases/latest"
    fi
    if command_exists podman; then
        warn "Falling back to Podman is not yet automated because daed needs host networking/TUN/system integration."
        die "Use a native Debian/RPM/Arch-based install path, or install daed manually from https://github.com/daeuniverse/daed/releases/latest"
    fi
    die "Unsupported distribution and no container runtime fallback was found. Install daed manually from https://github.com/daeuniverse/daed/releases/latest"
}

install_daed() {
    if command_exists daed; then
        ok "daed already installed: $(command -v daed)"
        return
    fi

    local family
    family="$(os_like)"
    case "$family" in
        *arch*)
            install_daed_arch
            ;;
        *debian*|*ubuntu*)
            install_daed_deb
            ;;
        *fedora*|*rhel*|*centos*|*suse*)
            install_daed_rpm
            ;;
        *alpine*)
            install_daed_alpine
            ;;
        *void*)
            install_daed_void
            ;;
        *gentoo*)
            install_daed_gentoo
            ;;
        *nixos*|*nix*)
            install_daed_nix
            ;;
        *)
            if command_exists apt-get || command_exists dpkg; then
                install_daed_deb
            elif command_exists dnf || command_exists yum || command_exists zypper; then
                install_daed_rpm
            elif command_exists pacman; then
                install_daed_arch
            elif command_exists apk; then
                install_daed_alpine
            elif command_exists xbps-install; then
                install_daed_void
            elif command_exists emerge; then
                install_daed_gentoo
            elif command_exists nix-env; then
                install_daed_nix
            else
                install_daed_container_fallback
            fi
            ;;
    esac
}

enable_daed_service() {
    if ! command_exists systemctl; then
        warn "systemctl not found; skip service enable/start."
        return
    fi

    log "Enabling daed service"
    if "${SUDO[@]}" systemctl enable --now daed; then
        ok "daed service is enabled and started"
    else
        warn "Could not start daed service. Check logs with: sudo journalctl -u daed -e"
    fi

    systemctl --no-pager --full status daed 2>/dev/null || true
}

main() {
    require_linux
    print_system_report
    check_internet_access
    require_sudo
    require_systemd
    ensure_base_tools
    install_daed
    enable_daed_service
    ok "daed bootstrap finished"
}

main "$@"
