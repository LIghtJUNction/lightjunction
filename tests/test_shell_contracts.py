"""Behavioral contracts for security-sensitive shell helpers."""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def run_bash(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    """Run an isolated Bash contract script from the repository root."""
    return subprocess.run(
        ["bash", "-c", script, "bash", *args],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def sha256(path: Path) -> str:
    """Return the SHA256 digest for one repository file."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def literal_pin(source: str, name: str) -> str:
    """Extract a literal 64-character SHA256 assignment."""
    match = re.search(rf"{name}:=([0-9a-f]{{64}})", source)
    assert match is not None, name
    return match.group(1)


def test_import_rejects_first_party_without_sha_before_curl() -> None:
    result = run_bash(
        r"""
        set -euo pipefail
        curl() {
            printf 'curl must not run\n' >&2
            return 99
        }
        source basic.sh
        import fixture.sh
        """,
    )

    assert result.returncode == 1
    assert "refusing URL without required SHA256" in result.stderr
    assert "curl must not run" not in result.stderr


def test_import_rejects_custom_source_without_sha_before_curl() -> None:
    result = run_bash(
        r"""
        set -euo pipefail
        curl() { printf 'curl must not run\n' >&2; return 99; }
        source basic.sh
        import fixture.sh main lightjunction lightjunction https://example.invalid
        """,
    )

    assert result.returncode == 1
    assert "refusing URL without required SHA256" in result.stderr
    assert "curl must not run" not in result.stderr


def test_bootstrap_dependency_pins_match_current_files() -> None:
    common = sha256(ROOT / "lib/common.sh")
    bootstrap = sha256(ROOT / "lib/bootstrap.sh")
    os_lib = sha256(ROOT / "lib/os.sh")

    for filename in ("bootstrap-linux.sh", "bootstrap-macbook.sh"):
        source = (ROOT / filename).read_text(encoding="utf-8")
        assert literal_pin(source, "COMMON_LIB_SHA256") == common
        assert literal_pin(source, "BOOTSTRAP_LIB_SHA256") == bootstrap

    deploy = (ROOT / "deploy-ssh-keys.sh").read_text(encoding="utf-8")
    assert literal_pin(deploy, "COMMON_LIB_SHA256") == common
    assert literal_pin(deploy, "BOOTSTRAP_LIB_SHA256") == bootstrap
    assert literal_pin(deploy, "OS_LIB_SHA256") == os_lib

    daed = (ROOT / "bootstrap-linux-daed.sh").read_text(encoding="utf-8")
    match = re.search(r'BOOTSTRAP_LINUX_PIN="([0-9a-f]{64})"', daed)
    assert match is not None
    assert match.group(1) == sha256(ROOT / "bootstrap-linux.sh")


def test_file_write_preserves_existing_mode(tmp_path: Path) -> None:
    target = tmp_path / "mode.txt"
    target.write_text("before", encoding="utf-8")
    target.chmod(0o640)
    result = run_bash(
        'set -euo pipefail; source lib/file.sh; file_write "$1" after',
        str(target),
    )

    assert result.returncode == 0, result.stderr
    assert target.read_text(encoding="utf-8") == "after"
    assert target.stat().st_mode & 0o777 == 0o640


def test_share_file_uses_contained_regular_file_and_expected_url(tmp_path: Path) -> None:
    share_root = tmp_path / "share"
    share_root.mkdir(mode=0o750)
    source = tmp_path / "source.txt"
    source.write_text("payload", encoding="utf-8")
    result = subprocess.run(
        ["bash", "scripts/share-file.sh", str(source), "nice name.txt"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "SHARE_ROOT": str(share_root),
            "SHARE_BASE_URL": "https://share.example",
        },
    )

    assert result.returncode == 0, result.stderr
    relative_url = result.stdout.strip().removeprefix("https://share.example/")
    target = share_root / relative_url
    assert target.is_file()
    assert target.read_text(encoding="utf-8") == "payload"
    assert target.stat().st_mode & 0o777 == 0o644
    assert share_root.stat().st_mode & 0o777 == 0o750
    assert target.resolve().is_relative_to(share_root.resolve())


@pytest.mark.parametrize("display_name", [".", ".."])
def test_share_file_rejects_dot_names_without_changing_root_mode(
    tmp_path: Path, display_name: str
) -> None:
    share_root = tmp_path / "share"
    share_root.mkdir(mode=0o750)
    source = tmp_path / "source.txt"
    source.write_text("payload", encoding="utf-8")
    result = subprocess.run(
        ["bash", "scripts/share-file.sh", str(source), display_name],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "SHARE_ROOT": str(share_root)},
    )

    assert result.returncode == 2
    assert share_root.stat().st_mode & 0o777 == 0o750
    assert list(share_root.iterdir()) == []


def test_malformed_managed_markers_leave_file_unchanged(tmp_path: Path) -> None:
    target = tmp_path / "profile"
    original = "keep\n# >>> managed >>>\nnever delete\n"
    target.write_text(original, encoding="utf-8")
    original_mtime = target.stat().st_mtime_ns
    result = run_bash(
        r"""
        set -euo pipefail
        source lib/bootstrap.sh
        append_managed_block "$1" '# >>> managed >>>' '# <<< managed <<<' replacement
        """,
        str(target),
    )

    assert result.returncode == 1
    assert target.read_text(encoding="utf-8") == original
    assert target.stat().st_mtime_ns == original_mtime
    assert not target.with_suffix(".bak").exists()


def test_suppressed_log_calls_succeed_under_errexit() -> None:
    result = run_bash(
        r"""
        set -euo pipefail
        NON_INTERACTIVE=1 C_UP='' C_CLEAR_LINE='' C_DIM='' C_RESET=''
        C_RED='' C_YELLOW='' C_GREEN='' C_BLUE='' C_PURPLE=''
        LOG_LEVEL=0
        source log.sh
        err hidden
        warn hidden
        ok hidden
        info hidden
        debug hidden
        printf 'alive\n'
        """,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == "alive\n"


@pytest.mark.parametrize(
    ("library", "function"), [("lib/common.sh", "lj_sha256_file"), ("lib/file.sh", "file_sha256")]
)
def test_failing_preferred_checksum_tool_is_not_hidden(
    tmp_path: Path, library: str, function: str
) -> None:
    target = tmp_path / "input"
    target.write_text("payload", encoding="utf-8")
    result = run_bash(
        r"""
        set -euo pipefail
        sha256sum() { return 1; }
        shasum() { printf '%064d  %s\n' 0 "$3"; }
        source "$1"
        if "$2" "$3"; then exit 9; fi
        """,
        library,
        function,
        str(target),
    )

    assert result.returncode == 0, result.stderr


def test_net_download_failure_preserves_existing_output(tmp_path: Path) -> None:
    target = tmp_path / "download"
    target.write_text("original", encoding="utf-8")
    result = run_bash(
        r"""
        set -euo pipefail
        curl() {
            local output=''
            while (($#)); do
                if [[ "$1" == '-o' ]]; then output="$2"; shift 2; else shift; fi
            done
            printf partial > "$output"
            return 22
        }
        source lib/net.sh
        if net_download https://example.invalid "$1"; then exit 9; fi
        """,
        str(target),
    )

    assert result.returncode == 0, result.stderr
    assert target.read_text(encoding="utf-8") == "original"
    assert list(tmp_path.glob(".net-download.*")) == []


def test_net_download_keeps_timeouts_when_selecting_progress_mode(tmp_path: Path) -> None:
    capture = tmp_path / "curl-args"
    result = run_bash(
        r"""
        set -euo pipefail
        export CAPTURE="$1"
        curl() { printf '%s\n' "$@" > "$CAPTURE"; }
        NET_CONNECT_TIMEOUT=7
        NET_MAX_TIME=19
        source lib/net.sh
        net_download https://example.invalid >/dev/null
        """,
        str(capture),
    )

    assert result.returncode == 0, result.stderr
    assert capture.read_text(encoding="utf-8").splitlines() == [
        "-fsSL",
        "--connect-timeout",
        "7",
        "--max-time",
        "19",
        "https://example.invalid",
    ]
    source = (ROOT / "lib/net.sh").read_text(encoding="utf-8")
    assert "opts[0]=-#fsSL" in source


def test_live_contribution_lock_cannot_be_stolen_with_zero_ttl(tmp_path: Path) -> None:
    lock_dir = tmp_path / "opensource-contrib.lock"
    lock_dir.mkdir()
    (lock_dir / "metadata").write_text(f"runId=existing\npid={os.getpid()}\n", encoding="utf-8")
    result = subprocess.run(
        ["bash", "skills/opensource-small-pr/scripts/context.sh"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "OPEN_SOURCE_CONTRIB_STATE_DIR": str(tmp_path),
            "OPEN_SOURCE_CONTRIB_LOCK_TTL_SECONDS": "0",
        },
    )

    assert result.returncode == 75
    assert (lock_dir / "metadata").read_text(encoding="utf-8").startswith("runId=existing\n")


def test_bootstrap_security_static_contracts() -> None:
    linux = (ROOT / "bootstrap-linux.sh").read_text(encoding="utf-8")
    mac = (ROOT / "bootstrap-macbook.sh").read_text(encoding="utf-8")
    daed = (ROOT / "bootstrap-linux-daed.sh").read_text(encoding="utf-8")
    deploy = (ROOT / "deploy-ssh-keys.sh").read_text(encoding="utf-8")
    tracked_paths = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, check=True, capture_output=True, text=True
    ).stdout.splitlines()
    tracked = "\n".join(
        (ROOT / path).read_text(encoding="utf-8", errors="replace") for path in tracked_paths
    )

    assert '[[ -f "$file" ]]' not in linux
    assert '[[ -f "$file" ]]' not in mac
    assert "BOOTSTRAP_FEATURES" in linux and "if ! is_interactive" in linux
    assert "cachyos-repo.tar.xz" not in linux
    assert "github_release_asset_metadata daeuniverse daed" in linux
    assert "lj_sha256_file" in linux
    assert 'sudo rm -rf "$clt_dir"' not in mac
    assert "BOOTSTRAP_REPAIR_CLT" in mac
    removed_app = "Hid" + "dify"
    assert removed_app not in tracked and removed_app.lower() not in tracked
    assert "--max-time 120" in daed
    assert "Malformed lightjunction managed key markers" in deploy


@pytest.mark.skipif(shutil.which("openssl") is None, reason="openssl unavailable")
def test_rsa_v2_and_legacy_decryption_contract(tmp_path: Path) -> None:
    result = run_bash(
        r"""
        set -euo pipefail
        source lib/crypto.sh
        private="$1/private.pem"
        public="$1/public.pem"
        openssl genrsa -out "$private" 2048 >/dev/null 2>&1
        openssl rsa -in "$private" -pubout -out "$public" >/dev/null 2>&1
        envelope="$(rsa_encrypt modern "$public")"
        [[ "$envelope" == LJ-RSA-V2:* ]]
        [[ "$(rsa_decrypt "$envelope" "$private")" == modern ]]
        legacy="$(printf legacy | openssl pkeyutl -encrypt -pubin -inkey "$public" \
            -pkeyopt rsa_padding_mode:pkcs1 | openssl base64 -A)"
        [[ "$(rsa_decrypt "$legacy" "$private" 2>"$1/warning")" == legacy ]]
        grep -q 'legacy RSA PKCS#1 v1.5' "$1/warning"
        """,
        str(tmp_path),
    )

    assert result.returncode == 0, result.stderr


@pytest.mark.skipif(shutil.which("gpg") is None, reason="gpg unavailable")
def test_aes_uses_authenticated_gpg_and_rejects_legacy_by_default(tmp_path: Path) -> None:
    result = run_bash(
        r"""
        set -euo pipefail
        export GNUPGHOME="$1/gnupg"
        mkdir -m 700 "$GNUPGHOME"
        source lib/crypto.sh
        encrypted="$(aes_encrypt secret password)"
        [[ "$encrypted" == '-----BEGIN PGP MESSAGE-----'* ]]
        [[ "$(aes_decrypt "$encrypted" password)" == secret ]]
        if aes_decrypt U2FsdGVkX1_invalid password 2>"$1/legacy-error"; then exit 9; fi
        grep -q 'Refusing legacy unauthenticated AES-CBC' "$1/legacy-error"
        """,
        str(tmp_path),
    )

    assert result.returncode == 0, result.stderr
    source = (ROOT / "lib/crypto.sh").read_text(encoding="utf-8")
    assert "--passphrase-fd 3" in source
    assert "-pass pass:" not in source
    assert '--passphrase "$password"' not in source
