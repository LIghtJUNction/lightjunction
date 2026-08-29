const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const GLYPHS = "observebuildverifyreturnagenttoolmemorysignalroute01<>[]{}:+-*/";
const LABELS = ["OBSERVE", "BUILD", "VERIFY", "RETURN"] as const;

type Point = { x: number; y: number };
type SeededRandom = () => number;

type Track = {
    start: Point;
    ingress: Point;
    junction: Point;
    egress: Point;
    end: Point;
};

type AsciiParticle = {
    track: number;
    progress: number;
    speed: number;
    offset: number;
    glyph: string;
    accent: boolean;
    alpha: number;
};

const TRACKS: readonly Track[] = [
    {
        start: { x: -0.08, y: 0.18 },
        ingress: { x: 0.2, y: 0.08 },
        junction: { x: 0.51, y: 0.47 },
        egress: { x: 0.82, y: 0.36 },
        end: { x: 1.08, y: 0.12 },
    },
    {
        start: { x: 0.17, y: -0.08 },
        ingress: { x: 0.24, y: 0.3 },
        junction: { x: 0.51, y: 0.47 },
        egress: { x: 0.72, y: 0.75 },
        end: { x: 0.88, y: 1.08 },
    },
    {
        start: { x: 1.08, y: 0.24 },
        ingress: { x: 0.78, y: 0.17 },
        junction: { x: 0.51, y: 0.47 },
        egress: { x: 0.26, y: 0.62 },
        end: { x: -0.08, y: 0.82 },
    },
    {
        start: { x: 0.55, y: -0.08 },
        ingress: { x: 0.61, y: 0.25 },
        junction: { x: 0.51, y: 0.47 },
        egress: { x: 0.43, y: 0.76 },
        end: { x: 0.49, y: 1.08 },
    },
];

