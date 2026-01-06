#!/bin/bash

# 1. 自动获取主密钥 ID (避免变量未定义的错误)
GPG_PATH=$(command -v gpg)
KEY_ID=$($GPG_PATH --list-secret-keys --with-colons | awk -F: '/^sec/ {print $5; exit}')

if [ -z "$KEY_ID" ]; then
    echo "❌ 错误: 未能在本地找到任何私钥。"
    exit 1
fi

echo "🛡️ 正在配置密钥: $KEY_ID"

# 2. 强制设置 Ultimate Trust (非交互式批处理)
# 使用 --batch 和 --no-tty 绕过交互界面
echo -e "trust\n5\ny\nquit" | $GPG_PATH --batch --no-tty --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

# 3. 精准提取认证子密钥 [A] 的 Keygrip
# 使用 --with-colons 格式是 2026 年自动化最稳定的方式，不受终端语言和空格影响
# 逻辑：寻找 sub (子密钥) 中 usage 包含 'a' (authentication) 的条目，并取其下方的 grp (keygrip)
KEYGRIP=$($GPG_PATH --with-colons --with-keygrip -K "$KEY_ID" | awk -F: '
    /^sub/ { has_a = ($12 ~ /a/) }
    /^grp/ && has_a { print $10; exit }
')

if [ -z "$KEYGRIP" ]; then
    echo "❌ 错误: 未能提取到标记为 [A] 的认证子密钥 Keygrip。"
    exit 1
fi
echo "✅ 识别到 Keygrip: $KEYGRIP"

# 4. 配置 GPG 代理与 SSH 支持
mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
touch ~/.gnupg/gpg-agent.conf ~/.gnupg/sshcontrol

# 写入配置 (去重)
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

# 5. 生成环境加载文件
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
# 强制代理识别当前 TTY
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1
EOF
chmod 600 "$RC_FILE"

# 6. 注入 Shell 配置文件 (Bash/Zsh)
for ShellConf in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$ShellConf" ]; then
        if ! grep -q "gpg-agent-ssh.rc" "$ShellConf"; then
            echo -e "\n# GPG SSH Agent\n[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$ShellConf"
            echo "✅ 已更新 $ShellConf"
        fi
    fi
done

# 7. 彻底激活
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

echo "------------------------------------------------"
echo "✅ 自动化配置完成！"
echo "🔑 SSH 公钥内容："
ssh-add -L
echo "------------------------------------------------"
