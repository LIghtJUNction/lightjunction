#!/bin/bash
KEY_ID="A67178405F7736FD"
KEYGRIP="04D57EF55CE358ADC4A824E6F7FADDFE10CB6679"
GPG_PATH=$(command -v gpg)

echo -e "trust\n5\ny\n" | $GPG_PATH --batch --no-tty --command-fd 0 --edit-key "$KEY_ID" >/dev/null 2>&1

mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
touch ~/.gnupg/gpg-agent.conf ~/.gnupg/sshcontrol
grep -q "enable-ssh-support" ~/.gnupg/gpg-agent.conf || echo "enable-ssh-support" >> ~/.gnupg/gpg-agent.conf
grep -q "$KEYGRIP" ~/.gnupg/sshcontrol || echo "$KEYGRIP" >> ~/.gnupg/sshcontrol

RC_FILE="$HOME/.gpg-agent-ssh.rc"
cat << 'EOF' > "$RC_FILE"
export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent > /dev/null 2>&1
gpg-connect-agent updatestartuptty /bye > /dev/null 2>&1
EOF
chmod 600 "$RC_FILE"

for conf in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$conf" ]; then
        grep -q "gpg-agent-ssh.rc" "$conf" || echo -e "\n[ -f \"$RC_FILE\" ] && source \"$RC_FILE\"" >> "$conf"
    fi
done

source "$RC_FILE"
gpgconf --kill gpg-agent && gpgconf --launch gpg-agent
sleep 1
ssh-add -L | grep "ssh-ed25519"
