# Online scripts

Use Bash on Linux, macOS or Termux. Each entrypoint supports `--help`.
These commands execute code from the selected GitHub revision.

```bash
BASE=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main
```

## Linux and Termux

Select the modules to install; without a selection, non-interactive execution
only reports the platform. An interactive terminal offers module prompts.

```bash
BOOTSTRAP_FEATURES=shell bash <(curl -fsSL "$BASE/bootstrap-linux.sh")
```

Linux modules: `shell`, `network-daed`, `fs-bees`, `cn-desktop`.
The `network-daed` module needs systemd. `fs-bees` installs tooling but does not
enable deduplication automatically. Package availability depends on the distribution.

The compatibility wrapper defaults to `network-daed`:

```bash
bash <(curl -fsSL "$BASE/bootstrap-linux-daed.sh")
```

Termux supports the `shell` module using `pkg`, without root or sudo. The other
Linux modules are rejected. Install the download prerequisites first:

```bash
pkg install bash curl gnupg
```

## macOS

Run as a normal administrator, not through sudo:

```bash
bash <(curl -fsSL "$BASE/bootstrap-macbook.sh")
```

Installs the existing Homebrew tool/app bundle, configures Ghostty and changes
the login shell to Fish. Existing Ghostty settings are kept outside the managed
block; the theme is stored in `lib/ghostty.conf`. Install Apple Command Line Tools
when prompted, then rerun. Broken CLT directories are not removed automatically.

## YubiKey client

Run on the account that uses the YubiKey, without sudo:

```bash
bash <(curl -fsSL "$BASE/setup-gpg-agent.sh")
```

Requires GnuPG, pinentry and curl. Configures Bash/Zsh/Fish agent integration,
imports the public certificate and saves `~/.ssh/lightjunction-openpgp.pub`.
The expected primary fingerprint remains
`EB21B83AB1E982DF66F08387A67178405F7736FD`. Private keys are never downloaded.

Open a new terminal, or load the generated environment:

```bash
. "${XDG_CONFIG_HOME:-$HOME/.config}/lightjunction/gpg-agent.sh"
gpg --card-status
ssh-add -L
```

Fish uses its generated `conf.d/lightjunction-gpg.fish` file. Forwarded SSH agents
are preserved. Android/WSL still need working USB/smartcard access; this script
does not change PC/SC, USB permissions, SELinux, PINs or card touch policy.

Manual public-key synchronization:

```bash
~/.local/bin/lightjunction-key-sync
```

A systemd user timer is installed when available. `--no-sync` leaves timer
configuration alone; it does not disable an existing timer. macOS and Termux
can use the manual command. The timer executes an installed helper, not fresh
remote code. Rerun setup to update that helper.

## Server SSH access

Only run this on an account that should accept the lightjunction identity:

```bash
bash <(curl -fsSL "$BASE/deploy-ssh-keys.sh")
```

Updates only the managed `authorized_keys` block, preserving other keys. Linux
uses a systemd timer; Termux installs `~/.termux/bin/sync-ssh-keys.sh` for manual
runs. Download/identity-validation failures preserve the existing key file.

To fetch a public key without granting server access:

```bash
mkdir -p "$HOME/.ssh"
bash <(curl -fsSL "$BASE/fetch-ssh-pub-key.sh") --output "$HOME/.ssh/lightjunction.pub"
```

`LIGHTJUNCTION_GPG_URL` overrides the HTTPS certificate URL without changing the
expected fingerprint. `LIGHTJUNCTION_GPG_KEYSERVER` explicitly selects a keyserver.

## Fixed revision or local checkout

Script hashes are no longer required. Set the same revision for the entrypoint
and dependencies:

```bash
export LIGHTJUNCTION_REF="<commit-sha>"
BASE="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/$LIGHTJUNCTION_REF"
bash <(curl -fsSL "$BASE/bootstrap-linux.sh") --help
```

A checkout uses local libraries automatically: `bash ./bootstrap-linux.sh`.
`LIGHTJUNCTION_RAW_BASE` selects a custom source. The short online forms stream
trusted code; a network error does not roll back already executed commands.
For download-before-execution, save the file first and run only after curl succeeds:

```bash
curl -fsSLo bootstrap-linux.sh "$BASE/bootstrap-linux.sh" && bash bootstrap-linux.sh
```

On Windows, run these Bash entrypoints in WSL, not native PowerShell.
