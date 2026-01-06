#!/bin/bash
# =================================================================
# GPG SSH Agent 自动化配置脚本
# =================================================================

# 主密钥 ID
KEY_ID="EB21B83AB1E982DF66F08387A67178405F7736FD"
GPG_PATH=$(command -v gpg)

# 基础检查
[ -z "$GPG_PATH" ] && { echo "❌ 错误: 未找到 gpg" >&2; exit 1; }
[ "$EUID" -eq 0 ] && { echo "❌ 错误: 请勿使用 sudo 运行此脚本" >&2; exit 1; }

echo "🛡️ 正在启动自动化配置..."

# 1. 自动设置 Ultimate Trust（绝对信任）
# 使用 --command-fd 确保在非交互模式下也能修改信任库
echo -e "trust\n5\ny\n" | $GPG_PATH --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

# 2. 提取认证子密钥 (Authentication) 的 Keygrip
# 使用 -K (私钥列表)
KEYGRIP=$($GPG_PATH -K --with-keygrip "$KEY_ID" | grep -A 1 "\[A\]" | grep "Keygrip" | awk '{print $3}')

if [ -z "$KEYGRIP" ]; then
    echo "❌ 错误: 未能提取到标记为 [A] 的认证子密钥 Keygrip，请确认子密钥已创建。"
    exit 1
fi
echo "✨ 识别到 Keygrip: $KEYGRIP"

# 3. 准备配置文件
mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
touch ~/.gnupg/gpg-agent.conf ~/.gnupg/sshcontrol

# 启用 SSH 支持 (去重)
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
# 将 Keygrip 注入 SSH 控制文件 (去重)
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

# 4. 生成独立的环境变量加载文件
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
# GPG-SSH Agent Config (Auto-generated)
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
# 强制 GPG 代理更新当前 TTY 以便弹出密码框
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1
EOF
chmod 600 "$RC_FILE"

# 5. 注入 Shell 配置文件 (Bash / Zsh / Fish)
# --- Bash & Zsh ---
for ShellConf in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$ShellConf" ]; then
        if ! grep -q "gpg-agent-ssh.rc" "$ShellConf"; then
            echo -e "\n# 加载 GPG SSH 代理配置\n[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$ShellConf"
            echo "✅ 已向 $ShellConf 添加加载项"
        fi
    fi
done

# --- Fish ---
FISH_CONF="$HOME/.config/fish/config.fish"
if [ -d "$(dirname "$FISH_CONF")" ]; then
    [ ! -f "$FISH_CONF" ] && touch "$FISH_CONF"
    if ! grep -q "gpg-agent-ssh.rc" "$FISH_CONF"; then
        echo -e "\n# GPG-SSH Agent support\nif test -f $RC_FILE\n    source $RC_FILE\nend" >> "$FISH_CONF"
        echo "✅ 已向 $FISH_CONF 添加加载项"
    fi
fi

# 6. 激活当前会话
echo "🔄 正在重启 GPG 代理..."
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

echo "------------------------------------------------"
echo "✅ 自动化配置完成！"
echo "🔑 请将以下公钥添加到 GitHub (github.com):"
echo ""
ssh-add -L
echo ""
echo "💡 提示：如果未显示密钥，请重新打开终端或执行: source $RC_FILE"
echo "------------------------------------------------"
