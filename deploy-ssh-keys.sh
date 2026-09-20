#!/usr/bin/env bash
# Deploy the pinned GPG identity's SSH public key; sync jobs download data only.

set -euo pipefail

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
REMOTE_BASE_URL="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"
FIRST_PARTY_RAW_BASE="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main"
COMMON_LIB_SHA256="${LIGHTJUNCTION_COMMON_LIB_SHA256:-}"
BOOTSTRAP_LIB_SHA256="${LIGHTJUNCTION_BOOTSTRAP_LIB_SHA256:-}"
OS_LIB_SHA256="${LIGHTJUNCTION_OS_LIB_SHA256:-}"
FETCH_SHA256="${LIGHTJUNCTION_FETCH_SHA256:-}"
if [[ "$REMOTE_BASE_URL" == "$FIRST_PARTY_RAW_BASE" ]]; then
    : "${FETCH_SHA256:=9a60df3d12975f83dea3d8260238aaf4b7bb91bc21dba033573147b5e625bebc}"
    : "${COMMON_LIB_SHA256:=ca059ee1633358864db21c2af98ad150823634ba44378fc6fa51fd302ac4cd86}"
    : "${BOOTSTRAP_LIB_SHA256:=ddda9419f326510a438ba6236e8f7f772e4cde1ae7511d71852f99ae8bea8e90}"
    : "${OS_LIB_SHA256:=ec5ff88f044b0bc1cc13a13581df179eb0cc8684cd35674804912a424aad10ca}"
fi

# REPLY belongs to the caller. Buffer before verification so partial downloads never run.
fetch_verified() {
    local file="${1:?}" expected="${2:-}" actual
    [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || {
        printf 'Required SHA256 is missing or invalid: %s\n' "$file" >&2
        return 1
    }
    REPLY="$(curl -fsSL --proto '=https' --proto-redir '=https' \
        --connect-timeout 10 --max-time 120 -- "$REMOTE_BASE_URL/$file" && printf '.')" || return
    REPLY="${REPLY%.}"
    actual="$(openssl dgst -sha256 <(printf '%s' "$REPLY"))" || return
    [[ "${actual##* }" == "$expected" ]] || {
        printf 'SHA256 mismatch for %s\n' "$file" >&2
        return 1
    }
}

import() {
    local REPLY
    fetch_verified "$@" || return
    # shellcheck source=/dev/null
    source <(printf '%s' "$REPLY")
}

import lib/common.sh "$COMMON_LIB_SHA256"
import lib/bootstrap.sh "$BOOTSTRAP_LIB_SHA256"
import lib/os.sh "$OS_LIB_SHA256"

find_gpg() {
    command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null || true
}

download_fetch_script() {
    local REPLY
    fetch_verified fetch-ssh-pub-key.sh "$FETCH_SHA256" || return
    printf '%s' "$REPLY"
}

write_sync_script() {
    local path="${1:?}"
    cat >"$path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

KEY_ID="$KEY_ID"
GPG_PATH="\${GPG_PATH:-\$(command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null || true)}"
[[ -n "\$GPG_PATH" ]] || { printf 'GPG not found\n' >&2; exit 1; }
mkdir -p "\$HOME/.ssh"
# Run the embedded helper in a subshell so its cleanup traps stay isolated.
key="\$(
$FETCH_SCRIPT_BODY
)"
[[ "\$key" == ssh-* ]] || { printf 'GPG did not export a valid SSH public key\n' >&2; exit 1; }
authorized_keys="\$HOME/.ssh/authorized_keys"
tmp="\$(mktemp "\$HOME/.ssh/authorized_keys.XXXXXX")"
cleanup() { rm -f -- "\$tmp"; }
trap cleanup EXIT
trap 'exit 130' HUP INT TERM
begin='# >>> lightjunction managed key >>>'
end='# <<< lightjunction managed key <<<'
if [[ -f "\$authorized_keys" ]]; then
    if ! awk -v begin="\$begin" -v end="\$end" '
        \$0 == begin {
            if (inside || seen_begin) exit 1
            inside = 1
            seen_begin = 1
            next
        }
        \$0 == end {
            if (!inside || seen_end) exit 1
            inside = 0
            seen_end = 1
            next
        }
        END { if (inside || seen_begin != seen_end) exit 1 }
    ' "\$authorized_keys"; then
        printf 'Malformed lightjunction managed key markers; refusing to modify authorized_keys.\n' >&2
        exit 1
    fi
    awk -v begin="\$begin" -v end="\$end" '
        \$0 == begin { skip = 1; next }
        \$0 == end { skip = 0; next }
        !skip { print }
    ' "\$authorized_keys" > "\$tmp"
fi
{
    printf '%s\n' "\$begin"
    printf '%s\n' "\$key"
    printf '%s\n' "\$end"
} >> "\$tmp"
chmod 600 "\$tmp"
if [[ -f "\$authorized_keys" ]]; then
    cp -p -- "\$authorized_keys" "\${authorized_keys}.bak"
fi
mv -f -- "\$tmp" "\$authorized_keys"
trap - EXIT HUP INT TERM
chmod 700 "\$HOME/.ssh"
EOF
}

install_termux() {
    info "Termux detected"
    local sync_script="$HOME/.termux/bin/sync-ssh-keys.sh"
    os_ensure_dir "$(dirname "$sync_script")"
    os_ensure_dir "$HOME/.ssh"
    write_sync_script "$sync_script"
    chmod +x "$sync_script"
    bash "$sync_script"
    ok "SSH key deployed to ~/.ssh/authorized_keys"
}

install_systemd() {
    info "Linux (systemd) detected"
    require_sudo
    os_ensure_dir "$HOME/.ssh"
    local tmp sync_script="/usr/local/bin/sync-ssh-keys.sh"
    tmp="$(mktemp)"
    write_sync_script "$tmp"
    "${SUDO[@]}" install -m 0755 "$tmp" "$sync_script"
    rm -f "$tmp"
    bash "$sync_script"

    "${SUDO[@]}" tee /etc/systemd/system/ssh-key-sync.service >/dev/null <<EOF
[Unit]
Description=GPG SSH Key Sync
After=network-online.target

[Service]
Type=oneshot
ExecStart=$sync_script
Environment=HOME=$HOME
User=$USER

[Install]
WantedBy=multi-user.target
EOF

    "${SUDO[@]}" tee /etc/systemd/system/ssh-key-sync.timer >/dev/null <<'EOF'
[Unit]
Description=GPG SSH Key Sync Timer

[Timer]
OnBootSec=2min
OnUnitActiveSec=12h
Persistent=true

[Install]
WantedBy=timers.target
EOF

    "${SUDO[@]}" systemctl daemon-reload
    "${SUDO[@]}" systemctl enable --now ssh-key-sync.timer
    ok "Systemd timer enabled (syncs every 12h)"
}

main() {
    GPG_PATH="${GPG_PATH:-$(find_gpg)}"
    [[ -n "$GPG_PATH" ]] || die "GPG not found"
    ok "GPG: $GPG_PATH"
    FETCH_SCRIPT_BODY="$(download_fetch_script)"
    if os_is android; then
        install_termux
    elif [[ -d /run/systemd/system ]]; then
        install_systemd
    else
        die "Unsupported environment"
    fi
    ok "Done!"
}

main "$@"
