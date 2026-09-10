#!/usr/bin/env bash
# Configure this user's YubiKey OpenPGP client; never modify card policy or SSH grants.
set -euo pipefail

BASE="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"
FETCH_SHA256="${LIGHTJUNCTION_FETCH_SHA256:-}"
if [[ "$BASE" == https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main ]]; then
    : "${FETCH_SHA256:=9a60df3d12975f83dea3d8260238aaf4b7bb91bc21dba033573147b5e625bebc}"
fi
sync_enabled=1
pinentry=''
work=''
config_tmp=''
block_changed=0
die() { printf '%s\n' "$*" >&2; exit 1; }
note() { printf '%s\n' "$*" >&2; }
cleanup() {
    [[ -z "$work" ]] || rm -rf -- "$work"
    [[ -z "$config_tmp" ]] || rm -f -- "$config_tmp"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

while (($#)); do
    case "$1" in
        -h|--help)
            cat <<'EOF'
Usage: setup-gpg-agent.sh [--no-sync] [--pinentry PROGRAM]

Configure GnuPG, Bash/Zsh/Fish integration and the OpenPGP SSH agent for this user.
Import/update LIghtJUNction's public certificate from GitHub. Install a local
key-sync command; enable a twice-daily user timer when systemd --user is available.
--no-sync leaves timer configuration alone. Existing PIN, touch, KDF, Git identity,
ownertrust, scdaemon settings and authorized_keys are never changed.
Run without sudo. Requires GnuPG, pinentry, curl and openssl.
EOF
            exit 0 ;;
        --no-sync) sync_enabled=0; shift ;;
        --pinentry)
            (($# >= 2)) && [[ -n "$2" ]] || die '--pinentry requires a program'
            pinentry="$2"; shift 2 ;;
        *) die "Unexpected argument: $1" ;;
    esac
done
[[ -z "${SUDO_USER:-}" ]] || die 'Run as your normal user, without sudo.'
[[ "$BASE" == https://* ]] || die 'Script source must use HTTPS'
[[ "$FETCH_SHA256" =~ ^[0-9a-f]{64}$ ]] || die 'A required LIGHTJUNCTION_FETCH_SHA256 is missing or invalid'
for program in gpg gpgconf gpg-connect-agent curl openssl; do
    command -v "$program" >/dev/null || die "Missing $program; install GnuPG, pinentry, curl and openssl."
done

# Remove our previous block, while rejecting damaged or duplicate boundaries.
strip_block() {
    local file="$1" name="$2"
    [[ -f "$file" ]] || return 0
    awk -v begin="# >>> lightjunction $name >>>" -v end="# <<< lightjunction $name <<<" '
        $0 == begin { if (inside || seen++) bad = 1; inside = 1; next }
        $0 == end { if (!inside || closed++) bad = 1; inside = 0; next }
        !inside { print }
        END { if (bad || inside || seen != closed) exit 1 }
    ' "$file"
}

write_block() {
    local file="$1" name="$2" body="$3" link depth=0 tmp
    block_changed=0
    # Keep symlink-based dotfile setups intact, including relative symlinks.
    while [[ -L "$file" ]]; do
        ((depth += 1)); ((depth <= 40)) || die "Symlink loop: $file"
        link="$(readlink "$file")"
        if [[ "$link" == /* ]]; then file="$link"; else file="$(dirname "$file")/$link"; fi
    done
    [[ ! -e "$file" || -f "$file" ]] || die "Not a regular file: $file"
    mkdir -p "$(dirname "$file")"
    tmp="$(mktemp "$(dirname "$file")/.lightjunction-config.XXXXXX")"
    config_tmp="$tmp"
    if [[ -f "$file" ]]; then cp -p -- "$file" "$tmp"; else chmod 600 "$tmp"; fi
    if ! strip_block "$file" "$name" >"$tmp"; then
        rm -f -- "$tmp"
        die "Malformed lightjunction $name markers in $file; file left unchanged."
    fi
    printf '# >>> lightjunction %s >>>\n%s\n# <<< lightjunction %s <<<\n' "$name" "$body" "$name" >>"$tmp"
    if [[ -f "$file" ]] && cmp -s "$tmp" "$file"; then
        rm -f -- "$tmp"
    else
        if [[ -f "$file" && ! -e "${file}.lightjunction.bak" ]]; then
            cp -p -- "$file" "${file}.lightjunction.bak"
        fi
        mv -f -- "$tmp" "$file"
        block_changed=1
    fi
    config_tmp=''
}

config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
gpg_home="$(gpgconf --list-dirs homedir)"
[[ "$gpg_home" == /* ]] || die 'GnuPG home must be an absolute path'
export GNUPGHOME="$gpg_home"
agent_conf="$gpg_home/gpg-agent.conf"
existing="$(strip_block "$agent_conf" gpg-agent)" || die 'Malformed managed gpg-agent block'
if [[ -n "$pinentry" ]]; then
    pinentry="$(command -v "$pinentry")" || die 'Requested pinentry program not found'
elif ! grep -Eq '^[[:space:]]*pinentry-program[[:space:]]' <<<"$existing"; then
    for program in pinentry-curses pinentry-tty pinentry-mac pinentry; do
        if pinentry="$(command -v "$program")"; then break; fi
    done
    [[ -n "$pinentry" ]] || die 'No pinentry found; install pinentry or use --pinentry PROGRAM.'
fi
agent_settings='enable-ssh-support'
[[ -z "$pinentry" ]] || agent_settings+=$'\n'"pinentry-program $pinentry"
# Preserve an existing cache policy. These TTLs are not card PIN-session timers.
if ! grep -Eq '^[[:space:]]*(default|max)-cache-ttl' <<<"$existing"; then
    agent_settings+=$'\ndefault-cache-ttl 3600\nmax-cache-ttl 28800\ndefault-cache-ttl-ssh 3600\nmax-cache-ttl-ssh 28800'
fi

work="$(mktemp -d)"
source_file="${BASH_SOURCE[0]:-}"
local_fetch=''
if [[ -n "$source_file" && -f "$source_file" ]]; then
    local_fetch="$(cd "$(dirname "$source_file")" && pwd)/fetch-ssh-pub-key.sh"
fi
if [[ -n "$local_fetch" && -f "$local_fetch" ]]; then
    cp -- "$local_fetch" "$work/fetch.sh"
else
    curl -fsSL --proto '=https' --proto-redir '=https' --connect-timeout 10 \
        --max-time 120 "$BASE/fetch-ssh-pub-key.sh" -o "$work/fetch.sh"
fi
actual="$(openssl dgst -sha256 "$work/fetch.sh" | awk '{print $2}')"
[[ "$actual" == "$FETCH_SHA256" ]] || die 'Public-key helper SHA256 mismatch; nothing executed.'
mkdir -p "$gpg_home" "$HOME/.ssh" "$HOME/.local/share/lightjunction" "$HOME/.local/bin"
chmod 700 "$gpg_home" "$HOME/.ssh"
# Fetch must succeed before changing agent/shell configuration or installing timers.
LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT= bash "$work/fetch.sh" --output "$HOME/.ssh/lightjunction-openpgp.pub"
write_block "$agent_conf" gpg-agent "$agent_settings"
agent_changed="$block_changed"
install -m 700 "$work/fetch.sh" "$HOME/.local/share/lightjunction/fetch-ssh-pub-key.sh"

# Store fixed, shell-quoted paths/environment so the user timer uses the same keyring.
{
    printf '#!/usr/bin/env bash\nset -euo pipefail\n'
    printf 'export GNUPGHOME=%q\n' "$gpg_home"
    printf 'export GPG_PATH=%q\n' "${GPG_PATH:-$(command -v gpg)}"
    printf 'export LIGHTJUNCTION_GPG_URL=%q\n' "${LIGHTJUNCTION_GPG_URL:-https://github.com/LIghtJUNction.gpg}"
    printf 'export LIGHTJUNCTION_GPG_KEYSERVER=%q\n' "${LIGHTJUNCTION_GPG_KEYSERVER:-}"
    printf 'unset LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT\n'
    printf 'exec bash %q --output %q\n' "$HOME/.local/share/lightjunction/fetch-ssh-pub-key.sh" "$HOME/.ssh/lightjunction-openpgp.pub"
} >"$work/sync"
install -m 700 "$work/sync" "$HOME/.local/bin/lightjunction-key-sync"

# This file is sourced in a terminal; a downloaded Bash child cannot change its parent.
{
    printf 'export GNUPGHOME=%q\n' "$gpg_home"
    cat <<'EOF'
if command -v gpgconf >/dev/null 2>&1; then
    gpgconf --launch gpg-agent >/dev/null 2>&1 || true
    if _lj_gpg_tty=$(tty 2>/dev/null); then
        export GPG_TTY="$_lj_gpg_tty"
        gpg-connect-agent updatestartuptty /bye >/dev/null 2>&1 || true
    fi
    # Keep an incoming forwarded SSH agent; use our local agent otherwise.
    if [ -z "${SSH_CONNECTION:-}" ] || [ -z "${SSH_AUTH_SOCK:-}" ]; then
        if _lj_gpg_socket=$(gpgconf --list-dirs agent-ssh-socket); then
            export SSH_AUTH_SOCK="$_lj_gpg_socket"
        fi
    fi
    unset _lj_gpg_tty _lj_gpg_socket
fi
EOF
} >"$work/env"
env_path="$config_home/lightjunction/gpg-agent.sh"
write_block "$env_path" environment "$(cat "$work/env")"
source_line="$(printf '. %q' "$env_path")"
write_block "$HOME/.bashrc" gpg-agent "$source_line"
if [[ "${SHELL:-}" == */zsh || -f "${ZDOTDIR:-$HOME}/.zshrc" ]] || command -v zsh >/dev/null; then
    write_block "${ZDOTDIR:-$HOME}/.zshrc" gpg-agent "$source_line"
fi
if [[ "${SHELL:-}" == */fish || -d "$config_home/fish" ]] || command -v fish >/dev/null; then
    # Fish has its own syntax and reads conf.d automatically.
    fish_home="${gpg_home//\\/\\\\}"
    fish_home="${fish_home//\'/\\\'}"
    fish_body="set -gx GNUPGHOME '$fish_home'"$'\n'"$(cat <<'EOF'
if status is-interactive; and type -q gpgconf
    gpgconf --launch gpg-agent >/dev/null 2>&1
    set -l current_tty (tty 2>/dev/null)
    if test $status -eq 0
        set -gx GPG_TTY $current_tty
        gpg-connect-agent updatestartuptty /bye >/dev/null 2>&1
    end
    if not set -q SSH_CONNECTION; or not set -q SSH_AUTH_SOCK
        set -gx SSH_AUTH_SOCK (gpgconf --list-dirs agent-ssh-socket)
    end
end
EOF
)"
    write_block "$config_home/fish/conf.d/lightjunction-gpg.fish" gpg-agent "$fish_body"
fi

if ((agent_changed)); then gpgconf --reload gpg-agent; fi
gpgconf --launch gpg-agent
if ! gpg --batch --card-status >/dev/null 2>&1; then
    note 'Public keys/config installed. Card not detected: connect YubiKey and run gpg --card-status.'
    note 'On Android, USB/PCSC access still requires a working Termux smartcard setup.'
fi
if ((sync_enabled)) && command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
    unit_dir="$config_home/systemd/user"
    write_block "$unit_dir/lightjunction-key-sync.service" key-sync '[Unit]
Description=Sync lightjunction public OpenPGP and SSH keys

[Service]
Type=oneshot
ExecStart="%h/.local/bin/lightjunction-key-sync"'
    write_block "$unit_dir/lightjunction-key-sync.timer" key-sync '[Unit]
Description=Sync lightjunction public keys twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=10m
Persistent=true

[Install]
WantedBy=timers.target'
    systemctl --user daemon-reload
    systemctl --user enable --now lightjunction-key-sync.timer
else
    note 'Timer configuration skipped. Manual sync: ~/.local/bin/lightjunction-key-sync'
fi
note 'Ready. Open a new terminal to load the agent environment, or source it in this terminal:'
if [[ "${SHELL:-}" == */fish ]]; then
    note "source $config_home/fish/conf.d/lightjunction-gpg.fish"
else
    note "$source_line"
fi
note 'Check: gpg --card-status; ssh-add -L. Card PIN/touch policy and authorized_keys are unchanged.'
