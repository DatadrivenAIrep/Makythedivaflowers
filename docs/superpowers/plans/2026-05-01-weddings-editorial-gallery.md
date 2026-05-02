# Weddings Editorial Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder masonry on `/weddings` with an editorial 17-photo gallery: asymmetric mosaics, two full-bleed cinematic hero images with strong parallax, and an auto-scrolling marquee finale.

**Architecture:** A new `components/weddings/gallery/` directory containing one orchestrator (`GalleryEditorial`) and four block primitives (`GalleryMosaic`, `GalleryHero`, `GalleryMarquee`, `GalleryLightbox`) plus a shared `GalleryTile`. Data lives in `data/wedding-portfolio.ts` with a `layout: "mosaic" | "hero"` field that drives block grouping. Animations use Framer Motion (`useScroll`, `useTransform`, `LayoutGroup`) and respect `useReducedMotion()`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Framer Motion 12, next-intl, Vitest + React Testing Library, Playwright.

**Spec:** [docs/superpowers/specs/2026-05-01-weddings-editorial-gallery-design.md](../specs/2026-05-01-weddings-editorial-gallery-design.md)

---

## File Structure

**New files:**
```
public/weddings/01.webp ... 17.webp                  17 image assets
components/weddings/gallery/
  GalleryEditorial.tsx                                orchestrator
  GalleryMosaic.tsx                                   asymmetric grid block
  GalleryHero.tsx                                     full-bleed parallax block
  GalleryMarquee.tsx                                  auto-scroll horizontal strip
  GalleryTile.tsx                                     shared tile primitive
  GalleryLightbox.tsx                                 modal with shared layout
tests/unit/wedding-portfolio.test.ts                  data shape validation
tests/unit/gallery-editorial.test.tsx                 component behavior
```

**Modified files:**
```
data/wedding-portfolio.ts                             17 real photos, layout field
app/[locale]/weddings/page.tsx                        swap import
messages/en.json, messages/es.json                    new i18n keys
components/weddings/MasonryGallery.tsx                deleted
```

## Image Mapping

The 17 source files in `~/Downloads` are copied to `public/weddings/` and renamed sequentially. The renaming and per-image layout/aspect assignments are derived from actual dimensions (verified with `file`):

| New name | Source                | Dimensions  | Aspect | Layout |
|----------|-----------------------|-------------|--------|--------|
| 01.webp  | `1.webp`              | 960×658     | 16/9   | mosaic |
| 02.webp  | `3 (1).webp`          | 685×960     | 3/4    | mosaic |
| 03.webp  | `5 (2).webp`          | 2560×1920   | 16/9   | mosaic |
| 04.webp  | `12 (1).webp`         | 2560×2056   | 1/1    | mosaic |
| 05.webp  | `7 (1).webp`          | 1920×2560   | 3/4    | mosaic |
| 06.webp  | `oh1-scaled.webp`     | 2560×1313   | 16/9   | **hero** |
| 07.webp  | `6 (1).webp`          | 2560×1920   | 16/9   | mosaic |
| 08.webp  | `4.jpg` → webp        | 1368×2020   | 3/4    | mosaic |
| 09.webp  | `8 (1).webp`          | 2560×1920   | 16/9   | mosaic |
| 10.webp  | `11 (1).webp`         | 1920×2560   | 3/4    | mosaic |
| 11.webp  | `2.webp`              | 960×680     | 16/9   | mosaic |
| 12.webp  | `9 (1).webp`          | 2560×1920   | 16/9   | **hero** |
| 13.webp  | `10 (1).webp`         | 2560×1920   | 16/9   | mosaic |
| 14.webp  | `oh2.webp`            | 2496×2448   | 1/1    | mosaic |
| 15.webp  | `per15.webp`          | 983×600     | 16/9   | mosaic |
| 16.webp  | `per19.webp`          | 600×400     | 16/9   | mosaic |
| 17.webp  | `per18.webp`          | 600×209     | 16/9   | mosaic |

Sequence: `mosaic × 5, hero, mosaic × 5, hero, mosaic × 5` — exactly 17 photos.

---

## Task 1: Copy and convert source images to public/weddings/

**Files:**
- Create: `public/weddings/01.webp` through `public/weddings/17.webp`

- [ ] **Step 1: Verify all 17 source files exist**

Run from project root:
```bash
ls -1 ~/Downloads/{1,2,3\ \(1\),5\ \(2\),6\ \(1\),7\ \(1\),8\ \(1\),9\ \(1\),10\ \(1\),11\ \(1\),12\ \(1\)}.webp \
       ~/Downloads/4.jpg \
       ~/Downloads/{oh1-scaled,oh2,per15,per18,per19}.webp 2>&1 | wc -l
```
Expected: `17`

- [ ] **Step 2: Create the destination directory**

```bash
mkdir -p public/weddings
```

- [ ] **Step 3: Copy and rename the 16 webp sources**

