"""Offline regression tests for the small Bash helper APIs."""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def bash(script: str, *args: str, stdin: str = "") -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", "-c", script, "bash", *args],
        cwd=ROOT,
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
        env={**os.environ, "LC_ALL": "C.UTF-8"},
    )


@pytest.mark.parametrize("legacy", [False, True])
def test_import_preserves_bytes_stdin_and_cache(legacy: bool) -> None:
    payload = "IMPORTED=ok\nremote_fn() { printf remote; }\n\n"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    result = bash(
        r"""
        set -euo pipefail
        payload="$1"
        curl() { printf '%s' "$payload"; }
        mktemp() { return 99; }
        source basic.sh
        if [[ "$3" == legacy ]]; then
            import fixture.sh main lightjunction lightjunction https://example.invalid "$2"
        else
            import https://example.invalid/fixture.sh "$2"
        fi
        [[ "$IMPORTED" == ok && "$(remote_fn)" == remote ]]
        source basic.sh
        [[ ${#__IMPORTED_FILES[@]} == 1 ]]
        curl() { return 99; }
        if [[ "$3" == legacy ]]; then
            import fixture.sh main lightjunction lightjunction https://example.invalid "$2"
        else
            import https://example.invalid/fixture.sh "$2"
        fi
        IFS= read -r input
        printf '%s' "$input"
        """,
        payload,
        digest,
        "legacy" if legacy else "url",
        stdin="stdin was not consumed\n",
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "stdin was not consumed"


@pytest.mark.parametrize("failure", ["missing", "invalid", "mismatch", "download", "source"])
def test_import_failure_never_caches(failure: str) -> None:
    payload = "printf executed; return 17\n" if failure == "source" else "printf executed\n"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    result = bash(
        r"""
        set -euo pipefail
        payload="$1" digest="$2" failure="$3"
        curl() {
            [[ "$failure" != missing && "$failure" != invalid ]] || return 99
            printf '%s' "$payload"
            [[ "$failure" != download ]] || return 23
        }
        case "$failure" in
            missing) digest='' ;;
            invalid) digest=invalid ;;
            mismatch) digest="$(printf '%064d' 0)" ;;
        esac
        source basic.sh
        if import https://example.invalid/library "$digest"; then exit 98; else status=$?; fi
        [[ ${#__IMPORTED_FILES[@]} == 0 ]]
        printf 'status=%s' "$status" >&2
        """,
        payload,
        digest,
        failure,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == ("executed" if failure == "source" else "")
    expected_status = {"missing": 1, "invalid": 2, "mismatch": 1, "download": 23, "source": 17}
    assert f"status={expected_status[failure]}" in result.stderr


def test_hash_mismatch_does_not_delete_caller_file(tmp_path: Path) -> None:
    target = tmp_path / "input"
    target.write_text("keep", encoding="utf-8")
    result = bash('source basic.sh; verify_sha256 "$1" "$(printf %064d 0)"', str(target))
    assert result.returncode == 1
    assert target.read_text(encoding="utf-8") == "keep"


def test_hook_copies_original_and_rejects_invalid_names() -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        greet() { printf 'hello %s' "$1"; }
        hook 'greet()::wrapper' <<'BODY'
        printf '['
        "$self" "$@"
        printf ']'
BODY
        [[ "$(greet world)" == '[hello world]' ]]
        hook greet <<'BODY'
        "$self" "$@"
BODY
        [[ "$(greet world)" == 'hello world' ]]
        if hook 'bad;name' </dev/null; then exit 98; fi
        """
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    ("library", "expression", "expected", "status"),
    [
        ("arr", "arr_join '::' a '' c", "a::::c", 0),
        ("arr", "arr_join '' a b", "ab", 0),
        ("arr", "arr_join ':'", "", 0),
        ("arr", "arr_contains '' a ''", "", 0),
        ("arr", "arr_sort", "", 0),
        ("arr", "arr_unique", "", 0),
        ("arr", "arr_reverse a '' b", "b\n\na\n", 0),
        ("arr", "arr_sum 0 -2 2 08", "8\n", 0),
        ("arr", "arr_sum", "0\n", 0),
        ("arr", "arr_avg 0 2 -2", "0\n", 0),
        ("arr", "arr_avg", "", 1),
        ("arr", "arr_min 0 -08 3", "-8\n", 0),
        ("arr", "arr_max -3 -2", "-2\n", 0),
        ("arr", "arr_max", "", 1),
        ("arr", "arr_sum '1+2'", "", 2),
        ("arr", "arr_slice 1 2 a b c d", "b\nc\n", 0),
        ("arr", "arr_slice 1 '' a b c", "b\nc\n", 0),
        ("arr", "arr_slice 0 0 a b", "", 0),
        ("arr", "arr_last", "", 1),
        ("arr", "arr_last a ''", "\n", 0),
        ("str", "str_trim '  a b  '", "a b", 0),
        ("str", "str_trim ''", "", 0),
        ("str", "str_split '::' 'a::::c::'", "a\n\nc\n\n", 0),
        ("str", "str_contains '' ''", "", 0),
        ("str", "str_replace 'a*a*' '*' '&'", "a&a*", 0),
        ("str", "str_replace_all 'a*a*' '*' ''", "aa", 0),
        ("str", "str_repeat 'ab' 3", "ababab", 0),
        ("str", "str_repeat x 0", "", 0),
        ("str", "str_pad_left 'a b' 5 '_'", "__a b", 0),
        ("str", "str_pad_right 'a b' 5 '_'", "a b__", 0),
        ("str", "str_pad_left abc 1", "abc", 0),
        ("str", "str_pad_left '' 2 '界'", "界界", 0),
        ("str", "str_length '你好'", "2", 0),
        ("str", "str_length ''", "0", 0),
        ("str", "str_rand 0", "", 0),
        ("str", "str_rand -1", "", 2),
        ("prompt", "NON_INTERACTIVE=1 prompt_choice pick a b", "a\n", 0),
        ("prompt", "NON_INTERACTIVE=1 prompt_choice pick", "", 2),
        ("prompt", "NON_INTERACTIVE=1 prompt_menu pick 'a:one:two'", "one:two\n", 0),
        ("prompt", "NON_INTERACTIVE=1 prompt_input name default", "default\n", 0),
        ("prompt", "NON_INTERACTIVE=1 prompt_password", "", 1),
        ("prompt", "NON_INTERACTIVE=1 prompt_yesno proceed y", "", 0),
        ("prompt", "NON_INTERACTIVE=1 prompt_confirm proceed", "", 1),
        ("prompt", "prompt_progress 1 3; printf alive", "alive", 0),
        ("prompt", "prompt_progress 5 3; printf alive", "alive", 0),
        ("prompt", "prompt_progress 0 0", "", 2),
        ("file", "file_extension /tmp/a.b/README", "", 0),
        ("file", "file_extension /tmp/.profile", "", 0),
        ("file", "file_extension /tmp/a.tar.gz", "gz", 0),
    ],
)
def test_helper_result(library: str, expression: str, expected: str, status: int) -> None:
    result = bash(f"set -euo pipefail; source lib/{library}.sh; {expression}")
    assert result.returncode == status, result.stderr
    assert result.stdout == expected


@pytest.mark.parametrize("operation", ["arr_map", "arr_filter"])
def test_callback_errors_propagate(operation: str) -> None:
    result = bash(
        f"set -euo pipefail; source lib/arr.sh; fail() {{ return 23; }}; {operation} fail a b"
    )
    assert result.returncode == 23, result.stderr


def test_env_and_logging_do_not_change_caller_options_or_messages() -> None:
    result = bash(
        r"""
        set +e +u
        set +o pipefail
        before="$-:$SHELLOPTS:$LC_ALL"
        NO_COLOR=true source env.sh
        [[ "$before" == "$-:$SHELLOPTS:$LC_ALL" ]] || exit 98
        [[ -z "$C_UP$C_RED$C_CLEAR_LINE" ]] || exit 97
        set -euo pipefail
        source log.sh
        LOG_LEVEL=0
        err hidden; warn hidden; ok hidden; info hidden; debug hidden
        LOG_LEVEL=3 info 'literal\n%s' words
        """
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == ""
    assert result.stderr.endswith("literal\\n%s words\n")
    assert "hidden" not in result.stderr
    assert "\x1b" not in result.stderr


def test_review_needs_confirmation_and_forwards_arguments(tmp_path: Path) -> None:
    script = tmp_path / "reviewed.sh"
    script.write_text('printf "%s" "$1"\n', encoding="utf-8")
    denied = bash('source env.sh; review_then_run "$1"', str(script))
    assert denied.returncode == 1
    allowed = bash('source env.sh; review_then_run "$1" --confirm argument', str(script))
    assert allowed.returncode == 0, allowed.stderr
    assert allowed.stdout == "argument"


def test_prompt_password_does_not_leak_and_spinner_keeps_streams() -> None:
    result = bash(
        r"""
        set -euo pipefail
        source lib/prompt.sh
        REPLY=original
        _prompt_read() { REPLY=secret; }
        prompt_password >/dev/null
        [[ "$REPLY" == original ]]
        _prompt_read() { REPLY=2; }
        [[ "$(prompt_choice pick a b)" == b ]]
        work() { printf out; printf err >&2; return 23; }
        NON_INTERACTIVE=1 prompt_spinner working work
        """
    )
    assert result.returncode == 23
    assert result.stdout == "out"
    assert result.stderr.endswith("err")


@pytest.mark.parametrize(
    ("environment", "expected"),
    [("TERMUX_VERSION=0.118", "android"), ("PREFIX=/data/data/com.termux/files/usr", "android")],
)
def test_termux_detection(environment: str, expected: str) -> None:
    result = bash(f"source lib/os.sh; {environment} os_detect")
    assert result.returncode == 0, result.stderr
    assert result.stdout == f"{expected}\n"


def test_linux_and_temp_paths() -> None:
    result = bash(
        r"""
        set -euo pipefail
        unset TERMUX_VERSION PREFIX TMPDIR
        source lib/os.sh
        uname() { if [[ "$1" == -s ]]; then printf Linux; else printf GNU/Linux; fi; }
        [[ "$(os_detect)" == linux ]]
        [[ "$(TMPDIR='/private space/tmp' os_tmpdir)" == '/private space/tmp' ]]
        [[ "$(PREFIX=/termux/usr os_tmpdir)" == /termux/usr/tmp ]]
        python3() { return 99; }; perl() { return 99; }
        sleep() { printf '%s' "$1"; }
        os_sleep 0.01
        """
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "0.01"


def test_file_write_cleanup_and_real_private_tempfile(tmp_path: Path) -> None:
    target = tmp_path / "file"
    target.write_text("before", encoding="utf-8")
    target.chmod(0o640)
    result = bash(
        r"""
        set -euo pipefail
        source lib/file.sh
        file_write "$1" after
        [[ "$(file_mode "$1")" == 640 ]]
        mv() { return 23; }
        if file_write "$1" incomplete; then exit 98; fi
        tmp="$(TMPDIR="$2" file_temp .txt)"
        [[ -f "$tmp" && "$tmp" == "$2"/*.txt && "$(file_mode "$tmp")" == 600 ]]
        rm -- "$tmp"
        sha256sum() { return 23; }
        shasum() { printf '%064d' 0; }
        if file_sha256 "$1"; then exit 97; fi
        """,
        str(target),
        str(tmp_path),
    )
    assert result.returncode == 0, result.stderr
    assert target.read_text(encoding="utf-8") == "after"
    assert sorted(path.name for path in tmp_path.iterdir()) == ["file"]


def test_network_status_parsing_and_deadline() -> None:
    result = bash(
        r"""
        set -euo pipefail
        source lib/net.sh
        getent() { printf '192.0.2.1 hostname alias\n'; }
        [[ "$(net_dns_lookup hostname)" == 192.0.2.1 ]]
        net_http_get() { printf '%s' '{"tag_name":"v1.2.3","other":"tag_name"}'; }
        [[ "$(net_github_latest owner repo)" == v1.2.3 ]]
        net_http_get() { return 23; }
        if net_github_latest owner repo; then exit 98; fi
        SECONDS=0
        net_check() { [[ "$3" == 2 ]] || exit 97; SECONDS=2; return 1; }
        if net_wait_for hostname 80 2; then exit 96; fi
        curl() { printf '%s\n' "$@"; }
        NET_CONNECT_TIMEOUT=7 NET_MAX_TIME=19 net_download https://example.invalid
        """
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [
        "-fsSL",
        "--connect-timeout",
        "7",
        "--max-time",
        "19",
        "https://example.invalid",
    ]


def test_network_download_failure_preserves_output(tmp_path: Path) -> None:
    output = tmp_path / "download"
    output.write_text("before", encoding="utf-8")
    result = bash(
        r"""
        set -euo pipefail
        source lib/net.sh
        curl() {
            while (($#)); do
                if [[ "$1" == -o ]]; then printf partial >"$2"; return 23; fi
                shift
            done
            return 98
        }
        net_download https://example.invalid "$1"
        """,
        str(output),
    )
    assert result.returncode == 23, result.stderr
    assert output.read_text(encoding="utf-8") == "before"
    assert sorted(path.name for path in tmp_path.iterdir()) == ["download"]


def test_rsa_verification_without_tempfile_and_pipeline_failures(tmp_path: Path) -> None:
    result = bash(
        r"""
        set -eu
        set +o pipefail
        source lib/crypto.sh
        private="$1/private.pem" public="$1/public.pem"
        rsa_gen_keys "$private" "$public" 2048 >/dev/null
        signature="$(rsa_sign message "$private")"
        mktemp() { return 99; }
        rsa_verify message "$signature" "$public"
        if rsa_verify changed "$signature" "$public"; then exit 98; fi
        [[ "$(rsa_decrypt "$(rsa_encrypt message "$public")" "$private")" == message ]]
        printf -v oversized '%01000d' 0
        if rsa_encrypt "$oversized" "$public"; then exit 97; fi
        [[ "$SHELLOPTS" != *pipefail* ]]
        """,
        str(tmp_path),
    )
    assert result.returncode == 0, result.stderr


def test_deploy_pin_and_verified_fetch(tmp_path: Path) -> None:
    source = (ROOT / "deploy-ssh-keys.sh").read_text(encoding="utf-8")
    match = re.search(r"OS_LIB_SHA256:=([a-f0-9]{64})", source)
    assert match is not None
    assert match.group(1) == hashlib.sha256((ROOT / "lib/os.sh").read_bytes()).hexdigest()
    # Test definitions only, never the installer or a real SSH configuration.
    definitions = tmp_path / "loader.sh"
    definitions.write_text(source.split('\nimport lib/common.sh "')[0], encoding="utf-8")
    payload = "DEPLOY_IMPORTED=yes\n\n"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    result = bash(
        r"""
        set -euo pipefail
        source "$1"
        payload="$2"
        curl() { printf '%s' "$payload"; }
        mktemp() { return 99; }
        trap ':' EXIT
        before="$(trap -p EXIT)"
        import fixture "$3"
        [[ "$DEPLOY_IMPORTED" == yes && "$(trap -p EXIT)" == "$before" ]]
        curl() { printf 'DEPLOY_IMPORTED=bad'; return 23; }
        if import fixture "$3"; then exit 98; fi
        [[ "$DEPLOY_IMPORTED" == yes ]]
        """,
        str(definitions),
        payload,
        digest,
    )
    assert result.returncode == 0, result.stderr
