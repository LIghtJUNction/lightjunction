---
name: lmm-best-service-page
repo: LIghtJUNction/lightjunction
description: >
  lmm.best personal static website product workflow. Use this skill when the
  user mentions lmm.best, /username pages, selling personal websites, static
  profile pages, customer intake, or deploying profile websites under
  lmm.best/<username>. Do not confuse this with the lightjunction profile site.
---

# LMM.best Personal Static Sites

Use this skill for the `lmm.best/<username>` product: customers pay to get a
simple, good-looking personal static website hosted under the `lmm.best` domain.

This is **not** the same as the `lightjunction` repository website. The
`lightjunction` site is the owner's / assistant's profile home and should not be
turned into a pricing or sales page unless the user explicitly asks.

## Product Definition

Position `lmm.best` as:

> A lightweight personal website service. Pay once, get a polished static page
> at `https://lmm.best/<username>`.

The customer buys their own personal site, not the assistant's services. The
assistant may help generate, edit, and deploy pages, but the product is the
published website.

## What A Customer Gets

For each `lmm.best/<username>` page, include only customer-relevant sections:

1. Hero: name, title, one-line identity.
2. About: short human or project introduction.
3. Links: GitHub, Bluesky, X, email, portfolio, products, payment links, etc.
4. Highlights: projects, services, writing, art, products, or credentials.
5. Contact: email, social link, contact form link, or encrypted contact if the
   customer requests it.
6. Optional: proof, testimonials, featured work, downloadable resume, public key.

Do not include the assistant's token costs, assistant treasury, or GPT-5.5
monetization language on customer pages unless the customer is specifically
buying an AI assistant identity page and explicitly asks for it.

## Pricing Framing

Use simple website-product pricing, not donation language:

```text
Basic profile page: one static page at lmm.best/<username>
Custom profile page: custom copy, colors, sections, and links
Maintenance: small updates after publishing
```

Avoid exact prices unless the user asks to publish them. If prices are needed,
use a simple starter menu and make it clear the human owner controls payments:

```text
$10 starter profile copy draft
$30 basic static page
$80 custom static page with refined copy and visual direction
```

## Design Rules

Personal pages must be mobile-first. Before showing a page to the user, check the
mobile layout mentally and with a real preview when possible.

Rules:

- Start with a narrow mobile layout, then enhance desktop.
- Avoid dense sidebars on mobile.
- Avoid tiny terminal-only UI for sales/customer pages unless the customer wants
  that style.
- Keep CTA buttons large enough for touch.
- Keep copy short and scannable.
- Do not make all pages look like the `lightjunction` profile site.
- Vary visual themes per customer: editorial, card stack, neon terminal,
  minimalist resume, product founder, artist portfolio, researcher, etc.

## Repository Separation

Keep these concepts separate:

- `lightjunction` repository/site: owner and assistant profile/home workspace.
- `lmm.best` site: main hosted product with many `/username` pages.
- Customer page: a generated static page under `lmm.best/<username>`.

If the `lmm.best` main repository is not present locally, do not force the page
into `lightjunction`. Instead:

1. Say the main `lmm.best` repo is missing.
2. Draft the page as portable static HTML/CSS or a component in a staging folder.
3. Ask for, locate, or create the proper `lmm.best` project before deployment.
4. Keep `lightjunction` profile changes separate from `lmm.best` product changes.

## Deployment Shape

Preferred production structure for option A:

```text
lmm.best/
  index.html              # directory / product homepage
  lightjunction/index.html
  alice/index.html
  bob/index.html
```

Any static server, Nginx, Caddy, GitHub Pages, Cloudflare Pages, or Vite build
can serve this shape. The important URL contract is:

```text
https://lmm.best/<username>/
```

## Customer Intake

Ask for only what is needed:

- Desired username/path.
- Display name.
- One-line bio.
- Links to show.
- Desired style or examples.
- Contact method to publish.
- 3-5 highlights, projects, services, or credentials.

Do not ask customers for passwords or platform credentials. Deployment secrets
must stay with the human owner or approved secret manager.

## Outreach

When promoting `lmm.best`, sell the website product:

```text
I can make you a small personal static website at https://lmm.best/<username>:
clean profile, links, projects, contact, and mobile-first design.
```

Avoid saying:

```text
Pay me because my token costs are high.
```

The better pitch is:

```text
You get a polished personal page. The assistant helps draft, design, and publish it.
```

## Default Workflow

When asked to build a `lmm.best/<username>` page:

1. Confirm or infer the username from context.
2. Locate the `lmm.best` main site repository. If missing, state that and create
   a portable draft only when useful.
3. Build the page mobile-first.
4. Preview with a public URL before publishing.
5. Run the site's normal checks/build.
6. Share a critique diff URL after edits.
7. Only promote publicly after the user approves the design.
