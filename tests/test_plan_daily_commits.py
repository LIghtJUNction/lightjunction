"""Tests for the random daily commit planner and its workflow wiring."""

from __future__ import annotations

import random
import statistics
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import plan_daily_commits as mod
import pytest


def test_commit_count_follows_requested_normal_distribution() -> None:
    rng = random.Random(20260809)
    samples = [mod.sample_commit_count(rng) for _ in range(100_000)]

    assert statistics.fmean(samples) == pytest.approx(10, abs=0.05)
    assert statistics.pstdev(samples) == pytest.approx(3, abs=0.05)
    assert min(samples) >= 1
    assert len(set(samples)) >= 15


def test_commit_times_are_unique_sorted_and_within_the_local_day() -> None:
    china_time = ZoneInfo("Asia/Shanghai")
    now = datetime(2026, 8, 9, 22, 17, 45, tzinfo=china_time)

    plan = mod.plan_commit_times(now, 18, random.Random(7))

    assert plan == sorted(plan)
    assert len(plan) == len(set(plan)) == 18
    assert all(item.date() == now.date() for item in plan)
    assert all(item <= now for item in plan)
    assert all(item.utcoffset() == now.utcoffset() for item in plan)


def test_commit_planner_rejects_invalid_inputs() -> None:
    aware_now = datetime(2026, 8, 9, tzinfo=ZoneInfo("Asia/Shanghai"))

    with pytest.raises(ValueError, match="timezone"):
        mod.plan_commit_times(datetime(2026, 8, 9), 10, random.Random(1))
    with pytest.raises(ValueError, match="count"):
        mod.plan_commit_times(aware_now, 0, random.Random(1))


def test_sync_workflow_uses_one_daily_run_and_preserves_random_dates() -> None:
    workflow = Path(".github/workflows/sync-project-cards.yml").read_text(encoding="utf-8")

    assert "cron: '17 14 * * *'" in workflow
    assert workflow.count("cron:") == 1
    assert "uv run scripts/plan-daily-commits.py" in workflow
    assert 'GIT_AUTHOR_DATE="$commit_date"' in workflow
    assert 'GIT_COMMITTER_DATE="$commit_date"' in workflow
    assert "git commit --allow-empty" in workflow
    assert "--committer-date-is-author-date" in workflow
