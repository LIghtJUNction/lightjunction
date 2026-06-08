#!/usr/bin/env python3
"""Render README dynamic sections from github_data.json."""

from __future__ import annotations

import html
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_OWNER = os.environ.get("GITHUB_REPOSITORY_OWNER", "LIghtJUNction")

LANG_EMOJI = {
    "Python": "PY",
    "Shell": "SH",
    "Rust": "RS",
    "Go": "GO",
    "JavaScript": "JS",
    "TypeScript": "TS",
    "Vue": "VU",
    "HTML": "HTML",
    "CSS": "CSS",
    "Java": "JVM",
    "C": "C",
    "C++": "CPP",
    "Ruby": "RB",
    "PHP": "PHP",
    "Swift": "SW",
    "Kotlin": "KT",
    "Dart": "DART",
}


@dataclass(frozen=True)
class Paths:
    readme: Path = Path("README.md")
    data: Path = Path("github_data.json")
    ai: Path = Path("ai_enhanced.json")
    skyline: Path = Path("skyline.txt")


SECTIONS = {
    "stats": ("<!-- START_DYNAMIC_STATS -->", "<!-- END_DYNAMIC_STATS -->"),
    "summary": ("<!-- START_DYNAMIC_SUMMARY -->", "<!-- END_DYNAMIC_SUMMARY -->"),
    "skyline": ("<!-- START_DYNAMIC_SKYLINE -->", "<!-- END_DYNAMIC_SKYLINE -->"),
    "repos": ("<!-- START_DYNAMIC_REPO_LIST -->", "<!-- END_DYNAMIC_REPO_LIST -->"),
    "commits": ("<!-- START_DYNAMIC_COMMITS -->", "<!-- END_DYNAMIC_COMMITS -->"),
}


def md_escape(value: Any) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ").strip()


def short_repo_name(repo: str) -> str:
    prefix = f"{REPO_OWNER}/"
    if repo.startswith(prefix):
        return repo[len(prefix) :]
    return repo


def get_account_age(created_at: str) -> tuple[str, int, int]:
    if not created_at:
        return "Unknown", 0, 0
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        now = datetime.now(UTC)
        age = now - created
        return created.strftime("%Y-%m-%d"), age.days // 365, (age.days % 365) // 30
    except ValueError:
        return created_at[:10], 0, 0


def progress_bar(count: int, total: int, width: int = 10) -> str:
    if total <= 0:
        return "░" * width
    filled = max(1, round(width * count / total))
    return "▓" * filled + "░" * max(0, width - filled)


def format_repo_card(repo: dict[str, Any]) -> str:
    name = md_escape(repo.get("name", "unknown"))
    owner = html.escape(REPO_OWNER)
    desc = html.escape(repo.get("description") or "No description")
    url = html.escape(repo.get("html_url") or "")
    lang = md_escape(repo.get("language") or "Unknown")
    badge = LANG_EMOJI.get(lang, "CODE")
    stars = repo.get("stargazers_count", 0)
    forks = repo.get("forks_count", 0)
    updated = str(repo.get("updated_at", ""))[:10]
    escaped_name = html.escape(name)
    escaped_updated = html.escape(updated)

    return f"""<td align="left" valign="top" width="50%">

#### <a href="{url}">{escaped_name}</a> <sub>{badge}</sub>

{desc}

<sub>{lang} / {stars} stars / {forks} forks / updated {escaped_updated}</sub>

<br>

![Stars](https://img.shields.io/github/stars/{owner}/{escaped_name}?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/{owner}/{escaped_name}?style=flat-square&labelColor=0d1117&color=4ecdc4)

</td>"""


def format_stats(data: dict[str, Any]) -> str:
    user = data.get("user_stats", {})
    created, years, months = get_account_age(user.get("created_at", ""))
    public_repos = user.get("public_repos", 0)
    followers = user.get("followers", 0)
    following = user.get("following", 0)
    return "\n".join(
        [
            "| Joined | Repos | Followers | Following |",
            "|:------:|:-----:|:---------:|:---------:|",
            (
                f"| {created} ({years}yr {months}mo) | **{public_repos}** | "
                f"**{followers}** | **{following}** |"
            ),
            "",
            "---",
        ]
    )


def format_weekly(data: dict[str, Any], ai_content: dict[str, Any]) -> str:
    total, repo_commits = data.get("weekly", (0, []))
    lines = ["### This Week", ""]

    insight = ai_content.get("commit_insights")
    if insight:
        lines.extend([f"_{md_escape(insight)}_", ""])

    if total == 0:
        lines.append("No commits this week.")
    else:
        lines.append(f"**{total}** commits across **{len(repo_commits)}** repositories")
        lines.extend(["", "| Repository | Activity |", "|:-----------|:--------:|"])
        for name, info in repo_commits[:6]:
            count = int(info.get("count", 0))
            url = info.get("url", "")
            label = md_escape(short_repo_name(name))
            lines.append(f"| [{label}]({url}) | {progress_bar(count, total)} {count} |")

    lines.extend(["", "---"])
    return "\n".join(lines)


