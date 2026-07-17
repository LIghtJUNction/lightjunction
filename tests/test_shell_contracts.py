"""Behavioral contracts for security-sensitive shell helpers."""

from __future__ import annotations

import hashlib
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


def test_import_allows_first_party_without_sha_with_warning() -> None:
    result = run_bash(
        r"""
        set -euo pipefail
        curl() {
            local output=''
            while (($#)); do
                if [[ "$1" == '-o' ]]; then output="$2"; shift 2; else shift; fi
            done
            printf 'FIRST_PARTY_IMPORTED=1\n' > "$output"
        }
        source basic.sh
        import fixture.sh
        printf '%s\n' "$FIRST_PARTY_IMPORTED"
        """,
    )

    assert result.returncode == 0
    assert result.stdout.strip() == "1"
    assert "warning: loading unverified first-party URL" in result.stderr


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
    assert "refusing unverified custom URL" in result.stderr
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
