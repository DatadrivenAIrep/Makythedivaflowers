# Weddings + Events Conversion Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift booking conversion on the existing weddings + events funnel by surfacing real proof, cutting form friction, adding a WhatsApp fast-lane, improving discovery, adding structured data, and firing an email alert on every inquiry.

**Architecture:** Small, presentational, prop-driven components (testimonials, rating chip, WhatsApp CTA, what-happens-next, form disclosure) composed into the existing server-component pages; pure helper functions for review filtering; two new JSON-LD server components mirroring `LocalBusinessLD`; a best-effort Resend email notifier called after the inquiry is persisted. No schema/validation changes, no redesign.

**Tech Stack:** Next.js (App Router, non-standard — read `node_modules/next/dist/docs/` before route/metadata changes), next-intl, React 19 server components, react-hook-form + zod (unchanged), Tailwind, Vitest 4 + @testing-library/react, Resend (already installed).

---

## Conventions (read once before starting)

- **Node:** use Node 22 (`/opt/homebrew/bin/node`); the shell default v16 breaks vitest/next.
- **Run one test file:** `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/<file>`
- **Test patterns (from the real harness):**
  - Pure functions → plain vitest (see `tests/unit/product-helpers.test.ts`).
  - Presentational server components that take strings as props → render directly, no i18n mock.
  - Components using `getTranslations` → `vi.mock("next-intl/server")` + a `globalThis` locale flag (see `tests/unit/PromPieces.test.tsx`).
  - Client components using `useTranslations` → wrap in `<NextIntlClientProvider locale messages>` (see `tests/unit/text-maky-modal.test.tsx`).
- **i18n parity is mandatory:** every key added to `messages/en.json` must be added to `messages/es.json` at the identical path. Both files are kept structurally identical.
- **Project rules:** never write "free delivery"; never use AI-generated product photos; keep copy warm and occasion-tailored with an explicit CTA.
- **Commit** after each task with the message shown in its final step.

## File Structure (created / modified)

**Create:**
- `data/review-helpers.ts` — pure filters over `REVIEWS` (by occasion / general).
- `components/social/RatingChip.tsx` — presentational "4.9 ★ · 127 reviews" pill.
- `components/social/Testimonials.tsx` — presentational testimonials section.
- `components/inquiry/WhatsAppCta.tsx` — presentational WhatsApp link (uses `buildWhatsappHref` + `SITE.mobile`).
- `components/inquiry/WhatHappensNext.tsx` — presentational 3-step reassurance strip.
- `components/ui/form/Disclosure.tsx` — native `<details>` "more details" wrapper.
- `components/home/EventsTeaser.tsx` — home discovery teaser (mirrors `WeddingsTeaser`).
- `components/seo/WeddingFaqLD.tsx` — `FAQPage` JSON-LD from `weddingFAQ`.
- `components/seo/ServiceLD.tsx` — `Service` JSON-LD, provider = `SITE`.
- `lib/notify-inquiry.ts` — best-effort Resend email on new inquiry.
- Test files under `tests/unit/` for each of the above.

**Modify:**
- `components/weddings/WeddingsHero.tsx`, `components/events/EventsHero.tsx` — add RatingChip + WhatsAppCta.
- `app/[locale]/weddings/page.tsx` — add Testimonials, WhatHappensNext, WeddingFaqLD, ServiceLD.
- `app/[locale]/events/page.tsx` — add Testimonials, WhatHappensNext, ServiceLD.
- `components/weddings/WeddingStories.tsx` — add gallery→form CTA banner.
- `components/inquiry/WeddingsForm.tsx`, `components/inquiry/EventsForm.tsx` — phone required + collapse optional fields.
- `data/wedding-faq.ts` — soften the minimum-spend answer (remove dollar figures).
- `app/[locale]/page.tsx` — mount `EventsTeaser`.
- `app/api/inquiry/route.ts` — call `notifyInquiry` after `saveInquiry`.
- `messages/en.json`, `messages/es.json` — new keys per task.

---

## Task 1: Review-filter helpers

**Files:**
- Create: `data/review-helpers.ts`
- Test: `tests/unit/review-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/review-helpers.test.ts
import { describe, it, expect } from "vitest";
import { reviewsByOccasion, generalReviews } from "@/data/review-helpers";

describe("reviewsByOccasion", () => {
  it("returns only reviews whose occasion matches", () => {
    const boda = reviewsByOccasion("Boda");
    expect(boda.length).toBeGreaterThanOrEqual(2);
    expect(boda.every((r) => r.occasion === "Boda")).toBe(true);
    expect(boda.map((r) => r.id)).toContain("blanca-duarte-martini-2025-12");
    expect(boda.map((r) => r.id)).toContain("samantha-brown-2026-03");
  });

  it("returns an empty array for an unused occasion", () => {
    expect(reviewsByOccasion("NoSuchOccasion")).toEqual([]);
  });
});

describe("generalReviews", () => {
  it("returns only reviews without an occasion", () => {
    const general = generalReviews();
    expect(general.length).toBeGreaterThanOrEqual(1);
    expect(general.every((r) => !r.occasion)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/review-helpers.test.ts`
Expected: FAIL — `Cannot find module '@/data/review-helpers'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// data/review-helpers.ts
import { REVIEWS, type Review } from "@/data/reviews";

/** Reviews tagged with a specific occasion (e.g. "Boda"). */
export function reviewsByOccasion(occasion: string): Review[] {
  return REVIEWS.filter((r) => r.occasion === occasion);
}

/** Reviews with no occasion tag — safe, non-misleading general proof. */
export function generalReviews(): Review[] {
  return REVIEWS.filter((r) => !r.occasion);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/review-helpers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add data/review-helpers.ts tests/unit/review-helpers.test.ts
git commit -m "feat(reviews): add occasion filters for testimonials"
```

---

## Task 2: RatingChip + Testimonials components

