import { createRun, startRun, advanceRun, pauseRun, resumeRun, dashRun, pulseRun, chooseUpgrade, rerollUpgrades, stats, UPGRADES, WAVE_SECONDS, readRogueRecord, saveRogueRecord } from './rogue-world.mjs';
import { RogueRenderer } from './rogue-renderer.mjs';
import { screenMovement, orbitCamera, zoomCamera } from './flight.mjs';
import { ISLANDS } from './world.mjs';
const $ = id => document.getElementById(id), root = $('rogue'), canvas = $('battle-world'), abort = new AbortController();
const on = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: abort.signal });
const seed = () => { try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
}
catch {
    return Date.now() >>> 0;
} };
let world = createRun(seed()), storage;
try {
    storage = localStorage;
}
catch { }
let record = readRogueRecord(storage), renderer, raf = 0, last = 0, accumulator = 0, hudClock = 0, phase = '', choiceKey = '', buildKey = '', saved = false, noticeUntil = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, keys = new Set(), stick = { x: 0, y: 0, id: null }, orbit = { id: null, x: 0, y: 0 };
const STEP = 1 / 60;
let audio = null, soundOn = false, lastTone = 0;
function tone(f = 440, length = .06) { if (!soundOn || !audio || audio.state !== 'running' || performance.now() - lastTone < 50)
    return; lastTone = performance.now(); const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime; osc.type = 'square'; osc.frequency.value = f; gain.gain.setValueAtTime(.022, t); gain.gain.exponentialRampToValueAtTime(.0001, t + length); osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + length + .01); osc.onended = () => { osc.disconnect(); gain.disconnect(); }; }