```bash
cp "$HOME/Downloads/1.webp"          public/weddings/01.webp
cp "$HOME/Downloads/3 (1).webp"      public/weddings/02.webp
cp "$HOME/Downloads/5 (2).webp"      public/weddings/03.webp
cp "$HOME/Downloads/12 (1).webp"     public/weddings/04.webp
cp "$HOME/Downloads/7 (1).webp"      public/weddings/05.webp
cp "$HOME/Downloads/oh1-scaled.webp" public/weddings/06.webp
cp "$HOME/Downloads/6 (1).webp"      public/weddings/07.webp
cp "$HOME/Downloads/8 (1).webp"      public/weddings/09.webp
cp "$HOME/Downloads/11 (1).webp"     public/weddings/10.webp
cp "$HOME/Downloads/2.webp"          public/weddings/11.webp
cp "$HOME/Downloads/9 (1).webp"      public/weddings/12.webp
cp "$HOME/Downloads/10 (1).webp"     public/weddings/13.webp
cp "$HOME/Downloads/oh2.webp"        public/weddings/14.webp
cp "$HOME/Downloads/per15.webp"      public/weddings/15.webp
cp "$HOME/Downloads/per19.webp"      public/weddings/16.webp
cp "$HOME/Downloads/per18.webp"      public/weddings/17.webp
```

- [ ] **Step 4: Convert 4.jpg to 08.webp**

The repo has `sharp` available transitively via Next.js (used at build time). Use `npx sharp-cli` to convert:

```bash
npx --yes sharp-cli --input "$HOME/Downloads/4.jpg" --output public/weddings/08.webp -q 82 resize 2400
```

If `sharp-cli` isn't available, use ImageMagick (`magick "$HOME/Downloads/4.jpg" -quality 82 public/weddings/08.webp`) or any tool that produces a webp under 500KB. Verify the file exists and is a valid webp:
```bash
file public/weddings/08.webp
```
Expected: `Web/P image, ...`

- [ ] **Step 5: Verify all 17 destination files**

```bash
ls -1 public/weddings/*.webp | wc -l
```
Expected: `17`

```bash
ls -lh public/weddings/ | awk 'NR>1 {sum += $5} END {print sum}'
```
Expected: total bytes under ~6 MB. If higher, recompress oversized files: `npx sharp-cli --input public/weddings/NN.webp --output public/weddings/NN.webp -q 82 resize 2400`.

- [ ] **Step 6: Commit**

```bash
git add public/weddings/
git commit -m "feat(weddings): add 17 portfolio photos to public/weddings"
```

---

## Task 2: Replace data/wedding-portfolio.ts with real photos and layout field

**Files:**
- Modify: `data/wedding-portfolio.ts`
- Test: `tests/unit/wedding-portfolio.test.ts` (create)

- [ ] **Step 1: Write the failing data validation test**

Create `tests/unit/wedding-portfolio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weddingPortfolio, type PortfolioPhoto } from "@/data/wedding-portfolio";
import fs from "node:fs";
import path from "node:path";

describe("wedding-portfolio", () => {
  it("has exactly 17 entries", () => {
    expect(weddingPortfolio).toHaveLength(17);
  });

  it("has the expected layout sequence: 5 mosaic, hero, 5 mosaic, hero, 5 mosaic", () => {
    const layouts = weddingPortfolio.map((p) => p.layout);
    expect(layouts).toEqual([
      "mosaic", "mosaic", "mosaic", "mosaic", "mosaic",
      "hero",
      "mosaic", "mosaic", "mosaic", "mosaic", "mosaic",
      "hero",
      "mosaic", "mosaic", "mosaic", "mosaic", "mosaic",
    ]);
  });

  it("has unique ids", () => {
    const ids = weddingPortfolio.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(["4/5", "1/1", "16/9", "3/4"] as const)("only uses allowed aspect %s when present", (aspect) => {
    const allowed = new Set(["4/5", "1/1", "16/9", "3/4"]);
    weddingPortfolio.forEach((p: PortfolioPhoto) => {
      expect(allowed.has(p.aspect)).toBe(true);
    });
  });

  it("references files that exist in public/weddings/", () => {
    weddingPortfolio.forEach((p) => {
      expect(p.src).toMatch(/^\/weddings\/\d{2}\.webp$/);
      const filePath = path.join(process.cwd(), "public", p.src);
      expect(fs.existsSync(filePath), `missing file: ${filePath}`).toBe(true);
    });
  });

  it("has non-empty bilingual alt text for every photo", () => {
    weddingPortfolio.forEach((p) => {
      expect(p.alt.en.trim().length).toBeGreaterThan(0);
      expect(p.alt.es.trim().length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- wedding-portfolio
```
Expected: FAIL — current data has 12 entries with picsum URLs and no `layout` field.

- [ ] **Step 3: Replace data/wedding-portfolio.ts**

