"""Isolated key publication and decryption cleanup; no real user keys/devices."""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def isolated_env(tmp_path: Path) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("LIGHTJUNCTION_")}
    home = tmp_path / "home"
    (home / ".ssh").mkdir(parents=True)
    env.update(HOME=str(home), TMPDIR=str(tmp_path), LC_ALL="C.UTF-8")
    return env


def run_keys(tmp_path: Path, script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", "-c", "source lib/crypto.sh\n" + script, "bash", *args],
        cwd=ROOT,
        env=isolated_env(tmp_path),
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )


def test_real_rsa_key_pair_and_existing_default_keys_unchanged(tmp_path: Path) -> None:
    result = run_keys(
        tmp_path,
        r"""
        set -eu
        set +o pipefail
        trap ':' EXIT
        before="$(trap -p EXIT)" options="$SHELLOPTS"
        rsa_gen_keys "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_rsa.pub" 2048
        [[ "$(stat -c %a "$HOME/.ssh/id_rsa")" == 600 ]]
        signature="$(rsa_sign synthetic "$HOME/.ssh/id_rsa")"
        rsa_verify synthetic "$signature" "$HOME/.ssh/id_rsa.pub"
        sha256sum "$HOME/.ssh/id_rsa" "$HOME/.ssh/id_rsa.pub" > "$HOME/before"
        if rsa_gen_keys; then exit 90; fi
        sha256sum -c "$HOME/before"
        [[ "$before" == "$(trap -p EXIT)" && "$options" == "$SHELLOPTS" ]]
        """,
    )
    assert result.returncode == 0, result.stderr
    assert not list((tmp_path / "home/.ssh").glob(".rsa-*"))


@pytest.mark.parametrize("target", ["private", "public"])
@pytest.mark.parametrize("kind", ["file", "symlink", "dangling", "directory"])
def test_rsa_refuses_existing_destination(tmp_path: Path, target: str, kind: str) -> None:
    directory = tmp_path / "keys"
    directory.mkdir()
    private, public = directory / "private", directory / "public"
    selected = private if target == "private" else public
    sentinel = tmp_path / "sentinel"
    sentinel.write_bytes(b"old key material")
    if kind == "file":
        selected.write_bytes(b"old key material")
    elif kind == "directory":
        selected.mkdir()
    else:
        selected.symlink_to(sentinel if kind == "symlink" else tmp_path / "missing")
    result = run_keys(tmp_path, 'rsa_gen_keys "$1" "$2" 2048', str(private), str(public))
    assert result.returncode != 0
    assert sentinel.read_bytes() == b"old key material"
    assert sorted(p.name for p in directory.iterdir()) == [target]
    if kind == "file":
        assert selected.read_bytes() == b"old key material"
    elif kind in {"symlink", "dangling"}:
        assert selected.is_symlink()


def test_rsa_refuses_same_normalized_path(tmp_path: Path) -> None:
    directory = tmp_path / "keys"
    directory.mkdir()
    result = run_keys(
        tmp_path,
        'rsa_gen_keys "$1/key" "$1/../keys/key" 2048',
        str(directory),
    )
    assert result.returncode != 0
    assert list(directory.iterdir()) == []


@pytest.mark.parametrize("phase,status", [("genrsa", 23), ("rsa", 37)])
def test_rsa_generation_failure_leaves_no_key(tmp_path: Path, phase: str, status: int) -> None:
    result = run_keys(
        tmp_path,
        r"""
        openssl() {
            if [[ "$1" == "$FAIL_PHASE" ]]; then return "$FAIL_STATUS"; fi
            command openssl "$@"
        }
        FAIL_PHASE="$1" FAIL_STATUS="$2"
        rsa_gen_keys "$HOME/.ssh/private" "$HOME/.ssh/public" 2048
        """,
        phase,
        str(status),
    )
    assert result.returncode == status, result.stderr
    assert list((tmp_path / "home/.ssh").iterdir()) == []


