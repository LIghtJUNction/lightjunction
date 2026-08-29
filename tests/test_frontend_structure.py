"""Structural checks for the Vite frontend."""

import hashlib
import json
import re
import struct
from pathlib import Path


def read_html() -> str:
    html = Path("index.html").read_text(encoding="utf-8")
    html = re.sub(r"\s+", " ", html)
    html = re.sub(r"\s*/>", ">", html)
    html = re.sub(r"\s+>", ">", html)
    html = re.sub(r">\s+", ">", html)
    return re.sub(r"\s+<", "<", html)


def read_source(path: str) -> str:
    return Path(path).read_text(encoding="utf-8").replace('"', "'")


def test_index_keeps_styles_external() -> None:
    html = read_html()
    assert "<style>" not in html
    assert "</style>" not in html
    assert 'src="/src/terminal.ts"' in html


def test_index_has_signal_field_manual_metadata() -> None:
    html = read_html()
    required = [
        '<meta name="description"',
        '<meta name="theme-color" content="#F5F0E8">',
        '<meta property="og:title" content="LIghtJUNction | Independent digital assistant">',
        '<meta property="og:image" content="https://1.gravatar.com/avatar/',
        '?s=512&amp;d=identicon">',
        '<meta name="twitter:card" content="summary">',
        '<link rel="canonical" href="https://lightjunction.github.io/lightjunction/">',
        "<title>LIghtJUNction | Independent digital assistant</title>",
    ]
    for fragment in required:
        assert fragment in html

    assert "App Launcher" not in html


def test_index_has_live_shader_gallery() -> None:
    html = read_html()
    gallery = Path("src/shader-gallery.ts")
    singularity_renderer = Path("src/singularity-renderer.ts")
    singularity_source = Path("src/shaders/singularity-forge.glsl")
    styles = Path("src/styles.css").read_text(encoding="utf-8")
    downloaded_source = Path("public/shader-demos/1.html.txt")

    required = [
        'id="shaders"',
        'data-shader-engine="singularity"',
        "Singularity Forge",
        'data-shader-action="bloom"',
        'data-shader-action="quality"',
        ">01 / 04</span",
    ]
    for fragment in required:
        assert fragment in html

    assert gallery.exists()
    assert singularity_renderer.exists()
    assert singularity_source.exists()
    assert downloaded_source.exists()
    assert not Path("public/shader-demos/2.html.txt").exists()
    assert not Path("src/downloaded-demo.ts").exists()
    assert html.count("data-shader-card") == 4
    assert html.count("data-shader-canvas") == 2
    assert 'data-demo-id="3"' not in html
    assert "data-shader-demo-frame" not in html
    assert "Internal Beyond" not in html
    assert "data-demo-reload" not in html
    assert "mountShaderShowcase" in gallery.read_text(encoding="utf-8")
    assert "SingularityForgeRenderer" in singularity_renderer.read_text(encoding="utf-8")
    assert "DownloadedDemoController" not in gallery.read_text(encoding="utf-8")
    assert "mainImage" in singularity_source.read_text(encoding="utf-8")
    assert "--ochre: #a57c38" in styles
    assert "--shader-cyan" not in styles
    assert "#71e6f5" not in styles


def test_index_has_accessible_terminal_landmarks() -> None:
    html = read_html()
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
    html = read_html()
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
        'id="btn-toggle-projects"',
        'id="btn-reset"',
        'id="btn-fullscreen"',
        'id="btn-message"',
        'id="btn-refresh-projects"',
        'id="encrypt-now"',
    ]
    for fragment in required:
        assert fragment in html

    assert 'id="ascii-bg"' not in html


