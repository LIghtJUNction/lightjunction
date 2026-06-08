import * as openpgp from 'openpgp'
import { COMMAND_NAMES, commandDescription } from './commands'
import { $, escapeHtml } from './dom'
import { fetchJson, fetchStaticProjectCards, type GitHubUser, type Repo, type RepoCard } from './github'
import { PUBLIC_KEY } from './public-key'
import { applyRandomVisuals } from './visuals'
import './styles.css'

type CommandHandler = (args: string[]) => void | Promise<void>

const output = $<HTMLElement>('terminal-output')
const inputText = $<HTMLElement>('input-text')
const secureCard = $<HTMLElement>('secure-card')
const secureMessage = $<HTMLTextAreaElement>('secure-message')
const resultOverlay = $<HTMLElement>('result-overlay')
const resultContent = $<HTMLElement>('result-content')
const toast = $<HTMLElement>('toast')
const asciiBg = $<HTMLCanvasElement>('ascii-bg')
const workspaceTitle = $<HTMLElement>('workspace-title')
const workspaceKicker = $<HTMLElement>('workspace-kicker')
const projectGrid = $<HTMLElement>('project-grid')
const projectStatus = $<HTMLElement>('project-status')
const projectCount = $<HTMLElement>('project-count')
const projectSort = $<HTMLElement>('project-sort')
const projectGroups = $<HTMLElement>('project-groups')

let currentInput = ''
let history: string[] = []
let historyIndex = 0
let encryptedMessage = ''
let sending = false
let activeApp: AppId = 'projects'
let projectsLoaded = false
let projectCards: RepoCard[] = []
let activeProjectGroup: ProjectGroupId = 'ai'

type AppId = 'projects' | 'terminal'
type ProjectGroupId = 'ai' | 'systems' | 'security' | 'web' | 'data' | 'tools' | 'all'

type CachedProjects = {
    cachedAt: number
    cards: RepoCard[]
}

type ProjectGroup = {
    id: ProjectGroupId
    label: string
    keywords: string[]
}

const PROJECT_GROUPS: ProjectGroup[] = [
    {
        id: 'ai',
        label: 'AI',
        keywords: [
            'agent',
            'ai',
            'astrbot',
            'chatgpt',
            'claude',
            'codex',
            'dataset',
            'gpt',
            'inference',
            'llm',
            'mcp',
            'model',
            'ollama',
            'openai',
            'prompt',
            'rag',
            'token',
            'train',
        ],
    },
    {
        id: 'systems',
        label: 'Systems',
        keywords: [
            'adb',
            'android',
            'arch',
            'bootstrap',
            'daed',
            'docker',
            'kernel',
            'linux',
            'network',
            'package',
            'root',
            'shell',
            'sing-box',
            'tun',
            'vpn',
        ],
    },
    {
        id: 'security',
        label: 'Security',
        keywords: ['auth', 'crypto', 'encrypt', 'gpg', 'key', 'oauth', 'openpgp', 'pgp', 'security', 'ssh'],
    },
    {
        id: 'web',
        label: 'Web',
        keywords: ['css', 'frontend', 'html', 'javascript', 'react', 'site', 'typescript', 'vite', 'web'],
    },
    {
        id: 'data',
        label: 'Data',
        keywords: ['api', 'crawl', 'data', 'dataset', 'etl', 'fetch', 'pipeline', 'scrape'],
    },
    {
        id: 'tools',
        label: 'Tools',
        keywords: ['automation', 'cli', 'script', 'tool', 'utility', 'workflow'],
    },
    {
        id: 'all',
        label: 'All',
        keywords: [],
    },
]

const PROJECT_CACHE_KEY = 'lightjunction.projectCards.v5'
const PROJECT_CACHE_TTL_MS = 15 * 60 * 1000

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

