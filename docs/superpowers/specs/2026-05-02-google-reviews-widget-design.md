# Google Reviews Widget — Design

**Date:** 2026-05-02
**Status:** Draft for review
**Owner:** Santiago

## Goal

Add a social-proof block to the home page that surfaces curated 5-star Google reviews of Diva Flowers in a modern, brand-aligned format, and link out to the full Google profile. Increases mid-funnel conversion by validating the brand right after visitors see categories/products.

## Scope

**In scope:**
- New `GoogleReviews` section component for the home page.
- Static curated review data (`data/reviews.ts`) — provided by Maky/Santiago.
- Bilingual reviews (en + es) with "Translated / View original" toggle.
- Auto-rotating hero quote with manual navigation, keyboard support, accessibility, and reduced-motion fallback.
- Schema.org `AggregateRating` + `Review` JSON-LD for SEO.
- Outbound CTA to the public Google reviews profile.

**Out of scope (future):**
- Live Google Places API integration.
- Dedicated `/reviews` page.
- Reviews shown on product pages or in the cart/checkout.
- User-generated review submission.

## Placement

The widget mounts in the home page between `CategoryStrip` and `EditorialSplit`. This position validates the brand right after the visitor sees products, before they invest scroll-depth — the strongest mid-funnel social-proof slot, especially for mobile users who rarely reach the bottom of the page.

Final home order:
```
Hero → KineticMarquee → BentoGrid → CategoryStrip
   → GoogleReviews         ← new
   → EditorialSplit → WeddingsTeaser → NewsletterField
```

## File structure

```
data/reviews.ts                              source of truth (curated)
components/home/GoogleReviews.tsx            server component (data + i18n + JSON-LD)
components/home/GoogleReviewsClient.tsx      client (rotation, navigation, translate toggle)
components/home/GoogleReviewsCard.tsx        pure presentation (card body)
messages/en.json, messages/es.json           home.reviews.* keys
app/[locale]/page.tsx                        slot the section in
tests/unit/reviews.test.tsx                  unit tests
```

Each file has one responsibility: data is decoupled from presentation, server work is decoupled from interaction, the card is reusable for a future `/reviews` page.

## Data model

```ts
// data/reviews.ts
export type Review = {
  id: string;                          // slug, e.g. "jessica-morales-2026-04"
  author: string;                      // "Jessica Morales"
  initials: string;                    // "JM" — used for the gradient avatar
  rating: 5;                           // always 5 (curated set)
  occasion?: string;                   // "Boda" | "Funeral" | "Aniversario" | …
  date: string;                        // ISO YYYY-MM (absolute, not relative)
  text: { en: string; es: string };    // both languages provided
  originalLang: "en" | "es";           // determines whether the "Translated" chip appears
};

export const REVIEWS_AGGREGATE = {
  rating: 4.9,                         // updated manually as Google profile changes
  total: 127,
  placeUrl: "https://g.page/r/...",    // outbound link target
} as const;

export const REVIEWS: Review[] = [/* 7 entries */];
```

Design decisions:
- **Absolute dates (`YYYY-MM`)** — relative dates ("hace 2 semanas") become false within weeks for a static set. Display format: `"Abril 2026 · Boda"`.
- **Bilingual `text`** — both versions are authored. The widget shows the locale-matching version by default, and a "Translated · view original" chip lets the user flip to `originalLang`.
- **Curated five-star only** — non-five-star or single-line filler is filtered upstream by the curator, not the component.
- **Aggregate is editable independently** — `total` and `rating` can be refreshed without touching reviews.

## Component anatomy (V1 brutalist editorial)

```
section py-24 md:py-32 (bone)
└── max-w-[1400px] mx-auto px-6
    └── container · rounded-[var(--radius-bento)] · border-mute-100 · padding 36px md:48px
        ├── HEADER ROW
        │   ├── eyebrow (mono, mute-500)        "★ Reseñas en Google"
        │   ├── rating block                    4.9 ★★★★★ /127
        │   │   └── 4.9 in font-display italic, 54-72px, WONK 1 SOFT 70
        │   └── verified chip (right)           [G logo] Verificadas
        ├── QUOTE BLOCK (animated crossfade)
        │   └── Inter 32-44px · weight 400 · tracking -0.035em · max-width ~22ch
        ├── FOOTER ROW (border-top mute-100)
        │   ├── avatar (gradient petal→rouge-glow) + name + date · occasion
        │   ├── translate chip (conditional)
        │   └── nav arrows ← →
        ├── PROGRESS BAR (7 segments, animated active fill)
        └── outbound CTA                        "→ Leer todas las 127 reseñas en Google"
```

Brand tokens used (no new tokens):
- `bg-bone`, `border-mute-100`, `radius-bento` — matches existing blocks.
- Eyebrow: `font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500`.
- Rating: `font-display` italic with `fontVariationSettings: "'WONK' 1, 'SOFT' 70"` (matches home h2 style).
- Quote: `font-sans` (Inter) — the deliberate "modern" contrast against the display italic; not Playfair italic.
- Avatar: `linear-gradient(135deg, var(--color-petal), var(--color-rouge-glow))` over white initials.
- Stars: `text-rouge` (`#B8345E`) — brand red, not Google yellow.
- Verified chip: subtle pill with the real Google G as a `conic-gradient` (4 brand colors) + "Verificadas" in mono.
- Outbound CTA: mono, `mute-500` → `ink` on hover.

