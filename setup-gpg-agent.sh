#!/bin/bash
# 2026 客户端专用配置脚本 - 严禁使用 sudo 运行

KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH=$(command -v gpg)

# 1. 检查是否误用了 sudo
if [ "$EUID" -eq 0 ]; then
    echo "❌ 错误: 此脚本配置的是当前用户的代理，请勿使用 sudo 运行！" >&2
    exit 1
fi

# 2. 检查私钥是否存在
if ! $GPG_PATH -K "$KEY_ID" &>/dev/null; then
    echo "❌ 错误: 本地找不到私钥，请先导入私钥！" >&2
    exit 1
fi

# 3. 信任与绑定 Keygrip (在当前用户家目录下操作)
echo "🛡️ 正在当前用户环境下配置密钥绑定..."
echo -e "5\ny\n" | $GPG_PATH --command-fd 0 --edit-key "$KEY_ID" trust >/dev/null 2>&1

KEYGRIP=$($GPG_PATH -k --with-keygrip "$KEY_ID" | grep -A 1 "\[A\]" | grep "Keygrip" | awk '{print $3}')

mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf

if [ -n "$KEYGRIP" ]; then
    # 如果已存在则不重复写入
    grep -q "$KEYGRIP" ~/.gnupg/sshcontrol 2>/dev/null || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol
else
    echo "❌ 无法获取子密钥 [A] 的 Keygrip" >&2
    exit 1
fi

# 4. 生成 RC 文件
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent > /dev/null 2>&1
EOF
chmod 600 "$RC_FILE"

# 5. 立即激活当前会话
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

echo "------------------------------------------------"
echo "✅ 用户级配置完成！"
echo "📜 验证当前身份 (ssh-add -L):"
ssh-add -L
echo "------------------------------------------------"
echo "🚀 请将以下代码添加到你的 ~/.zshrc 或 ~/.bashrc:"
echo "   [ -f \"$RC_FILE\" ] && source \"$RC_FILE\""
