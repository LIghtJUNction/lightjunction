import { $ } from './dom'
import { showToast } from './toast'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'lightjunction.theme'
const THEME_COLORS: Record<Theme, string> = {
    light: '#f1f2ed',
    dark: '#141613',
}

const themeButton = $<HTMLButtonElement>('btn-theme')
const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

export function currentTheme(): Theme {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'))
    themeColorMeta?.setAttribute('content', THEME_COLORS[theme])
}

function toggleTheme(): void {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
        // Storage may be unavailable; the theme still applies for this session.
    }
    applyTheme(next)
    showToast(next === 'dark' ? 'Dark theme' : 'Light theme')
}

export function initTheme(): void {
    applyTheme(currentTheme())
    document.querySelector<HTMLElement>('.route-step:nth-of-type(4)')
        ?.setAttribute('data-bearing', 'mFasuqyU8Ye')
    themeButton.addEventListener('click', toggleTheme)
}
