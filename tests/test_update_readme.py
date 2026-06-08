"""Tests for update-readme.py"""

import json
from pathlib import Path

import update_readme as mod


def test_get_account_age_valid():
    created, years, months = mod.get_account_age("2022-06-06T00:00:00Z")
    assert created == "2022-06-06"
    assert years >= 3
    assert months >= 0


def test_get_account_age_empty():
    created, years, months = mod.get_account_age("")
    assert created == "Unknown"
    assert years == 0


def test_get_account_age_invalid():
    created, years, months = mod.get_account_age("not-a-date")
    assert created == "not-a-date"
    assert years == 0


def test_replace_section_success(tmp_path):
    readme = tmp_path / "README.md"
    readme.write_text("<!-- START_FOO -->\nold content\n<!-- END_FOO -->\nrest of file")

    result = mod.replace_section(readme, "<!-- START_FOO -->", "<!-- END_FOO -->", "new content")

    assert result is True
    text = readme.read_text()
    assert "new content" in text
    assert "old content" not in text
    assert "rest of file" in text


def test_replace_section_no_match(tmp_path):
    readme = tmp_path / "README.md"
    readme.write_text("no markers here")

    result = mod.replace_section(readme, "<!-- START_FOO -->", "<!-- END_FOO -->", "new content")

    assert result is False


def test_replace_section_empty_content(tmp_path):
    readme = tmp_path / "README.md"
    readme.write_text("<!-- START_FOO -->\nold\n<!-- END_FOO -->")

    result = mod.replace_section(readme, "<!-- START_FOO -->", "<!-- END_FOO -->", "")

    assert result is True
    assert "old" not in readme.read_text()


def test_has_section_detects_valid_marker_pair(tmp_path):
    readme = tmp_path / "README.md"
    readme.write_text("before\n<!-- START -->\nbody\n<!-- END -->\nafter")

    assert mod.has_section(readme, "<!-- START -->", "<!-- END -->") is True


def test_has_section_rejects_missing_or_reversed_markers(tmp_path):
    readme = tmp_path / "README.md"
    readme.write_text("<!-- END -->\nbody\n<!-- START -->")

    assert mod.has_section(readme, "<!-- START -->", "<!-- END -->") is False


def test_format_stats():
    data = {
        "user_stats": {
            "created_at": "2022-06-06T00:00:00Z",
            "public_repos": 42,
            "followers": 10,
            "following": 20,
        }
    }
    stats = mod.format_stats(data)
    assert "**42**" in stats
    assert "**10**" in stats
    assert "**20**" in stats
    assert "Joined" in stats


def test_format_weekly_no_commits():
    data = {"weekly": (0, [])}
    ai = {}
    weekly = mod.format_weekly(data, ai)
    assert "No commits" in weekly or "Rest time" in weekly


def test_format_weekly_with_commits():
    data = {
        "weekly": (
            5,
            [
                (
                    "owner/repo",
                    {
                        "count": 5,
                        "url": "https://github.com/owner/repo",
                        "description": "A test repo",
                        "language": "Python",
                    },
                )
            ],
        )
    }
    ai = {"commit_insights": ""}
    weekly = mod.format_weekly(data, ai)
    assert "5" in weekly
    assert "owner/repo" in weekly


def test_format_commits_empty():
    commits = mod.format_commits({"commits": []})
    assert "No recent commits" in commits


def test_format_commits_valid():
    data = {
        "commits": [
            {
                "repo": "owner/repo",
                "sha": "abc1234",
                "message": "fix: resolve issue",
                "url": "https://github.com/owner/repo/commit/abc1234",
                "date": "2026-04-01T12:00:00Z",
            }
        ]
    }
    commits = mod.format_commits(data)
    assert "abc1234" in commits
    assert "fix: resolve issue" in commits
    assert "<details>" in commits
    assert "<details open>" not in commits


