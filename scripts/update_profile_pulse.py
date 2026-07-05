#!/usr/bin/env python3
# ruff: noqa: E501
"""Render the GitHub profile README as several clickable SVG panels."""

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
ACTIONS_FILE = ROOT / "PROFILE_ACTIONS.md"
PROJECT_CARDS_FILE = ROOT / "public" / "github-projects.json"
LEGACY_SVG_FILE = ROOT / "public" / "profile-readme.svg"
SVG_FILES = {
    "hero": ROOT / "public" / "profile-hero.svg",
    "pulse": ROOT / "public" / "profile-pulse.svg",
    "projects": ROOT / "public" / "profile-projects.svg",
    "actions": ROOT / "public" / "profile-actions.svg",
}
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
    """Public local signals surfaced in generated README images."""

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
    """Collect public GitHub and local repository data for the profile images."""
    refresh_time = now or datetime.now(UTC)
    stats = fetch_user_stats(owner, token=token)
    reports = work_report_paths(ROOT)
    return ProfilePulse(
        refreshed_on=refresh_time.strftime("%Y-%m-%d %H:%M UTC"),
        public_repos=stats["public_repos"],
        followers=stats["followers"],
        project_cards=count_project_cards(),
        skill_count=count_skills(),
        work_report_count=len(reports),
        latest_work_report=reports[-1].relative_to(ROOT).as_posix() if reports else None,
        top_projects=_read_project_cards()[:6],
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


def svg_shell(title: str, height: int, body: str) -> str:
    """Wrap panel-specific SVG content with shared visual language."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{height}" viewBox="0 0 1600 {height}" role="img" aria-labelledby="title desc">
  <title id="title">{esc(title)}</title>
  <desc id="desc">Generated LIghtJUNction README panel. Click the image in README for links and copyable commands.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06120d"/>
      <stop offset="48%" stop-color="#111b18"/>
      <stop offset="100%" stop-color="#171417"/>
    </linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2ea043"/>
      <stop offset="52%" stop-color="#58a6ff"/>
      <stop offset="100%" stop-color="#f0b72f"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="-0.25 0;0.25 0;-0.25 0" dur="7s" repeatCount="indefinite"/>
    </linearGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7ee787" stop-opacity="0.48"/>
      <stop offset="48%" stop-color="#58a6ff" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#58a6ff" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.30"/>
    </filter>
    <filter id="neon" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.055" stroke-width="1"/>
      <animateTransform attributeName="patternTransform" type="translate" values="0 0;48 48;0 0" dur="18s" repeatCount="indefinite"/>
    </pattern>
  </defs>
  <rect width="1600" height="{height}" fill="url(#bg)"/>
  <rect width="1600" height="{height}" fill="url(#grid)"/>
  <circle cx="1260" cy="120" r="210" fill="url(#orb)" opacity="0.55">
    <animate attributeName="cx" values="1260;1370;1160;1260" dur="12s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="120;170;80;120" dur="10s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.25;0.62;0.30;0.25" dur="6s" repeatCount="indefinite"/>
  </circle>
  <circle cx="220" cy="{height - 90}" r="180" fill="url(#orb)" opacity="0.24">
    <animate attributeName="cx" values="220;360;180;220" dur="14s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.16;0.42;0.18;0.16" dur="8s" repeatCount="indefinite"/>
  </circle>
  <path d="M0 210 C270 90 430 310 720 162 C960 40 1120 110 1600 0 L1600 0 L0 0 Z" fill="#2ea043" opacity="0.14">
    <animate attributeName="opacity" values="0.08;0.18;0.10;0.08" dur="9s" repeatCount="indefinite"/>
  </path>
  <path d="M0 {height - 96} C340 {height - 210} 650 {height - 20} 930 {height - 180} C1140 {height - 300} 1320 {height - 245} 1600 {height - 360}" fill="none" stroke="#58a6ff" stroke-width="4" opacity="0.34" stroke-dasharray="70 28">
    <animate attributeName="stroke-dashoffset" values="0;-196;0" dur="8s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.22;0.55;0.26;0.22" dur="6s" repeatCount="indefinite"/>
  </path>
  <rect x="-400" y="0" width="360" height="{height}" fill="#ffffff" opacity="0.035" transform="skewX(-18)">
    <animate attributeName="x" values="-420;1700" dur="7.5s" repeatCount="indefinite"/>
  </rect>
  <style>
    text {{ font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    .eyebrow {{ fill: #7ee787; font-size: 27px; font-weight: 850; letter-spacing: 5px; }}
    .title {{ fill: #f0f6fc; font-size: 98px; font-weight: 920; letter-spacing: 0; }}
    .subtitle {{ fill: #c9d1d9; font-size: 34px; font-weight: 650; }}
    .body {{ fill: #aebac7; font-size: 27px; font-weight: 480; }}
    .small {{ fill: #8b949e; font-size: 21px; font-weight: 550; }}
    .metric-value {{ fill: #f0f6fc; font-size: 58px; font-weight: 920; }}
    .metric-label {{ fill: #8b949e; font-size: 20px; font-weight: 850; letter-spacing: 2px; }}
    .section-title {{ fill: #f0f6fc; font-size: 44px; font-weight: 900; }}
    .tag {{ fill: #d5f5df; font-size: 25px; font-weight: 800; }}
    .panel, .project-card rect, .action-card {{ fill: #0d2118; stroke: #2f4c40; stroke-width: 1.5; filter: url(#soft-shadow); }}
    .project-name {{ fill: #f0f6fc; font-size: 29px; font-weight: 850; }}
    .project-meta {{ fill: #7ee787; font-size: 18px; font-weight: 850; }}
    .project-desc {{ fill: #aebac7; font-size: 20px; font-weight: 520; }}
    .link {{ fill: #58a6ff; font-size: 25px; font-weight: 800; }}
    .rule {{ stroke: url(#beam); stroke-width: 5; stroke-linecap: round; }}
  </style>
  {body}
</svg>
"""


def render_hero_svg(pulse: ProfilePulse) -> str:
    body = f"""
  <g transform="translate(90 96)">
    <text class="eyebrow" x="0" y="0">CLICK FOR PROFILE ACTIONS</text>
    <text class="title" x="0" y="120">LIghtJUNction</text>
    <text class="subtitle" x="4" y="184">AI tooling / Linux automation / agent workflows</text>
    <text class="subtitle" x="4" y="226">Practical security / auditable operations</text>
    <line class="rule" x1="4" y1="270" x2="930" y2="270"/>
    <text class="body" x="4" y="332">Terminal-first systems that survive real machines, clear boundaries, and auditable work.</text>
    <text class="small" x="4" y="374">Generated from public repository data and local work-report state. Last refresh: {esc(pulse.refreshed_on)}</text>
  </g>
  <g transform="translate(1040 104)">
    <rect class="panel" width="420" height="300" rx="30"/>
    <text class="section-title" x="34" y="76">Open Hub</text>
    <text class="body" x="34" y="130">Links, install commands,</text>
    <text class="body" x="34" y="168">reports, contact routes.</text>
    <text class="link" x="34" y="236">PROFILE_ACTIONS.md</text>
  </g>
"""
    return svg_shell("LIghtJUNction hero", 520, body)


def render_pulse_svg(pulse: ProfilePulse) -> str:
    latest = pulse.latest_work_report or "No report yet"
    metrics = [
        ("PUBLIC REPOS", format_value(pulse.public_repos)),
        ("FOLLOWERS", format_value(pulse.followers)),
        ("PROJECT CARDS", f"{pulse.project_cards:,}"),
        ("AGENT SKILLS", f"{pulse.skill_count:,}"),
        ("WORK REPORTS", f"{pulse.work_report_count:,}"),
    ]
    metric_svg = []
    for index, (label, value) in enumerate(metrics):
        metric_svg.append(
            f"""
    <g transform="translate({70 + index * 286} 150)">
      <text class="metric-value" x="0" y="0">{esc(value)}</text>
      <text class="metric-label" x="0" y="52">{esc(label)}</text>
      <circle cx="18" cy="-20" r="5" fill="#7ee787" opacity="0.7" filter="url(#neon)">
        <animate attributeName="r" values="4;10;4" dur="{3 + index * 0.35}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.25;0.9;0.25" dur="{3 + index * 0.35}s" repeatCount="indefinite"/>
      </circle>
    </g>"""
        )
    body = f"""
  <g transform="translate(90 70)">
    <rect class="panel" width="1420" height="300" rx="30"/>
    <text class="section-title" x="52" y="76">Live Profile Pulse</text>
    {"".join(metric_svg)}
    <text class="small" x="52" y="250">Latest report: {esc(latest)} / click for report and data links</text>
  </g>
"""
    return svg_shell("LIghtJUNction profile pulse", 450, body)


def render_projects_svg(pulse: ProfilePulse) -> str:
    rendered: list[str] = []
    start_x = 90
    start_y = 172
    card_width = 450
    card_height = 170
    gap_x = 34
    gap_y = 34
    for index, project in enumerate(pulse.top_projects):
        col = index % 3
        row = index // 3
        x = start_x + col * (card_width + gap_x)
        y = start_y + row * (card_height + gap_y)
        description = text_lines(project.description, width=24, max_lines=3)
        rendered.append(
            f"""
  <g class="project-card" transform="translate({x} {y})">
    <animateTransform attributeName="transform" type="translate" values="{x} {y};{x} {y - 8};{x} {y}" dur="{5.5 + index * 0.4}s" repeatCount="indefinite"/>
    <rect width="{card_width}" height="{card_height}" rx="22"/>
    <text class="project-name" x="24" y="42">{esc(project.name)}</text>
    <text class="project-meta" x="24" y="72">{esc(project.language)} / {project.stars:,} stars / {project.forks:,} forks</text>
    {svg_text_block(description, x=24, y=106, class_name="project-desc", line_height=24)}
  </g>"""
        )
    body = f"""
  <text class="section-title" x="90" y="86">Selected Public Work</text>
  <text class="small" x="90" y="124">Synchronized from public/github-projects.json. Click for repository links.</text>
  {"".join(rendered)}
"""
    return svg_shell("LIghtJUNction selected projects", 660, body)


def render_actions_svg(_: ProfilePulse) -> str:
    cards = [
        ("Install skills", "npx skills add LIghtJUNction/lightjunction -g"),
        ("Bootstrap Linux", "curl -sSL .../bootstrap-linux.sh | bash"),
        ("Read reports", "WORK_REPORT/index.md"),
        ("Secure contact", "OpenPGP browser message flow"),
    ]
    rendered = []
    for index, (title, detail) in enumerate(cards):
        x = 90 + (index % 2) * 724
        y = 170 + (index // 2) * 150
        rendered.append(
            f"""
  <g transform="translate({x} {y})">
    <animateTransform attributeName="transform" type="translate" values="{x} {y};{x + 10} {y};{x} {y}" dur="{4.8 + index * 0.5}s" repeatCount="indefinite"/>
    <rect class="action-card" width="660" height="110" rx="24"/>
    <text class="project-name" x="28" y="44">{esc(title)}</text>
    <text class="link" x="28" y="82">{esc(detail)}</text>
  </g>"""
        )
    body = f"""
  <text class="section-title" x="90" y="84">Click Actions</text>
  <text class="small" x="90" y="124">Each README image jumps to PROFILE_ACTIONS.md with copyable commands and links.</text>
  {"".join(rendered)}
"""
    return svg_shell("LIghtJUNction actions", 520, body)


def render_readme() -> str:
    return """<div align="center">
  <a href="PROFILE_ACTIONS.md#quick-links"><img src="public/profile-hero.svg" alt="LIghtJUNction profile hero" width="100%" /></a>
  <a href="PROFILE_ACTIONS.md#live-data"><img src="public/profile-pulse.svg" alt="LIghtJUNction live profile data" width="100%" /></a>
  <a href="PROFILE_ACTIONS.md#repositories"><img src="public/profile-projects.svg" alt="LIghtJUNction selected public work" width="100%" /></a>
  <a href="PROFILE_ACTIONS.md#copyable-commands"><img src="public/profile-actions.svg" alt="LIghtJUNction copyable commands and links" width="100%" /></a>
</div>
"""


def render_actions_md(pulse: ProfilePulse) -> str:
    project_lines = "\n".join(
        f"- [{project.full_name}](https://github.com/{project.full_name}) - {project.language}, {project.stars:,} stars"
        for project in pulse.top_projects
    )
    latest_report = pulse.latest_work_report or "WORK_REPORT/index.md"
    return f"""# LIghtJUNction Profile Actions

This file is the click target for the generated SVG panels in `README.md`.

## Quick Links

- [Website terminal](https://lightjunction.github.io/lightjunction/)
- [GitHub profile](https://github.com/LIghtJUNction)
- [Hugging Face](https://huggingface.co/LIghtJUNction)
- [Kaggle](https://www.kaggle.com/lightjunction)
- [Work report index](WORK_REPORT/index.md)
- [Latest work report]({latest_report})
- [Project data source](public/github-projects.json)

## Live Data

- Last refreshed: `{pulse.refreshed_on}`
- Public repositories: `{format_value(pulse.public_repos)}`
- Followers: `{format_value(pulse.followers)}`
- Website project cards: `{pulse.project_cards:,}`
- Reusable agent skills: `{pulse.skill_count:,}`
- Tracked work reports: `{pulse.work_report_count:,}`

## Repositories

{project_lines}

## Copyable Commands

Install reusable agent skills globally:

```bash
npx skills add LIghtJUNction/lightjunction -g
```

Install the global agent prompt:

```bash
curl -fsSL https://raw.githubusercontent.com/LIghtJUNction/AGENTS.md/main/AGENTS.md -o ~/AGENTS.md
```

Linux workstation bootstrap:

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-linux.sh | bash
```

macOS bootstrap:

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/bootstrap-macbook.sh | bash
```

SSH public key deployment:

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/deploy-ssh-keys.sh | bash
```

Shell module loader:

```bash
curl -sSL https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/basic.sh | bash
```

Import the OpenPGP public key:

```bash
gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys EB21B83AB1E982DF66F08387A67178405F7736FD
```

Fingerprint:

```text
EB21B83AB1E982DF66F08387A67178405F7736FD
```

## Support And Security

- [Sponsor files](sponsor/)
- BTC: `bc1qvt6dukyequta44jmwrsl69du69srvw7zc5lt47`
- SOL: `VvjgAbuxTuK2By8MYRMsWKVfwrN2ps6o5Yk9Eh2d2Hb`
- Never send private keys, seed phrases, recovery codes, wallet passwords, exchange credentials, or production secrets.
"""


def clean_generated_text(text: str) -> str:
    """Normalize generated text files so Git whitespace checks stay clean."""
    return "\n".join(line.rstrip() for line in text.splitlines()) + "\n"


def main() -> int:
    """Refresh README.md, click target Markdown, and generated SVG panels."""
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER", DEFAULT_OWNER)
    token = os.environ.get("GITHUB_TOKEN", "")
    pulse = build_pulse(owner=owner, token=token)

    SVG_FILES["hero"].write_text(clean_generated_text(render_hero_svg(pulse)), encoding="utf-8")
    SVG_FILES["pulse"].write_text(clean_generated_text(render_pulse_svg(pulse)), encoding="utf-8")
    SVG_FILES["projects"].write_text(
        clean_generated_text(render_projects_svg(pulse)), encoding="utf-8"
    )
    SVG_FILES["actions"].write_text(
        clean_generated_text(render_actions_svg(pulse)), encoding="utf-8"
    )
    if LEGACY_SVG_FILE.exists():
        LEGACY_SVG_FILE.unlink()
    README_FILE.write_text(clean_generated_text(render_readme()), encoding="utf-8")
    ACTIONS_FILE.write_text(clean_generated_text(render_actions_md(pulse)), encoding="utf-8")
    print(f"Updated profile SVG panels and README for {pulse.refreshed_on}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
