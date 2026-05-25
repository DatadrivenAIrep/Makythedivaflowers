# Prom Collection on Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the expired `MothersDayHomeStrip` on the home page with a four-piece prom collection (Rose corsage $35, Rose boutonnière $15, Orchid corsage $45, Orchid boutonnière $25) shown in a new `BentoPromTile` (variant H1: editorial header + 2×2 grid + CTA) backed by a dedicated `/[locale]/prom` landing whose reservations flow through the existing `TextMakyModal`.

**Architecture:** A new `data/prom-collection.ts` is the single source of truth for the four pieces (typed, bilingual). The home swaps `BentoFeaturedTile` for `BentoPromTile` inside `BentoGrid`. A new `/[locale]/prom` landing assembles four small components (`PromHero`, `PromPieces`, `PromHowItWorks`, `PromCTA`) that all open the existing `TextMakyModal` via `useContactContext`. The modal picks up a new `prom` subject key from the pathname (no per-piece overrides in v1 — kept simple). Photos go to `/public/prom/`; until uploaded, a CSS gradient fallback prevents broken images.

**Tech Stack:** Next.js 16 (App Router, breaking changes from training data — see `node_modules/next/dist/docs/`), TypeScript, Tailwind, `next-intl` for i18n, Radix Dialog (already wired in `TextMakyModal`), Vitest + Testing Library for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-05-25-prom-collection-home-design.md`

---

## File Structure

**New files:**
- `data/prom-collection.ts` — type `PromPiece` + `PROM_PIECES` array (4 pieces, bilingual copy, image paths)
- `components/home/BentoPromTile.tsx` — server component, layout H1, used in `BentoGrid`'s top-left slot
- `app/[locale]/prom/page.tsx` — landing page, mirrors `/sympathy` structure
- `components/prom/PromHero.tsx` — hero section (server component, opens modal via a small client trigger)
- `components/prom/PromPieces.tsx` — 4-card grid (server component) with anchor `id`s
- `components/prom/PromHowItWorks.tsx` — 3-step explainer (server component)
- `components/prom/PromCTA.tsx` — final CTA section (client component, opens modal)
- `components/prom/PromOpenModalButton.tsx` — small client component reused by `PromHero`/`PromCTA` to call `setOpen(true)` on `ContactContext`
- `tests/unit/BentoPromTile.test.tsx` — renders tile, asserts 4 cells + correct links
- `tests/unit/PromPieces.test.tsx` — renders 4 cards in both locales, asserts price/name/anchor

**Modified files:**
- `app/[locale]/page.tsx` — remove `MothersDayHomeStrip` import + usage
- `components/home/BentoGrid.tsx` — replace `BentoFeaturedTile` with `BentoPromTile`
- `lib/contact-subject.ts` — add `"prom"` to `SubjectKey` + path rule for `/prom`
- `tests/unit/contact-subject.test.ts` — add assertion for `/prom` → `{ key: "prom" }`
- `messages/en.json` — add `home.bento.prom.*`, `prom.*`, `text_modal.subjects.prom`
- `messages/es.json` — same keys, Spanish copy
- `app/sitemap.ts` — add `"prom"` to `STATIC_PATHS`

**Files preserved but unmounted (no edits beyond removing imports):**
- `components/mothers-day/MothersDayHomeStrip.tsx`
- `components/home/BentoFeaturedTile.tsx`

---

### Task 1: Create `data/prom-collection.ts`

**Files:**
- Create: `data/prom-collection.ts`

- [ ] **Step 1: Write the data file**

```ts
// data/prom-collection.ts
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