function seededRandom(seed: number): SeededRandom {
    let value = seed >>> 0;
    return () => {
        value += 0x6d2b79f5;
        let mixed = value;
        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function quadratic(start: Point, control: Point, end: Point, t: number): Point {
    const inverse = 1 - t;
    return {
        x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
        y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
}

function getTrack(index: number): Track {
    const track = TRACKS[index];
    if (!track) throw new Error(`Unknown ASCII junction track: ${index}`);
    return track;
}

function trackPoint(track: Track, progress: number): Point {
    if (progress <= 0.5) {
        return quadratic(track.start, track.ingress, track.junction, progress * 2);
    }
    return quadratic(
        track.junction,
        track.egress,
        track.end,
        (progress - 0.5) * 2,
    );
}

function makeParticles(width: number, height: number): AsciiParticle[] {
    const random = seededRandom(7_731);
    const count = Math.round(
        Math.min(360, Math.max(200, Math.sqrt(width * height) * 0.32)),
    );
    return Array.from({ length: count }, (_, index) => ({
        track: index % TRACKS.length,
        progress: random(),
        speed: 0.000012 + random() * 0.000022,
        offset: (random() - 0.5) * (24 + random() * 54),
        glyph: GLYPHS[index % GLYPHS.length] ?? "+",
        accent: index % 41 === 0,
        alpha: 0.18 + random() * 0.46,
    }));
}

function readColor(
    element: HTMLElement,
    property: string,
    fallback: string,
): string {
    return getComputedStyle(element).getPropertyValue(property).trim() || fallback;
}

// pi-lens-ignore: large-class -- one canvas lifecycle keeps resize, input, and render state synchronized.
class AsciiJunction {
    private readonly context: CanvasRenderingContext2D;
    private readonly pointer = { x: 0, y: 0, active: false };
    private particles: AsciiParticle[] = [];
    private frame: number | null = null;
    private width = 1;
    private height = 1;
    private ink = "#d8d5cd";
    private signal = "#d57a54";
    private readonly scene: HTMLElement | null;
    private visible = true;
    private lastTime = 0;
    private elapsed = 0;

    constructor(private readonly canvas: HTMLCanvasElement) {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable.");
        this.context = context;
        this.scene = canvas.closest<HTMLElement>(".opening");
        this.syncPalette();
        this.bind();
        this.resize();
    }

    private bind(): void {
        const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
        const resizeObserver = new ResizeObserver(() => this.resize());
        resizeObserver.observe(this.canvas);

        const visibilityObserver = new IntersectionObserver(
            ([entry]) => {
                this.visible = entry?.isIntersecting ?? false;
                if (this.visible) this.start();
                else this.stop();
            },
            { rootMargin: "180px 0px" },
        );
        visibilityObserver.observe(this.canvas);

        this.canvas.addEventListener("pointermove", (event) => {
            const bounds = this.canvas.getBoundingClientRect();
            this.pointer.x = event.clientX - bounds.left;
            this.pointer.y = event.clientY - bounds.top;
            this.pointer.active = true;
        });
        this.canvas.addEventListener("pointerleave", () => {
            this.pointer.active = false;
        });

        reducedMotion.addEventListener("change", () => {
            if (reducedMotion.matches) {
                this.stop();
                this.draw(0, true);
            } else if (this.visible) {
                this.start();
            }
        });

        const themeObserver = new MutationObserver(() => {
            this.syncPalette();
            if (reducedMotion.matches) this.draw(0, true);
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
    }

    private syncPalette(): void {
        this.ink = readColor(this.canvas, "--ascii-ink", "#d8d5cd");
        this.signal = readColor(
            this.canvas,
            "--ascii-signal",
            "#d57a54",
        );
    }

    private resize(): void {
        const bounds = this.canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        this.width = Math.max(1, bounds.width);
        this.height = Math.max(1, bounds.height);
        this.canvas.width = Math.max(1, Math.round(this.width * ratio));
        this.canvas.height = Math.max(1, Math.round(this.height * ratio));
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.particles = makeParticles(this.width, this.height);
        this.draw(this.elapsed, window.matchMedia(REDUCED_MOTION_QUERY).matches);
    }

    private start(): void {
        if (this.frame !== null || window.matchMedia(REDUCED_MOTION_QUERY).matches)
            return;
        this.lastTime = performance.now();
        this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    private stop(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    private tick(time: number): void {
        const elapsedSinceDraw = Math.max(0, time - this.lastTime);
        if (elapsedSinceDraw >= 32) {
            this.lastTime = time;
            this.elapsed += Math.min(64, elapsedSinceDraw);
            this.draw(this.elapsed, false);
        }
        this.frame = requestAnimationFrame((next) => this.tick(next));
    }

    private resolvePoint(
        particle: AsciiParticle,
        elapsed: number,
        scrollProgress: number,
    ): Point {
        const progress =
            (particle.progress + elapsed * particle.speed + scrollProgress * 0.12) %
            1;
        const track = getTrack(particle.track);
        const point = trackPoint(track, progress);
        const ahead = trackPoint(track, Math.min(1, progress + 0.002));
        const tangentX = (ahead.x - point.x) * this.width;
        const tangentY = (ahead.y - point.y) * this.height;
        const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY));
        let x = point.x * this.width - (tangentY / tangentLength) * particle.offset;
        let y = point.y * this.height + (tangentX / tangentLength) * particle.offset;

        if (this.pointer.active) {
            const dx = x - this.pointer.x;
            const dy = y - this.pointer.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const radius = Math.min(170, this.width * 0.18);
            if (distance < radius) {
                const force = (1 - distance / radius) ** 1.7 * 62;
                x += (dx / distance) * force;
                y += (dy / distance) * force;
            }
        }
        return { x, y };
    }

    private draw(elapsed: number, settled: boolean): void {
        this.context.clearRect(0, 0, this.width, this.height);
        const fontSize = Math.max(9, Math.min(13, this.width / 92));
        this.context.font = `500 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";

        const scrollProgress = Number.parseFloat(
            getComputedStyle(this.scene ?? document.documentElement)
                .getPropertyValue("--opening-progress") || "0",
        );
        for (const particle of this.particles) {
            const point = this.resolvePoint(
                particle,
                settled ? 0 : elapsed,
                scrollProgress,
            );
            const centerDistance = Math.hypot(
                point.x - this.width * 0.51,
                point.y - this.height * 0.47,
            );
            const centerGlow = Math.max(0, 1 - centerDistance / 180);
            this.context.fillStyle = particle.accent ? this.signal : this.ink;
            this.context.globalAlpha = Math.min(
                0.82,
                particle.alpha + centerGlow * 0.26,
            );
            this.context.fillText(particle.glyph, point.x, point.y);
        }

        this.drawJunctionLabels();
        this.context.globalAlpha = 1;
    }

    private drawJunctionLabels(): void {
        const centerX = this.width * 0.51;
        const centerY = this.height * 0.47;
        this.context.fillStyle = this.signal;
        this.context.globalAlpha = 0.9;
        this.context.font = `500 ${Math.max(10, Math.min(14, this.width / 86))}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.fillText("+", centerX, centerY);

        const positions: readonly Point[] = [
            { x: 0.08, y: 0.16 },
            { x: 0.84, y: 0.11 },
            { x: 0.82, y: 0.88 },
            { x: 0.09, y: 0.82 },
        ];
        this.context.textAlign = "left";
        this.context.font = `500 ${Math.max(8, Math.min(10, this.width / 120))}px "IBM Plex Mono", ui-monospace, monospace`;
        positions.forEach((position, index) => {
            this.context.globalAlpha = 0.48;
            this.context.fillText(
                LABELS[index] ?? "SIGNAL",
                position.x * this.width,
                position.y * this.height,
            );
        });
    }
}

export function initAsciiJunctions(): void {
    const canvases = document.querySelectorAll<HTMLCanvasElement>(
        "[data-ascii-junction]",
    );
    for (const canvas of canvases) new AsciiJunction(canvas);
}
