import { initAsciiJunctions } from "./ascii-junction.js";
import { initLetterSwarms } from "./letter-swarm.js";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function revealImmediately(): void {
    document
        .querySelectorAll<HTMLElement>(".story-reveal")
        .forEach((element) => {
            element.classList.add("is-visible");
        });
    document.querySelectorAll<SVGElement>("[data-draw]").forEach((element) => {
        element.classList.add("is-drawn");
    });
}

function observeStoryMarks(): void {
    if (
        !("IntersectionObserver" in window) ||
        window.matchMedia(REDUCED_MOTION_QUERY).matches
    ) {
        revealImmediately();
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const element = entry.target as HTMLElement | SVGElement;
                element.classList.add(
                    element.hasAttribute("data-draw")
                        ? "is-drawn"
                        : "is-visible",
                );
                observer.unobserve(element);
            });
        },
        {
            rootMargin: "0px 0px -8%",
            threshold: 0.08,
        },
    );

    document
        .querySelectorAll<
            HTMLElement | SVGElement
        >(".story-reveal, [data-draw]")
        .forEach((element) => observer.observe(element));
}

function initScrollDynamics(): void {
    const opening = document.querySelector<HTMLElement>(".opening");
    const depthElements = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scroll-depth]"),
    );
    let frame: number | null = null;

    const update = () => {
        const range = Math.max(
            1,
            document.documentElement.scrollHeight - window.innerHeight,
        );
        const progress = clamp(window.scrollY / range, 0, 1);
        document.documentElement.style.setProperty(
            "--story-progress",
            progress.toFixed(4),
        );

        if (opening) {
            const bounds = opening.getBoundingClientRect();
            const openingRange = Math.max(
                1,
                bounds.height - window.innerHeight * 0.55,
            );
            const openingProgress = clamp(-bounds.top / openingRange, 0, 1);
            opening.style.setProperty(
                "--opening-progress",
                openingProgress.toFixed(4),
            );
        }

        if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) {
            depthElements.forEach((element) => {
                const bounds = element.getBoundingClientRect();
                if (
                    bounds.bottom < -200 ||
                    bounds.top > window.innerHeight + 200
                )
                    return;
                const depth = Number.parseFloat(
                    element.dataset.scrollDepth ?? "0",
                );
                const offset = clamp(
                    (window.innerHeight / 2 -
                        (bounds.top + bounds.height / 2)) *
                        depth,
                    -28,
                    28,
                );
                element.style.setProperty(
                    "--scroll-shift",
                    `${offset.toFixed(2)}px`,
                );
            });
        }
        frame = null;
    };

    const schedule = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
}

export function initStoryWall(): void {
    initAsciiJunctions();
    initLetterSwarms();
    observeStoryMarks();
    initScrollDynamics();
}
