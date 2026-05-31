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

type CommandHandler = (args: string[]) => void | Promise<void>

type Repo = {
    name: string
    html_url: string
    description: string | null
    language: string | null
    stargazers_count: number
    forks_count: number
}

type GitHubUser = {
    public_repos: number
    followers: number
    following: number
    created_at: string
}

const COMMAND_NAMES = [
    'help',
    'about',
    'skills',
    'projects',
    'stats',
    'contact',
    'msg',
    'clear',
    'whoami',
    'pwd',
    'ls',
    'uname',
    'fastfetch',
    'reboot',
]

const $ = <T extends HTMLElement>(id: string): T => {
    const element = document.getElementById(id)
    if (!element) {
        throw new Error(`Missing required DOM element: #${id}`)
    }
    return element as T
}

const output = $('terminal-output')
const inputText = $('input-text')
const secureCard = $('secure-card')
const secureMessage = $('secure-message') as HTMLTextAreaElement
const resultOverlay = $('result-overlay')
const resultContent = $('result-content')
const toast = $('toast')

let currentInput = ''
let history: string[] = []
let historyIndex = 0
let encryptedMessage = ''
let sending = false

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

function escapeHtml(value: string): string {
    const div = document.createElement('div')
    div.textContent = value
    return div.innerHTML
}

function writeLine(html: string, className = ''): void {
    const line = document.createElement('div')
    line.className = className ? `term-line ${className}` : 'term-line'
    line.innerHTML = html
    output.appendChild(line)
    output.scrollTop = output.scrollHeight
}

function writeCommand(command: string): void {
    writeLine(
        `<span class="prompt">guest@lj</span><span class="path">:~</span>$ ${escapeHtml(command)}`,
        'term-input',
    )
}

function showToast(message: string): void {
    toast.textContent = message
    toast.classList.add('show')
    window.setTimeout(() => toast.classList.remove('show'), 2400)
}

function setInput(value: string): void {
    currentInput = value
    inputText.textContent = value
}

function resetTerminal(): void {
    output.innerHTML = ''
    boot()
}

function openSecureCard(): void {
    secureMessage.value = ''
    sending = false
    secureCard.hidden = false
    placeSecureCard()
    showToast('Secure card armed')
}

function placeSecureCard(): void {
    drag.x = Math.max(18, (window.innerWidth - secureCard.offsetWidth) / 2)
    drag.y = Math.max(80, window.innerHeight - secureCard.offsetHeight - 96)
    paintSecureCard()
}

function paintSecureCard(): void {
    secureCard.style.transform = `translate3d(${Math.round(drag.x)}px, ${Math.round(drag.y)}px, 0)`
}

function tick(): void {
    if (!secureCard.hidden && !drag.active && !sending) {
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

    requestAnimationFrame(tick)
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
        const publicKey = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        encryptedMessage = await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            encryptionKeys: publicKey,
        }) as string

        await navigator.clipboard.writeText(encryptedMessage)
        resultContent.textContent = encryptedMessage
        resultOverlay.classList.add('show')
        secureCard.hidden = true
        writeLine('Message encrypted with OpenPGP and copied to clipboard.', 'success')
        showToast('Encrypted and copied')
    } catch (error) {
        sending = false
        writeLine(`Encryption failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`, 'error')
        showToast('Encryption failed')
    }
}

async function copyEncrypted(): Promise<void> {
    if (!encryptedMessage) return
    await navigator.clipboard.writeText(encryptedMessage)
    showToast('Copied')
}

function openGitHubIssue(): void {
    const body = `## Encrypted Message\n\n\`\`\`\n${encryptedMessage}\n\`\`\`\n\n---\nvia lightjunction terminal`
    const url = `https://github.com/LIghtJUNction/lightjunction/issues/new?title=encrypted+message&body=${encodeURIComponent(body)}`
    window.open(url, '_blank', 'noopener,noreferrer')
}

function closeResult(): void {
    resultOverlay.classList.remove('show')
    encryptedMessage = ''
    openSecureCard()
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
}

