import { COMMAND_NAMES, commandDescription } from './commands'
import { $, escapeHtml } from './dom'
import { fetchJson, fetchStaticProjectCards, type GitHubUser, type Repo, type RepoCard } from './github'
import { initMotion, registerReveals } from './motion'
import { PUBLIC_KEY } from './public-key'
import './styles.css'

type OpenPgpModule = typeof import('openpgp')

let openpgpModule: OpenPgpModule | null = null

async function loadOpenPgp(): Promise<OpenPgpModule> {
    if (!openpgpModule) {
        openpgpModule = await import('openpgp')
    }
    return openpgpModule
}

type CommandHandler = (args: string[]) => void | Promise<void>

const output = $<HTMLElement>('terminal-output')
const inputText = $<HTMLElement>('input-text')
const secureCard = $<HTMLElement>('secure-card')
const secureMessage = $<HTMLTextAreaElement>('secure-message')
const resultOverlay = $<HTMLElement>('result-overlay')
const resultContent = $<HTMLElement>('result-content')
const resultCopy = $<HTMLButtonElement>('result-copy')
const toast = $<HTMLElement>('toast')
const terminalRegion = $<HTMLElement>('terminal-console')
const workspaceTitle = $<HTMLElement>('workspace-title')
const workspaceKicker = $<HTMLElement>('workspace-kicker')
const projectGrid = $<HTMLElement>('project-grid')
const projectStatus = $<HTMLElement>('project-status')
const projectCount = $<HTMLElement>('project-count')
const projectSort = $<HTMLElement>('project-sort')
const projectGroups = $<HTMLElement>('project-groups')
const themeButton = $<HTMLButtonElement>('btn-theme')
const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const pulseCard = document.getElementById('pulse-card')

let currentInput = ''
let history: string[] = []
let historyIndex = 0
let encryptedMessage = ''
let sending = false
let activeApp: AppId = 'projects'
let projectsLoaded = false
let projectCards: RepoCard[] = []
let projectSource: ProjectSource = 'network'
let activeProjectGroup: ProjectGroupId = 'ai'
let previousFocus: HTMLElement | null = null
let inertElements: HTMLElement[] = []

type AppId = 'projects' | 'terminal'
type ProjectSource = 'cache' | 'network'
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

function formatNumber(value: number | null): string {
    if (value === null) return 'unknown'
    return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string | null): string {
    if (!value) return 'not pushed'
    return new Date(value).toISOString().slice(0, 10)
}

type Theme = 'light' | 'dark'

function currentTheme(): Theme {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'))
    themeColorMeta?.setAttribute('content', theme === 'dark' ? '#14120e' : '#f3efe6')
}

function toggleTheme(): void {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    try {
        window.localStorage.setItem('lightjunction.theme', next)
    } catch {
        // Storage may be unavailable; the theme still applies for this session.
    }
    applyTheme(next)
    showToast(next === 'dark' ? 'Dark theme' : 'Light theme')
}