**Files:**
- Create: `components/social/RatingChip.tsx`, `components/social/Testimonials.tsx`
- Test: `tests/unit/testimonials.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/testimonials.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingChip } from "@/components/social/RatingChip";
import { Testimonials } from "@/components/social/Testimonials";
import type { Review } from "@/data/reviews";

const sample: Review[] = [
  {
    id: "r1",
    author: "Blanca D.",
    initials: "BD",
    rating: 5,
    occasion: "Boda",
    date: "2025-12",
    text: { en: "Beautiful bridal bouquet.", es: "Ramo de novia hermoso." },
    originalLang: "en",
  },
  {
    id: "r2",
    author: "Samantha B.",
    initials: "SB",
    rating: 5,
    occasion: "Boda",
    date: "2026-03",
    text: { en: "Made my wedding day.", es: "Hizo mi día de boda." },
    originalLang: "en",
  },
];

describe("RatingChip", () => {
  it("renders its label", () => {
    render(<RatingChip label="4.9 ★ · 127 reviews" />);
    expect(screen.getByText("4.9 ★ · 127 reviews")).toBeInTheDocument();
  });
});

describe("Testimonials", () => {
  it("renders the EN quotes, authors, eyebrow and title", () => {
    render(
      <Testimonials
        reviews={sample}
        locale="en"
        eyebrow="In their words"
        title="Couples on Diva."
      />,
    );
    expect(screen.getByText("In their words")).toBeInTheDocument();
    expect(screen.getByText("Couples on Diva.")).toBeInTheDocument();
    expect(screen.getByText(/Beautiful bridal bouquet\./)).toBeInTheDocument();
    expect(screen.getByText("Blanca D.")).toBeInTheDocument();
  });

  it("renders the ES quote text for locale es", () => {
    render(
      <Testimonials reviews={sample} locale="es" eyebrow="x" title="y" />,
    );
    expect(screen.getByText(/Ramo de novia hermoso\./)).toBeInTheDocument();
  });

  it("renders nothing when there are no reviews", () => {
    const { container } = render(
      <Testimonials reviews={[]} locale="en" eyebrow="x" title="y" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/testimonials.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write RatingChip**

```tsx
// components/social/RatingChip.tsx
export function RatingChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-bone/40 bg-ink/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone/90 backdrop-blur-sm">
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Write Testimonials**

```tsx
// components/social/Testimonials.tsx
import type { Review } from "@/data/reviews";
import type { Locale } from "@/types/locale";

export function Testimonials({
  reviews,
  locale,
  eyebrow,
  title,
}: {
  reviews: Review[];
  locale: Locale;
  eyebrow: string;
  title: string;
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">
            {title}
          </h2>
        </header>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-5 rounded-[var(--radius-bento)] border border-ink/10 bg-white/40 p-7"
            >
              <p className="text-base leading-relaxed text-ink/80">
                &ldquo;{r.text[locale]}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-ink/[0.06] font-mono text-[11px] tracking-wider text-ink/70">
                  {r.initials}
                </span>
                <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/60">
                  {r.author}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/testimonials.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add components/social/RatingChip.tsx components/social/Testimonials.tsx tests/unit/testimonials.test.tsx
git commit -m "feat(social): add RatingChip and Testimonials components"
```

---

## Task 3: Add testimonials + rating keys, wire into weddings page & hero

**Files:**
- Modify: `messages/en.json`, `messages/es.json`, `components/weddings/WeddingsHero.tsx`, `app/[locale]/weddings/page.tsx`

- [ ] **Step 1: Add keys to `messages/en.json`**

Inside the `"weddings"` object, add `rating_chip` next to `hero_cta`, and a `testimonials` object next to `stories`:

```jsonc
// within "weddings": { ... }
"rating_chip": "{rating} ★ · {count} reviews",
"testimonials": {
  "eyebrow": "In their words",
  "title": "Couples on Diva."
}
```

- [ ] **Step 2: Add the identical keys to `messages/es.json`**

```jsonc
// within "weddings": { ... }
"rating_chip": "{rating} ★ · {count} reseñas",
"testimonials": {
  "eyebrow": "En sus palabras",
  "title": "Novias sobre Diva."
}
```

- [ ] **Step 3: Wire the RatingChip into the weddings hero**

Modify `components/weddings/WeddingsHero.tsx` — add imports and render the chip above the title:

```tsx
// components/weddings/WeddingsHero.tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { RatingChip } from "@/components/social/RatingChip";
import { REVIEWS_AGGREGATE } from "@/data/reviews";
import type { Locale } from "@/types/locale";

export async function WeddingsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "weddings" });
  return (
    <section className="relative min-h-[100dvh] flex items-end overflow-hidden">
      <Image
        src="/images/wedding-stories-header.webp"
        alt={t("hero_alt")}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pb-20 pt-32 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">{t("eyebrow")}</p>
          <h1 className="font-display text-bone text-6xl sm:text-7xl lg:text-8xl leading-[0.92] tracking-tighter">
            {t("hero_title")}
          </h1>
          <p className="text-bone/85 text-lg max-w-[52ch]">{t("hero_sub")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <MagneticButton href={`/${locale}/weddings#inquire`} ariaLabel={t("hero_cta")}>
              {t("hero_cta")}
            </MagneticButton>
          </div>
          <RatingChip
            label={t("rating_chip", {
              rating: String(REVIEWS_AGGREGATE.rating),
              count: REVIEWS_AGGREGATE.total,
            })}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire Testimonials into the weddings page**

Modify `app/[locale]/weddings/page.tsx` — import and render between `WeddingStories` and `WeddingsFAQ`:

```tsx
// app/[locale]/weddings/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WeddingsHero } from "@/components/weddings/WeddingsHero";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { WeddingStories } from "@/components/weddings/WeddingStories";
import { WeddingsFAQ } from "@/components/weddings/WeddingsFAQ";
import { PricingIntent } from "@/components/weddings/PricingIntent";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";
import { Testimonials } from "@/components/social/Testimonials";
import { reviewsByOccasion } from "@/data/review-helpers";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: { languages: { en: "/en/weddings", es: "/es/weddings" } },
  };
}

export default async function WeddingsPage({
  params,
}: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "weddings.testimonials" });
  return (
    <>
      <WeddingsHero locale={locale} />
      <ProcessStrip />
      <PricingIntent locale={locale} />
      <WeddingStories locale={locale} />
      <Testimonials
        reviews={reviewsByOccasion("Boda")}
        locale={locale}
        eyebrow={t("eyebrow")}
        title={t("title")}
      />
      <WeddingsFAQ locale={locale} />
      <section id="inquire" className="py-24">
        <WeddingsForm locale={locale} />
      </section>
    </>
  );
}
```

- [ ] **Step 5: Verify build/typecheck and message parity**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/testimonials.test.tsx`
Then confirm JSON validity: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('json ok')"`
Expected: tests PASS, `json ok`.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/es.json components/weddings/WeddingsHero.tsx app/[locale]/weddings/page.tsx
git commit -m "feat(weddings): surface real testimonials + rating chip on the page"
```

---

## Task 4: Wire testimonials + rating into events page & hero

**Files:**
- Modify: `messages/en.json`, `messages/es.json`, `components/events/EventsHero.tsx`, `app/[locale]/events/page.tsx`

Events has no event-specific reviews; use general (untagged) reviews so nothing is misrepresented.

- [ ] **Step 1: Add keys to `messages/en.json`** (inside `"events"`):

```jsonc
"rating_chip": "{rating} ★ · {count} reviews",
"testimonials": {
  "eyebrow": "In their words",
  "title": "What clients say."
}
```

- [ ] **Step 2: Add identical keys to `messages/es.json`** (inside `"events"`):

```jsonc
"rating_chip": "{rating} ★ · {count} reseñas",
"testimonials": {
  "eyebrow": "En sus palabras",
  "title": "Lo que dicen los clientes."
}
```

- [ ] **Step 3: Wire the RatingChip into the events hero**

Modify `components/events/EventsHero.tsx`. Read the file first, then mirror the weddings hero: import `RatingChip` and `REVIEWS_AGGREGATE`, and render `<RatingChip label={t("rating_chip", { rating: String(REVIEWS_AGGREGATE.rating), count: REVIEWS_AGGREGATE.total })} />` immediately after the existing CTA button, inside the hero's text column.

```tsx
// add these imports at the top of components/events/EventsHero.tsx
import { RatingChip } from "@/components/social/RatingChip";
import { REVIEWS_AGGREGATE } from "@/data/reviews";
```

```tsx
// render immediately after the existing <MagneticButton>…</MagneticButton>
<RatingChip
  label={t("rating_chip", {
    rating: String(REVIEWS_AGGREGATE.rating),
    count: REVIEWS_AGGREGATE.total,
  })}
