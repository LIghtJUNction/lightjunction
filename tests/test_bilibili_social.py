"""Fully mocked contracts for Bilibili write safety and error handling."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch
from urllib import error

import pytest


def load_module() -> ModuleType:
    """Load the hyphenated Bilibili CLI module without executing its main function."""
    path = Path(__file__).resolve().parents[1] / "skills/bilibili-social/bilibili_social.py"
    spec = importlib.util.spec_from_file_location("bilibili_social", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BILIBILI = load_module()


@pytest.mark.parametrize(
    ("function_name", "arguments"),
    [
        (
            "cmd_comment",
            argparse.Namespace(
                confirm=False,
                aid="1",
                bvid=None,
                text="hello",
                root=None,
                parent=None,
                referer=None,
            ),
        ),
        (
            "cmd_send_dm",
            argparse.Namespace(confirm=False, receiver_id="2", text="hello", dev_id=None),
        ),
        ("cmd_dynamic", argparse.Namespace(confirm=False, text="hello")),
    ],
)
def test_write_commands_require_confirmation_before_credentials_or_network(
    function_name: str,
    arguments: argparse.Namespace,
) -> None:
    credential = MagicMock(side_effect=AssertionError("credentials must not be read"))
    network = MagicMock(side_effect=AssertionError("network must not be called"))

    with (
        patch.object(BILIBILI, "cookie_parts", credential),
        patch.object(BILIBILI, "cookie_value", credential),
        patch.object(BILIBILI, "csrf_token", credential),
        patch.object(BILIBILI, "get_json", network),
        patch.object(BILIBILI, "post_json", network),
        pytest.raises(BILIBILI.BilibiliError, match="--confirm"),
    ):
        getattr(BILIBILI, function_name)(arguments)

    credential.assert_not_called()
    network.assert_not_called()


def test_confirmed_comment_uses_mocked_api_only() -> None:
    arguments = argparse.Namespace(
        confirm=True,
        aid="1",
        bvid=None,
        text="hello",
        root=None,
        parent=None,
        referer=None,
    )
    response = {
        "code": 0,
        "message": "0",
        "data": {"reply": {"rpid": 3, "ctime": 4, "content": {"message": "hello"}}},
    }

    with (
        patch.object(BILIBILI, "csrf_token", return_value="csrf"),
        patch.object(BILIBILI, "post_json", return_value=response) as post,
    ):
        result = BILIBILI.cmd_comment(arguments)

    assert result["posted_message"] == "hello"
    post.assert_called_once()


def test_get_json_converts_network_failure_without_real_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BILIBILI_COOKIE", "bili_jct=test-csrf; DedeUserID=1")
    with (
        patch.object(BILIBILI.request, "urlopen", side_effect=error.URLError("offline")),
        pytest.raises(BILIBILI.BilibiliError, match="network request failed"),
    ):
        BILIBILI.get_json("https://api.bilibili.com/test")


def test_decode_json_response_rejects_invalid_json() -> None:
    response = MagicMock()
    with (
        patch.object(BILIBILI.json, "load", side_effect=json.JSONDecodeError("bad", "x", 0)),
        pytest.raises(BILIBILI.BilibiliError, match="invalid JSON response"),
    ):
        BILIBILI.decode_json_response(response, "https://api.bilibili.com/test")
