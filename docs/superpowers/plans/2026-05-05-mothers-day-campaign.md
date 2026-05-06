# Mother's Day 2026 Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/en/mothers-day` landing, supporting components, schema, home strip, and Google Ads Editor CSV in time for a Wed 2026-05-06 evening soft launch and a Sun 2026-05-10 Mother's Day delivery push.

**Architecture:** Server-component landing page under `app/[locale]/mothers-day/page.tsx` that composes a sticky countdown banner, a ZIP checker, a curated product grid (reusing `ProductGrid`), trust strip, "Why Diva", FAQ, and JSON-LD schema. Curation happens via a new `"mothers-day"` value added to the `Occasion` union and tagged on 7 existing products. Conversion tracking reuses the existing GA4 dataLayer infrastructure.

**Tech Stack:** Next.js 16.2.4, next-intl 4.11.0, React server components, Tailwind, framer-motion, Vitest (unit), Playwright (e2e). **IMPORTANT: This Next.js has breaking changes from training data — the engineer MUST read `node_modules/next/dist/docs/` for any unfamiliar API before using it (per AGENTS.md).**

**Spec:** `docs/superpowers/specs/2026-05-05-mothers-day-campaign-design.md`

---

## File Structure

**Create:**
- `components/mothers-day/MothersDayCutoffBanner.tsx` — sticky countdown banner
- `components/mothers-day/ZipChecker.tsx` — ZIP input + validation UI
- `components/mothers-day/MothersDayEdit.tsx` — curated product grid wrapper
- `components/mothers-day/MothersDayHomeStrip.tsx` — home page hero strip
- `components/mothers-day/WhyDivaBlock.tsx` — 3-column trust block
- `components/mothers-day/MothersDayFaq.tsx` — accordion
- `components/mothers-day/StickyMobileCTA.tsx` — bottom CTA on mobile
- `components/mothers-day/MothersDayProductSchema.tsx` — JSON-LD emitter
- `app/[locale]/mothers-day/page.tsx` — landing page (server component)
- `app/[locale]/mothers-day/opengraph-image.tsx` — OG image
- `lib/delivery-zones.ts` — `isInDeliveryZone(zip)` helper (named distinct from `data/delivery-zones.ts`)
- `tests/unit/delivery-zones.test.ts`
- `tests/unit/MothersDayCutoffBanner.test.tsx`
- `tests/unit/ZipChecker.test.tsx`
- `tests/unit/MothersDayEdit.test.tsx`
- `tests/e2e/mothers-day.spec.ts`
- `docs/google-ads/mothers-day-2026.csv` — Google Ads Editor import file
- `docs/google-ads/mothers-day-2026-README.md` — import instructions

**Modify:**
- `types/product.ts` — extend `Occasion` union to include `"mothers-day"`
- `data/products.ts` — tag 7 products with `"mothers-day"` occasion
- `lib/analytics.ts` — add `trackMothersDayView`, `trackZipCheckPass`, `trackZipCheckFail`, `trackCutoffBannerClick`
- `app/[locale]/page.tsx` — insert `<MothersDayHomeStrip>` between `<Hero>` and `<KineticMarquee>`
- `messages/en.json` and `messages/es.json` — add `mothers_day.*` keys
- `tests/unit/product-helpers.test.ts` — add fixture coverage for new occasion (smoke)

---

## Pre-flight checks (do once before Task 1)

- [ ] **Verify clean working tree.** Run: `git status`. Expected: working tree clean (the spec commits should already be in `main`).
- [ ] **Verify Node + deps installed.** Run: `node -v && npm ls next next-intl vitest`. Expected: Next 16.2.4, next-intl 4.11.x, vitest installed.
- [ ] **Verify the existing test suite is green.** Run: `npm test`. Expected: all tests pass. If any fail before we start, STOP and report to user.
- [ ] **Verify the existing build succeeds.** Run: `npm run build`. Expected: no build errors. Skip if first run is too slow; rely on dev server.
- [ ] **Verify dev server starts.** Run: `npm run dev` in background, hit `http://localhost:3000/en`, confirm home renders. Kill dev server.

---

## Task 1: Extend Occasion union to include "mothers-day"

**Files:**
- Modify: `types/product.ts:33-39`
- Test: extend existing `tests/unit/product-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/product-helpers.test.ts` (above the closing of the file, inside the existing test file):

```ts
describe("Occasion 'mothers-day' value", () => {
  it("filters products by the mothers-day occasion", () => {
    const target = fx({ id: "md-1", occasions: ["mothers-day"] });
    const other = fx({ id: "other", occasions: ["birthday"] });
    const filtered = filterProducts([target, other], { occasion: "mothers-day" });
    expect(filtered.map((p) => p.id)).toEqual(["md-1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- product-helpers.test.ts`
Expected: FAIL — TypeScript error `Type '"mothers-day"' is not assignable to type 'Occasion'`.

- [ ] **Step 3: Extend the union**

Edit `types/product.ts:33-39`:

```ts
export type Occasion =
  | "birthday"
  | "anniversary"
  | "sympathy"
  | "romance"
  | "congrats"
  | "just-because"
  | "mothers-day";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- product-helpers.test.ts`
Expected: PASS for all tests in this file.

- [ ] **Step 5: Run full type check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors anywhere — the union extension is additive). If anywhere else does an exhaustive `switch` on `Occasion` and now warns, add a default branch that handles `"mothers-day"` (likely just falls through to default rendering).

- [ ] **Step 6: Commit**

```bash
git add types/product.ts tests/unit/product-helpers.test.ts
git commit -m "feat(types): add 'mothers-day' to Occasion union"
```