/>
```

- [ ] **Step 4: Wire Testimonials into the events page**

Modify `app/[locale]/events/page.tsx` — render after `UseCaseGrid`:

```tsx
// app/[locale]/events/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EventsHero } from "@/components/events/EventsHero";
import { UseCaseGrid } from "@/components/events/UseCaseGrid";
import { ProcessStrip } from "@/components/weddings/ProcessStrip";
import { EventsForm } from "@/components/inquiry/EventsForm";
import { Testimonials } from "@/components/social/Testimonials";
import { generalReviews } from "@/data/review-helpers";
import type { Locale } from "@/types/locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/events", es: "/es/events" } },
  };
}

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tt = await getTranslations({ locale, namespace: "events.testimonials" });
  return (
    <main>
      <EventsHero locale={locale} />
      <UseCaseGrid locale={locale} />
      <Testimonials
        reviews={generalReviews().slice(0, 3)}
        locale={locale}
        eyebrow={tt("eyebrow")}
        title={tt("title")}
      />
      <ProcessStrip namespace="events.process" />
      <section id="inquire" className="py-24">
        <EventsForm locale={locale} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify JSON parity**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('json ok')"`
Expected: `json ok`.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/es.json components/events/EventsHero.tsx app/[locale]/events/page.tsx
git commit -m "feat(events): surface testimonials + rating chip on the page"
```

---

## Task 5: "What happens next" reassurance block

**Files:**
- Create: `components/inquiry/WhatHappensNext.tsx`
- Test: `tests/unit/what-happens-next.test.tsx`
- Modify: `messages/en.json`, `messages/es.json`, `app/[locale]/weddings/page.tsx`, `app/[locale]/events/page.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/what-happens-next.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatHappensNext } from "@/components/inquiry/WhatHappensNext";

