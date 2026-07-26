import { $, escapeHtml, safeExternalUrl } from './dom'
import { formatDate, formatNumber } from './format'
import { fetchStaticProjectCards, isRepoCardArray, type RepoCard } from './github'
import { registerReveals } from './motion'
import { showToast } from './toast'

export type ProjectSource = 'cache' | 'network'
export type ProjectGroupId = 'ai' | 'systems' | 'security' | 'web' | 'data' | 'tools' | 'all'

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

const projectGrid = $<HTMLElement>('project-grid')
const projectStatus = $<HTMLElement>('project-status')
const projectCount = $<HTMLElement>('project-count')
const projectSort = $<HTMLElement>('project-sort')
const projectGroups = $<HTMLElement>('project-groups')
const pulseCard = document.getElementById('pulse-card')
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

let projectsLoaded = false
let projectCards: RepoCard[] = []
let projectSource: ProjectSource = 'network'
let activeProjectGroup: ProjectGroupId = 'ai'

export function readProjectCache(): CachedProjects | null {
    try {
        const raw = window.localStorage.getItem(PROJECT_CACHE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<CachedProjects>
        if (typeof parsed.cachedAt !== 'number' || !isRepoCardArray(parsed.cards)) return null
        if (Date.now() - parsed.cachedAt > PROJECT_CACHE_TTL_MS) return null

        return {
            cachedAt: parsed.cachedAt,
            cards: parsed.cards,
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
        projectGrid.innerHTML = '<div class="empty-state glass-shell">No repositories matched this group.</div>'
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
        const repoUrl = escapeHtml(safeExternalUrl(repo.html_url))
        return `
            <div class="project-shell glass-shell reveal">
            <article class="project-card glass-core">
                <header>
                    <h3><a href="${repoUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(repo.full_name)} on GitHub">${escapeHtml(repo.name)}</a></h3>
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
                    <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">Open</a>
                </footer>
            </article>
            </div>
        `
    }).join('')

    registerReveals(projectGrid)
}

export async function loadProjectCards(force = false): Promise<void> {
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

export function ensureProjectCards(): void {
    if (!projectsLoaded) void loadProjectCards()
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

export async function initPulse(): Promise<void> {
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

export function initProjectControls(): void {
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
}
