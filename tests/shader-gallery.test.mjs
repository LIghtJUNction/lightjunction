import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { Window } from 'happy-dom';

let directory, serial = 0;
before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lightjunction-shader-dom-'));
    await build({ configFile: false, publicDir: false, logLevel: 'silent', build: {
        outDir: directory, emptyOutDir: true,
        lib: { entry: fileURLToPath(new URL('../src/shader-gallery.ts', import.meta.url)), formats: ['es'], fileName: () => 'gallery.mjs' },
    } });
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function using(reduced, check) {
    const window = new Window();
    const document = window.document;
    document.body.innerHTML = `<button data-shader-previous></button><span data-shader-position></span><button data-shader-next></button><div data-shader-track tabindex="0">${['ink', 'fold', 'neon', 'unknown'].map(engine => `<article data-shader-card data-shader-engine="${engine}"><h3>${engine}</h3><canvas data-shader-canvas></canvas><span data-shader-status></span><div data-shader-fallback hidden></div><button data-shader-action="pause">Pause</button><button data-shader-action="reset">Reset</button></article>`).join('')}</div><div data-shader-dots></div>`;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    const motion = new window.EventTarget(); motion.matches = reduced;
    window.matchMedia = () => motion;
    const callbacks = new Map(); let nextId = 0, time = performance.now();
    const contexts = new Map();
    window.HTMLCanvasElement.prototype.getContext = function () {
        const state = { sources: [], draws: 0, uniforms: {} };
        const gl = {
            VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, TRIANGLES: 5,
            createShader: type => ({ type }), shaderSource: (shader, source) => { state.sources.push(source); }, compileShader() {},
            getShaderParameter: () => true, deleteShader() {}, createProgram: () => ({}),
            attachShader() {}, linkProgram() {}, getProgramParameter: () => true, deleteProgram() {},
            getUniformLocation: (_, name) => ({ name }), useProgram() {}, viewport() {},
            uniform1f: (location, value) => { state.uniforms[location.name] = value; },
            uniform3f() {}, uniform4f: (location, ...value) => { state.uniforms[location.name] = value; },
            drawArrays: () => { state.draws++; },
        };
        contexts.set(this, state); return gl;
    };
    window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, bottom: 360, width: 640, height: 360 });
    window.HTMLCanvasElement.prototype.setPointerCapture = function (id) { this.captured = id; };
    window.HTMLCanvasElement.prototype.hasPointerCapture = function (id) { return this.captured === id; };
    window.HTMLCanvasElement.prototype.releasePointerCapture = function () { this.captured = null; };
    const visibility = [];
    class IntersectionObserver {
        constructor(callback) { visibility.push(callback); }
        observe() {}
    }
    window.IntersectionObserver = IntersectionObserver;
    const globals = { window, document, Element: window.Element,
        requestAnimationFrame: callback => { callbacks.set(++nextId, callback); return nextId; },
        cancelAnimationFrame: id => callbacks.delete(id), IntersectionObserver,
        ResizeObserver: class { observe() {} },
    };
    const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const module = await import(`${pathToFileURL(join(directory, 'gallery.mjs'))}?case=${serial++}`);
    module.mountShaderShowcase();
    time = performance.now();
    const cards = [...document.querySelectorAll('[data-shader-card]')];
    const step = () => { const pending = [...callbacks.values()]; callbacks.clear(); time += 16; pending.forEach(callback => callback(time)); };
    const visible = (index, value) => visibility.forEach(callback => callback([{ target: cards[index].querySelector('canvas'), intersectionRatio: value ? 1 : 0 }]));
    const state = index => contexts.get(cards[index].querySelector('canvas'));
    const action = (index, name) => cards[index].querySelector(`[data-shader-action="${name}"]`).click();
    const pointer = (index, type, id, x, primary = true) => cards[index].querySelector('canvas').dispatchEvent(new window.PointerEvent(type, { pointerId: id, isPrimary: primary, button: 0, clientX: x, clientY: 150 }));
    try { await check({ cards, step, state, visible, action, pointer, callbacks, motion, window, document }); }
    finally {
        await window.happyDOM.close();
        for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    }
}

test('study selection compiles distinct sources and rejects unknown engines independently', async () => using(false, env => {
    assert.ok(env.state(0).sources.some(source => source.includes('FLOATING INK')));
    assert.ok(env.state(1).sources.some(source => source.includes('IRIDESCENT FOLD')));
    assert.ok(env.state(2).sources.some(source => source.includes('NEON RIFT')));
    assert.equal(env.cards[3].querySelector('[data-shader-fallback]').hidden, false);
    assert.equal(env.cards[3].querySelector('button').disabled, true);
    assert.equal(env.state(0).draws, 0);
    assert.equal(env.state(1).draws, 0);
    env.visible(0, true); env.step();
    assert.equal(env.state(0).draws, 1);
    assert.equal(env.state(1).draws, 0);
    env.visible(0, false); env.step();
    assert.equal(env.state(0).draws, 1);
    assert.equal(env.callbacks.size, 0);
}));

test('pause and reset are independent; paused studies still respond to their active pointer', async () => using(false, env => {
    env.visible(0, true); env.visible(1, true); env.step();
    env.action(0, 'pause'); env.step();
    const inkTime = env.state(0).uniforms.iTime, foldTime = env.state(1).uniforms.iTime;
    env.step();
    assert.equal(env.state(0).uniforms.iTime, inkTime);
    assert.ok(env.state(1).uniforms.iTime > foldTime);
    env.pointer(0, 'pointerdown', 1, 200); env.step();
    const first = [...env.state(0).uniforms.iMouse];
    env.pointer(0, 'pointermove', 2, 500, false); env.pointer(0, 'pointerup', 2, 500, false); env.step();
    assert.deepEqual(env.state(0).uniforms.iMouse, first);
    env.pointer(0, 'pointermove', 1, 300); env.step();
    assert.notEqual(env.state(0).uniforms.iMouse[0], first[0]);
    env.pointer(0, 'pointercancel', 1, 300); env.step();
    assert.equal(env.state(0).uniforms.iMouse[2], 0);
    env.action(0, 'reset'); env.step();
    assert.equal(env.state(0).uniforms.iTime, 0);
    assert.ok(env.state(1).uniforms.iTime > 0);
}));

test('reduced motion starts settled, supports explicit resume, and hidden tabs stop drawing', async () => using(true, env => {
    env.visible(1, true); env.step();
    assert.equal(env.state(1).draws, 1);
    assert.equal(env.cards[1].querySelector('button').textContent, 'Resume');
    assert.equal(env.callbacks.size, 0);
    env.action(1, 'pause'); env.step();
    assert.ok(env.state(1).uniforms.iTime > 0);
    Object.defineProperty(env.document, 'hidden', { configurable: true, value: true });
    env.document.dispatchEvent(new env.window.Event('visibilitychange'));
    assert.equal(env.callbacks.size, 0);
    const draws = env.state(1).draws;
    env.step(); assert.equal(env.state(1).draws, draws);
    Object.defineProperty(env.document, 'hidden', { configurable: true, value: false });
    env.document.dispatchEvent(new env.window.Event('visibilitychange')); env.step();
    assert.equal(env.state(1).draws, draws + 1);
}));
