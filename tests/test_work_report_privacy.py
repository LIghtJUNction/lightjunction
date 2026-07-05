from pathlib import Path

import pytest


def load_sanitizer():
    import importlib.util

    script = Path(__file__).resolve().parents[1] / "scripts" / "sanitize-work-reports.py"
    spec = importlib.util.spec_from_file_location("sanitize_work_reports", script)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("/root/.kimaki/projects/lightjunction/WORK_REPORT/2026/06/30.md", "[local path]"),
        ("`/home/lightjunction/.config/agentmail/env`", "`[local path]`"),
        ("https://bscscan.com/tx/0x" + "a" * 64, "`[bscscan tx]`"),
        ("0x" + "b" * 40, "`[evm-address]`"),
        ("0x" + "c" * 64, "`[tx-hash]`"),
        ("lightjunction.me@gmail.com", "[email address]"),
        ("at://did:plc:example/app.bsky.feed.post/abc", "`[atproto record]`"),
        ("0.002681806513120592 BNB", "[amount] BNB"),
        ("1.354586777904000049 ASTER", "[amount] ASTER"),
    ],
)
def test_sanitize_text_redacts_sensitive_report_details(source: str, expected: str) -> None:
    sanitizer = load_sanitizer()

    assert sanitizer.sanitize_text(source) == expected


def test_remaining_leaks_allows_sanitized_text() -> None:
    sanitizer = load_sanitizer()
    text = "Read `[local path]`, sent to [email address], and recorded `[evm-address]`."

    assert sanitizer.remaining_leaks(text) == []
