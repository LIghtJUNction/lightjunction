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
import lib/os.sh

write_sync_script() {
    local path="${1:?}"
    {
        printf '#!%s\nset -euo pipefail\n' "$(command -v bash)"
        printf 'export GNUPGHOME=%q\n' "${GNUPGHOME:-$HOME/.gnupg}"
        printf 'export GPG_PATH=%q\n' "$GPG_PATH"
        printf 'export LIGHTJUNCTION_GPG_URL=%q\n' "${LIGHTJUNCTION_GPG_URL:-https://github.com/LIghtJUNction.gpg}"
        printf 'export LIGHTJUNCTION_GPG_KEYSERVER=%q\n' "${LIGHTJUNCTION_GPG_KEYSERVER:-}"
        printf 'unset LIGHTJUNCTION_SSH_PUB_KEY_OUTPUT\n'
        # Reuse the same block writer locally; scheduled sync fetches keys, not code.
        declare -f warn strip_managed_block validate_managed_markers append_managed_block
        printf 'key="$(\n%s\n)"\n' "$FETCH_SCRIPT_BODY"
        cat <<'SYNC'
[[ "$key" == ssh-* && "$key" != *$'\n'* ]] || { printf 'Invalid SSH public key\n' >&2; exit 1; }
mkdir -p "$HOME/.ssh"
authorized_keys="$HOME/.ssh/authorized_keys"
begin='# >>> lightjunction managed key >>>'
end='# <<< lightjunction managed key <<<'
validate_managed_markers "$authorized_keys" "$begin" "$end" || {
    printf 'Malformed lightjunction managed key markers; authorized_keys left unchanged.\n' >&2
    exit 1
}
append_managed_block "$authorized_keys" "$begin" "$end" "$key"
chmod 700 "$HOME/.ssh"
chmod 600 "$authorized_keys"
SYNC
    } >"$path"
}
install_systemd() {
    require_sudo
    local work script=/usr/local/bin/sync-ssh-keys.sh user
    work="$(make_tmp_dir)"
    user="$(id -un)"
    write_sync_script "$work/sync"
    "${SUDO[@]}" install -m 0755 "$work/sync" "$script"
    bash "$script"
    # Quotes protect spaces in HOME. Percent signs are escaped for systemd specifiers.
    local home_escaped="${HOME//\\/\\\\}"
    home_escaped="${home_escaped//\"/\\\"}"
    home_escaped="${home_escaped//%/%%}"
    "${SUDO[@]}" tee /etc/systemd/system/ssh-key-sync.service >/dev/null <<SERVICE
[Unit]
Description=GPG SSH Key Sync
After=network-online.target

[Service]
Type=oneshot
ExecStart=$script
Environment="HOME=$home_escaped"
User=$user
SERVICE
    "${SUDO[@]}" tee /etc/systemd/system/ssh-key-sync.timer >/dev/null <<'TIMER'
[Unit]
Description=GPG SSH Key Sync Timer

[Timer]
OnCalendar=*-*-* 00,12:00:00
Persistent=true

[Install]
WantedBy=timers.target
TIMER
    "${SUDO[@]}" systemctl daemon-reload
    "${SUDO[@]}" systemctl enable --now ssh-key-sync.timer
}
main() {
    case "${1:-}" in
        -h|--help) printf '%s\n' 'Usage: bash deploy-ssh-keys.sh' 'Deploy SSH access for the lightjunction GPG identity. Termux: manual sync; Linux: systemd timer.'; return ;;
        '') ;;
        *) die "Unexpected argument: $1" ;;
    esac
    [[ -z ${SUDO_USER:-} ]] || die 'Run as the target account without sudo; privilege escalation is handled internally.'
    GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null || true)}"
    [[ -n "$GPG_PATH" ]] || die 'GPG not found.'
    # Decide platform before downloads or filesystem changes.
    os_is android || [[ -d /run/systemd/system ]] || die 'Requires Termux or a running systemd instance.'
    FETCH_SCRIPT_BODY="$(lj_fetch fetch-ssh-pub-key.sh)"
    [[ -n "$FETCH_SCRIPT_BODY" ]] || die 'Public-key helper is empty.'
    init_tmp_dirs
    trap cleanup_tmp_dirs EXIT
    if os_is android; then
        local script="$HOME/.termux/bin/sync-ssh-keys.sh" work
        mkdir -p -- "$(dirname -- "$script")"
        work="$(make_tmp_dir)"
        write_sync_script "$work/sync"
        install -m 0700 "$work/sync" "$script"
        bash "$script"
        log "Manual sync: $script"
    else
        install_systemd
    fi
}
main "$@"
