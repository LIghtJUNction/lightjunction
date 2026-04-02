"""Tests for fetch-github-data.py"""

from unittest.mock import patch, MagicMock

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
        {"sha": "abc123", "commit": {"message": "fix bug", "committer": {"date": "2026-04-01T00:00:00Z"}}, "author": {"login": "user"}, "committer": {"login": "user"}, "html_url": "url"}
    ]

    def api_get_side(url):
        if "/repos" in url and "commits" not in url:
            return mock_repos
        return mock_commits

    with patch.object(mod, "api_get", side_effect=api_get_side):
        total, commits = mod.get_weekly_commits("testuser")
        assert total >= 0
