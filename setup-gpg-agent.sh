#!/bin/bash
KEY_ID="A67178405F7736FD"
KEYGRIP="04D57EF55CE358ADC4A824E6F7FADDFE10CB6679"
HOST_IP="45.59.187.63"
HOST_ALIAS="ArchDmit"
SSH_CONFIG="$HOME/.ssh/config"
AGENT_SOCK=$(gpgconf --list-dirs agent-ssh-socket)

echo "[1/4] 环境预处理..."
[ -d "/data/data/com.termux" ] && pkg install pinentry -y >/dev/null 2>&1
mkdir -p ~/.gnupg ~/.ssh && chmod 700 ~/.gnupg ~/.ssh

# GPG 幂等配置
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol
echo -e "trust\n5\ny\n" | gpg --batch --no-tty --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

echo "[2/4] 清理并重构 SSH Config..."
# 使用标记位确保块的唯一性
TEMP_CONF=$(mktemp)
# 排除掉之前脚本可能产生的旧配置行（根据关键字清理）
sed '/Host ArchDmit/,+4d; /Host myserver/,+4d; /Host \*/,+4d' "$SSH_CONFIG" > "$TEMP_CONF"

# 重新写入标准化的配置
cat << EOF >> "$TEMP_CONF"

Host *
    ForwardAgent yes
    AddKeysToAgent yes
    IdentityAgent $AGENT_SOCK

Host $HOST_ALIAS
    HostName $HOST_IP
    Port 222
    User root
EOF

# 移除多余空行并还原
cat -s "$TEMP_CONF" > "$SSH_CONFIG"
rm "$TEMP_CONF"

echo "[3/4] 注入环境变量..."
ENV_CMD="export GPG_TTY=\$(tty); export SSH_AUTH_SOCK=$AGENT_SOCK; gpg-connect-agent updatestartuptty /bye >/dev/null 2>&1"
for rc in ~/.bashrc ~/.zshrc; do
    [ -f "$rc" ] && ! grep -q "GPG_TTY" "$rc" && echo "$ENV_CMD" >> "$rc"
done

echo "[4/4] 激活并验证..."
eval "$ENV_CMD"
gpgconf --launch gpg-agent >/dev/null 2>&1

if ssh-add -l >/dev/null 2>&1; then
    echo "SUCCESS: 配置已重构。可用命令: ssh $HOST_ALIAS"
else
    echo "ERROR: 密钥未加载，请确认 GPG 私钥已导入。"
fi
