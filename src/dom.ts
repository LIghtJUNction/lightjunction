export const $ = <T extends HTMLElement>(id: string): T => {
    const element = document.getElementById(id)
    if (!element) {
        throw new Error(`Missing required DOM element: #${id}`)
    }
    return element as T
}

export function escapeHtml(value: string): string {
    const div = document.createElement('div')
    div.textContent = value
    return div.innerHTML
}

export function safeExternalUrl(value: string, allowedHosts: readonly string[] = ['github.com']): string {
    try {
        const url = new URL(value)
        const hostname = url.hostname.toLowerCase()
        if (url.protocol !== 'https:' || !allowedHosts.includes(hostname)) return '#'
        return url.toString()
    } catch {
        return '#'
    }
}
