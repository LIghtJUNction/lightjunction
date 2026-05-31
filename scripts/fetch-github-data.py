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
import os
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests

API_ROOT = "https://api.github.com"
DEFAULT_OWNER = "LIghtJUNction"
DEFAULT_REPO_LIMIT = 24
DEFAULT_DAYS = 7


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
        url = path_or_url if path_or_url.startswith("http") else f"{API_ROOT}{path_or_url}"
        if params:
            url = f"{url}?{urlencode(params)}"
        try:
            response = requests.get(url, headers=self.headers, timeout=20)
            if response.status_code == 404:
                print(f"warn: GitHub resource not found: {url}", file=sys.stderr)
                return None
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            print(f"warn: GitHub request failed: {url}: {exc}", file=sys.stderr)
            return None

    def pages(self, path: str, *, max_pages: int = 2, **params: Any) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for page in range(1, max_pages + 1):
            data = self.get(path, per_page=params.pop("per_page", 100), page=page, **params)
            if not isinstance(data, list) or not data:
                break
            items.extend(item for item in data if isinstance(item, dict))
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
    return {key: data.get(key, "" if key in {"created_at", "name", "bio", "html_url"} else 0) for key in keys}


def get_recent_repos(username: str, count: int = 6) -> list[dict[str, Any]]:
    repos = api_get(f"{API_ROOT}/users/{username}/repos?sort=updated&direction=desc&per_page={count}")
    return repos[:count] if isinstance(repos, list) else []


def get_org_repos(org: str, count: int = 10) -> list[dict[str, Any]]:
    repos = api_get(f"{API_ROOT}/orgs/{org}/repos?sort=updated&direction=desc&per_page={count}")
    return repos[:count] if isinstance(repos, list) else []


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


def candidate_repos(username: str, orgs: list[str] | tuple[str, ...] | None = None, limit: int = DEFAULT_REPO_LIMIT) -> list[dict[str, Any]]:
    repos = get_recent_repos(username, count=limit)
    for org in normalize_orgs(orgs):
        repos.extend(get_org_repos(org, count=max(8, limit // 2)))
    return unique_repos(repos, limit)


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


def fetch_repo_commits(repo: dict[str, Any], username: str, since: str, per_page: int = 100) -> list[dict[str, Any]]:
    full_name = repo.get("full_name", "")
    if not full_name:
        return []

    data = api_get(f"{API_ROOT}/repos/{full_name}/commits?author={username}&since={since}&per_page={per_page}")
    if isinstance(data, list) and data:
        return [item for item in data if isinstance(item, dict)]

    data = api_get(f"{API_ROOT}/repos/{full_name}/commits?since={since}&per_page={min(per_page, 30)}")
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict) and commit_belongs_to_user(item, username)]


def collect_commits(username: str, days: int = DEFAULT_DAYS, orgs: list[str] | tuple[str, ...] | None = None) -> list[dict[str, Any]]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    commits: list[dict[str, Any]] = []
    for repo in candidate_repos(username, orgs, limit=SETTINGS.repo_limit):
        commits.extend(format_commit(repo, commit) for commit in fetch_repo_commits(repo, username, since, per_page=100))
    commits.sort(key=lambda item: item.get("date", ""), reverse=True)
    return commits


def get_recent_commits(username: str, days: int = DEFAULT_DAYS, orgs: list[str] | None = None) -> list[dict[str, Any]]:
    return collect_commits(username, days=days, orgs=orgs)


def get_weekly_commits(username: str, orgs: list[str] | None = None) -> tuple[int, list[tuple[str, dict[str, Any]]]]:
    commits = collect_commits(username, days=7, orgs=orgs)
    counts = Counter(commit["repo"] for commit in commits if commit.get("repo"))
    repo_by_name = {repo.get("full_name", ""): repo for repo in candidate_repos(username, orgs, limit=SETTINGS.repo_limit)}
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
    repo_lookup = {repo.get("full_name", ""): repo for repo in candidate_repos(settings.owner, settings.orgs, settings.repo_limit)}
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
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    print(f"Fetching GitHub data for @{SETTINGS.owner}")
    if SETTINGS.orgs:
        print(f"Including org activity: {', '.join(SETTINGS.orgs)}")

    payload = build_payload()
    SETTINGS.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote {SETTINGS.output}")
    print(f"Repos: {len(payload['repos'])}")
    print(f"Commits ({SETTINGS.days} days): {len(payload['commits'])}")
    print(f"Weekly total: {payload['weekly'][0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
