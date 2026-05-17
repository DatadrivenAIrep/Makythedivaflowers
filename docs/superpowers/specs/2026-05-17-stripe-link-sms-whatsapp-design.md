# Stripe payment links + SMS/WhatsApp messaging — design (Phase 2)

**Status:** draft for review
**Date:** 2026-05-17
**Owner:** Santiago Cardona
**Phase:** 2 of 4 (Phase 1 — iPad intake form — is shipped and on `main`.)

## Summary

Close the loop on intake-form orders by (a) auto-generating a Stripe payment link for pending-payment orders and (b) sending order confirmations and the payment link to the customer via SMS or WhatsApp depending on their stated preference. Adds a Twilio integration behind feature flags so SMS goes live as soon as the account is provisioned, and WhatsApp flips on once Meta approves the message templates. Adds a `messaging_channel` field to the customer record and a 4-chip channel picker to the intake form's customer block. All messages are bilingual (en/es) driven by the customer's locale.

## Roadmap (context)

| Phase | Scope |
| ----- | ----- |
| 1     | iPad intake form + SQLite migration + customers seed — **shipped** |
| **2** | **Stripe payment links + SMS/WhatsApp customer notifications** (this spec) |
| 3     | Day-of operations: dashboard + delivery route + driver + Calendar + day-before reminders + "out for delivery" notifications |
| 4     | Full CRM + one-tap reorder + accounting export |

## Goals & non-goals

### In scope (Phase 2)
- Stripe **Checkout Session** generation for pending-payment intake orders, with 24-hour expiry and order metadata
- Manual regeneration endpoint at `POST /api/admin/orders/[id]/payment-link`
- Twilio integration for **SMS** (default channel for US) and **WhatsApp** (gated by env flag until Meta approves templates)
- Three message templates per channel per locale: `order_received`, `payment_link`, `payment_confirmed` (= 6 WhatsApp template submissions total)
- Customer-level `messaging_channel` preference (sms / whatsapp / email / none) with auto-fill on recurring customers and override in the intake form
- Customer-level `locale` preference (en / es) for message rendering
- Audit log `messages` table for all outbound sends
- `TWILIO_DRY_RUN` flag for local development without burning credits

### Out of scope (deferred)
- Day-before delivery reminders — Phase 3
- "Out for delivery" status + notification — Phase 3 (depends on driver UI)
- Inbound replies from customers — they land in Twilio's inbox; no auto-forwarding
- Messaging for web-checkout orders — those continue using the branded email only
- A pending-payment email template — when a customer's preference is `email` and the order is pending, no automated message is sent (Maky follows up manually). The branded email continues to fire on paid orders through the existing `notifyOrderPaid` path.
- Stripe Checkout page localization (Stripe handles automatically; no work for us)
- Marketing / promotional WhatsApp templates — Utility category only
- Multi-region — assumes US (+1, USD)

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Provider | Twilio (covers SMS + WhatsApp Business via one SDK) |
| Stripe API for links | Checkout Sessions (one-time URLs with metadata) |
| Link expiry | 24 hours |
| Channel preference scope | Hybrid: stored on customer, edits in the form update the customer |
| What triggers messages | (1) order saved · (2) order saved with pending payment + payment link · (3) Stripe webhook → paid |
| "On the way" notification | Deferred to Phase 3 |
| Language | Bilingual (en/es), inferred from intake form locale, persisted on customer, overridable |
| WhatsApp readiness | Build everything, gate WhatsApp sends behind `TWILIO_WHATSAPP_ENABLED=true` until Meta approves the 6 templates |
| Inbound replies | Out of scope — sit in Twilio inbox |
| Audit | New `messages` table — query-able locally |

## Architecture

```
                       ┌──────────────────────┐
                       │  iPad intake form    │
                       │  (sets channel pref) │
                       └──────────┬───────────┘
                                  │ POST /api/admin/orders
                                  ▼
                       ┌──────────────────────┐
                       │  saveOrder + decide  │
                       │  what to send        │
                       └──────────┬───────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                                   ▼
       ┌────────────────┐                  ┌─────────────────┐
       │ Stripe link    │                  │ messaging.send  │
       │ (if pending)   │                  │ (channel-aware) │
       └────────┬───────┘                  └────────┬────────┘
                │                                   │
                ▼                              ┌───┴───┐
       Checkout Session                        SMS  WhatsApp
       id stored on order                      (gated by flags)
                │                                   │
                ▼                                   ▼
       Customer pays via link              Twilio API
                │
                ▼
       Stripe webhook ───► updateOrderStatus ─► messaging.send "payment_confirmed"
```

