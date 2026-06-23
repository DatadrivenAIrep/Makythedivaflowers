# Gift Cards Program — Design Spec

**Date:** 2026-06-22
**Status:** Draft
**Scope:** Phase 1 — store-issued (free/courtesy) gift cards, emailed to a recipient, redeemable at checkout (web + intake). Foundation is built so Phase 2 (customer **buys** a gift card via Stripe) drops on top without rework.

## Problem

The shop wants to hand out gift cards as courtesies (loyalty, apology, prize, marketing) and have them behave like real stored value: issued from the dashboard, delivered by email, and applied at purchase time on both the website and the iPad intake. None of this exists today — there is no discount/credit concept anywhere in the order/totals model.

## Goals

- Issue a gift card from a new **Admin → Gift Cards** section. Phase 1 ships a single fixed denomination: **$150**.
- Deliver the card to a recipient by **email** (Resend, already wired), styled on-brand ("romantic/hero" direction).
- Redeem by **code** at checkout (guest checkout has no accounts, so a typed code is the mechanism). Works identically on web and intake.
- **Stored-value** semantics: balance draws down across multiple orders until $0.
- Tax is charged on the full order; the gift card acts as **tender** (reduces the amount charged), not a discount on the taxable subtotal.
- Manage cards from the dashboard: list, balance, status, redemption history, resend email, copy code, void.
- Keep the data model and redemption path **origin-agnostic** so Phase 2 selling reuses all of it.

## Non-Goals (Phase 1)

- **No selling** gift cards (no "buy a gift card" product on web/intake; no Stripe purchase of cards). That is Phase 2.
- **No variable amounts.** $150 only. The issue form shows $100/$200/Other as visibly disabled presets so the wiring is obvious, but only $150 is selectable.
- No physical cards, barcodes, balance reload, multi-currency, or customer-facing "check my balance" page.
- No customer accounts/auth (the site has none).

## Decisions (locked during brainstorming)

