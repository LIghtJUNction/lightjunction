#!/usr/bin/env bash
# Bootstrap a new macOS MacBook with common AI/developer tooling.

set -euo pipefail

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32mOK\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

BREW_FORMULAE=(
    bun
    uv
    rustup-init
    fish
    fastfetch
)

BREW_CASKS=(
    codex
    codex-app
    cc-switch
    ghostty
    clash-verge-rev
    font-jetbrains-mono-nerd-font
)

PROFILE_MARKER_BEGIN="# >>> lightjunction macbook bootstrap >>>"
PROFILE_MARKER_END="# <<< lightjunction macbook bootstrap <<<"
SHELL_MARKER_BEGIN="# >>> lightjunction macbook shell init >>>"
SHELL_MARKER_END="# <<< lightjunction macbook shell init <<<"
GHOSTTY_MARKER_BEGIN="# >>> lightjunction ghostty theme >>>"
GHOSTTY_MARKER_END="# <<< lightjunction ghostty theme <<<"
HIDDIFY_DMG_URL="https://github.com/hiddify/hiddify-app/releases/download/v4.1.1/Hiddify-MacOS.dmg"

require_macos() {
    [[ "$(uname -s)" == "Darwin" ]] || die "This script only supports macOS."
}

print_system_report() {
    log "System report"
    printf 'User: %s\n' "${USER:-unknown}"
    printf 'Host: %s\n' "$(hostname 2>/dev/null || printf unknown)"
    printf 'macOS: %s\n' "$(sw_vers -productVersion 2>/dev/null || printf unknown)"
    printf 'Build: %s\n' "$(sw_vers -buildVersion 2>/dev/null || printf unknown)"
    printf 'Kernel: %s\n' "$(uname -a)"
    printf 'Arch: %s\n' "$(uname -m)"
    printf 'Shell: %s\n' "${SHELL:-unknown}"
    printf 'PATH: %s\n' "$PATH"
    printf 'Disk: %s\n' "$(df -h / | awk 'NR == 2 { print $4 " free of " $2 }')"
    printf 'Default route: %s\n' "$(route -n get default 2>/dev/null | awk '/interface:|gateway:/ { printf "%s%s", sep $2, sep=" via " } END { print "" }' || printf unknown)"
    printf 'DNS: %s\n' "$(scutil --dns 2>/dev/null | awk '/nameserver\\[[0-9]+\\]/ { print $3 }' | sort -u | tr '\n' ' ' || true)"
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
    probe_url "Apple" "https://www.apple.com/" && international_ok=0
    probe_url "GitHub" "https://github.com/" && github_ok=0

    if [[ "$domestic_ok" -ne 0 ]]; then
        warn "Domestic connectivity check failed; package downloads may fail."
    fi
    if [[ "$international_ok" -ne 0 || "$github_ok" -ne 0 ]]; then
        warn "International internet or GitHub is not directly reachable; mirror-aware downloads will be used where supported."
    fi
}

require_normal_admin_user() {
    if [[ "$(id -u)" -eq 0 ]]; then
        die "Do not run this script with sudo/root. Homebrew refuses root. Run it as an Administrator user: curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh | bash"
    fi

    if ! id -Gn "${USER:?}" | tr ' ' '\n' | grep -qx admin; then
        die "Current user '$USER' is not a macOS Administrator. Log in as an Administrator user, then run this script without sudo."
    fi
}

note_xcode_cli_tools() {
    if xcode-select -p >/dev/null 2>&1; then
        ok "Xcode Command Line Tools already installed"
    else
        warn "Xcode Command Line Tools not detected."
        warn "A fresh Homebrew install requires Apple's git from Command Line Tools."
    fi
}

