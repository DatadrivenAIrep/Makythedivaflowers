# Stripe Checkout Integration — Design Spec

**Date:** 2026-05-06
**Approach:** Embedded Stripe Payment Element (B), pending-order pattern (A)
**Scope:** Test mode only. Production deploy is documented but not implemented in this spec.
**Stack:** Stripe Node SDK + `@stripe/stripe-js` + `@stripe/react-stripe-js`

---

## 1. Context

Today the checkout (`components/checkout/CheckoutShell.tsx`) is a 3-step accordion (Contact → Delivery → Payment). The "Payment" step is a visual placeholder (`PaymentStub.tsx`) and `app/api/checkout/route.ts` saves the order with `status: "paid"` directly without charging anything. No Stripe SDK is installed.

This spec replaces that stub with a real Stripe integration that:

- Charges the customer through the embedded Stripe Payment Element (no redirect to Stripe-hosted page).
- Persists the order in `pending-orders.json` as `pending` before charging, then transitions to `paid` / `failed` / `canceled` via webhook.
- Treats the Stripe webhook as the source of truth for payment state.
- Enables Card and Link only at launch. Apple Pay / Google Pay are deferred (toggle in Dashboard once domain verification is in place).

## 2. Goals & Non-goals

### Goals
1. Customer pays with a real card on the existing 3-step checkout without leaving the site.
2. Order state transitions are driven by Stripe webhooks, not client-side optimism.
3. Race between `return_url` redirect and webhook arrival is handled gracefully on the confirmation page.
4. No live keys in code; all Stripe credentials live in `.env.local` (dev) or host env (prod).

### Non-goals (YAGNI)
- Refunds / partial captures / cancellations from our UI (Stripe Dashboard only).
- Saved payment methods, Stripe `Customer` records, or recurring payments.
- Apple Pay / Google Pay (post-launch, toggleable from Dashboard once domain is verified).
- Multi-currency (USD only — delivery zones are NY/US).
- Cleanup or expiry of failed/canceled orders in storage.
- Production deploy automation (steps documented; execution out of scope).

## 3. Architecture

### 3.1 New files

| File | Purpose |
|---|---|
| `lib/stripe-server.ts` | `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "<latest>" })` singleton. Server-only. |
| `lib/stripe-client.ts` | Cached `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)`. Client-only. |
| `app/api/checkout/intent/route.ts` | `POST` handler: validates cart+form, computes totals, persists pending order, creates `PaymentIntent`, returns `{ clientSecret, orderId }`. |
| `app/api/stripe/webhook/route.ts` | `POST` handler: verifies signature, updates order on `payment_intent.succeeded` / `.payment_failed` / `.canceled`. Must use `runtime = "nodejs"` and read raw body via `req.text()`. |
| `app/api/order/[id]/status/route.ts` | `GET` handler: returns `{ status }` for confirmation-page polling. |
| `components/checkout/StripePaymentStep.tsx` | Replaces `PaymentStub`. Wraps `<Elements>` + `<PaymentElement>`. Exposes `confirmPayment()` to its parent through a callback ref. |

### 3.2 Files modified

