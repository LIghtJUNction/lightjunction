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

sync_enabled=1
pinentry=''
work=''
note() { printf '%s\n' "$*" >&2; }
cleanup() { if [[ -n "$work" ]]; then rm -rf -- "$work"; fi; }
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

while (($#)); do
    case "$1" in
        -h|--help)
            cat <<'HELP'
Usage: setup-gpg-agent.sh [--no-sync] [--pinentry PROGRAM]
Configure this user's GnuPG and Bash/Zsh/Fish SSH agent environment.
Install a local public-key sync command and, where available, a systemd user timer.
Run without sudo. Requires GnuPG, pinentry and curl.
--no-sync leaves an existing timer alone. Card policy and authorized_keys are unchanged.
HELP
            exit 0 ;;
        --no-sync) sync_enabled=0; shift ;;
        --pinentry)
            (($# >= 2)) && [[ -n "$2" ]] || die '--pinentry requires a program'
            pinentry="$2"; shift 2 ;;
        *) die "Unexpected argument: $1" ;;
    esac
done
[[ -z "${SUDO_USER:-}" ]] || die 'Run as your normal user, without sudo.'
lj_require gpg gpgconf gpg-connect-agent curl

strip_block() {
    strip_managed_block "$1" "# >>> lightjunction $2 >>>" "# <<< lightjunction $2 <<<"
}
write_block() {
    append_managed_block "$1" "# >>> lightjunction $2 >>>" "# <<< lightjunction $2 <<<" "$3" .lightjunction.bak
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
if ! grep -Eq '^[[:space:]]*(default|max)-cache-ttl' <<<"$existing"; then
    agent_settings+=$'\ndefault-cache-ttl 3600\nmax-cache-ttl 28800\ndefault-cache-ttl-ssh 3600\nmax-cache-ttl-ssh 28800'
fi

work="$(lj_tmpdir)"
lj_fetch fetch-ssh-pub-key.sh >"$work/fetch.sh"
[[ -s "$work/fetch.sh" ]] || die 'Public-key helper is empty.'
mkdir -p "$gpg_home" "$HOME/.ssh" "$HOME/.local/share/lightjunction" "$HOME/.local/bin"
chmod 700 "$gpg_home" "$HOME/.ssh"
LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT='' bash "$work/fetch.sh" --output "$HOME/.ssh/lightjunction-openpgp.pub"
# Public-key download must succeed before changing agent or shell configuration.
agent_before=''
if [[ -f "$agent_conf" ]]; then agent_before="$(cat "$agent_conf")"; fi
write_block "$agent_conf" gpg-agent "$agent_settings"
install -m 700 "$work/fetch.sh" "$HOME/.local/share/lightjunction/fetch-ssh-pub-key.sh"
{
    printf '#!%s\nset -euo pipefail\n' "$(command -v bash)"
    printf 'export GNUPGHOME=%q\n' "$gpg_home"
    printf 'export GPG_PATH=%q\n' "${GPG_PATH:-$(command -v gpg)}"
    printf 'export LIGHTJUNCTION_GPG_URL=%q\n' "${LIGHTJUNCTION_GPG_URL:-https://github.com/LIghtJUNction.gpg}"
    printf 'export LIGHTJUNCTION_GPG_KEYSERVER=%q\n' "${LIGHTJUNCTION_GPG_KEYSERVER:-}"
    printf 'unset LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT\n'
    printf 'exec %q %q --output %q\n' "$(command -v bash)" "$HOME/.local/share/lightjunction/fetch-ssh-pub-key.sh" "$HOME/.ssh/lightjunction-openpgp.pub"
} >"$work/sync"
install -m 700 "$work/sync" "$HOME/.local/bin/lightjunction-key-sync"

{
    printf 'export GNUPGHOME=%q\n' "$gpg_home"
    cat <<'ENV'
if command -v gpgconf >/dev/null 2>&1; then
    gpgconf --launch gpg-agent >/dev/null 2>&1 || true
    if _lj_gpg_tty=$(tty 2>/dev/null); then
        export GPG_TTY="$_lj_gpg_tty"
        gpg-connect-agent updatestartuptty /bye >/dev/null 2>&1 || true
    fi
    if [ -z "${SSH_CONNECTION:-}" ] || [ -z "${SSH_AUTH_SOCK:-}" ]; then
        if _lj_gpg_socket=$(gpgconf --list-dirs agent-ssh-socket); then
            export SSH_AUTH_SOCK="$_lj_gpg_socket"
        fi
    fi
    unset _lj_gpg_tty _lj_gpg_socket
fi
ENV
} >"$work/env"
env_path="$config_home/lightjunction/gpg-agent.sh"
write_block "$env_path" environment "$(cat "$work/env")"
source_line="$(printf '. %q' "$env_path")"
write_block "$HOME/.bashrc" gpg-agent "$source_line"
if [[ "${SHELL:-}" == */zsh || -f "${ZDOTDIR:-$HOME}/.zshrc" ]] || command -v zsh >/dev/null; then
    write_block "${ZDOTDIR:-$HOME}/.zshrc" gpg-agent "$source_line"
fi
if [[ "${SHELL:-}" == */fish || -d "$config_home/fish" ]] || command -v fish >/dev/null; then
    fish_home="${gpg_home//\\/\\\\}"
    fish_home="${fish_home//\'/\\\'}"
    fish_body="set -gx GNUPGHOME '$fish_home'"$'\n'"$(cat <<'FISH'
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
FISH
)"
    write_block "$config_home/fish/conf.d/lightjunction-gpg.fish" gpg-agent "$fish_body"
fi

if [[ "$agent_before" != "$(cat "$agent_conf")" ]]; then gpgconf --reload gpg-agent; fi
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
note 'Open a new terminal, or load the agent environment now:'
if [[ "${SHELL:-}" == */fish ]]; then note "source $config_home/fish/conf.d/lightjunction-gpg.fish"; else note "$source_line"; fi
