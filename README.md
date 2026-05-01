# Diva Flowers

Bilingual e-commerce website for Diva Flowers, a Long Island floral studio.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Framer Motion · next-intl · Zustand · Vitest · Playwright.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest unit tests
npm run e2e          # playwright e2e
npm run build        # production build
```

## Project layout

See `docs/superpowers/specs/2026-04-30-diva-flowers-design.md` for the full design spec and `docs/superpowers/plans/` for implementation plans.

## Brand framework

Built using the [taste-skill](https://github.com/Leonxlnx/taste-skill) framework (DESIGN_VARIANCE: 8 · MOTION_INTENSITY: 6 · VISUAL_DENSITY: 4). Reduced-motion preferences are honored throughout.

## Status

- Plan 1 complete: foundation, brand system, bilingual home page.
- Plan 2 complete: catalog (shop hub + category pages with sticky filter bar), PDP (variants, add-ons, delivery picker, card message, add-to-bag), sympathy variant, subscriptions, mega-menu, sitemap.
- Plan 3 complete: cart drawer, /cart, /checkout (3-step accordion), /order/[id]/confirmation. Inquiry pages: /weddings, /events, /contact. Editorial: /story, /journal, /journal/[slug] (3 articles). Stubbed: /account. Legal: /legal/privacy, /legal/terms.
- Plan 4 complete: launch-readiness polish — content centralization, motion coverage (stagger, grain, arch, magnetic CTAs), a11y (axe-core e2e, reduced-motion, focus rings), SEO (LocalBusiness + Breadcrumb JSON-LD, OG images, robots.txt, hreflang), error/loading/not-found states, perf (next/image migration), i18n gap sweep, v2 roadmap. Branch: plan-4-quality-polish.

## v1 status (post-Plan 3)

The site is fully shoppable end-to-end against stubbed payment and email:
- Browse, filter, sort, PDP, add to bag, drawer, /cart, /checkout, /order/[id]/confirmation.
- Inquiry pages: /weddings, /events, /contact (all submit and persist to `pending-inquiries.json`).
- Editorial: /story, /journal, /journal/[slug] (3 articles).
- Stubbed: /account, /account/sign-up, /account/orders.
- Legal: /legal/privacy, /legal/terms.

### v2 swap points
- `<PaymentStub />` → `@stripe/react-stripe-js` `<PaymentElement />` (~1 day).
- `lib/inquiry-storage.ts` and `lib/order-storage.ts` → Resend / Postmark + a real DB.
- `data/journal.tsx` → Sanity / Payload, same shape.
- `components/account/AuthForm.tsx` → NextAuth / Clerk, same field set.
