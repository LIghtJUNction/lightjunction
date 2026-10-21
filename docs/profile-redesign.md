# Text-first profile

The owner's October 6, 2026 reference replaces the old full-screen 3D homepage
with a quiet, white personal profile. This brief supersedes the earlier homepage
art direction in `DESIGN.md` and `.impeccable` for `index.html`.

## Surface

- A centered 576px reading column, system sans-serif, near-black emphasis, gray
  body text, and thin section rules. No oversized hero, cards, scroll hijacking,
  custom cursor, loading screen, or continuously running renderer.
- Original LightJunction monogram, introduction, two current projects, four
  selected repositories, and a small social footer. Do not invent employers,
  job titles, employment dates, availability, or live activity indicators.
- English is the static default; the optional Chinese toggle stores only the
  language preference. Storage denial must not break the page.
- The top disclosure is named "Elsewhere", not an unimplemented gallery. It
  contains the existing msg profile, donation link,
  and public contact downloads. Escape closes it and restores focus.

## Implementation

`index.html` contains all useful content. `site/profile.css` owns presentation.
`site/profile.mjs` only enhances language switching, email copying, and the
native disclosure. No new dependencies, remote fonts, tracking, API requests,
render loops, or hydration framework are required by the homepage.

Keep `/lightjunction/` as the Vite base. The existing Vite plugin still emits
`pubkey.asc`, `age-recipients.txt`, and the unchanged `junction-ii.png`.
Existing `#about`, `#work`, `#contact`, `#workbench`, and `#top` links remain
resolvable. The public key links download
public recipients only; no encryption form or private-key handling is added.

The October 22 simplification replaces the README animation with a static SVG,
removes automated README feeds and artificial commit generation, and retires
the unused token-cloud homepage. Particle typography and the game sources
remain as experiments, covered by `npm run test:legacy`; the published profile
does not load them. Public keys and the challenge artifact retain their exact
bytes. Page and enhancement tests live in `tests/profile.test.mjs` and run as
part of `npm run test:site` and the build.

## Verification

Run `npm run check` for typechecking, public-key and crypto tests, profile tests,
and the production build. README and SVG checks run in the Python gate. The CI
and Pages workflows run the checks for the current published surface.

For browser review, check English and Chinese at 320, 390, 773, and 1440 CSS
pixels, plus text wrapping at 200% zoom. Verify keyboard-only navigation,
Escape/outside-click dismissal, clipboard success and denial, language changes
while a clipboard write is pending, reduced motion, and JavaScript disabled.
