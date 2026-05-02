# Google Maps Embed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive Google Maps iframe to the home page (new "Visítanos" block between `WeddingsTeaser` and `NewsletterField`) and replace the placeholder map image on the contact page with a real iframe; centralize address + map URLs in `data/site.ts`; update studio address from Hempstead Tpke / Franklin Square to **1077 Willis Ave, Albertson, NY 11507**.

**Architecture:** Single source of truth for studio data in `data/site.ts` (`SITE.address`, new `SITE.map`). Keyless Google Maps embed via `https://maps.google.com/maps?q=...&output=embed` — no API key, no billing, no consent layer. Two consumer components: a new `components/home/StudioVisit.tsx` server component for the home, and an updated `components/contact/StudioMap.tsx` for the contact page. Editorial styling matches `WeddingsTeaser` and `EditorialSplit` (no new design tokens).

**Tech Stack:** Next.js (App Router, server components), `next-intl` for i18n, Tailwind CSS, Playwright for e2e.

**Spec:** [docs/superpowers/specs/2026-05-02-google-maps-embed-design.md](../specs/2026-05-02-google-maps-embed-design.md)

---

## File Structure

**Modified:**
- `data/site.ts` — change `address` to Willis Ave / Albertson; add new `map` object with `embedSrc` and `directionsHref`.
- `app/[locale]/page.tsx` — import and render `<StudioVisit />` between `<WeddingsTeaser />` and `<NewsletterField />`.
- `components/contact/StudioMap.tsx` — replace placeholder image with real iframe; restructure click target (drop outer anchor; add explicit "Get directions" link below the map).
- `messages/en.json` & `messages/es.json` — add new `home.studio` namespace; update strict address-of-record strings (privacy/terms postal address, contact `studio.address_value`, contact `map.alt`, contact `page_description`); update editorial brand copy that references the old street.
- `tests/e2e/home.spec.ts` — replace the `Hempstead Turnpike` assertion with one that matches the new copy + new section.

**Created:**
- `components/home/StudioVisit.tsx` — server component, 2-column grid (map + copy/CTAs).

**Untouched:**
- `tests/unit/checkout-schema.test.ts` and `tests/e2e/checkout.spec.ts` — these use `1077 Hempstead Tpke` as user-input fixture data unrelated to the studio address; do NOT change.
- `data/delivery-zones.ts` — `11010` is a delivery zip and unrelated to the store address.
- `components/home/BentoPressTile.tsx` — fictional press quotes that reference the old street; **flagged for the user** in Task 8 but not auto-edited.
- `data/journal.tsx` — journal entries about the storefront arch reference the old street; **flagged for the user** in Task 8 but not auto-edited.

---

## Task 1: Update `data/site.ts` with new address and map URLs

**Files:**
- Modify: `data/site.ts`

- [ ] **Step 1: Open `data/site.ts` and replace the `address` block + add `map` block**

Current address block (lines 9-15):

```ts
address: {
  line1: "1077 Hempstead Turnpike",
  locality: "Franklin Square",
  region: "NY",
  postal: "11010",
  country: "USA",
},
```

Replace with:

```ts
address: {
  line1: "1077 Willis Ave",
  locality: "Albertson",
  region: "NY",
  postal: "11507",
  country: "USA",
},
map: {
  embedSrc: "https://maps.google.com/maps?q=1077+Willis+Ave%2C+Albertson%2C+NY+11507&t=m&z=16&output=embed",
  directionsHref: "https://www.google.com/maps/dir/?api=1&destination=1077+Willis+Ave%2C+Albertson%2C+NY+11507",
},
```

Insert the `map` block immediately after the closing `},` of `address` and before `hours:`.

- [ ] **Step 2: Verify the file typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. The `SiteData` type is `typeof SITE`, so the new `map` field is automatically typed.

- [ ] **Step 3: Commit**

```bash
git add data/site.ts
git commit -m "data(site): update studio address to Willis Ave + add map URLs"
```

---

## Task 2: Add i18n keys for the new home `studio` block

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Add `home.studio` block to `messages/en.json`**

