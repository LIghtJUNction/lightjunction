import { createExhibit } from './exhibit.js';
import { drawWorld } from './expedition-renderer.js';
import { STOPS, clamp, distance, fitWorld, nearestLap, nearestStop, routePoint, screenPoint, wheelTravel, worldPoint, type Point } from './expedition-route.js';
import './expedition.css';

export function initExpedition(): void {
    const world = document.getElementById('explore');
    const canvas = document.querySelector<HTMLCanvasElement>('#world-canvas');
    const main = document.querySelector<HTMLElement>('.story-wall');
    const header = document.querySelector<HTMLElement>('.site-header');
    const toggle = document.querySelector<HTMLButtonElement>('#btn-reading');
    if (!world || !canvas || !main || !header || !toggle) return;
    const context = canvas.getContext('2d');
    if (!context) return; // The complete document remains usable without Canvas 2D.

    const labels = document.getElementById('world-stops')!;
    const dock = document.getElementById('world-dock')!;
    const title = document.getElementById('world-title')!;
    const note = document.getElementById('world-note')!;
    const count = document.getElementById('world-count')!;
    const enter = document.getElementById('world-enter')!;
    const announcement = document.getElementById('world-announcement')!;
    const art = document.getElementById('world-art')!;
    const mapButton = document.querySelector<HTMLButtonElement>('#world-map')!;
    const help = document.getElementById('world-help')!;
    const helpButton = document.querySelector<HTMLButtonElement>('#world-help-toggle')!;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const visited = new Set<number>([0]);
    const trail: Point[] = [];
    let enabled = false;
    let paused = false;
    let position = 0;
    let targetPosition = 0;
    let player: Point = routePoint(0);
    let camera: Point = { x: -160, y: 0 };
    let panTarget: Point = camera;
    let pointer: Point | null = null;
    let freeTarget: Point | null = null;
    let following = true;
    let overview = false;
    let zoom = .7;
    let width = 1, height = 1;
    let active = -1;
    let frame: number | null = null;
    let previousTime = 0;
    let pulse = 0;
    let readingScroll = 0;
    let gesture: { id: number; x: number; y: number; camera: Point; moved: boolean } | null = null;

    const stopAnimation = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null; previousTime = 0;
    };
    const schedule = () => {
        if (frame === null && enabled && !paused && !document.hidden) frame = requestAnimationFrame(render);
    };
    const rejoinRoute = () => {
        if (!freeTarget) return;
        position = targetPosition = nearestLap(position, nearestStop(player));
        freeTarget = null;
    };
    const travel = (index: number, relative = false) => {
        rejoinRoute();
        targetPosition = relative ? index : nearestLap(position, index);
        freeTarget = null; following = true; overview = false;
        world.classList.remove('is-overview');
        world.classList.add('has-travelled');
        mapButton.setAttribute('aria-pressed', 'false');
        pulse = 1;
        if (reduceMotion.matches) { position = targetPosition; player = routePoint(position); }
        schedule();
    };
    const exhibit = createExhibit({
        isExploring: () => enabled,
        onOpen: id => {
            const index = STOPS.findIndex(stop => stop.id === id);
            if (index >= 0) { visited.add(index); updateActive(index); }
            paused = true; stopAnimation();
        },
        onClose: () => { paused = false; schedule(); },
    });
    const stopButtons = STOPS.map((stop, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'world-stop';
        button.setAttribute('aria-label', `Open ${stop.title}`);
        const number = document.createElement('span');
        number.className = 'stop-number'; number.textContent = String(index + 1).padStart(2, '0');
        const name = document.createElement('span');
        name.className = 'stop-name'; name.textContent = stop.title;
        button.append(number, name);
        button.addEventListener('click', () => exhibit.open(stop.id, stop.title));
        labels.append(button);
        const shortcut = document.createElement('button');
        shortcut.type = 'button'; shortcut.textContent = number.textContent;
        shortcut.title = stop.title;
        shortcut.setAttribute('aria-label', `Travel to ${stop.title}`);
        shortcut.addEventListener('click', () => travel(index));
        dock.append(shortcut);
        return { button, shortcut };
    });

    function updateActive(index: number): void {
        const stop = STOPS[index]!;
        const changed = active !== index;
        active = index;
        if (changed) {
            title.textContent = stop.title;
            note.textContent = stop.note;
            enter.textContent = `${stop.action} ↗`;
            announcement.textContent = `Near ${stop.title}. Press Enter to open.`;
            document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]').forEach(link => {
                const selected = link.dataset.navLink === stop.id;
                link.classList.toggle('is-current', selected);
                if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
            });
        }
        count.textContent = `${String(visited.size).padStart(2, '0')} / 08 places found`;
        world!.classList.toggle('all-found', visited.size === STOPS.length);
        stopButtons.forEach(({ button, shortcut }, i) => {
            button.classList.toggle('is-near', i === index);
            button.classList.toggle('is-found', visited.has(i));
            shortcut.classList.toggle('is-found', visited.has(i));
            shortcut.setAttribute('aria-pressed', String(i === index));
        });
    }
    function render(time: number): void {
        frame = null;
        if (!enabled || paused || document.hidden) return;
        const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : 1 / 60;
        previousTime = time;
        const smooth = reduceMotion.matches ? 1 : 1 - Math.exp(-dt * 10);
        position += (targetPosition - position) * smooth;
        const destination = freeTarget ?? routePoint(position);
        player = { x: player.x + (destination.x - player.x) * smooth, y: player.y + (destination.y - player.y) * smooth };
        const targetZoom = overview ? fitWorld(width, height) : Math.min(.82, Math.max(.32, width / 1400));
        zoom += (targetZoom - zoom) * smooth;
        const targetCamera = overview ? { x: 510, y: 555 } : following ? { x: player.x - width * (width > 760 ? .13 : 0) / zoom, y: player.y + height * .055 / zoom } : panTarget;
        camera = { x: camera.x + (targetCamera.x - camera.x) * smooth, y: camera.y + (targetCamera.y - camera.y) * smooth };
        const index = nearestStop(player);
        const isNew = distance(player, STOPS[index]!) < 180 && !visited.has(index);
        if (isNew) { visited.add(index); pulse = 1; }
        if (index !== active || isNew) updateActive(index);
        if (!reduceMotion.matches) {
            if (!trail.length || distance(trail[trail.length - 1]!, player) > 3) trail.push({ ...player });
            if (trail.length > 75) trail.shift();
        }
        pulse = reduceMotion.matches ? 0 : Math.max(0, pulse - dt * .6);
        drawWorld(context!, { width, height, camera, zoom, player, time, reduced: reduceMotion.matches, overview, active, visited, trail, pulse, pointer });
        stopButtons.forEach(({ button }, i) => {
            const point = screenPoint(STOPS[i]!, camera, zoom, width, height);
            const outside = point.x < -120 || point.x > width + 120 || point.y < -50 || point.y > height + 50;
            button.hidden = outside;
            button.style.transform = `translate(${point.x.toFixed(1)}px, ${(point.y + (overview ? 0 : Math.max(35, 118 * zoom) + 28)).toFixed(1)}px) translate(-50%, -50%)`;
        });
        const origin = screenPoint(STOPS[0]!, camera, zoom, width, height);
        art.hidden = overview || origin.x < -250 || origin.x > width + 250 || origin.y < -250 || origin.y > height + 250;
        art.style.width = `${clamp(220 * zoom, 105, 190)}px`;
        art.style.transform = `translate(${(origin.x + (width <= 760 ? width * .22 : 0)).toFixed(1)}px, ${(origin.y - 80 * zoom).toFixed(1)}px) translate(-50%, -100%)`;
        if (!reduceMotion.matches) schedule();
    }
    function resize(): void {
        document.documentElement.style.setProperty('--explore-top', `${header!.getBoundingClientRect().height}px`);
        const bounds = canvas!.getBoundingClientRect();
        width = Math.max(bounds.width, 1); height = Math.max(bounds.height, 1);
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas!.width = Math.round(width * ratio); canvas!.height = Math.round(height * ratio);
        context!.setTransform(ratio, 0, 0, ratio, 0, 0);
        schedule();
    }
    function setEnabled(next: boolean): void {
        if (next === enabled) return;
        if (!next) exhibit.close(false);
        if (next) readingScroll = window.scrollY;
        enabled = next;
        world!.hidden = !next;
        main!.hidden = next;
        document.body.classList.toggle('exploring', next);
        toggle!.textContent = next ? 'Reading view' : 'Explore';
        toggle!.setAttribute('aria-pressed', String(next));
        if (next) {
            world!.setAttribute('role', 'main');
            window.scrollTo(0, 0); resize(); schedule();
        } else {
            world!.removeAttribute('role'); stopAnimation();
            history.replaceState(null, '', location.pathname + location.search);
            window.scrollTo(0, readingScroll);
        }
    }
    const moveAlong = (amount: number) => {
        rejoinRoute();
        targetPosition += amount;
        following = true; overview = false;
        world.classList.add('has-travelled'); world.classList.remove('is-overview');
        mapButton.setAttribute('aria-pressed', 'false');
        if (reduceMotion.matches) { position = targetPosition; player = routePoint(position); }
        schedule();
    };
    const toggleMap = () => {
        overview = !overview; following = true;
        world.classList.toggle('is-overview', overview);
        mapButton.setAttribute('aria-pressed', String(overview));
        world.classList.add('has-travelled'); schedule();
    };
    canvas.addEventListener('wheel', event => {
        if (!enabled || paused || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        moveAlong(wheelTravel(delta, event.deltaMode, height));
    }, { passive: false });
    canvas.addEventListener('keydown', event => {
        if (!enabled || paused || event.ctrlKey || event.metaKey || event.altKey) return;
        if (['ArrowRight', 'ArrowDown', 'd', 's'].includes(event.key)) { event.preventDefault(); moveAlong(.16); }
        else if (['ArrowLeft', 'ArrowUp', 'a', 'w'].includes(event.key)) { event.preventDefault(); moveAlong(-.16); }
        else if (event.key === 'Enter') { event.preventDefault(); const stop = STOPS[Math.max(0, active)]!; exhibit.open(stop.id, stop.title); }
        else if (event.key === ' ') { event.preventDefault(); pulse = 1; schedule(); }
        else if (event.key === 'Home') { event.preventDefault(); travel(0); }
        else if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleMap(); }
    });
    canvas.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: { ...camera }, moved: false };
    });
    canvas.addEventListener('pointermove', event => {
        const bounds = canvas.getBoundingClientRect();
        pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        if (!gesture || gesture.id !== event.pointerId) { schedule(); return; }
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (Math.hypot(dx, dy) > 6) gesture.moved = true;
        if (gesture.moved) {
            following = false; overview = false;
            world.classList.remove('is-overview'); world.classList.add('is-dragging', 'has-travelled');
            mapButton.setAttribute('aria-pressed', 'false');
            panTarget = { x: clamp(gesture.camera.x - dx / zoom, -2500, 3600), y: clamp(gesture.camera.y - dy / zoom, -1600, 2700) };
            camera = { ...panTarget }; schedule();
        }
    });
    canvas.addEventListener('pointerup', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        if (!gesture.moved) {
            const bounds = canvas.getBoundingClientRect();
            freeTarget = worldPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, camera, zoom, width, height);
            freeTarget = { x: clamp(freeTarget.x, -2300, 3300), y: clamp(freeTarget.y, -1400, 2500) };
            following = true; pulse = 1;
            world.classList.add('has-travelled');
        }
        gesture = null; world.classList.remove('is-dragging'); schedule();
    });
    const cancelGesture = () => { gesture = null; world.classList.remove('is-dragging'); };
    canvas.addEventListener('pointercancel', cancelGesture);
    canvas.addEventListener('lostpointercapture', cancelGesture);
    canvas.addEventListener('pointerleave', () => { pointer = null; schedule(); });
    document.getElementById('world-next')!.addEventListener('click', () => { rejoinRoute(); travel(Math.floor(targetPosition + .01) + 1, true); });
    document.getElementById('world-previous')!.addEventListener('click', () => { rejoinRoute(); travel(Math.ceil(targetPosition - .01) - 1, true); });
    document.getElementById('world-home')!.addEventListener('click', () => travel(0));
    document.getElementById('world-pulse')!.addEventListener('click', () => { pulse = 1; schedule(); });
    mapButton.addEventListener('click', toggleMap);
    helpButton.addEventListener('click', () => { help.hidden = !help.hidden; helpButton.setAttribute('aria-expanded', String(!help.hidden)); });
    enter.addEventListener('click', () => { const stop = STOPS[Math.max(active, 0)]!; exhibit.open(stop.id, stop.title); });
    toggle.addEventListener('click', () => setEnabled(!enabled));
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopAnimation(); else schedule(); });
    reduceMotion.addEventListener('change', () => { trail.length = 0; schedule(); });
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    new ResizeObserver(resize).observe(header);
    new ResizeObserver(resize).observe(world);
    toggle.hidden = false;
    setEnabled(true);
    updateActive(0);
    stopAnimation();
    render(performance.now());
    exhibit.fromLocation();
}
