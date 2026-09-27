import { ISLANDS, WORLD_LIMIT } from './world.mjs';
import { createCircuit, advanceCircuit } from './flight.mjs';
export const WAVE_SECONDS = 30, BOSS_WAVE = 6;
export const LIMITS = Object.freeze({ enemies: 90, bullets: 220, loot: 180, effects: 80 });
export const ENEMIES = Object.freeze({
    crawler: { name: '噪声虫', hp: 22, speed: 2.4, radius: .65, damage: 10, xp: 10, color: '#bd6555', shape: 'cross' },
    skitter: { name: '闪烁蜂', hp: 12, speed: 4.6, radius: .45, damage: 7, xp: 8, color: '#e4a557', shape: 'wing' },
    tank: { name: '防火墙', hp: 100, speed: 1.25, radius: 1.15, damage: 20, xp: 26, color: '#8c789a', shape: 'tank' },
    gunner: { name: '注入者', hp: 34, speed: 2, radius: .72, damage: 12, xp: 18, color: '#729b8c', shape: 'gun' },
    charger: { name: '断路冲锋者', hp: 42, speed: 2.6, radius: .8, damage: 18, xp: 20, color: '#e1794c', shape: 'arrow' },
    splitter: { name: '裂变体', hp: 55, speed: 1.8, radius: .9, damage: 12, xp: 24, color: '#b59b5e', shape: 'split' },
    boss: { name: 'NULL · 噪声核心', hp: 1400, speed: 1.6, radius: 2.2, damage: 25, xp: 150, color: '#b96b85', shape: 'boss' },
});
export const UPGRADES = Object.freeze([
    { id: 'damage', name: '超频核心', icon: '++', kind: '火力', max: 5, text: '主炮、环刃与技能伤害提高 25%。' },
    { id: 'rate', name: '并行时钟', icon: '>>', kind: '火力', max: 5, text: '主炮发射间隔缩短 16%。' },
    { id: 'multishot', name: '分叉编译', icon: 'Y', kind: '武器', max: 3, text: '主炮增加一发扇形弹，近距离可同时命中。' },
    { id: 'pierce', name: '穿透协议', icon: '→', kind: '武器', max: 3, text: '每发主炮额外穿透一个敌人。' },
    { id: 'crit', name: '幸运指针', icon: '!', kind: '火力', max: 4, text: '暴击率提高 10%，暴击造成双倍伤害。' },
    { id: 'orbit', name: '环刃阵列', icon: '◎', kind: '武器', max: 4, text: '增加一枚绕船旋转的环刃，近身持续切割。' },
    { id: 'chain', name: '链式闪电', icon: 'ϟ', kind: '武器', max: 4, text: '解锁或强化自动闪电，向附近多个敌人跳跃。' },
    { id: 'bomb', name: '爆裂缓存', icon: '✣', kind: '武器', max: 3, text: '定时轰击敌群；升级增加爆炸伤害与范围。' },
    { id: 'leech', name: '回收协议', icon: '+', kind: '生存', max: 3, text: '每击败一个敌人恢复 1 点生命。' },
    { id: 'armor', name: '冗余装甲', icon: '◇', kind: '生存', max: 4, text: '受到的伤害减少 12%，最高减少 48%。' },
    { id: 'regen', name: '热修复', icon: '~', kind: '生存', max: 3, text: '每秒自动恢复 1 点生命。' },
    { id: 'hull', name: '扩容舱', icon: '□', kind: '生存', max: 4, text: '最大生命增加 25，并立即恢复 25。' },
    { id: 'speed', name: '轻量引擎', icon: '↗', kind: '机动', max: 3, text: '移动速度提高 12%。' },
    { id: 'magnet', name: '引力索引', icon: 'U', kind: '机动', max: 3, text: '经验和道具的拾取半径增加 2。' },
    { id: 'dash', name: '相位穿梭', icon: '//', kind: '机动', max: 3, text: '冲刺冷却缩短 18%。' },
]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rng = w => { w.randomState = (Math.imul(w.randomState, 1664525) + 1013904223) >>> 0; return w.randomState / 4294967296; };
const emit = (w, type, data = {}) => { if (w.events.length < 100)
    w.events.push({ type, ...data }); };
const effect = (w, e) => { if (w.effects.length < LIMITS.effects)
    w.effects.push({ ...e, life: e.life ?? .3 }); };
export function createRun(seed = 271828) {
    const w = { seed: seed >>> 0, randomState: seed >>> 0, id: 0, phase: 'ready', time: 0, wave: 1, spawnClock: .9, bossSpawned: false, bossDefeated: false,
        player: { x: 0, z: 11, vx: 0, vz: 0, facing: Math.PI, hp: 100, maxHp: 100, invulnerable: 0, dash: 0, dashCooldown: 0, pulseCooldown: 0, haste: 0, dashId: 0 },
        enemies: [], bullets: [], loot: [], effects: [], events: [], upgrades: {}, choices: [], rerolls: 2, level: 1, xp: 0, xpNext: 24, kills: 0, score: 0, inventory: 0, collected: 0,
        attackClock: 0, chainClock: 0, bombClock: 0, pulse: 0, pulseOrigin: { x: 0, z: 0 }, beacons: ISLANDS.slice(1).map(b => ({ ...b, active: false })), circuit: createCircuit(ISLANDS) };
    for (const island of ISLANDS)
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2;
            w.loot.push({ id: ++w.id, kind: 'token', x: island.x + Math.cos(a) * 4, z: island.z + Math.sin(a) * 4, value: 1 });
        }
    return w;
}
export function startRun(w) { if (w.phase === 'ready')
    w.phase = 'playing'; }