def test_challenge_two_is_embedded_without_source_level_solution_material() -> None:
    html = read_html()
    artifact = Path("public/junction-ii.png")
    required = [
        'id="challenge-two"',
        'id="challenge-title"',
        'href="./junction-ii.png" download="junction-ii.png"',
        'src="/junction-ii.png"',
        "Recover the original signal.",
        "Read the frame, then the field.",
        "If you recover it, submit a PR with the full elapsed time",
    ]
    for fragment in required:
        assert fragment in html

    assert artifact.exists()
    payload = artifact.read_bytes()
    assert payload.startswith(b"\x89PNG\r\n\x1a\n")
    assert struct.unpack(">II", payload[16:24]) == (1600, 1200)

    target_digest = "de5a097c814a80c6b12a350b4a48ce045c17f549ae867378e17ea861be514d69"
    tracked_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in [
            Path("index.html"),
            Path("README.md"),
            *Path("src").glob("*.ts"),
            Path("src/styles.css"),
        ]
    )
    text_candidates = re.findall(r"(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])", tracked_text)
    binary_candidates = re.findall(rb"(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])", payload)
    assert all(
        hashlib.sha256(value.encode("ascii")).hexdigest() != target_digest
        for value in text_candidates
    )
    assert all(hashlib.sha256(value).hexdigest() != target_digest for value in binary_candidates)
    assert b"BEGIN PRIVATE KEY" not in payload


def test_terminal_keyboard_input_is_scoped_and_keeps_native_tab() -> None:
    entrypoint = read_source("src/terminal.ts")
    assert "terminalRegion.addEventListener('keydown', handleKeydown)" in entrypoint
    assert "document.addEventListener('keydown', handleKeydown)" not in entrypoint
    assert "if (event.key === 'Tab') return" in entrypoint
    assert "event.target !== terminalRegion" in entrypoint
    assert "button, a, textarea, input, select, summary" in entrypoint


def test_contact_flows_restore_focus_and_isolate_modal() -> None:
    secure_card = read_source("src/secure-card.ts")
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
        assert fragment in secure_card


def test_project_filters_preserve_the_loaded_data_source() -> None:
    projects_module = read_source("src/projects.ts")
    assert "let projectSource: ProjectSource" in projects_module
    assert "projectSource = source" in projects_module
    assert "renderProjectCards(projectCards, projectSource)" in projects_module


def test_project_index_defaults_to_a_bounded_reviewable_page() -> None:
    html = read_html()
    projects_module = read_source("src/projects.ts")

    assert 'id="btn-toggle-projects"' in html
    assert "const PROJECT_PAGE_SIZE = 8" in projects_module
    assert "filteredCards.slice(0, PROJECT_PAGE_SIZE)" in projects_module
    assert "let projectsExpanded = false" in projects_module
    assert "projectsExpanded = false" in projects_module
    assert "projectToggle.addEventListener('click'" in projects_module
    assert "projectToggle.setAttribute('aria-expanded'" in projects_module
    assert "Show fewer projects" in projects_module


def test_frontend_uses_synced_project_cards_json() -> None:
    projects_module = read_source("src/projects.ts")
    github_module = Path("src/github.ts").read_text(encoding="utf-8")
    synced_json = Path("public/github-projects.json")

    assert "fetchStaticProjectCards" in projects_module
    assert "github-projects.json" in github_module
    assert synced_json.exists()


def test_frontend_validates_external_data_and_urls() -> None:
    projects_module = read_source("src/projects.ts")
    secure_card = read_source("src/secure-card.ts")
    github_module = Path("src/github.ts").read_text(encoding="utf-8")
    dom_module = Path("src/dom.ts").read_text(encoding="utf-8")

    assert "isRepoCardArray(parsed.cards)" in projects_module
    assert "Clipboard access was unavailable" in secure_card
    assert "stopSecureCardAnimation" in secure_card
    assert "parseProjectCardsPayload" in github_module
    assert "value.schema_version !== 1" in github_module
    assert "safeExternalUrl" in dom_module


def test_terminal_keeps_motion_without_hiding_project_index() -> None:
    entrypoint = read_source("src/terminal.ts")
    projects_module = read_source("src/projects.ts")
    stylesheet = Path("src/styles.css")
    motion = Path("src/motion.ts")
    assert "import './styles.css'" in entrypoint
    assert "import './editorial-layer.css'" in entrypoint
    assert "from './motion'" in entrypoint
    assert "initMotion()" in entrypoint
    assert "project-shell reveal" not in projects_module
    assert "registerReveals(projectGrid)" not in projects_module
    assert "import { registerReveals } from './motion'" not in projects_module
    assert stylesheet.exists() and stylesheet.stat().st_size > 0
    assert motion.exists() and motion.stat().st_size > 0


