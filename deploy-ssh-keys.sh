#!/bin/bash
# deploy-ssh-keys.sh - Deploy GPG SSH public key via cloud scripts
# Usage:
#   curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | sudo bash
#   curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
#
# This is a CLOUD SCRIPT - all functions are imported from GitHub.

# ==================== BOOTSTRAP ====================
# Minimal import() implementation for cloud script
declare -gA __IMPORTED_FILES
__IMPORTED_FILES=()

_import() {
    local file="${1:?}" branch="${2:-main}" repo="${3:-lightjunction}" user="${4:-lightjunction}"
    local base_url="${5:-https://raw.githubusercontent.com}"
    local url="$base_url/$user/$repo/$branch/$file"
    [[ "${__IMPORTED_FILES[$url]:-}" == "1" ]] && return 0
    __IMPORTED_FILES[$url]=1
    local tmpfile; tmpfile=$(mktemp) || return 1
    curl -fsSL --connect-timeout 15 "$url" -o "$tmpfile" 2>/dev/null || {
        rm -f "$tmpfile"
        echo "[ERROR] Failed to download: $url" >&2
        return 1
    }
    source "$tmpfile"; rm -f "$tmpfile"
}

# ==================== IMPORTS ====================
_import env.sh
_import log.sh

# ==================== MAIN ====================
main() {
    local key_id="EB21B83AB1E982DF66F08387A67178405F7736FD"
    local gpg_path
    gpg_path=$(command -v gpg) || gpg_path=$(command -v gpg2)

    # Check gpg exists
    if [[ -z "$gpg_path" ]]; then
        err "GPG not found"
        exit 1
    fi
    ok "Found GPG at: $gpg_path"

    # Detect environment
    local sync_exec auth_file
    if [[ -d "/data/data/com.termux/files/home" ]]; then
        info "Detected Termux environment"
        sync_exec="$HOME/.termux/bin/sync-ssh-keys-core.sh"
        auth_file="$HOME/.ssh/authorized_keys"
        _import lib/os.sh
        os_ensure_dir "$HOME/.termux/bin"
        os_ensure_dir "$(dirname "$auth_file")"

        # Generate sync script
        cat > "$sync_exec" <<'SYNCEOF'
#!/bin/bash
GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null)}"
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys "$KEY_ID" >/dev/null 2>&1
$GPG_PATH --export-ssh-key "$KEY_ID" > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
SYNCEOF
        chmod +x "$sync_exec"
        bash "$sync_exec"
        ok "Termux sync script generated and executed"

    else
        info "Detected Linux environment"
        if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
            err "Linux deployment requires root (sudo)"
            exit 1
        fi

        # Check systemd
        if ! command -v systemctl >/dev/null 2>&1; then
            err "systemd not found, only systemd-based Linux is supported"
            exit 1
        fi

        sync_exec="/usr/local/bin/sync-ssh-keys-core.sh"
        auth_file="$HOME/.ssh/authorized_keys"
        _import lib/os.sh
        os_ensure_dir "$(dirname "$auth_file")"

        # Generate sync script
        cat > "$sync_exec" <<'SYNCEOF'
#!/bin/bash
GPG_PATH="${GPG_PATH:-$(command -v gpg 2>/dev/null || command -v gpg2 2>/dev/null)}"
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys "$KEY_ID" >/dev/null 2>&1
$GPG_PATH --export-ssh-key "$KEY_ID" > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
SYNCEOF
        chmod +x "$sync_exec"

        # Generate systemd service
        cat > /etc/systemd/system/ssh-key-sync.service <<'SERVICEEOF'
[Unit]
Description=GPG SSH Key Sync Service
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sync-ssh-keys-core.sh
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
SERVICEEOF

        # Generate systemd timer
        cat > /etc/systemd/system/ssh-key-sync.timer <<'TIMEREOF'
[Unit]
Description=Timer for GPG SSH Key Sync

[Timer]
OnBootSec=2min
OnUnitActiveSec=12h
Persistent=true

[Install]
WantedBy=timers.target
TIMEREOF

        systemctl daemon-reload
        if ! systemctl is-enabled --quiet ssh-key-sync.timer 2>/dev/null; then
            systemctl enable ssh-key-sync.timer
        fi
        bash "$sync_exec"
        ok "Linux systemd sync service deployed"
    fi

    # Show deployed key
    line
    info "Current authorized_keys content ($auth_file):"
    cat "$auth_file" 2>/dev/null || echo "(empty or not accessible)"
    line
    ok "Done! Make sure your local machine has the private key imported and IdentityAgent configured."
}

main "$@"
