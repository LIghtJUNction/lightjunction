cat << 'EOF' > sync-ssh-keys.sh
#!/bin/bash
if [ "$EUID" -ne 0 ]; then
    echo "❌ 错误: 必须以 root 权限运行此脚本。" >&2
    exit 1
fi

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"

if ! command -v gpg &> /dev/null; then
    echo "❌ 错误: 未找到 gpg，请先安装 gnupg。" >&2
    exit 1
fi

if [ -d "/data/data/com.termux/files/home" ]; then
    IS_TERMUX=true
    BIN_DIR="$HOME/.termux/bin"
    AUTH_FILE="$HOME/.ssh/authorized_keys"
    SYNC_EXEC="$BIN_DIR/sync-ssh-keys-core.sh"
    mkdir -p "$BIN_DIR"
else
    IS_TERMUX=false
    if ! command -v systemctl &> /dev/null; then
        echo "❌ 错误: 未检测到 systemctl，本脚本仅支持 systemd 系统。" >&2
        exit 1
    fi
    BIN_DIR="/usr/local/bin"
    AUTH_FILE="$HOME/.ssh/authorized_keys"
    SYNC_EXEC="$BIN_DIR/sync-ssh-keys-core.sh"
fi

mkdir -p "$(dirname "$AUTH_FILE")" || { echo "❌ 无法创建目录 $(dirname "$AUTH_FILE")" >&2; exit 1; }
chmod 700 "$(dirname "$AUTH_FILE")"

cat << INNEREOF > "$SYNC_EXEC"
#!/bin/bash
/usr/bin/gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys $KEY_ID > /dev/null 2>&1
if [ \$? -ne 0 ]; then
    echo "⚠️ 警告: 无法从密钥服务器拉取公钥，请检查网络。" >&2
fi
/usr/bin/gpg --export-ssh-key $KEY_ID > "$AUTH_FILE"
chmod 600 "$AUTH_FILE"
INNEREOF

chmod +x "$SYNC_EXEC"

if [ "$IS_TERMUX" = false ]; then
    cat << INNEREOF > /etc/systemd/system/ssh-key-sync.service
[Unit]
Description=GPG SSH Key Sync Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$SYNC_EXEC
Environment=HOME=$HOME

[Install]
WantedBy=multi-user.target
INNEREOF

    cat << INNEREOF > /etc/systemd/system/ssh-key-sync.timer
[Unit]
Description=Timer for GPG SSH Key Sync

[Timer]
OnBootSec=2min
OnUnitActiveSec=12h
Persistent=true

[Install]
WantedBy=timers.target
INNEREOF

    systemctl daemon-reload
    systemctl enable --now ssh-key-sync.timer || { echo "❌ 无法启动 timer。" >&2; exit 1; }
    systemctl start ssh-key-sync.service
    echo "✅ Systemd 服务与定时器部署成功。"
else
    bash "$SYNC_EXEC"
    echo "✅ Termux 环境同步成功。"
fi
EOF

bash sync-ssh-keys.sh
