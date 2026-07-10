let observer: IntersectionObserver | null = null

function revealImmediately(element: HTMLElement): void {
    element.classList.add('is-visible')
}

function getObserver(): IntersectionObserver | null {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
    if (observer) return observer

    observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const element = entry.target as HTMLElement
            revealImmediately(element)
            observer?.unobserve(element)
        }
    }, {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.08,
    })

    return observer
}

export function registerReveals(root: ParentNode = document): void {
    const elements = root.querySelectorAll<HTMLElement>('.reveal:not([data-reveal-registered])')
    const activeObserver = getObserver()

    elements.forEach((element, index) => {
        element.dataset.revealRegistered = 'true'
        element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`
        if (activeObserver) {
            activeObserver.observe(element)
        } else {
            revealImmediately(element)
        }
    })
}

export function initMotion(): void {
    document.documentElement.classList.add('motion-ready')
    registerReveals()
}
