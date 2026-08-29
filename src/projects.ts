import { $, safeExternalUrl } from "./dom.js";
import { formatDate, formatNumber } from "./format.js";
import {
    fetchStaticProjectCards,
    isRepoCardArray,
    type RepoCard,
} from "./github.js";
import { showToast } from "./toast.js";

type ProjectSource = "cache" | "network";
type ProjectGroupId =
    | "ai"
    | "systems"
    | "security"
    | "web"
    | "data"
    | "tools"
    | "all";

type CachedProjects = {
    cachedAt: number;
    cards: RepoCard[];
};

type ProjectGroup = {
    id: ProjectGroupId;
    label: string;
    keywords: string[];
};

const PROJECT_GROUPS: ProjectGroup[] = [
    {
        id: "ai",
        label: "AI",
        keywords: [
            "agent",
            "ai",
            "astrbot",
            "chatgpt",
            "claude",
            "codex",
            "dataset",
            "gpt",
            "inference",
            "llm",
            "mcp",
            "model",
            "ollama",
            "openai",
            "prompt",
            "rag",
            "token",
            "train",
        ],
    },
    {
        id: "systems",
        label: "Systems",
        keywords: [
            "adb",
            "android",
            "arch",
            "bootstrap",
            "dead",
            "docker",
            "kernel",
            "linux",
            "network",
            "package",
            "root",
            "shell",
            "sing-box",
            "tun",
            "vpn",
        ],
    },
    {
        id: "security",
        label: "Security",
        keywords: [
            "auth",
            "crypto",
            "encrypt",
            "gpg",
            "key",
            "oauth",
            "openpgp",
            "pgp",
            "security",
            "ssh",
        ],
    },
    {
        id: "web",
        label: "Web",
        keywords: [
            "css",
            "frontend",
            "html",
            "javascript",
            "react",
            "site",
            "typescript",
            "vite",
            "web",
        ],
    },
    {
        id: "data",
        label: "Data",
        keywords: [
            "api",
            "crawl",
            "data",
            "dataset",
            "etl",
            "fetch",
            "pipeline",
            "scrape",
        ],
    },
    {
        id: "tools",
        label: "Tools",
        keywords: [
            "automation",
            "cli",
            "script",
            "tool",
            "utility",
            "workflow",
        ],
    },
    {
        id: "all",
        label: "All",
        keywords: [],
    },
];

const PROJECT_CACHE_KEY = "lightjunction.projectCards.v5";
const PROJECT_CACHE_TTL_MS = 15 * 60 * 1000;
const PROJECT_PAGE_SIZE = 8;

const projectGrid = $<HTMLElement>("project-grid");
const projectStatus = $<HTMLElement>("project-status");
const projectCount = $<HTMLElement>("project-count");
const projectSort = $<HTMLElement>("project-sort");
const projectGroups = $<HTMLElement>("project-groups");
const projectToggle = $<HTMLButtonElement>("btn-toggle-projects");
const projectRefresh = $<HTMLButtonElement>("btn-refresh-projects");
const pulseCard = document.querySelector<HTMLElement>("#pulse-card");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let projectsLoaded = false;
let projectCards: RepoCard[] = [];
let projectSource: ProjectSource = "network";
let activeProjectGroup: ProjectGroupId = "ai";
let projectsExpanded = false;

export function readProjectCache(): CachedProjects | null {
    try {
        const raw = window.localStorage.getItem(PROJECT_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<CachedProjects>;
        const cachedAt = Number(parsed.cachedAt);
        if (!Number.isFinite(cachedAt) || !isRepoCardArray(parsed.cards))
            return null;
        if (Date.now() - cachedAt > PROJECT_CACHE_TTL_MS) return null;

        return {
            cachedAt,
            cards: parsed.cards,
        };
    } catch {
        return null;
    }
}

function writeProjectCache(cards: RepoCard[]): void {
    try {
        const cached: CachedProjects = {
            cachedAt: Date.now(),
            cards,
        };
        window.localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(cached));
    } catch {
        // Cache failure should not affect the project card list; 缓存失败不应影响项目卡片列表。
    }
}

function repoSearchText(repo: RepoCard): string {
    return [
        repo.full_name,
        repo.description ?? "",
        repo.language ?? "",
        ...(repo.topics ?? []),
    ]
        .join(" ")
        .toLowerCase();
}