describe("WhatHappensNext", () => {
  it("renders the title and each step in order", () => {
    render(
      <WhatHappensNext
        title="What happens next"
        steps={["You send this", "We reply within one business day", "We set up your consultation"]}
      />,
    );
    expect(screen.getByText("What happens next")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("You send this");
    expect(items[1]).toHaveTextContent("We reply within one business day");
    expect(items[2]).toHaveTextContent("We set up your consultation");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/what-happens-next.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// components/inquiry/WhatHappensNext.tsx
export function WhatHappensNext({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
          {title}
        </p>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={i} className="flex flex-col gap-3">
              <span className="font-display text-3xl text-ink/30">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-base leading-relaxed text-ink/80">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/what-happens-next.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add keys to `messages/en.json`**

Inside `"weddings"` add:

```jsonc
"next_steps": {
  "title": "What happens next",
  "step1": "You send this form — no obligation, no pressure.",
  "step2": "We reply by email or WhatsApp within one business day.",
  "step3": "We set up a consultation and start shaping your day."
}
```

Inside `"events"` add:

```jsonc
"next_steps": {
  "title": "What happens next",
  "step1": "You send this form with your dates and space.",
  "step2": "We reply by email or WhatsApp within one business day.",
  "step3": "We send a tailored proposal for your cadence."
}
```

- [ ] **Step 6: Add identical keys to `messages/es.json`**

Inside `"weddings"`:

```jsonc
"next_steps": {
  "title": "Qué pasa cuando escribes",
  "step1": "Envías este formulario — sin compromiso, sin presión.",
  "step2": "Te respondemos por email o WhatsApp en un día hábil.",
  "step3": "Agendamos una consulta y empezamos a dar forma a tu día."
}
```

Inside `"events"`:

```jsonc
"next_steps": {
  "title": "Qué pasa cuando escribes",
  "step1": "Envías este formulario con tus fechas y tu espacio.",
  "step2": "Te respondemos por email o WhatsApp en un día hábil.",
  "step3": "Te enviamos una propuesta a la medida de tu cadencia."
}
```

- [ ] **Step 7: Mount above the form on both pages**

In `app/[locale]/weddings/page.tsx`: import `WhatHappensNext`, load `const tn = await getTranslations({ locale, namespace: "weddings.next_steps" })`, and render it inside the `#inquire` section, before `<WeddingsForm>`:

```tsx
import { WhatHappensNext } from "@/components/inquiry/WhatHappensNext";
// ...
      <section id="inquire" className="py-24">
        <WhatHappensNext
          title={tn("title")}
          steps={[tn("step1"), tn("step2"), tn("step3")]}
        />
        <WeddingsForm locale={locale} />
      </section>
```

In `app/[locale]/events/page.tsx`: same pattern with `namespace: "events.next_steps"`, rendered before `<EventsForm>`.

- [ ] **Step 8: Verify JSON parity + tests**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('json ok')"`
Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/what-happens-next.test.tsx`
Expected: `json ok`, tests PASS.

- [ ] **Step 9: Commit**

```bash
git add components/inquiry/WhatHappensNext.tsx tests/unit/what-happens-next.test.tsx messages/en.json messages/es.json app/[locale]/weddings/page.tsx app/[locale]/events/page.tsx
git commit -m "feat(inquiry): add what-happens-next reassurance block on both pages"
```

---

## Task 6: WhatsApp fast-lane CTA in both heros

**Files:**
- Create: `components/inquiry/WhatsAppCta.tsx`
- Test: `tests/unit/whatsapp-cta.test.tsx`
- Modify: `messages/en.json`, `messages/es.json`, `components/weddings/WeddingsHero.tsx`, `components/events/EventsHero.tsx`

Uses the real `buildWhatsappHref` and `SITE.mobile.e164` (`+15168512815`) — no modal/context, no new number.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/whatsapp-cta.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppCta } from "@/components/inquiry/WhatsAppCta";

describe("WhatsAppCta", () => {
  it("renders a link with the given label and a whatsapp href containing the shop number", () => {
    render(<WhatsAppCta label="Text us on WhatsApp" message="Hi Maky" />);
    const link = screen.getByRole("link", { name: "Text us on WhatsApp" });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href") ?? "").toContain("15168512815");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/whatsapp-cta.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// components/inquiry/WhatsAppCta.tsx
import { SITE } from "@/data/site";
import { buildWhatsappHref } from "@/lib/text-maky-links";
import { cn } from "@/lib/cn";

export function WhatsAppCta({
  label,
  message,
  className,
}: {
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <a
      href={buildWhatsappHref(SITE.mobile.e164, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-bone/40 px-5 py-3 font-sans text-sm tracking-tight text-bone transition-colors hover:border-bone",
        className,
      )}
    >
      {label}
    </a>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/whatsapp-cta.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add keys to `messages/en.json`**

Inside `"weddings"`:

```jsonc
"hero_whatsapp": "Text us on WhatsApp",
"hero_whatsapp_msg": "Hi Maky, I'd like to inquire about wedding florals."
```

Inside `"events"`:

```jsonc
"hero_whatsapp": "Text us on WhatsApp",
"hero_whatsapp_msg": "Hi Maky, I'd like to ask about florals for an event."
```

- [ ] **Step 6: Add identical keys to `messages/es.json`**

Inside `"weddings"`:

```jsonc
"hero_whatsapp": "Escríbenos por WhatsApp",
"hero_whatsapp_msg": "Hola Maky, quiero consultar sobre flores para mi boda."
```

Inside `"events"`:

```jsonc
"hero_whatsapp": "Escríbenos por WhatsApp",
"hero_whatsapp_msg": "Hola Maky, quiero preguntar sobre flores para un evento."
```

- [ ] **Step 7: Render the CTA next to the primary hero CTA**

In `components/weddings/WeddingsHero.tsx`, import `WhatsAppCta` and place it inside the `flex flex-wrap items-center gap-4` wrapper next to `MagneticButton`:

```tsx
import { WhatsAppCta } from "@/components/inquiry/WhatsAppCta";
// ...
          <div className="flex flex-wrap items-center gap-4">
            <MagneticButton href={`/${locale}/weddings#inquire`} ariaLabel={t("hero_cta")}>
              {t("hero_cta")}
            </MagneticButton>
            <WhatsAppCta label={t("hero_whatsapp")} message={t("hero_whatsapp_msg")} />
          </div>
```

In `components/events/EventsHero.tsx`, add the same import and render `<WhatsAppCta label={t("hero_whatsapp")} message={t("hero_whatsapp_msg")} />` next to the events hero's `MagneticButton` (wrap both in a `flex flex-wrap items-center gap-4` div if they are not already siblings in one).

- [ ] **Step 8: Verify JSON parity + tests**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('json ok')"`
Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/whatsapp-cta.test.tsx`
Expected: `json ok`, PASS.

- [ ] **Step 9: Commit**

```bash
git add components/inquiry/WhatsAppCta.tsx tests/unit/whatsapp-cta.test.tsx messages/en.json messages/es.json components/weddings/WeddingsHero.tsx components/events/EventsHero.tsx
git commit -m "feat(inquiry): add WhatsApp fast-lane CTA to weddings + events heros"
```

---

## Task 7: Reduce form friction — required phone + collapse optional fields

**Files:**
- Create: `components/ui/form/Disclosure.tsx`
- Test: `tests/unit/disclosure.test.tsx`, `tests/unit/weddings-form-friction.test.tsx`
- Modify: `messages/en.json`, `messages/es.json`, `components/inquiry/WeddingsForm.tsx`, `components/inquiry/EventsForm.tsx`

No schema change — phone is already required by `schemas/inquiry.ts`. We (a) mark it `required` in the UI, and (b) collapse optional fields under a native `<details>` disclosure (children stay mounted, so react-hook-form registration/validation is unaffected).

- [ ] **Step 1: Write the failing Disclosure test**

```tsx
// tests/unit/disclosure.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Disclosure } from "@/components/ui/form/Disclosure";

describe("Disclosure", () => {
  it("renders a closed details with the summary and keeps children in the DOM", () => {
    render(
      <Disclosure summary="More details">
        <input aria-label="venue" />
      </Disclosure>,
    );
    const details = screen.getByText("More details").closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    // children remain mounted even when collapsed
    expect(screen.getByLabelText("venue")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/disclosure.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the Disclosure component**

```tsx
// components/ui/form/Disclosure.tsx
import type { ReactNode } from "react";

export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-t border-ink/10 pt-4">
      <summary className="cursor-pointer list-none font-mono text-[12px] uppercase tracking-[0.16em] text-ink/60 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="transition-transform group-open:rotate-45">+</span>
          {summary}
        </span>
      </summary>
      <div className="mt-6 space-y-6">{children}</div>
    </details>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/disclosure.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the `more_details` key to `messages/en.json`**

Inside `weddings.form` add `"more_details": "More details (optional)"`.
Inside `events.form` add `"more_details": "More details (optional)"`.

- [ ] **Step 6: Add identical keys to `messages/es.json`**

Inside `weddings.form` add `"more_details": "Más detalles (opcional)"`.
Inside `events.form` add `"more_details": "Más detalles (opcional)"`.

- [ ] **Step 7: Update `WeddingsForm.tsx` — mark phone required, collapse optional fields**

In `components/inquiry/WeddingsForm.tsx`:
1. Add the import: `import { Disclosure } from "@/components/ui/form/Disclosure";`
2. Add `required` to the phone `FormField`:

```tsx
<FormField label={t("phone")} htmlFor="w-phone" required error={errors.contact?.phone?.message}>
  <TextInput id="w-phone" type="tel" inputMode="tel" aria-invalid={!!errors.contact?.phone || undefined} {...form.register("contact.phone")} />
</FormField>
```

3. Wrap the optional blocks (date + venue grid, guests, budget, source) in a `Disclosure`, leaving the required fields (name, email, phone, vibe) and the submit button outside it. The `vibe` textarea stays required and outside the disclosure. Result:

```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
  <HoneypotField register={form.register("honeypot")} />
  <input type="hidden" {...form.register("type")} />
  <input type="hidden" {...form.register("locale")} />

  <div className="grid sm:grid-cols-2 gap-5">
    <FormField label={t("name")} htmlFor="w-name" required error={errors.contact?.name?.message}>
      <TextInput id="w-name" aria-invalid={!!errors.contact?.name || undefined} {...form.register("contact.name")} />
    </FormField>
    <FormField label={t("email")} htmlFor="w-email" required error={errors.contact?.email?.message}>
      <TextInput id="w-email" type="email" aria-invalid={!!errors.contact?.email || undefined} {...form.register("contact.email")} />
    </FormField>
  </div>

  <FormField label={t("phone")} htmlFor="w-phone" required error={errors.contact?.phone?.message}>
    <TextInput id="w-phone" type="tel" inputMode="tel" aria-invalid={!!errors.contact?.phone || undefined} {...form.register("contact.phone")} />
  </FormField>

  <FormField label={t("vibe")} htmlFor="w-vibe" required error={errors.vibe?.message}>
    <TextArea id="w-vibe" rows={5} aria-invalid={!!errors.vibe || undefined} {...form.register("vibe")} />
  </FormField>

  <Disclosure summary={t("more_details")}>
    <div className="grid sm:grid-cols-2 gap-5">
      <FormField label={t("date")} htmlFor="w-date">
        <DateInput id="w-date" {...form.register("date")} />
      </FormField>
      <FormField label={t("venue")} htmlFor="w-venue">
        <TextInput id="w-venue" placeholder="Glen Cove Mansion" {...form.register("venue")} />
      </FormField>
    </div>

    <FormField label={t("guests")} htmlFor="w-guests" error={errors.guests?.message}>
      <TextInput
        id="w-guests"
        type="number"
        inputMode="numeric"
        min={1}
        max={2000}
        aria-invalid={!!errors.guests || undefined}
        {...form.register("guests")}
      />
    </FormField>

    <FormField label={t("budget")} htmlFor="w-budget">
      <RadioChips
        name="budgetBand"
        items={budgetItems}
        value={watchedBudget}
        onChange={(v) => form.setValue("budgetBand", v as typeof BUDGETS[number])}
      />
    </FormField>

    <FormField label={t("source")} htmlFor="w-source" error={errors.source?.message}>
      <TextInput id="w-source" {...form.register("source")} />
    </FormField>
  </Disclosure>

  {errorMsg && (
    <p role="alert" className="font-mono text-[11px] text-error">{t(`errors.${errorMsg}`)}</p>
  )}

  <FormSubmit loading={state === "submitting"}>
    {state === "submitting" ? t("submitting") : t("submit")}
  </FormSubmit>
</form>
```

- [ ] **Step 8: Update `EventsForm.tsx` — mark phone required, collapse budget**

In `components/inquiry/EventsForm.tsx`:
1. Add `import { Disclosure } from "@/components/ui/form/Disclosure";`
2. Add `required` to the phone `FormField`:

```tsx
<FormField label={t("phone")} htmlFor="e-phone" required error={errors.contact?.phone?.message}>
  <TextInput id="e-phone" type="tel" inputMode="tel" aria-invalid={!!errors.contact?.phone || undefined} {...form.register("contact.phone")} />
</FormField>
```

3. Move the optional `budget` `FormField` into a `Disclosure summary={t("more_details")}` placed after the required `brief` field and before `FormSubmit`. Keep name, email, phone, company, frequency, brief as visible required/primary fields.

- [ ] **Step 9: Write the friction behavior test**

```tsx
// tests/unit/weddings-form-friction.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { WeddingsForm } from "@/components/inquiry/WeddingsForm";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/weddings" }));

function Harness() {
  return (
    <NextIntlClientProvider locale="en" messages={en as never}>
      <WeddingsForm locale="en" />
    </NextIntlClientProvider>
  );
}

describe("WeddingsForm friction", () => {
  it("marks the phone field required in the UI", () => {
    render(<Harness />);
    const phoneLabel = document.getElementById("w-phone-label");
    expect(phoneLabel).not.toBeNull();
    // required marker asterisk is rendered inside the label
    expect(phoneLabel?.textContent).toContain("*");
  });

  it("collapses optional fields under a 'more details' disclosure that is closed by default", () => {
    render(<Harness />);
    const summary = screen.getByText(en.weddings.form.more_details);
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    // optional field still mounted for react-hook-form
    expect(document.getElementById("w-venue")).not.toBeNull();
  });
});
```

- [ ] **Step 10: Run all form tests**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/disclosure.test.tsx tests/unit/weddings-form-friction.test.tsx`
Expected: PASS. (If `NextIntlClientProvider` warns about a missing key, re-check parity in both message files.)

- [ ] **Step 11: Commit**

```bash
git add components/ui/form/Disclosure.tsx tests/unit/disclosure.test.tsx tests/unit/weddings-form-friction.test.tsx messages/en.json messages/es.json components/inquiry/WeddingsForm.tsx components/inquiry/EventsForm.tsx
git commit -m "feat(inquiry): required phone + collapsed optional fields to cut form friction"
```

---

## Task 8: Gallery → form CTA banner in WeddingStories

**Files:**
- Test: `tests/unit/wedding-stories-cta.test.tsx`
- Modify: `messages/en.json`, `messages/es.json`, `components/weddings/WeddingStories.tsx`

> Scope note: the spec (A4) also floated a CTA *inside* `WeddingLightbox`. That is intentionally **deferred** here — it couples the modal-close (`onClose`) with anchor navigation and would need the lightbox's own translator namespace. The below-gallery banner is the higher-value, lower-risk bridge; the in-lightbox CTA is a documented follow-up.

- [ ] **Step 1: Add the `stories.cta` key to `messages/en.json`**

Inside `weddings.stories` add: `"cta": "See yourself here? Start planning →"`

- [ ] **Step 2: Add identical key to `messages/es.json`**

Inside `weddings.stories` add: `"cta": "¿Te imaginas aquí? Empieza a planear →"`

- [ ] **Step 3: Write the failing test**

```tsx
// tests/unit/wedding-stories-cta.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __WSTORIES_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const es = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    useTranslations: (namespace: string) => (key: string) => {
      const locale = globalThis.__WSTORIES_LOCALE__ ?? "en";
      const dict = locale === "es" ? es : en;
      return `${namespace}.${key}`
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict) as string;
    },
  };
});

const { WeddingStories } = await import("@/components/weddings/WeddingStories");

describe("WeddingStories CTA", () => {
  afterEach(() => {
    delete (globalThis as any).__WSTORIES_LOCALE__;
  });

  it("renders a CTA link to #inquire", () => {
    globalThis.__WSTORIES_LOCALE__ = "en";
    render(<WeddingStories locale="en" />);
    const cta = screen.getByRole("link", { name: /Start planning/i });
    expect(cta).toHaveAttribute("href", "#inquire");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-stories-cta.test.tsx`
Expected: FAIL — no link with that name.

- [ ] **Step 5: Add the CTA banner**

In `components/weddings/WeddingStories.tsx`, add a CTA link after the card-grid `</div>` and before `<WeddingLightbox …>`:

```tsx
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
        <a
          href="#inquire"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-sans text-sm tracking-tight text-bone transition-colors hover:bg-ink/90"
        >
          {t("cta")}
        </a>
      </div>
```

- [ ] **Step 6: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-stories-cta.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/es.json components/weddings/WeddingStories.tsx tests/unit/wedding-stories-cta.test.tsx
git commit -m "feat(weddings): add gallery to inquiry CTA banner"
```

---

## Task 9: Soften the FAQ minimum-spend answer (quote-only)

**Files:**
- Test: `tests/unit/wedding-faq-minimum.test.ts`
- Modify: `data/wedding-faq.ts`

Per the owner decision (no numbers, quote-only), remove the "$5,000 / $1,500" figures from the FAQ. This also flows into the FAQ JSON-LD (Task 11), which reads the same data.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/wedding-faq-minimum.test.ts
import { describe, it, expect } from "vitest";
import { weddingFAQ } from "@/data/wedding-faq";

describe("wedding FAQ minimum entry", () => {
  it("no longer states hard dollar figures", () => {
    const min = weddingFAQ.find((f) => f.id === "minimum");
    expect(min).toBeDefined();
    expect(min!.a.en).not.toMatch(/\$\s?\d/);
    expect(min!.a.es).not.toMatch(/\$\s?\d/);
  });

  it("still answers the minimum-spend question with a consultation-based statement", () => {
    const min = weddingFAQ.find((f) => f.id === "minimum")!;
    expect(min.a.en.toLowerCase()).toContain("consultation");
    expect(min.a.es.toLowerCase()).toContain("consulta");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-faq-minimum.test.ts`
Expected: FAIL — current answer contains "$5,000".

- [ ] **Step 3: Edit the `minimum` entry in `data/wedding-faq.ts`**

Replace the `a` object of the `id: "minimum"` entry with:

```ts
    a: {
      en: "We work to a studio minimum that we share during your consultation, scaled to your guest count and the scope of your day.",
      es: "Trabajamos con un mínimo de estudio que compartimos durante tu consulta, ajustado a tu número de invitados y al alcance de tu día.",
    },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-faq-minimum.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add data/wedding-faq.ts tests/unit/wedding-faq-minimum.test.ts
git commit -m "content(weddings): soften FAQ minimum-spend to quote-only"
```

---

## Task 10: Home EventsTeaser (discovery parity)

**Files:**
- Create: `components/home/EventsTeaser.tsx`
- Test: `tests/unit/events-teaser.test.tsx`
- Modify: `messages/en.json`, `messages/es.json`, `app/[locale]/page.tsx`

Image: uses a **real** Diva event photo (`dani-bridal-shower-jun-2026`) with a clear swap comment for a future corporate-event photo. Never use an AI image.

- [ ] **Step 1: Add keys to `messages/en.json`**

Inside `"home"` (next to `weddings_teaser`) add:

```jsonc
"events_teaser": {
  "eyebrow": "Events",
  "title": "Florals for every occasion.",
  "cta": "Plan an event"
}
```

- [ ] **Step 2: Add identical keys to `messages/es.json`**

```jsonc
"events_teaser": {
  "eyebrow": "Eventos",
  "title": "Flores para cada ocasión.",
  "cta": "Planear un evento"
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// tests/unit/events-teaser.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __EVENTS_TEASER_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const es = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => (key: string) => {
      const locale = globalThis.__EVENTS_TEASER_LOCALE__ ?? "en";
      const dict = locale === "es" ? es : en;
      return `${namespace}.${key}`
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict) as string;
    },
  };
});

const { EventsTeaser } = await import("@/components/home/EventsTeaser");

describe("EventsTeaser", () => {
  afterEach(() => {
    delete (globalThis as any).__EVENTS_TEASER_LOCALE__;
  });

  it("renders the EN title and a link to /en/events", async () => {
    globalThis.__EVENTS_TEASER_LOCALE__ = "en";
    render(await EventsTeaser({ locale: "en" }));
    expect(screen.getByText("Florals for every occasion.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Plan an event/i });
    expect(link).toHaveAttribute("href", "/en/events");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/events-teaser.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Write the component (mirrors `WeddingsTeaser`)**

```tsx
// components/home/EventsTeaser.tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Locale } from "@/types/locale";

export async function EventsTeaser({ locale }: { locale: Locale }) {
  const t = await getTranslations("home.events_teaser");
  return (
    <section className="relative py-16">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="relative overflow-hidden rounded-[var(--radius-bento)] aspect-[16/9] md:aspect-[21/9]">
          {/* Real Diva event (bridal shower). TODO: swap for a corporate-event photo when available. */}
          <img
            alt=""
            src="/weddings/dani-bridal-shower-jun-2026/7247.webp"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/20 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-8 md:p-14 text-bone">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/80">
              {t("eyebrow")}
            </p>
            <h2 className="font-display text-4xl md:text-6xl tracking-tighter leading-[0.98] mt-3 max-w-[16ch]">
              {t("title")}
            </h2>
            <Link
              href={`/${locale}/events`}
              className="mt-6 inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full border border-bone/40 hover:border-bone/100 transition-colors"
            >
              {t("cta")} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/events-teaser.test.tsx`
Expected: PASS.

- [ ] **Step 7: Mount on the home page**

In `app/[locale]/page.tsx`, import `EventsTeaser` and render it immediately after `<WeddingsTeaser locale={locale} />`:

```tsx
import { EventsTeaser } from "@/components/home/EventsTeaser";
// ...
      <WeddingsTeaser locale={locale} />
      <EventsTeaser locale={locale} />
      <StudioVisit locale={locale} />
```

- [ ] **Step 8: Verify JSON parity + tests**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('json ok')"`
Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/events-teaser.test.tsx`
Expected: `json ok`, PASS.

- [ ] **Step 9: Commit**

```bash
git add components/home/EventsTeaser.tsx tests/unit/events-teaser.test.tsx messages/en.json messages/es.json app/[locale]/page.tsx
git commit -m "feat(home): add EventsTeaser for events discovery parity"
```

---

## Task 11: FAQPage JSON-LD on the weddings page

**Files:**
- Create: `components/seo/WeddingFaqLD.tsx`
- Test: `tests/unit/wedding-faq-ld.test.tsx`
- Modify: `app/[locale]/weddings/page.tsx`

> **Before editing the page's structured data, read `node_modules/next/dist/docs/` for the current App-Router guidance on rendering JSON-LD — this Next.js is non-standard.** The pattern below mirrors the existing `components/seo/LocalBusinessLD.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/wedding-faq-ld.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WeddingFaqLD } from "@/components/seo/WeddingFaqLD";
import { weddingFAQ } from "@/data/wedding-faq";

function parseLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "{}");
}

describe("WeddingFaqLD", () => {
  it("emits a FAQPage with one entry per FAQ (EN)", () => {
    const { container } = render(<WeddingFaqLD locale="en" />);
    const ld = parseLd(container);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(weddingFAQ.length);
    expect(ld.mainEntity[0]["@type"]).toBe("Question");
    expect(ld.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
    expect(ld.mainEntity[0].name).toBe(weddingFAQ[0].q.en);
  });

  it("uses the ES answer text for locale es", () => {
    const { container } = render(<WeddingFaqLD locale="es" />);
    const ld = parseLd(container);
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe(weddingFAQ[0].a.es);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-faq-ld.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// components/seo/WeddingFaqLD.tsx
import { weddingFAQ } from "@/data/wedding-faq";
import type { Locale } from "@/types/locale";

export function WeddingFaqLD({ locale }: { locale: Locale }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: weddingFAQ.map((f) => ({
      "@type": "Question",
      name: f.q[locale],
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a[locale],
      },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/wedding-faq-ld.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount on the weddings page**

In `app/[locale]/weddings/page.tsx`, import and render it at the top of the returned fragment (before `<WeddingsHero>`):

```tsx
import { WeddingFaqLD } from "@/components/seo/WeddingFaqLD";
// ...
  return (
    <>
      <WeddingFaqLD locale={locale} />
      <WeddingsHero locale={locale} />
      {/* … */}
```

- [ ] **Step 6: Commit**

```bash
git add components/seo/WeddingFaqLD.tsx tests/unit/wedding-faq-ld.test.tsx app/[locale]/weddings/page.tsx
git commit -m "feat(seo): FAQPage JSON-LD on the weddings page"
```

---

## Task 12: Service JSON-LD on both pages

**Files:**
- Create: `components/seo/ServiceLD.tsx`
- Test: `tests/unit/service-ld.test.tsx`
- Modify: `messages/en.json`, `messages/es.json`, `app/[locale]/weddings/page.tsx`, `app/[locale]/events/page.tsx`

No price in the schema (consistent with quote-only). `ServiceLD` takes localized `name`/`description`/`serviceType` as props; provider + areaServed come from `SITE`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/service-ld.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ServiceLD } from "@/components/seo/ServiceLD";

function parseLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "{}");
}

describe("ServiceLD", () => {
  it("emits a Service schema with provider, areaServed, and no price", () => {
    const { container } = render(
      <ServiceLD
        name="Wedding Florals"
        description="Full-service wedding florals on Long Island."
        serviceType="Wedding Florals"
      />,
    );
    const ld = parseLd(container);
    expect(ld["@type"]).toBe("Service");
    expect(ld.name).toBe("Wedding Florals");
    expect(ld.serviceType).toBe("Wedding Florals");
    expect(ld.provider["@type"]).toBe("LocalBusiness");
    expect(ld.provider.name).toBe("Diva Flowers");
    expect(Array.isArray(ld.areaServed)).toBe(true);
    expect(JSON.stringify(ld)).not.toMatch(/price|offer/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/service-ld.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// components/seo/ServiceLD.tsx
import { SITE } from "@/data/site";

export function ServiceLD({
  name,
  description,
  serviceType,
}: {
  name: string;
  description: string;
  serviceType: string;
}) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    serviceType,
    areaServed: ["Long Island", "Nassau County", "New York metro"],
    provider: {
      "@type": "LocalBusiness",
      name: SITE.brand,
      url: SITE.url,
      telephone: SITE.phone,
      email: SITE.email,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/service-ld.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add service copy keys to `messages/en.json`**

Inside `"weddings"`:

```jsonc
"service_name": "Wedding Florals",
"service_desc": "Full-service wedding florals on Long Island — arches, tablescapes, bouquets, and installations, hand-built by Diva Flowers."
```

Inside `"events"`:

```jsonc
"service_name": "Event Florals",
"service_desc": "Corporate and recurring floral design for restaurants, offices, galleries, and private events on Long Island."
```

- [ ] **Step 6: Add identical keys to `messages/es.json`**

Inside `"weddings"`:

```jsonc
"service_name": "Flores para bodas",
"service_desc": "Flores de boda de servicio completo en Long Island — arcos, mesas, ramos e instalaciones, hechos a mano por Diva Flowers."
```

Inside `"events"`:

```jsonc
"service_name": "Flores para eventos",
"service_desc": "Diseño floral corporativo y recurrente para restaurantes, oficinas, galerías y eventos privados en Long Island."
```

- [ ] **Step 7: Mount on both pages**

Weddings `app/[locale]/weddings/page.tsx` — the `weddings` namespace `t` is already loaded in `generateMetadata`, but the page component uses a `weddings.testimonials` scoped `t`. Add a page-level `weddings` translator and render `ServiceLD` near `WeddingFaqLD`:

```tsx
import { ServiceLD } from "@/components/seo/ServiceLD";
// inside the component, alongside existing translators:
  const tw = await getTranslations({ locale, namespace: "weddings" });
// in JSX, right after <WeddingFaqLD locale={locale} />:
      <ServiceLD
        name={tw("service_name")}
        description={tw("service_desc")}
        serviceType="Wedding Florals"
      />
```

Events `app/[locale]/events/page.tsx` — add a `events` translator and render `ServiceLD` at the top of `<main>`:

```tsx
import { ServiceLD } from "@/components/seo/ServiceLD";
// inside the component:
  const te = await getTranslations({ locale, namespace: "events" });
// as the first child of <main>:
      <ServiceLD
        name={te("service_name")}
        description={te("service_desc")}
        serviceType="Event Florals"
      />
```

- [ ] **Step 8: Verify JSON parity + tests**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('json ok')"`
Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/service-ld.test.tsx`
Expected: `json ok`, PASS.

- [ ] **Step 9: Commit**

```bash
git add components/seo/ServiceLD.tsx tests/unit/service-ld.test.tsx messages/en.json messages/es.json app/[locale]/weddings/page.tsx app/[locale]/events/page.tsx
git commit -m "feat(seo): Service JSON-LD on weddings + events pages"
```

---

## Task 13: Best-effort email notification module (Resend)

**Files:**
- Create: `lib/notify-inquiry.ts`
- Test: `tests/unit/notify-inquiry.test.ts`

`resend` (^6.12.3) is already a dependency. The module never throws and no-ops when env vars are missing (safe for local/dev). Env: `RESEND_API_KEY`, `INQUIRY_NOTIFY_EMAIL` (to), `INQUIRY_NOTIFY_FROM` (verified sender; defaults provided).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/notify-inquiry.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

const ORIGINAL_ENV = { ...process.env };

async function importFresh() {
  vi.resetModules();
  return await import("@/lib/notify-inquiry");
}

const record = {
  id: "iq_test_1",
  type: "wedding" as const,
  payload: { contact: { name: "Ana", email: "ana@example.com", phone: "5551234567" } },
  createdAt: "2026-07-03T00:00:00.000Z",
  ip: "1.2.3.4",
  locale: "en" as const,
};

describe("notifyInquiry", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "email_1" });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("no-ops when RESEND_API_KEY or INQUIRY_NOTIFY_EMAIL is missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.INQUIRY_NOTIFY_EMAIL;
    const { notifyInquiry } = await importFresh();
    await notifyInquiry(record);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends an email to the configured address when env is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INQUIRY_NOTIFY_EMAIL = "studio@divaflowers.com";
    const { notifyInquiry } = await importFresh();
    await notifyInquiry(record);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("studio@divaflowers.com");
    expect(String(arg.subject)).toContain("wedding");
    expect(String(arg.subject)).toContain("ana@example.com");
  });

  it("never throws when Resend rejects", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.INQUIRY_NOTIFY_EMAIL = "studio@divaflowers.com";
    sendMock.mockRejectedValue(new Error("resend down"));
    const { notifyInquiry } = await importFresh();
    await expect(notifyInquiry(record)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/notify-inquiry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

```ts
// lib/notify-inquiry.ts
import { Resend } from "resend";
import type { InquiryRecord } from "@/lib/inquiry-storage";

type ContactLike = { contact?: { name?: string; email?: string; phone?: string } };

function contactOf(record: InquiryRecord): { name: string; email: string; phone: string } {
  const c = (record.payload as ContactLike)?.contact ?? {};
  return { name: c.name ?? "—", email: c.email ?? "—", phone: c.phone ?? "—" };
}

/**
 * Best-effort email alert for a new inquiry. Never throws; no-ops when the
 * Resend key or destination address are not configured (local/dev, or a host
 * where env vars aren't set yet — see the Hostinger deploy note).
 */
export async function notifyInquiry(record: InquiryRecord): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFY_EMAIL;
  const from = process.env.INQUIRY_NOTIFY_FROM ?? "Diva Flowers <inquiries@makythedivaflowers.com>";
  if (!apiKey || !to) return;

  try {
    const { name, email, phone } = contactOf(record);
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject: `New ${record.type} inquiry — ${email}`,
      text: [
        `Type: ${record.type}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Locale: ${record.locale}`,
        `Received: ${record.createdAt}`,
        `Inquiry ID: ${record.id}`,
        ``,
        `Full payload:`,
        JSON.stringify(record.payload, null, 2),
      ].join("\n"),
    });
  } catch (err) {
    console.error(`[notify-inquiry] failed for ${record.id}:`, err);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/notify-inquiry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notify-inquiry.ts tests/unit/notify-inquiry.test.ts
git commit -m "feat(inquiry): best-effort Resend email notifier for new inquiries"
```

---

## Task 14: Wire the notifier into the inquiry API route

**Files:**
- Test: `tests/unit/inquiry-route.test.ts`
- Modify: `app/api/inquiry/route.ts`

> Read `node_modules/next/dist/docs/` for current App-Router route-handler guidance before editing.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/inquiry-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const saveInquiryMock = vi.fn().mockResolvedValue(undefined);
const notifyInquiryMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: saveInquiryMock }));
vi.mock("@/lib/notify-inquiry", () => ({ notifyInquiry: notifyInquiryMock }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  ipFromRequest: () => "1.2.3.4",
}));

const { POST } = await import("@/app/api/inquiry/route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validWedding = {
  type: "wedding",
  contact: { name: "Ana Ruiz", email: "ana@example.com", phone: "5551234567" },
  budgetBand: "open",
  vibe: "Garden-style ceremony arch with soft pastels.",
  locale: "en",
  honeypot: "",
};

describe("POST /api/inquiry", () => {
  beforeEach(() => {
    saveInquiryMock.mockClear();
    notifyInquiryMock.mockClear();
  });

  it("saves then notifies on a valid inquiry and returns ok", async () => {
    const res = await post(validWedding);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(saveInquiryMock).toHaveBeenCalledTimes(1);
    expect(notifyInquiryMock).toHaveBeenCalledTimes(1);
    // notify receives the same id that was saved
    const savedId = saveInquiryMock.mock.calls[0][0].id;
    const notifiedId = notifyInquiryMock.mock.calls[0][0].id;
    expect(notifiedId).toBe(savedId);
  });

  it("does not notify on an invalid inquiry", async () => {
    const res = await post({ type: "wedding", locale: "en" });
    expect(res.status).toBe(400);
    expect(notifyInquiryMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/inquiry-route.test.ts`
Expected: FAIL — `notifyInquiry` not called (route doesn't call it yet).

- [ ] **Step 3: Edit the route to build the record once, save, then notify**

Update `app/api/inquiry/route.ts` so the `InquiryRecord` is built once and passed to both `saveInquiry` and `notifyInquiry`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { weddingInquirySchema, eventInquirySchema } from "@/schemas/inquiry";
import { subscriptionInquirySchema } from "@/schemas/subscription-inquiry";
import { saveInquiry, type InquiryRecord } from "@/lib/inquiry-storage";
import { notifyInquiry } from "@/lib/notify-inquiry";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const requestSchema = z.discriminatedUnion("type", [
  weddingInquirySchema,
  eventInquirySchema,
  subscriptionInquirySchema,
]);

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`inquiry:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record: InquiryRecord = {
    id,
    type: parsed.data.type,
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  };
  await saveInquiry(record);
  await notifyInquiry(record); // best-effort; never throws
  console.log(`[inquiry] ${parsed.data.type} from ${parsed.data.contact.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run tests/unit/inquiry-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full unit suite for regressions**

Run: `NODE_OPTIONS='--experimental-sqlite' npx vitest run`
Expected: the new tests pass; no previously-passing test newly fails. (The repo has a known-noisy baseline — compare against the pre-existing failures, don't treat those as introduced here.)

- [ ] **Step 6: Commit**

```bash
git add app/api/inquiry/route.ts tests/unit/inquiry-route.test.ts
git commit -m "feat(inquiry): fire best-effort email alert after saving an inquiry"
```

---

## Post-implementation: manual verification (preview) + deploy

- [ ] Start the dev server and verify on **both** `/en` and `/es`:
  - Weddings + events: rating chip in hero, testimonials section, "what happens next" strip, WhatsApp button (href opens WhatsApp with the shop number), collapsed "more details" in the form, phone marked required, gallery→inquire CTA (weddings).
  - Home: `EventsTeaser` present, links to `/events`.
  - View source on `/en/weddings`: `FAQPage` + `Service` JSON-LD present and valid; `/en/events`: `Service` JSON-LD present.
- [ ] Submit a test inquiry with `RESEND_API_KEY` + `INQUIRY_NOTIFY_EMAIL` set locally and confirm the alert email arrives; confirm a forced Resend error does not break the `ok: true` response.
- [ ] Honesty pass: grep new copy for "free delivery" (must be absent); confirm no fabricated testimonials (all come from `data/reviews.ts`).
- [ ] **Deploy reality:** merging to `main` does NOT update the live site. To go live, deploy the branch to the **Hostinger** host and set `RESEND_API_KEY`, `INQUIRY_NOTIFY_EMAIL`, and `INQUIRY_NOTIFY_FROM` (a Resend-verified sender) **there**. Until then, none of this — especially the email alert — is live.

## Owner action items (surfaced by this plan)

- Provide `INQUIRY_NOTIFY_EMAIL` (destination inbox) and verify a Resend sender domain for `INQUIRY_NOTIFY_FROM`.
- Confirm the WhatsApp number is monitored (the fast-lane promises a quick reply).
- Optional: provide a real corporate/event photo to replace the `EventsTeaser` bridal-shower image.
- Confirm removing the FAQ dollar figures is acceptable (Task 9).
