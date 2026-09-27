/** Pure camera controls and swept ring intersections, shared by the 3D game. */
export const DEFAULT_YAW = Math.atan2(28, 36), DEFAULT_PITCH = .67;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function cameraDirection(yaw = DEFAULT_YAW, pitch = DEFAULT_PITCH) { return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]; }
export function screenMovement(x, y, yaw = DEFAULT_YAW) { x = Number.isFinite(x) ? x : 0; y = Number.isFinite(y) ? y : 0; const n = Math.max(1, Math.hypot(x, y)); return { x: (x * Math.cos(yaw) + y * Math.sin(yaw)) / n, z: (-x * Math.sin(yaw) + y * Math.cos(yaw)) / n }; }
export function orbitCamera(c, dx, dy) { if (!Number.isFinite(dx) || !Number.isFinite(dy))
    return; c.yaw = (c.yaw - dx * .006) % (Math.PI * 2); c.pitch = clamp(c.pitch + dy * .004, .3, 1.2); }
export function zoomCamera(c, d) { if (Number.isFinite(d))
    c.zoom = clamp(c.zoom * Math.exp(clamp(d, -500, 500) * .001), .65, 1.6); }
export function createCircuit(islands) { const gates = []; islands.forEach((a, i) => { const b = islands[(i + 1) % islands.length], dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz); for (const t of [.3, .5, .7])
    gates.push({ x: a.x + dx * t, z: a.z + dz * t, nx: dx / n, nz: dz / n, radius: 2.2 }); }); return { gates, next: 0, elapsed: 0, started: false, finished: false }; }
export function crossedGate(a, b, g) { const u = (a.x - g.x) * g.nx + (a.z - g.z) * g.nz, v = (b.x - g.x) * g.nx + (b.z - g.z) * g.nz; if (!(u < 0 && v >= 0))
    return false; const t = -u / (v - u); return Math.abs((a.x + (b.x - a.x) * t - g.x) * g.nz - (a.z + (b.z - a.z) * t - g.z) * g.nx) <= g.radius; }
export function advanceCircuit(w, from, dt) { const r = w.circuit; if (w.phase !== 'playing' || !r || r.finished || !Number.isFinite(dt) || dt <= 0)
    return; if (r.started)
    r.elapsed += dt; const g = r.gates[r.next]; if (!g || !crossedGate(from, w.player, g))
    return; r.started = true; r.next++; w.score += 100; w.player.dashCooldown = 0; w.events.push({ type: 'gate', x: g.x, z: g.z, value: r.next }); if (r.next === r.gates.length) {
    r.finished = true;
    w.score += 1000;
    w.events.push({ type: 'circuit', x: g.x, z: g.z, value: r.elapsed });
} }
