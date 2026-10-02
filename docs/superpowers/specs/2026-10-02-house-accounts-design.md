# House accounts (cuentas por cobrar) — design

**Date:** 2026-10-02
**Status:** approved in chat section by section, pending spec review

## Problem

Several organizations (restaurants, funeral homes, churches, offices) order
often and pay on a schedule instead of per order. Today the only way to model
that is a pile of `payment_status = 'pending'` intake orders that staff settle
one by one, that alarm the Bandeja as "unpaid", and that have no consolidated
document, no due date, no reminder and no record of who owes what.

## Goals

- A **house account** per organization, with a billing contact and the
  persons allowed to charge to it.
- Orders taken in the admin intake can be charged **to an account** instead
  of being paid.
- A **running ledger** per account (charges, payments, credits, adjustments)
  so the balance is always derivable and partial payments have a home.
- A **periodic statement** (weekly / biweekly / monthly) frozen at close with
  its own number, period, due date and an unguessable public link where the
  customer can view, print and **pay by Stripe**.
- A **send plan** per account (statement day, terms, reminder steps with a
  channel each) that feeds a **visible queue**; a daily cron executes only
  what is in the queue and due. Staff can send now, skip or reschedule.
- One-click sending by **SMS (Twilio)** with the short link, and by **email
  (Resend)** when the account has a billing email.
- Manual payment recording (cash, Zelle, ACH, check, card terminal) that is
  applied oldest-first to open statements and orders, so the existing
  per-order reports stay correct.

## Non-goals (this phase)

- No card on file / automatic charge (Stripe SetupIntent, off-session). The
  model leaves room for it (a `stripe_customer_id` column later).
- No charging to an account from the public web checkout.
- No credit limit, no late fees or interest.
- No server-side PDF; the public page prints to PDF from the browser, like
  the order invoice.
- No accounting export (QuickBooks, CSV).
- No Settings UI for the plan defaults (constants with an optional
  `settings` override).

## Decisions (locked during brainstorming)

1. Account holder = **organization with N linked contacts**, not a single
   customer. A person belongs to at most one account.
2. Billing model = **periodic statement with terms**, not per-order net terms.
3. Collection = **Stripe Checkout link on the statement + manual recording**.
4. Channels = SMS always available, email when the account has one; the
   owner chooses **when** and **by which channel** through the plan and the
   queue. Nothing is sent that is not in the queue.
