"""Software menu behavior with isolated input and mocked installation commands."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def run_menu(
    body: str, *, platform: str = "arch", stdin: str = ""
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "bash",
            "-c",
            """
        set -euo pipefail
        source lib/basic.sh
        source lib/bootstrap.sh
        source lib/menu.sh
        MENU_PLATFORM="$1"
        menu_read() { IFS= read -r MENU_REPLY; }
        """
            + body,
            "bash",
            platform,
        ],
        cwd=ROOT,
        env={
            k: v
            for k, v in os.environ.items()
            if not k.startswith(("LIGHTJUNCTION_", "BOOTSTRAP_"))
        },
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
        timeout=20,
    )


@pytest.mark.parametrize("platform", ["arch", "deb", "dnf", "brew", "termux"])
def test_catalog_is_filtered_and_ids_are_unique(platform: str) -> None:
    result = run_menu("menu_catalog; menu_list", platform=platform)
    assert result.returncode == 0, result.stderr
    assert "Git ·" in result.stdout and "Gemini CLI" in result.stdout
    assert ("Reflector" in result.stdout) == (platform == "arch")
    assert ("Clash Verge" in result.stdout) == (platform in {"arch", "brew"})
    assert ("termux-change-repo" in result.stdout) == (platform == "termux")
    rows = [
        line.split("|")
        for line in (ROOT / "lib/software.tsv").read_text().splitlines()
        if line and not line.startswith("#")
    ]
    assert len(rows) >= 50
    assert len({row[1] for row in rows}) == len(rows)
    assert all(len(row) == 6 for row in rows)


def test_category_toggles_and_preserves_cross_category_choices() -> None:
    result = run_menu(
        """
    menu_catalog
    menu_category base
    menu_category ai
    menu_plan
    """,
        stdin="1 4\n0\n1\n0\n",
    )
    assert result.returncode == 0, result.stderr
    plan = result.stdout.split("待安装", 1)[1]
    assert "3 项" in plan
    assert "git " in plan and "jq " in plan and "codex " in plan
    assert "wget " not in plan


def test_dry_run_and_cancel_never_install() -> None:
    for dry_run, stdin in [(1, ""), (0, "n\n")]:
        result = run_menu(
            f"""
        menu_catalog
        menu_toggle codex
        MENU_DRY_RUN={dry_run}
        menu_install() {{ printf 'MUST_NOT_INSTALL'; return 99; }}
        menu_apply
        """,
            stdin=stdin,
        )
        assert result.returncode == 0, result.stderr
        assert "MUST_NOT_INSTALL" not in result.stdout


def test_failed_item_is_reported_and_next_item_runs() -> None:
    result = run_menu(
        """
    menu_catalog
    menu_toggle git
    menu_toggle jq
    MENU_DRY_RUN=0
    df() { :; }
    findmnt() { :; }
    require_sudo() { :; }
    init_tmp_dirs() { :; }
    menu_install() { printf 'INSTALL:%s\n' "$2"; [[ "$2" != git ]]; }
    if menu_apply; then exit 99; fi
    """,
        stdin="y\n",
    )
    assert result.returncode == 0, result.stderr
    assert "INSTALL:git" in result.stdout and "INSTALL:jq" in result.stdout
    assert "成功 1 项，失败 1 项" in result.stdout
    assert "失败项目：git" in result.stdout


def test_native_names_and_npm_use_user_prefix() -> None:
    result = run_menu(
        """
    install_packages() { printf 'PACKAGE:%s\n' "$*"; }
    menu_native fd
    menu_native rust
    command_exists() { return 1; }
    npm() { printf 'NPM:%s\n' "$*"; }
    menu_install npm @openai/codex
    """,
        platform="deb",
    )
    assert result.returncode == 0, result.stderr
    for package in ["fd-find", "rustc", "cargo", "nodejs", "npm"]:
        assert f"PACKAGE:{package}\n" in result.stdout
    assert f"NPM:install --global --prefix {Path.home()}/.local @openai/codex" in result.stdout


def test_unknown_selection_fails_before_installing() -> None:
    result = run_menu("""
    install_packages() { printf MUST_NOT_INSTALL; }
    export BOOTSTRAP_PACKAGES=git,unknown
    menu_main "$MENU_PLATFORM" --dry-run
    """)
    assert result.returncode == 2
    assert "MUST_NOT_INSTALL" not in result.stdout


def test_real_terminal_menu_can_preview_and_exit() -> None:
    script = shutil.which("script")
    if script is None:
        pytest.skip("util-linux script is unavailable")
    result = subprocess.run(
        [script, "-qec", "bash bootstrap-linux.sh --dry-run", "/dev/null"],
        cwd=ROOT,
        env={
            k: v
            for k, v in os.environ.items()
            if not k.startswith(("LIGHTJUNCTION_", "BOOTSTRAP_"))
        },
        input="2\n1 4\n0\np\ni\n",
        capture_output=True,
        text=True,
        check=False,
        timeout=20,
    )
    assert result.returncode == 0, result.stderr
    assert "软件自选商店" in result.stdout
    assert "待安装 2 项" in result.stdout
    assert "git " in result.stdout and "jq " in result.stdout
    assert "开始安装？" not in result.stdout


def test_mac_formula_and_desktop_dispatch() -> None:
    result = run_menu(
        """
        brew_install() { printf 'BREW:%s\n' "$*"; }
        menu_install native git
        menu_install desktop obs-studio
        menu_install clash clash-verge-rev
        menu_install vscode visual-studio-code
        menu_install chsrc chsrc
        """,
        platform="brew",
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [
        "BREW:formula git",
        "BREW:cask obs",
        "BREW:cask clash-verge-rev",
        "BREW:cask visual-studio-code",
        "BREW:formula chsrc",
    ]


def test_noninteractive_default_never_runs_installer() -> None:
    result = run_menu("""
    export BOOTSTRAP_PACKAGES=git
    is_interactive() { return 1; }
    menu_install() { printf MUST_NOT_INSTALL; return 99; }
    menu_main "$MENU_PLATFORM"
    """)
    assert result.returncode == 0, result.stderr
    assert "请在交互式终端" in result.stdout
    assert "MUST_NOT_INSTALL" not in result.stdout


def test_package_refresh_failure_prevents_install(tmp_path: Path) -> None:
    source = (ROOT / "bootstrap-linux.sh").read_text().rsplit('\nmain "$@"', 1)[0]
    definitions = tmp_path / "linux.sh"
    definitions.write_text(source)
    result = run_menu(
        """
        export LIGHTJUNCTION_ROOT="$PWD"
        source "$DEFINITIONS"
        pkg_family() { printf 'deb\n'; }
        SUDO=()
        apt-get() {
            printf 'APT:%s\n' "$*"
            [[ "$1" != update ]]
        }
        if install_packages git; then exit 99; fi
        """.replace('"$DEFINITIONS"', '"' + str(definitions) + '"')
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout == "APT:update\n"


def test_termux_go_uses_golang_package():
    result = run_menu("menu_package go", platform="termux")
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "golang"
