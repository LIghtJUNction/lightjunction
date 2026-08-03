"""Structural checks for the stable profile README files."""

from pathlib import Path

README_FILES = [
    Path("README.md"),
    Path("README.zh.md"),
    Path("README.ru.md"),
    Path("README.ko.md"),
    Path("README.ja.md"),
]

OLD_PANELS = [
    "profile-hero.svg",
    "profile-pulse.svg",
    "profile-projects.svg",
    "profile-actions.svg",
    "PROFILE_ACTIONS.md",
]


def test_readmes_start_with_one_stable_hero() -> None:
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        leading_lines = text.splitlines()[:8]
        assert '<div align="center">' in leading_lines, path
        assert text.count("public/readme-hero.svg") == 1, path
        assert "?" not in next(line for line in text.splitlines() if "readme-hero.svg" in line), (
            path
        )
        for old_panel in OLD_PANELS:
            assert old_panel not in text, path


def test_readme_hero_is_lightweight_static_svg() -> None:
    hero = Path("public/readme-hero.svg")
    text = hero.read_text(encoding="utf-8")
    assert hero.stat().st_size < 15_000
    assert "<script" not in text
    assert "<animate" not in text
    assert "http://" not in text.replace('xmlns="http://www.w3.org/2000/svg"', "")
    assert "https://" not in text


def test_readme_hero_uses_editorial_palette_and_junction_metaphor() -> None:
    text = Path("public/readme-hero.svg").read_text(encoding="utf-8")
    required = [
        'width="1200" height="430"',
        'fill="#CBCADB"',
        'fill="#FAF9F5"',
        'stroke="#141413"',
        'fill="#D97757"',
        "LIghtJUNction",
        "MANY SIGNALS. ONE USEFUL ROUTE.",
        "<circle",
    ]
    for fragment in required:
        assert fragment in text

    forbidden = ["<linearGradient", "<radialGradient", "<filter", "<image"]
    for fragment in forbidden:
        assert fragment not in text


def test_obsolete_profile_generation_is_removed() -> None:
    obsolete = [
        "PROFILE_ACTIONS.md",
        "public/profile-hero.png",
        "public/profile-hero.svg",
        "public/profile-pulse.svg",
        "public/profile-projects.svg",
        "public/profile-actions.svg",
        "scripts/update_profile_pulse.py",
        "scripts/generate-readme-ascii-flame.py",
        ".github/workflows/refresh-profile-pulse.yml",
        "tests/test_update_profile_pulse.py",
    ]
    for path in obsolete:
        assert not Path(path).exists(), path


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


def test_readmes_include_localized_api_relay_recommendation() -> None:
    headings = {
        "README.md": "### Recommended API relay",
        "README.zh.md": "### 中转站推荐",
        "README.ru.md": "### Рекомендуемый API-шлюз",
        "README.ko.md": "### 추천 API 중계 서비스",
        "README.ja.md": "### おすすめのAPI中継サービス",
    }
    link = "[api.lmm.best](https://api.lmm.best/)"
    for filename, heading in headings.items():
        text = Path(filename).read_text(encoding="utf-8")
        assert heading in text, filename
        assert link in text, filename


def test_challenge_two_recovery_ledger_exists_in_every_language() -> None:
    headings = {
        "README.md": "### Challenge II — asymmetric signal",
        "README.zh.md": "### 挑战二——非对称信号",
        "README.ru.md": "### Испытание II — асимметричный сигнал",
        "README.ko.md": "### 챌린지 II — 비대칭 신호",
        "README.ja.md": "### チャレンジ II — 非対称シグナル",
    }
    challenge_link = "https://lightjunction.github.io/lightjunction/#challenge-two"
    for filename, heading in headings.items():
        text = Path(filename).read_text(encoding="utf-8")
        assert heading in text, filename
        assert challenge_link in text, filename
        assert "| --- | ---: | --- | --- | --- |" in text, filename
