# Plan 4 — Quality, A11y, SEO & Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Diva Flowers v1 from "feature-complete" to "launch-ready" by closing every gap between current state and the spec's Definition of Done (§12), with content placeholders centralized for future client swaps.

**Architecture:** Audit-driven sweep. Phase 1 produces a written audit committed to git. Phase 2 has eight execution tasks (one per audit category) that read the audit, fix findings, and append `→ FIXED in <sha>` to closed bullets. Phase 3 runs final verification.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Framer Motion · next-intl · Zustand · Vitest · Playwright · `@axe-core/playwright` (added in Task 2.3).

**Spec reference:** `docs/superpowers/specs/2026-05-01-plan-4-design.md`.

**Discipline:**
- DRY, YAGNI, TDD where applicable.
- Single commit per task (or per logical sub-group when a task spans many files).
- Plan 4 must not ship with red tests. Every task ends with `npm test` (and `npm run e2e` if e2e was touched) green.
- Per-category scope-creep guard: if the audit finds > 10 fixes in a category, defer "nice-to-have" subset to v2 with rationale recorded in the audit doc.

---

## Phase 1 — Audit

### Task 1: Write the launch-readiness audit

**Files:**
- Create: `docs/superpowers/audits/2026-05-01-plan-4-audit.md`

The audit walks the spec DoD section by section and records every finding as a bullet:

```
- <STATUS> — <spec ref> — <location> — <one-line note>
```

`STATUS` ∈ `OK | PARTIAL | MISSING | DEFER`.

- [ ] **Step 1: Create audit doc skeleton**

Write the file at `docs/superpowers/audits/2026-05-01-plan-4-audit.md` with this exact skeleton (one section per Phase 2 category):

```md
# Plan 4 — Launch-Readiness Audit

**Date:** 2026-05-01
**Spec:** docs/superpowers/specs/2026-05-01-plan-4-design.md
**Source-of-truth spec:** docs/superpowers/specs/2026-04-30-diva-flowers-design.md

Each finding: `<STATUS> — <spec ref> — <location> — <note>`. Statuses are appended `→ FIXED in <sha>` or `→ DEFERRED to v2: <reason>` as Phase 2 tasks ship.

## 2.1 Content centralization

## 2.2 Motion coverage

## 2.3 A11y fixes

## 2.4 SEO + structured data

## 2.5 Empty / loading / error states

## 2.6 Taste-skill pre-flight

## 2.7 Perf pass (baseline)

## 2.8 i18n gap sweep

## Lighthouse scores (recorded after Task 2.7)

| Page | Perf | A11y | Best practices | SEO |
|---|---|---|---|---|
| /en | – | – | – | – |
| /en/shop/arrangements | – | – | – | – |
| /en/product/<slug> | – | – | – | – |
```

- [ ] **Step 2: Audit content centralization (§2.1)**

Run each grep and record findings. Known baseline (from pre-plan investigation): hero tagline placeholder lives at `app/layout.tsx:31` and `messages/{en,es}.json` key `home.hero.title`; marquee tokens live in `messages/{en,es}.json` key `home.hero.marquee`; everything else (`founded`, `phone`, `address`, `cutoffTime`) is already in `data/site.ts`.

```bash
grep -rn "DESDE 2014\|2:00 PM\|Romance, by the stem\|Romance, tallo a tallo\|516 484 3456\|1077 Hempstead" app components messages
grep -rn "SAME-DAY DELIVERY\|ENVÍOS HOY" app components
```

Append findings under `## 2.1 Content centralization`. Example bullet for the known case:

```
- MISSING — §13 hero tagline — app/layout.tsx:31 — `metadata.title` hardcoded "Diva Flowers — Romance, by the stem."; should read from SITE
- OK      — §13 phone        — already centralized in data/site.ts
- OK      — §13 founding year — already centralized in data/site.ts
- OK      — §13 same-day cutoff — already centralized in data/site.ts as `cutoffTime` + `cutoff24`
```

- [ ] **Step 3: Audit motion coverage (§2.2)**

For each motion primitive in spec §4.3, list where it's applied vs. where it's spec'd to be applied.

```bash
grep -rln "MagneticButton" components app
grep -rln "BloomImage" components app
grep -rln "StaggerGroup" components app
grep -rln "KineticMarquee" components app
grep -rln "Grain" components app
grep -rln "ArchSVG" components app
```

For each spec'd location, check whether it's wired:
- Magnetic CTAs: home hero, weddings hero, events hero, PDP "Add to bag", inquiry submit buttons.
- Bloom hover: product cards on `/shop/*` and PDP "Pairs well with" strip.
- Stagger reveal: home Bento, category grid mount, PDP "Pairs well with", journal index.
- Grain: hero, sympathy pages, journal pages only.
- Arch SVG: home hero photo frame, home Bento featured tile, between major sections.

Append findings under `## 2.2 Motion coverage`.

- [ ] **Step 4: Audit a11y (§2.3)**

```bash
grep -rEn "<h1\b" app components | wc -l              # rough single-H1-per-page check
grep -rn 'alt=""' app components                      # empty alts (intentional? otherwise flag)
grep -rEn "aria-(label|describedby|controls)" components/cart components/checkout components/inquiry | head -30
grep -rEn 'role="button"' components app              # role abuses
grep -rn "tabIndex" components app                    # tabindex traps
```

Manual checks (record per page):
- Tab order makes sense on home, /shop, PDP, /checkout, /weddings.
- Focus rings visible (`rouge` per spec §4.1).
- All images have non-empty alt text in EN and ES.
- Single H1 per page.
- Reduced-motion: confirm `motion-config.ts` is consulted by every motion primitive.

Append findings under `## 2.3 A11y fixes`.

- [ ] **Step 5: Audit SEO + structured data (§2.4)**

Known baseline: `components/product/PdpStructuredData.tsx` adds `Product` JSON-LD on PDP. No `LocalBusiness`, no `BreadcrumbList`, no per-template `opengraph-image.tsx`, no `app/robots.ts`.