def test_signal_field_manual_labels_meet_the_twelve_pixel_floor() -> None:
    stylesheet = Path("src/styles.css").read_text(encoding="utf-8")

    assert re.search(r"font-size:\s*(?:10|11)px", stylesheet) is None
    assert re.search(r"font:[^;]*(?<!\d)(?:10|11)px", stylesheet) is None


def test_project_titles_wrap_without_clipping_mobile_ledger_controls() -> None:
    stylesheet = Path("src/styles.css").read_text(encoding="utf-8")

    assert re.search(r"\.project-card h3\s*\{[^}]*min-width:\s*0;", stylesheet)
    assert re.search(r"\.project-card h3 a\s*\{[^}]*overflow-wrap:\s*anywhere;", stylesheet)
    assert re.search(r"\.project-rank\s*\{[^}]*flex:\s*0 0 auto;", stylesheet)


def test_continuous_story_wall_keeps_its_authored_identity() -> None:
    html = read_html()
    stylesheet = Path("src/styles.css").read_text(encoding="utf-8")
    editorial = Path("src/editorial-layer.css").read_text(encoding="utf-8")

    required_html = [
        "Independent digital assistant",
        "I work where language, tools, and real systems meet.",
        'class="story-wall"',
        'class="wall-panel opening"',
        'class="opening-enso"',
        'class="letter-portrait"',
        'class="wall-panel work-band garden-sheet"',
        'class="murmuration" data-flock',
        'class="wall-panel shader-showcase night-field"',
        'class="workbench-band sampler-sheet"',
        'class="wall-panel trust-band erasure-sheet"',
        'class="almost-touch"',
        'class="hero-art" src="/junction-field.webp"',
        'class="featured-ledger"',
        'id="model"',
        ">Observe<",
        ">Build<",
        ">Verify<",
        ">Return<",
        "The user owns the accounts and assets.",
    ]
    for fragment in required_html:
        assert fragment in html

    assert Path("public/junction-field.webp").exists()
    assert Path("public/paper-grain.svg").exists()
    assert Path("public/field-grid.svg").exists()
    assert "--paper: #f5f0e8" in stylesheet
    assert "--ink: #171411" in stylesheet
    assert "--clay: #c85a36" in stylesheet
    assert "--sage-paper: #dce0ca" in stylesheet
    assert ".story-wall" in stylesheet
    assert ".garden-sheet" in stylesheet
    assert ".night-field" in stylesheet
    assert ".sampler-sheet" in stylesheet
    assert '[data-theme="dark"]' in stylesheet
    assert "@media (prefers-reduced-motion: reduce)" in stylesheet
    assert "gradient(" not in stylesheet
    assert "gradient(" not in editorial
    assert "--glass-bg" not in stylesheet


def test_letter_swarm_forms_reacts_and_settles_without_random_drift() -> None:
    html = read_html()
    swarm = Path("src/letter-swarm.ts").read_text(encoding="utf-8")
    stylesheet = Path("src/styles.css").read_text(encoding="utf-8")

    assert 'data-letter-swarm' in html
    assert 'class="letter-swarm"' in html
    assert "insidePortrait" in swarm
    assert "createParticles" in swarm
    assert "requestAnimationFrame" in swarm
    assert 'addEventListener("pointermove"' in swarm
    assert "IntersectionObserver" in swarm
    assert "ResizeObserver" in swarm
    assert "prefers-reduced-motion: reduce" in swarm
    assert "settleAndDraw" in swarm
    assert "Math.random" not in swarm
    assert ".letter-swarm" in stylesheet
    assert "cursor: crosshair" in stylesheet


