"""Structural checks for the Vite frontend."""

import json
from pathlib import Path


def test_index_keeps_styles_external() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    assert "<style>" not in html
    assert "</style>" not in html
    assert 'src="/src/terminal.ts"' in html


def test_index_has_personal_site_metadata() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    required = [
        '<meta name="description"',
        '<meta name="theme-color" content="#e9e2d3">',
        '<meta property="og:title" content="LIghtJUNction — Independent Builder">',
        '<meta property="og:image" content="https://1.gravatar.com/avatar/',
        '?s=512&amp;d=identicon">',
        '<meta name="twitter:card" content="summary">',
        '<link rel="canonical" href="https://lightjunction.github.io/lightjunction/">',
        "<title>LIghtJUNction — Independent Builder</title>",
    ]
    for fragment in required:
        assert fragment in html

    assert "App Launcher" not in html


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


def test_index_has_portfolio_and_real_experiences() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    required = [
        'id="hero-title"',
        'id="workbench"',
        'id="workspace-title"',
        'id="workspace-kicker"',
        'data-app-target="projects"',
        'data-app-target="terminal"',
        'id="projects-app" data-app-panel="projects"',
        'id="terminal-app" data-app-panel="terminal"',
        'id="terminal-console" tabindex="0"',
        'id="terminal-output"',
        'id="input-text"',
        'id="secure-card"',
        'id="secure-message"',
        'id="secure-cancel"',
        'id="result-overlay"',
        'id="result-content"',
        'id="result-title"',
        'id="result-copy"',
        'id="result-github"',
        'id="result-close"',
        'id="toast"',
        'id="project-groups" role="tablist" aria-label="Project groups"',
        'id="project-grid" aria-live="polite"',
        'id="project-status"',
        'id="project-count"',
        'id="project-sort"',
        'id="btn-reset"',
        'id="btn-fullscreen"',
        'id="btn-message"',
        'id="btn-refresh-projects"',
        'id="encrypt-now"',
    ]
    for fragment in required:
        assert fragment in html

    assert 'id="ascii-bg"' not in html


def test_terminal_keyboard_input_is_scoped_and_keeps_native_tab() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    assert "terminalRegion.addEventListener('keydown', handleKeydown)" in entrypoint
    assert "document.addEventListener('keydown', handleKeydown)" not in entrypoint
    assert "if (event.key === 'Tab') return" in entrypoint
    assert "event.target !== terminalRegion" in entrypoint
    assert "button, a, textarea, input, select, summary" in entrypoint


def test_contact_flows_restore_focus_and_isolate_modal() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    required = [
        "dismissSecureCard",
        "restorePreviousFocus",
        "trapResultFocus",
        "setModalBackgroundInert",
        "clearModalBackgroundInert",
        "child.inert = true",
        "$('secure-cancel').addEventListener('click', dismissSecureCard)",
    ]
    for fragment in required:
        assert fragment in entrypoint


def test_project_filters_preserve_the_loaded_data_source() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    assert "let projectSource: ProjectSource" in entrypoint
    assert "projectSource = source" in entrypoint
    assert "renderProjectCards(projectCards, projectSource)" in entrypoint


def test_frontend_uses_synced_project_cards_json() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    github_module = Path("src/github.ts").read_text(encoding="utf-8")
    synced_json = Path("public/github-projects.json")

    assert "fetchStaticProjectCards" in entrypoint
    assert "github-projects.json" in github_module
    assert synced_json.exists()


def test_frontend_validates_external_data_and_urls() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    github_module = Path("src/github.ts").read_text(encoding="utf-8")
    dom_module = Path("src/dom.ts").read_text(encoding="utf-8")

    assert "isRepoCardArray(parsed.cards)" in entrypoint
    assert "Clipboard access was unavailable" in entrypoint
    assert "stopSecureCardAnimation" in entrypoint
    assert "parseProjectCardsPayload" in github_module
    assert "value.schema_version !== 1" in github_module
    assert "safeExternalUrl" in dom_module


def test_terminal_imports_styles_and_motion() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    stylesheet = Path("src/styles.css")
    motion = Path("src/motion.ts")
    assert "import './styles.css'" in entrypoint
    assert "from './motion'" in entrypoint
    assert "initMotion()" in entrypoint
    assert "registerReveals(projectGrid)" in entrypoint
    assert stylesheet.exists() and stylesheet.stat().st_size > 0
    assert motion.exists() and motion.stat().st_size > 0


def test_optical_edition_keeps_its_visual_asset_and_theme_layer() -> None:
    html = Path("index.html").read_text(encoding="utf-8")
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    theme = Path("src/optical-theme.css")
    lens = Path("public/optical-lens.webp")

    assert 'src="./optical-lens.webp"' in html
    assert "import './optical-theme.css'" in entrypoint
    assert theme.exists() and theme.stat().st_size > 0
    assert lens.exists() and lens.stat().st_size > 0


def test_terminal_entrypoint_stays_modular_without_random_visuals() -> None:
    entrypoint = Path("src/terminal.ts").read_text(encoding="utf-8")
    modules = [
        "src/commands.ts",
        "src/dom.ts",
        "src/github.ts",
        "src/motion.ts",
        "src/public-key.ts",
    ]

    for module in modules:
        assert Path(module).exists(), module

    assert "from './commands'" in entrypoint
    assert "from './dom'" in entrypoint
    assert "from './github'" in entrypoint
    assert "from './public-key'" in entrypoint
    assert "from './visuals'" not in entrypoint
    assert "initAsciiBackground" not in entrypoint
    assert not Path("src/visuals.ts").exists()
    assert "const PUBLIC_KEY =" not in entrypoint


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
