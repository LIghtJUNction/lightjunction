#!/usr/bin/env python3
"""Redact sensitive operational details from tracked work reports."""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path

DEFAULT_REPORTS_DIR = Path(__file__).resolve().parents[1] / "WORK_REPORT"
REPORT_RE = re.compile(r"^\d{4}/\d{2}/\d{2}\.md$")

REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"`/(?:root|home)/[^`\s]+`"),
        "`[local path]`",
    ),
    (
        re.compile(r"(?<![\w/])/(?:root|home)/[^\s`),;，。]+"),
        "[local path]",
    ),
    (
        re.compile(r"`~/(?:\.config|\.kimaki)/[^`\s]+`"),
        "`[local path]`",
    ),
    (
        re.compile(r"(?<![\w/])~/(?:\.config|\.kimaki)/[^\s`),;，。]+"),
        "[local path]",
    ),
    (
        re.compile(r"`?at://[A-Za-z0-9:._~/%+-]+`?"),
        "`[atproto record]`",
    ),
    (
        re.compile(r"`?https://bscscan\.com/tx/0x[a-fA-F0-9]{64}`?"),
        "`[bscscan tx]`",
    ),
    (
        re.compile(r"`?0x[a-fA-F0-9]{64}`?"),
        "`[tx-hash]`",
    ),
    (
        re.compile(r"`?0x[a-fA-F0-9]{40}`?"),
        "`[evm-address]`",
    ),
    (
        re.compile(r"`?bc1[a-z0-9]{25,90}`?", re.IGNORECASE),
        "`[btc-address]`",
    ),
    (
        re.compile(
            r"(?i)\b(?:sol(?:ana)?(?:\s+(?:wallet|address))?|wallet(?:\s+address)?)"
            r"\s*[:=]\s*`?[1-9A-HJ-NP-Za-km-z]{32,44}`?"
        ),
        "SOL address: `[base58-address]`",
    ),
    (
        re.compile(r"\b\d+\.\d{6,}\s+(BNB|USDT|ASTER|SKYAI|COAI|CAKE|TAG|BEAT|WBNB)\b"),
        r"[amount] \1",
    ),
    (
        re.compile(r"<[^<>\s]+@email\.amazonses\.com>"),
        "<[mail-message-id]>",
    ),
    (
        re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            re.IGNORECASE,
        ),
        "[email address]",
    ),
    (
        re.compile(
            r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
            re.IGNORECASE,
        ),
        "[uuid]",
    ),
)

LEAK_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("local absolute path", re.compile(r"(?<![\w/])/(?:root|home)/")),
    ("local config path", re.compile(r"(?<![\w/])~/(?:\.config|\.kimaki)/")),
    ("atproto record URI", re.compile(r"at://")),
    ("BscScan transaction URL", re.compile(r"https://bscscan\.com/tx/")),
    ("EVM address or transaction hash", re.compile(r"\b0x[a-fA-F0-9]{40,64}\b")),
    ("Bitcoin address", re.compile(r"\bbc1[a-z0-9]{25,90}\b", re.IGNORECASE)),
    (
        "high-precision token amount",
        re.compile(r"\b\d+\.\d{6,}\s+(?:BNB|USDT|ASTER|SKYAI|COAI|CAKE|TAG|BEAT|WBNB)\b"),
    ),
    ("Amazon SES message id", re.compile(r"@email\.amazonses\.com")),
    (
        "email address",
        re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", re.IGNORECASE),
    ),
)


def atomic_write_text(path: Path, content: str) -> None:
    """Replace a report atomically while preserving its permission bits."""
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
        text=True,
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, path.stat().st_mode)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Redact sensitive details from WORK_REPORT/YYYY/MM/DD.md files."
    )
    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=DEFAULT_REPORTS_DIR,
        help=f"WORK_REPORT directory to scan (default: {DEFAULT_REPORTS_DIR})",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if any report would change or still contains blocked patterns.",
    )
    return parser.parse_args()


def report_paths(reports_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in reports_dir.glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9].md")
        if REPORT_RE.match(path.relative_to(reports_dir).as_posix())
    )


def sanitize_text(text: str) -> str:
    sanitized = text
    for pattern, replacement in REPLACEMENTS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def remaining_leaks(text: str) -> list[str]:
    return [name for name, pattern in LEAK_PATTERNS if pattern.search(text)]


def main() -> int:
    args = parse_args()
    reports_dir = args.reports_dir.resolve()

    if not reports_dir.is_dir():
        print(f"reports directory does not exist: {reports_dir}", file=sys.stderr)
        return 2

    changed: list[Path] = []
    leaks: list[tuple[Path, list[str]]] = []

    for path in report_paths(reports_dir):
        text = path.read_text(encoding="utf-8")
        sanitized = sanitize_text(text)
        if sanitized != text:
            changed.append(path)
            if not args.check:
                atomic_write_text(path, sanitized)
        found = remaining_leaks(sanitized)
        if found:
            leaks.append((path, found))

    if args.check:
        for path in changed:
            print(f"would update {path.relative_to(reports_dir)}", file=sys.stderr)
        for path, found in leaks:
            names = ", ".join(found)
            print(f"blocked pattern in {path.relative_to(reports_dir)}: {names}", file=sys.stderr)
        return 1 if changed or leaks else 0

    for path in changed:
        print(f"updated {path.relative_to(reports_dir)}")
    if leaks:
        for path, found in leaks:
            names = ", ".join(found)
            print(
                f"warning: blocked pattern remains in {path.relative_to(reports_dir)}: {names}",
                file=sys.stderr,
            )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
