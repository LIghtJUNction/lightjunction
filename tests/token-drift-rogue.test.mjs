import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, startRun, advanceRun, spawnEnemy, damageEnemy, hurtPlayer, offerUpgrades, chooseUpgrade, rerollUpgrades, collectLoot, dashRun, pulseRun, pauseRun, resumeRun, stats, UPGRADES, ENEMIES, LIMITS, segmentDistance, readRogueRecord, saveRogueRecord } from '../src/token-drift/rogue-world.mjs';
import { screenMovement, cameraDirection, orbitCamera, zoomCamera, createCircuit, crossedGate, advanceCircuit } from '../src/token-drift/flight.mjs';
import { ISLANDS } from '../src/token-drift/world.mjs';
const run = () => { const w = createRun(17); startRun(w); w.loot = []; w.spawnClock = 9999; return w; };
const tick = (w, n = 1, input) => { for (let i = 0; i < n * 60; i++)
    advanceRun(w, 1 / 60, input); };
const enemy = (w, type = 'crawler', x = 4, z = 11) => { const e = spawnEnemy(w, type, x, z); e.telegraph = 0; return e; };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('seed is reproducible and changes random choices', () => { assert.deepEqual(createRun(3), createRun(3)); const a = run(), b = run(); b.randomState = 999; offerUpgrades(a); offerUpgrades(b); assert.notDeepEqual(a.choices, b.choices); });
test('ready, pause, upgrade and terminal phases freeze every simulation field', () => { for (const phase of ['ready', 'paused', 'upgrade', 'won', 'lost']) {
    const w = run();
    w.phase = phase;
    const s = structuredClone(w);
    advanceRun(w, 1, { x: 1, z: 1 });
    assert.equal(dashRun(w), false);
    assert.equal(pulseRun(w), false);
    assert.deepEqual(w, s);
} });
test('movement is finite, diagonal-normalized and bounded', () => { const a = run(), b = run(); tick(a, 1, { x: 1, z: 0 }); tick(b, 1, { x: 1, z: 1 }); close(Math.hypot(a.player.x, a.player.z - 11), Math.hypot(b.player.x, b.player.z - 11)); tick(a, 10, { x: 100, z: Infinity }); assert.ok(a.player.x <= 34); advanceRun(a, NaN, { x: NaN }); assert.ok(Number.isFinite(a.player.x)); });
test('enemies spawn with readable invulnerable telegraphs and distinct definitions', () => { const w = run(); assert.equal(Object.keys(ENEMIES).length, 7); const e = spawnEnemy(w, 'crawler', 0, 11); assert.equal(damageEnemy(w, e, 999), false); assert.equal(e.hp, e.maxHp); advanceRun(w, .05); assert.equal(w.player.hp, 100); });
test('automatic main gun kills enemies without firing input', () => { const w = run(), e = enemy(w, 'crawler'); tick(w, 1.5); assert.ok(e.dead); assert.ok(w.kills > 0); assert.ok(w.xp > 0 || w.loot.some(l => l.kind === 'xp')); });
test('piercing uses swept collisions and never hits one enemy twice', () => { const w = run(), e = enemy(w, 'tank', .5, 11); w.attackClock = 99; w.bullets.push({ id: 1, x: 0, z: 11, vx: 100, vz: 0, life: 2, damage: 10, friendly: true, pierce: 3, hit: [] }); advanceRun(w, .05); const hp = e.hp; assert.ok(hp < e.maxHp); advanceRun(w, .01); assert.equal(e.hp, hp); close(segmentDistance({ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 5, z: 1 }), 1); });
test('death rewards, experience and split children occur only once', () => { const w = run(), e = enemy(w, 'splitter'); assert.equal(damageEnemy(w, e, 999), true); const score = w.score, kills = w.kills; assert.equal(damageEnemy(w, e, 999), false); assert.equal(w.score, score); assert.equal(w.kills, kills); assert.equal(w.enemies.filter(n => n.type === 'skitter').length, 2); });
test('spawn and projectile population are bounded', () => { const w = run(); for (let i = 0; i < 150; i++)
    spawnEnemy(w, 'crawler', 20, 20); assert.equal(w.enemies.length, LIMITS.enemies); assert.equal(spawnEnemy(w, 'boss'), null); });
test('boss spawn retries when the enemy cap previously prevented it', () => { const w = run(); for (let i = 0; i < LIMITS.enemies; i++)
    spawnEnemy(w, 'crawler', 20, 20); w.time = 150; advanceRun(w, .01); assert.equal(w.bossSpawned, false); w.enemies.pop(); advanceRun(w, .01); assert.equal(w.bossSpawned, true); assert.ok(w.enemies.some(e => e.type === 'boss')); });
