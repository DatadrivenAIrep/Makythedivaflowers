# Web Order SMS Confirmation & Customer Base — Design

**Date:** 2026-08-17
**Status:** Draft for review
**Author:** Santiago (with Claude)

## Problem

The shop has a messaging rail that was built in May 2026 (`lib/twilio-server.ts`,
`lib/messaging.ts`, `lib/messaging-templates.ts`, `lib/message-storage.ts`,
`lib/order-dispatch.ts`) and is live: `TWILIO_SMS_ENABLED=true`,
`TWILIO_DRY_RUN=false`. It is only wired to the in-store intake flow.

Two consequences, both verified against the code:

1. **Web buyers receive nothing from Diva Flowers.** `dispatchOrderReceived()` is
   called only from `app/api/admin/orders/route.ts:153` (the iPad intake).
   `dispatchPaymentConfirmed()` fires only on `checkout.session.completed` — the
   payment-link flow. A normal web card payment lands on
   `payment_intent.succeeded`, which calls `notifyOrderPaid()`, and that email
   goes to `ORDER_NOTIFICATIONS_TO` (the shop), not the customer. The only thing
   a web buyer gets is Stripe's own receipt.

2. **Web buyers never enter the CRM.** `upsertOnOrder()` — the sole writer of the
   `customers` table — is called only from the intake route. There is no backfill
   script. So the 117 customers visible at `/admin/customers` in production are
   exclusively counter customers, and every online sale is invisible to
   retention.

A third problem surfaced while reading the segmentation code. In
`lib/customer-metrics.ts:79`:

```ts
isAtRisk = isRecurring && lastOrderAt < atRiskCutoffIso(now)
```

`isRecurring` requires 2+ orders, so a customer who bought once and never
returned can never be at-risk — they read as "new" forever. With a 9% repeat
rate, that excludes roughly 91% of the base from the one audience a win-back
campaign needs. This is why the dashboard shows "EN RIESGO: 0".

## Goal

Wire the existing rail to the web checkout, start (and retroactively recover) the
customer base, and make the never-returned customer findable.

After this delivery:

- Every paid web order sends the buyer an SMS confirmation.
- Every paid web order creates or updates a CRM customer.
- Historical paid web orders are recovered into the CRM.
- `/admin/customers` can filter the "bought once, never came back" segment.

## Non-Goals (YAGNI)

- **No marketing messages of any kind.** Transactional only — that is what may be
  sent on the strength of the transaction itself. Consent capture, opt-out
  storage, and `STOP`/`HELP` handling are Delivery 3 and gate all promotional
  sending.
- **No campaign engine.** No segmentation UI beyond one filter chip, no
  scheduler, no batch sender, no campaign analytics. At 117 customers a manual
  send is sufficient; the engine would be built for scale that does not exist.
- **No delivery-lifecycle messages** ("on the way", "delivered", photo capture).
  That is Delivery 2.
- **No refactor of the existing paid-order side effects.** The shop email, GA4
  purchase event, and print enqueue are duplicated between the webhook and the
  gift-card path today. That duplication is left alone: it works, and touching
  the payment path to tidy it would risk revenue for no user-facing gain.
- **No change to the meaning of `at_risk`.** A new segment is added beside it.
- **No A2P 10DLC registration.** That is a Twilio console task for the owner, not
  code, but it is a hard prerequisite for reliable delivery (see Risks).

## Architecture

### 1. A single "web order was paid" hook — `lib/on-web-order-paid.ts` (new)

A web order reaches paid state in exactly two places:

| Path | Location | Trigger |
|---|---|---|
| Card payment | `app/api/stripe/webhook/route.ts:52` | `payment_intent.succeeded` |
| Gift card covers the full total | `app/api/checkout/intent/route.ts:118` | no Stripe charge at all |

Both gain one call to the new module. Nothing else in those handlers changes.

```ts
export async function onWebOrderPaid(order: Order): Promise<void>
```

Steps, in this order:

1. **Idempotency guard.** If `order.customerId` is already set, return
   immediately. Stripe retries webhooks; `upsertOnOrder()` increments
   `order_count` on every call, so an unguarded retry inflates the count.