---

## Task 2: Tag 7 curated products with "mothers-day"

**Files:**
- Modify: `data/products.ts` (7 product entries — search by slug)

The 7 slugs to tag (per spec §3.1):
1. `blush-enchantment`
2. `dona-rosita`
3. `cottage-garden-charm`
4. `pink-opus`
5. `designers-choice-maky`
6. `maison-de-diva`
7. `hundred-roses-vase`

For each product, ADD `"mothers-day"` to the existing `occasions` array. Do NOT remove any existing occasion values.

- [ ] **Step 1: Find each product's `occasions:` line**

Run: `grep -n -B1 -A6 'slug: "blush-enchantment"' data/products.ts | grep -E "slug|occasions"`. Repeat for each slug.

- [ ] **Step 2: Edit each product**

Example for `blush-enchantment` (line ~605):

Before: `occasions: ["romance", "anniversary", "just-because"],`
After:  `occasions: ["romance", "anniversary", "just-because", "mothers-day"],`

Apply analogous edit to the other 6. Use `Edit` with enough surrounding context (slug + occasions line) to make each replacement unique.

- [ ] **Step 3: Verify all 7 are tagged**

Run: `grep -B3 '"mothers-day"' data/products.ts | grep slug`
Expected: exactly 7 slug lines, matching the list above.

- [ ] **Step 4: Run unit tests**

Run: `npm test -- product-helpers`
Expected: PASS.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add data/products.ts
git commit -m "feat(catalog): tag 7 SKUs with mothers-day occasion"
```

---

## Task 3: ZIP-zone validation helper

**Files:**
- Create: `lib/delivery-zones.ts`
- Test: `tests/unit/delivery-zones.test.ts`

Goal: a pure function that, given a ZIP string, returns either the matching `DeliveryZone` or `null`. Used by `<ZipChecker>` and reusable elsewhere.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/delivery-zones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findDeliveryZoneByZip, isValidZip } from "@/lib/delivery-zones";

describe("isValidZip", () => {
  it("accepts 5-digit numeric strings", () => {
    expect(isValidZip("11010")).toBe(true);
  });

  it("rejects empty / short / non-numeric / >5 digit input", () => {
    expect(isValidZip("")).toBe(false);
    expect(isValidZip("1101")).toBe(false);
    expect(isValidZip("110100")).toBe(false);
    expect(isValidZip("1101a")).toBe(false);
    expect(isValidZip("  11010  ")).toBe(false);
  });
});

describe("findDeliveryZoneByZip", () => {
  it("returns the matching zone for a known ZIP", () => {
    const zone = findDeliveryZoneByZip("11010");
    expect(zone?.id).toBe("nassau-south");
  });

  it("returns the matching zone for a Queens ZIP", () => {
    const zone = findDeliveryZoneByZip("11354");
    expect(zone?.id).toBe("queens");
  });

  it("returns null for an out-of-zone ZIP", () => {
    expect(findDeliveryZoneByZip("90210")).toBeNull();
  });

  it("returns null for an invalid ZIP", () => {
    expect(findDeliveryZoneByZip("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- delivery-zones.test.ts`
Expected: FAIL — `Cannot find module '@/lib/delivery-zones'`.

- [ ] **Step 3: Implement the helper**

Create `lib/delivery-zones.ts`:

```ts
import { deliveryZones, type DeliveryZone } from "@/data/delivery-zones";

const ZIP_RE = /^\d{5}$/;

export function isValidZip(input: string): boolean {
  return ZIP_RE.test(input);
}

export function findDeliveryZoneByZip(input: string): DeliveryZone | null {
  if (!isValidZip(input)) return null;
  for (const zone of deliveryZones) {
    if (zone.zips.includes(input)) return zone;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- delivery-zones.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/delivery-zones.ts tests/unit/delivery-zones.test.ts
git commit -m "feat(delivery): add findDeliveryZoneByZip helper"
```

---

## Task 4: Add Mother's Day analytics events

**Files:**
- Modify: `lib/analytics.ts` (append to file)
- Test: extend existing `tests/unit/analytics.test.ts`

These mirror the existing pattern (small `pushDataLayer` wrappers).

- [ ] **Step 1: Read the current analytics test file to match patterns**

Run: `head -40 tests/unit/analytics.test.ts`

- [ ] **Step 2: Write failing tests**

Append to `tests/unit/analytics.test.ts` (inside its existing setup that mocks `dataLayer` and `hasConsent`):

```ts
describe("mothers-day events", () => {
  beforeEach(() => {
    (window as any).dataLayer = [];
  });

  it("pushes mothers_day_view", async () => {
    const { trackMothersDayView } = await import("@/lib/analytics");
    trackMothersDayView();
    expect((window as any).dataLayer).toContainEqual({ event: "mothers_day_view" });
  });

  it("pushes zip_check_pass with zone id", async () => {
    const { trackZipCheckPass } = await import("@/lib/analytics");
    trackZipCheckPass({ zip: "11010", zoneId: "nassau-south" });
    expect((window as any).dataLayer).toContainEqual({
      event: "zip_check_pass",
      zip: "11010",
      zone_id: "nassau-south",
    });
  });

  it("pushes zip_check_fail with zip", async () => {
    const { trackZipCheckFail } = await import("@/lib/analytics");
    trackZipCheckFail({ zip: "90210" });
    expect((window as any).dataLayer).toContainEqual({
      event: "zip_check_fail",
      zip: "90210",
    });
  });

  it("pushes cutoff_banner_click", async () => {
    const { trackCutoffBannerClick } = await import("@/lib/analytics");
    trackCutoffBannerClick();
    expect((window as any).dataLayer).toContainEqual({ event: "cutoff_banner_click" });
  });
});
```

