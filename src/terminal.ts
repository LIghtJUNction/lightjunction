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

// State
let encrypted = ''
let sent = false
let history: string[] = []
let historyIndex = -1
let currentInput = ''

// DOM Elements
const output = document.getElementById('output')!
const cmdInput = document.getElementById('cmd-input')!
const secureCard = document.getElementById('secure-card')!
const secureMsg = document.getElementById('secure-msg') as HTMLTextAreaElement
const resultOverlay = document.getElementById('result-overlay')!
const resultContent = document.getElementById('result-content')!
const btnCopy = document.getElementById('btn-copy')!
const btnGithub = document.getElementById('btn-github')!
const btnClose = document.getElementById('btn-close')!
const toast = document.getElementById('toast')!

// GitHub Data
let githubData = {
    repos: 0,
    stars: 0,
    followers: 0,
    reposList: [] as any[]
}

// Terminal Physics for Secure Card
let posX = 0, posY = 0
let velX = 0, velY = 0
let dragging = false
let startX = 0, startY = 0
let offsetX = 0, offsetY = 0
let lastX = 0, lastY = 0
let lastT = 0

const GRAV = 0.35
const FRIC = 0.99

function initSecureCard() {
    posX = (window.innerWidth - secureCard.offsetWidth) / 2
    posY = window.innerHeight - secureCard.offsetHeight - 100
    updateSecureCard()
}

function updateSecureCard() {
    secureCard.style.left = posX + 'px'
    secureCard.style.top = posY + 'px'
    secureCard.style.transform = 'none'
}

function frame() {
    if (!dragging && !sent && secureCard.style.display !== 'none') {
        velY += GRAV
        velX *= FRIC
        velY *= FRIC
        posX += velX
        posY += velY

        const maxX = window.innerWidth - secureCard.offsetWidth
        const maxY = window.innerHeight - secureCard.offsetHeight

        if (posX < 0) { posX = 0; velX = -velX * 0.6 }
        if (posX > maxX) { posX = maxX; velX = -velX * 0.6 }
        if (posY > maxY) { posY = maxY; velY = -velY * 0.6 }

        if (posY < -secureCard.offsetHeight - 50) {
            doSendSecure()
        }

        updateSecureCard()
    }
    requestAnimationFrame(frame)
}

// Drag handlers for secure card
secureCard.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    secureCard.classList.add('dragging')
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
    updateSecureCard()
})

window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    secureCard.classList.remove('dragging')
})