Inside the `home` object, after `weddings_teaser` and before `newsletter` (around line 175), add:

```json
"studio": {
  "eyebrow": "Visit the studio",
  "title": "Walk in, ring the bell, take home a bouquet.",
  "address_label": "Studio",
  "hours_label": "Hours",
  "phone_label": "Phone",
  "directions_cta": "Get directions",
  "call_cta": "Call the studio",
  "map_title": "Map showing Diva Flowers at 1077 Willis Ave, Albertson, NY"
},
```

Make sure to keep the trailing comma after the closing `}` of `studio` (since `newsletter` follows).

- [ ] **Step 2: Add the same block to `messages/es.json`**

```json
"studio": {
  "eyebrow": "Visítanos",
  "title": "Entra, toca el timbre y llévate un ramo.",
  "address_label": "Estudio",
  "hours_label": "Horario",
  "phone_label": "Teléfono",
  "directions_cta": "Cómo llegar",
  "call_cta": "Llamar al estudio",
  "map_title": "Mapa mostrando Diva Flowers en 1077 Willis Ave, Albertson, NY"
},
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n(home): add studio block for new Visit-the-studio section"
```

---

## Task 3: Create the `StudioVisit` home component

**Files:**
- Create: `components/home/StudioVisit.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { getTranslations } from "next-intl/server";
import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";

export async function StudioVisit({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("home.studio");

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-7 md:-ml-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-bento)]">
            <iframe
              src={SITE.map.embedSrc}
              title={t("map_title")}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>

        <div className="md:col-span-5 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2
            className="font-display text-4xl md:text-6xl tracking-tighter leading-[1.02]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
          >
            {t("title")}
          </h2>

          <div className="space-y-1 text-mute-600 text-base leading-relaxed">
            <p>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute-500 block mb-1">
                {t("address_label")}
              </span>
              {SITE.address.line1}
              <br />
              {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
            </p>
          </div>

          <div className="space-y-1 text-mute-600 text-base leading-relaxed">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute-500 mb-1">
              {t("hours_label")}
            </p>
            <ul className="space-y-1 font-mono text-[13px]">
              {SITE.hours.map((h) => (
                <li key={h.day}>
                  <span className="text-mute-500">{h.day}</span>{" "}
                  <span>{h.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute-500 mb-1">
              {t("phone_label")}
            </p>
            <a
              href={SITE.phoneHref}
              className="font-mono text-[13px] hover:text-petal transition-colors"
            >
              {SITE.phoneDisplay}
            </a>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={SITE.map.directionsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone hover:opacity-90 transition-opacity"
            >
              {t("directions_cta")} →
            </a>
            <a
              href={SITE.phoneHref}
              className="inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full border border-ink/30 hover:border-ink transition-colors"
            >
              {t("call_cta")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/StudioVisit.tsx
git commit -m "feat(home): add StudioVisit section with Google Maps iframe"
```

---

## Task 4: Wire `StudioVisit` into the home page

**Files:**
- Modify: `app/[locale]/page.tsx`

- [ ] **Step 1: Import and render `StudioVisit`**

In `app/[locale]/page.tsx`:

Add to imports (alphabetically after `NewsletterField`):

```tsx
import { StudioVisit } from "@/components/home/StudioVisit";
```

In the JSX, between `<WeddingsTeaser />` and `<NewsletterField />`, insert:

```tsx
<StudioVisit locale={locale} />
```

The `<main>` block should now read:

```tsx
<main className="bg-bone text-ink">
  <Grain />
  <Hero locale={locale} />
  <KineticMarquee text={`${t("marquee")}  ·  `} />
  <BentoGrid locale={locale} />
  <CategoryStrip locale={locale} />
  <EditorialSplit locale={locale} />
  <WeddingsTeaser locale={locale} />
  <StudioVisit locale={locale} />
  <NewsletterField />
</main>
```

- [ ] **Step 2: Run dev server and visually verify**

Run: `npm run dev`
Open `http://localhost:3000/en` and `http://localhost:3000/es`.

