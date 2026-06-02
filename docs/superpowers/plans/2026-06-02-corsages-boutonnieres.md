# Corsages & Boutonnières — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seasonal `/prom` page with a year-round `/corsages-boutonnieres` page featuring a 3-photo collage hero, 2×2 product grid, how-it-works section, and a closing CTA, and update the BentoGrid home tile accordingly.

**Architecture:** Gallery-first layout — `CorsagesHero` (3-photo CSS grid collage) → `CorsagesPieces` (2×2 grid) → `CorsagesHowItWorks` (dark panel, 3 steps) → `CorsagesCTA` (centered CTA). All page components are async server components that call `getTranslations`. The old `/prom` route becomes a `redirect()`. The `BentoCorsagesTile` replaces `BentoPromTile` in the BentoGrid. The data file `data/corsages-collection.ts` reuses the same 4 products/prices as the old prom collection.

**Tech Stack:** Next.js 16 app router, next-intl (`getTranslations` for server components), Tailwind CSS v4, Vitest for tests, sips + cwebp for image conversion.

---

## File Map

| Status | File | Role |
|--------|------|------|
| Create | `public/corsages/hero-1.webp` … `hero-3.webp` | Collage hero images |
| Create | `public/corsages/rose-corsage.webp` … `orchid-boutonniere.webp` | Product card images |
| Modify | `messages/en.json` | Add `corsages.*` and `home.bento.corsages.*` keys |
| Modify | `messages/es.json` | Spanish equivalents |
| Create | `data/corsages-collection.ts` | 4 CorsagePiece items (same prices as prom) |
| Create | `tests/unit/corsages-collection.test.ts` | Data integrity checks |
| Create | `components/corsages/CorsagesOpenModalButton.tsx` | Client button that opens TextMakyModal |
| Create | `components/corsages/CorsagesHero.tsx` | 3-photo collage hero (server) |
| Create | `components/corsages/CorsagesPieces.tsx` | 2×2 product grid (server) |
| Create | `components/corsages/CorsagesHowItWorks.tsx` | Dark panel, 3 steps (server) |
| Create | `components/corsages/CorsagesCTA.tsx` | Closing CTA (server) |
| Create | `app/[locale]/corsages-boutonnieres/page.tsx` | New page |
| Modify | `app/[locale]/prom/page.tsx` | Replace with redirect() |
| Modify | `lib/contact-subject.ts` | Add `"corsages"` to SubjectKey + route map |
| Modify | `tests/unit/contact-subject.test.ts` | Add corsages route cases |
| Create | `components/home/BentoCorsagesTile.tsx` | Year-round home tile (server) |
| Modify | `components/home/BentoGrid.tsx` | Swap BentoPromTile → BentoCorsagesTile |

---

## Task 1: Process Photos

**Files:**
- Create: `public/corsages/hero-1.webp`, `hero-2.webp`, `hero-3.webp`
- Create: `public/corsages/rose-corsage.webp`, `rose-boutonniere.webp`, `orchid-corsage.webp`, `orchid-boutonniere.webp`

**Context:** Photos are in `~/Downloads/Coursages/` as HEIC files (IMG_0135, IMG_7629, IMG_7630, IMG_7634, IMG_7636, IMG_8082–IMG_8085, IMG_8294, IMG_8296, IMG_8683, IMG_8684, IMG_9245, IMG_9247) and PNG files (IMG_0813, IMG_0815). The pipeline is: HEIC → JPEG via sips, then JPEG/PNG → WebP via cwebp. The `public/corsages/` directory needs to be created.

- [ ] **Step 1: Create output directory**

```bash
mkdir -p "/Users/santiagocardonacastellanos/Desktop/Diva Flowers/public/corsages"
```

- [ ] **Step 2: Convert all HEIC files to JPEG in a temp directory**

```bash
TMPDIR=/tmp/corsages-jpegs
mkdir -p "$TMPDIR"

for f in ~/Downloads/Coursages/*.HEIC ~/Downloads/Coursages/*.heic; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  stem="${base%.*}"
  sips -s format jpeg "$f" --out "$TMPDIR/$stem.jpg" 2>/dev/null
done

echo "JPEG files created:"
ls "$TMPDIR/"
```

Expected: 15 JPEG files named IMG_0135.jpg, IMG_7629.jpg, etc.

- [ ] **Step 3: Convert PNG files to JPEG in the same temp dir**

