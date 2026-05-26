# Prom Collection on Home — Design Spec

**Date:** 2026-05-25
**Locale scope:** `en` + `es` (bilingual, like rest of site)
**Approach:** Hybrid B+C tile (variant H1) on home + dedicated `/[locale]/prom` landing
**Order channel:** WhatsApp/SMS/Phone via existing `TextMakyModal` (no cart / no PDPs)

---

## 1. Context & Goals

### Why
- Mother's Day 2026 campaign window has closed (`MothersDayHomeStrip` still mounted on home). We want the home featured slot to reflect the next live occasion: **prom season**.
- Diva Flowers offers four prom pieces — pricing already set by owner:
  - Rose corsage — **$35**
  - Rose boutonnière — **$15**
  - Orchid corsage — **$45**
  - Orchid boutonnière — **$25**
- Photos exist offline and will be uploaded after this work lands (owner confirmed).

### Goals
1. Remove the now-expired `MothersDayHomeStrip` from home.
2. Repurpose the home's featured Bento slot to surface all four prom pieces with prices, in the home's editorial style.
3. Send interested visitors to a dedicated, short prom landing that triggers the existing `TextMakyModal` (WhatsApp/SMS/Phone) — coordination of color/date happens in-message, not via cart.
4. Stay reversible: when prom season ends, swap the tile back to the previous `BentoFeaturedTile` (kept in repo) without touching anything else.

### Non-goals
- No new product entries in `data/products.ts`. Prom pieces are time-bound and require color/date coordination — they live in their own data file.
- No cart, no checkout, no Stripe link for prom pieces.
- No mega-menu / mobile-drawer entry. Discovery is via the home tile and direct URL only.

---

## 2. Architecture Overview

```
app/[locale]/page.tsx
  └─ <BentoGrid />
        └─ <BentoPromTile />  ← NEW (replaces BentoFeaturedTile in this slot)

app/[locale]/prom/page.tsx  ← NEW
  ├─ <PromHero />
  ├─ <PromPieces />          (anchors: #rose-corsage, #rose-boutonniere, #orchid-corsage, #orchid-boutonniere)
  ├─ <PromHowItWorks />
  └─ <PromCTA />              (opens TextMakyModal via ContactContext)

data/prom-collection.ts      ← NEW (single source of truth, 4 pieces + i18n copy)

lib/contact-subject.ts       ← edit (add "prom" SubjectKey + path rule)
messages/en.json             ← edit (add prom block + subjects.prom)
messages/es.json             ← edit (add prom block + subjects.prom)

components/mothers-day/MothersDayHomeStrip.tsx  ← kept in repo, unmounted
components/home/BentoFeaturedTile.tsx           ← kept in repo, unmounted
```

### Data flow
- `data/prom-collection.ts` exports `PROM_PIECES: PromPiece[]` (typed) — read by both `BentoPromTile` (home) and `PromPieces` (landing).
- Marketing copy ("Prom · 2026", "Limited season", "Reserve →", section titles) lives in `messages/{en,es}.json` under `home.bento.prom.*` and `prom.*`.
- Piece-level copy (name, description, alt text) lives **inside** `data/prom-collection.ts` as `{ en, es }` objects — keeps the four pieces fully self-contained.
- The `prom` subject for `TextMakyModal` is resolved by pathname in `lib/contact-subject.ts` (`/prom` → `{ key: "prom" }`). When the user opens the modal on `/[locale]/prom`, the modal automatically prefills the prom message.

---

## 3. Home Page Changes (`app/[locale]/page.tsx`)

**Diff:**
- Remove `import { MothersDayHomeStrip } from "@/components/mothers-day/MothersDayHomeStrip";`
- Remove `<MothersDayHomeStrip locale={locale} />` (currently on line 46).

**`components/home/BentoGrid.tsx`:**
- Remove `import { BentoFeaturedTile }` and the `FEATURED_SLUG` / `featured` lookup.
- Add `import { BentoPromTile } from "./BentoPromTile";`.
- Replace the contents of the first grid cell:
  ```tsx
  <div className="md:col-span-2 md:row-span-3">
    <BentoPromTile locale={locale} />
  </div>
  ```
- The remaining tiles (LiveStatus, Subscriptions, StudioClock, Press) stay untouched.

**Files kept but unmounted:** `BentoFeaturedTile.tsx` and `MothersDayHomeStrip.tsx`. Both remain on disk so post-prom-season reversal is a one-import swap. No dead-code cleanup in this scope.

---

