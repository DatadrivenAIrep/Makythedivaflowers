# Cierre del día — design

**Date:** 2026-10-16 · **Status:** approved in chat (approach A, parts 1 and 2), pending spec review
**Roadmap:** Dashboard actions #4 (see memory `dashboard-actions-roadmap`)

## Goal

At closing time Maky counts the cash drawer and checks Zelle / terminal / ACH / Stripe against what the
panel says came in that day. The screen says how much cash *should* be in the drawer, takes the counted
amount, shows the difference, and saves the close so there is a history of differences.

Out of scope: the sales-tax filing report (later; it will read the same payment log), multi-register,
multi-user drawers, reconstructing days before launch.

## Why a payment log

Today an order only stores the outcome: `amount_paid_cents`, the *last* `payment_method`, `paid_at`. A
Zelle deposit on Monday followed by a cash balance on Wednesday leaves the order "paid in cash"; the
Zelle survives only as free text in `internal_notes` / `order_changes.summary`. A cash-up built on that
cannot balance. House accounts already have a proper ledger (`house_account_entries`); orders do not.

Chosen approach (A): every place that records money also writes one row to a new `payments` table,
**in the same SQLite transaction** as the order update. Rejected: (B) parsing history text — breaks
on any copy change; (C) order fields only — wrong for split payments.

## Part 1 — `payments` table