install_xcode_cli_tools() {
    if xcode-select -p >/dev/null 2>&1; then
        ok "Xcode Command Line Tools already installed"
        return
    fi

    warn "macOS /usr/bin/git is only a stub until Command Line Tools are installed."
    log "Opening the Command Line Tools GUI installer"
    xcode-select --install || true
    warn "If a Command Line Tools dialog opened, click Install, wait for it to finish, then rerun this script."
    die "If no dialog appears or the installer fails, download 'Command Line Tools for Xcode' from https://developer.apple.com/download/all/ and install the .dmg manually."
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
    load_homebrew_env

    if ! command -v brew >/dev/null 2>&1; then
        install_xcode_cli_tools
        log "Installing Homebrew"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
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

install_brew_bundle() {
    local formula cask
    for formula in "${BREW_FORMULAE[@]}"; do
        brew_install_formula "$formula"
    done

    for cask in "${BREW_CASKS[@]}"; do
        brew_install_cask "$cask"
    done
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

    mv "$tmp" "$file"
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
    if ! command -v bun >/dev/null 2>&1; then
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
    fi
    command -v bun >/dev/null 2>&1 && ok "Bun: $(bun --version)" || warn "Bun installed but not visible until a new shell starts"
}

ensure_uv() {
    command -v uv >/dev/null 2>&1 && ok "uv: $(uv --version)" || warn "uv installed but not visible until a new shell starts"
}

ensure_rust() {
    if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
        ok "Rust: $(rustc --version)"
        return
    fi

    log "Installing Rust toolchain with rustup"
    rustup-init -y --no-modify-path
    export PATH="$HOME/.cargo/bin:$PATH"
    ok "Rust: $(rustc --version)"
}

ensure_codex() {
    if command -v codex >/dev/null 2>&1; then
        ok "Codex CLI: $(codex --version 2>/dev/null || printf 'installed')"
    else
        warn "Codex cask installed but codex is not visible until a new shell starts"
    fi

    [[ -d "/Applications/Codex.app" ]] && ok "Codex App installed" || warn "codex-app cask installed but /Applications/Codex.app was not found"
}

ensure_cc_switch() {
    ok "CC Switch cask installed"
}

ensure_desktop_apps() {
    [[ -d "/Applications/Ghostty.app" ]] && ok "Ghostty installed" || warn "ghostty cask installed but /Applications/Ghostty.app was not found"
    [[ -d "/Applications/Clash Verge.app" ]] && ok "Clash Verge Rev installed" || warn "clash-verge-rev cask installed but /Applications/Clash Verge.app was not found"
}

select_fastest_hiddify_url() {
    local original="${HIDDIFY_DMG_URL:?}"
    local candidates=(
        "$original"
        "https://gh.llkk.cc/$original"
        "https://gh-proxy.com/$original"
        "https://ghproxy.net/$original"
        "https://github.moeyy.xyz/$original"
    )
    local url elapsed best_url="" best_time=""

    log "Testing Hiddify download mirrors" >&2
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

    [[ -n "$best_url" ]] || die "No usable Hiddify download mirror found."
    printf '%s\n' "$best_url"
}

ensure_hiddify() {
    local app_path="/Applications/Hiddify.app"
    local tmp_dir dmg_path mount_dir url mounted_app

    if [[ -d "$app_path" ]]; then
        ok "Hiddify already installed"
        sudo xattr -dr com.apple.quarantine "$app_path" 2>/dev/null || true
        return
    fi

    tmp_dir="$(mktemp -d)"
    dmg_path="$tmp_dir/Hiddify-MacOS.dmg"
    mount_dir="$tmp_dir/mount"
    mkdir -p "$mount_dir"

    url="$(select_fastest_hiddify_url)"
    log "Downloading Hiddify from $url"
    curl -fL --retry 3 --connect-timeout 15 -o "$dmg_path" "$url"

    log "Mounting Hiddify DMG"
    hdiutil attach "$dmg_path" -nobrowse -quiet -mountpoint "$mount_dir"

    mounted_app="$(find "$mount_dir" -maxdepth 2 -type d -name 'Hiddify*.app' -print -quit)"
    if [[ -z "$mounted_app" ]]; then
        hdiutil detach "$mount_dir" -quiet || true
        rm -rf "$tmp_dir"
        die "Hiddify app bundle was not found in the mounted DMG."
    fi

    log "Installing Hiddify to /Applications"
    sudo rm -rf "$app_path"
    sudo ditto "$mounted_app" "$app_path"
    sudo xattr -dr com.apple.quarantine "$app_path" 2>/dev/null || true
    sudo chmod -R u+rwX,go+rX "$app_path"

    hdiutil detach "$mount_dir" -quiet || true
    rm -rf "$tmp_dir"

    ok "Hiddify installed"
    open -a Hiddify || warn "Open Hiddify manually from /Applications to approve macOS VPN/Network Extension permissions."
    warn "macOS VPN/Network Extension permissions cannot be fully granted by a shell script; approve Hiddify in the system prompt if macOS asks."
}

configure_ghostty() {
    local ghostty_config ghostty_block
    ghostty_config="$HOME/Library/Application Support/com.mitchellh.ghostty/config.ghostty"

    ghostty_block="$(cat <<'EOF'
# Typography
font-family = "JetBrainsMono Nerd Font"
font-size = 14
font-thicken = true
adjust-font-baseline = 1
adjust-underline-thickness = 1
adjust-cursor-thickness = 1

# Colors
background = #101419
foreground = #d9e2ec
selection-background = #334155
selection-foreground = #f8fafc
cursor-color = #7dd3fc
cursor-text = #101419
cursor-style = block
cursor-style-blink = false
split-divider-color = #263241
unfocused-split-opacity = 0.84
unfocused-split-fill = #0b0f14
search-background = #facc15
search-foreground = #111827
search-selected-background = #38bdf8
search-selected-foreground = #020617

palette = 0=#1f2937
palette = 1=#f87171
palette = 2=#34d399
palette = 3=#fbbf24
palette = 4=#60a5fa
palette = 5=#c084fc
palette = 6=#22d3ee
palette = 7=#e5e7eb
palette = 8=#475569
palette = 9=#fb7185
palette = 10=#4ade80
palette = 11=#fde68a
palette = 12=#93c5fd
palette = 13=#d8b4fe
palette = 14=#67e8f9
palette = 15=#ffffff

# Window
background-opacity = 0.94
background-blur = 24
window-width = 112
window-height = 32
window-padding-x = 14
window-padding-y = 12
window-padding-balance = true
window-decoration = true
window-save-state = always
window-theme = dark
window-colorspace = display-p3
macos-titlebar-style = tabs
macos-window-shadow = true
macos-window-buttons = visible
macos-icon = custom-style
macos-icon-frame = plastic
macos-icon-ghost-color = #e0f2fe
macos-icon-screen-color = #101419

# Behavior
mouse-hide-while-typing = true
mouse-scroll-multiplier = precision:0.7,discrete:3
copy-on-select = clipboard
confirm-close-surface = false
shell-integration-features = cursor,sudo,title

# Keybindings
keybind = global:cmd+grave=toggle_quick_terminal
keybind = cmd+t=new_tab
keybind = cmd+d=new_split:right
keybind = cmd+shift+d=new_split:down
keybind = cmd+w=close_surface
keybind = cmd+shift+w=close_window
keybind = cmd+shift+enter=toggle_fullscreen
keybind = cmd+plus=increase_font_size:1
keybind = cmd+minus=decrease_font_size:1
keybind = cmd+0=reset_font_size
keybind = cmd+shift+left=previous_tab
keybind = cmd+shift+right=next_tab
EOF
)"

    append_managed_block "$ghostty_config" "$GHOSTTY_MARKER_BEGIN" "$GHOSTTY_MARKER_END" "$ghostty_block"
}

ensure_fish() {
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
    print_system_report
    check_internet_access
    require_normal_admin_user
    note_xcode_cli_tools
    ensure_homebrew
    install_brew_bundle
    ensure_shell_env_blocks
    ensure_bun
    ensure_uv
    ensure_rust
    ensure_codex
    ensure_cc_switch
    ensure_desktop_apps
    ensure_hiddify
    configure_ghostty
    ensure_fish
    check_environment
}

main "$@"
