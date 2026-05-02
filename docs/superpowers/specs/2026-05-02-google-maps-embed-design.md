# Google Maps Embed — Home & Contact

**Date:** 2026-05-02
**Status:** Approved (pending implementation plan)

## Goal

Embed an interactive Google Map of the studio location on the home page (new "Visítanos" block) and replace the placeholder map image on the contact page with a real embed. Centralize address and map URLs in `data/site.ts` so the rest of the app (footer, future schema) stays consistent.

## Decisions

- **Address of record:** 1077 Willis Ave, Albertson, NY 11507. This replaces the current `1077 Hempstead Tpke, Franklin Square, NY 11010` in `data/site.ts`. Source: Google Maps listing for "Maky The Diva Flowers".
- **Embed mechanism:** Plain `<iframe>` from Google Maps "Share → Embed map → Copy HTML". No API key, no billing, no consent layer required for the basic place embed. Maps JavaScript API was rejected — no need for custom pins, styling, or programmatic interaction.
- **Home placement:** New `StudioVisit` block inserted in `app/[locale]/page.tsx` between `<WeddingsTeaser />` and `<NewsletterField />`.
- **Home layout:** Editorial 2-column grid matching the density of `EditorialSplit` / `WeddingsTeaser`. Map left, copy + CTAs right.
- **Contact page:** Replace `picsum.photos` placeholder image inside `components/contact/StudioMap.tsx` with the real iframe. Keep wrapper, aspect ratio, and floating address chip.

## Data changes — `data/site.ts`

Replace the `address` object and add a new `map` object:

```ts
address: {
  line1: "1077 Willis Ave",
  locality: "Albertson",
  region: "NY",
  postal: "11507",
  country: "USA",
},
map: {
  // Keyless embed: encodes the address as the place query, output=embed
  // returns the iframe-friendly view. Works without API key or billing.
  embedSrc: "https://maps.google.com/maps?q=1077+Willis+Ave%2C+Albertson%2C+NY+11507&t=m&z=16&output=embed",
  // Opens turn-by-turn directions in Google Maps with the place pre-selected.
  directionsHref: "https://www.google.com/maps/dir/?api=1&destination=1077+Willis+Ave%2C+Albertson%2C+NY+11507",
},
```

Both URLs are derived deterministically from the address; no manual copy/paste from Google Maps required. If we later want the richer "Embed map" iframe (with the place card, photo, etc.), we can swap `embedSrc` for the `https://www.google.com/maps/embed?pb=...` form Google generates from "Share → Embed map → Copy HTML".

## New component — `components/home/StudioVisit.tsx`

Server component. Imports `SITE` from `@/data/site`, `getTranslations` from `next-intl/server`. Layout:

- Outer section with the same vertical rhythm and horizontal padding as `WeddingsTeaser` / `EditorialSplit` (match existing classes — do not introduce a new spacing system).
- Two-column grid (`lg:grid-cols-2`, generous `gap`).
- **Column 1 (map):** Wrapper `relative aspect-[4/3] overflow-hidden rounded-2xl` containing an `<iframe>` with:
  - `src={SITE.map.embedSrc}`
  - `title={t("mapTitle")}` (a11y)
  - `loading="lazy"`
  - `referrerPolicy="no-referrer-when-downgrade"`
  - `className="absolute inset-0 h-full w-full border-0"`
  - No `allowFullScreen` (not needed).
- **Column 2 (copy + CTAs):**
  - Eyebrow: `font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60` — `t("eyebrow")`.
  - Title: `font-display` size matching peer sections — `t("title")`.
  - Address block: two lines from `SITE.address` (`line1` / `locality, region postal`).
  - Hours: rendered from `SITE.hours` (existing shape: `{ day, value }[]`), label from `t("hoursLabel")`.
  - Phone: `SITE.phoneDisplay`.
  - Two CTAs:
    - "Cómo llegar / Get directions" → `<a href={SITE.map.directionsHref} target="_blank" rel="noreferrer">` — `t("directionsCta")`.
    - "Llamar / Call" → `<a href={SITE.phoneHref}>` — `t("callCta")`.
  - Buttons reuse the existing button/link styling already used elsewhere on the home (no new variants).

### i18n keys

New namespace `home.studio` in both `messages/en.json` and `messages/es.json`:

- `eyebrow`
- `title`
- `hoursLabel`
- `directionsCta`
- `callCta`
- `mapTitle` (used as `<iframe title>` for screen readers)

Spanish copy follows the warm, occasion-tailored voice already used in catalog/home (per memory).

## Home page wiring — `app/[locale]/page.tsx`

Import `StudioVisit` and render it between `WeddingsTeaser` and `NewsletterField`:

```tsx
<WeddingsTeaser locale={locale} />
<StudioVisit locale={locale} />
<NewsletterField />
```

## Contact page — `components/contact/StudioMap.tsx`

Rewrite to use the real iframe:

- Keep the outer `<a>` wrapper opening `SITE.map.directionsHref` in a new tab — it preserves the click-to-directions behavior already in place.
- Inside, the same `relative aspect-[4/3] overflow-hidden` wrapper.
- Replace the `<Image src="https://picsum.photos/...">` with an `<iframe>` using the same props as in `StudioVisit` (src, title, loading, referrerPolicy, absolute fill, border-0).
- Keep the floating address chip overlay; update its text to read from `SITE.address` rather than a hardcoded string.
- Note on click semantics: an iframe inside an anchor does not reliably propagate clicks (the iframe captures pointer events). To preserve the "click anywhere on the map → open directions" behavior, add a sibling element above the iframe (`absolute inset-0 z-10` with `pointer-events-auto`) that is the actual click target, OR drop the outer anchor and rely on the chip + a dedicated "Get directions" link below the map. **Decision:** drop the outer anchor; add a small "Cómo llegar / Get directions" link under the map. Cleaner, accessible, and avoids fighting the iframe's pointer behavior.

## Address consistency sweep

After updating `data/site.ts`:

- `components/nav/Footer.tsx` already reads `SITE.address.*` — updates automatically.
- Search the repo for any hardcoded `"Hempstead"`, `"Franklin Square"`, `"11010"` strings (e.g., metadata, JSON-LD, sitemap, schema) and replace with `SITE.address` references or the new values.
- Verify no `.env`, robots, or sitemap files reference the old address.

## Out of scope

- Google Maps JavaScript API integration, custom pins, custom map styling.
- A generic `<MapEmbed>` component — only two consumers, no abstraction needed.
- Cookie/consent banner (basic place embed does not require it; reassess if/when we move to JS API).
- Geocoding, distance calculations, store locator UI.

## Testing / verification

- Visual: home renders the new block in the right slot; contact page shows the real map; both responsive at sm/md/lg.
- a11y: iframe has a `title`; CTAs have accessible labels; the contact-page address chip remains readable.
- Functional: "Get directions" CTA opens Google Maps with the correct destination in a new tab; "Call" CTA triggers `tel:` on mobile.
- No console errors, no hydration warnings, no layout shift from the iframe (aspect ratio reserves space).
- Footer renders the new address.

## Files touched (expected)

- `data/site.ts` — address + new `map` object.
- `components/home/StudioVisit.tsx` — **new**.
- `app/[locale]/page.tsx` — import + render.
- `components/contact/StudioMap.tsx` — replace placeholder image with iframe; restructure click target.
- `messages/en.json`, `messages/es.json` — new `home.studio` namespace.
- Any file with hardcoded old address (sweep result).
