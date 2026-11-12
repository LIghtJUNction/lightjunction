# lightjunction

A keyboard-driven terminal playground with generative Orbit, Rain, and Wave scenes, playable Snake, bundled public keys, and local age/OpenPGP encryption. No profile pages, network requests, telemetry, or saved activity.

Built in Rust with [`zclap`](https://crates.io/crates/zclap) and `crossterm`. Public keys are bundled for offline use; encryption uses locally installed tools.

## Install

The installers download the binary for your operating system and CPU, verify its SHA-256 checksum, and install it for your user. Rust and administrator privileges are not required.

### Linux and macOS

The script needs `curl`, `tar` with gzip support, `awk`, `sed`, `mktemp`, and either `sha256sum` or `shasum`.

```sh
installer=$(mktemp) &&
curl -fsSL https://github.com/LIghtJUNction/lightjunction/releases/latest/download/install.sh -o "$installer" &&
sh "$installer" &&
export PATH="$HOME/.local/bin:$PATH"
```

The default directory is `~/.local/bin`. To inspect the script first or choose a version and directory:

```sh
curl -fsSL https://github.com/LIghtJUNction/lightjunction/releases/latest/download/install.sh -o install-lightjunction.sh &&
sh install-lightjunction.sh --version 0.2.2 --install-dir "$HOME/.local/bin"
```

### Windows

In PowerShell 5.1 or later, download the script and then run it:

```powershell
$installer = Join-Path $env:TEMP ("lightjunction-install-{0}.ps1" -f [guid]::NewGuid())
Invoke-WebRequest 'https://github.com/LIghtJUNction/lightjunction/releases/latest/download/install.ps1' -OutFile $installer -UseBasicParsing -ErrorAction Stop
& $installer
$env:Path = "$env:LOCALAPPDATA\Programs\lightjunction\bin;$env:Path"
```

The default directory is `$env:LOCALAPPDATA\Programs\lightjunction\bin`. If your system blocks unsigned scripts, use the [manual download](#manual-download). To choose a version and directory:

```powershell
& $installer -Version 0.2.2 -InstallDir "$env:LOCALAPPDATA\Programs\lightjunction\bin"
```

The examples add the default install directory to `PATH` for the current session. Both scripts leave shell profiles and persistent `PATH` settings unchanged. For a custom install directory, add that directory to your session's `PATH` before running `lightjunction`. Rerun the installer to update; a version argument accepts `MAJOR.MINOR.PATCH`, without a `v` prefix. `LIGHTJUNCTION_VERSION` and `LIGHTJUNCTION_INSTALL_DIR` provide optional defaults, with explicit arguments taking precedence.

### Manual download

Download an archive and `SHA256SUMS` from the same [GitHub release](https://github.com/LIghtJUNction/lightjunction/releases/latest). Archive names follow `lightjunction-vVERSION-TARGET.tar.gz` on Linux/macOS and `lightjunction-vVERSION-TARGET.zip` on Windows.

| System | CPU | Target |
| --- | --- | --- |
| Linux | x86_64 | `x86_64-unknown-linux-musl` |
| Linux | ARM64 | `aarch64-unknown-linux-musl` |
| macOS | Intel | `x86_64-apple-darwin` |
| macOS | Apple silicon | `aarch64-apple-darwin` |
| Windows | x86_64 | `x86_64-pc-windows-msvc` |
| Windows | ARM64 | `aarch64-pc-windows-msvc` |

Compute the downloaded archive's checksum with the command for your system. These examples use Linux x86_64, macOS Apple silicon, and Windows x86_64; substitute the filename matching your download.

```sh
# Linux
sha256sum lightjunction-v0.2.2-x86_64-unknown-linux-musl.tar.gz
# macOS
shasum -a 256 lightjunction-v0.2.2-aarch64-apple-darwin.tar.gz
```

```powershell
Get-FileHash .\lightjunction-v0.2.2-x86_64-pc-windows-msvc.zip -Algorithm SHA256
```

Compare the complete hash with that archive's entry in `SHA256SUMS`, then extract it and copy `lightjunction` or `lightjunction.exe` into a directory on `PATH`. The checksum manifest comes from the same GitHub release: it checks download integrity and is not an independent publisher signature. Binaries are not signed with a macOS Developer ID or Windows Authenticode certificate; macOS builds are not notarized.

### Build with Cargo

With Rust 1.99.1 or later:

```sh
cargo install lightjunction --locked
```

From a repository checkout, use `cargo install --path cli --locked` instead. Run `lightjunction` to open the playground. Piped or redirected output receives one generated frame and exits. Encryption commands additionally require the [local encryption tools](#encrypt-a-message).

### Uninstall a binary installation

Remove only the installed executable. For the default locations:

```sh
rm "$HOME/.local/bin/lightjunction"
```

```powershell
Remove-Item "$env:LOCALAPPDATA\Programs\lightjunction\bin\lightjunction.exe"
```

For a custom install directory, remove the executable there. The installers create no persistent profile or `PATH` entries to undo.

## Play

```sh
lightjunction              # Start in Orbit
lightjunction rain         # Falling glyph field
lightjunction wave         # Animated interference colors
lightjunction snake        # Play Snake
lightjunction orbit --seed 42
```

| Key | Action |
| --- | --- |
| `1` / `2` / `3` / `4` | Jump to Orbit, Rain, Wave, or Snake |
| `Tab` | Cycle scenes |
| Arrow keys / WASD | Steer Snake |
| `Space` | Pause or resume every scene |
| `+` / `-` | Change animation speed |
| `[` / `]` | Change particle or glyph density |
| `R` | Reset the scene and Snake |
| `?` | Toggle the control panel |
| `Q` / `Esc` | Leave the playground |

Snake has wall and self-collision, score tracking, deterministic food placement, and instant restart with `R` or `Enter` after a crash.

Use `--frames` for bounded output without keyboard input. Combined with `--seed`, it produces reproducible frames:

```sh
lightjunction orbit --frames 120
lightjunction wave --seed 42 --frames 3 --plain > wave.txt
lightjunction snake --frames 1 --no-timing
```

`--frames` accepts 1–10000. In a terminal, multiple frames animate at 25 frames per second. Without a terminal, frames are written sequentially without ANSI control sequences.

## Public keys

Choose a format to print its raw public key to standard output. Timings remain on standard error, so exported files contain only the key material.

```sh
lightjunction keys
lightjunction keys age > lightjunction-age.txt
lightjunction keys gpg > lightjunction-openpgp.asc
lightjunction keys ssh > lightjunction-ssh.pub
lightjunction keys --json
```

The keys are fixed snapshots included in each release. Their public sources are the repository's [age recipient](https://github.com/LIghtJUNction/lightjunction/blob/main/public/age-recipients.txt), [OpenPGP key](https://github.com/LIghtJUNction/lightjunction/blob/main/pubkey.asc), and [GitHub SSH keys](https://github.com/LIghtJUNction.keys). See [snapshot provenance and fingerprints](keys/README.md) for the exact embedded versions. The OpenPGP primary fingerprint is `EB21B83AB1E982DF66F08387A67178405F7736FD`.

`keys --json` writes a `sections` array. SSH key export leaves `authorized_keys` and SSH access settings unchanged.

## Encrypt a message

Encryption delegates to `age` or `gpg` found on `PATH`. Install the tools for your chosen format using their official documentation:

| Format | Required tools |
| --- | --- |
| age | [age 1.1+](https://github.com/FiloSottile/age#installation) and [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey#installation), because the bundled recipient starts with `age1yubikey1`. |
| OpenPGP | [GnuPG 2.2+](https://www.gnupg.org/documentation/), providing `gpg` with `--recipient-file` support. |

You can encrypt to the age public recipient without a YubiKey. Decryption requires the recipient's corresponding private key and hardware. The CLI provides encryption and public-key export; it does not decrypt or sign messages.

```sh
lightjunction encrypt age --input message.txt --output message.txt.age
lightjunction encrypt gpg --input message.txt --output message.txt.gpg
printf 'Hello, LIghtJUNction.\n' | lightjunction encrypt age --armor --output hello.age
lightjunction encrypt gpg --input message.txt --armor
```

| Encryption option | Behavior |
| --- | --- |
| `--input FILE` | Read the file. Omit it or use `--input -` to read standard input. |
| `--output FILE`, `-o FILE` | Create a new ciphertext file. Omit it or use `--output -` to write to standard output. |
| `--armor` | Produce text-encoded ciphertext suitable for terminal output. |

Encryption refuses to read plaintext from an interactive terminal: supply a file or pipe. Binary ciphertext is refused when standard output is a terminal; choose `--armor` or an output file.

File output is staged and committed only after encryption succeeds, without replacing an existing destination. This atomic no-overwrite commit requires hard-link support on the destination filesystem. There is no overwrite option. Plaintext streams to the encryption tool without being placed in temporary files or process arguments by the CLI. Ciphertext written to standard output can already have been emitted when a later error occurs, so downstream consumers must check the command's exit status; in Bash pipelines, enable `set -o pipefail`.

GPG runs with an isolated temporary home and the bundled key through `--recipient-file`. It skips user configuration, disables automatic key retrieval and agent startup, and leaves the default keyring untouched. Timing and diagnostics stay on standard error for both formats.

## Output options

| Option | Behavior |
| --- | --- |
| `--seed N` | Reproduce particles and Snake food from an unsigned 64-bit seed |
| `--frames N` | Render a bounded animation without keyboard input |
| `--lang en` / `--lang zh` | Choose English or Chinese controls |
| `--plain` | Disable colors |
| `--json` | Print public-key content as JSON; encryption outputs ciphertext |
| `--no-timing` | Hide timing output |
| `--help`, `-h` | Show commands and controls |
| `--version`, `-V` | Show the installed version |

Language selection checks `LC_ALL`, then `LC_MESSAGES`, then `LANG`. An explicit `--lang` takes precedence. `NO_COLOR` and `TERM=dumb` also disable colors.

Scene and key output goes to standard output. Timings go to standard error, so raw keys, JSON, and generated frames remain usable in pipelines. Argument parsing failures still emit a diagnostic timing line, even when `--no-timing` is present.

## Timing

Each command reports its elapsed work time by default. The timer starts inside the running program and excludes operating-system process startup and the timing line's own output. Output I/O and machine load can affect the measurement.

See [measured benchmarks](https://github.com/LIghtJUNction/lightjunction/blob/main/cli/BENCHMARKS.md) for non-interactive scene timings and reproducible raw samples. Those measurements do not cover live terminal rendering or encryption; encryption timings include the external tool and input/output processing.

## Develop

The crate is in the `cli/` directory of the [lightjunction repository](https://github.com/LIghtJUNction/lightjunction). From that directory:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked --all-targets
cargo build --release --locked
uv run --no-project python -m unittest discover -s scripts -p 'test_*.py' -v
cargo run --release --locked -- snake
```

The parser is pinned to `zclap = "=0.1.4"`. `crossterm 0.29` provides portable raw keyboard input and terminal cleanup. CI checks Linux, macOS, and Windows on x86_64 and ARM64, including native archives, installers, public keys, and encryption.

## Release

The repository's [CLI release workflow](https://github.com/LIghtJUNction/lightjunction/blob/main/.github/workflows/cli-release.yml) publishes to crates.io using the GitHub Actions secret `CARGO_REGISTRY_TOKEN`.

Run it manually with `bump` set to `none`, `patch`, `minor`, or `major`, or provide a custom version. A version change in `cli/Cargo.toml` pushed to `main` also starts the release workflow. Publication runs after the workflow's checks; dependency-only changes do not republish an existing version.

The `cli-vVERSION` GitHub release includes the six platform archives, `install.sh`, `install.ps1`, and `SHA256SUMS`. Binary installation uses those assets directly and does not run Cargo.

## License

Original code is licensed under [Agent Upstream License 1.0-draft.1](LICENSE), the repository's custom license. Dependencies retain their own licenses. See the repository's [license scope](https://github.com/LIghtJUNction/lightjunction/blob/main/LICENSING.md) for details.
