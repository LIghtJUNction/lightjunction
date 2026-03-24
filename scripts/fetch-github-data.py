#!/usr/bin/env python3
"""
fetch-github-data.py - Fetch GitHub data for README update
"""

import json
import os
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO_OWNER = os.environ.get("GITHUB_REPOSITORY_OWNER", "LIghtJUNction")

HEADERS = {"Accept": "application/vnd.github.v3+json"}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"


def api_get(url: str) -> dict | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def get_user_stats(username: str) -> dict:
    data = api_get(f"https://api.github.com/users/{username}")
    if not data:
        return {}
    return {
        "public_repos": data.get("public_repos", 0),
        "followers": data.get("followers", 0),
        "following": data.get("following", 0),
        "created_at": data.get("created_at", ""),
        "name": data.get("name", ""),
        "bio": data.get("bio", ""),
    }


def get_recent_repos(username: str, count: int = 6) -> list:
    repos = api_get(
        f"https://api.github.com/users/{username}/repos"
        f"?sort=updated&direction=desc&per_page={count}"
    )
    return (repos or [])[:count]


def get_recent_commits(username: str, days: int = 7) -> list:
    repos = api_get(
        f"https://api.github.com/users/{username}/repos"
        "?sort=updated&direction=desc&per_page=10"
    )
    if not repos:
        return []

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    commits = []

    for repo in repos[:10]:
        url = (
            f"https://api.github.com/repos/{username}/{repo['name']}/commits"
            f"?author={username}&since={since}&per_page=20"
        )
        data = api_get(url)
        if not data:
            continue
        for c in data:
            commits.append({
                "repo": repo["name"],
                "repo_url": repo["html_url"],
                "message": c["commit"]["message"].split("\n")[0],
                "sha": c["sha"][:7],
                "url": c["html_url"],
                "date": c["commit"]["committer"]["date"],
            })

    commits.sort(key=lambda x: x["date"], reverse=True)
    return commits


def get_weekly_commits(username: str) -> tuple[int, list]:
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    repos = api_get(
        f"https://api.github.com/users/{username}/repos"
        "?sort=updated&direction=desc&per_page=20"
    )
    if not repos:
        return 0, []

    total = 0
    repo_commits = {}

    for repo in repos[:15]:
        url = (
            f"https://api.github.com/repos/{username}/{repo['name']}/commits"
            f"?author={username}&since={since}&per_page=100"
        )
        data = api_get(url)
        if data:
            total += len(data)
            repo_commits[repo["name"]] = {
                "count": len(data),
                "url": repo["html_url"],
                "description": repo.get("description", ""),
                "language": repo.get("language", ""),
            }

    sorted_commits = sorted(repo_commits.items(), key=lambda x: x[1]["count"], reverse=True)
    return total, sorted_commits


def main():
    print(f"📦 Fetching data for @{REPO_OWNER}...")

    data = {
        "user_stats": get_user_stats(REPO_OWNER),
        "repos": get_recent_repos(REPO_OWNER),
        "commits": get_recent_commits(REPO_OWNER),
        "weekly": get_weekly_commits(REPO_OWNER),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    output_path = Path("github_data.json")
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"✅ Data saved to {output_path}")
    print(f"   - Repos: {len(data['repos'])}")
    print(f"   - Commits (7 days): {len(data['commits'])}")
    print(f"   - Weekly total: {data['weekly'][0]}")


if __name__ == "__main__":
    main()