test('gunner shoots, charger locks a dash, and boss emits radial patterns', () => {
    const w = run();
    w.player.invulnerable = 999;
    const g = enemy(w, 'gunner', 12, 11);
    g.cooldown = 0;
    tick(w, .8);
    assert.ok(w.bullets.some(b => !b.friendly));
    const c = enemy(w, 'charger', -12, 11);
    c.cooldown = 0;
    advanceRun(w, .01);
    assert.ok(c.windup > 0);
    const aim = c.aimX;
    w.player.z = 30;
    tick(w, .82);
    assert.equal(c.aimX, aim);
    assert.ok(c.charging > 0);
    const boss = enemy(w, 'boss', 20, 20);
    boss.ringClock = 0;
    tick(w, 1);
    assert.ok(w.bullets.filter(b => !b.friendly).length >= 12);
});
test('damage cooldown and dash immunity prevent contact damage spam', () => { const w = run(); hurtPlayer(w, 10); assert.equal(w.player.hp, 90); hurtPlayer(w, 10); assert.equal(w.player.hp, 90); w.player.invulnerable = 0; dashRun(w, { x: 1, z: 0 }); hurtPlayer(w, 50); assert.equal(w.player.hp, 90); assert.equal(dashRun(w), false); });
test('pulse clears hostile bullets, hurts nearby enemies, and respects cooldown', () => { const w = run(), e = enemy(w, 'tank'); w.bullets = [{ friendly: false, x: 1, z: 11, life: 3 }]; assert.equal(pulseRun(w), true); assert.ok(e.hp < e.maxHp); assert.equal(w.bullets[0].life, 0); assert.equal(pulseRun(w), false); });
test('offered upgrades are three distinct non-maxed choices', () => { const w = run(); w.upgrades.damage = 5; offerUpgrades(w); assert.equal(w.choices.length, 3); assert.equal(new Set(w.choices).size, 3); assert.ok(!w.choices.includes('damage')); assert.equal(chooseUpgrade(w, 'unknown'), false); });
test('upgrade clicks cannot be replayed and rerolls are bounded', () => { const w = run(); offerUpgrades(w); assert.ok(rerollUpgrades(w)); assert.ok(rerollUpgrades(w)); assert.equal(rerollUpgrades(w), false); const choice = w.choices[0]; assert.ok(chooseUpgrade(w, choice)); assert.equal(chooseUpgrade(w, choice), false); assert.equal(w.upgrades[choice], 1); });
test('banked XP survives multiple queued level-ups and no maxed upgrade traps the run', () => {
    const w = run();
    w.xp = 200;
    advanceRun(w, .01);
    assert.equal(w.phase, 'upgrade');
    const xp = w.xp;
    chooseUpgrade(w, w.choices[0]);
    assert.equal(w.phase, 'upgrade');
    assert.ok(w.xp < xp);
    while (w.phase === 'upgrade')
        chooseUpgrade(w, w.choices[0]);
    assert.ok(w.level >= 4);
    for (const u of UPGRADES)
        w.upgrades[u.id] = u.max;
    w.player.hp = 1;
    assert.equal(offerUpgrades(w), false);
    assert.equal(w.phase, 'playing');
    assert.equal(w.player.hp, w.player.maxHp);
});
test('every upgrade is selectable and changes a capped, finite build', () => { for (const u of UPGRADES) {
    const w = run();
    for (let i = 0; i < u.max; i++) {
        w.phase = 'upgrade';
        w.choices = [u.id];
        assert.ok(chooseUpgrade(w, u.id));
    }
    w.phase = 'upgrade';
    w.choices = [u.id];
    assert.equal(chooseUpgrade(w, u.id), false);
    for (const value of Object.values(stats(w)))
        assert.ok(Number.isFinite(value));
} });
test('new weapon modules actually deal damage', () => { for (const type of ['orbit', 'chain', 'bomb']) {
    const w = run();
    w.upgrades[type] = 1;
    w.attackClock = 999;
    const e = enemy(w, 'tank', type === 'orbit' ? 0 : 5, type === 'orbit' ? 14 : 11);
    const hp = e.hp;
    tick(w, .2);
    assert.ok(e.hp < hp, type);
} });
test('pickups heal, shield, overclock, attract XP, explode, and open chests', () => {
    for (const kind of ['heal', 'shield', 'haste', 'magnet', 'bomb', 'chest']) {
        const w = run();
        w.player.hp = 40;
        const e = enemy(w, 'crawler', 5, 11);
        w.loot.push({ kind: 'xp', x: 30, z: 30, value: 20 });
        const item = { kind, x: 0, z: 11, value: 1 };
        assert.ok(collectLoot(w, item));
        assert.equal(collectLoot(w, item), false);
        if (kind === 'heal')
            assert.equal(w.player.hp, 70);
        if (kind === 'shield')
            assert.equal(w.player.invulnerable, 4);
        if (kind === 'haste')
            assert.equal(w.player.haste, 10);
        if (kind === 'magnet')
            assert.equal(w.xp, 20);
        if (kind === 'bomb')
            assert.ok(e.dead);
        if (kind === 'chest')
            assert.equal(w.phase, 'upgrade');
    }
});
test('elite drops a chest and beacon currency is spent once', () => { const w = run(), e = enemy(w, 'tank'); e.elite = true; damageEnemy(w, e, 999); assert.ok(w.loot.some(l => l.kind === 'chest')); w.loot = []; w.inventory = 12; Object.assign(w.player, { x: -15, z: -4 }); advanceRun(w, .01); assert.ok(w.beacons[0].active); assert.equal(w.inventory, 0); chooseUpgrade(w, w.choices[0]); advanceRun(w, .01); assert.equal(w.inventory, 0); });
test('boss death opens extraction, and victory / death / restart are complete states', () => { const w = run(), boss = enemy(w, 'boss'); w.bossSpawned = true; damageEnemy(w, boss, 99999); assert.ok(w.bossDefeated); assert.equal(w.phase, 'playing'); Object.assign(w.player, { x: 0, z: 8 }); advanceRun(w, .01); assert.equal(w.phase, 'won'); const score = w.score; tick(w, 1); assert.equal(w.score, score); const fresh = createRun(77); assert.equal(fresh.level, 1); assert.deepEqual(fresh.upgrades, {}); const dead = run(); hurtPlayer(dead, 1000); assert.equal(dead.phase, 'lost'); });
test('pause and resume preserve battle timers', () => { const w = run(); tick(w, .2); pauseRun(w); const snapshot = structuredClone(w); tick(w, 3); assert.deepEqual(w, snapshot); resumeRun(w); tick(w, .2); assert.ok(w.time > snapshot.time); });
test('storage denial and corrupt records cannot prevent a run', () => { for (const data of ['broken', 'null', '[]', '{"best":-1,"wins":"hi"}'])
    assert.deepEqual(readRogueRecord({ getItem: () => data }), { best: 0, wins: 0 }); assert.equal(saveRogueRecord(null, { best: 1, wins: 0 }, { score: 2, phase: 'won' }).wins, 1); });
