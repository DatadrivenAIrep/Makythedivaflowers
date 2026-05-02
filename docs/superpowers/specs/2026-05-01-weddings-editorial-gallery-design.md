# Weddings — Editorial Gallery (Cinematic Enhanced) — Design

**Date:** 2026-05-01
**Status:** Approved (pending user review of this spec)
**Page:** `/weddings`
**Component being replaced:** `components/weddings/MasonryGallery.tsx`

## Goal

Replace the current placeholder masonry on the weddings page with a real portfolio gallery showing 16 photographs of Diva Flowers' actual wedding work. The gallery must produce a "wow" reaction without competing with the photographs themselves, fit the brand's warm editorial palette, and convert wedding leads as well or better than today's gallery.

## Non-goals

- No category filters, no tagging system, no album navigation. The 16 photos are presented as one curated portfolio.
- No CMS integration. The gallery is statically defined in `data/wedding-portfolio.ts`.
- No video assets in this iteration.
- No structural changes to surrounding sections of the weddings page (`WeddingsHero`, `ProcessStrip`, `PricingIntent`, `WeddingsFAQ`, `WeddingsForm`).

## Source images

Seventeen images currently in `~/Downloads`, all modified 2026-05-01 between 20:54 and 21:09:

```
1.webp, 2.webp, 3 (1).webp, 4.jpg, 5 (2).webp,
6 (1).webp, 7 (1).webp, 8 (1).webp, 9 (1).webp,
10 (1).webp, 11 (1).webp, 12 (1).webp,            (12 numbered)
oh1-scaled.webp, oh2.webp,                        (2 in "oh" set)
per15.webp, per18.webp, per19.webp                (3 in "per" set)
```

Total: 17 photos. (`4.jpg` is the only non-webp; convert to webp during copy.)

These are copied into `public/weddings/` and renamed sequentially `01.webp ... 17.webp` for predictable references and clean URLs. The original-to-renamed mapping is recorded inline in `data/wedding-portfolio.ts` as a code comment.

## Visual structure

The gallery is composed of five sequential blocks:

```
[ Mosaic 1   — 5 tiles, asymmetric grid ]
[ Hero 1     — 1 image, full-bleed edge-to-edge, strong parallax ]
[ Mosaic 2   — 5 tiles, asymmetric grid ]
[ Hero 2     — 1 image, full-bleed edge-to-edge, strong parallax ]
[ Mosaic 3   — 5 tiles, asymmetric grid ]
[ Marquee    — all 17 photos, auto-scrolling horizontal loop, full width ]
```

Layout sequence in the data array: `5 mosaic, 1 hero, 5 mosaic, 1 hero, 5 mosaic` — 17 photos total, 2 of which are heroes.

The two hero images are the two most cinematic / widest-aspect images in the set, selected at implementation time after visually inspecting the originals. They use `aspect: "16/9"` and `layout: "hero"`.

Mosaic tiles use a 3-column desktop grid (2 col tablet, 1 col mobile) with mixed aspect ratios (`4/5`, `1/1`, `3/4`, `16/9`) to produce a print-magazine rhythm. Each tile is a fixed-aspect frame; the `<Image>` inside is what moves with parallax, never the frame itself, so the layout never reflows during scroll.

A small mono-uppercase index number (`01`, `02`, ...) sits in the bottom-left corner of each mosaic tile. Heroes carry no number — they are the moments where the image alone speaks. The marquee tiles also carry no number.

## Effects

### Entry reveals (IntersectionObserver, once per element)

- Mosaic tiles: `opacity 0 → 1`, `translateY 24px → 0`, `blur(8px) → blur(0)`, 600ms, `cubic-bezier(0.4, 0, 0.2, 1)`, **80ms stagger** within the same mosaic.
- Heroes: `opacity 0 → 1`, `scale 1.02 → 1`, 700ms, no blur.
- Marquee: simple fade-in once visible; the auto-scroll animation starts independently and loops.

### Parallax (driven by `useScroll` + `useTransform`)

- Mosaic tile inner image: 0.85x scroll velocity → ~10–15px total displacement across the tile's visible window. Sutile.
- Hero inner image: 0.65x scroll velocity → ~80–120px total displacement. Pronounced; this is the cinematic moment.
- Implemented per-element with `useScroll({ target: ref, offset: ["start end", "end start"] })`. No global scroll listener.

