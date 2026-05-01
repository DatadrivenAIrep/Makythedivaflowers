# Plan 2 — Catalog & PDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full bilingual product catalog and PDP. After this plan, a visitor can browse `/[locale]/shop`, jump into any of the 6 category pages, filter and sort the grid, open a product detail page, configure variants/add-ons/delivery date/card message, and "Add to bag" — which writes to the existing Zustand cart store skeleton from Plan 1 and increments the nav cart counter. The cart drawer and checkout itself remain Plan 3 territory.

**Architecture:** Server Components by default. Catalog and PDP routes are Server Components that read from a typed seed-data file (`data/products.ts`) and render fully on the server. Filters, sort, variant pickers, delivery picker, and "Add to bag" are isolated `'use client'` leaves. Filter and sort state is owned by the URL (`searchParams`), parsed on the server, and reflected in the client controls — refresh-safe and shareable. The sympathy category branches the visual variant (palette + motion intensity) at the route boundary, not via global state. Bilingual product copy lives inside the data layer using the `{ en, es }` shape called out in the spec; UI strings live in `messages/{en,es}.json` per next-intl.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Framer Motion (existing primitives), `next-intl`, Zustand (existing cart store from Plan 1), Vitest, Playwright. No new runtime dependencies are required for this plan — the seed data is a TS file, the date picker is HTML-native, and the filter UI is built from the customized shadcn `Button` and Radix primitives already installed.

**Spec reference:** `docs/superpowers/specs/2026-04-30-diva-flowers-design.md` — sections §3, §5.2, §5.3, §5.4, §5.9, §6, §10.

**Plan 1 reference:** `docs/superpowers/plans/2026-04-30-plan-1-foundation-brand-system.md` — completed; this plan reuses `ProductImage`-shaped placeholders, `BloomImage`, `StaggerGroup`, `Button`, format helpers, the cart store skeleton, and the `messages/*.json` namespacing.

**Important — Next.js 16 breaking changes:** `AGENTS.md` warns that this is not the Next.js you remember. Before writing any route or data-loading code, scan `node_modules/next/dist/docs/` for the relevant guide (params shape, `generateStaticParams`, `searchParams`, metadata). The patterns used in Plan 1 (e.g. `params: Promise<{ locale: string }>`) are the canonical ones for this version — do not regress to synchronous `params`.

---

## File Structure (created or modified in this plan)

```
diva-flowers/
├── app/
│   ├── [locale]/
│   │   ├── shop/
│   │   │   ├── page.tsx                             # Shop hub
│   │   │   ├── loading.tsx
│   │   │   └── [category]/
│   │   │       ├── page.tsx                         # Category page (all 6, incl. sympathy)
│   │   │       └── loading.tsx
│   │   └── product/
│   │       └── [slug]/
│   │           ├── page.tsx                         # PDP
│   │           └── loading.tsx
│   ├── sitemap.ts                                   # extended to include products
│   └── robots.ts                                    # noop verification, keep
├── components/
│   ├── product/
│   │   ├── ProductImage.tsx                         # central image swap point
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ProductPriceFromVariants.tsx             # Server Component
│   │   ├── FilterChip.tsx                           # 'use client'
│   │   ├── FilterBar.tsx                            # 'use client', sticky, URL-sync
│   │   ├── SortDropdown.tsx                         # 'use client'
│   │   ├── EmptyFilterState.tsx
│   │   ├── ImageStack.tsx                           # 'use client'
│   │   ├── VariantChips.tsx                         # 'use client'
│   │   ├── AddOnToggles.tsx                         # 'use client'
│   │   ├── DeliveryDatePicker.tsx                   # 'use client'
│   │   ├── CardMessage.tsx                          # 'use client'
│   │   ├── PdpAccordion.tsx                         # 'use client'
│   │   ├── PdpConfigurator.tsx                      # 'use client', orchestrates state
│   │   ├── AddToBag.tsx                             # 'use client', writes cart store
│   │   ├── PairsWellWith.tsx                        # Server Component
│   │   ├── JournalTile.tsx                          # lilac accent
│   │   ├── SubscriptionCadence.tsx                  # 'use client'
│   │   ├── PdpStructuredData.tsx                    # JSON-LD <script>
│   │   └── ProductCardSkeleton.tsx
│   ├── shop/
│   │   ├── CategoryMosaic.tsx                       # 6 varied tiles for hub
│   │   └── ShopHubHero.tsx
│   └── nav/
│       └── MegaMenu.tsx                             # 'use client', 6 thumbs (replaces NavLinks shop link on lg:)
├── data/
│   ├── products.ts                                  # 24 seed products + 4 subscription tiers
│   └── product-helpers.ts                           # filter / sort / price helpers
├── lib/
│   ├── delivery.ts                                  # cutoff + date availability
│   └── search-params.ts                             # filter URL parsing/serialization
├── messages/
│   ├── en.json                                      # extended: catalog, filter, sort, pdp
│   └── es.json                                      # extended: catalog, filter, sort, pdp
├── tests/
│   ├── unit/
│   │   ├── product-helpers.test.ts
│   │   ├── delivery.test.ts
│   │   └── search-params.test.ts
│   └── e2e/
│       ├── shop.spec.ts
│       ├── pdp.spec.ts
│       └── sympathy.spec.ts
└── types/
    └── product.ts
```

---

## Task 1: Product types

**Files:**
- Create: `types/product.ts`

- [ ] **Step 1: Write the type file**

```ts
// types/product.ts
import type { Locale } from "@/types/locale";

export type Localized = { en: string; es: string };

export type ProductCategory =
  | "arrangements"
  | "bouquets"
  | "plants"
  | "gifts"
  | "sympathy"
  | "subscriptions";

export type ProductImage = {
  src: string;
  alt: Localized;
  aspect: "4/5" | "1/1" | "16/9";
};

export type ProductVariant = {
  id: string;
  label: Localized;
  priceCents: number;
};

export type ProductAddOn = {
  id: string;
  label: Localized;
  priceCents: number;
};

export type ProductTag = "new" | "same-day" | "staff-pick" | "seasonal";
export type Occasion =
  | "birthday"
  | "anniversary"
  | "sympathy"
  | "romance"
  | "congrats"
  | "just-because";
export type ColorFamily =
  | "pink"
  | "red"
  | "white"
  | "mixed"
  | "green"
  | "pastel";

export type SubscriptionCadence = "weekly" | "biweekly";

export type Product = {
  id: string;
  slug: string;
  title: Localized;
  category: ProductCategory;
  blurb: Localized;
  description: Localized;
  images: ProductImage[];
  variants: ProductVariant[];
  addOns?: ProductAddOn[];
  tags: ProductTag[];
  occasions: Occasion[];
  colorFamily: ColorFamily[];
  active: boolean;
  /** subscription tiers carry available cadences */
  subscription?: { cadences: SubscriptionCadence[] };
  /** for "Pairs well with" — explicit curation; falls back to category */
  pairsWith?: string[];
  seo: {
    title: Localized;
    description: Localized;
  };
};

export function pickLocalized(value: Localized, locale: Locale): string {
  return value[locale];
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/product.ts
git commit -m "feat(catalog): product domain types"
```

---

## Task 2: Delivery cutoff + available dates helper (with tests)

**Files:**
- Create: `lib/delivery.ts`
- Create: `tests/unit/delivery.test.ts`

The delivery picker on the PDP needs to disable past dates, disable today after the same-day cutoff, and surface a flag for "same-day eligible".

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/delivery.test.ts
import { describe, it, expect } from "vitest";
import { isSameDayEligible, listAvailableDates, isPastDate } from "@/lib/delivery";

const CUTOFF = "14:00"; // 2pm local

