# Mother's Day Home Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dismissible Mother's Day strip on the homepage with a prominent dark-themed commercial showcase (4 curated products + live countdown + CTA to `/mothers-day`) that retires automatically at the Sunday 6 PM ET cutoff.

**Architecture:** One server component (`MothersDayHomeShowcase`) composes the section. Two small client islands handle the live countdown and the view-tracker (IntersectionObserver). Visibility is gated by a single timestamp constant; after the cutoff the server component returns `null` and the home reverts to its evergreen flow with no other code change.

**Tech Stack:** Next.js 15 (app router, server components), next-intl (translations live in `messages/en.json` and `messages/es.json`), Tailwind, vitest + @testing-library/react.

**Spec:** [docs/superpowers/specs/2026-05-06-md-home-showcase-design.md](../specs/2026-05-06-md-home-showcase-design.md)

---

## File Structure

| File | Type | Responsibility |
|---|---|---|
| `messages/en.json` | modify | Add `mothers_day.home_showcase.*` keys |
| `messages/es.json` | modify | Add `mothers_day.home_showcase.*` keys (parity) |
| `lib/analytics.ts` | modify | Add `trackMothersDayHomeShowcaseView` + `trackMothersDayHomeShowcaseCtaClick` |
| `lib/mothers-day-countdown.ts` | create | Pure formatting helpers — `getRemainingMs`, `formatCountdown` |
| `components/mothers-day/MothersDayHomeCountdown.tsx` | create | Client island — live countdown chip |
| `components/mothers-day/MothersDayHomeShowcaseTracker.tsx` | create | Client island — fires `view_md_home_showcase` once per session via IntersectionObserver |
| `components/mothers-day/MothersDayHomeShowcase.tsx` | create | Server component — title block, countdown, 4-card dark grid, CTA |
| `app/[locale]/page.tsx` | modify | Remove `MothersDayHomeStrip` import + use; insert `MothersDayHomeShowcase` after `<Hero />` |
| `tests/unit/analytics.test.ts` | modify | Cover the 2 new tracking functions |
| `tests/unit/mothers-day-countdown.test.ts` | create | Cover formatting branches and remaining-ms calc |
| `tests/unit/MothersDayHomeShowcase.test.tsx` | create | Visibility (before/after cutoff), product resolution |

`components/mothers-day/MothersDayHomeStrip.tsx` is left in place but unused; deletion is deferred to a post-MD cleanup PR per the spec.

---

## Task 1: Add i18n keys for the home showcase

**Files:**
- Modify: `messages/en.json` (after line 862, inside the `mothers_day` block)
- Modify: `messages/es.json` (parallel position, parity required)

The existing key parity test (`tests/unit/i18n-keys.test.ts`) will fail if EN and ES drift. We add identical key paths in both files in the same task so parity is never broken at HEAD.

- [ ] **Step 1: Add the EN keys**

In `messages/en.json`, locate the `mothers_day` block (starts at line 825). Inside that block, after the `home_strip_dismiss` entry (line 862), add:

```json
    "home_showcase": {
      "eyebrow": "Mother's Day · May 10",
      "title_lead": "For her,",
      "title_emph": "before Sunday.",
      "sub": "Hand-tied arrangements, delivered across Long Island.",
      "countdown_placeholder": "—d —h · order until Sun 6 PM",
      "countdown_days": "{days}d {hours}h · order until Sun 6 PM",
      "countdown_hours": "{hours}h {minutes}m left · order until Sun 6 PM",
      "cta": "View the full Mother's Day collection"
    },
```

(Note: `title_lead` + `title_emph` are split so the emphasised half can be rendered in italic without HTML in the translation string.)

- [ ] **Step 2: Add the ES keys**

In `messages/es.json`, in the same position inside the `mothers_day` block, add:

```json
    "home_showcase": {
      "eyebrow": "Día de la Madre · 10 de mayo",
      "title_lead": "Para ella,",
      "title_emph": "antes del domingo.",
      "sub": "Arreglos hechos a mano, entregados en todo Long Island.",
      "countdown_placeholder": "—d —h · pedidos hasta domingo 6 PM",
      "countdown_days": "{days}d {hours}h · pedidos hasta domingo 6 PM",
      "countdown_hours": "{hours}h {minutes}m · pedidos hasta domingo 6 PM",
      "cta": "Ver la colección completa"
    },
```

