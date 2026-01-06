#!/bin/bash
KEY_ID="A67178405F7736FD"
KEYGRIP="04D57EF55CE358ADC4A824E6F7FADDFE10CB6679"
GPG_PATH=$(command -v gpg)

# 1. 自动安装依赖 (Termux 或 桌面 Linux)
install_pinentry() {
    if [ -d "/data/data/com.termux" ]; then
        pkg install pinentry -y >/dev/null 2>&1
    elif command -v apt-get >/dev/null; then
        sudo apt-get install pinentry-curses -y >/dev/null 2>&1
    elif command -v pacman >/dev/null; then
        sudo pacman -S pinentry --noconfirm >/dev/null 2>&1
    elif command -v dnf >/dev/null; then
        sudo dnf install pinentry -y >/dev/null 2>&1
    fi
}

# 2. 初始化目录与配置
mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
install_pinentry
PINENTRY_PATH=$(command -v pinentry-curses || command -v pinentry)

# 写入 gpg-agent.conf (去重)
touch ~/.gnupg/gpg-agent.conf
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
if [ -n "$PINENTRY_PATH" ]; then
    grep -q "pinentry-program" ~/.gnupg/gpg-agent.conf || echo "pinentry-program $PINENTRY_PATH" >> ~/.gnupg/gpg-agent.conf
fi

# 写入 sshcontrol (去重)
touch ~/.gnupg/sshcontrol
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

# 3. 设置绝对信任
echo -e "trust\n5\ny\n" | $GPG_PATH --batch --no-tty --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

# 4. 生成统一加载文件 (POSIX)
RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent > /dev/null 2>&1
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1
EOF
chmod 600 "$RC_FILE"

# 5. 注入 Shell 配置文件
# --- Bash / Zsh ---
for conf in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$conf" ]; then
        grep -q "gpg-agent-ssh.rc" "$conf" || echo -e "\n[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$conf"
    fi
done

# --- Fish ---
FISH_CONF="$HOME/.config/fish/config.fish"
if [ -d "$(dirname "$FISH_CONF")" ]; then
    [ ! -f "$FISH_CONF" ] && touch "$FISH_CONF"
    if ! grep -q "gpg-agent-ssh.rc" "$FISH_CONF"; then
        echo -e "\n# GPG SSH Agent Support\nif test -f $RC_FILE\n    set -gx GPG_TTY (tty)\n    set -gx SSH_AUTH_SOCK (gpgconf --list-dirs agent-ssh-socket)\n    gpgconf --launch gpg-agent > /dev/null 2>&1\n    gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1\nend" >> "$FISH_CONF"
    fi
fi

# 6. 激活当前会话
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --kill gpg-agent && gpgconf --launch gpg-agent
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1

echo "✅ 配置已注入 Bash/Zsh/Fish (兼容 Termux 与 桌面 Linux)"
echo "🔑 SSH 公钥："
ssh-add -L | grep "ssh-ed25519"
