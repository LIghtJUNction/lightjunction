#!/usr/bin/env python3
"""
update-readme.py - Update README.md with GitHub stats and AI content
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_OWNER = "LIghtJUNction"

LANG_EMOJI = {
    "Python": "🐍", "Shell": "🐚", "Rust": "🦀", "Go": "🐹",
    "JavaScript": "📜", "TypeScript": "🔷", "Vue": "💚", "HTML": "🌐",
    "CSS": "🎨", "Java": "☕", "C": "🔧", "C++": "⚡", "Ruby": "💎",
    "PHP": "🐘", "Swift": "🍎", "Kotlin": "🤖", "Dart": "🌟",
}


def get_account_age(created_at: str) -> tuple[str, int, int]:
    if not created_at:
        return "Unknown", 0, 0
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        age = now - created
        return created.strftime("%Y-%m-%d"), age.days // 365, age.days % 365 // 30
    except Exception:
        return created_at[:10], 0, 0


def format_stats(data: dict) -> str:
    user = data.get("user_stats", {})
    created, years, months = get_account_age(user.get("created_at", ""))
    repos = user.get("public_repos", 0)
    followers = user.get("followers", 0)
    following = user.get("following", 0)

    content = f"""| 📅 Joined | 📦 Repos | 👥 Followers | 👤 Following |
|:---------:|:--------:|:------------:|:------------:|
| {created} ({years}yr {months}mo) | **{repos}** | **{followers}** | **{following}** |"""
    return content + "\n\n---"


def format_weekly(data: dict, ai_content: dict) -> str:
    total, repo_commits = data["weekly"]
    commit_insights = ai_content.get("commit_insights", "")

    lines = ["### 📈 This Week", ""]

    if total == 0:
        lines.append("No commits this week. Rest time is important too! 🎉")
    else:
        if commit_insights:
            lines.append(f"_{commit_insights}_")
            lines.append("")
        lines.append(f"**{total}** commits across **{len(repo_commits)}** repositories")

        if repo_commits:
            lines.append("")
            lines.append("| Repository | Activity |")
            lines.append("|:-----------|:--------:|")
            for name, info in repo_commits[:5]:
                count = info["count"]
                pct = count / total
                bar = "▓" * int(pct * 10) + "░" * (10 - int(pct * 10))
                lines.append(f"| [{name}]({info.get('url', '')}) | {bar} {count} |")

    return "\n".join(lines) + "\n\n---"


def format_repos(data: dict, ai_content: dict) -> str:
    repos = data.get("repos", [])
    if not repos:
        return "### 🚀 Latest Projects\n\nNo repositories found."

    insights = ai_content.get("project_insights", "")

    lines = ["### 🚀 Latest Projects", ""]

    if insights:
        lines.append(f"_{insights}_")
        lines.append("")

    lines.append("<table><tr>")

    for i, repo in enumerate(repos):
        if i > 0 and i % 2 == 0:
            lines.append("</tr><tr>")

        name = repo["name"]
        url = repo["html_url"]
        desc = (repo.get("description") or "").replace("|", "\\|")
        stars = repo.get("stargazers_count", 0)
        forks = repo.get("forks_count", 0)
        lang = repo.get("language") or "Unknown"
        updated = repo["updated_at"][:10]
        emoji = LANG_EMOJI.get(lang, "📄")

        lines.append(f"""<td align="center" valign="top">

#### {emoji} {name}
{desc if desc else '_No description_'}

⭐ {stars} • 🍴 {forks} • {lang}

