# Wedding Stories Gallery — Design Spec
**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

Replace the current flat `GalleryEditorial` carousel on the weddings page with a per-event portfolio section called **Wedding Stories**. Each wedding appears as a full-bleed split card (photo alternating left/right with a dark info panel). Clicking any card opens a lightbox scoped to that wedding's photos.

---

## Problem

The current `GalleryEditorial` component displays 17 photos in an undifferentiated carousel. There is no way to understand which photos belong to which wedding, when they were shot, or where. The section lacks narrative — it reads as a generic stock gallery rather than a portfolio of real client work.

---

## Goals

- Show each wedding as a distinct event with venue and date
- Make it easy for a visitor to browse all photos from one wedding
- Feel modern and editorial, not like a generic image grid
- Support 2–5 weddings initially, easy to add more over time

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Per-event layout | Split alternating cards | Creates visual rhythm in scroll; classic in photography portfolios |
| Expanded view | Lightbox / modal | User stays on page; reuses existing lightbox infrastructure |
| Metadata per wedding | Venue name + date | What the user has; enough for a clean, informative card |
| Photo organization | Subfolder per wedding in `public/weddings/` | Clear, predictable, easy to maintain |

---

## Architecture

### Data model

New file: `data/wedding-events.ts`

```ts
export type WeddingEvent = {
  id: string;                    // slug, e.g. "westbury-oct-2024"
  venue: { en: string; es: string };
  date: { en: string; es: string }; // formatted display date
  heroPhoto: string;             // path to hero image shown on card
  photos: {
    src: string;
    alt: { en: string; es: string };
    aspect: "4/5" | "1/1" | "16/9" | "3/4" | "4/3";
  }[];
};

export const weddingEvents: WeddingEvent[] = [ /* populated by user */ ];
```

The existing `data/wedding-portfolio.ts` flat array is **retired** — it will no longer be imported anywhere once `WeddingStories` is in place.

### Photo folder structure

```
public/
  weddings/
    westbury-oct-2024/
      hero.webp
      01.webp
      02.webp
      ...
    garden-city-jun-2024/
      hero.webp
      01.webp
      ...
```

One subfolder per wedding, named `{venue-slug}-{mon}-{year}`. All images converted to `.webp` before adding.

### Components

**`components/weddings/WeddingStories.tsx`** — `"use client"` (matches `GalleryEditorial` pattern)  
- Holds `activeEventId: string | null` state
- Uses `useTranslations("weddings.stories")` for section header copy
- Reads `weddingEvents` from `data/wedding-events.ts`
- Renders section header + one `WeddingStoryCard` per event + `WeddingLightbox`

**`components/weddings/WeddingStoryCard.tsx`** — client component  
- Props: `event: WeddingEvent`, `index: number`, `locale: Locale`, `onOpen: (id: string) => void`
- Layout: `grid-cols-[3fr_2fr]` for even index, `grid-cols-[2fr_3fr]` for odd (reverse)
- Photo panel: `next/image` fill, `object-cover`, hover scale via Framer Motion
- Info panel: dark `bg-ink`, venue name as primary heading (large serif, `text-bone`), venue also shown as mono eyebrow in `text-petal`, date below, "ver galería →" CTA
- Photo count badge (absolute, bottom-right of photo panel)
- Entrance animation: `whileInView` opacity + translateY, staggered by index

**`components/weddings/WeddingLightbox.tsx`** — client component  
- Adapts existing `GalleryLightbox` pattern but scoped to one `WeddingEvent`'s photos
- Props: `event: WeddingEvent | null`, `locale: Locale`, `onClose: () => void`
- Full-screen overlay (`fixed inset-0 bg-ink/90 backdrop-blur-sm`)
- Top bar: venue + date tag (left), close button (right)
- Main photo: large, with prev/next arrows and `N / total` counter
- Thumbnail strip: scrollable row of small photos, active thumb highlighted with `border-petal`
- Keyboard nav: ArrowLeft/ArrowRight, Escape to close
- Respects `prefers-reduced-motion`

### Page integration

`app/[locale]/weddings/page.tsx` — one import swap:

```diff
- import { GalleryEditorial } from "@/components/weddings/gallery/GalleryEditorial";
+ import { WeddingStories } from "@/components/weddings/WeddingStories";

  ...
- <GalleryEditorial locale={locale} />
+ <WeddingStories locale={locale} />
```

The existing `GalleryCarousel`, `GalleryEditorial`, and `GalleryLightbox` components in `components/weddings/gallery/` are **deleted** — they are only used by the weddings page and will have no remaining consumers.

### i18n additions

In `messages/en.json` and `messages/es.json`, under the `weddings` namespace:

```json
"stories": {
  "eyebrow": "Portfolio",
  "title": "Our work, wedding by wedding.",
  "photo_count": "{count} photos",
  "open_label": "View gallery",
  "close": "Close gallery",
  "prev": "Previous photo",
  "next": "Next photo"
}
```

Spanish equivalent in `es.json`.

---

## Photo import workflow

Before implementation can be tested end-to-end, the user must:

1. Export photos from phone/cloud organized by wedding
2. Convert to `.webp` (use `cwebp` or Squoosh)
3. Place in `public/weddings/{slug}/` subfolders
4. Populate `data/wedding-events.ts` with the correct paths and metadata

The component will render correctly with placeholder data (picsum URLs) during development and can be swapped for real paths once photos are ready.

---

## What does NOT change

- `WeddingsHero`, `ProcessStrip`, `PricingIntent`, `WeddingsFAQ`, `WeddingsForm` — untouched
- Inquiry flow and form — untouched
- All other sections of the site — untouched

---

## Out of scope

- Sub-pages per wedding (e.g. `/weddings/westbury-oct-2024`)
- Filtering or search across weddings
- Video content
- Client login / private galleries
