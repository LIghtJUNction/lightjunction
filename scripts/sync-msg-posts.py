#!/usr/bin/env python3
"""Refresh only the MSG post block in the profile README from public profile data."""

from __future__ import annotations

import html
import re
from pathlib import Path

import requests

PROFILE = "https://msg.lmm.best/@lightjunction"
START = "<!-- MSG-POSTS:START -->"
END = "<!-- MSG-POSTS:END -->"


def render_posts(profile: str) -> str:
    """Validate the public Markdown response and render up to five post links."""
    if not profile.startswith("# @lightjunction\n"):
        raise ValueError("Unexpected MSG profile response")
    sections = profile.split("## Latest posts\n", 1)
    if len(sections) != 2:
        raise ValueError("MSG profile has no latest-posts section")
    section = sections[1].split("\n## ", 1)[0]
    posts = re.findall(
        r"^- \[(.+)\]\(/\*([0-9a-f]{32})\) — (\d{4}-\d{2}-\d{2} \d{2}:\d{2})$",
        section,
        re.MULTILINE,
    )
    if not posts:
        if section.strip() != "No visible posts yet.":
            raise ValueError("Unrecognized MSG post list; keeping existing README")
        return "No public posts yet."
    lines = []
    for title, post_id, date in posts[:5]:
        # Remote text is content only: neutralize Markdown, HTML and image syntax.
        title = html.escape(title, quote=False)
        title = re.sub(r"([\\`*_{\[\]}()!|])", r"\\\1", title)
        lines.append(f"- [{title}](https://msg.lmm.best/*{post_id}) — {date}")
    return "\n".join(lines)


def update_readme(readme: str, posts: str) -> str:
    """Require one well-ordered marker pair before replacing its contents."""
    if readme.count(START) != 1 or readme.count(END) != 1:
        raise ValueError("README must contain exactly one MSG marker pair")
    before, rest = readme.split(START, 1)
    if END not in rest:
        raise ValueError("README MSG markers are out of order")
    _, after = rest.split(END, 1)
    return f"{before}{START}\n{posts}\n{END}{after}"


def main() -> None:
    response = requests.get(
        PROFILE,
        headers={"Accept": "text/markdown", "User-Agent": "lightjunction-readme-sync"},
        timeout=30,
    )
    response.raise_for_status()
    posts = render_posts(response.text)
    path = Path(__file__).resolve().parent.parent / "README.md"
    current = path.read_text(encoding="utf-8")
    updated = update_readme(current, posts)
    if updated != current:
        path.write_text(updated, encoding="utf-8")
        print("Updated MSG posts in README.md")
    else:
        print("MSG posts are unchanged")


if __name__ == "__main__":
    main()
