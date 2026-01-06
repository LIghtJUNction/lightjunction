#!/bin/bash
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH=$(command -v gpg)

[ -z "$GPG_PATH" ] && { echo "❌ 错误: 未找到 gpg" >&2; exit 1; }
[ "$EUID" -eq 0 ] && { echo "❌ 错误: 请勿使用 sudo 运行" >&2; exit 1; }

# 1. 信任与 Keygrip 绑定（去重）
echo "🛡️ 正在配置密钥绑定..."
echo -e "5\ny\n" | $GPG_PATH --command-fd 0 --edit-key "$KEY_ID" trust >/dev/null 2>&1
KEYGRIP=$($GPG_PATH -k --with-keygrip "$KEY_ID" | grep -A 1 "\[A\]" | grep "Keygrip" | awk '{print $3}')

mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
# gpg-agent.conf 去重
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf 2>/dev/null || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
# sshcontrol 去重
if [ -n "$KEYGRIP" ]; then
    grep -q "$KEYGRIP" ~/.gnupg/sshcontrol 2>/dev/null || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol
fi

# 2. 生成/刷新独立 RC 文件 (覆盖写入，天然去重)
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
# GPG-SSH Agent Config
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent > /dev/null 2>&1
EOF
chmod 600 "$RC_FILE"

# 3. 注入 Shell 配置文件（去重检查）
# --- 针对 Bash/Zsh ---
for ShellConf in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$ShellConf" ]; then
        if ! grep -q "gpg-agent-ssh.rc" "$ShellConf"; then
            echo -e "\n[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$ShellConf"
            echo "✅ 已向 $ShellConf 添加加载项"
        fi
    fi
done

# --- 针对 Fish ---
FISH_CONF="$HOME/.config/fish/config.fish"
if [ -d "$(dirname "$FISH_CONF")" ]; then
    [ ! -f "$FISH_CONF" ] && touch "$FISH_CONF"
    if ! grep -q "gpg-agent-ssh.rc" "$FISH_CONF"; then
        echo -e "\n# GPG-SSH Agent support\nif test -f $RC_FILE\n    source $RC_FILE\nend" >> "$FISH_CONF"
        echo "✅ 已向 $FISH_CONF 添加加载项"
    fi
fi

# 4. 激活当前会话
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent && gpgconf --launch gpg-agent

echo "------------------------------------------------"
echo "✅ 配置完成！ssh-add -L 结果："
ssh-add -L
echo "------------------------------------------------"
