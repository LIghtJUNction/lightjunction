# THE JUNCTION — the website is the world

The index and the previous `archive.html` URL now mount one navigable overworld,
not a combat landing page followed by a scrolling portfolio. Projects, identity,
shaders, the command console, encrypted contact, and Challenge II are facilities
within that world. `frontier.html` hosts the original endless battle; `rogue.html`
remains a compatible battle address. Both return to the overworld.

## Interaction

Move with WASD/arrows or the touch stick. Click the ground to steer, click a
building label to travel and enter on arrival, E to enter a nearby facility,
Space to scan for fragments, Shift to accelerate, and M to open the world map.
The dock and map always offer direct travel; no content is gated on progress.
Escape closes a facility and returns keyboard focus to the world.

The garden holds three dialogue memories. The shipyard has four independently
rotatable circuits and the complete searchable synced project fleet. Completing
a circuit lights its project and adds a small moving ship to the world. The lab
keeps the original four interactive WebGL studies. The communications station
includes optional signal alignment followed by the original local encryption
flow, with an explicit GitHub handoff. The command console offers real world
navigation commands, not a pretend privileged shell. The border gate exposes
original battle records and the live building/unit/enemy/upgrade definitions.

42 collectible fragments, visits, memories and repaired docks are saved under
`lightjunction.world.v1`. They are purely local game state, never platform
credits. Storage errors produce a session-only world. No message, credential,
terminal input, or combat state is written into this save.

## Modules and preservation boundary

- `src/junction/world.mjs`: deterministic rules and validated versioned saves.
- `src/junction/scene.mjs`: low-resolution, depth-sorted voxel rendering in
  Canvas 2D. No new engine, image assets, external fonts, or CDN dependencies.
- `src/junction/app.mjs`: input, native-dialog lifecycle, routes and facilities.
- `src/junction/world.css`: the entire overworld and its instrument interfaces.
- `scripts/junction-site.mjs`: fail-closed extraction of the existing instrument
  markup during both Vite development and production builds.

`archive.html` remains the canonical **source** for protected content, not a
second portfolio UI. The Vite pre-transform replaces its public shell with the
same world used by index. The original `model`, `challenge-two`, and `shaders`
sections are preserved byte for byte in an instrument bank. Opening a facility
moves the actual node and closing it returns that node, preserving renderer
ownership. The crypto composer/results remain body siblings so their existing
focus/inert logic works. Challenge II artifacts, construction, public keys and
cryptographic implementations are not modified.

The original `index.html` battle markup is copied intact to `frontier.html`;
only its navigation chrome is transformed at build time. Old gameplay unit
tests continue exercising the unchanged simulations, with entry assertions
pointing to the new battle address.

## Verification

`npm run check` includes the new `token-drift-junction.test.mjs` rules tests and
rewritten `token-drift-archive.test.mjs` build-boundary tests. The latter compare
actual preserved sections exactly and assert removal of the old public shell.

Local offline Chromium checks exercise desktop 1440×900, touch portrait 390×844,
and touch landscape 844×390: world startup, circuit completion, navigation
commands, signal alignment, Escape focus restoration and station transitions.
Those isolated checks do not substitute for production-build shader or crypto
integration. CI remains responsible for the complete dependency/typecheck,
existing ciphertext validation, and Vite-build checks.
