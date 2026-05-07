# Mother's Day Home Showcase — Design Spec

**Date:** 2026-05-06
**Author:** Santiago + Claude
**Status:** Approved (pending implementation plan)
**Cutoff:** Mother's Day is Sunday 2026-05-10. Module retires at 2026-05-10T22:00:00Z (6 PM ET — matches the order cutoff in copy and on the hub `MothersDayCutoffBanner`).

## Problem

The homepage currently underweights Mother's Day. The only MD surface on `/[locale]` is `MothersDayHomeStrip` — a small dismissible top bar that disappears permanently once a visitor hits the "×". Hero is generic, bento highlights an evergreen product, and the rest of the page is unchanged. Four days from MD, the most important sales window of the year, the home page does not visually commit to it.

## Goal

Add a single, high-impact MD module that drives traffic to the curated MD collection — without disturbing the evergreen hero or the rest of the home page's editorial rhythm. Commerce-first (curated product grid, single CTA), editorial in tone, with a discrete countdown.

## Decisions (from brainstorming)

| Question | Choice |
|---|---|
| Hero handling | **Keep hero intact**; insert MD module below it |
| Module character | **Commercial showcase** (product grid dominates; countdown discreet; single CTA) |
| Position | **Right after Hero, before KineticMarquee** — first scroll block |
| Product count | **4 products** ("best of"), CTA links to full 8 at `/mothers-day` |
| Visual treatment | **Dark with rouge accent** — `bg-charcoal` + radial rouge wash; aligns with `/mothers-day` hub |
| Existing strip | **Remove** `MothersDayHomeStrip` from home; new module replaces it |

## Architecture

### New files
- `components/mothers-day/MothersDayHomeShowcase.tsx` — server component (default export). Reads `getTranslations`, looks up the 4 curated products from `data/products`, renders the section. Returns `null` if `Date.now() >= 2026-05-10T22:00:00Z` (Sun 6 PM ET cutoff) or if fewer than 2 curated products are resolvable.
- `components/mothers-day/MothersDayHomeCountdown.tsx` — small client island. Renders the countdown chip with live updates. Server-renders a static placeholder (`—d —h · order until Sun 6 PM`) to avoid layout shift before mount.
- `components/mothers-day/MothersDayHomeShowcaseTracker.tsx` — small client island. Fires `view_md_home_showcase` once per session via `IntersectionObserver` (mirror of `MothersDayViewTracker`).

### Modified files
- `app/[locale]/page.tsx` — remove `MothersDayHomeStrip` import + usage; add `MothersDayHomeShowcase` between `<Hero />` and `<KineticMarquee />`.
- `messages/en/mothers_day.json` — add `home_showcase` keys.
- `messages/es/mothers_day.json` — add `home_showcase` keys (parallel ES copy, warm/occasion-tailored).

### Untouched / deferred
- `components/mothers-day/MothersDayHomeStrip.tsx` — file remains in place but unused. Delete in a post-MD cleanup PR.

## Layout

Section renders within `<main>` after `<Hero />`. Full-width background, max-w-7xl inner container.

