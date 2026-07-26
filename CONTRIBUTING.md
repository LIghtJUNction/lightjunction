# Contributing

This is a personal profile repository, but focused fixes and improvements are
welcome.

## Local Setup

```bash
npm ci
uv sync --dev
```

Copy `.env.example` to `.env` only for local experiments. Do not commit real
secrets.

## Quality Gates

Run the same checks that CI uses:

```bash
scripts/check.sh
```

CI runs the shell, Python, and frontend gates as separate parallel jobs. Each
one calls the matching domain script directly, so you can also run just the
part you touched:

```bash
scripts/check-shell.sh      # bash -n + shellcheck
scripts/check-python.sh     # ruff format/lint + mypy + pytest
scripts/check-frontend.sh   # npm run check (typecheck + build)
```

## Pull Requests

- Keep changes scoped and explain the user-visible reason.
- Do not commit generated files from `dist/`, `logs/`, caches, or local env
  files.
- Treat README dynamic sections as generated output unless the change is about
  the renderer itself.
