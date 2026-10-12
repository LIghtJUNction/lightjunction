"""Structural checks for the founder profile and its supporting links."""

import re
from pathlib import Path
from xml.etree import ElementTree as ET

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
        hero = ET.fromstring(text.split("\n\n", 1)[0])
        assert hero.tag in {"p", "div"} and hero.get("align") == "center", path
        image = hero.find("a/img")
        assert image is not None, path
        assert image.get("src") == "public/readme-hero.svg", path
        assert image.get("width") == "100%" and image.get("alt"), path
        assert text.count("public/readme-hero.svg") == 1, path
        for old_panel in OLD_PANELS:
            assert old_panel not in text, path
        for other in README_FILES:
            if other != path:
                assert f'href="{other.name}"' in text.split("\n# ", 1)[0], path


def test_readme_hero_is_lightweight_self_contained_svg() -> None:
    hero = Path("public/readme-hero.svg")
    text = hero.read_text(encoding="utf-8")
    assert hero.stat().st_size < 32 * 1024
    assert "http://" not in text.replace('xmlns="http://www.w3.org/2000/svg"', "")
    assert "https://" not in text
    root = ET.fromstring(text)
    namespace = {"svg": "http://www.w3.org/2000/svg"}
    assert root.tag == "{http://www.w3.org/2000/svg}svg"
    assert root.get("viewBox") == "0 0 1200 460"
    assert root.get("role") == "img"
    assert root.get("aria-labelledby") == "title desc"
    title = root.find("svg:title", namespace)
    desc = root.find("svg:desc", namespace)
    assert title is not None and title.get("id") == "title"
    assert title.text == "LIghtJUNction — Co-founder of api.lmm.best"
    assert desc is not None and desc.get("id") == "desc" and desc.text


def test_readme_hero_uses_looping_pixel_tokens() -> None:
    text = Path("public/readme-hero.svg").read_text(encoding="utf-8")
    required = [
        "@keyframes flow",
        "animation: flow 16s cubic-bezier(.45,0,.2,1) infinite;",
        "0%,22%,82%,100% { transform: translate(0,0) scale(1); opacity: 1; }",
        "@media (prefers-reduced-motion: reduce)",
        ".p,.cloud,.signal { animation: none; }",
    ]
    for fragment in required:
        assert fragment in text
    # System-font captions are allowed; the animated wordmark remains vector pixels.
    forbidden = ["<script", "<animate", "<filter", "<image", "<foreignObject", "@font-face"]
    for fragment in forbidden:
        assert fragment not in text
    root = ET.fromstring(text)
    pixels = [
        node
        for node in root.iter("{http://www.w3.org/2000/svg}rect")
        if "p" in node.get("class", "").split()
    ]
    assert len(pixels) == 172
    assert all(node.get("width") == node.get("height") == "10" for node in pixels)


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
        "README.md": "Please do not send private keys",
        "README.zh.md": "请不要发送私钥",
        "README.ru.md": "Не отправляйте приватные ключи",
        "README.ko.md": "개인키",
        "README.ja.md": "秘密鍵",
    }
    for filename, phrase in checks.items():
        assert phrase in Path(filename).read_text(encoding="utf-8"), filename


def test_readmes_present_localized_founder_identity_and_platform() -> None:
    checks = {
        "README.md": ["Co-founder", "tool marketplace", "AI gateway", "ecosystem support"],
        "README.zh.md": ["联合创始人", "工具市场", "AI 网关", "AI 生态支持"],
        "README.ru.md": ["Сооснователь", "маркетплейс инструментов", "ИИ-шлюз", "экосистемы"],
        "README.ko.md": ["공동 창업자", "도구 마켓플레이스", "AI 게이트웨이", "AI 생태계 지원"],
        "README.ja.md": [
            "共同創業者",
            "ツールマーケットプレイス",
            "AI ゲートウェイ",
            "AI エコシステム支援",
        ],
    }
    for filename, phrases in checks.items():
        intro = Path(filename).read_text(encoding="utf-8").split("\n## ", 1)[0]
        for phrase in phrases:
            assert phrase in intro, (filename, phrase)
        assert "[api.lmm.best](https://api.lmm.best/)" in intro, filename


def test_platform_is_early_and_actionable_with_selected_work_before_details() -> None:
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        intro = text.split("\n## ", 1)[0]
        assert "https://github.com/TokenNotIncluded/api.lmm.best" in intro, path
        assert "mailto:lightjunction.me@gmail.com" in intro, path
        visible = text.split("<details>", 1)[0]
        for project in (
            "LIghtJUNction/humangrant",
            "TokenNotIncluded/lmm-scripts",
            "LIghtJUNction/particle-sculpture-skill",
        ):
            assert f"https://github.com/{project}" in visible, path
        assert "https://api.lmm.best/scripts" in visible, path
        assert text.count("<details>") == text.count("</details>") > 0, path
        assert text.count("<summary>") == text.count("<details>"), path


def test_challenge_links_keep_canonical_board_entrypoints_in_every_locale() -> None:
    # Both challenge destinations survive the layout change, now in every locale.
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        for link in ("https://msg.lmm.best/main/184", "https://msg.lmm.best/main/185"):
            assert text.count(link) == 1, (path, link)
        assert "| --- | ---: | --- | --- | --- |" not in text, path


def test_readmes_include_localized_open_source_bounties() -> None:
    checks = {
        "README.md": ["open-source", "Issue/PR", "rated", "arbitration", "tokens"],
        "README.zh.md": ["开源", "Issue / PR", "评分", "仲裁", "Token"],
        "README.ru.md": ["Issue/PR", "награды", "оценивать", "арбитраж", "токены"],
        "README.ko.md": ["오픈소스", "Issue/PR", "평가", "중재", "토큰"],
        "README.ja.md": ["オープンソース", "Issue/PR", "評価", "仲裁", "トークン"],
    }
    for filename, phrases in checks.items():
        text = Path(filename).read_text(encoding="utf-8")
        blocks = re.findall(r"<details>\s*<summary>.*?</summary>(.*?)</details>", text, re.S)
        rewards = [block for block in blocks if "https://msg.lmm.best/main/184" in block]
        assert len(rewards) == 1, filename
        for phrase in phrases:
            assert phrase in rewards[0], (filename, phrase)
        assert "[api.lmm.best](https://api.lmm.best/)" in rewards[0], filename
        assert "lightjunction.me@gmail.com" not in rewards[0], filename


def test_msg_sync_markers_and_usage_disclaimer_survive_folding() -> None:
    text = Path("README.md").read_text(encoding="utf-8")
    start, end = "<!-- MSG-POSTS:START -->", "<!-- MSG-POSTS:END -->"
    assert text.count(start) == text.count(end) == 1
    assert text.index(start) < text.index(end)
    posts = text.split(start)[1].split(end)[0]
    assert sum(line.startswith("- [") for line in posts.splitlines()) <= 5
    assert "ChatGPT/Codex uses a dated, approximate snapshot" in text
    assert "each source keeps its own reporting period" in text


def test_english_and_chinese_keep_the_public_encryption_recipient() -> None:
    recipient = "age1yubikey1qgaqxkh32x84vm957584pc0980z3x2agpljavmsh3jwz5q02tlth5suju8n"
    for filename in ("README.md", "README.zh.md"):
        text = Path(filename).read_text(encoding="utf-8")
        assert recipient in text, filename
        assert "age -R age-recipients.txt -o message.txt.age message.txt" in text, filename
        assert "public/age-recipients.txt" in text, filename