### New files
- `lib/twilio-server.ts` — lazy-init Twilio SDK wrapper, `sendSms()`, `sendWhatsApp()`, `e164()` normalizer
- `lib/messaging.ts` — channel-agnostic `sendMessage(req)` with audit logging + feature-flag skip
- `lib/messaging-templates.ts` — bilingual template definitions (3 templates × 2 locales)
- `lib/stripe-payment-link.ts` — `createCheckoutSession(order, locale)` → `{ id, url, expiresAt }`
- `lib/message-storage.ts` — insert/update rows in the `messages` audit table
- `app/api/admin/orders/[id]/payment-link/route.ts` — `POST` to regenerate the payment link and resend
- `db/migrations/002_messaging.sql` — schema changes below
- Tests: `tests/unit/messaging.test.ts`, `tests/unit/messaging-templates.test.ts`, `tests/unit/twilio-server.test.ts`, `tests/unit/stripe-payment-link.test.ts`, `tests/unit/api-admin-payment-link.test.ts`, `tests/unit/api-stripe-webhook.test.ts` (extend)
- `components/admin/intake/ChannelPicker.tsx` — 4-chip selector

### Modified files
- `app/api/admin/orders/route.ts` — after `saveOrder`, dispatch `order_received` or `payment_link` based on payment status; generate Stripe Checkout Session when pending
- `app/api/stripe/webhook/route.ts` — add `checkout.session.completed` case; trigger `payment_confirmed`
- `lib/customer-storage.ts` — extend `Customer` + `UpsertInput` with `messagingChannel` and `locale`
- `components/admin/intake/CustomerBlock.tsx` — embed `ChannelPicker`; pass locale to parent
- `components/admin/intake/IntakeForm.tsx` — pass channel + locale on submit
- `types/order.ts` — add `MessagingChannel` type; `Customer.messagingChannel`, `Customer.locale`; `Order.stripeCheckoutSessionId`
- `schemas/intake.ts` — `customer.messagingChannel?`, `customer.locale?`
- `messages/en.json` + `messages/es.json` — new `admin_intake.channel.*` strings + status banner strings

## Data model

```sql
-- db/migrations/002_messaging.sql

ALTER TABLE customers ADD COLUMN messaging_channel TEXT;
-- values: 'sms' | 'whatsapp' | 'email' | 'none' | NULL (no preference yet)

ALTER TABLE customers ADD COLUMN locale TEXT;
-- 'en' | 'es' | NULL

ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,        -- "msg_..."
  order_id     TEXT NOT NULL,
  customer_id  TEXT,
  channel      TEXT NOT NULL,           -- 'sms' | 'whatsapp' | 'email'
  template     TEXT NOT NULL,           -- 'order_received' | 'payment_link' | 'payment_confirmed'
  locale       TEXT NOT NULL,
  to_phone     TEXT,
  to_email     TEXT,
  provider_sid TEXT,                    -- Twilio Message SID; NULL for email or skipped
  status       TEXT NOT NULL,           -- 'queued' | 'sent' | 'failed' | 'skipped'
  error        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_messages_order ON messages(order_id);
CREATE INDEX idx_messages_status ON messages(status);
```

### TypeScript types (additions)

```ts
// types/order.ts
export type MessagingChannel = "sms" | "whatsapp" | "email" | "none";

export type Customer = {
  // ...existing fields
  messagingChannel?: MessagingChannel;
  locale?: "en" | "es";
};

export type Order = {
  // ...existing fields
  stripeCheckoutSessionId?: string;
};
```

The form's channel override updates the customer record permanently (no per-order `messagingChannel` on the order). This avoids drift between the order and the customer's current preference.

## Stripe payment link flow

We use **Checkout Sessions** (not the simpler Payment Links product) — they let us pass `metadata.orderId`, set an expiry, and pre-fill the customer's email.

### When a session is generated

