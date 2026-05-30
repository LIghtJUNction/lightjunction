#!/usr/bin/env bash
# Bootstrap a new macOS MacBook with common AI/developer tooling.

set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

PROFILE_MARKER_BEGIN="# >>> lightjunction macbook bootstrap >>>"
PROFILE_MARKER_END="# <<< lightjunction macbook bootstrap <<<"
SHELL_MARKER_BEGIN="# >>> lightjunction macbook shell init >>>"
SHELL_MARKER_END="# <<< lightjunction macbook shell init <<<"

require_macos() {
    [[ "$(uname -s)" == "Darwin" ]] || die "This script only supports macOS."
}

ensure_xcode_cli_tools() {
    if xcode-select -p >/dev/null 2>&1; then
        ok "Xcode Command Line Tools already installed"
        return
    fi

    log "Installing Xcode Command Line Tools"
    xcode-select --install || true
    warn "Finish the Xcode Command Line Tools installer, then rerun this script."
    exit 1
}

detect_brew_prefix() {
    if [[ "$(uname -m)" == "arm64" ]]; then
        printf '/opt/homebrew'
    else
        printf '/usr/local'
    fi
}

load_homebrew_env() {
    local prefix
    prefix="$(detect_brew_prefix)"
    if [[ -x "$prefix/bin/brew" ]]; then
        eval "$("$prefix/bin/brew" shellenv)"
    elif command -v brew >/dev/null 2>&1; then
        eval "$(brew shellenv)"
    fi
}

ensure_homebrew() {
    if ! command -v brew >/dev/null 2>&1; then
        log "Installing Homebrew"
        NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi

    load_homebrew_env
    command -v brew >/dev/null 2>&1 || die "Homebrew installed but brew is not on PATH."
    ok "Homebrew: $(brew --version | head -n 1)"
}

brew_install_formula() {
    local formula="${1:?}"
    if brew list --formula "$formula" >/dev/null 2>&1; then
        ok "$formula already installed"
    else
        log "Installing $formula"
        brew install "$formula"
    fi
}

brew_install_cask() {
    local cask="${1:?}"
    if brew list --cask "$cask" >/dev/null 2>&1; then
        ok "$cask cask already installed"
    else
        log "Installing $cask cask"
        brew install --cask "$cask"
    fi
}

append_managed_block() {
    local file="${1:?}" begin="${2:?}" end="${3:?}" body="${4:?}"
    mkdir -p "$(dirname "$file")"
    touch "$file"

    if grep -Fqx "$begin" "$file"; then
        ok "Managed block already present in $file"
        return
    fi

    {
        printf '\n%s\n' "$begin"
        printf '%s\n' "$body"
        printf '%s\n' "$end"
    } >>"$file"
    ok "Updated $file"
}

ensure_shell_env_blocks() {
    local brew_prefix zsh_profile bash_profile fish_conf
    brew_prefix="$(brew --prefix)"
    zsh_profile="$HOME/.zprofile"
    bash_profile="$HOME/.bash_profile"
    fish_conf="$HOME/.config/fish/config.fish"

    local posix_block
    posix_block="$(cat <<EOF
if [ -x "$brew_prefix/bin/brew" ]; then
    eval "\$("$brew_prefix/bin/brew" shellenv)"
fi

export BUN_INSTALL="\$HOME/.bun"
[ -d "\$BUN_INSTALL/bin" ] && export PATH="\$BUN_INSTALL/bin:\$PATH"

[ -f "\$HOME/.cargo/env" ] && . "\$HOME/.cargo/env"

[ -d "\$HOME/.local/bin" ] && export PATH="\$HOME/.local/bin:\$PATH"
EOF
)"

    local fish_block
    fish_block="$(cat <<EOF
if test -x "$brew_prefix/bin/brew"
    eval ("$brew_prefix/bin/brew" shellenv)
end