export function pauseRun(w) { if (w.phase === 'playing')
    w.phase = 'paused'; }
export function resumeRun(w) { if (w.phase === 'paused')
    w.phase = 'playing'; }
export function stats(w) {
    const u = w.upgrades;
    return { damage: 12 * (1 + .25 * (u.damage || 0)), interval: Math.max(.1, .38 * .84 ** (u.rate || 0)) / (w.player.haste > 0 ? 2 : 1),
        speed: 7.5 * (1 + .12 * (u.speed || 0)), magnet: 3.2 + 2 * (u.magnet || 0), dashCooldown: 1.4 * .82 ** (u.dash || 0), armor: .12 * (u.armor || 0), crit: .05 + .1 * (u.crit || 0) };
}
export function offerUpgrades(w) {
    if (!['playing', 'upgrade'].includes(w.phase))
        return false;
    const pool = UPGRADES.filter(u => (w.upgrades[u.id] || 0) < u.max), choices = [];
    while (choices.length < 3 && pool.length) {
        const i = Math.floor(rng(w) * pool.length);
        choices.push(pool.splice(i, 1)[0].id);
    }
    if (!choices.length) {
        w.player.hp = w.player.maxHp;
        w.score += 250;
        return false;
    }
    w.choices = choices;
    w.phase = 'upgrade';
    emit(w, 'upgrade');
    return true;
}
function pendingLevel(w) { if (w.xp < w.xpNext || w.phase !== 'playing')
    return; w.xp -= w.xpNext; w.level++; w.xpNext = 24 + (w.level - 1) * 12; offerUpgrades(w); }
export function chooseUpgrade(w, id) {
    if (w.phase !== 'upgrade' || !w.choices.includes(id))
        return false;
    const item = UPGRADES.find(u => u.id === id);
    if (!item || (w.upgrades[id] || 0) >= item.max)
        return false;
    w.upgrades[id] = (w.upgrades[id] || 0) + 1;
    if (id === 'hull') {
        w.player.maxHp += 25;
        w.player.hp = Math.min(w.player.maxHp, w.player.hp + 25);
    }
    w.choices = [];
    w.phase = 'playing';
    emit(w, 'equipped', { id });
    pendingLevel(w);
    return true;
}
export function rerollUpgrades(w) { if (w.phase !== 'upgrade' || w.rerolls <= 0)
    return false; w.rerolls--; return offerUpgrades(w); }
export function spawnEnemy(w, type, x, z, elite = false) {
    const def = ENEMIES[type];
    if (!def || w.enemies.filter(e => !e.dead).length >= LIMITS.enemies)
        return null;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
        const a = rng(w) * Math.PI * 2, r = 15 + rng(w) * 6;
        x = clamp(w.player.x + Math.cos(a) * r, -32, 32);
        z = clamp(w.player.z + Math.sin(a) * r, -32, 32);
        if (Math.hypot(x - w.player.x, z - w.player.z) < 9) {
            x = clamp(w.player.x - Math.cos(a) * 14, -32, 32);
            z = clamp(w.player.z - Math.sin(a) * 14, -32, 32);
        }
    }
    const hp = def.hp * (type === 'boss' ? 1 : (1 + .14 * (w.wave - 1))) * (elite ? 2.5 : 1);
    const e = { id: ++w.id, type, x: clamp(x, -34, 34), z: clamp(z, -34, 34), hp, maxHp: hp, elite, radius: def.radius * (elite ? 1.2 : 1), telegraph: .75,
        cooldown: 1 + rng(w), windup: 0, charging: 0, aimX: 0, aimZ: 0, ringClock: 3, summonClock: 6, bladeClock: 0, flash: 0, dead: false, lastDash: -1 };
    w.enemies.push(e);
    return e;
}
function addLoot(w, kind, x, z, value = 1) { if (w.loot.length < LIMITS.loot)
    w.loot.push({ id: ++w.id, kind, x, z, value });
else if (kind === 'xp')
    w.xp += value; }