- The intake order POST returns 201 with `paymentStatus: "pending"` and the customer has a messaging channel (`sms` / `whatsapp`) — then we call `createCheckoutSession(order, locale)` and store the resulting `id` and `url` on the order.
- If the channel is `email` or `none`, no session is generated automatically. Maky cobra manual.
- A manual `POST /api/admin/orders/[id]/payment-link` regenerates the link (idempotent for the same order — the old session is closed implicitly when a new one is created).

### Session shape

```ts
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [
    {
      price_data: {
        currency: "usd",
        unit_amount: order.totals.totalCents,
        product_data: {
          name: `Diva Flowers · pedido ${order.id}`,
          description: `${order.lines.length} item${order.lines.length === 1 ? "" : "s"} · entrega ${order.fulfillment.window?.date ?? "TBD"}`,
        },
      },
      quantity: 1,
    },
  ],
  metadata: { orderId: order.id },
  client_reference_id: order.id,
  customer_email: order.contact.email || undefined,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  success_url: `${process.env.SITE_URL}/${locale}/order/${order.id}/confirmation`,
  cancel_url:  `${process.env.SITE_URL}/${locale}/admin/intake`,
  payment_intent_data: {
    metadata: { orderId: order.id },
  },
});
```

### Webhook integration

The existing `app/api/stripe/webhook/route.ts` handles `payment_intent.succeeded` (used by the web checkout). We add:

```ts
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) break;
  await markOrderPaidBySessionId(session.id, orderId);
  await sendPaymentConfirmation(orderId);
  break;
}
```

`updateOrderStatusByPaymentIntent` (Phase 1) is already idempotent on `paymentStatus === "paid"`, so a duplicate webhook (Stripe may fire both `checkout.session.completed` and `payment_intent.succeeded` for the same payment) does NOT double-send `payment_confirmed`.

### Reconciliation

`sendPaymentConfirmation(orderId)` checks the latest `messages` rows for that order and skips if a `payment_confirmed` was already sent successfully in the last 24h. Belt and suspenders.

## Twilio + messaging abstraction

`lib/messaging.ts`:

```ts
export type MessageRequest = {
  orderId: string;
  customerId?: string;
  channel: "sms" | "whatsapp" | "email";
  locale: "en" | "es";
  template: "order_received" | "payment_link" | "payment_confirmed";
  vars: Record<string, string>;
  to: { phone?: string; email?: string };
};

export type MessageResult = { id: string; status: "sent" | "skipped" | "failed"; error?: string };

export async function sendMessage(req: MessageRequest): Promise<MessageResult>;
```

### Internal flow

1. Render the template body from `messaging-templates.ts` using `req.vars`.
2. Channel routing:
   - `sms` → `TWILIO_SMS_ENABLED !== "true"` → mark `skipped`, return.
   - `whatsapp` → `TWILIO_WHATSAPP_ENABLED !== "true"` → mark `skipped`, return.
   - `email` → skip with reason `use_existing_email_pipeline`. Phase 2 does NOT add a new email template path. The existing `notifyOrderPaid` (Phase 1) still fires from the webhook on paid orders; for pending orders the email channel results in no automated outreach (Maky follows up manually). This keeps Phase 2 focused — a pending-email template can land later if needed.
3. `TWILIO_DRY_RUN === "true"` → log to stdout, mark `sent` with `provider_sid: "dry_run_<ulid>"`, return.
4. Insert `messages` row with `status: "queued"`.
5. Call provider (`twilio-server.sendSms`, `twilio-server.sendWhatsApp`, or `order-notifications.sendEmail`).
6. Update row to `sent` with `provider_sid`, or `failed` with error.
7. Never throw. Failure does NOT break the order pipeline.

### Twilio wrapper

```ts
// lib/twilio-server.ts
import "server-only";
import twilio from "twilio";

let client: twilio.Twilio | null = null;
function getClient(): twilio.Twilio | null {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  client = twilio(sid, token);
  return client;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const c = getClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("twilio_from_missing");
  const msg = await c.messages.create({ to: e164(to), from, body });
  return { sid: msg.sid };
}

export async function sendWhatsApp(
  to: string,
  contentSid: string,
  vars: Record<string, string>,
): Promise<{ sid: string }> {
  const c = getClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = process.env.TWILIO_WHATSAPP_FROM;  // "whatsapp:+1..."
  if (!from) throw new Error("twilio_whatsapp_from_missing");
  const msg = await c.messages.create({
    to: `whatsapp:${e164(to)}`,
    from,
    contentSid,
    contentVariables: JSON.stringify(vars),
  });
  return { sid: msg.sid };
}

export function e164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}
```

