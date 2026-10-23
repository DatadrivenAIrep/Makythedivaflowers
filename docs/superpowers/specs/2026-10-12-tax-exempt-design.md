# Tax exempt — customers, house accounts and orders

**Date:** 2026-10-12 · **Branch:** `feat/tax-exempt` · **Status:** approved design

## Problem

Exempt organizations (churches, schools, funeral homes, non-profits) present a NY
exemption certificate (ST-119.1 / ST-120) and must not be charged sales tax. Today
the only way to do that is to hand-edit the tax amount to $0 in staff intake. The
order then doesn't *know* it is exempt: the invoice and the printed ticket can't say
so, there is no certificate on record for an audit, and a later edit re-resolves
totals and can silently bring the tax back.

## Goals

- Mark a **customer** or a **house account** as tax exempt once, with its certificate
  number (required) and an optional expiry date.
- Staff intake applies the exemption automatically; staff can switch it off for one
  order (personal purchase) or switch it on for a one-off order (certificate number
  required).
- Each order keeps a **snapshot** of the exemption (flag + certificate) so history
  never changes when the customer/account record changes.
- Invoice, printed ticket and order detail show "Exempt · Cert #…".

## Non-goals

- Public web checkout. Exempt buyers order by phone / in store; an online order pays
  normal tax.
- Uploading a photo/PDF of the certificate (can be layered later on top of this).
- Multiple tax rates / jurisdictions — `TAX_RATE` stays a single constant.

## Data model — migration `db/migrations/037_tax_exempt.sql`

```sql
ALTER TABLE customers      ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers      ADD COLUMN tax_exempt_cert TEXT;
ALTER TABLE customers      ADD COLUMN tax_exempt_expires TEXT;   -- YYYY-MM-DD, nullable
ALTER TABLE house_accounts ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE house_accounts ADD COLUMN tax_exempt_cert TEXT;
ALTER TABLE house_accounts ADD COLUMN tax_exempt_expires TEXT;
ALTER TABLE orders         ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders         ADD COLUMN tax_exempt_cert TEXT;
```

The migration runner already serializes non-idempotent `ALTER ... ADD COLUMN` under
`BEGIN IMMEDIATE` (see `lib/db-migrate.ts`); verify with a fresh-DB build.

Shared type (in `types/tax-exempt.ts`):

```ts
export type TaxExemption = { exempt: boolean; cert: string | null; expires: string | null };
```

`Customer` and `HouseAccount` gain `taxExemption: TaxExemption`. `Order` gains
optional `taxExempt?: { cert: string }` (present only when the order is exempt —
same conditional-spread pattern as `funeral`).

## Rules — `lib/tax-exempt.ts` (pure, unit-tested)

- `isExemptionValid(e, today)` → true only if `exempt && cert?.trim() && (!expires || expires >= today)`.
  `today` is the shop's local date from `localYmd()` (`lib/format-datetime.ts`).
- `exemptionStatus(e, today)` → `"none" | "active" | "expired" | "missing_cert"` for UI badges.
- `resolveDefaultExemption({ account, customer, today })` → `{ cert } | null`.
  Precedence: if the order is charged to a house account whose exemption is valid → the
  account's cert; else the buyer customer's valid exemption → its cert; else null.
- `resolveOrderExemption({ fallback, requested })` where `requested` is what staff sent:
  - `requested === undefined` → the fallback (default).
  - `requested.taxExempt === false` → null (staff switched it off).
  - `requested.taxExempt === true` → `{ cert: requested.cert ?? default?.cert }`; if no
    cert results, it is a validation error (`tax_exempt_cert_required`).

## Totals

`computeOrderTotals(subtotal, delivery, discount, tip, opts?: { taxExempt?: boolean })`:
when `taxExempt`, `taxCents = 0`; everything else (discount clamp, tip after tax)
unchanged. `resolveOrderTotals` accepts `taxExempt?: boolean` and, when true, forces
tax to 0 **even if a manual tax override is present**; the total cascade then uses 0.
Client (`CartTotals`, IntakeForm live total, `OrderEditForm`) and server call the same
functions, so they can't drift.

