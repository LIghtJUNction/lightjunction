"""Tests for the profile README pulse updater."""

from __future__ import annotations

from pathlib import Path

import pytest
import update_profile_pulse as pulse


def test_render_profile_pulse_includes_markers_and_local_links() -> None:
    data = pulse.ProfilePulse(
        refreshed_on="2026-06-20 14:40:00 UTC",
        public_repos=42,
        followers=7,
        project_cards=11,
        skill_count=5,
        work_report_count=3,
        latest_work_report="WORK_REPORT/2026/06/20.md",
    )

    rendered = pulse.render_profile_pulse(data)

    assert rendered.startswith(pulse.START_MARKER)
    assert rendered.endswith(f"{pulse.END_MARKER}\n")
    assert "| Public GitHub repos | 42 |" in rendered
    assert "[WORK_REPORT/2026/06/20.md](WORK_REPORT/2026/06/20.md)" in rendered


def test_render_profile_pulse_marks_unavailable_public_stats() -> None:
    data = pulse.ProfilePulse(
        refreshed_on="2026-06-20 14:40:00 UTC",
        public_repos=None,
        followers=None,
        project_cards=0,
        skill_count=0,
        work_report_count=0,
        latest_work_report=None,
    )

    rendered = pulse.render_profile_pulse(data)

    assert "| Public GitHub repos | unavailable |" in rendered
    assert "| GitHub followers | unavailable |" in rendered
    assert "| Latest work report | not available |" in rendered


def test_render_portfolio_glance_includes_managed_stats() -> None:
    data = pulse.ProfilePulse(
        refreshed_on="2026-06-20 14:40:00 UTC",
        public_repos=112,
        followers=76,
        project_cards=144,
        skill_count=12,
        work_report_count=8,
        latest_work_report="WORK_REPORT/2026/06/18.md",
    )

    rendered = pulse.render_portfolio_glance(data)

    assert rendered.startswith(pulse.PORTFOLIO_START_MARKER)
    assert rendered.endswith(f"{pulse.PORTFOLIO_END_MARKER}\n")
    assert "<sub>PUBLIC REPOS</sub>" in rendered
    assert "<strong>112</strong>" in rendered
    assert "<sub>PROJECT CARDS</sub>" in rendered
    assert "<strong>144</strong>" in rendered


def test_replace_managed_section_preserves_surrounding_content() -> None:
    readme = f"before\n\n{pulse.START_MARKER}\nold\n{pulse.END_MARKER}\n\nafter\n"
    replacement = f"{pulse.START_MARKER}\nnew\n{pulse.END_MARKER}\n"

    updated = pulse.replace_managed_section(readme, replacement)

    assert "old" not in updated
    assert "before" in updated
    assert "after" in updated
    assert updated.count(pulse.START_MARKER) == 1
    assert updated.count(pulse.END_MARKER) == 1


def test_replace_marked_section_uses_custom_markers() -> None:
    readme = (
        f"before\n\n{pulse.PORTFOLIO_START_MARKER}\nold\n{pulse.PORTFOLIO_END_MARKER}\n\nafter\n"
    )
    replacement = f"{pulse.PORTFOLIO_START_MARKER}\nnew\n{pulse.PORTFOLIO_END_MARKER}\n"

    updated = pulse.replace_marked_section(
        readme,
        start_marker=pulse.PORTFOLIO_START_MARKER,
        end_marker=pulse.PORTFOLIO_END_MARKER,
        replacement=replacement,
    )

    assert "old" not in updated
    assert "new" in updated
    assert updated.count(pulse.PORTFOLIO_START_MARKER) == 1
    assert updated.count(pulse.PORTFOLIO_END_MARKER) == 1


def test_replace_managed_section_requires_markers() -> None:
    with pytest.raises(ValueError):
        pulse.replace_managed_section("plain README", "replacement")


def test_count_project_cards_handles_missing_and_valid_json(tmp_path: Path) -> None:
    assert pulse.count_project_cards(tmp_path / "missing.json") == 0

    data = tmp_path / "github-projects.json"
    data.write_text('{"project_cards": [{"name": "a"}, {"name": "b"}]}', encoding="utf-8")

    assert pulse.count_project_cards(data) == 2


def test_latest_work_report_uses_dated_paths(tmp_path: Path) -> None:
    work_report = tmp_path / "WORK_REPORT" / "2026" / "06"
    work_report.mkdir(parents=True)
    (work_report / "19.md").write_text("# 19\n", encoding="utf-8")
    (work_report / "20.md").write_text("# 20\n", encoding="utf-8")

    assert pulse.latest_work_report(tmp_path) == "WORK_REPORT/2026/06/20.md"
