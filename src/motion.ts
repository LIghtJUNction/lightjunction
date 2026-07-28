let observer: IntersectionObserver | null = null
let pointerFrame: number | null = null

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
        element.style.transitionDelay = `${Math.min(index % 5, 4) * 90}ms`
        if (activeObserver) {
            activeObserver.observe(element)
        } else {
            revealImmediately(element)
        }
    })
}

function initHeroDrift(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stage = document.querySelector<HTMLElement>('.hero-image-stage')
    if (!stage) return

    let pointerX = 0
    let pointerY = 0

    const paint = (): void => {
        pointerFrame = null
        const x = Math.max(-1, Math.min(1, pointerX))
        const y = Math.max(-1, Math.min(1, pointerY))
        stage.style.setProperty('--hero-x', `${(x * -12).toFixed(2)}px`)
        stage.style.setProperty('--hero-y', `${(y * -10).toFixed(2)}px`)
    }

    stage.addEventListener('pointermove', (event) => {
        const bounds = stage.getBoundingClientRect()
        pointerX = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2
        pointerY = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2
        if (pointerFrame === null) pointerFrame = requestAnimationFrame(paint)
    }, { passive: true })

    stage.addEventListener('pointerleave', () => {
        pointerX = 0
        pointerY = 0
        if (pointerFrame === null) pointerFrame = requestAnimationFrame(paint)
    })
}

function initMagneticActions(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    document.querySelectorAll<HTMLElement>('.magnetic-action').forEach((action) => {
        action.addEventListener('pointermove', (event) => {
            const bounds = action.getBoundingClientRect()
            const x = event.clientX - bounds.left - bounds.width / 2
            const y = event.clientY - bounds.top - bounds.height / 2
            action.style.setProperty('--magnetic-x', `${(x * 0.08).toFixed(2)}px`)
            action.style.setProperty('--magnetic-y', `${(y * 0.12).toFixed(2)}px`)
            action.style.setProperty('--icon-x', `${(x * 0.18).toFixed(2)}px`)
            action.style.setProperty('--icon-y', `${(y * 0.2).toFixed(2)}px`)
        }, { passive: true })

        action.addEventListener('pointerleave', () => {
            action.style.setProperty('--magnetic-x', '0px')
            action.style.setProperty('--magnetic-y', '0px')
            action.style.setProperty('--icon-x', '0px')
            action.style.setProperty('--icon-y', '0px')
        })
    })
}

export function initMotion(): void {
    document.documentElement.classList.add('motion-ready')
    registerReveals()
    initHeroDrift()
    initMagneticActions()
}