function initAsciiBackground(): void {
    const context = asciiBg.getContext('2d')
    if (!context) return
    const drawContext = context

    type AsciiGlyph = {
        homeX: number
        homeY: number
        phase: number
        seed: number
        char: string
        layer: number
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        asciiBg.hidden = true
        return
    }

    const pointer = {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.5,
        tx: window.innerWidth * 0.5,
        ty: window.innerHeight * 0.5,
        active: false,
    }
    const chars = '01<>[]{}\\/|*+=-_.'
    const hotChars = '@#%&*+=<>'
    const cell = 34
    const maxGlyphs = 760
    const frameIntervalMs = 1000 / 24
    const glyphs: AsciiGlyph[] = []
    let width = 0
    let height = 0
    let frame = 0
    let lastDraw = 0

    function pickChar(seed: number, hot = 0): string {
        const alphabet = hot > 0.62 ? hotChars : chars
        return alphabet[Math.abs(Math.floor(seed * alphabet.length)) % alphabet.length] ?? '.'
    }

    function resize(): void {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.25)
        width = window.innerWidth
        height = window.innerHeight
        asciiBg.width = Math.floor(width * ratio)
        asciiBg.height = Math.floor(height * ratio)
        asciiBg.style.width = `${width}px`
        asciiBg.style.height = `${height}px`
        drawContext.setTransform(ratio, 0, 0, ratio, 0, 0)
        drawContext.font = '12px "JetBrains Mono", monospace'
        drawContext.textBaseline = 'middle'
        drawContext.textAlign = 'center'

        glyphs.length = 0
        const columns = Math.ceil(width / cell) + 2
        const rows = Math.ceil(height / cell) + 2
        const density = Math.min(1, maxGlyphs / Math.max(1, columns * rows))

        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < columns; col += 1) {
                const seed = Math.sin((row + 1) * 91.17 + (col + 1) * 47.31) * 10_000
                const unit = seed - Math.floor(seed)
                if (unit > density) continue

                const jitterX = (seed - Math.floor(seed) - 0.5) * 8
                const jitterY = (Math.sin(seed * 2.17) - Math.floor(Math.sin(seed * 2.17)) - 0.5) * 8
                const homeX = col * cell - cell + jitterX
                const homeY = row * cell - cell + jitterY

                glyphs.push({
                    homeX,
                    homeY,
                    phase: seed,
                    seed,
                    char: pickChar(seed),
                    layer: 0.68 + unit * 0.52,
                })
            }
        }
    }

    function draw(now = 0): void {
        if (now - lastDraw < frameIntervalMs) {
            requestAnimationFrame(draw)
            return
        }
        lastDraw = now
        frame += 1
        pointer.x += (pointer.tx - pointer.x) * 0.16
        pointer.y += (pointer.ty - pointer.y) * 0.16

        drawContext.clearRect(0, 0, width, height)

        for (const glyph of glyphs) {
            const homeWave = Math.sin(frame * 0.035 + glyph.phase)
            const baseX = glyph.homeX + Math.cos(frame * 0.012 + glyph.phase) * glyph.layer * 4
            const baseY = glyph.homeY + homeWave * glyph.layer * 5
            const dx = baseX - pointer.x
            const dy = baseY - pointer.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1
            const hot = pointer.active ? Math.max(0, 1 - distance / 330) : 0
            const swirl = hot * hot * 30 * glyph.layer
            const drift = hot * 18 * glyph.layer
            const x = baseX + (-dy / distance) * swirl + (-dx / distance) * drift
            const y = baseY + (dx / distance) * swirl + (-dy / distance) * drift
            const pulse = Math.max(0, Math.sin(frame * 0.07 + glyph.phase))
            const alpha = 0.045 + hot * 0.34 + pulse * 0.028

            if (hot > 0.35 && (frame + Math.floor(glyph.seed)) % 5 === 0) {
                glyph.char = pickChar(glyph.seed + frame * 0.023 + hot * 8, hot)
            } else if (frame % 48 === 0 && pulse > 0.92) {
                glyph.char = pickChar(glyph.seed + frame * 0.004)
            }

            const hue = 142 + hot * 58 + Math.sin(glyph.phase + frame * 0.01) * 10
            const light = 48 + hot * 24 + pulse * 5
            drawContext.font = `${11 + hot * 4}px "JetBrains Mono", monospace`
            drawContext.fillStyle = `hsla(${hue}, 88%, ${light}%, ${Math.min(alpha, 0.48)})`
            drawContext.fillText(glyph.char, x, y)
        }

        requestAnimationFrame(draw)
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', (event) => {
        pointer.tx = event.clientX
        pointer.ty = event.clientY
        pointer.active = true
    })
    window.addEventListener('pointerleave', () => {
        pointer.active = false
    })

    resize()
    requestAnimationFrame(draw)
}

function formatNumber(value: number | null): string {
    if (value === null) return 'unknown'
    return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string | null): string {
    if (!value) return 'not pushed'
    return new Date(value).toISOString().slice(0, 10)
}

