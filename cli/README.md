# lightjunction

An interactive terminal introduction to [LIghtJUNction](https://github.com/LIghtJUNction). Meet the person, explore the projects, export public keys, and encrypt a message to their age or OpenPGP key.

Built in Rust with [`zclap`](https://crates.io/crates/zclap), with command timings on by default. Profile content and public keys are bundled for offline use. The CLI does not fetch keys, collect telemetry, or keep persistent activity logs; encryption uses locally installed tools.

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

Run `lightjunction` to open the menu. When its output is piped or redirected, it prints the introduction card and exits. Encryption commands additionally require the [local encryption tools](#encrypt-a-message), whichever installation method you choose.

### Uninstall a binary installation

Remove only the installed executable. For the default locations:

```sh
rm "$HOME/.local/bin/lightjunction"
```

```powershell
Remove-Item "$env:LOCALAPPDATA\Programs\lightjunction\bin\lightjunction.exe"
```

For a custom install directory, remove the executable there. The installers create no persistent profile or `PATH` entries to undo.

## Explore

```sh
lightjunction about
lightjunction projects
lightjunction projects magicnet
lightjunction tour
lightjunction spark
```

| Command | What you get |
| --- | --- |
| `card` | A compact introduction and places to explore. |
| `about` | The person and interests behind the projects. |
| `projects [project-name]` | The project collection, or one project's introduction. |
| `principles` | A few ideas behind the work. |
| `links` | Public GitHub and website links. |
| `tour` | The complete introduction, printed all at once. |
| `spark` | An original engineering question to think about. |
| `keys [age\|gpg\|ssh]` | A public-key summary, or one format's raw public key. |
| `encrypt age\|gpg` | Encrypt a file or input stream to the bundled recipient key. |

The collection introduces Project Z, LMM API, MagicNet, OniMods, and HumanGrant. Profile content comes from the [public repository](https://github.com/LIghtJUNction/lightjunction). The questions in `spark` are written for this CLI; they are not historical quotations. The `tour` command prints every section and exits without waiting for input; the menu provides interactive navigation.

In the menu, enter a number or a command. Enter `s` or `stats` for session timings, and `q`, `quit`, or `exit` to leave. You can also drive the menu with a script:

```sh
printf 'about\nprojects\ns\nq\n' | lightjunction --interactive --plain
```

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

`keys --json` uses the same `sections` array as the profile commands. SSH key export leaves `authorized_keys` and SSH access settings unchanged.

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

`-i` remains the alias for `--interactive`; use the full `--input` name for a file. Encryption refuses to read plaintext from an interactive terminal: supply a file or pipe. Binary ciphertext is refused when standard output is a terminal; choose `--armor` or an output file.

File output is staged and committed only after encryption succeeds, without replacing an existing destination. This atomic no-overwrite commit requires hard-link support on the destination filesystem. There is no overwrite option. Plaintext streams to the encryption tool without being placed in temporary files or process arguments by the CLI. Ciphertext written to standard output can already have been emitted when a later error occurs, so downstream consumers must check the command's exit status; in Bash pipelines, enable `set -o pipefail`.

GPG runs with an isolated temporary home and the bundled key through `--recipient-file`. It skips user configuration, disables automatic key retrieval and agent startup, and leaves the default keyring untouched. Timing and diagnostics stay on standard error for both formats.

## Output options

| Option | Behavior |
| --- | --- |
| `--lang en` / `--lang zh` | Choose English or Chinese. |
| `--plain` | Disable terminal styling. |
| `--json` | Print profile or public-key content as JSON. Encryption outputs ciphertext. |
| `--interactive`, `-i` | Open the menu even with piped input. |
| `--no-timing` | Hide timings after successful argument parsing. |
| `--help`, `-h` | Show usage. |
| `--version`, `-V` | Show the installed version. |

Language selection checks `LC_ALL`, then `LC_MESSAGES`, then `LANG`. Chinese locales select Chinese; other or missing locales select English. An explicit `--lang` takes precedence.

```sh
lightjunction --lang zh about
lightjunction --json projects
lightjunction --plain --no-timing card
```

Command content goes to standard output. Timings go to standard error, so JSON and text remain usable in pipelines. Argument parsing failures still emit a diagnostic timing line, even when `--no-timing` is present.

## Timing

Each command reports its elapsed work time by default. Interactive sessions also track the command count, minimum, mean, maximum, cumulative work time, input wait time, and total session time. Use `stats` during the session or read the summary on exit. Statistics live only for that session.

The timer starts inside the running program. It excludes operating-system process startup and the timing line's own output. Waiting for interactive input is recorded separately from command work. Output I/O and machine load can affect the measured work time.

For end-to-end startup performance, measure the release binary from a separate process. An internal command timing describes a different interval from launching and exiting the executable.

See [measured benchmarks](https://github.com/LIghtJUNction/lightjunction/blob/main/cli/BENCHMARKS.md) for historical measurements of the **0.1.1 introduction commands**, including the environment and raw samples. Those measurements do not cover encryption; encryption timings include the external tool and input/output processing.

## Develop

The crate is in the `cli/` directory of the [lightjunction repository](https://github.com/LIghtJUNction/lightjunction). From that directory:

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo build --release --locked
cargo run --release --locked -- --plain card
```

The parser dependency is pinned to `zclap = "=0.1.4"`. CI is configured to test Linux, macOS, and Windows, and to check formatting, linting, and crate packaging.

## Release

The repository's [CLI release workflow](https://github.com/LIghtJUNction/lightjunction/blob/main/.github/workflows/cli-release.yml) publishes to crates.io using the GitHub Actions secret `CARGO_REGISTRY_TOKEN`.

Run it manually with `bump` set to `none`, `patch`, `minor`, or `major`, or provide a custom version. A version change in `cli/Cargo.toml` pushed to `main` also starts the release workflow. Publication runs after the workflow's checks.

The `cli-vVERSION` GitHub release includes the six platform archives, `install.sh`, `install.ps1`, and `SHA256SUMS`. Binary installation uses those assets directly and does not run Cargo.

## License

Original code is licensed under [Agent Upstream License 1.0-draft.1](LICENSE), the repository's custom license. Dependencies retain their own licenses. See the repository's [license scope](https://github.com/LIghtJUNction/lightjunction/blob/main/LICENSING.md) for details.