1. **Origin:** store issues for free now; sellable later on the same foundation.
2. **Balance:** stored value that draws down (not single-use). Order < balance → leftover stays. Order > balance → card covers up to balance, customer pays the rest.
3. **Tax/tender:** tax on full price; gift card reduces the amount charged.
4. **Delivery:** email by default. Code is always visible/copyable in the admin detail, covering "give it by WhatsApp / print" without a separate flow.
5. **Code:** `DIVA-XXXX-XXXX`, unambiguous alphabet, unique.
6. **Expiration:** 1 year from issuance for courtesy cards, disclosed in the email. (Phase 2 sold cards will use NY's long-validity rule — handled then.)
7. **Void:** allowed from admin; the row is retained (auditable), not deleted.
8. **Refund/cancel:** restores the gift card balance via a `refund` ledger movement.
9. **Email design:** "romantic/hero" (rouge gradient header, large `$150`, code block, redeem CTA).

## Model

A **gift card** is a stored-value account identified by a code. Its `balance_cents` is the source of truth on the row; a **redemptions ledger** records every debit (`redeem`) and credit (`refund`) for audit and for the detail view's history. Balance and ledger are always mutated together inside a single transaction.

### Statuses (derived for display)

| Display | Condition |
|---|---|
| Activa | `status='active'`, `balance_cents = initial_cents`, not expired |
| Usada parcial | `status='active'`, `0 < balance_cents < initial_cents`, not expired |
| Agotada | `status='active'`, `balance_cents = 0` |
| Vencida | `status='active'`, `expires_at < now`, `balance_cents > 0` |
| Anulada | `status='void'` |

Only `active` + not-expired + `balance_cents > 0` cards are redeemable.

## Architecture

### Migration

`db/migrations/009_gift_cards.sql` (next in sequence after `008`):

```sql
CREATE TABLE IF NOT EXISTS gift_cards (
  id               TEXT PRIMARY KEY,            -- gc_<base36ts>_<rand>
  code             TEXT NOT NULL UNIQUE,        -- canonical form WITH dashes, uppercase: e.g. DIVA-7K2M-9XQ4
  initial_cents    INTEGER NOT NULL CHECK(initial_cents > 0),
  balance_cents    INTEGER NOT NULL CHECK(balance_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'void'
  recipient_email  TEXT NOT NULL,
  recipient_name   TEXT,
  from_label       TEXT,                         -- "De parte de"
  personal_message TEXT,
  reason           TEXT,                         -- internal: loyalty | apology | prize | marketing | other
  issued_by        TEXT,                         -- admin operator (from session), best-effort
  expires_at       TEXT,                         -- ISO; issuance + 1 year
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id            TEXT PRIMARY KEY,               -- gcr_<...>
  gift_card_id  TEXT NOT NULL REFERENCES gift_cards(id),
  order_id      TEXT,                            -- the order it applied to (nullable for adjustments)
  amount_cents  INTEGER NOT NULL,               -- positive = debit (redeem), negative = credit (refund)
  type          TEXT NOT NULL,                   -- 'redeem' | 'refund'
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gcr_card ON gift_card_redemptions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gcr_order ON gift_card_redemptions(order_id);

ALTER TABLE orders ADD COLUMN gift_card_id TEXT;
ALTER TABLE orders ADD COLUMN gift_card_cents INTEGER;   -- amount the card covered on this order
```

The migration runner (`lib/db-migrate.ts`) picks this up automatically (alphabetical, wrapped in a transaction).

### Types

`types/order.ts`:
- Add `"gift-card"` to `PaymentMethod`.
- Add to `Order`: `giftCardId?: string;` and `giftCardCents?: number;` (amount the card covered).
- `OrderTotals` is **unchanged** — subtotal/delivery/tax/total always describe the full order. Amount charged via Stripe = `totalCents - (giftCardCents ?? 0)`.

`types/gift-card.ts` (new): `GiftCard`, `GiftCardStatus`, `GiftCardReason`, `GiftCardRedemption`, and a `GiftCardPublic` (the safe shape returned to the checkout UI: `{ code, balanceCents, expiresAt }` — never internal notes/recipient).

### Code generation

`lib/gift-card-code.ts` (new): `generateGiftCardCode()` → `DIVA-XXXX-XXXX` using alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no `0/O/1/I/L`). `normalizeCode(input)` uppercases, strips spaces, and re-inserts dashes so customers can type `diva 7k2m 9xq4`. Uniqueness enforced by the `UNIQUE` constraint with a small retry loop on collision.

### Storage layer

`lib/gift-card-storage.ts` (new), mirroring `lib/order-storage.ts` patterns (synchronous `node:sqlite`, same db handle from `lib/db.ts`):

- `issueGiftCard(input): GiftCard` — generate id+code, set `balance = initial`, `expires_at = now + 1yr`, insert, return row.
- `getGiftCardByCode(code): GiftCard | null` — normalized lookup.
- `validateForRedemption(code, wantCents): { ok, card?, applicableCents?, reason? }` — checks active, not expired, balance > 0; `applicableCents = min(balance, wantCents)`.
- `redeem(cardId, orderId, amountCents): void` — **transactional**: re-read balance `FOR`-style guard (SQLite: `BEGIN IMMEDIATE`), assert still active/unexpired and `balance >= amountCents`, `balance -= amountCents`, write `redeem` ledger row, bump `updated_at`. Throws on insufficient/again-expired (caller handles).
- `refund(cardId, orderId, amountCents): void` — transactional credit: `balance += amountCents` (capped at `initial_cents`), write `refund` ledger row.
- `voidGiftCard(cardId): void` — set `status='void'`.
- `listGiftCards(filters): { cards, totals }` — list + aggregate stats (count active, sum pending balance = liability, sum issued, sum redeemed).
- `getGiftCardWithHistory(id): { card, redemptions }`.

