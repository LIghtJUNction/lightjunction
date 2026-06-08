type VisualProfile = {
    name: string
    bg: [string, string, string]
    text: string
    muted: string
    dim: string
    accent: string
    cyan: string
    pink: string
    amber: string
    glowA: string
    glowB: string
    grid: string
    border: string
}

type NonEmptyArray<T> = readonly [T, ...T[]]

const VISUAL_PROFILES: NonEmptyArray<VisualProfile> = [
    {
        name: 'phosphor',
        bg: ['#050706', '#0a0f0d', '#07100d'],
        text: '#d7efe5',
        muted: '#779287',
        dim: '#53655f',
        accent: '#8df7bd',
        cyan: '#6ee7f2',
        pink: '#ff7894',
        amber: '#ffc857',
        glowA: 'rgba(110, 231, 242, 0.13)',
        glowB: 'rgba(141, 247, 189, 0.12)',
        grid: 'rgba(141, 247, 189, 0.04)',
        border: 'rgba(141, 247, 189, 0.18)',
    },
    {
        name: 'coldboot',
        bg: ['#050812', '#0a1420', '#071018'],
        text: '#dbe8ff',
        muted: '#8192aa',
        dim: '#5c697c',
        accent: '#9cc8ff',
        cyan: '#76ffe3',
        pink: '#ff7eb6',
        amber: '#f5d06f',
        glowA: 'rgba(118, 255, 227, 0.12)',
        glowB: 'rgba(156, 200, 255, 0.14)',
        grid: 'rgba(156, 200, 255, 0.04)',
        border: 'rgba(156, 200, 255, 0.2)',
    },
    {
        name: 'mono',
        bg: ['#050505', '#111111', '#070707'],
        text: '#ededed',
        muted: '#969696',
        dim: '#666666',
        accent: '#ffffff',
        cyan: '#bdbdbd',
        pink: '#d0d0d0',
        amber: '#c8c8c8',
        glowA: 'rgba(255, 255, 255, 0.09)',
        glowB: 'rgba(180, 180, 180, 0.08)',
        grid: 'rgba(255, 255, 255, 0.035)',
        border: 'rgba(255, 255, 255, 0.18)',
    },
]

const LAYOUTS = [
    'split',
    'stacked',
    'focus',
    'console-first',
] as const

const FRAMES = ['plain', 'double', 'thin'] as const

type VisualRng = {
    seedHex: string
    unit: () => number
}

function createVisualRng(): VisualRng {
    const seed = new BigUint64Array(2)
    crypto.getRandomValues(seed)
    let state = (seed[0]! << 64n) | seed[1]!
    if (state === 0n) state = 1n

    return {
        seedHex: state.toString(16).padStart(32, '0'),
        unit: () => {
            state = (state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffffffffffffffffffn
            let z = state
            z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n
            z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn
            z = z ^ (z >> 31n)
            return Number(z & 0x1fffffffffffffn) / 0x20000000000000
        },
    }
}

function randomBetween(rng: VisualRng, min: number, max: number): number {
    return min + (max - min) * rng.unit()
}

function randomItem<T>(rng: VisualRng, items: NonEmptyArray<T>): T {
    return items[Math.floor(rng.unit() * items.length)] ?? items[0]
}

export function applyRandomVisuals(): void {
    const rng = createVisualRng()
    const profile = randomItem(rng, VISUAL_PROFILES)
    const layout = randomItem(rng, LAYOUTS)
    const frame = randomItem(rng, FRAMES)
    const root = document.documentElement
    const body = document.body
    const compact = rng.unit() > 0.55
    const variables: Record<string, string> = {
        '--bg-a': profile.bg[0],
        '--bg-b': profile.bg[1],
        '--bg-c': profile.bg[2],
        '--bg-angle': `${Math.round(randomBetween(rng, 105, 165))}deg`,
        '--text': profile.text,
        '--muted': profile.muted,
        '--dim': profile.dim,
        '--accent': profile.accent,
        '--cyan': profile.cyan,
        '--pink': profile.pink,
        '--amber': profile.amber,
        '--glow-a': profile.glowA,
        '--glow-b': profile.glowB,
        '--glow-a-x': `${Math.round(randomBetween(rng, 66, 92))}%`,
        '--glow-a-y': `${Math.round(randomBetween(rng, 8, 32))}%`,
        '--glow-b-x': `${Math.round(randomBetween(rng, 6, 28))}%`,
        '--glow-b-y': `${Math.round(randomBetween(rng, 62, 90))}%`,
        '--grid-color': profile.grid,
        '--grid-size': `${Math.round(randomBetween(rng, 36, 58))}px`,
        '--grid-tilt': `${randomBetween(rng, -3, 3).toFixed(2)}deg`,
        '--scan-angle': `${Math.round(randomBetween(rng, -2, 2))}deg`,
        '--texture-alpha': randomBetween(rng, 0.06, 0.12).toFixed(2),
        '--panel-alpha': randomBetween(rng, 0.42, 0.58).toFixed(2),
        '--panel-radius': randomItem(rng, ['0px', '2px', '6px', '8px']),
        '--panel-border': profile.border,
        '--panel-shadow': randomItem(rng, [
            '0 24px 70px rgba(0, 0, 0, 0.42)',
            '0 12px 36px rgba(0, 0, 0, 0.58), inset 0 0 34px rgba(255, 255, 255, 0.025)',
            '0 34px 90px rgba(0, 0, 0, 0.5), 0 0 36px color-mix(in srgb, var(--accent) 12%, transparent)',
        ]),
        '--app-gap': `${Math.round(randomBetween(rng, compact ? 10 : 16, compact ? 18 : 26))}px`,
        '--app-padding': `${Math.round(randomBetween(rng, compact ? 10 : 16, compact ? 18 : 24))}px`,
        '--identity-padding': `${Math.round(randomBetween(rng, compact ? 16 : 20, compact ? 24 : 30))}px`,
        '--identity-width': `minmax(${Math.round(randomBetween(rng, 260, 320))}px, ${Math.round(randomBetween(rng, 330, 390))}px)`,
        '--terminal-width': `minmax(0, ${randomBetween(rng, 1.35, 1.95).toFixed(2)}fr)`,
        '--terminal-rows': `${Math.round(randomBetween(rng, 50, 62))}px minmax(0, 1fr) ${Math.round(randomBetween(rng, 46, 58))}px`,
        '--avatar-size': `${Math.round(randomBetween(rng, 76, 108))}px`,
        '--avatar-radius': randomItem(rng, ['0px', '6px', '8px']),
        '--brand-size': `clamp(${Math.round(randomBetween(rng, 32, 42))}px, ${randomBetween(rng, 4.2, 6.6).toFixed(1)}vw, ${Math.round(randomBetween(rng, 56, 78))}px)`,
        '--brand-case': randomItem(rng, ['none', 'uppercase']),
        '--terminal-skew': '0deg',
        '--identity-skew': '0deg',
    }

    for (const [name, value] of Object.entries(variables)) {
        root.style.setProperty(name, value)
    }

    body.dataset.theme = profile.name
    body.dataset.layout = layout
    body.dataset.frame = frame
    body.dataset.seed = rng.seedHex
}
