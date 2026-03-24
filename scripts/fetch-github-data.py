#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests>=2.32.0",
# ]
# ///
"""
fetch-github-data.py - Fetch GitHub data for README update
Includes both personal and team/org repository commits
"""

import json
import os
import requests
from datetime import datetime, timedelta, timezone

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO_OWNER = os.environ.get("GITHUB_REPOSITORY_OWNER", "LIghtJUNction")
# Comma-separated list of org/repo to include (e.g., "SlashNephy/AstrBot,other/org")
TEAM_ORGS = os.environ.get("TEAM_ORGS", "").split(",") if os.environ.get("TEAM_ORGS") else []

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


def get_org_repos(org: str, count: int = 10) -> list:
    """Fetch repositories for an organization."""
    repos = api_get(
        f"https://api.github.com/orgs/{org}/repos"
        f"?sort=updated&direction=desc&per_page={count}"
    )
    return (repos or [])[:count]


def get_recent_commits(username: str, days: int = 7, orgs: list[str] = None) -> list:
    """Fetch recent commits from user repos AND org repos."""
    repos = api_get(
        f"https://api.github.com/users/{username}/repos"
        "?sort=updated&direction=desc&per_page=10"
    ) or []

    # Add org repos
    if orgs:
        for org in orgs:
            if org and "/" in org:
                org_repos = get_org_repos(org.split("/")[0])
                repos.extend(org_repos)

    if not repos:
        return []

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    commits = []

    # Deduplicate repos by full name
    seen = set()
    unique_repos = []
    for repo in repos:
        full_name = repo.get("full_name", "")
        if full_name and full_name not in seen:
            seen.add(full_name)
            unique_repos.append(repo)
    repos = unique_repos[:15]

    for repo in repos:
        full_name = repo["full_name"]
        # Use all commits author filter for personal repos, but use actor for org activity
        url = (
            f"https://api.github.com/repos/{full_name}/commits"
            f"?author={username}&since={since}&per_page=20"
        )
        data = api_get(url)
        if not data:
            # Try without author filter for org repos (might be committer different from author)
            url = (
                f"https://api.github.com/repos/{full_name}/commits"
                f"?since={since}&per_page=20"
            )
            data = api_get(url)
            if data:
                # Filter to only commits by our user
                data = [c for c in data if c.get("author", {}).get("login", "").lower() == username.lower()
                       or c.get("committer", {}).get("login", "").lower() == username.lower()]
        if data:
            for c in data:
                commits.append({
                    "repo": full_name,
                    "repo_url": repo["html_url"],
                    "message": c["commit"]["message"].split("\n")[0],
                    "sha": c["sha"][:7],
                    "url": c["html_url"],
                    "date": c["commit"]["committer"]["date"],
                })

    commits.sort(key=lambda x: x["date"], reverse=True)
    return commits


def get_weekly_commits(username: str, orgs: list[str] = None) -> tuple[int, list]:
    """Get weekly commits from user and org repos."""
    repos = api_get(
        f"https://api.github.com/users/{username}/repos"
        "?sort=updated&direction=desc&per_page=20"
    ) or []

    # Add org repos
    if orgs:
        for org in orgs:
            if org and "/" in org:
                org_repos = get_org_repos(org.split("/")[0])
                repos.extend(org_repos)

    if not repos:
        return 0, []

    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    total = 0
    repo_commits = {}

    # Deduplicate
    seen = set()
    unique_repos = []
    for repo in repos:
        full_name = repo.get("full_name", "")
        if full_name and full_name not in seen:
            seen.add(full_name)
            unique_repos.append(repo)
    repos = unique_repos[:20]

    for repo in repos:
        full_name = repo["full_name"]
        url = (
            f"https://api.github.com/repos/{full_name}/commits"
            f"?author={username}&since={since}&per_page=100"
        )
        data = api_get(url)
        if data:
            total += len(data)
            if full_name in repo_commits:
                repo_commits[full_name]["count"] += len(data)
            else:
                repo_commits[full_name] = {
                    "count": len(data),
                    "url": repo["html_url"],
                    "description": repo.get("description", ""),
                    "language": repo.get("language", ""),
                }

    sorted_commits = sorted(repo_commits.items(), key=lambda x: x[1]["count"], reverse=True)
    return total, sorted_commits


def main():
    print(f"📦 Fetching data for @{REPO_OWNER}...")
    if TEAM_ORGS:
        print(f"   📂 Including orgs: {', '.join(TEAM_ORGS)}")

    data = {
        "user_stats": get_user_stats(REPO_OWNER),
        "repos": get_recent_repos(REPO_OWNER),
        "commits": get_recent_commits(REPO_OWNER, orgs=TEAM_ORGS),
        "weekly": get_weekly_commits(REPO_OWNER, orgs=TEAM_ORGS),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    output_path = "github_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✅ Data saved to {output_path}")
    print(f"   - Repos: {len(data['repos'])}")
    print(f"   - Commits (7 days): {len(data['commits'])}")
    print(f"   - Weekly total: {data['weekly'][0]}")


if __name__ == "__main__":
    main()