### WhatsApp template mapping

Twilio's `contentSid` is the ID Meta returns after approving a template, surfaced through Twilio. We resolve the right SID for `(template, locale)` via env vars:

```
TWILIO_TEMPLATE_ORDER_RECEIVED_EN=HX...
TWILIO_TEMPLATE_ORDER_RECEIVED_ES=HX...
TWILIO_TEMPLATE_PAYMENT_LINK_EN=HX...
TWILIO_TEMPLATE_PAYMENT_LINK_ES=HX...
TWILIO_TEMPLATE_PAYMENT_CONFIRMED_EN=HX...
TWILIO_TEMPLATE_PAYMENT_CONFIRMED_ES=HX...
```

If a SID is missing for a `(template, locale)` pair we try to send, log `skipped: missing_whatsapp_template` and return — never crash.

## Message templates (exact copy)

These are the strings shipped in `lib/messaging-templates.ts` AND the exact body Maky submits to Meta via Twilio Content. Variables marked `{name}` in code map to numbered slots `{{1}}`, `{{2}}`, … in the Meta template.

### `order_received`

**EN** — `{{1}} = recipient_name`, `{{2}} = total`, `{{3}} = window`, `{{4}} = shop_phone`
> Hi {{1}}, Diva Flowers got your order. Total {{2}}. Delivery {{3}}. Thanks! — Maky · {{4}}

**ES**
> Hola {{1}}, Diva Flowers recibió tu pedido. Total {{2}}. Entrega {{3}}. ¡Gracias! — Maky · {{4}}

### `payment_link`

**EN** — `{{1}} = recipient_name`, `{{2}} = total`, `{{3}} = link`
> Hi {{1}}, your Diva Flowers order is reserved. Total {{2}}. Pay here: {{3}}. Delivery confirmed once paid. — Maky

**ES**
> Hola {{1}}, tu pedido en Diva Flowers está reservado. Total {{2}}. Paga aquí: {{3}}. Confirmamos la entrega al recibir el pago. — Maky

### `payment_confirmed`

**EN** — `{{1}} = recipient_name`, `{{2}} = window`
> Thanks {{1}}! Payment received. We're prepping your arrangement now. Delivery {{2}}. — Maky

**ES**
> ¡Gracias {{1}}! Recibimos tu pago. Estamos preparando tu arreglo. Entrega {{2}}. — Maky

### Constraints

