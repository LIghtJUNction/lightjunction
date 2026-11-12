# Shell library

Use Bash for the full library, not POSIX `sh`. The cloud preloader and logging
entrypoint also support zsh; this does not imply that every helper supports zsh.

## Cloud imports

Set the repository base URL, without `/lib`, and load the preloader:

```bash
export LIGHTJUNCTION_SHELL_BASE_URL=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main
. <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")
import log
ok "Ready"
import str
str_trim " hello "
```

You can also source a library directly in Bash or zsh. When the base variable is
nonempty, each library loads the preloader automatically before defining its
helpers. This works on the first invocation:

```bash
export LIGHTJUNCTION_SHELL_BASE_URL=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main
. <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/log.sh")
ok "Ready"
import str
```

`import log`, `import log.sh`, and `import lib/log.sh` all load
`$LIGHTJUNCTION_SHELL_BASE_URL/lib/log.sh`. Full HTTP/HTTPS URLs are also accepted.
The preloader uses a versioned source guard, and successful imports are cached
by resolved URL. Re-sourcing the preloader preserves that cache. A failed import
returns an error and remains retryable. Libraries also guard their definitions
against repeated sourcing.

In Bash, imports stream through process substitution and wait for the download
process, preserving download and source errors. In zsh, imports first capture a
successful download, then source it through process substitution: zsh does not
provide a waitable `$!` for this use. A failed zsh download is not sourced.
Bash may execute a partial response before a network failure is reported.
Use trusted sources. A manually written `. <(curl …)` command itself does not
verify curl's exit status; the error handling above applies to the loader.

Sourcing `lib/preload.sh` directly without setting the variable selects the
repository's `main` URL by default. To use a custom host or pinned revision,
set `LIGHTJUNCTION_SHELL_BASE_URL` before loading any library:

```bash
export LIGHTJUNCTION_SHELL_BASE_URL=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/COMMIT_SHA
```

## Bootstrap

After loading the preloader or any cloud library, run:

```bash
bootstrap              # Linux/Termux or macOS, detected automatically
bootstrap -h           # Show dispatcher help without downloading a setup script
bootstrap linux --help # Show Linux setup options
bootstrap macbook      # Run the macOS setup
```

`bootstrap` downloads the selected root setup script from
`LIGHTJUNCTION_SHELL_BASE_URL`, then executes it in a separate Bash process.
Its dependencies use the same base URL, including a pinned revision or custom
host. Downloads must succeed before execution. Arguments after the target are
forwarded unchanged; the setup script retains its existing prompts and options.
Running `bootstrap` without `--help` performs system setup.

## Loaded functions

```bash
funcs          # Public functions, grouped by library
funcs log      # Functions in the log category
funcs -c       # Category names only
funcs -a       # Include internal helpers beginning with _
funcs log -a   # Include internal logging helpers
```

The preloader tracks functions registered by the bundled libraries, including
libraries sourced directly while the preloader is active. Categories use library
names such as `log`, `str`, and `preload`. Output is sorted, excludes functions
that have been removed from the shell, and assigns a shared name to the last
library that registered it. Unrelated shell functions are not included.
Sourcing a current library upgrades an older preloader in the same shell while
preserving the import cache and function registry. To refresh explicitly:

```bash
. <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")
bootstrap -h
```

## Local Bash loader

With `LIGHTJUNCTION_SHELL_BASE_URL` unset, libraries do not fetch the preloader.
Use `lib/basic.sh` for local/path imports:

```bash
unset LIGHTJUNCTION_SHELL_BASE_URL
source ./lib/basic.sh
import lib/common.sh
import lib/os.sh
```

For a fresh online Bash session using the same path loader:

```bash
BASE=https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main
source <(curl -fsSL "$BASE/lib/basic.sh")
import lib/os.sh
import https://example.org/library.sh
```

This loader deduplicates successful imports and retains the original five
repository arguments; omit the old sixth hash argument. Legacy repository
arguments apply to this local/path loader, not the cloud preloader. When the
cloud preloader is loaded, its `import` takes precedence; start a fresh shell to
return to local/path mode.

`lib/basic.sh` also provides `fetch path-or-url`, which prints a local file when
available and otherwise downloads it, and `run_script path-or-url [args...]`,
which executes in a separate Bash process so shell options, traps and `exit`
do not affect the caller. Loading only `lib/preload.sh` does not define these
helpers.

## Sources and revisions

`LIGHTJUNCTION_RAW_BASE` overrides the repository URL. `LIGHTJUNCTION_REF` selects
a branch, tag or commit when no custom base is supplied. Set it before loading
an entrypoint or `lib/basic.sh`; dependencies use the same selected base.

```bash
export LIGHTJUNCTION_REF="<commit-sha>"
BASE="https://raw.githubusercontent.com/LIghtJUNction/lightjunction/$LIGHTJUNCTION_REF"
bash <(curl -fsSL "$BASE/bootstrap-linux.sh") --help
```

These settings control `lib/basic.sh` and setup entrypoints; cloud imports use
`LIGHTJUNCTION_SHELL_BASE_URL` instead.

Checked-out scripts prefer their own directory, not the caller's working
directory. `LIGHTJUNCTION_ROOT` can explicitly select a local checkout.

## Layout

`lib/` contains the reusable online shell library, including the loader
`lib/basic.sh`, terminal defaults in `lib/env.sh`, and logging in `lib/log.sh`.
Root bootstrap and SSH/GPG scripts are executable setup entrypoints; repository
maintenance tools live in `scripts/`.

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
When zsh is installed, the loader tests also cover first-load logging, short
imports, deduplication, and retrying failed cloud downloads in zsh.

References: [Bash process substitution](https://www.gnu.org/software/bash/manual/html_node/Process-Substitution.html),
[Termux execution environment](https://github.com/termux/termux-packages/wiki/Termux-execution-environment).