export const PROM_PIECES: readonly PromPiece[] = [
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

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If there are pre-existing errors elsewhere, they're not yours — confirm `data/prom-collection.ts` doesn't appear in the error list.

- [ ] **Step 3: Commit**

```bash
git add data/prom-collection.ts
git commit -m "feat(prom): add prom-collection data file (4 pieces, bilingual)"
```

---

### Task 2: Add i18n keys to `messages/en.json` and `messages/es.json`

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add EN keys**

Open `messages/en.json` and add a `prom` block at the top level (sibling of `home`, `text_modal`, etc.):

```jsonc
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
}
```

Inside the existing `home.bento` block, add a `prom` sub-block:

```jsonc
"prom": {
  "eyebrow": "Prom · 2026",
  "count": "4 pieces",
  "title": "For the night they remember",
  "limited": "Limited season",
  "cta": "Reserve"
}
```

Inside the existing `text_modal.subjects` block, add:

```jsonc
"prom": "I'd like to reserve a corsage or boutonnière for prom."
```

- [ ] **Step 2: Add ES keys (same shape, Spanish copy)**

Open `messages/es.json` and mirror the structure with this Spanish copy:

```jsonc
"prom": {
  "hero": {
    "eyebrow": "Prom · 2026",
    "title": "Para una noche inolvidable",
    "subtitle": "Cuatro piezas, dos flores, armadas el día anterior para que las flores se vean frescas en las fotos.",
    "cta": "Reservar por mensaje"
  },
  "pieces": {
    "section_eyebrow": "La colección",
    "section_title": "Cuatro piezas",
    "reserve_this": "Reservar esta pieza"
  },
  "how": {
    "eyebrow": "Cómo funciona",
    "title": "Tres pasos",
    "step1_title": "Cuéntanos sobre la noche",
    "step1_body": "Fecha, color del vestido o smoking, recoger o entrega.",
    "step2_title": "Confirmamos y armamos",
    "step2_body": "Armado el día anterior para que las flores se vean frescas en las fotos.",
    "step3_title": "Pago al confirmar",
    "step3_body": "Efectivo, Zelle o link de Stripe por mensaje."
  },
  "cta": {
    "eyebrow": "Temporada limitada",
    "title": "Reserva tus piezas",
    "button": "Escribir a Maky"
  }
}
```

Inside `home.bento`:

```jsonc
"prom": {
  "eyebrow": "Prom · 2026",
  "count": "4 piezas",
  "title": "Para una noche inolvidable",
  "limited": "Temporada limitada",
  "cta": "Reservar"
}
```

Inside `text_modal.subjects`:

```jsonc
"prom": "Quisiera reservar un corsage o boutonnière para Prom."
```

- [ ] **Step 3: Verify both JSON files parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok`. If you get a `SyntaxError`, you likely missed a comma between blocks — fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(prom): add bilingual i18n keys for prom collection"
```

---

### Task 3: Extend `lib/contact-subject.ts` for `/prom`

**Files:**
- Modify: `lib/contact-subject.ts`
- Test: `tests/unit/contact-subject.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/contact-subject.test.ts` inside the existing `describe("getSubjectKey", ...)` block (before the closing `});`):

```ts
  it("returns prom on /prom", () => {
    expect(getSubjectKey({ pathname: "/en/prom", override: null })).toEqual({ key: "prom" });
  });

  it("returns prom on /es/prom", () => {
    expect(getSubjectKey({ pathname: "/es/prom", override: null })).toEqual({ key: "prom" });
  });
```

And inside `describe("isAllowlistedRoute", ...)` → `it("is true for home, product, shop, weddings, events, cart, checkout", ...)`, add `"/en/prom"` to the array of paths.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- contact-subject`
Expected: FAIL — both new tests fail with `expected { key: 'default' } to deeply equal { key: 'prom' }`.

- [ ] **Step 3: Extend `SubjectKey` union and add path rule**

Edit `lib/contact-subject.ts`:

```ts
export type SubjectKey =
  | "pdp_named"
  | "pdp_generic"
  | "shop_all"
  | "shop_category"
  | "weddings"
  | "events"
  | "sympathy"
  | "prom"
  | "checkout"
  | "default";
```

In `getSubjectKey`, add the path rule below the `sympathy` line (around line 45):

```ts
  if (path === "/sympathy") return { key: "sympathy" };
  if (path === "/prom") return { key: "prom" };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- contact-subject`
Expected: PASS for all tests including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/contact-subject.ts tests/unit/contact-subject.test.ts
git commit -m "feat(prom): add prom subject key + /prom path rule"
```

---

### Task 4: Create `BentoPromTile` component

**Files:**
- Create: `components/home/BentoPromTile.tsx`
- Test: `tests/unit/BentoPromTile.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/BentoPromTile.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { BentoPromTile } from "@/components/home/BentoPromTile";

// BentoPromTile is async (server component); we await it inline.
async function renderTile(locale: "en" | "es" = "en") {
  const ui = await BentoPromTile({ locale });
  return render(
    <NextIntlClientProvider locale={locale} messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("BentoPromTile", () => {
  it("renders all four prom pieces with their prices", async () => {
    await renderTile("en");
    expect(screen.getByText("Rose corsage")).toBeDefined();
    expect(screen.getByText("Rose boutonnière")).toBeDefined();
    expect(screen.getByText("Orchid corsage")).toBeDefined();
    expect(screen.getByText("Orchid boutonnière")).toBeDefined();
    expect(screen.getByText("$35")).toBeDefined();
    expect(screen.getByText("$15")).toBeDefined();
    expect(screen.getByText("$45")).toBeDefined();
    expect(screen.getByText("$25")).toBeDefined();
  });

  it("links each cell to its anchor on /[locale]/prom", async () => {
    await renderTile("en");
    const roseCorsage = screen.getByRole("link", { name: /Rose corsage/i });
    expect(roseCorsage.getAttribute("href")).toBe("/en/prom#rose-corsage");
    const orchidBout = screen.getByRole("link", { name: /Orchid boutonnière/i });
    expect(orchidBout.getAttribute("href")).toBe("/en/prom#orchid-boutonniere");
  });

  it("renders the main CTA linking to /[locale]/prom", async () => {
    await renderTile("es");
    const cta = screen.getByRole("link", { name: /Reservar →|Reservar$/i });
    expect(cta.getAttribute("href")).toBe("/es/prom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BentoPromTile`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `BentoPromTile`**

```tsx
// components/home/BentoPromTile.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PROM_PIECES, type PromPiece } from "@/data/prom-collection";
import { cn } from "@/lib/cn";

const FLOWER_GRADIENT: Record<PromPiece["flower"], string> = {
  rose: "bg-gradient-to-br from-[#e89aa6] to-[#c45f72]",
  orchid: "bg-gradient-to-br from-[#b4a4d4] to-[#6e5b9c]",
};

export async function BentoPromTile({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.bento.prom");

  return (
    <div
      className={cn(
        "relative bg-petal text-ink rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[640px] h-full flex flex-col",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
          <span>{t("eyebrow")}</span>
          <span>{t("count")}</span>
        </div>
        <h3
          className="mt-2 font-display italic text-3xl md:text-5xl tracking-tighter leading-[0.9] text-ink"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h3>
      </header>

      <div className="flex-1 grid grid-cols-2 gap-2 px-3">
        {PROM_PIECES.map((piece) => (
          <Link
            key={piece.id}
            href={`/${locale}/prom#${piece.id}`}
            aria-label={`${piece.name[locale]} — $${piece.priceUSD}`}
            className={cn(
              "relative rounded-lg overflow-hidden flex flex-col group focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
              FLOWER_GRADIENT[piece.flower],
            )}
          >
            <img
              src={piece.image.src}
              alt={piece.image.alt[locale]}
              className="absolute inset-0 size-full object-cover transition-opacity group-hover:opacity-90"
              loading="lazy"
            />
            <div className="mt-auto relative bg-petal/95 px-3 py-2 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink truncate">
                {piece.name[locale]}
              </span>
              <span className="font-mono text-[12px] font-semibold text-ink">
                ${piece.priceUSD}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <footer className="px-6 pt-4 pb-6 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("limited")}
        </span>
        <Link
          href={`/${locale}/prom`}
          className="font-display italic text-base text-ink underline underline-offset-4 hover:no-underline"
        >
          {t("cta")} →
        </Link>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BentoPromTile`
Expected: PASS for all three tests.

- [ ] **Step 5: Commit**

```bash
git add components/home/BentoPromTile.tsx tests/unit/BentoPromTile.test.tsx
git commit -m "feat(prom): BentoPromTile component (layout H1) with tests"
```

---

### Task 5: Swap `BentoFeaturedTile` for `BentoPromTile` in `BentoGrid`

**Files:**
- Modify: `components/home/BentoGrid.tsx`

- [ ] **Step 1: Replace the featured tile**

Edit `components/home/BentoGrid.tsx`. Replace the entire current file with:

```tsx
import { getTranslations } from "next-intl/server";
import { BentoPromTile } from "./BentoPromTile";
import { BentoSubscriptionsTile } from "./BentoSubscriptionsTile";
import { BentoLiveStatusTile } from "./BentoLiveStatusTile";
import { BentoPressTile } from "./BentoPressTile";
import { BentoStudioClock } from "./BentoStudioClock";
import type { Locale } from "@/types/locale";

export async function BentoGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.bento");

  return (
    <section className="max-w-[1400px] mx-auto px-6 py-24 md:py-32">
      <div className="flex items-end justify-between mb-10 md:mb-14">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
            {t("console_eyebrow")}
          </span>
          <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-[0.95]">
            {t("console_title")}
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-rouge" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">
            SYSTEM ACTIVE
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5"
        style={{ gridAutoRows: "minmax(140px, auto)" }}
      >
        <div className="md:col-span-2 md:row-span-3">
          <BentoPromTile locale={locale} />
        </div>
        <div className="md:col-span-2 md:row-span-2">
          <BentoLiveStatusTile />
        </div>
        <div className="md:col-span-1">
          <BentoSubscriptionsTile locale={locale} />
        </div>
        <div className="md:col-span-1">
          <BentoStudioClock />
        </div>
        <div className="md:col-span-4">
          <BentoPressTile />
        </div>
      </div>
    </section>
  );
}
```

(Removed: `BentoFeaturedTile` import, `PRODUCTS` import, `FEATURED_SLUG` constant, `featured*` lookups. The original file is preserved at `components/home/BentoFeaturedTile.tsx` for future reuse.)

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS. If you see "Cannot find name 'PRODUCTS'" or similar in `BentoGrid.tsx`, you missed deleting an old reference — clean up.

- [ ] **Step 3: Commit**

```bash
git add components/home/BentoGrid.tsx
git commit -m "feat(home): swap featured tile for BentoPromTile"
```

---

### Task 6: Remove `MothersDayHomeStrip` from home page

**Files:**
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Remove import + usage**

Edit `app/[locale]/page.tsx`. Remove these two lines:

Import (line 15):
```tsx
import { MothersDayHomeStrip } from "@/components/mothers-day/MothersDayHomeStrip";
```

Usage inside `<main>` (line 46):
```tsx
      <MothersDayHomeStrip locale={locale} />
