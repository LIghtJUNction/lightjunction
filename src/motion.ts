let observer: IntersectionObserver | null = null
let scrollFrame: number | null = null
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
        element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`
        if (activeObserver) {
            activeObserver.observe(element)
        } else {
            revealImmediately(element)
        }
    })
}

function paintScrollProgress(): void {
    scrollFrame = null
    const root = document.documentElement
    const scrollRange = Math.max(1, root.scrollHeight - window.innerHeight)
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange))
    root.style.setProperty('--scroll-progress', progress.toFixed(4))
}

function scheduleScrollProgress(): void {
    if (scrollFrame !== null) return
    scrollFrame = requestAnimationFrame(paintScrollProgress)
}

function initScrollProgress(): void {
    paintScrollProgress()
    window.addEventListener('scroll', scheduleScrollProgress, { passive: true })
    window.addEventListener('resize', scheduleScrollProgress)
}

function initOpticalPointer(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stage = document.querySelector<HTMLElement>('.optical-stage')
    if (!stage) return

    let pointerX = 0
    let pointerY = 0

    const paint = (): void => {
        pointerFrame = null
        const x = Math.max(-1, Math.min(1, pointerX))
        const y = Math.max(-1, Math.min(1, pointerY))
        stage.style.setProperty('--lens-x', `${(x * 8).toFixed(2)}px`)
        stage.style.setProperty('--lens-y', `${(y * 8).toFixed(2)}px`)
        stage.style.setProperty('--caustic-x', `${(x * -5).toFixed(2)}px`)
        stage.style.setProperty('--caustic-y', `${(y * -4).toFixed(2)}px`)
    }

    window.addEventListener('pointermove', (event) => {
        pointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
        pointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
        if (pointerFrame === null) pointerFrame = requestAnimationFrame(paint)
    }, { passive: true })

    document.documentElement.addEventListener('pointerleave', () => {
        pointerX = 0
        pointerY = 0
        if (pointerFrame === null) pointerFrame = requestAnimationFrame(paint)
    })
}

export function initMotion(): void {
    document.documentElement.classList.add('motion-ready')
    registerReveals()
    initScrollProgress()
    initOpticalPointer()
}
