# Subscriptions Program — Design Spec

**Date:** 2026-05-02
**Status:** Draft
**Scope:** Lead-capture-only. No payment processing in this phase.

## Problem

The site advertises a subscriptions program (bento tile on home, "subscriptions" category exists in shop taxonomy), but the linked page has no content. There is no way for a customer to learn about the program or signal interest.

## Goals

- Introduce a curated weekly/biweekly bouquet program ("Ramo de la Semana") with three tiers.
- Capture qualified leads that the studio follows up on manually to coordinate first delivery and payment.
- Reuse existing inquiry storage so subscription leads land alongside wedding/event inquiries chronologically.
- Match the established editorial voice and visual system — no net-new design tokens or styles.

## Non-Goals

- No automated recurring billing. No Stripe Subscriptions. No customer portal for pause/cancel.
- No real authentication (the site has no real auth yet).
- No subscription products in the shop catalog. The category `subscriptions` stays in the taxonomy unused for now.
- No admin UI to manage leads — they accumulate in `pending-inquiries.json` like other inquiries.

## Model

Three tiers ("Petit Bouquet", "Maison", "Atelier"), two cadences (weekly, biweekly). Tiers differ by floral budget, presentation, and extras (e.g., Atelier rotates a studio vase every fourth delivery). The studio curates each delivery from in-season stems — customers do not select arrangements per delivery.

| Tier ID | Name | Price/delivery | Stems | Notes |
|---|---|---|---|---|
| `petit` | Petit Bouquet | $45 | ~15 | hand-tied, kraft, hand card |
| `maison` | Maison (popular) | $85 | ~25 | premium seasonal, signed paper |
| `atelier` | Atelier | $145 | vase arrangement | rare seasonal, vase included every 4 deliveries, priority window |

Cadence reuses the existing `SubscriptionCadence` type (`"weekly" | "biweekly"`) from `types/product.ts`.

## Architecture

### Page

`app/[locale]/subscriptions/page.tsx` — Server Component. Loads i18n namespace `subscriptions`, sets request locale, mounts `<SubscriptionLanding>`, generates metadata (title, alternates).

Layout sections (top to bottom):

1. **Hero** — eyebrow + display title + intro paragraph + editorial photo.
2. **Tiers** — three cards in a row (stacks on mobile). Maison shows "popular" badge.
3. **How it works** — three editorial steps ("Eliges plan y cadencia" / "Curamos según temporada" / "Entregamos el día acordado").
4. **Inquiry form** — separated visually. Plan from step 2 is preselected.

### Components

```
components/subscription/
├── SubscriptionLanding.tsx        Client wrapper. Holds selectedPlan state, connects tiers ↔ form.
├── SubscriptionHero.tsx           Server. Eyebrow, title, intro, photo.
├── SubscriptionTiers.tsx          Client. Renders 3 SubscriptionTierCard.
├── SubscriptionTierCard.tsx       Client. One card. CTA "Elegir [name] →" calls onSelect + scrolls to form.
├── SubscriptionHowItWorks.tsx     Server. Three editorial steps.
└── SubscriptionInquiryForm.tsx    Client. react-hook-form + zod. Plan preselected.
```

The wrapper `<SubscriptionLanding>` is a client component because it owns the `selectedPlan` state shared between tiers and the form. Hero and HowItWorks render as children inside it but remain server-rendered (passed via children prop to keep them server components).

Initial `selectedPlan` is `"maison"`.

### Data

`data/subscription-plans.ts` (new):

```ts
import type { Localized } from "@/types/product";

export type SubscriptionPlanId = "petit" | "maison" | "atelier";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: Localized;
  priceCents: number;
  blurb: Localized;
  stems?: number;          // omitted for Atelier (vase arrangement)
  highlights: Localized[]; // 3 bullets
  popular?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: "petit", name: { en: "Petit Bouquet", es: "Petit Bouquet" }, priceCents: 4500, stems: 15, popular: false, blurb: { en: "...", es: "..." }, highlights: [/* 3 */] },
  { id: "maison", name: { en: "Maison", es: "Maison" }, priceCents: 8500, stems: 25, popular: true, blurb: { en: "...", es: "..." }, highlights: [/* 3 */] },
  { id: "atelier", name: { en: "Atelier", es: "Atelier" }, priceCents: 14500, popular: false, blurb: { en: "...", es: "..." }, highlights: [/* 3 */] },
];
```

Names stay identical across locales (intentional brand decision — French/boutique tone in both markets). Blurbs and highlights are localized.

### Schema

`schemas/subscription-inquiry.ts` (new): `subscriptionInquirySchema` (zod) and `SubscriptionInquiryInput` (inferred type).

Required fields:
- `type: z.literal("subscription")`
- `locale: z.enum(["en", "es"])`
- `plan: z.enum(["petit", "maison", "atelier"])`
- `cadence: z.enum(["weekly", "biweekly"])`
- `startDate: z.string()` — ISO date, must be ≥ today + 2 days
- `recipient: { name, phone }`
- `address: Address` — reuse existing `Address` type/schema
- `window: { slot: DeliverySlot }` — reuse existing
- `contact: { email, phone }`
- `cardMessage?: z.string().max(500)`
- `notes?: z.string().max(1000)`

### API

Extend the existing inquiry endpoint, do not create a parallel one.

`lib/inquiry-storage.ts` — add `"subscription"` to the `type` union of `InquiryRecord`.

`app/api/inquiry/route.ts` — add `subscriptionInquirySchema` to the existing `z.discriminatedUnion("type", [...])`. Rate limit and storage path unchanged.