const commands: Record<string, CommandHandler> = {
    help: () => {
        writeLine(`
            <div class="command-grid">
                ${COMMAND_NAMES.map((name) => `<span>${name}</span><em>${commandDescription(name)}</em>`).join('')}
            </div>
        `)
    },
    about: () => {
        writeLine(`
            <div class="panel-copy">
                <strong>LIghtJUNction</strong>
                <p>Non-CS background, amateur programming enthusiast. Into AI, Android rooting, custom ROMs, Linux, and sharp little tools.</p>
                <p>Pragmatic by scar tissue. Learning by doing.</p>
            </div>
        `)
    },
    skills: () => {
        const groups = [
            ['Systems', 'Arch Linux', 'Shell', 'Packaging', 'Self-hosting'],
            ['Code', 'TypeScript', 'Python', 'Go', 'Rust'],
            ['AI', 'Agents', 'Datasets', 'Training loops', 'Automation'],
            ['Security', 'OpenPGP', 'SSH', 'OAuth', 'Operational hygiene'],
        ]
        writeLine(`
            <div class="skill-grid">
                ${groups.map(([title, ...items]) => `
                    <section>
                        <strong>${title}</strong>
                        <p>${items.map((item) => `<span>${item}</span>`).join('')}</p>
                    </section>
                `).join('')}
            </div>
        `)
    },
    projects: async () => {
        const loading = appendLoading('Fetching GitHub projects')
        try {
            const repos = await fetchJson<Repo[]>('https://api.github.com/users/LIghtJUNction/repos?sort=updated&per_page=8')
            loading.remove()
            writeLine(`
                <div class="project-list">
                    ${repos.map((repo) => `
                        <article>
                            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a>
                            <p>${escapeHtml(repo.description ?? 'No description')}</p>
                            <small>${escapeHtml(repo.language ?? 'Unknown')} / ${repo.stargazers_count} stars / ${repo.forks_count} forks</small>
                        </article>
                    `).join('')}
                </div>
            `)
        } catch (error) {
            loading.remove()
            writeLine(`Failed to fetch projects: ${escapeHtml(error instanceof Error ? error.message : String(error))}`, 'error')
        }
    },
    stats: async () => {
        const loading = appendLoading('Fetching GitHub stats')
        try {
            const user = await fetchJson<GitHubUser>('https://api.github.com/users/LIghtJUNction')
            const repos = await fetchJson<Repo[]>('https://api.github.com/users/LIghtJUNction/repos?per_page=100')
            const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0)
            const joined = new Date(user.created_at).toISOString().slice(0, 10)
            loading.remove()
            writeLine(`
                <div class="stats-grid">
                    <section><b>${user.public_repos}</b><span>Repos</span></section>
                    <section><b>${stars}</b><span>Stars</span></section>
                    <section><b>${user.followers}</b><span>Followers</span></section>
                    <section><b>${joined}</b><span>Joined</span></section>
                </div>
            `)
        } catch (error) {
            loading.remove()
            writeLine(`Failed to fetch stats: ${escapeHtml(error instanceof Error ? error.message : String(error))}`, 'error')
        }
    },
    contact: () => {
        writeLine(`
            <div class="contact-list">
                <a href="https://github.com/LIghtJUNction" target="_blank" rel="noopener noreferrer">github.com/LIghtJUNction</a>
                <a href="mailto:lightjunction.me@gmail.com">lightjunction.me@gmail.com</a>
                <code>PGP EB21B83AB1E982DF66F08387A67178405F7736FD</code>
            </div>
        `)
    },
    msg: openSecureCard,
    clear: () => { output.innerHTML = '' },
    whoami: () => writeLine('guest<br>LIghtJUNction<br>builder of questionable but useful things'),
    pwd: () => writeLine('/home/guest'),
    ls: () => writeLine('about.txt&nbsp;&nbsp;projects/&nbsp;&nbsp;contact.sh&nbsp;&nbsp;.pgp-key&nbsp;&nbsp;.bootstrap/'),
    uname: () => writeLine('lightjunction 2026.06 x86_64 GNU/Linux'),
    fastfetch: () => {
        writeLine(`
            <pre class="fetch">       /\\
      /  \\       user  LIghtJUNction
     / /\\ \\      host  lightjunction.github.io
    / ____ \\     shell zsh + fish + chaos
   /_/    \\_\\    focus AI / Linux / weird tools</pre>
        `)
    },
    reboot: resetTerminal,
}