**Concurrency:** all balance mutations use `BEGIN IMMEDIATE` so two simultaneous redemptions of the same card serialize; the second re-reads the lowered balance and either applies the remainder or fails cleanly. Double-spend is impossible.

### When the balance is actually debited (important)

Redemption is **committed only when the order is paid**, never at intent/abandon time, so abandoned carts don't strand balance:

- **Web, partial coverage (amount to charge > 0):** `/api/checkout/intent` validates the code, computes `applicableCents`, stores `giftCardId`/`giftCardCents` on the order, and creates the Stripe PaymentIntent for `totalCents - applicableCents` (gift card id/amount also in PI metadata). The **debit happens in the Stripe webhook** (`payment_intent.succeeded`) inside `redeem(...)`, re-validating balance. If the card is somehow insufficient by then (extremely rare for single-shop comps), log + alert via the existing print/notify failure channel; the order still stands (customer paid the Stripe portion).
- **Web, full coverage (amount to charge = $0):** Stripe cannot create a $0 PaymentIntent. The intent route, after `saveOrder`, performs `redeem(...)` immediately in a transaction, marks the order `paymentStatus='paid'`, `paymentMethod='gift-card'`, `paidAt=now`, enqueues print + confirmation like a paid order, and returns `{ paid: true, orderId }` (no `clientSecret`). The client skips the Stripe step and routes to confirmation.
- **Intake:** when the staff marks the order **paid** (cash/zelle/etc.) the debit runs at order-creation; when a Stripe payment link is generated for the remainder, the debit runs on that link's success (same webhook path). Full coverage in intake marks the order paid by gift card immediately.

### Web checkout — redemption UI & API

- `app/api/checkout/intent/route.ts` (modify): `requestSchema` gains optional `giftCardCode`. After computing `totals`, validate the code server-side (never trust the client for the applied amount), compute `applicableCents`, branch into partial vs full-coverage as above. Add `gift_card_*` to the order. Return either `{ clientSecret, orderId }` or `{ paid: true, orderId }`.
- `app/api/checkout/gift-card/route.ts` (new, GET/POST): lightweight **preview** validation for the UI — given a code, return `GiftCardPublic` or a localized error (`invalid` / `expired` / `empty`). Authoritative application still happens in the intent route.
- `components/checkout/GiftCardField.tsx` (new): "¿Tienes una gift card?" input + Aplicar/Quitar. On apply, calls the preview endpoint, shows the applied chip and the recomputed "A pagar". Holds the validated code in checkout state.
- `components/checkout/CheckoutShell.tsx` (modify): thread `giftCardCode` into the intent request; recompute the displayed payable as `total - applied`; when the intent response is `{ paid: true }`, skip `StripePaymentStep` and go straight to the confirmation route.
- `components/checkout/StripePaymentStep.tsx` / summary (modify): render the gift card line (`Gift card −$X.XX`) and the reduced "A pagar".

### Intake — redemption

- `schemas/intake.ts` (modify): add optional `giftCardCode`.
- `app/api/admin/orders/route.ts` (modify): validate + apply the same way; debit at the point the order becomes paid (immediate for cash/zelle; on link success otherwise). Store `gift_card_*` on the order.
- `components/admin/intake/IntakeForm.tsx` (modify): add a gift card field to the totals area, showing applied amount and remaining payable.

### Email

