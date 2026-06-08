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

