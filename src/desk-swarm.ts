const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const GLYPHS =
    "signal·desk·route·tune·observe·build·verify·return·agent·tool·01<>[]{}:+-*/⌁×·";

type Point = { x: number; y: number };
type SeededRandom = () => number;

type SwarmParticle = {
    progress: number;
    speed: number;
    lateral: number;
    phase: number;
    glyph: string;
    accent: boolean;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
};

type PointerState = Point & { active: boolean };

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

function readColor(element: HTMLElement, name: string, fallback: string): string {
    return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function wavePoint(
    progress: number,
    width: number,
    height: number,
    time: number,
    pointerX: number,
    pointerY: number,
): Point {
    const t = ((progress % 1) + 1) % 1;
    const x = width * (-0.06 + t * 1.12);
    const base =
        0.5 +
        Math.sin(t * Math.PI * 2.15 + time * 0.55) * 0.11 +
        Math.sin(t * Math.PI * 5.2 + time * 0.8) * 0.035 +
        pointerY * 0.04 -
        pointerX * 0.02 * Math.sin(t * Math.PI);
    return { x, y: height * base };
}

function createParticles(width: number, height: number): SwarmParticle[] {
    const random = seededRandom(5_017);
    const count = Math.round(
        Math.min(280, Math.max(140, Math.sqrt(width * height) * 0.28)),
    );

    return Array.from({ length: count }, (_, index) => {
        const progress = random();
        const point = wavePoint(progress, width, height, 0, 0, 0);
        return {
            progress,
            speed: 0.018 + random() * 0.045,
            lateral: (random() - 0.5) * Math.min(70, height * 0.12),
            phase: random() * Math.PI * 2,
            glyph: GLYPHS[index % GLYPHS.length] ?? "·",
            accent: index % 31 === 0 || index % 53 === 0,
            x: point.x,
            y: point.y,
            velocityX: 0,
            velocityY: 0,
        };
    });
}

class DeskSwarm {
    private readonly context: CanvasRenderingContext2D;
    private readonly pointer: PointerState = { x: 0, y: 0, active: false };
    private particles: SwarmParticle[] = [];
    private frame: number | null = null;
    private active = false;
    private width = 1;
    private height = 1;
    private ink = "#c8c2b8";
    private accent = "#c9734f";
    private previousTime = 0;
    private fieldX = 0;
    private fieldY = 0;
    private started = performance.now();

    constructor(private readonly canvas: HTMLCanvasElement) {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable.");
        this.context = context;
        this.syncPalette();
        this.bind();
        this.resize();
    }

    private syncPalette(): void {
        this.ink = readColor(this.canvas, "--desk-swarm-ink", "#c8c2b8");
        this.accent = readColor(this.canvas, "--desk-swarm-accent", "#c9734f");
    }

    private bind(): void {
        window.addEventListener(
            "pointermove",
            (event) => {
                const bounds = this.canvas.getBoundingClientRect();
                this.pointer.x = event.clientX - bounds.left;
                this.pointer.y = event.clientY - bounds.top;
                this.pointer.active = true;
                this.fieldX = Math.max(
                    -0.5,
                    Math.min(0.5, event.clientX / window.innerWidth - 0.5),
                );
                this.fieldY = Math.max(
                    -0.5,
                    Math.min(0.5, event.clientY / window.innerHeight - 0.5),
                );
            },
            { passive: true },
        );
        window.addEventListener("blur", () => {
            this.pointer.active = false;
            this.fieldX = 0;
            this.fieldY = 0;
        });
        document.documentElement.addEventListener("mouseleave", () => {
            this.pointer.active = false;
        });

        const resizeObserver = new ResizeObserver(() => this.resize());
        resizeObserver.observe(this.canvas);

        if (!("IntersectionObserver" in window)) {
            this.start();
            return;
        }

        const visibility = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) this.start();
                else this.stop();
            },
            { threshold: 0.01 },
        );
        visibility.observe(this.canvas);
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
            this.drawFrame(0);
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
        const step = Math.min(2, Math.max(0.45, (time - this.previousTime) / 16.67));
        this.previousTime = time;
        this.drawFrame(time, step);
        this.frame = requestAnimationFrame((next) => this.animate(next));
    }

    private drawFrame(time: number, step = 1): void {
        const elapsed = (time - this.started) / 1000;
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.font = `500 ${Math.max(10, Math.min(15, this.width / 70))}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";

        for (const particle of this.particles) {
            this.moveParticle(particle, elapsed, step);
            this.context.fillStyle = particle.accent ? this.accent : this.ink;
            this.context.globalAlpha = particle.accent ? 0.88 : 0.28 + (particle.progress % 1) * 0.28;
            this.context.fillText(particle.glyph, particle.x, particle.y);
        }
        this.context.globalAlpha = 1;
    }

    private moveParticle(particle: SwarmParticle, elapsed: number, step: number): void {
        particle.progress += particle.speed * 0.012 * step;
        const anchor = wavePoint(
            particle.progress,
            this.width,
            this.height,
            elapsed,
            this.fieldX,
            this.fieldY,
        );
        const normalX = Math.cos(elapsed * 0.4 + particle.phase) * 0.2;
        const bob = Math.sin(elapsed * 1.3 + particle.phase) * 8;
        const targetX = anchor.x + particle.lateral * 0.15 + normalX * particle.lateral;
        const targetY = anchor.y + particle.lateral * 0.85 + bob;

        particle.velocityX += (targetX - particle.x) * 0.045 * step;
        particle.velocityY += (targetY - particle.y) * 0.045 * step;

        if (this.pointer.active) {
            const dx = particle.x - this.pointer.x;
            const dy = particle.y - this.pointer.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const radius = Math.min(160, this.width * 0.2);
            if (distance < radius) {
                const force = (1 - distance / radius) ** 1.35 * 4.2;
                particle.velocityX += (dx / distance) * force * step;
                particle.velocityY += (dy / distance) * force * step;
            }
        }

        particle.velocityX *= 0.86;
        particle.velocityY *= 0.86;
        particle.x += particle.velocityX * step;
        particle.y += particle.velocityY * step;
    }

    private settleAndDraw(): void {
        this.context.clearRect(0, 0, this.width, this.height);
        this.context.font = `500 ${Math.max(10, Math.min(15, this.width / 70))}px "IBM Plex Mono", ui-monospace, monospace`;
        this.context.textAlign = "center";
        this.context.textBaseline = "middle";
        for (const particle of this.particles) {
            const point = wavePoint(particle.progress, this.width, this.height, 0, 0, 0);
            this.context.fillStyle = particle.accent ? this.accent : this.ink;
            this.context.globalAlpha = particle.accent ? 0.8 : 0.45;
            this.context.fillText(
                particle.glyph,
                point.x + particle.lateral * 0.15,
                point.y + particle.lateral * 0.85,
            );
        }
        this.context.globalAlpha = 1;
    }
}

export function initDeskSwarm(): void {
    document
        .querySelectorAll<HTMLCanvasElement>("[data-desk-swarm]")
        .forEach((canvas) => {
            try {
                new DeskSwarm(canvas);
            } catch {
                canvas.hidden = true;
            }
        });
}
