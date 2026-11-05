# Viewport-built profile

## Purpose

The owner's November 6, 2026 (Asia/Taipei) video reference replaces the October text-only
homepage brief. The profile now uses a swarm of small colored pointers to
assemble the presentation around the content currently in view. This direction
supersedes the earlier white-column and no-renderer constraints, and the older
homepage art direction in `DESIGN.md` and `.impeccable`, for `index.html`.

The reference supplies an interaction mechanism: pointers gather around element
boundaries while prepared content appears. The implementation does not generate
text with AI or copy the reference site's wording, illustrations, or assets.
All content and links are authored in [`index.html`](../index.html); the
presentation varies while the same complete set of information remains available.

## Visual design

The reading stage uses a near-black background (`#0d0f0e`), pale-green accent
(`#d5f4a2`), generous spacing, and thin section rules. Local Manrope and IBM Plex
Mono fonts provide the typography without a remote font service. The stage is
at most 1240px wide; mobile layouts use one column and 24px side padding, reduced
to 20px at widths of 360px or less. These rules live in
[`site/profile.css`](../site/profile.css).

The page retains the existing identity, current projects, selected repositories,
gratitude, and contact information. Project, social, donation, email, and public
key destinations remain real links. The design adds no invented employment,
availability, visitor counts, or live activity claims.

## Generation method

**Arrangement.** Each initialization and **Recompose** action obtains a fresh
32-bit seed from `crypto.getRandomValues`, with a time/random fallback when that
API is unavailable. The seed selects among three bounded desktop column
variants and changes note offsets, pointer paths, and entrance timing. It also
shuffles the four existing project elements in the DOM, keeping visual and
keyboard order aligned. This happens only on initialization or recomposition;
scrolling does not reorder content. Mobile layouts remain single-column.
The finite layout choices can repeat; a fresh seed does not guarantee a unique
visible layout.

**Viewport targets.** [`site/swarm.mjs`](../site/swarm.mjs) measures actual section
and element rectangles, then chooses the visible section nearest a point 45%
down the viewport. Pointer teams trace the boundaries of visible items in that
section. Scroll, resize, font readiness, and language changes refresh those
measurements, so the current reading area determines the swarm's work.

**Construction.** Newly visible items receive a short entrance animation and
temporary outlines with a moving edge marker. Entrances last 650ms with seeded
delays of up to 180ms; construction guides last about 1.25–1.45 seconds. Items
animate once per arrangement, and keyboard focus immediately removes an active
entrance effect. Content stays in the document throughout the presentation.

**Pointer response.** Nearby swarm pointers are attracted to the user's pointer
and scatter while it is pressed. The real system cursor remains visible.
The decorative canvas has `pointer-events: none`; passive pointer listeners do
not cancel link activation, text selection, or touch scrolling. The swarm has
22 pointers below 660px and 48 otherwise, with canvas pixel density capped at
1.5 to bound rendering work. These limits are implementation choices, not a
measured performance guarantee.

## Compatibility and preservation

Useful content is available without JavaScript or Canvas support. English is
the static default; [`site/profile.mjs`](../site/profile.mjs) adds Chinese,
email copying, and disclosure dismissal. Language persistence tolerates denied
storage. Clipboard failures offer manual copying, and changing language
invalidates pending clipboard feedback. **Elsewhere** retains its native
disclosure behavior; Escape closes it and returns focus to its summary.

Motion is optional. Reduced-motion preferences select a static presentation by
default, and **Pause motion** stops ongoing animation. Forced-colors mode hides
the decorative canvas. Hidden documents and `pagehide` cancel the animation
frame request; visibility restoration and `pageshow` refresh and resume only
when motion is enabled. No continuous frame loop runs while motion is paused.

The deployment base remains `/lightjunction/`, and `#about`, `#work`, `#contact`,
`#workbench`, and `#top` remain valid destinations. The
[`Vite configuration`](../vite.config.ts) emits `pubkey.asc`,
`age-recipients.txt`, and `junction-ii.png` from their existing source files.
Their bytes must remain unchanged by this redesign. No private-key handling or
challenge changes belong to this work. Legacy experiments remain separate from
the published profile entry point.

