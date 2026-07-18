#!/usr/bin/env bash
# deploy-ssh-keys.sh - Deploy SSH public key from GPG
# Usage:
#   curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash

set -euo pipefail

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
REMOTE_BASE_URL="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"
FIRST_PARTY_RAW_BASE="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main"
COMMON_LIB_SHA256="${LIGHTJUNCTION_COMMON_LIB_SHA256:-}"
BOOTSTRAP_LIB_SHA256="${LIGHTJUNCTION_BOOTSTRAP_LIB_SHA256:-}"
OS_LIB_SHA256="${LIGHTJUNCTION_OS_LIB_SHA256:-}"
if [[ "$REMOTE_BASE_URL" == "$FIRST_PARTY_RAW_BASE" ]]; then
    : "${COMMON_LIB_SHA256:=ca059ee1633358864db21c2af98ad150823634ba44378fc6fa51fd302ac4cd86}"
    : "${BOOTSTRAP_LIB_SHA256:=ddda9419f326510a438ba6236e8f7f772e4cde1ae7511d71852f99ae8bea8e90}"
    : "${OS_LIB_SHA256:=5c60bf433dfc6160dee5f8034bafd113b6fd322bb8e58273f474a0393c24f67f}"
fi

# ==================== BOOTSTRAP ====================
__IMPORTED_FILES=()

import() {
    local file="${1:?}" sha256="${2:-}" url
    url="$REMOTE_BASE_URL/$file"
    local imported
    for imported in "${__IMPORTED_FILES[@]}"; do
        [[ "$imported" == "$url" ]] && return 0
    done
    [[ -n "$sha256" ]] || {
        printf 'import: refusing script without required SHA256: %s\n' "$url" >&2
        exit 1
    }
    local tmp; tmp=$(mktemp) || exit 1
    trap 'rm -f -- "$tmp"' EXIT
    trap 'exit 130' HUP INT TERM
    curl -fsSL --connect-timeout 10 --max-time 120 "$url" -o "$tmp" || { rm -f "$tmp"; exit 1; }
    local actual
    actual=$(openssl dgst -sha256 "$tmp" | awk '{print $2}')
    if [[ "$actual" != "$sha256" ]]; then
        printf 'import: SHA256 mismatch for %s\n' "$file" >&2
        rm -f "$tmp"; exit 1
    fi
    local status
    # shellcheck source=/dev/null
    if source "$tmp"; then status=0; else status=$?; fi
    rm -f -- "$tmp"
    trap - EXIT HUP INT TERM
    ((status == 0)) || exit "$status"
    __IMPORTED_FILES+=("$url")
}

import lib/common.sh "$COMMON_LIB_SHA256"
import lib/bootstrap.sh "$BOOTSTRAP_LIB_SHA256"
import lib/os.sh "$OS_LIB_SHA256"

find_gpg() {
    command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null || true
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
"\$GPG_PATH" --keyserver hkps://keyserver.ubuntu.com --recv-keys "\$KEY_ID" >/dev/null 2>&1
key="\$("\$GPG_PATH" --export-ssh-key "\$KEY_ID")"
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
    sudo install -m 0755 "$tmp" "$sync_script"
    rm -f "$tmp"
    bash "$sync_script"

    sudo tee /etc/systemd/system/ssh-key-sync.service >/dev/null <<EOF
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

    sudo tee /etc/systemd/system/ssh-key-sync.timer >/dev/null <<'EOF'
[Unit]
Description=GPG SSH Key Sync Timer

[Timer]
OnBootSec=2min
OnUnitActiveSec=12h
Persistent=true

[Install]
WantedBy=timers.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now ssh-key-sync.timer
    ok "Systemd timer enabled (syncs every 12h)"
}

# ==================== MAIN ====================
main() {
    GPG_PATH="${GPG_PATH:-$(find_gpg)}"
    if [[ -z "$GPG_PATH" ]]; then
        die "GPG not found"
    fi
    ok "GPG: $GPG_PATH"

    if [[ -d "/data/data/com.termux/files/home" ]]; then
        install_termux
    elif [[ -d "/run/systemd/system" ]]; then
        install_systemd
    else
        die "Unsupported environment"
    fi

    ok "Done!"
}

main "$@"