5. Scheduling = **plan per account + visible queue**, executed by a cron.
6. Orders enter an account from the **admin intake only** (plus "move to
   account" on an existing pending order).
7. Ledger approach **A**: ledger entries are the source of truth; statements
   are immutable snapshots of the running balance; a statement is settled by
   every negative entry recorded after its close (recomputed from the
   ledger); payments and credits are allocated FIFO to open orders, updating
   `orders.amount_paid_cents`.

## Model

Migration `db/migrations/030_house_accounts.sql`. All money is integer cents,
timestamps ISO-8601 text, calendar dates `YYYY-MM-DD` in shop time
(`SHOP_TZ`), ids `<prefix>_<base36 ts>_<rand6>`.

### `house_accounts`

| column | type | notes |
|---|---|---|
| id | TEXT PK | `ha_…` |
| name | TEXT NOT NULL | commercial name shown on statements |
| billing_name | TEXT | person who receives statements |
| billing_phone | TEXT | digits only, like `customers.phone`; SMS target |
| billing_email | TEXT | email target; optional |
| locale | TEXT NOT NULL DEFAULT 'en' | language of statements and messages |
| cadence | TEXT NOT NULL DEFAULT 'monthly' | `weekly` / `biweekly` / `monthly` |
| issue_day | INTEGER NOT NULL DEFAULT 1 | monthly: day of month 1–28; weekly/biweekly: weekday 0–6 (Sunday = 0) |
| anchor_date | TEXT | biweekly only: first issue date; issues every 14 days from it |
| terms_days | INTEGER NOT NULL DEFAULT 15 | `due_date = issued date + terms_days` |
| reminder_plan_json | TEXT NOT NULL DEFAULT '[]' | `[{ "offsetDays": -3, "channel": "sms" }, …]` relative to `due_date` |
| statement_channel | TEXT NOT NULL DEFAULT 'sms' | `sms` / `email` / `both` for the statement send itself |
| status | TEXT NOT NULL DEFAULT 'active' | `active` / `paused` / `closed` |
| notes | TEXT | free text |
| created_at, updated_at | TEXT NOT NULL | |

### `house_account_contacts`

`(account_id, customer_id)` composite PK, `UNIQUE(customer_id)` so a person
belongs to one account. `customer_id` references `customers.id`. Used by the
intake to suggest the account when the phone is typed.

### `house_account_entries` (the ledger)

| column | type | notes |
|---|---|---|
| id | TEXT PK | `hae_…` |
| account_id | TEXT NOT NULL | FK `house_accounts` |
| kind | TEXT NOT NULL | `charge` / `payment` / `credit` / `adjustment` / `reversal` |
| amount_cents | INTEGER NOT NULL | signed: charge and positive adjustment > 0; payment, credit, reversal and negative adjustment < 0 |
| order_id | TEXT | charges, reversals and order adjustments point at the order |
| statement_id | TEXT | NULL = unbilled; set when a statement snapshots the entry |
| method | TEXT | payments only: `cash` / `zelle` / `ach` / `check` / `card-terminal` / `stripe` |
| stripe_session_id | TEXT UNIQUE | Stripe payments only; makes the webhook idempotent |
| note | TEXT | free text |
| actor | TEXT | who recorded it (`admin`, `stripe`, `system`) |
| created_at | TEXT NOT NULL | |

Index `(account_id, created_at)`, index `(order_id)`, index
`(account_id, statement_id)`.

**Balance** of an account = `SUM(amount_cents)` over its entries. Positive =
the customer owes; negative = credit in their favor.

### `house_account_statements`

| column | type | notes |
|---|---|---|
| id | TEXT PK | `hst_…` |
| account_id | TEXT NOT NULL | |
| number | TEXT NOT NULL UNIQUE | `ST-1001`, from single-row `statement_number_seq` seeded at 1000 (same pattern as `order_number_seq`) |
| code | TEXT NOT NULL UNIQUE | 8-char base62 for the public link |
| period_start, period_end | TEXT NOT NULL | `YYYY-MM-DD`; `UNIQUE(account_id, period_end)` |
| issued_at | TEXT NOT NULL | ISO |
| due_date | TEXT NOT NULL | `YYYY-MM-DD` |
| opening_cents | INTEGER NOT NULL | previous statement's `closing_cents`, else 0 |
| charges_cents | INTEGER NOT NULL | sum of positive entries snapshotted |
| credits_cents | INTEGER NOT NULL | sum of negative non-payment entries snapshotted (as a positive number) |
| payments_cents | INTEGER NOT NULL | sum of payment entries snapshotted (as a positive number) |
| closing_cents | INTEGER NOT NULL | `opening + charges − credits − payments` = account balance at `period_end` |
| settled_cents | INTEGER NOT NULL DEFAULT 0 | `min(closing, Σ|negative entries not captured by this statement's snapshot (unbilled or billed on a later statement)|)`, recomputed from the ledger after every entry |
| status | TEXT NOT NULL | `open` / `paid` / `void` |
| lines_json | TEXT NOT NULL | snapshot of the orders and other entries listed (see Statement content) |
| created_at | TEXT NOT NULL | |

### `house_account_sends` (queue and log in one table)

| column | type | notes |
|---|---|---|
| id | TEXT PK | `hsd_…` |
| account_id | TEXT NOT NULL | |
| statement_id | TEXT NOT NULL | |
| kind | TEXT NOT NULL | `statement` / `reminder` / `manual` |
| step_index | INTEGER | position in `reminder_plan_json` for reminders |
| channel | TEXT NOT NULL | `sms` / `email` / `both` (as requested) |
| scheduled_for | TEXT NOT NULL | `YYYY-MM-DD` |
| status | TEXT NOT NULL | `scheduled` / `sent` / `skipped` / `failed` / `canceled` |
| sent_at | TEXT | |
| sms_sid, email_id | TEXT | provider ids per channel actually used |
| body | TEXT | rendered SMS body (for the inbox) |
| error | TEXT | failure or skip reason, shown in the queue |
| created_at | TEXT NOT NULL | |

Index `(status, scheduled_for)`, index `(statement_id)`.

### Changes to existing tables and types

- `orders`: `ALTER TABLE orders ADD COLUMN house_account_id TEXT` + index.
  (Non-idempotent ALTER is fine: the migration runner serializes files.)
- `types/order.ts`: `PaymentMethod` gains `"house-account"`; `Order` gains
  `houseAccountId?: string`; `OrderChangeKind` gains `"house_account"`.
- `lib/order-row.ts`: map the new column both ways.
- An order charged to an account has `payment_status = 'pending'`,
  `payment_method = 'house-account'`, `house_account_id` set. It becomes
  `paid` only through ledger allocation (never through `markPaidManual`).

## Ledger rules

- **Charge** on creation of an account order: `+total_cents`, `order_id`.
  If the order already carries a deposit (`amount_paid_cents > 0`), the
  charge is `+(total − amount_paid)`; a "move to account" charge is likewise
  the remaining balance.
- **Order edit** that changes `total_cents` on an account order inserts an
  `adjustment` for the delta (signed), `order_id` set. The original charge is
  never mutated, billed or not.
- **Cancel** of an account order inserts a `reversal` of
  `−(charge + adjustments for that order)` once (guarded by "no reversal
  exists for this order"). Money already allocated to that order stays on the
  account as credit (the balance goes negative by that amount) and shows as
  "saldo a favor" on the next statement.
- **Payment** (`−amount`) and **credit** (`−amount`, staff, note required):
  recorded at account level, then, in the same transaction, allocated to
  **open account orders** (`house_account_id = account`, `payment_status =
  'pending'`, not canceled) oldest `created_at` first: `amount_paid_cents +=
  min(remaining, total − amount_paid)`. An order that reaches its total
  becomes `payment_status = 'paid'`, `paid_at = now`, keeps `payment_method =
  'house-account'`, and gets an `order_changes` row of kind `payment` with
  the entry id. No per-order SMS is sent. Any remainder simply stays in the
  balance (it covers unbilled charges or becomes credit). The pure function
  `allocate(targets, amount)` does the arithmetic. (Credits inflate
  `amount_paid_cents` and therefore LTV by their amount; accepted.)
- **Adjustment** (signed, staff with a required note, or the order-edit
  delta): never allocates to orders. After an order-edit adjustment, the
  order is marked `paid` if its `amount_paid_cents >= total_cents`.
- **Reversal** allocates only the *freed* money — the canceled order's
  `amount_paid_cents` — to the other open orders FIFO; the reversed charge
  itself never marks anything paid.
- **Statement settlement** is derived, not incremented: after every entry,
  `recomputeSettlement(accountId)` (in `lib/house-account-settlement.ts`) sets each open statement's
  `settled_cents = min(closing_cents, Σ|negative entries NOT captured by this
  statement's snapshot — i.e. unbilled (statement_id NULL) or billed on a later
  statement|)`. Defining settlement by the snapshot rather than by dates makes
  a same-day payment after a manual issue count, while a payment captured in
  the snapshot (already inside closing) never double-counts. A statement whose `dueCents =
  max(0, closing − settled)` reaches 0 becomes `paid` and its `scheduled`
  sends are canceled. Because `closing` is the cumulative balance, a single
  payment settles every older statement at once and no FIFO across
  statements is needed. Invariant: the account balance is always ≥ the
  latest statement's `dueCents`, so a link can never collect more than owed.
- **Promo**: an account order redeems its promo at creation (the charge is
  committed), using the same `redeemPromo` call the paid intake path uses; it
  is idempotent per order so later allocation cannot double-redeem.
- **Gift card** at intake is incompatible with "to account" (the UI hides the
  gift-card field when "A cuenta" is selected; the API returns 422 if both).

## Statement issue and the send plan

### When a statement is due

`nextIssueDate(account, today)` (pure, in `house-account-plan.ts`):

- `monthly`: the `issue_day` of each month (1–28, so every month has it).
- `weekly`: every date whose weekday equals `issue_day`.
- `biweekly`: `anchor_date + 14k`. `anchor_date` is set when the cadence is
  set to biweekly (or the account is created biweekly) to the next date whose
  weekday equals `issue_day`, today included.

An account is "due to issue" on `today` when `today` is an issue date and no
statement exists with `period_end >= today − 1` (so a manual "issue now"
earlier that day, or a same-period issue, does not double up).

### What a statement contains

`issueStatement(accountId, periodEnd)`:

1. `period_start` = day after the latest statement's `period_end`, else the
   account's creation date. If `period_start > period_end`, do nothing.
2. Collect every ledger entry of the account with `statement_id IS NULL` and
   `created_at` ≤ `period_end` 23:59:59 shop time. Entries after `period_end`
   wait for the next statement.
3. If there are no such entries and `opening_cents <= 0`, do nothing (no
   empty statements).
4. Compute `opening / charges / credits / payments / closing` as defined in
   the model, assign `number` and `code`, write `lines_json`, stamp every
   collected entry with `statement_id`, all in `BEGIN IMMEDIATE … COMMIT`.
5. `due_date = today + terms_days` (today = shop date of the issue).
   `settled_cents` is initialized by the same `recomputeSettlement` rule, so
   a payment recorded this morning before the cron ran already counts.
   Status `open`, unless `dueCents = 0` (closing ≤ 0, or already covered), in
   which case status `paid` and **no sends are enqueued** (staff can still
   "send now").
6. For an `open` statement, enqueue sends from the plan:
   - one `statement` row for today with `statement_channel`;
   - one `reminder` row per plan step at `due_date + offsetDays` with the
     step's channel. Steps whose date is on or before today are not
     enqueued (the statement send already covers today).

The cron calls `issueStatement(accountId, addDaysStr(today, -1))` (the period
closes yesterday); manual "Emitir estado ahora" calls
`issueStatement(accountId, today)`.

### Queue rules

- The cron (below) sends every `scheduled` row with `scheduled_for <= today`
  whose statement is still `open` and whose account is `active`.
- Statement → `paid` or `void` cancels its `scheduled` rows.
- Account `paused`: the cron skips its rows (they stay `scheduled`). On
  reactivation, rows whose `scheduled_for < today` are marked `skipped`
  (reason "pausa") so nothing goes out in a burst; future rows stay.
- Account `closed`: like paused, and no new statements are issued.
- A row is claimed with `UPDATE … SET status='sending' WHERE id=? AND
  status='scheduled'`; only a claim that changed one row proceeds. Two cron
  runs cannot send the same row twice. (`sending` is a transient status
  never shown as such: a crash mid-send leaves it, and the next run treats
  `sending` rows older than 1 hour as `failed` with reason "interrumpido".)
- "Enviar ya" from the admin creates a new `manual` row for today with the
  chosen channel and dispatches it immediately in the request; it is logged
  like any other row.
- "Saltar" sets `skipped` with reason "manual"; "Reprogramar" changes
  `scheduled_for` (must be ≥ today).

### Channel resolution at send time

Requested channel ∩ available channels:

- SMS available when `billing_phone` is set and the customer record with that
  phone (if any) does not have `messaging_channel = 'none'` (the opt-out
  marker set by STOP).
- Email available when `billing_email` is set and `RESEND_API_KEY` is
  configured.

If nothing remains, the row is `skipped` with the reason ("sin teléfono",
"opt-out SMS", "sin email", "email no configurado"). If one of two channels
fails, the row is `sent` with the failing channel's error kept in `error`.
Twilio dry-run is honored and recorded like the date-reminders cron does.

### Templates (`lib/house-account-templates.ts`, en/es)

Which template a row uses: `statement` for `kind = statement`; for
`reminder` and `manual`, `reminder` when `today <= due_date`, else `overdue`.
Vars: `number`, `amount` (the statement's `dueCents`), `due` (shop-local
date), `link`.

- `statement` — es: "Diva Flowers: tu estado de cuenta {number} por {amount}
  vence el {due}. Ver y pagar: {link}" / en: "Diva Flowers: your statement
  {number} for {amount} is due {due}. View and pay: {link}"
- `reminder` — es: "Recordatorio Diva Flowers: el estado {number} por {amount}
  vence el {due}. {link}" / en: "Reminder from Diva Flowers: statement
  {number} for {amount} is due {due}. {link}"
- `overdue` — es: "Diva Flowers: el estado {number} por {amount} venció el
  {due}. Paga aquí: {link}" / en: "Diva Flowers: statement {number} for
  {amount} was due {due}. Pay here: {link}"

No opt-out footer: these are transactional, like `payment_link`.

Email: subject "Estado de cuenta {number} · Diva Flowers" / "Statement
{number} · Diva Flowers"; body = the statement HTML with a "Ver y pagar" button
to the link; sender `ORDER_NOTIFICATIONS_FROM`, reply-to `SITE.email`.

### Plan defaults

Constants in `house-account-plan.ts`, overridable by a `settings` row
`house_account_defaults` (JSON, same shape) read with `getSetting`:

```json
{ "cadence": "monthly", "issueDay": 1, "termsDays": 15,
  "reminderPlan": [ { "offsetDays": -3, "channel": "sms" },
                    { "offsetDays": 0,  "channel": "sms" },
                    { "offsetDays": 7,  "channel": "both" } ],
  "statementChannel": "both" }
```

A new account is created with these values and edits them inline.

## Cron: `POST /api/cron/house-accounts`

Same contract as `app/api/cron/reminders/route.ts`: `Authorization: Bearer
$CRON_SECRET` (503 if unset, 401 if wrong), `dynamic = "force-dynamic"`,
`runtime = "nodejs"`. `today = shopDateStr(new Date())`.

1. **Issue**: for each `active` account due to issue today, `issueStatement`.
2. **Dispatch**: `dueSends(today)` → claim → `sendStep` → `markSent` /
   `markFailed` / `markSkipped`. One failure never stops the batch.

Response: `{ ok: true, today, issued, sent, skipped, failed }`. Never throws
after auth; per-row errors are captured.

Ops: one crontab line on Hostinger, daily at 09:20 NY (five minutes after the
date-reminders one), documented in `docs/ops/house-accounts.md`.

## Public statement page and Stripe

### `GET /s/[code]` → `app/s/[code]/route.ts`

Outside the locale tree and excluded from the proxy matcher (add `s/` next to
`c/`). Unknown code → 404 text. `void` → 410 with a one-line page. Otherwise
200 `text/html` built by `buildStatementHtml(statement, account, {paid?})`,
headers `Cache-Control: no-store`, `X-Robots-Tag: noindex`.

Look: the order invoice (`lib/invoice-html.tsx`) as the template — logo via
`getLogoDataUri()`, Letter portrait, inline CSS, "Imprimir / Guardar PDF"
button hidden on print. Language: `account.locale`. Strings in an `{ en, es }`
dictionary inside the module (no next-intl on a raw HTML route).

Content, top to bottom:

1. Header: logo, `SITE.merchantName`, address, phone, email.
2. "ESTADO DE CUENTA / STATEMENT", `number`, period, issue date, due date,
   stamp **PAGADO / PAID** when `status = 'paid'`, **VENCIDO / PAST DUE** when
   `open` and `today > due_date`, else **SALDO PENDIENTE / BALANCE DUE**.
3. Bill to: `name`, `billing_name`, phone (`formatPhoneUS`), email.
4. Summary table: saldo anterior (`opening`), cargos (`charges`), créditos
   (`credits`), pagos recibidos (`payments`), **saldo** (`closing`), and when
   `settled_cents > 0` a "pagado / acreditado después de emitido" line and
   the remaining `dueCents`.
5. Detail of the period from `lines_json`: one row per entry — date, type
   (order number with recipient name for charges, "Pago · método" for
   payments, "Crédito" / "Ajuste" / "Cancelación · ORD-…" otherwise),
   amount.
6. "Pagar ahora / Pay now" button (a `<form method="post" action="/s/<code>/pay">`)
   only when `status = 'open'` and `dueCents > 0`. After a successful
   return (`?paid=1`) the page re-reads the statement; if the webhook has
   already landed it shows PAID, otherwise a "Pago recibido, actualizando…"
   note.
7. Footer: `SITE` contact line and "Gracias por su preferencia / Thank you".

`lines_json` shape: `[{ "date": "YYYY-MM-DD", "kind": "charge" | "payment" |
"credit" | "adjustment" | "reversal", "label": string, "orderId"?: string,
"orderNumber"?: number, "recipientName"?: string, "method"?: string,
"note"?: string, "amountCents": number }]`, built at issue time so the page
never changes afterward. `label` is the Spanish fallback for admin tables; the
public page composes a localized label from the structured fields.

### `POST /s/[code]/pay` → `app/s/[code]/pay/route.ts`

`createStatementCheckout(statement, account)` in
`lib/house-statement-checkout.ts`, following `stripe-payment-link.ts` without
touching it: one line item "Estado de cuenta ST-… · Diva Flowers" for
`dueCents`, `metadata` and `payment_intent_data.metadata` =
`{ kind: "house_statement", statementId, accountId }`, `expires_at` = +24h,
`success_url = ${site}/s/${code}?paid=1`, `cancel_url = ${site}/s/${code}`.
Responds 303 to `session.url`. 404 / 410 / 409 (nothing due) mirror the GET.
Expired sessions are not tracked: the button just creates another one.

### Webhook (`app/api/stripe/webhook/route.ts`)

- `checkout.session.completed`: **before** the existing `orderId` path,
  `if (session.metadata?.kind === "house_statement")` →
  `recordStripeStatementPayment({ statementId, sessionId, amountCents:
  session.amount_total })`, which inserts a `payment` entry with `method =
  'stripe'`, `stripe_session_id = sessionId`, `actor = 'stripe'` using
  `INSERT OR IGNORE`; only when the insert changed a row does it run the
  order allocation and `recomputeSettlement`. Then `return` (the order path
  is untouched).
- `payment_intent.succeeded`: early `return` when `pi.metadata?.kind ===
  "house_statement"` so it is not looked up as an order.

## Admin

### Navigation

"Cuentas" / "Accounts" link in `components/admin/dashboard/DashboardShell.tsx`
between Clientes and Campañas, with `isAccounts` pathname flag added to the
`isBandeja` negation. Keys `admin_dashboard.nav_accounts` in `messages/es.json`
and `messages/en.json`. All other admin strings under a new `admin_accounts`
namespace.

### `/admin/accounts` → `app/[locale]/admin/accounts/page.tsx`

Server component: `listAccounts()` + `upcomingSends(7)` passed to
`<AccountsView>` inside `<DashboardShell>`.

- **Próximos envíos** strip (next 7 days, all accounts): account, kind,
  channel, date, status; buttons **Enviar ya** and **Saltar** per row.
- **Accounts table**: name, balance, oldest open statement (number + due
  date, red **Vencido** badge when past due), next issue date, last payment
  date, account status badge. Filters: todas / con saldo / vencidas /
  pausadas. Button **Nueva cuenta** (modal: name, billing name/phone/email,
  locale; plan from defaults).

### `/admin/accounts/[id]` → `app/[locale]/admin/accounts/[id]/page.tsx`

Server component: `getAccountDetail(id)` → `<AccountDetail>`. One scrolling
page, like the customer profile:

- **Header**: name, balance (red when > 0 and any statement past due), status
  badge, actions **Registrar pago**, **Crédito / ajuste**, **Emitir estado
  ahora**, **Pausar / Reactivar**, **Cerrar cuenta**.
- **Convenio**: inline-editable fields — name, billing contact, locale,
  cadence, issue day (weekday picker for weekly/biweekly, 1–28 for monthly),
  terms days, statement channel, reminder plan (list of offset + channel rows
  with add/remove), notes. **Guardar** sends a PATCH.
- **Estados de cuenta**: number, period, due date, closing, settled, status
  badge; per row **Ver** (`/s/<code>` new tab), **Copiar link**, **Enviar
  ya** (menu SMS / Email / Ambos), **Anular** (confirm).
- **Movimientos**: the ledger, chronological with running balance; charge and
  reversal rows link to the order and open the existing `OrderDetailDrawer`.
- **Contactos**: linked customers with segment badge; **Agregar** uses the
  existing `/api/admin/customers/search` typeahead; **Quitar** per row.
- **Cola**: every send row for this account (scheduled, sent, skipped, failed
  with its error), with **Enviar ya / Saltar / Reprogramar** on scheduled ones.

**Registrar pago** modal: amount (dollars text, cents derived like the
deposit field), method (`cash | zelle | ach | check | card-terminal`), note.
Overpayment is allowed and becomes credit (balance goes negative).

**Crédito / ajuste** modal: a toggle **Crédito** (amount > 0, stored as a
negative `credit`, allocates to open orders) or **Ajuste** (signed amount,
stored as `adjustment`, never allocates), plus a required note.

### Intake (`components/admin/intake/PaymentBlock.tsx`, `IntakeForm.tsx`, `schemas/intake.ts`)

- New button **A cuenta** in the method grid. Selecting it shows an account
  search (name typeahead against `GET /api/admin/accounts?q=`), and hides the
  deposit and gift-card fields.
- When the typed phone matches a linked contact, the account is preselected
  and a "Cuenta: X" chip shows next to the phone.
- `PaymentState` gains `{ status: "account"; accountId: string; accountName:
  string }`; zod `payment` union gains `{ status: 'account', accountId }`.
- `POST /api/admin/orders`: validates the account exists and is `active` (422
  `account_invalid` otherwise), rejects a gift card with it (422), saves the
  order with `paymentStatus 'pending'`, `paymentMethod 'house-account'`,
  `houseAccountId`, inserts the `charge`, redeems the promo, and links the
  customer as a contact when it is not linked to any account yet. The
  `order_received` SMS goes out as today; no payment link is sent (none is
  today for pending orders either).

### Order drawer (`components/admin/dashboard/OrderDetailDrawer.tsx`)

- Account order: balance banner shows **A cuenta · {name}** with a link to the
  account; the **Liquidar** button, the deposit form and the payment-link
  button are hidden (the account is where money is recorded).
- Pending order without account, not canceled: new action **Pasar a cuenta**
  (same account search). `PATCH /api/admin/orders/[id]/payment` with
  `{ moveToAccount: { accountId } }` → sets the fields and inserts a charge
  for `total − amount_paid`, records `order_changes` kind `house_account`.
- Account order whose charge is still unbilled: action **Quitar de cuenta** →
  `{ removeFromAccount: true }` → inserts a `reversal`, clears
  `house_account_id`, sets `payment_method` to NULL, leaves it `pending`.
  Refused (409) once the charge has a `statement_id`.
- `cancelOrder` on an account order inserts the reversal (Ledger rules).

### Bandeja, metrics, customer profile

- `lib/order-queue.ts`: the SQL and the in-memory reasons for
  `delivery_today_unpaid`, `pickup_today_unpaid` and `intake_unpaid_stale`
  add `AND payment_method IS NOT 'house-account'`.
- `/admin/metrics`: new `KpiCard` "Por cobrar en cuentas": sum of positive
  account balances, subtitle "{n} vencidos · {amount}" from open statements
  past due. `outstandingCents` keeps counting account orders (they are real
  receivables).
- Customer profile: "Cuenta: {name}" badge linking to the account when the
  customer is a contact.
- `lib/conversation-storage.ts`: fourth source — `house_account_sends` rows
  with `status = 'sent'` and `sms_sid` set, outbound, phone =
  `billing_phone`, body from `body`, attributed by phone like the rest.

## Modules and routes

### New `lib/` modules

| module | responsibility | pure? |
|---|---|---|
| `house-account-storage.ts` | accounts + contacts CRUD, `listAccounts(filters)`, `getAccount`, `getAccountDetail`, `accountBalanceCents`, `findAccountForPhone` | no |
| `house-account-ledger.ts` | `recordCharge`, `recordPayment` (+ allocation in one transaction), `recordCredit`, `recordAdjustment`, `reverseOrderCharge`, `syncOrderTotal`, `listEntries`, `recordStripeStatementPayment` | no |
| `house-account-allocate.ts` | `allocate(targets: {id, dueCents}[], amountCents) → {id, appliedCents}[]` | yes |
| `house-account-plan.ts` | `nextIssueDate`, `isIssueDay`, `scheduleFromPlan`, `DEFAULTS`, `resolveDefaults(settingsJson)` | yes |
| `house-account-settlement.ts` | `dueCents`, `entryDate`, `recomputeSettlement` (own module so ledger and statements can both import it without a cycle) | no |
| `house-account-statements.ts` | `issueStatement`, `accountsDueToIssue(today)`, `getStatementByCode`, `voidStatement`, `latestStatement`, `buildLines` | no |
| `house-account-detail.ts` | `getAccountDetail(id)` for the admin page and API | no |
| `house-account-sends.ts` | `enqueue`, `dueSends(today)`, `claim`, `markSent/Failed/Skipped`, `cancelForStatement`, `skipStaleForAccount`, `upcomingSends(days)`, `listForAccount` | no |
| `house-account-sender.ts` | `sendStep(row)`: resolves channels, renders, calls `sendSms` / Resend, returns the outcome | no (I/O) |
| `house-account-templates.ts` | `renderSms(template, locale, vars)`, `renderEmail(...)`, `SUBJECTS` | yes |
| `house-statement-html.tsx` | `buildStatementHtml(statement, account, opts)` | yes |
| `house-statement-checkout.ts` | `createStatementCheckout(statement, account)` | no (Stripe) |
| `short-code.ts` | `generateCode()` + `CODE_PATTERN`, moved from `digital-card-code.ts` which re-exports them (no behavior change) | yes |
| `types/house-account.ts` | the domain types | — |

### Routes

| route | methods | notes |
|---|---|---|
| `app/s/[code]/route.ts` | GET | public statement page |
| `app/s/[code]/pay/route.ts` | POST | Stripe Checkout redirect |
| `app/api/cron/house-accounts/route.ts` | POST | bearer `CRON_SECRET` |
| `app/api/admin/accounts/route.ts` | GET (list, `?q=&filter=`), POST (create) | |
| `app/api/admin/accounts/[id]/route.ts` | GET (detail), PATCH (plan, billing, status) | |
| `app/api/admin/accounts/[id]/payments/route.ts` | POST | manual payment; `requireAdmin` |
| `app/api/admin/accounts/[id]/entries/route.ts` | POST | credit / adjustment; `requireAdmin` |
| `app/api/admin/accounts/[id]/contacts/route.ts` | POST, DELETE | link / unlink |
| `app/api/admin/accounts/[id]/statements/route.ts` | POST | issue now |
| `app/api/admin/accounts/statements/[sid]/route.ts` | PATCH `{ void: true }` | |
| `app/api/admin/accounts/statements/[sid]/send/route.ts` | POST `{ channel }` | send now |
| `app/api/admin/accounts/sends/[id]/route.ts` | PATCH `{ skip: true }` or `{ scheduledFor }` | |

All `/api/admin/*` routes are proxy-gated; money-moving handlers also call
`requireAdmin`.

### Existing files touched (minimal diffs)

`db/migrations/030_house_accounts.sql` (new), `types/order.ts`,
`lib/order-row.ts`, `lib/order-mutations.ts` (cancel → reversal),
`lib/order-edit.ts` (total delta → adjustment), `lib/order-queue.ts`,
`lib/conversation-storage.ts`, `lib/metrics.ts` (+ metrics page),
`lib/digital-card-code.ts` (re-export), `schemas/intake.ts`,
`app/api/admin/orders/route.ts`, `app/api/admin/orders/[id]/payment/route.ts`,
`app/api/stripe/webhook/route.ts`, `proxy.ts` (matcher),
`components/admin/intake/PaymentBlock.tsx`, `IntakeForm.tsx`,
`intake-initial-state.ts`, `components/admin/dashboard/OrderDetailDrawer.tsx`,
`DashboardShell.tsx`, `components/admin/customers/CustomerProfile.tsx`,
`messages/es.json`, `messages/en.json`, `docs/ops/house-accounts.md` (new).

New components under `components/admin/accounts/`: `AccountsView`,
`AccountDetail`, `AccountSearch` (shared by intake and drawer), `PaymentModal`,
`EntryModal`, `PlanEditor`, `SendsQueue`, `StatementsTable`, `LedgerTable`,
`ContactsList`, `AccountStatusBadge`.

## Error handling

- Every money mutation (charge, payment + allocation, reversal, issue, void)
  runs in `BEGIN IMMEDIATE … COMMIT` with rollback on throw.
- `issueStatement` is idempotent through `UNIQUE(account_id, period_end)` and
  the "period_start > period_end" guard; a race returns the existing row.
- Webhook idempotency through `UNIQUE(stripe_session_id)` + `INSERT OR IGNORE`.
- Cron claim-before-send; stale `sending` rows older than 1 h become `failed`.
- Sending to an account with neither phone nor email: queue row `skipped`
  with a reason; the admin "send now" returns 422 with the same reason.
- Void of a `paid` statement is refused (409). Void of an `open` one clears
  `statement_id` on its entries (they become unbilled again), sets `void`,
  cancels its queue.
- Creating an account order against a `paused` or `closed` account → 422.
- Deleting an account is not offered; `closed` hides it from the intake
  search and stops issuing.
- `RESEND_API_KEY` missing → email channel unavailable, visible in the queue
  as a skip reason; never a crash.

## Testing

Vitest with `SQLITE_FILE=:memory:` + `runMigrations()` per test, Twilio and
Resend mocked with `vi.mock`, following `tests/unit/api-cron-reminders.test.ts`
and `order-mutations-deposit.test.ts`.

- **Pure**: `allocate` (exact, partial, overpayment, targets already partly
  paid, zero targets); `nextIssueDate` / `isIssueDay` for the three cadences
  including month ends, year rollover and the biweekly anchor;
  `scheduleFromPlan` (past offsets collapse to today, ordering); templates
  render both locales with money and dates formatted shop-local.
- **Storage / ledger**: charge on account order; deposit-aware charge;
  one payment settles two cumulative statements at once and allocates FIFO
  to three orders marking the right ones paid; a payment recorded before
  issue counts toward the new statement's `settled_cents`; overpayment
  leaves credit; reversal on cancel once and only frees the canceled order's
  paid amount; order-edit adjustment never pays another order; a reversal
  that zeroes the balance marks the open statement paid and cancels its
  sends; `issueStatement` idempotent and skips empty periods;
  `closing <= 0` issues as `paid` with no sends; void returns entries to
  unbilled and cancels sends; pause/reactivate skips stale rows.
- **Routes**: cron (auth 503/401, issues + dispatches, double run sends
  once, dry-run records, per-row failure isolation); `GET /s/[code]` (404,
  open with button, paid without button, void 410, noindex/no-store headers);
  `POST /s/[code]/pay` (303 to Stripe, 409 when nothing due); webhook
  `house_statement` (records once, allocates, ignores duplicate session,
  order path untouched); intake `status: 'account'` (422 on paused account,
  422 with gift card, charge inserted, promo redeemed, contact linked);
  `moveToAccount` / `removeFromAccount` (409 once billed); accounts CRUD +
  contacts uniqueness (a customer in two accounts → 409).
- **Queue exclusions**: `getPendingQueue` does not flag account orders as
  unpaid.
- **Inbox**: `conversationThread` shows a sent statement SMS under the
  billing phone.
- **E2E (Playwright, one spec)**: create account → intake order "A cuenta" →
  "Emitir estado ahora" → open `/s/<code>` and see BALANCE DUE → "Registrar
  pago" for the full amount → `/s/<code>` shows PAID and the order shows
  paid in the drawer.
- Compare against the known pre-existing failures before attributing a
  failure to this change.

## Build order (for the implementation plan)

1. Migration, types, `short-code.ts`, storage, allocate + ledger (with tests).
2. Plan, statements, sends queue, cron route (with tests).
3. Public page, checkout, webhook branch (with tests).
4. Templates, sender (SMS + email), inbox source (with tests).
5. Admin pages and components, nav, i18n.
6. Intake, drawer actions, cancel/edit hooks, queue exclusions, metrics card,
   customer badge.
7. E2E spec, ops doc, `rm data/diva.sqlite*` + `next build` check, CDN purge
   reminder in the deploy note.

## Deploy notes

- No new environment variables (`CRON_SECRET`, Stripe keys, Resend and
  `NEXT_PUBLIC_SITE_URL` already exist).
- Add the Hostinger cron line for `/api/cron/house-accounts` (09:20 NY).
- Purge the Hostinger CDN after deploy, as always.
- Verify migration 030 against a fresh DB and a full build before merging.
