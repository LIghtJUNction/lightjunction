import { STOPS, distance, routePoint, screenPoint, type Point } from './expedition-route.js';

export type WorldFrame = {
    width: number; height: number; camera: Point; zoom: number; player: Point;
    time: number; reduced: boolean; overview: boolean; active: number;
    visited: ReadonlySet<number>; trail: readonly Point[]; pulse: number;
    pointer: Point | null;
};

const route = Array.from({ length: 481 }, (_, index) => routePoint(index / 60));
const dust = Array.from({ length: 180 }, (_, i) => ({
    x: Math.sin(i * 127.1 + 1) * 3500 + 500,
    y: Math.sin(i * 311.7 + 7) * 2600 + 500,
    size: i % 7 === 0 ? 1.8 : .8,
}));

/** Geometry is the actual navigable map; labels and actions remain in HTML. */
export function drawWorld(ctx: CanvasRenderingContext2D, frame: WorldFrame): void {
    const { width, height, zoom, camera, player, time, reduced, overview, active } = frame;
    const project = (point: Point): Point => screenPoint(point, camera, zoom, width, height);
    ctx.clearRect(0, 0, width, height);
    const dark = document.documentElement.dataset.theme === 'dark';
    const ink = dark ? '#e6ebd9' : '#33402a';
    const line = dark ? '#606d4f' : '#a2ad90';
    const signal = dark ? '#d8f36a' : '#607d24';
    const faint = dark ? '#313b29' : '#cdd4c0';

    // A sparse, world-anchored coordinate field makes camera travel legible.
    const step = 150;
    const fromX = Math.floor((camera.x - width / zoom / 2) / step) * step;
    const fromY = Math.floor((camera.y - height / zoom / 2) / step) * step;
    ctx.fillStyle = faint;
    for (let x = fromX; x < fromX + width / zoom + step; x += step) {
        for (let y = fromY; y < fromY + height / zoom + step; y += step) {
            const p = project({ x, y });
            ctx.fillRect(p.x, p.y, 1.2, 1.2);
        }
    }
    for (const star of dust) {
        const p = project(star);
        if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) continue;
        const nearPointer = frame.pointer ? Math.max(0, 1 - distance(p, frame.pointer) / 100) : 0;
        ctx.globalAlpha = .28 + nearPointer * .6;
        ctx.fillStyle = nearPointer > 0 ? signal : ink;
        ctx.beginPath(); ctx.arc(p.x, p.y, star.size + nearPointer * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    route.forEach((point, index) => {
        const p = project(point);
        if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = line;
    ctx.lineWidth = overview ? 1.3 : 1;
    ctx.setLineDash([2, 9]); ctx.stroke(); ctx.setLineDash([]);

    // Tiny flowing lights show both directions around the closed route.
    for (let i = 0; i < 36; i += 1) {
        const p = project(routePoint(i * STOPS.length / 36 + (reduced ? 0 : time * .000018)));
        ctx.globalAlpha = .6;
        ctx.fillStyle = signal;
        ctx.beginPath(); ctx.arc(p.x, p.y, overview ? 1 : 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    STOPS.forEach((stop, index) => {
        const p = project(stop);
        if (p.x < -220 || p.y < -220 || p.x > width + 220 || p.y > height + 220) return;
        const found = frame.visited.has(index);
        const radius = Math.max(overview ? 10 : 23, 118 * zoom);
        const phase = reduced ? 0 : time * .0002;
        ctx.strokeStyle = found ? signal : line;
        ctx.globalAlpha = index === active ? .85 : .38;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= .55;
        ctx.beginPath(); ctx.arc(p.x, p.y, radius + 13, -.7 + phase, 3.7 + phase); ctx.stroke();
        ctx.globalAlpha = 1;
        if (!overview) {
            // Distinct orbital arrangements act as each destination's map symbol.
            const satellites = index === 2 ? 4 : index === 4 ? 3 : 6 + index;
            for (let n = 0; n < satellites; n += 1) {
                const angle = n * Math.PI * 2 / satellites + phase * (index % 2 ? 1 : -1);
                const orbit = radius + 22 + Math.sin(n * 2 + phase) * 7;
                const x = p.x + Math.cos(angle) * orbit, y = p.y + Math.sin(angle) * orbit;
                ctx.fillStyle = n === 0 ? signal : line;
                if (index === 1) {
                    ctx.font = '14px "IBM Plex Mono", monospace';
                    ctx.fillText('language'[n % 8] ?? 'a', x, y);
                } else {
                    ctx.beginPath(); ctx.arc(x, y, n === 0 ? 3 : 1.5, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        if (found) {
            ctx.fillStyle = signal;
            ctx.beginPath(); ctx.arc(p.x, p.y - radius - 13, 3, 0, Math.PI * 2); ctx.fill();
        }
    });

    if (frame.trail.length > 1 && !reduced) {
        ctx.beginPath();
        frame.trail.forEach((point, index) => {
            const p = project(point);
            if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = signal; ctx.lineWidth = 2; ctx.globalAlpha = .45; ctx.stroke(); ctx.globalAlpha = 1;
    }
    const p = project(player);
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34);
    halo.addColorStop(0, dark ? '#d8f36a55' : '#607d2433');
    halo.addColorStop(1, dark ? '#d8f36a00' : '#607d2400');
    ctx.fillStyle = halo; ctx.fillRect(p.x - 34, p.y - 34, 68, 68);
    ctx.fillStyle = signal; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = signal; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.stroke();
    if (frame.pulse > 0) {
        ctx.globalAlpha = frame.pulse;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20 + (1 - frame.pulse) * 270, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
    }
}