```

The file should still compile with all other imports and components intact.

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/page.tsx
git commit -m "chore(home): remove MothersDayHomeStrip (campaign closed)"
```

---

### Task 7: Create `PromOpenModalButton` (client trigger)

**Files:**
- Create: `components/prom/PromOpenModalButton.tsx`

Why a shared button: `PromHero` and `PromCTA` are otherwise server components. We isolate the modal-open behavior in one small client component so both sections can stay server-rendered.

- [ ] **Step 1: Implement the trigger**

```tsx
// components/prom/PromOpenModalButton.tsx
"use client";
import * as React from "react";
import { useContactContext } from "@/components/contact/ContactContextProvider";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

export function PromOpenModalButton({
  children,
  variant = "primary",
  className,
}: Props) {
  const { setOpen } = useContactContext();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-6 py-3 font-sans text-sm tracking-tight transition",
        variant === "primary" &&
          "bg-ink text-bone hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
        variant === "ghost" &&
          "border border-ink/30 text-ink hover:bg-ink/5",
        className,
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/prom/PromOpenModalButton.tsx
git commit -m "feat(prom): PromOpenModalButton client trigger"
```

---

### Task 8: Create `PromHero` section

**Files:**
- Create: `components/prom/PromHero.tsx`

- [ ] **Step 1: Implement the hero**

