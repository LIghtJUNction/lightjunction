#!/usr/bin/env bash
# deploy-ssh-keys.sh - Deploy SSH public key from GPG
# Usage:
#   curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash

set -euo pipefail

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
REMOTE_BASE_URL="${LIGHTJUNCTION_RAW_BASE:-https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main}"

# ==================== BOOTSTRAP ====================
declare -gA __IMPORTED_FILES

import() {
    local file="${1:?}" sha256="${2:-}" url
    url="$REMOTE_BASE_URL/$file"
    [[ "${__IMPORTED_FILES[$url]:-}" == "1" ]] && return 0
    __IMPORTED_FILES[$url]=1
    local tmp; tmp=$(mktemp) || exit 1
    curl -fsSL --connect-timeout 10 "$url" -o "$tmp" || { rm -f "$tmp"; exit 1; }
    if [[ -n "$sha256" ]]; then
        local actual
        actual=$(openssl dgst -sha256 "$tmp" | awk '{print $2}')
        if [[ "$actual" != "$sha256" ]]; then
            printf 'import: SHA256 mismatch for %s\n' "$file" >&2
            rm -f "$tmp"; exit 1
        fi
    fi
    # shellcheck source=/dev/null
    source "$tmp"; rm -f "$tmp"
}

import lib/common.sh
import lib/bootstrap.sh
import lib/os.sh

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
"\$GPG_PATH" --export-ssh-key "\$KEY_ID" > "\$HOME/.ssh/authorized_keys"
chmod 700 "\$HOME/.ssh"
chmod 600 "\$HOME/.ssh/authorized_keys"
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