function readProjectCache(): CachedProjects | null {
    try {
        const raw = window.localStorage.getItem(PROJECT_CACHE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<CachedProjects>
        if (typeof parsed.cachedAt !== 'number' || !Array.isArray(parsed.cards)) return null
        if (Date.now() - parsed.cachedAt > PROJECT_CACHE_TTL_MS) return null

        return {
            cachedAt: parsed.cachedAt,
            cards: parsed.cards as RepoCard[],
        }
    } catch {
        return null
    }
}

function writeProjectCache(cards: RepoCard[]): void {
    try {
        const cached: CachedProjects = {
            cachedAt: Date.now(),
            cards,
        }
        window.localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(cached))
    } catch {
        // Cache failure should not affect the project app.
    }
}

function repoSearchText(repo: RepoCard): string {
    return [
        repo.full_name,
        repo.description ?? '',
        repo.language ?? '',
        ...(repo.topics ?? []),
    ].join(' ').toLowerCase()
}

function isProjectGroupId(value: string | undefined): value is ProjectGroupId {
    return PROJECT_GROUPS.some((group) => group.id === value)
}

function repoMatchesGroup(repo: RepoCard, groupId: ProjectGroupId): boolean {
    if (groupId === 'all') return true

    const group = PROJECT_GROUPS.find((item) => item.id === groupId)
    if (!group) return false

    const searchText = repoSearchText(repo)
    return group.keywords.some((keyword) => searchText.includes(keyword))
}

function projectGroupCount(groupId: ProjectGroupId): number {
    return projectCards.filter((repo) => repoMatchesGroup(repo, groupId)).length
}

function renderProjectGroups(): void {
    projectGroups.innerHTML = PROJECT_GROUPS.map((group) => {
        const selected = group.id === activeProjectGroup
        return `
            <button class="project-group${selected ? ' active' : ''}" type="button" role="tab" aria-selected="${selected}" data-project-group="${group.id}">
                ${escapeHtml(group.label)} ${projectGroupCount(group.id)}
            </button>
        `
    }).join('')
}

function renderProjectCards(cards: RepoCard[], source: 'cache' | 'network'): void {
    projectCards = cards
    renderProjectGroups()

    const filteredCards = cards.filter((repo) => repoMatchesGroup(repo, activeProjectGroup))
    const totalStars = filteredCards.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    const knownCommitTotal = filteredCards.reduce((sum, repo) => sum + (repo.commit_count ?? 0), 0)
    const unknownCommits = filteredCards.filter((repo) => repo.commit_count === null).length
    const activeGroupLabel = PROJECT_GROUPS.find((group) => group.id === activeProjectGroup)?.label ?? 'Projects'

    projectCount.textContent = `${filteredCards.length} ${activeGroupLabel} projects / ${cards.length} total / ${formatNumber(totalStars)} stars`
    projectSort.textContent = `Rank: recent activity first, then newness, stars, and commits`
    projectStatus.textContent = source === 'cache'
        ? 'Showing cached GitHub data while refresh is available.'
        : `${formatNumber(knownCommitTotal)} commits counted${unknownCommits ? ` / ${unknownCommits} unknown` : ''}.`

    if (filteredCards.length === 0) {
        projectGrid.innerHTML = '<div class="empty-state">No repositories matched this group.</div>'
        return
    }

    projectGrid.innerHTML = filteredCards.map((repo, index) => {
        const owner = repo.full_name.split('/')[0] ?? 'Unknown'
        const tags = [
            owner,
            repo.language ?? 'Unknown',
            repo.fork ? 'Fork' : 'Source',
            repo.archived ? 'Archived' : 'Active',
        ]
        const description = repo.description ?? 'No description yet.'
        return `
            <article class="project-card">
                <header>
                    <h3><a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.full_name)}</a></h3>
                    <span class="project-rank">#${index + 1}</span>
                </header>
                <div class="project-metrics" aria-label="Repository metrics">
                    <span>${formatNumber(repo.stargazers_count)} stars</span>
                    <span>${formatNumber(repo.commit_count)} commits</span>
                    <span>${formatNumber(repo.forks_count)} forks</span>
                    <span>${formatNumber(repo.open_issues_count)} issues</span>
                </div>
                <p>${escapeHtml(description)}</p>
                <div class="project-tags">
                    ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
                </div>
                <footer>
                    <span>pushed ${formatDate(repo.pushed_at)}</span>
                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">Open</a>
                </footer>
            </article>
        `
    }).join('')
}

async function loadProjectCards(force = false): Promise<void> {
    const cache = readProjectCache()
    if (!force && cache) {
        renderProjectCards(cache.cards, 'cache')
        projectsLoaded = true
        return
    }

    projectStatus.textContent = 'Loading synced project cards from the repository...'
    projectGrid.innerHTML = ''

    try {
        const cards = await fetchStaticProjectCards()
        writeProjectCache(cards)
        renderProjectCards(cards, 'network')
        projectsLoaded = true
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        projectStatus.textContent = `Failed to fetch GitHub projects: ${message}`
        projectCount.textContent = 'GitHub projects unavailable'
        if (cache) {
            renderProjectCards(cache.cards, 'cache')
            showToast('Using cached projects')
        }
    }
}

