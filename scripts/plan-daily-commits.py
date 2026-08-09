#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Plan one day's normally distributed commits at unique random times."""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

COMMIT_COUNT_MEAN = 10.0
COMMIT_COUNT_STDDEV = 3.0
MIN_COMMIT_COUNT = 1
SECONDS_PER_DAY = 24 * 60 * 60
COMMIT_TIMEZONE = ZoneInfo("Asia/Shanghai")


def sample_commit_count(rng: random.Random) -> int:
    """Return a positive integer sampled from a rounded normal distribution."""
    while True:
        count = round(rng.normalvariate(COMMIT_COUNT_MEAN, COMMIT_COUNT_STDDEV))
        if MIN_COMMIT_COUNT <= count <= SECONDS_PER_DAY:
            return count


def plan_commit_times(
    now: datetime,
    count: int,
    rng: random.Random,
) -> list[datetime]:
    """Return sorted, unique timestamps from the current China-calendar day."""
    if now.tzinfo is None:
        raise ValueError("now must include a timezone")
    if not MIN_COMMIT_COUNT <= count <= SECONDS_PER_DAY:
        raise ValueError(f"count must be between {MIN_COMMIT_COUNT} and {SECONDS_PER_DAY}")

    local_now = now.astimezone(COMMIT_TIMEZONE)
    day_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    elapsed_seconds = int((local_now - day_start).total_seconds()) + 1
    available_seconds = max(count, elapsed_seconds)
    offsets = sorted(rng.sample(range(available_seconds), count))
    return [day_start + timedelta(seconds=offset) for offset in offsets]


def build_daily_plan(
    now: datetime | None = None,
    rng: random.Random | None = None,
) -> list[datetime]:
    """Build a complete daily plan using system entropy unless dependencies are supplied."""
    active_rng = rng or random.SystemRandom()
    active_now = now or datetime.now(COMMIT_TIMEZONE)
    count = sample_commit_count(active_rng)
    return plan_commit_times(active_now, count, active_rng)


def main() -> int:
    """Print one ISO-8601 commit timestamp per line for the workflow."""
    for commit_time in build_daily_plan():
        print(commit_time.isoformat(timespec="seconds"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
