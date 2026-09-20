#!/usr/bin/env bash
set -euo pipefail

BASE="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/${LIGHTJUNCTION_REF:-main}}"
LOCAL_ROOT="${LIGHTJUNCTION_ROOT:-$(dirname -- "${BASH_SOURCE[0]:-}")}"
if [[ -f "$LOCAL_ROOT/basic.sh" ]]; then
    # shellcheck source=basic.sh
    source "$LOCAL_ROOT/basic.sh"
else
    # shellcheck source=/dev/null
    source <(curl -fsSL --connect-timeout 10 --max-time 120 -- "$BASE/basic.sh")
    wait "$!"
fi
[[ ${__BASIC_SH_LOADED:-} == 1 ]] || { printf 'Could not load basic.sh\n' >&2; exit 1; }

import lib/common.sh
import lib/bootstrap.sh
import lib/os.sh

DAED_RELEASE_TAGS=("${DAED_VERSION:-v1.23.0}" v1.21.1 v1.15.0)
FEATURES=()
trap cleanup_tmp_dirs EXIT

pkg_family() {
    if os_is android; then printf 'termux\n'; return; fi
    local entry
    for entry in pacman:arch apt-get:deb dnf:dnf yum:yum zypper:zypper apk:apk xbps-install:xbps emerge:portage nix-env:nix; do
        if command_exists "${entry%%:*}"; then printf '%s\n' "${entry#*:}"; return; fi
    done
    printf 'unknown\n'
}
install_packages() {
    (($# > 0)) || return 0
    case "$(pkg_family)" in
        termux) pkg install -y "$@" ;;
        arch) "${SUDO[@]}" pacman -Syu --needed --noconfirm "$@" ;;
        deb) "${SUDO[@]}" apt-get update; "${SUDO[@]}" apt-get install -y "$@" ;;
        dnf|yum) "${SUDO[@]}" "$(pkg_family)" install -y "$@" ;;
        zypper) "${SUDO[@]}" zypper --non-interactive install "$@" ;;
        apk) "${SUDO[@]}" apk add "$@" ;;
        xbps) "${SUDO[@]}" xbps-install -Sy "$@" ;;
        portage) "${SUDO[@]}" emerge --ask=n "$@" ;;
        *) die "Package installation is not supported for $(pkg_family)." ;;
    esac
}
download_daed_asset() {
    local asset="${1:?}" output="${2:?}" tag url
    command_exists jq || install_packages jq
    for tag in "${DAED_RELEASE_TAGS[@]}"; do
        url="$(github_release_asset_url daeuniverse daed "$tag" "$asset")" || continue
        if curl -fL --retry 3 --connect-timeout 15 --max-time 300 -o "$output" -- "$url"; then return 0; fi
    done
    die "Could not download daed asset: $asset"
}
module_network_daed() {
    [[ -d /run/systemd/system ]] || die 'network-daed requires a running systemd instance.'
    if ! command_exists daed; then
        local family arch work package
        family="$(pkg_family)"
        arch="$(uname -m)"
        case "$family" in
            arch)
                grep -q '^\[cachyos\]' /etc/pacman.conf || die 'Configure the CachyOS repository using its official instructions first.'
                install_packages daed
                ;;
            deb|dnf|yum|zypper)
                work="$(make_tmp_dir)"
                if [[ "$family" == deb ]]; then package="$work/daed.deb"; else package="$work/daed.rpm"; fi
                download_daed_asset "installer-daed-linux-$arch.${package##*.}" "$package"
                case "$family" in
                    deb) "${SUDO[@]}" apt-get update; "${SUDO[@]}" apt-get install -y "$package" ;;
                    dnf) "${SUDO[@]}" dnf install -y "$package" ;;
                    yum) "${SUDO[@]}" yum localinstall -y "$package" ;;
                    zypper) "${SUDO[@]}" zypper --non-interactive install "$package" ;;
                esac
                ;;
            *) die "daed installation is not supported for $family." ;;
        esac
    fi
    "${SUDO[@]}" systemctl enable --now daed
}
module_fs_bees() {
    if ! command_exists findmnt || ! findmnt -t btrfs >/dev/null 2>&1; then
        warn 'No mounted btrfs filesystem; skipping bees.'
        return
    fi
    case "$(pkg_family)" in
        arch|deb|dnf|yum|zypper) install_packages bees ;;
        *) die 'bees installation is not supported on this distribution.' ;;
    esac
    log 'bees installed; select filesystem UUIDs and configure its service before enabling it.'
}
module_shell() {
    case "$(pkg_family)" in
        xbps) install_packages fish-shell starship fastfetch git curl vim ;;
        *) install_packages fish starship fastfetch git curl vim ;;
    esac
}
module_cn_desktop() {
    case "$(pkg_family)" in
        arch)
            install_packages fcitx5 fcitx5-chinese-addons fcitx5-configtool noto-fonts-cjk linuxqq
            if ((EUID == 0)); then
                warn 'Run an AUR helper as your normal user to install WeChat.'
            elif command_exists paru; then
                paru -S --needed --noconfirm wechat-universal-bwrap
            elif command_exists yay; then
                yay -S --needed --noconfirm wechat-universal-bwrap
            else
                warn 'Install WeChat separately with an AUR helper.'
            fi
            ;;
        deb) install_packages fcitx5 fcitx5-chinese-addons fcitx5-config-qt fonts-noto-cjk ;;
        dnf|yum|zypper) install_packages fcitx5 fcitx5-chinese-addons fcitx5-configtool google-noto-sans-cjk-fonts ;;
        *) die 'Chinese desktop setup is not supported on this platform.' ;;
    esac
    log 'Configure fcitx5 for your desktop session, then log in again. Vendor apps may need separate installation.'
}
parse_features() {
    local raw="${BOOTSTRAP_FEATURES:-}" feature
    if [[ -n "$raw" ]]; then
        raw="${raw//,/ }"
        read -r -a FEATURES <<<"$raw"
    elif ! is_interactive; then
        return 0
    else
        for feature in shell network-daed fs-bees cn-desktop; do
            if os_is android && [[ "$feature" != shell ]]; then continue; fi
            if ask_yes_no "Install $feature?" n; then FEATURES+=("$feature"); fi
        done
    fi
    # Validate the whole selection before installing anything.
    for feature in ${FEATURES[@]+"${FEATURES[@]}"}; do
        case "$feature" in
            shell) ;;
            network-daed|daed|fs-bees|bees|bee|cn-desktop|desktop-cn|chinese-desktop)
                if os_is android; then die "$feature is not supported in Termux; use BOOTSTRAP_FEATURES=shell."; fi
                ;;
            *) die "Unknown feature: $feature (shell, network-daed, fs-bees, cn-desktop)." ;;
        esac
    done
}
main() {
    case "${1:-}" in
        -h|--help)
            printf '%s\n' 'Usage: BOOTSTRAP_FEATURES=shell,network-daed,fs-bees,cn-desktop bash bootstrap-linux.sh' \
                'No feature selected: show platform only. Termux supports shell tooling without sudo.'
            return ;;
        '') ;;
        *) die "Unexpected argument: $1" ;;
    esac
    [[ $(uname -s) == Linux ]] || die 'This script requires Linux or Termux.'
    parse_features
    log "Platform: $(os_distro); architecture: $(uname -m)"
    ((${#FEATURES[@]} > 0)) || return 0
    if os_is android; then
        ((EUID != 0)) || die 'Run Termux package installation without root.'
        SUDO=()
    else
        require_sudo
    fi
    init_tmp_dirs
    local feature
    for feature in "${FEATURES[@]}"; do
        case "$feature" in
            shell) module_shell ;;
            network-daed|daed) module_network_daed ;;
            fs-bees|bees|bee) module_fs_bees ;;
            cn-desktop|desktop-cn|chinese-desktop) module_cn_desktop ;;
        esac
    done
}
main "$@"
