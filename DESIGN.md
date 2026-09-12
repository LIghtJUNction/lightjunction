# LIghtJUNction — Open Studio

The profile is an ongoing creative practice: public code, live studies, and a place to begin a conversation. Its entrance is a playable light map, with a suspended sculpture, orbital landmarks, a trail, and eight places to discover. Each place opens a real part of the studio in a readable exhibit. The complete typographic document remains available through Reading view.

## Visual language

- The light theme uses a cool, near-white field (`#f1f2ed`) and deep olive-black ink (`#20241c`). The dark theme uses `#141613` and near-white text. Both share the same compositions and proportions.
- Acid yellow-green (`#d8f36a`) marks the closing correspondence page and selected controls. On light surfaces, readable links use dark olive (`#53671c`); the bright accent is never small text on a light background.
- Instrument Serif gives the large `LIght` word and chapter titles their character. Manrope carries `JUNction`, project names, body text, and actions. IBM Plex Mono is reserved for catalogue labels and real repository data.
- Type scales with the viewport. Main body copy starts at 16px; controls at 14px; secondary captions at 12–13px. Long project names wrap inside their columns.
- Flat rules and differences in scale establish hierarchy. Corners remain square. Shadows belong only to the movable contact panel and encrypted result.

## Exploration

The default entrance fills the available viewport beneath the navigation. A small light follows a closed route through eight destinations. Mouse-wheel and arrow-key input advance along that route in either direction; pointer dragging pans the world, and tapping empty space sends the light there. Input is scoped to the map. Wheel events inside an exhibit retain ordinary reading behavior.

The route is a continuous Catmull–Rom curve. Direct destination buttons choose the closest lap, while consecutive next/previous input preserves direction. Returning from free flight rejoins near the current light. Map view fits all destinations; Home returns to the origin; Space sends a pulse. Discoveries leave persistent marks for the current visit and a small completion message after all eight. Discoveries never gate content.

HTML buttons provide station labels, direct travel, entry actions, and help. The canvas draws the route, station symbols, pointer-responsive dust, light trail, and pulse. The original sculpture appears at the origin. A quiet serif invitation clears after the first movement so the map becomes the main composition.

Exhibits move the original section nodes into a modal panel, preserving attached handlers, input state, canvas instances, IDs, and public challenge markup. Closing restores each section to its exact document position and resumes the same viewpoint. Internal navigation, deep links and browser history open the appropriate section. The original document is the fallback if Canvas 2D is unavailable.

## Reading composition

The opening pairs a two-line identity with an original photograph-like sculpture. Its introductory sentence and two actions remain in normal document flow. The artwork moves only slightly with the pointer and has explicit dimensions to reserve its space.

The language portrait is a framed interactive exhibit beside three operating notes and actual project data. Selected projects form a ruled exhibition checklist, with large names and compact descriptions. The ASCII junction moves to the process chapter, immediately above the four existing steps.

Challenge II keeps its original public surface and asset. The four live shader studies occupy a dark film strip with visible controls, readable fallback states, and horizontal scroll snapping. Floating Ink adds warm-paper marbling with a local pointer vortex; Iridescent Fold adds an analytic pleated surface with spectral color and pointer-driven light. Both are original, texture-free material studies that share a bounded single-pass renderer. Paused or offscreen single-pass studies stop requesting animation frames; a paused image still responds to pointer and reset input. Reduced motion starts all studies paused. The archive combines project filters, repository details, and the terminal in one working area.

Principles use a quiet two-column spread. The closing page changes to acid green, with a large serif invitation and the existing contact actions.

## Responsive behavior

At 760px, the navigation becomes a second, fully visible row. Opening content stacks in reading order, and the artwork shifts to a narrower right-aligned figure. Portrait, selected work, challenge, principles, and shader descriptions become single-column layouts. Repository cards stack below 680px. No essential navigation item disappears.

The map uses a compact mobile control strip and a horizontally scrollable destination dock. Single-pointer dragging coexists with browser pinch zoom. Short viewports omit the opening artwork and secondary descriptions. Interactive controls have at least 44px targets. The gallery track is positioned so its cards and controller share an `offsetLeft` reference; trailing space lets the final study align correctly. The skip-link target accounts for the sticky header.

## Motion and accessibility

Text is visible before JavaScript and before reveal observers fire. Entrance motion changes position without hiding essential content. The glyph portrait and ASCII routes retain pointer interaction, viewport observation, responsive canvas sizing, and reduced-motion behavior. Retired flock, star, and paper-tilt handlers are removed.

Reduced motion settles map movement immediately, stops its continuous animation loop, and redraws only when input, layout or theme changes. Opening an exhibit or hiding the page also pauses map animation. Device pixel ratio is capped at 1.5 for the world canvas. Reduced motion disables decorative CSS animation and retains settled canvas output. Native keyboard focus stays visible. Theme persistence, terminal key handling, project status regions, local OpenPGP encryption, and the encrypted-result focus trap remain.

The secure card is content-sized because its controller translates the whole card. Its content scrolls within the viewport, including on small screens. The exhibit, composer, result dialog, and toast remain direct children of the body for modal isolation. Each active dialog traps keyboard focus and restores it on dismissal. History navigation dismisses the inner contact dialog before moving or closing an exhibit. Canceled asynchronous encryption cannot reopen a result after navigation.

## Protected surface

Do not reinterpret or regenerate Challenge II during presentation work. Keep `public/junction-ii.png` byte-for-byte, the public challenge text and links, the ordered process articles and existing public attributes, and the relevant theme/motion initializers. No solutions or reconstruction details belong in this document.

## Asset provenance

`public/images/light-study.webp` is an original image generated for this redesign with OpenAI image generation, without reference images. The brief was a suspended brushed-aluminum ribbon and fine metallic-wire sculpture in near-black space, with white highlights, one acid green reflection, and tactile grain. There are no letters, logos, or interface elements. The original 1122 × 1402 image was encoded as WebP without changing its composition; the shipped file is approximately 45 KB. This image is a visual study, not a claimed physical artwork or project output.

Existing self-hosted fonts retain their license files. The Challenge II image and shader source assets retain their original bytes and provenance.

## Source organization

- `src/styles.css`: reset, semantic base styles, project/terminal interfaces, contact overlays, and shared responsive rules.
- `src/couture.css`: fonts, both theme palettes, chapter compositions, gallery, and responsive art direction.
- `src/story-wall.ts`: live canvas initialization, observed entrance motion, and reading-view scroll progress.
- `src/expedition-route.ts`: route geometry, destination metadata, wheel normalization and coordinate transforms.
- `src/expedition-renderer.ts`: Canvas 2D world rendering.
- `src/expedition.ts`: input, travel, discovery, camera and animation lifecycle.
- `src/exhibit.ts`: original-section mounting, focus, modal isolation and history.
- `src/expedition.css`: map, controls, exhibit and mobile layouts.

The map introduces no runtime dependency. Happy DOM is a development dependency for DOM interaction tests. `npm run check` runs TypeScript checks, route, interaction and shader-controller tests, and the production build. DOM tests cover input, original-node preservation, direct links, reduced motion, modal history, contact encryption and its cancellation; canvas calls and geometry are stubbed, so they do not verify browser rendering or visual composition.

## Interaction references

[Bruno Simon’s portfolio case study](https://medium.com/@bruno_simon/bruno-simon-portfolio-case-study-960402cc259b) informed the idea of movement as the entrance to a portfolio. The implementation here uses its own light map and Canvas 2D geometry. The [MDN wheel-event documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event) informed delta-mode normalization and preserving modified wheel zoom. [Reduced-motion guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) informs the settled, input-driven alternative.