2. **`upsertOnOrder(...)`** — create or update the customer (field mapping in §2).
3. **`updateOrder({ ...order, customerId: customer.id })`** — persist the link.
   `saveOrder` already upserts `customer_id` (`lib/order-storage.ts:73`), and
   `updateOrder` is the existing write path.
4. **`dispatchPaymentConfirmed({ ...order, customerId: customer.id })`** — send.

**The order of 2 and 4 is load-bearing.** `dispatchPaymentConfirmed` resolves the
recipient's channel and locale via `getByPhone()` (`lib/order-dispatch.ts:79`). If
the SMS went first, that lookup would miss on every first-time web buyer and the
customer's stored preference would never be honored.

The whole body is wrapped so that no failure propagates to the caller — see
Error handling.

### 2. Field mapping into the CRM

| `UpsertInput` | Source | Note |
|---|---|---|
| `name` | `order.contact.name` | falls back to `order.fulfillment.recipient.name` when blank — mirrors the intake fallback at `app/api/admin/orders/route.ts:41` |
| `phone` | `order.contact.phone` | always present on a web order |
| `email` | `order.contact.email` | optional |
| `address` | `order.fulfillment.address` when method is `delivery` | same choice the intake makes; lands in `last_address_json` |
| `buyerAddress` | — | web checkout does not collect it |
| `orderAt` | `order.paidAt ?? order.createdAt` | |
| `locale` | `order.locale` | |
| `messagingChannel` | — | left unset; `dispatchPaymentConfirmed` defaults to `sms`. This is the field the Delivery 3 consent checkbox will write. |

### 3. Upsert on paid, not on order creation

The web order row is written by `/api/checkout/intent` *before* payment, so
abandoned and failed checkouts also produce order rows. Creating the CRM record
at payment success keeps those out of the customer base and keeps the live path
and the backfill on identical rules.

### 4. Backfill — `scripts/backfill-customers-from-orders.ts` (new)

Recovers the customers that were lost while the web path was unwired.

- Selects orders where `payment_status = 'paid'` and `customer_id IS NULL`,
  ordered by `created_at ASC` so `first_seen_at` / `last_seen_at` land correctly.
- Calls the **same** `upsertOnOrder()` the live path uses, so a backfilled
  customer is indistinguishable from an organically created one.
- Matching is by normalized phone (`customer-storage.ts` `normalizePhone`), so a
  web buyer who already exists as a counter customer is merged rather than
  duplicated.
- Writes `customer_id` back onto each order, which makes re-running a no-op.
- **Dry-run is the default.** Run with no flags and it only reports: orders
  scanned, customers that would be created, and orders that would merge into an
  existing customer. Writing requires an explicit `--commit`.

**The backfill sends no messages.** It calls `upsertOnOrder` directly, never
`onWebOrderPaid` and never `dispatchPaymentConfirmed`. Firing confirmations for
months-old orders would be a serious incident; the script carries a comment
saying so, and the test suite asserts no Twilio call is made.

Added to `package.json` as `backfill:customers`.

### 5. Segmentation — the "never came back" segment

`at_risk` keeps its current definition. A new segment is added beside it:

| Segment | Definition | Message it deserves |
|---|---|---|
| `at_risk` | 2+ orders, last order older than 90 days | "we miss you" |
| `lapsed` *(new)* | exactly 1 order, older than 90 days | "come back, here's something" |

In `lib/customer-metrics.ts`:

- `isLapsed = orderCount === 1 && lastOrderAt !== null && lastOrderAt < atRiskCutoffIso(now)`
  — reuses `AT_RISK_DAYS` rather than introducing a second threshold.
- Add `isLapsed` to `CustomerMetrics`.
- Precedence becomes `at_risk > vip > recurring > lapsed > new`. `lapsed` sits
  above `new` so a stale single-order customer stops reading as "new"; it sits
  below `recurring` and `vip` so nobody currently badged changes.

`isLapsed` and `segment` are deliberately independent. A customer with one large
old order is both `isLapsed === true` and badged `vip` — precedence decides the
badge, but they still belong in the win-back audience, so the filter must return
them. The `lapsed` filter therefore matches the `isLapsed` flag, not the primary
badge. The same holds for `isVip` / `isRecurring` today.

