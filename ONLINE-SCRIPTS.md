# Online script quick commands

Copy-ready entrypoints for the scripts in this repository. The commands below fetch the current `main` branch from GitHub.

These scripts can install packages, change system configuration, or modify SSH access. Review downloaded scripts before running them on a machine you own or administer. The one-line forms are convenience shortcuts for trusted, disposable, or already-reviewed environments.

## Script list

| Script | Purpose | Intended environments |
| --- | --- | --- |
| `bootstrap-linux.sh` | General Linux bootstrap with optional modules | Linux |
| `bootstrap-linux-daed.sh` | Linux bootstrap with the `network-daed` module enabled by default | Linux |
| `bootstrap-macbook.sh` | macOS developer-tool and desktop bootstrap | macOS |
| `setup-gpg-agent.sh` | Configure a YubiKey client, restore public keys, and install user-level sync | Linux, macOS, Termux/WSL with working smartcard access |
| `deploy-ssh-keys.sh` | Import the GPG key, update `authorized_keys`, and enable periodic sync | Linux with systemd, Termux |
| `fetch-ssh-pub-key.sh` | Fetch and print or save the SSH public key derived from GPG | Bash + GPG environments |

## YubiKey client: agent and public keys

Use this on the computer where you plug in the YubiKey. Run as your own user, without `sudo`:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/setup-gpg-agent.sh | bash
```

Requires GnuPG (including `gpgconf`, `gpg-connect-agent` and a working smartcard backend), pinentry, curl and openssl. On Arch Linux, the relevant packages are `gnupg pinentry curl openssl`. The script does not install packages or alter PC/SC, USB permissions or SELinux. Android and WSL still require working access to the physical card; missing hardware is reported without discarding the installed configuration.

The setup imports the **public** certificate from `https://github.com/LIghtJUNction.gpg`, checks the primary fingerprint `EB21B83AB1E982DF66F08387A67178405F7736FD`, and retains all its public subkeys. Other certificates returned by GitHub are excluded; private-key input is rejected. It saves the SSH authentication public key as `~/.ssh/lightjunction-openpgp.pub`. Neither the primary private key nor a private-key backup is downloaded or required.

Agent configuration and shell integration are managed in marked blocks, with existing content and symlink-based dotfiles preserved. Repeating setup replaces its own blocks instead of appending duplicates. The first replaced version is saved alongside the file as `.lightjunction.bak`. Bash, Zsh (including `ZDOTDIR`) and Fish are supported. A missing pinentry setting is filled automatically; an explicit existing setting is preserved. To select another executable, pass `--pinentry /path/to/pinentry-curses`.

Open a new terminal after setup. To use it immediately in the current Bash/Zsh terminal:

```bash
. "${XDG_CONFIG_HOME:-$HOME/.config}/lightjunction/gpg-agent.sh"
```

For Fish, source `~/.config/fish/conf.d/lightjunction-gpg.fish` (or its location under `XDG_CONFIG_HOME`). The environment sets `GPG_TTY`, starts the agent when needed, and obtains `SSH_AUTH_SOCK` from `gpgconf`; an incoming SSH-forwarded agent is preserved. An executed child script cannot export these variables back into its parent terminal.

Check public-key/card availability without creating a commit:

```bash
gpg --card-status
ssh-add -L
```

Run public-key synchronization again at any time:

```bash
~/.local/bin/lightjunction-key-sync
```

When a systemd user session is available, setup enables `lightjunction-key-sync.timer` twice daily. It runs the locally installed, SHA256-checked helper, downloading public-key data only. It uses the same `GNUPGHOME` and source settings as setup. On macOS, Termux, or a session without user systemd, use the manual command. `--no-sync` skips timer configuration for this run; it does not disable a timer previously installed. Disable that timer explicitly with `systemctl --user disable --now lightjunction-key-sync.timer`.

Existing cache settings are retained. A new agent configuration uses one-hour idle and eight-hour maximum passphrase-cache TTLs, including the SSH cache. **These are agent cache settings, not a guarantee that a hardware PIN stays verified for eight hours.** Card removal/reset and card policy may require another PIN. The script never changes PINs, touch/UIF, KDF, `forcesig`, ownertrust, Git identity/signing defaults, or `authorized_keys`.