test('screen-relative movement remains orthogonal across camera angles', () => { for (let a = 0; a < 6.28; a += .3) {
    const x = screenMovement(1, 0, a), y = screenMovement(0, 1, a);
    close(x.x * y.x + x.z * y.z, 0);
    close(Math.hypot(...cameraDirection(a, .6)), 1);
    close(Math.hypot(...Object.values(screenMovement(1, 1, a))), 1);
} const c = { yaw: 0, pitch: .6, zoom: 1 }; orbitCamera(c, 9999, 9999); assert.equal(c.pitch, 1.2); for (let i = 0; i < 10; i++)
    zoomCamera(c, 500); assert.equal(c.zoom, 1.6); });
test('twelve gates use directional swept crossing and reward each only once', () => { const w = run(), g = w.circuit.gates[0], p = d => ({ x: g.x + g.nx * d, z: g.z + g.nz * d }); assert.equal(createCircuit(ISLANDS).gates.length, 12); assert.ok(crossedGate(p(-5), p(5), g)); assert.equal(crossedGate(p(5), p(-5), g), false); Object.assign(w.player, p(1)); advanceCircuit(w, p(-1), .05); assert.equal(w.circuit.next, 1); const score = w.score; advanceCircuit(w, p(-1), .05); assert.equal(w.score, score); });

test('battle entry is built alongside the preserved homepage and archive', async () => {
    const {readFile} = await import('node:fs/promises');
    const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const html = await read('rogue.html'), index = await read('index.html'), config = await read('vite.config.ts');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ['battle-world','start','upgrade','choices','reroll','paused','result','restart','fallback','joystick']) assert.ok(ids.includes(id));
    assert.ok(html.includes('aria-modal="true"'));
    assert.ok(index.includes('href="./rogue.html"'));
    assert.ok(index.includes('id="start-button"'));
    assert.ok(config.includes("rogue: 'rogue.html'"));
    assert.ok(config.includes("archive: 'archive.html'"));
});
