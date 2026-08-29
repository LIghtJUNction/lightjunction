type HeroObject = HTMLElement & { dataset: DOMStringMap };

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const setCurrentNav = (
    links: HTMLAnchorElement[],
    current: HTMLAnchorElement | null,
): void => {
    for (const link of links) {
        const active = link === current;
        link.classList.toggle("is-current", active);
        if (active) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    }
};

function initScrollNav(): void {
    const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"),
    );
    if (!links.length || !("IntersectionObserver" in window)) return;

    const targets = links
        .map((link) => {
            const id = link.dataset.navLink;
            return id ? document.getElementById(id) : null;
        })
        .filter((target): target is HTMLElement => target !== null);

    const byId = new Map(targets.map((target) => [target.id, target]));
    const observer = new IntersectionObserver(
        (entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            const active = links.find(
                (link) =>
                    byId.get(link.dataset.navLink ?? "") === visible.target,
            );
            if (active) setCurrentNav(links, active);
        },
        { rootMargin: "-28% 0px -58%", threshold: [0, 0.2, 0.5] },
    );

    targets.forEach((target) => observer.observe(target));
    setCurrentNav(links, links[0] ?? null);
}

export function initHeroMotion(): void {
    const scene = document.querySelector<HTMLElement>("[data-hero-scene]");
    const collage = scene?.querySelector<HTMLElement>("[data-hero-collage]");
    if (!scene || !collage) return;

    initScrollNav();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const objects = Array.from(
        scene.querySelectorAll<HeroObject>("[data-depth]"),
    );

    if (reducedMotion.matches || !objects.length) return;

    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let frame = 0;

    const render = (): void => {
        frame = 0;
        pointerX += (targetX - pointerX) * 0.08;
        pointerY += (targetY - pointerY) * 0.08;

        const sceneRect = scene.getBoundingClientRect();
        const progress = clamp(
            -sceneRect.top / Math.max(sceneRect.height, 1),
            0,
            1,
        );

        for (const object of objects) {
            const depth = Number(object.dataset.depth ?? 0.5);
            object.style.setProperty(
                "--motion-x",
                `${pointerX * depth * 18}px`,
            );
            object.style.setProperty(
                "--motion-y",
                `${pointerY * depth * 14 - progress * depth * 70}px`,
            );
        }

        if (
            Math.abs(targetX - pointerX) > 0.01 ||
            Math.abs(targetY - pointerY) > 0.01
        ) {
            frame = requestAnimationFrame(render);
        }
    };

    const schedule = (): void => {
        if (!frame) frame = requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent): void => {
        targetX = clamp(event.clientX / window.innerWidth - 0.5, -0.5, 0.5);
        targetY = clamp(event.clientY / window.innerHeight - 0.5, -0.5, 0.5);
        schedule();
    };

    const resetPointer = (): void => {
        targetX = 0;
        targetY = 0;
        schedule();
    };

    window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
    });
    window.addEventListener("blur", resetPointer, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
}
