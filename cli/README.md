# lightjunction

A tiny keyboard-driven terminal playground built in Rust. No profile pages, network requests, telemetry, or saved state—just generated motion and a playable game.

## Run

From this repository:

```sh
cargo install --path cli --locked
lightjunction
```

Inside `cli/`, use `cargo install --path . --locked` instead. Rust 1.99.1 or later is required.

A terminal opens the full-screen playground. Piped or redirected output receives one generated frame and exits, so scripts never wait for keyboard input.

## Play

```sh
lightjunction              # Start in Orbit
lightjunction rain         # Falling glyph field
lightjunction wave         # Animated interference colors
lightjunction snake        # Play Snake
lightjunction orbit --seed 42
```

| Key | Action |
| --- | --- |
| `1` / `2` / `3` / `4` | Jump to Orbit, Rain, Wave, or Snake |
| `Tab` | Cycle scenes |
| Arrow keys / WASD | Steer Snake |
| `Space` | Pause or resume every scene |
| `+` / `-` | Change animation speed |
| `[` / `]` | Change particle or glyph density |
| `R` | Reset the scene and Snake |
| `?` | Toggle the control panel |
| `Q` / `Esc` | Leave the playground |

Snake has wall and self-collision, score tracking, deterministic food placement, and instant restart with `R` or `Enter` after a crash.

## Script and capture

Use `--frames` for bounded output without keyboard input. Combined with `--seed`, it produces reproducible frames:

```sh
lightjunction orbit --frames 120
lightjunction wave --seed 42 --frames 3 --plain > wave.txt
lightjunction snake --frames 1 --no-timing
```

`--frames` accepts 1–10000. In a terminal, multiple frames animate at 25 frames per second. Without a terminal, frames are written sequentially without ANSI control sequences.

| Option | Behavior |
| --- | --- |
| `--seed N` | Reproduce particles and Snake food from an unsigned 64-bit seed |
| `--frames N` | Render a bounded animation without keyboard input |
| `--lang en` / `--lang zh` | Choose English or Chinese controls |
| `--plain` | Disable colors |
| `--no-timing` | Hide timing output |
| `--help`, `-h` | Show commands and controls |
| `--version`, `-V` | Show the installed version |

Language selection checks `LC_ALL`, then `LC_MESSAGES`, then `LANG`. An explicit `--lang` takes precedence. `NO_COLOR` and `TERM=dumb` also disable colors.

Scene output goes to standard output. Timings go to standard error and can be disabled with `--no-timing`.

## Develop

From `cli/`:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked --all-targets
cargo build --release --locked
cargo run --release --locked -- snake
```

The parser is pinned to `zclap = "=0.1.4"`. `crossterm 0.29` provides portable raw keyboard input and terminal cleanup. CI checks Linux, macOS, and Windows.

## Release

The repository's [CLI release workflow](https://github.com/LIghtJUNction/lightjunction/blob/main/.github/workflows/cli-release.yml) publishes to crates.io using the GitHub Actions secret `CARGO_REGISTRY_TOKEN`.

Run it manually with `bump` set to `none`, `patch`, `minor`, or `major`, or provide a custom version. A version change in `cli/Cargo.toml` pushed to `main` also starts the release workflow. Publication runs after the workflow's checks.

## License

Original code is licensed under [Agent Upstream License 1.0-draft.1](LICENSE), the repository's custom license. Dependencies retain their own licenses. See the repository's [license scope](https://github.com/LIghtJUNction/lightjunction/blob/main/LICENSING.md) for details.