Responsive:
- `md+`: full layout above.
- `<md`: padding `28px 24px`, rating 44px, quote 24-28px, header stacks vertically (eyebrow + rating, then verified chip on its own line), arrows 32px.

Transitions:
- Crossfade + 8px slide-up between reviews using Framer Motion (already a project dep), 350ms, soft easing.
- The container reserves `min-height` based on the longest quote to avoid layout shift.

## Behavior

**Autoplay:**
- 7 seconds per review, infinite loop, starts on slide 1.
- Progress bar (7 segments) animates the active segment left-to-right over 7s.
- Pauses when:
  - Pointer is over the section.
  - Keyboard focus is within the section.
  - The section is outside the viewport (IntersectionObserver).
- Disabled entirely under `prefers-reduced-motion: reduce`. The user navigates manually; progress bar shows segments as discrete states (no animation).

**Manual navigation:**
- `←` and `→` round buttons on the footer right (`→` filled `ink`, `←` outlined `mute-100`).
- Click on any progress segment jumps to that review.
- Keyboard: `←` / `→` change review; `Space` toggles play/pause; `Tab` moves focus through arrows and CTA.

**Translation toggle:**
- If active locale ≠ `review.originalLang`, a small chip appears under the author: "Translated · view original" / "Traducida · ver original".
- Click toggles `text.en` ↔ `text.es` for that slide only. State resets on slide change.

**Outbound CTA:**
- "Read all {count} reviews on Google" — opens `REVIEWS_AGGREGATE.placeUrl` in a new tab with `target="_blank" rel="noopener noreferrer"`.

## Accessibility

- `<section aria-label="Customer reviews">`.
- Each review wrapped in `<article role="group" aria-roledescription="review" aria-current={isActive ? "true" : undefined}>`.
- `aria-live="polite"` region announces author + occasion when the active review changes.
- Buttons (prev, next, play/pause, translate, segment) all have translated `aria-label`s.
- Star rating uses an `aria-label` like `"Rated 5 out of 5 stars"`; visual stars are `aria-hidden`.
- Focus ring uses the project's existing token (no new token).

## SEO / structured data

The server component injects JSON-LD inside the section:

```jsonc
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Diva Flowers",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.9,
    "reviewCount": 127
  },
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Jessica Morales" },
      "datePublished": "2026-04",
      "reviewBody": "...",
      "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 }
    }
    // …7 entries
  ]
}
```

This makes the home eligible for rich-snippet stars in SERP and reinforces local-SEO signals together with the outbound link to the Google profile.

## i18n keys

```
home.reviews.eyebrow        "★ Google Reviews" / "★ Reseñas en Google"
home.reviews.verified       "Verified" / "Verificadas"
home.reviews.read_all       "Read all {count} reviews on Google" / "Leer todas las {count} reseñas en Google"
home.reviews.translated     "Translated · view original" / "Traducida · ver original"
home.reviews.original       "Showing original" / "Mostrando original"
home.reviews.aria.section   "Customer reviews" / "Reseñas de clientes"
home.reviews.aria.next      "Next review" / "Siguiente reseña"
home.reviews.aria.prev      "Previous review" / "Anterior reseña"
home.reviews.aria.play      "Play autoplay" / "Reanudar reproducción"
home.reviews.aria.pause     "Pause autoplay" / "Pausar reproducción"
home.reviews.aria.goto      "Go to review {n}" / "Ir a la reseña {n}"
home.reviews.date_format    "{month} {year}" with month names from translations
```

## Performance

- Server component renders the first slide as static HTML — no LCP cost.
- Client hydration only for the rotation logic; estimated <4 KB gzipped.
- Avatars are pure CSS (gradient + initials) — no image requests.
- IntersectionObserver halts the timer when the section leaves the viewport.

## Testing

`tests/unit/reviews.test.tsx` covers:

1. Renders the first review on mount, with the correct author, stars, and date format.
2. Click `→` advances to the next review; wraps from last to first.
3. Click `←` goes back; wraps from first to last.
4. Keyboard `→` / `←` mirror the click behavior; `Space` toggles play/pause.
5. Hover and focus pause the autoplay (verified by mocking timers).
6. `prefers-reduced-motion: reduce` (mocked via `matchMedia`) disables autoplay.
7. When locale is `es` and `originalLang` is `en`, a "Translated" chip appears; clicking it swaps to `text.en` for that slide only and resets after navigating.
8. Outbound CTA has `target="_blank" rel="noopener noreferrer"` and points to `REVIEWS_AGGREGATE.placeUrl`.
9. JSON-LD is rendered with `AggregateRating` and 7 `Review` entries.
10. ARIA: section has `aria-label`; the active review has `aria-current="true"`.

## Inputs needed from the user

1. Seven curated five-star reviews. For each: author full name, original text, original language (`en` / `es`), translation into the other language, month/year (YYYY-MM), occasion (one short word).
2. Aggregate rating and total review count from the live Google profile.
3. Public URL of the Google profile / reviews page.

## Open questions

None at the time of writing — all conceptual and visual choices were validated during brainstorming. If the inputs reveal a review longer than ~280 characters, the `min-height` strategy will need re-evaluation; this will be addressed in implementation.