describe("delivery", () => {
  it("isSameDayEligible: true before cutoff", () => {
    const now = new Date("2026-05-01T12:30:00");
    expect(isSameDayEligible(now, CUTOFF)).toBe(true);
  });

  it("isSameDayEligible: false at or after cutoff", () => {
    expect(isSameDayEligible(new Date("2026-05-01T14:00:00"), CUTOFF)).toBe(false);
    expect(isSameDayEligible(new Date("2026-05-01T16:30:00"), CUTOFF)).toBe(false);
  });

  it("isPastDate: yesterday is past, today is not", () => {
    const today = new Date("2026-05-01T10:00:00");
    expect(isPastDate("2026-04-30", today)).toBe(true);
    expect(isPastDate("2026-05-01", today)).toBe(false);
    expect(isPastDate("2026-05-02", today)).toBe(false);
  });

  it("listAvailableDates: returns 14 ISO dates starting today when same-day eligible", () => {
    const now = new Date("2026-05-01T10:00:00");
    const dates = listAvailableDates(now, CUTOFF, 14);
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-05-01");
    expect(dates[13]).toBe("2026-05-14");
  });

  it("listAvailableDates: starts tomorrow after cutoff", () => {
    const now = new Date("2026-05-01T15:00:00");
    const dates = listAvailableDates(now, CUTOFF, 14);
    expect(dates[0]).toBe("2026-05-02");
    expect(dates).toHaveLength(14);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- delivery`
Expected: 5 failures (module not found / functions undefined).

- [ ] **Step 3: Write the implementation**

```ts
// lib/delivery.ts
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseCutoff(cutoff: string): { hour: number; minute: number } {
  const [h, m] = cutoff.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

export function isSameDayEligible(now: Date, cutoff: string): boolean {
  const { hour, minute } = parseCutoff(cutoff);
  const c = new Date(now);
  c.setHours(hour, minute, 0, 0);
  return now.getTime() < c.getTime();
}

export function isPastDate(iso: string, now: Date): boolean {
  const today = toIsoDate(now);
  return iso < today;
}

export function listAvailableDates(
  now: Date,
  cutoff: string,
  daysAhead: number,
): string[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (!isSameDayEligible(now, cutoff)) {
    start.setDate(start.getDate() + 1);
  }
  const out: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toIsoDate(d));
  }
  return out;
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- delivery`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/delivery.ts tests/unit/delivery.test.ts
git commit -m "feat(catalog): delivery cutoff and available-dates helpers"
```

---

## Task 3: Product helpers — price, filter, sort (with tests)

**Files:**
- Create: `data/product-helpers.ts`
- Create: `tests/unit/product-helpers.test.ts`

These helpers are pure functions that operate on the Product list. The tests use a small inline fixture so they don't depend on the seed-data file landing first.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/product-helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  startingPriceCents,
  filterProducts,
  sortProducts,
  type Filter,
  type Sort,
} from "@/data/product-helpers";
import type { Product } from "@/types/product";

const fx = (over: Partial<Product>): Product => ({
  id: over.id ?? "x",
  slug: over.slug ?? "x",
  title: { en: "x", es: "x" },
  category: over.category ?? "arrangements",
  blurb: { en: "", es: "" },
  description: { en: "", es: "" },
  images: [],
  variants: over.variants ?? [{ id: "s", label: { en: "S", es: "S" }, priceCents: 15000 }],
  tags: over.tags ?? [],
  occasions: over.occasions ?? [],
  colorFamily: over.colorFamily ?? [],
  active: over.active ?? true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

describe("startingPriceCents", () => {
  it("returns the cheapest variant price", () => {
    const p = fx({
      variants: [
        { id: "s", label: { en: "S", es: "S" }, priceCents: 22000 },
        { id: "m", label: { en: "M", es: "M" }, priceCents: 15000 },
        { id: "l", label: { en: "L", es: "L" }, priceCents: 31000 },
      ],
    });
    expect(startingPriceCents(p)).toBe(15000);
  });
});

describe("filterProducts", () => {
  const a = fx({
    id: "a",
    occasions: ["romance"],
    colorFamily: ["pink"],
    tags: ["same-day"],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 12000 }],
  });
  const b = fx({
    id: "b",
    occasions: ["birthday"],
    colorFamily: ["red"],
    tags: [],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 28000 }],
  });
  const c = fx({
    id: "c",
    occasions: ["sympathy"],
    colorFamily: ["white"],
    tags: ["same-day"],
    variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 38000 }],
    active: false,
  });

  it("hides inactive products", () => {
    expect(filterProducts([a, b, c], {} as Filter).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("filters by occasion", () => {
    const r = filterProducts([a, b, c], { occasion: "romance" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by color", () => {
    const r = filterProducts([a, b, c], { color: "red" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by same-day", () => {
    const r = filterProducts([a, b, c], { sameDay: true } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: under-$200", () => {
    const r = filterProducts([a, b, c], { price: "under-200" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price band: 200-300", () => {
    const r = filterProducts([a, b, c], { price: "200-300" } as Filter);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by price band: 300-plus", () => {
    const r = filterProducts([a, b, c], { price: "300-plus" } as Filter);
    expect(r.map((p) => p.id)).toEqual([]);
  });

  it("combines filters with AND", () => {
    const r = filterProducts([a, b, c], { color: "pink", sameDay: true } as Filter);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("sortProducts", () => {
  const p1 = fx({ id: "p1", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 20000 }], tags: [] });
  const p2 = fx({ id: "p2", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 10000 }], tags: ["new"] });
  const p3 = fx({ id: "p3", variants: [{ id: "s", label: { en: "", es: "" }, priceCents: 30000 }], tags: [] });

  it("price-asc", () => {
    expect(sortProducts([p1, p2, p3], "price-asc" as Sort).map((p) => p.id)).toEqual(["p2", "p1", "p3"]);
  });
  it("price-desc", () => {
    expect(sortProducts([p1, p2, p3], "price-desc" as Sort).map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
  });
  it("newest puts tagged 'new' first", () => {
    expect(sortProducts([p1, p2, p3], "newest" as Sort).map((p) => p.id)[0]).toBe("p2");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- product-helpers`
Expected: failures (module not found).

- [ ] **Step 3: Write the implementation**

```ts
// data/product-helpers.ts
import type {
  Product,
  ProductCategory,
  Occasion,
  ColorFamily,
} from "@/types/product";

export type PriceBand = "under-200" | "200-300" | "300-plus";
export type Sort = "newest" | "price-asc" | "price-desc" | "staff-pick";

export type Filter = {
  occasion?: Occasion;
  color?: ColorFamily;
  size?: "standard" | "grand" | "diva";
  price?: PriceBand;
  sameDay?: boolean;
};

export function startingPriceCents(p: Product): number {
  if (p.variants.length === 0) return 0;
  return p.variants.reduce((min, v) => (v.priceCents < min ? v.priceCents : min), p.variants[0].priceCents);
}

export function filterProducts(products: Product[], f: Filter): Product[] {
  return products.filter((p) => {
    if (!p.active) return false;
    if (f.occasion && !p.occasions.includes(f.occasion)) return false;
    if (f.color && !p.colorFamily.includes(f.color)) return false;
    if (f.size) {
      const has = p.variants.some((v) => v.id === f.size);
      if (!has) return false;
    }
    if (f.sameDay && !p.tags.includes("same-day")) return false;
    if (f.price) {
      const c = startingPriceCents(p);
      if (f.price === "under-200" && c >= 20000) return false;
      if (f.price === "200-300" && (c < 20000 || c >= 30000)) return false;
      if (f.price === "300-plus" && c < 30000) return false;
    }
    return true;
  });
}

export function sortProducts(products: Product[], sort: Sort): Product[] {
  const arr = [...products];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => startingPriceCents(a) - startingPriceCents(b));
    case "price-desc":
      return arr.sort((a, b) => startingPriceCents(b) - startingPriceCents(a));
    case "newest":
      return arr.sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")));
    case "staff-pick":
      return arr.sort((a, b) => Number(b.tags.includes("staff-pick")) - Number(a.tags.includes("staff-pick")));
    default:
      return arr;
  }
}

export function productsByCategory(
  products: Product[],
  category: ProductCategory,
): Product[] {
  return products.filter((p) => p.active && p.category === category);
}

export function newestArrivals(products: Product[], limit = 12): Product[] {
  return [...products]
    .filter((p) => p.active)
    .sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- product-helpers`
Expected: all passing (12 tests).

- [ ] **Step 5: Commit**

```bash
git add data/product-helpers.ts tests/unit/product-helpers.test.ts
git commit -m "feat(catalog): product filter/sort/price helpers"
```

---

## Task 4: Search-params parser (with tests)

**Files:**
- Create: `lib/search-params.ts`
- Create: `tests/unit/search-params.test.ts`

Filter and sort live in the URL — refresh-safe, shareable, server-readable. This module is the contract between server and client filter UIs.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/search-params.test.ts
import { describe, it, expect } from "vitest";
import { parseFilterParams, serializeFilterParams } from "@/lib/search-params";

describe("parseFilterParams", () => {
  it("returns empty filter + default sort for empty params", () => {
    const r = parseFilterParams({});
    expect(r.filter).toEqual({});
    expect(r.sort).toBe("newest");
  });

  it("ignores unknown values", () => {
    const r = parseFilterParams({
      occasion: "wat",
      color: "neon",
      sort: "garbage",
      same_day: "maybe",
    });
    expect(r.filter).toEqual({});
    expect(r.sort).toBe("newest");
  });

  it("parses every supported field", () => {
    const r = parseFilterParams({
      occasion: "romance",
      color: "pink",
      size: "grand",
      price: "200-300",
      same_day: "1",
      sort: "price-asc",
    });
    expect(r.filter).toEqual({
      occasion: "romance",
      color: "pink",
      size: "grand",
      price: "200-300",
      sameDay: true,
    });
    expect(r.sort).toBe("price-asc");
  });
});

describe("serializeFilterParams", () => {
  it("omits undefined values", () => {
    const s = serializeFilterParams({ filter: {}, sort: "newest" });
    expect(s).toBe("");
  });

  it("serializes set fields including same_day", () => {
    const s = serializeFilterParams({
      filter: { occasion: "romance", sameDay: true },
      sort: "price-asc",
    });
    expect(new URLSearchParams(s).get("occasion")).toBe("romance");
    expect(new URLSearchParams(s).get("same_day")).toBe("1");
    expect(new URLSearchParams(s).get("sort")).toBe("price-asc");
  });

  it("round-trips", () => {
    const original = {
      filter: { occasion: "anniversary", color: "red", price: "300-plus", sameDay: true },
      sort: "price-desc",
    } as const;
    const s = serializeFilterParams(original);
    const params = Object.fromEntries(new URLSearchParams(s));
    expect(parseFilterParams(params)).toEqual(original);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- search-params`
Expected: failures.

- [ ] **Step 3: Write the implementation**

```ts
// lib/search-params.ts
import type { Filter, Sort } from "@/data/product-helpers";

const OCCASIONS = ["birthday", "anniversary", "sympathy", "romance", "congrats", "just-because"] as const;
const COLORS = ["pink", "red", "white", "mixed", "green", "pastel"] as const;
const SIZES = ["standard", "grand", "diva"] as const;
const PRICES = ["under-200", "200-300", "300-plus"] as const;
const SORTS = ["newest", "price-asc", "price-desc", "staff-pick"] as const;

function pickEnum<T extends readonly string[]>(
  list: T,
  v: string | undefined,
): T[number] | undefined {
  return v && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parseFilterParams(params: RawSearchParams): { filter: Filter; sort: Sort } {
  const occasion = pickEnum(OCCASIONS, first(params.occasion));
  const color = pickEnum(COLORS, first(params.color));
  const size = pickEnum(SIZES, first(params.size));
  const price = pickEnum(PRICES, first(params.price));
  const sameDayRaw = first(params.same_day);
  const sameDay = sameDayRaw === "1" || sameDayRaw === "true" ? true : undefined;
  const sort = pickEnum(SORTS, first(params.sort)) ?? "newest";

  const filter: Filter = {};
  if (occasion) filter.occasion = occasion;
  if (color) filter.color = color;
  if (size) filter.size = size;
  if (price) filter.price = price;
  if (sameDay) filter.sameDay = true;

  return { filter, sort };
}

export function serializeFilterParams({
  filter,
  sort,
}: {
  filter: Filter;
  sort: Sort;
}): string {
  const params = new URLSearchParams();
  if (filter.occasion) params.set("occasion", filter.occasion);
  if (filter.color) params.set("color", filter.color);
  if (filter.size) params.set("size", filter.size);
  if (filter.price) params.set("price", filter.price);
  if (filter.sameDay) params.set("same_day", "1");
  if (sort !== "newest") params.set("sort", sort);
  return params.toString();
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test -- search-params`
Expected: passing.

- [ ] **Step 5: Commit**

```bash
git add lib/search-params.ts tests/unit/search-params.test.ts
git commit -m "feat(catalog): typed filter/sort URL serialization"
```

---

## Task 5: Seed product data (24 + 4 subscriptions)

**Files:**
- Create: `data/products.ts`

24 products across 5 categories (4 each) plus 4 subscription tiers. All copy bilingual EN/ES. Believable price points ($120–$420 for arrangements; subscriptions tier at $95/$165/$245/$345). No Acme placeholders. Image src uses `https://picsum.photos/seed/{slug}-{n}/1200/1500` — the `<ProductImage>` wrapper centralizes future swap.

- [ ] **Step 1: Write the seed file**

```ts
// data/products.ts
import type { Product } from "@/types/product";

const img = (slug: string, n: number, alt: { en: string; es: string }, aspect: "4/5" | "1/1" | "16/9" = "4/5") => ({
  src: `https://picsum.photos/seed/${slug}-${n}/1200/1500`,
  alt,
  aspect,
});

export const PRODUCTS: Product[] = [
  // ─── Arrangements (4) ─────────────────────────────────────
  {
    id: "p-arr-01",
    slug: "ruby-altar",
    title: { en: "Ruby Altar", es: "Altar Rubí" },
    category: "arrangements",
    blurb: {
      en: "Garden roses, ranunculus, and burgundy dahlia in our signature footed vase.",
      es: "Rosas de jardín, ranúnculos y dalia borgoña en nuestro jarrón con base.",
    },
    description: {
      en: "Built around fifteen garden-cut roses with ranunculus and burgundy dahlia, the Ruby Altar is our most-requested romantic arrangement. Each stem is conditioned for 24 hours before the build. Designed to last 7–9 days in cool light.",
      es: "Construido en torno a quince rosas cortadas en jardín con ranúnculos y dalia borgoña, el Altar Rubí es nuestro arreglo romántico más solicitado. Cada tallo se acondiciona durante 24 horas antes del montaje. Diseñado para durar 7–9 días con luz fresca.",
    },
    images: [
      img("ruby-altar", 1, { en: "Ruby Altar arrangement on a bone background", es: "Arreglo Altar Rubí sobre fondo hueso" }),
      img("ruby-altar", 2, { en: "Detail of garden roses and ranunculus", es: "Detalle de rosas de jardín y ranúnculos" }),
      img("ruby-altar", 3, { en: "Footed vase from above", es: "Jarrón con base desde arriba" }, "1/1"),
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 18700 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 26500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 38500 },
    ],
    addOns: [
      { id: "vase-upgrade", label: { en: "Heirloom vase upgrade", es: "Mejora a jarrón heredado" }, priceCents: 4500 },
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
    ],
    tags: ["staff-pick", "same-day"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red", "pink"],
    active: true,
    pairsWith: ["p-bou-02", "p-gif-01", "p-arr-03"],
    seo: {
      title: { en: "Ruby Altar — Diva Flowers", es: "Altar Rubí — Diva Flowers" },
      description: {
        en: "Romantic arrangement of garden roses, ranunculus, and dahlia. Same-day delivery on Long Island.",
        es: "Arreglo romántico de rosas de jardín, ranúnculos y dalia. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-02",
    slug: "petal-cathedral",
    title: { en: "Petal Cathedral", es: "Catedral de Pétalos" },
    category: "arrangements",
    blurb: {
      en: "A cloud of pale-pink peonies, garden roses, and trailing jasmine.",
      es: "Una nube de peonías rosa claro, rosas de jardín y jazmín colgante.",
    },
    description: {
      en: "Statement-scale arrangement built on a pedestal vase. Heavy on peony in season; substituted with double-petal garden roses in winter (always confirmed in advance).",
      es: "Arreglo a escala de declaración construido sobre un jarrón pedestal. Mucha peonía en temporada; sustituida con rosas dobles en invierno (siempre confirmado).",
    },
    images: [
      img("petal-cathedral", 1, { en: "Petal Cathedral pedestal arrangement", es: "Arreglo pedestal Catedral de Pétalos" }),
      img("petal-cathedral", 2, { en: "Pale pink peony detail", es: "Detalle de peonía rosa claro" }),
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 22500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 31200 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 42000 },
    ],
    addOns: [{ id: "vase-upgrade", label: { en: "Italian glass vase", es: "Jarrón de vidrio italiano" }, priceCents: 6500 }],
    tags: ["staff-pick", "seasonal"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["pink", "pastel"],
    active: true,
    pairsWith: ["p-arr-01", "p-bou-01"],
    seo: {
      title: { en: "Petal Cathedral — Diva Flowers", es: "Catedral de Pétalos — Diva Flowers" },
      description: {
        en: "Statement peony arrangement on a pedestal vase. Premium tier.",
        es: "Arreglo peonía a gran escala sobre jarrón pedestal. Nivel premium.",
      },
    },
  },
  {
    id: "p-arr-03",
    slug: "tangerine-mass",
    title: { en: "Tangerine Mass", es: "Misa Mandarina" },
    category: "arrangements",
    blurb: {
      en: "A volume study in coral roses, parrot tulips, and butterfly ranunculus.",
      es: "Un estudio de volumen en rosas coral, tulipanes loro y ranúnculos mariposa.",
    },
    description: {
      en: "Built unstructured — coral, peach, and warm citrus tones in a low compote vase. A great alternative when red feels too formal.",
      es: "Montaje no estructurado — tonos coral, durazno y cítrico cálido en un jarrón compota bajo. Excelente alternativa cuando el rojo es demasiado formal.",
    },
    images: [img("tangerine-mass", 1, { en: "Tangerine Mass low arrangement", es: "Arreglo bajo Misa Mandarina" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 24500 },
    ],
    tags: ["new"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Tangerine Mass — Diva Flowers", es: "Misa Mandarina — Diva Flowers" },
      description: {
        en: "Coral and peach low compote arrangement.",
        es: "Arreglo compota coral y durazno.",
      },
    },
  },
  {
    id: "p-arr-04",
    slug: "ivory-vow",
    title: { en: "Ivory Vow", es: "Voto Marfil" },
    category: "arrangements",
    blurb: {
      en: "Cream garden roses, lisianthus, and bleached eucalyptus on bone.",
      es: "Rosas de jardín crema, lisianto y eucalipto blanqueado sobre fondo hueso.",
    },
    description: {
      en: "Elegant all-white arrangement that reads as bridal but works for any quiet occasion. The lisianthus carries a subtle ruffle without going maximalist.",
      es: "Arreglo elegante en blanco que se lee como nupcial pero funciona para cualquier ocasión tranquila. El lisianto aporta un volado sutil sin caer en lo maximalista.",
    },
    images: [img("ivory-vow", 1, { en: "Ivory Vow all-white arrangement", es: "Arreglo blanco Voto Marfil" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 19500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 28000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 39500 },
    ],
    tags: ["same-day"],
    occasions: ["congrats", "anniversary", "just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Ivory Vow — Diva Flowers", es: "Voto Marfil — Diva Flowers" },
      description: {
        en: "All-white garden rose and lisianthus arrangement.",
        es: "Arreglo blanco de rosa de jardín y lisianto.",
      },
    },
  },

  // ─── Bouquets (4) ─────────────────────────────────────
  {
    id: "p-bou-01",
    slug: "morning-letter",
    title: { en: "The Morning Letter", es: "La Carta de la Mañana" },
    category: "bouquets",
    blurb: {
      en: "Hand-tied: blush roses, white anemone, eucalyptus, hand-trimmed at the studio.",
      es: "Atado a mano: rosas rubor, anémona blanca, eucalipto, recortado en el estudio.",
    },
    description: {
      en: "Our most-ordered hand-tied. Wrapped in unbleached parchment with a hand-tied raffia bow. Cut and arranged the morning of delivery.",
      es: "Nuestro ramo atado a mano más pedido. Envuelto en papel sin blanquear con lazo de rafia. Cortado y arreglado la mañana del envío.",
    },
    images: [img("morning-letter", 1, { en: "Hand-tied bouquet on parchment", es: "Ramo atado a mano sobre pergamino" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 12500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 18500 },
    ],
    tags: ["staff-pick", "same-day"],
    occasions: ["romance", "just-because", "birthday"],
    colorFamily: ["pink", "white"],
    active: true,
    seo: {
      title: { en: "The Morning Letter — Diva Flowers", es: "La Carta de la Mañana — Diva Flowers" },
      description: { en: "Hand-tied bouquet of blush roses and anemone.", es: "Ramo atado de rosa rubor y anémona." },
    },
  },
  {
    id: "p-bou-02",
    slug: "scarlet-note",
    title: { en: "Scarlet Note", es: "Nota Escarlata" },
    category: "bouquets",
    blurb: {
      en: "Twenty-five long-stem red roses, sleeved in our heavyweight rouge paper.",
      es: "Veinticinco rosas rojas de tallo largo, en nuestro papel rouge de alto gramaje.",
    },
    description: {
      en: "The classic. Long-stem red roses, conditioned for two days, delivered in our heavyweight wrap.",
      es: "El clásico. Rosas rojas de tallo largo, acondicionadas durante dos días, entregadas en nuestro envoltorio de alto gramaje.",
    },
    images: [img("scarlet-note", 1, { en: "Long-stem red roses in rouge paper", es: "Rosas rojas de tallo largo en papel rouge" })],
    variants: [
      { id: "standard", label: { en: "Standard · 25 stems", es: "Estándar · 25 tallos" }, priceCents: 18900 },
      { id: "grand", label: { en: "Grand · 50 stems", es: "Grandes · 50 tallos" }, priceCents: 31500 },
      { id: "diva", label: { en: "Diva · 100 stems", es: "Diva · 100 tallos" }, priceCents: 56000 },
    ],
    tags: ["same-day"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "Scarlet Note — Diva Flowers", es: "Nota Escarlata — Diva Flowers" },
      description: { en: "Long-stem red roses, premium build.", es: "Rosas rojas de tallo largo, calidad premium." },
    },
  },
  {
    id: "p-bou-03",
    slug: "sunday-walk",
    title: { en: "Sunday Walk", es: "Paseo Dominical" },
    category: "bouquets",
    blurb: {
      en: "Mixed seasonal field — anemone, sweet pea, ranunculus, varies weekly.",
      es: "Campo mixto de temporada — anémona, guisante de olor, ranúnculo, varía semanalmente.",
    },
    description: {
      en: "Our florist's choice — what's freshest at the market that week. Hand-tied, paper-wrapped. Always different, always good.",
      es: "Elección de nuestra florista — lo más fresco del mercado esa semana. Atado a mano, envuelto en papel. Siempre distinto, siempre bueno.",
    },
    images: [img("sunday-walk", 1, { en: "Mixed field bouquet", es: "Ramo de campo mixto" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 14500 },
    ],
    tags: ["seasonal", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["mixed", "pastel"],
    active: true,
    seo: {
      title: { en: "Sunday Walk — Diva Flowers", es: "Paseo Dominical — Diva Flowers" },
      description: { en: "Florist's-choice seasonal mixed bouquet.", es: "Ramo mixto de temporada elegido por la florista." },
    },
  },
  {
    id: "p-bou-04",
    slug: "alabaster-thread",
    title: { en: "Alabaster Thread", es: "Hilo Alabastro" },
    category: "bouquets",
    blurb: {
      en: "Cream peonies and bridal roses on bleached parchment.",
      es: "Peonías crema y rosas nupciales sobre pergamino blanqueado.",
    },
    description: {
      en: "Soft, all-white hand-tied. Perfect for new-baby visits, congratulations, and quiet anniversaries.",
      es: "Atado suave en blanco. Perfecto para visitas de bebé, felicitaciones y aniversarios tranquilos.",
    },
    images: [img("alabaster-thread", 1, { en: "All-white hand-tied bouquet", es: "Ramo atado a mano blanco" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 14500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 21000 },
    ],
    tags: ["new"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Alabaster Thread — Diva Flowers", es: "Hilo Alabastro — Diva Flowers" },
      description: { en: "Soft all-white hand-tied bouquet.", es: "Ramo atado a mano blanco y suave." },
    },
  },

  // ─── Plants (4) ─────────────────────────────────────
  {
    id: "p-pla-01",
    slug: "phalaenopsis-double-spike",
    title: { en: "Double-Spike Orchid", es: "Orquídea de Doble Vara" },
    category: "plants",
    blurb: {
      en: "Phalaenopsis with two spikes in a hand-thrown stoneware planter.",
      es: "Phalaenopsis con dos varas en macetero de gres hecho a mano.",
    },
    description: {
      en: "Six-week bloom window. Care card and watering syringe included.",
      es: "Florescencia de seis semanas. Incluye tarjeta de cuidado y jeringa de riego.",
    },
    images: [img("phalaenopsis-double-spike", 1, { en: "White double-spike phalaenopsis orchid", es: "Orquídea phalaenopsis blanca de doble vara" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 18500 },
      { id: "grand", label: { en: "Grand · Three spikes", es: "Grandes · Tres varas" }, priceCents: 26500 },
    ],
    tags: ["staff-pick"],
    occasions: ["congrats", "just-because", "sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Double-Spike Orchid — Diva Flowers", es: "Orquídea Doble Vara — Diva Flowers" },
      description: { en: "Phalaenopsis orchid in stoneware planter.", es: "Phalaenopsis en macetero de gres." },
    },
  },
  {
    id: "p-pla-02",
    slug: "fiddle-leaf-fig",
    title: { en: "Fiddle-Leaf Fig", es: "Ficus Lyrata" },
    category: "plants",
    blurb: { en: "Three-foot ficus lyrata in a glazed terracotta pot.", es: "Ficus lyrata de un metro en maceta de terracota esmaltada." },
    description: {
      en: "Studio-grown, ready to live in a bright corner. Stake and care card included.",
      es: "Cultivado en estudio, listo para una esquina luminosa. Incluye tutor y tarjeta de cuidado.",
    },
    images: [img("fiddle-leaf-fig", 1, { en: "Fiddle-leaf fig in glazed pot", es: "Ficus lyrata en maceta esmaltada" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 22500 }],
    tags: [],
    occasions: ["just-because", "congrats"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Fiddle-Leaf Fig — Diva Flowers", es: "Ficus Lyrata — Diva Flowers" },
      description: { en: "Three-foot fiddle-leaf fig in glazed terracotta.", es: "Ficus lyrata de un metro en terracota esmaltada." },
    },
  },
  {
    id: "p-pla-03",
    slug: "rosemary-topiary",
    title: { en: "Rosemary Topiary", es: "Romero Topiario" },
    category: "plants",
    blurb: { en: "Fragrant standard-form rosemary in a French zinc pot.", es: "Romero en forma estándar en maceta de zinc francesa." },
    description: { en: "Sun-loving, hardy. Smells like a Provençal kitchen.", es: "Le encanta el sol, resistente. Huele a cocina provenzal." },
    images: [img("rosemary-topiary", 1, { en: "Rosemary topiary in zinc pot", es: "Romero topiario en maceta de zinc" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 13500 }],
    tags: ["new", "same-day"],
    occasions: ["just-because"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Rosemary Topiary — Diva Flowers", es: "Romero Topiario — Diva Flowers" },
      description: { en: "Fragrant rosemary topiary in French zinc.", es: "Romero topiario en zinc francés." },
    },
  },
  {
    id: "p-pla-04",
    slug: "monstera-dwarf",
    title: { en: "Dwarf Monstera", es: "Monstera Enana" },
    category: "plants",
    blurb: { en: "Compact monstera deliciosa in a cream stoneware pot.", es: "Monstera deliciosa compacta en macetero de gres crema." },
    description: { en: "Easy-care, fast-growing. Lives happily in indirect light.", es: "Fácil de cuidar, crece rápido. Vive feliz con luz indirecta." },
    images: [img("monstera-dwarf", 1, { en: "Dwarf monstera in cream stoneware", es: "Monstera enana en gres crema" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 11500 }],
    tags: ["same-day"],
    occasions: ["just-because", "congrats"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Dwarf Monstera — Diva Flowers", es: "Monstera Enana — Diva Flowers" },
      description: { en: "Compact monstera in stoneware.", es: "Monstera compacta en gres." },
    },
  },

  // ─── Gifts (4) ─────────────────────────────────────
  {
    id: "p-gif-01",
    slug: "champagne-bouquet-pair",
    title: { en: "Champagne & Bouquet", es: "Champaña y Ramo" },
    category: "gifts",
    blurb: { en: "Hand-tied bouquet paired with a bottle of Veuve Clicquot.", es: "Ramo atado con una botella de Veuve Clicquot." },
    description: {
      en: "Pairing of our Sunday Walk bouquet with a chilled bottle of Veuve. Wrapped together with a tied raffia handle. ID required at delivery.",
      es: "Maridaje de nuestro Paseo Dominical con una botella fría de Veuve. Envuelto con asa de rafia atada. Se requiere identificación al entregar.",
    },
    images: [img("champagne-bouquet-pair", 1, { en: "Bouquet and Veuve Clicquot bottle", es: "Ramo y botella de Veuve Clicquot" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 19500 }],
    tags: ["staff-pick"],
    occasions: ["anniversary", "congrats", "romance"],
    colorFamily: ["mixed"],
    active: true,
    pairsWith: ["p-arr-01", "p-bou-02"],
    seo: {
      title: { en: "Champagne & Bouquet — Diva Flowers", es: "Champaña y Ramo — Diva Flowers" },
      description: { en: "Hand-tied bouquet with Veuve Clicquot.", es: "Ramo atado con Veuve Clicquot." },
    },
  },
  {
    id: "p-gif-02",
    slug: "studio-candle-trio",
    title: { en: "Studio Candle Trio", es: "Trío de Velas del Estudio" },
    category: "gifts",
    blurb: { en: "Three of our house-poured tuberose candles.", es: "Tres de nuestras velas de nardo hechas en casa." },
    description: { en: "House-poured at the studio in soy + coconut wax. 50-hour burn each.", es: "Vertidas en el estudio en cera de soya + coco. 50 horas de quemado cada una." },
    images: [img("studio-candle-trio", 1, { en: "Trio of tuberose candles", es: "Trío de velas de nardo" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9800 }],
    tags: ["new"],
    occasions: ["just-because", "congrats", "birthday"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Studio Candle Trio — Diva Flowers", es: "Trío de Velas — Diva Flowers" },
      description: { en: "Three house-poured tuberose candles.", es: "Tres velas de nardo hechas en casa." },
    },
  },
  {
    id: "p-gif-03",
    slug: "patisserie-box",
    title: { en: "Pâtisserie Box", es: "Caja Pâtisserie" },
    category: "gifts",
    blurb: { en: "A small bouquet with a box of Long Island macarons.", es: "Un ramo pequeño con una caja de macarrones de Long Island." },
    description: { en: "Petite hand-tied paired with twelve macarons from a Garden City pâtissier.", es: "Pequeño atado a mano con doce macarrones de un pâtissier de Garden City." },
    images: [img("patisserie-box", 1, { en: "Petite bouquet with macaron box", es: "Pequeño ramo con caja de macarrones" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 13500 }],
    tags: ["same-day"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["pastel", "pink"],
    active: true,
    seo: {
      title: { en: "Pâtisserie Box — Diva Flowers", es: "Caja Pâtisserie — Diva Flowers" },
      description: { en: "Petite bouquet plus macarons.", es: "Pequeño ramo y macarrones." },
    },
  },
  {
    id: "p-gif-04",
    slug: "mother-after-noon",
    title: { en: "Mother & Afternoon", es: "Madre y la Tarde" },
    category: "gifts",
    blurb: { en: "A reading-day box: bouquet, novel, candle, kraft thermos.", es: "Caja de día de lectura: ramo, novela, vela, termo kraft." },
    description: { en: "Curated quarterly. The novel rotates each season — current selection on the listing.", es: "Curada trimestralmente. La novela rota por temporada — selección actual en la ficha." },
    images: [img("mother-after-noon", 1, { en: "Curated reading-day gift box", es: "Caja regalo de día de lectura" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 }],
    tags: ["seasonal"],
    occasions: ["birthday", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Mother & Afternoon — Diva Flowers", es: "Madre y la Tarde — Diva Flowers" },
      description: { en: "Curated reading-day gift box.", es: "Caja regalo curada para día de lectura." },
    },
  },

  // ─── Sympathy (4) ─────────────────────────────────────
  {
    id: "p-sym-01",
    slug: "white-vespers",
    title: { en: "White Vespers", es: "Vísperas Blancas" },
    category: "sympathy",
    blurb: { en: "Cream lilies, white roses, and bleached eucalyptus on a low platform.", es: "Lirios crema, rosas blancas y eucalipto blanqueado en una base baja." },
    description: { en: "Low, restrained arrangement appropriate for service or home. Wrapped without ribbon.", es: "Arreglo bajo y contenido, adecuado para servicio u hogar. Envuelto sin lazo." },
    images: [img("white-vespers", 1, { en: "All-white sympathy arrangement", es: "Arreglo de condolencias blanco" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 18500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 26500 },
    ],
    tags: [],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "White Vespers — Diva Flowers", es: "Vísperas Blancas — Diva Flowers" },
      description: { en: "Sympathy arrangement of white lily and rose.", es: "Arreglo de condolencias de lirio y rosa blancos." },
    },
  },
  {
    id: "p-sym-02",
    slug: "evening-prayer",
    title: { en: "Evening Prayer", es: "Oración de la Noche" },
    category: "sympathy",
    blurb: { en: "Standing spray for service: white roses, lily, and eucalyptus on an easel.", es: "Pieza de pie: rosas blancas, lirio y eucalipto sobre caballete." },
    description: { en: "Built on a brass easel for funeral services. Two-day lead time recommended.", es: "Montado sobre caballete de latón para servicios. Se recomienda 2 días de antelación." },
    images: [img("evening-prayer", 1, { en: "Sympathy standing spray on easel", es: "Pieza de condolencias en caballete" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 32500 }],
    tags: [],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Evening Prayer — Diva Flowers", es: "Oración de la Noche — Diva Flowers" },
      description: { en: "Standing sympathy spray for funeral services.", es: "Pieza de pie para servicios funerarios." },
    },
  },
  {
    id: "p-sym-03",
    slug: "kindly-orchid",
    title: { en: "Kindly Orchid", es: "Orquídea Bondadosa" },
    category: "sympathy",
    blurb: { en: "Single-spike phalaenopsis in a stoneware planter for the home.", es: "Phalaenopsis de una sola vara en macetero de gres para el hogar." },
    description: { en: "A quiet, lasting gesture for the home of a grieving family. Bloom window six weeks.", es: "Un gesto tranquilo y duradero para el hogar de una familia en duelo. Florescencia de seis semanas." },
    images: [img("kindly-orchid", 1, { en: "White phalaenopsis in stoneware", es: "Phalaenopsis blanca en gres" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 }],
    tags: ["same-day"],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Kindly Orchid — Diva Flowers", es: "Orquídea Bondadosa — Diva Flowers" },
      description: { en: "Phalaenopsis orchid for sympathy.", es: "Phalaenopsis para condolencias." },
    },
  },
  {
    id: "p-sym-04",
    slug: "stillwater-wreath",
    title: { en: "Stillwater Wreath", es: "Corona Aguas Tranquilas" },
    category: "sympathy",
    blurb: { en: "20-inch wreath of cream rose and bay laurel.", es: "Corona de 50 cm de rosa crema y laurel." },
    description: { en: "Suitable for service or door. Bay-laurel base lasts well past bloom.", es: "Adecuada para servicio o puerta. La base de laurel dura más allá de la florescencia." },
    images: [img("stillwater-wreath", 1, { en: "Cream rose and laurel wreath", es: "Corona de rosa crema y laurel" })],
    variants: [
      { id: "standard", label: { en: "Standard · 20 in", es: "Estándar · 50 cm" }, priceCents: 21500 },
      { id: "grand", label: { en: "Grand · 28 in", es: "Grandes · 70 cm" }, priceCents: 32500 },
    ],
    tags: [],
    occasions: ["sympathy"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Stillwater Wreath — Diva Flowers", es: "Corona Aguas Tranquilas — Diva Flowers" },
      description: { en: "Cream rose and bay laurel wreath.", es: "Corona de rosa crema y laurel." },
    },
  },

  // ─── Subscriptions (4 tiers) ─────────────────────────────────────
  {
    id: "p-sub-01",
    slug: "petite-subscription",
    title: { en: "Petite — Weekly", es: "Petite — Semanal" },
    category: "subscriptions",
    blurb: { en: "A small hand-tied delivered every week, florist's choice.", es: "Un pequeño atado a mano entregado cada semana, elección de la florista." },
    description: { en: "Choose your day. Pause anytime. Cancel anytime.", es: "Elige tu día. Pausa cuando quieras. Cancela cuando quieras." },
    images: [img("petite-subscription", 1, { en: "Petite weekly subscription bouquet", es: "Ramo de suscripción semanal Petite" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 }],
    subscription: { cadences: ["weekly", "biweekly"] },
    tags: ["staff-pick"],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Petite Subscription — Diva Flowers", es: "Suscripción Petite — Diva Flowers" },
      description: { en: "Small weekly hand-tied bouquet.", es: "Pequeño ramo semanal atado a mano." },
    },
  },
  {
    id: "p-sub-02",
    slug: "studio-subscription",
    title: { en: "Studio — Weekly", es: "Studio — Semanal" },
    category: "subscriptions",
    blurb: { en: "Our weekly Sunday Walk-style bouquet, in standard size.", es: "Nuestro ramo semanal estilo Paseo Dominical, en tamaño estándar." },
    description: { en: "Choose your day. Pause anytime.", es: "Elige tu día. Pausa cuando quieras." },
    images: [img("studio-subscription", 1, { en: "Standard weekly subscription bouquet", es: "Ramo semanal estándar" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 }],
    subscription: { cadences: ["weekly", "biweekly"] },
    tags: [],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Studio Subscription — Diva Flowers", es: "Suscripción Studio — Diva Flowers" },
      description: { en: "Standard weekly bouquet subscription.", es: "Suscripción de ramo semanal estándar." },
    },
  },
  {
    id: "p-sub-03",
    slug: "salon-subscription",
    title: { en: "Salon — Biweekly", es: "Salon — Quincenal" },
    category: "subscriptions",
    blurb: { en: "A statement arrangement every other week.", es: "Un arreglo de declaración cada dos semanas." },
    description: { en: "For consistent presence in a foyer or office.", es: "Para presencia constante en recibidor u oficina." },
    images: [img("salon-subscription", 1, { en: "Statement biweekly arrangement", es: "Arreglo quincenal de declaración" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 24500 }],
    subscription: { cadences: ["biweekly"] },
    tags: [],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Salon Subscription — Diva Flowers", es: "Suscripción Salon — Diva Flowers" },
      description: { en: "Statement arrangement biweekly.", es: "Arreglo de declaración quincenal." },
    },
  },
  {
    id: "p-sub-04",
    slug: "atelier-subscription",
    title: { en: "Atelier — Weekly", es: "Atelier — Semanal" },
    category: "subscriptions",
    blurb: { en: "Our largest tier — a Diva-scale arrangement every week.", es: "Nuestro mayor nivel — un arreglo escala Diva cada semana." },
    description: { en: "For lobbies, restaurants, and very floral households.", es: "Para lobbies, restaurantes y hogares muy florales." },
    images: [img("atelier-subscription", 1, { en: "Diva-scale weekly arrangement", es: "Arreglo semanal escala Diva" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 34500 }],
    subscription: { cadences: ["weekly"] },
    tags: ["staff-pick"],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Atelier Subscription — Diva Flowers", es: "Suscripción Atelier — Diva Flowers" },
      description: { en: "Largest weekly arrangement subscription.", es: "Mayor suscripción semanal de arreglos." },
    },
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(cat: string): Product[] {
  return PRODUCTS.filter((p) => p.active && p.category === cat);
}

export function getPairsWith(product: import("@/types/product").Product): import("@/types/product").Product[] {
  if (product.pairsWith && product.pairsWith.length > 0) {
    return product.pairsWith
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is import("@/types/product").Product => Boolean(p && p.active));
  }
  return PRODUCTS.filter(
    (p) => p.active && p.id !== product.id && p.category === product.category,
  ).slice(0, 4);
}
```

- [ ] **Step 2: Sanity-check counts**

```bash
node -e "const { PRODUCTS } = require('./data/products.ts'); console.log(PRODUCTS.length);" 2>/dev/null \
  || npx tsx -e "import('./data/products.ts').then(m => console.log(m.PRODUCTS.length))"
```

Expected: `28` (24 + 4 subscriptions). If `tsx` isn't installed and the line errors, skip this step — it's just a sanity check; the unit tests in Task 3 already exercise the helpers, and the catalog routes will fail loudly at the next task if the file is malformed.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add data/products.ts
git commit -m "feat(catalog): seed 24 products + 4 subscription tiers, bilingual EN/ES"
```

---

## Task 6: ProductImage component (centralized swap point)

**Files:**
- Create: `components/product/ProductImage.tsx`

Per spec §4.7 — when real photography arrives, this is the single file to swap. v1 uses plain `<img>` (no `next/image` blur — picsum doesn't support it cleanly).

- [ ] **Step 1: Write the file**

```tsx
// components/product/ProductImage.tsx
import { cn } from "@/lib/cn";
import type { ProductImage as ProductImageT } from "@/types/product";
import type { Locale } from "@/types/locale";

type Props = {
  image: ProductImageT;
  locale: Locale;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

const aspectClass: Record<ProductImageT["aspect"], string> = {
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
};

export function ProductImage({ image, locale, className, sizes, priority }: Props) {
  return (
    <img
      src={image.src}
      alt={image.alt[locale]}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      className={cn("size-full object-cover", aspectClass[image.aspect], className)}
    />
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/product/ProductImage.tsx
git commit -m "feat(catalog): centralized ProductImage swap point"
```

---

## Task 7: ProductCard + ProductCardSkeleton

**Files:**
- Create: `components/product/ProductCard.tsx`
- Create: `components/product/ProductCardSkeleton.tsx`

Bloom hover comes from the existing `<BloomImage>`. Card uses `rounded-2xl` per `--radius-product`. No filled-card visual — hover scales the image only; meta lines sit below.

- [ ] **Step 1: Write `ProductCard.tsx`**

```tsx
// components/product/ProductCard.tsx
import Link from "next/link";
import { memo } from "react";
import type { Locale } from "@/types/locale";
import type { Product } from "@/types/product";
import { ProductImage } from "./ProductImage";
import { BloomImage } from "@/components/motion/BloomImage";
import { startingPriceCents } from "@/data/product-helpers";
import { formatMoneyCents } from "@/lib/format";

type Props = {
  product: Product;
  locale: Locale;
  reduceMotion?: boolean;
  priority?: boolean;
};

function ProductCardImpl({ product, locale, reduceMotion, priority }: Props) {
  const href = `/${locale}/product/${product.slug}`;
  const cover = product.images[0];
  const fromPrice = formatMoneyCents(startingPriceCents(product), locale);
  const startingFrom = locale === "es" ? "Desde" : "From";
  const eyebrow = product.tags.includes("new")
    ? locale === "es"
      ? "Nuevo"
      : "New"
    : product.tags.includes("staff-pick")
      ? locale === "es"
        ? "Selección"
        : "Staff pick"
      : null;

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <div className="relative overflow-hidden rounded-[var(--radius-product)] bg-mute-100">
        {cover && reduceMotion ? (
          <ProductImage image={cover} locale={locale} priority={priority} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
        ) : cover ? (
          <BloomImage
            src={cover.src}
            alt={cover.alt[locale]}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="aspect-[4/5]"
          />
        ) : null}
        {product.tags.includes("same-day") && (
          <span className="absolute left-3 top-3 rounded-full border border-ink/15 bg-bone/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
            {locale === "es" ? "Hoy" : "Today"}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
              {eyebrow}
            </p>
          )}
          <h3 className="truncate font-display text-xl leading-none text-ink group-hover:text-rouge transition-colors">
            {product.title[locale]}
          </h3>
        </div>
        <p className="shrink-0 font-mono text-sm text-ink">
          <span className="text-mute-500 mr-1">{startingFrom}</span>
          {fromPrice}
        </p>
      </div>
    </Link>
  );
}

export const ProductCard = memo(ProductCardImpl);
```

- [ ] **Step 2: Write `ProductCardSkeleton.tsx`**

```tsx
// components/product/ProductCardSkeleton.tsx
export function ProductCardSkeleton() {
  return (
    <div className="block">
      <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-mute-100" />
        <div className="h-4 w-16 animate-pulse rounded bg-mute-100" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/product/ProductCard.tsx components/product/ProductCardSkeleton.tsx
git commit -m "feat(catalog): ProductCard with bloom hover + skeleton"
```

---

## Task 8: ProductGrid

**Files:**
- Create: `components/product/ProductGrid.tsx`

`StaggerGroup` + `staggerItemVariants` from `components/motion/StaggerGroup.tsx` are reused. Sympathy variant gets fade-only stagger via the `motion` prop.

- [ ] **Step 1: Write the file**

```tsx
// components/product/ProductGrid.tsx
"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { StaggerGroup, staggerItemVariants } from "@/components/motion/StaggerGroup";
import { ProductCard } from "./ProductCard";
import type { Locale } from "@/types/locale";
import type { Product } from "@/types/product";

type Props = {
  products: Product[];
  locale: Locale;
  /** sympathy = fade-only stagger, no bloom */
  motionMode?: "default" | "sympathy";
  className?: string;
};

const fadeOnly = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

function ProductGridImpl({ products, locale, motionMode = "default", className }: Props) {
  const itemVariants = motionMode === "sympathy" ? fadeOnly : staggerItemVariants;
  return (
    <StaggerGroup
      className={
        className ??
        "grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 md:gap-y-16 lg:grid-cols-3"
      }
    >
      {products.map((p, i) => (
        <motion.div key={p.id} variants={itemVariants}>
          <ProductCard
            product={p}
            locale={locale}
            reduceMotion={motionMode === "sympathy"}
            priority={i < 3}
          />
        </motion.div>
      ))}
    </StaggerGroup>
  );
}

export const ProductGrid = memo(ProductGridImpl);
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit && git add components/product/ProductGrid.tsx && git commit -m "feat(catalog): ProductGrid with stagger + sympathy variant"
```

---

## Task 9: FilterChip

**Files:**
- Create: `components/product/FilterChip.tsx`

A pill button. Selected state uses rouge background with bone text. Clicking again toggles off. Cmd/Ctrl-click is not special.

- [ ] **Step 1: Write the file**

```tsx
// components/product/FilterChip.tsx
"use client";
import { memo } from "react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  selected: boolean;
  onToggle: () => void;
  ariaLabel?: string;
};

function FilterChipImpl({ label, selected, onToggle, ariaLabel }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel ?? label}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 font-sans text-sm tracking-tight transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
        selected
          ? "border-transparent bg-rouge text-bone"
          : "border-ink/15 bg-transparent text-ink/80 hover:border-ink/35",
      )}
    >
      {label}
    </button>
  );
}

export const FilterChip = memo(FilterChipImpl);
```

- [ ] **Step 2: Commit**

```bash
git add components/product/FilterChip.tsx && git commit -m "feat(catalog): FilterChip pill"
```

---

## Task 10: SortDropdown

**Files:**
- Create: `components/product/SortDropdown.tsx`

A native `<select>` styled to match. Native is enough here — keyboard, screen-reader, and mobile all already work.

- [ ] **Step 1: Write the file**

```tsx
// components/product/SortDropdown.tsx
"use client";
import { memo } from "react";
import type { Sort } from "@/data/product-helpers";

type Option = { value: Sort; label: string };

type Props = {
  value: Sort;
  options: Option[];
  onChange: (s: Sort) => void;
  ariaLabel: string;
};

function SortDropdownImpl({ value, options, onChange, ariaLabel }: Props) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {ariaLabel}
      </span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as Sort)}
        className="h-9 rounded-full border border-ink/15 bg-transparent pl-3 pr-8 font-sans text-sm tracking-tight text-ink/90 hover:border-ink/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export const SortDropdown = memo(SortDropdownImpl);
```

- [ ] **Step 2: Commit**

```bash
git add components/product/SortDropdown.tsx && git commit -m "feat(catalog): SortDropdown"
```

---

## Task 11: FilterBar (sticky, URL-sync)

**Files:**
- Create: `components/product/FilterBar.tsx`

`useSearchParams` + `useRouter().replace()` — server-rendered grid below it re-runs because the route reads `searchParams`. Sticky `top-16` aligns with the `pt-16` nav offset already in `app/[locale]/layout.tsx`.

- [ ] **Step 1: Write the file**

```tsx
// components/product/FilterBar.tsx
"use client";
import { memo, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FilterChip } from "./FilterChip";
import { SortDropdown } from "./SortDropdown";
import type { Filter, Sort } from "@/data/product-helpers";
import type { Locale } from "@/types/locale";
import { serializeFilterParams } from "@/lib/search-params";

type Props = {
  locale: Locale;
  filter: Filter;
  sort: Sort;
  /** subset of fields to render, in order; sympathy excludes color */
  show?: Array<"occasion" | "color" | "size" | "price" | "sameDay">;
};

const OCCASIONS = [
  "romance",
  "anniversary",
  "birthday",
  "congrats",
  "sympathy",
  "just-because",
] as const;
const COLORS = ["pink", "red", "white", "mixed", "green", "pastel"] as const;
const SIZES = ["standard", "grand", "diva"] as const;
const PRICES = ["under-200", "200-300", "300-plus"] as const;

const SORT_VALUES = ["newest", "price-asc", "price-desc", "staff-pick"] as const;

type Copy = { [k: string]: { en: string; es: string } };

const COPY: Copy = {
  filter_label: { en: "Filter", es: "Filtrar" },
  sort_label: { en: "Sort", es: "Ordenar" },
  same_day: { en: "Same-day", es: "Hoy" },
  clear: { en: "Clear", es: "Limpiar" },
  // occasions
  romance: { en: "Romance", es: "Romance" },
  anniversary: { en: "Anniversary", es: "Aniversario" },
  birthday: { en: "Birthday", es: "Cumpleaños" },
  congrats: { en: "Congratulations", es: "Felicitaciones" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  "just-because": { en: "Just because", es: "Sin razón" },
  // colors
  pink: { en: "Pink", es: "Rosa" },
  red: { en: "Red", es: "Rojo" },
  white: { en: "White", es: "Blanco" },
  mixed: { en: "Mixed", es: "Mixto" },
  green: { en: "Green", es: "Verde" },
  pastel: { en: "Pastel", es: "Pastel" },
  // sizes
  standard: { en: "Standard", es: "Estándar" },
  grand: { en: "Grand", es: "Grandes" },
  diva: { en: "Diva", es: "Diva" },
  // price
  "under-200": { en: "Under $200", es: "Menos de $200" },
  "200-300": { en: "$200–$300", es: "$200–$300" },
  "300-plus": { en: "$300+", es: "$300+" },
  // sort
  newest: { en: "Newest", es: "Más nuevos" },
  "price-asc": { en: "Price: low to high", es: "Precio: menor a mayor" },
  "price-desc": { en: "Price: high to low", es: "Precio: mayor a menor" },
  "staff-pick": { en: "Staff picks", es: "Selección" },
};

function l(key: string, locale: Locale): string {
  return COPY[key]?.[locale] ?? key;
}

function FilterBarImpl({ locale, filter, sort, show = ["occasion", "color", "size", "price", "sameDay"] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = useCallback(
    (next: { filter: Filter; sort: Sort }) => {
      const qs = serializeFilterParams(next);
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [router, pathname],
  );

  const toggle = useCallback(
    <K extends keyof Filter>(key: K, value: Filter[K]) => {
      const next: Filter = { ...filter };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      apply({ filter: next, sort });
    },
    [filter, sort, apply],
  );

  const setSort = useCallback(
    (s: Sort) => {
      apply({ filter, sort: s });
    },
    [filter, sort, apply],
  );

  const clearAll = useCallback(() => {
    apply({ filter: {}, sort: "newest" });
  }, [apply]);

  const sortOptions = useMemo(
    () => SORT_VALUES.map((v) => ({ value: v as Sort, label: l(v, locale) })),
    [locale],
  );

  const hasAny = Object.keys(filter).length > 0 || sort !== "newest";

  return (
    <div className="sticky top-16 z-30 -mx-6 border-y border-ink/10 bg-bone/85 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-bone/70">
      <div className="mx-auto flex max-w-[var(--container-max)] flex-wrap items-center gap-x-6 gap-y-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
          {l("filter_label", locale)}
        </span>

        {show.includes("occasion") &&
          OCCASIONS.map((o) => (
            <FilterChip
              key={o}
              label={l(o, locale)}
              selected={filter.occasion === o}
              onToggle={() => toggle("occasion", o)}
            />
          ))}

        {show.includes("color") && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-mute-500">
            ·
          </span>
        )}
        {show.includes("color") &&
          COLORS.map((c) => (
            <FilterChip
              key={c}
              label={l(c, locale)}
              selected={filter.color === c}
              onToggle={() => toggle("color", c)}
            />
          ))}

        {show.includes("size") &&
          SIZES.map((s) => (
            <FilterChip
              key={s}
              label={l(s, locale)}
              selected={filter.size === s}
              onToggle={() => toggle("size", s)}
            />
          ))}

        {show.includes("price") &&
          PRICES.map((p) => (
            <FilterChip
              key={p}
              label={l(p, locale)}
              selected={filter.price === p}
              onToggle={() => toggle("price", p)}
            />
          ))}

        {show.includes("sameDay") && (
          <FilterChip
            label={l("same_day", locale)}
            selected={Boolean(filter.sameDay)}
            onToggle={() => toggle("sameDay", filter.sameDay ? undefined : true)}
          />
        )}

        <span className="ml-auto flex items-center gap-3">
          {hasAny && (
            <button
              type="button"
              onClick={clearAll}
              className="font-sans text-sm tracking-tight text-ink/70 underline-offset-4 hover:underline"
            >
              {l("clear", locale)}
            </button>
          )}
          <SortDropdown
            value={sort}
            options={sortOptions}
            onChange={setSort}
            ariaLabel={l("sort_label", locale)}
          />
        </span>
      </div>
    </div>
  );
}

export const FilterBar = memo(FilterBarImpl);
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/product/FilterBar.tsx && git commit -m "feat(catalog): sticky filter bar with URL sync"
```

---

## Task 12: EmptyFilterState

**Files:**
- Create: `components/product/EmptyFilterState.tsx`

- [ ] **Step 1: Write the file**

```tsx
// components/product/EmptyFilterState.tsx
import Link from "next/link";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
  resetHref: string;
};

export function EmptyFilterState({ locale, resetHref }: Props) {
  const title = locale === "es" ? "Nada coincide aún." : "Nothing matches yet.";
  const body =
    locale === "es"
      ? "Prueba con menos filtros, o explora todas nuestras flores."
      : "Try fewer filters, or browse everything we're growing.";
  const cta = locale === "es" ? "Ver todo" : "Browse all";

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Sin resultados" : "No results"}
      </p>
      <h2 className="mt-3 font-display text-4xl tracking-tighter text-ink md:text-5xl">
        {title}
      </h2>
      <p className="mt-3 max-w-md font-sans text-base leading-relaxed text-ink/75">
        {body}
      </p>
      <Link
        href={resetHref}
        className="mt-6 inline-flex h-11 items-center rounded-full border border-ink/20 px-5 font-sans text-sm tracking-tight text-ink hover:border-ink/45"
      >
        {cta}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/product/EmptyFilterState.tsx && git commit -m "feat(catalog): empty filter state"
```

---

## Task 13: CategoryMosaic + ShopHubHero

**Files:**
- Create: `components/shop/CategoryMosaic.tsx`
- Create: `components/shop/ShopHubHero.tsx`

Asymmetric 6-tile mosaic per spec §5.2 — varied sizes, all using BloomImage.

- [ ] **Step 1: Write `ShopHubHero.tsx`**

```tsx
// components/shop/ShopHubHero.tsx
import type { Locale } from "@/types/locale";

export function ShopHubHero({ locale }: { locale: Locale }) {
  const eyebrow = locale === "es" ? "La tienda" : "The shop";
  const title =
    locale === "es"
      ? "Cada arreglo, hecho a mano bajo el arco rosado."
      : "Every arrangement, made by hand under the pink arch.";
  const sub =
    locale === "es"
      ? "Ramos atados, plantas, regalos y suscripciones. Mismo día en Long Island y Queens."
      : "Hand-tied bouquets, plants, gifts, and subscriptions. Same-day across Long Island and Queens.";
  return (
    <header className="mx-auto max-w-[var(--container-max)] px-6 pt-16 pb-10 md:pt-24 md:pb-14">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[0.95] tracking-tighter text-ink md:text-7xl">
        {title}
      </h1>
      <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-ink/75 md:text-lg">
        {sub}
      </p>
    </header>
  );
}
```

- [ ] **Step 2: Write `CategoryMosaic.tsx`**

```tsx
// components/shop/CategoryMosaic.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BloomImage } from "@/components/motion/BloomImage";
import type { Locale } from "@/types/locale";

const TILES: { slug: string; seed: string; col: string; row: string; aspect: string }[] = [
  { slug: "arrangements", seed: "cat-arrangements", col: "md:col-span-7", row: "md:row-span-2", aspect: "aspect-[7/8]" },
  { slug: "bouquets", seed: "cat-bouquets", col: "md:col-span-5", row: "md:row-span-1", aspect: "aspect-[5/4]" },
  { slug: "plants", seed: "cat-plants", col: "md:col-span-5", row: "md:row-span-1", aspect: "aspect-[5/4]" },
  { slug: "gifts", seed: "cat-gifts", col: "md:col-span-4", row: "md:row-span-1", aspect: "aspect-square" },
  { slug: "sympathy", seed: "cat-sympathy", col: "md:col-span-4", row: "md:row-span-1", aspect: "aspect-square" },
  { slug: "subscriptions", seed: "cat-subscriptions", col: "md:col-span-4", row: "md:row-span-1", aspect: "aspect-square" },
];

export async function CategoryMosaic({ locale }: { locale: Locale }) {
  const t = await getTranslations("categories");
  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pb-20">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {TILES.map((tile) => {
          const name = t(tile.slug);
          return (
            <Link
              key={tile.slug}
              href={`/${locale}/shop/${tile.slug}`}
              className={`group relative overflow-hidden rounded-[var(--radius-bento)] bg-mute-100 ${tile.col} ${tile.row} ${tile.aspect}`}
            >
              <BloomImage
                src={`https://picsum.photos/seed/${tile.seed}/1400/1400`}
                alt={name}
                className="h-full w-full"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
              <div className="absolute inset-x-5 bottom-5 flex items-end justify-between">
                <h2 className="font-display text-3xl leading-none tracking-tighter text-bone md:text-4xl">
                  {name}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-bone/85">
                  {locale === "es" ? "Ver →" : "Shop →"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit && git add components/shop/CategoryMosaic.tsx components/shop/ShopHubHero.tsx && git commit -m "feat(shop): hub hero + 6-tile category mosaic"
```

---

## Task 14: Shop hub page (`/[locale]/shop`)

**Files:**
- Create: `app/[locale]/shop/page.tsx`
- Create: `app/[locale]/shop/loading.tsx`

Composes hero + mosaic + "Newest arrivals" 12-product grid. Newest grid does **not** show the filter bar — that's a category-page concern. The hub is editorial.

- [ ] **Step 1: Write `app/[locale]/shop/page.tsx`**

```tsx
// app/[locale]/shop/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { ShopHubHero } from "@/components/shop/ShopHubHero";
import { CategoryMosaic } from "@/components/shop/CategoryMosaic";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PRODUCTS } from "@/data/products";
import { newestArrivals } from "@/data/product-helpers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "es"
        ? "Tienda — Diva Flowers"
        : "Shop — Diva Flowers",
    description:
      locale === "es"
        ? "Compra arreglos, ramos, plantas y regalos. Entrega el mismo día en Long Island."
        : "Shop arrangements, bouquets, plants, and gifts. Same-day delivery on Long Island.",
    alternates: {
      canonical: `/${locale}/shop`,
      languages: { en: "/en/shop", es: "/es/shop" },
    },
  };
}

export default async function ShopHubPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const newest = newestArrivals(PRODUCTS, 12);
  const newestTitle = locale === "es" ? "Lo más nuevo" : "Newest arrivals";
  return (
    <main className="bg-bone text-ink">
      <ShopHubHero locale={locale} />
      <CategoryMosaic locale={locale} />
      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-display text-4xl leading-none tracking-tighter md:text-5xl">
            {newestTitle}
          </h2>
        </div>
        <ProductGrid products={newest} locale={locale} />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Write `app/[locale]/shop/loading.tsx`**

```tsx
// app/[locale]/shop/loading.tsx
import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";

export default function ShopHubLoading() {
  return (
    <main className="bg-bone text-ink">
      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-16 pb-10">
        <div className="h-3 w-24 animate-pulse rounded bg-mute-100" />
        <div className="mt-3 h-14 w-3/4 animate-pulse rounded bg-mute-100" />
      </header>
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-5 px-6 pb-16 md:grid-cols-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[5/4] animate-pulse rounded-[var(--radius-bento)] bg-mute-100 md:col-span-4" />
        ))}
      </section>
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-x-6 gap-y-12 px-6 pb-24 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Boot the dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000/en/shop` and `http://localhost:3000/es/shop`. Confirm: hero renders, 6 mosaic tiles render with image + label, newest 12 grid renders, no console errors. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/shop/page.tsx app/[locale]/shop/loading.tsx
git commit -m "feat(shop): hub page at /[locale]/shop with mosaic + newest arrivals"
```

---

## Task 15: Category page (`/[locale]/shop/[category]`)

**Files:**
- Create: `app/[locale]/shop/[category]/page.tsx`
- Create: `app/[locale]/shop/[category]/loading.tsx`

Server-rendered. Reads filter+sort from `searchParams`. Sympathy variant detected at this boundary — it sets `motionMode="sympathy"` on the grid, hides the `color` filter (palette restricted), and adds the prominent call-CTA + service note.

- [ ] **Step 1: Write `app/[locale]/shop/[category]/page.tsx`**

```tsx
// app/[locale]/shop/[category]/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import {
  productsByCategory,
  filterProducts,
  sortProducts,
} from "@/data/product-helpers";
import type { ProductCategory } from "@/types/product";
import { parseFilterParams, type RawSearchParams } from "@/lib/search-params";
import { ProductGrid } from "@/components/product/ProductGrid";
import { FilterBar } from "@/components/product/FilterBar";
import { EmptyFilterState } from "@/components/product/EmptyFilterState";
import { SITE } from "@/data/site";

const ALLOWED: ProductCategory[] = [
  "arrangements",
  "bouquets",
  "plants",
  "gifts",
  "sympathy",
  "subscriptions",
];

const CATEGORY_TITLES: Record<ProductCategory, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};

const CATEGORY_DESCS: Record<ProductCategory, { en: string; es: string }> = {
  arrangements: {
    en: "Statement arrangements, hand-built daily.",
    es: "Arreglos de declaración, hechos a mano cada día.",
  },
  bouquets: {
    en: "Hand-tied bouquets, cut and wrapped the morning of delivery.",
    es: "Ramos atados a mano, cortados y envueltos la mañana del envío.",
  },
  plants: {
    en: "Long-lasting plants and orchids in studio-poured planters.",
    es: "Plantas y orquídeas duraderas en maceteros del estudio.",
  },
  gifts: {
    en: "Pairings: flowers with champagne, candles, or pastries.",
    es: "Maridajes: flores con champaña, velas o pastelería.",
  },
  sympathy: {
    en: "When words are not enough.",
    es: "Cuando las palabras no bastan.",
  },
  subscriptions: {
    en: "Weekly or biweekly blooms. Pause anytime.",
    es: "Flores semanales o quincenales. Pausa cuando quieras.",
  },
};

export async function generateStaticParams() {
  return ALLOWED.map((c) => ({ category: c }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  if (!(ALLOWED as string[]).includes(category)) return {};
  const cat = category as ProductCategory;
  return {
    title: `${CATEGORY_TITLES[cat][locale]} — Diva Flowers`,
    description: CATEGORY_DESCS[cat][locale],
    alternates: {
      canonical: `/${locale}/shop/${category}`,
      languages: {
        en: `/en/shop/${category}`,
        es: `/es/shop/${category}`,
      },
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; category: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, category } = await params;
  if (!(ALLOWED as string[]).includes(category)) notFound();
  setRequestLocale(locale);

  const cat = category as ProductCategory;
  const sp = await searchParams;
  const { filter, sort } = parseFilterParams(sp);

  const all = productsByCategory(PRODUCTS, cat);
  const filtered = sortProducts(filterProducts(all, filter), sort);

  const isSympathy = cat === "sympathy";
  const motionMode = isSympathy ? "sympathy" : "default";
  const filtersToShow = isSympathy
    ? (["price", "sameDay"] as const)
    : (["occasion", "color", "size", "price", "sameDay"] as const);

  return (
    <main className={isSympathy ? "bg-bone text-ink" : "bg-bone text-ink"}>
      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-12 pb-6 md:pt-20">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
          {locale === "es" ? "Categoría" : "Category"}
        </p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tighter md:text-7xl">
          {CATEGORY_TITLES[cat][locale]}
        </h1>
        <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-ink/75 md:text-lg">
          {CATEGORY_DESCS[cat][locale]}
        </p>
      </header>

      <FilterBar locale={locale} filter={filter} sort={sort} show={filtersToShow as unknown as Array<"occasion" | "color" | "size" | "price" | "sameDay">} />

      <section className="mx-auto max-w-[var(--container-max)] px-6 py-10">
        {filtered.length === 0 ? (
          <EmptyFilterState locale={locale} resetHref={`/${locale}/shop/${cat}`} />
        ) : (
          <ProductGrid products={filtered} locale={locale} motionMode={motionMode} />
        )}
      </section>

      {isSympathy && (
        <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
          <div className="rounded-[var(--radius-bento)] border border-ink/10 p-8 md:p-12">
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
              {locale === "es" ? "O llámanos" : "Or call us"}
            </p>
            <p className="mt-3 font-mono text-2xl text-ink md:text-3xl">
              <a href={SITE.phoneHref} className="hover:text-rouge transition-colors">
                {SITE.phoneDisplay}
              </a>
            </p>
            <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-ink/75">
              {locale === "es"
                ? "Coordinamos personalmente con funerarias de Long Island y Queens. Llámanos para servicios el mismo día."
                : "We coordinate directly with Long Island and Queens funeral homes. Call us for same-day service."}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write `app/[locale]/shop/[category]/loading.tsx`**

```tsx
// app/[locale]/shop/[category]/loading.tsx
import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";

export default function CategoryLoading() {
  return (
    <main className="bg-bone text-ink">
      <header className="mx-auto max-w-[var(--container-max)] px-6 pt-12 pb-6 md:pt-20">
        <div className="h-3 w-24 animate-pulse rounded bg-mute-100" />
        <div className="mt-3 h-14 w-1/2 animate-pulse rounded bg-mute-100" />
        <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-mute-100" />
      </header>
      <div className="sticky top-16 z-30 -mx-6 border-y border-ink/10 bg-bone/85 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[var(--container-max)] gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-mute-100" />
          ))}
        </div>
      </div>
      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-x-6 gap-y-12 px-6 py-10 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Type-check + dev verify**

```bash
npx tsc --noEmit && npm run dev
```

Walk these URLs:
- `/en/shop/arrangements`
- `/en/shop/arrangements?occasion=romance&sort=price-asc`
- `/en/shop/arrangements?color=pink&same_day=1`
- `/en/shop/sympathy` — confirm no color filter, no rouge, fade-only stagger, phone CTA renders
- `/es/shop/bouquets` — Spanish copy

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/shop/[category]/page.tsx app/[locale]/shop/[category]/loading.tsx
git commit -m "feat(shop): category pages with sticky filter bar + sympathy variant"
```

---

## Task 16: PDP shell + metadata + structured data

**Files:**
- Create: `app/[locale]/product/[slug]/page.tsx`
- Create: `app/[locale]/product/[slug]/loading.tsx`
- Create: `components/product/PdpStructuredData.tsx`

The PDP has a lot of moving parts; this task lands the shell that subsequent tasks fill out. It renders the title, blurb, sticky image stack placeholder, sticky right column placeholder, accordion placeholder, "Pairs well with" placeholder, and structured data — but not the configurator yet.

- [ ] **Step 1: Write `components/product/PdpStructuredData.tsx`**

```tsx
// components/product/PdpStructuredData.tsx
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { startingPriceCents } from "@/data/product-helpers";

export function PdpStructuredData({
  product,
  locale,
  origin,
}: {
  product: Product;
  locale: Locale;
  origin: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title[locale],
    description: product.description[locale],
    image: product.images.map((i) => i.src),
    brand: { "@type": "Brand", name: "Diva Flowers" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: (startingPriceCents(product) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.active ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${origin}/${locale}/product/${product.slug}`,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 2: Write `app/[locale]/product/[slug]/page.tsx` (shell)**

```tsx
// app/[locale]/product/[slug]/page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, headers } from "next/navigation";
import type { Locale } from "@/types/locale";
import { getProductBySlug, getPairsWith, PRODUCTS } from "@/data/products";
import { ImageStack } from "@/components/product/ImageStack";
import { PdpConfigurator } from "@/components/product/PdpConfigurator";
import { PdpAccordion } from "@/components/product/PdpAccordion";
import { PairsWellWith } from "@/components/product/PairsWellWith";
import { JournalTile } from "@/components/product/JournalTile";
import { PdpStructuredData } from "@/components/product/PdpStructuredData";

export async function generateStaticParams() {
  return PRODUCTS.filter((p) => p.active).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = getProductBySlug(slug);
  if (!p) return {};
  return {
    title: p.seo.title[locale],
    description: p.seo.description[locale],
    alternates: {
      canonical: `/${locale}/product/${slug}`,
      languages: {
        en: `/en/product/${slug}`,
        es: `/es/product/${slug}`,
      },
    },
    openGraph: {
      title: p.seo.title[locale],
      description: p.seo.description[locale],
      images: p.images[0]?.src ? [p.images[0].src] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  setRequestLocale(locale);

  const isSympathy = product.category === "sympathy";
  const pairs = getPairsWith(product);

  // origin for structured data
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const eyebrow =
    locale === "es"
      ? `Diva Flowers · ${categoryLabel(product.category, "es")}`
      : `Diva Flowers · ${categoryLabel(product.category, "en")}`;

  return (
    <main className="bg-bone text-ink">
      <PdpStructuredData product={product} locale={locale} origin={origin} />

      <section className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-10 px-6 pt-10 pb-16 lg:grid-cols-12 lg:gap-12 lg:pt-16">
        <div className="lg:col-span-7">
          <ImageStack product={product} locale={locale} />
        </div>
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tighter md:text-6xl">
              {product.title[locale]}
            </h1>
            <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-ink/75">
              {product.blurb[locale]}
            </p>

            <PdpConfigurator
              product={product}
              locale={locale}
              cutoff={"14:00"}
              motionMode={isSympathy ? "sympathy" : "default"}
            />

            <div className="mt-8">
              <PdpAccordion locale={locale} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pb-16">
        <PairsWellWith products={pairs} locale={locale} />
      </section>

      {!isSympathy && (
        <section className="mx-auto max-w-[var(--container-max)] px-6 pb-24">
          <JournalTile locale={locale} />
        </section>
      )}
    </main>
  );
}

function categoryLabel(c: string, locale: "en" | "es"): string {
  const map: Record<string, { en: string; es: string }> = {
    arrangements: { en: "Arrangements", es: "Arreglos" },
    bouquets: { en: "Bouquets", es: "Ramos" },
    plants: { en: "Plants", es: "Plantas" },
    gifts: { en: "Gifts", es: "Regalos" },
    sympathy: { en: "Sympathy", es: "Condolencias" },
    subscriptions: { en: "Subscriptions", es: "Suscripciones" },
  };
  return map[c]?.[locale] ?? c;
}
```

- [ ] **Step 3: Write `app/[locale]/product/[slug]/loading.tsx`**

```tsx
// app/[locale]/product/[slug]/loading.tsx
export default function ProductLoading() {
  return (
    <main className="mx-auto grid max-w-[var(--container-max)] grid-cols-1 gap-10 px-6 pt-10 pb-16 lg:grid-cols-12 lg:gap-12 lg:pt-16">
      <div className="lg:col-span-7">
        <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
          ))}
        </div>
      </div>
      <div className="lg:col-span-5">
        <div className="h-3 w-24 animate-pulse rounded bg-mute-100" />
        <div className="mt-3 h-14 w-3/4 animate-pulse rounded bg-mute-100" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-mute-100" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-mute-100" />
        <div className="mt-8 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-mute-100" />
          ))}
        </div>
        <div className="mt-8 h-14 w-full animate-pulse rounded-[var(--radius-product)] bg-mute-100" />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Note — this won't compile yet**

The shell imports `ImageStack`, `PdpConfigurator`, `PdpAccordion`, `PairsWellWith`, `JournalTile` — created in Tasks 17–22. Skip type-check and commit at the end of Task 22 instead.

---

## Task 17: ImageStack

**Files:**
- Create: `components/product/ImageStack.tsx`

Primary image full-width, secondary thumbs in a 3-col strip below. Click a thumb to swap primary. Bloom hover only on the primary image (thumbs use a quiet hover).

- [ ] **Step 1: Write the file**

```tsx
// components/product/ImageStack.tsx
"use client";
import { useState, memo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
};

function ImageStackImpl({ product, locale }: Props) {
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const active = product.images[activeIdx];
  if (!active) return null;
  const aspect =
    active.aspect === "1/1"
      ? "aspect-square"
      : active.aspect === "16/9"
        ? "aspect-video"
        : "aspect-[4/5]";

  return (
    <div>
      <div className={cn("relative overflow-hidden rounded-[var(--radius-product)] bg-mute-100", aspect)}>
        <AnimatePresence mode="wait">
          <motion.img
            key={active.src}
            src={active.src}
            alt={active.alt[locale]}
            className="absolute inset-0 size-full object-cover"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </AnimatePresence>
      </div>
      {product.images.length > 1 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {product.images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={img.alt[locale]}
              aria-current={i === activeIdx}
              className={cn(
                "aspect-square overflow-hidden rounded-[var(--radius-product)] border transition-colors",
                i === activeIdx ? "border-ink/45" : "border-ink/10 hover:border-ink/25",
              )}
            >
              <img src={img.src} alt={img.alt[locale]} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ImageStack = memo(ImageStackImpl);
```

---

## Task 18: PdpConfigurator + AddToBag (variant + add-on + delivery + card message + add-to-bag, in one client orchestrator)

**Files:**
- Create: `components/product/VariantChips.tsx`
- Create: `components/product/AddOnToggles.tsx`
- Create: `components/product/DeliveryDatePicker.tsx`
- Create: `components/product/CardMessage.tsx`
- Create: `components/product/SubscriptionCadence.tsx`
- Create: `components/product/AddToBag.tsx`
- Create: `components/product/PdpConfigurator.tsx`

These six client components are tightly coupled (state flows from `PdpConfigurator` down) so they ship in a single task to avoid placeholder noise. Each file is a standalone unit; the orchestrator wires them.

- [ ] **Step 1: Write `VariantChips.tsx`**

```tsx
// components/product/VariantChips.tsx
"use client";
import { memo } from "react";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { formatMoneyCents } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
  value: string;
  onChange: (variantId: string) => void;
};

function VariantChipsImpl({ product, locale, value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {product.variants.map((v) => {
        const selected = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(v.id)}
            className={cn(
              "inline-flex h-11 items-center gap-3 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
              selected ? "border-transparent bg-ink text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
            )}
          >
            <span>{v.label[locale]}</span>
            <span className={cn("font-mono text-xs", selected ? "text-bone/80" : "text-mute-500")}>
              {formatMoneyCents(v.priceCents, locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const VariantChips = memo(VariantChipsImpl);
```

- [ ] **Step 2: Write `AddOnToggles.tsx`**

```tsx
// components/product/AddOnToggles.tsx
"use client";
import { memo } from "react";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { formatMoneyCents } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
  value: string[];
  onChange: (next: string[]) => void;
};

function AddOnTogglesImpl({ product, locale, value, onChange }: Props) {
  if (!product.addOns || product.addOns.length === 0) return null;
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Acompañamientos" : "Add-ons"}
      </p>
      <div className="flex flex-wrap gap-2">
        {product.addOns.map((a) => {
          const selected = value.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(a.id)}
              className={cn(
                "inline-flex h-10 items-center gap-3 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
                selected ? "border-transparent bg-rouge text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              <span>{a.label[locale]}</span>
              <span className={cn("font-mono text-xs", selected ? "text-bone/85" : "text-mute-500")}>
                +{formatMoneyCents(a.priceCents, locale)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const AddOnToggles = memo(AddOnTogglesImpl);
```

- [ ] **Step 3: Write `DeliveryDatePicker.tsx`**

```tsx
// components/product/DeliveryDatePicker.tsx
"use client";
import { memo, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/types/locale";
import { listAvailableDates, isSameDayEligible, toIsoDate } from "@/lib/delivery";
import { cn } from "@/lib/cn";

type Props = {
  locale: Locale;
  cutoff: string;
  value: string;
  onChange: (iso: string) => void;
};

function DeliveryDatePickerImpl({ locale, cutoff, value, onChange }: Props) {
  // Render-time-stable date list — mounted client-side so timezone is the user's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const dates = useMemo(() => (now ? listAvailableDates(now, cutoff, 14) : []), [now, cutoff]);
  const eligible = now ? isSameDayEligible(now, cutoff) : false;
  const today = now ? toIsoDate(now) : "";

  // Default selection on first mount
  useEffect(() => {
    if (now && !value && dates.length > 0) onChange(dates[0]);
  }, [now, value, dates, onChange]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Fecha de entrega" : "Delivery date"}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((iso) => {
          const d = new Date(iso + "T00:00:00");
          const selected = iso === value;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              className={cn(
                "flex h-16 min-w-[5rem] flex-col items-center justify-center rounded-[var(--radius-product)] border px-3 text-center transition-colors",
                selected ? "border-transparent bg-ink text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
                {isToday ? (locale === "es" ? "Hoy" : "Today") : fmt.format(d).split(",")[0]}
              </span>
              <span className="font-mono text-sm">{fmt.format(d).split(",").slice(1).join(",").trim()}</span>
            </button>
          );
        })}
      </div>
      {now && !eligible && (
        <p className="font-sans text-xs text-mute-500">
          {locale === "es"
            ? `Pasamos del corte de hoy (${cutoff}). Mismo día disponible mañana.`
            : `Past today's cutoff (${cutoff}). Same-day available tomorrow.`}
        </p>
      )}
    </div>
  );
}

export const DeliveryDatePicker = memo(DeliveryDatePickerImpl);
```

- [ ] **Step 4: Write `CardMessage.tsx`**

```tsx
// components/product/CardMessage.tsx
"use client";
import { memo } from "react";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
};

function CardMessageImpl({ locale, value, onChange, maxLength = 200 }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Mensaje de tarjeta (opcional)" : "Card message (optional)"}
      </p>
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={locale === "es" ? "Para alguien especial…" : "For someone special…"}
        className="w-full resize-none rounded-[var(--radius-product)] border border-ink/15 bg-transparent px-4 py-3 font-sans text-base leading-relaxed text-ink placeholder:text-mute-400 focus-visible:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
      />
      <p className="text-right font-mono text-xs text-mute-500">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

export const CardMessage = memo(CardMessageImpl);
```

- [ ] **Step 5: Write `SubscriptionCadence.tsx`**

```tsx
// components/product/SubscriptionCadence.tsx
"use client";
import { memo } from "react";
import type { Locale } from "@/types/locale";
import type { SubscriptionCadence as Cadence } from "@/types/product";
import { cn } from "@/lib/cn";

type Props = {
  locale: Locale;
  cadences: Cadence[];
  value: Cadence;
  onChange: (c: Cadence) => void;
};

function SubscriptionCadenceImpl({ locale, cadences, value, onChange }: Props) {
  const label: Record<Cadence, { en: string; es: string }> = {
    weekly: { en: "Weekly", es: "Semanal" },
    biweekly: { en: "Biweekly", es: "Quincenal" },
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Cadencia" : "Cadence"}
      </p>
      <div className="flex gap-2">
        {cadences.map((c) => {
          const selected = c === value;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-pressed={selected}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
                selected ? "border-transparent bg-ink text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              {label[c][locale]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const SubscriptionCadence = memo(SubscriptionCadenceImpl);
```

- [ ] **Step 6: Write `AddToBag.tsx`**

```tsx
// components/product/AddToBag.tsx
"use client";
import { memo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/lib/cart-store";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";

type Props = {
  productId: string;
  variantId: string;
  addOnIds: string[];
  totalCents: number;
  disabled?: boolean;
  locale: Locale;
};

function AddToBagImpl({ productId, variantId, addOnIds, totalCents, disabled, locale }: Props) {
  const add = useCartStore((s) => s.add);
  const [state, setState] = useState<"idle" | "added">("idle");
  const reduce = useReducedMotion();

  const onClick = () => {
    if (disabled) return;
    add({ productId, variantId, addOnIds, qty: 1 });
    setState("added");
    window.setTimeout(() => setState("idle"), 1800);
  };

  const idleLabel = locale === "es" ? "Añadir a la bolsa" : "Add to bag";
  const addedLabel = locale === "es" ? "Añadido" : "Added";

  return (
    <Button
      variant="primary"
      size="lg"
      disabled={disabled || state === "added"}
      onClick={onClick}
      className="w-full justify-between"
    >
      <AnimatePresence mode="wait">
        {state === "idle" ? (
          <motion.span
            key="idle"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {idleLabel}
          </motion.span>
        ) : (
          <motion.span
            key="added"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            ✓ {addedLabel}
          </motion.span>
        )}
      </AnimatePresence>
      <span className="font-mono text-base">{formatMoneyCents(totalCents, locale)}</span>
    </Button>
  );
}

export const AddToBag = memo(AddToBagImpl);
```

- [ ] **Step 7: Write `PdpConfigurator.tsx`**

```tsx
// components/product/PdpConfigurator.tsx
"use client";
import { memo, useMemo, useState } from "react";
import type { Locale } from "@/types/locale";
import type { Product, SubscriptionCadence as Cadence } from "@/types/product";
import { VariantChips } from "./VariantChips";
import { AddOnToggles } from "./AddOnToggles";
import { DeliveryDatePicker } from "./DeliveryDatePicker";
import { CardMessage } from "./CardMessage";
import { SubscriptionCadence as CadencePicker } from "./SubscriptionCadence";
import { AddToBag } from "./AddToBag";

type Props = {
  product: Product;
  locale: Locale;
  cutoff: string;
  motionMode: "default" | "sympathy";
};

function PdpConfiguratorImpl({ product, locale, cutoff }: Props) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const isSubscription = product.category === "subscriptions" && Boolean(product.subscription);
  const [cadence, setCadence] = useState<Cadence>(
    product.subscription?.cadences[0] ?? "weekly",
  );

  const totalCents = useMemo(() => {
    const v = product.variants.find((x) => x.id === variantId)?.priceCents ?? 0;
    const adds =
      product.addOns?.filter((a) => addOnIds.includes(a.id)).reduce((s, a) => s + a.priceCents, 0) ?? 0;
    return v + adds;
  }, [product, variantId, addOnIds]);

  const dateLabel =
    isSubscription
      ? locale === "es"
        ? "Primera entrega"
        : "First delivery"
      : locale === "es"
        ? "Fecha de entrega"
        : "Delivery date";

  return (
    <div className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
          {locale === "es" ? "Tamaño" : "Size"}
        </p>
        <VariantChips product={product} locale={locale} value={variantId} onChange={setVariantId} />
      </div>

      {isSubscription && product.subscription && (
        <CadencePicker
          locale={locale}
          cadences={product.subscription.cadences}
          value={cadence}
          onChange={setCadence}
        />
      )}

      <AddOnToggles product={product} locale={locale} value={addOnIds} onChange={setAddOnIds} />

      <div className="flex flex-col gap-2">
        <p className="sr-only">{dateLabel}</p>
        <DeliveryDatePicker locale={locale} cutoff={cutoff} value={date} onChange={setDate} />
      </div>

      <CardMessage locale={locale} value={message} onChange={setMessage} />

      <AddToBag
        productId={product.id}
        variantId={variantId}
        addOnIds={addOnIds}
        totalCents={totalCents}
        disabled={!variantId || !date}
        locale={locale}
      />
    </div>
  );
}

export const PdpConfigurator = memo(PdpConfiguratorImpl);
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

If this errors on the unused `motionMode` prop, that's OK — leave it; it's destined to flip down to children in Task 19 when the sympathy variant is wired. Suppress with `void motionMode` at the top of `PdpConfiguratorImpl` to keep the linter quiet:

```ts
function PdpConfiguratorImpl({ product, locale, cutoff, motionMode }: Props) {
  void motionMode;
  // …
}
```

- [ ] **Step 9: Commit**

```bash
git add components/product/VariantChips.tsx components/product/AddOnToggles.tsx components/product/DeliveryDatePicker.tsx components/product/CardMessage.tsx components/product/SubscriptionCadence.tsx components/product/AddToBag.tsx components/product/PdpConfigurator.tsx
git commit -m "feat(pdp): variant/addon/delivery/message/cadence configurator + add-to-bag"
```

---

## Task 19: PdpAccordion

**Files:**
- Create: `components/product/PdpAccordion.tsx`

Three sections: Stems & care, Substitution policy, Delivery zones. Plain `<details>` — works without JS, keyboard-friendly, matches editorial restraint.

- [ ] **Step 1: Write the file**

```tsx
// components/product/PdpAccordion.tsx
"use client";
import { memo } from "react";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";

const COPY = {
  stems_label: { en: "Stems & care", es: "Tallos y cuidado" },
  stems_body: {
    en: "Each stem is conditioned for 24 hours before the build. Trim half an inch and change the water every other day. Keep out of direct sun. Bloom window: 7–9 days.",
    es: "Cada tallo se acondiciona durante 24 horas antes del montaje. Corta medio centímetro y cambia el agua cada dos días. Mantén fuera del sol directo. Florescencia: 7–9 días.",
  },
  sub_label: { en: "Substitution policy", es: "Política de sustitución" },
  sub_body: {
    en: "Markets vary. We may substitute a stem of equal or greater value to keep the silhouette and palette intact. We always confirm major substitutions in advance.",
    es: "Los mercados varían. Podemos sustituir un tallo por uno de igual o mayor valor para mantener silueta y paleta. Siempre confirmamos sustituciones mayores con antelación.",
  },
  delivery_label: { en: "Delivery zones", es: "Zonas de entrega" },
  delivery_body: {
    en: `We deliver across ${SITE.deliveryZones.join(", ")}. Same-day cutoff is ${SITE.cutoffTime}.`,
    es: `Entregamos en ${SITE.deliveryZones.join(", ")}. El corte para el mismo día es a las ${SITE.cutoffTime}.`,
  },
} as const;

function Item({ label, body }: { label: string; body: string }) {
  return (
    <details className="group border-b border-ink/10 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-base text-ink">
        <span>{label}</span>
        <span className="font-mono text-xs text-mute-500 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-ink/75">{body}</p>
    </details>
  );
}

function PdpAccordionImpl({ locale }: { locale: Locale }) {
  return (
    <div className="border-t border-ink/10">
      <Item label={COPY.stems_label[locale]} body={COPY.stems_body[locale]} />
      <Item label={COPY.sub_label[locale]} body={COPY.sub_body[locale]} />
      <Item label={COPY.delivery_label[locale]} body={COPY.delivery_body[locale]} />
    </div>
  );
}

export const PdpAccordion = memo(PdpAccordionImpl);
```

- [ ] **Step 2: Commit**

```bash
git add components/product/PdpAccordion.tsx && git commit -m "feat(pdp): stems/substitution/delivery accordion"
```

---

## Task 20: PairsWellWith

**Files:**
- Create: `components/product/PairsWellWith.tsx`

Server component. 4 product cards side-by-side. Reuses `<ProductCard>`.

- [ ] **Step 1: Write the file**

```tsx
// components/product/PairsWellWith.tsx
import { ProductCard } from "./ProductCard";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";

type Props = { products: Product[]; locale: Locale };

export function PairsWellWith({ products, locale }: Props) {
  if (products.length === 0) return null;
  const title = locale === "es" ? "Combina bien con" : "Pairs well with";
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-display text-3xl leading-none tracking-tighter md:text-4xl">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
        {products.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} locale={locale} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/product/PairsWellWith.tsx && git commit -m "feat(pdp): pairs-well-with strip"
```

---

## Task 21: JournalTile (lilac accent)

**Files:**
- Create: `components/product/JournalTile.tsx`

This is one of the two places `lilac` may appear (per spec §4.1). Hard-coded teaser in v1 — Plan 5 will replace with real journal data.

- [ ] **Step 1: Write the file**

```tsx
// components/product/JournalTile.tsx
import Link from "next/link";
import type { Locale } from "@/types/locale";

export function JournalTile({ locale }: { locale: Locale }) {
  const eyebrow = locale === "es" ? "Del diario" : "From our journal";
  const title =
    locale === "es"
      ? "Cómo construimos un Altar Rubí, paso a paso."
      : "How we build a Ruby Altar, stem by stem.";
  const cta = locale === "es" ? "Leer" : "Read";
  return (
    <Link
      href={`/${locale}/journal`}
      className="group relative flex flex-col items-start justify-between overflow-hidden rounded-[var(--radius-bento)] bg-lilac p-8 transition-colors hover:bg-lilac/90 md:flex-row md:items-end md:p-12"
    >
      <div className="max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink/70">{eyebrow}</p>
        <p className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink md:text-4xl">
          {title}
        </p>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-ink md:mt-0">
        {cta}
        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Type-check the full PDP shell now**

```bash
npx tsc --noEmit
```

Expected: no errors — every PDP import now resolves.

- [ ] **Step 3: Commit**

```bash
git add components/product/JournalTile.tsx app/[locale]/product/[slug]/page.tsx app/[locale]/product/[slug]/loading.tsx components/product/PdpStructuredData.tsx
git commit -m "feat(pdp): full route + structured data + journal tile (lilac)"
```

---

## Task 22: Boot the dev server and verify the PDP

**Files:**
- (no file changes; verification only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk these PDP URLs and verify**

- `/en/product/ruby-altar` —
  - title, blurb, image stack works (3 thumbs swap primary)
  - 3 size chips select; price changes
  - 2 add-on chips toggle; price updates
  - delivery date strip renders 14 dates; first selected by default
  - card message respects 200-char limit
  - "Add to bag" enabled once date is set; pressing it morphs to "✓ Added" briefly, the nav cart counter increments by 1
  - accordion opens
  - "Pairs well with" shows curated 3 products (per `pairsWith`) or category fallback
  - lilac journal tile renders below
- `/en/product/petite-subscription` —
  - cadence picker shows Weekly + Biweekly
  - delivery label reads "First delivery"
- `/en/product/white-vespers` (sympathy) —
  - no journal tile (lilac suppressed)
- `/es/product/ruby-altar` — Spanish copy throughout

Stop the server.

- [ ] **Step 3: Verify the cart store actually persists**

Open `/en/product/ruby-altar`, add to bag, refresh the page. The cart count in the top nav should still show 1. (Plan 1's `CartButton` reads from the store; the store persists to `localStorage`.)

- [ ] **Step 4: Commit (no changes — verification only)**

If you spot issues, fix them inline and commit a `fix(pdp): …` follow-up. Otherwise no commit needed.

---

## Task 23: MegaMenu in TopNav

**Files:**
- Create: `components/nav/MegaMenu.tsx`
- Modify: `components/nav/NavLinks.tsx` — replace plain `Shop` link with `<MegaMenu>` trigger on `lg:`

Hover-opens a wide panel with 6 category thumbs. Uses `BloomImage`.

- [ ] **Step 1: Write `MegaMenu.tsx`**

```tsx
// components/nav/MegaMenu.tsx
"use client";
import { memo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { BloomImage } from "@/components/motion/BloomImage";
import type { Locale } from "@/types/locale";

const CATS = [
  { slug: "arrangements", seed: "cat-arrangements" },
  { slug: "bouquets", seed: "cat-bouquets" },
  { slug: "plants", seed: "cat-plants" },
  { slug: "gifts", seed: "cat-gifts" },
  { slug: "sympathy", seed: "cat-sympathy" },
  { slug: "subscriptions", seed: "cat-subscriptions" },
] as const;

const LABELS: Record<(typeof CATS)[number]["slug"], { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};

type Props = { locale: Locale; label: string };

function MegaMenuImpl({ locale, label }: Props) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href={`/${locale}/shop`}
        className="font-sans text-sm tracking-tight text-ink/80 hover:text-ink transition-colors"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {label}
      </Link>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-0 top-16 z-40 hidden border-y border-ink/10 bg-bone/95 px-6 py-8 backdrop-blur lg:block"
          >
            <div className="mx-auto grid max-w-[var(--container-max)] grid-cols-6 gap-4">
              {CATS.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${locale}/shop/${c.slug}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-product)] bg-mute-100"
                >
                  <BloomImage
                    src={`https://picsum.photos/seed/${c.seed}/600/800`}
                    alt={LABELS[c.slug][locale]}
                    className="h-full w-full"
                    sizes="200px"
                  />
                  <div className="absolute inset-x-3 bottom-3">
                    <span className="font-display text-xl leading-none tracking-tight text-bone drop-shadow-[0_2px_4px_rgba(14,13,12,0.4)]">
                      {LABELS[c.slug][locale]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const MegaMenu = memo(MegaMenuImpl);
```

- [ ] **Step 2: Update `NavLinks.tsx`**

Open `components/nav/NavLinks.tsx` and replace the file contents with:

```tsx
// components/nav/NavLinks.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { MegaMenu } from "./MegaMenu";

export async function NavLinks({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const links: { href: string; label: string }[] = [
    { href: `/${locale}/shop/subscriptions`, label: t("subscriptions") },
    { href: `/${locale}/weddings`, label: t("weddings") },
    { href: `/${locale}/events`, label: t("events") },
    { href: `/${locale}/story`, label: t("story") },
  ];
  return (
    <ul className="hidden md:flex items-center gap-7">
      <li>
        <MegaMenu locale={locale} label={t("shop")} />
      </li>
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="font-sans text-sm tracking-tight text-ink/80 hover:text-ink transition-colors"
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Verify in dev**

```bash
npm run dev
```

Hover the "Shop" link on a desktop viewport (`lg:` ≥ 1024). The panel should drop down with 6 category thumbs and disappear on mouse-leave. Below `lg:`, the link still works as a plain link to `/shop`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add components/nav/MegaMenu.tsx components/nav/NavLinks.tsx
git commit -m "feat(nav): mega-menu with 6 category thumbs on desktop"
```

---

## Task 24: i18n message keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

Most catalog/PDP copy lives inside the data layer (per spec) or inside hard-coded component constants (filter labels, accordion). The i18n bundle just adds the keys components actually consume — currently only the `categories` block is used outside the home page; the rest of the catalog/PDP UI literals are baked into the components above. So this task is small: confirm the existing `categories` keys (verified present in Plan 1) cover the new pages, and add no-op message keys for accessibility labels we'll need in Task 25's e2e.

- [ ] **Step 1: Open `messages/en.json` and add the `catalog` block**

Insert this object inside the top-level JSON object (e.g. after the `categories` block):

```json
"catalog": {
  "filter_label": "Filter",
  "sort_label": "Sort",
  "clear": "Clear",
  "newest_arrivals": "Newest arrivals",
  "from_price_prefix": "From",
  "out_of_stock": "Sold out",
  "delivery_zone_error": "We don't deliver to that ZIP yet — call us at {phone}.",
  "no_results_title": "Nothing matches yet."
}
```

- [ ] **Step 2: Open `messages/es.json` and add the matching block**

```json
"catalog": {
  "filter_label": "Filtrar",
  "sort_label": "Ordenar",
  "clear": "Limpiar",
  "newest_arrivals": "Lo más nuevo",
  "from_price_prefix": "Desde",
  "out_of_stock": "Agotado",
  "delivery_zone_error": "No entregamos a ese código postal aún — llámanos al {phone}.",
  "no_results_title": "Nada coincide aún."
}
```

These keys are reserved for future use (e.g. when the dev-zone error wires up in Plan 3 checkout) — they're added now to keep the message bundle complete and avoid noisy diffs later.

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit && git add messages/en.json messages/es.json && git commit -m "chore(i18n): reserve catalog message keys (en + es)"
```

---

## Task 25: Sitemap extension

**Files:**
- Modify: `app/sitemap.ts` (or create if not present)

Generate URLs for all category pages and all 28 product pages, in both locales.

- [ ] **Step 1: Check whether `app/sitemap.ts` exists**

```bash
ls app/sitemap.ts 2>/dev/null && echo "exists" || echo "missing"
```

- [ ] **Step 2: Write or rewrite the file**

Replace the file contents with:

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/data/products";
import { locales } from "@/types/locale";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://divaflowers.com";
const STATIC_PATHS = [
  "",
  "/shop",
  "/shop/arrangements",
  "/shop/bouquets",
  "/shop/plants",
  "/shop/gifts",
  "/shop/sympathy",
  "/shop/subscriptions",
  "/weddings",
  "/events",
  "/story",
  "/contact",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  const lastModified = new Date();
  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      out.push({ url: `${SITE_URL}/${locale}${path}`, lastModified });
    }
    for (const p of PRODUCTS) {
      if (!p.active) continue;
      out.push({ url: `${SITE_URL}/${locale}/product/${p.slug}`, lastModified });
    }
  }
  return out;
}
```

- [ ] **Step 3: Hit the sitemap in dev**

```bash
npm run dev
# in another shell:
curl -s http://localhost:3000/sitemap.xml | head -40
```

Expected: XML with both `/en/...` and `/es/...` entries, including `/shop/arrangements` and product slugs. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/sitemap.ts && git commit -m "feat(seo): include catalog + product URLs in sitemap"
```

---

## Task 26: Playwright e2e — shop hub + category filter/sort

**Files:**
- Create: `tests/e2e/shop.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/shop.spec.ts
import { test, expect } from "@playwright/test";

test.describe("shop", () => {
  test("hub renders in EN with mosaic + newest grid", async ({ page }) => {
    await page.goto("/en/shop");
    await expect(page.getByRole("heading", { name: /Every arrangement/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Arrangements/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Newest arrivals/i })).toBeVisible();
  });

  test("hub renders in ES", async ({ page }) => {
    await page.goto("/es/shop");
    await expect(page.getByRole("heading", { name: /Cada arreglo/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Lo más nuevo/i })).toBeVisible();
  });

  test("category page shows products and filter bar", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await expect(page.getByRole("heading", { name: /Arrangements/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Romance/i })).toBeVisible();
    // four arrangements seeded
    const cards = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    await expect(cards).toHaveCount(4);
  });

  test("filter chip writes the URL and narrows the grid", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    const cardsBefore = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    const beforeCount = await cardsBefore.count();
    await page.getByRole("button", { name: /^Romance$/ }).click();
    await expect(page).toHaveURL(/[?&]occasion=romance/);
    const cardsAfter = page.getByRole("link").filter({ hasText: /From\s*\$/i });
    expect(await cardsAfter.count()).toBeLessThanOrEqual(beforeCount);
  });

  test("sort dropdown updates URL", async ({ page }) => {
    await page.goto("/en/shop/arrangements");
    await page.getByLabel("Sort").selectOption("price-asc");
    await expect(page).toHaveURL(/[?&]sort=price-asc/);
  });

  test("clear filters resets the URL", async ({ page }) => {
    await page.goto("/en/shop/arrangements?occasion=romance&sort=price-asc");
    await page.getByRole("button", { name: /^Clear$/ }).click();
    await expect(page).toHaveURL(/\/en\/shop\/arrangements$/);
  });
});
```

- [ ] **Step 2: Run it**

```bash
npm run e2e -- shop.spec
```

Expected: all 6 tests pass. If a selector flakes (e.g. ambiguous role match), tighten the locator and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/shop.spec.ts && git commit -m "test(e2e): shop hub, category, filter, sort, clear"
```

---

## Task 27: Playwright e2e — PDP + add-to-bag + sympathy

**Files:**
- Create: `tests/e2e/pdp.spec.ts`
- Create: `tests/e2e/sympathy.spec.ts`

- [ ] **Step 1: Write `tests/e2e/pdp.spec.ts`**

```ts
// tests/e2e/pdp.spec.ts
import { test, expect } from "@playwright/test";

test.describe("pdp", () => {
  test("ruby-altar renders with title, blurb, variants, default delivery", async ({ page }) => {
    await page.goto("/en/product/ruby-altar");
    await expect(page.getByRole("heading", { name: "Ruby Altar", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Standard\s/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Grand\s/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Diva\s/i })).toBeVisible();
    // delivery default selected — exactly one selected button in the date strip
    const dateButtons = page.locator('button[aria-pressed="true"]').filter({ hasText: /^(Today|[A-Z][a-z]{2})/ });
    await expect(dateButtons).toHaveCount(1);
  });

  test("changing variant updates the visible price on the CTA", async ({ page }) => {
    await page.goto("/en/product/ruby-altar");
    const cta = page.getByRole("button", { name: /Add to bag/i });
    const standardPrice = await cta.innerText();
    await page.getByRole("button", { name: /^Diva\s/i }).click();
    const divaPrice = await cta.innerText();
    expect(divaPrice).not.toBe(standardPrice);
  });

  test("add to bag morphs to confirmation and increments the cart counter", async ({ page }) => {
    await page.goto("/en/product/ruby-altar");
    const cta = page.getByRole("button", { name: /Add to bag/i });
    await cta.click();
    await expect(page.getByText(/Added/i)).toBeVisible();
    // cart counter increments by 1; cart button is in the top nav
    await expect(page.locator("header").getByText(/^1$/)).toBeVisible();
  });

  test("Spanish PDP renders ES copy", async ({ page }) => {
    await page.goto("/es/product/ruby-altar");
    await expect(page.getByRole("heading", { name: "Altar Rubí", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Añadir a la bolsa/i })).toBeVisible();
  });

  test("subscription PDP shows cadence picker and 'First delivery'", async ({ page }) => {
    await page.goto("/en/product/petite-subscription");
    await expect(page.getByRole("button", { name: /^Weekly$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Biweekly$/ })).toBeVisible();
    await expect(page.getByText(/First delivery/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Write `tests/e2e/sympathy.spec.ts`**

```ts
// tests/e2e/sympathy.spec.ts
import { test, expect } from "@playwright/test";

test.describe("sympathy variant", () => {
  test("/en/shop/sympathy hides color filter and shows phone CTA", async ({ page }) => {
    await page.goto("/en/shop/sympathy");
    // color chip ("Pink") should NOT be present
    await expect(page.getByRole("button", { name: /^Pink$/ })).toHaveCount(0);
    // phone number should be visible
    await expect(page.getByRole("link", { name: /516 484 3456/ })).toBeVisible();
  });

  test("ES copy on sympathy hub uses 'Cuando las palabras no bastan'", async ({ page }) => {
    await page.goto("/es/shop/sympathy");
    await expect(page.getByText(/Cuando las palabras no bastan/i)).toBeVisible();
  });

  test("sympathy PDP suppresses lilac journal tile", async ({ page }) => {
    await page.goto("/en/product/white-vespers");
    await expect(page.getByText(/From our journal/i)).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run all e2e**

```bash
npm run e2e
```

Expected: home + locale + shop + pdp + sympathy specs all green. If `npm run build` is required first (depends on `playwright.config.ts`), Playwright will boot the dev server itself per the existing config.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/pdp.spec.ts tests/e2e/sympathy.spec.ts && git commit -m "test(e2e): PDP, add-to-bag, subscription, sympathy"
```

---

## Task 28: Pre-flight + README update + final commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Forbidden-pattern grep**

```bash
grep -RE "h-screen|font-\['Inter|#000000\b|emoji|✨|🌸|💐" app components data lib && echo "FAIL — fix offending file" || echo "OK — no forbidden patterns"
```

Expected: `OK — no forbidden patterns`. If any match, fix the file before continuing.

- [ ] **Step 2: Type-check end-to-end**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all unit tests**

```bash
npm test
```

Expected: format (7) + motion-config (3) + cart-store (5) + delivery (5) + product-helpers (12) + search-params (5) = 37 tests passing.

- [ ] **Step 4: Run all e2e**

```bash
npm run e2e
```

Expected: home, locale, shop, pdp, sympathy specs green.

- [ ] **Step 5: Build for production**

```bash
npm run build
```

Expected: build succeeds. If a route fails to statically render, check that all `params`/`searchParams` are awaited as `Promise<…>` per the Next.js 16 contract.

- [ ] **Step 6: Update `README.md` Status section**

Open `README.md` and replace the `## Status` section with:

```markdown
## Status

- Plan 1 complete: foundation, brand system, bilingual home page.
- Plan 2 complete: catalog (shop hub + category pages with sticky filter bar), PDP (variants, add-ons, delivery picker, card message, add-to-bag), sympathy variant, subscriptions, mega-menu, sitemap.
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: mark Plan 2 complete in README"
```

---

## Plan 2 Done — Summary

**Shipped:**
- Product domain types and 28 seed entries (24 products + 4 subscription tiers), bilingual EN/ES with believable price points and copy.
- Pure-function product helpers (price, filter, sort) with full test coverage; URL-based filter/sort state with parse/serialize round-trip tests; delivery cutoff + available-dates helper with tests.
- `/[locale]/shop` hub with editorial header, 6-tile asymmetric category mosaic, and "Newest arrivals" 12-product grid.
- `/[locale]/shop/[category]` category pages for all 6 categories with sticky filter bar (occasion, color, size, price, same-day), sort dropdown, empty state, loading skeleton, and a sympathy variant that swaps to fade-only motion, drops `rouge`/`petal` from chrome accents, hides the color filter, and surfaces a prominent phone CTA.
- `/[locale]/product/[slug]` PDP with image stack, variant chips, add-on toggles, delivery date strip with cutoff awareness, 200-char card message, accordion (stems / substitution / delivery zones), curated "Pairs well with" strip, lilac journal tile (suppressed on sympathy), `Product` JSON-LD structured data, OG image, full bilingual metadata, and an "Add to bag" CTA that writes to the existing Zustand store and increments the nav cart counter with a success morph.
- Subscription PDP variant: cadence picker (Weekly/Biweekly per product) and "First delivery" labeling.
- Mega-menu in the desktop top nav with 6 category thumbs (mobile/tablet keeps the plain `Shop` link).
- Sitemap extended with all category and product URLs in both locales.
- Playwright e2e: shop hub (en + es), category filter+sort+clear, PDP add-to-bag flow, subscription cadence, sympathy variant.
- All taste-skill rules respected: no `h-screen` on new pages, transform/opacity-only motion, single accent (`rouge`) preserved (lilac strictly on the journal tile), no `Inter`, no emojis in code.

**Next:** Plan 3 — Cart drawer + checkout. Adds the global slide-in drawer (Radix Dialog already installed), full-page cart, 3-step checkout (Contact → Delivery → Payment) with `<PaymentStub />`, mock order confirmation page, and inquiry-form scaffolding for Plan 4.