![Stars](https://img.shields.io/github/stars/{REPO_OWNER}/{name}?style=flat-square&labelColor=0d1117&color=ffcb2f)
![Forks](https://img.shields.io/github/forks/{REPO_OWNER}/{name}?style=flat-square&labelColor=0d1117&color=4ecdc4)

_Updated: {updated}_

</td>""")

    if len(repos) % 2 == 1:
        lines.append("<td></td>")

    lines.append("</tr></table>")
    return "\n".join(lines) + "\n\n---"


def format_commits(data: dict) -> str:
    commits = data.get("commits", [])
    if not commits:
        return "### 📝 Recent Commits\n\nNo recent commits."

    lines = ["### 📝 Recent Commits", "", "<details>", "<summary>📅 Last 7 Days</summary>", ""]

    # Group commits by date
    by_date = {}
    for c in commits[:10]:
        try:
            dt = datetime.fromisoformat(c["date"].replace("Z", "+00:00"))
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M")
        except Exception:
            date_str = c["date"][:10]
            time_str = c["date"][11:16]
        if date_str not in by_date:
            by_date[date_str] = []
        by_date[date_str].append((time_str, c["repo"], c["sha"], c["url"], c["message"]))

    # Render grouped: bold date header + 3-col table (Time | Repo | Commit)
    for date_str in sorted(by_date.keys(), reverse=True):
        rows = by_date[date_str]
        lines.append(f"**{date_str}**")
        lines.append("")
        lines.append("| Time | Repo | Commit |")
        lines.append("|:-----|:-----|:-------|")
        for time_str, repo, sha, url, msg in rows:
            short_repo = repo[len(REPO_OWNER)+1:] if repo.startswith(REPO_OWNER) else repo[:15]
            short_repo = short_repo[:15]
            msg = msg[:60] + ("..." if len(msg) > 60 else "")
            lines.append(f"| {time_str} | {short_repo} | [`{sha}`]({url}) {msg} |")
        lines.append("")

    lines.append("</details>")
    return "\n".join(lines) + "\n\n---"


def replace_section(path: Path, start_marker: str, end_marker: str, new_content: str) -> bool:
    text = path.read_text()
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker)
    if start_idx == -1 or end_idx == -1:
        return False

    end_idx += len(end_marker)
    content = new_content.strip() if new_content.strip() else ""
    if content:
        new_text = text[:start_idx] + start_marker + "\n\n" + content + "\n\n" + end_marker + "\n\n" + text[end_idx:]
    else:
        new_text = text[:start_idx] + start_marker + "\n\n" + text[end_idx:]

    if new_text != text:
        path.write_text(new_text)
        return True
    return False


def format_skyline() -> str:
    skyline_path = Path("skyline.txt")
    if not skyline_path.exists():
        return ""
    content = skyline_path.read_text().strip()
    if not content:
        return ""
    return "### 🏔️ Skyline\n\n```\n" + content + "\n```\n\n---"


def main():
    data_path = Path("github_data.json")
    ai_path = Path("ai_enhanced.json")

    if not data_path.exists():
        print("[ERROR] No github_data.json found. Run fetch-github-data.py first.")
        return 1

    data = json.loads(data_path.read_text())
    ai_content = json.loads(ai_path.read_text()) if ai_path.exists() else {}

    print("📝 Updating README...")

    readme = Path("README.md")
    changed = False

    changed |= replace_section(readme, "<!-- START_DYNAMIC_STATS -->", "<!-- END_DYNAMIC_STATS -->", format_stats(data))
    changed |= replace_section(readme, "<!-- START_DYNAMIC_SUMMARY -->", "<!-- END_DYNAMIC_SUMMARY -->", format_weekly(data, ai_content))
    changed |= replace_section(readme, "<!-- START_DYNAMIC_SKYLINE -->", "<!-- END_DYNAMIC_SKYLINE -->", format_skyline())
    changed |= replace_section(readme, "<!-- START_DYNAMIC_REPO_LIST -->", "<!-- END_DYNAMIC_REPO_LIST -->", format_repos(data, ai_content))
    changed |= replace_section(readme, "<!-- START_DYNAMIC_COMMITS -->", "<!-- END_DYNAMIC_COMMITS -->", format_commits(data))

    # Cleanup
    for f in [data_path, ai_path, Path("skyline.txt")]:
        f.unlink(missing_ok=True)

    if changed:
        print("✅ README updated successfully.")
    else:
        print("ℹ️  No changes needed.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