In `lib/customer-storage.ts`, the `listCustomers` switch gains:

```sql
COALESCE(a.o_count, 0) = 1 AND a.last_order_at < ?
```

with `atRiskCutoffIso(now)` as the parameter — same construction as the existing
`at_risk` arm, thresholds interpolated from the `customer-metrics.ts` exports and
never from user input.

UI: a fifth filter chip in `components/admin/customers/CustomersList.tsx`
(`{ id: "lapsed", key: "seg_lapsed" }`), a badge, a `lapsedCount` in
`CustomerListStats`, and i18n keys `seg_lapsed` / `badge_lapsed` /
`stat_lapsed` in `messages/en.json` and `messages/es.json`. Spanish copy:
**"Sin volver"**.

### 6. Message copy

Reuses the existing `payment_confirmed` template rather than adding a fourth one.
`TemplateVars` gains `order_number?: string`.

```
ES  ¡Gracias {name}! Diva Flowers recibió tu pago. Orden #{number},
    total {total}. Entrega {window}. — Maky

EN  Thanks {name}! Diva Flowers received your payment. Order #{number},
    total {total}. Delivery {window}. — Maky
```

`order_number` comes from `order.orderNumber`; the clause is omitted when the
order has none (orders predating that feature).

`whatsappContentVars()` gains the matching positional entry so the two renderers
stay in step. WhatsApp remains disabled — this is bookkeeping, not activation.

Known and accepted: Spanish accents (`ó`, `í`) fall outside GSM-7, so ES messages
encode as UCS-2 and split into two segments. At this volume the cost difference
is negligible and the copy is not worth mangling to avoid it.

## Data flow

```
Web checkout (card)
  POST /api/checkout/intent  → saveOrder(paymentStatus: "pending")
  Stripe                     → payment_intent.succeeded
  webhook                    → updateOrderStatusByPaymentIntent(paid)
                             → notifyOrderPaid (shop email)   [unchanged]
                             → sendPurchaseToGA4              [unchanged]
                             → enqueuePrintJob                [unchanged]
                             → onWebOrderPaid(order)          [NEW]
                                  ├─ guard: order.customerId already set? → stop
                                  ├─ upsertOnOrder → customer
                                  ├─ updateOrder(customerId)
                                  └─ dispatchPaymentConfirmed
                                       ├─ getByPhone → channel + locale  (now hits)
                                       ├─ hasRecentSuccess(24h) → dedupe
                                       └─ sendMessage → messages row + Twilio

Web checkout (gift card covers the total)
  POST /api/checkout/intent  → saveOrder(paymentStatus: "paid")
                             → notifyOrderPaid, enqueuePrintJob  [unchanged]
                             → onWebOrderPaid(order)             [NEW, same path]

Backfill (one-off, manual)
  scripts/backfill-customers-from-orders.ts --commit
                             → upsertOnOrder + updateOrder(customerId)
                             → NO messages
```

## Error handling

- `onWebOrderPaid` catches everything and logs a structured line
  (`{ event: "web_order_paid_hook_failed", orderId, error }`). It never throws.
  A Stripe webhook that 5xx's is retried, which would re-run the print enqueue
  and the shop email; an SMS failure must not cause that.
- Twilio failures are already recorded per-message: `sendMessage` writes a
  `messages` row before attempting the send and updates it to `failed` with the
  error text (`lib/messaging.ts:93`). No new error store is needed.
- The upsert and the `customerId` write are two statements. If the process dies
  between them, the customer exists but the order is unlinked — the next backfill
  run repairs it, since it selects on `customer_id IS NULL` and matches by phone.
- The backfill wraps its writes per order and reports failures at the end rather
  than aborting, so one malformed row cannot strand the run halfway.

## Testing

`tests/unit/on-web-order-paid.test.ts` (new)
- creates the customer and links it before dispatching (assert call order)
- returns early without a second `upsertOnOrder` when `customerId` is already set
- a throwing `dispatchPaymentConfirmed` does not propagate
- a throwing `upsertOnOrder` does not propagate

`tests/unit/backfill-customers.test.ts` (new)
- groups multiple orders sharing a phone into one customer with the right
  `first_seen_at` / `last_seen_at`
