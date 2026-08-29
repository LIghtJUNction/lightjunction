import "./simple.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function revealDesk(): void {
    const marks = Array.from(document.querySelectorAll<HTMLElement>(".desk-reveal"));
    if (marks.length === 0) return;

    if (prefersReducedMotion()) {
        for (const mark of marks) mark.classList.add("is-visible");
        return;
    }

    document.documentElement.classList.add("desk-js");

    marks.forEach((mark, index) => {
        mark.style.setProperty("--desk-delay", `${80 + index * 70}ms`);
        requestAnimationFrame(() => mark.classList.add("is-visible"));
    });
}

function initDeskField(): void {
    const field = document.querySelector<HTMLElement>("[data-desk-field]");
    if (!field || prefersReducedMotion()) return;

    const drifts = Array.from(field.querySelectorAll<HTMLElement>("[data-depth]"));
    const carrier = field.querySelector<SVGPathElement>("[data-carrier-live]");
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let frame = 0;
    let started = performance.now();

    const paint = (now = performance.now()): void => {
        frame = 0;
        pointerX += (targetX - pointerX) * 0.08;
        pointerY += (targetY - pointerY) * 0.08;

        field.style.setProperty("--field-x", pointerX.toFixed(3));
        field.style.setProperty("--field-y", pointerY.toFixed(3));

        if (carrier) {
            const idle = 0.5 + Math.sin((now - started) / 1400) * 0.08;
            const progress = Math.min(0.96, Math.max(0.42, idle + pointerX * 0.18 - pointerY * 0.08));
            field.style.setProperty("--carrier-progress", progress.toFixed(3));
        }

        for (const drift of drifts) {
            const depth = Number(drift.dataset.depth ?? 0.4);
            drift.style.setProperty("--motion-x", `${pointerX * depth * 28}px`);
            drift.style.setProperty("--motion-y", `${pointerY * depth * 22}px`);
        }

        frame = requestAnimationFrame(paint);
    };

    const schedule = (): void => {
        if (!frame) frame = requestAnimationFrame(paint);
    };

    window.addEventListener(
        "pointermove",
        (event) => {
            targetX = Math.max(-0.5, Math.min(0.5, event.clientX / window.innerWidth - 0.5));
            targetY = Math.max(-0.5, Math.min(0.5, event.clientY / window.innerHeight - 0.5));
        },
        { passive: true },
    );

    window.addEventListener("blur", () => {
        targetX = 0;
        targetY = 0;
    });

    document.documentElement.addEventListener("mouseleave", () => {
        targetX = 0;
        targetY = 0;
    });

    schedule();
}

revealDesk();
initDeskField();
