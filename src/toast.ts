import { $ } from './dom'

const toast = $<HTMLElement>('toast')

let hideTimer: number | null = null

export function showToast(message: string): void {
    toast.textContent = message
    toast.classList.add('show')
    if (hideTimer !== null) window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
        toast.classList.remove('show')
        hideTimer = null
    }, 2400)
}