@pytest.mark.parametrize("conflict", ["private", "public"])
@pytest.mark.parametrize("kind", ["file", "symlink", "dangling", "directory"])
def test_rsa_publication_race_no_clobber(tmp_path: Path, conflict: str, kind: str) -> None:
    result = run_keys(
        tmp_path,
        r"""
        link() {
            [[ $# == 2 && "$1" == /* && "$2" == /* ]] || return 99
            local destination="${@: -1}"
            if [[ "$destination" == "$HOME/.ssh/$RACE_TARGET" ]]; then
                case "$RACE_KIND" in
                    file) printf concurrent > "$destination" ;;
                    symlink) command ln -s "$HOME/sentinel" "$destination" ;;
                    dangling) command ln -s "$HOME/missing" "$destination" ;;
                    directory) mkdir "$destination" ;;
                esac
            fi
            command link "$@"
        }
        printf untouched > "$HOME/sentinel"
        RACE_TARGET="$1" RACE_KIND="$2"
        rsa_gen_keys "$HOME/.ssh/private" "$HOME/.ssh/public" 2048
        """,
        conflict,
        kind,
    )
    assert result.returncode != 0, result.stderr
    directory = tmp_path / "home/.ssh"
    assert sorted(p.name for p in directory.iterdir()) == [conflict]
    assert (tmp_path / "home/sentinel").read_text() == "untouched"
    if kind == "file":
        assert (directory / conflict).read_text() == "concurrent"
    elif kind in {"symlink", "dangling"}:
        assert (directory / conflict).is_symlink()
    else:
        assert list((directory / conflict).iterdir()) == []


@pytest.mark.parametrize("kind", ["file", "symlink", "dangling", "directory"])
def test_rsa_rollback_preserves_replaced_public_destination(tmp_path: Path, kind: str) -> None:
    result = run_keys(
        tmp_path,
        r"""
        link() {
            [[ $# == 2 && "$1" == /* && "$2" == /* ]] || return 99
            if [[ "${@: -1}" == "$HOME/.ssh/private" ]]; then
                [[ -f "$HOME/.ssh/public" &&
                    ! -e "$HOME/.ssh/private" && ! -L "$HOME/.ssh/private" ]] || return 99
                rm -- "$HOME/.ssh/public"
                case "$RACE_KIND" in
                    file) printf concurrent > "$HOME/.ssh/public" ;;
                    symlink) command ln -s "$HOME/sentinel" "$HOME/.ssh/public" ;;
                    dangling) command ln -s "$HOME/missing" "$HOME/.ssh/public" ;;
                    directory) mkdir "$HOME/.ssh/public" ;;
                esac
                return 41
            fi
            command link "$@"
        }
        printf untouched > "$HOME/sentinel"
        RACE_KIND="$1"
        rsa_gen_keys "$HOME/.ssh/private" "$HOME/.ssh/public" 2048
        """,
        kind,
    )
    assert result.returncode == 41, result.stderr
    directory = tmp_path / "home/.ssh"
    assert sorted(p.name for p in directory.iterdir()) == ["public"]
    assert (tmp_path / "home/sentinel").read_text() == "untouched"
    if kind == "file":
        assert (directory / "public").read_text() == "concurrent"
    elif kind in {"symlink", "dangling"}:
        assert (directory / "public").is_symlink()
    else:
        assert (directory / "public").is_dir()


def test_rsa_arbitrary_separate_parent_paths(tmp_path: Path) -> None:
    one, two = tmp_path / "one", tmp_path / "two"
    one.mkdir()
    two.mkdir()
    result = run_keys(tmp_path, 'rsa_gen_keys "$1/key" "$2/key" 2048', str(one), str(two))
    assert result.returncode == 0, result.stderr
    assert sorted(p.name for p in one.iterdir()) == ["key"]
    assert sorted(p.name for p in two.iterdir()) == ["key"]


