#!/bin/bash
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH=$(command -v gpg)

[ -z "$GPG_PATH" ] && { echo "❌ 错误: 未找到 gpg" >&2; exit 1; }

# 1. 设置信任与绑定 Keygrip (核心逻辑)
echo "🛡️ 配置密钥信任与绑定..."
echo -e "5\ny\n" | $GPG_PATH --command-fd 0 --edit-key "$KEY_ID" trust >/dev/null 2>&1
KEYGRIP=$($GPG_PATH -k --with-keygrip "$KEY_ID" | grep -A 1 "\[A\]" | grep "Keygrip" | awk '{print $3}')
mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
[ -n "$KEYGRIP" ] && ! grep -q "$KEYGRIP" ~/.gnupg/sshcontrol 2>/dev/null && echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

# 2. 生成独立的 RC 文件
RC_FILE="$HOME/.gpg-agent-ssh.rc"
echo "📝 生成独立配置文件: $RC_FILE"

cat << 'EOF' > "$RC_FILE"
# GPG-SSH Agent Configuration (2026 Edition)
# Source this file in your ~/.zshrc or ~/.bashrc

export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent > /dev/null 2>&1

# 可选：如果 ssh-add 为空，尝试列出密钥以激活代理
# ssh-add -L > /dev/null 2>&1
EOF

# 3. 激活与提示
chmod 600 "$RC_FILE"
source "$RC_FILE"

echo "------------------------------------------------"
echo "✅ 配置完成！"
echo "📜 你的 GPG-SSH 公钥 (ssh-add -L):"
ssh-add -L
echo "------------------------------------------------"
echo "🚀 [重要操作] 请将以下代码手动添加到你的 ~/.zshrc 或 ~/.bashrc config.fish 末尾:"
echo ""
echo "    [ -f \"$RC_FILE\" ] && source \"$RC_FILE\""
echo ""
echo "------------------------------------------------"