Migration `db/migrations/040_payments.sql` (idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF
NOT EXISTS` — `next build` runs migrations from parallel workers, see memory `migrations-concurrency`).

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | `pay_<base36 time>_<rand>` |
| `at` | TEXT NOT NULL | ISO UTC instant the money was recorded |
| `day` | TEXT NOT NULL | shop-local `YYYY-MM-DD` of `at` (America/New_York), via `shopDateStr` |
| `kind` | TEXT NOT NULL | `payment` · `deposit` · `balance` · `refund` · `gift_card_sale` |
| `method` | TEXT NOT NULL | `cash` · `zelle` · `card-terminal` · `ach` · `check` · `stripe` · `gift-card` · `unknown` |
| `amount_cents` | INTEGER NOT NULL | positive in; **negative for refunds** |
| `order_id` | TEXT NULL | order it pays, if any |
| `house_account_id` | TEXT NULL | account it pays, if any |
| `gift_card_id` | TEXT NULL | card sold (`gift_card_sale`) or redeemed (`method = gift-card`) |
| `source` | TEXT NOT NULL | writer: `intake` · `mark_paid` · `deposit` · `settle` · `stripe_intent` · `stripe_checkout` · `house_account` · `house_account_stripe` · `gift_card_admin` · `gift_card_stripe` · `cancel_refund` |
| `actor` | TEXT NOT NULL | `maky` / `stripe` / `system` (same convention as `order_changes.actor`) |
| `note` | TEXT NULL | |

Indexes: `(day, method)`, `(order_id)`.

`gift-card` money is a redemption of value sold earlier, not cash in hand: the close lists it apart and
never adds it to "cobrado". The card's *sale* is the money event (`gift_card_sale`, with its method).

### Writers (each one: same transaction as the existing update, plus a unit test)

1. **Intake creation** (`app/api/admin/orders/route.ts`): paid at creation → `payment` for the total
   with the chosen method; pending with deposit → `deposit` for the deposit; house account → nothing
   (money arrives through the account). Gift card applied at intake → `payment`, `method gift-card`,
   for `gift_card_cents`.
2. **Mark paid** (`markPaidManual`): `payment` for the **remaining** balance (`total − already paid`),
   not the full total, so a prior deposit is not counted twice. No row when it returns early (already paid).
3. **Deposit** (`recordDeposit`): `deposit` for the amount and method.
4. **Settle balance** (`settleBalance`): `balance` for the remainder. It gains an optional `method`
   (API body `{ settleBalance: true, method? }`); the drawer's "Saldar" and the Por cobrar section ask
   for it. Missing method → `unknown` (shown as "Sin método" in the close, so it is visible, not lost).
5. **Stripe** (`lib/order-storage.ts` payment-intent and checkout-session paths): `payment`,
   `method stripe`, for the amount newly marked paid. Idempotent with the existing guards (`payment_status
   != 'paid'`): the row is written only when the UPDATE changed a row. A web checkout that also used a
   gift card writes a second row, `method gift-card`, for `gift_card_cents`, in the same transaction.
6. **House-account payments** (`recordPayment`, `recordStripeStatementPayment` in
   `lib/house-account-ledger.ts`): one `payment` row with `house_account_id`, the entry's method and
   amount (the order allocations stay in the account ledger; the close needs the money once).
7. **Gift cards**: Stripe purchase (`issueGiftCardForPayment`) → `gift_card_sale`, `method stripe`.
   Admin issue with reason `purchase` → the issue form asks the method (cash / zelle / terminal / ach);
   `gift_card_sale` with it. Other reasons (loyalty, apology, prize…) → no row: no money moved.
8. **Refund on cancel** (`cancelOrder` with `refund: true`): `refund`, negative amount paid, method =
   the order's `payment_method` (money goes back the way it came; `unknown` if none). Staff still move
   the money by hand, as today.

A single helper `recordPaymentRow(db, row)` in `lib/payments-storage.ts` does the insert; writers call
it inside their existing `db.transaction`. Writers that are currently not transactional are wrapped.

## Part 2 — "Cierre" screen

Route `/[locale]/admin/dashboard/cierre`, new nav link "Cierre" right after "Libro de órdenes" in
`DashboardShell`. Admin-gated like the rest (`proxy.ts` covers `/api/admin/*`; the page sits under the
admin layout).

Day picker: today (shop time) by default, ‹ › for previous/next days, `?day=YYYY-MM-DD`.

### 1. Cobrado del día

One card per method with its total and an expandable list (hora, orden #, cliente, tipo, monto):
Efectivo, Zelle, Terminal, ACH, Cheque, Stripe (en línea), Sin método (only when non-zero). Total
cobrado = sum of those. "Tarjeta de regalo usada" shown apart, muted, not in the total. Each non-cash
method has a "Revisado ✓" checkbox, saved with the close.

### 2. Cuadre del efectivo

```
  Fondo inicial            (prefilled: previous close's "fondo que se deja"; else $0; editable)
+ Efectivo cobrado         (auto: cash rows of the day, kind ≠ refund)
− Reembolsos en efectivo   (auto: cash refund rows)
− Salidas de caja          (typed by Maky, with a note)
= Efectivo esperado
  Efectivo contado         (typed)
  Diferencia               (contado − esperado; green 0, red < 0 "faltan", amber > 0 "sobran")
  Fondo que se deja        (typed; default = fondo inicial)
  Nota
  [Guardar cierre]
```

### 3. Saving

Table `cash_closes` (same migration): `day` TEXT PK, `opening_float_cents`, `cash_in_cents`,
`cash_refunds_cents`, `cash_out_cents`, `cash_out_note`, `expected_cents`, `counted_cents`,
`difference_cents`, `float_left_cents`, `reviewed_json` (methods ticked), `totals_json` (per-method
snapshot at save time), `note`, `actor`, `created_at`, `updated_at`.

- One close per day; saving again overwrites it (keeps `created_at`, bumps `updated_at`).
- If payments for that day are recorded after the close (`payments.at > updated_at`), the screen warns:
  "Hubo cobros después del cierre: el esperado cambió en $X" (comparing live vs `totals_json`).
- API: `GET /api/admin/cash-close?day=` → `{ day, payments, summary, close | null, previousFloatCents }`;
  `PUT /api/admin/cash-close` with the typed fields → saved close. Server recomputes every derived
  number; it never trusts client totals.

### 4. Below

- **Venta del día** (informative): orders created that day (count), subtotal, tax, tips, delivery,
  discounts, and how much of them is still pending.
- **Historial**: last 30 closes — day, difference, who, when.

## Pure core

`lib/cash-close.ts` (no DB): `summarizeDay(payments)` → per-method totals, cash in, cash refunds,
gift-card redemptions, total; `expectedCash({ openingFloat, cashIn, cashRefunds, cashOut })`;
`difference(counted, expected)`; `paymentsAfterClose(payments, close)`. Storage in
`lib/payments-storage.ts` (insert + list by day) and `lib/cash-close-storage.ts` (get/put close,
previous float).

## Edge cases

- Day boundaries are shop-local (America/New_York), never UTC: a 9 PM payment belongs to that day.
- Edits that change an order's total create no payment row (no money moved); the balance shows in Por cobrar.
- Stripe retries: no duplicate rows (row written only when the paid UPDATE changed a row).
- Partial gift card + cash at intake → two rows (gift-card, cash).
- Opening float with no previous close → $0, editable.
- Days before launch: no rows → the screen says "Sin registro de cobros antes del {first day}", where
  the first day is `MIN(payments.day)` (no payments at all → "Todavía no hay cobros registrados").
- Money amounts are integer cents end to end; typed amounts ("$12.50", "12,50") are parsed the same way
  the intake deposit field parses them, and rejected if negative or not a number.

## Testing

- Unit (pure): `summarizeDay`, `expectedCash`, `difference`, after-close detection, day boundary at
  23:30 NY / 03:30 UTC.
- Writers: one test per writer against the test SQLite DB — a row with the right kind/method/amount,
  none on idempotent no-ops (already paid, Stripe retry), mark-paid after deposit records only the remainder.
- API: GET shape, PUT recomputes server-side and rejects bad input; admin-gated.
- Component: the cuadre math updates live; difference colors; "Guardar" sends the typed fields.
- Preview end-to-end (scratch DB, `TWILIO_DRY_RUN`): intake paid cash, deposit Zelle + settle cash, mark
  paid terminal, gift card applied, refund → the close shows each in the right card and the cuadre balances.

## Rollout

Migration ships with the code (builds run it). From that deploy on, every money event is logged; the
first useful close is the first full day after the deploy. No backfill.
