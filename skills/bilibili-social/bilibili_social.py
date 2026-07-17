#!/usr/bin/env python3
"""Small Bilibili social CLI for cookie-backed assistant runs.

This script intentionally never prints the cookie. Load credentials from
`BILIBILI_COOKIE` or a local `.env` file containing `BILIBILI_COOKIE='...'`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from http.cookies import SimpleCookie
from pathlib import Path
from typing import Any
from urllib import error, parse, request

API = "https://api.bilibili.com"
VC_API = "https://api.vc.bilibili.com"


class BilibiliError(RuntimeError):
    """Raised for safe, user-facing Bilibili API failures."""


def load_env(path: str | None) -> None:
    env_path = Path(path or ".env")
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def cookie_parts() -> tuple[str, SimpleCookie[str]]:
    cookie = os.environ.get("BILIBILI_COOKIE")
    if not cookie:
        raise SystemExit("BILIBILI_COOKIE is missing. Put it in local .env or environment.")
    jar: SimpleCookie[str] = SimpleCookie(cookie)
    return cookie, jar


def headers(referer: str = "https://www.bilibili.com/") -> dict[str, str]:
    cookie, _ = cookie_parts()
    return {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0",
        "Referer": referer,
    }


def csrf_token() -> str:
    _, jar = cookie_parts()
    if "bili_jct" not in jar:
        raise SystemExit("bili_jct is missing from BILIBILI_COOKIE; cannot perform write action.")
    return jar["bili_jct"].value


def cookie_value(name: str) -> str | None:
    _, jar = cookie_parts()
    if name not in jar:
        return None
    return jar[name].value


def decode_json_response(response: Any, url: str) -> dict[str, Any]:
    """Decode and validate one JSON object response."""
    try:
        data = json.load(response)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise BilibiliError(f"invalid JSON response from {url}: {exc}") from exc
    if not isinstance(data, dict):
        raise BilibiliError(f"unexpected JSON response from {url}")
    return data


def request_failure(exc: BaseException, url: str) -> BilibiliError:
    """Convert network exceptions without exposing cookie-bearing headers."""
    if isinstance(exc, error.HTTPError):
        body = exc.read().decode("utf-8", errors="replace")[:500]
        return BilibiliError(
            json.dumps({"http_error": exc.code, "url": url, "body": body}, ensure_ascii=False)
        )
    return BilibiliError(f"network request failed for {url}: {exc}")


def get_json(url: str) -> dict[str, Any]:
    req = request.Request(url, headers=headers())
    try:
        with request.urlopen(req, timeout=20) as response:
            return decode_json_response(response, url)
    except (error.URLError, TimeoutError) as exc:
        raise request_failure(exc, url) from exc


def post_json(
    url: str,
    data: dict[str, str],
    referer: str = "https://www.bilibili.com/",
) -> dict[str, Any]:
    body = parse.urlencode(data).encode()
    post_headers = headers(referer)
    post_headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = request.Request(url, data=body, headers=post_headers, method="POST")
    try:
        with request.urlopen(req, timeout=20) as response:
            return decode_json_response(response, url)
    except (error.URLError, TimeoutError) as exc:
        raise request_failure(exc, url) from exc


def require_confirm(args: argparse.Namespace, action: str) -> None:
    """Require explicit confirmation before a network write."""
    if not getattr(args, "confirm", False):
        raise BilibiliError(f"{action} is a write action; re-run with --confirm")


def require_api_success(data: dict[str, Any], action: str) -> None:
    """Fail when Bilibili reports a non-zero API code."""
    if data.get("code") != 0:
        message = data.get("message") or "unknown API error"
        raise BilibiliError(f"{action} failed: code={data.get('code')} message={message}")


def resolve_aid(args: argparse.Namespace) -> int:
    if getattr(args, "aid", None):
        return int(args.aid)
    bvid = getattr(args, "bvid", None)
    if not bvid:
        raise SystemExit("Provide --aid or --bvid.")
    data = get_json(f"{API}/x/web-interface/view?{parse.urlencode({'bvid': bvid})}")
    if data.get("code") != 0:
        raise SystemExit(json.dumps(data, ensure_ascii=False))
    return int(data["data"]["aid"])


def cmd_nav(_: argparse.Namespace) -> dict[str, Any]:
    data = get_json(f"{API}/x/web-interface/nav")
    nav = data.get("data") or {}
    return {
        "code": data.get("code"),
        "message": data.get("message"),
        "isLogin": nav.get("isLogin"),
        "uname": nav.get("uname"),
        "mid": nav.get("mid"),
    }


def cmd_hot(_: argparse.Namespace) -> dict[str, Any]:
    data = get_json("https://s.search.bilibili.com/main/hotword")
    items = data.get("list") or data.get("data", {}).get("list") or []
    return {
        "items": [
            {
                "rank": i,
                "keyword": item.get("keyword") or item.get("show_name") or item.get("name"),
                "raw_type": item.get("value") or item.get("word_type"),
            }
            for i, item in enumerate(items, 1)
        ]
    }


def cmd_popular(args: argparse.Namespace) -> dict[str, Any]:
    query = parse.urlencode({"ps": args.limit, "pn": args.page})
    data = get_json(f"{API}/x/web-interface/popular?{query}")
    videos = data.get("data", {}).get("list") or []
    return {
        "code": data.get("code"),
        "videos": [
            {
                "title": video.get("title"),
                "bvid": video.get("bvid"),
                "aid": video.get("aid"),
                "owner": (video.get("owner") or {}).get("name"),
                "url": video.get("short_link_v2") or video.get("short_link"),
            }
            for video in videos[: args.limit]
        ],
    }


def cmd_comments(args: argparse.Namespace) -> dict[str, Any]:
    aid = resolve_aid(args)
    query = parse.urlencode({"type": 1, "oid": aid, "mode": 3, "next": args.page, "ps": args.limit})
    data = get_json(f"{API}/x/v2/reply/main?{query}")
    replies = (data.get("data") or {}).get("replies") or []
    return {
        "code": data.get("code"),
        "message": data.get("message"),
        "aid": aid,
        "comments": [
            {
                "rpid": reply.get("rpid"),
                "user": (reply.get("member") or {}).get("uname"),
                "likes": reply.get("like"),
                "message": (reply.get("content") or {}).get("message"),
            }
            for reply in replies[: args.limit]
        ],
    }


def cmd_comment(args: argparse.Namespace) -> dict[str, Any]:
    require_confirm(args, "comment")
    aid = resolve_aid(args)
    form = {
        "type": "1",
        "oid": str(aid),
        "message": args.text,
        "csrf": csrf_token(),
    }
    if args.root:
        form["root"] = str(args.root)
        form["parent"] = str(args.parent or args.root)
    data = post_json(
        f"{API}/x/v2/reply/add", form, referer=args.referer or "https://www.bilibili.com/"
    )
    require_api_success(data, "comment")
    reply = (data.get("data") or {}).get("reply") or {}
    return {
        "code": data.get("code"),
        "message": data.get("message"),
        "rpid": reply.get("rpid"),
        "ctime": reply.get("ctime"),
        "posted_message": (reply.get("content") or {}).get("message"),
    }


def cmd_sessions(args: argparse.Namespace) -> dict[str, Any]:
    query = parse.urlencode(
        {
            "session_type": 1,
            "group_fold": 1,
            "unfollow_fold": 0,
            "sort_rule": 2,
            "size": args.limit,
        }
    )
    data = get_json(f"{VC_API}/session_svr/v1/session_svr/get_sessions?{query}")
    sessions = (data.get("data") or {}).get("session_list") or []
    return {
        "code": data.get("code"),
        "sessions": [
            {
                "talker_id": session.get("talker_id"),
                "session_type": session.get("session_type"),
                "unread_count": session.get("unread_count"),
                "timestamp": session.get("session_ts"),
                "last_msg": session.get("last_msg", {}).get("content"),
            }
            for session in sessions[: args.limit]
        ],
    }


def cmd_messages(args: argparse.Namespace) -> dict[str, Any]:
    query = parse.urlencode(
        {
            "talker_id": args.talker_id,
            "session_type": 1,
            "size": args.limit,
            "begin_seqno": args.begin_seqno,
        }
    )
    data = get_json(f"{VC_API}/svr_sync/v1/svr_sync/fetch_session_msgs?{query}")
    messages = (data.get("data") or {}).get("messages") or []
    return {
        "code": data.get("code"),
        "messages": [
            {
                "sender_uid": message.get("sender_uid"),
                "receiver_id": message.get("receiver_id"),
                "timestamp": message.get("timestamp"),
                "msg_type": message.get("msg_type"),
                "content": message.get("content"),
            }
            for message in messages[: args.limit]
        ],
    }


def cmd_send_dm(args: argparse.Namespace) -> dict[str, Any]:
    require_confirm(args, "send-dm")
    sender_uid = cookie_value("DedeUserID")
    if not sender_uid:
        raise SystemExit("DedeUserID is missing from BILIBILI_COOKIE; cannot send DM.")
    now = str(int(time.time()))
    token = csrf_token()
    form = {
        "msg[sender_uid]": sender_uid,
        "msg[receiver_id]": str(args.receiver_id),
        "msg[receiver_type]": "1",
        "msg[msg_type]": "1",
        "msg[msg_status]": "0",
        "msg[content]": json.dumps({"content": args.text}, ensure_ascii=False),
        "msg[timestamp]": now,
        "msg[dev_id]": args.dev_id or str(uuid.uuid4()),
        "csrf": token,
        "csrf_token": token,
    }
    data = post_json(f"{VC_API}/web_im/v1/web_im/send_msg", form)
    require_api_success(data, "send-dm")
    return {"code": data.get("code"), "message": data.get("message"), "data": data.get("data")}


def cmd_dynamic(args: argparse.Namespace) -> dict[str, Any]:
    require_confirm(args, "dynamic")
    token = csrf_token()
    uid = cookie_value("DedeUserID")
    if not uid:
        raise SystemExit("DedeUserID is missing from BILIBILI_COOKIE; cannot post dynamic.")
    form = {
        "uid": uid,
        "type": "4",
        "rid": "0",
        "content": args.text,
        "extension": json.dumps({"emoji_type": 1}, ensure_ascii=False, separators=(",", ":")),
        "at_uids": "",
        "ctrl": "[]",
        "csrf_token": token,
        "csrf": token,
    }
    data = post_json(
        f"{VC_API}/dynamic_svr/v1/dynamic_svr/create",
        form,
        referer="https://t.bilibili.com/",
    )
    require_api_success(data, "dynamic")
    result = {"code": data.get("code"), "message": data.get("message"), "data": data.get("data")}
    dyn_id = (data.get("data") or {}).get("dynamic_id_str") or (data.get("data") or {}).get(
        "dynamic_id"
    )
    if dyn_id:
        result["url"] = f"https://t.bilibili.com/{dyn_id}"
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bilibili social helper CLI")
    parser.add_argument("--env", default=".env", help="Path to local .env file")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("nav", help="Check current login state").set_defaults(func=cmd_nav)
    sub.add_parser("hot", help="Read hot search keywords").set_defaults(func=cmd_hot)

    popular = sub.add_parser("popular", help="Read popular videos")
    popular.add_argument("--limit", type=int, default=10)
    popular.add_argument("--page", type=int, default=1)
    popular.set_defaults(func=cmd_popular)

    comments = sub.add_parser("comments", help="Read video comments")
    comments.add_argument("--aid")
    comments.add_argument("--bvid")
    comments.add_argument("--limit", type=int, default=10)
    comments.add_argument("--page", type=int, default=0)
    comments.set_defaults(func=cmd_comments)

    comment = sub.add_parser("comment", help="Post a video comment or reply")
    comment.add_argument("--aid")
    comment.add_argument("--bvid")
    comment.add_argument("--text", required=True)
    comment.add_argument("--root", help="Root rpid when replying")
    comment.add_argument("--parent", help="Parent rpid when replying; defaults to root")
    comment.add_argument("--referer")
    comment.add_argument("--confirm", action="store_true", help="Confirm the external write")
    comment.set_defaults(func=cmd_comment)

    sessions = sub.add_parser("sessions", help="Read private-message sessions")
    sessions.add_argument("--limit", type=int, default=10)
    sessions.set_defaults(func=cmd_sessions)

    messages = sub.add_parser("messages", help="Read messages from one DM session")
    messages.add_argument("--talker-id", required=True)
    messages.add_argument("--limit", type=int, default=20)
    messages.add_argument("--begin-seqno", default="0")
    messages.set_defaults(func=cmd_messages)

    dm = sub.add_parser("send-dm", help="Send a text DM")
    dm.add_argument("--receiver-id", required=True)
    dm.add_argument("--text", required=True)
    dm.add_argument("--dev-id")
    dm.add_argument("--confirm", action="store_true", help="Confirm the external write")
    dm.set_defaults(func=cmd_send_dm)

    dynamic = sub.add_parser("dynamic", help="Post a pure text dynamic")
    dynamic.add_argument("--text", required=True)
    dynamic.add_argument("--confirm", action="store_true", help="Confirm the external write")
    dynamic.set_defaults(func=cmd_dynamic)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    load_env(args.env)
    try:
        result = args.func(args)
    except BilibiliError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
