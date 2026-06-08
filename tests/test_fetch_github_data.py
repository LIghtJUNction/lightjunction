"""Tests for fetch-github-data.py"""

from unittest.mock import MagicMock, patch

import fetch_github_data as mod


def test_api_get_success():
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"name": "test", "login": "testuser"}
    mock_resp.raise_for_status = MagicMock()

    with patch("requests.get", return_value=mock_resp):
        result = mod.api_get("https://api.github.com/users/test")
        assert result == {"name": "test", "login": "testuser"}


def test_api_get_failure():
    with patch("requests.get", side_effect=Exception("network error")):
        result = mod.api_get("https://api.github.com/users/test")
        assert result is None


def test_get_user_stats():
    mock_data = {
        "public_repos": 10,
        "followers": 5,
        "following": 3,
        "created_at": "2022-06-06T00:00:00Z",
        "name": "Test User",
        "bio": "A test user",
    }

    with patch.object(mod, "api_get", return_value=mock_data):
        result = mod.get_user_stats("testuser")
        assert result["public_repos"] == 10
        assert result["followers"] == 5
        assert result["following"] == 3


def test_get_user_stats_not_found():
    with patch.object(mod, "api_get", return_value=None):
        result = mod.get_user_stats("nonexistent")
        assert result == {}


def test_get_recent_repos():
    mock_repos = [
        {"name": "repo1", "full_name": "user/repo1", "html_url": "url1"},
        {"name": "repo2", "full_name": "user/repo2", "html_url": "url2"},
    ]

    with patch.object(mod, "api_get", return_value=mock_repos):
        result = mod.get_recent_repos("testuser", count=2)
        assert len(result) == 2
        assert result[0]["name"] == "repo1"


def test_get_recent_repos_empty():
    with patch.object(mod, "api_get", return_value=None):
        result = mod.get_recent_repos("testuser")
        assert result == []


def test_get_org_repos():
    mock_repos = [
        {"name": "org-repo", "full_name": "org/repo", "html_url": "url"},
    ]
    with patch.object(mod, "api_get", return_value=mock_repos):
        result = mod.get_org_repos("testorg")
        assert len(result) == 1


def test_get_recent_commits_no_repos():
    with patch.object(mod, "api_get", return_value=None):
        result = mod.get_recent_commits("testuser")
        assert result == []


def test_get_weekly_commits_no_repos():
    with patch.object(mod, "api_get", return_value=None):
        total, commits = mod.get_weekly_commits("testuser")
        assert total == 0
        assert commits == []


def test_get_weekly_commits():
    mock_repos = [
        {
            "full_name": "user/repo",
            "html_url": "https://github.com/user/repo",
            "description": "test",
            "language": "Python",
        }
    ]
    mock_commits = [
        {
            "sha": "abc123",
            "commit": {"message": "fix bug", "committer": {"date": "2026-04-01T00:00:00Z"}},
            "author": {"login": "user"},
            "committer": {"login": "user"},
            "html_url": "url",
        }
    ]

    def api_get_side(url):
        if "/repos" in url and "commits" not in url:
            return mock_repos
        return mock_commits

    with patch.object(mod, "api_get", side_effect=api_get_side):
        total, commits = mod.get_weekly_commits("testuser")
        assert total >= 0


def test_last_page_from_link_header():
    header = (
        '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", '
        '<https://api.github.com/repositories/1/commits?per_page=1&page=42>; rel="last"'
    )

    assert mod.last_page_from_link_header(header) == 42


def test_format_project_card_uses_commit_count_and_rank_score():
    repo = {
        "id": 1,
        "name": "agent-tool",
        "full_name": "user/agent-tool",
        "html_url": "https://github.com/user/agent-tool",
        "description": "AI agent tool",
        "language": "TypeScript",
        "topics": ["ai", "agent"],
        "stargazers_count": 3,
        "forks_count": 1,
        "open_issues_count": 0,
        "default_branch": "main",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-02T00:00:00Z",
        "pushed_at": "2026-01-03T00:00:00Z",
        "archived": False,
        "fork": False,
    }

    with patch.object(mod, "fetch_repo_commit_count", return_value=12):
        card = mod.format_project_card(repo)

    assert card["full_name"] == "user/agent-tool"
    assert card["topics"] == ["ai", "agent"]
    assert card["commit_count"] == 12
    assert card["rank_score"] > 0


def test_build_project_cards_payload_includes_org_repos():
    user_repo = {
        "id": 1,
        "name": "personal-ai",
        "full_name": "user/personal-ai",
        "html_url": "https://github.com/user/personal-ai",
        "description": "AI",
        "language": "Python",
        "topics": [],
        "stargazers_count": 1,
        "forks_count": 0,
        "open_issues_count": 0,
        "default_branch": "main",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "pushed_at": "2026-01-01T00:00:00Z",
        "archived": False,
        "fork": False,
    }
    org_repo = {**user_repo, "id": 2, "full_name": "org/org-ai", "name": "org-ai"}

    def pages_side_effect(path, **kwargs):
        if path == "/users/user/orgs":
            return [{"login": "org"}]
        if path == "/users/user/repos":
            return [user_repo]
        if path == "/orgs/org/repos":
            return [org_repo]
        return []

    settings = mod.Settings(owner="user", token="", orgs=(), output=mod.Path("/tmp/out.json"))

    with (
        patch.object(mod.CLIENT, "pages", side_effect=pages_side_effect),
        patch.object(mod, "fetch_repo_commit_count", return_value=4),
    ):
        payload = mod.build_project_cards_payload(settings)

    names = {repo["full_name"] for repo in payload["project_cards"]}
    assert names == {"user/personal-ai", "org/org-ai"}
    assert payload["included_orgs"] == ["org"]
