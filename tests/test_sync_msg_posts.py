"""Protect README content against failed or unexpected public MSG responses."""

import pytest
import sync_msg_posts as mod


def test_remote_title_is_content_and_update_is_idempotent() -> None:
    profile = (
        "# @lightjunction\n\n## Latest posts\n\n"
        "- [![image](url) <script>](/*" + "a" * 32 + ") — 2026-10-02 01:48\n"
        "\n## Resources\n"
    )
    posts = mod.render_posts(profile)
    assert "<script>" not in posts
    assert r"\!\[image\]\(url\)" in posts
    original = f"intro\n{mod.START}\nold\n{mod.END}\noutro\n"
    updated = mod.update_readme(original, posts)
    assert updated.startswith("intro\n")
    assert updated.endswith("\noutro\n")
    assert mod.update_readme(updated, posts) == updated


@pytest.mark.parametrize(
    "profile",
    ["<html>service unavailable</html>", "# @root\n", "# @lightjunction\n"],
)
def test_unexpected_responses_are_rejected(profile: str) -> None:
    with pytest.raises(ValueError):
        mod.render_posts(profile)


def test_empty_profile_is_distinct_from_broken_post_format() -> None:
    prefix = "# @lightjunction\n\n## Latest posts\n\n"
    assert mod.render_posts(prefix + "No visible posts yet.\n") == "No public posts yet."
    with pytest.raises(ValueError):
        mod.render_posts(prefix + "- [Changed format](/unknown)\n")


@pytest.mark.parametrize(
    "readme",
    ["no markers", f"{mod.END}\n{mod.START}", f"{mod.START}{mod.START}{mod.END}"],
)
def test_bad_markers_are_rejected(readme: str) -> None:
    with pytest.raises(ValueError):
        mod.update_readme(readme, "posts")