- All EN bodies under 160 chars after variable substitution to avoid SMS concatenation charges.
- No emojis (avoids glyph rendering issues on older carriers; matches the brand's restrained voice).
- Sender identification + opt-out: Twilio appends "Reply STOP to unsubscribe" automatically on transactional messages — no code from us.
- Window rendering helper produces `Sat May 17 · afternoon (12–4 pm)` for `en`, `sáb 17 may · tarde (12–4 pm)` for `es`.
- Total rendering: `$205.51` (USD only).

## UX changes

### `ChannelPicker` component

New 4-chip single-select control, slotted into `CustomerBlock` below the email input:

```
[ SMS ]  [ WhatsApp ]  [ Solo email ]  [ Ninguno ]
```

- Default to `sms` for new customers
- Auto-fill the recurring-customer's saved channel
- "Solo email" disabled (grey) when no email is on the customer
- Changing the chip updates the customer record on next save — Maky's choice is sticky

### Locale override

A small inline toggle next to the picker, only shown when the inferred locale and the customer's phone-country-code disagree (e.g., form locale `en` but phone `+52...`):

```
Mensajes en: [ EN ] [ ES ]
```

Defaults to the customer's stored `locale`, falling back to the active form locale.

### Status banner after save

The intake page is reloaded with `?ok=do_...` after a successful submit. The banner shows the dispatch status:

> ✓ Order do_abc saved · Ticket queued · Payment pending → SMS sent to 516-555-0142

Failure case:

> ⚠ Order do_abc saved · SMS to 516-555-0142 failed (`network_error`) — [Retry]

The retry button POSTs `/api/admin/orders/[id]/payment-link` which regenerates and resends.

When the channel is gated by a flag and skipped:

> ✓ Order do_abc saved · SMS not configured (TWILIO_SMS_ENABLED off)

### What does NOT change

- Product picker, cart, totals, payment chips — untouched
- The "Stripe" payment chip — still represents *manually* generated links from Stripe dashboard. The new auto-link flow only fires when payment is **Pending**, not when "Stripe" is selected as a method.

## Testing

### Unit
- `messaging.ts`: template render with vars; skip path when flag off; skip path when WhatsApp SID missing; audit row inserted with correct status; provider error caught and recorded
- `messaging-templates.ts`: every `(template × locale)` pair returns a string with all required vars substituted; SMS bodies < 160 chars after substitution
- `twilio-server.ts`: `e164()` for 10-digit, 11-digit, already-formatted, dashes/parens; `getClient()` returns null without credentials
- `stripe-payment-link.ts`: `createCheckoutSession()` includes `metadata.orderId`, correct `expires_at`, correct `success_url` per locale
- `customer-storage.ts`: `messagingChannel` and `locale` round-trip; upsert preserves preferences across orders
- `api/admin/orders/[id]/payment-link/route.ts`: 200 returns new session URL; 404 on missing order; 401 without admin cookie
- `api/stripe/webhook/route.ts` extended: `checkout.session.completed` updates order + sends `payment_confirmed`; idempotent re-delivery

### Component
- `ChannelPicker`: chip selection, "email" disabled without email, value reflects customer record on mount

### E2E
None added. Twilio is async + paid; testing via mocks. Existing E2E suite remains green.

### Dev affordance
- `TWILIO_DRY_RUN=true` writes the rendered body to stdout instead of calling Twilio. Tests use this implicitly via `:memory:` SQLite.

## Risks and mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Twilio account suspension for unsolicited messages | Only outbound to customers who initiated contact (walk-in / phone / WhatsApp message). UTILITY category for WhatsApp. |
| Stripe link replay attacks | Sessions expire in 24h; metadata-bound to one orderId; cancel_url back to admin. |
| Webhook spoofing | Existing Stripe signature verification covers `checkout.session.completed` automatically. |
| Sending the same `payment_confirmed` twice | Idempotency check on `messages` table before send. |
| Phone number formatting drift (US prefix assumed) | `e164()` only special-cases 10-digit US; international numbers passed through with `+` if user-typed. |
| WhatsApp template ID drift after Meta re-approval | `TWILIO_TEMPLATE_*` env vars; rotation requires a redeploy of env, not code. |
| Cost overruns from accidental loops | Audit log limits same-template-same-order to once-per-24h on the controller side. |

## Environment variables

New required env vars (production):
- `TWILIO_ACCOUNT_SID` — from Twilio console
- `TWILIO_AUTH_TOKEN` — from Twilio console
- `TWILIO_PHONE_NUMBER` — your Twilio US number, format `+15165550000`
- `TWILIO_WHATSAPP_FROM` — your approved WhatsApp sender, format `whatsapp:+15165550000`
- `TWILIO_SMS_ENABLED=true` — gate
- `TWILIO_WHATSAPP_ENABLED=true` — gate (start `false`)
- `TWILIO_TEMPLATE_ORDER_RECEIVED_EN`, `..._ES`, `_PAYMENT_LINK_EN`, `..._ES`, `_PAYMENT_CONFIRMED_EN`, `..._ES` — six Twilio Content SIDs
- `SITE_URL` — already used elsewhere; needed for the Stripe success_url

Dev-only:
- `TWILIO_DRY_RUN=true` — log instead of send

## Open questions

None at design time. New decisions during implementation get logged in the plan.

## Definition of done

- A pending intake order in dev with `TWILIO_DRY_RUN=true` logs the rendered SMS body to stdout and creates a `messages` row with `status: sent`
- A pending intake order in dev with `TWILIO_SMS_ENABLED=false` creates a `messages` row with `status: skipped`
- The Stripe Checkout link in the SMS body resolves to a working Stripe-hosted payment page in test mode
- Paying that test session triggers the webhook locally (via Stripe CLI) and the `payment_confirmed` message is dispatched (visible in the `messages` table)
- All Phase 1 unit + E2E tests still pass
- The 6 WhatsApp templates are written into the spec in their final form, ready to copy-paste into Meta Business Suite when Maky's account is provisioned
