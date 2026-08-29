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

function showMark(mark: HTMLElement, index: number, animated: boolean): void {
    if (animated) {
        mark.style.setProperty(
            "--desk-delay",
            `${REVEAL_BASE_DELAY_MS + index * REVEAL_STAGGER_MS}ms`,
        );
    } else {
        mark.style.removeProperty("--desk-delay");
    }
    mark.classList.add("is-visible");
}

function revealDesk(reducedMotion: boolean): void {
    const marks = Array.from(document.querySelectorAll<HTMLElement>(".desk-reveal"));
    if (marks.length === 0) return;

    if (reducedMotion || typeof IntersectionObserver !== "function") {
        marks.forEach((mark, index) => showMark(mark, index, false));
        return;
    }

    // Progressive enhancement: only hide once JS can restore visibility.
    document.documentElement.classList.add("desk-js");

    const revealVisible = (): void => {
        const viewportBottom = window.innerHeight * 0.96;
        marks.forEach((mark, index) => {
            if (mark.classList.contains("is-visible")) return;
            const rect = mark.getBoundingClientRect();
            if (rect.top < viewportBottom && rect.bottom > 0) {
                showMark(mark, index, true);
            }
        });
    };

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const mark = entry.target as HTMLElement;
                const index = marks.indexOf(mark);
                showMark(mark, Math.max(0, index), true);
                observer.unobserve(mark);
            }
        },
        { threshold: 0.05, rootMargin: "0px 0px -4% 0px" },
    );

    for (const mark of marks) observer.observe(mark);

    // Headless browsers and some first paints skip IO callbacks; force in-view reveals.
    requestAnimationFrame(() => {
        revealVisible();
        window.setTimeout(revealVisible, 120);
    });
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
        document.querySelectorAll<HTMLElement>(".desk-reveal").forEach((mark, index) => {
            showMark(mark, index, false);
        });
    };

    if (typeof motionQuery.addEventListener === "function") {
        motionQuery.addEventListener("change", syncMotionPreference);
    } else {
        motionQuery.addListener(syncMotionPreference);
    }
}

initDesk();