```bash
for f in ~/Downloads/Coursages/*.PNG ~/Downloads/Coursages/*.png; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  stem="${base%.*}"
  sips -s format jpeg "$f" --out "$TMPDIR/$stem.jpg" 2>/dev/null
done

echo "All source files as JPEG:"
ls "$TMPDIR/"
```

Expected: 17 JPEG files total (15 from HEIC + 2 from PNG).

- [ ] **Step 4: Convert all JPEGs to WebP in a preview directory**

```bash
PREVIEWDIR=/tmp/corsages-preview
mkdir -p "$PREVIEWDIR"

for f in "$TMPDIR"/*.jpg; do
  stem=$(basename "$f" .jpg)
  cwebp -q 85 "$f" -o "$PREVIEWDIR/$stem.webp" -quiet
done

echo "WebP preview files:"
ls "$PREVIEWDIR/"
```

- [ ] **Step 5: Open preview directory to choose hero and product assignments**

```bash
open "$PREVIEWDIR"
```

View all 17 photos in Finder. Choose:
- **3 hero photos** — best overall shots showing arrangement quality, varied compositions for the collage
- **4 product photos** — ideally one per product type (rose corsage, rose boutonnière, orchid corsage, orchid boutonnière); or use the best available

Record your choices before the next step. Example assignment (replace with your actual choices):
- `hero-1`: IMG_8082
- `hero-2`: IMG_7634
- `hero-3`: IMG_9245
- `rose-corsage`: IMG_7629
- `rose-boutonniere`: IMG_7630
- `orchid-corsage`: IMG_8083
- `orchid-boutonniere`: IMG_8085

- [ ] **Step 6: Copy chosen files into `public/corsages/` with canonical names**

Replace the filenames below with your actual choices from Step 5:

```bash
DEST="/Users/santiagocardonacastellanos/Desktop/Diva Flowers/public/corsages"

# Hero photos (replace IMG_XXXX with your choices)
cp "$PREVIEWDIR/IMG_8082.webp" "$DEST/hero-1.webp"
cp "$PREVIEWDIR/IMG_7634.webp" "$DEST/hero-2.webp"
cp "$PREVIEWDIR/IMG_9245.webp" "$DEST/hero-3.webp"

# Product photos
cp "$PREVIEWDIR/IMG_7629.webp" "$DEST/rose-corsage.webp"
cp "$PREVIEWDIR/IMG_7630.webp" "$DEST/rose-boutonniere.webp"
cp "$PREVIEWDIR/IMG_8083.webp" "$DEST/orchid-corsage.webp"
cp "$PREVIEWDIR/IMG_8085.webp" "$DEST/orchid-boutonniere.webp"

echo "Files in public/corsages:"
ls -lh "$DEST/"
```

Expected: 7 WebP files, each under 500 KB.

- [ ] **Step 7: Commit photo assets**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add public/corsages/
git commit -m "$(cat <<'EOF'
feat(corsages): add real photo assets

