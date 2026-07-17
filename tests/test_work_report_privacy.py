import pytest
import sanitize_work_reports as sanitizer


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
    assert sanitizer.sanitize_text(source) == expected


def test_remaining_leaks_allows_sanitized_text() -> None:
    text = "Read `[local path]`, sent to [email address], and recorded `[evm-address]`."

    assert sanitizer.remaining_leaks(text) == []


def test_sanitize_text_preserves_unlabelled_long_base58_text() -> None:
    ordinary_identifier = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk"

    assert sanitizer.sanitize_text(ordinary_identifier) == ordinary_identifier


def test_sanitize_text_redacts_labelled_solana_address() -> None:
    address = "VvjgAbuxTuK2By8MYRMsWKVfwrN2ps6o5Yk9Eh2d2Hb"

    assert sanitizer.sanitize_text(f"SOL address: {address}") == "SOL address: `[base58-address]`"
