#!/usr/bin/env bash
# General Linux bootstrap with diagnostics, network-aware downloads, and opt-in modules.

set -euo pipefail

SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "bash" && "${BASH_SOURCE[0]}" != "-" && -f "${BASH_SOURCE[0]}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
REMOTE_BASE_URL="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"

load_lib() {
    local file="${1:?}" local_path tmp
    local_path="${SCRIPT_DIR:+$SCRIPT_DIR/}$file"
    if [[ -n "$SCRIPT_DIR" && -f "$local_path" ]]; then
        # shellcheck source=/dev/null
        source "$local_path"
        return
    fi
    if [[ -f "$file" ]]; then
        # shellcheck source=/dev/null
        source "$file"
        return
    fi
    tmp="$(mktemp)"
    curl -fsSL --connect-timeout 10 "$REMOTE_BASE_URL/$file" -o "$tmp"
    # shellcheck source=/dev/null
    source "$tmp"
    rm -f "$tmp"
}

load_lib lib/common.sh
load_lib lib/bootstrap.sh

DAED_RELEASE_TAGS=("${DAED_VERSION:-v1.23.0}" v1.21.1 v1.15.0)
CACHYOS_REPO_URL="https://mirror.cachyos.org/cachyos-repo.tar.xz"
FEATURES=()
DOMESTIC_OK=1
INTERNATIONAL_OK=1
GITHUB_OK=1

trap cleanup_tmp_dirs EXIT

require_linux() {
    [[ "$(uname -s)" == "Linux" ]] || die "This script only supports Linux."
}

os_id() {
    # shellcheck source=/dev/null
    . /etc/os-release 2>/dev/null || true
    printf '%s\n' "${ID:-unknown}"
}

os_like() {
    # shellcheck source=/dev/null
    . /etc/os-release 2>/dev/null || true
    printf '%s %s\n' "${ID:-unknown}" "${ID_LIKE:-}"
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
    printf 'Filesystems:\n'
    findmnt -no TARGET,FSTYPE,SIZE,AVAIL / /home 2>/dev/null | sort -u || true
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

check_internet_access() {
    log "Checking internet access"
    probe_url "Baidu" "https://www.baidu.com/" && DOMESTIC_OK=0
    probe_url "Cloudflare" "https://www.cloudflare.com/" && INTERNATIONAL_OK=0
    probe_url "GitHub" "https://github.com/" && GITHUB_OK=0

    if [[ "$DOMESTIC_OK" -ne 0 ]]; then
        warn "Domestic connectivity check failed; fix DNS/network before installing packages."
    fi
    if [[ "$INTERNATIONAL_OK" -ne 0 || "$GITHUB_OK" -ne 0 ]]; then
        warn "International internet or GitHub is not directly reachable; proxy/bootstrap modules are recommended."
    fi
}

ensure_base_tools() {
    command_exists awk || die "awk is required."
    command_exists tar || die "tar is required."
    command_exists curl || install_packages curl
    command_exists curl || die "curl is required."
}

pkg_family() {
    if command_exists pacman; then printf 'arch\n'
    elif command_exists apt-get; then printf 'deb\n'
    elif command_exists dnf; then printf 'dnf\n'
    elif command_exists yum; then printf 'yum\n'
    elif command_exists zypper; then printf 'zypper\n'
    elif command_exists apk; then printf 'apk\n'
    elif command_exists xbps-install; then printf 'xbps\n'
    elif command_exists emerge; then printf 'portage\n'
    elif command_exists nix-env; then printf 'nix\n'
    else printf 'unknown\n'
    fi
}

install_packages() {
    local family packages=("$@")
    [[ "${#packages[@]}" -gt 0 ]] || return
    family="$(pkg_family)"

    case "$family" in
        arch) "${SUDO[@]}" pacman -Syu --needed --noconfirm "${packages[@]}" ;;
        deb) "${SUDO[@]}" apt-get update && "${SUDO[@]}" apt-get install -y "${packages[@]}" ;;
        dnf) "${SUDO[@]}" dnf install -y "${packages[@]}" ;;
        yum) "${SUDO[@]}" yum install -y "${packages[@]}" ;;
        zypper) "${SUDO[@]}" zypper --non-interactive install "${packages[@]}" ;;
        apk) "${SUDO[@]}" apk add "${packages[@]}" ;;
        xbps) "${SUDO[@]}" xbps-install -Sy "${packages[@]}" ;;
        portage) "${SUDO[@]}" emerge --ask=n "${packages[@]}" ;;
        nix) nix-env -iA "${packages[@]}" ;;
        *) die "No supported package manager found for installing: ${packages[*]}" ;;
    esac
}