```ts
// data/wedding-portfolio.ts
export type PortfolioPhoto = {
  id: string;
  src: string;
  alt: { en: string; es: string };
  aspect: "4/5" | "1/1" | "16/9" | "3/4";
  layout: "mosaic" | "hero";
};

// Source-to-renamed mapping (recorded for traceability):
//   01.webp ← 1.webp                 02.webp ← 3 (1).webp
//   03.webp ← 5 (2).webp             04.webp ← 12 (1).webp
//   05.webp ← 7 (1).webp             06.webp ← oh1-scaled.webp  [hero 1]
//   07.webp ← 6 (1).webp             08.webp ← 4.jpg (converted to webp)
//   09.webp ← 8 (1).webp             10.webp ← 11 (1).webp
//   11.webp ← 2.webp                 12.webp ← 9 (1).webp       [hero 2]
//   13.webp ← 10 (1).webp            14.webp ← oh2.webp
//   15.webp ← per15.webp             16.webp ← per19.webp
//   17.webp ← per18.webp

export const weddingPortfolio: PortfolioPhoto[] = [
  { id: "w01", src: "/weddings/01.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Wedding florals from the Diva studio floor",    es: "Florales de boda desde el estudio de Diva" } },
  { id: "w02", src: "/weddings/02.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Bridal bouquet in soft natural light",          es: "Ramo de novia en luz natural suave" } },
  { id: "w03", src: "/weddings/03.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Reception centerpiece in full bloom",           es: "Centro de mesa de recepción en plena flor" } },
  { id: "w04", src: "/weddings/04.webp", aspect: "1/1",  layout: "mosaic", alt: { en: "Detail of garden roses and ranunculus",         es: "Detalle de rosas de jardín y ranúnculos" } },
  { id: "w05", src: "/weddings/05.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Ceremony arrangement, elegant white blooms",    es: "Arreglo de ceremonia, flores blancas elegantes" } },
  { id: "w06", src: "/weddings/06.webp", aspect: "16/9", layout: "hero",   alt: { en: "Cinematic wide view of a Diva wedding install", es: "Vista panorámica de una instalación de boda Diva" } },
  { id: "w07", src: "/weddings/07.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Tablescape with low-and-lush centerpieces",     es: "Mesa con centros bajos y abundantes" } },
  { id: "w08", src: "/weddings/08.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Vertical floral installation detail",           es: "Detalle de instalación floral vertical" } },
  { id: "w09", src: "/weddings/09.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Reception florals at golden hour",              es: "Florales de recepción al atardecer" } },
  { id: "w10", src: "/weddings/10.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Tall arrangement against natural backdrop",     es: "Arreglo alto contra fondo natural" } },
  { id: "w11", src: "/weddings/11.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Soft and romantic floral palette",              es: "Paleta floral suave y romántica" } },
  { id: "w12", src: "/weddings/12.webp", aspect: "16/9", layout: "hero",   alt: { en: "Full-room reception florals, wide view",        es: "Florales de recepción de salón completo" } },
  { id: "w13", src: "/weddings/13.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Ceremony arch in full bloom",                   es: "Arco de ceremonia en plena flor" } },
  { id: "w14", src: "/weddings/14.webp", aspect: "1/1",  layout: "mosaic", alt: { en: "Square detail of textured greenery and blooms", es: "Detalle cuadrado de follaje texturado y flores" } },
  { id: "w15", src: "/weddings/15.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Mixed bouquet with seasonal stems",             es: "Ramo mixto con tallos de temporada" } },
  { id: "w16", src: "/weddings/16.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Editorial portrait of a Diva arrangement",      es: "Retrato editorial de un arreglo Diva" } },
  { id: "w17", src: "/weddings/17.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Panoramic view of a Diva wedding setup",        es: "Vista panorámica de un montaje de boda Diva" } },
];
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- wedding-portfolio
```
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add data/wedding-portfolio.ts tests/unit/wedding-portfolio.test.ts
git commit -m "feat(weddings): real portfolio data with mosaic/hero layout field"
```

---

## Task 3: Build GalleryTile primitive

The single shared tile used by mosaics and the marquee. Renders an `<Image>` inside an aspect-ratio frame, applies inner-image parallax driven by scroll, fade+lift+blur entry on first viewport intersection, hover scale, and an optional bottom-left index number. Honors `useReducedMotion()`.

**Files:**
- Create: `components/weddings/gallery/GalleryTile.tsx`
- Test: `tests/unit/gallery-tile.test.tsx`

- [ ] **Step 1: Write the failing tile test**

Create `tests/unit/gallery-tile.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryTile } from "@/components/weddings/gallery/GalleryTile";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const photo = {
  id: "w01",
  src: "/weddings/01.webp",
  alt: { en: "Sample wedding photo", es: "Foto de boda" },
  aspect: "4/5" as const,
  layout: "mosaic" as const,
};

