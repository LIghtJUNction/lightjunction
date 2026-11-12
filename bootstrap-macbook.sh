#!/usr/bin/env bash
set -euo pipefail

BASE="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/${LIGHTJUNCTION_REF:-main}}"
LOCAL_ROOT="${LIGHTJUNCTION_ROOT:-$(dirname -- "${BASH_SOURCE[0]:-}")}"
if [[ -f "$LOCAL_ROOT/lib/basic.sh" ]]; then
    # shellcheck source=lib/basic.sh
    source "$LOCAL_ROOT/lib/basic.sh"
else
    # shellcheck source=/dev/null
    source <(curl -fsSL --connect-timeout 10 --max-time 120 -- "$BASE/lib/basic.sh")
    wait "$!"
fi
[[ ${__BASIC_SH_LOADED:-} == 1 ]] || { printf 'Could not load lib/basic.sh\n' >&2; exit 1; }

import lib/bootstrap.sh
import lib/menu.sh

trap cleanup_tmp_dirs EXIT

load_homebrew_env() {
    local prefix=/usr/local
    [[ $(uname -m) != arm64 ]] || prefix=/opt/homebrew
    if [[ -x "$prefix/bin/brew" ]]; then
        eval "$("$prefix/bin/brew" shellenv)"
    elif command_exists brew; then
        eval "$(brew shellenv)"
    fi
}
ensure_xcode_cli_tools() {
    xcode-select -p >/dev/null 2>&1 && return 0
    local clt_dir=/Library/Developer/CommandLineTools
    if [[ -e "$clt_dir" ]]; then
        [[ ${BOOTSTRAP_REPAIR_CLT:-0} == 1 ]] || die "Inspect $clt_dir first; BOOTSTRAP_REPAIR_CLT=1 moves it to a backup."
        local backup
        backup="${clt_dir}.backup.$(date +%Y%m%d%H%M%S)"
        [[ ! -e "$backup" ]] || die "Backup already exists: $backup"
        sudo mv -- "$clt_dir" "$backup"
        sudo xcode-select --reset
    fi
    xcode-select --install || true
    die 'Install Apple Command Line Tools, then rerun this script.'
}
ensure_homebrew() {
    load_homebrew_env
    if ! command_exists brew; then
        # Keep an explicit revision; no extra checksum configuration is required.
        run_script "${HOMEBREW_INSTALL_URL:-https://raw.githubusercontent.com/Homebrew/install/fea42d9aedd20a82bea800a6898dcde19401ab1f/install.sh}"
    fi
    load_homebrew_env
    command_exists brew || die 'Homebrew was not found after installation.'
}
brew_install() {
    local kind="${1:?}" package
    shift
    for package do
        if ! brew list "--$kind" "$package" >/dev/null 2>&1; then
            brew install "--$kind" "$package" || return
        fi
    done
}
main() {
    case "${1:-}" in
        -h|--help) printf '%s\n' 'Usage: bash bootstrap-macbook.sh' '打开软件分类菜单；--list 列出软件，--dry-run 预览安装。'; return ;;
        ''|--list|--dry-run) ;;
        *) die "Unexpected argument: $1" ;;
    esac
    [[ $(uname -s) == Darwin ]] || die 'This script only supports macOS.'
    ((EUID != 0)) || die 'Run as a normal macOS administrator, without sudo.'
    case "$(uname -m)" in arm64|x86_64) ;; *) die 'Unsupported macOS architecture.' ;; esac
    menu_main brew "$@"
}
main "$@"
