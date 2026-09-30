# Token cloud personal site

The public site is a single personal introduction, not a game launcher or a directory of old websites. Original game, archive, challenge, crypto and README sources remain in Git. Only `index.html`, its imported assets and the two published public-contact-key downloads enter the production build. Other repositories are untouched.

## Design and interaction

Paper white, ink black and lime; editorial typography; a native-scrolling, three-stage story. A procedurally modeled cloud of code-bearing cuboids separates into five strata and resolves into an extruded LJ monogram. Pointer parallax, a temporary scatter action and a pause control accompany the scene. Projects and contact details remain ordinary semantic HTML, independent of graphics or JavaScript.

`site/token-cloud.mjs` keeps deterministic geometry and rendering separate from `site/site.mjs`, which owns scroll, visibility and accessibility state. WebGL2 uses instanced cuboids and vertex-shader morph targets. Canvas2D fallback projects and depth-sorts the same 3D model with visible-face shading and code textures. No model download, runtime CDN, web font, tracker or API request is needed.

Reduced-motion preferences select discrete model states; pause stops ambient motion. Rendering stops when the story is offscreen or the document is hidden. Pixel ratio and particle count are bounded on mobile. If neither renderer is available, a static illustration and all textual content remain. Clipboard denial exposes the real email instead of reporting success.

## Public source material

- https://github.com/LIghtJUNction
- https://github.com/LIghtJUNction/lightjunction
- https://github.com/LIghtJUNction/cortexfs
- https://github.com/LIghtJUNction/MagicNet
- https://github.com/LIghtJUNction/LightFlow
- https://github.com/LIghtJUNction/OniMods

Descriptions distinguish LightFlow's current backend-first workflow environment from its long-term video platform direction. No live follower/star counts, unverified experience, private identity information or commercial claims are introduced.

## Verification

- `npm run test:site`: twelve deterministic geometry, single-entry deployment, content, navigation and accessibility contracts.
- Browser checks at 1440x1000, 390x844 and 320x640: no horizontal overflow, scene rendering, pause, About navigation, all three story stages, reduced motion, truthful clipboard failure and no JavaScript exceptions.
- Separate JavaScript-disabled and graphics-disabled checks preserve the introduction and real project/contact links.
- The local browser exposed no WebGL2 context; the CPU-projected 3D fallback was exercised. Native GPU rendering still needs verification on a WebGL2-capable device.
- Local module syntax and site tests passed. Production Vite build and existing repository checks run in GitHub Actions; this document does not assert those remote results.

The active `check` retains TypeScript, README hero and public-key/crypto checks and adds site tests through `build`. Archived game/exploration/shader suites remain available through `npm run test:legacy`; they no longer gate a page that does not ship those features. Dependency versions and the existing lockfile are unchanged.
