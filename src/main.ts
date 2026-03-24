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

el('encryptBtn').onclick = async () => {
    const msg = el('message').value.trim()
    if (!msg) return

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
    }

    btn.textContent = 'encrypt'
    btn.disabled = false
}

el('copyBtn').onclick = () => {
    if (!encrypted) return
    navigator.clipboard.writeText(encrypted)
    el('msg').textContent = 'copied'
    el('msg').className = 'msg ok'
}

el('clearBtn').onclick = () => {
    el('title').value = ''
    el('message').value = ''
    el('output').textContent = ''
    el('outputCard').style.display = 'none'
    el('msg').textContent = ''
    encrypted = ''
}