export function damageEnemy(w, e, damage) {
    if (w.phase !== 'playing' || e.dead || e.telegraph > 0 || !Number.isFinite(damage) || damage <= 0)
        return false;
    e.hp -= damage * (e.type === 'tank' ? .7 : 1);
    e.flash = .1;
    if (e.hp > 0)
        return false;
    e.dead = true;
    w.kills++;
    w.score += ENEMIES[e.type].xp * 5;
    addLoot(w, 'xp', e.x, e.z, ENEMIES[e.type].xp);
    effect(w, { kind: 'burst', x: e.x, z: e.z, radius: e.radius + 1, life: .35, color: ENEMIES[e.type].color });
    if (w.upgrades.leech)
        w.player.hp = Math.min(w.player.maxHp, w.player.hp + w.upgrades.leech);
    if (e.elite)
        addLoot(w, 'chest', e.x, e.z);
    else if (rng(w) < .13 && e.type !== 'boss') {
        const pool = ['heal', 'shield', 'bomb', 'magnet', 'haste'];
        addLoot(w, pool[Math.floor(rng(w) * pool.length)], e.x + .4, e.z);
    }
    if (e.type === 'splitter')
        for (const d of [-.8, .8])
            spawnEnemy(w, 'skitter', e.x + d, e.z + d);
    if (e.type === 'boss') {
        w.bossDefeated = true;
        w.score += 5000;
        w.enemies.forEach(n => { n.dead = true; });
        w.bullets = w.bullets.filter(b => b.friendly);
        emit(w, 'boss-down');
    }
    return true;
}
export function hurtPlayer(w, damage) { const p = w.player; if (w.phase !== 'playing' || !Number.isFinite(damage) || damage <= 0 || p.invulnerable > 0 || p.dash > 0)
    return false; p.hp = Math.max(0, p.hp - damage * (1 - stats(w).armor)); p.invulnerable = .7; emit(w, 'hit'); if (p.hp <= 0) {
    w.phase = 'lost';
    emit(w, 'lost');
} return true; }
export function dashRun(w, direction) { const p = w.player; if (w.phase !== 'playing' || p.dashCooldown > 0)
    return false; const n = direction ? Math.hypot(direction.x, direction.z) : 0; if (n > .1 && Number.isFinite(n))
    p.facing = Math.atan2(direction.x, direction.z); p.dash = .25; p.dashCooldown = stats(w).dashCooldown; p.invulnerable = Math.max(p.invulnerable, .32); p.dashId++; emit(w, 'dash'); return true; }
export function pulseRun(w) {
    const p = w.player;
    if (w.phase !== 'playing' || p.pulseCooldown > 0)
        return false;
    p.pulseCooldown = 6;
    w.pulse = .6;
    w.pulseOrigin = { x: p.x, z: p.z };
    for (const e of [...w.enemies])
        if (dist(e, p) < 8)
            damageEnemy(w, e, stats(w).damage * 2.5);
    for (const b of w.bullets)
        if (!b.friendly && dist(b, p) < 8)
            b.life = 0;
    effect(w, { kind: 'ring', x: p.x, z: p.z, radius: 8, life: .45, color: '#80b9aa' });
    emit(w, 'pulse');
    return true;
}
function projectile(w, x, z, dx, dz, friendly, damage, speed = 22, pierce = 0) { if (w.bullets.length >= LIMITS.bullets || (!friendly && w.bullets.filter(b => !b.friendly).length >= 150))
    return; const n = Math.hypot(dx, dz) || 1; w.bullets.push({ id: ++w.id, x, z, vx: dx / n * speed, vz: dz / n * speed, friendly, damage, life: friendly ? 1.15 : 5, pierce, hit: [] }); }
