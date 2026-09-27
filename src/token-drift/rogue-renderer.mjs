import { ISLANDS, random } from './world.mjs';
import { ENEMIES } from './rogue-world.mjs';
import { DEFAULT_YAW, DEFAULT_PITCH, cameraDirection } from './flight.mjs';
const TAU = Math.PI * 2, SKY = [.91, .925, .87];
const colors = new Map();
function rgb(hex) { if (!colors.has(hex))
    colors.set(hex, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)); return colors.get(hex); }
const cube = (a, x, y, z, sx, sy, sz, c, rotation = 0) => a.push(x, y, z, sx, sy, sz, ...rgb(c), rotation);
const faces = [
    [[1, 0, 0], [[.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [.5, -.5, .5]]],
    [[-1, 0, 0], [[-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], [-.5, -.5, -.5]]],
    [[0, 1, 0], [[-.5, .5, -.5], [-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5]]],
    [[0, -1, 0], [[-.5, -.5, .5], [-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5]]],
    [[0, 0, 1], [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]]],
    [[0, 0, -1], [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]]],
];
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;
layout(location=2) in vec3 center;layout(location=3) in vec3 scale;layout(location=4) in vec3 color;layout(location=5) in float rotation;
uniform mat4 matrix;out vec3 tint;
void main(){float c=cos(rotation),s=sin(rotation);mat3 r=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vec3 p=r*(position*scale)+center;float light=.68+.32*max(0.,dot(r*normal,normalize(vec3(-.4,1.,.6))));tint=mix(color*light,vec3(.91,.925,.87),clamp((-p.y-3.)*.04,0.,.4));gl_Position=matrix*vec4(p,1.);}`;
const FRAG = `#version 300 es
precision highp float;in vec3 tint;out vec4 outColor;void main(){outColor=vec4(tint,1.);}`;
function terrain() {
    const out = [], rng = random(804), tops = ['#cbd3a7', '#b7c98b', '#b7c9bb', '#d4b1a7'];
    for (const [i, a] of ISLANDS.entries()) {
        for (let x = -7; x <= 7; x++)
            for (let z = -7; z <= 7; z++) {
                const d = Math.hypot(x, z);
                if (d > a.radius + (rng() - .5) * .7)
                    continue;
                const h = .6 + Math.floor((a.radius - d) * .5) * .7;
                cube(out, a.x + x, -1 - h / 2, a.z + z, 1, h, 1, ['#876b65', '#9b7870', '#b28c7d'][Math.floor(rng() * 3)]);
                cube(out, a.x + x, -.84, a.z + z, .99, .3, .99, tops[i]);
                if (d > 2.8 && d < a.radius - 1 && rng() < .09) {
                    cube(out, a.x + x, 0, a.z + z, .22, 1.2, .22, '#837c5d');
                    cube(out, a.x + x, .8, a.z + z, 1, .9, 1, i === 3 ? '#dcaa9c' : '#879d70');
                    cube(out, a.x + x, 1.3, a.z + z, .6, .4, .6, i === 3 ? '#ebc4ad' : '#a7b785');
                }
            }
        cube(out, a.x, -.35, a.z, 2.8, .6, 2.8, '#47564c');
        cube(out, a.x, .01, a.z, 2.1, .1, 2.1, '#f0e7cb');
    }
    for (let i = 0; i < 22; i++) {
        const x = (rng() - .5) * 80, z = (rng() - .5) * 80;
        for (let j = 0; j < 4; j++)
            cube(out, x + (rng() - .5) * 5, -5 - rng() * 3, z + (rng() - .5) * 3, 2 + rng() * 2, .7 + rng(), 1 + rng() * 2, '#f1efdf');
    }
    return out;
}
export class RogueRenderer {
    constructor(canvas, labels, reducedMotion = false) {
        this.canvas = canvas;
        this.labels = labels;
        this.reduced = reducedMotion;
        this.ctx = labels.getContext('2d');
        if (!this.ctx)
            throw new Error('无法创建标签画布');
        this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
        this.software = !this.gl;
        this.staticData = terrain();
        this.cx = 1;
        this.cz = -4;
        this.halfHeight = 28;
        this.pixelSize = 2;
        this.shake = 0;
        this.resetCamera();
        if (!this.gl) {
            this.soft = canvas.getContext('2d', { alpha: false });
            if (!this.soft)
                throw new Error('无法创建游戏画布');
            return;
        }
        const gl = this.gl, compile = (type, source) => { const s = gl.createShader(type); if (!s)
            throw new Error('无法创建着色器'); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(s);
            gl.deleteShader(s);
            throw new Error(message || '着色器编译失败');
        } return s; };
        const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
        this.program = gl.createProgram();
        if (!this.program)
            throw new Error('无法创建渲染程序');
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error('无法连接渲染程序');
        this.uniform = gl.getUniformLocation(this.program, 'matrix');
        const vertices = [];
        for (const [n, points] of faces)
            for (const i of [0, 1, 2, 0, 2, 3])
                vertices.push(...points[i], ...n);
        this.geometry = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.geometry);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        this.static = this.batch(new Float32Array(this.staticData), true);
        this.data = new Float32Array(40000);
        this.dynamic = this.batch(this.data, false);
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(...SKY, 1);
    }
    resetCamera() { this.camera = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH, zoom: 1 }; }
    batch(data, fixed) { const gl = this.gl, vao = gl.createVertexArray(), buffer = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.geometry); for (let i = 0; i < 2; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 24, i * 12);
    } gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, fixed ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW); for (const [i, n, o] of [[2, 3, 0], [3, 3, 12], [4, 3, 24], [5, 1, 36]]) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, n, gl.FLOAT, false, 40, o);
        gl.vertexAttribDivisor(i, 1);
    } return { vao, buffer, count: data.length / 10 }; }
    resize() { this.width = Math.max(1, this.canvas.clientWidth); this.height = Math.max(1, this.canvas.clientHeight); const scale = Math.max(this.pixelSize, this.width / 1000), w = Math.round(this.width / scale), h = Math.round(this.height / scale); if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl?.viewport(0, 0, w, h);
    } const d = Math.min(globalThis.devicePixelRatio || 1, 2); if (this.labels.width !== Math.round(this.width * d) || this.labels.height !== Math.round(this.height * d)) {
        this.labels.width = Math.round(this.width * d);
        this.labels.height = Math.round(this.height * d);
    } }
    point(x, y, z) { const m = this.matrix; return { x: (m[0] * x + m[4] * y + m[8] * z + m[12] + 1) * this.width / 2, y: (1 - m[1] * x - m[5] * y - m[9] * z - m[13]) * this.height / 2 }; }
    render(w, dt, clock) {
        this.resize();
        const p = w.player, intro = w.phase === 'ready', frozen = !['ready', 'playing'].includes(w.phase), t = this.reduced ? 0 : intro ? clock : w.time, a = this.reduced ? 1 : 1 - Math.exp(-dt * 5), mobile = this.width < 650;
        this.cx += ((intro ? 1 : p.x + p.vx * .2) - this.cx) * a;
        this.cz += ((intro ? -5 : p.z + p.vz * .2) - this.cz) * a;
        this.halfHeight += (((intro ? mobile ? 34 : 25 : mobile ? 17 : 15) * this.camera.zoom) - this.halfHeight) * a;
        this.shake = Math.max(0, this.shake - (frozen ? 0 : dt));
        const sh = this.reduced ? 0 : this.shake * .5 * Math.sin(clock * 75), yaw = this.camera.yaw, pitch = this.camera.pitch;
        this.view = cameraDirection(yaw, pitch);
        const z = this.view, x = [Math.cos(yaw), 0, -Math.sin(yaw)], y = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)], dot = v => v[0] * this.cx + v[2] * this.cz, hh = this.halfHeight, rx = hh * this.width / this.height;
        this.matrix = new Float32Array([x[0] / rx, y[0] / hh, -2 * z[0] / 160, 0, x[1] / rx, y[1] / hh, -2 * z[1] / 160, 0, x[2] / rx, y[2] / hh, -2 * z[2] / 160, 0, -dot(x) / rx + (intro && !mobile ? .34 : 0) + sh, -dot(y) / hh + (intro && mobile ? .58 : 0), 2 * (60 + dot(z)) / 160 - 1, 1]);
        const out = [], ring = (cx, cy, cz, r, color, n = 24) => { for (let i = 0; i < n; i++) {
            const v = i / n * TAU;
            cube(out, cx + Math.sin(v) * r, cy, cz + Math.cos(v) * r, .2, .13, .2, color);
        } };
        for (const item of w.loot) {
            const col = { xp: '#98b9b9', token: '#efd080', heal: '#8fbe89', shield: '#a4b9ce', bomb: '#da8b6d', magnet: '#bd9fbf', haste: '#eece68', chest: '#d9a863' }[item.kind] || '#ffffff', s = item.kind === 'xp' ? .22 : item.kind === 'token' ? .3 : .6;
            cube(out, item.x, 1.4 + Math.sin(t * 2 + item.id) * .12, item.z, s, s, s, col, t * .4);
            if (item.kind !== 'xp')
                cube(out, item.x, 1.4, item.z, .12, s * 1.7, .12, '#fff4db');
        }
        ISLANDS.forEach((b, i) => { const active = i ? w.beacons[i - 1].active : w.bossDefeated, col = active ? '#efd080' : '#718c80'; if (i) {
            cube(out, b.x, .6, b.z, .65, 1.25, .65, '#45584c');
            cube(out, b.x, 1.6, b.z, .8, .6, .8, col, t * .35);
        } ring(b.x, active ? 1 : 0, b.z, i ? 1.6 : 2.2, col); });
        const race = w.circuit;
        if (!race.finished)
            for (const gate of race.gates.slice(race.next, race.next + 2)) {
                const active = gate === race.gates[race.next];
                for (let i = 0; i < 24; i++) {
                    const v = i / 24 * TAU;
                    cube(out, gate.x + Math.sin(v) * 2.5 * gate.nz, 2.2 + Math.cos(v) * 2.5, gate.z - Math.sin(v) * 2.5 * gate.nx, .28, .28, .28, active ? '#d2ad73' : '#bcc6af');
                }
            }
        for (const e of w.enemies) {
            if (e.dead)
                continue;
            const def = ENEMIES[e.type], s = e.radius, rot = e.type === 'charger' ? Math.atan2(e.aimX, e.aimZ) : t * .4, col = e.flash > 0 ? '#fff5da' : def.color, body = (dx, dy, dz, sx, sy, sz, c = col) => cube(out, e.x + dx, 2 + dy, e.z + dz, sx, sy, sz, c, rot);
            if (e.telegraph > 0) {
                ring(e.x, .1, e.z, s + 1, col, 12);
                body(0, 0, 0, s * .5, s * .5, s * .5);
                continue;
            }
            body(0, 0, 0, s * 1.4, s * 1.4, s * 1.4);
            body(0, .12, s * .75, s * .65, .16, .12, '#f7e6c7');
            if (e.type === 'skitter') {
                body(-s, 0, 0, s, .12, s);
                body(s, 0, 0, s, .12, s);
            }
            else if (e.type === 'tank') {
                body(0, -.5, 0, s * 2.4, .5, s * 1.8, '#665d72');
                body(-s, .1, 0, .3, s * 2, s);
                body(s, .1, 0, .3, s * 2, s);
            }
            else if (e.type === 'gunner') {
                cube(out, e.x + e.aimX * .8, 2.1, e.z + e.aimZ * .8, .3, .3, 1.8, '#435c50', Math.atan2(e.aimX, e.aimZ));
                body(0, s, 0, .35, .4, .35);
            }
            else if (e.type === 'charger') {
                cube(out, e.x + e.aimX * s, 2, e.z + e.aimZ * s, .5, .4, 1, col, rot);
            }
            else if (e.type === 'splitter') {
                for (const dx of [-s, s])
                    body(dx, 0, 0, s * .6, s * .8, s * .6);
                body(0, s, 0, .4, .6, .4);
            }
            else if (e.type === 'boss') {
                body(0, 0, 0, s * 1.2, s * 1.2, s * 1.2, '#443e53');
                for (let i = 0; i < 6; i++) {
                    const v = t * .4 + i / 6 * TAU;
                    body(Math.cos(v) * 3, .5, Math.sin(v) * 3, .6, 1.3, .6);
                }
                ring(e.x, .1, e.z, 3.6, col);
            }
            else {
                body(0, 0, 0, s * 2.5, .2, .2);
                body(0, 0, 0, .2, s * 2.5, .2);
            }
            if (e.elite)
                ring(e.x, 3.8, e.z, s + .5, '#e9c174', 12);
            if (e.windup > 0) {
                ring(e.x, .2, e.z, e.type === 'boss' ? 5 : s + 1, '#d77a64', 20);
                if (e.type !== 'boss')
                    for (let i = 1; i < 8; i++)
                        cube(out, e.x + e.aimX * i, .2, e.z + e.aimZ * i, .17, .1, .17, '#d77a64');
            }
        }
        for (const b of w.bullets)
            cube(out, b.x, 2.1, b.z, b.friendly ? .18 : .3, .18, b.friendly ? .8 : .3, b.friendly ? '#fff4b4' : '#d66a54', Math.atan2(b.vx, b.vz));
        const ship = (x, dy, z, sx, sy, sz, c) => cube(out, p.x + Math.cos(p.facing) * x + Math.sin(p.facing) * z, 2.2 + dy, p.z - Math.sin(p.facing) * x + Math.cos(p.facing) * z, sx, sy, sz, c, p.facing);
        cube(out, p.x, -.6, p.z, 1.8, .03, 1.2, '#8a9c80', p.facing);
        ship(0, 0, 0, 1.05, .4, 1.5, p.invulnerable > 0 ? '#fffdf2' : '#e9efdd');
        ship(0, .3, .15, .65, .3, .65, '#3d5551');
        ship(0, 0, .9, .5, .2, .4, '#df8d64');
        ship(-.9, 0, -.2, .8, .15, .8, '#e4b47c');
        ship(.9, 0, -.2, .8, .15, .8, '#e4b47c');
        for (let i = 0; i < Math.min(w.inventory, 15); i++) {
            const v = i * 2.4 + t * .7;
            cube(out, p.x + Math.cos(v) * 1.8, 2.7 + Math.sin(v * 1.6) * .3, p.z + Math.sin(v) * 1.8, .12, .12, .12, '#eac272');
        }
        if (p.invulnerable > 0)
            ring(p.x, 2.1, p.z, 2, '#acc8bd', 16);
        for (let i = 0; i < (w.upgrades.orbit || 0); i++) {
            const v = w.time * 3 + i / w.upgrades.orbit * TAU;
            cube(out, p.x + Math.sin(v) * 3, 2.2, p.z + Math.cos(v) * 3, .18, .2, 1.4, '#f5de9e', v);
        }
        for (const e of w.effects) {
            if (e.kind === 'beam') {
                const n = Math.ceil(Math.hypot(e.tx - e.x, e.tz - e.z) * 3);
                for (let i = 0; i < n; i++)
                    cube(out, e.x + (e.tx - e.x) * i / n, 2.3, e.z + (e.tz - e.z) * i / n, .2, .2, .2, e.color);
            }
            else
                ring(e.x, e.kind === 'burst' ? 2 : .3, e.z, e.radius * (1 - e.life / .5), e.color, 24);
        }
        this.draw(out);
        this.drawLabels(w, intro);
    }
    draw(dynamic) {
        if (this.software) {
            this.drawSoftware(dynamic);
            return;
        }
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniform, false, this.matrix);
        gl.bindVertexArray(this.static.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.static.count);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamic.buffer);
        if (dynamic.length > this.data.length) {
            this.data = new Float32Array(dynamic.length * 2);
            gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);
        }
        this.data.set(dynamic);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, dynamic.length));
        gl.bindVertexArray(this.dynamic.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, dynamic.length / 10);
    }
    drawSoftware(dynamic) {
        const ctx = this.soft, w = this.canvas.width, h = this.canvas.height, m = this.matrix, polys = [];
        ctx.fillStyle = '#e8ecde';
        ctx.fillRect(0, 0, w, h);
        for (const data of [this.staticData, dynamic])
            for (let i = 0; i < data.length; i += 10) {
                const [x, y, z, sx, sy, sz, r, g, b, yaw] = data.slice(i, i + 10), c = Math.cos(yaw), s = Math.sin(yaw), px = (m[0] * x + m[4] * y + m[8] * z + m[12] + 1) * w / 2, py = (1 - m[1] * x - m[5] * y - m[9] * z - m[13]) * h / 2, margin = (sx + sy + sz) * w / this.halfHeight;
                if (px < -margin || px > w + margin || py < -margin || py > h + margin)
                    continue;
                for (const [n, corners] of faces) {
                    const normal = [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
                    if (normal.reduce((sum, v, k) => sum + v * this.view[k], 0) <= 0)
                        continue;
                    const points = [];
                    let depth = 0;
                    for (const [vx, vy, vz] of corners) {
                        const wx = x + vx * sx * c + vz * sz * s, wy = y + vy * sy, wz = z - vx * sx * s + vz * sz * c;
                        points.push([(m[0] * wx + m[4] * wy + m[8] * wz + m[12] + 1) * w / 2, (1 - m[1] * wx - m[5] * wy - m[9] * wz - m[13]) * h / 2]);
                        depth += m[2] * wx + m[6] * wy + m[10] * wz;
                    }
                    const shade = .68 + .32 * Math.max(0, (-.4 * normal[0] + normal[1] + .6 * normal[2]) / Math.sqrt(1.52)), fog = Math.min(.4, Math.max(0, -y - 3) * .04), col = [r, g, b].map((v, k) => Math.round((v * shade * (1 - fog) + SKY[k] * fog) * 255));
                    polys.push({ points, depth, color: `rgb(${col.join(',')})` });
                }
            }
        polys.sort((a, b) => b.depth - a.depth);
        for (const p of polys) {
            ctx.beginPath();
            ctx.moveTo(...p.points[0]);
            p.points.slice(1).forEach(v => ctx.lineTo(...v));
            ctx.closePath();
            ctx.fillStyle = p.color;
            ctx.fill();
        }
    }
    drawLabels(w, intro) {
        const ctx = this.ctx, d = this.labels.width / this.width;
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.textAlign = 'center';
        ctx.font = '600 10px ui-monospace, monospace';
        for (const e of w.enemies) {
            if (!e.elite || e.dead)
                continue;
            const q = this.point(e.x, 4.7, e.z);
            ctx.fillStyle = '#554c4d';
            ctx.fillRect(q.x - 18, q.y, 36, 3);
            ctx.fillStyle = '#e6bb70';
            ctx.fillRect(q.x - 18, q.y, 36 * Math.max(0, e.hp / e.maxHp), 3);
        }
        ISLANDS.forEach((b, i) => { const q = this.point(b.x, 4.5, b.z); if (q.x < 60 || q.x > this.width - 60 || q.y < 190 || q.y > this.height - 180 || (intro && q.x < this.width * .4))
            return; const text = i ? `${w.beacons[i - 1].active ? '◆' : '◇'} ${b.name}` : w.bossDefeated ? '⌂ 撤离点已开启' : '⌂ 归航港'; ctx.fillStyle = '#edf0e3'; ctx.fillRect(q.x - 45, q.y - 12, 90, 20); ctx.fillStyle = '#566f5c'; ctx.fillText(text, q.x, q.y + 2); });
    }
    destroy() { if (!this.gl)
        return; const gl = this.gl; for (const b of [this.static, this.dynamic]) {
        gl.deleteBuffer(b.buffer);
        gl.deleteVertexArray(b.vao);
    } gl.deleteBuffer(this.geometry); gl.deleteProgram(this.program); }
}
