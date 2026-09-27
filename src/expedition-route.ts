export type Point = { x: number; y: number };
export type Stop = Point & { id: string; title: string; note: string; action: string };

export const STOPS: readonly Stop[] = [
    { id: 'top', x: 0, y: 0, title: '基地档案馆', note: '防线之外，是这些小世界背后的代码与作者。所有内容直接可见。', action: '认识 LIghtJUNction' },
    { id: 'language', x: 1000, y: -460, title: 'Token 标本室', note: '拨动文字肖像，观察碎片如何散开，再重新汇聚。', action: '触碰文字肖像' },
    { id: 'work', x: 2040, y: 240, title: '项目工坊', note: 'LightFlow、cortexfs、MagicNet、OniMods。打开真实项目，不需要完成游戏。', action: '浏览项目档案' },
    { id: 'model', x: 2230, y: 1250, title: '建造日志', note: '观察、实现、验证、再修改。这些世界是怎么搭起来的。', action: '查看工作流程' },
    { id: 'challenge-two', x: 1170, y: 1670, title: '封存信号', note: '公开的密码学挑战。原始材料与线索保持完整。', action: '进入 Challenge II' },
    { id: 'shaders', x: -40, y: 1300, title: '光影研究室', note: '四个可以触碰的实时实验：光、墨水与折叠。', action: '进入实时研究' },
    { id: 'workbench', x: -1180, y: 740, title: '代码与终端', note: '浏览仓库，或在终端中输入指令。真实项目与游戏装备分开陈列。', action: '打开交互工作台' },
    { id: 'contact', x: -1080, y: -360, title: '通讯室', note: '一段问题、一项合作，或者一个尚未完成的想法。加密仍在本机进行。', action: '打开通讯频道' },
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