```bash
find app -name "opengraph-image*"
find app -name "robots*"
find app -name "sitemap*"
grep -rn "application/ld+json" app components
grep -rn "export const metadata\|export async function generateMetadata" app | head -40
```

Walk every route in spec §3 and confirm it has `export const metadata` or `generateMetadata`. Append findings under `## 2.4 SEO + structured data`.

- [ ] **Step 6: Audit empty / loading / error states (§2.5)**

```bash
find app -name "loading.tsx"
find app -name "error.tsx"
find app -name "not-found.tsx"
grep -rn "Empty\|empty state\|isEmpty\|.length === 0" components | head -30
```

Per route from spec §3, record OK / MISSING for: `loading.tsx`, `error.tsx`, empty filter state, empty cart, empty search, sold-out PDP, delivery-zone-error PDP. Append findings under `## 2.5 Empty / loading / error states`.

- [ ] **Step 7: Audit taste-skill pre-flight (§2.6)**

Run each grep — every hit is a violation, every clean grep is a passing rule.

```bash
grep -rn "h-screen" app components                                       # forbidden — use min-h-[100dvh]
grep -rEn "animate=\{\{[^}]*(top|left|width|height):" app components     # transform/opacity only
grep -rEn 'from "next/font/google".*Inter\b' app                          # no Inter
grep -rEn "(purple|violet)-[0-9]" app components                          # AI-purple aesthetic
grep -rn "bg-black\b" app components                                     # never pure black (use ink)
grep -rEn "text-white(\s|\")" app components                              # never pure white standalone
```

Manual check: no generic 3-column card row on the home page; perpetual animations isolated in their own memoized client components; all `useEffect` animations have cleanup. Append findings under `## 2.6 Taste-skill pre-flight`.

- [ ] **Step 8: Audit perf baseline (§2.7)**

Run a Lighthouse baseline (no fixes yet — just record numbers). The user runs the dev server and captures via Chrome DevTools or a one-shot CLI:

```bash
npm run build && npm start &
sleep 5
npx lighthouse http://localhost:3000/en --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=/tmp/lh-home.json --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:3000/en/shop/arrangements --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=/tmp/lh-shop.json --chrome-flags="--headless" --quiet
# Pick a real product slug from data/products.ts:
SLUG=$(grep -oE 'slug:\s*"[^"]+"' data/products.ts | head -1 | sed -E 's/slug:\s*"([^"]+)"/\1/')
npx lighthouse "http://localhost:3000/en/product/$SLUG" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=/tmp/lh-pdp.json --chrome-flags="--headless" --quiet
kill %1 2>/dev/null
```

Read the JSON, fill the Lighthouse table at the bottom of the audit. List any single-fix opportunities (e.g., "missing `priority` on hero `<Image>`", "no `font-display: swap`") under `## 2.7 Perf pass (baseline)`.

- [ ] **Step 9: Audit i18n parity (§2.8)**

```bash
node -e "
const en = require('./messages/en.json');
const es = require('./messages/es.json');
const flatten = (obj, p='') => Object.entries(obj).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flatten(v, p ? p + '.' + k : k) : [(p ? p + '.' + k : k)]);
const ek = new Set(flatten(en));
const sk = new Set(flatten(es));
const missingInEs = [...ek].filter(k => !sk.has(k));
const missingInEn = [...sk].filter(k => !ek.has(k));
console.log('Missing in es.json:', missingInEs);
console.log('Missing in en.json:', missingInEn);
"
grep -rEn "[\"'][A-Z][a-z]{3,}.*[a-z][\"']" components/cart components/checkout components/inquiry components/contact 2>/dev/null | grep -v "from\b\|import\b" | head -40
```

Record key parity gaps and any obvious hardcoded strings under `## 2.8 i18n gap sweep`.

- [ ] **Step 10: Commit the audit**

```bash
git add docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "docs(audit): plan 4 launch-readiness audit baseline"
```

The audit is now the source of truth for Phase 2.

---

## Phase 2 — Execution

Each Phase 2 task follows this shape:
1. Read the audit findings for this category.
2. Fix each finding (or `DEFER` with rationale appended to the audit doc).
3. Append `→ FIXED in <commit-sha>` to each closed audit bullet at end of task.
4. Run targeted tests.
5. Single commit per task.

If audit findings for a category exceed 10 items, defer the lowest-impact subset to v2 and record rationale in the audit doc as `→ DEFERRED to v2: <reason>`.

---

### Task 2.1: Content centralization

**Files:**
- Modify: `data/site.ts`
- Modify: `app/layout.tsx` (and any other files using the hero tagline outside `messages/`)
- Test: `tests/unit/site-content.test.ts`

**Goal:** Every §13 placeholder lives in `data/site.ts` or `messages/{en,es}.json`. No hardcoded copies in components.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/site-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SITE } from "@/data/site";