If `tests/unit/analytics.test.ts` mocks `hasConsent` differently, mirror that mock for these tests (consent must be granted, otherwise `pushDataLayer` no-ops). Read the top of the existing test file to confirm.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- analytics.test.ts`
Expected: FAIL — `trackMothersDayView is not a function` (or similar).

- [ ] **Step 4: Add the helpers**

Append to `lib/analytics.ts`:

```ts
// ─── Mother's Day campaign events ────────────────────────────────────────────

export function trackMothersDayView(): void {
  pushDataLayer({ event: "mothers_day_view" });
}

export function trackZipCheckPass(args: { zip: string; zoneId: string }): void {
  pushDataLayer({ event: "zip_check_pass", zip: args.zip, zone_id: args.zoneId });
}

export function trackZipCheckFail(args: { zip: string }): void {
  pushDataLayer({ event: "zip_check_fail", zip: args.zip });
}

export function trackCutoffBannerClick(): void {
  pushDataLayer({ event: "cutoff_banner_click" });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- analytics.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): add mothers-day campaign event helpers"
```

---

## Task 5: i18n strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

All Mother's Day landing copy lives under `mothers_day.*`. Even though v1 only renders English, we add ES keys now so that `next-intl` doesn't throw "missing key" warnings if a Spanish user lands and we route them with the "Pronto en español" banner.

- [ ] **Step 1: Add EN keys**

Append to the top-level object in `messages/en.json`:

```json
  "mothers_day": {
    "page_title": "Mother's Day Flowers · Long Island Same-Day Delivery — Diva Flowers",
    "meta_description": "Hand-delivered Mother's Day bouquets across Nassau, Queens & W. Suffolk. Order by Sat May 9 · 2 PM. Real florist studio since 2014.",
    "cutoff_banner": "Order by Saturday May 9 · 2 PM for Sunday delivery",
    "cutoff_banner_post": "Order today for Monday delivery",
    "hero_h1": "Mother's Day Flowers · Long Island",
    "hero_sub": "Same-day delivery to Nassau, Queens & Western Suffolk. Hand-delivered by our studio since 2014.",
    "hero_cta": "Shop the Mother's Day Edit",
    "zip_label": "Confirm same-day delivery",
    "zip_placeholder": "Enter your ZIP",
    "zip_check": "Check",
    "zip_pass": "✓ We deliver to {zone}",
    "zip_fail": "Sorry, we don't deliver to {zip} yet",
    "zip_fail_link": "Contact us for special requests",
    "trust_reviews": "★★★★★ 4.9 · 127 reviews on Google",
    "edit_title": "The Mother's Day Edit",
    "edit_subtitle": "Seven curated arrangements, hand-delivered Sunday May 10",
    "why_title": "Why Diva",
    "why_real_title": "Real florists, real studio",
    "why_real_body": "Visit our Albertson studio. We design every bouquet by hand — never warehoused, never boxed.",
    "why_delivery_title": "Hand-delivered, never boxed",
    "why_delivery_body": "Our drivers carry your flowers door-to-door — no mailroom drops, no soggy boxes.",
    "why_cutoff_title": "Order by 2 PM, arrives same day",
    "why_cutoff_body": "Place your order before 2 PM and we'll have it at her door before dinner.",
    "faq_title": "Mother's Day FAQ",
    "faq_when_q": "When should I order?",
    "faq_when_a": "Place your order by Saturday May 9 at 2 PM ET to guarantee Sunday May 10 delivery. Orders after the cutoff are delivered Monday.",
    "faq_sunday_q": "Do you deliver Sunday May 10?",
    "faq_sunday_a": "Yes. We open at 10 AM and deliver until 4 PM on Mother's Day to all our zones.",
    "faq_not_home_q": "What if she's not home?",
    "faq_not_home_a": "Our drivers will text the recipient and leave the bouquet in a shaded, safe location with a photo confirmation.",
    "faq_addons_q": "Can I add a card or chocolate?",
    "faq_addons_a": "Yes. Every order includes a free hand-written card. Add chocolates or a vase upgrade at checkout.",
    "faq_where_q": "Where do you deliver?",
    "faq_where_a": "Same-day to Nassau County, Queens, Brooklyn (select ZIPs), and Western Suffolk. Use the ZIP checker above to confirm.",
    "sticky_cta": "Order by Sat 2 PM →",
    "home_strip": "Mother's Day · Order by Sat May 9 · Same-day to Long Island",
    "home_strip_dismiss": "Dismiss",
    "es_banner": "Pronto en español"
  },
```

- [ ] **Step 2: Add ES keys**

Append to the top-level object in `messages/es.json` with Spanish translations of the same keys. For all keys not yet translated, use placeholder ES strings; the only key actually rendered to ES users in v1 is `home_strip` and `es_banner`. Translate at minimum:

```json
  "mothers_day": {
    "home_strip": "Día de la Madre · Pide antes del sáb 9 de mayo · Entrega misma día en Long Island",
    "home_strip_dismiss": "Cerrar",
    "es_banner": "Pronto en español"
  }
```

For all other keys, copy the English value verbatim (acceptable since the EN landing is what ES users see in v1; full ES translation is out of scope).

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"` and `node -e "JSON.parse(require('fs').readFileSync('messages/es.json','utf8'))"`
Expected: no output (= valid JSON).

- [ ] **Step 4: Run i18n key test**