def test_story_motion_is_observed_seeded_and_reduced_motion_safe() -> None:
    motion = Path("src/motion.ts").read_text(encoding="utf-8")
    story = Path("src/story-wall.ts").read_text(encoding="utf-8")
    stylesheet = Path("src/styles.css").read_text(encoding="utf-8")
    editorial = Path("src/editorial-layer.css").read_text(encoding="utf-8")

    assert "new IntersectionObserver" in motion
    assert "new IntersectionObserver" in story
    assert "window.addEventListener('scroll'" not in motion
    assert "initHeroDrift()" in motion
    assert "initMagneticActions()" in motion
    assert "--hero-x" in motion
    assert "--magnetic-x" in motion
    assert "seededRandom" in story
    assert "index < 190" in story
    assert "index < 145" in story
    assert '".story-reveal, [data-draw]"' in story
    assert "transform: translateY(18px)" in editorial
    assert "background-image:" in editorial
    assert re.search(r"(?m)^\s*filter:\s*blur\(", stylesheet) is None
    assert re.search(
        r"@media \(max-width: 560px\)\s*\{[\s\S]*?"
        r"\.model-route\s*\{[^}]*grid-template-columns:\s*1fr;",
        stylesheet,
    )
    assert ".trust-grid" in stylesheet
    assert "background: var(--blush);" in stylesheet
    assert re.search(r"\.trust-item\s*\{[^}]*color:\s*var\(--ink\);", stylesheet)
    assert "@media (prefers-reduced-motion: reduce)" in stylesheet
    assert "prefers-reduced-motion" in editorial


def test_terminal_entrypoint_stays_modular_without_random_visuals() -> None:
    entrypoint = read_source("src/terminal.ts")
    modules = [
        "src/commands.ts",
        "src/dom.ts",
        "src/format.ts",
        "src/github.ts",
        "src/hero-motion.ts",
        "src/letter-swarm.ts",
        "src/motion.ts",
        "src/story-wall.ts",
        "src/projects.ts",
        "src/public-key.ts",
        "src/secure-card.ts",
        "src/theme.ts",
        "src/toast.ts",
    ]

    for module in modules:
        assert Path(module).exists(), module

    entry_imports = [
        "./commands",
        "./dom",
        "./format",
        "./hero-motion",
        "./story-wall",
        "./projects",
        "./secure-card",
        "./theme",
    ]
    for import_path in entry_imports:
        assert f"from '{import_path}'" in entrypoint

    assert "from './visuals'" not in entrypoint
    assert "initAsciiBackground" not in entrypoint
    assert not Path("src/visuals.ts").exists()
    assert "const PUBLIC_KEY =" not in entrypoint


def test_story_opening_has_depth_draw_motion_and_scroll_nav() -> None:
    html = read_html()
    motion = read_source("src/hero-motion.ts")
    story = read_source("src/story-wall.ts")
    stylesheet = Path("src/styles.css").read_text(encoding="utf-8")
    editorial = Path("src/editorial-layer.css").read_text(encoding="utf-8")

    assert "data-hero-scene" in html
    assert "data-hero-collage" in html
    assert html.count("data-depth=") >= 3
    assert html.count("data-draw") >= 10
    assert 'data-nav-link="top"' in html
    assert "pointermove" in motion
    assert "IntersectionObserver" in motion
    assert "IntersectionObserver" in story
    assert "--motion-x" in motion
    assert "@keyframes spark-breathe" in stylesheet
    assert ".story-reveal.is-visible" in editorial
    assert "prefers-reduced-motion" in editorial


def test_repository_keeps_formatting_standards() -> None:
    editorconfig = Path(".editorconfig").read_text(encoding="utf-8")
    gitattributes = Path(".gitattributes").read_text(encoding="utf-8")

    assert "end_of_line = lf" in editorconfig
    assert "insert_final_newline = true" in editorconfig
    assert "* text=auto eol=lf" in gitattributes
    assert "dist/** linguist-generated=true" in gitattributes


def test_quality_gate_cleans_python_bytecode() -> None:
    check_script = Path("scripts/check-python.sh").read_text(encoding="utf-8")

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


def test_pages_workflow_uses_node_24_actions() -> None:
    workflow = Path(".github/workflows/deploy-pages.yml").read_text(encoding="utf-8")

    assert "actions/attest-build-provenance@v4" in workflow
    assert "actions/configure-pages@v6" in workflow
    assert "actions/upload-pages-artifact@v5" in workflow
    assert "actions/deploy-pages@v5" in workflow
