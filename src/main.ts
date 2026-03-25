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

const card = document.getElementById('card')!
const msg = document.getElementById('msg') as HTMLTextAreaElement
const result = document.getElementById('result')!
const out = document.getElementById('out')!
const cp = document.getElementById('cp')!
const gh = document.getElementById('gh')!
const cl = document.getElementById('cl')!
const st = document.getElementById('st')!

// physics
let posX = 0, posY = 0
let velX = 0, velY = 0
let dragging = false
let startX = 0, startY = 0
let offsetX = 0, offsetY = 0
let lastX = 0, lastY = 0
let lastT = 0
let sent = false

const GRAV = 0.4
const FRIC = 0.99

function init() {
    posX = (window.innerWidth - card.offsetWidth) / 2
    posY = (window.innerHeight - card.offsetHeight) / 2
    update()
}
init()

function update() {
    card.style.transform = `translate(${posX}px, ${posY}px)`
}

function frame() {
    if (!dragging && !sent) {
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

window.addEventListener('mouseup', (e) => {
    if (!dragging) return
    dragging = false
    velX = (e.clientX - startX) * 0.05
    velY = (e.clientY - startY) * 0.05
})

// drag - touch
card.addEventListener('touchstart', (e) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    const t = e.touches[0]
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

card.addEventListener('touchend', () => { dragging = false })

// status
function status(t: string) {
    st.textContent = t
    st.className = t ? 'status show' : 'status'
    if (t) setTimeout(() => st.className = 'status', 2000)
}

// send
async function doSend() {
    sent = true
    const text = msg.value.trim()
    if (!text) {
        sent = false
        posY = 0
        velY = 0
        status('write something')
        return
    }

    status('encrypting...')

    try {
        const pub = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            encryptionKeys: pub,
        }) as string

        await navigator.clipboard.writeText(encrypted)
        out.textContent = encrypted
        result.classList.add('show')
        status('encrypted & copied!')
    } catch {
        status('error')
        sent = false
        posY = 0
        velY = 0
    }
}

// result buttons
cp.addEventListener('click', async () => {
    await navigator.clipboard.writeText(encrypted)
    status('copied')
})

gh.addEventListener('click', () => {
    const url = `https://github.com/LIghtJUNction/lightjunction/issues/new?title=encrypted+message&body=${encodeURIComponent(`## Encrypted Message\n\n\`\`\`\n${encrypted}\n\`\`\`\n\n---\n*via secure-message*`)}`
    navigator.clipboard.writeText(url)
    status('issue url copied')
})

cl.addEventListener('click', () => {
    result.classList.remove('show')
    msg.value = ''
    encrypted = ''
    sent = false
    init()
})

window.addEventListener('resize', () => {
    if (!dragging) {
        posX = Math.max(0, Math.min(posX, window.innerWidth - card.offsetWidth))
        posY = Math.max(0, Math.min(posY, window.innerHeight - card.offsetHeight))
        update()
    }
})
