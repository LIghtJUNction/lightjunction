# CLAUDE.md

## Project Overview

This is LIghtJUNction's personal GitHub profile repository. It combines a
dynamic auto-updating README, a secure message web app, and a portable shell
scripting toolkit.

## Key Components

### Auto-Updating GitHub Profile (`README.md`)
- Dynamic sections (stats, weekly summary, repos, commits, skyline) are
  generated daily by `.github/workflows/daily-readme-update.yml`.
- Three Python scripts power the automation:
  - `scripts/fetch-github-data.py` — fetches GitHub API data
  - `scripts/ai-enhance.py` — calls GitHub Copilot API for insights
  - `scripts/update-readme.py` — replaces `<!-- START_...-->` markers

### Secure Message Web App (`src/main.ts`, `index.html`)
- Vite + TypeScript app deployed to GitHub Pages.
- Uses `openpgp` v6 to encrypt messages with the owner's GPG public key.
- Physics-based card interaction (drag up to send).
- Build: `npm run build` → `dist/`

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
| `daily-readme-update.yml` | Daily midnight UTC | Fetch data, AI enhance, update README |
| `deploy-pages.yml` | Manual | Build web app, deploy to GitHub Pages |

## Important Notes

- `import()` deduplicates by URL. All imported scripts must define a guard
  (`[[ -n "${__VAR:-}" ]] && return 0`) to prevent double-sourcing.
- `STRICT_MODE=1` (default) enables `set -euo pipefall`.
- `NON_INTERACTIVE=1` is auto-set when `CI` is set or stdin is not a TTY.
- GPG Key ID: `EB21B83AB1E982DF66F08387A67178405F7736FD`