## 4. `BentoPromTile.tsx` (new component)

**File:** `components/home/BentoPromTile.tsx`
**Type:** Server component (async, reads translations via `getTranslations`). No client-side animation (the parent grid already provides motion via `BentoGrid`'s siblings; this tile stays calm to let the four pieces breathe).

**Layout (variant H1):** vertical tile, fills `md:col-span-2 md:row-span-3` slot. Three vertical zones inside a single rounded container:

1. **Header (top, ~20% of height)** — `bg-petal` background:
   - Top row: `Prom · 2026` (left) · `4 pieces` (right). Both `font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60`.
   - Title: `t("home.bento.prom.title")` (e.g. "For the night they remember") — `font-display italic text-3xl md:text-5xl tracking-tighter leading-[0.9]`.

2. **Grid 2×2 (middle, ~65% of height)** — 8px gap, rounded inner cells:
   - Each cell is a `<Link href={`/${locale}/prom#${piece.id}`}>`.
   - Inside the cell:
     - Image (`<img>` with `object-cover` filling the cell) — `src` from `data/prom-collection.ts`.
     - **Fallback:** if image fails to load (or to render before photos are uploaded), the cell shows a CSS gradient matching the flower type: rose → `from-[#e89aa6] to-[#c45f72]`, orchid → `from-[#b4a4d4] to-[#6e5b9c]`. Implemented via `bg-gradient-to-br` on the cell with the `<img>` layered on top + `onError` swap to `data-fallback="true"`. (Simpler alternative: ship gradient backgrounds always, layer image on top with `object-cover`; if image 404s, gradient remains visible. We use this — fewer state changes.)
     - Bottom strip of cell: `bg-petal` with name (`font-mono text-[10px] uppercase tracking-[0.12em]`, left) and price (`font-mono text-[12px] font-semibold`, right).
   - Cell order matches `PROM_PIECES` array order: rose corsage, rose boutonnière, orchid corsage, orchid boutonnière.

3. **Footer (bottom, ~15% of height)** — `bg-petal`:
   - Left: `t("home.bento.prom.limited")` (e.g. "Limited season") — mono uppercase.
   - Right: `<Link href={`/${locale}/prom`}>` with CTA "Reserve →" / "Reservar →" in italic display font.

**Accessibility:**
- Each cell `<Link>` has `aria-label={`${piece.name[locale]} — $${piece.priceUSD}`}` so screen readers announce both name and price.
- Image `alt` from `piece.image.alt[locale]`. If no photo yet (placeholder gradient), alt is the piece name plus "(photo coming soon)".
- Color contrast: the bottom strip is `bg-petal` with `text-ink`, well above WCAG AA (this matches existing tile-bottom patterns).

---

## 5. `/[locale]/prom` Landing

**File:** `app/[locale]/prom/page.tsx` — mirrors `app/[locale]/sympathy/page.tsx` structure.

```tsx
export default async function PromPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD items={[
        { name: locale === "es" ? "Inicio" : "Home", href: `/${locale}` },
        { name: "Prom", href: `/${locale}/prom` },
      ]} />
      <Grain />
      <PromHero locale={locale} />
      <PromPieces locale={locale} />
      <PromHowItWorks locale={locale} />
      <PromCTA locale={locale} />
    </main>
  );
}
```

**`generateMetadata`:** bilingual title/description, canonical `/${locale}/prom`, alternates `en` and `es`.

### 5.1 `PromHero.tsx`
- Full-bleed section, ~70vh, `bg-petal` background.
- Eyebrow: `Prom · 2026`.
- H1: same as tile (`prom.hero.title`).
- Sub: one sentence (`prom.hero.subtitle`).
- CTA button: opens `TextMakyModal` via `useContactContext().setOpen(true)`.

### 5.2 `PromPieces.tsx`
- Grid of 4 large cards (2×2 on desktop, 1 column on mobile).
- Each card: `id={piece.id}` (anchor target from home tile), photo (with same gradient fallback), name (display italic), description (2 lines), price.
- No "add to cart" — each card has a small "Reserve this piece" link that **opens the same modal** with a piece-specific override (extend `ContactOverride` to support `{ kind: "prom-piece"; pieceName: string }` so the prefill includes the specific piece name).

### 5.3 `PromHowItWorks.tsx`
- Three numbered steps, mono labels + short copy. Suggested copy:
  1. **Tell us the night.** Date, color of the dress / tux, pickup or delivery.
  2. **We confirm and craft.** Day-before assembly so blooms are fresh for photos.
  3. **Pay at confirmation.** Cash, Zelle, or Stripe link by message.

### 5.4 `PromCTA.tsx`
- Closing section with single large button → `TextMakyModal`.
- Repeats the eyebrow `Limited season` to reinforce urgency.

---

## 6. Data file (`data/prom-collection.ts`)

```ts
export type PromPieceId =
  | "rose-corsage"
  | "rose-boutonniere"
  | "orchid-corsage"
  | "orchid-boutonniere";

export type PromPiece = {
  id: PromPieceId;
  flower: "rose" | "orchid";
  type: "corsage" | "boutonniere";
  priceUSD: number;
  name: { en: string; es: string };
  description: { en: string; es: string };
  image: {
    src: string;
    alt: { en: string; es: string };
  };
};

export const PROM_PIECES: PromPiece[] = [
  {
    id: "rose-corsage",
    flower: "rose",
    type: "corsage",
    priceUSD: 35,
    name: { en: "Rose corsage", es: "Corsage de rosa" },
    description: {
      en: "Three garden roses on the wrist, soft and steady. Pairs with any dress color.",
      es: "Tres rosas de jardín en la muñeca, suaves y seguras. Combina con cualquier color de vestido.",
    },
    image: {
      src: "/prom/rose-corsage.webp",
      alt: {
        en: "Rose wrist corsage with garden roses and ribbon",
        es: "Corsage de muñeca con rosas de jardín y cinta",
      },
    },
  },
  {
    id: "rose-boutonniere",
    flower: "rose",
    type: "boutonniere",
    priceUSD: 15,
    name: { en: "Rose boutonnière", es: "Boutonnière de rosa" },
    description: {
      en: "A single rose on the lapel — clean, classic, easy to match.",
      es: "Una rosa en la solapa — limpia, clásica, fácil de combinar.",
    },
    image: {
      src: "/prom/rose-boutonniere.webp",
      alt: {
        en: "Single-rose boutonnière for prom lapel",
        es: "Boutonnière de una rosa para solapa de prom",
      },
    },
  },
  {
    id: "orchid-corsage",
    flower: "orchid",
    type: "corsage",
    priceUSD: 45,
    name: { en: "Orchid corsage", es: "Corsage de orquídea" },
    description: {
      en: "Cymbidium with satin ribbon. The premium pick for statement-night looks.",
      es: "Cymbidium con cinta de satén. La pieza premium para una noche que se nota.",
    },
    image: {
      src: "/prom/orchid-corsage.webp",
      alt: {
        en: "Cymbidium orchid wrist corsage with satin ribbon",
        es: "Corsage de muñeca con orquídea cymbidium y cinta de satén",
      },
    },
  },
  {
    id: "orchid-boutonniere",
    flower: "orchid",
    type: "boutonniere",
    priceUSD: 25,
    name: { en: "Orchid boutonnière", es: "Boutonnière de orquídea" },
    description: {
      en: "One orchid head, anchored with greenery. Quietly luxe.",
      es: "Una flor de orquídea con un toque de verde. Lujo discreto.",
    },
    image: {
      src: "/prom/orchid-boutonniere.webp",
      alt: {
        en: "Single-orchid boutonnière for prom lapel",
        es: "Boutonnière de una orquídea para solapa de prom",
      },
    },
  },
];
```

**Photo upload path:** `/public/prom/` — owner drops 4 `.webp` files there (`rose-corsage.webp`, `rose-boutonniere.webp`, `orchid-corsage.webp`, `orchid-boutonniere.webp`). Until then, the gradient fallback shows.

---

## 7. i18n strings

### `messages/en.json` (additions)

```jsonc
{
  "home": {
    "bento": {
      "prom": {
        "eyebrow": "Prom · 2026",
        "count": "4 pieces",
        "title": "For the night they remember",
        "limited": "Limited season",
        "cta": "Reserve"
      }
    }
  },
  "prom": {
    "hero": {
      "eyebrow": "Prom · 2026",
      "title": "For the night they remember",
      "subtitle": "Four pieces, two flowers, made the day before so the blooms are fresh for photos.",
      "cta": "Reserve by message"
    },
    "pieces": {
      "section_eyebrow": "The collection",
      "section_title": "Four pieces",
      "reserve_this": "Reserve this piece"
    },
    "how": {
      "eyebrow": "How it works",
      "title": "Three steps",
      "step1_title": "Tell us the night",
      "step1_body": "Date, color of the dress or tux, pickup or delivery.",
      "step2_title": "We confirm and craft",
      "step2_body": "Day-before assembly so blooms are fresh for photos.",
      "step3_title": "Pay at confirmation",
      "step3_body": "Cash, Zelle, or a Stripe link by message."
    },
    "cta": {
      "eyebrow": "Limited season",
      "title": "Reserve your pieces",
      "button": "Message Maky"
    }
  },
  "text_modal": {
    "subjects": {
      "prom": "I'd like to reserve a corsage or boutonnière for prom."
    }
  }
}
```

### `messages/es.json` (additions)

Same shape, with Spanish copy:
- `home.bento.prom.title`: `"Para una noche inolvidable"`
- `home.bento.prom.cta`: `"Reservar"`
- `prom.hero.subtitle`: `"Cuatro piezas, dos flores, armadas el día anterior para que las flores se vean frescas en las fotos."`
- `prom.cta.button`: `"Escribir a Maky"`
- `text_modal.subjects.prom`: `"Quisiera reservar un corsage o boutonnière para Prom."`

---

## 8. `TextMakyModal` integration

**File:** `lib/contact-subject.ts`
- Extend `SubjectKey`: add `"prom"` and `"prom_piece"` to the union.
- Extend `ContactOverride`: add `| { kind: "prom-piece"; pieceName: string }`.
- In `getSubjectKey`:
  - Handle `override.kind === "prom-piece"` → `{ key: "prom_piece", vars: { piece: override.pieceName } }`.
  - Add path rule: `if (path === "/prom") return { key: "prom" };`.

**Allowlist:** `isAllowlistedRoute` already returns `true` for any path with a non-`default` subject — adding the `/prom` rule above is enough to make the modal openable from the landing without further work.

**Translation key for piece-specific message:** `text_modal.subjects.prom_piece` with placeholder `{piece}`:
- EN: `"I'd like to reserve the {piece} for prom."`
- ES: `"Quisiera reservar el/la {piece} para Prom."`

---

## 9. Routing, SEO, sitemap

- Add `/prom` to `app/sitemap.ts` with `priority: 0.6, changeFrequency: "monthly"` (prom is seasonal; downgraded after July).
- `<BreadcrumbListLD>` rendered on the landing as in sympathy.
- `generateMetadata`:
  - EN title: `"Prom flowers — corsages & boutonnières | Diva Flowers"`
  - ES title: `"Flores para Prom — corsages y boutonnières | Diva Flowers"`
  - Description references Long Island delivery + per-zone fees (consistent with site memory: never claim free delivery).
- No new entry in `MegaMenu`, `MobileDrawer`, or `NavLinks` — discovery is via home tile and direct URL only.

---

## 10. Reversal plan (post-prom season)

When prom season ends (early-to-mid June 2026):

1. In `components/home/BentoGrid.tsx`: swap `<BentoPromTile />` back to the original `<BentoFeaturedTile />` block. Both components live in the repo so this is a one-block edit.
2. `BentoPromTile.tsx`, `data/prom-collection.ts`, `app/[locale]/prom/page.tsx`, and the prom-specific i18n keys remain in repo for reuse next prom season — no deletion required.
3. (Optional) Remove `/prom` from `sitemap.ts` if the URL should disappear from indexing once out of season.

---

## 11. Testing

- **Unit (Vitest):** `tests/unit/PromPieces.test.tsx` — renders 4 cards, asserts price/name in both locales, asserts each card has an `id` anchor.
- **Unit:** `tests/unit/BentoPromTile.test.tsx` — renders the tile, asserts the 4 cells exist with correct links to `/[locale]/prom#<id>`, asserts CTA links to `/[locale]/prom`.
- **Unit:** `tests/unit/contact-subject.test.ts` — extend existing test: `/prom` → `{ key: "prom" }`, `prom-piece` override → `{ key: "prom_piece", vars: { piece: "Rose corsage" } }`.
- **Manual:** start dev server, visit `/en` and `/es`, click each cell + the CTA, open modal on `/prom`, confirm prefilled message in both locales.

---

## 12. Out of scope (explicitly)

- No Stripe payment link generation for prom (handled in-message by owner).
- No analytics events specific to prom (existing `phone_click` / `whatsapp_click` events already fire from the modal — sufficient for v1).
- No background animations / petals on `/prom` (keep the page calm; the home already has motion).
- No "prom" filter on `/shop` (no products to filter).
- No mega-menu entry.
- No Spanish slug variant (`/[locale]/prom` works for both locales; Spanish users will recognize "prom" as it's a US-centric event).
