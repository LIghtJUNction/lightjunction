# Benchmarks

`lightjunction 0.1.1` completed the six workloads below with internal median times of 25.22–274.81 µs and external process median times of 1.713–1.979 ms on this host. The release binary was **477,352 bytes**.

## Results

Measured on 2026-11-12 with 100 samples and 5 warmup runs per workload. Lower is faster; p95 uses the nearest-rank method.

| Workload | Internal median (µs) | Internal p95 (µs) | External median (ms) | External p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Orbit, no arguments | 121.23 | 313.81 | 1.827 | 5.426 |
| `orbit --seed 42` | 132.23 | 350.97 | 1.898 | 5.362 |
| `rain --seed 42` | 60.72 | 155.90 | 1.753 | 5.997 |
| `wave --seed 42` | 274.81 | 721.25 | 1.979 | 6.051 |
| `snake --seed 42` | 45.53 | 142.49 | 1.743 | 5.600 |
| `--help` | 25.22 | 61.26 | 1.713 | 4.715 |

Source: [complete results and individual samples](benchmark-results.json).

## Measurement boundaries

**Internal time** is the CLI's own elapsed time from entry into `main` through output flush. It excludes operating-system process startup, the final timing line, and process teardown. Every scene renders one frame; no workload waits for interactive input.

**External time** is the parent Python process's wall clock around `subprocess.run`. It includes Python overhead, process creation, loader work, command execution, captured stdout and stderr I/O, exit, and waiting for the child process. Both output streams are piped, stdin is closed, the locale is `C`, and colors are disabled.

These results use a warm filesystem cache on a shared Linux host. They describe these measured executions; cold starts, other hardware, and rendering in an interactive terminal require separate measurements. The external timings are elapsed time, not CPU time.

## Environment and reproduction

- Linux 7.2.11-arch1-1, x86_64; 12th Gen Intel Core i9-12900HX; 24 logical CPUs visible to the process.
- Rust 1.99.1 (`58cf8f9c3`, 2026-10-13); Python 3.14.8.
- Release profile: `opt-level = 3`, LTO enabled, one codegen unit, symbols stripped, and abort on panic.
- Workload order rotates between samples to spread shared-host drift across commands.

From the `cli/` directory:

```sh
cargo build --release --locked
uv run --no-project python scripts/benchmark.py --samples 100 --warmup 5 --output benchmark-results.json
```

The [benchmark script](scripts/benchmark.py) records the environment, binary size and digest, timing boundaries, summary statistics, and every sample. It also checks successful exit codes, timing output, non-empty scene output, and the absence of ANSI controls in piped output.
