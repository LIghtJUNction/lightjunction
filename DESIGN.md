# LIghtJUNction — Open Studio

The profile is an ongoing creative practice: public code, live studies, and a place to begin a conversation. Its identity comes from a typographic cover, a suspended light sculpture, generous margins, and an exhibition-like sequence of real work.

## Visual language

- The light theme uses a cool, near-white field (`#f1f2ed`) and deep olive-black ink (`#20241c`). The dark theme uses `#141613` and near-white text. Both share the same compositions and proportions.
- Acid yellow-green (`#d8f36a`) marks the closing correspondence page and selected controls. On light surfaces, readable links use dark olive (`#53671c`); the bright accent is never small text on a light background.
- Instrument Serif gives the large `LIght` word and chapter titles their character. Manrope carries `JUNction`, project names, body text, and actions. IBM Plex Mono is reserved for catalogue labels and real repository data.
- Type scales with the viewport. Main body copy starts at 16px; controls at 14px; secondary captions at 12–13px. Long project names wrap inside their columns.
- Flat rules and differences in scale establish hierarchy. Corners remain square. Shadows belong only to the movable contact panel and encrypted result.

## Composition

The opening pairs a two-line identity with an original photograph-like sculpture. Its introductory sentence and two actions remain in normal document flow. The artwork moves only slightly with the pointer and has explicit dimensions to reserve its space.

The language portrait is a framed interactive exhibit beside three operating notes and actual project data. Selected projects form a ruled exhibition checklist, with large names and compact descriptions. The ASCII junction moves to the process chapter, immediately above the four existing steps.

Challenge II keeps its original public surface and asset. The live shader gallery occupies a dark film strip with visible controls, readable fallback states, and horizontal scroll snapping. The archive combines project filters, repository details, and the terminal in one working area.

Principles use a quiet two-column spread. The closing page changes to acid green, with a large serif invitation and the existing contact actions.

## Responsive behavior

At 760px, the navigation becomes a second, fully visible row. Opening content stacks in reading order, and the artwork shifts to a narrower right-aligned figure. Portrait, selected work, challenge, principles, and shader descriptions become single-column layouts. Repository cards stack below 680px. No essential navigation item disappears.

Interactive controls have at least 44px targets. The gallery track is positioned so its cards and controller share an `offsetLeft` reference; trailing space lets the final narrow study align correctly. The skip-link target accounts for the sticky header.

## Motion and accessibility

Text is visible before JavaScript and before reveal observers fire. Entrance motion changes position without hiding essential content. The glyph portrait and ASCII routes retain pointer interaction, viewport observation, responsive canvas sizing, and reduced-motion behavior. Retired flock, star, and paper-tilt handlers are removed.

Reduced motion disables CSS animation and transforms, and retains settled canvas output. Native keyboard focus stays visible. Theme persistence, terminal key handling, project status regions, local OpenPGP encryption, and the encrypted-result focus trap remain.

The secure card is content-sized because its controller translates the whole card. Its content scrolls within the viewport, including on small screens. The result dialog and toast remain direct children of the body for modal isolation.

## Protected surface

Do not reinterpret or regenerate Challenge II during presentation work. Keep `public/junction-ii.png` byte-for-byte, the public challenge text and links, the ordered process articles and existing public attributes, and the relevant theme/motion initializers. No solutions or reconstruction details belong in this document.

## Asset provenance

`public/images/light-study.webp` is an original image generated for this redesign with OpenAI image generation, without reference images. The brief was a suspended brushed-aluminum ribbon and fine metallic-wire sculpture in near-black space, with white highlights, one acid green reflection, and tactile grain. There are no letters, logos, or interface elements. The original 1122 × 1402 image was encoded as WebP without changing its composition; the shipped file is approximately 45 KB. This image is a visual study, not a claimed physical artwork or project output.

Existing self-hosted fonts retain their license files. The Challenge II image and shader source assets retain their original bytes and provenance.

## Source organization

- `src/styles.css`: reset, semantic base styles, project/terminal interfaces, contact overlays, and shared responsive rules.
- `src/couture.css`: fonts, both theme palettes, chapter compositions, gallery, and responsive art direction.
- `src/story-wall.ts`: live canvas initialization, observed entrance motion, and scroll progress.

The previous stacked visual overrides have been replaced. The dependency manifest and lockfile are unchanged.
