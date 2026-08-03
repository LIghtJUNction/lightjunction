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


def test_challenge_two_ledger_is_canonical_in_english_readme() -> None:
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
        if filename == "README.md":
            assert "| --- | ---: | --- | --- | --- |" in text
        else:
            assert "`README.md`" in text, filename
            assert "| --- | ---: | --- | --- | --- |" not in text, filename


def test_english_readme_separates_challenge_claim_from_bug_fix_rewards() -> None:
    text = Path("README.md").read_text(encoding="utf-8")
    required = [
        "#### Claim and record a recovery",
        "Redeem the recovered code directly",
        "No Issue, email, or manual approval is required",
        "### Real bug-fix contribution rewards",
        "find and fix real code defects",
        "reproduction steps, expected behavior, actual behavior, and impact",
        "focused pull request that fixes the Issue",
        "LIghtJUNction encrypted channel",
        "lightjunction.me@gmail.com",
        "I will review whether the Issue is genuine and the fix is valid",
        "Low-quality reports, fabricated bugs, duplicate Issues",
    ]
    for fragment in required:
        assert fragment in text

    assert "Submit a recovery for review" not in text


def test_translated_readmes_include_bug_fix_reward_workflow() -> None:
    checks: dict[str, tuple[str, str, str, list[str]]] = {
        "README.zh.md": (
            "### 挑战二——非对称信号",
            "### 真实缺陷修复贡献奖励",
            "### 链接",
            [
                "可重现的代码缺陷",
                "预期行为、实际行为和影响",
                "LIghtJUNction 加密通道",
                "审核问题是否属实以及修复方案是否有效",
                "低质量报告、捏造的错误、重复 Issue",
            ],
        ),
        "README.ja.md": (
            "### チャレンジ II — 非対称シグナル",
            "### 実際のバグ修正への貢献報酬",
            "### リンク",
            [
                "再現可能なコード欠陥",
                "期待される動作、実際の動作、影響",
                "LIghtJUNction の暗号化チャネル",
                "Issue が実在する問題を報告しているか、修正が有効か",
                "低品質な報告、捏造されたバグ、重複 Issue",
            ],
        ),
        "README.ko.md": (
            "### 챌린지 II — 비대칭 신호",
            "### 실제 버그 수정 기여 보상",
            "### 링크",
            [
                "재현 가능한 코드 결함",
                "예상 동작, 실제 동작, 영향",
                "LIghtJUNction 암호화 채널",
                "Issue가 실제 문제인지와 수정이 유효한지",
                "품질이 낮은 보고서, 조작된 버그, 중복 Issue",
            ],
        ),
        "README.ru.md": (
            "### Испытание II — асимметричный сигнал",
            "### Вознаграждение за исправление реальных ошибок",
            "### Ссылки",
            [
                "воспроизводимый дефект кода",
                "ожидаемого и фактического поведения",
                "зашифрованный канал LIghtJUNction",
                "действительно ли существует описанная проблема",
                "Низкокачественные отчёты, выдуманные ошибки, дубликаты Issue",
            ],
        ),
    }

    for filename, (challenge, reward, links, phrases) in checks.items():
        text = Path(filename).read_text(encoding="utf-8")
        challenge_index = text.index(challenge)
        reward_index = text.index(reward)
        links_index = text.index(links)
        assert challenge_index < reward_index < links_index, filename

        reward_section = text[reward_index:links_index]
        for step in range(1, 6):
            assert f"{step}. " in reward_section, filename

        for phrase in phrases:
            assert phrase in reward_section, filename

        assert "https://lightjunction.github.io/lightjunction/#contact" in reward_section
        assert "lightjunction.me@gmail.com" in reward_section
        assert "**GitHub Issue**" in reward_section
