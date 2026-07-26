export function formatNumber(value: number | null): string {
    if (value === null) return 'unknown'
    return new Intl.NumberFormat('en-US').format(value)
}

export function formatDate(value: string | null): string {
    if (!value) return 'not pushed'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'unknown date' : date.toISOString().slice(0, 10)
}