| File | Change |
|---|---|
| `types/order.ts` | `status: "pending" \| "paid" \| "failed" \| "canceled"` (replaces current literal `"paid"`). Add `paymentIntentId?: string`. |
| `lib/order-storage.ts` | Add `updateOrderStatusByPaymentIntent(piId, status)`, `updateOrderPaymentIntent(orderId, piId)`, `getOrderByPaymentIntent(piId)`. |
| `components/checkout/CheckoutShell.tsx` | Replace `PaymentStub` with `StripePaymentStep`. Create `PaymentIntent` when advancing to step 3. Replace `submitOrder()` call with `stripe.confirmPayment()`. Re-create intent if subtotal+delivery changes. |
| `app/[locale]/order/[id]/confirmation/page.tsx` | Handle four states: `paid` (normal confirmation), `pending` (poll for up to 15s, 2s interval), `failed` and `canceled` (error UI + back-to-checkout CTA). On `paid` mount, also clear local cart (covers tab-close-after-pay edge case). |
| `.env.local.example` | Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` with placeholder values. |
| `README.md` | New "Pagos con Stripe" section covering env vars, `stripe listen` workflow, test cards, common failure modes. |

### 3.3 Files deleted

| File | Reason |
|---|---|
| `app/api/checkout/route.ts` | Replaced by `/api/checkout/intent`. Old route's "save order as paid" responsibility moves to the webhook. |
| `components/checkout/PaymentStub.tsx` | Replaced by `StripePaymentStep`. |
| `lib/submit-order.ts` | Its work splits into `/intent` (server) + `stripe.confirmPayment()` (client). |

### 3.4 Dependencies

```
pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js
```

### 3.5 Environment variables

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`whsec_` is provided by `stripe listen` in dev, by Dashboard endpoint config in prod.

## 4. Data flow

### 4.1 Happy path

```
Step 2 → user clicks "Continuar":
  client validates step-2 fields
  POST /api/checkout/intent { locale, lines, form }
    server: zod validate, compute totals
    server: orderId = `do_${...}`, save Order { status: "pending" }
    server: stripe.paymentIntents.create({
              amount: totals.totalCents,
              currency: "usd",
              automatic_payment_methods: { enabled: true },
              metadata: { orderId, locale },
              receipt_email: form.contact.email,
            }, { idempotencyKey: orderId })
    server: updateOrderPaymentIntent(orderId, paymentIntent.id)
    return 200 { clientSecret, orderId }
  client: store { clientSecret, orderId }, open step 3

Step 3 renders:
  <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
    <StripePaymentStep onConfirm={handleConfirm} />
  </Elements>

Step 3 → user clicks "Place order":
  stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${origin}/${locale}/order/${orderId}/confirmation`,
    },
    redirect: "if_required",
  })
  - success without redirect: clear cart, closeDrawer, router.push(confirmation)
  - 3DS branch: Stripe redirects to bank → bank redirects to return_url

Webhook (parallel to redirect):
  POST /api/stripe/webhook
    verify signature
    on payment_intent.succeeded → updateOrderStatusByPaymentIntent(pi.id, "paid")
    on payment_intent.payment_failed → "failed"
    on payment_intent.canceled → "canceled"

Confirmation page reads order:
  paid → normal confirmation UI; clear local cart on mount
  pending → "Procesando tu pago…", poll /api/order/[id]/status every 2s, max 15s
  failed | canceled → error UI + back-to-checkout CTA
```

### 4.2 Cart-changes-after-intent

The cart drawer remains accessible during checkout. If the user modifies the cart (or changes ZIP, which alters `deliveryCents`) after the `PaymentIntent` is created, the PI's `amount` no longer matches what we're about to charge.

Mitigation: `CheckoutShell` watches `subtotal + deliveryCents` via `useEffect`. If either changes after `clientSecret` is set, re-call `/api/checkout/intent` and replace `clientSecret` (which causes `<Elements>` to remount with the new key). The old `PaymentIntent` is left alone — Stripe expires unconfirmed PIs after 24h.

This is intentionally simpler than locking the cart drawer: keeps the user's ability to adjust their order at any point.

## 5. API contracts

### 5.1 `POST /api/checkout/intent`

**Request:**
```ts
{
  locale: "en" | "es",
  lines: CartLine[],   // { productId, variantId, addOnIds, qty }
  form: CheckoutInput  // existing checkoutSchema (contact + delivery)
}
```

**Response 200:**
```ts
{ clientSecret: string, orderId: string }
```

**Response 400:**
```ts
{ errors: { formErrors?: string[], fieldErrors?: Record<string, string[]> } }
```

Possible `formErrors` codes:
- `cart_empty` — subtotal ≤ 0
- `zip_not_in_zone` — `computeDeliveryCentsForZip(zip)` returned `null`
- `payment_init_failed` — Stripe API returned an error creating the PI
- `unknown_error` — anything else (e.g., `saveOrder` FS failure)