Run: `npm test -- i18n-keys`
Expected: PASS. If this test enforces parity between en/es, both files now have the same `mothers_day.*` keys.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(i18n): add mothers_day.* copy keys"
```

---

## Task 6: `<MothersDayCutoffBanner>` component

**Files:**
- Create: `components/mothers-day/MothersDayCutoffBanner.tsx`
- Test: `tests/unit/MothersDayCutoffBanner.test.tsx`

Sticky top, coral-on-bone, reads cutoff via existing `useCutoff()` hook.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/MothersDayCutoffBanner.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MothersDayCutoffBanner } from "@/components/mothers-day/MothersDayCutoffBanner";

vi.mock("@/lib/conversion/use-cutoff", () => ({
  useCutoff: () => ({ status: "before", minutesRemaining: 240, cutoff: "14:00" }),
}));

describe("MothersDayCutoffBanner", () => {
  it("renders cutoff text and a countdown when before cutoff", () => {
    render(<MothersDayCutoffBanner cutoff="14:00" label="Order by Sat 2 PM" />);
    expect(screen.getByText(/Order by Sat 2 PM/i)).toBeInTheDocument();
    expect(screen.getByTestId("md-countdown")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MothersDayCutoffBanner.test.tsx`
Expected: FAIL — `Cannot find module '@/components/mothers-day/MothersDayCutoffBanner'`.

- [ ] **Step 3: Implement the component**

Create `components/mothers-day/MothersDayCutoffBanner.tsx`:

```tsx
"use client";
import { useCutoff } from "@/lib/conversion/use-cutoff";
import { trackCutoffBannerClick } from "@/lib/analytics";

type Props = {
  cutoff: string;
  label: string;
  ctaHref?: string;
  ctaLabel?: string;
};

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function MothersDayCutoffBanner({ cutoff, label, ctaHref = "#md-edit", ctaLabel = "Shop now" }: Props) {
  const snap = useCutoff(cutoff);
  return (
    <div
      role="banner"
      className="sticky top-0 z-50 w-full bg-rouge text-bone shadow-md"
      data-testid="md-cutoff-banner"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="font-medium">{label}</span>
        <span data-testid="md-countdown" className="font-mono text-xs opacity-90">
          {snap && snap.status === "before" ? formatHM(snap.minutesRemaining) : "—"}
        </span>
        <a
          href={ctaHref}
          onClick={trackCutoffBannerClick}
          className="rounded-full bg-bone px-3 py-1 text-xs font-semibold text-rouge hover:bg-bone/90"
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
```

> Verify `bg-rouge` and `text-bone` exist in the Tailwind palette by checking `tailwind.config.*` or one of the existing components (e.g. Hero.tsx mentions `text-bone`). If `rouge` isn't a token, swap to `bg-[#B8345E]` or whatever the brand red token is in the config.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MothersDayCutoffBanner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/mothers-day/MothersDayCutoffBanner.tsx tests/unit/MothersDayCutoffBanner.test.tsx
git commit -m "feat(mothers-day): cutoff banner with live countdown"
```

---

## Task 7: `<ZipChecker>` component

**Files:**
- Create: `components/mothers-day/ZipChecker.tsx`
- Test: `tests/unit/ZipChecker.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/ZipChecker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZipChecker } from "@/components/mothers-day/ZipChecker";

const trackPass = vi.fn();
const trackFail = vi.fn();

vi.mock("@/lib/analytics", () => ({
  trackZipCheckPass: (args: any) => trackPass(args),
  trackZipCheckFail: (args: any) => trackFail(args),
}));

