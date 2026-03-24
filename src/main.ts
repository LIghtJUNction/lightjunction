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

const paper = document.getElementById('paper')!
const message = document.getElementById('message') as HTMLTextAreaElement
const seal = document.getElementById('seal')!
const envelope = document.getElementById('envelope')!
const status = document.getElementById('status')!
const hint = document.getElementById('hint')!

message.addEventListener('focus', () => {
    paper.classList.add('open')
    hint.textContent = 'write your secret message'
})

message.addEventListener('blur', () => {
    if (!encrypted) paper.classList.remove('open')
})

seal.addEventListener('click', async () => {
    const msg = message.value.trim()
    if (!msg) {
        showStatus('write something first', 'err')
        return
    }

    paper.classList.add('fold')
    seal.style.display = 'none'
    showStatus('encrypting...')

    try {
        const pub = await openpgp.readKey({ armoredKey: PUBLIC_KEY })

        encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: msg }),
            encryptionKeys: pub,
        }) as string

        await navigator.clipboard.writeText(encrypted)
        showStatus('encrypted & copied!', 'ok')
        hint.textContent = 'tap envelope to send'

        // Show envelope
        envelope.classList.add('show')

        // After delay, fly away
        setTimeout(() => {
            envelope.classList.add('fly')
            setTimeout(() => {
                sendToGithub()
            }, 600)
        }, 800)

    } catch (e) {
        showStatus('error: ' + (e as Error).message, 'err')
        paper.classList.remove('fold')
        seal.style.display = 'flex'
    }
})

envelope.addEventListener('click', () => {
    if (!encrypted) return
    sendToGithub()
})

function sendToGithub() {
    const body = encodeURIComponent(`## Encrypted Message\n\n\`\`\`\n${encrypted}\n\`\`\`\n\n---\n*via secure-message*`)
    const url = `https://github.com/LIghtJUNction/lightjunction/issues/new?title=secure+message&body=${body}`
    window.open(url, '_blank')
    navigator.clipboard.writeText(url)
    showStatus('github opened & link copied!', 'ok')

    // Reset after a moment
    setTimeout(resetAll, 2000)
}

function showStatus(text: string, type: 'ok' | 'err' | '' = '') {
    status.textContent = text
    status.className = 'status show ' + type
}

function resetAll() {
    paper.classList.remove('open', 'fold')
    envelope.classList.remove('show', 'fly')
    message.value = ''
    encrypted = ''
    seal.style.display = 'flex'
    hint.textContent = 'click paper to start writing'
    showStatus('')
}
