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

## Stripe Payments

The checkout uses the embedded Stripe Payment Element. Payment state is driven
by webhooks; the local `pending-orders.json` is updated by
`POST /api/stripe/webhook`, never client-side.

### Required env vars (`.env.local`)

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`whsec_...` comes from `stripe listen` in dev (next section), or from the
Dashboard webhook endpoint config in production.

### Dev workflow

Two terminals:

```bash
# Terminal 1
pnpm dev
```

```bash
# Terminal 2 — forwards Stripe events to your local webhook
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The first time you run `stripe listen`, copy the `whsec_...` it prints into
`.env.local` as `STRIPE_WEBHOOK_SECRET=...` and restart Terminal 1. The secret
rotates per CLI session unless you reuse one — `stripe listen --print-secret`
prints the current secret without starting the listener.

### Test cards

- `4242 4242 4242 4242` — succeeds, no 3DS
- `4000 0025 0000 3155` — requires 3DS authentication
- `4000 0000 0000 9995` — insufficient funds (declined)
- `4000 0000 0000 0002` — generic decline

Use any future expiry (e.g. `12/34`), any CVC, any ZIP (e.g. `10001`).

### Common issues

- **Order stays `pending` forever in dev** → `stripe listen` is not running, or
  the `whsec_` in `.env.local` doesn't match the one currently active.
- **`STRIPE_SECRET_KEY is not set` at boot** → missing or misnamed in
  `.env.local`. Restart `pnpm dev` after editing the file.
- **Payment Element renders blank** → check the browser console for
  `loadStripe` errors; usually the publishable key is missing or has
  the wrong prefix (live key in test build, etc.).

### Going to production

Deploy is documented in
`docs/superpowers/specs/2026-05-06-stripe-checkout-integration-design.md`
section 10.

## Impresión automática de órdenes

Cuando una orden se paga (Stripe `payment_intent.succeeded`), el servidor encola un trabajo de impresión: una hoja tamaño carta con el ticket de orden arriba y la tarjeta decorativa abajo. Un agente que corre en una computadora Windows en la tienda hace polling al endpoint `/api/print/queue` cada 10s y manda los PDFs a la impresora local.

### Configuración (servidor)

1. Genera un token: `openssl rand -base64 32`
2. Agrégalo como `PRINT_AGENT_TOKEN` en las variables de entorno de Vercel (production).
3. Copia ese mismo valor a `tools/print-agent/.env` en la compu de la tienda.

### Configuración (compu de la tienda)

Sigue las instrucciones en [tools/print-agent/README.md](./tools/print-agent/README.md).

### Estado de la cola

Hace un GET autenticado a `/api/print/health` para ver `{ pendingCount, oldestPendingAgeSeconds, lastPrintedAt }`.

### Si una impresión falla

- El agente intenta hasta 3 veces con backoff (5s, 30s, 2min).
- Si fallan los 3, se envía un email a `ORDER_NOTIFICATIONS_TO` con asunto `[PRINT FAILED] order <id>`.
- Para reimprimir manualmente, edita `print-queue.json` y cambia `status: "failed"` → `"pending"` (v1; un panel admin queda para v2).
