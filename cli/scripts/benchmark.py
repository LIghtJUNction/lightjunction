#!/usr/bin/env python3
"""Measure complete CLI processes separately from the program's own timer."""

import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import statistics
import subprocess
import sys
import time


TIMING = re.compile(r"^\[time\] command=\S+ status=ok elapsed=([0-9.]+)(us|ms|s)$", re.MULTILINE)
WORKLOADS = {
    "play": [],
    "orbit": ["orbit", "--seed", "42"],
    "rain": ["rain", "--seed", "42"],
    "wave": ["wave", "--seed", "42"],
    "snake": ["snake", "--seed", "42"],
    "help": ["--help"],
}


def summarize(samples):
    """Nearest-rank p95; every value is in microseconds."""
    ordered = sorted(samples)
    return {
        "min_us": min(ordered),
        "median_us": statistics.median(ordered),
        "p95_us": ordered[math.ceil(0.95 * len(ordered)) - 1],
        "max_us": max(ordered),
    }


def cpu_name():
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            key, separator, value = line.partition(":")
            if separator and key.strip() in {"model name", "Hardware"}:
                return value.strip()
    except OSError:
        pass
    if platform.system() == "Darwin":
        try:
            return subprocess.check_output(
                ["sysctl", "-n", "machdep.cpu.brand_string"], text=True, timeout=5
            ).strip()
        except (OSError, subprocess.SubprocessError):
            pass
    return platform.processor() or platform.machine()


def rust_version():
    try:
        return subprocess.check_output(
            [os.environ.get("RUSTC", "rustc"), "--version"], text=True,
            stderr=subprocess.STDOUT, timeout=5
        ).strip()
    except (OSError, subprocess.SubprocessError):
        return "unavailable; pass the build toolchain in PATH or RUSTC"


def invoke(binary, args, environment):
    started = time.perf_counter_ns()
    result = subprocess.run(
        [str(binary), *args], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env=environment, timeout=10, check=False
    )
    elapsed = (time.perf_counter_ns() - started) / 1000
    if result.returncode:
        raise RuntimeError(f"{args!r} exited {result.returncode}: {result.stderr.decode(errors='replace')}")
    stderr = result.stderr.decode("utf-8")
    match = TIMING.search(stderr)
    if not match:
        raise RuntimeError(f"missing successful internal timer for {args!r}: {stderr!r}")
    internal = float(match[1]) * {"us": 1, "ms": 1000, "s": 1_000_000}[match[2]]
    if not math.isfinite(internal) or internal < 0:
        raise RuntimeError(f"invalid internal elapsed time: {match[0]}")
    if b"\x1b" in result.stdout:
        raise RuntimeError(f"non-terminal output contains ANSI controls for {args!r}")
    if not result.stdout:
        raise RuntimeError(f"empty output for {args!r}")
    return elapsed, internal


def main():
    root = Path(__file__).resolve().parents[1]
    suffix = ".exe" if os.name == "nt" else ""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=root / "target" / "release" / f"lightjunction{suffix}")
    parser.add_argument("--samples", type=int, default=100, help="samples per workload (5..1000; default 100)")
    parser.add_argument("--warmup", type=int, default=5, help="untimed warmup calls per workload (0..20)")
    parser.add_argument("--output", type=Path, help="also save the complete JSON report to this path")
    arguments = parser.parse_args()
    if not 5 <= arguments.samples <= 1000:
        parser.error("--samples must be between 5 and 1000")
    if not 0 <= arguments.warmup <= 20:
        parser.error("--warmup must be between 0 and 20")
    binary = arguments.binary.resolve()
    if not binary.is_file():
        parser.error(f"binary not found: {binary}; run cargo build --release --locked first")

    environment = dict(os.environ, LC_ALL="C", LANG="C", NO_COLOR="1", TERM="dumb")
    version = subprocess.check_output(
        [str(binary), "--version", "--no-timing"], env=environment,
        stdin=subprocess.DEVNULL, text=True, timeout=10
    ).strip()
    results = {name: {"process": [], "internal": []} for name in WORKLOADS}
    for _ in range(arguments.warmup):
        for command in WORKLOADS.values():
            invoke(binary, command, environment)
    # Rotate workload order to spread shared-host drift across commands.
    names = list(WORKLOADS)
    for iteration in range(arguments.samples):
        offset = iteration % len(names)
        for name in names[offset:] + names[:offset]:
            process, internal = invoke(binary, WORKLOADS[name], environment)
            results[name]["process"].append(process)
            results[name]["internal"].append(internal)

    report = {
        "schema": 1,
        "measured_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "version": version,
        "binary_bytes": binary.stat().st_size,
        "binary_sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "environment": {
            "os": platform.system(), "os_release": platform.release(),
            "architecture": platform.machine(), "cpu": cpu_name(),
            "logical_cpus": os.cpu_count(), "rustc": rust_version(),
            "python": platform.python_version(),
        },
        "method": {
            "samples_per_workload": arguments.samples,
            "warmup_per_workload": arguments.warmup,
            "clock": "Python time.perf_counter_ns",
            "process_scope": "Parent wall clock around subprocess.run: spawn, loader, command, captured pipe I/O, exit and wait; includes Python overhead.",
            "internal_scope": "CLI-reported elapsed from main entry through output flush; excludes pre-main startup, final timing write and process teardown.",
            "output": "stdout and stderr captured through pipes; stdin is closed; C locale and no colors",
            "p95": "nearest rank, ceil(0.95 * N)",
            "limitations": "Warm filesystem cache on this host; process samples are not interactive terminal latency or CPU time. No claim about other machines or cold starts.",
        },
        "workloads": {
            name: {
                "arguments": WORKLOADS[name],
                "process_wall": summarize(values["process"]),
                "internal_elapsed": summarize(values["internal"]),
                "raw_process_us": values["process"],
                "raw_internal_us": values["internal"],
            }
            for name, values in results.items()
        },
    }
    encoded = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if arguments.output:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(encoded, encoding="utf-8")
    sys.stdout.write(encoded)


if __name__ == "__main__":
    main()