- [ ] **Step 3: Run the i18n parity test**

Run: `pnpm vitest run tests/unit/i18n-keys.test.ts`
Expected: PASS — keys are identical in both files.

If FAIL: re-check both blocks have the exact same key paths and trailing commas are correct.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(mothers-day): add home_showcase keys (en/es)"
```

---

## Task 2: Add the two analytics tracking functions

**Files:**
- Modify: `lib/analytics.ts:152-167` (the Mother's Day campaign block)
- Modify: `tests/unit/analytics.test.ts`

Two events per the spec: `view_md_home_showcase` and `click_md_home_showcase_cta`. They follow the existing `trackMothersDayView` pattern — thin wrappers over `pushDataLayer`.

- [ ] **Step 1: Write failing tests**

In `tests/unit/analytics.test.ts`, add to the imports block (around line 30):

```ts
import {
  trackMothersDayView,
  trackZipCheckPass,
  trackZipCheckFail,
  trackCutoffBannerClick,
  trackMothersDayHomeShowcaseView,
  trackMothersDayHomeShowcaseCtaClick,
} from "@/lib/analytics";
```

(Replace the existing `trackMothersDayView, trackZipCheckPass, …` import block with the expanded one above.)

Then, in the same file, add a new `describe` block at the end (before the final closing brace of the file):

```ts
describe("Mother's Day home showcase events", () => {
  beforeEach(() => {
    window.dataLayer = [];
    vi.spyOn(consent, "hasConsent").mockReturnValue(true);
  });

  it("trackMothersDayHomeShowcaseView pushes view_md_home_showcase", () => {
    trackMothersDayHomeShowcaseView();
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toEqual({ event: "view_md_home_showcase" });
  });

  it("trackMothersDayHomeShowcaseCtaClick pushes click_md_home_showcase_cta", () => {
    trackMothersDayHomeShowcaseCtaClick();
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0]).toEqual({ event: "click_md_home_showcase_cta" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/analytics.test.ts -t "home showcase"`
Expected: FAIL — `trackMothersDayHomeShowcaseView is not a function` (or import resolution error).

- [ ] **Step 3: Add the two functions in `lib/analytics.ts`**

At the end of `lib/analytics.ts` (after `trackCutoffBannerClick`, line 167), append:

```ts
export function trackMothersDayHomeShowcaseView(): void {
  pushDataLayer({ event: "view_md_home_showcase" });
}

export function trackMothersDayHomeShowcaseCtaClick(): void {
  pushDataLayer({ event: "click_md_home_showcase_cta" });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/analytics.test.ts -t "home showcase"`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): home showcase view + cta tracking"
```

---

## Task 3: Pure countdown formatting helper

**Files:**
- Create: `lib/mothers-day-countdown.ts`
- Create: `tests/unit/mothers-day-countdown.test.ts`

Extract countdown math + formatting from the React component so it can be tested as a pure function. Keeps the React island tiny.

The deadline `2026-05-10T18:00:00-04:00` (Sun 6 PM ET) equals `Date.UTC(2026, 4, 10, 22, 0, 0)` — same instant. We use the UTC literal as the canonical source of truth.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/mothers-day-countdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CUTOFF_AT_UTC_MS,
  getRemainingMs,
  formatCountdownParts,
} from "@/lib/mothers-day-countdown";

describe("mothers-day-countdown", () => {
  it("CUTOFF_AT_UTC_MS equals Sun May 10 2026 6 PM ET", () => {
    expect(CUTOFF_AT_UTC_MS).toBe(Date.UTC(2026, 4, 10, 22, 0, 0));
    // Same instant as 2026-05-10T18:00:00-04:00
    expect(CUTOFF_AT_UTC_MS).toBe(new Date("2026-05-10T18:00:00-04:00").getTime());
  });

  it("getRemainingMs returns positive ms before cutoff", () => {
    const now = Date.UTC(2026, 4, 6, 22, 0, 0); // 4 days before cutoff
    expect(getRemainingMs(now)).toBe(4 * 24 * 60 * 60 * 1000);
  });

  it("getRemainingMs returns 0 at or after cutoff", () => {
    expect(getRemainingMs(CUTOFF_AT_UTC_MS)).toBe(0);
    expect(getRemainingMs(CUTOFF_AT_UTC_MS + 1)).toBe(0);
  });

  it("formatCountdownParts uses days+hours branch when >= 24h remain", () => {
    const ms = (4 * 24 + 2) * 60 * 60 * 1000; // 4d 2h
    expect(formatCountdownParts(ms)).toEqual({ kind: "days", days: 4, hours: 2 });
  });

  it("formatCountdownParts uses hours+minutes branch when < 24h remain", () => {
    const ms = (6 * 60 + 30) * 60 * 1000; // 6h 30m
    expect(formatCountdownParts(ms)).toEqual({ kind: "hours", hours: 6, minutes: 30 });
  });

  it("formatCountdownParts returns kind:expired when ms <= 0", () => {
    expect(formatCountdownParts(0)).toEqual({ kind: "expired" });
    expect(formatCountdownParts(-100)).toEqual({ kind: "expired" });
  });

  it("formatCountdownParts floors to whole units", () => {
    // 23h 59m 59s → still under 24h, hours+minutes branch with 23h 59m
    const ms = 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000;
    expect(formatCountdownParts(ms)).toEqual({ kind: "hours", hours: 23, minutes: 59 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/mothers-day-countdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `lib/mothers-day-countdown.ts`:

```ts
export const CUTOFF_AT_UTC_MS = Date.UTC(2026, 4, 10, 22, 0, 0); // Sun May 10 2026, 6 PM ET (UTC-4)

export function getRemainingMs(now: number): number {
  return Math.max(0, CUTOFF_AT_UTC_MS - now);
}

export type CountdownParts =
  | { kind: "days"; days: number; hours: number }
  | { kind: "hours"; hours: number; minutes: number }
  | { kind: "expired" };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function formatCountdownParts(remainingMs: number): CountdownParts {
  if (remainingMs <= 0) return { kind: "expired" };
  if (remainingMs >= DAY_MS) {
    const days = Math.floor(remainingMs / DAY_MS);
    const hours = Math.floor((remainingMs - days * DAY_MS) / HOUR_MS);
    return { kind: "days", days, hours };
  }
  const hours = Math.floor(remainingMs / HOUR_MS);
  const minutes = Math.floor((remainingMs - hours * HOUR_MS) / (60 * 1000));
  return { kind: "hours", hours, minutes };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/mothers-day-countdown.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/mothers-day-countdown.ts tests/unit/mothers-day-countdown.test.ts
git commit -m "feat(mothers-day): countdown formatting helper"
```

---

## Task 4: Countdown client island

**Files:**
- Create: `components/mothers-day/MothersDayHomeCountdown.tsx`

A small client component that renders the countdown chip. Reads `useTranslations("mothers_day.home_showcase")`, computes parts via the helper, updates every 60 seconds. SSR renders the placeholder string (`countdown_placeholder` key) so first paint matches first hydration.

- [ ] **Step 1: Implement the component**

Create `components/mothers-day/MothersDayHomeCountdown.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  formatCountdownParts,
  getRemainingMs,
} from "@/lib/mothers-day-countdown";

export function MothersDayHomeCountdown() {
  const t = useTranslations("mothers_day.home_showcase");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  let label = t("countdown_placeholder");
  if (now !== null) {
    const parts = formatCountdownParts(getRemainingMs(now));
    if (parts.kind === "days") {
      label = t("countdown_days", { days: parts.days, hours: parts.hours });
    } else if (parts.kind === "hours") {
      label = t("countdown_hours", { hours: parts.hours, minutes: parts.minutes });
    }
    // kind === "expired": parent server component already returned null at the cutoff;
    // if we somehow hit this client-side after cutoff, fall through to the placeholder.
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-bone/15 bg-charcoal/40 px-4 py-2 font-mono text-[11px] tracking-[0.05em] text-bone backdrop-blur-sm"
      role="timer"
      aria-live="off"
      aria-atomic="true"
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles via type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors related to the new file. (Other unrelated TS errors pre-existing in the project should be ignored — confirm none come from `MothersDayHomeCountdown.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/mothers-day/MothersDayHomeCountdown.tsx
git commit -m "feat(mothers-day): live countdown chip client island"
```

---

## Task 5: View-tracker client island

**Files:**
- Create: `components/mothers-day/MothersDayHomeShowcaseTracker.tsx`

Fires the `view_md_home_showcase` event once per browser session when the section enters the viewport. Uses `IntersectionObserver` (50% threshold) and a `sessionStorage` flag for the once-per-session guarantee.

- [ ] **Step 1: Implement the tracker**

Create `components/mothers-day/MothersDayHomeShowcaseTracker.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import { trackMothersDayHomeShowcaseView } from "@/lib/analytics";

const SESSION_KEY = "md-home-showcase-viewed";

export function MothersDayHomeShowcaseTracker() {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY)) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackMothersDayHomeShowcaseView();
            window.sessionStorage.setItem(SESSION_KEY, "1");
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return <div ref={sentinelRef} aria-hidden className="h-0 w-0" />;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no new errors from `MothersDayHomeShowcaseTracker.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/mothers-day/MothersDayHomeShowcaseTracker.tsx
git commit -m "feat(mothers-day): home showcase view tracker (session-gated)"
```

---

## Task 6: Main showcase server component (with tests)

**Files:**
- Create: `components/mothers-day/MothersDayHomeShowcase.tsx`
- Create: `tests/unit/MothersDayHomeShowcase.test.tsx`

Composes the section. Returns `null` after the cutoff or when fewer than 2 curated products resolve. Renders eyebrow, two-line title, sub, countdown island, 4-card dark grid (links direct to PDPs), CTA pill linking to `/[locale]/mothers-day`, and the view-tracker island.

The server component is async (`await getTranslations(...)`). Tests treat it as a function: `const result = await MothersDayHomeShowcase({ locale: "en" })`, then `render(result)`.

### Curated slugs (top of file constant)
```ts
const SHOWCASE_SLUGS = [
  "angels-touch",
  "blush-enchantment",
  "pastel-poetry",
  "wildflower-meadow",
];
```

- [ ] **Step 1: Write failing tests**

Create `tests/unit/MothersDayHomeShowcase.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { CUTOFF_AT_UTC_MS } from "@/lib/mothers-day-countdown";

// Mock next-intl/server before importing the SUT
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

// Mock the islands so we can assert composition without their internals
vi.mock("@/components/mothers-day/MothersDayHomeCountdown", () => ({
  MothersDayHomeCountdown: () => <span data-testid="countdown" />,
}));
vi.mock("@/components/mothers-day/MothersDayHomeShowcaseTracker", () => ({
  MothersDayHomeShowcaseTracker: () => <span data-testid="tracker" />,
}));

import { MothersDayHomeShowcase } from "@/components/mothers-day/MothersDayHomeShowcase";

describe("MothersDayHomeShowcase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set "now" to 4 days before cutoff (2026-05-06 22:00Z)
    vi.setSystemTime(new Date(CUTOFF_AT_UTC_MS - 4 * 24 * 60 * 60 * 1000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the section before the cutoff", async () => {
    const result = await MothersDayHomeShowcase({ locale: "en" });
    const { container, getByTestId } = render(result as React.ReactElement);
    expect(container.querySelector("section")).not.toBeNull();
    expect(getByTestId("countdown")).toBeDefined();
    expect(getByTestId("tracker")).toBeDefined();
  });

  it("renders 4 product links to PDPs", async () => {
    const result = await MothersDayHomeShowcase({ locale: "en" });
    const { container } = render(result as React.ReactElement);
    const productLinks = container.querySelectorAll('a[href^="/en/product/"]');
    expect(productLinks.length).toBe(4);
  });

  it("renders a CTA link to the mothers-day hub", async () => {
    const result = await MothersDayHomeShowcase({ locale: "en" });
    const { container } = render(result as React.ReactElement);
    const ctaLink = container.querySelector('a[href="/en/mothers-day"]');
    expect(ctaLink).not.toBeNull();
  });

  it("returns null at or after the cutoff", async () => {
    vi.setSystemTime(new Date(CUTOFF_AT_UTC_MS));
    const result = await MothersDayHomeShowcase({ locale: "en" });
    expect(result).toBeNull();
  });

  it("renders ES locale links", async () => {
    const result = await MothersDayHomeShowcase({ locale: "es" });
    const { container } = render(result as React.ReactElement);
    expect(container.querySelector('a[href="/es/mothers-day"]')).not.toBeNull();
    expect(container.querySelectorAll('a[href^="/es/product/"]').length).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/unit/MothersDayHomeShowcase.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the server component**

Create `components/mothers-day/MothersDayHomeShowcase.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import { startingPriceCents } from "@/data/product-helpers";
import { formatMoneyCents } from "@/lib/format";
import { CUTOFF_AT_UTC_MS } from "@/lib/mothers-day-countdown";
import { MothersDayHomeCountdown } from "./MothersDayHomeCountdown";
import { MothersDayHomeShowcaseTracker } from "./MothersDayHomeShowcaseTracker";

const SHOWCASE_SLUGS = [
  "angels-touch",
  "blush-enchantment",
  "pastel-poetry",
  "wildflower-meadow",
];

type Props = { locale: Locale };

export async function MothersDayHomeShowcase({ locale }: Props) {
  if (Date.now() >= CUTOFF_AT_UTC_MS) return null;

  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));
  const products = SHOWCASE_SLUGS
    .map((s) => bySlug.get(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.active));

  if (products.length < 2) return null;

  const t = await getTranslations({ locale, namespace: "mothers_day.home_showcase" });

  return (
    <section
      className="relative isolate border-t border-rouge/20 bg-charcoal py-20 md:py-28"
      aria-labelledby="md-home-showcase-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 15% 0%, rgba(184,52,94,0.25) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-rouge">
          {t("eyebrow")}
        </span>

        <h2
          id="md-home-showcase-title"
          className="mt-3 max-w-3xl font-display text-5xl leading-[0.95] text-bone md:text-6xl lg:text-7xl"
        >
          <span>{t("title_lead")}</span>{" "}
          <em className="font-light italic text-bone/95">{t("title_emph")}</em>
        </h2>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-bone/80">
          {t("sub")}
        </p>

        <div className="mt-7">
          <MothersDayHomeCountdown />
        </div>

        <ul
          role="list"
          className="mt-12 grid grid-cols-2 gap-4 md:mt-14 md:grid-cols-4 md:gap-5"
        >
          {products.map((p) => {
            const cover = p.images[0];
            const price = formatMoneyCents(startingPriceCents(p), locale);
            return (
              <li key={p.id}>
                <Link
                  href={`/${locale}/product/${p.slug}`}
                  className="group block overflow-hidden rounded-xl border border-bone/10 bg-bone/5 transition-colors hover:bg-bone/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bone"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {cover ? (
                      <Image
                        src={cover.src}
                        alt={cover.alt[locale]}
                        fill
                        sizes="(min-width: 768px) 22vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-baseline justify-between gap-3 p-3 md:p-4">
                    <h3 className="truncate font-display text-base text-bone md:text-lg">
                      {p.title[locale]}
                    </h3>
                    <span className="shrink-0 font-mono text-xs text-bone/70">
                      {price}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-12 flex justify-center md:mt-14">
          <Link
            href={`/${locale}/mothers-day`}
            className="inline-flex items-center gap-2 rounded-full border border-bone/40 px-7 py-3.5 font-sans text-sm text-bone transition-colors hover:bg-bone hover:text-ink"
          >
            {t("cta")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <MothersDayHomeShowcaseTracker />
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm vitest run tests/unit/MothersDayHomeShowcase.test.tsx`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add components/mothers-day/MothersDayHomeShowcase.tsx tests/unit/MothersDayHomeShowcase.test.tsx
git commit -m "feat(mothers-day): home showcase server component"
```

---

## Task 7: Wire the showcase into the homepage; remove the strip

**Files:**
- Modify: `app/[locale]/page.tsx:15` and `app/[locale]/page.tsx:46`

- [ ] **Step 1: Replace the strip import**

In `app/[locale]/page.tsx`, find line 15:

```tsx
import { MothersDayHomeStrip } from "@/components/mothers-day/MothersDayHomeStrip";
```

Replace with:

```tsx
import { MothersDayHomeShowcase } from "@/components/mothers-day/MothersDayHomeShowcase";
```

- [ ] **Step 2: Replace the JSX usage**

In the same file, find line 46:

```tsx
      <MothersDayHomeStrip locale={locale} />
```

Replace with:

```tsx
      <MothersDayHomeShowcase locale={locale} />
```

The new module sits in the same JSX position (between `<Hero />` and `<KineticMarquee />`), matching the spec's "right after Hero, before marquee" decision.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

Run: `pnpm lint` (if `lint` script exists in package.json)
Expected: no new errors.

- [ ] **Step 4: Run the full unit test suite**

Run: `pnpm vitest run`
Expected: PASS — including the i18n parity test, analytics tests, countdown tests, and showcase tests.

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/page.tsx
git commit -m "feat(mothers-day): swap home strip for showcase module"
```

---

## Task 8: Manual QA in the browser

**Files:** none modified — verification only.

Per the project guidance ("For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete"), this task is mandatory before claiming the work done.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Expected: server up on http://localhost:3000.

- [ ] **Step 2: Verify EN homepage**

Open http://localhost:3000/en. Confirm:
- Hero unchanged.
- Below the hero, dark section with rouge accent renders.
- Eyebrow reads "Mother's Day · May 10".
- Title is two-line; second line is italic.
- Countdown chip shows real days/hours remaining.
- 4 product cards render in 4-column desktop grid; each card links to its PDP (hover → check link target in dev tools).
- CTA pill at the bottom links to `/en/mothers-day`.
- Old red dismissible strip is gone.
- Below the showcase: marquee, bento, etc. — all unchanged.

- [ ] **Step 3: Verify ES homepage**

Open http://localhost:3000/es. Confirm:
- Eyebrow reads "Día de la Madre · 10 de mayo".
- Title reads "Para ella, antes del domingo." with the second fragment italic.
- Countdown copy uses ES strings.
- CTA links to `/es/mothers-day`.

- [ ] **Step 4: Verify mobile layout**

Toggle responsive mode (375px wide). Confirm:
- Section padding reduced.
- Product grid is 2×2.
- Title scales down readably; countdown still legible against background.

- [ ] **Step 5: Verify analytics fire**

Open DevTools → Application → sessionStorage (under `localhost`).

Reload `/en`. Scroll the showcase into view. Confirm:
- `window.dataLayer` (Console: `dataLayer`) contains a `view_md_home_showcase` event.
- `sessionStorage` has `md-home-showcase-viewed = "1"`.

Click the bottom CTA. Confirm:
- `dataLayer` now also contains `click_md_home_showcase_cta`.

Reload again. Confirm:
- No second `view_md_home_showcase` event (session-gated).

(If consent is denied in the consent banner, no events fire — that's expected behavior of `pushDataLayer`.)

- [ ] **Step 6: Verify cutoff hide**

In DevTools → Sources → click the clock icon (or use `Date.now` override via console patch), set system time to 2026-05-10T22:00:01Z (1 second after cutoff). Reload `/en`. Confirm:
- The showcase section is gone.
- Marquee + bento + rest of home render normally directly under the hero.

Easier alternative: temporarily edit `lib/mothers-day-countdown.ts` to set `CUTOFF_AT_UTC_MS = Date.now() - 1000`, reload, confirm null render, then revert the file. **Do not commit the temporary edit.**

- [ ] **Step 7: Stop the dev server**

Ctrl-C the `pnpm dev` process.

- [ ] **Step 8: Final verification commit (optional)**

If any cosmetic adjustments came up during manual QA, commit them as a follow-up:

```bash
git add <files>
git commit -m "fix(mothers-day): <specific tweak from QA>"
```

If nothing changed, no commit needed.

---

## Self-Review Notes

Spec coverage check: every section of the design spec maps to a task in this plan.

| Spec section | Implementing task |
|---|---|
| Architecture / new files | Tasks 3, 4, 5, 6 |
| Architecture / modified files | Tasks 1, 2, 7 |
| Layout (visual treatment) | Task 6 (component implementation) |
| Content / curated products | Task 6 (`SHOWCASE_SLUGS` constant) |
| Content / i18n keys (EN + ES) | Task 1 |
| Behavior / visibility window | Task 6 (server-side cutoff) + Task 4 (countdown helper) |
| Behavior / countdown branches | Task 3 (helper) + Task 4 (component) |
| Behavior / SSR placeholder | Task 4 (placeholder text on first paint) |
| Behavior / edge cases (missing slug, <2 products) | Task 6 (filter + null short-circuit) |
| Analytics / `view_md_home_showcase` | Task 2 (function) + Task 5 (tracker fires it) |
| Analytics / `click_md_home_showcase_cta` | Task 2 (function) — *wired into the CTA in Task 6 — see Step 3 below* |
| Testing / unit | Tasks 2, 3, 6 |
| Testing / manual QA | Task 8 |

**Gap caught in self-review:** Task 6's CTA `<Link>` does not invoke `trackMothersDayHomeShowcaseCtaClick`. Since the function is server-side (`<Link>` itself is a client primitive but the surrounding component is a server component), we need the click handler in a tiny client wrapper. Fix below.

### Task 6 (correction): wrap the CTA in a client component to fire the click event

Add to the **end of Task 6**, after Step 5:

- [ ] **Step 6: Add a CTA client wrapper**

Create `components/mothers-day/MothersDayHomeShowcaseCta.tsx`:

```tsx
"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { trackMothersDayHomeShowcaseCtaClick } from "@/lib/analytics";

type Props = {
  href: string;
  children: ReactNode;
};

export function MothersDayHomeShowcaseCta({ href, children }: Props) {
  return (
    <Link
      href={href}
      onClick={() => trackMothersDayHomeShowcaseCtaClick()}
      className="inline-flex items-center gap-2 rounded-full border border-bone/40 px-7 py-3.5 font-sans text-sm text-bone transition-colors hover:bg-bone hover:text-ink"
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 7: Use it in `MothersDayHomeShowcase.tsx`**

In `components/mothers-day/MothersDayHomeShowcase.tsx`, replace the existing CTA block:

```tsx
        <div className="mt-12 flex justify-center md:mt-14">
          <Link
            href={`/${locale}/mothers-day`}
            className="inline-flex items-center gap-2 rounded-full border border-bone/40 px-7 py-3.5 font-sans text-sm text-bone transition-colors hover:bg-bone hover:text-ink"
          >
            {t("cta")}
            <span aria-hidden>→</span>
          </Link>
        </div>
```

with:

```tsx
        <div className="mt-12 flex justify-center md:mt-14">
          <MothersDayHomeShowcaseCta href={`/${locale}/mothers-day`}>
            {t("cta")}
            <span aria-hidden>→</span>
          </MothersDayHomeShowcaseCta>
        </div>
```

And add the import at the top:

```tsx
import { MothersDayHomeShowcaseCta } from "./MothersDayHomeShowcaseCta";
```

(Remove the `import Link from "next/link"` if no other `<Link>` remains in the file. Note: there are still `<Link>` usages in the product grid, so keep the import.)

- [ ] **Step 8: Re-run showcase tests**

Run: `pnpm vitest run tests/unit/MothersDayHomeShowcase.test.tsx`
Expected: PASS — the existing tests still match (the CTA selector queries `a[href="/en/mothers-day"]`, and the new client wrapper still renders an `<a>` underneath).

- [ ] **Step 9: Amend / new commit**

```bash
git add components/mothers-day/MothersDayHomeShowcaseCta.tsx components/mothers-day/MothersDayHomeShowcase.tsx
git commit -m "feat(mothers-day): cta click tracking via client wrapper"
```

---

## Definition of done (matches spec)

- ✅ `MothersDayHomeShowcase` renders below `<Hero />` on `/en` and `/es` before cutoff.
- ✅ `MothersDayHomeStrip` no longer imported/rendered on the home page.
- ✅ 4 curated products visible, each linking to its PDP.
- ✅ Countdown updates live; placeholder shown during SSR.
- ✅ After 2026-05-10T22:00:00Z, module returns `null` and home is unchanged.
- ✅ Both view and CTA-click analytics events fire.
- ✅ Unit tests pass; manual QA in EN/ES, mobile/desktop verified.
