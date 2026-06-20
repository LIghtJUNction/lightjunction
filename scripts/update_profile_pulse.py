#!/usr/bin/env python3
"""Refresh the small managed profile-pulse section in README.md."""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
README_FILE = ROOT / "README.md"
PROJECT_CARDS_FILE = ROOT / "public" / "github-projects.json"
START_MARKER = "<!-- profile-pulse:start -->"
END_MARKER = "<!-- profile-pulse:end -->"
DEFAULT_OWNER = "LIghtJUNction"
API_ROOT = "https://api.github.com"


@dataclass(frozen=True)
class ProfilePulse:
    """Public and local signals surfaced in the profile README."""

    refreshed_on: str
    public_repos: int | None
    followers: int | None
    project_cards: int
    skill_count: int
    work_report_count: int
    latest_work_report: str | None


def _github_headers(token: str = "") -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "lightjunction-profile-pulse",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_user_stats(owner: str, token: str = "") -> dict[str, int | None]:
    """Return public GitHub user counters, falling back to unknown values."""
    try:
        response = requests.get(
            f"{API_ROOT}/users/{owner}",
            headers=_github_headers(token),
            timeout=20,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"warning: GitHub profile stats unavailable: {exc}", file=sys.stderr)
        return {"public_repos": None, "followers": None}

    payload = response.json()
    return {
        "public_repos": _optional_int(payload.get("public_repos")),
        "followers": _optional_int(payload.get("followers")),
    }


def _optional_int(value: Any) -> int | None:
    return value if isinstance(value, int) else None


def count_project_cards(path: Path = PROJECT_CARDS_FILE) -> int:
    """Return the number of website project cards already generated locally."""
    if not path.exists():
        return 0
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return 0
    cards = payload.get("project_cards")
    return len(cards) if isinstance(cards, list) else 0


def count_skills(root: Path = ROOT) -> int:
    """Count tracked reusable skills in the local workspace."""
    paths = [*root.glob(".agents/skills/*/SKILL.md"), *root.glob("skills/*/SKILL.md")]
    return len({path.relative_to(root).as_posix() for path in paths})


def work_report_paths(root: Path = ROOT) -> list[Path]:
    """Return dated work-report files tracked in the repository."""
    reports = []
    for path in (root / "WORK_REPORT").glob("20[0-9][0-9]/*/*.md"):
        relative_path = path.relative_to(root / "WORK_REPORT").as_posix()
        if re.fullmatch(r"\d{4}/\d{2}/\d{2}\.md", relative_path):
            reports.append(path)
    return sorted(reports)


def latest_work_report(root: Path = ROOT) -> str | None:
    """Return the newest tracked work-report path relative to the repository."""
    paths = work_report_paths(root)
    if not paths:
        return None
    return paths[-1].relative_to(root).as_posix()


def build_pulse(
    *,
    owner: str = DEFAULT_OWNER,
    token: str = "",
    now: datetime | None = None,
) -> ProfilePulse:
    """Collect profile-pulse data from public GitHub and local files."""
    stats = fetch_user_stats(owner, token=token)
    reports = work_report_paths(ROOT)
    return ProfilePulse(
        refreshed_on=(now or datetime.now(UTC)).date().isoformat(),
        public_repos=stats["public_repos"],
        followers=stats["followers"],
        project_cards=count_project_cards(),
        skill_count=count_skills(),
        work_report_count=len(reports),
        latest_work_report=reports[-1].relative_to(ROOT).as_posix() if reports else None,
    )


def format_value(value: int | None) -> str:
    """Render an integer value or an explicit unknown marker."""
    return "unavailable" if value is None else str(value)


def render_profile_pulse(pulse: ProfilePulse) -> str:
    """Render the managed README section."""
    latest = (
        f"[{pulse.latest_work_report}]({pulse.latest_work_report})"
        if pulse.latest_work_report
        else "not available"
    )
    return "\n".join(
        [
            START_MARKER,
            "| Signal | Current |",
            "|:--|:--|",
            f"| Last refreshed | {pulse.refreshed_on} UTC |",
            f"| Public GitHub repos | {format_value(pulse.public_repos)} |",
            f"| GitHub followers | {format_value(pulse.followers)} |",
            f"| Website project cards | {pulse.project_cards} |",
            f"| Reusable agent skills | {pulse.skill_count} |",
            f"| Tracked work reports | {pulse.work_report_count} |",
            f"| Latest work report | {latest} |",
            END_MARKER,
            "",
        ]
    )


def replace_managed_section(readme_text: str, replacement: str) -> str:
    """Replace the managed profile-pulse section between README markers."""
    start = readme_text.index(START_MARKER)
    end = readme_text.index(END_MARKER) + len(END_MARKER)
    return (
        f"{readme_text[:start].rstrip()}\n\n{replacement.rstrip()}\n\n{readme_text[end:].lstrip()}"
    )


def main() -> int:
    """Refresh README.md in place."""
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER", DEFAULT_OWNER)
    token = os.environ.get("GITHUB_TOKEN", "")
    readme = README_FILE.read_text(encoding="utf-8")
    pulse = build_pulse(owner=owner, token=token)
    README_FILE.write_text(
        replace_managed_section(readme, render_profile_pulse(pulse)),
        encoding="utf-8",
    )
    print(f"Updated {README_FILE.relative_to(ROOT)} profile pulse for {pulse.refreshed_on}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