function isProjectGroupId(value: string | undefined): value is ProjectGroupId {
    return PROJECT_GROUPS.some((group) => group.id === value);
}

function repoMatchesGroup(repo: RepoCard, groupId: ProjectGroupId): boolean {
    if (groupId === "all") return true;

    const group = PROJECT_GROUPS.find((item) => item.id === groupId);
    if (!group) return false;

    const searchText = repoSearchText(repo);
    return group.keywords.some((keyword) => searchText.includes(keyword));
}

function projectGroupCount(groupId: ProjectGroupId): number {
    return projectCards.filter((repo) => repoMatchesGroup(repo, groupId))
        .length;
}

function renderProjectGroups(): void {
    const buttons = PROJECT_GROUPS.map((group) => {
        const selected = group.id === activeProjectGroup;
        const button = document.createElement("button");
        button.className = `project-group${selected ? " active" : ""}`;
        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(selected));
        button.dataset.projectGroup = group.id;
        button.textContent = `${group.label} ${projectGroupCount(group.id)}`;
        return button;
    });
    projectGroups.replaceChildren(...buttons);
}

function appendProjectText(
    parent: HTMLElement,
    tagName: string,
    text: string,
    className?: string,
): HTMLElement {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
}

function createProjectLink(
    url: string,
    text: string,
    ariaLabel?: string,
): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = safeExternalUrl(url);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = text;
    if (ariaLabel) link.setAttribute("aria-label", ariaLabel);
    return link;
}

function createProjectCard(repo: RepoCard, index: number): HTMLElement {
    const owner = repo.full_name.split("/")[0] ?? "Unknown";
    const tags = [
        owner,
        repo.language ?? "Unknown",
        repo.fork ? "Fork" : "Source",
        repo.archived ? "Archived" : "Active",
    ];
    const shell = document.createElement("div");
    shell.className = "project-shell";
    const article = document.createElement("article");
    article.className = "project-card";
    const header = document.createElement("header");
    const heading = document.createElement("h3");
    heading.append(
        createProjectLink(
            repo.html_url,
            repo.name,
            `Open ${repo.full_name} on GitHub`,
        ),
    );
    header.append(heading);
    appendProjectText(header, "span", `#${index + 1}`, "project-rank");
    article.append(header);

    const metrics = document.createElement("div");
    metrics.className = "project-metrics";
    metrics.setAttribute("aria-label", "Repository metrics");
    for (const metric of [
        `${formatNumber(repo.stargazers_count)} stars`,
        `${formatNumber(repo.commit_count)} commits`,
        `${formatNumber(repo.forks_count)} forks`,
        `${formatNumber(repo.open_issues_count)} issues`,
    ]) {
        appendProjectText(metrics, "span", metric);
    }
    article.append(metrics);
    appendProjectText(article, "p", repo.description ?? "No description yet.");

    const tagList = document.createElement("div");
    tagList.className = "project-tags";
    for (const tag of tags) appendProjectText(tagList, "span", tag);
    article.append(tagList);

    const footer = document.createElement("footer");
    appendProjectText(footer, "span", `pushed ${formatDate(repo.pushed_at)}`);
    footer.append(createProjectLink(repo.html_url, "Open"));
    article.append(footer);
    shell.append(article);
    return shell;
}

function renderProjectCards(cards: RepoCard[], source: ProjectSource): void {
    projectCards = cards;
    projectSource = source;
    renderProjectGroups();

    const filteredCards = cards.filter((repo) =>
        repoMatchesGroup(repo, activeProjectGroup),
    );
    const totalStars = filteredCards.reduce(
        (sum, repo) => sum + repo.stargazers_count,
        0,
    );
    const knownCommitTotal = filteredCards.reduce(
        (sum, repo) => sum + (repo.commit_count ?? 0),
        0,
    );
    const unknownCommits = filteredCards.filter(
        (repo) => repo.commit_count === null,
    ).length;
    const activeGroupLabel =
        PROJECT_GROUPS.find((group) => group.id === activeProjectGroup)
            ?.label ?? "Projects";
    const visibleCards = projectsExpanded
        ? filteredCards
        : filteredCards.slice(0, PROJECT_PAGE_SIZE);

    projectCount.textContent = `Showing ${visibleCards.length} of ${filteredCards.length} ${activeGroupLabel} projects / ${cards.length} indexed`;
    projectSort.textContent = `Rank: recent activity first, then newness, stars, and commits`;
    const sourceStatus =
        source === "cache"
            ? "Cached checked-in project data."
            : "Checked-in project index loaded.";
    projectStatus.textContent = `${sourceStatus} ${formatNumber(totalStars)} stars across this filtered index / ${formatNumber(knownCommitTotal)} commits counted${unknownCommits ? ` / ${unknownCommits} unknown` : ""}.`;

    projectToggle.hidden = filteredCards.length <= PROJECT_PAGE_SIZE;
    projectToggle.textContent = projectsExpanded
        ? "Show fewer projects"
        : `Show all ${filteredCards.length} projects`;
    projectToggle.setAttribute("aria-expanded", String(projectsExpanded));

    if (filteredCards.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.textContent = "No repositories matched this group.";
        projectGrid.replaceChildren(emptyState);
        return;
    }

    projectGrid.replaceChildren(...visibleCards.map(createProjectCard));
}

