---
name: LIghtJUNction
description: A continuous living trace for an inspectable digital assistant.
colors:
  outer-void: "#080908"
  obsidian-wall: "#191916"
  raised-graphite: "#20211d"
  bone-ink: "#e8e3d9"
  soft-bone: "#c8c2b8"
  evidence-muted: "#918d85"
  oxidized-signal: "#c9734f"
  instrument-ink: "#171713"
typography:
  display:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(2.8rem, 5.6vw, 5rem)"
    fontWeight: 690
    lineHeight: 0.94
    letterSpacing: "-0.065em"
  identity:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(3.9rem, 7.5vw, 6rem)"
    fontWeight: 680
    lineHeight: 0.84
    letterSpacing: "-0.075em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(0.94rem, 0.9rem + 0.16vw, 1.05rem)"
    fontWeight: 450
    lineHeight: 1.62
  evidence:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.71rem"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  none: "0"
spacing:
  gutter: "clamp(1.4rem, 5.4vw, 5rem)"
  chapter: "clamp(10rem, 16vw, 16rem)"
components:
  action-link:
    backgroundColor: "transparent"
    textColor: "{colors.bone-ink}"
    typography: "{typography.evidence}"
    rounded: "{rounded.none}"
    padding: "0.2rem 0"
    height: "2.9rem"
  icon-control:
    backgroundColor: "transparent"
    textColor: "{colors.bone-ink}"
    rounded: "{rounded.none}"
    width: "2.55rem"
    height: "2.55rem"
  instrument-sheet:
    backgroundColor: "{colors.bone-ink}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.none}"
    padding: "clamp(1.2rem, 4vw, 3rem)"
---

# Design System: LIghtJUNction

## Overview

The creative north star is **“The Living Junction Trace.”**

LIghtJUNction is rendered as one continuous obsidian wall crossed by an oxidized signal. The wall is not a dark-theme dashboard: it is a slowly authored field where ASCII routes, repository evidence, live shaders, and operating boundaries all belong to the same trace. Long quiet passages are intentional; density arrives only where the underlying system becomes inspectable.

The visual world is technical without adopting generic cyberpunk, terminal rain, or Swiss-brutalist portfolio conventions. Motion explains causality: routes meet, glyphs form a portrait, the visitor disturbs the field, and the system reforms. Fable is an authority for continuity and pacing only; its assets, drawings, prose, dimensions, and scene order are never copied.

**Key Characteristics:**

- One continuous wall instead of alternating page templates.
- Deterministic ASCII motion as moving evidence, not decoration.
- One oxidized signal accent with large areas of low-chroma material.
- Open composition around real instruments rather than ornamental cards.
- Visible recovery, reduced-motion, keyboard, and ownership boundaries.

## Colors

The palette is a low-chroma field with one rare warm signal.

### Primary

- **Oxidized Signal** (`oxidized-signal`): scroll progress, active junctions, selected controls, ASCII accents, and evidence links. It should remain a minority of every viewport.

### Neutral

- **Outer Void** (`outer-void`): the page surround and deepest live-media fallback.
- **Obsidian Wall** (`obsidian-wall`): the single continuous authored surface.
- **Raised Graphite** (`raised-graphite`): restrained tonal separation for actual instruments.
- **Bone Ink** (`bone-ink`): identity, headings, and essential text on the wall.
- **Soft Bone** (`soft-bone`): secondary high-contrast text and line work.
- **Evidence Muted** (`evidence-muted`): explanatory copy, metadata, and inactive navigation.
- **Instrument Ink** (`instrument-ink`): text inside the light repository instrument.

**The One Signal Rule.** Oxidized Signal identifies active causality; it is not a section background, decorative gradient, or general-purpose brand fill.

## Typography

- **Display Font:** Manrope (Arial fallback)
- **Body Font:** Manrope (Arial fallback)
- **Label/Mono Font:** IBM Plex Mono (monospace fallback)
- **Rare Annotation Font:** Instrument Serif, used only when a human annotation needs contrast.

