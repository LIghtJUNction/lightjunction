"""Structural checks for the Vite frontend."""

import json
from pathlib import Path


def test_index_keeps_styles_external() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    assert "<style>" not in html
    assert "</style>" not in html
    assert 'src="/src/terminal.ts"' in html


def test_index_has_share_metadata() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    required = [
        '<meta name="description"',
        '<meta name="theme-color" content="#080b0a">',
        '<meta property="og:title" content="LIghtJUNction App Launcher">',
        '<meta property="og:image"',
        '<meta name="twitter:card" content="summary">',
        '<link rel="canonical" href="https://lightjunction.github.io/lightjunction/">',
    ]
    for fragment in required:
        assert fragment in html


def test_index_has_accessible_terminal_landmarks() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    required = [
        'class="skip-link" href="#workspace-title"',
        'id="terminal-output" role="log" aria-live="polite"',
        '<label class="sr-only" for="secure-message">Message to encrypt</label>',
        'role="dialog" aria-modal="true" aria-labelledby="result-title"',
        '<h2 id="result-title">Encrypted message</h2>',
    ]
    for fragment in required:
        assert fragment in html


def test_index_has_app_launcher_and_project_cards() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    required = [
        'class="launcher" aria-label="Apps"',
        'data-app-target="projects"',
        'data-app-target="terminal"',
        'id="projects-app" data-app-panel="projects"',
        'id="project-groups" role="tablist" aria-label="Project groups"',
        'id="project-grid" aria-live="polite"',
    ]
    for fragment in required:
        assert fragment in html


def test_frontend_uses_synced_project_cards_json() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    github_module = Path("src/github.ts").read_text(encoding="utf-8")
    synced_json = Path("public/github-projects.json")

    assert "fetchStaticProjectCards" in entrypoint
    assert "github-projects.json" in github_module
    assert synced_json.exists()


def test_terminal_imports_stylesheet() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    stylesheet = Path("src/styles.css")
    assert "import './styles.css'" in entrypoint
    assert stylesheet.exists()
    assert stylesheet.stat().st_size > 0


def test_terminal_entrypoint_stays_modular() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    modules = [
        "src/commands.ts",
        "src/dom.ts",
        "src/github.ts",
        "src/public-key.ts",
        "src/visuals.ts",
    ]

    for module in modules:
        assert Path(module).exists(), module

    assert "from './commands'" in entrypoint
    assert "from './dom'" in entrypoint
    assert "from './github'" in entrypoint
    assert "from './public-key'" in entrypoint
    assert "from './visuals'" in entrypoint
    assert "const PUBLIC_KEY =" not in entrypoint
    assert "type VisualProfile =" not in entrypoint


def test_repository_keeps_formatting_standards() -> None:
    editorconfig = Path(".editorconfig").read_text(encoding="utf-8")
    gitattributes = Path(".gitattributes").read_text(encoding="utf-8")

    assert "end_of_line = lf" in editorconfig
    assert "insert_final_newline = true" in editorconfig
    assert "* text=auto eol=lf" in gitattributes
    assert "dist/** linguist-generated=true" in gitattributes


def test_quality_gate_cleans_python_bytecode() -> None:
    check_script = Path("scripts/check.sh").read_text(encoding="utf-8")

    assert "Clean transient Python bytecode" in check_script
    assert "__pycache__" in check_script
    assert "*.py[co]" in check_script


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
