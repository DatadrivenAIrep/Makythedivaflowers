# SMS Delivery 2 — Delivery lifecycle + owner alerts — Design

**Date:** 2026-08-18
**Status:** Draft for review
**Author:** Santiago (with Claude)

## Problem

The Twilio SMS rail (now A2P-approved and live) sends order/payment
confirmations to web buyers, but nothing after that. Two gaps:

1. **Customers hear nothing about delivery.** When the shop marks an order
   out-for-delivery or delivered (`changeFulfillmentStatus` in
   `lib/order-mutations.ts`), the status changes and is recorded, but no SMS
   goes out. Buyers who paid online have no idea their flowers are on the way or
   have arrived — the single biggest driver of "where is my order?" calls.
2. **The owner (Maky) doesn't know when something needs her.** New paid web
   orders and new leads land in the admin dashboard, but Maky doesn't watch it.
   The contact-form lead-notification gap (`/api/contact` saves but never pings
   her) is long-standing; she prefers a text she can act on.

## Goal

Close both gaps, reusing the existing rail:

- **Customer:** an SMS when a delivery order goes out-for-delivery ("on the
  way") and when it's delivered ("delivered"), to the buyer, if they opted in.
- **Owner:** an SMS to Maky's mobile when a new web order is paid, a new
  wedding/event lead arrives, or a new contact inquiry arrives.

## Non-Goals (YAGNI — confirmed with the owner)

- **No delivery photo.** The "delivered" message is text only. No photo upload,
  no MMS, no link to a photo.
- **No pickup messages.** "On the way"/"delivered" are delivery concepts;
  pickup orders get nothing. No "ready for pickup" message.
- **No recipient notification.** Messages go to the buyer only (who consented),
  not the flower recipient (who did not).
- **No cron-based messages.** No daily summary, no pickup reminders — those need
  a scheduler and are out of scope.
- **No newsletter alert.** Newsletter signups do not text Maky (too noisy).

## Architecture

### 1. Customer delivery messages

**Two new templates** in `lib/messaging-templates.ts`: `out_for_delivery` and
`delivered`, each EN/ES. This requires:
- Extending `MessageTemplate` in `lib/message-storage.ts` to
  `"order_received" | "payment_link" | "payment_confirmed" | "out_for_delivery" | "delivered"`.
  (No DB migration — the `messages.template` column is free-text TEXT.)
- Adding both to the `BODIES` map (en + es) — TypeScript's `Record<MessageTemplate, …>`
  makes this exhaustive, so a missing entry fails to compile.
- Adding both to the `whatsappContentVars` switch so it stays exhaustive
  (WhatsApp is disabled; these are inert but must compile).

They reuse the existing `TemplateVars` fields (`recipient_name`, `window`,
`shop_phone`) — no new vars.

**Two dispatch functions** in `lib/order-dispatch.ts`, mirroring
`dispatchPaymentConfirmed`:

```ts
export async function dispatchOutForDelivery(order: Order): Promise<void>
export async function dispatchDelivered(order: Order): Promise<void>
```

Each:
1. Returns immediately if `order.fulfillment.method !== "delivery"`.
2. Resolves the customer by `getByPhone(order.contact.phone)`; channel =
   `customer?.messagingChannel ?? "sms"`; returns if channel is `"none"` (the
   buyer's transactional consent gates delivery updates just like the
   confirmation — same field, same rule as Delivery 1).
3. Dedupes with `hasRecentSuccess(order.id, "<template>", 24)` so re-marking a
   status doesn't double-send.
4. Renders and sends via `sendMessage` (which handles dry-run, audit row, and
   the actual Twilio call) to `order.contact.phone`.

**Trigger** in `lib/order-mutations.ts` `changeFulfillmentStatus`: after the
successful `upsert(next)` and change record, dispatch based on the new status,
using the same dynamic-import + swallow-failures pattern the function already
uses for `dispatchPaymentConfirmed` on payment:

```ts
if (status === "out-for-delivery") {
  try {
    const { dispatchOutForDelivery } = await import("@/lib/order-dispatch");
    await dispatchOutForDelivery(next);
  } catch (e) { /* log; the status change already committed */ }
} else if (status === "delivered") {
  // …dispatchDelivered(next)…
}
```

The dispatch functions' own `method !== "delivery"` guard means pickup/in-store
orders are skipped even though the trigger fires for them.

### 2. Internal owner alerts — `lib/notify-owner.ts` (new)

A small server-only module with one function:

```ts
export async function notifyOwner(message: string): Promise<void>
```

- Sends an SMS to `SITE.mobile.e164` (+15168512815) via `sendSms`.
- Respects `twilioSmsEnabled()` (skip if off) and `twilioDryRun()` (log instead
  of send). No customer consent involved — it's the owner's own operational
  phone, not an A2P/marketing message.
- **Never throws.** Wrapped in try/catch that logs a structured line. An alert
  failure must never break the order or lead flow that triggered it.
- Not written to the `messages` table (that's order-scoped; leads aren't). The
  console log is the trail.

**Three hooks:**

| Event | Where | Alert content |
|---|---|---|
| New paid web order | `lib/on-web-order-paid.ts`, after the customer/dispatch work (fires once — guarded by the existing `customerId` check) | order number, total, delivery window |
| New wedding/event lead | `app/api/inquiry/route.ts`, after `saveInquiry`, for `type` wedding/event | lead name + phone (`contact.phone` exists on these) |
| New contact inquiry | `app/api/contact/route.ts`, after `saveInquiry` | lead name + email + subject (**the contact form has no phone field**) |

Each hook calls `notifyOwner(...)` fire-and-forget (`void`, or awaited inside the
route's existing best-effort try). The alert strings are built inline in Spanish
(Maky's language) — they are not customer messages, so no `messaging-templates`
entry and no next-intl i18n.

### 3. Message content

**Customer templates** (`messaging-templates.ts`), example-rendered:

```
out_for_delivery
  ES  ¡Hola {recipient_name}! Tu pedido de Diva Flowers va en camino, llega
      {window}. — Maky
  EN  Hi {recipient_name}! Your Diva Flowers order is on the way, arriving
      {window}. — Maky

delivered
  ES  ¡Entregado! Tu pedido de Diva Flowers ya llegó. ¡Gracias por tu compra!
      — Maky · {shop_phone}
  EN  Delivered! Your Diva Flowers order has arrived. Thank you! — Maky · {shop_phone}
```

**Owner alerts** (inline Spanish strings):

```
new order   Nueva orden web #{orderNumber} · {total} · entrega {window}. — Diva Flowers
wedding lead Nuevo lead de boda: {name} · {phone}. Revisa el pipeline.
event lead   Nuevo lead de evento: {name} · {phone}. Revisa el pipeline.
contact      Nueva consulta: {name} · {email} — "{subject}".
```

The buyer/window rendering reuses `windowLabel`/`totalLabel`/`firstName` helpers
already in `order-dispatch.ts`.

### 4. Test-panel additions

The Twilio settings test-send (`/api/admin/settings/twilio-test` +
`TwilioSettings.tsx`) already previews the existing templates. Add
`out_for_delivery` and `delivered` to its `KNOWN_TEMPLATES` allow-list and to the
UI's message dropdown (two i18n option labels), so the owner can preview the new
messages on a test number too.

## Data flow

```
Shop marks order out-for-delivery / delivered  (dashboard → fulfillment PATCH)
  → changeFulfillmentStatus(orderId, status)
      → upsert(next) + recordOrderChange           [existing]
      → status "out-for-delivery" → dispatchOutForDelivery(next)   [NEW]
        status "delivered"        → dispatchDelivered(next)        [NEW]
            ├─ method !== "delivery"? → skip
            ├─ getByPhone → channel; "none" → skip
            ├─ hasRecentSuccess(24h) → dedupe
            └─ sendMessage → messages row + Twilio (or dry-run)

Web order paid    → onWebOrderPaid → … → notifyOwner("Nueva orden web …")   [NEW]
Wedding/event lead → POST /api/inquiry → saveInquiry → notifyOwner("Nuevo lead …") [NEW]
Contact inquiry   → POST /api/contact → saveInquiry → notifyOwner("Nueva consulta …") [NEW]
  notifyOwner: sms-enabled? dry-run? → sendSms(SITE.mobile.e164, …), never throws
```

## Error handling

- **Delivery dispatch:** wrapped where triggered (order-mutations) in try/catch
  that logs; the status change is already committed, and `sendMessage` records a
  `failed` row on Twilio error. Re-marking the status won't re-send (dedupe).
- **Owner alerts:** `notifyOwner` never throws; a failed alert logs and is
  swallowed so the order/lead flow is unaffected. The lead routes already wrap
  their side effects best-effort.
- **Dedupe across both:** `hasRecentSuccess` prevents duplicate customer sends;
  owner alerts fire from single, once-per-event call sites (onWebOrderPaid's
  `customerId` guard; one lead POST = one lead).

## Testing

`tests/unit/messaging-templates.test.ts` (extend)
- `out_for_delivery` and `delivered` render in EN and ES with a name/window/phone.

`tests/unit/order-dispatch.test.ts` (new — none exists)
- delivery order + `messagingChannel:"sms"` → sends the right template
- pickup order → no send
- `messagingChannel:"none"` → no send
- dedupe: a second call within 24h does not re-send

`tests/unit/order-mutations-fulfillment.test.ts` (extend — exists)
- transition to out-for-delivery dispatches out_for_delivery; to delivered
  dispatches delivered; a dispatch throw does not break the status change

`tests/unit/notify-owner.test.ts` (new)
- sends to `SITE.mobile.e164` when sms enabled and not dry-run
- skips (no send) when sms disabled, and when dry-run
- never throws when `sendSms` rejects

`tests/unit/on-web-order-paid.test.ts` (extend)
- a paid web order calls `notifyOwner` once

`tests/unit/api-contact.test.ts` (extend — exists) and
`tests/unit/api-inquiry.test.ts` (new — none exists)
- a wedding/event lead calls `notifyOwner`; a contact inquiry calls `notifyOwner`

`tests/unit/api-admin-settings-twilio-test.test.ts` (extend)
- the two new templates are accepted and rendered by the test-send endpoint

Baseline: the suite carries the known ~7 pre-existing failures (Chromium spawn
ENOEXEC + the date-sensitive checkout-schema specs). Compare before attributing.

## Files touched (summary)

**New**
- `lib/notify-owner.ts`
- `tests/unit/notify-owner.test.ts`
- `tests/unit/order-dispatch.test.ts` (if none exists)

**Modified**
- `lib/message-storage.ts` — `MessageTemplate` union +2
- `lib/messaging-templates.ts` — BODIES +2 (en/es), whatsappContentVars switch +2
- `lib/order-dispatch.ts` — `dispatchOutForDelivery`, `dispatchDelivered`
- `lib/order-mutations.ts` — trigger the two dispatches in `changeFulfillmentStatus`
- `lib/on-web-order-paid.ts` — `notifyOwner` new-order alert
- `app/api/inquiry/route.ts` — `notifyOwner` wedding/event alert
- `app/api/contact/route.ts` — `notifyOwner` contact alert
- `app/api/admin/settings/twilio-test/route.ts` — allow the 2 new templates
- `components/admin/settings/TwilioSettings.tsx` — 2 dropdown options
- `messages/en.json`, `messages/es.json` — 2 test-dropdown labels
- tests as listed above

No database migration.

## Deployment note

Deploy = push to `origin/main` (auto-builds; ~1–2 min). The delivery messages
send only when the shop advances a real order's status, and owner alerts fire on
real orders/leads — verify with a test order after deploy, or preview the two
customer templates via the settings test panel.
