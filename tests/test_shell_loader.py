"""Offline import and installer regression tests; no host package installs."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def bash(script: str, *args: str, stdin: str = "") -> subprocess.CompletedProcess[str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("LIGHTJUNCTION_")}
    return subprocess.run(
        ["bash", "-c", script, "bash", *args],
        cwd=ROOT,
        env=env,
        input=stdin,
        text=True,
        capture_output=True,
        check=False,
        timeout=15,
    )


@pytest.mark.parametrize("legacy", [False, True])
def test_import_without_checksum(legacy: bool) -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        curl() { printf 'VALUE=loaded\n'; }
        openssl() { return 99; }
        mktemp() { return 99; }
        if [[ "$1" == legacy ]]; then
            import fixture.sh main lightjunction LIghtJUNction https://example.invalid
        else
            import https://example.invalid/fixture.sh
        fi
        [[ "$VALUE" == loaded ]]
        source basic.sh
        [[ ${#__IMPORTED_FILES[@]} == 1 ]]
        curl() { return 99; }
        if [[ "$1" == legacy ]]; then
            import fixture.sh main lightjunction LIghtJUNction https://example.invalid
        else
            import https://example.invalid/fixture.sh
        fi
        IFS= read -r input
        printf '%s' "$input"
        """,
        "legacy" if legacy else "url",
        stdin="caller stdin\n",
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "caller stdin"


@pytest.mark.parametrize("kind,status", [("network", 23), ("source", 17), ("partial", 22)])
def test_import_propagates_errors_and_does_not_cache(kind: str, status: int) -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        kind="$1"
        curl() {
            case "$kind" in
                network) return 23 ;;
                source) printf 'return 17\n' ;;
                partial) printf 'PARTIAL=visible\n'; return 22 ;;
            esac
        }
        trap ':' EXIT
        before="$(trap -p EXIT)"
        if import https://example.invalid/fixture; then exit 99; else status=$?; fi
        [[ ${#__IMPORTED_FILES[@]} == 0 && "$before" == "$(trap -p EXIT)" ]]
        if [[ "$kind" == partial ]]; then [[ "$PARTIAL" == visible ]]; fi
        exit "$status"
        """,
        kind,
    )
    assert result.returncode == status, result.stderr


def test_nested_import_keeps_the_outer_download_status() -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        curl() {
            case "${@: -1}" in
                */outer) printf 'import https://example.invalid/inner\n'; return 22 ;;
                */inner) printf 'INNER=yes\n' ;;
            esac
        }
        if import https://example.invalid/outer; then exit 99; else status=$?; fi
        [[ "$INNER" == yes && ${#__IMPORTED_FILES[@]} == 1 ]]
        exit "$status"
        """
    )
    assert result.returncode == 22, result.stderr


def test_local_import_is_independent_of_cwd(tmp_path: Path) -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        cd "$1"
        curl() { return 99; }
        import lib/common.sh
        lj_has bash
        """,
        str(tmp_path),
    )
    assert result.returncode == 0, result.stderr


def test_explicit_revision_is_used_without_hash() -> None:
    result = bash(
        r"""
        set -euo pipefail
        LIGHTJUNCTION_REF=reviewed-commit
        source basic.sh
        LIGHTJUNCTION_ROOT=''
        curl() { printf '%s\n' "${@: -1}" >&2; printf 'VALUE=yes\n'; }
        import fixture.sh
        [[ "$VALUE" == yes ]]
        """
    )
    assert result.returncode == 0, result.stderr
    assert "/reviewed-commit/fixture.sh" in result.stderr


@pytest.mark.parametrize("entry", ["file", "stdin", "process"])
@pytest.mark.parametrize(
    "name",
    [
        "bootstrap-linux.sh",
        "bootstrap-linux-daed.sh",
        "bootstrap-macbook.sh",
        "deploy-ssh-keys.sh",
        "setup-gpg-agent.sh",
    ],
)
def test_entrypoint_loading_modes(tmp_path: Path, entry: str, name: str) -> None:
    result = bash(
        r"""
        set -euo pipefail
        ROOT="$PWD"
        export ROOT
        curl() {
            local url="${@: -1}" relative
            relative="${url#https://raw.githubusercontent.com/LIghtJUNction/lightjunction/main/}"
            cat "$ROOT/$relative"
        }
        export -f curl
        case "$1" in
            file) bash "$2" --help ;;
            stdin) cd "$3"; bash -s -- --help <"$ROOT/$2" ;;
            process) cd "$3"; bash <(cat "$ROOT/$2") --help ;;
        esac
        """,
        entry,
        name,
        str(tmp_path),
    )
    assert result.returncode == 0, result.stderr
    assert "Usage:" in result.stdout


def test_wrapper_preserves_child_errexit_arguments_and_download_status() -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        curl() { printf 'set -e\nprintf "%%s" "$1"\nfalse\nprintf unreachable\n'; }
        if run_script https://example.invalid/test 'one two'; then exit 99; else status=$?; fi
        [[ "$status" == 1 ]]
        curl() { return 23; }
        run_script https://example.invalid/missing
        """
    )
    assert result.returncode == 23, result.stderr
    assert result.stdout == "one two"