### Hover (mosaic + marquee tiles)

- Inner image scales to 1.04 over 600ms.
- Index number (mosaic only) translates from `y: 100% → 0` and `opacity 0.6 → 1`.
- A 1px inset border at `bg-bone/20` reinforces the frame.

### Marquee

- CSS `@keyframes` translating the strip `0 → -50%` over 45s, infinite, linear. The strip contains the 16 photos duplicated once for seamless loop.
- `animation-play-state: paused` on hover (and on keyboard focus inside the marquee).
- Mixed tile heights (160px, 220px, 280px) cycled across photos for a rhythmic strip.

### Lightbox

- Reuses the existing logic from `MasonryGallery.tsx` (Esc closes, ←/→ navigate, focus trap, focus restoration to triggering button).
- Upgrade: shared-element transition. Each tile and the lightbox image share a Framer Motion `layoutId` so clicking smoothly animates the image from its grid position to the centered fullscreen view, and the reverse on close.
- Backdrop: `bg-ink/85`, `backdrop-blur-xl`, plus a subtle radial gradient for editorial depth.

## Reduced motion (`prefers-reduced-motion: reduce`)

All non-essential motion is suppressed:
- No parallax (inner images are static).
- No marquee animation (the strip becomes a horizontally scrollable static row with visible scrollbar / arrow controls).
- No entry blur, no entry translateY, no scale-in on heroes; tiles fade in only.
- Hover scale and number-slide are disabled.
- Lightbox shared-element transition reduces to a plain crossfade.

The gallery still functions: every photo is reachable, every photo opens in lightbox, navigation works.

`useReducedMotion()` from Framer Motion (already used in `MasonryGallery.tsx`) is the single source of truth.

## Mobile (`< 768px`)

- Mosaic collapses to 1 column. Tile aspect ratios are preserved.
- Mosaic-tile inner parallax reduces to 0.95x (almost imperceptible).
- Hero parallax stays at 0.85x (the cinematic moment is preserved on mobile).
- Marquee remains; it is well-suited to touch (natural swipe with momentum). Auto-scroll still runs; user touch interrupts it via `pointer-events`.
- Lightbox remains fullscreen with same controls.

## Component architecture

```
components/weddings/
  gallery/
    GalleryEditorial.tsx      orchestrator: loops the data, renders blocks
    GalleryMosaic.tsx         block: 3-col asymmetric grid, accepts N tiles
    GalleryHero.tsx           block: single full-bleed image with strong parallax
    GalleryMarquee.tsx        block: auto-scroll horizontal strip of all 16
    GalleryTile.tsx            tile: parallax inner, reveal, hover, index number
    GalleryLightbox.tsx        modal: shared-element transition, keyboard, focus
```

The old `components/weddings/MasonryGallery.tsx` is deleted. `app/[locale]/weddings/page.tsx` swaps the import:

```ts
// before
import { MasonryGallery } from "@/components/weddings/MasonryGallery";
// after
import { GalleryEditorial } from "@/components/weddings/gallery/GalleryEditorial";
```

`GalleryEditorial` walks `weddingPortfolio` and groups runs of `layout: "mosaic"` between `layout: "hero"` items into mosaic blocks, rendering each block in order, then a single `GalleryMarquee` at the end.

### Data shape

```ts
// data/wedding-portfolio.ts
export type PortfolioPhoto = {
  id: string;
  src: string;                              // /weddings/01.webp
  alt: { en: string; es: string };
  aspect: "4/5" | "1/1" | "16/9" | "3/4";
  layout: "mosaic" | "hero";
};
```

Order in the array directly determines render order. The expected layout sequence is `5 mosaic, 1 hero, 5 mosaic, 1 hero, 5 mosaic` (17 total). The marquee renders all 17 regardless of `layout`.

### Lightbox interaction model

- Click on any tile (mosaic, hero, or marquee) opens the lightbox at that photo's index in the global 17-photo array.
- Arrow keys cycle through all 17 (the lightbox does not respect block boundaries).
- The triggering button is captured at click time via a ref on the orchestrator so focus restores correctly across blocks.

## i18n