function countUp(element: HTMLElement, target: number): void {
    if (reduceMotionQuery.matches) {
        element.textContent = formatNumber(target)
        return
    }
    const duration = 900
    const start = performance.now()
    const step = (now: number): void => {
        const progress = Math.min(1, (now - start) / duration)
        const eased = 1 - (1 - progress) ** 3
        element.textContent = formatNumber(Math.round(target * eased))
        if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
}

async function initPulse(): Promise<void> {
    if (!pulseCard) return
    const reposEl = pulseCard.querySelector<HTMLElement>('[data-pulse="repos"]')
    const starsEl = pulseCard.querySelector<HTMLElement>('[data-pulse="stars"]')
    const latestEl = pulseCard.querySelector<HTMLElement>('[data-pulse="latest"]')
    const latestDateEl = pulseCard.querySelector<HTMLElement>('[data-pulse="latest-date"]')
    if (!reposEl || !starsEl || !latestEl || !latestDateEl) return

    try {
        const cards = readProjectCache()?.cards ?? await fetchStaticProjectCards()
        if (cards.length === 0) return
        const totalStars = cards.reduce((sum, repo) => sum + repo.stargazers_count, 0)
        const latest = cards.reduce((a, b) => {
            const timeA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0
            const timeB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0
            return timeB > timeA ? b : a
        })
        countUp(reposEl, cards.length)
        countUp(starsEl, totalStars)
        latestEl.textContent = latest.full_name
        latestDateEl.textContent = latest.pushed_at ? `pushed ${formatDate(latest.pushed_at)}` : ''
    } catch {
        // The pulse card is informational; keep placeholders when data is unavailable.
    }
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
        // Cache failure should not affect the project card list; 缓存失败不应影响项目卡片列表。
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

function renderProjectCards(cards: RepoCard[], source: ProjectSource): void {
    projectCards = cards
    projectSource = source
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
            <div class="project-shell reveal">
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
            </div>
        `
    }).join('')

    registerReveals(projectGrid)
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
    document.body.dataset.activeApp = appId

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

    workspaceTitle.textContent = appId === 'projects' ? 'Selected work' : 'Terminal experience'
    workspaceKicker.textContent = appId === 'projects' ? 'Library / GitHub' : 'Interactive / secure tty'

    if (appId === 'projects' && !projectsLoaded) {
        void loadProjectCards()
    }
    if (appId === 'terminal') {
        requestAnimationFrame(() => terminalRegion.focus())
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
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && !secureCard.contains(activeElement)) {
        previousFocus = activeElement
    }
    secureMessage.value = ''
    sending = false
    secureCard.hidden = false
    placeSecureCard()
    showToast('Secure card armed')
    secureMessage.focus()
}

function restorePreviousFocus(): void {
    const focusTarget = previousFocus
    previousFocus = null
    if (focusTarget?.isConnected) {
        focusTarget.focus()
    }
}

function dismissSecureCard(): void {
    if (secureCard.hidden) return
    if (document.activeElement instanceof HTMLElement && secureCard.contains(document.activeElement)) {
        document.activeElement.blur()
    }
    secureCard.hidden = true
    sending = false
    drag.active = false
    secureCard.classList.remove('dragging')
    restorePreviousFocus()
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
    if (!secureCard.hidden && !drag.active && !sending && !reduceMotionQuery.matches) {
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
        const openpgp = await loadOpenPgp()
        const publicKey = await openpgp.readKey({ armoredKey: PUBLIC_KEY })
        encryptedMessage = await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            encryptionKeys: publicKey,
        }) as string

        await navigator.clipboard.writeText(encryptedMessage)
        secureCard.hidden = true
        resultContent.textContent = encryptedMessage
        showResultDialog()
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

function setModalBackgroundInert(): void {
    inertElements = []
    for (const child of document.body.children) {
        if (!(child instanceof HTMLElement) || child === resultOverlay || child === toast) continue
        if (child.inert) continue
        child.inert = true
        inertElements.push(child)
    }
}

function clearModalBackgroundInert(): void {
    for (const element of inertElements) {
        element.inert = false
    }
    inertElements = []
}

function showResultDialog(): void {
    resultOverlay.classList.add('show')
    resultOverlay.setAttribute('aria-hidden', 'false')
    setModalBackgroundInert()
    resultCopy.focus()
}

function closeResult(): void {
    resultOverlay.classList.remove('show')
    resultOverlay.setAttribute('aria-hidden', 'true')
    encryptedMessage = ''
    clearModalBackgroundInert()
    restorePreviousFocus()
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
                <strong>开源支持</strong>
                <p>如果你觉得这些项目有帮助，欢迎通过加密消息留下赞助或支持信息。</p>
                <p>不再提供 GPT-5.5 token 赞助。</p>
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
    if (isInteractiveTarget(event.target)) return
    if (
        activeApp !== 'terminal'
        || event.target !== terminalRegion
        || event.metaKey
        || event.ctrlKey
        || event.altKey
    ) {
        return
    }

    if (event.key === 'Tab') return

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

    if (event.key === 'ArrowRight' && currentInput) {
        const match = COMMAND_NAMES.find((name) => name.startsWith(currentInput.toLowerCase()))
        if (match && match !== currentInput.toLowerCase()) {
            event.preventDefault()
            setInput(match)
        }
        return
    }

    if (event.key.length === 1) {
        setInput(currentInput + event.key)
    }
}

const INTERACTIVE_SELECTOR = 'button, a, textarea, input, select, summary, [contenteditable]:not([contenteditable="false"])'
const DIALOG_FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

function trapResultFocus(event: KeyboardEvent): void {
    const focusable = Array.from(
        resultOverlay.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) {
        event.preventDefault()
        return
    }

    const activeElement = document.activeElement
    if (event.shiftKey && (activeElement === first || !resultOverlay.contains(activeElement))) {
        event.preventDefault()
        last.focus()
    } else if (!event.shiftKey && (activeElement === last || !resultOverlay.contains(activeElement))) {
        event.preventDefault()
        first.focus()
    }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
    if (resultOverlay.classList.contains('show')) {
        if (event.key === 'Escape') {
            event.preventDefault()
            closeResult()
        } else if (event.key === 'Tab') {
            trapResultFocus(event)
        }
        return
    }

    if (event.key === 'Escape' && !secureCard.hidden) {
        event.preventDefault()
        dismissSecureCard()
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
    $('secure-cancel').addEventListener('click', dismissSecureCard)
}

function bindChrome(): void {
    $('btn-reset').addEventListener('click', resetTerminal)
    $('btn-fullscreen').addEventListener('click', () => void document.documentElement.requestFullscreen?.())
    themeButton.addEventListener('click', toggleTheme)
    $('btn-message').addEventListener('click', openSecureCard)
    $('btn-contact-message').addEventListener('click', openSecureCard)
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
        renderProjectCards(projectCards, projectSource)
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
    terminalRegion.addEventListener('keydown', handleKeydown)
    terminalRegion.addEventListener('click', (event) => {
        if (!isInteractiveTarget(event.target)) terminalRegion.focus()
    })
    document.addEventListener('keydown', handleGlobalKeydown)
}

function boot(): void {
    writeLine('<pre class="hero-type">LIghtJUNction</pre>')
    writeLine('Terminal app. PGP messages. Open-source support. Type <kbd>sponsor</kbd> or <kbd>help</kbd>.', 'muted')
}

initMotion()
applyTheme(currentTheme())
bindChrome()
bindSecureCard()
boot()
switchApp('projects')
placeSecureCard()
secureCard.hidden = true
void initPulse()
requestAnimationFrame(tick)