Verify:
- The new "Visit the studio" / "Visítanos" section appears between the weddings teaser and the newsletter field.
- The Google Map renders and is interactive (drag, zoom).
- "Get directions" / "Cómo llegar" opens Google Maps directions in a new tab with `1077 Willis Ave, Albertson, NY 11507` as the destination.
- "Call the studio" / "Llamar al estudio" triggers a `tel:+15164843456` link.
- Hours and phone render from `SITE`.
- Layout: 2 columns on `md+` (map left, copy right); stacks on mobile.
- No console errors and no hydration warnings.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/page.tsx
git commit -m "feat(home): wire StudioVisit between weddings teaser and newsletter"
```

---

## Task 5: Replace the placeholder map on the contact page

**Files:**
- Modify: `components/contact/StudioMap.tsx`

- [ ] **Step 1: Rewrite the component**

Full replacement contents of `components/contact/StudioMap.tsx`:

```tsx
// components/contact/StudioMap.tsx
import { getTranslations } from "next-intl/server";
import { SITE } from "@/data/site";
import type { Locale } from "@/types/locale";

export async function StudioMap({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.map" });
  const tStudio = await getTranslations({ locale, namespace: "contact.studio" });

  return (
    <div className="mt-8 space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <iframe
          src={SITE.map.embedSrc}
          title={t("alt")}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
        <div className="pointer-events-none absolute inset-0 flex items-end p-4">
          <span className="rounded-full bg-bone/90 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink">
            {SITE.address.line1} · {SITE.address.locality}, {SITE.address.region}
          </span>
        </div>
      </div>
      <a
        href={SITE.map.directionsHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:text-petal transition-colors"
      >
        {tStudio("directions_cta") /* falls back via i18n; see step 2 */} →
      </a>
    </div>
  );
}
```

Note: the floating chip is wrapped in a `pointer-events-none` overlay so it doesn't intercept iframe interaction.

- [ ] **Step 2: Add the `directions_cta` key under `contact.studio` in both locale files**

In `messages/en.json`, inside `contact.studio` (the existing block), add:

```json
"directions_cta": "Get directions",
```

In `messages/es.json`, inside `contact.studio`:

```json
"directions_cta": "Cómo llegar",
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Run dev server and visually verify the contact page**

Run: `npm run dev`
Open `http://localhost:3000/en/contact` and `http://localhost:3000/es/contact`.

Verify:
- The map renders as a real interactive iframe (not a placeholder image).
- The address chip overlays the bottom of the map and reads `1077 Willis Ave · Albertson, NY`.
- The "Get directions" / "Cómo llegar" link below the map opens directions in a new tab.
- The map is interactive (drag/zoom work).
- No console errors.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/contact/StudioMap.tsx messages/en.json messages/es.json
git commit -m "feat(contact): replace placeholder map with real Google Maps iframe"
```

---

## Task 6: Update strict address-of-record copy strings

These strings are *literal address references* — they must match the new studio address. (Editorial / brand-flavor copy that mentions "Hempstead Turnpike" is handled separately in Task 8.)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Update `messages/en.json`**

Replace the following strings:

| Path | Old value | New value |
|---|---|---|
| `contact.page_description` | `Visit our studio on Hempstead Turnpike, call us, or send a message. Same-day delivery across Long Island and Queens.` | `Visit our studio on Willis Ave in Albertson, call us, or send a message. Same-day delivery across Long Island and Queens.` |
| `contact.studio.address_value` | `1077 Hempstead Tpke, Franklin Square, NY 11010` | `1077 Willis Ave, Albertson, NY 11507` |
| `contact.map.alt` | `Map showing Diva Flowers at 1077 Hempstead Turnpike, Franklin Square, NY` | `Map showing Diva Flowers at 1077 Willis Ave, Albertson, NY` |
| `legal.privacy.contact.p1` (line ~235) | `…1077 Hempstead Tpke, Franklin Square, NY 11010.` | `…1077 Willis Ave, Albertson, NY 11507.` (preserve the rest of the paragraph verbatim) |
| `legal.terms.contact.p1` (line ~276) | `…1077 Hempstead Tpke, Franklin Square, NY 11010.` | `…1077 Willis Ave, Albertson, NY 11507.` (preserve the rest of the paragraph verbatim) |

- [ ] **Step 2: Update `messages/es.json` with the same five edits**

Apply the same swaps in Spanish copy. The Spanish privacy/terms paragraphs follow the same structure; replace the postal address only. For `page_description` (Spanish):

| Path | Old value | New value |
|---|---|---|
| `contact.page_description` | `Visítanos en Hempstead Turnpike, llámanos o envíanos un mensaje. Entrega el mismo día en Long Island y Queens.` | `Visítanos en Willis Ave en Albertson, llámanos o envíanos un mensaje. Entrega el mismo día en Long Island y Queens.` |
| `contact.studio.address_value` | `1077 Hempstead Tpke, Franklin Square, NY 11010` | `1077 Willis Ave, Albertson, NY 11507` |
| `contact.map.alt` | `Mapa que muestra Diva Flowers en 1077 Hempstead Turnpike, Franklin Square, NY` | `Mapa que muestra Diva Flowers en 1077 Willis Ave, Albertson, NY` |

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Verify no remaining strict-address occurrences in i18n**

Run: `grep -n "Hempstead Tpke\|Hempstead Turnpike, Franklin Square\|Franklin Square, NY 11010" messages/en.json messages/es.json || echo "clean"`
Expected: `clean`. (Note: editorial mentions of just "Hempstead Turnpike" without the full address are intentionally still there — handled in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n: update address-of-record strings to Willis Ave / Albertson"
```

---

## Task 7: Update the home e2e test

**Files:**
- Modify: `tests/e2e/home.spec.ts`

The current test asserts visibility of `Hempstead Turnpike` (line 9). After Task 8 we'll have updated the editorial copy that contained that string. Even before Task 8 runs, Task 4 added the new `StudioVisit` section that should be asserted in e2e.

- [ ] **Step 1: Replace the brittle assertion and add a new one**

In `tests/e2e/home.spec.ts`, replace the existing English test (lines 3-13) with:

```ts
test("home renders in English with hero, marquee, bento, studio visit", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: /Romance, by the stem/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shop arrangements/ })).toBeVisible();
  await expect(page.getByText("The Ingrid Bouquet")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Find your bloom/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Visit the studio|Walk in, ring the bell/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Get directions/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Installations, by Diva/ })).toBeVisible();
  await expect(page.getByPlaceholder("you@email.com")).toBeVisible();
  await expect(page.getByText("516 484 3456")).toBeVisible();
});
```

(`Visit the studio` is the eyebrow text; `Walk in, ring the bell` is the heading. The regex matches either, so the test stays robust if the eyebrow is rendered as a heading-equivalent or vice versa.)

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test tests/e2e/home.spec.ts`
Expected: 3 tests pass (English render, Spanish render, no console errors).

If the dev server is not already running for Playwright, run the project's standard e2e command instead — check `package.json` for a `test:e2e` script and use that. Common form: `npm run test:e2e -- tests/e2e/home.spec.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/home.spec.ts
git commit -m "test(e2e): assert StudioVisit section on home; drop Hempstead text check"
```

---

## Task 8: Decide and update editorial brand copy referencing the old street

The following strings reference "Hempstead Turnpike" or "Franklin Square" as part of brand-flavor copy (not as a literal address). Since the studio is actually on Willis Ave in Albertson, these are factually incorrect and should be updated. **However**, this is closer to brand voice work than feature work, so confirm before applying.

**i18n editorial strings:**
- `messages/en.json` and `messages/es.json` `home.hero.sub` (lines ~136): `…hand-built daily under our hot-pink arch on Hempstead Turnpike.` → recommend: `…hand-built daily under our hot-pink arch on Willis Ave.`
- `home.bento.console_title` (lines ~143): `Live from Hempstead Turnpike.` → recommend: `Live from Willis Ave.`
- `home.editorial_split.title` (lines ~168): `Built around our floral arch on Hempstead Turnpike.` → recommend: `Built around our floral arch on Willis Ave.`
- `story.*` (line ~328): `Built around a single arch on Hempstead Turnpike.` → recommend: `Built around a single arch on Willis Ave.`

**Components / data:**
- `components/home/BentoPressTile.tsx:9-10` — fictional press quotes attributed to The Cut and Vogue, both naming "Hempstead Turnpike" / "Franklin Square". These are brand voice; recommend updating to "Willis Ave" / "Albertson" for internal consistency.
- `data/journal.tsx:51,71` — journal entry copy about "the storefront arch on Hempstead Turnpike". Recommend updating to "Willis Ave".

- [ ] **Step 1: Decision point — confirm with the user**

Before editing any of the above, surface the list to the user (in chat, not in a file) and ask:

> The address sweep also turns up brand-flavor copy that names the old street ("Live from Hempstead Turnpike", "our floral arch on Hempstead Turnpike", press quotes, journal entries). These aren't strict addresses but they're factually wrong now. Want me to swap "Hempstead Turnpike" → "Willis Ave" and "Franklin Square" → "Albertson" across these strings? (List of files: messages/en.json, messages/es.json, components/home/BentoPressTile.tsx, data/journal.tsx)

If the user declines, mark this task complete with a no-op and move on.
If the user approves, proceed to Step 2.

- [ ] **Step 2: Apply the edits**

For each string listed above, replace `Hempstead Turnpike` with `Willis Ave` and `Franklin Square` with `Albertson`. Preserve all surrounding copy verbatim. Touch only the literal street/locality names — do not rewrite paragraphs.

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Verify no remaining old-address occurrences in app code or i18n**

Run:
```bash
grep -rn "Hempstead\|Franklin Square\|11010" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  app components data messages \
  | grep -v "delivery-zones.ts" || echo "clean"
```

`delivery-zones.ts:10` legitimately keeps `11010` as a delivery-area zip — that is unrelated to the store address. Everything else should be gone.

Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json components/home/BentoPressTile.tsx data/journal.tsx
git commit -m "copy: align brand-flavor location references to Willis Ave / Albertson"
```

---

## Task 9: Final verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint (if configured)**

Run: `npm run lint` (skip if the script is not defined)
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, no errors. Warnings about image optimization or unrelated routes are acceptable.

- [ ] **Step 4: e2e suite**

Run: `npm run test:e2e` (or `npx playwright test`)
Expected: all tests pass.

- [ ] **Step 5: Manual browser smoke test**

Run: `npm run dev`

Walk through:
- `/en` — confirm `StudioVisit` is between weddings teaser and newsletter; map is interactive; "Get directions" opens correct destination in new tab; "Call the studio" triggers tel: link.
- `/es` — same as above with Spanish copy.
- `/en/contact` — confirm contact map is now an interactive iframe; address chip shows new address; "Get directions" link below the map works.
- `/es/contact` — Spanish version.
- Footer (any page) — address line shows `1077 Willis Ave · Albertson, NY 11507`.
- `/en/legal/privacy` and `/en/legal/terms` — postal address paragraph cites the new address.

Stop the dev server.

- [ ] **Step 6: No follow-up commit needed** unless issues are found in steps 1–5. If issues are found, fix them in dedicated commits (one per fix), then re-run the full verification.

---

## Done criteria

1. Home renders the `StudioVisit` section between `WeddingsTeaser` and `NewsletterField` in both locales, with an interactive Google Map iframe.
2. Contact page renders an interactive Google Map iframe (no more `picsum.photos` placeholder), with a working "Get directions" link.
3. `data/site.ts` is the single source of truth for studio address and map URLs; Footer, contact metadata, and legal addresses all reflect `1077 Willis Ave, Albertson, NY 11507`.
4. e2e tests pass; build succeeds; no console errors in dev or production builds.
5. No remaining references to `Hempstead`, `Franklin Square`, or `11010` (except `data/delivery-zones.ts` where `11010` is a delivery zip).
