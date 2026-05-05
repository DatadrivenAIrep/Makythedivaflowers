# Analytics & Conversion Tracking — Design

**Date:** 2026-05-04
**Status:** Approved (pending user review of written spec)
**Scope:** Install Microsoft Clarity + Google Analytics 4 (via Google Tag Manager), wire conversion events across the funnel, add hybrid client+server purchase tracking, and add a lightweight consent layer.

## Goal

Give Diva Flowers production-grade analytics so the team can:
1. Measure the full ecommerce funnel (catalog → PDP → cart → checkout → purchase).
2. Recover ~30% of purchase attribution that ad-blockers strip out (server-side mirror — wired in Phase 2 once Stripe is integrated).
3. Watch real session replays and heatmaps (Clarity) to inform UX iteration.
4. Layer in Meta/TikTok/Google Ads pixels later without code changes (GTM as the container).

Target audience: USA, New York. Compliance posture: opt-out (CCPA-aware) with GPC signal respect.

## Tools

| Tool | Purpose |
|---|---|
| Google Tag Manager (GTM) | Tag container — owns GA4 + future pixels |
| Google Analytics 4 (GA4) | Funnel reports, ecommerce, conversion attribution |
| Microsoft Clarity | Heatmaps + session replay |

## Architecture

```
Browser
├── app/layout.tsx
│   ├── <GTMScript />     (next/script, afterInteractive)
│   ├── <ClarityScript /> (next/script, afterInteractive)
│   └── <ConsentNotice />
└── Components → lib/analytics.ts → window.dataLayer → GTM → GA4
                                                          ↑
                                                          │ Measurement Protocol
                                                          │ (server-side purchase
                                                          │  — DEFERRED until
                                                          │  Stripe is wired)
Server
└── lib/analytics-server.ts → sendPurchaseToGA4(order)
    Built now, but NOT called from anywhere until the Stripe
    webhook exists. The current checkout API route does not
    represent a real payment, so firing purchase events from
    there would pollute GA4 with non-revenue data.

Dedup: shared transaction_id on client + server purchase events.
Clarity ↔ GA4 link: shared anonymous user_id cookie.
```

### Stripe-readiness posture

Stripe is not yet integrated. This affects the `purchase` event only:

- **Now:** client-side `purchase` fires from the order confirmation page. Server-side `purchase` is **not wired**. `lib/analytics-server.ts` is built and unit-tested so it's drop-in ready when Stripe lands.
- **When Stripe is wired:** add a single call to `sendPurchaseToGA4(order)` inside the Stripe webhook's `checkout.session.completed` (or `payment_intent.succeeded`) handler. No other analytics changes required.

All other tracking (catalog, PDP, cart, checkout steps, engagement, Clarity) is independent of Stripe and ships now.

### Module boundaries

- `lib/analytics.ts` — typed client-side event functions. Single import point for tracking calls.
- `lib/analytics-server.ts` — server-side Measurement Protocol client.
- `lib/consent.ts` — consent cookie read/write, GPC detection, `hasConsent()`.
- `components/analytics/GTMScript.tsx`, `ClarityScript.tsx`, `ConsentNotice.tsx` — client components.

### Environment variables

Add to `.env.local.example`:
```
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_CLARITY_PROJECT_ID=
GA4_MEASUREMENT_ID=G-XXXXXXX
GA4_API_SECRET=
```

`NEXT_PUBLIC_*` are exposed to the browser. `GA4_API_SECRET` is server-only (Measurement Protocol auth).

## Privacy & Consent

US/NY target — opt-out model:
- Tracking enabled by default.
- Small dismissible notice on first visit: "We use cookies for analytics — [Privacy Policy]".
- Footer link: "Do Not Sell or Share My Personal Information" → toggles consent off, reloads page.
- Browser sends Global Privacy Control (`navigator.globalPrivacyControl === true`) → consent defaults to off (covers California CCPA).
- Consent state stored in a `dvf_consent` cookie (1 year).

`lib/analytics.ts` and `lib/analytics-server.ts` event functions check consent before firing. Silent no-op if disabled. The GTM and Clarity `<Script>` tags only render when consent is true.

## Event Catalog