- merges into an existing counter customer instead of duplicating
- re-running after a commit changes nothing
- dry-run writes nothing
- **no Twilio call is made** (assert the messaging module is untouched)

`tests/unit/customer-metrics.test.ts` (extend)
- 1 order, 91 days → `lapsed`
- 1 order, 10 days → `new`
- 2 orders, 91 days → `at_risk` (unchanged)
- 1 order, 91 days, LTV over the VIP threshold → `vip` (precedence holds)

`tests/unit/customer-storage.test.ts` (extend)
- the `lapsed` SQL filter returns exactly the customers whose `isLapsed` flag is
  true — including one badged `vip` by precedence — so the predicate and the
  metric cannot drift apart

`tests/unit/messaging-templates.test.ts` (extend)
- `payment_confirmed` renders the order number in both locales, and omits the
  clause cleanly when `order_number` is absent

Baseline note: the full suite carries ~7 failures that also fail on `main`
(Chromium spawn ENOEXEC plus checkout/preview). Run the suite on the base commit
first and compare, rather than attributing them to this work.

## Files touched (summary)

**New**
- `lib/on-web-order-paid.ts`
- `scripts/backfill-customers-from-orders.ts`
- `tests/unit/on-web-order-paid.test.ts`
- `tests/unit/backfill-customers.test.ts`

**Modified**
- `app/api/stripe/webhook/route.ts` — one call in `payment_intent.succeeded`
- `app/api/checkout/intent/route.ts` — one call in the gift-card full-coverage branch
- `lib/customer-metrics.ts` — `isLapsed`, precedence
- `lib/customer-storage.ts` — `lapsed` predicate, `lapsedCount` stat
- `lib/messaging-templates.ts` — `order_number` in `TemplateVars`, copy, WhatsApp vars
- `lib/order-dispatch.ts` — pass `order_number` through
- `components/admin/customers/CustomersList.tsx` — filter chip, badge, stat
- `messages/en.json`, `messages/es.json` — `seg_lapsed`, `badge_lapsed`, `stat_lapsed`
- `package.json` — `backfill:customers` script
- `tests/unit/customer-metrics.test.ts`, `tests/unit/customer-storage.test.ts`,
  `tests/unit/messaging-templates.test.ts`

No database migration. The `lapsed` segment is derived, not stored.

## Risks and prerequisites

1. **A2P 10DLC.** US application-to-person SMS from a long code requires brand and
   campaign registration; unregistered traffic is filtered or blocked by carriers.
   Verify the number's status in the Twilio console before judging deliverability.
   A sole-proprietor campaign is the likely fit at this volume. Registration takes
   days — start it in parallel with implementation. (Carrier rules and pricing
   change; confirm in the console rather than trusting documentation from memory.)
2. **Back up the production database before running the backfill.** It writes to
   `customers` and `orders`. Dry-run first, read the counts, then commit.
3. **Orders showing $0.00 spent.** "Total gastado" sums `amount_paid_cents`
   (`customer-metrics.ts:55`), so counter orders settled in cash or Zelle without
   being marked paid read as $0. VIP detection is LTV-based and therefore
   undercounts. This is a data-entry question for the shop, not a code defect, and
   it is out of scope here — but it will distort any LTV-based audience built in
   Delivery 3.
4. **Consent.** This delivery sends only transactional confirmations for a
   purchase the recipient just made. No promotional message may go out until
   Delivery 3 ships consent capture and opt-out handling.

## Open questions (defaults chosen; flag if you disagree)

1. **Lapsed threshold = 90 days**, reusing `AT_RISK_DAYS`. For a florist a
   90-day gap may be normal (occasion-driven buying); 180 might segment better.
   Chose 90 for consistency; it is a one-line change.
2. **The backfill covers paid orders only.** Unpaid web orders are abandoned
   checkouts and are excluded. If the shop wants to reach people who started a
   checkout and did not finish, that is a separate — and consent-bound —
   conversation.
3. **`lapsedCount` is added as a fifth stat card** in the customers header.
   If five cards crowd the layout, the alternative is to swap it for "EN RIESGO",
   which is structurally near-zero at a 9% repeat rate.
