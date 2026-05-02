# Conversion tactics v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the six conversion tactics in `docs/superpowers/specs/2026-05-02-conversion-tactics-v1-design.md` (cutoff system, PDP social-proof, anchor pricing on 12 products, cart upsell strip, gift assurance bar, confirmation reciprocity card) without breaking the existing fully-shoppable funnel.

**Architecture:** All shared logic lives in `lib/conversion/` (pure helpers + one client hook). All visible UI lives in `components/conversion/`. Edits to existing files are minimal and additive. The i18n namespace `conversion.*` carries every new EN/ES string.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Framer Motion, next-intl, Zustand, Vitest + jsdom + React Testing Library, Playwright.

**Test conventions in this repo (read once):**
- Vitest unit tests live in `tests/unit/`; subdirectory `tests/unit/conversion/` for new tests.
- Components that consume `next-intl` mock it: `vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }))`.
- Server components are tested by importing and asserting on rendered output (React 19 + RTL handles them).
- Playwright e2e in `tests/e2e/`; new file `tests/e2e/conversion.spec.ts` consolidates the six tactics' end-to-end checks.
- `npm test` runs Vitest. `npm run e2e` runs Playwright. `npm run build` validates production build.

**Branching:** All work on a single feature branch `feat/conversion-tactics-v1`. Each task ends with a commit; the branch merges to `main` when §9 of the spec is satisfied.

---

## Step 0: Setup

### Task 0.1: Create feature branch

**Files:** none

- [ ] **Step 1: Verify clean working tree on the planning branch**

Run: `git status`
Expected: only the planning docs are touched; no other unstaged work.

- [ ] **Step 2: Create and switch to the feature branch**

Run: `git checkout -b feat/conversion-tactics-v1`
Expected: `Switched to a new branch 'feat/conversion-tactics-v1'`

- [ ] **Step 3: Confirm test baseline is green**

Run: `npm test -- --run`
Expected: all existing unit tests pass.

Run: `npm run build`
Expected: production build succeeds.

---

## Step 1: Foundations (`lib/conversion/`)

### Task 1.1: Create types

**Files:**
- Create: `lib/conversion/types.ts`

- [ ] **Step 1: Create the file with shared types**

```ts
// lib/conversion/types.ts
import type { Occasion } from "@/types/product";

export type CutoffStatus = "before" | "closing-soon" | "after";

export type CutoffSnapshot = {
  status: CutoffStatus;
  minutesRemaining: number;   // 0 when status === "after"
  cutoff: string;             // "HH:MM" — echoed back for trace
};

export type ReviewMatch = {
  matched: { id: string; author: string; quote: string; initials: string }[];
  aggregateRating: number;
  aggregateCount: number;     // global count (e.g. 127)
  matchedCount: number;       // count of reviews matching the occasion
  usedFallback: boolean;
  occasionLabelKey: Occasion | null;  // i18n key, not localized text
};

export type UpsellSuggestion = {
  productId: string;
  priceCents: number;
  title: string;              // already localized at component layer
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/conversion/types.ts
git commit -m "feat(conversion): add shared types for cutoff, reviews, upsell"
```

---

### Task 1.2: Cutoff helpers (TDD)

**Files:**
- Create: `lib/conversion/cutoff.ts`
- Create: `tests/unit/conversion/cutoff.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/conversion/cutoff.test.ts
import { describe, it, expect } from "vitest";
import { snapshotCutoff } from "@/lib/conversion/cutoff";

const CUTOFF = "14:00";

describe("snapshotCutoff", () => {
  it("returns status=before with correct minutesRemaining when well before cutoff", () => {
    const now = new Date("2026-05-01T12:13:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("before");
    expect(snap.minutesRemaining).toBe(107);
    expect(snap.cutoff).toBe(CUTOFF);
  });

  it("returns status=closing-soon when within 30 minutes of cutoff", () => {
    const now = new Date("2026-05-01T13:35:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("closing-soon");
    expect(snap.minutesRemaining).toBe(25);
  });

  it("returns status=after exactly at cutoff", () => {
    const now = new Date("2026-05-01T14:00:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("after");
    expect(snap.minutesRemaining).toBe(0);
  });

  it("returns status=after one minute past cutoff", () => {
    const now = new Date("2026-05-01T14:01:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("after");
    expect(snap.minutesRemaining).toBe(0);
  });

  it("returns status=closing-soon at the boundary (30 min before)", () => {
    const now = new Date("2026-05-01T13:30:00");
    const snap = snapshotCutoff(now, CUTOFF);
    expect(snap.status).toBe("closing-soon");
    expect(snap.minutesRemaining).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/conversion/cutoff.test.ts --run`
Expected: FAIL with "Cannot find module '@/lib/conversion/cutoff'".

- [ ] **Step 3: Implement the helper**

```ts
// lib/conversion/cutoff.ts
import { parseCutoff } from "@/lib/delivery";
import type { CutoffSnapshot, CutoffStatus } from "./types";

const CLOSING_SOON_MIN = 30;

export function snapshotCutoff(now: Date, cutoff: string): CutoffSnapshot {
  const { hour, minute } = parseCutoff(cutoff);
  const c = new Date(now);
  c.setHours(hour, minute, 0, 0);
  const diffMin = Math.floor((c.getTime() - now.getTime()) / 60000);
  let status: CutoffStatus;
  if (diffMin <= 0) status = "after";
  else if (diffMin <= CLOSING_SOON_MIN) status = "closing-soon";
  else status = "before";
  return {
    status,
    minutesRemaining: Math.max(0, diffMin),
    cutoff,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/conversion/cutoff.test.ts --run`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/conversion/cutoff.ts tests/unit/conversion/cutoff.test.ts
git commit -m "feat(conversion): add snapshotCutoff with status + minutesRemaining"
```

---

### Task 1.3: Cutoff hook (client)

**Files:**
- Create: `lib/conversion/use-cutoff.ts`

This is a thin wrapper around `snapshotCutoff` with `setInterval`. We do not unit-test it (jsdom + setInterval coverage is brittle); it is exercised via Playwright in Step 3.

- [ ] **Step 1: Implement the hook**

```ts
// lib/conversion/use-cutoff.ts
"use client";
import { useEffect, useState } from "react";
import { snapshotCutoff } from "./cutoff";
import type { CutoffSnapshot } from "./types";

