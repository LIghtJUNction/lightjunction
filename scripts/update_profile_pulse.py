#!/usr/bin/env python3
# ruff: noqa: E501
"""Render the GitHub profile README as one large SVG image."""

from __future__ import annotations

import csv
import html
import json
import os
import re
import sys
import textwrap
from dataclasses import dataclass
from datetime import UTC, datetime
from io import StringIO
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
README_FILE = ROOT / "README.md"
PROJECT_CARDS_FILE = ROOT / "public" / "github-projects.json"
SVG_FILE = ROOT / "public" / "profile-readme.svg"
DEFAULT_OWNER = "LIghtJUNction"
API_ROOT = "https://api.github.com"


@dataclass(frozen=True)
class ProjectCard:
    """Small public project summary rendered in the profile image."""

    name: str
    full_name: str
    description: str
    language: str
    stars: int
    forks: int
    rank_score: float


@dataclass(frozen=True)
class ProfilePulse:
    """Public local signals surfaced in the generated README image."""

    refreshed_on: str
    public_repos: int | None
    followers: int | None
    project_cards: int
    skill_count: int
    work_report_count: int
    latest_work_report: str | None
    top_projects: list[ProjectCard]


def _github_headers(token: str = "") -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "lightjunction-profile-svg",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _optional_int(value: Any) -> int | None:
    return value if isinstance(value, int) else None


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


def _load_project_payload(path: Path = PROJECT_CARDS_FILE) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"warning: project cards unavailable: {exc}", file=sys.stderr)
        return {}
    return payload if isinstance(payload, dict) else {}


def _read_project_cards(path: Path = PROJECT_CARDS_FILE) -> list[ProjectCard]:
    payload = _load_project_payload(path)
    raw_cards = payload.get("project_cards")
    if isinstance(raw_cards, list):
        return _project_cards_from_rows(raw_cards)
    if not isinstance(raw_cards, str) or "\n" not in raw_cards:
        return []

    header, _, table = raw_cards.partition("\n")
    match = re.match(r"\[\d+]\{(.+)}$", header)
    if not match:
        return []
    fieldnames = [name.split(":", maxsplit=1)[0] for name in match.group(1).split(",")]
    reader = csv.DictReader(StringIO(table), fieldnames=fieldnames)
    return _project_cards_from_rows(reader)


def _project_cards_from_rows(rows: Any) -> list[ProjectCard]:
    cards: list[ProjectCard] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            cards.append(
                ProjectCard(
                    name=row.get("name", "").strip(),
                    full_name=row.get("full_name", "").strip(),
                    description=(row.get("description") or "").strip(),
                    language=(row.get("language") or "Mixed").strip() or "Mixed",
                    stars=int(row.get("stargazers_count") or 0),
                    forks=int(row.get("forks_count") or 0),
                    rank_score=float(row.get("rank_score") or 0),
                )
            )
        except ValueError:
            continue
    return sorted(cards, key=lambda card: card.rank_score, reverse=True)


def count_project_cards() -> int:
    payload = _load_project_payload()
    raw_cards = payload.get("project_cards")
    if isinstance(raw_cards, list):
        return len(raw_cards)
    if isinstance(raw_cards, str):
        match = re.match(r"\[(\d+)]", raw_cards)
        if match:
            return int(match.group(1))
    return len(_read_project_cards())


def count_skills(root: Path = ROOT) -> int:
    skill_paths = [*root.glob(".agents/skills/*/SKILL.md"), *root.glob("skills/*/SKILL.md")]
    return len({path.relative_to(root).as_posix() for path in skill_paths})


def work_report_paths(root: Path = ROOT) -> list[Path]:
    reports: list[Path] = []
    for path in (root / "WORK_REPORT").glob("20[0-9][0-9]/*/*.md"):
        relative = path.relative_to(root / "WORK_REPORT").as_posix()
        if re.fullmatch(r"\d{4}/\d{2}/\d{2}\.md", relative):
            reports.append(path)
    return sorted(reports)


def build_pulse(
    *,
    owner: str = DEFAULT_OWNER,
    token: str = "",
    now: datetime | None = None,
) -> ProfilePulse:
    """Collect public GitHub and local repository data for the profile image."""
    refresh_time = now or datetime.now(UTC)
    stats = fetch_user_stats(owner, token=token)
    reports = work_report_paths(ROOT)
    top_projects = _read_project_cards()[:6]
    return ProfilePulse(
        refreshed_on=refresh_time.strftime("%Y-%m-%d %H:%M UTC"),
        public_repos=stats["public_repos"],
        followers=stats["followers"],
        project_cards=count_project_cards(),
        skill_count=count_skills(),
        work_report_count=len(reports),
        latest_work_report=reports[-1].relative_to(ROOT).as_posix() if reports else None,
        top_projects=top_projects,
    )


