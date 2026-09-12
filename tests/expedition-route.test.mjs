import assert from 'node:assert/strict';
import test from 'node:test';
import { STOPS, routePoint, nearestLap, nearestStop, wheelTravel, screenPoint, worldPoint, distance, fitWorld } from '../src/expedition-route.ts';

test('closed route reaches every destination in either direction and across laps', () => {
    for (let lap = -3; lap <= 3; lap++) {
        STOPS.forEach((stop, index) => {
            assert.ok(distance(routePoint(index + lap * STOPS.length), stop) < 1e-8);
            assert.equal(nearestStop(stop), index);
        });
    }
    assert.ok(distance(routePoint(-0.00001), routePoint(0.00001)) < 1);
    for (let position = -8; position < 16; position += .07) {
        const point = routePoint(position);
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    }
});

test('direct navigation takes the nearest lap', () => {
    assert.equal(nearestLap(7.8, 0), 8);
    assert.ok(Math.abs(nearestLap(.1, 7) + 1) < 1e-10);
    for (let from = -20; from <= 20; from += .37) {
        STOPS.forEach((stop, index) => {
            const to = nearestLap(from, index);
            assert.ok(Math.abs(to - from) <= 4.00001);
            assert.ok(distance(routePoint(to), stop) < 1e-8);
        });
    }
});

test('wheel units normalize and large bursts remain bounded', () => {
    assert.equal(wheelTravel(48, 0, 800), wheelTravel(3, 1, 800));
    assert.equal(wheelTravel(200, 0, 800), wheelTravel(.25, 2, 800));
    assert.equal(wheelTravel(99999, 0, 800), .204);
    assert.equal(wheelTravel(-99999, 0, 800), -.204);
    assert.equal(wheelTravel(0, 0, 800), 0);
});

test('pointer coordinates round-trip on desktop and mobile', () => {
    for (const [width, height] of [[1440, 760], [390, 620], [740, 290]]) {
        const camera = { x: -450, y: 901 };
        const zoom = fitWorld(width, height);
        assert.ok(zoom > 0 && zoom <= .42);
        STOPS.forEach(stop => assert.ok(distance(worldPoint(screenPoint(stop, camera, zoom, width, height), camera, zoom, width, height), stop) < 1e-8));
    }
});