def decrypt_fixture(tmp_path: Path, mode: str) -> tuple[dict[str, str], Path]:
    env = isolated_env(tmp_path)
    tools = tmp_path / "bin"
    tools.mkdir()
    for command in ("cat", "mktemp", "rm", "sleep"):
        executable = shutil.which(command)
        assert executable
        (tools / command).symlink_to(executable)
    plugin = tools / "age-plugin-yubikey"
    plugin.write_text("#!/bin/bash\nprintf synthetic-identity\n")
    plugin.chmod(0o755)
    age = tools / "age"
    age.write_text(
        """#!/bin/bash
count=0
[[ ! -f "$HOME/count" ]] || read -r count < "$HOME/count"
count=$((count+1))
printf '%s\\n' "$count" > "$HOME/count"
if [[ "$TEST_MODE" == success ]]; then printf plaintext; exit 0; fi
if [[ "$count" == 1 ]]; then exit 17; fi
if [[ "$TEST_MODE" == interrupt ]]; then
    printf ready > "$HOME/ready"
    sleep 30
fi
exit 29
"""
    )
    age.chmod(0o755)
    env.update(PATH=str(tools), TEST_MODE=mode)
    ciphertext = tmp_path / "ciphertext"
    ciphertext.write_text(
        "-----BEGIN AGE ENCRYPTED FILE-----\nYWJj\n-----END AGE ENCRYPTED FILE-----\n"
    )
    return env, ciphertext


@pytest.mark.parametrize("mode,status", [("success", 0), ("failure", 29)])
def test_decrypt_cleans_temp_identity_and_preserves_status(
    tmp_path: Path, mode: str, status: int
) -> None:
    env, ciphertext = decrypt_fixture(tmp_path, mode)
    bash = shutil.which("bash")
    assert bash
    before = set(tmp_path.iterdir())
    result = subprocess.run(
        [bash, "scripts/decrypt-message.sh", str(ciphertext)],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )
    assert result.returncode == status, result.stderr
    assert set(tmp_path.iterdir()) == before
    assert result.stdout == ("plaintext\n" if mode == "success" else "")


@pytest.mark.parametrize(
    "signum,status", [(signal.SIGTERM, 143), (signal.SIGINT, 130), (signal.SIGHUP, 129)]
)
def test_decrypt_signal_cleans_temp_identity(tmp_path: Path, signum: int, status: int) -> None:
    env, ciphertext = decrypt_fixture(tmp_path, "interrupt")
    bash = shutil.which("bash")
    assert bash
    before = set(tmp_path.iterdir())
    process = subprocess.Popen(
        [bash, "scripts/decrypt-message.sh", str(ciphertext)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        deadline = time.monotonic() + 5
        while not (tmp_path / "home/ready").exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert (tmp_path / "home/ready").exists()
        assert set(tmp_path.iterdir()) != before
        os.killpg(process.pid, signum)
        _, stderr = process.communicate(timeout=5)
        assert process.returncode == status, stderr
        assert set(tmp_path.iterdir()) == before
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate(timeout=5)


def test_rsa_preserves_newline_destination_names(tmp_path: Path) -> None:
    one = tmp_path / "private-parent\n"
    two = tmp_path / "public-parent\n"
    one.mkdir()
    two.mkdir()
    result = run_keys(
        tmp_path,
        'rsa_gen_keys "$1" "$2" 2048',
        str(one / "private\n"),
        str(two / "public\n"),
    )
    assert result.returncode == 0, result.stderr
    assert sorted(p.name for p in one.iterdir()) == ["private\n"]
    assert sorted(p.name for p in two.iterdir()) == ["public\n"]


def test_rsa_signal_after_private_link_preserves_complete_pair(tmp_path: Path) -> None:
    result = run_keys(
        tmp_path,
        r"""
        set -eu
        link() {
            [[ $# == 2 && "$1" == /* && "$2" == /* ]] || return 99
            command link "$@" || return
            if [[ "$2" == "$HOME/.ssh/private" ]]; then
                kill -TERM "$BASHPID"
            fi
        }
        if rsa_gen_keys "$HOME/.ssh/private" "$HOME/.ssh/public" 2048; then
            exit 90
        else
            [[ "$?" == 143 ]]
        fi
        signature="$(rsa_sign synthetic "$HOME/.ssh/private")"
        rsa_verify synthetic "$signature" "$HOME/.ssh/public"
        """,
    )
    assert result.returncode == 0, result.stderr
    directory = tmp_path / "home/.ssh"
    assert sorted(p.name for p in directory.iterdir()) == ["private", "public"]
