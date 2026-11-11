# lightjunction

An interactive terminal introduction to [LIghtJUNction](https://github.com/LIghtJUNction). Meet the person, explore the projects, and pick up a small engineering question along the way.

Built in Rust with [`zclap`](https://crates.io/crates/zclap), with command timings on by default. Everything runs locally: no network requests, telemetry, or persistent activity logs.

## Install

```sh
cargo install lightjunction --locked
lightjunction
```

Build with Rust 1.99.1 or later. In a terminal, `lightjunction` opens a menu. When its output is piped or redirected, it prints the introduction card and exits.

## Explore

```sh
lightjunction about
lightjunction projects
lightjunction projects magicnet
lightjunction tour
lightjunction spark
```

| Command | What you get |
| --- | --- |
| `card` | A compact introduction and places to explore. |
| `about` | The person and interests behind the projects. |
| `projects [project-name]` | The project collection, or one project's introduction. |
| `principles` | A few ideas behind the work. |
| `links` | Public GitHub and website links. |
| `tour` | A guided introduction. |
| `spark` | An original engineering question to think about. |

The collection introduces Project Z, LMM API, MagicNet, OniMods, and HumanGrant. Profile content comes from the [public repository](https://github.com/LIghtJUNction/lightjunction). The questions in `spark` are written for this CLI; they are not historical quotations.

In the menu, enter a number or a command. Enter `s` or `stats` for session timings, and `q`, `quit`, or `exit` to leave. You can also drive the menu with a script:

```sh
printf 'about\nprojects\ns\nq\n' | lightjunction --interactive --plain
```

## Output options

| Option | Behavior |
| --- | --- |
| `--lang en` / `--lang zh` | Choose English or Chinese. |
| `--plain` | Disable terminal styling. |
| `--json` | Print the selected command's content as JSON. A JSON tour does not wait for input. |
| `--interactive` | Open the menu even with piped input. |
| `--no-timing` | Hide timing output. |
| `--help`, `-h` | Show usage. |
| `--version`, `-V` | Show the installed version. |

Language selection checks `LC_ALL`, then `LC_MESSAGES`, then `LANG`. Chinese locales select Chinese; other or missing locales select English. An explicit `--lang` takes precedence.

```sh
lightjunction --lang zh about
lightjunction --json projects
lightjunction --plain --no-timing card
```

Command content goes to standard output. Timings go to standard error, so JSON and text remain usable in pipelines.

## Timing

Each command reports its elapsed work time by default. Interactive sessions also track the command count, minimum, mean, maximum, cumulative work time, input wait time, and total session time. Use `stats` during the session or read the summary on exit. Statistics live only for that session.

The timer starts inside the running program. It excludes operating-system process startup and the timing line's own output. Waiting for interactive input is recorded separately from command work. Output I/O and machine load can affect the measured work time.

For end-to-end startup performance, measure the release binary from a separate process. An internal command timing describes a different interval from launching and exiting the executable.

## Develop

The crate is in the `cli/` directory of the [lightjunction repository](https://github.com/LIghtJUNction/lightjunction). From that directory:

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo build --release --locked
cargo run --release --locked -- --plain card
```

The parser dependency is pinned to `zclap = 0.1.4`. CI is configured to test Linux, macOS, and Windows, and to check formatting, linting, and crate packaging.

## Release

The repository's [CLI release workflow](https://github.com/LIghtJUNction/lightjunction/blob/main/.github/workflows/cli-release.yml) publishes to crates.io using the GitHub Actions secret `CARGO_REGISTRY_TOKEN`.

Run it manually with `bump` set to `none`, `patch`, `minor`, or `major`, or provide a custom version. A version change in `cli/Cargo.toml` pushed to `main` also starts the release workflow. Publication runs after the workflow's checks.

## License

Original code is licensed under [Agent Upstream License 1.0-draft.1](LICENSE), the repository's custom license. Dependencies retain their own licenses. See the repository's [license scope](https://github.com/LIghtJUNction/lightjunction/blob/main/LICENSING.md) for details.
