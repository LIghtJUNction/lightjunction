import * as openpgp from 'openpgp'

const PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEZ/6uihYJKwYBBAHaRw8BAQdAGM5JPSEZCHEAma0d8JoMDtfy+JJwmPlf4Lo9
5RJVMDq0KkxJZ2h0SlVOY3Rpb24gPExJZ2h0SlVOY3Rpb24ubWVAZ21haWwuY29t
PoiTBBMWCgA7AhsDBQsJCAcCAiICBhUKCQgLAgQWAgMBAh4HAheAFiEE6yG4OrHp
gt9m8IOHpnF4QF93Nv0FAmf+smUACgkQpnF4QF93Nv17uAD/QcyMTrc98nfAf88i
mCZOAgwTfqT4ZE/I9pFj3xxxJwQA/Rlq0SC5/vWuPhr6J7S22u/PUOFJP2fj+nKp
EX6EQ18IuDgEZ/6uihIKKwYBBAGXVQEFAQEHQDh4OfNBdiuIoLUjLJ7581/lK3Zg
giLnI6ZYyCwj3ygFAwEIB4h4BBgWCgAgAhsMFiEE6yG4OrHpgt9m8IOHpnF4QF93
Nv0FAmf+sncACgkQpnF4QF93Nv0ihQD/dIGnVBFC8eNcA3W20sQ7UV5n2sj39Lzp
f6NsZS7R5RsA/RcNOObtRzBmYoar1H5xTcV16i4gYpo3OcnND9g5Ee8LuDMEaVzv
9RYJKwYBBAHaRw8BAQdAgh+f07ofBteLgJYBennZmEiGj/uleeJji/e9+b2ixj2I
eAQYFgoAIBYhBOshuDqx6YLfZvCDh6ZxeEBfdzb9BQJpXO/1AhsgAAoJEKZxeEBf
dzb9EccA+wQJ4rgGHEutSEH7IBVbcg2Ua/bO5kGJL1dsXpHbrN9OAP9lXD8yURjh
l3xQhx6HVK8KzO3u7bdIxVNIwuj+fqmhAg==
=vCDQ
-----END PGP PUBLIC KEY BLOCK-----`

let encrypted = ''
let sent = false

const card = document.getElementById('secure-card')!
const msg = document.getElementById('secure-msg') as HTMLTextAreaElement
const resultBox = document.getElementById('result-box')!
const resultText = document.getElementById('result-text')!
const btnCopy = document.getElementById('btn-copy')!
const btnGithub = document.getElementById('btn-github')!
const btnClose = document.getElementById('btn-close')!
const toast = document.getElementById('toast')!

// physics
let posX = 0, posY = 0
let velX = 0, velY = 0
let dragging = false
let startX = 0, startY = 0
let offsetX = 0, offsetY = 0
let lastX = 0, lastY = 0
let lastT = 0

const GRAV = 0.4
const FRIC = 0.99

function init() {
    posX = (window.innerWidth - card.offsetWidth) / 2
    posY = (window.innerHeight - card.offsetHeight) / 2
    card.style.right = 'auto'
    card.style.bottom = 'auto'
    update()
}
init()

function update() {
    card.style.left = posX + 'px'
    card.style.top = posY + 'px'
    card.style.transform = 'none'
}

function frame() {
    if (!dragging && !sent && card.style.display !== 'none') {
        velY += GRAV
        velX *= FRIC
        velY *= FRIC
        posX += velX
        posY += velY

        const maxX = window.innerWidth - card.offsetWidth
        const maxY = window.innerHeight - card.offsetHeight

        if (posX < 0) { posX = 0; velX = -velX * 0.6 }
        if (posX > maxX) { posX = maxX; velX = -velX * 0.6 }
        if (posY > maxY) { posY = maxY; velY = -velY * 0.6 }

        // thrown above screen = send
        if (posY < -card.offsetHeight - 50) {
            doSend()
        }

        update()
    }
    requestAnimationFrame(frame)
}
frame()

// drag - mouse
card.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    card.classList.add('dragging')
    dragging = true
    startX = e.clientX
    startY = e.clientY
    offsetX = posX
    offsetY = posY
    lastX = e.clientX
    lastY = e.clientY
    lastT = Date.now()
    velX = velY = 0
})

window.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const now = Date.now()
    const dt = now - lastT
    if (dt > 0) {
        velX = (e.clientX - lastX) / dt * 16
        velY = (e.clientY - lastY) / dt * 16
    }
    posX = offsetX + (e.clientX - startX)
    posY = offsetY + (e.clientY - startY)
    lastX = e.clientX
    lastY = e.clientY
    lastT = now
    update()
})

window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    card.classList.remove('dragging')
    velX = (window.innerWidth / 2 - posX) * 0.001
    velY = (window.innerHeight / 2 - posY) * 0.001
})

// drag - touch
card.addEventListener('touchstart', (e) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    const t = e.touches[0]
    card.classList.add('dragging')
    dragging = true
    startX = t.clientX
    startY = t.clientY
    offsetX = posX
    offsetY = posY
    lastX = t.clientX
    lastY = t.clientY
    lastT = Date.now()
    velX = velY = 0
}, { passive: true })

card.addEventListener('touchmove', (e) => {
    if (!dragging) return
    const t = e.touches[0]
    const now = Date.now()
    const dt = now - lastT
    if (dt > 0) {
        velX = (t.clientX - lastX) / dt * 16
        velY = (t.clientY - lastY) / dt * 16
    }
    posX = offsetX + (t.clientX - startX)
    posY = offsetY + (t.clientY - startY)
    lastX = t.clientX
    lastY = t.clientY
    lastT = now
    update()
}, { passive: true })

card.addEventListener('touchend', () => {
    dragging = false
    card.classList.remove('dragging')
})

// toast
function showToast(t: string) {
    toast.textContent = t
    toast.classList.add('show')
    setTimeout(() => toast.classList.remove('show'), 2500)
}

// send
async function doSend() {
    sent = true
    const text = msg.value.trim()
    if (!text) {
        sent = false
        posY = window.innerHeight - card.offsetHeight - 50
        velY = 0
        showToast('Write something first!')
        return
    }

    showToast('Encrypting...')

    try {
        const pub = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            encryptionKeys: pub,
        }) as string

        await navigator.clipboard.writeText(encrypted)
        resultText.textContent = encrypted
        resultBox.classList.add('show')
        card.style.display = 'none'
        showToast('Encrypted & copied!')
    } catch {
        showToast('Encryption error')
        sent = false
        posY = window.innerHeight - card.offsetHeight - 50
        velY = 0
    }
}

// result buttons
btnCopy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(encrypted)
    showToast('Copied!')
})

btnGithub.addEventListener('click', () => {
    const url = `https://github.com/LIghtJUNction/lightjunction/issues/new?title=encrypted+message&body=${encodeURIComponent(`## Encrypted Message\n\n\`\`\`\n${encrypted}\n\`\`\`\n\n---\n*via secure-message*`)}`
    window.open(url, '_blank')
})

btnClose.addEventListener('click', () => {
    resultBox.classList.remove('show')
    msg.value = ''
    encrypted = ''
    sent = false
    card.style.display = 'block'
    init()
})

window.addEventListener('resize', () => {
    if (!dragging) {
        posX = Math.max(0, Math.min(posX, window.innerWidth - card.offsetWidth))
        posY = Math.max(0, Math.min(posY, window.innerHeight - card.offsetHeight))
        update()
    }
})