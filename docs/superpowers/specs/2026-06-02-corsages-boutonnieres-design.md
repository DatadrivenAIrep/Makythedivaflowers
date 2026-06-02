# Corsages & Boutonnières Page — Design Spec
**Date:** 2026-06-02  
**Status:** Approved

---

## Overview

Replace the seasonal `/prom` page and its home tile with a year-round **Corsages & Boutonnières** section at `/corsages-boutonnieres`. The new page covers all occasions (weddings, prom, quinceañeras, graduations) without categorizing by occasion — occasions are mentioned only in the hero subtitle. The old `/prom` route redirects to the new URL.

---

## Problem

The current prom page frames corsages and boutonnières as prom-only, a single seasonal use case. In practice Diva Flowers sells these for weddings, quinceañeras, graduations, and other formal events. The prom framing limits the page's reach and leaves money on the table outside of prom season.

---

## Goals

- Make corsages/boutonnières visible and purchasable year-round
- Lead with real photos from the shop (gallery-first layout)
- Keep the same 4 products and prices — no new ordering logic needed
- Update the home BentoGrid tile to reflect all occasions

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| URL | `/corsages-boutonnieres` | Descriptive, occasion-neutral |
| Old `/prom` route | Redirect → `/corsages-boutonnieres` | Preserves any inbound links |
| Layout | Gallery-first: 3-photo collage hero → products → process → CTA | Real photos sell better than copy; same as approach B chosen in brainstorm |
| Occasions | Mentioned in hero subtitle only, not as categories | Clean, not cluttered; user decision C |
| Products | Same 4 (rose/orchid × corsage/boutonnière, same prices) | No change needed |
| Home tile | Replace `BentoPromTile` with `BentoCorsagesTile`, year-round | Removes seasonal framing |

---

## Architecture

### Route

New: `app/[locale]/corsages-boutonnieres/page.tsx`  
Retired: `app/[locale]/prom/page.tsx` — replaced with a `redirect()` to `/[locale]/corsages-boutonnieres`

### Data

`data/corsages-collection.ts` — replaces `data/prom-collection.ts`.  
Same `PromPiece` type (renamed `CorsagePiece`), same 4 items, updated image paths to `/corsages/`.

```ts
export type CorsagePieceId =
  | "rose-corsage"
  | "rose-boutonniere"
  | "orchid-corsage"
  | "orchid-boutonniere";

export type CorsagePiece = {
  id: CorsagePieceId;
  flower: "rose" | "orchid";
  type: "corsage" | "boutonniere";
  priceUSD: number;
  name: { en: string; es: string };
  description: { en: string; es: string };
  image: { src: string; alt: { en: string; es: string } };
};
```

### Photo assets

Real photos from `~/Downloads/Coursages/` (HEIC + PNG) → converted to WebP → placed in `public/corsages/`:
- `hero-1.webp`, `hero-2.webp`, `hero-3.webp` — 3 best photos for the collage hero
- `rose-corsage.webp`, `rose-boutonniere.webp`, `orchid-corsage.webp`, `orchid-boutonniere.webp` — product photos

### Components

All live under `components/corsages/`:

**`CorsagesHero.tsx`** — server component  
3-photo CSS grid collage (2fr left column, 1fr right column split into 2 rows). Dark gradient overlay. Text anchored bottom-left: eyebrow "Corsages · Boutonnières", large serif title, subtitle mentioning all occasions.

**`CorsagesPieces.tsx`** — server component  
2×2 product grid. Each card: photo (4:5 aspect), name, price, "Reserve this piece" button → opens `TextMakyModal` with corsage prefill. Adapted directly from `PromPieces`.

**`CorsagesHowItWorks.tsx`** — server component  
Dark `bg-ink` panel, 3 steps: tell us the date → we confirm and craft → pay at confirmation. Adapted from `PromHowItWorks` with copy updated for all occasions.

**`CorsagesCTA.tsx`** — server component  
Closing section: title + "Message Maky" button → `TextMakyModal`. Adapted from `PromCTA`.

**`BentoCorsagesTile.tsx`** — client component (replaces `BentoPromTile`)  
Home grid tile: hero photo background, badge "Corsages · Boutonnières", eyebrow "For every occasion", editorial title "The detail that completes the look.", CTA "View collection" → `/[locale]/corsages-boutonnieres`. No seasonal framing.

### i18n

New namespace `corsages.*` in `messages/en.json` and `messages/es.json`. The `prom.*` namespace is **kept** (not deleted) since it may still be referenced until the prom page is fully retired.

**`messages/en.json`** — new keys under `corsages`:
```json
"corsages": {
  "page_title": "Corsages & Boutonnières — Diva Flowers",
  "meta_description": "Corsages and boutonnières for weddings, prom, quinceañeras, graduations and every special occasion. Made fresh the day before.",
  "hero_eyebrow": "Corsages · Boutonnières",
  "hero_title": "For the moment that deserves it.",
  "hero_sub": "For weddings, prom, quinceañeras, graduations, and every special occasion.",
  "pieces_eyebrow": "The collection",
  "pieces_title": "Four pieces.",
  "reserve_this": "Reserve this piece",
  "how_eyebrow": "How it works",
  "how_title": "Made the day before. Fresh blooms for the photo.",
  "how_step1_title": "Tell us the date",
  "how_step1_body": "Message us with the date and occasion.",
  "how_step2_title": "We confirm and craft",
  "how_step2_body": "We assemble your piece the day before the event.",
  "how_step3_title": "Pay at confirmation",
  "how_step3_body": "Cash, Zelle, or Stripe link.",
  "cta_title": "Ready to reserve?",
  "cta_button": "Message Maky"
}
```

**`messages/en.json`** — updated keys under `home.bento`:
```json
"corsages": {
  "eyebrow": "For every occasion",
  "title": "The detail that completes the look.",
  "count": "4 pieces",
  "cta": "View collection"
}
```

Spanish equivalents in `messages/es.json`.

### Page integration

`components/home/BentoGrid.tsx` — swap `<BentoPromTile />` for `<BentoCorsagesTile />`.

### Contact prefill

`lib/contact-subject.ts` — add a `corsages` subject that prefills: *"I'd like to reserve a corsage or boutonnière."* / *"Quisiera reservar un corsage o boutonnière."*

---

## What does NOT change

- Ordering flow (TextMakyModal, Stripe/Zelle/cash)
- The 4 products and their prices
- `prom.*` i18n keys — kept but no longer used by any rendered page
- All other pages and sections of the site

---

## Out of scope

- Sub-pages per occasion
- Filtering by occasion or flower type
- Online cart checkout for corsages
- Removing the `prom.*` i18n keys (safe to do in a future cleanup)
