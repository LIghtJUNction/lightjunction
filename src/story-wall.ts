import { initLetterSwarms } from "./letter-swarm.js";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function setNumberVariable(
    element: HTMLElement,
    name: string,
    value: number,
): void {
    element.style.setProperty(name, value.toFixed(2));
}

function populateFlock(container: HTMLElement): void {
    if (container.childElementCount > 0) return;

    const random = seededRandom(1919);
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 190; index += 1) {
        const mark = document.createElement("i");
        const x = random() * 100;
        const center = 45 + Math.sin((x / 100) * Math.PI * 2.25) * 15;
        const taper = 8 + Math.abs(x - 50) * 0.28;
        const y = clamp(center + (random() - 0.5) * taper * 2, 4, 96);

        mark.className = "flock-mark";
        mark.setAttribute("aria-hidden", "true");
        setNumberVariable(mark, "--x", x);
        setNumberVariable(mark, "--y", y);
        setNumberVariable(mark, "--r", (random() - 0.5) * 36);
        setNumberVariable(mark, "--s", 0.48 + random() * 1.05);
        setNumberVariable(mark, "--o", 0.18 + random() * 0.56);
        mark.style.setProperty("--drift-from-x", `${(random() - 0.5) * 6}px`);
        mark.style.setProperty("--drift-from-y", `${(random() - 0.5) * 5}px`);
        mark.style.setProperty("--drift-to-x", `${(random() - 0.5) * 11}px`);
        mark.style.setProperty("--drift-to-y", `${(random() - 0.5) * 8}px`);
        mark.style.setProperty("--duration", `${3.4 + random() * 5.2}s`);
        mark.style.setProperty("--delay", `${random() * -7}s`);

        if (index === 34 || index === 117 || index === 173) {
            mark.classList.add("is-lone");
        }
        fragment.append(mark);
    }

    container.append(fragment);
}

function populateStars(container: HTMLElement): void {
    if (container.childElementCount > 0) return;

    const random = seededRandom(7331);
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < 145; index += 1) {
        const star = document.createElement("i");
        star.className = "star-mark";
        star.setAttribute("aria-hidden", "true");
        setNumberVariable(star, "--x", random() * 100);
        setNumberVariable(star, "--y", random() * 100);
        setNumberVariable(star, "--s", 1 + random() * 2.4);
        setNumberVariable(star, "--o", 0.12 + random() * 0.5);
        star.style.setProperty("--duration", `${2.2 + random() * 5.8}s`);
        star.style.setProperty("--delay", `${random() * -8}s`);

        if (index % 23 === 0) star.classList.add("is-gold");
        fragment.append(star);
    }

    container.append(fragment);
}

function revealImmediately(): void {
    document.querySelectorAll<HTMLElement>(".story-reveal").forEach((element) => {
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
                    element.hasAttribute("data-draw") ? "is-drawn" : "is-visible",
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
        .querySelectorAll<HTMLElement | SVGElement>(".story-reveal, [data-draw]")
        .forEach((element) => observer.observe(element));
}

function initResponsiveFields(): void {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    document.querySelectorAll<HTMLElement>("[data-responsive-field]").forEach((field) => {
        const panel = field.closest<HTMLElement>(".wall-panel");
        if (!panel) return;

        panel.addEventListener("pointermove", (event) => {
            const bounds = panel.getBoundingClientRect();
            setNumberVariable(field, "--field-x", ((event.clientX - bounds.left) / bounds.width - 0.5) * 2);
            setNumberVariable(field, "--field-y", ((event.clientY - bounds.top) / bounds.height - 0.5) * 2);
        });
        panel.addEventListener("pointerleave", () => {
            setNumberVariable(field, "--field-x", 0);
            setNumberVariable(field, "--field-y", 0);
        });
    });
}

function initPaperTilt(): void {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    document.querySelectorAll<HTMLElement>("[data-paper-tilt]").forEach((paper) => {
        paper.addEventListener("pointermove", (event) => {
            const bounds = paper.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 9;
            const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 9;
            paper.style.setProperty("--paper-x", `${x.toFixed(2)}px`);
            paper.style.setProperty("--paper-y", `${y.toFixed(2)}px`);
        });
        paper.addEventListener("pointerleave", () => {
            paper.style.setProperty("--paper-x", "0px");
            paper.style.setProperty("--paper-y", "0px");
        });
    });
}

function initToneObserver(): void {
    const night = document.querySelector<HTMLElement>("[data-story-tone='night']");
    if (!night || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
        ([entry]) => {
            document.body.dataset.storyTone = entry?.isIntersecting ? "night" : "paper";
        },
        { rootMargin: "-22% 0px -62%", threshold: 0 },
    );
    observer.observe(night);
}

function initScrollDynamics(): void {
    const opening = document.querySelector<HTMLElement>(".opening");
    const depthElements = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scroll-depth]"),
    );
    let frame: number | null = null;

    const update = () => {
        const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = clamp(window.scrollY / range, 0, 1);
        document.documentElement.style.setProperty("--story-progress", progress.toFixed(4));

        if (opening) {
            const bounds = opening.getBoundingClientRect();
            const openingRange = Math.max(1, bounds.height - window.innerHeight * 0.55);
            const openingProgress = clamp(-bounds.top / openingRange, 0, 1);
            opening.style.setProperty("--opening-progress", openingProgress.toFixed(4));
        }

        if (!window.matchMedia(REDUCED_MOTION_QUERY).matches) {
            depthElements.forEach((element) => {
                const bounds = element.getBoundingClientRect();
                if (bounds.bottom < -200 || bounds.top > window.innerHeight + 200) return;
                const depth = Number.parseFloat(element.dataset.scrollDepth ?? "0");
                const offset = clamp(
                    (window.innerHeight / 2 - (bounds.top + bounds.height / 2)) * depth,
                    -28,
                    28,
                );
                element.style.setProperty("--scroll-shift", `${offset.toFixed(2)}px`);
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
    document.querySelectorAll<HTMLElement>("[data-flock]").forEach(populateFlock);
    document.querySelectorAll<HTMLElement>("[data-stars]").forEach(populateStars);
    initLetterSwarms();
    observeStoryMarks();
    initResponsiveFields();
    initPaperTilt();
    initToneObserver();
    initScrollDynamics();
}
