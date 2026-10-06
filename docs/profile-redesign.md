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
  contains the existing msg profile, pixel experiment source, donation link,
  and public contact downloads. Escape closes it and restores focus.

## Implementation

`index.html` contains all useful content. `site/profile.css` owns presentation.
`site/profile.mjs` only enhances language switching, email copying, and the
native disclosure. No new dependencies, remote fonts, tracking, API requests,
render loops, or hydration framework are required by the homepage.

Keep `/lightjunction/` as the Vite base. The existing Vite plugin still emits
`pubkey.asc` and `age-recipients.txt`. Existing `#about`, `#work`, `#contact`,
`#workbench`, and `#top` links remain resolvable. The public key links download
public recipients only; no encryption form or private-key handling is added.

The README, its animation, cryptographic challenge material, old game sources,
and old token renderer are not changed by this redesign. Legacy rendering is
not loaded by the new homepage. Model-level regression tests remain in
`tests/token-cloud.test.mjs`; new page and enhancement tests live in
`tests/profile.test.mjs` and run as part of `npm run test:site` and the build.

## Verification

Run `npm run check` for typechecking, README animation tests, public-key and
crypto tests, profile/model tests, and the production build. The existing CI
and Pages workflows run the required gates without disabling old checks.

For browser review, check English and Chinese at 320, 390, 773, and 1440 CSS
pixels, plus text wrapping at 200% zoom. Verify keyboard-only navigation,
Escape/outside-click dismissal, clipboard success and denial, language changes
while a clipboard write is pending, reduced motion, and JavaScript disabled.
The dot in the introduction is decoration, not an online-status claim.
