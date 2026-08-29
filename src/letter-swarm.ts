const GLYPHS =
    "agent·tool·memory·shell·signal·route·code·system·verify·return·01<>[]{}";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface Point {
    x: number;
    y: number;
}

interface GlyphParticle extends Point {
    targetX: number;
    targetY: number;
    velocityX: number;
    velocityY: number;
    phase: number;
    glyph: string;
    accent: boolean;
}

interface PointerState extends Point {
    active: boolean;
}

type SeededRandom = () => number;

function seededRandom(seed: number): SeededRandom {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function insidePortrait(x: number, y: number): boolean {
    const headX = (x - 0.515) / 0.155;
    const headY = (y - 0.265) / 0.205;
    const insideHead = headX * headX + headY * headY <= 1;
    const insideEar =
        ((x - 0.358) / 0.032) ** 2 + ((y - 0.29) / 0.065) ** 2 <= 1;
    const insideNeck = y >= 0.43 && y <= 0.59 && Math.abs(x - 0.5) < 0.085;
    const bodyProgress = Math.max(0, Math.min(1, (y - 0.5) / 0.46));
    const shoulderWidth = 0.105 + Math.sin(bodyProgress * Math.PI * 0.58) * 0.3;
    const bodyCenter = 0.5 - bodyProgress * 0.025;
    const insideBody =
        y >= 0.5 && y <= 0.96 && Math.abs(x - bodyCenter) < shoulderWidth;
    return insideHead || insideEar || insideNeck || insideBody;
}

function makeTarget(
    random: SeededRandom,
    width: number,
    height: number,
): Point {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const x = 0.08 + random() * 0.84;
        const y = 0.035 + random() * 0.93;
        if (insidePortrait(x, y)) return { x: x * width, y: y * height };
    }
    return { x: width / 2, y: height / 2 };
}

function makeStart(random: SeededRandom, width: number, height: number): Point {
    if (random() < 0.74) {
        return { x: random() * width, y: random() * height };
    }
    const edge = Math.floor(random() * 4);
    if (edge === 0)
        return { x: random() * width, y: -random() * height * 0.18 };
    if (edge === 1)
        return { x: width * (1 + random() * 0.25), y: random() * height };
    if (edge === 2)
        return { x: random() * width, y: height * (1 + random() * 0.25) };
    return { x: -random() * width * 0.25, y: random() * height };
}

function createParticles(width: number, height: number): GlyphParticle[] {
    const random = seededRandom(4049);
    const count = Math.round(
        Math.min(920, Math.max(380, Math.sqrt(width * height) * 0.92)),
    );
    return Array.from({ length: count }, (_, index) => {
        const target = makeTarget(random, width, height);
        const start = makeStart(random, width, height);
        return {
            ...start,
            targetX: target.x,
            targetY: target.y,
            velocityX: (random() - 0.5) * 5,
            velocityY: (random() - 0.5) * 5,
            phase: random() * Math.PI * 2,
            glyph: GLYPHS[index % GLYPHS.length] ?? "·",
            accent: index % 47 === 0,
        };
    });
}