describe("GalleryTile", () => {
  it("renders an image with the alt text for the locale", () => {
    render(<GalleryTile photo={photo} locale="en" index={0} onOpen={() => {}} />);
    expect(screen.getByAltText("Sample wedding photo")).toBeInTheDocument();
  });

  it("renders a button so the tile is clickable", () => {
    render(<GalleryTile photo={photo} locale="en" index={0} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "Sample wedding photo" })).toBeInTheDocument();
  });

  it("calls onOpen with the index when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryTile photo={photo} locale="en" index={4} onOpen={onOpen} />);
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(4);
  });

  it("renders the index number when showIndex is true", () => {
    render(<GalleryTile photo={photo} locale="en" index={2} showIndex onOpen={() => {}} />);
    expect(screen.getByText("03")).toBeInTheDocument();
  });

  it("does not render the index number when showIndex is false", () => {
    render(<GalleryTile photo={photo} locale="en" index={2} onOpen={() => {}} />);
    expect(screen.queryByText("03")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- gallery-tile
```
Expected: FAIL — `GalleryTile` does not exist.

- [ ] **Step 3: Implement GalleryTile**

Create `components/weddings/gallery/GalleryTile.tsx`:

```tsx
"use client";
import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

const ASPECT_DIMENSIONS: Record<PortfolioPhoto["aspect"], [number, number]> = {
  "1/1":  [1200, 1200],
  "16/9": [2400, 1350],
  "3/4":  [1500, 2000],
  "4/5":  [1200, 1500],
};

const ASPECT_CLASS: Record<PortfolioPhoto["aspect"], string> = {
  "1/1":  "aspect-square",
  "16/9": "aspect-[16/9]",
  "3/4":  "aspect-[3/4]",
  "4/5":  "aspect-[4/5]",
};

type Props = {
  photo: PortfolioPhoto;
  locale: Locale;
  index: number;
  showIndex?: boolean;
  priority?: boolean;
  sizes?: string;
  onOpen: (index: number) => void;
};

export function GalleryTile({ photo, locale, index, showIndex = false, priority = false, sizes = "(max-width: 768px) 100vw, 33vw", onOpen }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-12, 12]);

  const [w, h] = ASPECT_DIMENSIONS[photo.aspect];
  const aspectCls = ASPECT_CLASS[photo.aspect];
  const label = String(index + 1).padStart(2, "0");

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={photo.alt[locale]}
      className={`group relative block w-full overflow-hidden rounded-2xl bg-bone ${aspectCls}`}
      initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div className="absolute inset-0" style={reduce ? undefined : { y, willChange: "transform" }}>
        <Image
          src={photo.src}
          alt={photo.alt[locale]}
          width={w}
          height={h}
          sizes={sizes}
          priority={priority}
          className="h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </motion.div>
      {showIndex && (
        <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-ink/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-bone backdrop-blur-sm transition-all duration-300 translate-y-2 opacity-60 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100">
          {label}
        </span>
      )}
    </motion.button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- gallery-tile
```
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add components/weddings/gallery/GalleryTile.tsx tests/unit/gallery-tile.test.tsx
git commit -m "feat(weddings/gallery): add GalleryTile primitive"
```

---

## Task 4: Build GalleryMosaic block

A 5-tile asymmetric grid (3 columns desktop, 2 tablet, 1 mobile) with stagger entry. Receives a slice of photos (always exactly 5 in our data, but the component is N-tile flexible).

**Files:**
- Create: `components/weddings/gallery/GalleryMosaic.tsx`
- Test: `tests/unit/gallery-mosaic.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gallery-mosaic.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryMosaic } from "@/components/weddings/gallery/GalleryMosaic";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryMosaic", () => {
  it("renders one image per photo passed in", () => {
    const slice = weddingPortfolio.slice(0, 5);
    const indices = [0, 1, 2, 3, 4];
    render(<GalleryMosaic photos={slice} indices={indices} locale="en" onOpen={() => {}} />);
    slice.forEach((p) => {
      expect(screen.getByAltText(p.alt.en)).toBeInTheDocument();
    });
  });

  it("renders index labels using the global indices", () => {
    const slice = weddingPortfolio.slice(0, 3);
    render(<GalleryMosaic photos={slice} indices={[0, 1, 2]} locale="en" onOpen={() => {}} />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- gallery-mosaic
```
Expected: FAIL — `GalleryMosaic` does not exist.

- [ ] **Step 3: Implement GalleryMosaic**

Create `components/weddings/gallery/GalleryMosaic.tsx`:

```tsx
"use client";
import { GalleryTile } from "./GalleryTile";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  indices: number[];
  locale: Locale;
  priorityFirst?: boolean;
  onOpen: (index: number) => void;
};

export function GalleryMosaic({ photos, indices, locale, priorityFirst = false, onOpen }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, i) => (
          <GalleryTile
            key={photo.id}
            photo={photo}
            locale={locale}
            index={indices[i]}
            showIndex
            priority={priorityFirst && i === 0}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- gallery-mosaic
```
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add components/weddings/gallery/GalleryMosaic.tsx tests/unit/gallery-mosaic.test.tsx
git commit -m "feat(weddings/gallery): add GalleryMosaic block"
```

---

## Task 5: Build GalleryHero block

A full-bleed (edge-to-edge) image with strong inner parallax and a longer fade+scale entry. No index number. Click opens lightbox.

**Files:**
- Create: `components/weddings/gallery/GalleryHero.tsx`
- Test: `tests/unit/gallery-hero.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gallery-hero.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryHero } from "@/components/weddings/gallery/GalleryHero";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryHero", () => {
  const heroPhoto = weddingPortfolio.find((p) => p.layout === "hero")!;

  it("renders the hero image edge-to-edge with no index label", () => {
    render(<GalleryHero photo={heroPhoto} index={5} locale="en" onOpen={() => {}} />);
    expect(screen.getByAltText(heroPhoto.alt.en)).toBeInTheDocument();
    expect(screen.queryByText("06")).not.toBeInTheDocument();
  });

  it("calls onOpen with the index when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryHero photo={heroPhoto} index={5} locale="en" onOpen={onOpen} />);
    await user.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- gallery-hero
```
Expected: FAIL.

- [ ] **Step 3: Implement GalleryHero**

Create `components/weddings/gallery/GalleryHero.tsx`:

```tsx
"use client";
import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photo: PortfolioPhoto;
  index: number;
  locale: Locale;
  onOpen: (index: number) => void;
};

export function GalleryHero({ photo, index, locale, onOpen }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-100, 100]);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={photo.alt[locale]}
      className="group relative block w-full overflow-hidden bg-ink"
      initial={reduce ? false : { opacity: 0, scale: 1.02 }}
      whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="relative aspect-[16/9] max-h-[90vh]">
        <motion.div className="absolute inset-[-10%]" style={reduce ? undefined : { y, willChange: "transform" }}>
          <Image
            src={photo.src}
            alt={photo.alt[locale]}
            fill
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </div>
    </motion.button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- gallery-hero