download_daed_asset() {
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
    tmp="$(make_tmp_dir)"
    log "Configuring CachyOS repositories for Arch-based Linux"
    curl -fL --retry 3 --connect-timeout 15 -o "$tmp/cachyos-repo.tar.xz" "$CACHYOS_REPO_URL"
    tar -C "$tmp" -xf "$tmp/cachyos-repo.tar.xz"
    installer="$(find "$tmp" -maxdepth 3 -type f -name 'cachyos-repo.sh' -print -quit)"
    [[ -n "$installer" ]] || die "CachyOS repository installer was not found in downloaded archive."
    chmod +x "$installer"
    ( cd "$(dirname "$installer")" && "${SUDO[@]}" ./cachyos-repo.sh )
    ok "CachyOS repository configured"
}

install_daed_deb() {
    local arch tmp deb
    arch="$(uname -m)"
    tmp="$(make_tmp_dir)"
    deb="$tmp/daed.deb"
    download_daed_asset "installer-daed-linux-$arch.deb" "$deb"
    log "Installing daed deb package"
    "${SUDO[@]}" apt-get update
    "${SUDO[@]}" apt-get install -y "$deb"
}

install_daed_rpm() {
    local arch tmp rpm
    arch="$(uname -m)"
    tmp="$(make_tmp_dir)"
    rpm="$tmp/daed.rpm"
    download_daed_asset "installer-daed-linux-$arch.rpm" "$rpm"
    log "Installing daed rpm package"
    case "$(pkg_family)" in
        dnf) "${SUDO[@]}" dnf install -y "$rpm" ;;
        yum) "${SUDO[@]}" yum localinstall -y "$rpm" ;;
        zypper) "${SUDO[@]}" zypper --non-interactive install "$rpm" ;;
        *) die "No supported RPM package manager found." ;;
    esac
}

install_daed_arch() {
    configure_cachyos_repo
    log "Installing daed with pacman"
    "${SUDO[@]}" pacman -Syu --needed --noconfirm daed
}

install_daed() {
    if command_exists daed; then
        ok "daed already installed: $(command -v daed)"
        return
    fi

    case "$(pkg_family)" in
        arch) install_daed_arch ;;
        deb) install_daed_deb ;;
        dnf|yum|zypper) install_daed_rpm ;;
        *)
            die "daed native auto-install is supported on Arch/CachyOS, Debian/Ubuntu, Fedora/RHEL, and openSUSE. Current package family: $(pkg_family)"
            ;;
    esac
}

enable_daed_service() {
    if [[ "$(ps -p 1 -o comm= 2>/dev/null || true)" != "systemd" ]]; then
        die "daed transparent proxy module requires systemd because it manages daed.service."
    fi
    log "Enabling daed service"
    if "${SUDO[@]}" systemctl enable --now daed; then
        ok "daed service is enabled and started"
    else
        warn "Could not start daed service. Check logs with: sudo journalctl -u daed -e"
    fi
    systemctl --no-pager --full status daed 2>/dev/null || true
}

module_network_daed() {
    install_daed
    enable_daed_service
}

module_fs_bees() {
    if ! findmnt -t btrfs >/dev/null 2>&1; then
        warn "No mounted btrfs filesystem found; bees only deduplicates btrfs. Skipping."
        return
    fi

    case "$(pkg_family)" in
        arch) install_packages bees ;;
        deb|dnf|yum|zypper) install_packages bees ;;
        *) warn "bees package install is not automated for package family $(pkg_family)." ;;
    esac

    warn "bees is installed but not auto-enabled. Choose target btrfs filesystem UUIDs first, then configure the distro's bees service/template."
}