7 WebP files for corsages/boutonnieres page:
hero-1/2/3 for collage hero, rose/orchid × corsage/boutonniere for product cards.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add i18n Strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Context:** Both files use deeply nested JSON. The `corsages` page namespace goes at the top level alongside `"prom"`. The home bento tile keys go under `home.bento.corsages` alongside the existing `home.bento.prom`. There are no existing `corsages` keys in either file. The existing `prom.*` keys are kept (spec says don't delete them).

- [ ] **Step 1: Write failing test for i18n key coverage**

Create `tests/unit/corsages-i18n.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const CORSAGES_KEYS = [
  "page_title",
  "meta_description",
  "hero_eyebrow",
  "hero_title",
  "hero_sub",
  "pieces_eyebrow",
  "pieces_title",
  "reserve_this",
  "how_eyebrow",
  "how_title",
  "how_step1_title",
  "how_step1_body",
  "how_step2_title",
  "how_step2_body",
  "how_step3_title",
  "how_step3_body",
  "cta_title",
  "cta_button",
] as const;

const BENTO_CORSAGES_KEYS = ["eyebrow", "title", "count", "cta"] as const;

describe("corsages i18n", () => {
  it("en.json has all corsages.* keys", () => {
    const corsages = (en as Record<string, unknown>).corsages as Record<string, string>;
    expect(corsages).toBeDefined();
    for (const key of CORSAGES_KEYS) {
      expect(typeof corsages[key], `en.corsages.${key}`).toBe("string");
      expect(corsages[key].trim().length, `en.corsages.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("es.json has all corsages.* keys", () => {
    const corsages = (es as Record<string, unknown>).corsages as Record<string, string>;
    expect(corsages).toBeDefined();
    for (const key of CORSAGES_KEYS) {
      expect(typeof corsages[key], `es.corsages.${key}`).toBe("string");
      expect(corsages[key].trim().length, `es.corsages.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("en.json has home.bento.corsages.* keys", () => {
    const bento = ((en as Record<string, unknown>).home as Record<string, unknown>)
      .bento as Record<string, unknown>;
    const tile = bento.corsages as Record<string, string>;
    expect(tile).toBeDefined();
    for (const key of BENTO_CORSAGES_KEYS) {
      expect(typeof tile[key], `en.home.bento.corsages.${key}`).toBe("string");
    }
  });

  it("es.json has home.bento.corsages.* keys", () => {
    const bento = ((es as Record<string, unknown>).home as Record<string, unknown>)
      .bento as Record<string, unknown>;
    const tile = bento.corsages as Record<string, string>;
    expect(tile).toBeDefined();
    for (const key of BENTO_CORSAGES_KEYS) {
      expect(typeof tile[key], `es.home.bento.corsages.${key}`).toBe("string");
    }
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run tests/unit/corsages-i18n.test.ts
```

Expected: FAIL — `en.json has all corsages.* keys` — corsages is undefined.

- [ ] **Step 3: Add English keys**

In `messages/en.json`, find the `"prom"` top-level object (around line 669) and insert a `"corsages"` sibling block **before** it:

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
},
```

Also add `"corsages"` under `home.bento` (alongside the existing `"prom"` tile keys):

```json
"corsages": {
  "eyebrow": "For every occasion",
  "title": "The detail that completes the look.",
  "count": "4 pieces",
  "cta": "View collection"
}
```

Also add to the `contact.subjects` map (alongside the `"prom"` entry):

```json
"corsages": "I'd like to reserve a corsage or boutonnière."
```

- [ ] **Step 4: Add Spanish keys**

In `messages/es.json`, add the same structure. Find the `"prom"` top-level object and insert a `"corsages"` sibling **before** it:

```json
"corsages": {
  "page_title": "Corsages y Boutonnières — Diva Flowers",
  "meta_description": "Corsages y boutonnières para bodas, prom, quinceañeras, graduaciones y toda ocasión especial. Hechos el día anterior.",
  "hero_eyebrow": "Corsages · Boutonnières",
  "hero_title": "Para el momento que lo merece.",
  "hero_sub": "Para bodas, prom, quinceañeras, graduaciones y toda ocasión especial.",
  "pieces_eyebrow": "La colección",
  "pieces_title": "Cuatro piezas.",
  "reserve_this": "Reservar esta pieza",
  "how_eyebrow": "Cómo funciona",
  "how_title": "Hecho el día antes. Flores frescas para la foto.",
  "how_step1_title": "Cuéntanos la fecha",
  "how_step1_body": "Escríbenos con la fecha y la ocasión.",
  "how_step2_title": "Confirmamos y armamos",
  "how_step2_body": "Armamos tu pieza el día antes del evento.",
  "how_step3_title": "Pagas al confirmar",
  "how_step3_body": "Efectivo, Zelle o link de Stripe.",
  "cta_title": "¿Listo para reservar?",
  "cta_button": "Escribirle a Maky"
},
```

Under `home.bento`:

```json
"corsages": {
  "eyebrow": "Para toda ocasión",
  "title": "El detalle que completa el look.",
  "count": "4 piezas",
  "cta": "Ver colección"
}
```

Under `contact.subjects`:

```json
"corsages": "Quisiera reservar un corsage o boutonnière."
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run tests/unit/corsages-i18n.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add messages/en.json messages/es.json tests/unit/corsages-i18n.test.ts
git commit -m "$(cat <<'EOF'
feat(corsages): add i18n strings for corsages page and home tile

Adds corsages.*, home.bento.corsages.*, and contact.subjects.corsages
to en.json and es.json. Prom keys retained (not deleted per spec).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Data Model

**Files:**
- Create: `data/corsages-collection.ts`
- Create: `tests/unit/corsages-collection.test.ts`

**Context:** This mirrors `data/prom-collection.ts` exactly — same 4 products, same prices. Rename types `PromPiece*` → `CorsagePiece*`, rename constant `PROM_PIECES` → `CORSAGE_PIECES`, and update image paths from `/prom/…` to `/corsages/…`. Use `Localized` from `@/types/product` (same import as prom). The `FLOWER_GRADIENT` constant is also kept (same gradient values).

- [ ] **Step 1: Write failing test**

Create `tests/unit/corsages-collection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CORSAGE_PIECES, type CorsagePiece } from "@/data/corsages-collection";

describe("CORSAGE_PIECES", () => {
  it("has exactly 4 pieces", () => {
    expect(CORSAGE_PIECES).toHaveLength(4);
  });

  it("piece ids are unique", () => {
    const ids = CORSAGE_PIECES.map((p) => p.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("each piece has required fields", () => {
    CORSAGE_PIECES.forEach((p: CorsagePiece) => {
      expect(typeof p.id).toBe("string");
      expect(typeof p.priceUSD).toBe("number");
      expect(p.priceUSD).toBeGreaterThan(0);
      expect(typeof p.name.en).toBe("string");
      expect(typeof p.name.es).toBe("string");
      expect(typeof p.description.en).toBe("string");
      expect(typeof p.description.es).toBe("string");
      expect(p.image.src.startsWith("/corsages/")).toBe(true);
      expect(typeof p.image.alt.en).toBe("string");
      expect(typeof p.image.alt.es).toBe("string");
    });
  });

  it("covers rose and orchid flowers", () => {
    const flowers = new Set(CORSAGE_PIECES.map((p) => p.flower));
    expect(flowers.has("rose")).toBe(true);
    expect(flowers.has("orchid")).toBe(true);
  });

  it("covers corsage and boutonniere types", () => {
    const types = new Set(CORSAGE_PIECES.map((p) => p.type));
    expect(types.has("corsage")).toBe(true);
    expect(types.has("boutonniere")).toBe(true);
  });

  it("prices match spec: rose corsage $35, rose boutonniere $15, orchid corsage $45, orchid boutonniere $25", () => {
    const map = Object.fromEntries(CORSAGE_PIECES.map((p) => [p.id, p.priceUSD]));
    expect(map["rose-corsage"]).toBe(35);
    expect(map["rose-boutonniere"]).toBe(15);
    expect(map["orchid-corsage"]).toBe(45);
    expect(map["orchid-boutonniere"]).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run tests/unit/corsages-collection.test.ts
```

Expected: FAIL — cannot find module `@/data/corsages-collection`.

- [ ] **Step 3: Create `data/corsages-collection.ts`**

```ts
// data/corsages-collection.ts
import type { Localized } from "@/types/product";

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
  name: Localized;
  description: Localized;
  image: {
    src: string;
    alt: Localized;
  };
};

export const CORSAGE_PIECES: readonly CorsagePiece[] = [
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
      src: "/corsages/rose-corsage.webp",
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
      src: "/corsages/rose-boutonniere.webp",
      alt: {
        en: "Single-rose boutonnière for any formal occasion",
        es: "Boutonnière de una rosa para cualquier ocasión formal",
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
      src: "/corsages/orchid-corsage.webp",
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
      src: "/corsages/orchid-boutonniere.webp",
      alt: {
        en: "Single-orchid boutonnière for any formal occasion",
        es: "Boutonnière de una orquídea para cualquier ocasión formal",
      },
    },
  },
];

export const FLOWER_GRADIENT: Record<CorsagePiece["flower"], string> = {
  rose: "bg-gradient-to-br from-[#e89aa6] to-[#c45f72]",
  orchid: "bg-gradient-to-br from-[#b4a4d4] to-[#6e5b9c]",
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run tests/unit/corsages-collection.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add data/corsages-collection.ts tests/unit/corsages-collection.test.ts
git commit -m "$(cat <<'EOF'
feat(corsages): add CorsagePiece data model and tests

Same 4 products/prices as prom collection, renamed types, image paths
updated to /corsages/.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `CorsagesOpenModalButton`

**Files:**
- Create: `components/corsages/CorsagesOpenModalButton.tsx`

**Context:** This is an exact copy of `components/prom/PromOpenModalButton.tsx` with the component name changed. It uses `useContactContext` from `@/components/contact/ContactContextProvider` to get `setOpen`. It's a `"use client"` component because it uses a hook. No tests needed — the hook is already covered by prom's equivalent, and this component has no logic beyond it.

- [ ] **Step 1: Create the component**

```tsx
// components/corsages/CorsagesOpenModalButton.tsx
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

export function CorsagesOpenModalButton({
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
          "border border-ink/30 text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        className,
      )}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "corsages" || echo "No corsages type errors"
```

Expected: "No corsages type errors" (or no output from the grep).

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add components/corsages/CorsagesOpenModalButton.tsx
git commit -m "$(cat <<'EOF'
feat(corsages): add CorsagesOpenModalButton client component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `CorsagesHero`

**Files:**
- Create: `components/corsages/CorsagesHero.tsx`

**Context:** Gallery-first design — a 3-photo CSS grid collage (2fr left column spanning 2 rows, 1fr right column split into top/bottom). Dark gradient overlay from bottom. Text anchored bottom-left: eyebrow → large serif title → subtitle. No button in the hero (the CTA section at the bottom handles that). Uses `next/image` with `fill` prop (consistent with newer components in this codebase). The images are `hero-1.webp`, `hero-2.webp`, `hero-3.webp` from `public/corsages/`. Uses `getTranslations("corsages")` for strings. Locale is passed as a prop for the `lang` attribute but isn't needed for translations (server component calls `getTranslations` directly).

- [ ] **Step 1: Create the component**

```tsx
// components/corsages/CorsagesHero.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function CorsagesHero({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  return (
    <header className="relative isolate overflow-hidden">
      {/* 3-photo collage: left column spans 2 rows, right column splits into 2 cells */}
      <div
        className="grid h-[70vh] min-h-[480px] max-h-[800px]"
        style={{ gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr" }}
      >
        {/* Main photo — spans both rows */}
        <div className="relative row-span-2 overflow-hidden">
          <Image
            src="/corsages/hero-1.webp"
            alt=""
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 66vw"
          />
        </div>
        {/* Top-right photo */}
        <div className="relative overflow-hidden border-l-2 border-b border-bone">
          <Image
            src="/corsages/hero-2.webp"
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 0vw, 34vw"
          />
        </div>
        {/* Bottom-right photo */}
        <div className="relative overflow-hidden border-l-2 border-t border-bone">
          <Image
            src="/corsages/hero-3.webp"
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 0vw, 34vw"
          />
        </div>
      </div>

      {/* Dark gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(14,13,12,0.72) 0%, rgba(14,13,12,0.2) 55%, transparent 100%)",
        }}
      />

      {/* Text anchored bottom-left */}
      <div className="absolute bottom-0 left-0 px-6 pb-10 sm:px-10 sm:pb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-petal/80">
          {t("hero_eyebrow")}
        </p>
        <h1
          className="mt-3 max-w-2xl font-display text-5xl leading-[0.95] tracking-tighter text-bone sm:text-6xl md:text-7xl"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("hero_title")}
        </h1>
        <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-bone/70 sm:text-base">
          {t("hero_sub")}
        </p>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "CorsagesHero\|corsages/CorsagesHero" || echo "No CorsagesHero type errors"
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add components/corsages/CorsagesHero.tsx
git commit -m "$(cat <<'EOF'
feat(corsages): add CorsagesHero 3-photo collage component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `CorsagesPieces`

**Files:**
- Create: `components/corsages/CorsagesPieces.tsx`

**Context:** Adapted from `components/prom/PromPieces.tsx`. Same 2×2 grid layout. Key differences: uses `CORSAGE_PIECES` from `data/corsages-collection.ts`, reads from `corsages` i18n namespace (`pieces_eyebrow`, `pieces_title`, `reserve_this`), and includes a "Reserve this piece" button that opens the modal via `CorsagesOpenModalButton`. The prom version has no per-card button — add one here per spec. Uses `<img>` with `loading="lazy"` to match the prom pattern (not next/image, since these are local statics loaded lazily). Background is `bg-bone`.

- [ ] **Step 1: Create the component**

```tsx
// components/corsages/CorsagesPieces.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { CORSAGE_PIECES, FLOWER_GRADIENT } from "@/data/corsages-collection";
import { CorsagesOpenModalButton } from "./CorsagesOpenModalButton";
import { cn } from "@/lib/cn";

export async function CorsagesPieces({ locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("pieces_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("pieces_title")}
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {CORSAGE_PIECES.map((piece) => (
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
                <div className="mt-1">
                  <CorsagesOpenModalButton variant="ghost">
                    {t("reserve_this")}
                  </CorsagesOpenModalButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "CorsagesPieces\|corsages/CorsagesPieces" || echo "No CorsagesPieces type errors"
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add components/corsages/CorsagesPieces.tsx
git commit -m "$(cat <<'EOF'
feat(corsages): add CorsagesPieces 2x2 product grid component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `CorsagesHowItWorks` and `CorsagesCTA`

**Files:**
- Create: `components/corsages/CorsagesHowItWorks.tsx`
- Create: `components/corsages/CorsagesCTA.tsx`

**Context:** Both are adapted from their `Prom*` counterparts. `CorsagesHowItWorks` uses `bg-ink text-bone` (dark panel, per spec) instead of the prom version's `bg-petal`. `CorsagesCTA` is identical to `PromCTA` except using `getTranslations("corsages")` and `CorsagesOpenModalButton`. Key i18n keys: how section uses `how_eyebrow`, `how_title`, `how_step1_title`, `how_step1_body`, `how_step2_title`, `how_step2_body`, `how_step3_title`, `how_step3_body`; CTA uses `cta_title`, `cta_button`.

- [ ] **Step 1: Create `CorsagesHowItWorks`**

```tsx
// components/corsages/CorsagesHowItWorks.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function CorsagesHowItWorks({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  const steps = [
    { n: "01", title: t("how_step1_title"), body: t("how_step1_body") },
    { n: "02", title: t("how_step2_title"), body: t("how_step2_body") },
    { n: "03", title: t("how_step3_title"), body: t("how_step3_body") },
  ];
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {t("how_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("how_title")}
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-bone/15 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-bone/40">
                {s.n}
              </span>
              <h3 className="mt-2 font-display text-xl leading-snug">
                {s.title}
              </h3>
              <p className="mt-2 font-sans text-sm text-bone/70 leading-relaxed">
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

- [ ] **Step 2: Create `CorsagesCTA`**

```tsx
// components/corsages/CorsagesCTA.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { CorsagesOpenModalButton } from "./CorsagesOpenModalButton";

export async function CorsagesCTA({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("corsages");
  return (
    <section className="bg-bone text-ink border-t border-ink/10">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24 text-center">
        <h2 className="font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("cta_title")}
        </h2>
        <div className="mt-10 flex justify-center">
          <CorsagesOpenModalButton>
            {t("cta_button")}
          </CorsagesOpenModalButton>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "CorsagesHow\|CorsagesCTA" || echo "No type errors in new components"
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add components/corsages/CorsagesHowItWorks.tsx components/corsages/CorsagesCTA.tsx
git commit -m "$(cat <<'EOF'
feat(corsages): add CorsagesHowItWorks (dark panel) and CorsagesCTA

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: New Page `app/[locale]/corsages-boutonnieres/page.tsx`

**Files:**
- Create: `app/[locale]/corsages-boutonnieres/page.tsx`

**Context:** Modelled after `app/[locale]/prom/page.tsx`. Uses `setRequestLocale`, `BreadcrumbListLD`, `Grain`. Metadata comes from i18n keys `corsages.page_title` and `corsages.meta_description` (unlike prom which hardcodes metadata in a ternary — use `getTranslations` for cleaner approach). The page composes the 4 corsages components in order: Hero → Pieces → HowItWorks → CTA. The canonical URL is `/{locale}/corsages-boutonnieres`.

- [ ] **Step 1: Create the page**

```tsx
// app/[locale]/corsages-boutonnieres/page.tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";
import { CorsagesHero } from "@/components/corsages/CorsagesHero";
import { CorsagesPieces } from "@/components/corsages/CorsagesPieces";
import { CorsagesHowItWorks } from "@/components/corsages/CorsagesHowItWorks";
import { CorsagesCTA } from "@/components/corsages/CorsagesCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "corsages" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `/${locale}/corsages-boutonnieres`,
      languages: {
        en: "/en/corsages-boutonnieres",
        es: "/es/corsages-boutonnieres",
      },
    },
  };
}

export default async function CorsagesBoutonnièresPage({
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
          {
            name: locale === "es" ? "Corsages y Boutonnières" : "Corsages & Boutonnières",
            href: `/${locale}/corsages-boutonnieres`,
          },
        ]}
      />
      <Grain />
      <CorsagesHero locale={locale} />
      <CorsagesPieces locale={locale} />
      <CorsagesHowItWorks locale={locale} />
      <CorsagesCTA locale={locale} />
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "corsages-boutonnieres\|CorsagesPage" || echo "No page type errors"
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add "app/[locale]/corsages-boutonnieres/"
git commit -m "$(cat <<'EOF'
feat(corsages): add /corsages-boutonnieres page

Gallery-first layout: CorsagesHero → CorsagesPieces → CorsagesHowItWorks → CorsagesCTA.
Metadata from i18n keys.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Redirect `/prom` → `/corsages-boutonnieres`

**Files:**
- Modify: `app/[locale]/prom/page.tsx`

**Context:** The spec says replace the prom page with a `redirect()`. In Next.js app router, use `redirect` from `"next/navigation"`. The redirect should go to `/${locale}/corsages-boutonnieres`. The prom components (`PromHero`, `PromPieces`, etc.) are left in place — they're referenced by the old route only and will go dead after this redirect, but the spec explicitly says not to delete them in this pass.

- [ ] **Step 1: Replace prom page with redirect**

Read the current file first, then replace its entire content:

```tsx
// app/[locale]/prom/page.tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";

export default async function PromPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/corsages-boutonnieres`);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "prom/page\|PromPage" || echo "No prom redirect type errors"
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add "app/[locale]/prom/page.tsx"
git commit -m "$(cat <<'EOF'
feat(corsages): redirect /prom to /corsages-boutonnieres

Old route preserved as a redirect to protect inbound links.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update `lib/contact-subject.ts`

**Files:**
- Modify: `lib/contact-subject.ts`
- Modify: `tests/unit/contact-subject.test.ts`

**Context:** Two changes: (1) add `"corsages"` to the `SubjectKey` union type; (2) add a route mapping `if (path === "/corsages-boutonnieres") return { key: "corsages" };` before the `return { key: "default" }` fallback. The prom route entry (`if (path === "/prom") return { key: "prom" };`) is kept — the prom route now redirects, but the subject key remains valid in case the modal is opened programmatically from prom.

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/contact-subject.test.ts` — append to the existing `getSubjectKey` describe block:

```ts
it("returns corsages on /corsages-boutonnieres", () => {
  expect(getSubjectKey({ pathname: "/en/corsages-boutonnieres", override: null })).toEqual({
    key: "corsages",
  });
});

it("returns corsages on /es/corsages-boutonnieres", () => {
  expect(getSubjectKey({ pathname: "/es/corsages-boutonnieres", override: null })).toEqual({
    key: "corsages",
  });
});
```

Also add `/en/corsages-boutonnieres` to the `isAllowlistedRoute` truthy list in the existing test.

- [ ] **Step 2: Run tests to confirm new cases fail**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run tests/unit/contact-subject.test.ts
```

Expected: FAIL — `returns corsages on /corsages-boutonnieres` — key is "default".

- [ ] **Step 3: Update `lib/contact-subject.ts`**

Change 1 — add `"corsages"` to `SubjectKey`:

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
  | "corsages"
  | "checkout"
  | "default";
```

Change 2 — add route mapping after the `/prom` line:

```ts
if (path === "/prom") return { key: "prom" };
if (path === "/corsages-boutonnieres") return { key: "corsages" };
```

- [ ] **Step 4: Run all contact-subject tests to confirm all pass**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run tests/unit/contact-subject.test.ts
```

Expected: PASS — all tests (original + 2 new).

- [ ] **Step 5: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add lib/contact-subject.ts tests/unit/contact-subject.test.ts
git commit -m "$(cat <<'EOF'
feat(corsages): add corsages subject key and route mapping

SubjectKey union and getSubjectKey updated for /corsages-boutonnieres.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `BentoCorsagesTile` + BentoGrid Swap

**Files:**
- Create: `components/home/BentoCorsagesTile.tsx`
- Modify: `components/home/BentoGrid.tsx`

**Context:** `BentoCorsagesTile` replaces `BentoPromTile`. It's a server component (async function, uses `getTranslations`), matching the pattern of `BentoPromTile`. Key design difference: the spec calls for a hero-photo background on the tile (full-bleed image behind the text) rather than the prom 2×2 grid of product cards. Use `hero-1.webp` as the background image with a dark overlay, then the text body below on a dark (`bg-ink`) panel. Badge top-left: "Corsages · Boutonnières". Count badge top-right. No "Limited season" footer text. The CTA links to `/${locale}/corsages-boutonnieres`.

Uses `getTranslations("home.bento.corsages")` for: `eyebrow`, `title`, `count`, `cta`.

- [ ] **Step 1: Create `BentoCorsagesTile`**

```tsx
// components/home/BentoCorsagesTile.tsx
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

export async function BentoCorsagesTile({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.bento.corsages");

  return (
    <div
      className={cn(
        "relative bg-ink text-bone rounded-[var(--radius-bento)] overflow-hidden",
        "min-h-[480px] md:min-h-[640px] h-full flex flex-col",
        "shadow-[var(--shadow-tile-rest)]",
      )}
    >
      {/* Hero image */}
      <div className="relative flex-1 min-h-[220px]">
        <Image
          src="/corsages/hero-1.webp"
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {/* Gradient to ensure badges are readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 to-ink/10" />

        {/* Category badge — top left */}
        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-ink/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-petal backdrop-blur-sm">
            {t("eyebrow")}
          </span>
        </div>

        {/* Count badge — top right */}
        <div className="absolute top-3 right-3">
          <span className="rounded-full bg-ink/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bone/60 backdrop-blur-sm">
            {t("count")}
          </span>
        </div>
      </div>

      {/* Text body */}
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          Corsages · Boutonnières
        </p>
        <h3
          className="font-display italic text-3xl md:text-4xl tracking-tighter leading-[0.9] text-bone"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("title")}
        </h3>
        <Link
          href={`/${locale}/corsages-boutonnieres`}
          className="self-start rounded-full bg-rouge px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone transition hover:bg-rouge/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge/60"
        >
          {t("cta")} →
        </Link>
      </div>
    </div>
  );
}
```

**Note on `bg-rouge`:** The Tailwind token for `#B8345E` in this codebase is `text-rouge` / `bg-rouge` (check `tailwind.config.ts` or the CSS variables file). If `rouge` isn't a defined token, use `bg-[#B8345E]` as a fallback.

- [ ] **Step 2: Check the rouge token exists**

```bash
grep -r "rouge\|B8345E" "/Users/santiagocardonacastellanos/Desktop/Diva Flowers/tailwind.config.ts" "/Users/santiagocardonacastellanos/Desktop/Diva Flowers/app/globals.css" 2>/dev/null | head -10
```

If `rouge` is not a token, replace `bg-rouge` and `focus-visible:ring-rouge/60` in the component with `bg-[#B8345E]` and `focus-visible:ring-[#B8345E]/60`.

- [ ] **Step 3: Update `BentoGrid.tsx` to swap the tile**

In `components/home/BentoGrid.tsx`:

Change the import:
```diff
-import { BentoPromTile } from "./BentoPromTile";
+import { BentoCorsagesTile } from "./BentoCorsagesTile";
```

Change the JSX:
```diff
-          <BentoPromTile locale={locale} />
+          <BentoCorsagesTile locale={locale} />
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit 2>&1 | grep "BentoCorsages\|BentoGrid" || echo "No BentoGrid type errors"
```

- [ ] **Step 5: Run full test suite**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
PATH="/opt/homebrew/bin:$PATH" npx vitest run
```

Expected: all tests pass, including corsages-collection, corsages-i18n, and updated contact-subject.

- [ ] **Step 6: Commit**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git add components/home/BentoCorsagesTile.tsx components/home/BentoGrid.tsx
git commit -m "$(cat <<'EOF'
feat(corsages): add BentoCorsagesTile and wire into BentoGrid

Replaces BentoPromTile with year-round corsages tile. Hero photo
background, editorial title, links to /corsages-boutonnieres.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

Before declaring done, verify against the spec:

1. **`/corsages-boutonnieres` route renders** — `CorsagesHero`, `CorsagesPieces`, `CorsagesHowItWorks`, `CorsagesCTA` in order. ✓
2. **`/prom` redirects** to `/[locale]/corsages-boutonnieres`. ✓
3. **3-photo collage hero** with dark gradient overlay and text anchored bottom-left. ✓
4. **Occasions mentioned in hero subtitle only** (not as categories). ✓
5. **Same 4 products, same prices** — $35, $15, $45, $25. ✓
6. **"Reserve this piece" button per card** → opens `TextMakyModal`. ✓
7. **`CorsagesHowItWorks` is dark** (`bg-ink`). ✓
8. **`BentoCorsagesTile` replaces `BentoPromTile`** in home grid. ✓
9. **No seasonal framing** in home tile copy. ✓
10. **`corsages` subject key** added to `contact-subject.ts`. ✓
11. **`prom.*` i18n keys kept** (not deleted). ✓
12. **All tests pass.** ✓
