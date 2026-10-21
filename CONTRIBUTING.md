# Contributing

This is a personal profile repository, but focused fixes and improvements are
welcome.

## Local Setup

```bash
npm ci
uv sync --dev
```

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
- Keep the README stable and concise; link to notes instead of embedding feeds.

## Repository map

- `index.html` and `site/profile.*`: the published static profile.
- `src/`, the other HTML pages, and `site/particle-*`: retained experiments;
  they are not shipped with the profile. Run `npm run test:legacy` to check them.
- `scripts/` and the root shell scripts: local tools and setup helpers.
- `.agents/skills/` and `AGENTS.md`: assistant workflows and operating rules.

Only CI and Pages deployment run automatically. The historical project-card
snapshot can be refreshed manually with `uv run scripts/fetch-github-data.py`.

## Licensing and upstream feedback

Read [LICENSE](LICENSE), [LICENSING.md](LICENSING.md) and [UPSTREAM.toml](UPSTREAM.toml) before submitting. New contributors may submit only code they have rights to license. For a fork following an external upstream, AUL asks for confirmed upstream issues and retained changes to be reported upstream, with no duplicate reports or disclosure of secrets. AUL does not grant access or publication authority.