def format_value(value: int | None) -> str:
    """Render an integer value or explicit unknown marker."""
    return "n/a" if value is None else f"{value:,}"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def text_lines(text: str, *, width: int, max_lines: int) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return ["No public description yet."]
    wrapped = textwrap.wrap(cleaned, width=width, max_lines=max_lines, placeholder="...")
    return wrapped or ["No public description yet."]


def svg_text_block(
    lines: list[str],
    *,
    x: int,
    y: int,
    class_name: str,
    line_height: int,
) -> str:
    tspans = [
        f'<tspan x="{x}" dy="{0 if index == 0 else line_height}">{esc(line)}</tspan>'
        for index, line in enumerate(lines)
    ]
    return f'<text class="{class_name}" x="{x}" y="{y}">' + "".join(tspans) + "</text>"


def render_project_cards(projects: list[ProjectCard]) -> str:
    rendered: list[str] = []
    start_x = 90
    start_y = 1160
    card_width = 450
    card_height = 168
    gap_x = 34
    gap_y = 34
    for index, project in enumerate(projects):
        col = index % 3
        row = index // 3
        x = start_x + col * (card_width + gap_x)
        y = start_y + row * (card_height + gap_y)
        description = text_lines(project.description, width=24, max_lines=3)
        rendered.append(
            f"""
  <g class="project-card" transform="translate({x} {y})">
    <rect width="{card_width}" height="{card_height}" rx="22"/>
    <text class="project-name" x="24" y="42">{esc(project.name)}</text>
    <text class="project-meta" x="24" y="72">{esc(project.language)} / {project.stars:,} stars / {project.forks:,} forks</text>
    {svg_text_block(description, x=24, y=104, class_name="project-desc", line_height=24)}
  </g>"""
        )
    return "\n".join(rendered)


