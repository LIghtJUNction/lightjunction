#!/bin/bash

KEY_ID="A67178405F7736FD"
GPG_PATH=$(command -v gpg)

# 1. 强制信任（非交互式）
echo "🛡️ 正在配置密钥信任..."
echo -e "trust\n5\ny\nquit" | $GPG_PATH --batch --no-tty --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

# 2. 精准提取 [A] 子密钥的 Keygrip
# 此处 awk 逻辑针对 GPG 2.4/2.5+ 进行了优化
KEYGRIP=$($GPG_PATH --with-colons --with-keygrip -K "$KEY_ID" | awk -F: '
    /^sub/ { is_auth = ($12 ~ /[aA]/) }
    /^grp/ && is_auth { print $10; exit }
')

if [ -z "$KEYGRIP" ]; then
    echo "❌ 错误: 未能提取到标记为 [A] 的认证子密钥 Keygrip。"
    echo "🔍 请手动检查输出: gpg -K --with-keygrip $KEY_ID"
    exit 1
fi

echo "✅ 成功提取 Keygrip: $KEYGRIP"

# 3. 写入配置文件
mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
touch ~/.gnupg/gpg-agent.conf ~/.gnupg/sshcontrol
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

# 4. 设置环境变量加载
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1
EOF

# 注入 Shell
for conf in "$HOME/.bashrc" "$HOME/.zshrc"; do
    [ -f "$conf" ] && ! grep -q "gpg-agent-ssh.rc" "$conf" && echo "[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$conf"
done

# 5. 重启代理
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

echo "------------------------------------------------"
echo "✅ 配置完成！ssh-add -L 结果："
ssh-add -L
echo "------------------------------------------------"
