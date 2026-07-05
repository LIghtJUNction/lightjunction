"""Tests for the generated animated profile README panels."""

from __future__ import annotations

import json
from pathlib import Path
from xml.etree import ElementTree as ET

import update_profile_pulse as pulse


def sample_pulse() -> pulse.ProfilePulse:
    return pulse.ProfilePulse(
        refreshed_on="2026-07-05 10:52 UTC",
        public_repos=42,
        followers=7,
        project_cards=11,
        skill_count=5,
        work_report_count=3,
        latest_work_report="WORK_REPORT/2026/07/05.md",
        top_projects=[
            pulse.ProjectCard(
                name="demo",
                full_name="LIghtJUNction/demo",
                description="A demo project that proves generated SVG panels still render.",
                language="Python",
                stars=12,
                forks=2,
                rank_score=99.0,
            )
        ],
    )


def test_render_readme_links_each_svg_to_action_sections() -> None:
    rendered = pulse.render_readme()

    assert 'href="PROFILE_ACTIONS.md#quick-links"' in rendered
    assert 'href="PROFILE_ACTIONS.md#live-data"' in rendered
    assert 'href="PROFILE_ACTIONS.md#repositories"' in rendered
    assert 'href="PROFILE_ACTIONS.md#copyable-commands"' in rendered
    assert "public/profile-hero.svg" in rendered
    assert "public/profile-pulse.svg" in rendered
    assert "public/profile-projects.svg" in rendered
    assert "public/profile-actions.svg" in rendered


def test_svg_panels_are_valid_and_animated() -> None:
    data = sample_pulse()
    renderers = [
        pulse.render_hero_svg,
        pulse.render_pulse_svg,
        pulse.render_projects_svg,
        pulse.render_actions_svg,
    ]

    for renderer in renderers:
        rendered = renderer(data)
        ET.fromstring(rendered)
        assert "<animate" in rendered
        assert "<animateTransform" in rendered


def test_render_actions_md_contains_links_commands_and_live_data() -> None:
    rendered = pulse.render_actions_md(sample_pulse())

    assert "## Quick Links" in rendered
    assert "## Copyable Commands" in rendered
    assert "[Latest work report](WORK_REPORT/2026/07/05.md)" in rendered
    assert "npx skills add LIghtJUNction/lightjunction -g" in rendered
    assert "LIghtJUNction/demo" in rendered
    assert "Public repositories: `42`" in rendered


def test_read_project_cards_handles_list_and_compact_formats(tmp_path: Path) -> None:
    list_data = tmp_path / "list.json"
    list_data.write_text(
        json.dumps(
            {
                "project_cards": [
                    {
                        "name": "b",
                        "full_name": "owner/b",
                        "description": "B",
                        "language": "Rust",
                        "stargazers_count": 1,
                        "forks_count": 0,
                        "rank_score": 2,
                    },
                    {
                        "name": "a",
                        "full_name": "owner/a",
                        "description": "A",
                        "language": "Python",
                        "stargazers_count": 2,
                        "forks_count": 1,
                        "rank_score": 3,
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    assert [card.name for card in pulse._read_project_cards(list_data)] == ["a", "b"]

    compact_data = tmp_path / "compact.json"
    compact_data.write_text(
        json.dumps(
            {
                "project_cards": (
                    "[1]{name:string,full_name:string,description:string,language:string,"
                    "stargazers_count:int,forks_count:int,rank_score:float}\n"
                    "demo,owner/demo,Description,Shell,4,1,9.5\n"
                )
            }
        ),
        encoding="utf-8",
    )
    cards = pulse._read_project_cards(compact_data)
    assert len(cards) == 1
    assert cards[0].full_name == "owner/demo"


def test_work_report_paths_uses_dated_paths(tmp_path: Path) -> None:
    work_report = tmp_path / "WORK_REPORT" / "2026" / "06"
    work_report.mkdir(parents=True)
    (work_report / "19.md").write_text("# 19\n", encoding="utf-8")
    (work_report / "20.md").write_text("# 20\n", encoding="utf-8")
    (work_report / "notes.md").write_text("# ignored\n", encoding="utf-8")

    paths = [path.relative_to(tmp_path).as_posix() for path in pulse.work_report_paths(tmp_path)]

    assert paths == ["WORK_REPORT/2026/06/19.md", "WORK_REPORT/2026/06/20.md"]
