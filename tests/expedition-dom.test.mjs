import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { Window } from 'happy-dom';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = (await readFile(join(root, 'index.html'), 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
let directory;
let serial = 0;
before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lightjunction-interaction-'));
    const entry = join(directory, 'entry.ts');
    await writeFile(entry, `export { initExpedition } from ${JSON.stringify(join(root, 'src/expedition.ts'))};\nexport { initSecureCard, openSecureCard } from ${JSON.stringify(join(root, 'src/secure-card.ts'))};`);
    await build({ root, configFile: false, publicDir: false, logLevel: 'silent', build: {
        outDir: join(directory, 'bundle'), emptyOutDir: true, minify: false,
        lib: { entry, formats: ['es'], fileName: () => 'world.mjs' },
    } });
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function environment({ reduced = false, hash = '', canvasAvailable = true } = {}) {
    const window = new Window({ url: `https://lightjunction.github.io/lightjunction/${hash}`, settings: {
        disableJavaScriptEvaluation: true, disableCSSFileLoading: true,
        disableComputedStyleRendering: true, disableIframePageLoading: true,
    } });
    window.document.write(html);
    const document = window.document;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    window.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
    const frames = new Map();
    let frameId = 0, time = performance.now();
    const raf = callback => { frames.set(++frameId, callback); return frameId; };
    const caf = id => frames.delete(id);
    const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
    window.HTMLCanvasElement.prototype.getContext = () => canvasAvailable ? context : null;
    window.HTMLElement.prototype.getBoundingClientRect = function () {
        return { x: 0, y: 0, left: 0, top: 0, width: 1440, height: this.classList.contains('site-header') ? 88 : 760, right: 1440, bottom: 760 };
    };
    window.HTMLElement.prototype.getClientRects = function () { return this.closest('[hidden]') ? [] : [this.getBoundingClientRect()]; };
    window.HTMLElement.prototype.setPointerCapture = () => {};
    const globals = { window, document, location: window.location, history: window.history,
        Element: window.Element, HTMLElement: window.HTMLElement,
        MutationObserver: window.MutationObserver,
        HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLButtonElement: window.HTMLButtonElement,
        requestAnimationFrame: raf, cancelAnimationFrame: caf,
        ResizeObserver: class { observe() {} disconnect() {} },
    };
    const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const module = await import(`${pathToFileURL(join(directory, 'bundle/world.mjs'))}?case=${serial++}`);
    const logs = [];
    module.initSecureCard(message => logs.push(message));
    module.initExpedition();
    const step = (count = 100) => {
        for (let index = 0; index < count; index++) {
            const callbacks = [...frames.values()]; frames.clear(); time += 16;
            callbacks.forEach(callback => callback(time));
        }
    };
    const get = id => document.getElementById(id);
    const key = (element, value, options = {}) => {
        const event = new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
        element.dispatchEvent(event); return event;
    };
    const navigate = hash => {
        window.history.replaceState(null, '', hash);
        window.dispatchEvent(new window.PopStateEvent('popstate'));
    };
    step();
    return { window, document, frames, module, step, get, key, navigate, logs,
        async close() {
            await window.happyDOM.close();
            for (const [key, descriptor] of saved) {
                if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
            }
        },
    };
}

async function using(options, check) {
    const env = await environment(options);
    try { await check(env); } finally { await env.close(); }
}

test('wheel travels, browser zoom is preserved, and keyboard movement works', async () => using({}, env => {
    const { window, get, step, key, document } = env;
    const canvas = get('world-canvas');
    assert.equal(document.querySelector('main').hidden, true);
    assert.equal(get('explore').hidden, false);
    const wheel = options => { const event = new window.WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true, ...options }); Object.assign(event, options); canvas.dispatchEvent(event); return event; };
    assert.equal(wheel({ ctrlKey: true }).defaultPrevented, false);
    assert.equal(wheel({ metaKey: true }).defaultPrevented, false);
    for (let index = 0; index < 5; index++) assert.equal(wheel({}).defaultPrevented, true);
    step();
    assert.equal(get('world-title').textContent, 'Made of language');
    key(canvas, 'Home'); step();
    assert.equal(get('world-title').textContent, 'The junction');
    for (let index = 0; index < 6; index++) key(canvas, 'ArrowRight');
    step(); assert.equal(get('world-title').textContent, 'Made of language');
    assert.equal(key(get('secure-message'), 'ArrowRight').defaultPrevented, false);
}));