describe("SITE content", () => {
  it("exposes every §13 open-item placeholder under a stable key", () => {
    expect(SITE.brand).toBeTruthy();
    expect(SITE.founded).toBeTypeOf("number");
    expect(SITE.phoneDisplay).toMatch(/\d{3}\s?\d{3}\s?\d{4}/);
    expect(SITE.address.line1).toBeTruthy();
    expect(SITE.cutoffTime).toBeTruthy();
    expect(SITE.cutoff24).toMatch(/^\d{2}:\d{2}$/);
    expect(SITE.tagline.en).toBeTruthy();
    expect(SITE.tagline.es).toBeTruthy();
    expect(SITE.metadata.title.en).toBeTruthy();
    expect(SITE.metadata.title.es).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm test -- tests/unit/site-content.test.ts
```

Expected: FAIL — `SITE.tagline` and `SITE.metadata` are undefined.

- [ ] **Step 3: Extend `data/site.ts`**

Add `tagline` and `metadata` to the `SITE` object:

```ts
export const SITE = {
  brand: "Diva Flowers",
  founded: 2014,
  // ...existing keys unchanged...
  tagline: {
    en: "Romance, by the stem.",
    es: "Romance, tallo a tallo.",
  },
  metadata: {
    title: {
      en: "Diva Flowers — Romance, by the stem.",
      es: "Diva Flowers — Romance, tallo a tallo.",
    },
    description: {
      en: "Romantic, abundant florals from Long Island. Same-day delivery across Nassau, Queens & western Suffolk.",
      es: "Florales románticos y abundantes desde Long Island. Entrega el mismo día en Nassau, Queens y oeste de Suffolk.",
    },
  },
} as const;
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm test -- tests/unit/site-content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor `app/layout.tsx` to read from `SITE.metadata`**

Replace any hardcoded `"Diva Flowers — Romance, by the stem."` in `app/layout.tsx` with `SITE.metadata.title.en` (root layout is locale-agnostic; use `en` as default — per-locale metadata overrides happen in `app/[locale]/layout.tsx`).

If `app/[locale]/layout.tsx` defines `generateMetadata`, use the `locale` param to pick `SITE.metadata.title[locale]` and `SITE.metadata.description[locale]`.

- [ ] **Step 6: Refactor any other audit findings under §2.1**

For every bullet under `## 2.1 Content centralization` in the audit with status `MISSING` or `PARTIAL`, replace the hardcoded string with the appropriate `SITE.*` lookup or `messages/*.json` key. Do not invent new placeholders — if a value isn't in §13, leave it.

- [ ] **Step 7: Verify nothing references the old hardcoded strings**

```bash
grep -rn "DESDE 2014\|2:00 PM\|Romance, by the stem\|Romance, tallo a tallo\|1077 Hempstead" app components | grep -v "data/site.ts\|messages/"
```

Expected: empty output.

- [ ] **Step 8: Update the audit doc**

For each fixed bullet under `## 2.1 Content centralization`, append `→ FIXED in <commit-sha>` (use `git rev-parse HEAD` after step 9 commits, then amend if needed; or do this in step 9's commit message and leave the audit pointing at HEAD).

- [ ] **Step 9: Update the audit doc with closure annotations**

For each fixed bullet under `## 2.1 Content centralization`, edit the line in the audit doc to append ` → FIXED in <abbreviated-sha>`. Do this manually per bullet — don't rely on a regex sweep, because notes may contain `—` characters that break parsing. After Plan 4 each closed bullet looks like:

```
- MISSING — §13 hero tagline — app/layout.tsx:31 — was hardcoded → FIXED in abc1234
```

Use `git rev-parse --short HEAD~0` (after the initial commit in Step 10) for the SHA, then amend.

- [ ] **Step 10: Run all tests, commit, then amend with audit closure**

```bash
npm test
git add data/site.ts app/layout.tsx tests/unit/site-content.test.ts
# Add other modified files surfaced by the audit
git commit -m "refactor(content): centralize §13 placeholders in data/site.ts"
SHA=$(git rev-parse --short HEAD)
echo "Use this sha when annotating audit bullets: $SHA"
# Now manually edit docs/superpowers/audits/2026-05-01-plan-4-audit.md per Step 9.
git add docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit --amend --no-edit
```

Expected: green tests, single commit, audit reflects closure.

---

### Task 2.2: Motion coverage

**Files:**
- Modify: any components flagged under `## 2.2 Motion coverage` in the audit (typical candidates: `components/home/*`, `components/product/*`, `components/shop/*`, `components/weddings/*`, `components/events/*`, `components/inquiry/*`, `components/cart/Drawer.tsx`).
- Test: existing motion tests; possibly extend `tests/unit/motion-config.test.ts` if it exists, otherwise create.

**Goal:** Every motion primitive applied where the spec §4.3 calls for it. No primitive applied where the spec doesn't (especially: no motion on sympathy beyond MOTION_INTENSITY: 2).

- [ ] **Step 1: Verify reduced-motion config still works**

Create or extend `tests/unit/motion-config.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getMotionPreference } from "@/lib/motion-config";

describe("motion config", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it("returns reduced when user prefers reduced motion", () => {
    expect(getMotionPreference()).toBe("reduced");
  });
});
```

If `getMotionPreference` doesn't exist or has a different signature, read `lib/motion-config.ts` and adjust the test to match the actual API. Do not invent an API.

- [ ] **Step 2: Run motion-config test, verify it passes (or fix)**

```bash
npm test -- tests/unit/motion-config.test.ts
```

Expected: PASS. If it fails because the API differs, fix the test to match `lib/motion-config.ts`.

- [ ] **Step 3: Apply each MISSING / PARTIAL finding under §2.2**

For each audit bullet, apply the motion primitive at the location. Use these patterns:

**Magnetic CTA pattern (e.g., adding to PDP "Add to bag"):**

```tsx
// Before
<button className="...arched primary CTA classes...">{t("add")}</button>

// After
import { MagneticButton } from "@/components/motion/MagneticButton";

<MagneticButton className="...arched primary CTA classes...">
  {t("add")}
</MagneticButton>
```

`MagneticButton` already isolates `'use client'` and respects reduced-motion. Do not add `useEffect` here — it's encapsulated.

**Bloom hover pattern (e.g., product cards on `/shop/*`):**

```tsx
// Before
<Image src={product.images[0].src} alt={product.images[0].alt[locale]} ... />

// After
import { BloomImage } from "@/components/motion/BloomImage";

<BloomImage
  src={product.images[0].src}
  alt={product.images[0].alt[locale]}
  width={...}
  height={...}
/>
```

**Stagger reveal pattern (grid mount):**

```tsx
import { StaggerGroup } from "@/components/motion/StaggerGroup";

<StaggerGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {products.map((p) => <ProductCard key={p.id} product={p} />)}
</StaggerGroup>
```

**Sympathy override:** if the audit flagged a motion primitive on `/shop/sympathy`, REMOVE it (sympathy is MOTION_INTENSITY: 2 — fade only, no magnetic, no bloom).

- [ ] **Step 4: Verify each fix in browser (manual, dev server)**

```bash
npm run dev
```

Click each location flagged in the audit. Confirm:
- Magnetic CTAs feel pulled toward cursor (subtle).
- Bloom hover lifts product images on hover (`scale: 1.02, rotate: -0.5deg`).
- Grids stagger on mount (90ms cascade).
- Sympathy pages have no magnetic / bloom.
- With OS-level "Reduce motion" enabled, all of the above turn off.

- [ ] **Step 5: Update audit doc**

Append `→ FIXED in <sha>` to each closed bullet under `## 2.2 Motion coverage`.

- [ ] **Step 6: Run all tests, commit**

```bash
npm test
git add components docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "feat(motion): apply primitives per §4.3 — close plan 4 audit §2.2"
```

---

### Task 2.3: A11y fixes + axe-core integration

**Files:**
- Create: `tests/e2e/a11y.spec.ts`
- Modify: `package.json` (add `@axe-core/playwright` dev dep)
- Modify: any components flagged under `## 2.3 A11y fixes`

**Goal:** Every audit finding closed. `axe-core` runs against home / PDP / checkout in CI via Playwright with zero violations.

- [ ] **Step 1: Install `@axe-core/playwright`**

```bash
npm install --save-dev @axe-core/playwright
```

- [ ] **Step 2: Write the failing axe-core e2e**

Create `tests/e2e/a11y.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

const PAGES = [
  { name: "home (en)", url: "/en" },
  { name: "home (es)", url: "/es" },
  { name: "shop (en)", url: "/en/shop/arrangements" },
  { name: "checkout (en)", url: "/en/checkout" },
];

for (const { name, url } of PAGES) {
  test(`a11y — ${name}`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("a11y — pdp (en)", async ({ page }) => {
  await page.goto("/en/shop/arrangements");
  await page.locator("a[href*='/product/']").first().click();
  await page.waitForURL(/\/product\//);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 3: Run the e2e, see what fails**

```bash
npm run e2e -- a11y.spec.ts
```

Expected: fails with a list of violations (color contrast, missing labels, etc.). Each violation is a finding to fix.

- [ ] **Step 4: Fix every audit finding under §2.3 + every axe violation**

Common patterns:

**Empty alt** — if image is decorative, keep `alt=""`. If informative, write a meaningful alt in EN/ES via `messages/`.

**Missing label** — every `<input>`, `<select>`, `<textarea>` needs a `<label htmlFor>` or `aria-label`.

**Heading order** — single H1 per page; no skipping levels (H2 → H4 is a violation).

**Focus ring** — confirm Tailwind `focus-visible:ring-2 focus-visible:ring-rouge` (or equivalent token) is on every interactive element. Globally enforce via `app/globals.css`:

```css
:focus-visible {
  outline: 2px solid var(--rouge);
  outline-offset: 2px;
}
```

(Only add the global rule if the audit shows widespread focus-ring inconsistency. Otherwise prefer per-component fixes.)

**Reduced-motion regressions** — every `useEffect`-driven animation must consult `getMotionPreference()` (or whatever `lib/motion-config.ts` exposes) and bail out when reduced.

- [ ] **Step 5: Run e2e until green**

```bash
npm run e2e -- a11y.spec.ts
```

Expected: PASS for all routes.

- [ ] **Step 6: Update audit doc**

Append `→ FIXED in <sha>` for each closed bullet under `## 2.3 A11y fixes`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tests/e2e/a11y.spec.ts components app docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "feat(a11y): axe-core e2e + close plan 4 audit §2.3"
```

---

### Task 2.4: SEO + structured data

**Files:**
- Create: `components/seo/LocalBusinessLD.tsx`
- Create: `components/seo/BreadcrumbListLD.tsx`
- Modify: `app/[locale]/layout.tsx` (mount `<LocalBusinessLD />`)
- Modify: `app/[locale]/shop/[category]/page.tsx`, `app/[locale]/product/[slug]/page.tsx` (mount `<BreadcrumbListLD />`)
- Create (per template): `app/[locale]/opengraph-image.tsx`, `app/[locale]/product/[slug]/opengraph-image.tsx`, `app/[locale]/shop/[category]/opengraph-image.tsx`, etc.
- Create: `app/robots.ts` (if missing)
- Test: `tests/unit/structured-data.test.ts`

**Goal:** `LocalBusiness` JSON-LD on every page (via locale layout). `Product` JSON-LD on PDP (already exists — verify). `BreadcrumbList` JSON-LD on category + PDP. Per-template OG images. `robots.ts` present.

- [ ] **Step 1: Write the failing test for `LocalBusinessLD`**

Create `tests/unit/structured-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LocalBusinessLD } from "@/components/seo/LocalBusinessLD";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";

describe("LocalBusinessLD", () => {
  it("emits a JSON-LD script with @type LocalBusiness and SITE phone/address", () => {
    const html = renderToString(<LocalBusinessLD />);
    expect(html).toContain('type="application/ld+json"');
    const json = JSON.parse(html.match(/>([^<]+)</)![1]);
    expect(json["@type"]).toBe("LocalBusiness");
    expect(json.telephone).toContain("516");
    expect(json.address.streetAddress).toContain("Hempstead");
  });
});

describe("BreadcrumbListLD", () => {
  it("emits BreadcrumbList JSON-LD with the provided trail", () => {
    const html = renderToString(
      <BreadcrumbListLD
        items={[
          { name: "Home", url: "https://divaflowers.com/en" },
          { name: "Shop", url: "https://divaflowers.com/en/shop" },
        ]}
      />
    );
    const json = JSON.parse(html.match(/>([^<]+)</)![1]);
    expect(json["@type"]).toBe("BreadcrumbList");
    expect(json.itemListElement).toHaveLength(2);
    expect(json.itemListElement[0].position).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- tests/unit/structured-data.test.ts
```

Expected: FAIL — components don't exist.

- [ ] **Step 3: Create `LocalBusinessLD`**

`components/seo/LocalBusinessLD.tsx`:

```tsx
import { SITE } from "@/data/site";

export function LocalBusinessLD() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE.brand,
    telephone: SITE.phone,
    email: SITE.email,
    url: "https://divaflowers.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.line1,
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postal,
      addressCountry: SITE.address.country,
    },
    openingHoursSpecification: SITE.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.value.split("–")[0]?.trim(),
      closes: h.value.split("–")[1]?.trim(),
    })),
    sameAs: SITE.social.map((s) => s.href),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 4: Create `BreadcrumbListLD`**

`components/seo/BreadcrumbListLD.tsx`:

```tsx
type Item = { name: string; url: string };

export function BreadcrumbListLD({ items }: { items: Item[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 5: Run test, verify it passes**

```bash
npm test -- tests/unit/structured-data.test.ts
```

Expected: PASS.

- [ ] **Step 6: Mount `<LocalBusinessLD />` in locale layout**

Edit `app/[locale]/layout.tsx`. Inside the rendered tree (typically inside `<body>` or the root fragment), add:

```tsx
import { LocalBusinessLD } from "@/components/seo/LocalBusinessLD";

// ...inside the JSX...
<LocalBusinessLD />
```

- [ ] **Step 7: Mount `<BreadcrumbListLD />` on category and PDP pages**

`app/[locale]/shop/[category]/page.tsx`:

```tsx
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";

const SITE_URL = "https://divaflowers.com";

// ...inside the page JSX...
<BreadcrumbListLD
  items={[
    { name: t("home"), url: `${SITE_URL}/${locale}` },
    { name: t("shop"), url: `${SITE_URL}/${locale}/shop` },
    { name: categoryLabel, url: `${SITE_URL}/${locale}/shop/${params.category}` },
  ]}
/>
```

`app/[locale]/product/[slug]/page.tsx`:

```tsx
<BreadcrumbListLD
  items={[
    { name: t("home"), url: `${SITE_URL}/${locale}` },
    { name: t("shop"), url: `${SITE_URL}/${locale}/shop` },
    { name: categoryLabel, url: `${SITE_URL}/${locale}/shop/${product.category}` },
    { name: product.title[locale], url: `${SITE_URL}/${locale}/product/${product.slug}` },
  ]}
/>
```

- [ ] **Step 8: Add `app/robots.ts` if missing**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/account/"] }],
    sitemap: "https://divaflowers.com/sitemap.xml",
    host: "https://divaflowers.com",
  };
}
```

- [ ] **Step 9: Add per-template `opengraph-image.tsx`**

For every `MISSING — §8 OG images` finding in the audit, create the file. Pattern using Next's `ImageResponse`:

`app/[locale]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { SITE } from "@/data/site";

export const runtime = "edge";
export const alt = SITE.brand;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#FAF6F0",
          color: "#0E0D0C",
          fontFamily: "serif",
          fontSize: 96,
          letterSpacing: -2,
        }}
      >
        <div>{SITE.brand}</div>
        <div style={{ fontSize: 36, marginTop: 24, color: "#B8345E" }}>
          {SITE.tagline.en}
        </div>
      </div>
    ),
    { ...size }
  );
}
```

For PDP (`app/[locale]/product/[slug]/opengraph-image.tsx`), accept `params` and render the product hero image plus title.

- [ ] **Step 10: Verify each route's `<head>` in dev**

```bash
npm run dev
```

Open each route, view source, confirm the JSON-LD scripts and OG meta are present and well-formed. Validate one PDP via [Google's Rich Results test](https://search.google.com/test/rich-results) (manual, browser).

- [ ] **Step 11: Update audit doc, commit**

```bash
npm test && npm run e2e
git add components/seo app/robots.ts "app/[locale]" tests/unit/structured-data.test.ts docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "feat(seo): LocalBusiness + Breadcrumb JSON-LD, OG images, robots"
```

---

### Task 2.5: Empty / loading / error states

**Files:**
- Create: missing `loading.tsx` per audit (typical: `app/[locale]/loading.tsx`, `app/[locale]/story/loading.tsx`, `app/[locale]/journal/loading.tsx`, `app/[locale]/contact/loading.tsx`, `app/[locale]/account/loading.tsx`, `app/[locale]/legal/loading.tsx`).
- Create: `app/[locale]/error.tsx`, `app/[locale]/not-found.tsx`.
- Modify: any component missing an empty/error state per audit.
- Test: `tests/e2e/states.spec.ts`

**Goal:** Every route from spec §3 has a `loading.tsx`. Site-wide `error.tsx` and `not-found.tsx` exist. Every data-loading component has empty / error variants.

- [ ] **Step 1: Write the failing e2e**

Create `tests/e2e/states.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("not-found page renders for unknown route", async ({ page }) => {
  const res = await page.goto("/en/this-route-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toContainText(/not found|no encontrad/i);
});

test("category page shows empty filter state when filters yield zero results", async ({ page }) => {
  await page.goto("/en/shop/arrangements?color=this-color-does-not-exist");
  await expect(page.getByText(/no.*match|sin resultados/i)).toBeVisible();
});

test("cart page shows empty state when cart is empty", async ({ page }) => {
  await page.goto("/en/cart");
  await expect(page.getByText(/your bag is empty|tu bolsa está vacía/i)).toBeVisible();
});
```

- [ ] **Step 2: Run, see what fails**

```bash
npm run e2e -- states.spec.ts
```

Each failure points to a missing state.

- [ ] **Step 3: Add `not-found.tsx`**

`app/[locale]/not-found.tsx`:

```tsx
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="min-h-[100dvh] grid place-items-center px-6">
      <div className="max-w-prose text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-mute-700">
          404
        </p>
        <h1 className="mt-3 font-display text-5xl tracking-tighter">
          {t("title")}
        </h1>
        <p className="mt-4 text-mute-700">{t("body")}</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-t-[10rem] bg-rouge px-8 py-4 text-bone"
        >
          {t("cta")}
        </Link>
      </div>
    </main>
  );
}
```

Add `notFound` keys to `messages/en.json`:

```json
"notFound": {
  "title": "We couldn't find that page.",
  "body": "It may have moved, or the link may be broken. Browse the shop or call us if you need help.",
  "cta": "Back to home"
}
```

And to `messages/es.json`:

```json
"notFound": {
  "title": "No pudimos encontrar esa página.",
  "body": "Es posible que haya sido movida o que el enlace esté roto. Explora la tienda o llámanos si necesitas ayuda.",
  "cta": "Volver al inicio"
}
```

- [ ] **Step 4: Add `error.tsx`**

`app/[locale]/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="min-h-[100dvh] grid place-items-center px-6">
      <div className="max-w-prose text-center">
        <h1 className="font-display text-4xl tracking-tighter">{t("title")}</h1>
        <p className="mt-4 text-mute-700">{t("body")}</p>
        <button
          onClick={reset}
          className="mt-8 rounded-t-[10rem] bg-rouge px-8 py-4 text-bone"
        >
          {t("retry")}
        </button>
      </div>
    </main>
  );
}
```

Add `error` keys to `messages/en.json`:

```json
"error": {
  "title": "Something went wrong.",
  "body": "Please try again. If this keeps happening, call us at 516 484 3456.",
  "retry": "Try again"
}
```

And to `messages/es.json`:

```json
"error": {
  "title": "Algo salió mal.",
  "body": "Por favor intenta de nuevo. Si sigue ocurriendo, llámanos al 516 484 3456.",
  "retry": "Intentar de nuevo"
}
```

- [ ] **Step 5: Add missing `loading.tsx` files per audit**

For every route flagged as `MISSING` under `## 2.5`, create a skeleton matching the page shape. Pattern:

```tsx
export default function Loading() {
  return (
    <div className="min-h-[60dvh] mx-auto max-w-7xl px-4 py-12">
      <div className="h-8 w-48 rounded bg-mute-100/50 animate-pulse" />
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-mute-100/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
```

Tailor the skeleton to each route (PDP loading already exists — skip; home loading needs a hero-shaped skeleton; etc.).

- [ ] **Step 6: Add component-level empty / error states per audit**

For each finding (e.g., "category empty filter state missing"), add the empty-state JSX inline. Pattern:

```tsx
{filtered.length === 0 ? (
  <div className="col-span-full py-16 text-center">
    <p className="font-display text-2xl">{t("empty.title")}</p>
    <p className="mt-2 text-mute-700">{t("empty.body")}</p>
    <button onClick={clearFilters} className="mt-6 underline underline-offset-4">
      {t("empty.clear")}
    </button>
  </div>
) : (
  <ProductGrid products={filtered} />
)}
```

- [ ] **Step 7: Run e2e until green**

```bash
npm run e2e -- states.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Update audit doc, commit**

```bash
npm test && npm run e2e
git add app messages tests/e2e/states.spec.ts docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "feat(states): empty/loading/error coverage — close plan 4 audit §2.5"
```

---

### Task 2.6: Taste-skill pre-flight

**Files:**
- Modify: any file flagged under `## 2.6 Taste-skill pre-flight`.

**Goal:** Every spec §12 taste-skill checklist item passes.

- [ ] **Step 1: Re-run all preflight greps to confirm audit accuracy**

```bash
grep -rn "h-screen" app components
grep -rEn 'from "next/font/google".*Inter\b' app
grep -rEn "(purple|violet)-[0-9]" app components
grep -rn "bg-black\b" app components
grep -rEn "text-white(\s|\")" app components
grep -rEn "animate=\{\{[^}]*(top|left|width|height):" app components
```

If any new violations exist that the audit missed, append them.

- [ ] **Step 2: Fix `h-screen` violations**

Replace every `h-screen` with `min-h-[100dvh]` (or `min-h-dvh` if using Tailwind v4 dvh utilities). Verify the visual result on mobile (iPhone toolbar visible).

- [ ] **Step 3: Fix forbidden font / color violations**

- Inter imports → remove; replace usage with `Cabinet Grotesk` (configured in `app/layout.tsx`).
- `purple-` / `violet-` Tailwind classes → replace with `lilac` token from spec §4.1 *only* where editorial accent is intended; otherwise replace with `mute-*`.
- `bg-black` → `bg-ink`. `text-white` (alone, not `text-white/...`) → `text-bone`.

- [ ] **Step 4: Fix non-transform animations**

Any animation on `top` / `left` / `width` / `height` is a violation. Refactor to `transform` (`translate`, `scale`) and `opacity`. Example:

```tsx
// Before
<motion.div animate={{ left: 0 }} />

// After
<motion.div animate={{ x: 0 }} />
```

- [ ] **Step 5: Verify perpetual animations are isolated**

For each perpetual animation (marquee, breathing dot on `BentoLiveStatusTile`, kinetic anything), confirm it's its own `'use client'` memoized component. Check via grep:

```bash
grep -rln "useEffect\|setInterval\|requestAnimationFrame" components | head -20
```

For each hit, open the file. If a perpetual animation lives in a multi-purpose component, extract it.

- [ ] **Step 6: Verify `useEffect` cleanup**

Every `useEffect` that subscribes / starts a timer / adds a listener must `return` a cleanup. Quick grep:

```bash
grep -rn "useEffect" components | wc -l
```

Spot-check a sampling. Fix any that lack cleanup.

- [ ] **Step 7: Confirm no 3-column card row on home**

Open `app/[locale]/page.tsx` and any `components/home/*` files in tree. Confirm the home page is asymmetric / Bento-shaped, not a `grid-cols-3` row of identical cards.

- [ ] **Step 8: Update audit doc, commit**

```bash
npm test && npm run e2e
git add app components docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "fix(taste): close plan 4 audit §2.6 (taste-skill pre-flight)"
```

---

### Task 2.7: Perf pass

**Files:**
- Modify: any component flagged under `## 2.7 Perf pass`.
- Possibly modify: `next.config.mjs` (image optimization), `app/layout.tsx` (font preload).

**Goal:** Lighthouse perf ≥ 95, a11y = 100 on home / `/en/shop/arrangements` / a sample PDP. Numbers recorded in audit doc.

- [ ] **Step 1: Apply baseline-finding fixes from audit**

For each `MISSING` finding under `## 2.7`, apply the fix. Common patterns:

**Hero image priority:**

```tsx
// home hero photo
<Image src="..." alt="..." priority width={...} height={...} />
```

**Font display swap** — already handled by `next/font` if using `font-display: swap`. If using local fonts, ensure:

```ts
const editorialNew = localFont({
  src: "../public/fonts/editorial-new.woff2",
  display: "swap",
  variable: "--font-display",
});
```

**Route-level `loading.tsx`** — already covered in Task 2.5.

**Dynamic import heavy client motion components on home:**

```tsx
import dynamic from "next/dynamic";

// Adjust the .then((m) => m.X) selector to match KineticMarquee's actual export
// (named or default) — read components/brand/KineticMarquee.tsx first.
const KineticMarquee = dynamic(
  () => import("@/components/brand/KineticMarquee").then((m) => m.KineticMarquee),
  { ssr: false }
);
```

Only do this if Lighthouse flags JS bundle weight on home. Don't preemptively defer SSR — it hurts SEO if applied widely.

**Image optimization** — confirm `next.config.mjs` has reasonable `images.formats: ['image/avif', 'image/webp']`. Unsplash/picsum domains in `images.remotePatterns`.

- [ ] **Step 2: Re-run Lighthouse**

```bash
npm run build && npm start &
sleep 5
npx lighthouse http://localhost:3000/en --only-categories=performance,accessibility,best-practices,seo --output=html --output-path=/tmp/lh-home.html --chrome-flags="--headless" --quiet
npx lighthouse http://localhost:3000/en/shop/arrangements --only-categories=performance,accessibility,best-practices,seo --output=html --output-path=/tmp/lh-shop.html --chrome-flags="--headless" --quiet
SLUG=$(grep -oE 'slug:\s*"[^"]+"' data/products.ts | head -1 | sed -E 's/slug:\s*"([^"]+)"/\1/')
npx lighthouse "http://localhost:3000/en/product/$SLUG" --only-categories=performance,accessibility,best-practices,seo --output=html --output-path=/tmp/lh-pdp.html --chrome-flags="--headless" --quiet
kill %1 2>/dev/null
```

Open each HTML report. Fill in the Lighthouse table at the bottom of the audit doc with the new scores.

- [ ] **Step 3: Decide pass / defer**

If perf ≥ 95 and a11y = 100 on all three pages — done.

If a single page falls < 95 perf, examine the report's "Opportunities" — apply if cheap (one fix), defer if structural (e.g., requires real photography swap):

```
- DEFER — §12 Lighthouse perf — /en — current score 92, blocked on hero image weight (will resolve when real photography arrives via <ProductImage> swap)
  → DEFERRED to v2: tied to real-photography swap
```

- [ ] **Step 4: Update audit doc, commit**

```bash
npm test && npm run e2e
git add app components next.config.mjs docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "perf: close plan 4 audit §2.7 (Lighthouse pass)"
```

---

### Task 2.8: i18n gap sweep

**Files:**
- Modify: `messages/en.json`, `messages/es.json`.
- Modify: any component using a hardcoded string flagged in audit.
- Test: `tests/unit/i18n-parity.test.ts`

**Goal:** Every key in `en.json` exists in `es.json` and vice versa. No hardcoded user-facing strings outside message bundles or `data/site.ts`.

- [ ] **Step 1: Write the failing parity test**

Create `tests/unit/i18n-parity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

function flatten(obj: any, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? flatten(v, key) : [key];
  });
}

describe("i18n parity", () => {
  const enKeys = new Set(flatten(en));
  const esKeys = new Set(flatten(es));

  it("every en key has an es counterpart", () => {
    const missing = [...enKeys].filter((k) => !esKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("every es key has an en counterpart", () => {
    const missing = [...esKeys].filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, see what's missing**

```bash
npm test -- tests/unit/i18n-parity.test.ts
```

Expected: failures listing missing keys (or PASS if already in parity).

- [ ] **Step 3: Fill missing keys**

For each missing key, add a translation. Do NOT machine-translate blindly — for any key you're unsure about, leave it tagged `[ES?]` and note in audit for client review:

```json
"key": "[ES?] machine-translated value here"
```

- [ ] **Step 4: Replace hardcoded user-facing strings**

For every audit finding under `## 2.8` flagging a hardcoded string, replace it with a `useTranslations()` lookup:

```tsx
// Before
<p>Calculated at checkout</p>

// After
const t = useTranslations("cart");
<p>{t("calculatedAtCheckout")}</p>
```

Add the new key to both `en.json` and `es.json`.

- [ ] **Step 5: Run parity test until green**

```bash
npm test -- tests/unit/i18n-parity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Update audit doc, commit**

```bash
npm test && npm run e2e
git add messages tests/unit/i18n-parity.test.ts components docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "feat(i18n): close key parity + hardcoded strings — plan 4 audit §2.8"
```

---

## Phase 3 — Verification

### Task 3.1: Pre-launch QA

**Files:**
- Modify: `README.md` (update v1 status section).
- Create: `docs/superpowers/v2-roadmap.md` (consolidated v2 list, generated from `DEFER` audit findings).

**Goal:** Plan 4 DoD §5 fully satisfied. v1 is launch-ready.

- [ ] **Step 1: Confirm audit doc is closed**

```bash
grep -E "^- (OK|MISSING|PARTIAL|DEFER)" docs/superpowers/audits/2026-05-01-plan-4-audit.md | grep -v "→ FIXED in\|→ DEFERRED to v2"
```

Expected: empty output (every non-OK bullet has a closure annotation). If anything remains, return to the relevant Phase 2 task.

- [ ] **Step 2: Confirm placeholder grep is clean**

```bash
grep -rn "DESDE 2014\|2:00 PM\|Romance, by the stem\|Romance, tallo a tallo\|1077 Hempstead" app components | grep -v "data/site.ts\|messages/"
```

Expected: empty output.

- [ ] **Step 3: Re-run full test suites**

```bash
npm test
npm run e2e
npm run build
```

Expected: all green, build succeeds.

- [ ] **Step 4: Manual click-through (EN + ES)**

Run dev server. For each route in spec §3, in both `/en` and `/es`:

- Page renders without console errors.
- Single H1 visible.
- All images have alt text.
- All interactive elements reachable by Tab.
- Focus rings visible (`rouge`).
- Locale switcher works and persists (refresh, locale stays).

Record any new finding in the audit doc as a Phase 3 bullet, fix it, return to Step 3.

- [ ] **Step 5: Manual reduced-motion pass**

Enable OS-level "Reduce motion" (macOS: System Settings → Accessibility → Display → Reduce Motion). Reload home, /shop, PDP, /weddings.

Expected: no magnetic, no bloom, no kinetic marquee, no perpetual animations. Static content only.

- [ ] **Step 6: Manual mobile pass**

DevTools device emulation, breakpoints `sm`, `md`, and below. For each route in §3:

- Asymmetric layouts collapse cleanly (no horizontal overflow).
- Hero CTAs remain reachable with thumb.
- Cart drawer opens full-width below `md`.
- Checkout 3-step accordion remains usable.

- [ ] **Step 7: Re-run final Lighthouse, record numbers**

Re-run the Lighthouse commands from Task 2.7. Update the table at the bottom of the audit doc with the final scores.

If perf < 95 on any page despite Task 2.7 fixes, confirm the `DEFER` bullet exists with rationale. Don't block launch on chasing two perf points if the rationale is sound.

- [ ] **Step 8: Generate `docs/superpowers/v2-roadmap.md`**

Walk every `DEFERRED to v2` line in the audit doc and consolidate into a single roadmap document grouped by category. Append the standing v2 swaps from spec §11:

```md
# v2 Roadmap (post-Plan 4)

Generated 2026-05-01 from `docs/superpowers/audits/2026-05-01-plan-4-audit.md` and spec §11.

## Standing v2 swaps

- Stripe (`<PaymentStub />` → `<PaymentElement />`)
- CMS (Sanity / Payload)
- Auth (NextAuth / Clerk)
- Email send (Resend / Postmark)
- Analytics (Plausible / PostHog)
- Real product photography (`<ProductImage>` swap)
- Address autocomplete (Google Places)
- Lighthouse CI gating

## Deferred audit findings

### From §2.2 Motion coverage
<paste DEFER bullets here>

### From §2.4 SEO
<paste DEFER bullets here>

[…etc…]
```

- [ ] **Step 9: Update README**

In `README.md`, add Plan 4 to the status block:

```md
## Status

- Plan 1 complete: foundation, brand system, bilingual home page.
- Plan 2 complete: catalog (shop hub + category pages with sticky filter bar), PDP (variants, add-ons, delivery picker, card message, add-to-bag), sympathy variant, subscriptions, mega-menu, sitemap.
- Plan 3 complete: cart drawer, /cart, /checkout (3-step accordion), /order/[id]/confirmation. Inquiry pages: /weddings, /events, /contact. Editorial: /story, /journal, /journal/[slug] (3 articles). Stubbed: /account. Legal: /legal/privacy, /legal/terms.
- Plan 4 complete: launch-readiness — content centralization, motion coverage, a11y (axe-core), SEO + structured data, OG images, taste-skill pre-flight, Lighthouse pass, i18n parity, empty/loading/error states. Audit at `docs/superpowers/audits/2026-05-01-plan-4-audit.md`. v2 roadmap at `docs/superpowers/v2-roadmap.md`.

## v1 status

**Launch-ready.** See `docs/superpowers/v2-roadmap.md` for the v2 swap list.
```

- [ ] **Step 10: Final commit**

```bash
git add README.md docs/superpowers/v2-roadmap.md docs/superpowers/audits/2026-05-01-plan-4-audit.md
git commit -m "docs: plan 4 verification complete — v1 launch-ready"
```

---

## Definition of Done (Plan 4)

1. ✅ `docs/superpowers/audits/2026-05-01-plan-4-audit.md` exists; every non-OK bullet has `→ FIXED in <sha>` or `→ DEFERRED to v2: <reason>`.
2. ✅ `data/site.ts` extended with `tagline` + `metadata`; no remaining placeholder strings (`DESDE 2014`, `2:00 PM`, `Romance, by the stem.`, `1077 Hempstead`) outside `data/site.ts` and `messages/`.
3. ✅ Lighthouse on home / `/en/shop/arrangements` / sample PDP: ≥ 95 perf, 100 a11y. Numbers in audit doc.
4. ✅ `npm test` + `npm run e2e` green. `npm run build` succeeds.
5. ✅ Manual QA complete: EN + ES, keyboard-only, reduced-motion, mobile breakpoint at `md:` and below.
6. ✅ `README.md` v1-status section reflects Plan 4 completion.
7. ✅ `docs/superpowers/v2-roadmap.md` consolidates all `DEFERRED to v2` items + standing v2 swaps.
8. ✅ No new TODOs introduced. v2 deferrals tracked in the audit doc + roadmap, not scattered in code.

---

## Risks & Mitigations

- **Audit balloons (>50 findings).** Mitigation: per-category "defer if > 10 fixes" rule.
- **Lighthouse perf < 95 due to a structural blocker.** Mitigation: `DEFER` bullet with rationale (typically tied to real-photography swap). Don't block launch chasing two points.
- **Real photography unavailable means OG images feel placeholder.** Mitigation: OG components use the same `<ProductImage>` swap point — automatic when real photos arrive.
