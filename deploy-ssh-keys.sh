#!/bin/bash
# --- 配置项 ---
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH=$(command -v gpg)

# 1. 环境检查
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
    echo "✅ [Termux] 核心同步脚本已生成并执行。"

else
    echo "💻 检测到标准 Linux 环境"
    [ "$EUID" -ne 0 ] && { echo "❌ 错误: 必须以 root 权限运行" >&2; exit 1; }
    
    if ! command -v systemctl &> /dev/null; then
        echo "❌ 错误: 未检测到 systemctl，仅支持 systemd 系统。" >&2
        exit 1
    fi
    
    SYNC_EXEC="/usr/local/bin/sync-ssh-keys-core.sh"
    AUTH_FILE="$HOME/.ssh/authorized_keys"
    mkdir -p "$(dirname "$AUTH_FILE")"
    
    # 生成核心同步脚本
    cat << EOF > "$SYNC_EXEC"
#!/bin/bash
$GPG_PATH --keyserver hkps://keyserver.ubuntu.com --recv-keys $KEY_ID > /dev/null 2>&1
$GPG_PATH --export-ssh-key $KEY_ID > "$AUTH_FILE"
chmod 600 "$AUTH_FILE"
EOF
    chmod +x "$SYNC_EXEC"

    # 生成 Systemd 服务
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

    # 生成 Systemd 定时器
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

    # 激活服务
    systemctl daemon-reload
    systemctl enable --now ssh-key-sync.timer
    bash "$SYNC_EXEC"
    
    echo "✅ [Linux] Systemd 自动同步任务部署成功。"
fi

echo "------------------------------------------------"
echo "📜 服务器端当前授权公钥内容 ($AUTH_FILE):"
cat "$AUTH_FILE"
echo "------------------------------------------------"
echo "🚀 提示：请确保你本地已导入私钥并配置 IdentityAgent 即可登录。"
