# Benchmarks

`lightjunction 0.1.0` completed the six workloads below with internal median times of 18.39–21.23 µs and external process median times of 1.078–1.140 ms on this host. The release binary was **366,680 bytes**.

## Results

Measured on 2026-11-11 with 100 samples and 5 warmup runs per workload. Lower is faster; p95 uses the nearest-rank method.

| Workload | Internal median (µs) | Internal p95 (µs) | External median (ms) | External p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Card, no arguments | 18.39 | 41.01 | 1.099 | 1.406 |
| `about` | 18.81 | 29.71 | 1.078 | 1.568 |
| `projects` | 20.56 | 45.87 | 1.085 | 1.475 |
| `tour` | 21.03 | 34.86 | 1.140 | 1.576 |
| `--help` | 20.28 | 28.94 | 1.121 | 1.473 |
| `tour --json` | 21.23 | 32.46 | 1.127 | 1.701 |

Source: [complete results and individual samples](benchmark-results.json).

## Measurement boundaries

**Internal time** is the CLI's own elapsed time from entry into `main` through output flush. It excludes operating-system process startup, the final timing line, and process teardown. No workload waits for interactive input.

**External time** is the parent Python process's wall clock around `subprocess.run`. It includes Python overhead, process creation, loader work, command execution, captured stdout and stderr I/O, exit, and waiting for the child process. Both output streams are piped, stdin is closed, the locale is `C`, and colors are disabled.

These results use a warm filesystem cache on a shared Linux host. They describe these measured executions; cold starts, other hardware, and rendering in an interactive terminal require separate measurements. The external timings are elapsed time, not CPU time.

## Environment and reproduction

- Linux 6.18.57, x86_64; AMD EPYC 9V74 80-Core Processor; 9 logical CPUs visible to the process.
- Rust 1.99.1 (`58cf8f9c3`, 2026-10-13); Python 3.12.14.
- Release profile: `opt-level = 3`, LTO enabled, one codegen unit, symbols stripped, and abort on panic.
- Workload order rotates between samples to spread shared-host drift across commands.

From the `cli/` directory:

```sh
cargo build --release --locked
python3 scripts/benchmark.py --samples 100 --warmup 5 --output benchmark-results.json
```

The [benchmark script](scripts/benchmark.py) records the environment, binary size and digest, timing boundaries, summary statistics, and every sample. It also checks successful exit codes, timing output, and the JSON response structure.