function switchApp(appId: AppId): void {
    activeApp = appId

    document.querySelectorAll<HTMLElement>('[data-app-panel]').forEach((panel) => {
        const visible = panel.dataset.appPanel === appId
        panel.hidden = !visible
        panel.classList.toggle('active', visible)
    })

    document.querySelectorAll<HTMLButtonElement>('[data-app-target]').forEach((button) => {
        const selected = button.dataset.appTarget === appId
        button.classList.toggle('active', selected)
        button.setAttribute('aria-pressed', String(selected))
    })

    workspaceTitle.textContent = appId === 'projects' ? 'Proj Cards' : 'Terminal'
    workspaceKicker.textContent = appId === 'projects' ? 'App / GitHub' : 'App / tty1'

    if (appId === 'projects' && !projectsLoaded) {
        void loadProjectCards()
    }
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
                <p>Independent builder focused on AI tooling, Linux automation, network workflows, and practical security.</p>
                <p>Learning in public by turning rough personal systems into reusable tools.</p>
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
        const loading = appendLoading('Loading synced project cards')
        try {
            const repos = (readProjectCache()?.cards ?? await fetchStaticProjectCards()).slice(0, 8)
            loading.remove()
            writeLine(`
                <div class="project-list">
                    ${repos.map((repo) => `
                        <article>
                            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a>
                            <p>${escapeHtml(repo.description ?? 'No description')}</p>
                            <small>${escapeHtml(repo.language ?? 'Unknown')} / ${repo.stargazers_count} stars / ${formatNumber(repo.commit_count)} commits</small>
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
    sponsor: () => {
        writeLine(`
            <div class="panel-copy">
                <strong>开源协作招募</strong>
                <p>寻找活跃的开源贡献者，学生优先。我可以赞助 GPT-5.5 token：你可以用于自己的开源项目，也请用 GPT-5.5 帮我测试、调试、改进我的公开仓库。</p>
                <p>仅限非商业用途。需要项目经历、又缺少 token，欢迎联系互加微信。</p>
                <p class="muted">Type <kbd>msg</kbd> to send an encrypted contact note.</p>
            </div>
        `)
    },
    msg: openSecureCard,
    clear: () => { output.innerHTML = '' },
    whoami: () => writeLine('guest<br>LIghtJUNction<br>builder of compact tools for real systems'),
    pwd: () => writeLine('/home/guest'),
    ls: () => writeLine('about.txt&nbsp;&nbsp;projects/&nbsp;&nbsp;contact.sh&nbsp;&nbsp;.pgp-key&nbsp;&nbsp;.bootstrap/'),
    uname: () => writeLine('lightjunction 2026.06 x86_64 GNU/Linux'),
    fastfetch: () => {
        writeLine(`
            <pre class="fetch">       /\\
      /  \\       user  LIghtJUNction
     / /\\ \\      host  lightjunction.github.io
    / ____ \\     shell zsh + fish
   /_/    \\_\\    focus AI / Linux / security</pre>
        `)
    },
    reboot: resetTerminal,
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
    if (activeApp !== 'terminal') {
        return
    }

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
    $('btn-refresh-projects').addEventListener('click', () => {
        void loadProjectCards(true)
        showToast('Refreshing projects')
    })
    projectGroups.addEventListener('click', (event) => {
        const target = event.target
        if (!(target instanceof HTMLButtonElement)) return

        const group = target.dataset.projectGroup
        if (!isProjectGroupId(group)) return

        activeProjectGroup = group
        renderProjectCards(projectCards, 'cache')
    })
    $('result-copy').addEventListener('click', () => void copyEncrypted())
    $('result-github').addEventListener('click', openGitHubIssue)
    $('result-close').addEventListener('click', closeResult)
    document.querySelectorAll<HTMLButtonElement>('[data-app-target]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.appTarget
            if (target === 'projects' || target === 'terminal') {
                switchApp(target)
            }
        })
    })
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
    writeLine('Terminal app. PGP messages. Open-source token sponsorship. Type <kbd>sponsor</kbd> or <kbd>help</kbd>.', 'muted')
}

applyRandomVisuals()
initAsciiBackground()
bindChrome()
bindSecureCard()
boot()
switchApp('projects')
placeSecureCard()
secureCard.hidden = true
requestAnimationFrame(tick)
