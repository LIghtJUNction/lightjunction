export type Repo = {
    id: number
    name: string
    full_name: string
    html_url: string
    description: string | null
    language: string | null
    topics: string[]
    stargazers_count: number
    forks_count: number
    open_issues_count: number
    default_branch: string
    created_at: string
    updated_at: string
    pushed_at: string | null
    archived: boolean
    fork: boolean
}

export type GitHubUser = {
    public_repos: number
    followers: number
    following: number
    created_at: string
}

export type GitHubOrg = {
    login: string
    repos_url: string
}

export type RepoCard = Repo & {
    commit_count: number | null
    rank_score: number
}

export type ProjectCardsPayload = {
    schema_version: number
    owner: string
    included_orgs: string[]
    project_cards: RepoCard[]
    generated_at: string
}

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
}

function staticProjectCardsUrl(): string {
    return `${import.meta.env.BASE_URL}github-projects.json`
}

export async function fetchStaticProjectCards(): Promise<RepoCard[]> {
    const payload = await fetchJson<ProjectCardsPayload>(staticProjectCardsUrl())
    if (!Array.isArray(payload.project_cards)) {
        throw new Error('Invalid project cards payload')
    }
    return payload.project_cards.sort(compareRepoCards)
}

async function fetchJsonWithHeaders<T>(url: string): Promise<{ data: T; headers: Headers }> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`)
    }
    return {
        data: await response.json() as T,
        headers: response.headers,
    }
}

function lastPageFromLinkHeader(linkHeader: string | null): number | null {
    if (!linkHeader) return null

    for (const part of linkHeader.split(',')) {
        const [urlPart, relPart] = part.trim().split(';').map((value) => value.trim())
        if (!urlPart || !relPart || relPart !== 'rel="last"') continue

        const page = /[?&]page=(\d+)/.exec(urlPart)?.[1]
        return page ? Number(page) : null
    }

    return null
}

async function fetchPaged<T>(buildUrl: (page: number) => string): Promise<T[]> {
    const items: T[] = []
    let page = 1

    while (true) {
        const data = await fetchJson<T[]>(buildUrl(page))
        items.push(...data)

        if (data.length < 100) break
        page += 1
    }

    return items
}

export async function fetchUserOwnedRepos(owner = 'LIghtJUNction'): Promise<Repo[]> {
    return fetchPaged<Repo>(
        (page) => `https://api.github.com/users/${owner}/repos?type=owner&sort=full_name&per_page=100&page=${page}`,
    )
}

export async function fetchUserOrgs(owner = 'LIghtJUNction'): Promise<GitHubOrg[]> {
    return fetchPaged<GitHubOrg>(
        (page) => `https://api.github.com/users/${owner}/orgs?per_page=100&page=${page}`,
    )
}

export async function fetchOrgRepos(org: GitHubOrg): Promise<Repo[]> {
    return fetchPaged<Repo>(
        (page) => `https://api.github.com/orgs/${org.login}/repos?type=all&sort=full_name&per_page=100&page=${page}`,
    )
}

function uniqueRepos(repos: Repo[]): Repo[] {
    const byName = new Map<string, Repo>()
    for (const repo of repos) {
        byName.set(repo.full_name, repo)
    }

    return [...byName.values()]
}

function ageDays(value: string | null): number {
    if (!value) return Number.POSITIVE_INFINITY

    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY

    return Math.max(0, (Date.now() - timestamp) / 86_400_000)
}

function decay(age: number, halfLifeDays: number): number {
    if (!Number.isFinite(age)) return 0
    return 2 ** (-age / halfLifeDays)
}

function repoRankScore(repo: RepoCard): number {
    const commits = repo.commit_count ?? 0
    const activeProjectBoost = decay(ageDays(repo.pushed_at), 60) * 100_000
    const newProjectBoost = decay(ageDays(repo.created_at), 180) * 18_000
    const starScore = Math.log1p(repo.stargazers_count) * 4_500
    const commitScore = Math.log1p(commits) * 850
    const archivedPenalty = repo.archived ? 20_000 : 0

    return activeProjectBoost + newProjectBoost + starScore + commitScore - archivedPenalty
}

export async function fetchAllRepos(owner = 'LIghtJUNction'): Promise<Repo[]> {
    const [ownedRepos, orgs] = await Promise.all([
        fetchUserOwnedRepos(owner),
        fetchUserOrgs(owner),
    ])
    const orgRepos = await Promise.all(orgs.map((org) => fetchOrgRepos(org)))

    return uniqueRepos([...ownedRepos, ...orgRepos.flat()])
}

export async function fetchRepoCommitCount(repo: Repo): Promise<number | null> {
    try {
        const branch = encodeURIComponent(repo.default_branch)
        const url = `https://api.github.com/repos/${repo.full_name}/commits?sha=${branch}&per_page=1`
        const { data, headers } = await fetchJsonWithHeaders<unknown[]>(url)
        const lastPage = lastPageFromLinkHeader(headers.get('Link'))

        if (lastPage !== null) return lastPage
        return data.length
    } catch {
        return null
    }
}

function compareRepoCards(left: RepoCard, right: RepoCard): number {
    const scoreDelta = right.rank_score - left.rank_score
    if (scoreDelta !== 0) return scoreDelta

    const starDelta = right.stargazers_count - left.stargazers_count
    if (starDelta !== 0) return starDelta

    return left.full_name.localeCompare(right.full_name)
}

export async function fetchProjectCards(owner = 'LIghtJUNction'): Promise<RepoCard[]> {
    const repos = await fetchAllRepos(owner)
    const cards: RepoCard[] = repos.map((repo) => ({ ...repo, commit_count: null, rank_score: 0 }))
    let cursor = 0

    async function worker(): Promise<void> {
        while (cursor < repos.length) {
            const index = cursor
            cursor += 1

            const repo = repos[index]
            if (!repo) continue
            const commitCount = await fetchRepoCommitCount(repo)
            const card = {
                ...repo,
                commit_count: commitCount,
                rank_score: 0,
            }

            cards[index] = {
                ...card,
                rank_score: repoRankScore(card),
            }
        }
    }

    const workerCount = Math.min(6, repos.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    return cards.sort(compareRepoCards)
}
