"""Focused tests for the GitHub project-card generator."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import fetch_github_data as mod
import requests


def sample_repo(**overrides: object) -> dict[str, object]:
    """Return a complete repository fixture with optional overrides."""
    repo: dict[str, object] = {
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
    repo.update(overrides)
    return repo


def test_client_get_returns_decoded_json() -> None:
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"login": "testuser"}

    with patch("requests.get", return_value=response):
        result = mod.GitHubClient().get("/users/test")

    assert result == {"login": "testuser"}


def test_client_get_returns_none_for_request_failure() -> None:
    with patch("requests.get", side_effect=requests.RequestException("network error")):
        result = mod.GitHubClient().get("/users/test")

    assert result is None


def test_normalize_orgs_deduplicates_and_removes_paths() -> None:
    assert mod.normalize_orgs([" SlashNephy/tools ", "SlashNephy", "", "Other/"]) == [
        "SlashNephy",
        "Other",
    ]


def test_collect_project_repos_includes_public_and_configured_orgs() -> None:
    user_repo = sample_repo()
    public_org_repo = sample_repo(id=2, name="public", full_name="public/public")
    configured_org_repo = sample_repo(id=3, name="configured", full_name="configured/tool")

    def pages_side_effect(path: str, **_kwargs: object) -> list[dict[str, object]]:
        responses: dict[str, list[dict[str, object]]] = {
            "/users/user/orgs": [{"login": "public"}],
            "/users/user/repos": [user_repo],
            "/orgs/public/repos": [public_org_repo],
            "/orgs/configured/repos": [configured_org_repo],
        }
        return responses.get(path, [])

    with patch.object(mod.CLIENT, "pages", side_effect=pages_side_effect):
        repos = mod.collect_project_repos("user", ["configured"])

    assert {repo["full_name"] for repo in repos} == {
        "user/agent-tool",
        "public/public",
        "configured/tool",
    }


def test_last_page_from_link_header() -> None:
    header = (
        '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", '
        '<https://api.github.com/repositories/1/commits?per_page=1&page=42>; rel="last"'
    )

    assert mod.last_page_from_link_header(header) == 42


def test_format_project_card_preserves_schema_and_ranking_data() -> None:
    with patch.object(mod, "fetch_repo_commit_count", return_value=12):
        card = mod.format_project_card(sample_repo())

    assert card["full_name"] == "user/agent-tool"
    assert card["topics"] == ["ai", "agent"]
    assert card["commit_count"] == 12
    assert card["rank_score"] > 0


def test_build_project_cards_payload_sorts_by_rank() -> None:
    settings = mod.Settings(
        owner="user",
        token="",
        orgs=(),
        projects_output=Path("public/github-projects.json"),
    )
    low = sample_repo(id=1, name="low", full_name="user/low")
    high = sample_repo(id=2, name="high", full_name="user/high")

    def format_side_effect(repo: dict[str, object]) -> dict[str, object]:
        score = 10 if repo["name"] == "high" else 1
        return {**repo, "rank_score": score, "commit_count": 0}

    with (
        patch.object(mod, "project_orgs", return_value=[]),
        patch.object(mod, "collect_project_repos", return_value=[low, high]),
        patch.object(mod, "format_project_card", side_effect=format_side_effect),
    ):
        payload = mod.build_project_cards_payload(settings)

    cards = payload["project_cards"]
    assert isinstance(cards, list)
    assert [card["full_name"] for card in cards] == ["user/high", "user/low"]


def test_main_writes_only_configured_project_payload(tmp_path: Path) -> None:
    output = tmp_path / "projects.json"
    settings = mod.Settings(owner="user", token="", orgs=(), projects_output=output)
    payload = {
        "schema_version": 1,
        "owner": "user",
        "included_orgs": [],
        "project_cards": [],
        "generated_at": "2026-07-10T00:00:00+00:00",
    }

    with patch.object(mod, "build_project_cards_payload", return_value=payload):
        result = mod.main(settings)

    assert result == 0
    assert json.loads(output.read_text(encoding="utf-8")) == payload


def test_legacy_activity_payload_configuration_is_absent() -> None:
    source = Path("scripts/fetch-github-data.py").read_text(encoding="utf-8")
    assert "GITHUB_DATA_PATH" not in source
    assert "README_ACTIVITY_DAYS" not in source
    assert "collect_commits" not in source
    assert "build_payload" not in source
