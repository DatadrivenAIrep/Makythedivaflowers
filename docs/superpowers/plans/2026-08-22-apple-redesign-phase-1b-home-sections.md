# Apple Fluid Redesign — Phase 1b: Home Sections (dirección A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply home architecture **dirección A** to the rest of the home — reorder sections, merge the two social-proof sections and the two vertical teasers, soften the "console/dashboard" framing, and dial back ambient noise (grain → hero-only, remove ambient petals) — while keeping Diva's identity and the Phase-1 material/motion system.

**Architecture:** Small, mostly file-local edits plus two clean merges. New presentational `VerticalTeaser` + `Verticals` (2-up) absorb the twin Weddings/Events teasers. `GoogleReviews`/`TikTokStrip` are refactored to expose chrome-free *Content* components that a new unified `SocialProof` band composes. `Grain` moves into the hero (page-level → hero-only). Ambient `<PetalRain/>` is removed from `CategoryOrbit` (petals become delight-only, deferred to Phase 2) — which also resolves a pre-existing hydration mismatch. `page.tsx` is reordered last.

**Tech Stack:** Next.js 16 (App Router, modified — read `node_modules/next/dist/docs/` before any Next API), React 19, Tailwind v4, Framer Motion 12, next-intl, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-22-apple-fluid-redesign-design.md` (home architecture = dirección A).

## Global Constraints

- **Modified Next.js** — consult `node_modules/next/dist/docs/` before using any Next API. `next/image`, `next/link`, `getTranslations`/`setRequestLocale` from `next-intl/server` are already used across these files; follow existing patterns.
- **Tests** live in `tests/unit/**/*.test.ts(x)` (vitest, jsdom, alias `@`). Run one file: `npx vitest run tests/unit/<file>`. Do NOT gate on full `npm test` (~8 pre-existing failures in `checkout-schema`/`print-chromium`, unrelated).
- **Verification reality:** most of these are server-async components with data + i18n imports that don't unit-test cleanly. Where a *presentational* unit is cleanly testable (e.g. `VerticalTeaser`), TDD it. Otherwise the gate is **browser verification** on the running dev server (`npm run dev`, home at `/en` and `/es`) plus `npx tsc --noEmit` clean — the task says which applies.
- **Preserve i18n** — copy comes from `messages/{en,es}.json`; do not hardcode user-facing strings. Reuse existing namespaces (`home.weddings_teaser`, `home.events_teaser`, `home.reviews`, `home.tiktok`); only add keys if a new label is truly needed, and add BOTH locales.
- **Preserve behavior** — keep the Google reviews JSON-LD (`buildReviewsJsonLd`) rendered exactly once; keep the TikTok empty-guard (`TIKTOKS.length === 0` → render nothing); keep `next/image` usage.
- **Use Phase-1 tokens** where a surface is restyled: `--material-*`, `--text-*`, `SPRING` from `@/lib/motion`. Motion default = `SPRING.default` (bounce 0); bounce only after a momentum gesture. Compositor-only animation (`transform`/`opacity`).
- **Branch** `feat/apple-home-1b`. Commit after each task.

## File Structure

```
components/home/VerticalTeaser.tsx     NEW  presentational card (strings in, no data/i18n) — unit-tested
components/home/Verticals.tsx          NEW  server: 2-up grid of VerticalTeaser (weddings + events)
tests/unit/vertical-teaser.test.tsx    NEW
components/home/GoogleReviews.tsx       MOD  extract GoogleReviewsContent (chrome-free), keep JSON-LD + thin section wrapper
components/home/TikTokStrip.tsx         MOD  extract TikTokContent (chrome-free, keeps empty-guard), keep thin section wrapper
components/home/SocialProof.tsx         NEW  server: one unified band composing GoogleReviewsContent + TikTokContent
components/home/CategoryOrbit.tsx       MOD  remove ambient <PetalRain/>; remove LAT/LON console badge
components/home/BentoGrid.tsx           MOD  remove the "SYSTEM ACTIVE" pulse block
components/home/Hero.tsx                MOD  render Grain inside the hero (hero-only), lighter opacity
app/[locale]/page.tsx                   MOD  drop page-level <Grain/>; reorder to dirección A; swap merged components
```

---

### Task 1: Grain → hero-only + lighter

**Files:** Modify `components/home/Hero.tsx`, `app/[locale]/page.tsx`

Restraint (dirección A: "grain solo en hero y a menor opacidad"). Today `<Grain/>` is a page-level fixed full-screen overlay (`app/[locale]/page.tsx:46`, `opacity-[0.04]`). Scope it to the hero only.

- [ ] **Step 1: Read** `components/brand/Grain.tsx` and `components/home/Hero.tsx`. `Grain` accepts `{ className }` and renders `<div aria-hidden className="pointer-events-none fixed inset-0 z-[60] mix-blend-multiply opacity-[0.04] ...">`.

- [ ] **Step 2: Render Grain inside the hero.** In `components/home/Hero.tsx`, import Grain and render it as an absolutely-positioned overlay scoped to the hero `<section>` (which is `relative min-h-[100dvh] overflow-hidden`), just after the background block. Pass a className that overrides `fixed inset-0` → `absolute inset-0` and lowers opacity:

```tsx
import { Grain } from "@/components/brand/Grain";
// ...inside the hero <section>, after the background <div> (around line 49):
<Grain className="!fixed-none absolute z-[5] opacity-[0.03]" />
```

Because `Grain`'s own class hardcodes `fixed inset-0 z-[60] opacity-[0.04]` and it merges via `cn()`, prefer making Grain's base overridable: change `components/brand/Grain.tsx` so the base omits `fixed`/`z`/`opacity` when a caller supplies them. Simplest robust approach — edit Grain's base string to `"pointer-events-none inset-0 mix-blend-multiply"` and move `fixed z-[60] opacity-[0.04]` into a default that callers can override; keep every existing caller identical by having Grain default to `className = "fixed z-[60] opacity-[0.04]"`. Concretely, change Grain to:

```tsx
export function Grain({ className = "fixed z-[60] opacity-[0.04]" }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none inset-0 mix-blend-multiply", className)}
      style={{ backgroundImage: "url(/grain.svg)", backgroundSize: "256px 256px" }} />
  );
}
```

(Verify the existing `style`/attrs match the current file when you edit — keep them.) Existing page-level callers that pass no className keep the old look via the default. The hero passes `className="absolute z-[5] opacity-[0.03]"`.

- [ ] **Step 3: Remove the page-level Grain from the home.** In `app/[locale]/page.tsx`, delete the `<Grain />` line (line ~46) and its import (line 5). (Grain stays used on journal/shop/sympathy/orchids/corsages pages — do not touch those.)

- [ ] **Step 4: Verify (browser + tsc).** `npx tsc --noEmit` clean. Then `npm run dev`, open `/en`: grain texture is now only over the hero (not over the lower sections) and subtler; the rest of the home is clean bone. No console errors from Grain.

- [ ] **Step 5: Commit**

```bash
git add components/brand/Grain.tsx components/home/Hero.tsx "app/[locale]/page.tsx"
git commit -m "feat(home): scope grain to the hero and lighten it (restraint pass)"
```

---

### Task 2: Remove ambient petals + soften CategoryOrbit console

**Files:** Modify `components/home/CategoryOrbit.tsx`

dirección A: petals = delight-only (not ambient); soften console framing. Removing the ambient `<PetalRain/>` also resolves the pre-existing home hydration mismatch (the `motion.span` inline-style formatting on those petals).

- [ ] **Step 1: Read** `components/home/CategoryOrbit.tsx`. Note: `<PetalRain />` at ~line 216; the LAT/LON mono coordinate badge at ~lines 261-263 (`LAT 40.7000° N · LON 73.6700° W`, `font-mono ... tracking-[0.3em]`); the per-tile pulse dot ~lines 173-182; the index counter `[ {activeIndex} / 06 ]` ~line 283.

- [ ] **Step 2: Remove the ambient petals.** Delete the `<PetalRain />` render (~line 216) and its import (top of file). Leave `components/home/PetalRain.tsx` in place (still used by `app/[locale]/mothers-day/page.tsx`).

- [ ] **Step 3: Remove the LAT/LON console badge** (~lines 261-263) — the coordinate string reads as "dashboard," which dirección A dials back. Keep the section title and the tiles. Leave the per-tile pulse dot and the index counter as-is (they are subtle and part of the interactive orbit; softening them further is out of scope here).

- [ ] **Step 4: Verify (browser + tsc).** `npx tsc --noEmit` clean. `npm run dev`, open `/en`, scroll to the categories section: no falling petals, no LAT/LON badge; **check the browser console — the previous hydration-mismatch warning is gone.**

- [ ] **Step 5: Commit**

```bash
git add components/home/CategoryOrbit.tsx
git commit -m "feat(home): remove ambient petals and the coordinate badge from the category orbit"
```

---

### Task 3: Soften the Bento "console" framing

**Files:** Modify `components/home/BentoGrid.tsx`

dirección A: "framing consola suavizado." Remove the hardcoded "SYSTEM ACTIVE" status block; keep the eyebrow + title (they read as editorial, not console).

- [ ] **Step 1: Read** `components/home/BentoGrid.tsx`. The "SYSTEM ACTIVE" block is ~lines 23-28: a `<div className="hidden md:flex items-center gap-3">` containing a static `<span className="size-1.5 rounded-full bg-rouge" />` and a `<span className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute-500">SYSTEM ACTIVE</span>`.