```
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add components/weddings/gallery/GalleryHero.tsx tests/unit/gallery-hero.test.tsx
git commit -m "feat(weddings/gallery): add GalleryHero full-bleed block"
```

---

## Task 6: Build GalleryMarquee block

Auto-scrolling horizontal strip of all 17 photos, infinite loop via duplicated row. Pauses on hover/focus. Tiles open lightbox by global index.

**Files:**
- Create: `components/weddings/gallery/GalleryMarquee.tsx`
- Test: `tests/unit/gallery-marquee.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gallery-marquee.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryMarquee } from "@/components/weddings/gallery/GalleryMarquee";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryMarquee", () => {
  it("renders every photo at least once (duplicated row counts as same alt text)", () => {
    render(<GalleryMarquee photos={weddingPortfolio} locale="en" onOpen={() => {}} />);
    weddingPortfolio.forEach((p) => {
      // each photo appears twice (original + duplicate row); use getAllByAltText
      expect(screen.getAllByAltText(p.alt.en).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("uses role=region with the marquee_label", () => {
    render(<GalleryMarquee photos={weddingPortfolio} locale="en" onOpen={() => {}} />);
    expect(screen.getByRole("region", { name: "marquee_label" })).toBeInTheDocument();
  });

  it("opens the lightbox at the photo's global index when a tile is clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GalleryMarquee photos={weddingPortfolio} locale="en" onOpen={onOpen} />);
    const region = screen.getByRole("region", { name: "marquee_label" });
    const button = within(region).getAllByRole("button", { name: weddingPortfolio[3].alt.en })[0];
    await user.click(button);
    expect(onOpen).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- gallery-marquee
```
Expected: FAIL.

- [ ] **Step 3: Implement GalleryMarquee**

Create `components/weddings/gallery/GalleryMarquee.tsx`:

```tsx
"use client";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  locale: Locale;
  onOpen: (index: number) => void;
};

const TILE_HEIGHTS = [220, 280, 200, 260, 240]; // px, cycled across photos

export function GalleryMarquee({ photos, locale, onOpen }: Props) {
  const t = useTranslations("weddings.gallery");
  const reduce = useReducedMotion();

  const renderRow = (keyPrefix: string) =>
    photos.map((photo, i) => {
      const h = TILE_HEIGHTS[i % TILE_HEIGHTS.length];
      const w = Math.round(h * 1.4);
      return (
        <button
          key={`${keyPrefix}-${photo.id}`}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={photo.alt[locale]}
          className="relative shrink-0 overflow-hidden rounded-xl bg-bone"
          style={{ height: h, width: w }}
        >
          <Image
            src={photo.src}
            alt={photo.alt[locale]}
            fill
            sizes="30vw"
            className="object-cover transition-transform duration-500 hover:scale-[1.04] motion-reduce:transition-none motion-reduce:hover:scale-100"
          />
        </button>
      );
    });

  return (
    <section
      role="region"
      aria-label={t("marquee_label")}
      className="relative w-full overflow-hidden py-12 group"
    >
      <div
        className={`flex gap-4 ${reduce ? "overflow-x-auto" : "marquee-track"}`}
        style={reduce ? undefined : { width: "max-content" }}
      >
        {renderRow("a")}
        {!reduce && renderRow("b")}
      </div>
      <style jsx>{`
        .marquee-track {
          animation: marquee 45s linear infinite;
        }
        :global(.group:hover) .marquee-track,
        :global(.group:focus-within) .marquee-track {
          animation-play-state: paused;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none; }
        }
      `}</style>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- gallery-marquee
```
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add components/weddings/gallery/GalleryMarquee.tsx tests/unit/gallery-marquee.test.tsx
git commit -m "feat(weddings/gallery): add GalleryMarquee auto-scroll strip"
```

---

## Task 7: Build GalleryLightbox

Full-screen modal with shared-element transition (`layoutId`) and keyboard navigation (Esc, ←, →). Reuses existing i18n keys (`close`, `prev`, `next`).

**Files:**
- Create: `components/weddings/gallery/GalleryLightbox.tsx`
- Test: `tests/unit/gallery-lightbox.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gallery-lightbox.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryLightbox } from "@/components/weddings/gallery/GalleryLightbox";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryLightbox", () => {
  it("renders the active photo and a dialog", () => {
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={2}
        locale="en"
        onClose={() => {}}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText(weddingPortfolio[2].alt.en)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={0}
        locale="en"
        onClose={onClose}
        onChange={() => {}}
      />
    );
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onChange with next index on right arrow click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={0}
        locale="en"
        onClose={() => {}}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("wraps around when navigating past the last photo", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={weddingPortfolio.length - 1}
        locale="en"
        onClose={() => {}}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "next" }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("closes on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={0}
        locale="en"
        onClose={onClose}
        onChange={() => {}}
      />
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- gallery-lightbox
```
Expected: FAIL.

- [ ] **Step 3: Implement GalleryLightbox**

Create `components/weddings/gallery/GalleryLightbox.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  activeIndex: number | null;
  locale: Locale;
  onClose: () => void;
  onChange: (next: number) => void;
};

export function GalleryLightbox({ photos, activeIndex, locale, onClose, onChange }: Props) {
  const t = useTranslations("weddings.gallery");
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange((activeIndex + 1) % photos.length);
      if (e.key === "ArrowLeft") onChange((activeIndex - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, onChange, onClose, photos.length]);

  const active = activeIndex === null ? null : photos[activeIndex];

  return (
    <AnimatePresence>
      {active && activeIndex !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt[locale]}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 backdrop-blur-xl p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_70%)]" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute top-6 right-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={() => onChange((activeIndex - 1 + photos.length) % photos.length)}
            aria-label={t("prev")}
            className="absolute left-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <CaretLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => onChange((activeIndex + 1) % photos.length)}
            aria-label={t("next")}
            className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <CaretRight size={18} />
          </button>
          <motion.div
            layoutId={reduce ? undefined : `gallery-${active.id}`}
            className="relative h-[90vh] w-[90vw]"
          >
            <Image
              src={active.src}
              alt={active.alt[locale]}
              fill
              sizes="90vw"
              priority
              className="object-contain"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- gallery-lightbox
```
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add components/weddings/gallery/GalleryLightbox.tsx tests/unit/gallery-lightbox.test.tsx
git commit -m "feat(weddings/gallery): add GalleryLightbox with keyboard nav"
```

---

## Task 8: Build GalleryEditorial orchestrator

Walks `weddingPortfolio`, splits into mosaic blocks separated by hero blocks, renders each in order, then `GalleryMarquee` and `GalleryLightbox`. Owns the `activeIndex` state and click handlers.

**Files:**
- Create: `components/weddings/gallery/GalleryEditorial.tsx`
- Test: `tests/unit/gallery-editorial.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gallery-editorial.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryEditorial } from "@/components/weddings/gallery/GalleryEditorial";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryEditorial", () => {
  it("renders an eyebrow and title", () => {
    render(<GalleryEditorial locale="en" />);
    expect(screen.getByText("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("renders all 17 photos at least once across mosaics + heroes", () => {
    render(<GalleryEditorial locale="en" />);
    weddingPortfolio.forEach((p) => {
      expect(screen.getAllByAltText(p.alt.en).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens the lightbox when a mosaic tile is clicked", async () => {
    const user = userEvent.setup();
    render(<GalleryEditorial locale="en" />);
    const firstPhoto = weddingPortfolio[0];
    const buttons = screen.getAllByRole("button", { name: firstPhoto.alt.en });
    await user.click(buttons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the lightbox when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<GalleryEditorial locale="en" />);
    const buttons = screen.getAllByRole("button", { name: weddingPortfolio[0].alt.en });
    await user.click(buttons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    // AnimatePresence exit may keep DOM briefly; query asynchronously
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- gallery-editorial
```
Expected: FAIL.

- [ ] **Step 3: Implement GalleryEditorial**

Create `components/weddings/gallery/GalleryEditorial.tsx`:

```tsx
"use client";
import { useState } from "react";
import { LayoutGroup } from "framer-motion";
import { useTranslations } from "next-intl";
import { weddingPortfolio, type PortfolioPhoto } from "@/data/wedding-portfolio";
import { GalleryMosaic } from "./GalleryMosaic";
import { GalleryHero } from "./GalleryHero";
import { GalleryMarquee } from "./GalleryMarquee";
import { GalleryLightbox } from "./GalleryLightbox";
import type { Locale } from "@/types/locale";

type Block =
  | { kind: "mosaic"; photos: PortfolioPhoto[]; indices: number[] }
  | { kind: "hero"; photo: PortfolioPhoto; index: number };

function buildBlocks(photos: PortfolioPhoto[]): Block[] {
  const blocks: Block[] = [];
  let bucket: { photos: PortfolioPhoto[]; indices: number[] } = { photos: [], indices: [] };
  photos.forEach((photo, i) => {
    if (photo.layout === "hero") {
      if (bucket.photos.length > 0) {
        blocks.push({ kind: "mosaic", ...bucket });
        bucket = { photos: [], indices: [] };
      }
      blocks.push({ kind: "hero", photo, index: i });
    } else {
      bucket.photos.push(photo);
      bucket.indices.push(i);
    }
  });
  if (bucket.photos.length > 0) blocks.push({ kind: "mosaic", ...bucket });
  return blocks;
}

export function GalleryEditorial({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.gallery");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const blocks = buildBlocks(weddingPortfolio);

  return (
    <LayoutGroup>
      <section className="py-24">
        <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <div className="space-y-16 md:space-y-24">
          {blocks.map((block, bi) => {
            if (block.kind === "mosaic") {
              return (
                <GalleryMosaic
                  key={`m-${bi}`}
                  photos={block.photos}
                  indices={block.indices}
                  locale={locale}
                  priorityFirst={bi === 0}
                  onOpen={setActiveIndex}
                />
              );
            }
            return (
              <GalleryHero
                key={`h-${bi}`}
                photo={block.photo}
                index={block.index}
                locale={locale}
                onOpen={setActiveIndex}
              />
            );
          })}
        </div>
        <div className="mt-16 md:mt-24">
          <GalleryMarquee photos={weddingPortfolio} locale={locale} onOpen={setActiveIndex} />
        </div>
      </section>
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={activeIndex}
        locale={locale}
        onClose={() => setActiveIndex(null)}
        onChange={setActiveIndex}
      />
    </LayoutGroup>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- gallery-editorial
```
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add components/weddings/gallery/GalleryEditorial.tsx tests/unit/gallery-editorial.test.tsx
git commit -m "feat(weddings/gallery): add GalleryEditorial orchestrator"
```

---

## Task 9: Add new i18n keys for the marquee

The lightbox keys (`close`, `prev`, `next`) and section headers (`eyebrow`, `title`) already exist. Add `marquee_label`.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add the new key to messages/en.json**

Edit `messages/en.json`. In the `"weddings": { "gallery": { ... } }` block, add `"marquee_label"`:

```json
"gallery": {
  "eyebrow": "Portfolio",
  "title": "From the studio floor.",
  "close": "Close lightbox",
  "prev": "Previous photo",
  "next": "Next photo",
  "marquee_label": "Wedding portfolio in motion"
}
```

- [ ] **Step 2: Add the new key to messages/es.json**

Edit `messages/es.json`. In the same block:

```json
"gallery": {
  "eyebrow": "Portafolio",
  "title": "Desde el piso del estudio.",
  "close": "Cerrar visor",
  "prev": "Foto anterior",
  "next": "Foto siguiente",
  "marquee_label": "Portafolio de bodas en movimiento"
}
```

- [ ] **Step 3: Validate that both files are still valid JSON**

```bash
python3 -c "import json; json.load(open('messages/en.json')); json.load(open('messages/es.json')); print('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(weddings): add marquee_label i18n key"
```

---

## Task 10: Wire GalleryEditorial into the weddings page and delete the old MasonryGallery

**Files:**
- Modify: `app/[locale]/weddings/page.tsx`
- Delete: `components/weddings/MasonryGallery.tsx`

- [ ] **Step 1: Replace the import and usage in app/[locale]/weddings/page.tsx**

Change the import:
```tsx
// before
import { MasonryGallery } from "@/components/weddings/MasonryGallery";
// after
import { GalleryEditorial } from "@/components/weddings/gallery/GalleryEditorial";
```

Change the JSX usage in the same file:
```tsx
// before
<MasonryGallery locale={locale} />
// after
<GalleryEditorial locale={locale} />
```

- [ ] **Step 2: Delete the old MasonryGallery component**

```bash
git rm components/weddings/MasonryGallery.tsx
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Run typecheck and build**

```bash
npx tsc --noEmit
npm run build
```
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/weddings/page.tsx
git commit -m "feat(weddings): wire GalleryEditorial, remove old MasonryGallery"
```

---

## Task 11: Manual verification in the dev server

Animations and visual polish cannot be fully verified by unit tests. Run the dev server and spot-check the page in a browser.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```
Wait for the "Ready on http://localhost:3000" line.

- [ ] **Step 2: Open the weddings page in a browser**

Navigate to `http://localhost:3000/en/weddings`. Scroll through the entire page.

Visual checklist (note any failures and fix before completion):
- [ ] Eyebrow `Portfolio` and title `From the studio floor.` render above the gallery.
- [ ] Mosaic 1 shows 5 tiles in a 3-column grid on desktop.
- [ ] Hero 1 (image `06.webp`) appears full-bleed edge-to-edge.
- [ ] Mosaic 2 shows 5 more tiles.
- [ ] Hero 2 (image `12.webp`) appears full-bleed.
- [ ] Mosaic 3 shows 5 more tiles.
- [ ] Marquee renders below all mosaics, scrolling left at a slow pace.
- [ ] Each mosaic tile displays a small `01`–`17` index in the bottom-left on hover.
- [ ] Hero tiles do NOT show an index.
- [ ] Hovering a tile causes a subtle scale (~1.04).
- [ ] Hovering the marquee region pauses its animation.
- [ ] Scrolling the page produces a perceptible parallax inside hero images and a subtle one inside mosaic tiles.

- [ ] **Step 3: Click a tile and verify the lightbox**

- [ ] Click any mosaic tile → lightbox opens, image is centered, backdrop blurred.
- [ ] Press the right arrow key → next image renders.
- [ ] Press the left arrow key → previous image renders.
- [ ] Press Escape → lightbox closes, focus returns to the tile that opened it.
- [ ] Click a hero → lightbox opens with that image.
- [ ] Click a marquee tile → lightbox opens with that image.

- [ ] **Step 4: Verify mobile layout**

In Chrome DevTools, switch to a mobile device emulation (e.g., iPhone 14 Pro):
- [ ] Mosaics collapse to 1 column.
- [ ] Heroes still render full-width edge-to-edge.
- [ ] Marquee still auto-scrolls and is touch-swipable.
- [ ] Lightbox covers the screen and arrows/close are tappable.

- [ ] **Step 5: Verify reduced-motion**

In DevTools → Rendering → set "Emulate CSS media feature prefers-reduced-motion" to `reduce`. Reload the page:
- [ ] Tiles still render but no parallax inside images (images stay still while scrolling).
- [ ] Marquee no longer auto-scrolls; it shows as a horizontally scrollable strip.
- [ ] Hover scale effects are suppressed.
- [ ] Lightbox still opens/closes; transition is a plain crossfade (no shared-element morph).

- [ ] **Step 6: Verify the Spanish locale**

Navigate to `http://localhost:3000/es/weddings`:
- [ ] Eyebrow reads `Portafolio`.
- [ ] Title reads `Desde el piso del estudio.`.
- [ ] Lightbox close/prev/next buttons have Spanish `aria-label`s.
- [ ] All photo alt texts are in Spanish.

- [ ] **Step 7: If any check failed, file a fix as a follow-up commit**

For each failing check:
1. Identify the responsible file from the file structure section.
2. Apply the fix.
3. Re-run `npm test` and the relevant manual check.
4. Commit with a descriptive message (e.g., `fix(weddings/gallery): correct hero parallax direction on mobile`).

- [ ] **Step 8: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

---

## Self-review (completed during plan authoring)

- **Spec coverage:** Every spec section maps to a task — image source/copy → Task 1; data shape → Task 2; tile primitive → Task 3; mosaic block → Task 4; hero block → Task 5; marquee → Task 6; lightbox → Task 7; orchestrator → Task 8; i18n → Task 9; integration → Task 10; reduced-motion / mobile / locale verification → Task 11.
- **Placeholder scan:** No "TBD" / "TODO" / generic "add error handling" remain. Hero photo selection is concretely assigned to images `06.webp` and `12.webp` based on actual dimensions.
- **Type consistency:** `PortfolioPhoto` shape (id/src/alt/aspect/layout) is consistent across all tasks. Method/prop names (`onOpen`, `onClose`, `onChange`, `activeIndex`, `index`, `indices`) are consistent across files.
- **Risks called out in spec:** Parallax jank (mitigated by transform-only animation), marquee layout shift (fixed-height container), hero on ultrawide (capped via `max-h-[90vh]`), image weight (Task 1 Step 5 verifies size).