```tsx
// components/prom/PromHero.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PromOpenModalButton } from "./PromOpenModalButton";

export async function PromHero({ locale }: { locale: Locale }) {
  const t = await getTranslations("prom.hero");
  return (
    <header className="relative isolate overflow-hidden bg-petal text-ink">
      <div className="relative mx-auto max-w-[var(--container-max)] px-6 pt-24 pb-20 md:pt-32 md:pb-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-4 max-w-3xl font-display italic text-5xl leading-[0.95] tracking-tighter md:text-7xl"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-ink/80 md:text-lg">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <PromOpenModalButton>{t("cta")}</PromOpenModalButton>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/prom/PromHero.tsx
git commit -m "feat(prom): PromHero section"
```

---

### Task 9: Create `PromPieces` section with anchors

**Files:**
- Create: `components/prom/PromPieces.tsx`
- Test: `tests/unit/PromPieces.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/PromPieces.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { PromPieces } from "@/components/prom/PromPieces";

async function renderPieces(locale: "en" | "es" = "en") {
  const ui = await PromPieces({ locale });
  const messages = locale === "es" ? es : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("PromPieces", () => {
  it("renders all four pieces with prices in EN", async () => {
    await renderPieces("en");
    expect(screen.getByText("Rose corsage")).toBeDefined();
    expect(screen.getByText("Orchid boutonnière")).toBeDefined();
    expect(screen.getByText(/\$45/)).toBeDefined();
  });

  it("renders all four pieces with prices in ES", async () => {
    await renderPieces("es");
    expect(screen.getByText("Corsage de orquídea")).toBeDefined();
    expect(screen.getByText(/\$25/)).toBeDefined();
  });

  it("anchors each card to its id for deep links from the home tile", async () => {
    const { container } = await renderPieces("en");
    expect(container.querySelector("#rose-corsage")).not.toBeNull();
    expect(container.querySelector("#rose-boutonniere")).not.toBeNull();
    expect(container.querySelector("#orchid-corsage")).not.toBeNull();
    expect(container.querySelector("#orchid-boutonniere")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PromPieces`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PromPieces`**

```tsx
// components/prom/PromPieces.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PROM_PIECES, type PromPiece } from "@/data/prom-collection";
import { cn } from "@/lib/cn";