test('exhibits keep original nodes, restore focus, and preserve reading access', async () => using({}, env => {
    const { get, document, key, step } = env;
    const original = get('work');
    const main = original.parentElement;
    const button = document.querySelector('.site-header a[href="#work"]');
    button.focus(); button.click();
    assert.ok(get('work') === original);
    assert.ok(original.parentElement === get('exhibit-content'));
    assert.equal(get('exhibit-dialog').hidden, false);
    assert.equal(get('explore').inert, true);
    assert.equal(env.frames.size, 0);
    assert.ok(document.activeElement === get('exhibit-close'));
    key(get('exhibit-close'), 'Escape'); step();
    assert.ok(original.parentElement === main);
    assert.equal(get('explore').inert, false);
    assert.ok(document.activeElement === button);
    assert.equal(get('world-title').textContent, 'The junction');
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    assert.equal(new Set(ids).size, ids.length);
    get('btn-reading').click();
    assert.equal(main.hidden, false);
    assert.equal(get('explore').hidden, true);
    assert.equal(env.frames.size, 0);
    get('btn-reading').click(); step();
    assert.equal(main.hidden, true);
    assert.equal(get('explore').hidden, false);
}));

test('direct links, map and rapid destination buttons work without completing the route', async () => using({ hash: '#challenge-two', reduced: true }, env => {
    const { get, document, key, step, navigate } = env;
    assert.ok(get('challenge-two').parentElement === get('exhibit-content'));
    key(get('exhibit-close'), 'Escape'); step();
    get('world-next').click(); get('world-next').click(); step();
    assert.equal(get('world-title').textContent, 'The workshop');
    get('world-map').click(); step();
    assert.equal(get('world-map').getAttribute('aria-pressed'), 'true');
    document.querySelectorAll('#world-dock button')[7].click(); step();
    assert.equal(get('world-title').textContent, 'Leave a trace');
    assert.equal(get('world-map').getAttribute('aria-pressed'), 'false');
    navigate('#model');
    assert.ok(get('model').parentElement === get('exhibit-content'));
    assert.equal(document.querySelectorAll('.model-route article.route-step').length, 4);
    navigate('#explore');
    assert.equal(get('exhibit-dialog').hidden, true);
    assert.equal(get('explore').inert, false);
    step(); assert.equal(env.frames.size, 0);
}));

test('contact composer traps focus and history dismisses nested overlays in order', async () => using({}, env => {
    const { get, document, module, key, navigate } = env;
    navigate('#contact');
    const opener = get('contact').querySelector('button');
    opener.focus(); module.openSecureCard();
    assert.ok(document.activeElement === get('secure-message'));
    assert.equal(get('exhibit-dialog').inert, true);
    key(get('secure-message'), 'Tab', { shiftKey: true });
    assert.ok(document.activeElement === get('encrypt-now'));
    key(get('encrypt-now'), 'Tab');
    assert.ok(document.activeElement === get('secure-message'));
    key(get('secure-message'), 'Escape');
    assert.equal(get('secure-card').hidden, true);
    assert.equal(get('exhibit-dialog').hidden, false);
    assert.equal(get('exhibit-dialog').inert, false);
    assert.equal(get('explore').inert, true);
    assert.ok(document.activeElement === opener);
    module.openSecureCard(); navigate('#explore');
    assert.equal(get('secure-card').hidden, true);
    assert.equal(get('exhibit-dialog').hidden, true);
    assert.equal(get('explore').inert, false);
}));

