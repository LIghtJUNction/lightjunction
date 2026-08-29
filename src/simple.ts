import "./simple.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const REVEAL_STAGGER_MS = 70;
const REVEAL_BASE_DELAY_MS = 60;
const FIELD_LERP = 0.085;
const FIELD_SETTLE = 0.01;
const FIELD_RANGE = 0.5;

type DeskPoint = {
    x: number;
    y: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}

function prefersReducedMotion(media = window.matchMedia(REDUCED_MOTION_QUERY)): boolean {
    return media.matches;
}

function setCssNumber(element: HTMLElement, name: string, value: number, digits = 3): void {
    element.style.setProperty(name, value.toFixed(digits));
}

function revealDesk(reducedMotion: boolean): void {
    const marks = Array.from(document.querySelectorAll<HTMLElement>(".desk-reveal"));
    if (marks.length === 0) return;

    if (reducedMotion) {
        for (const mark of marks) mark.classList.add("is-visible");
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const mark = entry.target as HTMLElement;
                const index = marks.indexOf(mark);
                mark.style.setProperty(
                    "--desk-delay",
                    `${REVEAL_BASE_DELAY_MS + Math.max(0, index) * REVEAL_STAGGER_MS}ms`,
                );
                mark.classList.add("is-visible");
                observer.unobserve(mark);
            }
        },
        { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    for (const mark of marks) observer.observe(mark);
}

function initDeskClock(): void {
    const clock = document.querySelector<HTMLElement>("[data-desk-clock]");
    if (!clock) return;

    const formatter = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const paint = (): void => {
        clock.textContent = `local ${formatter.format(new Date())}`;
    };

    paint();
    window.setInterval(paint, 1000);
}

function initDeskField(reducedMotion: boolean): void {
    const field = document.querySelector<HTMLElement>("[data-desk-field]");
    if (!field || reducedMotion) return;

    const drifts = Array.from(field.querySelectorAll<HTMLElement>("[data-depth]"));
    const route = field.querySelector<HTMLElement>("[data-desk-route]");
    const pointer: DeskPoint = { x: 0, y: 0 };
    const target: DeskPoint = { x: 0, y: 0 };
    let frame = 0;

    const paint = (): void => {
        frame = 0;
        pointer.x += (target.x - pointer.x) * FIELD_LERP;
        pointer.y += (target.y - pointer.y) * FIELD_LERP;

        setCssNumber(field, "--field-x", pointer.x);
        setCssNumber(field, "--field-y", pointer.y);

        if (route) {
            route.style.setProperty("--route-shift", `${pointer.x * 18}px`);
            route.style.setProperty("--route-tilt", `${pointer.y * 3.2}deg`);
        }

        for (const drift of drifts) {
            const depth = Number(drift.dataset.depth ?? 0.4);
            drift.style.setProperty("--motion-x", `${pointer.x * depth * 28}px`);
            drift.style.setProperty("--motion-y", `${pointer.y * depth * 22}px`);
        }

        if (
            Math.abs(target.x - pointer.x) > FIELD_SETTLE ||
            Math.abs(target.y - pointer.y) > FIELD_SETTLE
        ) {
            frame = requestAnimationFrame(paint);
        }
    };

    const schedule = (): void => {
        if (!frame) frame = requestAnimationFrame(paint);
    };

    const resetTarget = (): void => {
        target.x = 0;
        target.y = 0;
        schedule();
    };

    window.addEventListener(
        "pointermove",
        (event) => {
            const width = Math.max(window.innerWidth, 1);
            const height = Math.max(window.innerHeight, 1);
            target.x = clamp(event.clientX / width - 0.5, -FIELD_RANGE, FIELD_RANGE);
            target.y = clamp(event.clientY / height - 0.5, -FIELD_RANGE, FIELD_RANGE);
            schedule();
        },
        { passive: true },
    );

    window.addEventListener("blur", resetTarget);
    document.documentElement.addEventListener("mouseleave", resetTarget);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) resetTarget();
    });

    schedule();
}

function initDesk(): void {
    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const reducedMotion = prefersReducedMotion(motionQuery);

    revealDesk(reducedMotion);
    initDeskField(reducedMotion);
    initDeskClock();

    const syncMotionPreference = (): void => {
        if (!prefersReducedMotion(motionQuery)) return;
        for (const mark of document.querySelectorAll<HTMLElement>(".desk-reveal")) {
            mark.classList.add("is-visible");
            mark.style.removeProperty("--desk-delay");
        }
    };

    if (typeof motionQuery.addEventListener === "function") {
        motionQuery.addEventListener("change", syncMotionPreference);
    } else {
        motionQuery.addListener(syncMotionPreference);
    }
}

initDesk();
