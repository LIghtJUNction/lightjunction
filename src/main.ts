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
let isOpen = false

const scene = document.getElementById('scene')!
const envelope = document.getElementById('envelope')!
const envTitle = document.getElementById('envTitle')!
const envHint = document.getElementById('envHint')!
const inputArea = document.getElementById('inputArea')!
const titleInput = document.getElementById('titleInput') as HTMLInputElement
const secretMsg = document.getElementById('secretMsg') as HTMLTextAreaElement
const encryptBtn = document.getElementById('encryptBtn')!
const cancelBtn = document.getElementById('cancelBtn')!
const resetBtn = document.getElementById('resetBtn')!
const statusEl = document.getElementById('status')!

// Touch handling for swipe
let touchStartY = 0
let touchStartX = 0
let isSwiping = false

scene.addEventListener('click', () => {
    if (isOpen) return
    openEnvelope()
})

secretMsg.addEventListener('focus', () => {
    if (!isOpen) openEnvelope()
})

function openEnvelope() {
    isOpen = true
    envelope.classList.add('open')
    envHint.textContent = 'write your secret inside'
    setTimeout(() => {
        inputArea.classList.add('show')
        titleInput.focus()
    }, 400)
}

function closeEnvelope() {
    isOpen = false
    envelope.classList.remove('open')
    inputArea.classList.remove('show')
    envTitle.textContent = 'tap to open'
    envHint.textContent = 'slide to flip'
}

// Cancel button
cancelBtn.addEventListener('click', () => {
    closeEnvelope()
    secretMsg.value = ''
    titleInput.value = ''
    statusEl.textContent = ''
    statusEl.className = 'status'
})

// Reset button
resetBtn.addEventListener('click', () => {
    closeEnvelope()
    secretMsg.value = ''
    titleInput.value = ''
    statusEl.textContent = ''
    statusEl.className = 'status'
    envelope.classList.remove('sent')
    encrypted = ''
})

// Encrypt and seal
encryptBtn.addEventListener('click', async () => {
    const msg = secretMsg.value.trim()
    const title = titleInput.value.trim()

    if (!msg) {
        statusEl.textContent = 'write something first'
        statusEl.className = 'status err'
        return
    }

    encryptBtn.textContent = '...'
    encryptBtn.disabled = true

    try {
        const pub = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        const full = title ? `Title: ${title}\n\n${msg}` : msg

        encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: full }),
            encryptionKeys: pub,
        }) as string

        // Copy to clipboard
        await navigator.clipboard.writeText(encrypted)

        statusEl.textContent = 'encrypted & copied!'
        statusEl.className = 'status ok'

        // Update envelope title
        envTitle.textContent = title || 'encrypted'
        envHint.textContent = 'swipe up to send'

        // Close envelope after short delay
        setTimeout(() => {
            closeEnvelope()
            secretMsg.value = ''
            titleInput.value = ''

            // Show swipe hint
            setTimeout(() => {
                envHint.textContent = 'swipe up →'
                statusEl.textContent = 'ready to send'
            }, 300)
        }, 800)

    } catch (e) {
        statusEl.textContent = 'error: ' + (e as Error).message
        statusEl.className = 'status err'
    }

    encryptBtn.textContent = 'encrypt & seal'
    encryptBtn.disabled = false
})

// Swipe up to send
document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY
    touchStartX = e.touches[0].clientX
    isSwiping = true
})

document.addEventListener('touchmove', (e) => {
    if (!isSwiping || !encrypted) return
    const deltaY = touchStartY - e.touches[0].clientY
    const deltaX = e.touches[0].clientX - touchStartX

    // Detect upward swipe
    if (deltaY > 50 && deltaY > Math.abs(deltaX)) {
        e.preventDefault()
        isSwiping = false
        sendMessage()
    }
})

// Mouse swipe (for desktop)
document.addEventListener('mousedown', (e) => {
    touchStartY = e.clientY
    isSwiping = true
})

document.addEventListener('mouseup', async (e) => {
    if (!isSwiping || !encrypted) return
    const deltaY = touchStartY - e.clientY
    if (deltaY > 80) {
        isSwiping = false
        await sendMessage()
    }
    isSwiping = false
})

async function sendMessage() {
    if (!encrypted) return

    statusEl.textContent = 'sending...'

    // Animate envelope away
    envelope.classList.add('sent')

    // Get title
    const title = titleInput.value.trim() || 'encrypted message'

    // Wait for animation
    await new Promise(r => setTimeout(r, 800))

    // Create issue URL
    const body = encodeURIComponent(`## Encrypted Message\n\n\`\`\`\n${encrypted}\n\`\`\`\n\n---\n*via secure-message*`)
    const issueUrl = `https://github.com/LIghtJUNction/lightjunction/issues/new?title=${encodeURIComponent(title)}&body=${body}`

    // Open in new tab
    window.open(issueUrl, '_blank')

    // Copy URL to clipboard
    await navigator.clipboard.writeText(issueUrl)

    statusEl.textContent = 'link copied!'
    statusEl.className = 'status ok'

    // Reset after a moment
    setTimeout(() => {
        envelope.classList.remove('sent')
        encrypted = ''
        envTitle.textContent = 'tap to open'
        envHint.textContent = 'slide to flip'
        statusEl.textContent = ''
        statusEl.className = 'status'
    }, 2000)
}