set -gx BUN_INSTALL "\$HOME/.bun"
fish_add_path -g "\$BUN_INSTALL/bin"
fish_add_path -g "\$HOME/.cargo/bin"
fish_add_path -g "\$HOME/.local/bin"
EOF
)"

    append_managed_block "$zsh_profile" "$PROFILE_MARKER_BEGIN" "$PROFILE_MARKER_END" "$posix_block"
    append_managed_block "$bash_profile" "$PROFILE_MARKER_BEGIN" "$PROFILE_MARKER_END" "$posix_block"
    append_managed_block "$fish_conf" "$SHELL_MARKER_BEGIN" "$SHELL_MARKER_END" "$fish_block"
}

ensure_bun() {
    brew_install_formula bun
    if ! command -v bun >/dev/null 2>&1; then
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
    fi
    command -v bun >/dev/null 2>&1 && ok "Bun: $(bun --version)" || warn "Bun installed but not visible until a new shell starts"
}

ensure_uv() {
    brew_install_formula uv
    command -v uv >/dev/null 2>&1 && ok "uv: $(uv --version)" || warn "uv installed but not visible until a new shell starts"
}

ensure_rust() {
    if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
        ok "Rust: $(rustc --version)"
        return
    fi

    brew_install_formula rustup-init
    log "Installing Rust toolchain with rustup"
    rustup-init -y --no-modify-path
    export PATH="$HOME/.cargo/bin:$PATH"
    ok "Rust: $(rustc --version)"
}

ensure_codex() {
    brew_install_cask codex
    if command -v codex >/dev/null 2>&1; then
        ok "Codex CLI: $(codex --version 2>/dev/null || printf 'installed')"
    else
        warn "Codex cask installed but codex is not visible until a new shell starts"
    fi

    brew_install_cask codex-app
    [[ -d "/Applications/Codex.app" ]] && ok "Codex App installed" || warn "codex-app cask installed but /Applications/Codex.app was not found"
}

ensure_cc_switch() {
    brew_install_cask cc-switch
    ok "CC Switch cask installed"
}

ensure_fish() {
    brew_install_formula fish

    local fish_path shells_file
    fish_path="$(brew --prefix)/bin/fish"
    shells_file="/etc/shells"
    [[ -x "$fish_path" ]] || die "Fish binary not found at $fish_path"

    if ! grep -Fqx "$fish_path" "$shells_file"; then
        log "Adding fish to $shells_file"
        printf '%s\n' "$fish_path" | sudo tee -a "$shells_file" >/dev/null
    fi

    if [[ "${SHELL:-}" != "$fish_path" ]]; then
        log "Changing default shell to fish"
        chsh -s "$fish_path"
        warn "Open a new terminal window to enter fish."
    else
        ok "Default shell is already fish"
    fi
}

check_environment() {
    log "Checking environment"
    local missing=0
    local expected_paths=(
        "$(brew --prefix)/bin"
        "$HOME/.bun/bin"
        "$HOME/.cargo/bin"
        "$HOME/.local/bin"
    )

    for path in "${expected_paths[@]}"; do
        if [[ ":$PATH:" != *":$path:"* ]]; then
            warn "Current PATH is missing $path; profile files were updated for new shells."
            missing=1
        fi
    done

    local commands=(brew bun uv rustc cargo fish codex)
    for cmd in "${commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            ok "$cmd -> $(command -v "$cmd")"
        else
            warn "$cmd is not visible in current shell"
            missing=1
        fi
    done

    if [[ "$missing" -eq 0 ]]; then
        ok "Environment looks ready"
    else
        warn "Some changes require opening a new terminal, or running: source ~/.zprofile"
    fi
}

main() {
    require_macos
    ensure_xcode_cli_tools
    ensure_homebrew
    ensure_shell_env_blocks
    ensure_bun
    ensure_uv
    ensure_rust
    ensure_codex
    ensure_cc_switch
    ensure_fish
    check_environment
}

main "$@"