def test_format_repos_empty():
    result = mod.format_repos({"repos": []}, {})
    assert "No repositories" in result


def test_format_repos_valid():
    data = {
        "repos": [
            {
                "name": "test-repo",
                "html_url": "https://github.com/user/test-repo",
                "description": "A test",
                "stargazers_count": 10,
                "forks_count": 2,
                "language": "Python",
                "updated_at": "2026-04-01T00:00:00Z",
            }
        ]
    }
    result = mod.format_repos(data, {})
    assert "test-repo" in result
    assert "10" in result
    assert "<details>" in result
    assert "recently updated repositories" in result


def test_format_repo_card_escapes_html_and_markdown():
    result = mod.format_repo_card(
        {
            "name": "tool|kit<script>",
            "html_url": "https://example.com?a=1&b=2",
            "description": "A <sharp> repo",
            "stargazers_count": 3,
            "forks_count": 1,
            "language": "TypeScript",
            "updated_at": "2026-04-01T00:00:00Z",
        }
    )

    assert "tool\\|kit&lt;script&gt;" in result
    assert "https://example.com?a=1&amp;b=2" in result
    assert "A &lt;sharp&gt; repo" in result
    assert "<sub>TS</sub>" in result


def test_format_repos_keeps_even_table_when_count_is_odd():
    data = {
        "repos": [
            {
                "name": "solo",
                "html_url": "https://github.com/user/solo",
                "description": None,
                "stargazers_count": 0,
                "forks_count": 0,
                "language": None,
                "updated_at": "2026-04-01T00:00:00Z",
            },
            {
                "name": "pair",
                "html_url": "https://github.com/user/pair",
                "description": None,
                "stargazers_count": 0,
                "forks_count": 0,
                "language": None,
                "updated_at": "2026-04-01T00:00:00Z",
            },
            {
                "name": "odd",
                "html_url": "https://github.com/user/odd",
                "description": None,
                "stargazers_count": 0,
                "forks_count": 0,
                "language": None,
                "updated_at": "2026-04-01T00:00:00Z",
            },
        ]
    }

    result = mod.format_repos(data, {})

    assert result.count("<tr>") == 2
    assert "<td></td>" in result


def test_format_skyline_missing():
    result = mod.format_skyline()
    assert result == ""


def test_format_skyline_exists(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "skyline.txt").write_text("  ___\n /   \\")

    result = mod.format_skyline()
    assert "Skyline" in result
    assert "___" in result
    assert "<details>" in result
    assert "Contribution skyline" in result


def test_main_missing_data(tmp_path, monkeypatch, capfd):
    monkeypatch.chdir(tmp_path)
    result = mod.main()
    assert result == 1
    # stdout should contain the error message
    out, _ = capfd.readouterr()
    assert "ERROR" in out or "github_data.json" in out


def test_main_fails_when_required_readme_marker_is_missing(tmp_path, monkeypatch, capfd):
    monkeypatch.chdir(tmp_path)
    Path("README.md").write_text(
        "\n\n".join(
            [
                "<!-- START_DYNAMIC_SUMMARY -->\nold\n<!-- END_DYNAMIC_SUMMARY -->",
                "<!-- START_DYNAMIC_SKYLINE -->\nold\n<!-- END_DYNAMIC_SKYLINE -->",
                "<!-- START_DYNAMIC_REPO_LIST -->\nold\n<!-- END_DYNAMIC_REPO_LIST -->",
                "<!-- START_DYNAMIC_COMMITS -->\nold\n<!-- END_DYNAMIC_COMMITS -->",
            ]
        )
    )
    Path("github_data.json").write_text(
        json.dumps(
            {
                "user_stats": {},
                "weekly": [0, []],
                "repos": [],
                "commits": [],
            }
        )
    )

    result = mod.main()

    out, _ = capfd.readouterr()
    assert result == 1
    assert "Missing README dynamic section markers: stats" in out
    assert Path("github_data.json").exists()