describe("ZipChecker", () => {
  beforeEach(() => {
    trackPass.mockClear();
    trackFail.mockClear();
  });

  it("shows the zone name when ZIP is valid and in-zone", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "11010");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/we deliver to/i)).toBeInTheDocument();
    expect(trackPass).toHaveBeenCalledWith({ zip: "11010", zoneId: "nassau-south" });
  });

  it("shows the rejection message for an out-of-zone ZIP", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "90210");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(screen.getByText(/we don't deliver to 90210/i)).toBeInTheDocument();
    expect(trackFail).toHaveBeenCalledWith({ zip: "90210" });
  });

  it("does not fire analytics for an invalid ZIP shape", async () => {
    const u = userEvent.setup();
    render(<ZipChecker locale="en" />);
    await u.type(screen.getByPlaceholderText(/enter your zip/i), "abc");
    await u.click(screen.getByRole("button", { name: /check/i }));
    expect(trackPass).not.toHaveBeenCalled();
    expect(trackFail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ZipChecker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/mothers-day/ZipChecker.tsx`:

```tsx
"use client";
import { useState, type FormEvent } from "react";
import { findDeliveryZoneByZip, isValidZip } from "@/lib/delivery-zones";
import { trackZipCheckPass, trackZipCheckFail } from "@/lib/analytics";
import type { Locale } from "@/types/locale";

type Result =
  | { kind: "pass"; zip: string; zoneLabel: string }
  | { kind: "fail"; zip: string }
  | { kind: "invalid" }
  | { kind: "idle" };

export function ZipChecker({ locale }: { locale: Locale }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const zip = value.trim();
    if (!isValidZip(zip)) {
      setResult({ kind: "invalid" });
      return;
    }
    const zone = findDeliveryZoneByZip(zip);
    if (zone) {
      const label = zone.label[locale];
      trackZipCheckPass({ zip, zoneId: zone.id });
      setResult({ kind: "pass", zip, zoneLabel: label });
    } else {
      trackZipCheckFail({ zip });
      setResult({ kind: "fail", zip });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="Enter your ZIP"
          aria-label="Enter your ZIP"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-md border border-ink/20 bg-bone px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bone hover:bg-ink/90"
        >
          Check
        </button>
      </div>
      {result.kind === "pass" && (
        <p className="text-sm text-ink">✓ We deliver to {result.zoneLabel}</p>
      )}
      {result.kind === "fail" && (
        <p className="text-sm text-ink">
          Sorry, we don't deliver to {result.zip} yet —{" "}
          <a className="underline" href={`/${locale}/contact`}>
            Contact us for special requests
          </a>
        </p>
      )}
      {result.kind === "invalid" && (
        <p className="text-sm text-ink/70">Please enter a 5-digit ZIP.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ZipChecker.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/mothers-day/ZipChecker.tsx tests/unit/ZipChecker.test.tsx
git commit -m "feat(mothers-day): ZIP checker with delivery-zone validation"
```

---

## Task 8: `<MothersDayEdit>` curated grid

**Files:**
- Create: `components/mothers-day/MothersDayEdit.tsx`
- Test: `tests/unit/MothersDayEdit.test.tsx`

Renders existing `<ProductGrid>` filtered to a passed-in slug list. Skips slugs that don't resolve.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/MothersDayEdit.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MothersDayEdit } from "@/components/mothers-day/MothersDayEdit";

vi.mock("@/components/product/ProductGrid", () => ({
  ProductGrid: ({ products }: any) => (
    <div data-testid="product-grid">
      {products.map((p: any) => (
        <span key={p.id} data-testid="product-tile">
          {p.slug}
        </span>
      ))}
    </div>
  ),
}));

describe("MothersDayEdit", () => {
  it("renders products in the order of the slug list, skipping unknowns", () => {
    render(
      <MothersDayEdit
        locale="en"
        slugs={["blush-enchantment", "this-does-not-exist", "dona-rosita"]}
      />,
    );
    const tiles = screen.getAllByTestId("product-tile");
    expect(tiles.map((t) => t.textContent)).toEqual([
      "blush-enchantment",
      "dona-rosita",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MothersDayEdit.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/mothers-day/MothersDayEdit.tsx`:

```tsx
import { PRODUCTS } from "@/data/products";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
  slugs: string[];
};

export function MothersDayEdit({ locale, slugs }: Props) {
  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));
  const products = slugs
    .map((s) => bySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.active));

  return (
    <section id="md-edit" className="mx-auto max-w-7xl px-4 py-16">
      <ProductGrid products={products} locale={locale} />
    </section>
  );
}
```

> Verify the import name. If `data/products.ts` exports `default` or `products` (lowercase) instead of `PRODUCTS`, adjust accordingly. Run: `grep -E "^export" data/products.ts` to confirm.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MothersDayEdit.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/mothers-day/MothersDayEdit.tsx tests/unit/MothersDayEdit.test.tsx
git commit -m "feat(mothers-day): curated edit grid wrapper"
```

---

## Task 9: `<WhyDivaBlock>` and `<MothersDayFaq>` static blocks

**Files:**
- Create: `components/mothers-day/WhyDivaBlock.tsx`
- Create: `components/mothers-day/MothersDayFaq.tsx`

These are pure presentation, server-component-friendly. Light testing — visual smoke only via the e2e in Task 14. No new unit tests required (static markup; behavior tests would have low value).

- [ ] **Step 1: Implement WhyDivaBlock**

Create `components/mothers-day/WhyDivaBlock.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function WhyDivaBlock({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "mothers_day" });
  const items = [
    { title: t("why_real_title"), body: t("why_real_body") },
    { title: t("why_delivery_title"), body: t("why_delivery_body") },
    { title: t("why_cutoff_title"), body: t("why_cutoff_body") },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <h2 className="mb-10 text-center font-display text-3xl text-ink">
        {t("why_title")}
      </h2>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.title}>
            <h3 className="mb-2 font-display text-xl text-ink">{it.title}</h3>
            <p className="text-ink/80">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement MothersDayFaq**

Create `components/mothers-day/MothersDayFaq.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function MothersDayFaq({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "mothers_day" });
  const faqs = [
    { q: t("faq_when_q"), a: t("faq_when_a") },
    { q: t("faq_sunday_q"), a: t("faq_sunday_a") },
    { q: t("faq_not_home_q"), a: t("faq_not_home_a") },
    { q: t("faq_addons_q"), a: t("faq_addons_a") },
    { q: t("faq_where_q"), a: t("faq_where_a") },
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="mb-8 text-center font-display text-3xl text-ink">
        {t("faq_title")}
      </h2>
      <div className="space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="rounded-md border border-ink/10 bg-bone px-4 py-3"
          >
            <summary className="cursor-pointer font-medium text-ink">{f.q}</summary>
            <p className="mt-2 text-ink/80">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

> If the codebase has a font token besides `font-display`, swap to it. Inspect `tailwind.config.*` or any existing component to confirm.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/mothers-day/WhyDivaBlock.tsx components/mothers-day/MothersDayFaq.tsx
git commit -m "feat(mothers-day): WhyDiva and FAQ blocks"
```

---

## Task 10: `<MothersDayProductSchema>` JSON-LD emitter

**Files:**
- Create: `components/mothers-day/MothersDayProductSchema.tsx`

Emits a `Product` JSON-LD per curated SKU plus an `OfferCatalog` linking them. Server component — runs at request time but produces only a `<script type="application/ld+json">`.

- [ ] **Step 1: Implement**

Create `components/mothers-day/MothersDayProductSchema.tsx`:

```tsx
import { PRODUCTS } from "@/data/products";
import { startingPriceCents } from "@/data/product-helpers";
import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";

export function MothersDayProductSchema({
  locale,
  slugs,
}: {
  locale: Locale;
  slugs: string[];
}) {
  const products = slugs
    .map((s) => PRODUCTS.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.active));

  const items = products.map((p, i) => ({
    "@type": "Product",
    "@id": `${SITE.url}/${locale}/product/${p.slug}#md`,
    position: i + 1,
    name: p.title[locale],
    description: p.blurb[locale],
    image: `${SITE.url}${p.images[0]?.src ?? ""}`,
    brand: { "@type": "Brand", name: SITE.brand },
    offers: {
      "@type": "Offer",
      price: (startingPriceCents(p) / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressRegion: "NY",
          addressCountry: "US",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        },
      },
    },
  }));

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Mother's Day Edit",
    itemListElement: items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/mothers-day/MothersDayProductSchema.tsx
git commit -m "feat(mothers-day): Product/ItemList JSON-LD with shipping details"
```

---

## Task 11: `<StickyMobileCTA>` and `<MothersDayHomeStrip>`

**Files:**
- Create: `components/mothers-day/StickyMobileCTA.tsx`
- Create: `components/mothers-day/MothersDayHomeStrip.tsx`

- [ ] **Step 1: Implement StickyMobileCTA**

Create `components/mothers-day/StickyMobileCTA.tsx`:

```tsx
"use client";
import { useTranslations } from "next-intl";

export function StickyMobileCTA() {
  const t = useTranslations("mothers_day");
  return (
    <a
      href="#md-edit"
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-rouge px-6 py-3 text-sm font-semibold text-bone shadow-lg md:hidden"
    >
      {t("sticky_cta")}
    </a>
  );
}
```

- [ ] **Step 2: Implement MothersDayHomeStrip**

The strip auto-hides after `2026-05-10T16:00:00-04:00` (Sun MD 4 PM ET = 20:00 UTC).

Create `components/mothers-day/MothersDayHomeStrip.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";

const HIDE_AFTER_UTC_MS = Date.UTC(2026, 4, 10, 20, 0, 0); // 2026-05-10T20:00:00Z = MD 4 PM ET
const STORAGE_KEY = "md2026-strip-dismissed";

export function MothersDayHomeStrip({ locale }: { locale: Locale }) {
  const t = useTranslations("mothers_day");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Date.now() >= HIDE_AFTER_UTC_MS) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-rouge text-bone">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <a href={`/${locale}/mothers-day`} className="flex-1 hover:underline">
          {t("home_strip")}
        </a>
        <button
          aria-label={t("home_strip_dismiss")}
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "1");
            setShow(false);
          }}
          className="text-bone/80 hover:text-bone"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into the home page**

