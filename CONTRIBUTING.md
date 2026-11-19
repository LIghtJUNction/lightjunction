# Contributing

Focused fixes are welcome. Keep changes tied to a visible problem, verify them
locally, and preserve the public keys and Challenge II material.

## Local setup

```sh
npm ci
uv sync --dev
```

Node.js 24 or newer runs the frontend checks. The crypto integration tests also
need the `age` executable. Rust commands use the toolchain pinned in
`cli/rust-toolchain.toml`.

## Local checks

Run the domain checks affected by a change:

```sh
scripts/check-shell.sh      # Bash syntax and ShellCheck
scripts/check-python.sh     # Ruff, mypy, and pytest
scripts/check-frontend.sh   # Crypto checks, profile tests, and production build
scripts/check.sh            # All three domains above
```

For CLI changes, run these commands from `cli/`:

```sh
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked --all-targets
uv run --no-project python -m unittest discover -s scripts -p 'test_*.py'
```

Daily verification runs locally. The CI workflows remain available on demand,
and the CLI matrix is reused by the official release workflow. Pages deployment
runs when published website inputs change. CLI release preparation, native
artifacts, and registry publication remain in the release workflow.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `site/profile.*` | Published profile and optional browser enhancements |
| `archive.html`, `public/junction-ii.png` | Original public Challenge II section and artifact |
| `public/fonts/`, `public/readme-hero.svg` | Current fonts and README artwork |
| `pubkey.asc`, `public/age-recipients.txt` | Public contact downloads |
| `src/age-crypto.ts`, `src/public-key.ts` | Retained, independently tested crypto helper and public constants |
| `cli/` | Rust command-line tool, installers, and release tooling |
| `scripts/`, `lib/`, root shell scripts | Local checks and machine setup helpers |
| `tests/` | Current profile, crypto, repository, and shell regression checks |
| `.agents/skills/`, `AGENTS.md` | Repository workflows and operating instructions |
| `workspace/` | Ignored local working material |

Retired games, visual experiments, generated project snapshots, and their tests
are available through Git history. Do not restore them as build inputs without a
current product requirement.

## Changes and licensing

Keep commits scoped, describe the user-visible reason, and include the checks
actually run. Never commit `dist/`, build caches, credentials, or local runtime
state. Keep README identity and contact information stable.

Read [LICENSE](LICENSE), [LICENSING.md](LICENSING.md), and
[UPSTREAM.toml](UPSTREAM.toml) before contributing. Submit only material you have
the right to license. An upstream feedback requirement does not authorize
publishing private data or secrets.
