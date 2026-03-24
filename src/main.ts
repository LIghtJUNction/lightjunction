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

const el = (id: string) => document.getElementById(id)!

el('pubkey').textContent = PUBLIC_KEY

const $ = (sel: string) => document.querySelector(sel) as HTMLElement

el('encryptBtn').onclick = async () => {
    const msg = el('message').value.trim()
    if (!msg) return alert('message required')

    const btn = el('encryptBtn')
    btn.textContent = '...'
    btn.disabled = true

    try {
        const pub = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        const title = el('title').value.trim()
        const full = title ? `Title: ${title}\n\n${msg}` : msg

        encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: full }),
            encryptionKeys: pub,
        }) as string

        el('output').textContent = encrypted
        el('outputCard').style.display = 'block'
        el('msg').textContent = ''
        el('msg').className = 'msg'
    } catch (e) {
        el('msg').textContent = 'error: ' + (e as Error).message
        el('msg').className = 'msg error'
    }

    btn.textContent = 'encrypt'
    btn.disabled = false
}

el('copyBtn').onclick = () => {
    if (!encrypted) return
    navigator.clipboard.writeText(encrypted)
    el('msg').textContent = 'copied'
    el('msg').className = 'msg success'
}

el('clearBtn').onclick = () => {
    el('title').value = ''
    el('message').value = ''
    el('output').textContent = ''
    el('outputCard').style.display = 'none'
    el('msg').textContent = ''
    encrypted = ''
}

el('postBtn').onclick = async () => {
    const token = (el('ghToken') as HTMLInputElement).value.trim()
    if (!token) return alert('token required')
    if (!encrypted) return

    const btn = el('postBtn')
    btn.textContent = '...'
    btn.disabled = true

    const title = el('title').value.trim() || 'encrypted message'

    try {
        const res = await fetch('https://api.github.com/repos/LIghtJUNction/lightjunction/issues', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
                title: `[Encrypted] ${title}`,
                body: `## Encrypted Message\n\n\`\`\`\n${encrypted}\n\`\`\`\n\n---\n*via secure-message*`,
            }),
        })

        if (res.status === 201) {
            const data = await res.json()
            el('msg').innerHTML = `posted! <a href="${data.html_url}" style="color:#6a6;">view</a>`
            el('msg').className = 'msg success'
        } else if (res.status === 401) {
            el('msg').textContent = 'invalid token'
            el('msg').className = 'msg error'
        } else if (res.status === 403) {
            el('msg').textContent = 'token lacks permission'
            el('msg').className = 'msg error'
        } else {
            el('msg').textContent = `error ${res.status}`
            el('msg').className = 'msg error'
        }
    } catch (e) {
        el('msg').textContent = 'network error'
        el('msg').className = 'msg error'
    }

    btn.textContent = 'post to github'
    btn.disabled = false
}