async function loadProjectCards(
    options: { bypassCache?: boolean } = {},
): Promise<void> {
    const { bypassCache = false } = options;
    const cache = readProjectCache();
    if (cache && !bypassCache) {
        renderProjectCards(cache.cards, "cache");
        projectsLoaded = true;
        return;
    }

    projectGrid.setAttribute("aria-busy", "true");
    projectRefresh.disabled = true;
    projectStatus.textContent =
        "Loading synced project cards from the repository...";
    projectGrid.replaceChildren();

    try {
        const cards = await fetchStaticProjectCards();
        writeProjectCache(cards);
        renderProjectCards(cards, "network");
        projectsLoaded = true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        projectStatus.textContent = `Failed to fetch GitHub projects: ${message}. Use refresh to retry.`;
        projectCount.textContent = "GitHub projects unavailable";
        if (cache) {
            renderProjectCards(cache.cards, "cache");
            showToast("Using cached projects");
        } else {
            showToast("Projects unavailable — refresh to retry");
        }
    } finally {
        projectGrid.setAttribute("aria-busy", "false");
        projectRefresh.disabled = false;
    }
}

export function ensureProjectCards(): void {
    if (!projectsLoaded) void loadProjectCards();
}

function countUp(element: HTMLElement, target: number): void {
    if (reduceMotionQuery.matches) {
        element.textContent = formatNumber(target);
        return;
    }
    const duration = 900;
    const start = performance.now();
    const step = (now: number): void => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - progress) ** 3;
        element.textContent = formatNumber(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

export async function initPulse(): Promise<void> {
    if (!pulseCard) return;
    const reposEl = pulseCard.querySelector<HTMLElement>(
        '[data-pulse="repos"]',
    );
    const starsEl = pulseCard.querySelector<HTMLElement>(
        '[data-pulse="stars"]',
    );
    const latestEl = pulseCard.querySelector<HTMLElement>(
        '[data-pulse="latest"]',
    );
    const latestDateEl = pulseCard.querySelector<HTMLElement>(
        '[data-pulse="latest-date"]',
    );
    if (!reposEl || !starsEl || !latestEl || !latestDateEl) return;

    try {
        const cards =
            readProjectCache()?.cards ?? (await fetchStaticProjectCards());
        if (cards.length === 0) return;
        const totalStars = cards.reduce(
            (sum, repo) => sum + repo.stargazers_count,
            0,
        );
        const latest = cards.reduce((a, b) => {
            const timeA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0;
            const timeB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0;
            return timeB > timeA ? b : a;
        });
        countUp(reposEl, cards.length);
        countUp(starsEl, totalStars);
        latestEl.textContent = latest.full_name;
        latestDateEl.textContent = latest.pushed_at
            ? `pushed ${formatDate(latest.pushed_at)}`
            : "";
    } catch {
        // The pulse card is informational; keep placeholders when data is unavailable.
    }
}

export function initProjectControls(): void {
    projectRefresh.addEventListener("click", () => {
        projectsExpanded = false;
        void loadProjectCards({ bypassCache: true });
        showToast("Refreshing projects");
    });
    projectToggle.addEventListener("click", () => {
        projectsExpanded = !projectsExpanded;
        renderProjectCards(projectCards, projectSource);
    });
    projectGroups.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;

        const group = target.dataset.projectGroup;
        if (!isProjectGroupId(group)) return;

        activeProjectGroup = group;
        projectsExpanded = false;
        renderProjectCards(projectCards, projectSource);
    });
}
