# Bash helpers

Use Bash, including Termux's Bash. These files are not POSIX `sh` scripts.
Run checked-out entrypoints with `bash script.sh`; this also avoids relying on
Android having `/bin/bash` or `/usr/bin/env` at desktop Linux paths.

## Import a library

```bash
source ./basic.sh
import "$LIBRARY_URL" "$REVIEWED_SHA256"
```

The original repository-relative API still works:

```bash
import lib/str.sh main lightjunction LIghtJUNction \
    https://raw.githubusercontent.com "$REVIEWED_SHA256"
```

The checksum must be a trusted, lowercase SHA256 digest of the exact file.
Use a reviewed commit URL for reproducible imports. Downloading a digest from
an untrusted location alongside the script does not establish authenticity.

Imports fetch the complete text, verify its digest, then source it in the
current shell with process substitution:

```bash
source <(printf '%s' "$content")
```

There are no temporary script files or cleanup traps. The buffer deliberately
preserves trailing newlines. A failed download cannot execute a partial script;
a failed import is not cached. Successful imports are cached by URL and digest.
Sourced libraries can define functions and globals but do not consume stdin.
This loader is for small text libraries, not binary files or large downloads.

A bare `source <(curl ...)` is shorter, but its exit status does not by itself
report the asynchronous curl process's failure. It can also run a partial
response before that failure is known. The buffer and digest check are kept for
that reason. Imported code remains trusted code, not a sandbox or transaction.

## Helper conventions

Libraries can be sourced directly from `lib/`. They do not install packages.
Errors return nonzero instead of terminating the caller or changing global
shell options. Use `set -euo pipefail` in executable entrypoints as appropriate;
functions expected to fail belong in an explicit `if` or `||` check.

Array helpers accept values as separate arguments. `arr_contains` takes the
needle first. Numeric reductions use Bash integers and reject expressions.
Empty sorts/slices print nothing; empty minimum, maximum and average fail.
`arr_filter` treats status 1 as rejection and propagates other callback errors.

String splitting and replacement use literal strings, not shell patterns.
Padding leaves existing spaces untouched. Length and padding follow the
caller's locale, so use a UTF-8 locale for character counts. `str_rand` is for
non-secret labels; use `openssl rand` for credentials.

Network helpers share timeout options. File downloads replace their target only
after success; POST data is literal, including a leading `@`. DNS lookup needs
`getent` or `nslookup`; `net_github_latest` needs `jq` for JSON parsing.

## Behavior changes

- `env.sh` preserves the caller's locale and shell options. Set `STRICT_MODE=1`
  before sourcing it to explicitly enable strict mode. Any nonempty `NO_COLOR`
  disables color. Non-terminal output contains no cursor-control sequences.
- Logging prints literal messages to stderr. It no longer rewrites prior lines
  or exports wrappers without their dependencies. Source `log.sh` in a child
  shell that needs it.
- `file_temp [suffix]` **creates** a private file; callers remove it when done.
  It honors `TMPDIR`, then `$PREFIX/tmp`, then `/tmp`. `file_write` rejects
  symlinks and directories rather than silently replacing them.
- `os_sleep` uses native `sleep`, not Python or Perl. Termux detection uses its
  environment as well as the reported platform; `os_tmpdir` respects explicit
  temporary-directory settings before defaults.
- Review helpers require a terminal or explicit `--confirm`. Prompt helpers
  read `/dev/tty`, keep passwords local, and do not merge command output streams.

SSH deployment retains its pinned GPG identity, managed-key block validation
and embedded sync helper. Public-key downloads and script verification remain
separate. Existing installed helpers are not changed until deployment is rerun.

## Checks

```bash
bash scripts/check-shell.sh
uv run pytest tests/test_shell_helpers.py tests/test_shell_contracts.py
bash scripts/check.sh
```

The check entrypoints share `scripts/lib/check-common.sh`. Shell checks use
Git's NUL-delimited tracked-file list, so add new scripts before running them.
Python checks do not delete existing bytecode caches on exit.

Regression tests use isolated Bash subprocesses, temporary paths and mock
commands; they do not run installers or change live SSH access. Termux path
handling and platform detection are simulated. Passing these tests is not a
claim of testing on an Android device, a smartcard, or macOS's bundled Bash.