function area(w, x, z, r, damage, color = '#e8b06f') { effect(w, { kind: 'ring', x, z, radius: r, life: .4, color }); for (const e of [...w.enemies])
    if (dist(e, { x, z }) < r + e.radius)
        damageEnemy(w, e, damage); }
export function collectLoot(w, item) {
    if (w.phase !== 'playing' || item.taken)
        return false;
    item.taken = true;
    const p = w.player;
    if (item.kind === 'xp')
        w.xp += item.value;
    else if (item.kind === 'token') {
        w.inventory += item.value;
        w.collected += item.value;
        w.xp += 2;
        w.score += 10;
    }
    else if (item.kind === 'heal')
        p.hp = Math.min(p.maxHp, p.hp + 30);
    else if (item.kind === 'shield')
        p.invulnerable = Math.max(p.invulnerable, 4);
    else if (item.kind === 'haste')
        p.haste = 10;
    else if (item.kind === 'bomb')
        area(w, p.x, p.z, 14, 100);
    else if (item.kind === 'magnet') {
        for (const l of w.loot)
            if (!l.taken && l.kind === 'xp') {
                l.taken = true;
                w.xp += l.value;
            }
    }
    else if (item.kind === 'chest')
        offerUpgrades(w);
    if (!['xp', 'token'].includes(item.kind))
        emit(w, 'pickup', { kind: item.kind });
    return true;
}
function enemiesStep(w, dt) {
    const p = w.player;
    for (const e of [...w.enemies]) {
        if (e.dead)
            continue;
        e.telegraph = Math.max(0, e.telegraph - dt);
        e.flash = Math.max(0, e.flash - dt);
        e.bladeClock = Math.max(0, e.bladeClock - dt);
        if (e.telegraph > 0)
            continue;
        const def = ENEMIES[e.type], d = dist(e, p) || .01, nx = (p.x - e.x) / d, nz = (p.z - e.z) / d;
        e.cooldown -= dt;
        let speed = def.speed * (e.elite ? 1.15 : 1), mx = nx, mz = nz;
        if (e.type === 'gunner') {
            const move = d > 12 ? 1 : d < 8 ? -1 : 0;
            mx *= move;
            mz *= move;
            if (e.windup > 0) {
                e.windup -= dt;
                mx = 0;
                mz = 0;
                if (e.windup <= 0) {
                    projectile(w, e.x, e.z, e.aimX, e.aimZ, false, def.damage, 8);
                    e.cooldown = 2.4;
                }
            }
            else if (e.cooldown <= 0) {
                e.windup = .65;
                e.aimX = nx;
                e.aimZ = nz;
            }
        }
        if (e.type === 'charger') {
            if (e.charging > 0) {
                e.charging -= dt;
                speed = 15;
                mx = e.aimX;
                mz = e.aimZ;
            }
            else if (e.windup > 0) {
                e.windup -= dt;
                speed = 0;
                if (e.windup <= 0) {
                    e.charging = .6;
                    e.cooldown = 3;
                }
            }
            else if (e.cooldown <= 0) {
                e.windup = .8;
                e.aimX = nx;
                e.aimZ = nz;
                speed = 0;
            }
        }
        if (e.type === 'boss') {
            const rage = e.hp < e.maxHp * .5;
            mx = d > 11 ? nx : 0;
            mz = d > 11 ? nz : 0;
            e.ringClock -= dt;
            e.summonClock -= dt;
            if (e.cooldown <= 0) {
                for (const a of [-.2, 0, .2])
                    projectile(w, e.x, e.z, nx * Math.cos(a) - nz * Math.sin(a), nx * Math.sin(a) + nz * Math.cos(a), false, 12, 8);
                e.cooldown = rage ? .65 : 1.15;
            }
            if (e.ringClock <= 0 && e.windup <= 0) {
                e.windup = .9;
            }
            if (e.windup > 0) {
                e.windup -= dt;
                if (e.windup <= 0) {
                    const n = rage ? 18 : 12;
                    for (let i = 0; i < n; i++) {
                        const a = i / n * Math.PI * 2 + w.time * .3;
                        projectile(w, e.x, e.z, Math.sin(a), Math.cos(a), false, 15, 6);
                    }
                    e.ringClock = rage ? 2.5 : 4;
                }
            }
            if (e.summonClock <= 0) {
                for (let i = 0; i < (rage ? 3 : 2); i++)
                    spawnEnemy(w, 'skitter', e.x + (i - 1) * 2, e.z - 3);
                e.summonClock = 6;
            }
        }
        e.x = clamp(e.x + mx * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
        e.z = clamp(e.z + mz * speed * dt, -WORLD_LIMIT, WORLD_LIMIT);
        if (dist(e, p) < e.radius + .65) {
            if (p.dash > 0 && e.lastDash !== p.dashId) {
                e.lastDash = p.dashId;
                damageEnemy(w, e, stats(w).damage * 2.5);
            }
            else
                hurtPlayer(w, def.damage);
        }
        if (w.phase !== 'playing')
            return;
    }
}
function weaponsStep(w, dt) {
    const p = w.player, s = stats(w), targets = w.enemies.filter(e => !e.dead && e.telegraph <= 0).sort((a, b) => dist(a, p) - dist(b, p));
    w.attackClock -= dt;
    w.chainClock -= dt;
    w.bombClock -= dt;
    const target = targets.find(e => dist(e, p) < 17);
    if (target && w.attackClock <= 0) {
        const a = Math.atan2(target.x - p.x, target.z - p.z), count = 1 + (w.upgrades.multishot || 0);
        for (let i = 0; i < count; i++) {
            const angle = a + (i - (count - 1) / 2) * .16;
            projectile(w, p.x, p.z, Math.sin(angle), Math.cos(angle), true, s.damage * (rng(w) < s.crit ? 2 : 1), 24, w.upgrades.pierce || 0);
        }
        w.attackClock = s.interval;
        emit(w, 'shot');
    }
    if (target && w.upgrades.chain && w.chainClock <= 0) {
        let node = p;
        const visited = new Set();
        for (let i = 0; i < w.upgrades.chain + 2; i++) {
            const next = targets.find(e => !e.dead && !visited.has(e.id) && dist(node, e) < (node === p ? 15 : 8));
            if (!next)
                break;
            visited.add(next.id);
            effect(w, { kind: 'beam', x: node.x, z: node.z, tx: next.x, tz: next.z, life: .22, color: '#8cacb4' });
            damageEnemy(w, next, s.damage * (1 + .4 * w.upgrades.chain));
            node = next;
        }
        w.chainClock = 2;
    }
    if (target && w.upgrades.bomb && w.bombClock <= 0) {
        area(w, target.x, target.z, 2.5 + w.upgrades.bomb * .6, s.damage * (2 + w.upgrades.bomb));
        w.bombClock = 3.5;
    }
    for (let i = 0; i < (w.upgrades.orbit || 0); i++) {
        const a = w.time * 3 + i / (w.upgrades.orbit || 1) * Math.PI * 2, blade = { x: p.x + Math.sin(a) * 3, z: p.z + Math.cos(a) * 3 };
        for (const e of targets)
            if (!e.dead && e.bladeClock <= 0 && dist(e, blade) < e.radius + .7) {
                damageEnemy(w, e, s.damage * .8);
                e.bladeClock = .32;
            }
    }
}
/** Swept projectile collision prevents tunnelling at low frame rates. */
export function segmentDistance(a, b, p) { const dx = b.x - a.x, dz = b.z - a.z, n = dx * dx + dz * dz, t = n ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / n, 0, 1) : 0; return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z); }
function bulletsStep(w, dt) { for (const b of w.bullets) {
    if (b.life <= 0)
        continue;
    const from = { x: b.x, z: b.z };
    b.life -= dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (b.friendly) {
        for (const e of w.enemies) {
            if (e.dead || e.telegraph > 0 || b.hit.includes(e.id) || segmentDistance(from, b, e) > e.radius + .2)
                continue;
            b.hit.push(e.id);
            damageEnemy(w, e, b.damage);
            if (b.pierce-- <= 0) {
                b.life = 0;
                break;
            }
        }
    }
    else if (segmentDistance(from, b, w.player) < .7) {
        hurtPlayer(w, b.damage);
        b.life = 0;
    }
    if (w.phase !== 'playing')
        return;
} w.bullets = w.bullets.filter(b => b.life > 0 && Math.abs(b.x) < 45 && Math.abs(b.z) < 45); }
export function advanceRun(w, dt, input = { x: 0, z: 0 }) {
    if (w.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0)
        return;
    dt = Math.min(.05, dt);
    const p = w.player, s = stats(w), from = { x: p.x, z: p.z };
    w.time += dt;
    for (const key of ['invulnerable', 'dashCooldown', 'pulseCooldown', 'haste'])
        p[key] = Math.max(0, p[key] - dt);
    w.pulse = Math.max(0, w.pulse - dt);
    p.hp = Math.min(p.maxHp, p.hp + (w.upgrades.regen || 0) * dt);
    let ix = Number.isFinite(input.x) ? input.x : 0, iz = Number.isFinite(input.z) ? input.z : 0;
    const len = Math.max(1, Math.hypot(ix, iz));
    ix /= len;
    iz /= len;
    if (p.dash > 0) {
        p.vx = Math.sin(p.facing) * 25;
        p.vz = Math.cos(p.facing) * 25;
    }
    else {
        const a = 1 - Math.exp(-12 * dt);
        p.vx += (ix * s.speed - p.vx) * a;
        p.vz += (iz * s.speed - p.vz) * a;
        if (Math.hypot(p.vx, p.vz) > .3)
            p.facing = Math.atan2(p.vx, p.vz);
    }
    p.x = clamp(p.x + p.vx * dt, -WORLD_LIMIT, WORLD_LIMIT);
    p.z = clamp(p.z + p.vz * dt, -WORLD_LIMIT, WORLD_LIMIT);
    const wave = Math.min(BOSS_WAVE, Math.floor(w.time / WAVE_SECONDS) + 1);
    if (wave !== w.wave) {
        w.wave = wave;
        emit(w, 'wave', { wave });
        if ([3, 5].includes(wave))
            spawnEnemy(w, 'tank', undefined, undefined, true);
    }
    if (!w.bossDefeated) {
        if (w.wave >= BOSS_WAVE && !w.bossSpawned) {
            w.bossSpawned = !!spawnEnemy(w, 'boss');
            if (w.bossSpawned)
                emit(w, 'boss');
        }
        w.spawnClock -= dt;
        if (w.spawnClock <= 0) {
            const pool = ['crawler', 'skitter'];
            if (w.wave >= 2)
                pool.push('gunner');
            if (w.wave >= 3)
                pool.push('charger', 'tank');
            if (w.wave >= 4)
                pool.push('splitter');
            if (w.wave < BOSS_WAVE)
                spawnEnemy(w, pool[Math.floor(rng(w) * pool.length)]);
            w.spawnClock = Math.max(.28, 1.2 - w.wave * .15);
        }
    }
    enemiesStep(w, dt);
    if (w.phase !== 'playing')
        return;
    weaponsStep(w, dt);
    bulletsStep(w, dt);
    if (w.phase !== 'playing')
        return;
    advanceCircuit(w, from, dt);
    p.dash = Math.max(0, p.dash - dt);
    for (const l of w.loot) {
        if (l.taken)
            continue;
        const d = dist(l, p), radius = w.pulse > 0 ? 10 : s.magnet;
        if (d < radius && d > .01) {
            const step = Math.min(d, dt * (l.kind === 'token' ? 8 : 14));
            l.x += (p.x - l.x) / d * step;
            l.z += (p.z - l.z) / d * step;
        }
        if (dist(l, p) < 1.1) {
            collectLoot(w, l);
            if (w.phase !== 'playing')
                break;
        }
    }
    w.loot = w.loot.filter(l => !l.taken);
    w.enemies = w.enemies.filter(e => !e.dead);
    w.effects = w.effects.filter(e => (e.life -= dt) > 0);
    if (w.phase !== 'playing')
        return;
    for (const b of w.beacons)
        if (!b.active && dist(b, p) < 2 && w.inventory >= b.cost) {
            w.inventory -= b.cost;
            b.active = true;
            p.hp = Math.min(p.maxHp, p.hp + 30);
            w.score += 500;
            emit(w, 'beacon');
            offerUpgrades(w);
            return;
        }
    if (w.bossDefeated && dist(p, ISLANDS[0]) < 3) {
        w.phase = 'won';
        w.score += 2000;
        emit(w, 'won');
        return;
    }
    pendingLevel(w);
}
export function readRogueRecord(storage) { try {
    const r = JSON.parse(storage.getItem('lightjunction.rogue.v1') || '{}');
    return { best: Number.isSafeInteger(r?.best) && r.best > 0 ? Math.min(r.best, 99999999) : 0, wins: Number.isSafeInteger(r?.wins) && r.wins > 0 ? Math.min(r.wins, 999999) : 0 };
}
catch {
    return { best: 0, wins: 0 };
} }
export function saveRogueRecord(storage, record, w) { const next = { best: Math.max(record.best, w.score), wins: record.wins + (w.phase === 'won' ? 1 : 0) }; try {
    storage.setItem('lightjunction.rogue.v1', JSON.stringify(next));
}
catch { } return next; }
