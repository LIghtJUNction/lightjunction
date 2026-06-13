# CLAUDE.md

## Project Overview

This is LIghtJUNction's personal GitHub profile repository. It combines a
manually maintained README, a secure message web app, and a portable shell
scripting toolkit.

## Key Components

### GitHub Profile (`README.md`)
- The README is maintained through deliberate agent edits.
- Do not reintroduce generated recent-commit lists, live repository cards,
  weekly activity counters, or dynamic section markers.
- `scripts/fetch-github-data.py` still feeds `public/github-projects.json` for
  the website project cards; it should not rewrite `README.md`.

### Secure Message Web App (`src/terminal.ts`, `index.html`)
- Vite + TypeScript app deployed to GitHub Pages.
- Uses `openpgp` v6 to encrypt messages with the owner's GPG public key.
- Physics-based card interaction (drag up to send).
- Check: `npm run check`
- Build: `npm run build` -> `dist/`
- Full repository gate: `scripts/check.sh`

### Shell Toolkit
- `basic.sh` — `import()` function to download and source scripts from GitHub.
- `env.sh` — terminal environment, colors, strict mode. Exports `review_then_run()`.
- `log.sh` — logging functions: `err`, `warn`, `ok`, `info`, `debug`, `line`.
- `lib/*.sh` — utility modules: `str`, `arr`, `os`, `file`, `net`, `prompt`, `crypto`.

### SSH Key Deploy (`deploy-ssh-keys.sh`)
- One-liner: `curl -sSL ... | bash`
- Detects Termux or systemd Linux, exports GPG key as SSH key.
- **Security:** script content is shown via `less` for review before execution.
  Use `--confirm` flag to skip review.

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | Push, pull request, manual | Shell, Python, and frontend quality gates |
| `deploy-pages.yml` | Push to `main`, manual | Build web app, deploy to GitHub Pages |
| `sync-project-cards.yml` | Every 6 hours, manual | Refresh website project-card JSON |

## Important Notes

- `import()` deduplicates by URL. All imported scripts must define a guard
  (`[[ -n "${__VAR:-}" ]] && return 0`) to prevent double-sourcing.
- `STRICT_MODE=1` (default) enables `set -euo pipefail`.
- `NON_INTERACTIVE=1` is auto-set when `CI` is set or stdin is not a TTY.
- Local secrets belong in `.env`; commit only `.env.example`.
- GPG Key ID: `EB21B83AB1E982DF66F08387A67178405F7736FD`

## Agent Preferences

- Avoid heavy tasks by default; this machine is resource-constrained
  (about 1 GiB RAM, KVM/QEMU Arch Linux VM).
- Prefer lightweight checks and targeted commands over full scans, full builds,
  or broad test suites unless explicitly requested.
- When running user-environment commands, prefer the `arch` user environment,
  for example `su - arch -c "bash -lc '<command>'"`.