The existing `weddings.gallery.eyebrow`, `weddings.gallery.title`, `weddings.gallery.close`, `weddings.gallery.prev`, `weddings.gallery.next` keys are preserved. New keys added if needed:

- `weddings.gallery.marquee_label` — accessible label for the marquee region.
- `weddings.gallery.pause_marquee` / `resume_marquee` — visible control labels for keyboard users (only rendered when marquee region is keyboard-focused).

Alt text for each of the 17 photos is bilingual and concrete (e.g., `{ en: "Cascading garden-rose centerpiece", es: "Centro de mesa con rosas de jardín en cascada" }`). I write the alt text during implementation based on what each image actually shows.

## Performance

- All 17 images use `next/image`. The first mosaic and Hero 1 (visible above the fold or just below it) get `priority`. The rest lazy-load by default.
- `sizes` set per block: mosaic mobile `100vw`, mosaic desktop `33vw`, hero `100vw`, marquee `30vw`.
- Parallax uses transform-only animations with `will-change: transform` set on the moving inner image (compositor-thread, 60fps target).
- Marquee uses CSS keyframes (no per-frame JavaScript).
- IntersectionObserver thresholds tuned to fire reveals just before tiles scroll into view (no late-pop).

## Accessibility

- Every tile is a `<button type="button">` with a meaningful `aria-label` (the photo's `alt[locale]`).
- Lightbox uses `role="dialog"`, `aria-modal="true"`, focus moves to the close button on open, focus returns to the triggering tile on close. Esc closes; ←/→ navigate.
- Marquee uses `role="region"`, `aria-label={t("marquee_label")}`. When any element inside the marquee receives keyboard focus, the auto-scroll pauses and a visible Pause/Resume control appears.
- Reduced-motion users get a fully-functional gallery without animation, as detailed above.
- Color contrast for the index number meets WCAG AA against the photo (rendered on a small `bg-ink/40` chip if the underlying image is too light).

## Testing

### Unit (Vitest, `tests/unit/wedding-portfolio.test.ts`)

- The exported array has exactly 17 entries.
- The `layout` sequence is `[mosaic × 5, hero, mosaic × 5, hero, mosaic × 5]` exactly.
- Every `src` matches the pattern `/weddings/\d{2}\.webp`.
- Every `aspect` is one of the four allowed values.
- Every entry has non-empty `alt.en` and `alt.es`.

### Component (Vitest + RTL, `tests/unit/gallery-editorial.test.tsx`)

- Renders 17 images total (mosaics + heroes) plus 17 in the marquee (or 34 with the duplicate row — assert at least 17 unique `src` references).
- Clicking a mosaic tile opens the lightbox with that image's alt text rendered.
- Pressing Escape closes the lightbox and returns focus to the triggering button.
- With `prefers-reduced-motion` mocked to `reduce`, no parallax transforms are applied (assert via `style` attribute on the inner image not containing `translate3d`).

### E2E (Playwright, if pattern exists in repo)

- Smoke: visit `/en/weddings`, scroll to gallery, assert 17 images visible (eventually), click first tile, lightbox opens, press right arrow, image changes, press Esc, lightbox closes.

## Risks and mitigations

- **Parallax jank on low-end devices.** Mitigation: transform-only animation, `will-change`, hard cap of two simultaneous parallax elements at any time (the visible mosaic + nearest hero). If profiling shows issues, fall back to disabled parallax below a viewport-width threshold.
- **Marquee causing layout shift.** Mitigation: marquee container has fixed height, all images sized via `sizes` prop, no aspect-ratio surprises.
- **Hero full-bleed on ultrawide monitors.** Mitigation: cap inner image at `max-h-[90vh]` so a 21:9 monitor doesn't render a 600px-tall hero.
- **Image weight.** Seventeen webp images at decent quality should land under ~3.5MB total. If the originals from Downloads are heavier, run them through a one-time `sharp` resize during the copy step (max width 2400px, quality 82).

## Out of scope (future iterations)

- Adding a "Featured weddings" carousel of full case studies (one couple per slide with multiple photos and a quote).
- Tagging photos by occasion type (intimate / grand / outdoor) and offering filter chips.
- Video reels embedded in the marquee.
- A CMS-backed photo source so the team can add weddings without code changes.