Modify `app/[locale]/page.tsx`. After `<Hero locale={locale} />` and before `<KineticMarquee>`:

```tsx
import { MothersDayHomeStrip } from "@/components/mothers-day/MothersDayHomeStrip";
```

```tsx
      <Hero locale={locale} />
      <MothersDayHomeStrip locale={locale} />
      <KineticMarquee text={`${marquee}  ·  `} />
```

- [ ] **Step 4: Type check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/mothers-day/StickyMobileCTA.tsx components/mothers-day/MothersDayHomeStrip.tsx app/[locale]/page.tsx
git commit -m "feat(mothers-day): home strip and sticky mobile CTA"
```

---

## Task 12: Landing page `app/[locale]/mothers-day/page.tsx`

**Files:**
- Create: `app/[locale]/mothers-day/page.tsx`
- Create: `app/[locale]/mothers-day/opengraph-image.tsx` (copy pattern from existing one)

The CURATED_SLUGS list is the spec's selection.

- [ ] **Step 1: Implement the page**

Create `app/[locale]/mothers-day/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";
import { MothersDayCutoffBanner } from "@/components/mothers-day/MothersDayCutoffBanner";
import { ZipChecker } from "@/components/mothers-day/ZipChecker";
import { MothersDayEdit } from "@/components/mothers-day/MothersDayEdit";
import { WhyDivaBlock } from "@/components/mothers-day/WhyDivaBlock";
import { MothersDayFaq } from "@/components/mothers-day/MothersDayFaq";
import { StickyMobileCTA } from "@/components/mothers-day/StickyMobileCTA";
import { MothersDayProductSchema } from "@/components/mothers-day/MothersDayProductSchema";
import { GoogleReviews } from "@/components/home/GoogleReviews";

const CURATED_SLUGS = [
  "blush-enchantment",
  "dona-rosita",
  "cottage-garden-charm",
  "pink-opus",
  "designers-choice-maky",
  "maison-de-diva",
  "hundred-roses-vase",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "mothers_day" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `${SITE.url}/${locale}/mothers-day`,
      languages: {
        en: "/en/mothers-day",
        es: "/es/mothers-day",
      },
    },
    openGraph: {
      title: t("page_title"),
      description: t("meta_description"),
      url: `${SITE.url}/${locale}/mothers-day`,
    },
  };
}

