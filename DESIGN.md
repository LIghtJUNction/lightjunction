# Profile design

The profile uses a dark reading surface, generous spacing, and a small set of
typographic sizes. Organizations and project collections carry the page's
structure; technical demonstrations and retired game interfaces are kept out of
the active profile.

## Visual language

The background is `#0d0f0e`, primary text is `#eff1eb`, and the restrained
accent is `#d5f4a2`. Self-hosted Manrope carries headings and body text; IBM Plex
Mono is reserved for labels and commands. Thin rules separate sections without
turning every item into a bordered card.

The content width is bounded at 1240 pixels. Responsive layouts reduce columns
and spacing while retaining organization links, the Project Z directory, and
contact actions. Names and email addresses wrap within the reading area.

## Interaction and access

Content is visible in HTML before JavaScript runs. The profile has no canvas,
3D avatar, construction animation, or continuous rendering loop. Language
selection and email copying are optional enhancements; native links and
disclosures remain usable without them.

Keep visible keyboard focus, a skip link, descriptive control names, and touch
targets of at least 44 pixels. Language changes update visible text and
accessible labels together. Clipboard feedback must describe the actual result,
including denied access.

## Source and protected material

`index.html`, `site/profile.css`, and `site/profile.mjs` own the active
profile. `tests/profile.test.mjs` checks its content and interaction contracts.
Vite builds the profile and copies the public downloads.

`archive.html` is a small static page retaining the original Challenge II
section verbatim. Its artifact stays at `public/junction-ii.png`. Source
checks protect both with recorded hashes; the generated archive resolves the
image within the deployment directory. Do not add solution material or change
public clues during presentation work.