```
┌──────────────────────────────────────────────────────────────────┐
│  bg-charcoal + radial rouge accent (top-left, ~rgba .25)         │
│  border-t border-rouge/20                                        │
│                                                                  │
│   MOTHER'S DAY · MAY 10  [eyebrow rouge, mono, 10px, .25em]      │
│                                                                  │
│   For her, before Sunday.    [font-display 5xl–7xl, italic, bone]│
│   [Sub ~12-14 words, text-bone/80, max-w-xl]                    │
│                                                                  │
│   ⏱ 4d 02h · order until Sun 6 PM   [chip, mono, text-bone]      │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ product │  │ product │  │ product │  │ product │              │
│  │ image   │  │ image   │  │ image   │  │ image   │              │
│  │ name    │  │ name    │  │ name    │  │ name    │              │
│  │ $price  │  │ $price  │  │ $price  │  │ $price  │              │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘              │
│                                                                  │
│           [View the full Mother's Day collection →]              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Spacing
- Section: `py-20 md:py-28`
- Mobile: `py-14`, products in 2×2 grid, eyebrow/title/sub stacked vertical
- Desktop: 4-column product grid, content block left-aligned

### Typography & color
- Eyebrow: `font-mono text-[10px] uppercase tracking-[0.25em] text-rouge`
- Title: `font-display text-5xl md:text-6xl lg:text-7xl text-bone` with italic span on the emotional fragment
- Sub: `text-bone/80 max-w-xl leading-relaxed`
- Countdown chip: `bg-charcoal/40 border border-bone/15 backdrop-blur-sm rounded-full px-4 py-2 font-mono text-[11px] text-bone`
- Product card: `bg-bone/5 border border-bone/10 rounded-xl overflow-hidden hover:bg-bone/10 transition-colors`
  - Image: 4:5 aspect, object-cover
  - Name: `font-display text-lg text-bone`
  - Price: `font-mono text-sm text-bone/70`
- CTA: outline pill — `border border-bone/40 text-bone hover:bg-bone hover:text-ink rounded-full px-7 py-3.5`

### Background
```
bg-charcoal
+ radial-gradient(ellipse 50% 60% at 15% 0%, rgba(184,52,94,0.25) 0%, transparent 70%)
```
Mirror direction of the hero's rouge wash (hero is top-right; this is top-left) for visual variety while staying in the same palette.

## Content

### Curated products (4 of 8)
Suggested mix from existing `CURATED_SLUGS` in `app/[locale]/mothers-day/page.tsx`:
1. `angels-touch` — premium / flagship
2. `blush-enchantment` — pastel romantic
3. `pastel-poetry` — color story
4. `wildflower-meadow` — texture/editorial

Selection lives as a constant in `MothersDayHomeShowcase.tsx`. Easy to swap.

### i18n keys (`mothers_day.home_showcase`)

```json
{
  "eyebrow": "Mother's Day · May 10",
  "title": "For her, before Sunday.",
  "sub": "Hand-tied arrangements, delivered across Long Island.",
  "countdown_days": "{days}d {hours}h · order until Sun 6 PM",
  "countdown_hours": "{hours}h {minutes}m left · order until Sun 6 PM",
  "cta": "View the full Mother's Day collection"
}
```

ES copy proposal (warm, occasion-tailored — per memory `feedback_catalog_copy_voice`):
```json
{
  "eyebrow": "Día de la Madre · 10 de mayo",
  "title": "Para ella, antes del domingo.",
  "sub": "Arreglos hechos a mano, entregados en todo Long Island.",
  "countdown_days": "{days}d {hours}h · pedidos hasta domingo 6 PM",
  "countdown_hours": "{hours}h {minutes}m · pedidos hasta domingo 6 PM",
  "cta": "Ver la colección completa"
}
```

## Behavior

### Visibility window
- Module renders for any visit before `2026-05-10T22:00:00Z` (Sunday 6 PM ET — same as the cutoff in copy and on the hub `MothersDayCutoffBanner`).
- After that timestamp, server component returns `null`. Home reverts to its evergreen flow with no other change required.
- Note: this is 2 hours later than the existing `MothersDayHomeStrip.HIDE_AFTER_UTC_MS` (20:00Z / 4 PM ET). The spec aligns the hide-time with the actual cutoff so the module's own copy ("order until Sun 6 PM") doesn't contradict its visibility.

### Countdown
- Server renders a static placeholder: `—d —h · order until Sun 6 PM`.
- Client island mounts and replaces with live counter, updating every 60s (no need for per-second precision in a marketing module).
- Branch logic:
  - `>= 24h remaining`: `{days}d {hours}h · order until Sun 6 PM`
  - `< 24h remaining`: `{hours}h {minutes}m left · order until Sun 6 PM`
  - `<= 0`: server has already short-circuited, but defensive — render nothing.
- Deadline source: `2026-05-10T18:00:00-04:00` (Sun 6 PM ET — same value used by `MothersDayCutoffBanner` on the hub page).

### Edge cases
- **Missing product slug:** filter the curated array against `PRODUCTS`; if fewer than 2 resolve, return `null` (silent fallback over a half-empty grid).
- **Missing image:** trust the data-layer guarantee that every product has at least one image (same assumption as `BentoFeaturedTile`).
- **Reduced motion:** module has no animated transforms. Countdown updates a text node; nothing to gate behind `prefers-reduced-motion`.
- **SSR / hydration:** countdown island uses `useEffect` to set initial value; placeholder text on server matches placeholder on first client paint to avoid hydration mismatch.

## Analytics

Two events, namespaced consistently with existing MD events:

| Event | Trigger | Notes |
|---|---|---|
| `view_md_home_showcase` | Section enters viewport (50% threshold), once per session | Mirror of `MothersDayViewTracker`. Uses sessionStorage flag. |
| `click_md_home_showcase_cta` | Click on the bottom CTA pill | Standard click handler on the `<Link>`. |

Product card clicks inherit existing PDP-flow analytics — no new tracking added per card.

## Testing

### Unit
- `MothersDayHomeShowcase.test.tsx` — server component:
  - Renders all 4 products before cutoff.
  - Returns `null` after cutoff (mock `Date.now()`).
  - Returns `null` when fewer than 2 curated slugs resolve.
- `MothersDayHomeCountdown.test.tsx` — countdown formatting:
  - Days+hours branch (e.g., 96h remaining → `4d 0h`).
  - Hours+minutes branch (e.g., 6h 30m remaining).
  - Zero / negative remaining → empty render.

### Manual QA
- EN and ES locales, both render correctly.
- Mobile (2×2 grid) and desktop (4-column).
- Before cutoff: module visible, countdown counts down.
- After cutoff: DevTools clock override → module disappears, no other regressions.
- Product cards link to correct PDP slugs.
- CTA links to `/[locale]/mothers-day`.
- Lighthouse: no CLS regression (placeholder reserves countdown space).

## Out of scope

- Replacing the hero or its content.
- Modifying `BentoGrid`, `CategoryStrip`, or any other home section.
- Touching `/mothers-day` page — it stays as the canonical hub.
- Sticky mobile CTA on home (the hub already has one; home doesn't need it).
- Email/notification campaign tie-ins.
- Removing `MothersDayHomeStrip.tsx` file (deferred to post-MD cleanup).

## Definition of done

- `MothersDayHomeShowcase` renders below `<Hero />` on `/en` and `/es` before cutoff.
- `MothersDayHomeStrip` no longer imported/rendered on the home page.
- 4 curated products visible, each linking to its PDP.
- Countdown updates live; placeholder shown during SSR.
- After 2026-05-10T22:00:00Z, module returns `null` and home is unchanged.
- Both view and CTA-click analytics events fire.
- Unit tests pass; manual QA in EN/ES, mobile/desktop verified.
