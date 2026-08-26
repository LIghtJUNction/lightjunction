import shaderBody from "./shaders/neon-rift.glsl?raw";
import { SingularityForgeRenderer } from "./singularity-renderer.js";

const vertexSource = `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0); }
`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
out vec4 outColor;
${shaderBody}
void main() { mainImage(outColor, gl_FragCoord.xy); }
`;

const MAX_RENDER_PIXELS = 420_000;
const REDUCED_MOTION_QUERY = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
);
const INTERACTIVE_SELECTOR =
    "button, a, canvas, input, textarea, select, summary";

type LiveRenderer = NeonRiftRenderer | SingularityForgeRenderer;
type VisibilityController = LiveRenderer;
type ShaderAction = "pause" | "reset" | "bloom" | "quality";

function compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create the WebGL shader.");

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log =
            gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
        gl.deleteShader(shader);
        throw new Error(log);
    }
    return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create the WebGL program.");

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentSource,
    );
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log =
            gl.getProgramInfoLog(program) || "Unknown shader link error.";
        gl.deleteProgram(program);
        throw new Error(log);
    }
    return program;
}

// pi-lens-ignore: large-class
class NeonRiftRenderer {
    private readonly canvas: HTMLCanvasElement;
    private readonly gl: WebGL2RenderingContext;
    private readonly program: WebGLProgram;
    private readonly resolutionLocation: WebGLUniformLocation;
    private readonly timeLocation: WebGLUniformLocation;
    private readonly mouseLocation: WebGLUniformLocation;
    private readonly resizeObserver: ResizeObserver | null;
    private elapsed = 0;
    private previous = performance.now();
    private mouseX = 0;
    private mouseY = 0;
    private mouseDown = false;
    private visible = true;
    private paused = false;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", {
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
        });
        if (!gl) throw new Error("WebGL2 is required for this shader.");

        const program = createProgram(gl);
        const resolutionLocation = gl.getUniformLocation(
            program,
            "iResolution",
        );
        const timeLocation = gl.getUniformLocation(program, "iTime");
        const mouseLocation = gl.getUniformLocation(program, "iMouse");
        if (!resolutionLocation || !timeLocation || !mouseLocation) {
            gl.deleteProgram(program);
            throw new Error("The shader uniforms could not be resolved.");
        }

        this.canvas = canvas;
        this.gl = gl;
        this.program = program;
        this.resolutionLocation = resolutionLocation;
        this.timeLocation = timeLocation;
        this.mouseLocation = mouseLocation;
        this.resizeObserver =
            "ResizeObserver" in window
                ? new ResizeObserver(() => this.resize())
                : null;

        this.canvas.addEventListener("pointerdown", this.handlePointerDown);
        this.canvas.addEventListener("pointermove", this.handlePointerMove);
        this.canvas.addEventListener("pointerup", this.handlePointerUp);
        this.canvas.addEventListener("pointercancel", this.handlePointerCancel);
        this.resizeObserver?.observe(this.canvas);
        window.addEventListener("resize", this.resize);
    }

    start(): void {
        this.resize();
        requestAnimationFrame(this.frame);
    }

    updateVisibility(visible: boolean): void {
        this.visible = visible;
        this.previous = performance.now();
    }

    isPaused(): boolean {
        return this.paused;
    }

    togglePaused(): void {
        this.paused = !this.paused;
        this.previous = performance.now();
    }

    reset(): void {
        this.elapsed = 0;
        this.previous = performance.now();
    }

    private resize = (): void => {
        const bounds = this.canvas.getBoundingClientRect();
        const cssWidth = Math.max(1, bounds.width || this.canvas.clientWidth);
        const cssHeight = Math.max(
            1,
            bounds.height || this.canvas.clientHeight,
        );
        const deviceRatio = Math.min(window.devicePixelRatio || 1, 1.35);
        const pixelRatio = Math.min(
            deviceRatio,
            Math.sqrt(MAX_RENDER_PIXELS / (cssWidth * cssHeight)),
        );
        const width = Math.max(1, Math.floor(cssWidth * pixelRatio));
        const height = Math.max(1, Math.floor(cssHeight * pixelRatio));

        if (this.canvas.width === width && this.canvas.height === height)
            return;
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    };

    private updatePointer(event: PointerEvent): void {
        const bounds = this.canvas.getBoundingClientRect();
        this.mouseX =
            ((event.clientX - bounds.left) / Math.max(1, bounds.width)) *
            this.canvas.width;
        this.mouseY =
            ((bounds.bottom - event.clientY) / Math.max(1, bounds.height)) *
            this.canvas.height;
    }

    private handlePointerDown = (event: PointerEvent): void => {
        this.mouseDown = true;
        this.updatePointer(event);
        this.canvas.setPointerCapture(event.pointerId);
    };

    private handlePointerMove = (event: PointerEvent): void => {
        if (this.mouseDown) this.updatePointer(event);
    };

    private handlePointerUp = (event: PointerEvent): void => {
        this.mouseDown = false;
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
    };

    private handlePointerCancel = (): void => {
        this.mouseDown = false;
    };

    private frame = (now: number): void => {
        const delta = Math.min((now - this.previous) * 0.001, 0.1);
        this.previous = now;
        if (!this.paused) this.elapsed += delta;

        if (this.visible && !document.hidden) {
            this.gl.useProgram(this.program);
            this.gl.uniform3f(
                this.resolutionLocation,
                this.canvas.width,
                this.canvas.height,
                1,
            );
            this.gl.uniform1f(this.timeLocation, this.elapsed);
            this.gl.uniform4f(
                this.mouseLocation,
                this.mouseX,
                this.mouseY,
                this.mouseDown ? 1 : 0,
                0,
            );
            this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
        }

        requestAnimationFrame(this.frame);
    };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
    return (
        target instanceof Element &&
        target.closest(INTERACTIVE_SELECTOR) !== null
    );
}

function clampIndex(index: number, count: number): number {
    return Math.max(0, Math.min(count - 1, index));
}

function setActionDisabled(
    buttons: HTMLButtonElement[],
    disabled: boolean,
): void {
    for (const button of buttons) {
        button.disabled = disabled;
    }
}

function getAction(button: HTMLButtonElement): ShaderAction | null {
    const action = button.dataset.shaderAction;
    return action === "pause" ||
        action === "reset" ||
        action === "bloom" ||
        action === "quality"
        ? action
        : null;
}

function rendererStatus(renderer: LiveRenderer): string {
    return renderer instanceof SingularityForgeRenderer
        ? `Live · ${renderer.status()}`
        : "Live · drag the route";
}

function handleLiveShaderAction(
    renderer: LiveRenderer,
    action: ShaderAction,
    button: HTMLButtonElement,
    status: HTMLElement,
): void {
    if (action === "pause") {
        renderer.togglePaused();
        button.textContent = renderer.isPaused() ? "Resume" : "Pause";
        status.textContent = renderer.isPaused()
            ? "Paused · press Resume or Space"
            : rendererStatus(renderer);
        return;
    }
    if (action === "reset") {
        renderer.reset();
        status.textContent = renderer.isPaused()
            ? "Reset · paused"
            : `${rendererStatus(renderer)} · route reset`;
        return;
    }
    if (!(renderer instanceof SingularityForgeRenderer)) return;
    if (action === "bloom") {
        const enabled = renderer.toggleBloom();
        button.textContent = enabled ? "Bloom on" : "Bloom off";
        status.textContent = `Live · ${renderer.status()}`;
    } else if (action === "quality") {
        button.textContent = renderer.cycleQuality();
        status.textContent = `Live · ${renderer.status()}`;
    }
}

function initLiveShader(card: HTMLElement): LiveRenderer | null {
    const canvas = card.querySelector<HTMLCanvasElement>(
        "[data-shader-canvas]",
    );
    const status = card.querySelector<HTMLElement>("[data-shader-status]");
    const fallback = card.querySelector<HTMLElement>("[data-shader-fallback]");
    const actionButtons = Array.from(
        card.querySelectorAll<HTMLButtonElement>("[data-shader-action]"),
    );
    if (!canvas || !status || !fallback) return null;

    try {
        const renderer: LiveRenderer =
            card.dataset.shaderEngine === "singularity"
                ? new SingularityForgeRenderer(canvas)
                : new NeonRiftRenderer(canvas);
        renderer.start();
        status.textContent = rendererStatus(renderer);
        for (const button of actionButtons) {
            const action = getAction(button);
            if (!action) continue;
            button.addEventListener("click", () => {
                handleLiveShaderAction(renderer, action, button, status);
            });
        }
        return renderer;
    } catch {
        canvas.hidden = true;
        fallback.hidden = false;
        fallback.dataset.shaderError = "initialization-failed";
        status.textContent = "Fallback · WebGL2 unavailable";
        setActionDisabled(actionButtons, true);
        return null;
    }
}

type GalleryPositionController = {
    getActiveIndex: () => number;
    showCard: (index: number) => void;
    queuePositionSync: () => void;
};

type GalleryPositionOptions = {
    track: HTMLElement;
    cards: HTMLElement[];
    previousButton: HTMLButtonElement | null;
    nextButton: HTMLButtonElement | null;
    position: HTMLElement | null;
    dots: HTMLElement | null;
};

function labelShaderCards(cards: HTMLElement[]): void {
    cards.forEach((card, index) => {
        const title =
            card.querySelector("h3")?.textContent?.trim() ||
            `Shader ${index + 1}`;
        card.setAttribute("aria-roledescription", "slide");
        card.setAttribute(
            "aria-label",
            `${title} — shader study ${index + 1} of ${cards.length}`,
        );
    });
}

function renderShaderDots(
    cards: HTMLElement[],
    dots: HTMLElement | null,
): void {
    if (!dots) return;
    dots.replaceChildren(
        ...cards.map((card, index) => {
            const button = document.createElement("button");
            const title =
                card.querySelector("h3")?.textContent?.trim() ||
                `Shader ${index + 1}`;
            button.type = "button";
            button.dataset.shaderDot = String(index);
            button.setAttribute("aria-current", String(index === 0));
            button.setAttribute("aria-label", `Show ${title}`);
            const marker = document.createElement("span");
            marker.setAttribute("aria-hidden", "true");
            button.append(marker);
            return button;
        }),
    );
}

function createGalleryPositionController({
    track,
    cards,
    previousButton,
    nextButton,
    position,
    dots,
}: GalleryPositionOptions): GalleryPositionController {
    let activeIndex = 0;
    let scrollFrame: number | null = null;

    const updatePosition = (index: number): void => {
        activeIndex = clampIndex(index, cards.length);
        cards.forEach((card, cardIndex) => {
            card.classList.toggle("is-selected", cardIndex === activeIndex);
        });
        position?.replaceChildren(
            document.createTextNode(
                `${String(activeIndex + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`,
            ),
        );
        if (previousButton) previousButton.disabled = activeIndex === 0;
        if (nextButton) nextButton.disabled = activeIndex === cards.length - 1;
        dots?.querySelectorAll<HTMLButtonElement>("[data-shader-dot]").forEach(
            (button, dotIndex) => {
                button.setAttribute(
                    "aria-current",
                    String(dotIndex === activeIndex),
                );
            },
        );
    };

    const syncPosition = (): void => {
        const currentScroll = track.scrollLeft;
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        cards.forEach((card, index) => {
            const distance = Math.abs(card.offsetLeft - currentScroll);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        updatePosition(nearestIndex);
    };

    const queuePositionSync = (): void => {
        if (scrollFrame !== null) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = null;
            syncPosition();
        });
    };

    const showCard = (index: number): void => {
        const nextIndex = clampIndex(index, cards.length);
        const card = cards[nextIndex];
        if (!card) return;
        track.scrollTo({
            left: card.offsetLeft,
            behavior: REDUCED_MOTION_QUERY.matches ? "auto" : "smooth",
        });
        updatePosition(nextIndex);
    };

    updatePosition(0);
    return {
        getActiveIndex: () => activeIndex,
        showCard,
        queuePositionSync,
    };
}

function bindGalleryNavigation(
    previousButton: HTMLButtonElement | null,
    nextButton: HTMLButtonElement | null,
    dots: HTMLElement | null,
    positionController: GalleryPositionController,
): void {
    previousButton?.addEventListener("click", () =>
        positionController.showCard(positionController.getActiveIndex() - 1),
    );
    nextButton?.addEventListener("click", () =>
        positionController.showCard(positionController.getActiveIndex() + 1),
    );
    dots?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest<HTMLButtonElement>("[data-shader-dot]");
        if (!button) return;
        const index = Number(button.dataset.shaderDot);
        if (Number.isInteger(index)) positionController.showCard(index);
    });
}

function updateLiveShaderStatus(track: HTMLElement, message: string): void {
    const status = track.querySelector<HTMLElement>("[data-shader-status]");
    if (status) status.textContent = message;
}

function toggleLiveShaderFromKeyboard(
    card: HTMLElement,
    renderer: LiveRenderer,
): void {
    renderer.togglePaused();
    const pauseButton = card.querySelector<HTMLButtonElement>(
        '[data-shader-action="pause"]',
    );
    if (pauseButton)
        pauseButton.textContent = renderer.isPaused() ? "Resume" : "Pause";
    updateLiveShaderStatus(
        card,
        renderer.isPaused()
            ? "Paused · press Resume or Space"
            : rendererStatus(renderer),
    );
}

function resetLiveShaderFromKeyboard(
    card: HTMLElement,
    renderer: LiveRenderer,
): void {
    renderer.reset();
    updateLiveShaderStatus(
        card,
        renderer.isPaused()
            ? "Reset · paused"
            : `${rendererStatus(renderer)} · route reset`,
    );
}

function bindGalleryKeyboard(
    track: HTMLElement,
    cards: HTMLElement[],
    renderers: Map<HTMLElement, LiveRenderer>,
    positionController: GalleryPositionController,
): void {
    track.addEventListener("keydown", (event) => {
        if (event.target !== track) return;

        let targetIndex: number | null = null;
        if (event.key === "ArrowLeft")
            targetIndex = positionController.getActiveIndex() - 1;
        if (event.key === "ArrowRight")
            targetIndex = positionController.getActiveIndex() + 1;
        if (event.key === "Home") targetIndex = 0;
        if (event.key === "End") targetIndex = cards.length - 1;
        if (targetIndex !== null) {
            event.preventDefault();
            positionController.showCard(targetIndex);
            return;
        }

        const activeCard = cards[positionController.getActiveIndex()];
        const renderer = activeCard ? renderers.get(activeCard) : undefined;
        if (event.code === "Space" && activeCard && renderer) {
            event.preventDefault();
            toggleLiveShaderFromKeyboard(activeCard, renderer);
            return;
        }
        if (event.key.toLowerCase() === "r" && activeCard && renderer) {
            event.preventDefault();
            resetLiveShaderFromKeyboard(activeCard, renderer);
        }
    });
}

function bindTrackPointerDrag(
    track: HTMLElement,
    queuePositionSync: () => void,
): void {
    let dragPointerId: number | null = null;
    let dragStartX = 0;
    let dragStartScroll = 0;

    track.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || isInteractiveTarget(event.target)) return;
        dragPointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartScroll = track.scrollLeft;
        track.classList.add("is-dragging");
        track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointermove", (event) => {
        if (dragPointerId !== event.pointerId) return;
        track.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    });
    const endDrag = (event: PointerEvent): void => {
        if (dragPointerId !== event.pointerId) return;
        dragPointerId = null;
        track.classList.remove("is-dragging");
        if (track.hasPointerCapture(event.pointerId)) {
            track.releasePointerCapture(event.pointerId);
        }
        queuePositionSync();
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
}

function observeShaderPreviews(
    renderers: Map<HTMLElement, LiveRenderer>,
): void {
    const targets = new Map<Element, VisibilityController>();
    for (const [card, renderer] of renderers) {
        const canvas = card.querySelector<HTMLCanvasElement>(
            "[data-shader-canvas]",
        );
        if (canvas) targets.set(canvas, renderer);
    }

    if (!("IntersectionObserver" in window)) {
        for (const controller of targets.values())
            controller.updateVisibility(true);
        return;
    }
    for (const controller of targets.values())
        controller.updateVisibility(false);

    const visibilityObserver = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                targets
                    .get(entry.target)
                    ?.updateVisibility(entry.intersectionRatio >= 0.6);
            }
        },
        { threshold: 0.6 },
    );
    for (const target of targets.keys()) visibilityObserver.observe(target);
}

function initGallery(): void {
    const track = document.querySelector<HTMLElement>("[data-shader-track]");
    if (!track) return;
    const cards = Array.from(
        track.querySelectorAll<HTMLElement>("[data-shader-card]"),
    );
    if (cards.length === 0) return;

    const previousButton = document.querySelector<HTMLButtonElement>(
        "[data-shader-previous]",
    );
    const nextButton =
        document.querySelector<HTMLButtonElement>("[data-shader-next]");
    const position = document.querySelector<HTMLElement>(
        "[data-shader-position]",
    );
    const dots = document.querySelector<HTMLElement>("[data-shader-dots]");

    labelShaderCards(cards);
    renderShaderDots(cards, dots);
    const renderers = new Map<HTMLElement, LiveRenderer>();
    for (const card of cards) {
        if (!card.querySelector("[data-shader-canvas]")) continue;
        const renderer = initLiveShader(card);
        if (renderer) renderers.set(card, renderer);
    }
    const positionController = createGalleryPositionController({
        track,
        cards,
        previousButton,
        nextButton,
        position,
        dots,
    });
    bindGalleryNavigation(previousButton, nextButton, dots, positionController);
    track.addEventListener("scroll", positionController.queuePositionSync, {
        passive: true,
    });
    bindGalleryKeyboard(track, cards, renderers, positionController);
    bindTrackPointerDrag(track, positionController.queuePositionSync);
    observeShaderPreviews(renderers);
}

// The gallery entrypoint is kept explicit so future shader cards can share the same controller.
export function mountShaderShowcase(): void {
    initGallery();
}
