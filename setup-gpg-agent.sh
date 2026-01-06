#!/bin/bash

# 1. 变量定义
KEY_ID="A67178405F7736FD"
GPG_PATH=$(command -v gpg)

# 2. 强制设置 Ultimate Trust (非交互式)
echo "🛡️ 正在设置信任级别..."
echo -e "trust\n5\ny\nquit" | $GPG_PATH --batch --no-tty --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

# 3. 提取 Keygrip (增强版匹配)
# 我们先尝试获取整个密钥的信息，然后用 awk 精确锁定 [A] 标识符下方的 Keygrip
echo "🔍 正在提取认证子密钥绑定信息..."
KEYGRIP=$($GPG_PATH --with-colons --with-keygrip -K "$KEY_ID" | awk -F: '/^sub/ {usage=$12} /^grp/ && usage ~ /a/ {print $10; exit}')

if [ -z "$KEYGRIP" ]; then
    # 备选方案：如果 colons 模式失败，使用传统 grep 模式
    KEYGRIP=$($GPG_PATH -K --with-keygrip "$KEY_ID" | grep -A 1 "\[A\]" | grep "Keygrip" | awk '{print $3}')
fi

if [ -z "$KEYGRIP" ]; then
    echo "❌ 错误: 仍无法提取到 [A] 子密钥的 Keygrip。"
    echo "请手动运行 'gpg -K --with-keygrip' 确认是否存在标记为 [A] 的条目。"
    exit 1
fi

echo "✅ 成功获取 Keygrip: $KEYGRIP"

# 4. 写入配置文件
mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf 2>/dev/null || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol 2>/dev/null || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

# 5. 刷新环境
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << EOF > "$RC_FILE"
export GPG_TTY=\$(tty)
export SSH_AUTH_SOCK=\$(gpgconf --list-dirs agent-ssh-socket)
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1
EOF

# 注入 Shell (去重)
for conf in "$HOME/.bashrc" "$HOME/.zshrc"; do
    [ -f "$conf" ] && ! grep -q "gpg-agent-ssh.rc" "$conf" && echo "[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$conf"
done

# 6. 立即激活并显示结果
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

echo "------------------------------------------------"
echo "✅ 配置完成！SSH 公钥如下："
ssh-add -L
echo "------------------------------------------------"
