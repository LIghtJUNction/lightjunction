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
        source lib/basic.sh
        curl() { printf 'VALUE=loaded\n'; }
        openssl() { return 99; }
        mktemp() { return 99; }
        if [[ "$1" == legacy ]]; then
            import fixture.sh main lightjunction LIghtJUNction https://example.invalid
        else
            import https://example.invalid/fixture.sh
        fi
        [[ "$VALUE" == loaded ]]
        source lib/basic.sh
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
        source lib/basic.sh
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
        source lib/basic.sh
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
        source lib/basic.sh
        cd "$1"
        curl() { return 99; }
        import lib/common.sh
        has bash
        """,
        str(tmp_path),
    )
    assert result.returncode == 0, result.stderr


def test_explicit_revision_is_used_without_hash() -> None:
    result = bash(
        r"""
        set -euo pipefail
        LIGHTJUNCTION_REF=reviewed-commit
        source lib/basic.sh
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
        source lib/basic.sh
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
    result = bash("TERMUX_VERSION=test BOOTSTRAP_FEATURES=fs-bees bash bootstrap-linux.sh")
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
        source lib/basic.sh
        import lib/common.sh
        import lib/bootstrap.sh
        unset TMPDIR
        PREFIX="$1/usr"
        mkdir -p "$PREFIX/tmp"
        f="$(tmpfile)"; [[ "$f" == "$PREFIX/tmp/"* ]]; rm "$f"
        init_tmp_dirs
        first="$(make_tmp_dir)"; second="$(make_tmp_dir)"
        [[ "$first" != "$second" && "$first" == "$PREFIX/tmp/"* ]]
        [[ "$(stat -c %a "$TMP_ROOT")" == 700 ]]
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
        "lib/basic.sh",
        "bootstrap-linux.sh",
        "bootstrap-macbook.sh",
        "deploy-ssh-keys.sh",
        "setup-gpg-agent.sh",
    ):
        text = (ROOT / name).read_text()
        assert "SHA256" not in text
        assert "verify_sha256" not in text