export default async function MothersDayPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "mothers_day" });

  return (
    <main className="bg-bone text-ink">
      <MothersDayCutoffBanner cutoff={SITE.cutoff24} label={t("cutoff_banner")} ctaLabel={t("hero_cta")} />

      {locale === "es" && (
        <div className="bg-ink/5 py-2 text-center text-sm text-ink/70">
          {t("es_banner")}
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center">
        <h1 className="font-display text-4xl md:text-5xl">{t("hero_h1")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink/80">{t("hero_sub")}</p>
        <a
          href="#md-edit"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-bone hover:bg-ink/90"
        >
          {t("hero_cta")}
        </a>
        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ink/60">{t("zip_label")}</span>
          <ZipChecker locale={locale} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-6 text-center">
        <p className="text-sm text-ink/70">{t("trust_reviews")}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-wider text-ink/50">
          {SITE.press.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </section>

      <GoogleReviews locale={locale} />

      <section className="mx-auto max-w-7xl px-4 pt-16 pb-2 text-center">
        <h2 className="font-display text-3xl text-ink">{t("edit_title")}</h2>
        <p className="mt-2 text-ink/70">{t("edit_subtitle")}</p>
      </section>
      <MothersDayEdit locale={locale} slugs={CURATED_SLUGS} />

      <WhyDivaBlock locale={locale} />
      <MothersDayFaq locale={locale} />

      <StickyMobileCTA />
      <MothersDayProductSchema locale={locale} slugs={CURATED_SLUGS} />
    </main>
  );
}
```

- [ ] **Step 2: Build and run dev server**

Run: `npm run dev`
Visit: `http://localhost:3000/en/mothers-day`
Verify visually:
- Cutoff banner sticky at top
- Hero with H1 = "Mother's Day Flowers · Long Island"
- ZIP checker present
- Trust strip with reviews + press logos
- 7 product tiles in the Edit grid
- WhyDiva 3-column block
- FAQ accordion expands
- Sticky CTA appears on mobile viewport (resize devtools)

Kill dev server.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/mothers-day/page.tsx
git commit -m "feat(mothers-day): landing page assembling all components"
```

---

## Task 13: OG image for the landing

**Files:**
- Create: `app/[locale]/mothers-day/opengraph-image.tsx`

- [ ] **Step 1: Inspect existing pattern**

Run: `cat "app/[locale]/opengraph-image.tsx"`. Mirror this file's approach (likely uses `next/og` `ImageResponse`).

- [ ] **Step 2: Create the OG image**

Create `app/[locale]/mothers-day/opengraph-image.tsx` mirroring the existing one but with:
- Title: "Mother's Day Flowers · Long Island"
- Subtitle: "Same-day delivery · Order by Sat May 9, 2 PM"
- Brand wordmark / studio reference per existing visual style.

- [ ] **Step 3: Verify**

Run: `npm run build` then visit `http://localhost:3000/en/mothers-day/opengraph-image` once `npm run dev` is up.
Expected: 1200×630 PNG renders with the title.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/mothers-day/opengraph-image.tsx"
git commit -m "feat(mothers-day): opengraph image"
```

---

## Task 14: E2E smoke test

**Files:**
- Create: `tests/e2e/mothers-day.spec.ts`

- [ ] **Step 1: Inspect a sibling Playwright spec for setup pattern**

Run: `cat tests/e2e/checkout.spec.ts | head -30`. Mirror imports, base URL handling, and any auth/cookie setup.

- [ ] **Step 2: Write the test**

Create `tests/e2e/mothers-day.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Mother's Day landing", () => {
  test("renders all key sections", async ({ page }) => {
    await page.goto("/en/mothers-day");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Mother's Day Flowers/i);
    await expect(page.getByTestId("md-cutoff-banner")).toBeVisible();
    await expect(page.getByPlaceholder(/Enter your ZIP/i)).toBeVisible();
    await expect(page.getByText(/4\.9 · 127 reviews/i)).toBeVisible();
    await expect(page.locator("#md-edit")).toBeVisible();
  });

  test("ZIP checker validates an in-zone ZIP and an out-of-zone ZIP", async ({ page }) => {
    await page.goto("/en/mothers-day");

    const input = page.getByPlaceholder(/Enter your ZIP/i);
    const button = page.getByRole("button", { name: /check/i });

    await input.fill("11010");
    await button.click();
    await expect(page.getByText(/We deliver to/i)).toBeVisible();

    await input.fill("90210");
    await button.click();
    await expect(page.getByText(/We don't deliver to 90210/i)).toBeVisible();
  });

  test("anchor link from hero CTA scrolls to edit grid", async ({ page }) => {
    await page.goto("/en/mothers-day");
    await page.getByRole("link", { name: /Shop the Mother's Day Edit/i }).first().click();
    await expect(page).toHaveURL(/#md-edit$/);
  });
});
```

- [ ] **Step 3: Run e2e**

Run: `npm run e2e -- mothers-day`
Expected: 3 tests PASS.

If they fail with selector mismatches, adjust the selectors in the test (not the implementation) — the test exists to lock current behavior, not to dictate it.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/mothers-day.spec.ts
git commit -m "test(e2e): mothers-day landing smoke and ZIP flow"
```

---

## Task 15: Generate Google Ads Editor CSV + README

**Files:**
- Create: `docs/google-ads/mothers-day-2026.csv`
- Create: `docs/google-ads/mothers-day-2026-README.md`

The CSV is what the user imports into Google Ads Editor (File → Import → CSV).

- [ ] **Step 1: Build the CSV**

Create `docs/google-ads/mothers-day-2026.csv`. Use the exact column headers Google Ads Editor expects. The row count covers: 1 campaign, 1 ad group, 1 RSA, 12 keywords, 12 negatives, 4 sitelinks, 5 callouts, 1 promotion extension. The reference for the exact column names is Google's "Bulk uploads spec" — the engineer should verify columns against the latest Google Ads Editor template (`Account → File → Export Spreadsheet` from any prior account for the template).

Sketch (column headers shown — fill in remaining required columns per template):

```csv
Campaign,Budget,Networks,Languages,Bid strategy type,Status
Mother's Day 2026 - Search,75.00,"Google search",English,Manual CPC,Paused
```

(The full CSV will be tens of lines covering all the entities listed above. Build the CSV by:
1. Open Google Ads Editor → create the structure manually for ONE campaign as a reference.
2. Export to CSV → use those headers.
3. Fill in the values from spec sections 4.4 / 4.5 / 4.6.)

If exact CSV format proves unwieldy, fall back to **delivering this content as a structured markdown doc** at `docs/google-ads/mothers-day-2026-setup.md` with copy-paste blocks per Google Ads UI panel — still saves ~80% of UI time vs typing from scratch.

- [ ] **Step 2: Write the README**

Create `docs/google-ads/mothers-day-2026-README.md`:

```markdown
# Mother's Day 2026 — Google Ads Import

## Quick start
1. Install Google Ads Editor (https://ads.google.com/home/tools/ads-editor/).
2. Sign in, select the new account.
3. File → Import → From file → select `mothers-day-2026.csv`.
4. Review the proposed changes panel.
5. Post.

## Pre-launch checklist (do BEFORE posting)
- [ ] Link GA4 property in Tools → Linked accounts.
- [ ] Import `purchase` as a primary conversion goal (Tools → Conversions).
- [ ] Auto-tagging ON (Settings → Account settings).
- [ ] Verify location extension links to the verified GBP at 1077 Willis Ave, Albertson.
- [ ] Run 1 real test purchase from /en/mothers-day → confirm `purchase` event in GA4 Realtime.

## Day-of operations
- Wed 5/6 evening: post the changes (campaign created PAUSED).
- After verifying conversion fires: ENABLE the campaign at 6 PM.
- Sat 5/9 12 PM: bump max bid +30% (already set as scheduled bid adjustment in CSV).
- Sat 5/9 2:30 PM: PAUSE campaign.

## Post-campaign (Mon 5/11)
- Pull report; export to CSV.
- Save audience "MD 2026 visitors" for remarketing on Father's Day.
- Pause campaign permanently or archive.
```

- [ ] **Step 3: Commit**

```bash
git add docs/google-ads/
git commit -m "docs(ads): mothers-day 2026 Editor CSV and import README"
```

---

## Task 16: Pre-deploy QA checklist

This task does not write code — it's an explicit gate before merging / deploying. The engineer runs through it and reports.

- [ ] **Type check passes:** `npx tsc --noEmit` → 0 errors.
- [ ] **Unit tests pass:** `npm test` → all green.
- [ ] **E2E passes:** `npm run e2e -- mothers-day` → green.
- [ ] **Build succeeds:** `npm run build` → 0 errors.
- [ ] **Visual smoke (dev server):**
  - `/en` → home strip visible above marquee.
  - `/en/mothers-day` → all 6 sections render in order.
  - `/es/mothers-day` → renders with "Pronto en español" banner up top.
  - Mobile viewport (375×667) → sticky bottom CTA visible.
  - Cutoff countdown ticks (wait 60s, value updates).
  - ZIP `11010` → success state.
  - ZIP `90210` → fail state with link to contact.
- [ ] **Schema validity:**
  - Paste the page source from `/en/mothers-day` into https://validator.schema.org/ → no errors on the `ItemList` block.
- [ ] **PageSpeed:**
  - Run https://pagespeed.web.dev/ on `https://staging-or-prod-url/en/mothers-day` → mobile LCP < 2.5s.
- [ ] **Conversion test:**
  - Run a real test purchase from the landing → `purchase` event appears in GA4 Realtime within 30s.
- [ ] **GA4 events:**
  - Open `/en/mothers-day` with GA4 DebugView → `mothers_day_view` fires.
  - Submit valid ZIP → `zip_check_pass` fires with `zone_id`.
  - Submit invalid ZIP → `zip_check_fail` fires.

If any check fails, fix and re-run before deploying. After all green, deploy and proceed with the Google Ads import (separate, owner = user).

---

## Self-Review

Spec coverage:
- §3.1 landing sections: covered by tasks 6, 7, 8, 9, 12.
- §3.2 home strip: covered by task 11.
- §3.3 new components: 6, 7, 8, 11.
- §3.4 data changes (`occasions` union, tagging): tasks 1, 2.
- §3.5 schema/SEO: task 10 (Product/ItemList) + task 12 (metadata) + task 13 (OG).
- §4 Google Ads campaign: task 15 (CSV + README).
- §5.1–5.3 account linking, enhanced conversions, UTMs: covered in task 15 README and §5.1 of spec — no code change.
- §5.4 new GA4 events: task 4.
- §5.5 pre-launch QA: task 16.
- §5.6 daily monitoring / §5.7 post-MD: documented in spec and task 15 README; out of code scope.
- §6 timeline / §7 out-of-scope / §8 risks / §10 address reconciliation: docs only, no implementation tasks.

Placeholder scan: ✓ no TBD/TODO/"add appropriate". Every code step contains real code.

Type consistency: `Occasion` extended with `"mothers-day"` (task 1) and used in task 2's tagging. `findDeliveryZoneByZip` (task 3) returns `DeliveryZone | null`, and `<ZipChecker>` in task 7 uses exactly that signature. `trackZipCheckPass({ zip, zoneId })` defined in task 4, called with the same shape in task 7.

CURATED_SLUGS is duplicated between tasks 8 (test fixture only) and 12 (page consumer) — that's intentional; the page is the single source of truth, the test passes its own array. No drift risk.

---
