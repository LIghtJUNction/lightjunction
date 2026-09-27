# TOKEN DRIFT

A small, playable voxel world at the site's front door. The courier gathers a cloud of tokens, restores three beacons, and returns home. The original portfolio, terminal, encrypted contact flow and Challenge II remain in `archive.html`; its initial contents are an exact copy of the previous homepage. Existing fragment links are forwarded to that archive. No challenge assets or cryptographic construction are changed.

## Play

Move with WASD / arrow keys, dash with Space, use the attraction pulse with E, and pause with Escape. Phones have a pointer-captured joystick and two ability buttons; simultaneous movement and ability input is supported. Sound is opt-in.

Tokens are collected by proximity. Consecutive pickups within three seconds build a multiplier up to x8. Beacons spend 12, 18 and 24 tokens once each and restore one shield point. Red noise can be avoided, dashed through, or broken with a pulse. Restore all three beacons, then return to the home island. There is no time limit; a quicker journey earns a bonus. Running out of shields ends the run. Replay starts a fresh world.

The seed fixes the terrain and collectible layout. Personal best and wins are stored locally, with malformed/denied storage handled. There is no account, remote leaderboard, API call, analytics, payment, or model-token consumption in the game.

## Implementation

- `src/token-drift/world.mjs`: deterministic, DOM-free simulation at a fixed 60 Hz step. Input, frame delta, movement bounds, cooldowns, damage immunity, one-time rewards, and end states are constrained here.
- `renderer.mjs`: actual 3D cubes with an orthographic camera, per-face lighting and depth. WebGL2 uses instanced batches for static terrain and dynamic objects. When WebGL2 cannot be obtained, the same geometry and camera are rendered as depth-sorted projected faces on Canvas2D. No model downloads, texture bundles, CDN libraries, or new package dependencies.
- `app.mjs`: scoped input, multi-pointer touch controls, native help dialog, optional synthesized chip sounds, local records and UI. Blur and hidden tabs pause gameplay. Paused/end screens stop the animation loop; resize or an explicit control redraws them. Reduced motion removes decorative movement and continuous title animation.
- `style.css`: warm paper, sage, muted coral, bitmap title and nearest-neighbor pixels. The cursor remains visible. Labels and controls stay crisp rather than being downsampled with the world.

`index.html` is the game, while `archive.html` loads the original terminal entry point. Vite builds both under the existing `/lightjunction/` base. Archive DOM/structure tests now load the archive, retaining their previous assertions. The challenge leak scan covers both HTML entries and the new game modules.

## Development and validation

```sh
npm ci
npm run dev
npm run test:game
npm run check
```

Open the Vite URL ending in `/lightjunction/`. Localhost with `?test` exposes a small `window.__tokenDrift` inspection hook for integration tests; that hook is absent on the public origin.

The initial change includes 16 Node tests covering deterministic generation, normalized movement, pickups/combo, cooldowns, damage, exact spending, full win conditions, replay and storage failures. Browser checks were performed at 1440x900, 390x844, 360x740 and 844x390, including touch cancellation, simultaneous movement/dash, dialogs, pause/focus, replay/results, reduced motion and unavailable canvas fallback. These checks used the software renderer because the test browser did not provide WebGL. They do not establish GPU performance or compatibility on every physical device. Test WebGL2 on real desktop and Android/iOS devices before making frame-rate claims.

For a manual regression: start, move and use both abilities; cancel an active touch; pause/resume; switch tabs; finish all beacons and return home; exhaust the shields and restart; disable storage; follow the portfolio and challenge links; repeat at narrow portrait and short landscape sizes.
