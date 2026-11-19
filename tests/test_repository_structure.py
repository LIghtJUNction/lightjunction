"""Repository checks for retained assets, development gates, and release workflows."""

import hashlib
import json
import re
import subprocess
from pathlib import Path


def test_challenge_keeps_its_original_artifact_and_public_section() -> None:
    payload = Path("public/junction-ii.png").read_bytes()
    assert hashlib.sha256(payload).hexdigest() == (
        "5a3faa3c9aece52aacb3f0c67a386eb5289bc37f95cc5a9e6547eef7a87ce4e4"
    )
    html = Path("archive.html").read_text(encoding="utf-8")
    section = re.search(r'<section\b[^>]*\bid="challenge-two"[^>]*>[\s\S]*?</section>', html)
    assert section is not None
    assert hashlib.sha256(section.group().encode()).hexdigest() == (
        "b400113a9209f2167fc9c5dd90415af1bdb256241c16ac92af275925381812be"
    )
    assert '<a href="./">' in html
    assert "<script" not in html


def test_repository_keeps_formatting_standards() -> None:
    editorconfig = Path(".editorconfig").read_text(encoding="utf-8")
    gitattributes = Path(".gitattributes").read_text(encoding="utf-8")

    assert "end_of_line = lf" in editorconfig
    assert "insert_final_newline = true" in editorconfig
    assert "* text=auto eol=lf" in gitattributes
    assert "dist/** linguist-generated=true" in gitattributes


def test_quality_gate_preserves_existing_python_bytecode(tmp_path: Path) -> None:
    for relative in ("scripts/check-python.sh", "scripts/lib/check-common.sh"):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(Path(relative).read_bytes())

    caches = []
    for directory in ("scripts", "tests", ".agents/skills"):
        cache = tmp_path / directory / "__pycache__" / "keep.pyc"
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(b"existing bytecode")
        caches.append(cache)

    for expected_status in (0, 23):
        result = subprocess.run(
            [
                "bash",
                "-c",
                r"""
                status="$2"
                uv() {
                    bash -c '[[ "${PYTHONDONTWRITEBYTECODE:-}" == 1 ]]' || return 97
                    return "$status"
                }
                source "$1"
                """,
                "bash",
                str(tmp_path / "scripts/check-python.sh"),
                str(expected_status),
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
        assert result.returncode == expected_status, result.stderr
        assert all(cache.read_bytes() == b"existing bytecode" for cache in caches)


def test_typescript_uses_strict_frontend_checks() -> None:
    tsconfig = json.loads(Path("tsconfig.json").read_text(encoding="utf-8"))
    compiler_options = tsconfig["compilerOptions"]
    required = [
        "strict",
        "noUnusedLocals",
        "noUnusedParameters",
        "noImplicitReturns",
        "noFallthroughCasesInSwitch",
        "noUncheckedIndexedAccess",
        "exactOptionalPropertyTypes",
        "useUnknownInCatchVariables",
    ]

    for option in required:
        assert compiler_options[option] is True


def test_pages_workflow_uses_node_24_actions() -> None:
    workflow = Path(".github/workflows/deploy-pages.yml").read_text(encoding="utf-8")

    assert re.search(r"actions/attest-build-provenance@[0-9a-f]{40} # v4\b", workflow)
    assert re.search(r"actions/configure-pages@[0-9a-f]{40} # v6\b", workflow)
    assert re.search(r"actions/upload-pages-artifact@[0-9a-f]{40} # v5\b", workflow)
    assert re.search(r"actions/deploy-pages@[0-9a-f]{40} # v5\b", workflow)


def test_external_workflow_actions_are_sha_pinned() -> None:
    for path in Path(".github/workflows").glob("*.yml"):
        for action in re.findall(r"^\s*(?:-\s*)?uses:\s*(\S+)", path.read_text(), re.MULTILINE):
            if action.startswith(("./", "docker://")):
                continue
            assert re.fullmatch(r"[^@]+@[0-9a-f]{40}", action), (path, action)