`lib/gift-card-notifications.ts` (new), reusing the Resend client + inline-HTML approach of `lib/order-notifications.ts`:
- `notifyGiftCardIssued(card: GiftCard)` — sends to `card.recipient_email`, `from` = `ORDER_NOTIFICATIONS_FROM`. Subject e.g. `Tienes una gift card de Diva Flowers 💐`.
- Template = **direction B**: rouge gradient header, `maky · diva flowers` wordmark, recipient name, large `$150`, personal message + "de parte de", a dark code block (`DIVA-XXXX-XXXX`), a "Canjear mi tarjeta" button linking to the shop, expiry date, and one-line instructions ("Escribe el código en el checkout, en la web o en la tienda"). Plain-text fallback included.
- Localized en/es (default es per the brand's primary market).

The **shop's** order-confirmation email (`lib/order-notifications.ts`) gains a gift-card line when `order.giftCardCents` is set, so the owner sees how much was tendered by card.

### Admin UI

- Route `app/[locale]/admin/gift-cards/page.tsx` (server) → list view; protected by the existing admin middleware (`proxy.ts`, `/admin/*`). Add a nav entry in the dashboard shell.
- `components/admin/gift-cards/GiftCardsView.tsx` (client): stats row (Activas, Saldo pendiente = liability, Emitido, Canjeado) + table (código, destinatario, `saldo / inicial`, estado badge, vence, motivo). "+ Emitir gift card" opens the issue form.
- `components/admin/gift-cards/IssueGiftCardForm.tsx` (client): the approved form (monto $150 fixed; recipient email required; name, from, message, reason optional). Submits to the issue API.
- Detail as a **drawer/panel** within the list view (no separate route): code (copy button), redemption history (order #, amount, date), **Reenviar email**, **Copiar código**, **Anular**. Data comes from the `[id]` detail API.
- API `app/api/admin/gift-cards/route.ts` (GET list+stats, POST issue → issues + sends email), `app/api/admin/gift-cards/[id]/route.ts` (GET detail+history), `.../[id]/void` (POST), `.../[id]/resend` (POST). All under the admin-auth middleware.
- `schemas/gift-card.ts` (new): `issueGiftCardSchema` (zod) — amount restricted to `15000` in Phase 1; `recipientEmail` required/email; rest optional with sane max lengths.

### Refund / cancel restoration

`app/api/admin/orders/[id]/cancel/route.ts` (modify) and any refund path: when canceling/refunding an order that has `giftCardId` + `giftCardCents`, call `refund(giftCardId, orderId, giftCardCents)` to credit the balance back (a `refund` ledger row; status stays/returns `active`). Idempotent — guard against double-refund by checking for an existing `refund` row for that order.

## Error Handling

- **Invalid/expired/empty code at checkout:** preview endpoint returns a localized error; the field shows it inline and applies nothing. The intent route re-validates and rejects (`gift_card_invalid`) if the client somehow sends a bad/again-changed code, so the price can never be tampered with.
- **Race / insufficient at commit:** `redeem()` throws; full-coverage path returns a localized "gift card no longer valid" so the customer can retry/pay normally; webhook path logs + alerts (order already paid the Stripe portion).
- **$0 PaymentIntent:** never created — full-coverage path bypasses Stripe entirely.
- **Code collision on issue:** retry generation; surfaced only if it fails repeatedly (effectively never).
- **Email send failure on issue:** the card is still created and visible in admin (code copyable); the API returns a soft warning so staff can hit **Reenviar email**. Issuance is not rolled back by a mail failure.
- **Double void / double refund:** guarded (status check / existing-refund-row check) — both idempotent.

## Testing

- `tests/unit/gift-card-code.test.ts` — format, unambiguous alphabet, `normalizeCode` round-trips messy input, uniqueness retry.
- `tests/unit/gift-card-storage.test.ts` — issue sets balance+expiry; `validateForRedemption` (active/expired/empty/void); `redeem` partial draws down and writes ledger; over-balance redemption caps at balance; **double-spend** under serialized transactions leaves balance ≥ 0 and consistent with ledger; `refund` credits back and is idempotent; `void` blocks redemption.
- `tests/unit/totals-gift-card.test.ts` — amount charged = `total - applied`; full coverage → $0/skip-Stripe; tax computed on full subtotal (unchanged).
- `tests/unit/checkout-intent-gift-card.test.ts` — intent applies code, sets PI amount, stores `gift_card_*`; full-coverage returns `{ paid: true }` and marks order paid by gift card; bad code rejected server-side.
- `tests/unit/gift-card-notifications.test.ts` — issue sends to recipient with code, amount, expiry; missing config skips gracefully (mirrors existing notification test).
- `tests/unit/IssueGiftCardForm.test.tsx` — renders fields, $150 fixed, validates required email, posts correct payload, shows success with code.
- `tests/unit/GiftCardsView.test.tsx` — renders stats + rows, status badges map correctly, void action calls API.
- `tests/e2e/gift-card.spec.ts` (optional, if e2e infra is in play) — issue → email code → redeem partial on web → second redeem consumes remainder → balance shows agotada.

## Out of scope (future / Phase 2)

- Selling gift cards via Stripe (web + intake "buy a gift card" product), which on payment issues + emails a card using this exact foundation.
- Variable denominations ($100/$200/custom).
- NY long-validity (~9yr) handling for **purchased** cards, no-expiry option, dormancy rules.
- Customer "check my balance" page, balance reload, physical/barcode cards, multi-currency.
- Accounting export of the outstanding-liability figure.

> ⚖️ Worth a quick check with the shop's accountant on how the outstanding balance (liability) and the 1-year courtesy expiry are booked. 1 year for free courtesy cards is a safe default; this spec does not constitute legal/tax advice.

## Files touched

**New:**
- `db/migrations/009_gift_cards.sql`
- `types/gift-card.ts`
- `lib/gift-card-code.ts`
- `lib/gift-card-storage.ts`
- `lib/gift-card-notifications.ts`
- `schemas/gift-card.ts`
- `app/api/admin/gift-cards/route.ts`
- `app/api/admin/gift-cards/[id]/route.ts`
- `app/api/admin/gift-cards/[id]/void/route.ts`
- `app/api/admin/gift-cards/[id]/resend/route.ts`
- `app/api/checkout/gift-card/route.ts`
- `app/[locale]/admin/gift-cards/page.tsx`
- `components/admin/gift-cards/GiftCardsView.tsx`
- `components/admin/gift-cards/IssueGiftCardForm.tsx`
- `components/admin/gift-cards/GiftCardDetail.tsx`
- `components/checkout/GiftCardField.tsx`
- `tests/unit/gift-card-code.test.ts`
- `tests/unit/gift-card-storage.test.ts`
- `tests/unit/totals-gift-card.test.ts`
- `tests/unit/checkout-intent-gift-card.test.ts`
- `tests/unit/gift-card-notifications.test.ts`
- `tests/unit/IssueGiftCardForm.test.tsx`
- `tests/unit/GiftCardsView.test.tsx`

**Modified:**
- `types/order.ts` — `gift-card` payment method; `giftCardId`/`giftCardCents` on `Order`
- `lib/order-storage.ts` — persist/read `gift_card_id`, `gift_card_cents`
- `app/api/checkout/intent/route.ts` — validate/apply code, partial vs full-coverage branch
- `components/checkout/CheckoutShell.tsx` — thread code, reduced payable, `{ paid: true }` skip-Stripe path
- `components/checkout/StripePaymentStep.tsx` (or the summary component) — gift card line + reduced total
- `app/api/stripe/webhook/route.ts` — commit `redeem()` on `payment_intent.succeeded` when the order carries a gift card
- `schemas/intake.ts` — optional `giftCardCode`
- `app/api/admin/orders/route.ts` — apply/debit in intake
- `components/admin/intake/IntakeForm.tsx` — gift card field
- `app/api/admin/orders/[id]/cancel/route.ts` (and refund path) — restore balance via `refund()`
- `lib/order-notifications.ts` — show gift card line on the shop confirmation email
- the admin dashboard shell/nav — add "Gift Cards" entry
- `messages/en.json`, `messages/es.json` — `giftCard` namespace (checkout field, email copy, admin labels)