Logic:
1. Parse body with `requestSchema` (same as today's `/api/checkout`).
2. Compute `subtotal` (`cartSubtotalCents`).
3. Compute `deliveryCents` (`computeDeliveryCentsForZip`); 400 if `null`.
4. Compute `totals` (`computeOrderTotals`).
5. Generate `orderId` (same `do_…` format as today).
6. `saveOrder({ id: orderId, status: "pending", ...form, totals })`.
7. `stripe.paymentIntents.create(..., { idempotencyKey: orderId })`.
8. `updateOrderPaymentIntent(orderId, paymentIntent.id)`.
9. Return `{ clientSecret, orderId }`.

### 5.2 `POST /api/stripe/webhook`

**Request:** Stripe-signed event payload. Headers must include `stripe-signature`.

**Response:**
- `200 { received: true }` on success or ignored events.
- `400` on missing/invalid signature.
- `500` on storage failure (so Stripe retries with backoff).

Logic:
```ts
const body = await req.text();
const signature = req.headers.get("stripe-signature");
if (!signature) return new Response("missing signature", { status: 400 });

let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
} catch {
  return new Response("invalid signature", { status: 400 });
}

switch (event.type) {
  case "payment_intent.succeeded": {
    const pi = event.data.object as Stripe.PaymentIntent;
    await updateOrderStatusByPaymentIntent(pi.id, "paid");
    break;
  }
  case "payment_intent.payment_failed": {
    const pi = event.data.object as Stripe.PaymentIntent;
    await updateOrderStatusByPaymentIntent(pi.id, "failed");
    break;
  }
  case "payment_intent.canceled": {
    const pi = event.data.object as Stripe.PaymentIntent;
    await updateOrderStatusByPaymentIntent(pi.id, "canceled");
    break;
  }
  default:
    // ignore other events; Stripe will not retry on 2xx
}

return Response.json({ received: true });
```

`updateOrderStatusByPaymentIntent` is idempotent: if the order is already in the target state (or a more terminal state of the same nature), it's a no-op. If the order is not found, log warning and return success (don't retry).

**Runtime:** `export const runtime = "nodejs"` (Stripe SDK uses Node `crypto`).

### 5.3 `GET /api/order/[id]/status`

**Response 200:** `{ status: "pending" | "paid" | "failed" | "canceled" }`
**Response 404:** order not found.

No auth. Used only by the confirmation page polling. Does not expose totals or PII.

## 6. Order lifecycle

```
                     /api/checkout/intent
       (none) ─────────────────────────────► pending
                                                │
                                                ├── webhook: payment_intent.succeeded ──► paid
                                                │
                                                ├── webhook: payment_intent.payment_failed ──► failed
                                                │
                                                └── webhook: payment_intent.canceled ──► canceled
```

- `paid` is terminal.
- `failed` is terminal-ish: a user who retries gets a *new* order + new `PaymentIntent`. The failed order stays on disk (acceptable garbage; storage is JSON file, site is small).
- `canceled` is terminal.
- `pending` orders that never receive a webhook (e.g., `stripe listen` not running in dev) stay in `pending` indefinitely. Documented as expected dev behavior.

### Legacy data

Existing orders in `pending-orders.json` were saved with the old `status: "paid"` (string literal — same shape, different meaning: "we faked it"). They have no `paymentIntentId`. By making `paymentIntentId?: string` optional, we don't break reads. The webhook ignores orders it can't find by `paymentIntentId`, so legacy orders are inert.

## 7. Error handling

### 7.1 Server (`/api/checkout/intent`)

| Case | Status | Body | Client UI |
|---|---|---|---|
| Body parse / zod fail | 400 | `{ errors: zod.flatten() }` | Generic error (fields already validated client-side) |
| Empty cart | 400 | `{ errors: { formErrors: ["cart_empty"] } }` | "Your cart is empty" |
| ZIP out of zone | 400 | `{ errors: { formErrors: ["zip_not_in_zone"] } }` | Message + focus ZIP field |
| Stripe API failure | 502 | `{ errors: { formErrors: ["payment_init_failed"] } }` | "Couldn't start payment, try again" + retry |
| `saveOrder` FS error | 500 | `{ errors: { formErrors: ["unknown_error"] } }` | Generic |
| Idempotency-key replay | 200 | Returns same `client_secret` | User retries → same intent, flow continues |

### 7.2 Server (`/api/stripe/webhook`)

