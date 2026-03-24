import * as openpgp from 'openpgp'

// Public key embedded for encryption
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

let encryptedData = ''

// Display public key
document.getElementById('pubkey')!.textContent = PUBLIC_KEY

const titleInput = document.getElementById('title') as HTMLInputElement
const messageInput = document.getElementById('message') as HTMLTextAreaElement
const encryptBtn = document.getElementById('encryptBtn')!
const copyBtn = document.getElementById('copyBtn')!
const clearBtn = document.getElementById('clearBtn')!
const outputCard = document.getElementById('outputCard')!
const outputEl = document.getElementById('output')!
const copiedMsg = document.getElementById('copiedMsg')!
const postBtn = document.getElementById('postBtn')!
const ghTokenInput = document.getElementById('ghToken') as HTMLInputElement
const statusMsg = document.getElementById('statusMsg')!

async function encryptMessage(): Promise<void> {
    const title = titleInput.value.trim()
    const message = messageInput.value.trim()

    if (!message) {
        alert('Please enter a message to encrypt')
        return
    }

    encryptBtn.textContent = '🔐 Encrypting...'
    encryptBtn.setAttribute('disabled', '')

    try {
        const pubKey = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        const fullMessage = title ? `Title: ${title}\n\n${message}` : message

        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: fullMessage }),
            encryptionKeys: pubKey,
        })

        encryptedData = encrypted as string
        outputEl.textContent = encryptedData
        outputCard.style.display = 'block'
        copiedMsg.textContent = ''
        statusMsg.innerHTML = ''

        encryptBtn.textContent = '✅ Encrypted!'
        setTimeout(() => {
            encryptBtn.textContent = '🔐 Encrypt Message'
            encryptBtn.removeAttribute('disabled')
        }, 2000)
    } catch (err) {
        alert('Encryption failed: ' + (err as Error).message)
        encryptBtn.textContent = '🔐 Encrypt Message'
        encryptBtn.removeAttribute('disabled')
    }
}

function copyOutput(): void {
    if (!encryptedData) {
        alert('No encrypted message to copy. Please encrypt a message first.')
        return
    }

    navigator.clipboard.writeText(encryptedData).then(() => {
        copiedMsg.textContent = '✅ Copied to clipboard!'
        setTimeout(() => { copiedMsg.textContent = '' }, 2000)
    })
}

async function postToGitHub(): Promise<void> {
    const token = ghTokenInput.value.trim()
    const title = titleInput.value.trim() || 'Encrypted Message'

    if (!token) {
        alert('Please enter your GitHub Token')
        return
    }

    if (!encryptedData) {
        alert('No encrypted message to post. Please encrypt a message first.')
        return
    }

    postBtn.textContent = '🚀 Posting...'
    postBtn.setAttribute('disabled', '')
    statusMsg.innerHTML = '<div class="status loading">Posting encrypted message to GitHub...</div>'

    try {
        const response = await fetch('https://api.github.com/repos/LIghtJUNction/lightjunction/issues', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Secure-Message-Page',
            },
            body: JSON.stringify({
                title: `[Encrypted] ${title}`,
                body: `## 🔐 Encrypted Message\n\nThis message was encrypted by the sender using the recipient's public GPG key.\nOnly the recipient (holding the private key) can decrypt it.\n\n\`\`\`\n${encryptedData}\n\`\`\`\n\n---\n*Sent via Secure Message Page*`,
            }),
        })

        if (response.status === 201) {
            const data = await response.json()
            statusMsg.innerHTML = `<div class="status success">✅ Posted successfully! <a href="${data.html_url}" target="_blank">View Issue</a></div>`
        } else if (response.status === 401) {
            statusMsg.innerHTML = `<div class="status error">❌ Invalid token. Please check your GitHub Token.</div>`
        } else if (response.status === 403) {
            statusMsg.innerHTML = `<div class="status error">❌ Token lacks 'repo' scope or rate limited.</div>`
        } else {
            const data = await response.json()
            statusMsg.innerHTML = `<div class="status error">❌ Error ${response.status}: ${data.message || 'Unknown error'}</div>`
        }
    } catch (err) {
        statusMsg.innerHTML = `<div class="status error">❌ Network error: ${(err as Error).message}</div>`
    }

    postBtn.textContent = '🚀 Post to GitHub Issue'
    postBtn.removeAttribute('disabled')
}

function clearAll(): void {
    titleInput.value = ''
    messageInput.value = ''
    outputEl.textContent = ''
    outputCard.style.display = 'none'
    copiedMsg.textContent = ''
    statusMsg.innerHTML = ''
    encryptedData = ''
}

// Event listeners
encryptBtn.addEventListener('click', encryptMessage)
copyBtn.addEventListener('click', copyOutput)
clearBtn.addEventListener('click', clearAll)
postBtn.addEventListener('click', postToGitHub)
