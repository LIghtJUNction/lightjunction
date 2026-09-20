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

import lib/bootstrap.sh

BREW_FORMULAE=(bun uv rustup-init fish fastfetch)
BREW_CASKS=(codex codex-app cc-switch ghostty clash-verge-rev font-jetbrains-mono-nerd-font)
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
            brew install "--$kind" "$package"
        fi
    done
}
configure_shells() {
    local prefix block path fish_path
    prefix="$(brew --prefix)"
    block="$(cat <<BLOCK
if [ -x "$prefix/bin/brew" ]; then
    eval "\$("$prefix/bin/brew" shellenv)"
fi
export BUN_INSTALL="\$HOME/.bun"
[ ! -d "\$BUN_INSTALL/bin" ] || export PATH="\$BUN_INSTALL/bin:\$PATH"
[ ! -f "\$HOME/.cargo/env" ] || . "\$HOME/.cargo/env"
[ ! -d "\$HOME/.local/bin" ] || export PATH="\$HOME/.local/bin:\$PATH"
BLOCK
)"
    for path in "${ZDOTDIR:-$HOME}/.zprofile" "$HOME/.bash_profile"; do
        append_managed_block "$path" '# >>> lightjunction macbook bootstrap >>>' '# <<< lightjunction macbook bootstrap <<<' "$block"
    done
    block="$(cat <<BLOCK
if test -x "$prefix/bin/brew"
    eval ("$prefix/bin/brew" shellenv)
end
set -gx BUN_INSTALL "\$HOME/.bun"
fish_add_path -g "\$BUN_INSTALL/bin" "\$HOME/.cargo/bin" "\$HOME/.local/bin"
BLOCK
)"
    append_managed_block "${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish" '# >>> lightjunction macbook shell init >>>' '# <<< lightjunction macbook shell init <<<' "$block"
    fish_path="$prefix/bin/fish"
    [[ -x "$fish_path" ]] || die "Fish not found: $fish_path"
    if ! grep -Fqx "$fish_path" /etc/shells; then printf '%s\n' "$fish_path" | sudo tee -a /etc/shells >/dev/null; fi
    if [[ ${SHELL:-} != "$fish_path" ]]; then chsh -s "$fish_path"; fi
}
main() {
    case "${1:-}" in
        -h|--help) printf '%s\n' 'Usage: bash bootstrap-macbook.sh' 'Install developer tools and desktop apps, configure Ghostty and use Fish as the login shell.'; return ;;
        '') ;;
        *) die "Unexpected argument: $1" ;;
    esac
    [[ $(uname -s) == Darwin ]] || die 'This script only supports macOS.'
    ((EUID != 0)) || die 'Run as a normal macOS administrator, without sudo.'
    id -Gn | tr ' ' '\n' | grep -qx admin || die 'Administrator group membership is required.'
    case "$(uname -m)" in arm64|x86_64) ;; *) die 'Unsupported macOS architecture.' ;; esac
    ensure_xcode_cli_tools
    ensure_homebrew
    brew_install formula "${BREW_FORMULAE[@]}"
    brew_install cask "${BREW_CASKS[@]}"
    if ! command_exists rustc || ! command_exists cargo; then rustup-init -y --no-modify-path; fi
    configure_shells
    local ghostty_block
    ghostty_block="$(lj_fetch lib/ghostty.conf)"
    [[ -n "$ghostty_block" ]] || die 'Ghostty configuration is empty.'
    append_managed_block "$HOME/Library/Application Support/com.mitchellh.ghostty/config.ghostty" \
        '# >>> lightjunction ghostty theme >>>' '# <<< lightjunction ghostty theme <<<' "$ghostty_block"
    log 'Setup complete. Open a new terminal to use the updated shell environment.'
}
main "$@"