| Case | Status | Action |
|---|---|---|
| Missing / invalid signature | 400 | Log + ignore (likely spoofing attempt) |
| Body parse fails | 400 | Log |
| Unknown event type | 200 | Silent no-op (don't 5xx — Stripe would retry) |
| Order not found by `paymentIntentId` | 200 | Log warning + 200 (PI created outside our flow) |
| `updateOrderStatus` FS error | 500 | Stripe retries with backoff (intended behavior) |
| Duplicate event (already processed) | 200 | Idempotent no-op |

### 7.3 Client (`stripe.confirmPayment`)

| `error.type` | UI |
|---|---|
| `card_error` (decline, insufficient funds, …) | Show `error.message` (Stripe localizes). `submitting=false`. Don't clear cart, don't navigate. |
| `validation_error` | Show message, keep form open. |
| `api_connection_error` / `rate_limit_error` | "Connection issue, try again" + retry button. |
| `authentication_error` | "There's a problem with payment configuration, please contact us." (Indicates misconfigured keys — our bug.) |
| Anything else | Generic error + console log. |

### 7.4 Edge cases

1. **User closes tab between charge success and `return_url` redirect**
   Webhook still arrives → order marked `paid` → Stripe sends auto-receipt email. Local cart not cleared (state lives in browser). Acceptable: customer has email confirmation; on next visit they'll see their old cart and can clear it themselves. If they revisit `/order/[id]/confirmation` later, that page also clears the cart on mount when status is `paid`.

2. **Webhook arrives after redirect**
   Confirmation page polls `/api/order/[id]/status` every 2s up to 15s. Webhooks typically land in 1–2s. After 15s timeout: "We're verifying your payment, you'll receive an email."

3. **Webhook never arrives (dev without `stripe listen`)**
   Order stays `pending`. Confirmation polling times out. Documented in README as expected; fix is to start `stripe listen`.

4. **Double-click "Place order"**
   `FormSubmit` button is disabled while `submitting=true`. SDK is also robust against double-confirm.

5. **3DS authentication**
   `confirmPayment({ redirect: "if_required" })` redirects to bank when needed. Bank redirects back to `return_url`. Webhook resolves final status. Confirmation page handles either outcome.

6. **Retry after declined payment**
   User refreshes / returns to checkout. `CheckoutShell` has no `clientSecret` → on advancing to step 3, creates a *new* order + PI. Old order stays `failed` on disk.

7. **Cart goes empty mid-checkout (other tab clears it)**
   `CheckoutShell` already guards: `lines.length === 0` blocks submit. New: if cart empties while user is on step 3, redirect to `/cart` with a notice.

8. **ZIP changes between intent creation and submit (or cart changes)**
   `useEffect` watching `subtotal + deliveryCents` re-creates the intent (new `clientSecret`). Old PI expires unconfirmed within 24h.

### 7.5 Logging

`console.error("[stripe]", message, context)` server-side for API and webhook errors. No external logging service. Client errors surface in the UI (no telemetry).

## 8. Testing

### 8.1 Unit (Vitest)

Mock the Stripe SDK at the `lib/stripe-server` module boundary:
```ts
vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    paymentIntents: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
}));
```

| File | Cases |
|---|---|
| `tests/unit/api-checkout-intent.test.ts` | 400 on zod fail; 400 on empty cart; 400 on bad ZIP; 502 on Stripe error; 200 happy path with correct shape; idempotency key passed through. |
| `tests/unit/api-stripe-webhook.test.ts` | 400 on missing/invalid signature; 200 + status update for `succeeded` / `failed` / `canceled`; 200 silent on unknown event; idempotent on duplicate event; 200 + warning when order not found. |
| `tests/unit/order-storage.test.ts` (create — does not exist yet) | `updateOrderStatusByPaymentIntent`, `getOrderByPaymentIntent`, idempotent transitions. |

### 8.2 E2E (Playwright)

| Spec | Card | Expected |
|---|---|---|
| `tests/e2e/checkout-stripe-success.spec.ts` | `4242 4242 4242 4242` | Redirect to confirmation, paid status, cart cleared. |
| `tests/e2e/checkout-stripe-3ds.spec.ts` | `4000 0025 0000 3155` | 3DS challenge appears, complete it, confirmation. |
| `tests/e2e/checkout-stripe-decline.spec.ts` | `4000 0000 0000 9995` | Error message shown in step 3, no redirect, cart intact. |

E2E tests rely on Stripe-hosted iframes — known to be slightly flaky. Acceptable as smoke coverage; unit tests are the primary safety net.

### 8.3 Out of automated scope

- Webhook arrival timing (race with confirmation page) — covered by unit + manual smoke.
- Apple Pay / Google Pay — not enabled.
- `pending` confirmation UI with polling — manual smoke.

### 8.4 Manual smoke test

Documented in README:

```
Terminal 1: pnpm dev
Terminal 2: stripe listen --forward-to localhost:3000/api/stripe/webhook
            (copy whsec_... to .env.local, restart Terminal 1)
Browser:
  1. Add a product to the cart
  2. Go to /es/checkout
  3. Fill contact + delivery
  4. On step 3, verify Payment Element renders
  5. Card: 4242 4242 4242 4242, 12/34, CVC 123, ZIP 10001
  6. Click "Place order"
  7. Verify redirect to /es/order/[id]/confirmation with success state
  8. Verify pending-orders.json shows status: "paid"
  9. Verify event in Terminal 2 (stripe listen) and in Stripe Dashboard (test mode)
  10. Verify receipt email arrived (Stripe sandbox inbox)
```

### 8.5 Stripe test cards

- `4242 4242 4242 4242` — succeeds, no 3DS
- `4000 0025 0000 3155` — requires 3DS authentication
- `4000 0000 0000 9995` — insufficient_funds
- `4000 0000 0000 0002` — generic decline
- `4000 0000 0000 0341` — fails after attach (rare edge case)

Use any future expiry, any CVC, any ZIP.

## 9. Implementation order (suggested commits)

| # | Commit | Notes |
|---|---|---|
| 1 | `chore(stripe): install SDKs and add lib/stripe-{server,client}.ts` | Dependencies + singletons. No behavior change. |
| 2 | `feat(orders): add status + paymentIntentId to Order, helpers` | Type + storage helpers. Tests for storage. |
| 3 | `feat(checkout): POST /api/checkout/intent endpoint` | New endpoint with unit tests. Not yet consumed. |
| 4 | `feat(stripe): POST /api/stripe/webhook handler` | New endpoint with unit tests. |
| 5 | `feat(checkout): replace PaymentStub with StripePaymentStep` | Client wrapper around Elements + PaymentElement. |
| 6 | `feat(checkout): wire CheckoutShell to /intent + confirmPayment` | Cut-over commit. Deletes `submit-order.ts` and `app/api/checkout/route.ts`. |
| 7 | `feat(order): handle pending/failed states on confirmation page` | Polling + auxiliary `/api/order/[id]/status`. |
| 8 | `chore(stripe): document setup in README` | Setup + smoke + test cards. |

Each commit must pass `pnpm test`, `pnpm build`, and type-check before moving on. Commit 6 is the cut-over; before it, the site still uses the old flow.

## 10. Production deploy (out of scope, documented)

When the user is ready to go live:

1. Rotate the live secret key (the `sk_live_...` exposed during setup conversation).
2. Set production env vars (in host config — Vercel / Netlify / VPS):
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...` (from Dashboard, not CLI)
3. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://makythedivaflowers.com/api/stripe/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - Copy the `whsec_...` it generates into prod env.
4. Live mode → Settings → Payments → Payment methods: enable Card + Link.
5. Live mode → Settings → Emails: enable "Successful payments".
6. Live mode → Settings → Branding: same logo + accent color.
7. Smoke test in prod with a real card ($1.00 charge to self), then refund from Dashboard.

Apple Pay and Google Pay can be enabled at any point post-launch:
1. Live mode → Settings → Payment methods: toggle on.
2. For Apple Pay: download domain association file from Dashboard, place at `public/.well-known/apple-developer-merchantid-domain-association`, deploy, then verify in Dashboard.
3. `automatic_payment_methods: { enabled: true }` will surface them in the Payment Element automatically.

## 11. Open questions

None.
