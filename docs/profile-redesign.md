# A profile constructed in view

Updated November 6, 2026 (Asia/Taipei).

## Requirement and reference

The owner rejected the first floating-pointer implementation because the cursors
did not visibly construct the website. This revision replaces it with finite
jobs: cursors drag frames and lines, reveal the prepared content, then release
their handles and disappear. It supersedes the previous motion description and
the older white-column/no-renderer direction for `index.html`.

The supplied video establishes a visible order of operations. In the opening
sequence, the content area is nearly empty through approximately 0.4 seconds;
frames expand around 0.6 seconds; text and imagery appear inside them around
0.8–1.2 seconds; completed regions settle around 1.2–1.8 seconds. Newly exposed
sections receive fresh guides and frames during scrolling. These are approximate
observations of the reference recording, not measured timings of this site.
The implementation uses this interaction idea without copying the reference's
wording, illustrations, or assets.

All text and links remain authored in [index.html](../index.html). Runtime
generation means arranging and presenting that content; there is no live AI
text generation. The near-black background, pale-green accent, local Manrope
and IBM Plex Mono fonts, generous spacing, and responsive layout remain in
[site/profile.css](../site/profile.css).

## Construction mechanism

[site/swarm-model.mjs](../site/swarm-model.mjs) samples a finite timeline for
each measured element. [site/swarm.mjs](../site/swarm.mjs) uses that same sample
to draw the cursors and control the element's CSS clipping. This shared state
makes the visible operation determine how much content is revealed.

| Stage | Visible action | Content state |
| --- | --- | --- |
| Approach | A small crew travels to the element's measured origin. | Concealed, with its layout space retained. |
| Frame | The lead cursor drags a growing rectangle; assistants hold alignment points. | Text and cards remain concealed until the frame is complete. |
| Write | A cursor and caret move across the prepared content. | The clipping frontier follows the same sampled position. |
| Settle | Handles and guides fade, then the job completes. | Fully visible; its workers disappear. |

Text jobs use `Range.getClientRects()` to measure the rendered text rows. The
caret advances through those rows in reading order, and a matching polygon
reveals completed rows plus the current partial row. The HTML is not split or
replaced. Cards use the measured element boundary and a horizontal reveal.
Scroll, resize, font readiness, and language changes refresh the measurements.

Section and project dividers are actual line jobs. Their lead cursor stays at
the growing line endpoint, while the underlying DOM rule is revealed by the
same progress value. Rectangle jobs likewise place the lead cursor exactly at
the expanding corner. Temporary guides, five-pixel handles, and short action
labels make these operations visible.

Individual text jobs take approximately 1.8–2.2 seconds, cards 2.1–2.5 seconds,
and lines 1.0–1.25 seconds in the model. Several jobs overlap, with a small
stagger between starts. These are configured animation durations, not measured
page-load or frame-rate results.

## Viewport queue and variation

Only visible unfinished jobs advance. The queue prioritizes the section nearest
45% of the viewport height, then starts jobs in visual position order. It allows
four simultaneous visible jobs on desktop and two below 660 CSS pixels, with
two or three assigned cursors per job. Partially built content pauses offscreen
and resumes from its saved progress when it returns. Once visible work is
complete, the canvas is empty and no idle animation frame loop continues.

Each initialization and **Build again** action obtains a fresh 32-bit seed from
`crypto.getRandomValues`, with a time/random fallback. The seed varies bounded
column arrangements, note offsets, task timings, colors, and project order.
The four existing project elements are moved in the DOM so reading and keyboard
order remain aligned. Scrolling never reshuffles content. Finite layout choices
can repeat; a fresh seed does not guarantee a unique visible layout.

## Access and failure behavior

Prepared content remains in the document throughout construction. Keyboard
focus immediately reveals its containing job, and **Build again** preserves
focus. The canvas is noninteractive (`pointer-events: none`); the native mouse
cursor, links, and normal scrolling remain available.

