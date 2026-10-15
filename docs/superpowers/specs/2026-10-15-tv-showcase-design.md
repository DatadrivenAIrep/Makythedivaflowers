# TV showcase ("Vitrina") — Maky's arrangements on the shop Smart TV

**Date:** 2026-10-15 · **Branch:** `feat/tv-showcase` · **Status:** approved design

## Problem

The shop has a Smart TV (with a built-in browser) facing customers. Today it shows
nothing of the catalog. The owner wants it to show Maky's arrangements, one at a
time, with their name — so a walk-in customer can see the range, the price, and
order from their phone.

## Decisions (owner, 2026-10-15)

- **One piece at a time, gallery style** (not a grid, not an exported video).
- **Name in both languages:** English name large, Spanish name smaller below.
- **Price shown** as "From $X · Desde $X", plus a **small QR** in a corner.
- **Automatic selection with opt-out:** every eligible product shows by default;
  Maky can hide any product from the TV in Admin → Products.
- **Sympathy pieces hidden by default** (Maky can switch one on).
- Out of scope for v1: collection title cards, behind-the-scenes video clips.

## Route & access

- `app/[locale]/vitrina/page.tsx` — public, no login (it only shows public catalog
  data). The TV opens `https://<site>/en/vitrina` once and stays there.
- No site chrome: `LocaleChrome` treats `/<locale>/vitrina` like `/admin` (no
  TopNav, Footer, WelcomeOffer, cart toasts or Text-Maky trigger).
- Not indexed: page metadata `robots: { index: false, follow: false }` and
  `"vitrina"` added to `PRIVATE_PATHS` in `app/robots.ts`.
- `export const dynamic = "force-dynamic"` so each load reads current prices,
  photos, sales and visibility.
- The page renders both languages regardless of `[locale]`.

## Which products, in what order

Pure function `buildShowcase()` in `lib/tv-showcase.ts` (no DB access; inputs passed in):

1. Start from the catalog with **price overrides and image overrides applied**
   (same as the shop — never raw `PRODUCTS`).
2. Keep `active && !giftExtra && isInSeason(p)` (the shop's own eligibility).
3. **Photo quality gate (hard):** drop products whose cover has no entry in
   `data/product-image-dims.json` or whose cover height is `< MIN_COVER_HEIGHT`
   (900 px — the photo is drawn ~90% of a 1080-line screen). Not overridable:
   a pixelated photo on a large TV is worse than no photo. Image-override covers
   with unknown dims are dropped too.
4. **Visibility:** an explicit row in `tv_showcase_visibility` wins; otherwise
   default = `category !== "sympathy"`.
5. Order with `sortProducts(list, "recommended", { sales: getSalesRanking() })`
   — identical to the shop's "Recomendados".

Each `ShowcaseSlide`:
`{ id, slug, src, width, height, nameEn, nameEs, price: { en, es }, url }`
- `price`: lowest variant price → `From $85` / `Desde $85` (whole dollars without
  cents, `$1,080` with a thousands separator, cents kept when not whole).
  `quoteOnly` → `Made to order` / `Por encargo`.
- `url`: `${SITE.url}/en/product/<slug>?utm_source=tienda-tv&utm_medium=qr`.

The page server component adds `qr: string` (SVG data URI via
`lib/digital-card-qr.ts` `qrSvgDataUri`) to each slide.

## Visibility storage & admin toggle

- Migration `db/migrations/039_tv_showcase.sql`:
  `CREATE TABLE IF NOT EXISTS tv_showcase_visibility (product_id TEXT PRIMARY KEY,
  visible INTEGER NOT NULL, updated_at TEXT NOT NULL);` — idempotent (see the
  parallel-build migration race).
- `lib/tv-showcase-storage.ts` (server-only): `getTvVisibility(): Map<string, boolean>`,
  `setTvVisibility(productId, visible)`. A broken DB read falls back to an empty
  map (defaults apply) rather than a blank TV.
- API: `PUT /api/admin/tv-showcase` `{ productId, visible }` → 200 / 400 on unknown
  product or non-boolean. Admin-gated by `proxy.ts` like every `/api/admin/*`.
- Admin → Products (`ProductPricesPage`): per product an **"En la TV"** switch
  showing the effective state (row or default). Products failing the photo gate
  show a disabled switch labelled "Foto de baja resolución".

## Screen

Client component `components/tv-showcase/Showcase.tsx`, full viewport, sized in
`vw`/`vh` so it works at any TV resolution.

- Background plaster `#EDE8E0` (`bg-mute-100`), edge to edge.
- Left ~58%: the arrangement, whole photo (`object-contain`), bottom-anchored,
  ~90vh tall, slow zoom (CSS `transform: scale(1 → 1.05)` over the slide).
- Right: English name (brand serif, large), Spanish name (smaller, italic),
  price line, then a small QR (~12vh) with "Order · Pide aquí". Small Diva logo.
- Every **9 s** crossfade (opacity, 1.2 s) to the next slide; loops forever.
  The next photo is preloaded before its turn so the screen never flashes blank.
- Only `opacity`/`transform` animations — Smart-TV browsers (Tizen/webOS) are slow
  and old; no CSS masks, no backdrop filters.
- `cursor: none`; `navigator.wakeLock.request("screen")` when available (guarded).
- **Self-refresh every 30 min:** fetch the page URL first; reload only on a 200,
  so a Wi-Fi drop keeps the current slideshow running instead of an error page.
- Zero eligible slides → a centered logo card (never an empty screen).

## Testing

- Unit `tests/unit/tv-showcase.test.ts`: eligibility (inactive, giftExtra, out of
  season, sympathy default, explicit show/hide rows, photo gate), order follows
  sales, price labels (whole, thousands, cents, quoteOnly), URL with UTM.
- Unit for the API route validation and the `LocaleChrome` vitrina path.
- Migration: `rm data/diva.sqlite*` then `npm run build` (parallel-worker race).
- Browser: open `/en/vitrina` at 1920×1080, screenshot two consecutive slides,
  check no console errors; toggle a product off in admin and confirm it leaves
  the rotation after reload.
