# CLAUDE.md

## Project Overview

This is LIghtJUNction's personal GitHub profile repository. It combines a
manually maintained README, a secure message web app, a portable shell
scripting toolkit, and a set of host-neutral agent skills.

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
- Liquid-glass art language: a fixed `.liquid-field` color layer drifts behind
  frosted `.glass-shell` / `.glass-core` panes (`backdrop-filter` with an
  `@supports` opaque fallback) defined in `src/styles.css`; scroll-reveal +
  pointer-parallax motion lives in `src/motion.ts`, which sets the
  `--lens-*`/`--caustic-*` custom properties on the document root.
- Frontend modules: `terminal.ts` (entry + REPL + app switching),
  `projects.ts` (project cards, groups, cache, pulse), `secure-card.ts`
  (drag physics, encryption, result modal, focus management), `theme.ts`,
  `toast.ts`, `format.ts`, `dom.ts`, `github.ts`, `motion.ts`,
  `public-key.ts`.
- The terminal exposes public commands listed in `src/commands.ts`
  (`COMMAND_NAMES`), plus hidden commands defined only in the `commands` map
  in `terminal.ts` (e.g. `fable5`) that intentionally do not appear in `help`
  or autocomplete.
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

### Agent Skills (`skills/`)
- Host-neutral `SKILL.md` workflows, installable via
  `npx skills add LIghtJUNction/lightjunction -g`.
- See `skills/README.md` for the full index. Do not add a competing
  `.agents/skills/` directory — `skills/` at the repo root is the single
  source of truth.

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | Push, pull request, manual | Parallel `shell` / `python` / `frontend` jobs, each calling the matching `scripts/check-*.sh`, plus a `ci` gate job that fails if any of them did |
| `deploy-pages.yml` | Push to `main`, manual | `build` job (typecheck, build, attest provenance, upload Pages artifact), then a separate `deploy` job |
| `sync-project-cards.yml` | Every 6 hours, manual | Refresh website project-card JSON; guarded to the upstream repo, rebases before pushing |

## Important Notes

- `scripts/check.sh` is a thin orchestrator over `scripts/check-shell.sh`,
  `scripts/check-python.sh`, and `scripts/check-frontend.sh` — CI and local
  dev both call the same domain scripts, so there is one source of truth for
  what "passing" means.
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
