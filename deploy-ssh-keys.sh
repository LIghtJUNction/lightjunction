#!/bin/bash
# deploy-ssh-keys.sh - Deploy SSH public key from GPG
# Usage:
#   curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash

set -e

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2)}"

# ==================== BOOTSTRAP ====================
declare -gA __IMPORTED_FILES

import() {
    local file="${1:?}" branch="${2:-main}" repo="${3:-lightjunction}" user="${4:-lightjunction}"
    local url="https://raw.githubusercontent.com/$user/$repo/$branch/$file"
    [[ "${__IMPORTED_FILES[$url]:-}" == "1" ]] && return 0
    __IMPORTED_FILES[$url]=1
    local tmp; tmp=$(mktemp) || exit 1
    curl -fsSL --connect-timeout 10 "$url" -o "$tmp" || { rm -f "$tmp"; exit 1; }
    source "$tmp"; rm -f "$tmp"
}

# ==================== IMPORTS ====================
import env.sh
import log.sh

# ==================== MAIN ====================
main() {
    # Check GPG
    if [[ -z "$GPG_PATH" ]]; then
        err "GPG not found"; exit 1
    fi
    ok "GPG: $GPG_PATH"

    # Detect environment
    if [[ -d "/data/data/com.termux/files/home" ]]; then
        info "Termux detected"
        import lib/os.sh

        local sync_script="$HOME/.termux/bin/sync-ssh-keys.sh"
        os_ensure_dir "$(dirname "$sync_script")"
        os_ensure_dir "$HOME/.ssh"

        # Generate sync script
        cat > "$sync_script" <<'EOF'
#!/bin/bash
GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2)}"
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys "$KEY_ID" >/dev/null 2>&1
$GPG_PATH --export-ssh-key "$KEY_ID" > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
EOF
        chmod +x "$sync_script"
        bash "$sync_script"
        ok "SSH key deployed to ~/.ssh/authorized_keys"

    elif [[ -d "/run/systemd/system" ]]; then
        info "Linux (systemd) detected"

        if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
            err "Requires root (sudo)"; exit 1
        fi

        import lib/os.sh
        os_ensure_dir "/usr/local/bin"
        os_ensure_dir "$HOME/.ssh"

        local sync_script="/usr/local/bin/sync-ssh-keys.sh"
        cat > "$sync_script" <<'EOF'
#!/bin/bash
GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2)}"
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys "$KEY_ID" >/dev/null 2>&1
$GPG_PATH --export-ssh-key "$KEY_ID" > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
EOF
        chmod +x "$sync_script"

        # Systemd service + timer
        cat > /etc/systemd/system/ssh-key-sync.service <<'EOF'
[Unit] Description=GPG SSH Key Sync After=network-online.target
[Service] Type=oneshot ExecStart=/usr/local/bin/sync-ssh-keys.sh Environment=HOME=/root
[Install] WantedBy=multi-user.target
EOF

        cat > /etc/systemd/system/ssh-key-sync.timer <<'EOF'
[Unit] Description=GPG SSH Key Sync Timer
[Timer] OnBootSec=2min OnUnitActiveSec=12h Persistent=true
[Install] WantedBy=timers.target
EOF

        systemctl daemon-reload
        systemctl enable --now ssh-key-sync.timer
        ok "Systemd timer enabled (syncs every 12h)"
    else
        err "Unsupported environment"; exit 1
    fi

    line
    ok "Done!"
}

main "$@"