- [ ] **Step 2: Remove the SYSTEM ACTIVE block** (the whole `<div>` at ~lines 23-28). The header (`flex items-end justify-between`) now holds just the eyebrow+title cluster; leave the container — it will left-align, which is fine, or change `justify-between` to `justify-start` if the empty side looks off (use your judgment reading the rendered result).

- [ ] **Step 3: Write the failing test** (this one IS cleanly testable — the header text is static). `tests/unit/bento-grid.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BentoGrid } from "@/components/home/BentoGrid";

// BentoGrid is an async server component; render its resolved element.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (k: string) => k,
}));

describe("BentoGrid header (softened console)", () => {
  it("no longer shows the SYSTEM ACTIVE status", async () => {
    const ui = await BentoGrid({ locale: "en" });
    render(ui);
    expect(screen.queryByText(/SYSTEM ACTIVE/i)).toBeNull();
  });
});
```

> If awaiting the async component in the test proves impractical (child tiles pull data/i18n that jsdom can't resolve), delete this test and instead verify in the browser (Step 5) that "SYSTEM ACTIVE" is gone — note which path you took in your report.

- [ ] **Step 4: Run test** — `npx vitest run tests/unit/bento-grid.test.tsx`. RED before the edit (text present), GREEN after.

- [ ] **Step 5: Verify (browser + tsc).** `npx tsc --noEmit` clean. `npm run dev`, `/en`: the bento header shows the eyebrow + "Live from Willis Ave." title, no "SYSTEM ACTIVE" tag.

- [ ] **Step 6: Commit**

```bash
git add components/home/BentoGrid.tsx tests/unit/bento-grid.test.tsx
git commit -m "feat(home): soften the bento console framing (drop SYSTEM ACTIVE)"
```

---

### Task 4: Merge verticals → `VerticalTeaser` + `Verticals` (2-up)

**Files:** Create `components/home/VerticalTeaser.tsx`, `components/home/Verticals.tsx`, `tests/unit/vertical-teaser.test.tsx`; Modify `app/[locale]/page.tsx` (done in Task 6's reorder — here just create + wire the section)

The two teasers are twins differing only in namespace/image/href. Extract one presentational card + a 2-up section.

**Interfaces produced:** `VerticalTeaser({ eyebrow, title, cta, imageSrc, imageAlt, href }: {...string})`; `Verticals({ locale }: { locale: Locale })` (server async).

- [ ] **Step 1: Write the failing test** `tests/unit/vertical-teaser.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerticalTeaser } from "@/components/home/VerticalTeaser";

describe("VerticalTeaser", () => {
  it("renders the copy and links to the destination", () => {
    render(
      <VerticalTeaser
        eyebrow="Weddings" title="Say it with flowers" cta="Explore weddings"
        imageSrc="/weddings/oh1-scaled.webp" imageAlt="A wedding arch"
        href="/en/weddings"
      />,
    );
    expect(screen.getByText("Say it with flowers")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Explore weddings/i });
    expect(link).toHaveAttribute("href", "/en/weddings");
  });
});
```

- [ ] **Step 2: Run test** — `npx vitest run tests/unit/vertical-teaser.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Create `components/home/VerticalTeaser.tsx`** (presentational; mirror the current teaser card markup — read `components/home/WeddingsTeaser.tsx` for the exact card classes and reuse them verbatim):

```tsx
import Image from "next/image";
import Link from "next/link";

export function VerticalTeaser({
  eyebrow, title, cta, imageSrc, imageAlt, href,
}: {
  eyebrow: string; title: string; cta: string;
  imageSrc: string; imageAlt: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[var(--radius-bento)] aspect-[16/9] text-bone"
    >
      <Image
        src={imageSrc} alt={imageAlt} fill
        className="object-cover transition-transform duration-700 ease-[var(--ease-elegant)] group-hover:scale-[1.03]"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/80">{eyebrow}</span>
        <h3 className="font-display text-2xl md:text-3xl leading-[1.05] tracking-tight mt-2">{title}</h3>
        <span className="mt-3 font-sans text-sm underline-offset-4 group-hover:underline">{cta} →</span>
      </div>
    </Link>
  );
}
```

(Match the aspect/classes to the current teasers when you read them; the above follows their pattern — `rounded-[var(--radius-bento)]`, the same gradient overlay, `text-bone`.)

- [ ] **Step 4: Run test** — GREEN.

- [ ] **Step 5: Create `components/home/Verticals.tsx`** (server; resolves both namespaces and renders a 2-up). Read the exact keys used by `WeddingsTeaser`/`EventsTeaser` (`t("eyebrow")`, `t("title")`, the CTA key — confirm its name) and the image paths (`/weddings/oh1-scaled.webp`, `/events/evento-01/p01.webp`) and hrefs (`/${locale}/weddings`, `/${locale}/events`):

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { VerticalTeaser } from "@/components/home/VerticalTeaser";

export async function Verticals({ locale }: { locale: Locale }) {
  const w = await getTranslations("home.weddings_teaser");
  const e = await getTranslations("home.events_teaser");
  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 py-16">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <VerticalTeaser
          eyebrow={w("eyebrow")} title={w("title")} cta={w("cta")}
          imageSrc="/weddings/oh1-scaled.webp" imageAlt={w("title")}
          href={`/${locale}/weddings`}
        />
        <VerticalTeaser
          eyebrow={e("eyebrow")} title={e("title")} cta={e("cta")}
          imageSrc="/events/evento-01/p01.webp" imageAlt={e("title")}
          href={`/${locale}/events`}
        />
      </div>
    </section>
  );
}
```

> Confirm the real i18n key names by reading the two teaser files — if the CTA key is not `cta` (e.g. `link`/`button`), use the actual name in both places. If a key is missing in a namespace, prefer reusing what the old component used rather than inventing keys.

- [ ] **Step 6: Retire the old teasers from the home** — they are replaced by `Verticals`. Grep for other importers of `WeddingsTeaser`/`EventsTeaser`: `grep -rn "WeddingsTeaser\|EventsTeaser" components app`. If the ONLY importer is `app/[locale]/page.tsx`, delete `components/home/WeddingsTeaser.tsx` and `components/home/EventsTeaser.tsx` (Task 6 removes their usage). If anything else imports them, keep the files and note it.

- [ ] **Step 7: Verify + Commit** — `npx tsc --noEmit` clean; `npx vitest run tests/unit/vertical-teaser.test.tsx` GREEN.

```bash
git add components/home/VerticalTeaser.tsx components/home/Verticals.tsx tests/unit/vertical-teaser.test.tsx
# plus any deletions from Step 6
git commit -m "feat(home): merge weddings + events teasers into a 2-up Verticals section"
```

---

### Task 5: Merge social proof → `SocialProof` band

**Files:** Modify `components/home/GoogleReviews.tsx`, `components/home/TikTokStrip.tsx`; Create `components/home/SocialProof.tsx`

dirección A: "Google + TikTok en una banda." Refactor each into chrome-free content, then compose one unified band. NO duplicated markup.

- [ ] **Step 1: Read** `components/home/GoogleReviews.tsx` and `components/home/TikTokStrip.tsx` fully. Note: GoogleReviews renders JSON-LD (`buildReviewsJsonLd` via `dangerouslySetInnerHTML`) + a bordered card (rating, `★★★★★`, Google chip, `GoogleReviewsClient`, CTA). TikTokStrip early-returns `null` if `TIKTOKS.length === 0`, renders a `bg-petal` band with a horizontal-scroll `<ul>` of `<TikTokCard>`.

- [ ] **Step 2: Extract chrome-free content.**
  - In `GoogleReviews.tsx`: add an exported `async function GoogleReviewsContent({ locale })` that returns everything currently inside the `<section>` EXCEPT the `<section>` wrapper (keep the JSON-LD `<script>` and the card). Change `GoogleReviews` to render `<section className="pt-24 pb-0 md:pt-32 md:pb-0" aria-label={...}><GoogleReviewsContent locale={locale} /></section>` so existing standalone use is unchanged.
  - In `TikTokStrip.tsx`: add an exported `async function TikTokContent({ locale })` returning the inner content (the heading + the `<ul>` scroller), keeping the `TIKTOKS.length === 0` guard (return `null`). Change `TikTokStrip` to render its old `<section className="bg-petal text-ink">…<TikTokContent/>…</section>` wrapper.

- [ ] **Step 3: Create `components/home/SocialProof.tsx`** — one unified band, one eyebrow/title, reviews on top, TikTok below, consistent rhythm on bone:

```tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { GoogleReviewsContent } from "@/components/home/GoogleReviews";
import { TikTokContent } from "@/components/home/TikTokStrip";

export async function SocialProof({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.reviews");
  return (
    <section aria-label={t("aria.section")} className="mx-auto max-w-[var(--container-max)] px-6 py-24 md:py-28">
      <div className="grid gap-10 md:gap-14">
        <GoogleReviewsContent locale={locale} />
        <TikTokContent locale={locale} />
      </div>
    </section>
  );
}
```

> Reconcile the visual seam: the old TikTok block was a full-bleed `bg-petal` band; inside `SocialProof` it now sits on bone. Drop the `bg-petal` full-bleed wrapper from `TikTokContent` (keep the heading + scroller) so the two blocks read as one band. Keep the reviews card's border/rounding. Preserve the JSON-LD (it renders once, inside `GoogleReviewsContent`). Keep the `aria-label`/heading semantics reasonable — one section landmark, sub-headings for each block.

- [ ] **Step 4: Verify (browser + tsc — this task is not cleanly unit-testable).** `npx tsc --noEmit` clean. `npm run dev`, `/en` and `/es`: one cohesive social-proof band (Google rating + rotating quote, then the TikTok row) on bone, no jarring pink full-bleed break, CTAs work. View source / network: exactly one Reviews JSON-LD `<script>`. With `TIKTOKS` empty the TikTok block disappears and the reviews block still renders.

- [ ] **Step 5: Commit**

```bash
git add components/home/GoogleReviews.tsx components/home/TikTokStrip.tsx components/home/SocialProof.tsx
git commit -m "feat(home): merge google reviews + tiktok into one social-proof band"
```

---

### Task 6: Reorder `page.tsx` to dirección A

**Files:** Modify `app/[locale]/page.tsx`

Wire everything into the approved order. Depends on Tasks 1, 4, 5.

- [ ] **Step 1: Update imports** — remove `Grain` (Task 1), `GoogleReviews`, `TikTokStrip`, `WeddingsTeaser`, `EventsTeaser`; add `SocialProof`, `Verticals`. Keep `Hero`, `KineticMarquee`, `BentoGrid`, `CategoryStrip`, `SympathyShowcase`, `EditorialSplit`, `StudioVisit`, `NewsletterField`.

- [ ] **Step 2: Reorder the `<main>` body** to dirección A:

```tsx
<main className="bg-bone text-ink">
  <Hero locale={locale} />
  <KineticMarquee text={`${marquee}  ·  `} />
  <CategoryStrip locale={locale} />
  <BentoGrid locale={locale} />
  <SocialProof locale={locale} />
  <SympathyShowcase locale={locale} />
  <Verticals locale={locale} />
  <EditorialSplit locale={locale} />
  <StudioVisit locale={locale} />
  <NewsletterField />
</main>
```

(Grain now lives inside `Hero`. CategoryStrip moved up ahead of Bento for the conversion goal. SocialProof and Verticals are the merged bands. EditorialSplit + StudioVisit + Newsletter close the "estudio" cluster.)

- [ ] **Step 3: Verify (browser + tsc).** `npx tsc --noEmit` clean. `npm run dev`, open `/en` AND `/es`, scroll the whole page: order matches dirección A; no duplicated sections; no console errors/hydration warnings; every section renders. Check mobile width too (resize).

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/page.tsx"
git commit -m "feat(home): reorder the home to dirección A (shop up, merged bands)"
```

---

## Self-Review

**Spec coverage (dirección A):** shop moved up ✅ (T6). Bento softened ✅ (T3). Social proof merged ✅ (T5). Sympathy kept ✅ (T6). Verticals merged ✅ (T4). Grain hero-only + petals dial-back ✅ (T1, T2). Marquee already 1× (no change needed — confirmed in the audit). Estudio+Newsletter close ✅ (T6).

**Verification honesty:** T3 has a unit test if the async render is feasible, else browser; T4 has a real presentational unit test; T1/T2/T5/T6 are browser-verified (server-async/visual) — the controller runs the live dev server (already up) and checks each. Every task also gates on `tsc --noEmit`.

**Type/interface consistency:** `VerticalTeaser` props (T4) match `Verticals`' call. `GoogleReviewsContent`/`TikTokContent` (T5) are consumed by `SocialProof` with `{ locale }`. `page.tsx` (T6) imports only components that exist after T1/T4/T5. i18n key names in `Verticals` must be confirmed against the real teaser files (flagged in T4 Step 5).

**Known follow-ups (carry to final review / Phase 2):** petals delight-placement on add-to-bag (Phase 2); any leftover console bits in CategoryOrbit (pulse dots / index counter) left intentionally; if old teaser/section components become unused, delete them (T4 Step 6) or note remaining consumers.