const FLOWER_GRADIENT: Record<PromPiece["flower"], string> = {
  rose: "bg-gradient-to-br from-[#e89aa6] to-[#c45f72]",
  orchid: "bg-gradient-to-br from-[#b4a4d4] to-[#6e5b9c]",
};

export async function PromPieces({ locale }: { locale: Locale }) {
  const t = await getTranslations("prom.pieces");
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("section_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("section_title")}
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {PROM_PIECES.map((piece) => (
            <li
              key={piece.id}
              id={piece.id}
              className="scroll-mt-24 rounded-[var(--radius-bento)] overflow-hidden bg-petal"
            >
              <div
                className={cn(
                  "relative aspect-[4/3] overflow-hidden",
                  FLOWER_GRADIENT[piece.flower],
                )}
              >
                <img
                  src={piece.image.src}
                  alt={piece.image.alt[locale]}
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display italic text-2xl leading-tight">
                    {piece.name[locale]}
                  </h3>
                  <span className="font-mono text-base font-semibold whitespace-nowrap">
                    ${piece.priceUSD}
                  </span>
                </div>
                <p className="font-sans text-sm text-ink/80 leading-relaxed">
                  {piece.description[locale]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PromPieces`
Expected: PASS for all three tests.

- [ ] **Step 5: Commit**

```bash
git add components/prom/PromPieces.tsx tests/unit/PromPieces.test.tsx
git commit -m "feat(prom): PromPieces section with anchors + tests"
```

---

### Task 10: Create `PromHowItWorks` section

**Files:**
- Create: `components/prom/PromHowItWorks.tsx`

- [ ] **Step 1: Implement the section**

```tsx
// components/prom/PromHowItWorks.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function PromHowItWorks({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("prom.how");
  const steps = [
    { n: "01", title: t("step1_title"), body: t("step1_body") },
    { n: "02", title: t("step2_title"), body: t("step2_body") },
    { n: "03", title: t("step3_title"), body: t("step3_body") },
  ];
  return (
    <section className="bg-petal text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("title")}
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-ink/15 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-ink/50">
                {s.n}
              </span>
              <h3 className="mt-2 font-display text-xl leading-snug">
                {s.title}
              </h3>
              <p className="mt-2 font-sans text-sm text-ink/80 leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/prom/PromHowItWorks.tsx
git commit -m "feat(prom): PromHowItWorks 3-step section"
```

---

### Task 11: Create `PromCTA` final section

**Files:**
- Create: `components/prom/PromCTA.tsx`

- [ ] **Step 1: Implement the section**

```tsx
// components/prom/PromCTA.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PromOpenModalButton } from "./PromOpenModalButton";

export async function PromCTA({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("prom.cta");
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("title")}
        </h2>
        <div className="mt-10 flex justify-center">
          <PromOpenModalButton variant="ghost" className="text-bone border-bone/40 hover:bg-bone/10">
            {t("button")}
          </PromOpenModalButton>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/prom/PromCTA.tsx
git commit -m "feat(prom): PromCTA closing section"
```

---

### Task 12: Assemble `/[locale]/prom` page

**Files:**
- Create: `app/[locale]/prom/page.tsx`

- [ ] **Step 1: Implement the route**

```tsx
// app/[locale]/prom/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";
import { PromHero } from "@/components/prom/PromHero";
import { PromPieces } from "@/components/prom/PromPieces";
import { PromHowItWorks } from "@/components/prom/PromHowItWorks";
import { PromCTA } from "@/components/prom/PromCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "es"
        ? "Flores para Prom — corsages y boutonnières | Diva Flowers"
        : "Prom flowers — corsages & boutonnières | Diva Flowers",
    description:
      locale === "es"
        ? "Corsages y boutonnières para Prom 2026 en Long Island. Cuatro piezas, dos flores, armadas el día anterior. Reserva por WhatsApp o SMS."
        : "Prom corsages and boutonnières for 2026 across Long Island. Four pieces, two flowers, assembled the day before. Reserve by WhatsApp or text.",
    alternates: {
      canonical: `/${locale}/prom`,
      languages: { en: "/en/prom", es: "/es/prom" },
    },
  };
}

export default async function PromPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: locale === "es" ? "Inicio" : "Home", href: `/${locale}` },
          { name: "Prom", href: `/${locale}/prom` },
        ]}
      />
      <Grain />
      <PromHero locale={locale} />
      <PromPieces locale={locale} />
      <PromHowItWorks locale={locale} />
      <PromCTA locale={locale} />
    </main>
  );
}
```

- [ ] **Step 2: Verify TS compiles + dev server boots the route**

Run: `npx tsc --noEmit`
Expected: PASS.

(Optional sanity boot — only if dev server isn't already running:)
Run: `npm run dev` in a separate terminal and visit `http://localhost:3000/en/prom` and `http://localhost:3000/es/prom`. Expected: page renders without errors; the modal opens when clicking either CTA. Kill dev server after.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/prom/page.tsx
git commit -m "feat(prom): /[locale]/prom landing page assembly + metadata"
```

---

### Task 13: Add `/prom` to sitemap

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Add to `STATIC_PATHS`**

Edit `app/sitemap.ts`. In the `STATIC_PATHS` array (currently lines 10-26), insert `"prom"` after `"weddings"` so the order remains alphabetical-ish and logical:

```ts
const STATIC_PATHS = [
  "",
  "shop",
  "shop/arrangements",
  "shop/bouquets",
  "shop/plants",
  "shop/gifts",
  "shop/sympathy",
  "subscriptions",
  "weddings",
  "prom",
  "events",
  "story",
  "journal",
  "contact",
  "legal/privacy",
  "legal/terms",
];
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat(prom): include /prom in sitemap"
```

---

### Task 14: Full test suite + manual smoke verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: All tests pass. No new failures from this work. If pre-existing failures exist elsewhere in the repo, confirm none are introduced by this branch.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, no new errors.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `npm run dev` and visit:

1. `http://localhost:3000/en`
   - Bento grid first tile shows: "Prom · 2026 / 4 pieces" eyebrow, "For the night they remember" title, 2×2 grid with rose/orchid gradient fallbacks (no real photos yet), prices `$35 / $15 / $45 / $25`, "Limited season" + "Reserve →" footer.
   - MothersDayHomeStrip is gone (the strip that used to sit just below the Hero).
   - Click any cell → navigates to `/en/prom#<id>` and scrolls to that piece.
2. `http://localhost:3000/es`
   - Same layout, Spanish copy ("Para una noche inolvidable", "Temporada limitada", "Reservar →").
3. `http://localhost:3000/en/prom`
   - Renders 4 sections: hero, pieces grid, how-it-works, CTA.
   - Click hero "Reserve by message" → `TextMakyModal` opens with subject "I'd like to reserve a corsage or boutonnière for prom."
   - Click footer CTA "Message Maky" → same modal opens.
4. `http://localhost:3000/es/prom`
   - Same as above, ES copy. Modal subject: "Quisiera reservar un corsage o boutonnière para Prom."

If any of these checks fail, fix before completing the task — do not commit a half-working state.

- [ ] **Step 4: No commit** (verification step only)

---

## Self-Review Checklist (post-write, for the plan author)

**Spec coverage:** Verified — every spec section maps to a task:
- Spec §3 (Home changes) → Tasks 5, 6
- Spec §4 (BentoPromTile) → Task 4
- Spec §5 (Landing) → Tasks 7–12
- Spec §6 (Data file) → Task 1
- Spec §7 (i18n) → Task 2
- Spec §8 (Contact subject) → Task 3
- Spec §9 (Sitemap/SEO) → Tasks 12 (metadata + breadcrumb), 13 (sitemap)
- Spec §10 (Reversal) → docs/comments in Task 5
- Spec §11 (Testing) → Tasks 3 (contact-subject), 4 (BentoPromTile), 9 (PromPieces), 14 (manual)

**Out-of-scope correctly skipped:**
- `prom_piece` override key (spec §8 mentions it but explicitly notes per-piece links are MVP-optional). Dropped from v1 to keep scope tight. Per-piece "Reserve this piece" buttons can be added later by extending `ContactOverride` and adding a piece-prop to `PromOpenModalButton`.

**Type/name consistency:** `PromPiece`, `PromPieceId`, `PROM_PIECES`, `FLOWER_GRADIENT` used consistently across Tasks 1, 4, 9. Piece `id` values (`rose-corsage`, `rose-boutonniere`, `orchid-corsage`, `orchid-boutonniere`) match between Task 1 data, Task 4 anchor links, Task 9 `id={piece.id}` and Task 14 smoke test.

**No placeholders:** every step contains exact code, exact commands, expected output.
