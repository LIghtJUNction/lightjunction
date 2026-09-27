# TOKEN FRONTIER — endless defense

`index.html` and the existing `rogue.html` URL now launch the same endless game. There is no extraction or final wave. A run ends only when the base reaches zero HP. Every fifth wave contains another NULL boss; killing it never ends the run. The previous finite simulation modules remain solely for compatibility tests, not as active website entrypoints.

## Play loop

Build during the 12-second preparation window, command squads, fight as the flagship, collect experience, and choose one of three random upgrades. Clear the entire wave before the next preparation period. Enemies continue to scale with wave number. Flagship destruction costs the base 40 HP and triggers an eight-second respawn rather than immediately ending the run.

The local best-wave/score record is shared with the archive; it is not a saved run. Refreshing or leaving the page starts a new run. TK is fictional game currency, never API credit. No account, model calls or payments are involved.

## Tower defense and RTS

Five buildings: pulse turret, slowing node, area mortar, repair relay and token mine. Place snapped buildings inside the defense perimeter; overlapping buildings, base obstruction, insufficient funds and population caps are rejected before spending. Towers have three levels, paid repairs and one-time 55% invested-cost recycling. Flying units pass over structures: this is perimeter defense, not maze-building/path-blocking tower defense.

Three squad types: ranged scout, area siege unit and healing drone. The production queue reserves population and supports a full refund for the last queued item. Units obey move, attack-move and hold orders, maintain spaced destinations and can rally to a player-selected location. Enemies attack the base and nearby allies; sappers prioritize mines. The flagship retains automatic weapons, dash and a bullet-clearing pulse.

Seven ordinary enemy behaviours plus a recurring two-phase boss, periodic elites and split-on-death enemies. Eighteen capped upgrades cover individual weapons, survival, industry, allied firepower and base logistics. Experience, healing, shielding, haste, area bombs, vacuum pickups and upgrade chests remain functional.

Controls: WASD/arrows move the flagship; Space dashes; E pulses; 1–5 select buildings; F selects all squads; G moves, T attack-moves and H holds. Click/drag to select, Shift adds selection, right-click moves. Middle-drag or Q-drag pans the camera; wheel zooms. Touch uses a joystick, visible command buttons and tap destinations. Selecting a build/target command closes its drawer so short screens remain usable. Native upgrade/help dialogs and pause freeze the simulation. Hidden tabs pause automatically.

## The rest of the website

`archive.html` is no longer visually separate from the game. A shared Vite HTML pre-transform (`scripts/frontier-archive.mjs`) updates the original archive shell in both dev and production, while leaving the original articles, public challenge artifacts, secure composer and contact handlers intact. `src/frontier-archive.css` reskins the project workshop, live studies, terminal, correspondence, expedition map and exhibit overlays. The existing expedition destinations use the new archive/workshop/laboratory vocabulary, with their IDs, coordinates and direct links preserved.

The archive header links back to the game and shows the same local defense record. Its building/unit/enemy/upgrade codex imports the live game definitions rather than a duplicated catalogue. All articles and encrypted contact remain directly accessible without playing, paying or completing a challenge. Light/dark themes and reduced-motion support remain available.

## Boundaries and validation

Simulation: `frontier-world.mjs`. Procedural WebGL2/software 3D: `frontier-renderer.mjs`. Keyboard, pointer, touch and UI: `frontier-app.mjs`. Enemy/projectile/drop/effect/tower/unit caps bound long runs. Boss spawning retries at capacity. Swept projectile collisions prevent tunnelling. Spending and rewards reject replay in invalid states.

Run `npm run check` for the complete repository gate. New tests use the existing `tests/token-drift*.test.mjs` glob. They cover the endless loop, recurring bosses, economy, construction, repairs, queue refunds, unit orders, tower effects, enemy behaviours, upgrade pauses, storage denial, site entrypoints and archive preservation. The real archive-template test requires the full checkout (and runs in CI).

Local browser interaction checks use the actual application modules in an offline harness. Desktop, portrait and short-landscape checks include build placement, recruiting, orders, upgrades, pause, defeat and restart. The software 3D path was exercised; hardware WebGL was not available in that environment. Three ordinary-cost deterministic defense bots ran for 600 simulation seconds to waves 12–13 with two bosses each. This verifies progression, not final difficulty balance.