## Verification

The following commands define the verification procedure. Results for the
delivered implementation are recorded below.

```sh
npm run test:site
npm run check
scripts/check-python.sh
cmp pubkey.asc dist/pubkey.asc
cmp public/age-recipients.txt dist/age-recipients.txt
cmp public/junction-ii.png dist/junction-ii.png
```

`npm run check` runs TypeScript, public-key and crypto tests, profile tests, and
the production build. The Python gate covers repository structure and related
checks. The three `cmp` commands require the built output and verify that public
downloads match the tracked source bytes. The release diff must also show that
the source key and challenge files themselves were not changed.

Browser review must cover English and Chinese at 320, 390, 773, and 1440 CSS
pixels, plus 200% zoom. Check fresh visits and **Recompose**, viewport-dependent
targets, pointer attraction and scattering, native cursor visibility, touch
scrolling, and readable text during construction. Also check keyboard access,
Escape/outside-click dismissal, clipboard success and denial, language changes
during a pending copy, storage denial, disabled JavaScript, unavailable Canvas,
reduced motion, forced colors, background tabs, and back/forward restoration.
Use the results below to distinguish completed checks from this broader review
matrix.

### Delivery evidence — November 6, 2026

The implementation and lifecycle tests are committed at
[`eb59436`](https://github.com/LIghtJUNction/lightjunction/commit/eb594361cc5054705c6782c5495aa1d4a5d1da08).
Local `npm run check` passed: TypeScript checking, six crypto/public-key tests,
26 profile/swarm tests, and the Vite production build. The public downloads and
the two shipped font license files match their source bytes. No runtime
dependencies were added.

[GitHub CI](https://github.com/LIghtJUNction/lightjunction/actions/runs/42065877946)
and [Pages deployment](https://github.com/LIghtJUNction/lightjunction/actions/runs/42065878045)
both succeeded for that commit. The full Python suite passes in CI. Locally,
184 Python tests passed; the remaining GnuPG integration test could not start
`gpg-agent` in the execution environment. Its assertion and CI coverage remain
intact. The existing README link check now accepts both HTML and Markdown links
while continuing to require every language destination.

The published site was inspected at a 1363 × 936 CSS-pixel viewport in English
and Chinese. Neither language caused horizontal page overflow. Recompose and
reload produced new seeds and different project orders while preserving all
four links. Scrolling changed the active swarm section from `about` to `work`.
Pause/resume controls, email-copy feedback, and Escape dismissal with restored
menu focus worked. Automated lifecycle tests cover reduced motion, suspended
pages, Canvas failure, cleanup, and touch-pointer cancellation. Narrow-screen
and physical-device visual checks are not included in this browser evidence.

## Claim and evidence review

| Claim | Evidence to inspect | Status |
| --- | --- | --- |
| Content remains prepared and reachable. | Static-content/link tests and the published English/Chinese page. | Verified. |
| Each visit can vary the presentation. | Seeded-model tests and published Recompose/reload observations. | Verified. |
| The viewport and pointer affect the swarm. | Pointer-model tests and the published active-section observation. | Verified within the stated test coverage. |
| Motion can stop without blocking reading. | Lifecycle tests and the published pause control. | Verified. |
| Public artifacts retain their bytes. | Source diff and built-output `cmp` checks. | Verified. |

Self-review follows the requested
[Research Paper Writing skill](https://github.com/Master-cai/Research-Paper-Writing-Skills/blob/main/research-paper-writing/SKILL.md):

- **Contribution:** the change is viewport-guided presentation of existing
  content; it makes no AI-generation or algorithmic-novelty claim.
- **Clarity:** arrangement, targets, construction, and pointer response each
  have one defined role and a corresponding source location.
- **Evidence:** reported results identify the commit, commands, and observation
  surface; no frame-rate or device-performance measurements are claimed.
- **Coverage:** automated checks include interaction and failure paths; the
  browser evidence states its viewport and remaining device-review limits.
- **Design soundness:** static content, native controls, bounded variation, and
  pause behavior constrain the decoration; desktop composition was reviewed.