function notice(text) { $('notice').textContent = text; $('notice').classList.add('visible'); noticeUntil = performance.now() + 3000; }
const time = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function movement() { return screenMovement((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x, (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stick.y, renderer.camera.yaw); }
function releaseOrbit() { const id = orbit.id; orbit.id = null; canvas.classList.remove('orbiting'); if (id !== null && canvas.hasPointerCapture(id))
    canvas.releasePointerCapture(id); }
function clearInput() { keys.clear(); stick.x = 0; stick.y = 0; const id = stick.id; stick.id = null; if (id !== null && $('joystick').hasPointerCapture(id))
    $('joystick').releasePointerCapture(id); $('knob').style.transform = 'translate(0, 0)'; releaseOrbit(); accumulator = 0; }
function requestDraw() { if (!raf && !document.hidden && root.dataset.phase !== 'error') {
    last = performance.now();
    raf = requestAnimationFrame(frame);
} }
function start() { startRun(world); saved = false; clearInput(); sync(); requestDraw(); canvas.focus({ preventScroll: true }); notice('主炮自动开火。走位收集经验，升级三选一。'); }
function pause() { if (world.phase !== 'playing')
    return; pauseRun(world); clearInput(); sync(); requestDraw(); $('resume').focus(); }
function resume() { if (world.phase !== 'paused')
    return; resumeRun(world); clearInput(); sync(); requestDraw(); canvas.focus({ preventScroll: true }); }
function restart() { world = createRun(seed()); renderer.resetCamera(); renderer.shake = 0; buildKey = ''; choiceKey = ''; phase = ''; start(); }
function choose(id) { if (!chooseUpgrade(world, id))
    return; choiceKey = ''; tone(880, .13); clearInput(); sync(); updateHUD(); requestDraw(); if (world.phase === 'playing')
    canvas.focus({ preventScroll: true }); }
function sync() {
    const changed = phase !== world.phase;
    phase = world.phase;
    root.dataset.phase = phase;
    $('intro').hidden = phase !== 'ready';
    $('hud').hidden = phase === 'ready';
    $('upgrade').hidden = phase !== 'upgrade';
    $('paused').hidden = phase !== 'paused';
    $('result').hidden = !['won', 'lost'].includes(phase);
    $('pause').hidden = !['playing', 'paused'].includes(phase);
    $('pause').textContent = phase === 'paused' ? '继续' : '暂停';
    if (phase === 'upgrade') {
        if (changed)
            clearInput();
        const key = `${world.level}:${world.choices.join(',')}:${world.rerolls}`;
        if (key !== choiceKey) {
            choiceKey = key;
            $('choices').replaceChildren();
            world.choices.forEach((id, i) => {
                const u = UPGRADES.find(v => v.id === id), button = document.createElement('button');
                button.type = 'button';
                button.className = 'choice';
                button.dataset.upgrade = id;
                for (const [tag, text, cls] of [['span', `0${i + 1}`, 'number'], ['span', u.icon, 'symbol'], ['small', `${u.kind} / ${(world.upgrades[id] || 0) + 1} 级`, ''], ['strong', u.name, ''], ['p', u.text, '']]) {
                    const el = document.createElement(tag);
                    el.textContent = text;
                    if (cls)
                        el.className = cls;
                    button.append(el);
                }
                $('choices').append(button);
            });
            $('reroll').textContent = `重抽 · 剩余 ${world.rerolls} 次`;
            $('reroll').disabled = world.rerolls <= 0;
            $('choices').firstElementChild?.focus();
        }
    }
    if (['won', 'lost'].includes(phase) && !saved) {
        saved = true;
        clearInput();
        record = saveRogueRecord(storage, record, world);
        const won = phase === 'won';
        $('result-title').textContent = won ? '把自己带回来了。' : '下一次，会不一样。';
        $('result-kicker').textContent = won ? 'EXTRACTION COMPLETE' : 'SIGNAL LOST';
        $('result-copy').textContent = won ? '噪声核心已击败。本局构筑留在这里，下一次重新出发。' : '护甲归零。尝试换一种构筑，或者用冲刺穿过包围。';
        $('result-stats').replaceChildren();
        for (const [name, value] of [['SCORE', world.score], ['KILLS', world.kills], ['LEVEL', world.level], ['TIME', time(world.time)]]) {
            const span = document.createElement('span'), b = document.createElement('b');
            span.textContent = name;
            b.textContent = String(value);
            span.append(b);
            $('result-stats').append(span);
        }
        $('restart').focus();
    }
}
function drawMap() {
    const ctx = $('minimap').getContext('2d');
    if (!ctx)
        return;
    ctx.fillStyle = '#e1e8d8';
    ctx.fillRect(0, 0, 144, 144);
    const point = p => ({ x: 72 + p.x * 1.8, y: 72 + p.z * 1.8 });
    ctx.strokeStyle = '#35483f16';
    for (let i = 18; i < 144; i += 18) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 144);
        ctx.moveTo(0, i);
        ctx.lineTo(144, i);
        ctx.stroke();
    }
    for (const [i, island] of ISLANDS.entries()) {
        const q = point(island);
        ctx.fillStyle = i && world.beacons[i - 1].active ? '#ce9d68' : '#b1c3a0';
        ctx.fillRect(q.x - 8, q.y - 7, 16, 14);
    }
    for (const e of world.enemies) {
        const q = point(e);
        ctx.fillStyle = e.type === 'boss' ? '#b36c8a' : '#bf7660';
        const s = e.type === 'boss' ? 3 : 1.3;
        ctx.fillRect(q.x - s, q.y - s, s * 2, s * 2);
    }
    if (!world.circuit.finished) {
        const q = point(world.circuit.gates[world.circuit.next]);
        ctx.strokeStyle = '#a97841';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
        ctx.stroke();
    }
    const p = point(world.player);
    if (world.bossDefeated) {
        const q = point(ISLANDS[0]);
        ctx.strokeStyle = '#b27742';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fff9e8';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    ctx.strokeStyle = '#3d5545';
    ctx.strokeRect(p.x - 3, p.y - 3, 6, 6);
}
function updateHUD() {
    const p = world.player, s = stats(world);
    $('best').textContent = String(record.best).padStart(6, '0');
    $('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('hp-fill').style.transform = `scaleX(${p.hp / p.maxHp})`;
    $('score').textContent = String(world.score).padStart(6, '0');
    $('level').textContent = `LV ${String(world.level).padStart(2, '0')}`;
    $('xp-text').textContent = `${world.xp} / ${world.xpNext} XP`;
    $('xp-fill').style.transform = `scaleX(${Math.min(1, world.xp / world.xpNext)})`;
    $('wave').textContent = world.bossDefeated ? 'EXTRACT' : world.wave >= 6 ? 'BOSS WAVE' : `WAVE 0${world.wave} / 05`;
    $('timer').textContent = time(world.time);
    $('map-caption').textContent = `${world.kills} KILLS · ${world.inventory} TK`;
    $('dash-fill').style.transform = `scaleX(${Math.max(0, 1 - p.dashCooldown / s.dashCooldown)})`;
    $('pulse-fill').style.transform = `scaleX(${Math.max(0, 1 - p.pulseCooldown / 6)})`;
    $('dash').disabled = world.phase !== 'playing' || p.dashCooldown > 0;
    $('pulse').disabled = world.phase !== 'playing' || p.pulseCooldown > 0;
    $('objective').textContent = world.bossDefeated ? '返回归航港，完成撤离' : world.wave >= 6 ? '击败 NULL · 噪声核心' : `撑过第 ${world.wave} 波 · ${Math.max(0, Math.ceil(WAVE_SECONDS - world.time % WAVE_SECONDS))} 秒`;
    $('extra').textContent = `信标 ${world.beacons.filter(b => b.active).length}/3 · 航环 ${world.circuit.next}/12${p.haste > 0 ? ' · 火力超频中' : ''}`;
    const boss = world.enemies.find(e => e.type === 'boss' && !e.dead);
    $('boss-ui').hidden = !boss;
    if (boss) {
        $('boss-fill').style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
        $('boss-phase').textContent = boss.hp < boss.maxHp * .5 ? 'PHASE II · 狂暴' : 'PHASE I';
    }
    const build = JSON.stringify(world.upgrades);
    if (build !== buildKey) {
        buildKey = build;
        $('loadout').replaceChildren();
        for (const [id, level] of Object.entries(world.upgrades)) {
            const u = UPGRADES.find(v => v.id === id), span = document.createElement('span'), small = document.createElement('small');
            span.title = `${u.name}：${u.text}`;
            span.setAttribute('aria-label', `${u.name} ${level}级`);
            span.textContent = u.icon;
            small.textContent = String(level);
            span.append(small);
            $('loadout').append(span);
        }
    }
    drawMap();
}
function consume() { for (const e of world.events.splice(0)) {
    if (e.type === 'shot')
        tone(240, .035);
    else if (e.type === 'hit') {
        renderer.shake = .2;
        tone(75, .16);
    }
    else if (e.type === 'upgrade')
        tone(660, .12);
    else if (e.type === 'dash')
        tone(140, .12);
    else if (e.type === 'pulse')
        tone(320, .2);
    else if (e.type === 'wave')
        notice(`第 ${e.wave} 波 · 敌人更强了`);
    else if (e.type === 'boss')
        notice('NULL 噪声核心出现。注意地面预警。');
    else if (e.type === 'boss-down')
        notice('核心已击败！沿小地图路线返回归航港。');
    else if (e.type === 'beacon')
        notice('信标已充能 · 生命回复 · 获得额外强化');
    else if (e.type === 'gate')
        notice(`航环 ${e.value}/12 · +100 · 冲刺已恢复`);
    else if (e.type === 'circuit')
        notice('整条航线完成 · +1000');
    else if (e.type === 'pickup') {
        const names = { heal: '生命恢复 +30', shield: '护盾 · 4 秒无敌', haste: '超频 · 10 秒双倍射速', magnet: '所有经验已吸取', bomb: '清场爆破', chest: '打开宝箱' };
        notice(names[e.kind] || '获得道具');
    }
} }
function frame(now) { raf = 0; const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now; if (world.phase === 'playing') {
    accumulator += dt;
    while (accumulator >= STEP && world.phase === 'playing') {
        advanceRun(world, STEP, movement());
        accumulator -= STEP;
    }
    if (world.phase !== 'playing')
        accumulator = 0;
    consume();
    sync();
} renderer.render(world, dt, now / 1000); hudClock += dt; if (hudClock > .08) {
    hudClock = 0;
    updateHUD();
} if (noticeUntil && now > noticeUntil) {
    $('notice').classList.remove('visible');
    noticeUntil = 0;
} if (!document.hidden && !$('help-dialog').open && (world.phase === 'playing' || world.phase === 'ready' && !reduced))
    raf = requestAnimationFrame(frame); }
function fatal(error) { cancelAnimationFrame(raf); raf = 0; clearInput(); root.dataset.phase = 'error'; for (const id of ['intro', 'hud', 'upgrade', 'paused', 'result', 'pause'])
    $(id).hidden = true; $('fallback').hidden = false; $('fallback-reason').textContent = error instanceof Error ? error.message : String(error); }
try {
    renderer = new RogueRenderer(canvas, $('battle-labels'), reduced);
    sync();
    updateHUD();
    on($('start'), 'click', start);
    on($('restart'), 'click', restart);
    on($('resume'), 'click', resume);
    on($('pause'), 'click', () => world.phase === 'paused' ? resume() : pause());
    on($('choices'), 'click', e => { const button = e.target.closest('.choice'); if (button) choose(button.dataset.upgrade); });
    on($('reroll'), 'click', () => { if (rerollUpgrades(world)) {
        sync();
        requestDraw();
    } });
    on($('dash'), 'click', () => { dashRun(world, movement()); consume(); canvas.focus({ preventScroll: true }); });
    on($('pulse'), 'click', () => { pulseRun(world); consume(); canvas.focus({ preventScroll: true }); });
    on($('sound'), 'click', async () => { try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio)
            throw new Error();
        if (!audio)
            audio = new Audio();
        if (!soundOn)
            await audio.resume();
        soundOn = !soundOn;
        $('sound').textContent = `音效 ${soundOn ? 'ON' : 'OFF'}`;
        $('sound').setAttribute('aria-pressed', String(soundOn));
        tone(523, .1);
    }
    catch {
        notice('音频暂不可用，可以继续无声游玩。');
    } if (world.phase === 'playing')
        canvas.focus({ preventScroll: true }); });
    on($('help'), 'click', () => { pause(); $('help-dialog').showModal(); $('close-help').focus(); });
    for (const id of ['close-help', 'help-done'])
        on($(id), 'click', () => $('help-dialog').close());
    on($('help-dialog'), 'close', requestDraw);
    on($('pixels'), 'click', () => { renderer.pixelSize = renderer.pixelSize === 2 ? 3 : 2; $('pixels').textContent = `PIXELS ×${renderer.pixelSize}`; requestDraw(); });
    const canOrbit = () => ['ready', 'playing'].includes(world.phase) && !$('help-dialog').open && root.dataset.phase !== 'error';
    function camera(action) { if (!canOrbit())
        return; if (action === 'reset')
        renderer.resetCamera();
    else if (action === 'left' || action === 'right')
        orbitCamera(renderer.camera, action === 'left' ? 80 : -80, 0);
    else
        zoomCamera(renderer.camera, action === 'in' ? -150 : 150); requestDraw(); canvas.focus({ preventScroll: true }); }
    for (const action of ['left', 'right', 'reset', 'in', 'out'])
        on($(`cam-${action}`), 'click', () => camera(action));
    on(window, 'keydown', e => {
        if ($('help-dialog').open)
            return;
        const modal = {upgrade: 'upgrade', paused: 'paused', won: 'result', lost: 'result'}[world.phase];
        if (e.key === 'Tab' && modal) {
            const buttons = [...$(modal).querySelectorAll('button:not(:disabled), a[href]')];
            const first = buttons[0], end = buttons[buttons.length - 1];
            if (e.shiftKey && (document.activeElement === first || !$(modal).contains(document.activeElement))) { e.preventDefault(); end?.focus(); }
            else if (!e.shiftKey && (document.activeElement === end || !$(modal).contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
        }
        if (world.phase === 'upgrade') {
            const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
            if (i >= 0 && !e.repeat) {
                e.preventDefault();
                choose(world.choices[i]);
            }
            return;
        }
        if (e.code === 'Escape') {
            if (world.phase === 'playing')
                pause();
            else
                resume();
            return;
        }
        if (world.phase !== 'playing' || e.target.closest?.('button,a,input,textarea,select'))
            return;
        if (['KeyQ', 'KeyR', 'KeyC'].includes(e.code)) {
            e.preventDefault();
            camera({ KeyQ: 'left', KeyR: 'right', KeyC: 'reset' }[e.code]);
            return;
        }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE'].includes(e.code)) {
            e.preventDefault();
            keys.add(e.code);
            if (!e.repeat && e.code === 'Space')
                dashRun(world, movement());
            if (!e.repeat && e.code === 'KeyE')
                pulseRun(world);
            consume();
        }
    });
    on(window, 'keyup', e => keys.delete(e.code));
    on(canvas, 'pointerdown', e => { if (!canOrbit() || orbit.id !== null || e.button !== 0)
        return; canvas.focus({ preventScroll: true }); orbit.id = e.pointerId; orbit.x = e.clientX; orbit.y = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.classList.add('orbiting'); });
    on(canvas, 'pointermove', e => { if (e.pointerId !== orbit.id || !canOrbit())
        return; orbitCamera(renderer.camera, e.clientX - orbit.x, e.clientY - orbit.y); orbit.x = e.clientX; orbit.y = e.clientY; requestDraw(); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        on(canvas, event, e => { if (e.pointerId === orbit.id)
            releaseOrbit(); });
    on(canvas, 'wheel', e => { if (!canOrbit() || e.ctrlKey)
        return; e.preventDefault(); zoomCamera(renderer.camera, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1)); requestDraw(); }, { passive: false });
    function moveStick(e) { if (e.pointerId !== stick.id)
        return; const r = $('joystick').getBoundingClientRect(); let x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; const length = Math.max(1, Math.hypot(x, y) / 35); x /= length; y /= length; stick.x = Math.abs(x) < 3 ? 0 : x / 35; stick.y = Math.abs(y) < 3 ? 0 : y / 35; $('knob').style.transform = `translate(${x}px, ${y}px)`; }
    on($('joystick'), 'pointerdown', e => { if (world.phase !== 'playing' || stick.id !== null)
        return; e.preventDefault(); stick.id = e.pointerId; $('joystick').setPointerCapture(e.pointerId); moveStick(e); });
    on($('joystick'), 'pointermove', moveStick);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        on($('joystick'), event, e => { if (e.pointerId === stick.id) {
            stick.id = null;
            stick.x = 0;
            stick.y = 0;
            $('knob').style.transform = 'translate(0, 0)';
        } });
    on(window, 'blur', () => { clearInput(); pause(); });
    on(document, 'visibilitychange', () => { if (document.hidden) {
        clearInput();
        pause();
        cancelAnimationFrame(raf);
        raf = 0;
    }
    else
        requestDraw(); });
    on(window, 'resize', requestDraw);
    on(canvas, 'webglcontextlost', e => { e.preventDefault(); fatal('图形上下文丢失，请重新加载页面。'); });
    on(window, 'pagehide', e => { cancelAnimationFrame(raf); raf = 0; clearInput(); pauseRun(world); if (!e.persisted) {
        abort.abort();
        renderer.destroy();
        audio?.close().catch(() => { });
    } });
    on(window, 'pageshow', e => { if (e.persisted) {
        sync();
        requestDraw();
    } });
    if (['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('test'))
        window.__rogue = { get state() { return world; }, get renderer() { return renderer; }, step(seconds) { for (let i = 0; i < seconds / STEP && world.phase === 'playing'; i++)
                advanceRun(world, STEP); consume(); sync(); updateHUD(); requestDraw(); } };
    requestDraw();
}
catch (error) {
    fatal(error);
}
