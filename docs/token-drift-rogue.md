# TOKEN DRIFT: Rogue Run

The homepage offers **肉鸽战斗** (`rogue.html`) and the unchanged **云海漫游** mode. Portfolio, contact, cryptographic challenges and their deep links remain in `archive.html`.

## Run loop

Move while the main gun automatically targets nearby enemies. Collect XP, pause for a random three-choice upgrade, survive five 30-second waves, defeat the two-phase NULL boss, then return to the home island. A new run generates a fresh seed and clears all upgrades. Only best score and wins are stored locally; there is no account, network leaderboard, purchased item or API usage.

Six ordinary enemy behaviours: chase, fast chase, heavy armour, aimed ranged fire, telegraphed locked-direction charge, and splitting on death. Elite tanks appear in waves 3 and 5 and drop upgrade chests. NULL combines aimed spreads, telegraphed radial volleys, summons and a half-health rage phase.

Fifteen capped upgrades include damage, attack speed, multishot, piercing, critical hits, orbiting blades, chain lightning, area bombardment, kill healing, armour, regeneration, hull capacity, movement speed, magnet radius and dash cooldown. Pickups include XP, tokens, healing, temporary invulnerability, temporary double fire rate, XP vacuum, an area bomb and upgrade chests.

Optional exploration remains useful: tokens activate the three island beacons for healing and an upgrade. Twelve ordered flight gates refresh dash and grant score. Gate and bullet collisions use swept segments.

## Code boundaries

- `rogue-world.mjs`: seeded, DOM-free simulation, AI, projectiles, upgrades and storage helpers.
- `rogue-renderer.mjs`: procedural voxel meshes, an orbit camera, WebGL2 instancing and a software 3D fallback.
- `rogue-app.mjs`: fixed-step loop, keyboard/touch controls, audio and modal UI.
- `flight.mjs`: pure camera and gate math.

Entity limits: 90 live enemies, 220 projectiles (at most 150 hostile), 180 drops and 80 short-lived effects. Pauses, upgrade choices and terminal states freeze simulation. Health and ammunition cannot tick underneath an upgrade choice. Experience exceeding one level is retained for subsequent choices.

## Validation

Run `npm ci` and `npm run check`. `npm run test:game` includes the existing exploration tests and the new roguelike tests. The new tests cover seeds, collision tunnelling, all enemy behaviours and upgrades, loot, caps, boss-spawn retry, pause, queued levels, repeat rewards, extraction, restart and browser entrypoints.

Local Chromium interaction checks covered desktop, mobile two-finger move/orbit, touch upgrades, pause, help, victory, defeat, restart, landscape and reduced motion, with no JavaScript exceptions. These local browser checks exercised the software renderer; hardware WebGL rendering was not verified in that environment. Three deterministic movement/upgrade bots completed full runs without modifying starting health or damage. Those bots are a progression smoke test, not a claim that difficulty is fully balanced.
