#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests>=2.32.0",
# ]
# ///
"""Generate the ranked GitHub project-card JSON consumed by the website."""

from __future__ import annotations

import json
import math
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import requests

API_ROOT = "https://api.github.com"
DEFAULT_OWNER = "LIghtJUNction"
PROJECT_CARD_SCHEMA_VERSION = 1

JsonObject = dict[str, Any]


def env_list(name: str) -> list[str]:
    """Return a comma-separated environment variable as clean path segments."""
    raw = os.environ.get(name, "")
    return [item.strip().strip("/") for item in raw.split(",") if item.strip()]


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime settings for project-card generation."""

    owner: str = os.environ.get("GITHUB_REPOSITORY_OWNER", DEFAULT_OWNER)
    token: str = os.environ.get("GITHUB_TOKEN", "")
    orgs: tuple[str, ...] = tuple(env_list("TEAM_ORGS"))
    projects_output: Path = Path(
        os.environ.get("GITHUB_PROJECTS_PATH", "public/github-projects.json")
    )


class GitHubClient:
    """Small defensive client for the GitHub REST endpoints used here."""

    def __init__(self, token: str = "") -> None:
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lightjunction-project-card-sync",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def get(self, path_or_url: str, **params: Any) -> Any | None:
        """Return decoded JSON for one GitHub request, or None on failure."""
        response = self.response(path_or_url, **params)
        if response is None:
            return None
        try:
            return response.json()
        except requests.JSONDecodeError as exc:
            print(f"warn: GitHub returned invalid JSON: {response.url}: {exc}", file=sys.stderr)
            return None

    def response(self, path_or_url: str, **params: Any) -> requests.Response | None:
        """Return a successful GitHub response, or None for recoverable failures."""
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
        except requests.RequestException as exc:
            print(f"warn: GitHub request failed: {url}: {exc}", file=sys.stderr)
            return None

    def pages(
        self,
        path: str,
        *,
        max_pages: int | None = 2,
        **params: Any,
    ) -> list[JsonObject]:
        """Return object items from paginated GitHub list responses."""
        items: list[JsonObject] = []
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


def normalize_orgs(orgs: list[str] | tuple[str, ...] | None) -> list[str]:
    """Return unique, normalized organization names in input order."""
    normalized: list[str] = []
    for item in orgs or []:
        org = item.split("/", 1)[0].strip()
        if org and org not in normalized:
            normalized.append(org)
    return normalized


def get_user_orgs(username: str) -> list[str]:
    """Return public organization logins for a user."""
    orgs = CLIENT.pages(f"/users/{username}/orgs", max_pages=None)
    return normalize_orgs([str(org.get("login", "")) for org in orgs])


def project_orgs(
    username: str,
    orgs: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    """Return public and configured organizations to include in project cards."""
    return normalize_orgs([*get_user_orgs(username), *(orgs or [])])


def unique_all_repos(repos: list[JsonObject]) -> list[JsonObject]:
    """Return all unique repositories keyed by full_name."""
    seen: set[str] = set()
    result: list[JsonObject] = []
    for repo in repos:
        full_name = str(repo.get("full_name") or "")
        if not full_name or full_name in seen:
            continue
        seen.add(full_name)
        result.append(repo)
    return result


def collect_project_repos(
    username: str,
    orgs: list[str] | tuple[str, ...] | None = None,
    *,
    include_user_orgs: bool = True,
) -> list[JsonObject]:
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


def fetch_repo_commit_count(repo: JsonObject) -> int | None:
    """Return the default-branch commit count for a repository."""
    full_name = str(repo.get("full_name") or "")
    branch = str(repo.get("default_branch") or "")
    if not full_name or not branch:
        return None

    response = CLIENT.response(f"/repos/{full_name}/commits", sha=branch, per_page=1)
    if response is None:
        return None

    last_page = last_page_from_link_header(response.headers.get("Link", ""))
    if last_page is not None:
        return last_page

    try:
        data = response.json()
    except requests.JSONDecodeError as exc:
        print(f"warn: GitHub returned invalid commit JSON: {response.url}: {exc}", file=sys.stderr)
        return None
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


def repo_rank_score(repo: JsonObject, commit_count: int | None) -> float:
    """Score repositories with activity as the dominant ranking signal."""
    commits = commit_count or 0
    active_project_boost = decay(age_days(repo.get("pushed_at")), 60) * 100_000
    new_project_boost = decay(age_days(repo.get("created_at")), 180) * 18_000
    star_score = math.log1p(int(repo.get("stargazers_count") or 0)) * 4_500
    commit_score = math.log1p(commits) * 850
    archived_penalty = 20_000 if repo.get("archived") else 0
    return active_project_boost + new_project_boost + star_score + commit_score - archived_penalty


def format_project_card(repo: JsonObject) -> JsonObject:
    """Return the frontend project-card shape for one repository."""
    commit_count = fetch_repo_commit_count(repo)
    topics = repo.get("topics")
    return {
        "id": repo.get("id", 0),
        "name": repo.get("name", ""),
        "full_name": repo.get("full_name", ""),
        "html_url": repo.get("html_url", ""),
        "description": repo.get("description"),
        "language": repo.get("language"),
        "topics": topics if isinstance(topics, list) else [],
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


def build_project_cards_payload(settings: Settings = SETTINGS) -> JsonObject:
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


def write_project_cards_payload(payload: JsonObject, output: Path) -> None:
    """Write a project-card payload to its configured JSON path."""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        f"{json.dumps(payload, indent=2, ensure_ascii=False)}\n",
        encoding="utf-8",
    )


def main(settings: Settings = SETTINGS) -> int:
    """Fetch, rank, and write the website project cards."""
    print(f"Fetching project cards for @{settings.owner}")
    project_payload = build_project_cards_payload(settings)
    write_project_cards_payload(project_payload, settings.projects_output)
    print(f"Wrote {settings.projects_output}")
    print(f"Project cards: {len(project_payload['project_cards'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