All ecommerce events follow the [GA4 recommended schema](https://developers.google.com/analytics/devguides/collection/ga4/reference/events) so out-of-the-box GA4 reports work.

### Item shape (used in all ecommerce events)

```ts
type AnalyticsItem = {
  item_id: string;        // SKU
  item_name: string;
  item_category: string;  // "bouquets" | "arrangements" | "weddings" | etc.
  item_variant?: string;  // size/color
  price: number;
  quantity: number;
  currency: "USD";
};
```

### Core ecommerce funnel (GA4 standard events)

| Event | Fires when | Required params |
|---|---|---|
| `view_item_list` | Catalog/shop page mount | `item_list_name`, `items[]` |
| `view_item` | PDP mount | `currency`, `value`, `items[]` |
| `add_to_cart` | Add-to-cart click | `currency`, `value`, `items[]` |
| `remove_from_cart` | Remove from cart | `currency`, `value`, `items[]` |
| `view_cart` | Cart drawer open | `currency`, `value`, `items[]` |
| `begin_checkout` | Checkout page mount | `currency`, `value`, `items[]`, `coupon?` |
| `add_shipping_info` | Shipping step complete | `shipping_tier`, `items[]` |
| `add_payment_info` | Payment step complete | `payment_type`, `items[]` |
| `purchase` | Order confirmed (client + server) | `transaction_id`, `value`, `currency`, `tax`, `shipping`, `items[]` |

### Engagement (custom events)

| Event | Fires when | Params |
|---|---|---|
| `newsletter_signup` | Newsletter form success | `location` |
| `whatsapp_click` | WhatsApp CTA click | `location`, `context` |
| `phone_click` | `tel:` link click | `location` |
| `contact_submit` | Contact form success | `subject`, `inquiry_type` |

### Diva-specific (custom events)

| Event | Fires when | Params |
|---|---|---|
| `occasion_selected` | Occasion filter/option chosen | `occasion` |
| `delivery_date_selected` | Date picker confirm | `days_ahead`, `is_same_day` |
| `recipient_info_completed` | Recipient name+address filled | `has_card_message` |

## Integration Points

| Location | Events |
|---|---|
| `app/layout.tsx` | Mount GTM, Clarity, ConsentNotice |
| `components/shop/*` (category grid) | `view_item_list` |
| `components/product/*` (PDP root) | `view_item`, `occasion_selected`, `add_to_cart` |
| `components/cart/*` (cart drawer) | `view_cart`, `remove_from_cart` |
| `app/[locale]/checkout/page.tsx` | `begin_checkout`, `delivery_date_selected`, `recipient_info_completed`, `add_shipping_info`, `add_payment_info` |
| `app/[locale]/order/[id]/confirmation/page.tsx` | `purchase` (client) |
| Stripe webhook handler (future, not wired now) | `purchase` (server, fire-and-forget) |
| Newsletter form component | `newsletter_signup` |
| WhatsApp button component | `whatsapp_click` |
| `tel:` link wrapper | `phone_click` |
| Contact form component | `contact_submit` |

## Hybrid Purchase Tracking (Phased)

**Phase 1 — ships now (without Stripe):**
- Client fires `purchase` from the order confirmation page on mount, reading `transaction_id` from the URL or order data.
- `lib/analytics-server.ts` exists with a tested `sendPurchaseToGA4(order)` function, but no caller. This avoids polluting GA4 with non-revenue data while the checkout is still a placeholder.

**Phase 2 — when Stripe is integrated:**
- Add one call to `sendPurchaseToGA4(order)` inside the Stripe webhook handler (`checkout.session.completed` or `payment_intent.succeeded`). Fire-and-forget — never block the webhook response on GA's API.
- Reuse the same `transaction_id` (Stripe's session/payment-intent ID, mirrored to the order record) on both client and server.
- GA4 deduplicates events that share `transaction_id` within 24h, so duplicate-counting is not a concern.
- Net effect: when a client-side event is blocked by an ad-blocker, the server event fills the gap. When the client event fires, GA4 dedupes.

## Testing

Vitest unit tests:
- `tests/unit/analytics.test.ts` — each `trackX()` function pushes the correct shape to `dataLayer`; silent no-op when consent is off.
- `tests/unit/consent.test.ts` — GPC detection, cookie roundtrip, default states.
- `tests/unit/analytics-server.test.ts` — Measurement Protocol payload shape (mock `fetch`).

Manual verification:
- Use GA4 DebugView while running `pnpm dev` to confirm events arrive.
- Use GTM Preview mode to confirm `dataLayer` pushes are captured.
- Verify Clarity dashboard shows live sessions.
- Test with a known ad-blocker (uBlock Origin) to confirm server-side `purchase` still arrives.

## Out of Scope (YAGNI)

- Micro-conversions (wishlist, gallery interaction, search/filter usage) — add later if Clarity heatmaps reveal a need.
- Meta/TikTok/Google Ads pixels — GTM container makes these a tag-only addition, no code change required.
- Server-side `add_to_cart` / `begin_checkout` — client coverage is sufficient; only `purchase` justifies hybrid complexity.
- A/B testing framework — separate concern.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| GA4 Measurement Protocol misconfigured → silent server data loss | Unit test payload shape; manual verification via DebugView before sign-off |
| Consent banner blocks tracking for too many users | Banner is dismissible-by-click, not opt-in — tracking enabled by default |
| `transaction_id` mismatch between client and server → duplicates | Use the order's persisted ID as the single source on both sides |
| Clarity script slows page load | Loaded with `strategy="afterInteractive"` — runs after hydration |
| Server-side purchase forgotten when Stripe lands | `lib/analytics-server.ts` has a doc comment "CALL ME FROM THE STRIPE WEBHOOK"; the future Stripe spec must include this hookup as an explicit checklist item |
| Firing purchase events from placeholder checkout pollutes GA4 | Server-side purchase deliberately not wired in Phase 1 — only client-side fires, gated to the confirmation page |
