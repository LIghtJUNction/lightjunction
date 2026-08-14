# Online script quick commands

Copy-ready entrypoints for the scripts in this repository. The commands below fetch the current `main` branch from GitHub.

These scripts can install packages, change system configuration, or modify SSH access. Review downloaded scripts before running them on a machine you own or administer. The one-line forms are convenience shortcuts for trusted, disposable, or already-reviewed environments.

## Script list

| Script | Purpose | Intended environments |
| --- | --- | --- |
| `bootstrap-linux.sh` | General Linux bootstrap with optional modules | Linux |
| `bootstrap-linux-daed.sh` | Linux bootstrap with the `network-daed` module enabled by default | Linux |
| `bootstrap-macbook.sh` | macOS developer-tool and desktop bootstrap | macOS |
| `deploy-ssh-keys.sh` | Import the GPG key, update `authorized_keys`, and enable periodic sync | Linux with systemd, Termux |
| `fetch-ssh-pub-key.sh` | Fetch and print or save the SSH public key derived from GPG | Bash + GPG environments |

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
