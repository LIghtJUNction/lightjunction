"""Check public profile links, downloads and encryption instructions."""

import re
from pathlib import Path
from xml.etree import ElementTree as ET

README_FILES = sorted(Path().glob("README*.md"))


def test_readme_links_resolve_locally_and_between_languages() -> None:
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        for other in README_FILES:
            if other != path:
                assert f"]({other.name})" in text, (path, other)
        for link in re.findall(r"\]\(([^)]+)\)|(?:src|href)=\"([^\"]+)\"", text):
            destination = next(part for part in link if part).split("#", 1)[0]
            if destination and not re.match(r"[a-z]+:", destination):
                assert Path(destination).is_file(), (path, destination)
        assert "<!-- MSG-POSTS:" not in text, path
        assert "api/share/profile/" not in text, path


def test_static_header_is_accessible_and_self_contained() -> None:
    text = Path("public/readme-hero.svg").read_text(encoding="utf-8")
    root = ET.fromstring(text)
    namespace = "{http://www.w3.org/2000/svg}"
    assert root.tag == f"{namespace}svg"
    assert root.get("role") == "img"
    for label in root.attrib["aria-labelledby"].split():
        node = next(node for node in root if node.get("id") == label)
        assert node.text
    assert not re.search(r"<(?:script|image|foreignObject|animate|set)\b", text)
    assert "@keyframes" not in text and "@import" not in text
    assert "https://" not in text


def test_readmes_keep_challenge_entrypoints_and_license_scope() -> None:
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        for link in ("https://msg.lmm.best/main/184", "https://msg.lmm.best/main/185"):
            assert text.count(link) == 1, (path, link)
        for reference in ("(LICENSE)", "(LICENSING.md)", "OSI", "MIT"):
            assert reference in text, (path, reference)


def test_encryption_instructions_use_the_published_recipient() -> None:
    recipient = Path("public/age-recipients.txt").read_text(encoding="utf-8").strip()
    for path in README_FILES:
        text = path.read_text(encoding="utf-8")
        assert "(public/age-recipients.txt)" in text, path
        assert "(pubkey.asc)" in text, path
        assert "age -R age-recipients.txt -o message.txt.age message.txt" in text, path
        assert "message.txt.age" in text and "lightjunction.me@gmail.com" in text, path
    for filename in ("README.md", "README.zh.md"):
        assert recipient in Path(filename).read_text(encoding="utf-8"), filename