function commandDescription(name: string): string {
    return {
        help: 'show commands',
        about: 'who this is',
        skills: 'working areas',
        projects: 'recent repositories',
        stats: 'GitHub numbers',
        contact: 'links and key',
        msg: 'encrypted message card',
        clear: 'clear scrollback',
        whoami: 'print identity',
        pwd: 'current path',
        ls: 'list files',
        uname: 'kernel cosplay',
        fastfetch: 'system card',
        reboot: 'reset terminal',
    }[name] ?? ''
}

function appendLoading(label: string): HTMLElement {
    const line = document.createElement('div')
    line.className = 'term-line muted'
    line.textContent = `${label}...`
    output.appendChild(line)
    output.scrollTop = output.scrollHeight
    return line
}

async function execute(commandLine: string): Promise<void> {
    const [command = '', ...args] = commandLine.trim().split(/\s+/)
    if (!command) return

    writeCommand(commandLine)
    const handler = commands[command.toLowerCase()]
    if (!handler) {
        writeLine(`Command not found: ${escapeHtml(command)}. Try <kbd>help</kbd>.`, 'error')
        return
    }
    await handler(args)
}

function handleKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLTextAreaElement || event.metaKey || event.ctrlKey || event.altKey) {
        return
    }

    if (event.key === 'Enter') {
        event.preventDefault()
        const submitted = currentInput
        if (submitted.trim()) {
            history.push(submitted)
            historyIndex = history.length
        }
        setInput('')
        void execute(submitted)
        return
    }

    if (event.key === 'Backspace') {
        event.preventDefault()
        setInput(currentInput.slice(0, -1))
        return
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (historyIndex > 0) {
            historyIndex -= 1
            setInput(history[historyIndex] ?? '')
        }
        return
    }

    if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (historyIndex < history.length - 1) {
            historyIndex += 1
            setInput(history[historyIndex] ?? '')
        } else {
            historyIndex = history.length
            setInput('')
        }
        return
    }

    if (event.key === 'Tab') {
        event.preventDefault()
        const match = COMMAND_NAMES.find((name) => name.startsWith(currentInput.toLowerCase()))
        if (match) setInput(match)
        return
    }

    if (event.key.length === 1) {
        setInput(currentInput + event.key)
    }
}

function bindSecureCard(): void {
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

    $('encrypt-now').addEventListener('click', () => void encryptAndReveal())
}

function bindChrome(): void {
    $('btn-reset').addEventListener('click', resetTerminal)
    $('btn-fullscreen').addEventListener('click', () => void document.documentElement.requestFullscreen?.())
    $('btn-message').addEventListener('click', openSecureCard)
    $('result-copy').addEventListener('click', () => void copyEncrypted())
    $('result-github').addEventListener('click', openGitHubIssue)
    $('result-close').addEventListener('click', closeResult)
    window.addEventListener('resize', () => {
        if (!secureCard.hidden) {
            drag.x = Math.min(drag.x, window.innerWidth - secureCard.offsetWidth - 12)
            drag.y = Math.min(drag.y, window.innerHeight - secureCard.offsetHeight - 12)
            paintSecureCard()
        }
    })
    document.addEventListener('keydown', handleKeydown)
}

function boot(): void {
    writeLine('<pre class="hero-type">LIghtJUNction</pre>')
    writeLine('Personal terminal. PGP messages. Linux bootstrap notes. Type <kbd>help</kbd>.', 'muted')
}

bindChrome()
bindSecureCard()
boot()
placeSecureCard()
secureCard.hidden = true
requestAnimationFrame(tick)