function readColor(
    element: HTMLElement,
    name: string,
    fallback: string,
): string {
    return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

class LetterSwarm {
    private readonly context: CanvasRenderingContext2D;
    private readonly pointer: PointerState = { x: 0, y: 0, active: false };
    private particles: GlyphParticle[] = [];
    private frame: number | null = null;
    private active = false;
    private width = 1;
    private height = 1;
    private ink = "#e8ebe6";
    private accent = "#3157ff";
    private previousTime = 0;

    constructor(private readonly canvas: HTMLCanvasElement) {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable.");
        this.context = context;
        this.syncPalette();
        this.bind();
        this.resize();
    }

    private syncPalette(): void {
        this.ink = readColor(this.canvas, "--swarm-ink", "#e8ebe6");
        this.accent = readColor(this.canvas, "--swarm-accent", "#3157ff");
    }

    private bind(): void {
        this.canvas.addEventListener("pointermove", (event) => {
            const bounds = this.canvas.getBoundingClientRect();
            this.pointer.x = event.clientX - bounds.left;
            this.pointer.y = event.clientY - bounds.top;
            this.pointer.active = true;
        });
        this.canvas.addEventListener("pointerleave", () => {
            this.pointer.active = false;
        });

        const resizeObserver = new ResizeObserver(() => this.resize());
        resizeObserver.observe(this.canvas);

        const themeObserver = new MutationObserver(() => {
            this.syncPalette();
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        if (!("IntersectionObserver" in window)) {
            this.start();
            return;
        }
        const visibilityObserver = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) this.start();
                else this.stop();
            },
            { rootMargin: "20% 0px", threshold: 0.01 },
        );
        visibilityObserver.observe(this.canvas);
    }

    private resize(): void {
        const bounds = this.canvas.getBoundingClientRect();
        if (bounds.width < 1 || bounds.height < 1) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        this.width = bounds.width;
        this.height = bounds.height;
        this.canvas.width = Math.round(this.width * ratio);
        this.canvas.height = Math.round(this.height * ratio);
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.particles = createParticles(this.width, this.height);

        if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
            this.settleAndDraw();
        } else {
            this.drawInitialField();
        }
    }

    private start(): void {
        if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
            this.settleAndDraw();
            return;
        }
        if (this.active) return;
        this.active = true;
        this.previousTime = performance.now();
        this.frame = requestAnimationFrame((time) => this.animate(time));
    }

    private stop(): void {
        this.active = false;
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    private animate(time: number): void {
        if (!this.active) return;
        const step = Math.min(
            2,
            Math.max(0.45, (time - this.previousTime) / 16.67),
        );
        this.previousTime = time;
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.font = `500 ${Math.max(9, Math.min(14, this.width / 62))}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";

        for (const particle of this.particles) {
            this.moveParticle(particle, time, step);
            const displacement = Math.min(
                1,
                Math.hypot(
                    particle.targetX - particle.x,
                    particle.targetY - particle.y,
                ) / 90,
            );
            this.context.fillStyle = particle.accent ? this.accent : this.ink;
            this.context.globalAlpha = 0.38 + displacement * 0.42;
            this.context.fillText(particle.glyph, particle.x, particle.y);
        }
        this.context.globalAlpha = 1;
        this.frame = requestAnimationFrame((nextTime) =>
            this.animate(nextTime),
        );
    }

    private moveParticle(
        particle: GlyphParticle,
        time: number,
        step: number,
    ): void {
        const driftX = Math.sin(time * 0.0007 + particle.phase) * 0.032;
        const driftY = Math.cos(time * 0.0009 + particle.phase) * 0.026;
        particle.velocityX +=
            ((particle.targetX - particle.x) * 0.014 + driftX) * step;
        particle.velocityY +=
            ((particle.targetY - particle.y) * 0.014 + driftY) * step;

        if (this.pointer.active) {
            const dx = particle.x - this.pointer.x;
            const dy = particle.y - this.pointer.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const radius = Math.min(175, this.width * 0.23);
            if (distance < radius) {
                const force = (1 - distance / radius) ** 1.4 * 3.2;
                particle.velocityX +=
                    ((dx / distance) * force - (dy / distance) * force * 0.16) *
                    step;
                particle.velocityY +=
                    ((dy / distance) * force + (dx / distance) * force * 0.16) *
                    step;
            }
        }

        particle.velocityX *= 0.885;
        particle.velocityY *= 0.885;
        particle.x += particle.velocityX * step;
        particle.y += particle.velocityY * step;
    }

    private drawInitialField(): void {
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.globalAlpha = 0.28;
        this.context.font = `500 ${Math.max(9, Math.min(14, this.width / 62))}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";
        this.particles.forEach((particle) => {
            this.context.fillStyle = particle.accent ? this.accent : this.ink;
            this.context.fillText(particle.glyph, particle.x, particle.y);
        });
        this.context.globalAlpha = 1;
    }

    private settleAndDraw(): void {
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.globalAlpha = 0.72;
        this.context.font = `500 ${Math.max(9, Math.min(14, this.width / 62))}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";
        this.particles.forEach((particle) => {
            this.context.fillStyle = particle.accent ? this.accent : this.ink;
            this.context.fillText(
                particle.glyph,
                particle.targetX,
                particle.targetY,
            );
        });
        this.context.globalAlpha = 1;
    }
}

export function initLetterSwarms(): void {
    document
        .querySelectorAll<HTMLCanvasElement>("[data-letter-swarm]")
        .forEach((canvas) => {
            try {
                new LetterSwarm(canvas);
            } catch {
                canvas.hidden = true;
            }
        });
}
