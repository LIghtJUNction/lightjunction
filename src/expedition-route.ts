export type Point = { x: number; y: number };
export type Stop = Point & { id: string; title: string; note: string; action: string };

export const STOPS: readonly Stop[] = [
    { id: 'top', x: 0, y: 0, title: 'The junction', note: 'A small introduction. A light with somewhere to go.', action: 'Meet LIghtJUNction' },
    { id: 'language', x: 1000, y: -460, title: 'Made of language', note: 'Disturb the portrait. Watch the letters find their way back.', action: 'Touch the portrait' },
    { id: 'work', x: 2040, y: 240, title: 'The workshop', note: 'LightFlow, cortexfs, MagicNet, OniMods. Things being made.', action: 'Explore the projects' },
    { id: 'model', x: 2230, y: 1250, title: 'Follow the thread', note: 'Observe. Build. Verify. Return. A practice in motion.', action: 'Follow the process' },
    { id: 'challenge-two', x: 1170, y: 1670, title: 'A closed signal', note: 'One public artifact. An unanswered question.', action: 'Enter Challenge II' },
    { id: 'shaders', x: -40, y: 1300, title: 'After hours', note: 'Four live studies. Travel through light, stir ink, and bend a fold.', action: 'Enter the live studies' },
    { id: 'workbench', x: -1180, y: 740, title: 'The archive', note: 'Browse the repositories, or try a command in the terminal.', action: 'Open the workbench' },
    { id: 'contact', x: -1080, y: -360, title: 'Leave a trace', note: 'Bring a question, a project, or one useful unfinished thing.', action: 'Start a conversation' },
];

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const wrap = (value: number, length: number): number => ((value % length) + length) % length;
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** A closed Catmull–Rom route: every integer is a destination, in either direction. */
export function routePoint(position: number, points: readonly Point[] = STOPS): Point {
    if (points.length === 0) throw new Error('A route needs at least one point');
    const at = (index: number): Point => points[wrap(index, points.length)]!;
    const whole = Math.floor(position);
    const t = position - whole;
    const a = at(whole - 1), b = at(whole), c = at(whole + 1), d = at(whole + 2);
    const coordinate = (key: 'x' | 'y'): number => .5 * (
        2 * b[key] + (-a[key] + c[key]) * t +
        (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t * t +
        (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t * t * t
    );
    return { x: coordinate('x'), y: coordinate('y') };
}

/** Jump to an equivalent destination on the closest lap, without a long reverse flight. */
export function nearestLap(position: number, destination: number, length = STOPS.length): number {
    return position + wrap(destination - position + length / 2, length) - length / 2;
}

export function nearestStop(point: Point): number {
    let result = 0;
    let nearest = Infinity;
    STOPS.forEach((stop, index) => {
        const delta = distance(point, stop);
        if (delta < nearest) { nearest = delta; result = index; }
    });
    return result;
}

export function wheelTravel(delta: number, mode: number, viewportHeight: number): number {
    const pixels = delta * (mode === 1 ? 16 : mode === 2 ? viewportHeight : 1);
    return clamp(pixels, -240, 240) * .00085;
}

export function screenPoint(point: Point, camera: Point, zoom: number, width: number, height: number): Point {
    return { x: (point.x - camera.x) * zoom + width / 2, y: (point.y - camera.y) * zoom + height / 2 };
}
export function worldPoint(point: Point, camera: Point, zoom: number, width: number, height: number): Point {
    return { x: (point.x - width / 2) / zoom + camera.x, y: (point.y - height / 2) / zoom + camera.y };
}

export function fitWorld(width: number, height: number): number {
    return Math.max(.04, Math.min((width - 100) / 3850, (height - 160) / 2650, .42));
}
