import { $, escapeHtml } from './dom.js'
import { PUBLIC_KEY } from './public-key.js'
import { showToast } from './toast.js'

type OpenPgpModule = typeof import('openpgp')

type SecureLog = (html: string, className?: string) => void

let openpgpModule: OpenPgpModule | null = null

async function loadOpenPgp(): Promise<OpenPgpModule> {
    if (!openpgpModule) {
        openpgpModule = await import('openpgp')
    }
    return openpgpModule
}

const secureCard = $<HTMLElement>('secure-card')
const secureMessage = $<HTMLTextAreaElement>('secure-message')
const resultOverlay = $<HTMLElement>('result-overlay')
const resultContent = $<HTMLElement>('result-content')
const resultCopy = $<HTMLButtonElement>('result-copy')
const toast = $<HTMLElement>('toast')
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

let log: SecureLog = () => {}
let encryptedMessage = ''
let sending = false
let previousFocus: HTMLElement | null = null
let inertElements: HTMLElement[] = []
let secureCardAnimationFrame: number | null = null

const drag = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    startX: 0,
    startY: 0,
    cardX: 0,
    cardY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
}

export function openSecureCard(): void {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && !secureCard.contains(activeElement)) {
        previousFocus = activeElement
    }
    secureMessage.value = ''
    sending = false
    secureCard.hidden = false
    placeSecureCard()
    startSecureCardAnimation()
    showToast('Secure card armed')
    secureMessage.focus()
}

function restorePreviousFocus(): void {
    const focusTarget = previousFocus
    previousFocus = null
    if (focusTarget?.isConnected) {
        focusTarget.focus()
    }
}

function dismissSecureCard(): void {
    if (secureCard.hidden) return
    if (document.activeElement instanceof HTMLElement && secureCard.contains(document.activeElement)) {
        document.activeElement.blur()
    }
    secureCard.hidden = true
    stopSecureCardAnimation()
    sending = false
    drag.active = false
    secureCard.classList.remove('dragging')
    restorePreviousFocus()
}

function placeSecureCard(): void {
    drag.x = Math.max(18, (window.innerWidth - secureCard.offsetWidth) / 2)
    drag.y = Math.max(80, window.innerHeight - secureCard.offsetHeight - 96)
    drag.vx = 0
    drag.vy = 0
    paintSecureCard()
}

function paintSecureCard(): void {
    secureCard.style.transform = `translate3d(${Math.round(drag.x)}px, ${Math.round(drag.y)}px, 0)`
}

function tick(): void {
    if (secureCard.hidden || reduceMotionQuery.matches) {
        secureCardAnimationFrame = null
        return
    }

    if (!drag.active && !sending) {
        drag.vy += 0.28
        drag.vx *= 0.985
        drag.vy *= 0.985
        drag.x += drag.vx
        drag.y += drag.vy

        const maxX = window.innerWidth - secureCard.offsetWidth - 12
        const maxY = window.innerHeight - secureCard.offsetHeight - 12

        if (drag.x < 12) {
            drag.x = 12
            drag.vx *= -0.55
        }
        if (drag.x > maxX) {
            drag.x = maxX
            drag.vx *= -0.55
        }
        if (drag.y > maxY) {
            drag.y = maxY
            drag.vy *= -0.55
        }
        if (drag.y < -secureCard.offsetHeight - 48) {
            void encryptAndReveal()
        }
        paintSecureCard()
    }

    secureCardAnimationFrame = requestAnimationFrame(tick)
}

function startSecureCardAnimation(): void {
    if (secureCardAnimationFrame === null && !secureCard.hidden && !reduceMotionQuery.matches) {
        secureCardAnimationFrame = requestAnimationFrame(tick)
    }
}

function stopSecureCardAnimation(): void {
    if (secureCardAnimationFrame !== null) {
        cancelAnimationFrame(secureCardAnimationFrame)
        secureCardAnimationFrame = null
    }
}

async function encryptAndReveal(): Promise<void> {
    if (sending) return
    sending = true

    const text = secureMessage.value.trim()
    if (!text) {
        sending = false
        drag.y = window.innerHeight - secureCard.offsetHeight - 96
        drag.vy = 0
        paintSecureCard()
        showToast('Write something first')
        return
    }

    showToast('Encrypting')
    try {
        const openpgp = await loadOpenPgp()
        const publicKey = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        encryptedMessage = await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            encryptionKeys: publicKey,
        }) as string

        secureCard.hidden = true
        stopSecureCardAnimation()
        resultContent.textContent = encryptedMessage
        showResultDialog()
        try {
            await navigator.clipboard.writeText(encryptedMessage)
            log('Message encrypted with OpenPGP and copied to clipboard.', 'success')
            showToast('Encrypted and copied')
        } catch {
            log('Message encrypted with OpenPGP. Clipboard access was unavailable.', 'success')
            showToast('Encrypted; copy manually')
        }
    } catch (error) {
        sending = false
        log(`Encryption failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`, 'error')
        showToast('Encryption failed')
    }
}