def render_svg(pulse: ProfilePulse) -> str:
    latest = pulse.latest_work_report or "No report yet"
    cards = render_project_cards(pulse.top_projects)
    safety_note = svg_text_block(
        [
            "No private keys, seed phrases, OAuth tokens, cookies,",
            "or recovery material belong in this repository.",
            "Human-owned assets. Transparent",
            "automation. Small useful changes.",
        ],
        x=760,
        y=128,
        class_name="small",
        line_height=34,
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2050" viewBox="0 0 1600 2050" role="img" aria-labelledby="title desc">
  <title id="title">LIghtJUNction profile</title>
  <desc id="desc">A generated profile card for AI tooling, Linux automation, and agent operations.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07110d"/>
      <stop offset="42%" stop-color="#0f1b18"/>
      <stop offset="100%" stop-color="#161417"/>
    </linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2ea043"/>
      <stop offset="50%" stop-color="#58a6ff"/>
      <stop offset="100%" stop-color="#f0b72f"/>
    </linearGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.055" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1600" height="2050" fill="url(#bg)"/>
  <rect width="1600" height="2050" fill="url(#grid)"/>
  <path d="M0 310 C270 180 400 430 690 284 C920 168 1050 188 1600 76 L1600 0 L0 0 Z" fill="#2ea043" opacity="0.16"/>
  <path d="M0 580 C360 455 500 650 805 482 C1050 347 1220 415 1600 250" fill="none" stroke="url(#beam)" stroke-width="5" opacity="0.58"/>
  <path d="M120 1940 C390 1815 670 1990 940 1810 C1160 1665 1395 1740 1540 1608" fill="none" stroke="#58a6ff" stroke-width="4" opacity="0.35"/>

  <style>
    text {{ font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    .eyebrow {{ fill: #7ee787; font-size: 30px; font-weight: 800; letter-spacing: 5px; }}
    .title {{ fill: #f0f6fc; font-size: 106px; font-weight: 900; letter-spacing: 0; }}
    .subtitle {{ fill: #c9d1d9; font-size: 34px; font-weight: 650; }}
    .body {{ fill: #aebac7; font-size: 28px; font-weight: 450; }}
    .small {{ fill: #8b949e; font-size: 22px; font-weight: 550; }}
    .metric-value {{ fill: #f0f6fc; font-size: 54px; font-weight: 900; }}
    .metric-label {{ fill: #8b949e; font-size: 20px; font-weight: 800; letter-spacing: 2px; }}
    .section-title {{ fill: #f0f6fc; font-size: 42px; font-weight: 900; }}
    .tag {{ fill: #d5f5df; font-size: 25px; font-weight: 800; }}
    .project-card rect, .panel {{ fill: #111c18; stroke: #30463d; stroke-width: 1.4; filter: url(#soft-shadow); }}
    .project-name {{ fill: #f0f6fc; font-size: 28px; font-weight: 850; }}
    .project-meta {{ fill: #7ee787; font-size: 18px; font-weight: 800; }}
    .project-desc {{ fill: #aebac7; font-size: 20px; font-weight: 500; }}
    .link {{ fill: #58a6ff; font-size: 24px; font-weight: 750; }}
    .rule {{ stroke: #2ea043; stroke-width: 3; opacity: 0.9; }}
  </style>

  <g transform="translate(90 110)">
    <text class="eyebrow" x="0" y="0">OWNER-AWARE DIGITAL ASSISTANT</text>
    <text class="title" x="0" y="120">LIghtJUNction</text>
    <text class="subtitle" x="4" y="184">AI tooling / Linux automation / agent workflows / practical security</text>
    <rect x="4" y="236" width="1010" height="8" rx="4" fill="url(#beam)"/>
    <text class="body" x="4" y="310">Terminal-first systems that survive real machines, clear boundaries, and auditable work.</text>
    <text class="small" x="4" y="354">Generated from public repository data and local work-report state. Last refresh: {esc(pulse.refreshed_on)}</text>
  </g>

  <g transform="translate(90 560)">
    <rect class="panel" width="1420" height="270" rx="28"/>
    <text class="section-title" x="42" y="70">Profile Pulse</text>
    <g transform="translate(42 118)">
      <text class="metric-value" x="0" y="0">{format_value(pulse.public_repos)}</text>
      <text class="metric-label" x="0" y="48">PUBLIC REPOS</text>
    </g>
    <g transform="translate(322 118)">
      <text class="metric-value" x="0" y="0">{format_value(pulse.followers)}</text>
      <text class="metric-label" x="0" y="48">FOLLOWERS</text>
    </g>
    <g transform="translate(600 118)">
      <text class="metric-value" x="0" y="0">{pulse.project_cards:,}</text>
      <text class="metric-label" x="0" y="48">PROJECT CARDS</text>
    </g>
    <g transform="translate(920 118)">
      <text class="metric-value" x="0" y="0">{pulse.skill_count:,}</text>
      <text class="metric-label" x="0" y="48">AGENT SKILLS</text>
    </g>
    <g transform="translate(1184 118)">
      <text class="metric-value" x="0" y="0">{pulse.work_report_count:,}</text>
      <text class="metric-label" x="0" y="48">WORK REPORTS</text>
    </g>
    <text class="small" x="42" y="228">Latest report: {esc(latest)}</text>
  </g>

  <g transform="translate(90 910)">
    <text class="section-title" x="0" y="0">Operating Surface</text>
    <line class="rule" x1="0" y1="34" x2="1420" y2="34"/>
    <g transform="translate(0 88)">
      <rect width="300" height="64" rx="18" fill="#163323" stroke="#2ea043" stroke-opacity="0.55"/>
      <text class="tag" x="30" y="42">AI tooling</text>
    </g>
    <g transform="translate(330 88)">
      <rect width="360" height="64" rx="18" fill="#14283b" stroke="#58a6ff" stroke-opacity="0.55"/>
      <text class="tag" x="30" y="42">Linux automation</text>
    </g>
    <g transform="translate(720 88)">
      <rect width="390" height="64" rx="18" fill="#332711" stroke="#f0b72f" stroke-opacity="0.55"/>
      <text class="tag" x="30" y="42">Agent operations</text>
    </g>
    <g transform="translate(1140 88)">
      <rect width="280" height="64" rx="18" fill="#241d2e" stroke="#d2a8ff" stroke-opacity="0.55"/>
      <text class="tag" x="30" y="42">Security</text>
    </g>
  </g>

  <g>
    <text class="section-title" x="90" y="1092">Selected Public Work</text>
    {cards}
  </g>

  <g transform="translate(90 1620)">
    <rect class="panel" width="1420" height="260" rx="28"/>
    <text class="section-title" x="42" y="72">Links</text>
    <text class="link" x="42" y="132">Website: https://lightjunction.github.io/lightjunction/</text>
    <text class="link" x="42" y="174">Work reports: WORK_REPORT/index.md</text>
    <text class="link" x="42" y="216">Skills: npx skills add LIghtJUNction/lightjunction -g</text>
    {safety_note}
  </g>

  <text class="small" x="90" y="1970">Source data: public/github-projects.json / local WORK_REPORT / local skills. This README is intentionally one generated SVG image.</text>
</svg>
"""


def render_readme() -> str:
    return """<div align="center">
  <img src="public/profile-readme.svg" alt="LIghtJUNction profile" width="100%" />
</div>
"""


def main() -> int:
    """Refresh README.md and the generated SVG in place."""
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER", DEFAULT_OWNER)
    token = os.environ.get("GITHUB_TOKEN", "")
    pulse = build_pulse(owner=owner, token=token)

    SVG_FILE.write_text(render_svg(pulse), encoding="utf-8")
    README_FILE.write_text(render_readme(), encoding="utf-8")
    print(
        f"Updated {README_FILE.relative_to(ROOT)} and {SVG_FILE.relative_to(ROOT)} "
        f"for {pulse.refreshed_on}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
