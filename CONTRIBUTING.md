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

## Pull Requests

- Keep changes scoped and explain the user-visible reason.
- Do not commit generated files from `dist/`, `logs/`, caches, or local env
  files.
- Treat README dynamic sections as generated output unless the change is about
  the renderer itself.