Use `deploy-ssh-keys.sh` only on a **server that should accept this identity**. That separate script updates the managed `authorized_keys` block and keeps its existing systemd/Termux deployment behavior. Its generated sync helper now uses the same GitHub certificate download and fingerprint check. Rerun deployment once to update already-installed old helpers. Downloads or validation failures leave the existing authorized key file intact.

`LIGHTJUNCTION_GPG_URL` overrides the HTTPS certificate URL without changing the expected fingerprint. Explicitly setting `LIGHTJUNCTION_GPG_KEYSERVER` retains the legacy keyserver workflow. A custom `LIGHTJUNCTION_RAW_BASE` for script dependencies requires a matching `LIGHTJUNCTION_FETCH_SHA256` (and the existing library hashes for server deployment).

## Shared URLs

### Bash

```bash
BASE_URL="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main"
```

### PowerShell

```powershell
$BaseUrl = "https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main"
```

## Linux

### General bootstrap

Convenience form:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh | bash
```

Review-first form:

```bash
curl -fsSLo bootstrap-linux.sh https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh
less bootstrap-linux.sh
bash bootstrap-linux.sh
```

Select optional modules explicitly for a non-interactive run:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh \
  | BOOTSTRAP_FEATURES=network-daed,shell bash
```

Supported optional modules include `network-daed`, `fs-bees`, `shell`, and `cn-desktop`.

### daed compatibility entrypoint

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux-daed.sh | bash
```

This wrapper verifies and launches `bootstrap-linux.sh` with `network-daed` enabled by default.

## macOS

Run this as a normal administrator user, not with `sudo`:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh | bash
```

Review-first form:

```bash
curl -fsSLo bootstrap-macbook.sh https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh
less bootstrap-macbook.sh
bash bootstrap-macbook.sh
```

## Termux / Android

Install the required command-line tools first:

```bash
pkg update
pkg install curl gnupg
```

Deploy the managed SSH key block and its periodic sync helper:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
```

Fetch only the SSH public key:

```bash
mkdir -p "$HOME/.ssh"
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/fetch-ssh-pub-key.sh \
  | bash -s -- --output "$HOME/.ssh/lightjunction.pub"
```

The deployment script detects Termux through its standard home path and does not install a systemd unit there.

## Windows PowerShell

The repository entrypoints are Bash scripts. Native PowerShell can download and review them, but Linux bootstrap actions should run inside WSL.

### Run through WSL

```powershell
wsl.exe bash -lc 'curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh | bash'
```

Fetch the SSH public key through WSL:

```powershell
wsl.exe bash -lc 'curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/fetch-ssh-pub-key.sh | bash'
```

### Download and review in PowerShell, then run in WSL

```powershell
$BaseUrl = "https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main"
$ScriptPath = Join-Path $env:TEMP "lightjunction-bootstrap-linux.sh"
Invoke-WebRequest -Uri "$BaseUrl/bootstrap-linux.sh" -OutFile $ScriptPath
Get-Content -Path $ScriptPath
$WslPath = (wsl.exe wslpath -a $ScriptPath).Trim()
wsl.exe bash $WslPath
```

Git Bash can download and inspect the files, but the Linux and macOS bootstrap entrypoints intentionally reject unsupported operating systems. Use WSL for Linux bootstrap work.

## Other Unix-like systems

For a Bash + GPG environment such as a remote server, fetch the SSH public key without changing `authorized_keys`:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/fetch-ssh-pub-key.sh | bash
```

Save it to a file instead:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/fetch-ssh-pub-key.sh \
  | bash -s -- --output "$HOME/.ssh/lightjunction.pub"
```

The Linux bootstrap requires Linux, the macOS bootstrap requires macOS, and SSH deployment requires either systemd or Termux.

## Review and pin a revision

For a reviewable and reproducible run, download a specific commit rather than tracking `main`:

```bash
REVISION="<reviewed-commit-sha>"
curl -fsSLo script.sh "https://raw.githubusercontent.com/LIghtJUNction/lightjunction/$REVISION/bootstrap-linux.sh"
less script.sh
bash script.sh
```

Never provide private keys, seed phrases, passwords, recovery codes, or production credentials to these scripts.