`lib/submit-subscription-inquiry.ts` (new) — client wrapper paralleling `submit-order.ts`. POSTs to `/api/inquiry` with `type: "subscription"`. Returns `{ ok: true, id } | { ok: false, errors }`.

### i18n

New namespace `subscriptions` in `messages/en.json` and `messages/es.json`. Keys (illustrative):

```
subscriptions.eyebrow
subscriptions.hero.title
subscriptions.hero.body
subscriptions.tiers.heading
subscriptions.tiers.popular_badge
subscriptions.tiers.cta              // "Elegir {name}"
subscriptions.tiers.per_delivery     // "por entrega"
subscriptions.how.heading
subscriptions.how.step_1.{title,body}
subscriptions.how.step_2.{title,body}
subscriptions.how.step_3.{title,body}
subscriptions.form.heading
subscriptions.form.cadence.{weekly,biweekly}
subscriptions.form.start_date.{label,help}
subscriptions.form.recipient.{name,phone}
subscriptions.form.address.{...}     // mirror checkout
subscriptions.form.window.{morning,midday,afternoon,evening}
subscriptions.form.contact.{email,phone}
subscriptions.form.card_message.{label,help}
subscriptions.form.notes.{label,help}
subscriptions.form.submit
subscriptions.form.submitting
subscriptions.form.errors.{generic,rate_limited,validation}
subscriptions.form.success.{title,body}
```

Localized plan blurbs/highlights live in `data/subscription-plans.ts`, not in i18n JSON (parallels how product copy lives in `data/products.ts`).

### Routing & links

- New route: `/[locale]/subscriptions`.
- `components/home/BentoSubscriptionsTile.tsx` — change `href` from `/${locale}/shop/subscriptions` to `/${locale}/subscriptions`.
- `app/sitemap.ts` — add `/en/subscriptions` and `/es/subscriptions`.
- The `/[locale]/shop/subscriptions` category route stays functional (renders empty state since no products have category `subscriptions`). No redirect — leave the category slot for future.

### Visual system

Reuse existing tokens. No new CSS variables, no new shadows, no new radii.
- `bg-bone`, `text-ink`, `text-rouge`, `border-ink/10`
- `font-display` for titles, `font-mono` uppercase tracked for eyebrows/labels
- `rounded-[var(--radius-bento)]`, `shadow-[var(--shadow-tile-rest)]` on tier cards
- `framer-motion` with `useReducedMotion` for any subtle animation, matching the bento tile

Copy voice: warm, occasion-tailored, explicit CTA in copy ("Elegir Maison →", not "Discover →"). Per project memory, restrained literary tone reads cold.

## Error Handling

- Form: zod resolver in react-hook-form; per-field errors inline; form-level errors in a banner above the submit button.
- API failures: surface localized message (`generic`, `rate_limited`, `validation`).
- Submitting state: disable submit, show "Enviando…" / "Sending…".
- Submitted state: replace form with confirmation panel — copy promises follow-up within 24h to coordinate first delivery and payment.
- The bento tile and any anchor link to a missing `/subscriptions` route would 404 — `app/sitemap.ts` and the bento tile update are part of this work, so this can't happen.

## Testing

- `tests/unit/subscription-inquiry-schema.test.ts` — required fields, plan/cadence enums, startDate ≥ today+2.
- `tests/unit/SubscriptionTiers.test.tsx` — renders three tiers, "popular" badge on `maison`, click changes selected state, calls `onSelect` with correct id.
- `tests/unit/SubscriptionInquiryForm.test.tsx` — renders all fields, shows validation errors on bad submit, calls fetch with correct payload on valid submit, shows success state on `{ ok: true }`.
- `tests/e2e/subscriptions.spec.ts` — Playwright: visit `/en/subscriptions`, click "Elegir Atelier", fill form, submit, see confirmation. Repeat smoke check on `/es/subscriptions`.

Hero and HowItWorks are static content — no unit tests.

## Out of scope (future work)

- Stripe Subscriptions integration (recurring billing, customer portal, webhooks).
- Real authentication tied to subscription state.
- Admin UI for inquiry management.
- Subscription products as individual SKUs in the shop catalog.
- Pause/skip/cancel workflows.
- Gift subscriptions (sender ≠ recipient billing).

## Files touched

**New:**
- `app/[locale]/subscriptions/page.tsx`
- `app/[locale]/subscriptions/loading.tsx` (matches sibling routes)
- `components/subscription/SubscriptionLanding.tsx`
- `components/subscription/SubscriptionHero.tsx`
- `components/subscription/SubscriptionTiers.tsx`
- `components/subscription/SubscriptionTierCard.tsx`
- `components/subscription/SubscriptionHowItWorks.tsx`
- `components/subscription/SubscriptionInquiryForm.tsx`
- `data/subscription-plans.ts`
- `schemas/subscription-inquiry.ts`
- `lib/submit-subscription-inquiry.ts`
- `tests/unit/subscription-inquiry-schema.test.ts`
- `tests/unit/SubscriptionTiers.test.tsx`
- `tests/unit/SubscriptionInquiryForm.test.tsx`
- `tests/e2e/subscriptions.spec.ts`

**Modified:**
- `lib/inquiry-storage.ts` — add `"subscription"` to type union
- `app/api/inquiry/route.ts` — add `subscriptionInquirySchema` to discriminated union
- `components/home/BentoSubscriptionsTile.tsx` — update href
- `app/sitemap.ts` — add `/subscriptions` for both locales
- `messages/en.json`, `messages/es.json` — add `subscriptions` namespace