module_shell() {
    case "$(pkg_family)" in
        arch) install_packages fish starship fastfetch git curl vim ;;
        deb) install_packages fish starship fastfetch git curl vim ;;
        dnf|yum|zypper) install_packages fish starship fastfetch git curl vim ;;
        apk) install_packages fish starship fastfetch git curl vim ;;
        xbps) install_packages fish-shell starship fastfetch git curl vim ;;
        *) warn "Shell tooling install is not automated for package family $(pkg_family)." ;;
    esac
    ok "Shell tools installed. Default shell is not changed automatically."
}

module_cn_desktop() {
    case "$(pkg_family)" in
        arch)
            install_packages fcitx5 fcitx5-chinese-addons fcitx5-configtool noto-fonts-cjk linuxqq
            if command_exists paru; then
                paru -S --needed --noconfirm wechat-universal-bwrap || warn "wechat AUR install failed."
            elif command_exists yay; then
                yay -S --needed --noconfirm wechat-universal-bwrap || warn "wechat AUR install failed."
            else
                warn "Install WeChat from AUR manually, for example with paru/yay package wechat-universal-bwrap."
            fi
            ;;
        deb)
            install_packages fcitx5 fcitx5-chinese-addons fcitx5-config-qt fonts-noto-cjk
            warn "QQ/WeChat Linux packages change often on Debian-family systems; install vendor debs manually after network/proxy is ready."
            ;;
        dnf|yum|zypper)
            install_packages fcitx5 fcitx5-chinese-addons fcitx5-configtool google-noto-sans-cjk-fonts
            warn "QQ/WeChat packages are not automated for this rpm-family distro."
            ;;
        *)
            warn "Chinese desktop app/input-method setup is not automated for package family $(pkg_family)."
            ;;
    esac
    warn "For fcitx5, log out and back in after configuring desktop input method environment variables if your DE does not do it automatically."
}

parse_features() {
    local raw="${BOOTSTRAP_FEATURES:-}" item
    if [[ -n "$raw" ]]; then
        raw="${raw//,/ }"
        for item in $raw; do
            FEATURES+=("$item")
        done
        return
    fi

    if [[ "$INTERNATIONAL_OK" -ne 0 || "$GITHUB_OK" -ne 0 ]]; then
        ask_yes_no "International/GitHub connectivity looks bad. Install daed transparent proxy?" y && FEATURES+=("network-daed")
    else
        ask_yes_no "Install daed transparent proxy?" n && FEATURES+=("network-daed")
    fi
    ask_yes_no "Install bees btrfs dedup tooling if btrfs is detected?" n && FEATURES+=("fs-bees")
    ask_yes_no "Install shell/dev comfort tools? fish, starship, fastfetch, git, vim" n && FEATURES+=("shell")
    ask_yes_no "Install Chinese desktop basics? fcitx5, CJK fonts, best-effort QQ/WeChat" n && FEATURES+=("cn-desktop")
    return 0
}

run_features() {
    local feature
    if [[ "${#FEATURES[@]}" -eq 0 ]]; then
        warn "No optional features selected. Set BOOTSTRAP_FEATURES=network-daed,fs-bees,shell,cn-desktop for non-interactive use."
        return
    fi

    for feature in "${FEATURES[@]}"; do
        case "$feature" in
            network-daed|daed) module_network_daed ;;
            fs-bees|bees|bee) module_fs_bees ;;
            shell) module_shell ;;
            cn-desktop|desktop-cn|chinese-desktop) module_cn_desktop ;;
            *) warn "Unknown feature '$feature'. Known: network-daed, fs-bees, shell, cn-desktop." ;;
        esac
    done
}

main() {
    require_linux
    print_system_report
    check_internet_access
    ensure_base_tools
    parse_features
    if [[ "${#FEATURES[@]}" -gt 0 ]]; then
        require_sudo
    fi
    run_features
    ok "Linux bootstrap finished"
}

main "$@"