def format_repos(data: dict[str, Any], ai_content: dict[str, Any]) -> str:
    repos = data.get("repos", [])
    if not repos:
        return "### Latest Projects\n\nNo repositories found."

    lines = [
        "### Latest Projects",
        "",
        "<details>",
        f"<summary>{len(repos)} recently updated repositories</summary>",
        "",
    ]
    insight = ai_content.get("project_insights")
    if insight:
        lines.extend([f"_{md_escape(insight)}_", ""])

    lines.append("<table>")
    for row_start in range(0, len(repos), 2):
        lines.append("<tr>")
        for repo in repos[row_start : row_start + 2]:
            lines.append(format_repo_card(repo))
        if len(repos[row_start : row_start + 2]) == 1:
            lines.append("<td></td>")
        lines.append("</tr>")
    lines.extend(["</table>", "", "</details>"])
    lines.extend(["", "---"])
    return "\n".join(lines)


def parse_commit_time(value: str) -> tuple[str, str]:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        return value[:10], value[11:16]


def format_commits(data: dict[str, Any]) -> str:
    commits = data.get("commits", [])
    if not commits:
        return "### Recent Commits\n\nNo recent commits."

    grouped: dict[str, list[dict[str, Any]]] = {}
    for commit in commits[:12]:
        date, time = parse_commit_time(commit.get("date", ""))
        grouped.setdefault(date, []).append({**commit, "time": time})

    lines = ["### Recent Commits", "", "<details>", "<summary>Last 7 days</summary>", ""]
    for date in sorted(grouped, reverse=True):
        lines.extend([f"**{date}**", "", "| Time | Repo | Commit |", "|:-----|:-----|:-------|"])
        for commit in grouped[date]:
            repo = md_escape(short_repo_name(commit.get("repo", "")))[:24]
            sha = md_escape(commit.get("sha", ""))
            url = commit.get("url", "")
            message = md_escape(commit.get("message", ""))[:76]
            lines.append(f"| {commit['time']} | {repo} | [`{sha}`]({url}) {message} |")
        lines.append("")
    lines.extend(["</details>", "", "---"])
    return "\n".join(lines)


def replace_section(path: Path, start_marker: str, end_marker: str, new_content: str) -> bool:
    text = path.read_text(encoding="utf-8")
    start = text.find(start_marker)
    end = text.find(end_marker)
    if start == -1 or end == -1 or end < start:
        return False

    end += len(end_marker)
    body = new_content.strip()
    replacement = f"{start_marker}\n\n{body}\n\n{end_marker}"
    new_text = f"{text[:start]}{replacement}{text[end:]}"
    if new_text == text:
        return False
    path.write_text(new_text, encoding="utf-8")
    return True


def has_section(path: Path, start_marker: str, end_marker: str) -> bool:
    text = path.read_text(encoding="utf-8")
    start = text.find(start_marker)
    end = text.find(end_marker)
    return start != -1 and end != -1 and start < end


def format_skyline(path: Path | None = None) -> str:
    skyline_path = path or Path("skyline.txt")
    if not skyline_path.exists():
        return ""
    content = skyline_path.read_text(encoding="utf-8").strip()
    if not content:
        return ""
    return "\n".join(
        [
            "### Skyline",
            "",
            "<details>",
            "<summary>Contribution skyline</summary>",
            "",
            "```",
            content,
            "```",
            "",
            "</details>",
            "",
            "---",
        ]
    )


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def render_sections(
    data: dict[str, Any], ai_content: dict[str, Any], paths: Paths
) -> dict[str, str]:
    return {
        "stats": format_stats(data),
        "summary": format_weekly(data, ai_content),
        "skyline": format_skyline(paths.skyline),
        "repos": format_repos(data, ai_content),
        "commits": format_commits(data),
    }


def main() -> int:
    paths = Paths()
    if not paths.data.exists():
        print("[ERROR] No github_data.json found. Run fetch-github-data.py first.")
        return 1

    data = load_json(paths.data, {})
    ai_content = load_json(paths.ai, {})
    print("Updating README dynamic sections")

    changed = False
    missing_sections: list[str] = []
    for name, content in render_sections(data, ai_content, paths).items():
        start, end = SECTIONS[name]
        if not content and name == "skyline":
            continue
        if not has_section(paths.readme, start, end):
            missing_sections.append(name)
            continue
        if replace_section(paths.readme, start, end, content):
            print(f"updated: {name}")
            changed = True

    if missing_sections:
        print(f"[ERROR] Missing README dynamic section markers: {', '.join(missing_sections)}")
        return 1

    for path in (paths.data, paths.ai, paths.skyline):
        path.unlink(missing_ok=True)

    print("README updated." if changed else "No README changes needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
