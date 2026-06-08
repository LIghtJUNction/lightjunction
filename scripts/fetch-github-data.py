#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests>=2.32.0",
# ]
# ///
"""Collect the GitHub snapshot consumed by scripts/update-readme.py."""

from __future__ import annotations

import json
import math
import os
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import requests

API_ROOT = "https://api.github.com"
DEFAULT_OWNER = "LIghtJUNction"
DEFAULT_REPO_LIMIT = 24
DEFAULT_DAYS = 7
PROJECT_CARD_SCHEMA_VERSION = 1


def env_list(name: str) -> list[str]:
    raw = os.environ.get(name, "")
    return [item.strip().strip("/") for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    owner: str = os.environ.get("GITHUB_REPOSITORY_OWNER", DEFAULT_OWNER)
    token: str = os.environ.get("GITHUB_TOKEN", "")
    orgs: tuple[str, ...] = tuple(env_list("TEAM_ORGS"))
    days: int = int(os.environ.get("README_ACTIVITY_DAYS", DEFAULT_DAYS))
    repo_limit: int = int(os.environ.get("README_REPO_LIMIT", DEFAULT_REPO_LIMIT))
    output: Path = Path(os.environ.get("GITHUB_DATA_PATH", "github_data.json"))
    projects_output: Path = Path(
        os.environ.get("GITHUB_PROJECTS_PATH", "public/github-projects.json")
    )


class GitHubClient:
    def __init__(self, token: str = "") -> None:
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lightjunction-readme-updater",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def get(self, path_or_url: str, **params: Any) -> Any | None:
        response = self.response(path_or_url, **params)
        if response is None:
            return None
        return response.json()

    def response(self, path_or_url: str, **params: Any) -> requests.Response | None:
        url = path_or_url if path_or_url.startswith("http") else f"{API_ROOT}{path_or_url}"
        if params:
            url = f"{url}?{urlencode(params)}"
        try:
            response = requests.get(url, headers=self.headers, timeout=20)
            if response.status_code == 404:
                print(f"warn: GitHub resource not found: {url}", file=sys.stderr)
                return None
            response.raise_for_status()
            return response
        except Exception as exc:
            print(f"warn: GitHub request failed: {url}: {exc}", file=sys.stderr)
            return None

    def pages(self, path: str, *, max_pages: int | None = 2, **params: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        page = 1
        per_page = params.pop("per_page", 100)
        while max_pages is None or page <= max_pages:
            data = self.get(path, per_page=per_page, page=page, **params)
            if not isinstance(data, list) or not data:
                break
            items.extend(item for item in data if isinstance(item, dict))
            if len(data) < per_page:
                break
            page += 1
        return items


SETTINGS = Settings()
CLIENT = GitHubClient(SETTINGS.token)


def api_get(url: str) -> Any | None:
    """Compatibility wrapper used by tests and older scripts."""
    return CLIENT.get(url)


def get_user_stats(username: str) -> dict[str, Any]:
    data = api_get(f"{API_ROOT}/users/{username}")
    if not isinstance(data, dict):
        return {}
    keys = ("public_repos", "followers", "following", "created_at", "name", "bio", "html_url")
    return {
        key: data.get(key, "" if key in {"created_at", "name", "bio", "html_url"} else 0)
        for key in keys
    }


def get_recent_repos(username: str, count: int = 6) -> list[dict[str, Any]]:
    repos = api_get(
        f"{API_ROOT}/users/{username}/repos?sort=updated&direction=desc&per_page={count}"
    )
    return repos[:count] if isinstance(repos, list) else []


def get_org_repos(org: str, count: int = 10) -> list[dict[str, Any]]:
    repos = api_get(f"{API_ROOT}/orgs/{org}/repos?sort=updated&direction=desc&per_page={count}")
    return repos[:count] if isinstance(repos, list) else []


def get_user_orgs(username: str) -> list[str]:
    """Return public organization logins for a user."""
    orgs = CLIENT.pages(f"/users/{username}/orgs", max_pages=None)
    return normalize_orgs([str(org.get("login", "")) for org in orgs])


def project_orgs(username: str, orgs: list[str] | tuple[str, ...] | None = None) -> list[str]:
    """Return public and configured organizations to include in project cards."""
    return normalize_orgs([*get_user_orgs(username), *(orgs or [])])


def normalize_orgs(orgs: list[str] | tuple[str, ...] | None) -> list[str]:
    normalized: list[str] = []
    for item in orgs or []:
        org = item.split("/", 1)[0].strip()
        if org and org not in normalized:
            normalized.append(org)
    return normalized


def unique_repos(repos: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for repo in repos:
        full_name = repo.get("full_name")
        if not full_name or full_name in seen:
            continue
        seen.add(full_name)
        result.append(repo)
        if len(result) >= limit:
            break
    return result


def unique_all_repos(repos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return all unique repositories keyed by full_name."""
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for repo in repos:
        full_name = repo.get("full_name")
        if not full_name or full_name in seen:
            continue
        seen.add(full_name)
        result.append(repo)
    return result


def candidate_repos(
    username: str, orgs: list[str] | tuple[str, ...] | None = None, limit: int = DEFAULT_REPO_LIMIT
) -> list[dict[str, Any]]:
    repos = get_recent_repos(username, count=limit)
    for org in normalize_orgs(orgs):
        repos.extend(get_org_repos(org, count=max(8, limit // 2)))
    return unique_repos(repos, limit)


def collect_project_repos(
    username: str,
    orgs: list[str] | tuple[str, ...] | None = None,
    *,
    include_user_orgs: bool = True,
) -> list[dict[str, Any]]:
    """Collect user-owned and organization repositories for the frontend."""
    repos = CLIENT.pages(
        f"/users/{username}/repos",
        max_pages=None,
        type="owner",
        sort="full_name",
        per_page=100,
    )
    known_orgs = project_orgs(username, orgs) if include_user_orgs else normalize_orgs(orgs)
    for org in known_orgs:
        repos.extend(
            CLIENT.pages(
                f"/orgs/{org}/repos",
                max_pages=None,
                type="all",
                sort="full_name",
                per_page=100,
            )
        )
    return unique_all_repos(repos)


def commit_belongs_to_user(commit: dict[str, Any], username: str) -> bool:
    expected = username.lower()
    for key in ("author", "committer"):
        login = ((commit.get(key) or {}).get("login") or "").lower()
        if login == expected:
            return True
    return False


def format_commit(repo: dict[str, Any], commit: dict[str, Any]) -> dict[str, Any]:
    payload = commit.get("commit") or {}
    message = (payload.get("message") or "").splitlines()[0]
    committer = payload.get("committer") or {}
    return {
        "repo": repo.get("full_name", ""),
        "repo_url": repo.get("html_url", ""),
        "message": message,
        "sha": (commit.get("sha") or "")[:7],
        "url": commit.get("html_url", ""),
        "date": committer.get("date", ""),
    }


def fetch_repo_commits(
    repo: dict[str, Any], username: str, since: str, per_page: int = 100
) -> list[dict[str, Any]]:
    full_name = repo.get("full_name", "")
    if not full_name:
        return []

    data = api_get(
        f"{API_ROOT}/repos/{full_name}/commits?author={username}&since={since}&per_page={per_page}"
    )
    if isinstance(data, list) and data:
        return [item for item in data if isinstance(item, dict)]

    data = api_get(
        f"{API_ROOT}/repos/{full_name}/commits?since={since}&per_page={min(per_page, 30)}"
    )
    if not isinstance(data, list):
        return []
    return [
        item for item in data if isinstance(item, dict) and commit_belongs_to_user(item, username)
    ]


def last_page_from_link_header(link_header: str) -> int | None:
    """Extract the last page number from a GitHub Link header."""
    for part in link_header.split(","):
        url_part, *rel_parts = [item.strip() for item in part.split(";")]
        if 'rel="last"' not in rel_parts:
            continue
        parsed = urlparse(url_part.strip("<>"))
        page = parse_qs(parsed.query).get("page", [""])[0]
        return int(page) if page.isdigit() else None
    return None


def fetch_repo_commit_count(repo: dict[str, Any]) -> int | None:
    """Return the default-branch commit count for a repository."""
    full_name = repo.get("full_name", "")
    branch = repo.get("default_branch", "")
    if not full_name or not branch:
        return None

    response = CLIENT.response(f"/repos/{full_name}/commits", sha=branch, per_page=1)
    if response is None:
        return None

    last_page = last_page_from_link_header(response.headers.get("Link", ""))
    if last_page is not None:
        return last_page

    data = response.json()
    return len(data) if isinstance(data, list) else None


def age_days(value: str | None) -> float:
    """Return age in days for an ISO datetime string."""
    if not value:
        return float("inf")
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return float("inf")
    return max(0.0, (datetime.now(UTC) - timestamp).total_seconds() / 86_400)


def decay(age: float, half_life_days: float) -> float:
    """Return an exponential decay multiplier."""
    if age == float("inf"):
        return 0.0
    return 2 ** (-age / half_life_days)


def repo_rank_score(repo: dict[str, Any], commit_count: int | None) -> float:
    """Score repositories with activity as the dominant ranking signal."""
    commits = commit_count or 0
    active_project_boost = decay(age_days(repo.get("pushed_at")), 60) * 100_000
    new_project_boost = decay(age_days(repo.get("created_at")), 180) * 18_000
    star_score = math.log1p(int(repo.get("stargazers_count") or 0)) * 4_500
    commit_score = math.log1p(commits) * 850
    archived_penalty = 20_000 if repo.get("archived") else 0
    return active_project_boost + new_project_boost + star_score + commit_score - archived_penalty


def format_project_card(repo: dict[str, Any]) -> dict[str, Any]:
    """Return the frontend project-card shape for one repository."""
    commit_count = fetch_repo_commit_count(repo)
    return {
        "id": repo.get("id", 0),
        "name": repo.get("name", ""),
        "full_name": repo.get("full_name", ""),
        "html_url": repo.get("html_url", ""),
        "description": repo.get("description"),
        "language": repo.get("language"),
        "topics": repo.get("topics") if isinstance(repo.get("topics"), list) else [],
        "stargazers_count": repo.get("stargazers_count", 0),
        "forks_count": repo.get("forks_count", 0),
        "open_issues_count": repo.get("open_issues_count", 0),
        "default_branch": repo.get("default_branch", ""),
        "created_at": repo.get("created_at", ""),
        "updated_at": repo.get("updated_at", ""),
        "pushed_at": repo.get("pushed_at"),
        "archived": bool(repo.get("archived")),
        "fork": bool(repo.get("fork")),
        "commit_count": commit_count,
        "rank_score": repo_rank_score(repo, commit_count),
    }


def build_project_cards_payload(settings: Settings = SETTINGS) -> dict[str, Any]:
    """Build the static frontend project-card payload."""
    orgs = project_orgs(settings.owner, settings.orgs)
    cards = [
        format_project_card(repo)
        for repo in collect_project_repos(settings.owner, orgs, include_user_orgs=False)
    ]
    cards.sort(
        key=lambda repo: (
            -float(repo.get("rank_score") or 0),
            -int(repo.get("stargazers_count") or 0),
            str(repo.get("full_name") or ""),
        )
    )
    return {
        "schema_version": PROJECT_CARD_SCHEMA_VERSION,
        "owner": settings.owner,
        "included_orgs": orgs,
        "project_cards": cards,
        "generated_at": datetime.now(UTC).isoformat(),
    }


def collect_commits(
    username: str, days: int = DEFAULT_DAYS, orgs: list[str] | tuple[str, ...] | None = None
) -> list[dict[str, Any]]:
    since = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    commits: list[dict[str, Any]] = []
    for repo in candidate_repos(username, orgs, limit=SETTINGS.repo_limit):
        commits.extend(
            format_commit(repo, commit)
            for commit in fetch_repo_commits(repo, username, since, per_page=100)
        )
    commits.sort(key=lambda item: item.get("date", ""), reverse=True)
    return commits


def get_recent_commits(
    username: str, days: int = DEFAULT_DAYS, orgs: list[str] | None = None
) -> list[dict[str, Any]]:
    return collect_commits(username, days=days, orgs=orgs)


def get_weekly_commits(
    username: str, orgs: list[str] | None = None
) -> tuple[int, list[tuple[str, dict[str, Any]]]]:
    commits = collect_commits(username, days=7, orgs=orgs)
    counts = Counter(commit["repo"] for commit in commits if commit.get("repo"))
    repo_by_name = {
        repo.get("full_name", ""): repo
        for repo in candidate_repos(username, orgs, limit=SETTINGS.repo_limit)
    }
    summary = [
        (
            name,
            {
                "count": count,
                "url": repo_by_name.get(name, {}).get("html_url", ""),
                "description": repo_by_name.get(name, {}).get("description", ""),
                "language": repo_by_name.get(name, {}).get("language", ""),
            },
        )
        for name, count in counts.most_common()
    ]
    return len(commits), summary


def build_payload(settings: Settings = SETTINGS) -> dict[str, Any]:
    commits = collect_commits(settings.owner, days=settings.days, orgs=settings.orgs)
    counts = Counter(commit["repo"] for commit in commits if commit.get("repo"))
    repos = get_recent_repos(settings.owner, count=6)
    repo_lookup = {
        repo.get("full_name", ""): repo
        for repo in candidate_repos(settings.owner, settings.orgs, settings.repo_limit)
    }
    weekly = [
        (
            name,
            {
                "count": count,
                "url": repo_lookup.get(name, {}).get("html_url", ""),
                "description": repo_lookup.get(name, {}).get("description", ""),
                "language": repo_lookup.get(name, {}).get("language", ""),
            },
        )
        for name, count in counts.most_common()
    ]
    return {
        "schema_version": 2,
        "owner": settings.owner,
        "included_orgs": list(settings.orgs),
        "user_stats": get_user_stats(settings.owner),
        "repos": repos,
        "commits": commits,
        "weekly": (len(commits), weekly),
        "fetched_at": datetime.now(UTC).isoformat(),
    }


def main() -> int:
    print(f"Fetching GitHub data for @{SETTINGS.owner}")
    if SETTINGS.orgs:
        print(f"Including org activity: {', '.join(SETTINGS.orgs)}")

    payload = build_payload()
    project_payload = build_project_cards_payload()
    SETTINGS.projects_output.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    SETTINGS.projects_output.write_text(
        json.dumps(project_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Wrote {SETTINGS.output}")
    print(f"Wrote {SETTINGS.projects_output}")
    print(f"Repos: {len(payload['repos'])}")
    print(f"Project cards: {len(project_payload['project_cards'])}")
    print(f"Commits ({SETTINGS.days} days): {len(payload['commits'])}")
    print(f"Weekly total: {payload['weekly'][0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