def test_linux_rejects_all_invalid_features_before_installing() -> None:
    result = bash(
        r"""
        export BOOTSTRAP_FEATURES=shell,invalid
        sudo() { printf 'must-not-run' >&2; exit 99; }
        export -f sudo
        bash bootstrap-linux.sh
        """
    )
    assert result.returncode == 1
    assert "Unknown feature" in result.stderr and "must-not-run" not in result.stderr


def test_termux_rejects_system_modules_before_installing() -> None:
    result = bash("TERMUX_VERSION=test BOOTSTRAP_FEATURES=network-daed bash bootstrap-linux.sh")
    assert result.returncode == 1
    assert "not supported in Termux" in result.stderr


def test_termux_packages_use_pkg_without_sudo(tmp_path: Path) -> None:
    source = (ROOT / "bootstrap-linux.sh").read_text().rsplit('\nmain "$@"', 1)[0]
    definitions = tmp_path / "linux.sh"
    definitions.write_text(source)
    result = bash(
        r"""
        export LIGHTJUNCTION_ROOT="$PWD" TERMUX_VERSION=test
        source "$1"
        pkg() { printf '%s\n' "$*"; }
        sudo() { return 99; }
        install_packages fish git
        """,
        str(definitions),
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "install -y fish git\n"


def test_shared_temp_and_managed_file_behavior(tmp_path: Path) -> None:
    result = bash(
        r"""
        set -euo pipefail
        source basic.sh
        import lib/common.sh
        import lib/bootstrap.sh
        unset TMPDIR
        PREFIX="$1/usr"
        mkdir -p "$PREFIX/tmp"
        f="$(lj_tmpfile)"; [[ "$f" == "$PREFIX/tmp/"* ]]; rm "$f"
        init_tmp_dirs
        first="$(make_tmp_dir)"; second="$(make_tmp_dir)"
        [[ "$first" != "$second" && "$first" == "$PREFIX/tmp/"* ]]
        [[ "$(stat -c %a "$LJ_TMP_ROOT")" == 700 ]]
        cleanup_tmp_dirs
        [[ ! -d "$first" && ! -d "$second" ]]
        target="$1/profile"
        printf 'user content\n' >"$target"
        chmod 640 "$target"
        ln -s profile "$1/link"
        append_managed_block "$1/link" '# begin' '# end' managed
        before="$(stat -c %Y "$target")"
        append_managed_block "$1/link" '# begin' '# end' managed
        [[ -L "$1/link" && "$(stat -c %a "$target")" == 640 ]]
        [[ "$before" == "$(stat -c %Y "$target")" ]]
        [[ "$(cat "$target.bak")" == 'user content' ]]
        [[ "$(grep -c '^# begin$' "$target")" == 1 ]]
        printf '# begin\nbroken\n' >"$target"
        if append_managed_block "$target" '# begin' '# end' replacement; then exit 99; fi
        [[ "$(cat "$target")" == $'# begin\nbroken' ]]
        """,
        str(tmp_path),
    )
    assert result.returncode == 0, result.stderr


def test_failed_probe_does_not_treat_curl_timing_output_as_success() -> None:
    result = bash(
        r"""
        set -euo pipefail
        source lib/bootstrap.sh
        curl() { printf 0.001; return 22; }
        if probe_url example https://example.invalid; then exit 99; fi
        if select_fastest_url https://example.invalid; then exit 98; fi
        """
    )
    assert result.returncode == 0, result.stderr


def test_installers_have_no_script_digest_configuration() -> None:
    for name in (
        "basic.sh",
        "bootstrap-linux.sh",
        "bootstrap-linux-daed.sh",
        "bootstrap-macbook.sh",
        "deploy-ssh-keys.sh",
        "setup-gpg-agent.sh",
    ):
        text = (ROOT / name).read_text()
        assert "SHA256" not in text
        assert "verify_sha256" not in text
