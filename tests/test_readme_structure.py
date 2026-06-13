"""Structural checks for the profile README files."""

from pathlib import Path

README_FILES = [
    Path("README.md"),
    Path("README.zh.md"),
    Path("README.ru.md"),
    Path("README.ko.md"),
    Path("README.ja.md"),
]


def test_readmes_open_with_identity() -> None:
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        first_line = text.splitlines()[0]
        assert first_line == '<div align="center">', path
        assert not first_line.startswith(">"), path


def test_translated_support_sections_warn_against_credentials() -> None:
    checks = {
        "README.zh.md": "请不要发送私钥",
        "README.ru.md": "Не отправляйте приватные ключи",
        "README.ko.md": "개인키",
        "README.ja.md": "秘密鍵",
    }
    for filename, phrase in checks.items():
        text = Path(filename).read_text(encoding="utf-8")
        assert phrase in text, filename
