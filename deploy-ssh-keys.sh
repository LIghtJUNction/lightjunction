#!/bin/bash
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH=$(command -v gpg)

[ -z "$GPG_PATH" ] && { echo "❌ 错误: 未找到 gpg" >&2; exit 1; }

if [ -d "/data/data/com.termux/files/home" ]; then
    echo "📱 检测到 Termux 环境"
    SYNC_EXEC="$HOME/.termux/bin/sync-ssh-keys-core.sh"
    AUTH_FILE="$HOME/.ssh/authorized_keys"
    
    mkdir -p "$HOME/.termux/bin" "$(dirname "$AUTH_FILE")"
    
    cat << EOF > "$SYNC_EXEC"
#!/bin/bash
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys $KEY_ID > /dev/null 2>&1
$GPG_PATH --export-ssh-key $KEY_ID > "$AUTH_FILE"
chmod 600 "$AUTH_FILE"
EOF

    chmod +x "$SYNC_EXEC"
    bash "$SYNC_EXEC"
    echo "✅ Termux 同步完成"

else
    echo "💻 检测到标准 Linux 环境"
    [ "$EUID" -ne 0 ] && { echo "❌ 错误: 必须以 root 权限运行" >&2; exit 1; }
    if ! command -v systemctl &> /dev/null; then
        echo "❌ 错误: 未检测到 systemctl，本脚本仅支持 systemd 系统。" >&2
        exit 1
    fi

    SYNC_EXEC="/usr/local/bin/sync-ssh-keys-core.sh"
    AUTH_FILE="$HOME/.ssh/authorized_keys"
    mkdir -p "$(dirname "$AUTH_FILE")"
    
    cat << EOF > "$SYNC_EXEC"
#!/bin/bash
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys $KEY_ID > /dev/null 2>&1
$GPG_PATH --export-ssh-key $KEY_ID > "$AUTH_FILE"
chmod 600 "$AUTH_FILE"
EOF
    chmod +x "$SYNC_EXEC"

    cat << EOF > /etc/systemd/system/ssh-key-sync.service
[Unit]
Description=GPG SSH Key Sync Service
After=network-online.target

[Service]
Type=oneshot
ExecStart=$SYNC_EXEC
Environment=HOME=$HOME

[Install]
WantedBy=multi-user.target
EOF

    cat << EOF > /etc/systemd/system/ssh-key-sync.timer
[Unit]
Description=Timer for GPG SSH Key Sync

[Timer]
OnBootSec=2min
OnUnitActiveSec=12h
Persistent=true

[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload
    systemctl enable --now ssh-key-sync.timer
    echo "✅ Linux Systemd Timer 部署成功"
    bash "$SYNC_EXEC"
fi

echo "------------------------------------------------"
echo "🔐 正在初始化本地 GPG-SSH 代理验证..."

export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent

echo "📜 当前可用于登录的公钥列表 (ssh-add -L):"
ssh-add -L

echo "------------------------------------------------"
echo "✅ 部署与验证流程全部完成。"
