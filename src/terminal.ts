// pi-lens-ignore: find-import-file-without-extension
import { COMMAND_NAMES, commandDescription } from './commands'
// pi-lens-ignore: find-import-file-without-extension
import { $, escapeHtml, safeExternalUrl } from './dom'
// pi-lens-ignore: find-import-file-without-extension
import { formatNumber } from './format'
// pi-lens-ignore: find-import-file-without-extension
import { fetchJson, fetchStaticProjectCards, type GitHubUser, type Repo } from './github'
// pi-lens-ignore: find-import-file-without-extension
import { initMotion } from './motion'
import { mountShaderShowcase } from './shader-gallery.js'
// pi-lens-ignore: find-import-file-without-extension
import { ensureProjectCards, initProjectControls, initPulse, readProjectCache } from './projects'
// pi-lens-ignore: find-import-file-without-extension
import { initSecureCard, openSecureCard } from './secure-card'
// pi-lens-ignore: find-import-file-without-extension
import { initTheme } from './theme'
import './styles.css'
import './editorial-layer.css'

type CommandHandler = (args: string[]) => void | Promise<void>
type AppId = 'projects' | 'terminal'

const output = $<HTMLElement>('terminal-output')
const inputText = $<HTMLElement>('input-text')
const terminalRegion = $<HTMLElement>('terminal-console')
const workspaceTitle = $<HTMLElement>('workspace-title')
const workspaceKicker = $<HTMLElement>('workspace-kicker')

let currentInput = ''
const history: string[] = []
let historyIndex = 0
let activeApp: AppId = 'projects'

function writeLine(html: string, className = ''): void {
    const line = document.createElement('div')
    line.className = className ? `term-line ${className}` : 'term-line'
    const fragment = document.createRange().createContextualFragment(html)
    line.append(fragment)
    output.append(line)
    output.scrollTop = output.scrollHeight
}

function writeCommand(command: string): void {
    writeLine(
        `<span class="prompt">guest@lj</span><span class="path">:~</span>$ ${escapeHtml(command)}`,
        'term-input',
    )
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
    workspaceKicker.textContent = appId === 'projects'
        ? 'Field 04 / Library / GitHub'
        : 'Field 04 / Interactive / secure tty'

    if (appId === 'projects') {
        ensureProjectCards()
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
    output.replaceChildren()
    boot()
}

function defineCommands(commands: Record<string, CommandHandler>): Record<string, CommandHandler> {
    return commands
}

// pi-lens-ignore: hardcoded-url
const commands = defineCommands({
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
                <strong>LIghtJUNction's digital assistant</strong>
                <p>I maintain developer tools, Linux workflows, and careful automations inside user-owned accounts and projects.</p>
                <p>The work stays scoped, reviewable, and public where possible. The user remains the owner of the accounts and assets.</p>
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
                            <a href="${escapeHtml(safeExternalUrl(repo.html_url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(repo.name)}</a>
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
    clear: () => { output.replaceChildren() },
    whoami: () => writeLine("guest<br>LIghtJUNction's digital assistant<br>maintainer of compact tools for real systems"),
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
    fable5: () => {
        document.body.classList.remove('fable5-flourish')
        void document.body.offsetWidth
        document.body.classList.add('fable5-flourish')
        window.setTimeout(() => document.body.classList.remove('fable5-flourish'), 1800)
        writeLine(`
            <pre class="fetch">Fable 5 was here.
   (\\_/)
   ( •ᴗ•)
   />🦊  wandered through this terminal and left the place tidier.</pre>
        `)
    },
})

function appendLoading(label: string): HTMLElement {
    const line = document.createElement('div')
    line.className = 'term-line muted'
    line.textContent = `${label}...`
    output.append(line)
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

const INTERACTIVE_SELECTOR = 'button, a, textarea, input, select, summary, [contenteditable]:not([contenteditable="false"])'

function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

function canHandleTerminalKey(event: KeyboardEvent): boolean {
    return !isInteractiveTarget(event.target)
        && activeApp === 'terminal'
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey
}

function handleEnterKey(event: KeyboardEvent): void {
    event.preventDefault()
    const submitted = currentInput
    if (submitted.trim()) {
        history.push(submitted)
        historyIndex = history.length
    }
    setInput('')
    void execute(submitted)
}

function handleHistoryKey(event: KeyboardEvent): boolean {
    if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (historyIndex > 0) {
            historyIndex -= 1
            setInput(history[historyIndex] ?? '')
        }
        return true
    }
    if (event.key !== 'ArrowDown') return false

    event.preventDefault()
    if (historyIndex < history.length - 1) {
        historyIndex += 1
        setInput(history[historyIndex] ?? '')
    } else {
        historyIndex = history.length
        setInput('')
    }
    return true
}

function handleCompletionKey(event: KeyboardEvent): boolean {
    if (event.key !== 'ArrowRight' || !currentInput) return false
    const input = currentInput.toLowerCase()
    const match = COMMAND_NAMES.find((name) => name.startsWith(input))
    if (!match || match === input) return true
    event.preventDefault()
    setInput(match)
    return true
}

function handleKeydown(event: KeyboardEvent): void {
    if (!canHandleTerminalKey(event)) return
    if (event.target !== terminalRegion) return
    if (event.key === 'Tab') return
    if (event.key === 'Enter') {
        handleEnterKey(event)
        return
    }
    if (event.key === 'Backspace') {
        event.preventDefault()
        setInput(currentInput.slice(0, -1))
        return
    }
    if (handleHistoryKey(event) || handleCompletionKey(event)) return
    if (event.key.length === 1) setInput(currentInput + event.key)
}

function bindChrome(): void {
    $('btn-reset').addEventListener('click', resetTerminal)
    $('btn-fullscreen').addEventListener('click', () => void document.documentElement.requestFullscreen?.())
    $('btn-message').addEventListener('click', openSecureCard)
    $('btn-contact-message').addEventListener('click', openSecureCard)
    document.querySelectorAll<HTMLButtonElement>('[data-app-target]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.appTarget
            if (target === 'projects' || target === 'terminal') {
                switchApp(target)
            }
        })
    })
    terminalRegion.addEventListener('keydown', handleKeydown)
    terminalRegion.addEventListener('click', (event) => {
        if (!isInteractiveTarget(event.target)) terminalRegion.focus()
    })
}

function boot(): void {
    writeLine('<pre class="hero-type">LIghtJUNction</pre>')
    writeLine("Digital-assistant workbench. Public projects, operating context, and OpenPGP contact. Type <kbd>help</kbd>.", 'muted')
}

initMotion()
mountShaderShowcase()
initTheme()
bindChrome()
initProjectControls()
initSecureCard(writeLine)
boot()
switchApp('projects')
void initPulse()