async function copyEncrypted(): Promise<void> {
    if (!encryptedMessage) return
    try {
        await navigator.clipboard.writeText(encryptedMessage)
        showToast('Copied')
    } catch {
        showToast('Clipboard unavailable')
    }
}

function openGitHubIssue(): void {
    const body = `## Encrypted Message\n\n\`\`\`\n${encryptedMessage}\n\`\`\`\n\n---\nvia lightjunction terminal`
    try {
        const issueUrl = new URL('https://github.com/LIghtJUNction/lightjunction/issues/new')
        issueUrl.searchParams.set('title', 'encrypted message')
        issueUrl.searchParams.set('body', body)

        const link = document.createElement('a')
        link.href = issueUrl.toString()
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.click()
    } catch {
        showToast('Unable to open GitHub')
    }
}

function setModalBackgroundInert(): void {
    inertElements = []
    for (const child of document.body.children) {
        if (!(child instanceof HTMLElement) || child === resultOverlay || child === toast) continue
        if (child.inert) continue
        child.inert = true
        inertElements.push(child)
    }
}

function clearModalBackgroundInert(): void {
    for (const element of inertElements) {
        element.inert = false
    }
    inertElements = []
}

function showResultDialog(): void {
    resultOverlay.classList.add('show')
    resultOverlay.setAttribute('aria-hidden', 'false')
    setModalBackgroundInert()
    resultCopy.focus()
}

function closeResult(): void {
    resultOverlay.classList.remove('show')
    resultOverlay.setAttribute('aria-hidden', 'true')
    encryptedMessage = ''
    clearModalBackgroundInert()
    restorePreviousFocus()
}

const DIALOG_FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function trapResultFocus(event: KeyboardEvent): void {
    const focusable = Array.from(
        resultOverlay.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
    )
    const first = focusable[0]
    const last = focusable.slice(-1)[0]
    if (!first || !last) {
        event.preventDefault()
        return
    }

    const activeElement = document.activeElement
    if (event.shiftKey && (activeElement === first || !resultOverlay.contains(activeElement))) {
        event.preventDefault()
        last.focus()
    } else if (!event.shiftKey && (activeElement === last || !resultOverlay.contains(activeElement))) {
        event.preventDefault()
        first.focus()
    }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
    if (resultOverlay.classList.contains('show')) {
        if (event.key === 'Escape') {
            event.preventDefault()
            closeResult()
        } else if (event.key === 'Tab') {
            trapResultFocus(event)
        }
        return
    }

    if (event.key === 'Escape' && !secureCard.hidden) {
        event.preventDefault()
        dismissSecureCard()
    }
}

export function initSecureCard(logger: SecureLog): void {
    log = logger

    secureCard.addEventListener('pointerdown', (event) => {
        if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return
        secureCard.setPointerCapture(event.pointerId)
        drag.active = true
        drag.startX = event.clientX
        drag.startY = event.clientY
        drag.cardX = drag.x
        drag.cardY = drag.y
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        drag.lastT = performance.now()
        drag.vx = 0
        drag.vy = 0
        secureCard.classList.add('dragging')
    })

    secureCard.addEventListener('pointermove', (event) => {
        if (!drag.active) return
        const now = performance.now()
        const dt = Math.max(1, now - drag.lastT)
        drag.vx = ((event.clientX - drag.lastX) / dt) * 16
        drag.vy = ((event.clientY - drag.lastY) / dt) * 16
        drag.x = drag.cardX + event.clientX - drag.startX
        drag.y = drag.cardY + event.clientY - drag.startY
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        drag.lastT = now
        paintSecureCard()
    })

    secureCard.addEventListener('pointerup', () => {
        drag.active = false
        secureCard.classList.remove('dragging')
    })

    window.addEventListener('resize', () => {
        if (!secureCard.hidden) {
            drag.x = Math.min(drag.x, window.innerWidth - secureCard.offsetWidth - 12)
            drag.y = Math.min(drag.y, window.innerHeight - secureCard.offsetHeight - 12)
            paintSecureCard()
        }
    })

    $('encrypt-now').addEventListener('click', () => void encryptAndReveal())
    $('secure-cancel').addEventListener('click', dismissSecureCard)
    $('result-copy').addEventListener('click', () => void copyEncrypted())
    $('result-github').addEventListener('click', openGitHubIssue)
    $('result-close').addEventListener('click', closeResult)
    document.addEventListener('keydown', handleGlobalKeydown)
}