**Pause motion** completes all pending jobs and reveals the page. Resuming does
not hide completed content again; **Build again** starts a new construction.
Reduced-motion and forced-colors preferences select the readable static state.
Print styling also exposes all content and hides the canvas.

The small boot script conceals construction targets before the module starts,
avoiding a flash of the finished page. If the module never initializes, this
boot concealment expires after 3.5 seconds. Disabled JavaScript leaves normal
HTML; missing Canvas support, a lost canvas context, or a renderer exception
releases concealed content. Hidden documents and `pagehide` suspend the frame
request without consuming construction time. Restoration remeasures the page.

English/Chinese switching, email copying, native contact disclosure, public-key
downloads, and existing destinations remain part of the profile. The deployment
base stays `/lightjunction/`. This change does not alter the public key material
or Challenge II source artifacts.

## Verification

The corrected implementation is committed at
[ee015ea](https://github.com/LIghtJUNction/lightjunction/commit/ee015ead81e650825c69564deee83db0a87a62cb).
Local `npm run check` passed: TypeScript checking, six crypto/public-key tests,
35 site tests, and the Vite production build. The site total comprises 15 profile
tests, seven construction-model tests, and 13 controller tests.

The model tests verify that frame drawing precedes text/card reveal, cursor
positions match drawing endpoints, multiline text follows measured rows, and
completed workers disappear. Controller tests cover viewport queuing and
resumption, no idle frame loop, fresh seeds without replacing prepared links,
focus preservation, pause/static modes, page lifecycle, Canvas failure, and
renderer failure. These tests establish the state and geometry relationships;
the browser observations below establish the visible construction sequence.

Built copies of `pubkey.asc`, `age-recipients.txt`, and `junction-ii.png` matched
their source bytes with `cmp`; the source artifacts remain unchanged. No runtime
dependency was added.

[GitHub CI](https://github.com/LIghtJUNction/lightjunction/actions/runs/42072251248)
and [Pages deployment](https://github.com/LIghtJUNction/lightjunction/actions/runs/42072251072)
both succeeded for `ee015ea`.

The corrected public page was reviewed in a Chromium browser at 1363 × 936 CSS
pixels. A fresh English load was captured during frame dragging, partial text
writing, and completion. During the drag, title and body text remained concealed
inside the expanding boxes. During writing, the caret and worker tracked the
visible text frontier. At completion the canvas state was `idle`, all visible
jobs were done, and no construction cursors remained.

The review also confirmed that navigating to Projects selected the `work` scene
and started fresh divider/header jobs. Chinese text filled its first line before
advancing through the second line. The original screenshots are no longer kept
in the repository.

**Build again** started a new construction and seed; reloading varied the project
order. English and Chinese had no horizontal page overflow. The Chinese page
also settled to `idle` with zero visible unfinished jobs. The review used actual
browser captures, with no added mock cursors or simulated content. Narrow
viewport and physical-device visual checks were not performed in this review;
no device frame-rate or loading-speed claim is made.

## Review notes

This note follows the requested
[Research Paper Writing skill](https://github.com/Master-cai/Research-Paper-Writing-Skills/blob/main/research-paper-writing/SKILL.md)
and its method/claim-evidence review guidance.

- **Contribution:** Cursor operations now control content reveal;
  no AI-generation or algorithmic-novelty claim is made.
- **Clarity:** The stage table maps to the pure
  model, DOM controller, and CSS clipping described above.
- **Evidence:** Local checks cover state, geometry, lifecycle, production output,
  and preserved downloads; screenshots show the deployed construction stages.
- **Coverage:** CI and deployment passed. Desktop English/Chinese rendering was
  observed; narrow viewport and physical-device rendering remain unverified.
- **Design:** Focus, static modes, boot timeout,
  and failure cleanup expose prepared content; no device-performance guarantee
  is claimed.