## Server

- `POST /api/admin/orders` (`schemas/intake.ts`): new optional
  `taxExempt?: { taxExempt: boolean; cert?: string }`. After the account and customer
  are loaded (both already happen before `computeTotals`), the route computes the
  default, applies `resolveOrderExemption`, returns **400 `tax_exempt_cert_required`**
  on a missing cert, passes `taxExempt` into totals, and stores the snapshot on the
  order. The server is authoritative; the client flag is only a request.
- `PATCH /api/admin/orders/[id]` + `lib/order-edit.ts`: patch may carry the same
  `taxExempt` object. When absent, the order's stored snapshot is kept and passed to
  `resolveOrderTotals` on re-resolve (so an edit never re-adds tax). Account ledger
  sync (`syncOrderTotal`) already handles the changed total.
- `PATCH /api/admin/customers/[id]` (`schemas/customer-patch.ts`, `updateCustomer`):
  accepts `taxExemption`. Setting `exempt: true` without a cert → 400.
- `POST`/`PATCH /api/admin/accounts[/id]` (`schemas/house-account.ts`,
  `createAccount`/`updateAccount` — add the columns to both SQL statements): same field,
  same validation.
- `GET /api/admin/customers/lookup` and `/api/admin/accounts/for-phone` already return
  the full objects → the new field reaches intake without new routes.

## UI

- **Customer profile** (`CustomerProfile.tsx`): "Tax exempt" block — toggle, cert #,
  expiry; inline edit saved through the existing PATCH. Status badge: active (green),
  expired / missing cert (rouge).
- **House account** (`NewAccountModal.tsx`, `PlanEditor.tsx`): the same three fields;
  "Tax exempt" badge in the account header (`AccountDetail.tsx`).
- **Intake** (`IntakeForm.tsx`, `CartTotals.tsx`): above the totals, a toggle row
  "Tax exempt · Cert #123 (cuenta|cliente)". Pre-on when a default exists; staff can
  turn it off; turning it on with no default reveals a cert input. While on, the tax
  row reads "$0.00 · exento" and is not editable. State is included in the draft.
  An expired certificate on the customer/account shows a small rouge note
  ("certificado vencido") and does not pre-enable.
- **Order detail / edit** (`OrderDetailDrawer.tsx`, `OrderEditForm.tsx`): detail
  shows "Tax exempt (Cert #…)" on the tax row; edit form has the same toggle.
- **Documents:** `lib/invoice.ts` tax row label → "Sales tax (NY) — Exempt · Cert #…"
  / "Impuesto (NY) — Exento · Cert #…"; `lib/print-render-html.tsx` same idea.
  House statements are unchanged (they show order totals, already tax-free).
- i18n strings in both `messages/en.json` and `messages/es.json`.

## Testing

- `lib/tax-exempt.ts`: validity (no cert, expired, expiry = today, no expiry),
  precedence (account beats customer; invalid account falls back to customer),
  request resolution (off, on with/without cert, on with default cert).
- `computeOrderTotals` / `resolveOrderTotals` exempt: tax 0 with discount + tip, tax
  override ignored when exempt, total cascade correct.
- Migration test (columns exist, defaults 0) + fresh-DB `next build`.
- Intake route: default applied from account / customer; staff off; on without cert
  → 400; snapshot persisted and read back via `rowToOrder`.
- `editOrder`: exempt order stays tax-free after an unrelated edit; toggle on/off
  re-resolves tax.
- Customer and account PATCH: validation + round-trip.
- Invoice: exempt label rendered with cert.

## Side finding (separate commit)

`lib/order-edit.ts` `applyPatch` appears not to carry `cur.totals.discountCents` /
`tipCents` into `resolveOrderTotals`, so editing a promo/tip order may drop the
discount/tip. Write a failing test first; if confirmed, fix in its own commit on this
branch since the same code is touched.