@pytest.mark.parametrize("library", sorted(p.name for p in (ROOT / "lib").glob("*.sh")))
def test_cloud_preload_and_short_imports(tmp_path: Path, library: str) -> None:
    log = tmp_path / "requests"
    result = bash(
        r"""
        set -euo pipefail
        ROOT="$PWD"
        export LIGHTJUNCTION_SHELL_BASE_URL=https://example.invalid/custom
        requests="$2"
        curl() {
            local url="${@: -1}"
            printf '%s\n' "$url" >>"$requests"
            case "$url" in
                */lib/preload.sh) cat "$ROOT/lib/preload.sh" ;;
                */lib/log.sh) cat "$ROOT/lib/log.sh" ;;
                *) return 22 ;;
            esac
        }
        source "lib/$1"
        declare -F import >/dev/null
        import log
        import log.sh
        import lib/log.sh
        source lib/preload.sh
        import log
        declare -F info >/dev/null
        IFS= read -r input
        printf '%s' "$input"
        """,
        library,
        str(log),
        stdin="preserved stdin\n",
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "preserved stdin"
    requests = log.read_text().splitlines()
    assert requests.count("https://example.invalid/custom/lib/log.sh") == 1
    assert requests.count("https://example.invalid/custom/lib/preload.sh") == (
        0 if library == "preload.sh" else 1
    )


@pytest.mark.parametrize("failure", ["download", "source", "partial"])
def test_cloud_import_failure_can_be_retried(failure: str) -> None:
    result = bash(
        r"""
        set -euo pipefail
        source lib/preload.sh
        failure="$1"
        curl() {
            case "$failure" in
                download) return 23 ;;
                source) printf 'return 17\n' ;;
                partial) printf 'PARTIAL=yes\n'; return 22 ;;
                success) printf 'RECOVERED=yes\n' ;;
            esac
        }
        if import fixture; then exit 99; else status=$?; fi
        case "$failure" in
            download) [[ "$status" == 23 ]] ;;
            source) [[ "$status" == 17 ]] ;;
            partial) [[ "$status" == 22 && "$PARTIAL" == yes ]] ;;
        esac
        [[ ${#__PRELOAD_IMPORTED[@]} == 0 ]]
        failure=success
        import fixture
        [[ "$RECOVERED" == yes && ${#__PRELOAD_IMPORTED[@]} == 1 ]]
        """,
        failure,
    )
    assert result.returncode == 0, result.stderr


def test_zsh_cloud_source_works_on_first_attempt(tmp_path: Path) -> None:
    import shutil

    zsh = shutil.which("zsh")
    if zsh is None:
        pytest.skip("zsh is not installed")
    requests = tmp_path / "requests"
    result = subprocess.run(
        [
            zsh,
            "-fc",
            r"""
            set -eu
            ROOT="$PWD"
            LIGHTJUNCTION_SHELL_BASE_URL=https://example.invalid
            requests="$1"
            curl() {
                local url="${@[-1]}"
                printf '%s\n' "$url" >>"$requests"
                cat "$ROOT/lib/${url##*/}"
            }
            . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/log.sh")
            ok 1
            import log
            import log
            import str
            [[ "$(str_trim ' hello ')" == hello ]]
            . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/log.sh")
            ok 2
            curl() { printf 'BROKEN=yes\n'; return 23; }
            if import missing; then exit 99; else [[ "$?" == 23 ]]; fi
            [[ -z "${BROKEN:-}" ]]
            curl() { printf 'RECOVERED=yes\n'; }
            import missing
            [[ "$RECOVERED" == yes ]]
            """,
            "zsh",
            str(requests),
        ],
        cwd=ROOT,
        env={k: v for k, v in os.environ.items() if not k.startswith("LIGHTJUNCTION_")},
        text=True,
        capture_output=True,
        check=False,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert "OK    1" in result.stderr and "OK    2" in result.stderr
    assert requests.read_text().splitlines().count("https://example.invalid/lib/preload.sh") == 1


@pytest.mark.parametrize("shell", ["bash", "zsh"])
def test_funcs_lists_loaded_functions_by_category(shell: str) -> None:
    import shutil

    executable = shutil.which(shell)
    if executable is None:
        pytest.skip(f"{shell} is not installed")
    result = subprocess.run(
        [
            executable,
            "-fc",
            r"""
        set -eu
        ROOT="$PWD"
        LIGHTJUNCTION_SHELL_BASE_URL=https://example.invalid
        curl() { local url; for url do :; done; cat "$ROOT/lib/${url##*/}"; }
        unrelated() { :; }
        . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/log.sh")
        import str
        import log
        . lib/preload.sh
        printf '%s\n' '---log---'
        funcs log
        printf '%s\n' '---categories---'
        funcs -c
        printf '%s\n' '---private---'
        funcs log -a
        unset -f ok
        printf '%s\n' '---removed---'
        funcs log
        printf '%s\n' '---all---'
        funcs
        printf '%s\n' '---reassigned---'
        _preload_register other info
        funcs other
        if funcs --invalid; then exit 99; else [[ "$?" == 2 ]]; fi
        """,
        ],
        cwd=ROOT,
        env={k: v for k, v in os.environ.items() if not k.startswith("LIGHTJUNCTION_")},
        text=True,
        capture_output=True,
        check=False,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    log, rest = result.stdout.split("---log---\n", 1)[1].split("---categories---\n")
    assert log == "log:\n  debug\n  err\n  info\n  line\n  ok\n  warn\n"
    categories, rest = rest.split("---private---\n")
    assert categories == "log\npreload\nstr\n"
    private, rest = rest.split("---removed---\n")
    assert "  _log\n" in private
    removed, rest = rest.split("---all---\n")
    assert "  ok\n" not in removed
    all_functions, reassigned = rest.split("---reassigned---\n")
    assert "  funcs\n" in all_functions and "  str_trim\n" in all_functions
    assert "unrelated" not in all_functions and "  _log\n" not in all_functions
    assert reassigned == "other:\n  info\n"


@pytest.mark.parametrize("shell", ["bash", "zsh"])
def test_bootstrap_dispatches_and_preserves_shell(shell: str, tmp_path: Path) -> None:
    import shutil

    executable = shutil.which(shell)
    if executable is None:
        pytest.skip(f"{shell} is not installed")
    result = subprocess.run(
        [
            executable,
            "-fc",
            r"""
        set -eu
        LIGHTJUNCTION_SHELL_BASE_URL=https://example.invalid/pinned/
        . lib/preload.sh
        requests="$1"
        curl() {
            local url
            for url do :; done
            printf '%s\n' "$url" >>"$requests"
            printf '%s\n' 'printf "%s|%s|%s|%s\n" \' \
                '"$LIGHTJUNCTION_RAW_BASE" "$LIGHTJUNCTION_SHELL_BASE_URL" "$1" "$2"' 'exit 7'
        }
        uname() { printf 'Linux\n'; }
        bootstrap -h >/dev/null
        [[ ! -e "$requests" ]]
        if bootstrap linux --help 'two words'; then exit 99; else [[ "$?" == 7 ]]; fi
        if bootstrap --help-script 'auto linux'; then exit 99; else [[ "$?" == 7 ]]; fi
        uname() { printf 'Darwin\n'; }
        if bootstrap --help-script 'auto mac'; then exit 99; else [[ "$?" == 7 ]]; fi
        uname() { printf 'FreeBSD\n'; }
        if bootstrap; then exit 99; else [[ "$?" == 2 ]]; fi
        if bootstrap unknown; then exit 99; else [[ "$?" == 2 ]]; fi
        curl() { printf 'touch "$1"\n'; return 23; }
        if bootstrap linux "$2"; then exit 99; else [[ "$?" == 23 ]]; fi
        [[ ! -e "$2" ]]
        funcs preload
        """,
            "shell",
            str(tmp_path / "requests"),
            str(tmp_path / "executed"),
        ],
        cwd=ROOT,
        env={k: v for k, v in os.environ.items() if not k.startswith("LIGHTJUNCTION_")},
        text=True,
        capture_output=True,
        check=False,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    expected = "https://example.invalid/pinned|https://example.invalid/pinned|--help|two words"
    assert expected in result.stdout
    assert "  bootstrap\n" in result.stdout
    assert (tmp_path / "requests").read_text().splitlines() == [
        "https://example.invalid/pinned/bootstrap-linux.sh",
        "https://example.invalid/pinned/bootstrap-linux.sh",
        "https://example.invalid/pinned/bootstrap-macbook.sh",
    ]


@pytest.mark.parametrize("shell", ["bash", "zsh"])
def test_current_library_upgrades_old_preloader_in_same_shell(shell: str) -> None:
    import shutil

    executable = shutil.which(shell)
    if executable is None:
        pytest.skip(f"{shell} is not installed")
    result = subprocess.run(
        [
            executable,
            "-fc",
            r"""
        set -eu
        ROOT="$PWD"
        LIGHTJUNCTION_SHELL_BASE_URL=https://example.invalid
        # An old session has already loaded log and imported bootstrap helpers.
        __PRELOAD_SH_LOADED=1
        __LOG_SH_LOADED=1
        __PRELOAD_IMPORTED=(https://example.invalid/lib/bootstrap.sh)
        __PRELOAD_FUNCTIONS=(old:kept)
        kept() { :; }
        import() { return 0; }
        curl() { local url; for url do :; done; cat "$ROOT/lib/${url##*/}"; }
        . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/log.sh")
        [[ "$__PRELOAD_SH_VERSION" == 2 ]]
        bootstrap -h
        import bootstrap
        [[ ${#__PRELOAD_IMPORTED[@]} == 1 ]]
        . <(curl -fsSL "$LIGHTJUNCTION_SHELL_BASE_URL/lib/preload.sh")
        funcs old
        if bootstrap daed; then exit 99; else [[ "$?" == 2 ]]; fi
        """,
        ],
        cwd=ROOT,
        env={k: v for k, v in os.environ.items() if not k.startswith("LIGHTJUNCTION_")},
        text=True,
        capture_output=True,
        check=False,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert "Usage: bootstrap [linux|macbook]" in result.stdout
    assert "old:\n  kept\n" in result.stdout
    assert "Unknown bootstrap target: daed" in result.stderr
