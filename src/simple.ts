import "./simple.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LOOP_TICK_MS = 1400;

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
        mark.style.setProperty("--desk-delay", `${70 + index * 65}ms`);
        requestAnimationFrame(() => mark.classList.add("is-visible"));
    });
}

function buildCarrierPath(time: number, pointerX: number, pointerY: number): string {
    const wave = (speed: number, phase: number, amount: number): number =>
        Math.sin(time * speed + phase) * amount;

    const y0 = 420 + wave(0.7, 0, 34) + pointerY * 48;
    const c1 = y0 - 150 + wave(0.9, 1.2, 28) - pointerX * 18;
    const c2 = y0 + 130 + wave(1.1, 0.4, 36) + pointerX * 22;
    const y1 = 390 + wave(0.85, 1.7, 42) + pointerX * 36 - pointerY * 12;
    const y2 = 250 + wave(0.95, 2.4, 38) - pointerY * 30;
    const y3 = 410 + wave(1.05, 0.8, 40) + pointerX * 20 + pointerY * 18;
    const y4 = 340 + wave(0.75, 2.1, 32) - pointerX * 16;

    return [
        `M-40 ${y0.toFixed(1)}`,
        `C180 ${c1.toFixed(1)} 320 ${c2.toFixed(1)} 520 ${y1.toFixed(1)}`,
        `S820 ${y2.toFixed(1)} 980 ${y3.toFixed(1)}`,
        `1180 ${(y3 + 140).toFixed(1)} 1240 ${y4.toFixed(1)}`,
    ].join(" ");
}

function initDeskField(): void {
    const field = document.querySelector<HTMLElement>("[data-desk-field]");
    if (!field || prefersReducedMotion()) return;

    const drifts = Array.from(field.querySelectorAll<HTMLElement>("[data-depth]"));
    const live = field.querySelector<SVGPathElement>("[data-carrier-live]");
    const ghost = field.querySelector<SVGPathElement>("[data-carrier-ghost]");
    const pulse = field.querySelector<SVGPathElement>("[data-carrier-pulse]");
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const started = performance.now();

    const paint = (now = performance.now()): void => {
        requestAnimationFrame(paint);
        pointerX += (targetX - pointerX) * 0.09;
        pointerY += (targetY - pointerY) * 0.09;

        const elapsed = (now - started) / 1000;
        field.style.setProperty("--field-x", pointerX.toFixed(3));
        field.style.setProperty("--field-y", pointerY.toFixed(3));

        const path = buildCarrierPath(elapsed, pointerX, pointerY);
        if (live) live.setAttribute("d", path);
        if (ghost) ghost.setAttribute("d", path);
        if (pulse) pulse.setAttribute("d", path);

        const progress = Math.min(
            0.98,
            Math.max(0.38, 0.58 + Math.sin(elapsed * 0.85) * 0.16 + pointerX * 0.2),
        );
        field.style.setProperty("--carrier-progress", progress.toFixed(3));
        field.style.setProperty(
            "--carrier-pulse",
            (0.18 + ((elapsed * 0.22 + pointerX * 0.1) % 1)).toFixed(3),
        );

        for (const drift of drifts) {
            const depth = Number(drift.dataset.depth ?? 0.4);
            const bobX = Math.sin(elapsed * (0.7 + depth) + depth * 4) * 10 * depth;
            const bobY = Math.cos(elapsed * (0.9 + depth) + depth * 2) * 12 * depth;
            drift.style.setProperty(
                "--motion-x",
                `${pointerX * depth * 30 + bobX}px`,
            );
            drift.style.setProperty(
                "--motion-y",
                `${pointerY * depth * 24 + bobY}px`,
            );
        }
    };

    window.addEventListener(
        "pointermove",
        (event) => {
            targetX = Math.max(-0.5, Math.min(0.5, event.clientX / window.innerWidth - 0.5));
            targetY = Math.max(-0.5, Math.min(0.5, event.clientY / window.innerHeight - 0.5));
        },
        { passive: true },
    );

    const reset = (): void => {
        targetX = 0;
        targetY = 0;
    };

    window.addEventListener("blur", reset);
    document.documentElement.addEventListener("mouseleave", reset);
    requestAnimationFrame(paint);
}

function initLoopPulse(): void {
    const steps = Array.from(document.querySelectorAll<HTMLElement>("[data-loop-step]"));
    if (steps.length === 0) return;

    if (prefersReducedMotion()) {
        steps[0]?.classList.add("is-live");
        return;
    }

    let index = 0;
    const tick = (): void => {
        steps.forEach((step, stepIndex) => {
            step.classList.toggle("is-live", stepIndex === index);
        });
        index = (index + 1) % steps.length;
    };

    tick();
    window.setInterval(tick, LOOP_TICK_MS);
}

function initChannelTune(): void {
    const list = document.querySelector<HTMLElement>("[data-desk-channels]");
    if (!list || prefersReducedMotion()) return;

    const rows = Array.from(list.querySelectorAll<HTMLAnchorElement>("a"));
    if (rows.length === 0) return;

    let index = 0;
    const tick = (): void => {
        rows.forEach((row, rowIndex) => {
            row.classList.toggle("is-tuning", rowIndex === index);
        });
        index = (index + 1) % rows.length;
    };

    tick();
    window.setInterval(tick, 2200);
}

revealDesk();
initDeskField();
initLoopPulse();
initChannelTune();