**Character:** Identity type is dense, plainspoken, and tightly spaced. Monospace is reserved for evidence that could plausibly be read from a running system: route labels, counts, status, commands, timestamps, and controls.

### Hierarchy

- **Identity** (680, fluid up to 6rem, 0.84 line-height): `LIghtJUNction` in the opening field only.
- **Display** (690, fluid up to 5rem, 0.94 line-height): chapter propositions with deliberately short measures.
- **Title** (650, 1.35–3.8rem): projects, studies, and operating boundaries.
- **Body** (450, fluid around 1rem, 1.62 line-height): explanatory copy, usually no wider than 38 characters in composed scenes.
- **Evidence** (500, 0.57–0.71rem): controls and data; never substitute it for readable body copy.

**The Evidence Test.** Monospace must name a state, action, coordinate, value, or source. If it does none of those, use Manrope.

## Layout

The desktop wall is capped at 74rem and centered inside the outer void. A route spine crosses the complete document; chapters share the same material and differ through density, offset, and scale rather than background swaps. Evidence clusters alternate left and right around the route, while real instruments may occupy a bounded light sheet.

Chapter spacing is intentionally large. Featured work uses offset fragments rather than equal rows. The project index is the exception: its density is functional and contained inside a light instrument sheet. Below 720px, all evidence becomes single-column, the route shifts toward the left edge, actions remain at least 44px tall, and no desktop coordinate is preserved merely for visual similarity.

## Elevation & Depth

The wall is flat by default. Depth comes from tonal material, moving glyph density, and overlap with the continuous route. Shadows are not a general component treatment. The only hard offset shadow belongs to the bounded light instrument and the protected Challenge II artifact, where it distinguishes a manipulable object from the wall.

**The Instrument Exception.** A surface may lift only when it contains a real tool, artifact, or protected interaction. Narrative copy never becomes a raised card.

## Shapes

Corners are square. Rules are one pixel, controls are rectangular, and the continuous route supplies the only recurring curve. Circular geometry is limited to data points inside the motion systems; there are no decorative blobs, pills, or giant background circles.

## Components

### Action Links

Underlined text actions have no fill and no radius. Hover shifts the text to Oxidized Signal; focus uses a visible two-pixel outline with offset.

### Icon Controls

Theme and fullscreen controls are square 2.55rem instruments with a faint rule. Hover replaces the surface with Oxidized Signal and reverses the text color.

### Navigation

The navigation is a restrained fixed index inside the wall width. Active entries draw a one-pixel Oxidized Signal rule. On narrow screens it becomes a horizontally scrollable second header row rather than a hidden menu.

### Project Instrument

The repository index is a light, square-cornered sheet containing groups, loading/failure/empty status, ruled rows, and direct links. It remains the densest component because its role is inspection, not storytelling.

### ASCII Junction

Four deterministic character routes converge and continue through a shared point. Pointer proximity displaces characters locally, scroll advances the flow, and reduced motion renders the settled route. Labels use real operating verbs: Observe, Build, Verify, Return.

### Glyph Portrait

Characters assemble into a human portrait, repel from the pointer, and reform. The surrounding text explains the operating behavior so the canvas is never the sole source of meaning.

## Do's and Don'ts

### Do

- **Do** preserve one continuous material and route across the whole public page.
- **Do** let real state, evidence, and visitor input drive motion.
- **Do** leave large quiet intervals between dense technical scenes.
- **Do** keep content and recovery paths visible before animation finishes.
- **Do** keep reduced-motion output stable and complete.

### Don't

- **Don't** reintroduce cream-serif editorial templates, black-blue Swiss portfolios, Matrix rain, card walls, or section-by-section theme swaps.
- **Don't** use Oxidized Signal as wallpaper or gradient text.
- **Don't** turn prose into cards, badges, or decorative technical labels.
- **Don't** copy Fable assets, source, drawings, prose, dimensions, or scene order.
- **Don't** expose or weaken Challenge II while changing presentation.