test('reduced motion settles after input and a canceled drag leaves navigation usable', async () => using({ reduced: true }, env => {
    const { get, window, step } = env;
    assert.equal(env.frames.size, 0);
    const canvas = get('world-canvas');
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0, clientX: 400, clientY: 300 }));
    canvas.dispatchEvent(new window.PointerEvent('pointermove', { pointerId: 1, isPrimary: true, clientX: 700, clientY: 400 }));
    assert.equal(get('explore').classList.contains('is-dragging'), true);
    canvas.dispatchEvent(new window.PointerEvent('pointercancel', { pointerId: 1 }));
    assert.equal(get('explore').classList.contains('is-dragging'), false);
    get('world-next').click(); step();
    assert.equal(get('world-title').textContent, 'Made of language');
    assert.equal(env.frames.size, 0);
}));

test('without a canvas context the full original document stays available', async () => using({ canvasAvailable: false }, env => {
    assert.equal(env.document.querySelector('main').hidden, false);
    assert.equal(env.get('explore').hidden, true);
    assert.equal(env.get('btn-reading').hidden, true);
}));


test('rapid relative travel preserves direction across the opposite side of the map', async () => using({}, env => {
    for (let index = 0; index < 4; index++) env.get('world-next').click();
    env.step(5);
    assert.equal(env.get('world-title').textContent, 'Made of language');
    env.step();
    assert.equal(env.get('world-title').textContent, 'A closed signal');
}));

test('theme changes redraw the settled map under reduced motion', async () => using({ reduced: true }, async env => {
    assert.equal(env.frames.size, 0);
    env.document.documentElement.dataset.theme = 'dark';
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(env.frames.size, 1);
    env.step();
    assert.equal(env.frames.size, 0);
}));

test('free flight rejoins the route near the player for wheel and next-place input', async () => using({ reduced: true }, env => {
    const { get, step, window, document } = env;
    const flyToWorkshop = () => {
        get('world-map').click(); step();
        const stop = document.querySelectorAll('#world-stops button')[2];
        const [x, y] = stop.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px/).slice(1).map(Number);
        for (const type of ['pointerdown', 'pointerup']) get('world-canvas').dispatchEvent(new window.PointerEvent(type, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y }));
        step(); assert.equal(get('world-title').textContent, 'The workshop');
    };
    flyToWorkshop();
    get('world-canvas').dispatchEvent(new window.WheelEvent('wheel', { deltaY: 1, cancelable: true }));
    step(); assert.equal(get('world-title').textContent, 'The workshop');
    get('world-home').click(); step();
    flyToWorkshop();
    get('world-next').click(); step();
    assert.equal(get('world-title').textContent, 'Follow the thread');
}));

test('encrypted result stays isolated and browser history closes it before the exhibit', async () => using({}, async env => {
    const { get, module, navigate, document, key } = env;
    navigate('#contact');
    // Happy DOM also queues hashchange for replaceState; let that settle first.
    await new Promise(resolve => setTimeout(resolve, 0));
    module.openSecureCard();
    get('secure-message').value = 'Local automated interaction check.';
    get('encrypt-now').click();
    for (let attempt = 0; attempt < 300 && get('result-overlay').getAttribute('aria-hidden') !== 'false'; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(get('result-overlay').getAttribute('aria-hidden'), 'false', JSON.stringify({ logs: env.logs, toast: get('toast').textContent, composerHidden: get('secure-card').hidden, hash: env.window.location.hash }));
    assert.ok(get('result-content').textContent.startsWith('-----BEGIN PGP MESSAGE-----'));
    assert.equal(get('exhibit-dialog').inert, true);
    assert.equal(get('explore').inert, true);
    get('result-close').focus(); key(get('result-close'), 'Tab');
    assert.ok(document.activeElement === get('result-copy'));
    navigate('#explore');
    assert.equal(get('result-overlay').getAttribute('aria-hidden'), 'true');
    assert.equal(get('exhibit-dialog').hidden, true);
    assert.equal(get('explore').inert, false);
}));

test('canceling an in-flight encryption never opens a result after returning to the map', async () => using({}, async env => {
    const { get, module, navigate } = env;
    navigate('#contact');
    await new Promise(resolve => setTimeout(resolve, 0));
    module.openSecureCard();
    get('secure-message').value = 'Canceled local interaction check.';
    get('encrypt-now').click(); navigate('#explore');
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(get('result-overlay').getAttribute('aria-hidden'), 'true');
    assert.equal(get('secure-card').hidden, true);
    assert.equal(get('explore').inert, false);
}));