// Touch handlers
secureCard.addEventListener('touchstart', (e) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
    const t = e.touches[0]
    secureCard.classList.add('dragging')
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

secureCard.addEventListener('touchmove', (e) => {
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
    updateSecureCard()
}, { passive: true })

secureCard.addEventListener('touchend', () => {
    dragging = false
    secureCard.classList.remove('dragging')
})

async function doSendSecure() {
    sent = true
    const text = secureMsg.value.trim()
    if (!text) {
        sent = false
        posY = window.innerHeight - secureCard.offsetHeight - 100
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
        resultContent.textContent = encrypted
        resultOverlay.classList.add('show')
        secureCard.style.display = 'none'
        showToast('Encrypted & copied!')
        addOutput('pgp', 'success', 'Message encrypted with PGP and copied to clipboard!')
    } catch (err) {
        showToast('Encryption error')
        sent = false
        posY = window.innerHeight - secureCard.offsetHeight - 100
        velY = 0
    }
}

// Toast
function showToast(msg: string) {
    toast.textContent = msg
    toast.classList.add('show')
    setTimeout(() => toast.classList.remove('show'), 2500)
}

// Output functions
function addOutput(content: string, type: string = '', extra: string = '') {
    const line = document.createElement('div')
    line.className = 'line' + (type ? ` output-text ${type}` : '')
    line.innerHTML = content + (extra ? extra : '')
    output.appendChild(line)
    output.scrollTop = output.scrollHeight
}

function addInputLine(cmd: string) {
    const line = document.createElement('div')
    line.className = 'line input-line'
    line.innerHTML = `<span class="prompt"><span class="prompt-user">guest</span>@<span class="prompt-path">lj</span>:<span class="prompt-char">~</span>$&nbsp;</span><span class="cmd">${escapeHtml(cmd)}</span>`
    output.appendChild(line)
    output.scrollTop = output.scrollHeight
}

function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// Commands
const commands: Record<string, (args: string[]) => void> = {
    help: () => {
        addOutput(`<pre class="ascii-art" style="color: var(--neon-green)">
╔══════════════════════════════════════════════════════════════╗
║                    LIghtJUNction Terminal                     ║
╚══════════════════════════════════════════════════════════════╝</pre>`)
        addOutput('', '', '<div class="help-table">' +
            '<div><span class="help-cmd">help</span></div><div class="help-desc">Show this help message</div>' +
            '<div><span class="help-cmd">about</span></div><div class="help-desc">About me</div>' +
            '<div><span class="help-cmd">skills</span></div><div class="help-desc">My technical skills</div>' +
            '<div><span class="help-cmd">projects</span></div><div class="help-desc">List my GitHub projects</div>' +
            '<div><span class="help-cmd">stats</span></div><div class="help-desc">GitHub statistics</div>' +
            '<div><span class="help-cmd">contact</span></div><div class="help-desc">Get in touch</div>' +
            '<div><span class="help-cmd">msg</span></div><div class="help-desc">Open encrypted message card</div>' +
            '<div><span class="help-cmd">clear</span></div><div class="help-desc">Clear the terminal</div>' +
            '<div><span class="help-cmd">sudo</span></div><div class="help-desc">Try sudo access</div>' +
            '<div><span class="help-cmd">matrix</span></div><div class="help-desc">Enter the matrix</div>' +
            '</div>')
    },

    about: () => {
        addOutput('', '', `<pre class="ascii-art">
 █████╗ ██╗  ██╗██╗ ██████╗ ██╗  ██╗████████╗
██╔══██╗██║  ██║██║██╔════╝ ██║  ██║╚══██╔══╝
███████║███████║██║██║  ███╗███████║   ██║
██╔══██║██╔══██║██║██║   ██║██╔══██║   ██║
██║  ██║██║  ██║██║╚██████╔╝██║  ██║   ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝</pre>`)
        addOutput('', '', '<div style="color: var(--text-secondary); margin-top: 10px;">' +
            '<p><span style="color: var(--neon-cyan)">> Identity:</span> Full-Stack Developer & Security Enthusiast</p>' +
            '<p><span style="color: var(--neon-cyan)">> Focus:</span> Building secure, efficient, open source solutions</p>' +
            '<p><span style="color: var(--neon-cyan)">> Currently:</span> Exploring cryptographic protocols & distributed systems</p>' +
            '<p><span style="color: var(--neon-cyan)">> Philosophy:</span> "Code is poetry, security is paramount"</p>' +
            '</div>')
    },

    skills: () => {
        addOutput('<span style="color: var(--neon-green)">[Skills] Loading...</span>', '', '<span class="loading"></span>')
        setTimeout(() => {
            const skillItems = document.querySelectorAll('.line:last-child')[0]
            if (skillItems) skillItems.remove()
            addOutput('', '', '<div class="skills-grid">' +
                '<div class="skill-item"><div class="skill-name">Frontend</div><div class="skill-tags"><span class="skill-tag">TypeScript</span><span class="skill-tag">React</span><span class="skill-tag">Vue</span><span class="skill-tag">Vite</span></div></div>' +
                '<div class="skill-item"><div class="skill-name">Backend</div><div class="skill-tags"><span class="skill-tag">Node.js</span><span class="skill-tag">Python</span><span class="skill-tag">Go</span><span class="skill-tag">PostgreSQL</span></div></div>' +
                '<div class="skill-item"><div class="skill-name">Security</div><div class="skill-tags"><span class="skill-tag">PGP</span><span class="skill-tag">OAuth</span><span class="skill-tag">JWT</span><span class="skill-tag">WebAuthn</span></div></div>' +
                '<div class="skill-item"><div class="skill-name">DevOps</div><div class="skill-tags"><span class="skill-tag">Docker</span><span class="skill-tag">Linux</span><span class="skill-tag">CI/CD</span><span class="skill-tag">Shell</span></div></div>' +
                '</div>')
        }, 500)
    },

    projects: async () => {
        addOutput('<span class="loading">Fetching projects</span>')
        try {
            if (githubData.reposList.length === 0) {
                const res = await fetch('https://api.github.com/users/LIghtJUNction/repos?sort=updated&per_page=10')
                githubData.reposList = await res.json()
            }
            addOutput('', '', '<div class="projects-list">' +
                githubData.reposList.slice(0, 6).map(repo => `
                    <div class="project-item">
                        <div class="project-name"><a href="${repo.html_url}" target="_blank">${repo.name}</a> ${repo.language ? `<span style="color: var(--neon-cyan); font-size: 10px;">[${repo.language}]</span>` : ''}</div>
                        <div class="project-desc">${repo.description || 'No description'}</div>
                        <div class="project-meta">
                            <span>★ ${repo.stargazers_count}</span>
                            <span>⑂ ${repo.forks_count}</span>
                        </div>
                    </div>
                `).join('') +
                '</div>')
        } catch {
            addOutput('Failed to fetch projects', 'error')
        }
    },

    stats: async () => {
        addOutput('<span class="loading">Fetching GitHub stats</span>')
        try {
            if (githubData.repos === 0) {
                const res = await fetch('https://api.github.com/users/LIghtJUNction')
                const data = await res.json()
                githubData.repos = data.public_repos
                githubData.followers = data.followers

                const reposRes = await fetch(`https://api.github.com/users/LIghtJUNction/repos?per_page=100`)
                const repos = await reposRes.json()
                githubData.stars = repos.reduce((sum: number, r: any) => sum + r.stargazers_count, 0)
            }
            addOutput('', '', '<div class="stats-display">' +
                `<div class="stat-item"><div class="stat-value">${githubData.repos}</div><div class="stat-label">Repos</div></div>` +
                `<div class="stat-item"><div class="stat-value">${githubData.stars}</div><div class="stat-label">Stars</div></div>` +
                `<div class="stat-item"><div class="stat-value">${githubData.followers}</div><div class="stat-label">Followers</div></div>` +
                `<div class="stat-item"><div class="stat-value">67</div><div class="stat-label">Following</div></div>` +
                '</div>')
        } catch {
            addOutput('Failed to fetch stats', 'error')
        }
    },

    contact: () => {
        addOutput('', '', '<div class="contact-list">' +
            '<div class="contact-item"><span class="contact-icon">🐙</span><span class="contact-label">GitHub</span><span class="contact-value"><a href="https://github.com/LIghtJUNction" target="_blank">github.com/LIghtJUNction</a></span></div>' +
            '<div class="contact-item"><span class="contact-icon">📧</span><span class="contact-label">Email</span><span class="contact-value"><a href="mailto:lightjunction.me@gmail.com">lightjunction.me@gmail.com</a></span></div>' +
            '<div class="contact-item"><span class="contact-icon">🔐</span><span class="contact-label">PGP Key</span><span class="contact-value" style="font-size: 10px; color: var(--text-secondary);">EB21B83AB1E982DF66F08387A67178405F7736FD</span></div>' +
            '</div>')
        addOutput('Use <span style="color: var(--neon-green)">msg</span> command to send encrypted messages!', 'info')
    },

    msg: () => {
        secureMsg.value = ''
        sent = false
        secureCard.style.display = 'block'
        initSecureCard()
        showToast('Secure card activated - drag up to send!')
        addOutput('Secure message card opened', 'success')
    },

    clear: () => {
        output.innerHTML = ''
    },

    sudo: () => {
        addOutput('<span style="color: var(--neon-pink)">[sudo] password for guest: </span>', '', '<span class="cursor"></span>')
        cmdInput.focus()
    },

    matrix: () => {
        addOutput('Entering the matrix...', 'success')
        document.body.style.animation = 'none'
        setTimeout(() => {
            document.body.style.filter = 'hue-rotate(180deg) saturate(2)'
            setTimeout(() => {
                document.body.style.filter = 'none'
                addOutput('You took the red pill.', 'success')
            }, 3000)
        }, 1000)
    },

    whoami: () => {
        addOutput('guest<br>LIghtJUNction<br>Full-Stack Developer')
    },

    pwd: () => {
        addOutput('/home/guest')
    },

    ls: () => {
        addOutput('', '', '<div style="color: var(--text-secondary);">' +
            'about.txt&nbsp;&nbsp; skills.log&nbsp;&nbsp; projects/&nbsp;&nbsp; contact.sh<br>' +
            '<span style="color: var(--text-dim)">Or use <span style="color: var(--neon-green)">ls -la</span> for hidden files</span></div>')
    },

    uname: () => {
        addOutput('LIghtJUNction-os 2026.1 x86_64 GNU/Linux')
    },

    neofetch: () => {
        addOutput('', '', `<pre style="color: var(--neon-green)">
        ██╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
        ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
        ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
        ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
        ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
        ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝</pre>`)
        addOutput('', '', '<div style="color: var(--text-secondary); text-align: left; display: inline-block;">' +
            '<div><span style="color: var(--neon-cyan)">user:</span> LIghtJUNction</div>' +
            '<div><span style="color: var(--neon-cyan)">host:</span> lj.dev</div>' +
            '<div><span style="color: var(--neon-cyan)">distro:</span> Arch Linux</div>' +
            '<div><span style="color: var(--neon-cyan)">kernel:</span> Linux 6.x</div>' +
            '<div><span style="color: var(--neon-cyan)">shell:</span> zsh + starship</div>' +
            '<div><span style="color: var(--neon-cyan)">term:</span> Alacritty</div>' +
            '<div><span style="color: var(--neon-cyan)">uptime:</span> just started</div>' +
            '</div>')
    }
}

// Parse and execute command
function execute(cmd: string) {
    const parts = cmd.trim().split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    if (command === '') {
        return
    }

    addInputLine(cmd)

    if (commands[command]) {
        commands[command](args)
    } else {
        addOutput(`<span style="color: var(--neon-pink)">Command not found: ${command}</span>`)
        addOutput(`Type <span style="color: var(--neon-green)">help</span> to see available commands`, 'dim')
    }
}

// Event handlers
cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const cmd = cmdInput.value
        if (cmd.trim()) {
            history.push(cmd)
            historyIndex = history.length
        }
        execute(cmd)
        cmdInput.value = ''
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (historyIndex > 0) {
            historyIndex--
            cmdInput.value = history[historyIndex]
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (historyIndex < history.length - 1) {
            historyIndex++
            cmdInput.value = history[historyIndex]
        } else {
            historyIndex = history.length
            cmdInput.value = ''
        }
    } else if (e.key === 'Tab') {
        e.preventDefault()
        const commands = ['help', 'about', 'skills', 'projects', 'stats', 'contact', 'msg', 'clear', 'sudo', 'matrix', 'whoami', 'pwd', 'ls', 'uname', 'neofetch']
        const input = cmdInput.value.toLowerCase()
        const matches = commands.filter(c => c.startsWith(input))
        if (matches.length === 1) {
            cmdInput.value = matches[0]
        }
    }
})

// Result overlay handlers
btnCopy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(encrypted)
    showToast('Copied!')
})

btnGithub.addEventListener('click', () => {
    const url = `https://github.com/LIghtJUNction/lightjunction/issues/new?title=encrypted+message&body=${encodeURIComponent(`## Encrypted Message\n\n\`\`\`\n${encrypted}\n\`\`\`\n\n---\n*via secure-message*`)}`
    window.open(url, '_blank')
})

btnClose.addEventListener('click', () => {
    resultOverlay.classList.remove('show')
    secureMsg.value = ''
    encrypted = ''
    sent = false
    secureCard.style.display = 'block'
    initSecureCard()
})

// Welcome message
function init() {
    const welcome = document.createElement('div')
    welcome.className = 'welcome'
    welcome.innerHTML = `<pre class="ascii-art">
 ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
 ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
 ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
 ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
 ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
 ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝</pre>
<div class="welcome-sub"><span>Full-Stack Developer</span> // <span>Security Enthusiast</span> // <span>Open Source Advocate</span></div>
<div style="color: var(--text-dim); margin-top: 20px; font-size: 12px;">Type <span style="color: var(--neon-green)">help</span> to see available commands</div>`
    output.appendChild(welcome)

    addOutput('')
    initSecureCard()
    frame()
}

init()