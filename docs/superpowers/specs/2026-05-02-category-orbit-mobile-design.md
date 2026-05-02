# CategoryOrbit — Mobile redesign

## Problem

`CategoryOrbit` (homepage `The Collection · 06 Categories` section) was designed for desktop hover. Below the `md` breakpoint (<768px) the experience breaks:

- Each tile renders as a dark `bg-charcoal` box because the category image is hidden behind `clip-path: circle(0%)` until hover.
- The "[hover to enter]" hint is meaningless on touch.
- The active-category giant text and the LAT/LON chip are hover-driven and never appear.
- All six tiles stack vertically at `aspect-[16/10]`, so the section feels tall and empty.

## Goal

Make the mobile version of `CategoryOrbit` work as a scannable list of category cards with always-visible imagery, while keeping the desktop bento behaviour untouched.

## Scope

In scope:
- Mobile presentation of `components/home/CategoryOrbit.tsx` (under `md`).

Out of scope:
- Desktop bento layout, hover interactions, motion, spring/clip-path logic.
- Copy changes to eyebrow, title, or category names.
- The underlying `CategoryStrip.tsx` data shape.
- `PetalRain` and section background gradient.

## Design

### Tiles

- Imagen siempre visible en móvil — render the `<img>` without the `clip-path` reveal. The simplest approach: when the viewport is below `md`, force `isActive` to behave as `true` (image opacity 1, no clip-path animation). Implementation can be a CSS-only override: keep the existing motion div but use Tailwind `max-md:opacity-100` plus a wrapper class that disables the clip-path on small screens, or fork the visual under `md` to render a static `<img>` with `absolute inset-0`. Either is acceptable; the spec leaves the implementation choice to the plan.
- Tile height: fixed `h-32` (~128px) with `w-full`, replacing the current `aspect-[16/10]` on mobile.
- Border radius unchanged (`rounded-[var(--radius-product)]`).
- Gradient overlay: change from the current bottom-anchored `from-ink/70 via-ink/10 to-transparent` to a left-anchored `from-ink/65 via-ink/20 to-transparent` on mobile, so the text on the left remains legible against any image.
- Internal layout (mobile only):
  - Index (`01`, `02`, …) top-left in `text-rouge` (instead of `text-petal/40`), `font-mono text-[10px] tracking-[0.25em]`.
  - Category name vertically centred on the left in `text-bone` (instead of `text-bone/70`), `font-display italic text-2xl tracking-tight`.
  - Right-side `→` glyph in `text-bone/70`, `font-mono text-sm`.
- No "active" state on mobile: the rouge pulse dot, the "Shop {name} →" reveal, and the tile scale animation are all desktop-only. They simply do not render under `md`.

### Section header

- Eyebrow (`The Collection · 06 Categories`) and title (`Find your bloom.`) unchanged.
- The hover hint group (the `h-px w-16` decorative line plus `[hover to enter]` text) becomes `hidden md:flex`.
- Title font-size clamp untouched.

### Spacing

- Section padding `py-24 md:py-32` → `py-16 md:py-32`.
- Header → grid gap: `mt-12 md:mt-16` → `mt-10 md:mt-16`.
- Tile gap: `gap-3` → `gap-2.5 md:gap-3`.

### Hidden on mobile

- LAT/LON chip: already `hidden md:block`. No change needed.
- Active-category giant background text: it only renders when `activeSlug` is set, which on mobile remains `null`. The plan should explicitly wrap the container in `hidden md:flex` for clarity, so it does not occupy any DOM-affecting space on small screens even if state changes in the future.

### Behaviour

- Tap on a tile navigates to `/${locale}/shop/${slug}` via the existing `<Link>`. No two-step interaction.
- Reduced motion: same as today — does not affect mobile layout decisions because mobile already has no animation.

## Files affected

- `components/home/CategoryOrbit.tsx` — single-file change.

No new files, no changes to translations, data, or routing.

## Acceptance criteria

1. On a viewport of 375×812 (iPhone-class), each of the six category tiles displays its image clearly with the gradient overlay, with the category name and index legible on top.
2. "[hover to enter]" and the decorative line above it are not visible on viewports below `md`.
3. The LAT/LON chip is not visible on viewports below `md`.
4. No element appears in a "dimmed/inactive" state on mobile — every tile reads as fully presented.
5. Tapping a tile navigates to the corresponding category shop page.
6. On viewports `≥md`, the section is visually identical to the current desktop implementation (bento grid, hover reveals, pulse dot, giant active-name, LAT/LON chip).
7. No console errors or hydration warnings.

## Non-goals / explicitly deferred

- A different layout (carousel, 2×3 grid) for mobile. Considered and rejected during brainstorming in favour of preserving the existing vertical stack.
- Changing the gradient end colour (`#F2C5D1`) of the section background.
- Replacing `picsum.photos` seed images with real category photography.