export function useCutoff(cutoff: string): CutoffSnapshot | null {
  const [snap, setSnap] = useState<CutoffSnapshot | null>(null);
  useEffect(() => {
    const tick = () => setSnap(snapshotCutoff(new Date(), cutoff));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [cutoff]);
  return snap;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/conversion/use-cutoff.ts
git commit -m "feat(conversion): add useCutoff hook with 60s tick + hydration-safe null"
```

---

### Task 1.4: Reviews matcher (TDD)

**Files:**
- Create: `lib/conversion/reviews-match.ts`
- Create: `tests/unit/conversion/reviews-match.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/conversion/reviews-match.test.ts
import { describe, it, expect } from "vitest";
import { matchReviews } from "@/lib/conversion/reviews-match";
import { REVIEWS, REVIEWS_AGGREGATE } from "@/data/reviews";
import type { Occasion } from "@/types/product";

describe("matchReviews", () => {
  it("matches anniversary product against Boda reviews", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["anniversary" as Occasion]);
    expect(result.matchedCount).toBeGreaterThanOrEqual(2);
    expect(result.usedFallback).toBe(false);
    expect(result.occasionLabelKey).toBe("anniversary");
    expect(result.matched.length).toBe(2);
  });

  it("matches birthday product against Cumpleaños reviews", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["birthday" as Occasion]);
    expect(result.matchedCount).toBeGreaterThanOrEqual(1);
    expect(result.occasionLabelKey).toBe("birthday");
  });

  it("falls back to top-rated reviews when no match exists for sympathy", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["sympathy" as Occasion]);
    expect(result.usedFallback).toBe(true);
    expect(result.occasionLabelKey).toBeNull();
    expect(result.matched.length).toBe(2);
  });

  it("returns the global aggregate counts regardless of match", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["anniversary" as Occasion]);
    expect(result.aggregateRating).toBe(REVIEWS_AGGREGATE.rating);
    expect(result.aggregateCount).toBe(REVIEWS_AGGREGATE.total);
  });

  it("uses the first occasion when product has multiple", () => {
    const result = matchReviews(REVIEWS, REVIEWS_AGGREGATE, ["anniversary", "romance"] as Occasion[]);
    expect(result.occasionLabelKey).toBe("anniversary");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/conversion/reviews-match.test.ts --run`
Expected: FAIL with "Cannot find module '@/lib/conversion/reviews-match'".

- [ ] **Step 3: Implement the matcher**

```ts
// lib/conversion/reviews-match.ts
import type { Review, ReviewsAggregate } from "@/data/reviews";
import type { Occasion } from "@/types/product";
import type { ReviewMatch } from "./types";

// Map review.occasion strings (loose Spanish labels in REVIEWS) → typed Occasion.
// Boda → anniversary because Diva does not sell standalone wedding products
// (weddings are inquiry-only); anniversary is the closest celebratory retail
// category and the proof signal still applies.
const OCCASION_MAP: Record<string, Occasion> = {
  Boda: "anniversary",
  Cumpleaños: "birthday",
};

function quoteFor(text: { en: string; es: string }, max = 140): string {
  const s = text.en.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function matchReviews(
  reviews: Review[],
  aggregate: ReviewsAggregate,
  occasions: Occasion[],
): ReviewMatch {
  const targetOccasion = occasions[0] ?? null;

  const matchingReviews = targetOccasion
    ? reviews.filter((r) => {
        if (!r.occasion) return false;
        return OCCASION_MAP[r.occasion] === targetOccasion;
      })
    : [];

  const useFallback = matchingReviews.length < 2;
  const pool = useFallback ? reviews : matchingReviews;
  const picks = pool.slice(0, 2);

  return {
    matched: picks.map((r) => ({
      id: r.id,
      author: r.author,
      initials: r.initials,
      quote: quoteFor(r.text),
    })),
    aggregateRating: aggregate.rating,
    aggregateCount: aggregate.total,
    matchedCount: matchingReviews.length,
    usedFallback: useFallback,
    occasionLabelKey: useFallback ? null : targetOccasion,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/conversion/reviews-match.test.ts --run`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/conversion/reviews-match.ts tests/unit/conversion/reviews-match.test.ts
git commit -m "feat(conversion): add reviews matcher with occasion mapping + fallback"
```

---

### Task 1.5: Referral code derivation (TDD)

**Files:**
- Create: `lib/conversion/referral-code.ts`
- Create: `tests/unit/conversion/referral-code.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/conversion/referral-code.test.ts
import { describe, it, expect } from "vitest";
import { deriveReferralCode } from "@/lib/conversion/referral-code";

describe("deriveReferralCode", () => {
  it("uses last 6 alphanumeric chars uppercased with DIVA- prefix", () => {
    expect(deriveReferralCode("ord_a4f2c9")).toBe("DIVA-A4F2C9");
  });

  it("strips non-alphanumeric characters before slicing", () => {
    expect(deriveReferralCode("ord-2026-05-02-abc123")).toBe("DIVA-ABC123");
  });

  it("pads with X when input has fewer than 6 alphanumeric chars", () => {
    expect(deriveReferralCode("ab")).toBe("DIVA-XXXXAB");
  });

  it("is deterministic for the same input", () => {
    expect(deriveReferralCode("ord_xyz789")).toBe(deriveReferralCode("ord_xyz789"));
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/conversion/referral-code.test.ts --run`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the derivation**

```ts
// lib/conversion/referral-code.ts
export function deriveReferralCode(orderId: string): string {
  const cleaned = orderId.replace(/[^a-zA-Z0-9]/g, "");
  const tail = cleaned.slice(-6).padStart(6, "X").toUpperCase();
  return `DIVA-${tail}`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/conversion/referral-code.test.ts --run`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/conversion/referral-code.ts tests/unit/conversion/referral-code.test.ts
git commit -m "feat(conversion): add deterministic referral code derivation"
```

---

### Task 1.6: Gift-extras data + suggestion logic (TDD)

**Files:**
- Create: `data/gift-extras.ts`
- Create: `tests/unit/conversion/gift-extras.test.ts`

The four gift-extra products themselves are added in Task 6.2; this task adds only the suggestion logic, which references the IDs by string.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/conversion/gift-extras.test.ts
import { describe, it, expect } from "vitest";
import { suggestExtrasForCart, GIFT_EXTRA_IDS } from "@/data/gift-extras";
import type { CartLine } from "@/lib/cart-store";

const line = (productId: string, occasions: string[] = []): CartLine & { _occasions: string[] } => ({
  productId,
  variantId: "lush",
  addOnIds: [],
  qty: 1,
  _occasions: occasions,
});

// suggestExtrasForCart receives full Product objects via PRODUCTS lookup;
// for the unit test we provide a minimal fake products array via the second arg.
import type { Product } from "@/types/product";

const fakeProducts: Product[] = [
  { id: "rom1", slug: "rom1", title: { en: "", es: "" }, category: "arrangements",
    blurb: { en: "", es: "" }, description: { en: "", es: "" }, images: [], variants: [],
    tags: [], occasions: ["romance"], colorFamily: ["red"], active: true,
    seo: { title: { en: "", es: "" }, description: { en: "", es: "" } } },
  { id: "sym1", slug: "sym1", title: { en: "", es: "" }, category: "sympathy",
    blurb: { en: "", es: "" }, description: { en: "", es: "" }, images: [], variants: [],
    tags: [], occasions: ["sympathy"], colorFamily: ["white"], active: true,
    seo: { title: { en: "", es: "" }, description: { en: "", es: "" } } },
];

describe("suggestExtrasForCart", () => {
  it("suggests card, chocolates, vase for romance cart", () => {
    const result = suggestExtrasForCart(
      [{ productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 }],
      fakeProducts,
    );
    expect(result.slice(0, 3)).toEqual(["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"]);
  });

  it("suggests only card and vase for sympathy-only cart (no chocolates, no ribbon)", () => {
    const result = suggestExtrasForCart(
      [{ productId: "sym1", variantId: "lush", addOnIds: [], qty: 1 }],
      fakeProducts,
    );
    expect(result).toEqual(["x-card-premium", "x-vase-upgrade"]);
    expect(result).not.toContain("x-chocolates-mini");
    expect(result).not.toContain("x-ribbon-silk");
  });

  it("excludes extras already in cart", () => {
    const result = suggestExtrasForCart(
      [
        { productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 },
        { productId: "x-card-premium", variantId: "default", addOnIds: [], qty: 1 },
      ],
      fakeProducts,
    );
    expect(result).not.toContain("x-card-premium");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty array when all extras are in cart", () => {
    const lines = GIFT_EXTRA_IDS.map((id) => ({ productId: id, variantId: "default", addOnIds: [], qty: 1 }));
    lines.push({ productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 });
    expect(suggestExtrasForCart(lines, fakeProducts)).toEqual([]);
  });

  it("caps suggestions at 3", () => {
    const result = suggestExtrasForCart(
      [{ productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 }],
      fakeProducts,
    );
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("uses non-sympathy priority when cart is mixed", () => {
    const result = suggestExtrasForCart(
      [
        { productId: "rom1", variantId: "lush", addOnIds: [], qty: 1 },
        { productId: "sym1", variantId: "lush", addOnIds: [], qty: 1 },
      ],
      fakeProducts,
    );
    // Mixed cart: non-sympathy logic applies → can include chocolates
    expect(result).toContain("x-chocolates-mini");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/conversion/gift-extras.test.ts --run`
Expected: FAIL with "Cannot find module '@/data/gift-extras'".

- [ ] **Step 3: Implement the data module**

```ts
// data/gift-extras.ts
import type { CartLine } from "@/lib/cart-store";
import type { Occasion, Product } from "@/types/product";

export const GIFT_EXTRA_IDS = [
  "x-card-premium",
  "x-vase-upgrade",
  "x-ribbon-silk",
  "x-chocolates-mini",
] as const;

export type GiftExtraId = (typeof GIFT_EXTRA_IDS)[number];

const PRIORITY_BY_OCCASION: Record<Occasion, GiftExtraId[]> = {
  romance:        ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
  anniversary:    ["x-card-premium", "x-chocolates-mini", "x-vase-upgrade"],
  birthday:       ["x-chocolates-mini", "x-card-premium", "x-vase-upgrade"],
  sympathy:       ["x-card-premium", "x-vase-upgrade"],
  congrats:       ["x-card-premium", "x-chocolates-mini", "x-ribbon-silk"],
  "just-because": ["x-card-premium", "x-vase-upgrade", "x-chocolates-mini"],
};

export function suggestExtrasForCart(
  lines: CartLine[],
  allProducts: Product[],
): GiftExtraId[] {
  const inCart = new Set(lines.map((l) => l.productId));
  const productOccasions = lines
    .map((l) => allProducts.find((p) => p.id === l.productId))
    .filter((p): p is Product => Boolean(p))
    .flatMap((p) => p.occasions);

  if (productOccasions.length === 0) return [];

  const isSympathyOnly = productOccasions.every((o) => o === "sympathy");
  const occasionsToUse: Occasion[] = isSympathyOnly
    ? ["sympathy"]
    : productOccasions.filter((o) => o !== "sympathy");

  const seen = new Set<GiftExtraId>();
  const ordered: GiftExtraId[] = [];
  for (const occ of occasionsToUse) {
    for (const extra of PRIORITY_BY_OCCASION[occ] ?? []) {
      if (!seen.has(extra) && !inCart.has(extra)) {
        seen.add(extra);
        ordered.push(extra);
        if (ordered.length === 3) return ordered;
      }
    }
  }
  return ordered;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/conversion/gift-extras.test.ts --run`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add data/gift-extras.ts tests/unit/conversion/gift-extras.test.ts
git commit -m "feat(conversion): add gift-extras catalog ids + suggestion logic"
```

---

### Task 1.7: Events constants

**Files:**
- Create: `lib/conversion/events.ts`

- [ ] **Step 1: Implement the constants**

```ts
// lib/conversion/events.ts
export const CONV_EVENTS = {
  cutoff: { view: "cutoff_view", expired_in_session: "cutoff_expired_in_session" },
  reviews: { view: "pdp_reviews_view", expand: "pdp_reviews_expand" },
  variants: { default_changed: "variant_default_changed" },
  upsell: { view: "cart_upsell_view", add: "cart_upsell_add", dismiss: "cart_upsell_dismiss" },
  assurance: { view: "assurance_view" },
  reciprocity: { referral_copy: "referral_copy", subscription_click: "subscription_nudge_click" },
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/conversion/events.ts
git commit -m "feat(conversion): add CONV_EVENTS constant for v2 analytics wiring"
```

---

### Task 1.8: i18n keys (`conversion.*` namespace)

**Files:**
- Modify: `messages/en.json` (append `conversion` namespace at top level)
- Modify: `messages/es.json` (append `conversion` namespace at top level)

- [ ] **Step 1: Add the EN namespace**

In `messages/en.json`, add the following key at the same nesting level as the existing top-level keys (e.g., next to `cart`, `checkout`):

```json
"conversion": {
  "cutoff": {
    "before_label": "Same-day delivery",
    "before_body": "Order in the next {time} for delivery this afternoon.",
    "before_label_sym": "Earliest delivery",
    "before_body_sym": "We can deliver as early as this afternoon if you order in the next {time}.",
    "after_label": "Same-day closed",
    "after_body": "Next available: tomorrow afternoon. Order anytime.",
    "after_body_sym": "Earliest delivery is tomorrow afternoon.",
    "time_hours_minutes": "{h}h {m}m",
    "time_minutes": "{m}m",
    "placeholder": "—"
  },
  "reviews": {
    "rating_aggregate": "{rating} / {total} reviews",
    "rating_aggregate_matched": "{rating} from {count} {occasion} buyers",
    "read_all_cta": "Read all {count} reviews on Google",
    "anniversary": "anniversary",
    "birthday": "birthday",
    "sympathy": "sympathy",
    "romance": "romance",
    "congrats": "congratulations",
    "just_because": "just-because"
  },
  "variants": {
    "standard": "Standard",
    "lush": "Lush",
    "opulent": "Opulent",
    "most_popular": "Most popular"
  },
  "upsell": {
    "title": "Complete the gift",
    "added_label": "Added",
    "add_aria": "Add {item} for {price}"
  },
  "assurance": {
    "hand_built_title": "Hand-built today",
    "hand_built_body": "Cut this morning, arranged by Maky.",
    "redo_title": "Free re-do if it's our miss",
    "redo_body": "Anything not right on our end, we make it again.",
    "local_title": "Long Island florist since 2014",
    "local_body": "Real shop on Willis Ave. We deliver what we make."
  },
  "reciprocity": {
    "referral_eyebrow": "Refer a friend",
    "referral_title": "Send a friend $20.",
    "referral_body": "Get $20 toward your next arrangement when they order.",
    "referral_copy_cta": "Copy code",
    "referral_copied": "Copied!",
    "subscription_eyebrow": "Stay in bloom",
    "subscription_title": "Loved sending this?",
    "subscription_body": "Weekly arrangements at her door, hand-built fresh every Thursday. Pause anytime. Skip a week. Cancel in two clicks.",
    "subscription_cta": "See subscriptions"
  }
}
```

- [ ] **Step 2: Add the ES namespace**

In `messages/es.json`, mirror at the same level:

```json
"conversion": {
  "cutoff": {
    "before_label": "Entrega hoy",
    "before_body": "Pídelo en los próximos {time} y entra por su puerta esta tarde.",
    "before_label_sym": "Entrega más temprana",
    "before_body_sym": "Podemos entregar esta tarde si lo pides en los próximos {time}.",
    "after_label": "Same-day cerrado",
    "after_body": "Siguiente entrega: mañana por la tarde. Puedes ordenar a cualquier hora.",
    "after_body_sym": "La entrega más temprana es mañana por la tarde.",
    "time_hours_minutes": "{h}h {m}m",
    "time_minutes": "{m}m",
    "placeholder": "—"
  },
  "reviews": {
    "rating_aggregate": "{rating} / {total} reseñas",
    "rating_aggregate_matched": "{rating} de {count} compradores para {occasion}",
    "read_all_cta": "Lee las {count} reseñas en Google",
    "anniversary": "aniversario",
    "birthday": "cumpleaños",
    "sympathy": "condolencias",
    "romance": "romance",
    "congrats": "felicitaciones",
    "just_because": "porque sí"
  },
  "variants": {
    "standard": "Clásico",
    "lush": "Generoso",
    "opulent": "Opulento",
    "most_popular": "Más popular"
  },
  "upsell": {
    "title": "Completa el regalo",
    "added_label": "Agregado",
    "add_aria": "Agrega {item} por {price}"
  },
  "assurance": {
    "hand_built_title": "Hecho hoy a mano",
    "hand_built_body": "Cortado esta mañana, armado por Maky.",
    "redo_title": "Lo rehacemos gratis si fue error nuestro",
    "redo_body": "Si algo salió mal de nuestro lado, lo hacemos de nuevo.",
    "local_title": "Florista de Long Island desde 2014",
    "local_body": "Tienda real en Willis Ave. Entregamos lo que hacemos."
  },
  "reciprocity": {
    "referral_eyebrow": "Invita a un amigo",
    "referral_title": "Regala $20 a un amigo.",
    "referral_body": "Recibe $20 para tu próximo arreglo cuando lo use.",
    "referral_copy_cta": "Copiar código",
    "referral_copied": "¡Copiado!",
    "subscription_eyebrow": "Sigue floreciendo",
    "subscription_title": "¿Te gustó enviarlo?",
    "subscription_body": "Arreglos semanales en su puerta, hechos cada jueves. Pausa cuando quieras. Salta una semana. Cancela en dos clics.",
    "subscription_cta": "Ver suscripciones"
  }
}
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"`
Expected: no output (valid JSON).

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/es.json','utf8'))"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(conversion): add bilingual i18n keys for conversion namespace"
```

---

## Step 2: GiftAssuranceBar

### Task 2.1: Component (TDD)

**Files:**
- Create: `components/conversion/GiftAssuranceBar.tsx`
- Create: `tests/unit/GiftAssuranceBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/GiftAssuranceBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

describe("GiftAssuranceBar", () => {
  it("renders three assurance items in md size with title and body", () => {
    render(<GiftAssuranceBar size="md" surface="pdp" locale="en" />);
    expect(screen.getByText("hand_built_title")).toBeInTheDocument();
    expect(screen.getByText("hand_built_body")).toBeInTheDocument();
    expect(screen.getByText("redo_title")).toBeInTheDocument();
    expect(screen.getByText("local_title")).toBeInTheDocument();
  });

  it("hides body in sm size, keeps titles", () => {
    render(<GiftAssuranceBar size="sm" surface="cart" locale="en" />);
    expect(screen.getByText("hand_built_title")).toBeInTheDocument();
    expect(screen.queryByText("hand_built_body")).not.toBeInTheDocument();
  });

  it("emits surface in data attribute for analytics", () => {
    const { container } = render(<GiftAssuranceBar size="sm" surface="checkout" locale="en" />);
    expect(container.querySelector('[data-conv-event="assurance_view"][data-surface="checkout"]')).toBeTruthy();
  });

  it("uses ul/li semantic markup", () => {
    render(<GiftAssuranceBar size="md" surface="pdp" locale="en" />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/GiftAssuranceBar.test.tsx --run`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// components/conversion/GiftAssuranceBar.tsx
import { useTranslations } from "next-intl";
import { Leaf, ArrowsCounterClockwise, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";
import { CONV_EVENTS } from "@/lib/conversion/events";

type Size = "sm" | "md" | "lg";
type Surface = "pdp" | "cart" | "checkout";

type Props = {
  size?: Size;
  surface: Surface;
  locale: Locale;
};

export function GiftAssuranceBar({ size = "md", surface, locale: _locale }: Props) {
  const t = useTranslations("conversion.assurance");
  const showBody = size !== "sm";
  const items = [
    { Icon: Leaf, titleKey: "hand_built_title", bodyKey: "hand_built_body" },
    { Icon: ArrowsCounterClockwise, titleKey: "redo_title", bodyKey: "redo_body" },
    { Icon: MapPin, titleKey: "local_title", bodyKey: "local_body" },
  ] as const;

  return (
    <ul
      role="list"
      data-conv-event={CONV_EVENTS.assurance.view}
      data-surface={surface}
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-3",
        size === "sm" && "gap-2 md:gap-4",
      )}
    >
      {items.map(({ Icon, titleKey, bodyKey }) => (
        <li
          key={titleKey}
          className={cn(
            "flex items-start gap-3",
            size === "md" && "md:flex-col md:items-start md:text-left",
          )}
        >
          <Icon
            aria-hidden
            size={size === "sm" ? 16 : 20}
            className="text-rouge shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p
              className={cn(
                "font-display tracking-tight text-ink",
                size === "sm" ? "text-sm leading-snug" : "text-base leading-tight",
              )}
            >
              {t(titleKey)}
            </p>
            {showBody && (
              <p className="mt-1 text-sm text-ink/70 leading-snug">{t(bodyKey)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/GiftAssuranceBar.test.tsx --run`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/conversion/GiftAssuranceBar.tsx tests/unit/GiftAssuranceBar.test.tsx
git commit -m "feat(conversion): add GiftAssuranceBar with sm/md sizes + surface attr"
```

---

### Task 2.2: Mount on PDP

**Files:**
- Modify: `app/[locale]/product/[slug]/page.tsx`

- [ ] **Step 1: Locate the configurator render**

Read `app/[locale]/product/[slug]/page.tsx` and find the `<PdpConfigurator ... />` JSX.

- [ ] **Step 2: Insert the bar below the configurator**

Add the import at the top of the file:

```tsx
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";
```

Immediately after the `<PdpConfigurator />` JSX (still inside the same right-column wrapper that holds the configurator), add:

```tsx
<div className="mt-8 border-t border-ink/10 pt-6">
  <GiftAssuranceBar size="md" surface="pdp" locale={locale} />
</div>
```

- [ ] **Step 3: Run the build to verify no type errors**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke test in dev**

Run: `npm run dev`
Open: `http://localhost:3000/en/product/a-thousand-heartbeats`
Verify: three icons with titles + bodies appear below the configurator.
Stop the dev server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/product/[slug]/page.tsx
git commit -m "feat(conversion): mount GiftAssuranceBar size=md on PDP"
```

---

## Step 3: Cutoff system

### Task 3.1: CutoffCountdown component (PDP variant) — TDD

**Files:**
- Create: `components/conversion/CutoffCountdown.tsx`
- Create: `tests/unit/CutoffCountdown.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/CutoffCountdown.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CutoffCountdown } from "@/components/conversion/CutoffCountdown";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string, vars?: Record<string, unknown>) => {
    if (vars) return `${ns ?? ""}.${k}|${JSON.stringify(vars)}`;
    return `${ns ?? ""}.${k}`;
  },
}));

describe("CutoffCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders placeholder on first paint (no client snapshot yet)", () => {
    vi.setSystemTime(new Date("2026-05-01T12:13:00"));
    render(<CutoffCountdown cutoff="14:00" tone="default" locale="en" />);
    expect(screen.getByText(/conversion\.cutoff\.before_label/)).toBeInTheDocument();
    expect(screen.getByText(/conversion\.cutoff\.placeholder/)).toBeInTheDocument();
  });

  it("renders before-cutoff body after hydration tick", async () => {
    vi.setSystemTime(new Date("2026-05-01T12:13:00"));
    render(<CutoffCountdown cutoff="14:00" tone="default" locale="en" />);
    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText(/conversion\.cutoff\.before_body/)).toBeInTheDocument();
    expect(screen.getByText(/"h":1,"m":47/)).toBeInTheDocument();
  });

  it("renders sympathy variant when tone=sympathy", async () => {
    vi.setSystemTime(new Date("2026-05-01T12:13:00"));
    render(<CutoffCountdown cutoff="14:00" tone="sympathy" locale="en" />);
    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText(/conversion\.cutoff\.before_body_sym/)).toBeInTheDocument();
  });

  it("renders after-cutoff copy when past cutoff", async () => {
    vi.setSystemTime(new Date("2026-05-01T15:00:00"));
    render(<CutoffCountdown cutoff="14:00" tone="default" locale="en" />);
    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText(/conversion\.cutoff\.after_label/)).toBeInTheDocument();
    expect(screen.getByText(/conversion\.cutoff\.after_body/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/CutoffCountdown.test.tsx --run`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// components/conversion/CutoffCountdown.tsx
"use client";
import { useTranslations } from "next-intl";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Locale } from "@/types/locale";

type Props = {
  cutoff: string;          // "HH:MM"
  tone?: "default" | "sympathy";
  locale: Locale;
};

export function CutoffCountdown({ cutoff, tone = "default", locale: _locale }: Props) {
  const t = useTranslations("conversion.cutoff");
  const snap = useCutoff(cutoff);

  const sym = tone === "sympathy";
  const isAfter = snap?.status === "after";

  const labelKey = isAfter ? "after_label" : sym ? "before_label_sym" : "before_label";
  const bodyKey = isAfter
    ? sym ? "after_body_sym" : "after_body"
    : sym ? "before_body_sym" : "before_body";

  const time = renderTime(snap?.minutesRemaining, t);

  return (
    <div
      data-conv-event={CONV_EVENTS.cutoff.view}
      data-cutoff-status={snap?.status ?? "loading"}
      className="flex flex-col gap-1 rounded-xl border border-ink/10 bg-bone/60 px-4 py-3"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {t(labelKey)}
      </p>
      <p aria-live="polite" className="text-sm text-ink/85 leading-snug">
        {!snap ? t("placeholder") : isAfter ? t(bodyKey) : t(bodyKey, { time })}
      </p>
    </div>
  );
}

function renderTime(minutes: number | undefined, t: ReturnType<typeof useTranslations>): string {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("time_hours_minutes", { h, m });
  return t("time_minutes", { m });
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/CutoffCountdown.test.tsx --run`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/conversion/CutoffCountdown.tsx tests/unit/CutoffCountdown.test.tsx
git commit -m "feat(conversion): add CutoffCountdown with hydration-safe placeholder"
```

---

### Task 3.2: CutoffPill (compact variant for cart drawer header)

**Files:**
- Create: `components/conversion/CutoffPill.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/conversion/CutoffPill.tsx
"use client";
import { useTranslations } from "next-intl";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Locale } from "@/types/locale";

type Props = {
  cutoff: string;
  locale: Locale;
};

export function CutoffPill({ cutoff, locale: _locale }: Props) {
  const t = useTranslations("conversion.cutoff");
  const snap = useCutoff(cutoff);
  if (!snap) return null;

  const isAfter = snap.status === "after";
  const time = renderTime(snap.minutesRemaining, t);

  return (
    <span
      data-conv-event={CONV_EVENTS.cutoff.view}
      data-cutoff-status={snap.status}
      className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-bone/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/85"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rouge" />
      {isAfter ? t("after_label") : t("before_body", { time })}
    </span>
  );
}

function renderTime(minutes: number, t: ReturnType<typeof useTranslations>): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("time_hours_minutes", { h, m });
  return t("time_minutes", { m });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/conversion/CutoffPill.tsx
git commit -m "feat(conversion): add CutoffPill compact variant for nav/drawer"
```

---

### Task 3.3: CutoffReminderRow (inline variant for /cart and OrderSummarySticky)

**Files:**
- Create: `components/conversion/CutoffReminderRow.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// components/conversion/CutoffReminderRow.tsx
"use client";
import { useTranslations } from "next-intl";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Locale } from "@/types/locale";

type Props = {
  cutoff: string;
  locale: Locale;
};

export function CutoffReminderRow({ cutoff, locale: _locale }: Props) {
  const t = useTranslations("conversion.cutoff");
  const snap = useCutoff(cutoff);

  const isAfter = snap?.status === "after";
  const time = snap ? renderTime(snap.minutesRemaining, t) : "";

  return (
    <div
      data-conv-event={CONV_EVENTS.cutoff.view}
      data-cutoff-status={snap?.status ?? "loading"}
      className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
        {isAfter ? t("after_label") : t("before_label")}
      </span>
      <span aria-live="polite" className="text-xs text-ink/80 text-right">
        {!snap ? t("placeholder") : isAfter ? t("after_body") : t("before_body", { time })}
      </span>
    </div>
  );
}

function renderTime(minutes: number, t: ReturnType<typeof useTranslations>): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return t("time_hours_minutes", { h, m });
  return t("time_minutes", { m });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/conversion/CutoffReminderRow.tsx
git commit -m "feat(conversion): add CutoffReminderRow inline variant"
```

---

### Task 3.4: Mount cutoff on PDP

**Files:**
- Modify: `app/[locale]/product/[slug]/page.tsx`
- Modify: `components/product/PdpConfigurator.tsx` (only to receive `tone` if not already)

- [ ] **Step 1: Determine cutoff value**

Read `data/site.ts`. If `SITE.cutoff` does not exist, add it:

```ts
// in data/site.ts, append to the SITE object
cutoff: "14:00",
```

- [ ] **Step 2: Mount CutoffCountdown above the configurator on the PDP page**

In `app/[locale]/product/[slug]/page.tsx`, add the import:

```tsx
import { CutoffCountdown } from "@/components/conversion/CutoffCountdown";
import { SITE } from "@/data/site";
```

(SITE may already be imported; do not duplicate.)

Inside the right column, immediately above `<PdpConfigurator />`, render:

```tsx
<div className="mt-6">
  <CutoffCountdown
    cutoff={SITE.cutoff}
    tone={isSympathy ? "sympathy" : "default"}
    locale={locale}
  />
</div>
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke test**

Run: `npm run dev`
Open: `http://localhost:3000/en/product/a-thousand-heartbeats`
Verify: cutoff countdown appears above the configurator with a real time value.
Open: `http://localhost:3000/en/product/angels-touch` (sympathy)
Verify: sympathy copy renders.
Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/product/[slug]/page.tsx data/site.ts
git commit -m "feat(conversion): mount CutoffCountdown on PDP with sympathy tone variant"
```

---

### Task 3.5: Mount cutoff in cart drawer + /cart + checkout

**Files:**
- Modify: `components/cart/CartDrawer.tsx`
- Modify: `components/cart/CartPageList.tsx` (or the `/cart` page wrapper, whichever owns the layout)
- Modify: `components/checkout/OrderSummarySticky.tsx`

- [ ] **Step 1: Add CutoffPill to CartDrawer header**

In `components/cart/CartDrawer.tsx`:

Add import:
```tsx
import { CutoffPill } from "@/components/conversion/CutoffPill";
import { SITE } from "@/data/site";
```

In the `<header>` element of the drawer, replace the existing `<div className="flex items-center gap-3">` with one that includes the pill *before* the existing controls:

```tsx
<header className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
  <div className="flex items-center gap-3">
    <p className="font-display text-xl text-ink">{t("title")}</p>
    <CutoffPill cutoff={SITE.cutoff} locale={locale} />
  </div>
  <div className="flex items-center gap-3">
    {/* existing view_full link + close button */}
  </div>
</header>
```

- [ ] **Step 2: Add CutoffReminderRow to /cart page**

Identify the `/cart` page entry (`app/[locale]/cart/page.tsx`). Find the wrapper that renders `CartPageList` + `CartSummary`. Insert above:

```tsx
import { CutoffReminderRow } from "@/components/conversion/CutoffReminderRow";
import { SITE } from "@/data/site";

// inside the JSX, above the cart list:
<CutoffReminderRow cutoff={SITE.cutoff} locale={locale} />
```

- [ ] **Step 3: Add CutoffReminderRow to OrderSummarySticky**

In `components/checkout/OrderSummarySticky.tsx`:

Add imports:
```tsx
import { CutoffReminderRow } from "@/components/conversion/CutoffReminderRow";
import { SITE } from "@/data/site";
```

Inside the `<aside>`, as the first child immediately after the title `<p>`:
```tsx
<CutoffReminderRow cutoff={SITE.cutoff} locale={locale} />
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke test**

Run: `npm run dev`
- Open `http://localhost:3000/en/product/a-thousand-heartbeats`, add to bag, open drawer → pill visible in header.
- Click "View full bag" → reminder row above list.
- Click "Continue to checkout" → reminder row at top of order summary.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add components/cart/CartDrawer.tsx app/[locale]/cart/page.tsx components/checkout/OrderSummarySticky.tsx
git commit -m "feat(conversion): mount cutoff variants in drawer, /cart, and checkout"
```

---

### Task 3.6: Add GiftAssuranceBar to drawer + checkout sticky

**Files:**
- Modify: `components/cart/CartDrawer.tsx`
- Modify: `components/checkout/OrderSummarySticky.tsx`

- [ ] **Step 1: Mount in cart drawer above CartSummary**

In `CartDrawer.tsx`, immediately above the `<CartSummary ... />` line in the non-empty branch:

Add import:
```tsx
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";
```

Render:
```tsx
<div className="px-5 pt-3">
  <GiftAssuranceBar size="sm" surface="cart" locale={locale} />
</div>
<CartSummary subtotalCents={subtotal} locale={locale} onCheckout={close} />
```

- [ ] **Step 2: Mount in OrderSummarySticky at the bottom**

In `OrderSummarySticky.tsx`, after the closing `</dl>`:

Add import:
```tsx
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";
```

Render after the `</dl>`:
```tsx
<div className="border-t border-ink/10 pt-4">
  <GiftAssuranceBar size="sm" surface="checkout" locale={locale} />
</div>
```

- [ ] **Step 3: Verify build + smoke test**

Run: `npx tsc --noEmit && npm run dev`
- Drawer: assurance bar above checkout CTA.
- Checkout: assurance bar below totals.
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/cart/CartDrawer.tsx components/checkout/OrderSummarySticky.tsx
git commit -m "feat(conversion): mount GiftAssuranceBar size=sm in drawer + checkout"
```

---

## Step 4: PDP social-proof block

### Task 4.1: PdpReviewsBlock component (TDD)

**Files:**
- Create: `components/conversion/PdpReviewsBlock.tsx`
- Create: `tests/unit/PdpReviewsBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/PdpReviewsBlock.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PdpReviewsBlock } from "@/components/conversion/PdpReviewsBlock";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string, vars?: Record<string, unknown>) => {
    if (vars) return `${ns ?? ""}.${k}|${JSON.stringify(vars)}`;
    return `${ns ?? ""}.${k}`;
  },
}));

const baseProduct = (overrides: Partial<Product>): Product => ({
  id: "p1",
  slug: "p1",
  title: { en: "P1", es: "P1" },
  category: "arrangements",
  blurb: { en: "", es: "" },
  description: { en: "", es: "" },
  images: [],
  variants: [],
  tags: [],
  occasions: [],
  colorFamily: ["red"],
  active: true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...overrides,
});

describe("PdpReviewsBlock", () => {
  it("renders the global aggregate when product has no occasion", () => {
    render(<PdpReviewsBlock product={baseProduct({ occasions: [] })} locale="en" />);
    expect(screen.getByText(/conversion\.reviews\.rating_aggregate\|/)).toBeInTheDocument();
  });

  it("renders the matched aggregate when product has anniversary occasion", () => {
    render(<PdpReviewsBlock product={baseProduct({ occasions: ["anniversary"] })} locale="en" />);
    expect(screen.getByText(/conversion\.reviews\.rating_aggregate_matched\|/)).toBeInTheDocument();
  });

  it("renders two review quotes", () => {
    const { container } = render(<PdpReviewsBlock product={baseProduct({ occasions: ["anniversary"] })} locale="en" />);
    expect(container.querySelectorAll("blockquote").length).toBe(2);
  });

  it("includes a Read all reviews link to the Google place URL", () => {
    render(<PdpReviewsBlock product={baseProduct({ occasions: [] })} locale="en" />);
    const link = screen.getByRole("link", { name: /read_all_cta/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("google.com/maps"));
    expect(link).toHaveAttribute("target", "_blank");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/PdpReviewsBlock.test.tsx --run`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// components/conversion/PdpReviewsBlock.tsx
import { useTranslations } from "next-intl";
import { REVIEWS, REVIEWS_AGGREGATE } from "@/data/reviews";
import { matchReviews } from "@/lib/conversion/reviews-match";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";

type Props = {
  product: Product;
  locale: Locale;
};

export function PdpReviewsBlock({ product, locale: _locale }: Props) {
  const t = useTranslations("conversion.reviews");
  const match = matchReviews(REVIEWS, REVIEWS_AGGREGATE, product.occasions);

  const aggregateText = match.usedFallback || !match.occasionLabelKey
    ? t("rating_aggregate", { rating: match.aggregateRating, total: match.aggregateCount })
    : t("rating_aggregate_matched", {
        rating: match.aggregateRating,
        count: match.matchedCount,
        occasion: t(match.occasionLabelKey),
      });

  return (
    <section
      data-conv-event={CONV_EVENTS.reviews.view}
      aria-label="Customer reviews"
      className="rounded-2xl border border-ink/10 bg-bone/40 p-5"
    >
      <header className="flex items-baseline gap-3">
        <span aria-label={`Rated ${match.aggregateRating} out of 5 stars`} className="text-rouge tracking-widest">
          ★★★★★
        </span>
        <p className="font-mono text-xs text-ink/80">{aggregateText}</p>
      </header>
      <ul className="mt-4 space-y-3">
        {match.matched.map((r) => (
          <li key={r.id}>
            <blockquote className="text-sm text-ink/85 italic leading-snug">
              &ldquo;{r.quote}&rdquo;
              <cite className="not-italic block mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mute-500">
                — {r.author}
              </cite>
            </blockquote>
          </li>
        ))}
      </ul>
      <a
        href={REVIEWS_AGGREGATE.placeUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:underline"
      >
        {t("read_all_cta", { count: match.aggregateCount })}
      </a>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/PdpReviewsBlock.test.tsx --run`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/conversion/PdpReviewsBlock.tsx tests/unit/PdpReviewsBlock.test.tsx
git commit -m "feat(conversion): add PdpReviewsBlock with occasion-matched aggregate"
```

---

### Task 4.2: Mount PdpReviewsBlock on PDP

**Files:**
- Modify: `app/[locale]/product/[slug]/page.tsx`

- [ ] **Step 1: Insert above the configurator (above CutoffCountdown)**

Add import:
```tsx
import { PdpReviewsBlock } from "@/components/conversion/PdpReviewsBlock";
```

Inside the right column, before the `<CutoffCountdown />` block:

```tsx
<div className="mt-6">
  <PdpReviewsBlock product={product} locale={locale} />
</div>
```

- [ ] **Step 2: Verify build + smoke test**

Run: `npx tsc --noEmit && npm run dev`
Open: `http://localhost:3000/en/product/a-thousand-heartbeats` (anniversary)
Verify: review block renders with matched-anniversary copy and two quotes.
Open: `http://localhost:3000/en/product/angels-touch` (sympathy, no matches)
Verify: fallback aggregate copy.
Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/product/[slug]/page.tsx
git commit -m "feat(conversion): mount PdpReviewsBlock above PDP configurator"
```

---

## Step 5: Anchor pricing on 12 products

### Task 5.1: Extend ProductVariant type with optional subtitle

**Files:**
- Modify: `types/product.ts`

- [ ] **Step 1: Add optional subtitle field**

Locate the `ProductVariant` type and add `subtitle?: Localized`:

```ts
export type ProductVariant = {
  id: string;
  label: Localized;
  priceCents: number;
  subtitle?: Localized;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors (back-compat addition).

- [ ] **Step 3: Commit**

```bash
git add types/product.ts
git commit -m "feat(conversion): add optional subtitle to ProductVariant"
```

---

### Task 5.2: Update PdpConfigurator default to "lush"

**Files:**
- Modify: `components/product/PdpConfigurator.tsx`

- [ ] **Step 1: Replace the variant default selection**

Find the line:
```tsx
const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
```

Replace with:
```tsx
const defaultVariantId = useMemo(() => {
  const middle = product.variants.find((v) => v.id === "lush");
  return middle?.id ?? product.variants[0]?.id ?? "";
}, [product]);
const [variantId, setVariantId] = useState(defaultVariantId);
```

(`useMemo` is already imported in this file.)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/product/PdpConfigurator.tsx
git commit -m "feat(conversion): default to lush variant when present"
```

---

### Task 5.3: Update VariantChips with "Most popular" eyebrow + subtitle

**Files:**
- Modify: `components/product/VariantChips.tsx`

- [ ] **Step 1: Read the current component**

Run: `cat components/product/VariantChips.tsx`
Note the current structure.

- [ ] **Step 2: Add "Most popular" badge over the lush variant + subtitle below each chip**

Add `useTranslations` import if not present:
```tsx
import { useTranslations } from "next-intl";
```

Inside the component body:
```tsx
const tConv = useTranslations("conversion.variants");
```

For each chip, wrap it in a div that renders:
- An eyebrow `<span>` containing `tConv("most_popular")` *only when* `variant.id === "lush"` AND `product.variants.length > 1`
- The existing chip
- A `<small>` containing `variant.subtitle?.[locale]` if defined

Final chip block (replace the existing chip render with):
```tsx
<div key={variant.id} className="flex flex-col gap-1">
  {variant.id === "lush" && product.variants.length > 1 && (
    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-rouge">
      {tConv("most_popular")}
    </span>
  )}
  <button
    type="button"
    aria-pressed={variant.id === value}
    onClick={() => onChange(variant.id)}
    className={/* existing chip className */}
  >
    {variant.label[locale]}
    <span className={/* existing price span className */}>
      {formatMoneyCents(variant.priceCents, locale)}
    </span>
  </button>
  {variant.subtitle && (
    <small className="text-[11px] text-ink/60 leading-snug">
      {variant.subtitle[locale]}
    </small>
  )}
</div>
```

(Keep the existing chip className and price formatting intact — only the wrapping `<div>`, eyebrow, and `<small>` are new.)

- [ ] **Step 3: Verify build + smoke test**

Run: `npx tsc --noEmit && npm run dev`
Open any current PDP — variant chips render unchanged (no products have anchor variants yet).
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/product/VariantChips.tsx
git commit -m "feat(conversion): add Most popular eyebrow + subtitle to VariantChips"
```

---

### Task 5.4: Apply anchor pricing to the 12 products

**Files:**
- Modify: `data/products.ts` (12 product entries)

The 12 products and their identifiers (per spec §7.2):

| # | Slug | ID |
|---|------|----|
| 1 | a-thousand-heartbeats | p-arr-m01 |
| 2 | dozen-roses-bouquet | p-bou-m01 |
| 3 | hundred-roses-vase | p-arr-m02 |
| 4 | sunburst-garden | p-bou-m02 |
| 5 | rainforest-rhapsody | p-arr-m03 |
| 6 | designers-choice | p-gif-m01 |
| 7 | velvet-sun | p-bou-m03 |
| 8 | katsobad | p-bou-m04 |
| 9 | abundant-table | p-arr-b1-01 |
| 10 | all-my-love | p-bou-b1-01 |
| 11 | blush-enchantment | p-bou-b1-02 |
| 12 | cottage-garden-charm | p-arr-b1-07 |

**Pricing rule:** for each product, take the existing single-variant `priceCents` as the new `lush` price. Compute `standard = round(lush × 0.75 / 100) × 100` and `opulent = round(lush × 1.35 / 100) × 100` (rounded to whole dollars). Maky tunes per-product later via direct edit.

**Subtitle rule (placeholder for Maky):** every Standard gets `{ en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" }`. Every Opulent gets `{ en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" }`. Lush gets no subtitle.

- [ ] **Step 1: Apply anchor variants to product 1 (`p-arr-m01`)**

Find the `variants` array of `p-arr-m01` (currently `[{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 25500 }]`). Replace with:

```ts
variants: [
  {
    id: "standard",
    label: { en: "Standard", es: "Clásico" },
    priceCents: 19000,
    subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" },
  },
  {
    id: "lush",
    label: { en: "Lush", es: "Generoso" },
    priceCents: 25500,
  },
  {
    id: "opulent",
    label: { en: "Opulent", es: "Opulento" },
    priceCents: 34500,
    subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" },
  },
],
```

- [ ] **Step 2: Repeat the pattern for products 2–12**

For each of the remaining 11 products, replace the single-variant array with the same three-variant structure, using the existing `priceCents` as `lush` and computing `standard` (×0.75 → rounded to whole dollars) and `opulent` (×1.35 → rounded to whole dollars).

After this step, search to confirm no surprises: `grep -n 'variants:' data/products.ts` — verify exactly 12 products now have 3-entry variant arrays. Other products are unchanged.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run all unit tests**

Run: `npm test -- --run`
Expected: all tests pass (existing tests do not assume single variants).

- [ ] **Step 5: Smoke test**

Run: `npm run dev`
Open: `http://localhost:3000/en/product/a-thousand-heartbeats`
Verify: three chips appear; Lush is selected by default; "Most popular" eyebrow above Lush; subtitles below Standard and Opulent. Click Standard, price updates. Add to bag works.
Open: `http://localhost:3000/en/shop`
Verify: ProductCard "From" prices for the 12 products now show the lower Standard price.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add data/products.ts
git commit -m "feat(conversion): apply Standard/Lush/Opulent anchor pricing to 12 products"
```

---

## Step 6: Cart upsell strip + gift-extra products

### Task 6.1: Add `giftExtra` flag to Product type

**Files:**
- Modify: `types/product.ts`

- [ ] **Step 1: Add the optional flag**

In the `Product` type, add:

```ts
export type Product = {
  // ...existing fields
  giftExtra?: boolean;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/product.ts
git commit -m "feat(conversion): add optional giftExtra flag to Product"
```

---

### Task 6.2: Add four gift-extra products to data/products.ts

**Files:**
- Modify: `data/products.ts`

- [ ] **Step 1: Append the four products at the end of the PRODUCTS array**

```ts
{
  id: "x-card-premium",
  slug: "premium-card",
  title: { en: "Premium handwritten card", es: "Tarjeta escrita a mano premium" },
  category: "gifts",
  giftExtra: true,
  blurb: {
    en: "A note in Maky's hand, on heavy stock.",
    es: "Una nota escrita por Maky, en papel de gramaje alto.",
  },
  description: {
    en: "Hand-lettered by Maky on heavyweight cotton stock. Slipped into the arrangement at delivery.",
    es: "Escrita a mano por Maky en papel de algodón de alto gramaje. Se coloca en el arreglo al entregar.",
  },
  images: [{
    src: "/products/x-card-premium.jpg",
    alt: { en: "Handwritten card", es: "Tarjeta escrita a mano" },
    aspect: "1/1",
  }],
  variants: [{ id: "default", label: { en: "Premium card", es: "Tarjeta premium" }, priceCents: 500 }],
  tags: ["same-day"],
  occasions: ["just-because"],
  colorFamily: ["white"],
  active: true,
  seo: {
    title: { en: "Premium handwritten card | Diva Flowers", es: "Tarjeta escrita a mano premium | Diva Flowers" },
    description: { en: "Hand-lettered note added to your arrangement.", es: "Nota escrita a mano agregada a tu arreglo." },
  },
},
{
  id: "x-vase-upgrade",
  slug: "glass-vase-upgrade",
  title: { en: "Glass vase upgrade", es: "Mejora a jarrón de vidrio" },
  category: "gifts",
  giftExtra: true,
  blurb: {
    en: "Swap the standard vessel for hand-cut clear glass.",
    es: "Cambia el recipiente estándar por vidrio cortado a mano.",
  },
  description: {
    en: "Heavy clear-glass vase, hand-cut, sized to the arrangement.",
    es: "Jarrón pesado de vidrio transparente, cortado a mano, dimensionado al arreglo.",
  },
  images: [{
    src: "/products/x-vase-upgrade.jpg",
    alt: { en: "Glass vase", es: "Jarrón de vidrio" },
    aspect: "1/1",
  }],
  variants: [{ id: "default", label: { en: "Glass vase", es: "Jarrón de vidrio" }, priceCents: 1500 }],
  tags: ["same-day"],
  occasions: ["just-because"],
  colorFamily: ["white"],
  active: true,
  seo: {
    title: { en: "Glass vase upgrade | Diva Flowers", es: "Mejora a jarrón de vidrio | Diva Flowers" },
    description: { en: "Hand-cut clear glass vase upgrade.", es: "Mejora a jarrón de vidrio cortado a mano." },
  },
},
{
  id: "x-ribbon-silk",
  slug: "silk-ribbon",
  title: { en: "Silk ribbon", es: "Listón de seda" },
  category: "gifts",
  giftExtra: true,
  blurb: {
    en: "Hand-tied silk ribbon, color matched to the bouquet.",
    es: "Listón de seda atado a mano, combinado con el ramo.",
  },
  description: {
    en: "Sand-washed silk ribbon, tied at the stem by Maky.",
    es: "Listón de seda lavada a mano, atado al tallo por Maky.",
  },
  images: [{
    src: "/products/x-ribbon-silk.jpg",
    alt: { en: "Silk ribbon", es: "Listón de seda" },
    aspect: "1/1",
  }],
  variants: [{ id: "default", label: { en: "Silk ribbon", es: "Listón de seda" }, priceCents: 600 }],
  tags: ["same-day"],
  occasions: ["just-because"],
  colorFamily: ["white"],
  active: true,
  seo: {
    title: { en: "Silk ribbon | Diva Flowers", es: "Listón de seda | Diva Flowers" },
    description: { en: "Hand-tied silk ribbon for your arrangement.", es: "Listón de seda atado a mano para tu arreglo." },
  },
},
{
  id: "x-chocolates-mini",
  slug: "mini-chocolates",
  title: { en: "Mini chocolates (4 pieces)", es: "Mini chocolates (4 piezas)" },
  category: "gifts",
  giftExtra: true,
  blurb: {
    en: "Four single-origin chocolates from a Long Island chocolatier.",
    es: "Cuatro chocolates de origen único de un chocolatero de Long Island.",
  },
  description: {
    en: "Four hand-selected chocolates from our local chocolatier, packed alongside the arrangement.",
    es: "Cuatro chocolates seleccionados a mano de nuestro chocolatero local, empacados con el arreglo.",
  },
  images: [{
    src: "/products/x-chocolates-mini.jpg",
    alt: { en: "Mini chocolates", es: "Mini chocolates" },
    aspect: "1/1",
  }],
  variants: [{ id: "default", label: { en: "Mini chocolates", es: "Mini chocolates" }, priceCents: 800 }],
  tags: ["same-day"],
  occasions: ["just-because"],
  colorFamily: ["white"],
  active: true,
  seo: {
    title: { en: "Mini chocolates | Diva Flowers", es: "Mini chocolates | Diva Flowers" },
    description: { en: "Four-piece chocolate add-on from a Long Island chocolatier.", es: "Caja de cuatro chocolates de un chocolatero de Long Island." },
  },
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add data/products.ts
git commit -m "feat(conversion): add four gift-extra products (card, vase, ribbon, chocolates)"
```

---

### Task 6.3: Filter gift-extras out of catalog browsing

**Files:**
- Modify: any file calling `PRODUCTS.filter(...)` or `PRODUCTS.map(...)` for catalog display.

- [ ] **Step 1: Audit call sites**

Run: `grep -rn "PRODUCTS\.\(filter\|map\|find\)" app/ components/ data/ lib/`

Note every call site. Expected hits include `app/[locale]/shop/page.tsx`, category pages, sitemap helpers, and `data/product-helpers.ts`.

- [ ] **Step 2: Add gift-extra exclusion to each catalog-browsing call site**

For each catalog-listing call (anything that surfaces products to the user as part of `/shop` or category navigation), add `&& !p.giftExtra` to the filter predicate. For example, in `app/[locale]/shop/page.tsx` if the line is:

```tsx
const items = PRODUCTS.filter((p) => p.active && (!category || p.category === category));
```

Change to:

```tsx
const items = PRODUCTS.filter((p) => p.active && !p.giftExtra && (!category || p.category === category));
```

For `data/product-helpers.ts`, add `getShoppableProducts()`:

```ts
export function getShoppableProducts(): Product[] {
  return PRODUCTS.filter((p) => p.active && !p.giftExtra);
}
```

For `getPairsWith(product)`, add the same exclusion to the inner filter.

For `generateStaticParams` in `app/[locale]/product/[slug]/page.tsx`, leave it untouched — gift-extras have product pages too (they're real products), they just shouldn't appear in catalog browsing.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Smoke test**

Run: `npm run dev`
Open: `http://localhost:3000/en/shop`
Verify: gift-extras (Premium card, Vase upgrade, etc.) do NOT appear.
Open: `http://localhost:3000/en/product/premium-card`
Verify: the gift-extra's own PDP renders (it's still a valid route).
Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/ components/ data/ lib/
git commit -m "feat(conversion): exclude gift-extras from catalog browsing"
```

---

### Task 6.4: CartUpsellStrip component (TDD)

**Files:**
- Create: `components/conversion/CartUpsellStrip.tsx`
- Create: `tests/unit/CartUpsellStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/CartUpsellStrip.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartUpsellStrip } from "@/components/conversion/CartUpsellStrip";
import { useCartStore } from "@/lib/cart-store";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, vars?: Record<string, unknown>) => vars ? `${k}|${JSON.stringify(vars)}` : k,
}));

beforeEach(() => {
  useCartStore.setState({ lines: [] });
});

describe("CartUpsellStrip", () => {
  it("renders nothing when cart is empty", () => {
    const { container } = render(<CartUpsellStrip locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders chips for suggested extras when cart has a romance product", () => {
    useCartStore.setState({
      lines: [{ productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
    });
    render(<CartUpsellStrip locale="en" />);
    expect(screen.getByText(/title/)).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("adds an extra to the cart when chip clicked", async () => {
    useCartStore.setState({
      lines: [{ productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
    });
    const user = userEvent.setup();
    render(<CartUpsellStrip locale="en" />);
    const firstChip = screen.getAllByRole("button")[0];
    await user.click(firstChip);
    const lines = useCartStore.getState().lines;
    expect(lines.some((l) => l.productId.startsWith("x-"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/CartUpsellStrip.test.tsx --run`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// components/conversion/CartUpsellStrip.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { suggestExtrasForCart } from "@/data/gift-extras";
import { PRODUCTS } from "@/data/products";
import { formatMoneyCents } from "@/lib/format";
import { CONV_EVENTS } from "@/lib/conversion/events";
import { cn } from "@/lib/cn";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
};

export function CartUpsellStrip({ locale }: Props) {
  const t = useTranslations("conversion.upsell");
  const lines = useCartStore((s) => s.lines);
  const add = useCartStore((s) => s.add);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  if (lines.length === 0) return null;

  const suggestions = suggestExtrasForCart(lines, PRODUCTS);
  if (suggestions.length === 0) return null;

  const onAdd = (extraId: string) => {
    const product = PRODUCTS.find((p) => p.id === extraId);
    if (!product) return;
    const variant = product.variants[0];
    if (!variant) return;
    add({ productId: product.id, variantId: variant.id, addOnIds: [], qty: 1 });
    setRecentlyAdded(extraId);
    setTimeout(() => setRecentlyAdded(null), 2000);
  };

  return (
    <div
      data-conv-event={CONV_EVENTS.upsell.view}
      className="border-t border-ink/10 px-5 py-4"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500 mb-3">
        {t("title")}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory" role="list">
        {suggestions.map((extraId) => {
          const product = PRODUCTS.find((p) => p.id === extraId);
          if (!product) return null;
          const variant = product.variants[0];
          if (!variant) return null;
          const justAdded = recentlyAdded === extraId;
          const price = formatMoneyCents(variant.priceCents, locale);
          return (
            <li key={extraId} className="snap-start">
              <button
                type="button"
                disabled={justAdded}
                aria-label={t("add_aria", { item: product.title[locale], price })}
                data-conv-event={justAdded ? CONV_EVENTS.upsell.add : undefined}
                onClick={() => onAdd(extraId)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors",
                  justAdded
                    ? "border-rouge bg-rouge text-bone"
                    : "border-ink/15 text-ink hover:border-ink/40",
                )}
              >
                {justAdded ? (
                  <span aria-live="polite">✓ {t("added_label")}</span>
                ) : (
                  <>
                    <span>{product.title[locale]}</span>
                    <span className="font-mono text-xs text-ink/60">+{price}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/CartUpsellStrip.test.tsx --run`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add components/conversion/CartUpsellStrip.tsx tests/unit/CartUpsellStrip.test.tsx
git commit -m "feat(conversion): add CartUpsellStrip with chip-add + 2s feedback"
```

---

### Task 6.5: Mount CartUpsellStrip in CartDrawer and /cart

**Files:**
- Modify: `components/cart/CartDrawer.tsx`
- Modify: `components/cart/CartPageList.tsx` or the `/cart` page wrapper

- [ ] **Step 1: Add to CartDrawer between line list and assurance bar**

In `CartDrawer.tsx`, in the non-empty branch, between the closing `</ul>` of line items and the `<GiftAssuranceBar />` div:

Add import:
```tsx
import { CartUpsellStrip } from "@/components/conversion/CartUpsellStrip";
```

Render:
```tsx
<CartUpsellStrip locale={locale} />
```

- [ ] **Step 2: Add to /cart page**

In `app/[locale]/cart/page.tsx` (or wherever `CartPageList` is rendered), insert `<CartUpsellStrip locale={locale} />` between the cart list and `CartSummary`.

- [ ] **Step 3: Verify build + smoke test**

Run: `npx tsc --noEmit && npm run dev`
- Add `a-thousand-heartbeats` to bag, open drawer → upsell strip with chips appears.
- Click "Premium card" chip → it shows "Added ✓", chip becomes disabled, cart line count increases. After 2s, chip stays as Added (stays disabled until reload).
- Visit `/en/cart` → strip appears there too.
Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/cart/CartDrawer.tsx app/[locale]/cart/page.tsx
git commit -m "feat(conversion): mount CartUpsellStrip in drawer and /cart page"
```

---

## Step 7: Confirmation reciprocity card

### Task 7.1: ReciprocityCard component (TDD)

**Files:**
- Create: `components/conversion/ReciprocityCard.tsx`
- Create: `tests/unit/ReciprocityCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/ReciprocityCard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReciprocityCard } from "@/components/conversion/ReciprocityCard";
import type { Order } from "@/types/order";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const baseOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "ord_a4f2c9",
  lines: [{ productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
  contact: { email: "x@y.z", phone: "5161234567" },
  delivery: {
    recipient: { name: "Test", phone: "5160000000" },
    address: { street1: "1 a", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-05-03", slot: "midday" },
    cardMessage: "",
  },
  totals: { subtotalCents: 25500, deliveryCents: 0, taxCents: 0, totalCents: 25500 },
  ...overrides,
});

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("ReciprocityCard", () => {
  it("renders the referral code derived from order id", () => {
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    expect(screen.getByText("DIVA-A4F2C9")).toBeInTheDocument();
  });

  it("renders the subscription nudge when the order has no subscription items", () => {
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    expect(screen.getByText("subscription_title")).toBeInTheDocument();
  });

  it("hides the subscription nudge when the order contains a subscription product", () => {
    const order = baseOrder({
      lines: [{ productId: "p-sub-1", variantId: "weekly", addOnIds: [], qty: 1 }],
    });
    // Add a subscription product fixture so the lookup hits — minimal mock via PRODUCTS
    render(<ReciprocityCard order={order} locale="en" />);
    expect(screen.queryByText("subscription_title")).not.toBeInTheDocument();
  });

  it("copies the referral code to clipboard on click", async () => {
    const user = userEvent.setup();
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    await user.click(screen.getByRole("button", { name: /referral_copy_cta/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("DIVA-A4F2C9");
  });
});
```

> Note: the third test relies on `PRODUCTS` containing at least one subscription-category product with id `p-sub-1`. If the existing `data/products.ts` does not include one with that exact id, change the test to use the actual subscription product id (run `grep -n 'category: "subscriptions"' data/products.ts` to find it).

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/ReciprocityCard.test.tsx --run`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
// components/conversion/ReciprocityCard.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PRODUCTS } from "@/data/products";
import { deriveReferralCode } from "@/lib/conversion/referral-code";
import { CONV_EVENTS } from "@/lib/conversion/events";
import type { Order } from "@/types/order";
import type { Locale } from "@/types/locale";

type Props = {
  order: Order;
  locale: Locale;
};

export function ReciprocityCard({ order, locale }: Props) {
  const t = useTranslations("conversion.reciprocity");
  const [copied, setCopied] = useState(false);

  const code = deriveReferralCode(order.id);

  const hasSubscription = order.lines.some((l) => {
    const p = PRODUCTS.find((p) => p.id === l.productId);
    return p?.category === "subscriptions";
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-ink/10 bg-bone/40 p-6">
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
          {t("referral_eyebrow")}
        </p>
        <h2 className="font-display text-2xl text-ink leading-tight">{t("referral_title")}</h2>
        <p className="text-sm text-ink/75 max-w-[58ch]">{t("referral_body")}</p>
        <div className="flex items-center gap-3 mt-2">
          <code
            aria-label={`Referral code ${code}`}
            className="rounded-lg border border-ink/15 bg-bone px-3 py-2 font-mono text-sm tracking-widest text-ink"
          >
            {code}
          </code>
          <button
            type="button"
            onClick={onCopy}
            data-conv-event={CONV_EVENTS.reciprocity.referral_copy}
            aria-live="polite"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:underline"
          >
            {copied ? t("referral_copied") : t("referral_copy_cta")}
          </button>
        </div>
      </div>

      {!hasSubscription && (
        <div className="space-y-3 border-t border-ink/10 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500">
            {t("subscription_eyebrow")}
          </p>
          <h3 className="font-display text-xl text-ink leading-tight">{t("subscription_title")}</h3>
          <p className="text-sm text-ink/75 max-w-[58ch]">{t("subscription_body")}</p>
          <Link
            href={`/${locale}/shop?category=subscriptions`}
            data-conv-event={CONV_EVENTS.reciprocity.subscription_click}
            className="inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-rouge hover:underline mt-1"
          >
            {t("subscription_cta")} →
          </Link>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- tests/unit/ReciprocityCard.test.tsx --run`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/conversion/ReciprocityCard.tsx tests/unit/ReciprocityCard.test.tsx
git commit -m "feat(conversion): add ReciprocityCard with referral code + subscription nudge"
```

---

### Task 7.2: Mount ReciprocityCard on ConfirmationView

**Files:**
- Modify: `components/checkout/ConfirmationView.tsx`

- [ ] **Step 1: Insert below the totals aside**

Add import:
```tsx
import { ReciprocityCard } from "@/components/conversion/ReciprocityCard";
```

After the `</section>` that closes the grid (the one containing the delivery info + items + totals aside), and before the `<footer>`, insert:

```tsx
<section>
  <ReciprocityCard order={order} locale={locale} />
</section>
```

- [ ] **Step 2: Verify build + smoke test**

Run: `npx tsc --noEmit && npm run dev`
- Complete a checkout with a non-subscription product (e.g., `a-thousand-heartbeats`).
- On the confirmation page, verify the ReciprocityCard shows both sections (referral + subscription nudge).
- Click "Copy code" → "Copied!" appears for ~2s.
- Repeat with a subscription product → only referral section renders.
Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add components/checkout/ConfirmationView.tsx
git commit -m "feat(conversion): mount ReciprocityCard on confirmation view"
```

---

## Step 8: End-to-end verification

### Task 8.1: Playwright e2e suite

**Files:**
- Create: `tests/e2e/conversion.spec.ts`

- [ ] **Step 1: Write the consolidated e2e file**

```ts
// tests/e2e/conversion.spec.ts
import { test, expect } from "@playwright/test";

test.describe("conversion tactics", () => {
  test("PDP: cutoff countdown is visible and reflects time", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-01T12:13:00") });
    await page.goto("/en/product/a-thousand-heartbeats");
    await expect(page.locator('[data-conv-event="cutoff_view"]').first()).toBeVisible();
    await expect(page.getByText(/Order in the next.*1h 47m/)).toBeVisible();
  });

  test("PDP: review block renders matched anniversary copy", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await expect(page.locator('[data-conv-event="pdp_reviews_view"]')).toBeVisible();
    await expect(page.getByText(/anniversary buyers/)).toBeVisible();
  });

  test("PDP: anchor pricing shows three variants with Lush as default", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await expect(page.getByRole("button", { name: /Lush/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Most popular")).toBeVisible();
  });

  test("Drawer: cutoff pill appears, upsell chips present", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await page.getByRole("button", { name: /add to bag/i }).click();
    // Open drawer if not auto-opened
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-conv-event="cutoff_view"]')).toBeVisible();
    await expect(drawer.locator('[data-conv-event="cart_upsell_view"]')).toBeVisible();
  });

  test("Checkout: cutoff row + assurance bar in OrderSummarySticky", async ({ page }) => {
    await page.goto("/en/product/a-thousand-heartbeats");
    await page.getByRole("button", { name: /add to bag/i }).click();
    await page.getByRole("link", { name: /continue to checkout/i }).click();
    await expect(page.locator('aside [data-conv-event="cutoff_view"]')).toBeVisible();
    await expect(page.locator('aside [data-conv-event="assurance_view"]')).toBeVisible();
  });

  test("Confirmation: referral code present and copyable", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Walk through a full order (relies on existing checkout flow being completable with stubs)
    await page.goto("/en/product/a-thousand-heartbeats");
    await page.getByRole("button", { name: /add to bag/i }).click();
    await page.getByRole("link", { name: /continue to checkout/i }).click();
    // Fill checkout form with the existing stub-friendly values
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/^phone/i).fill("5165550100");
    await page.getByRole("button", { name: /continue/i }).first().click();
    await page.getByLabel(/recipient name/i).fill("Recipient");
    await page.getByLabel(/recipient phone/i).fill("5165550101");
    await page.getByLabel(/street address/i).fill("1 Willis Ave");
    await page.getByLabel(/city/i).fill("Albertson");
    await page.getByLabel(/zip/i).fill("11507");
    // Pick the first available delivery date (assumes the picker exposes selectable buttons)
    const dateButton = page.getByRole("button", { name: /\d{4}-\d{2}-\d{2}/ }).first();
    await dateButton.click();
    await page.getByRole("button", { name: /continue/i }).first().click();
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page.getByText(/^DIVA-/)).toBeVisible();
    await page.getByRole("button", { name: /copy code/i }).click();
    await expect(page.getByText(/Copied!/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run e2e -- tests/e2e/conversion.spec.ts`
Expected: all 6 tests pass.

If a selector fails because of label/copy mismatch, update the selector to match the actual DOM (do NOT loosen assertions on the conversion features themselves; these tests are the proof-of-life).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/conversion.spec.ts
git commit -m "test(conversion): add end-to-end coverage for all six tactics"
```

---

### Task 8.2: Full test sweep

**Files:** none

- [ ] **Step 1: Run all unit tests**

Run: `npm test -- --run`
Expected: every test passes (existing + new).

- [ ] **Step 2: Run all e2e tests**

Run: `npm run e2e`
Expected: every spec passes.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build succeeds, no warnings about missing translations.

- [ ] **Step 4: Verify a11y on the new components manually**

Open the dev server, use axe DevTools or VoiceOver on:
- PDP cutoff countdown (status changes are announced once per change, not per tick)
- Cart drawer upsell add (announces "Added")
- Confirmation copy code (announces "Copied!")

- [ ] **Step 5: Commit (if any final fixes)**

If steps 1-4 surfaced issues, fix and commit. Otherwise no commit needed.

---

### Task 8.3: PR

**Files:** none

- [ ] **Step 1: Push the branch**

Run: `git push -u origin feat/conversion-tactics-v1`

- [ ] **Step 2: Open a PR**

Run:
```bash
gh pr create --title "feat(conversion): six conversion tactics v1" --body "$(cat <<'EOF'
## Summary
Implements the six conversion tactics from the audit at `docs/superpowers/specs/2026-05-02-conversion-neuromarketing-audit.md`:
- Same-day cutoff system (PDP, drawer, /cart, checkout)
- PDP social-proof block with occasion matching
- Anchor pricing on 12 products (Standard / Lush / Opulent)
- Cart drawer "Complete the gift" upsell strip + four gift-extra products
- Gift-confidence assurance bar in PDP, drawer, checkout
- Confirmation reciprocity card (referral code + subscription nudge)

All shared logic lives in `lib/conversion/`; no new external dependencies; bilingual EN/ES.

## Test plan
- [ ] `npm test` — all unit tests pass (new tests in `tests/unit/conversion/` + new `*.test.tsx`)
- [ ] `npm run e2e` — `tests/e2e/conversion.spec.ts` covers each tactic end-to-end
- [ ] `npm run build` — production build clean
- [ ] Manual: PDP cutoff is accurate, drawer upsell adds work, copy-code works, sympathy PDP uses sympathy variant, anchor pricing shows three chips with Lush selected by default

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL is returned.

---

## Self-review (run before delivering plan)

**Spec coverage:**
- §1.1–1.6 of spec → Steps 1.2–1.7
- §3.1 cutoff system → Tasks 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5
- §3.2 PDP reviews → Tasks 1.4, 4.1, 4.2
- §3.3 anchor pricing → Tasks 5.1, 5.2, 5.3, 5.4
- §3.4 cart upsell → Tasks 1.6, 6.1, 6.2, 6.3, 6.4, 6.5
- §3.5 assurance bar → Tasks 2.1, 2.2, 3.6
- §3.6 reciprocity → Tasks 1.5, 7.1, 7.2
- §4.7 events constants → Task 1.7
- §4 i18n → Task 1.8
- §6 testing → unit tests in each task + Task 8.1 + Task 8.2

**Type consistency check:**
- `CutoffSnapshot` defined in 1.1, consumed in 1.2 (`snapshotCutoff`), 1.3 (`useCutoff`), 3.1/3.2/3.3 (components). Consistent.
- `ReviewMatch` defined in 1.1, returned by 1.4 (`matchReviews`), consumed in 4.1 (`PdpReviewsBlock`). Consistent.
- `GiftExtraId` defined in 1.6, consumed in 6.4 (`CartUpsellStrip`). Consistent.
- `useCartStore` shape unchanged — 6.4 reads + writes via existing `add` action.
- `CONV_EVENTS` defined in 1.7, consumed in every component's `data-conv-event`. Consistent.

**Placeholder scan:** none of the `TBD`/`add error handling`/`similar to`/`fill in` patterns present.
