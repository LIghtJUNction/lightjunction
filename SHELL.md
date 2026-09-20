# Bash helpers

Use Bash, not POSIX `sh`. Local files and online scripts use the same loader.

```bash
source ./basic.sh
import lib/common.sh
import lib/os.sh
```

Online:

```bash
BASE=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main
source <(curl -fsSL "$BASE/basic.sh")
import lib/os.sh
import https://example.org/library.sh
```

`import` uses process substitution, loads in the current shell and deduplicates
successful imports. No checksum, temporary script file or cleanup trap is needed.
The original five repository arguments still work; omit the old sixth hash argument.

`lj_fetch path-or-url` prints a local file when available, otherwise downloads it.
`run_script path-or-url [args...]` runs an executable in a separate Bash process,
so its shell options, traps and `exit` do not affect the caller.

The loader waits for the download process and returns download/source errors.
This is streaming execution, not a transaction: a partial response may have
already executed before a network failure is reported. Use trusted sources.

## Sources and revisions

`LIGHTJUNCTION_RAW_BASE` overrides the repository URL. `LIGHTJUNCTION_REF` selects
a branch, tag or commit when no custom base is supplied. Set it before loading
an entrypoint or `basic.sh`; dependencies use the same selected base.

```bash
export LIGHTJUNCTION_REF="<commit-sha>"
BASE="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/$LIGHTJUNCTION_REF"
bash <(curl -fsSL "$BASE/bootstrap-linux.sh") --help
```

Checked-out scripts prefer their own directory, not the caller's working
directory. `LIGHTJUNCTION_ROOT` can explicitly select a local checkout.

## Shared behavior

`lib/common.sh` provides command checks, private temporary files and data hashes.
Data hash functions are utilities, not mandatory script-verification steps.
`lib/bootstrap.sh` provides logging, prompts, temporary-directory cleanup and
managed configuration blocks. The block writer preserves symlinks and modes,
keeps a first backup, rejects malformed markers and does not rewrite unchanged files.

Termux paths honor `TMPDIR`, then `$PREFIX/tmp`, then `/tmp`. Invoke entrypoints
with `bash script.sh`; installed sync helpers use the actual Bash path. The Linux
bootstrap supports Termux shell packages without sudo; systemd, desktop and
btrfs modules are rejected before installation there.

GPG public-certificate fingerprint validation is unchanged. Installed key-sync
helpers contain local code; scheduled runs download public-key data only.

## Checks

```bash
bash scripts/check-shell.sh
uv run pytest tests/test_shell_loader.py tests/test_shell_helpers.py tests/test_shell_contracts.py tests/test_yubikey_setup.py
```

Tests use isolated homes, mocked installers and temporary GPG keys. They do not
install host packages or prove compatibility with physical Android/macOS devices.

References: [Bash process substitution](https://www.gnu.org/software/bash/manual/html_node/Process-Substitution.html),
[Termux execution environment](https://github.com/termux/termux-packages/wiki/Termux-execution-environment).
