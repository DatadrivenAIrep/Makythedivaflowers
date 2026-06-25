# Order editing + change history + sheet preview + reprint — design

**Status:** approved for plan
**Date:** 2026-06-25
**Owner:** Santiago Cardona
**Phase:** 3, sub-2 (order editing — deferred by the ops-dashboard spec `2026-05-25-ops-dashboard-design.md`), bundled with two print conveniences (preview + reprint)

## Summary

Three additions to the admin order workflow, all landing in the existing order detail drawer (`components/admin/dashboard/OrderDetailDrawer.tsx`):

1. **Edit an order after creation** — inline editing of contact, recipient, fulfillment (method / address / window / card message), and line items. Totals recompute automatically when items or delivery change. (Internal notes keep their existing append-only add flow.)
2. **Change history** — an immutable audit log (`order_changes`) recording every mutation an order goes through (created, edit, payment, fulfillment, cancel, note, reprint), shown as a timeline in the drawer. Edits store a field-level before→after diff.
3. **Print conveniences** — a **preview** button that renders the exact work-sheet HTML the printer produces, and a **reprint** button that re-enqueues a print job for any past order.

Editing a **paid** order does not refund or recharge Stripe. Instead the order tracks how much was actually collected (`amount_paid_cents`) and the drawer surfaces a **balance**: *saldo pendiente* (customer owes) or *saldo a favor* (we owe). The real settlement happens in person.

Operational tool, Spanish-only copy, single shared admin login (so the audit `actor` is `maky` for now).

## Roadmap context

| Phase | Scope |
| ----- | ----- |
| 1 | iPad intake form + SQLite migration + customers seed — shipped |
| 2 | Stripe payment links + SMS/WhatsApp notifications — shipped |
| 3, sub-1 | Ops dashboard (Bandeja + Libro + detail drawer) — shipped |
| **3, sub-2** | **Order editing + change history + sheet preview + reprint (this spec)** |
| 3, sub-N | Delivery route by zone, driver mobile UI, Calendar sync, day-before reminders, DB backup |
| 4 | CRM UI, one-tap reorder, daily close + QuickBooks/CSV export, per-user accounts |

## Why now

The ops-dashboard explicitly deferred "edit order items, address, time, card message". In daily use, intake mistakes (wrong recipient, wrong address, typo'd card message, an item added or swapped after the customer changed their mind) currently have no fix path — the order is frozen at creation. The user asked for editing **plus** an accountability trail, plus the ability to preview and re-print the work-sheet for a past order.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Editable surface | Contact + recipient, fulfillment (method/address/window/card message), line items + amounts. Internal notes stay on the existing append-only flow. |
| Where to edit | **Inline** in the order detail drawer (not the intake form, not a separate page). |
| Editing a paid order | Allowed. No Stripe refund/recharge. System computes a **balance** (saldo pendiente / saldo a favor) from `total − amount_paid`. |
| Change history storage | Dedicated immutable `order_changes` table (same pattern as `gift_card_redemptions`), not free-text `internal_notes`. |
| History scope | Unified timeline — edits **and** the existing mutations (payment, fulfillment, cancel, note) **and** creation **and** reprint all record a row. |
| "Who" attribution | Single shared login today → `actor = "maky"`. Table is per-user-ready for Phase 4 CRM. |
| Preview presentation | Opens the real work-sheet HTML (`buildSheetHtml`) in a **new browser tab**. |
| Reprint | Re-enqueues a fresh print job via `enqueuePrintJob`; confirmation prompt; logged in history. |
| Re-notify customer on edit | **No** — out of scope; recorded in history only. Automated messaging is Phase 2's domain. |

## Goals & non-goals

### In scope
- Inline edit mode in `OrderDetailDrawer` for: contact (name/phone/email), recipient (name/phone), fulfillment method + address + window + card message, line items (add / remove / qty / price override). Internal notes keep their existing append-only add flow.
- Server-authoritative totals recompute on edit, reusing `lib/totals.ts` (`computeOrderTotals`, delivery-zone resolution) and the same pricing path the intake uses.
- `order_changes` immutable audit table + `amount_paid_cents` column on `orders` (migration `010`).
- Field-level before→after diff for edits; one-line human summary per change.
- Unified history timeline in the drawer; existing mutations retrofitted to log to `order_changes`.
- Balance computation + banner (saldo pendiente / saldo a favor) + a "marcar saldado" action that sets `amount_paid = total`.
- `GET /api/admin/orders/[id]/sheet` returns the work-sheet HTML for preview (new tab).
- `POST /api/admin/orders/[id]/reprint` re-enqueues a print job.
- Server-side admin-session enforcement on the new endpoints.
- Spanish-only copy.

### Out of scope (deferred)
- Multi-installment partial-payment ledger (record each collection separately) — Phase 4 payments work. We track a single `amount_paid_cents`, not a payment history.
- Automatic Stripe refund / additional charge when a paid order's total changes — always manual / in person.
- Automatic customer re-notification (SMS/WhatsApp/email) on edit — Phase 2 messaging owns notifications; edits are silent.
- Per-user accounts / real `actor` identity — Phase 4 CRM. Actor is hardcoded `maky`.
- Editing through the standalone intake form route — we chose inline editing.
- Concurrent-edit conflict resolution — single-user shop, last-write-wins.

## Architecture

### SQLite migration — `db/migrations/010_order_history.sql`

Follows the existing numbered-SQL-file pattern (latest is `009_gift_cards.sql`).

```sql
-- Immutable audit log of every change an order goes through.
CREATE TABLE order_changes (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  at           TEXT NOT NULL,            -- ISO timestamp
  actor        TEXT NOT NULL,            -- admin session user; "maky" for now
  kind         TEXT NOT NULL,            -- created | edit | payment | fulfillment | cancel | note | reprint
  summary      TEXT NOT NULL,            -- human-readable one-liner (Spanish)
  changes_json TEXT                      -- JSON array of field diffs for kind='edit'; NULL otherwise
);
CREATE INDEX idx_order_changes_order ON order_changes(order_id, at);

-- How much has actually been collected, for balance (saldo) computation.
ALTER TABLE orders ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing fully-paid orders are considered paid in full.
UPDATE orders SET amount_paid_cents = total_cents WHERE payment_status = 'paid';
```

`balance_cents` is **derived** (`total_cents − amount_paid_cents`), never stored.

### Types — `types/order.ts` (additions)

Current shapes are unchanged; we add:

```ts
export type OrderChangeKind =
  | "created" | "edit" | "payment" | "fulfillment" | "cancel" | "note" | "reprint";

export type FieldDiff = {
  field: string;        // machine key, e.g. "fulfillment.address.street1"
  label: string;        // Spanish UI label, e.g. "Dirección"
  before: string | null;
  after: string | null;
};

export type OrderChange = {
  id: string;
  orderId: string;
  at: string;           // ISO
  actor: string;
  kind: OrderChangeKind;
  summary: string;
  changes?: FieldDiff[]; // present for kind="edit"
};
```

`Order` gains `amountPaidCents: number` (default 0). Balance is computed in a helper, not on the type:

```ts
// lib/order-balance.ts
export function orderBalanceCents(order: Order): number {
  return order.totals.totalCents - order.amountPaidCents;
}
```

### Server logic

**`lib/order-history.ts`** (new)
- `recordOrderChange(input: { orderId; actor; kind; summary; changes? }): Promise<OrderChange>` — inserts one row.
- `listOrderHistory(orderId: string): Promise<OrderChange[]>` — ordered by `at` ascending (UI renders reverse).

**`lib/order-edit.ts`** (new) — the core edit operation:

```ts
editOrder(orderId, patch: OrderEditPatch, actor: string): Promise<{ order: Order; change: OrderChange | null }>
```

`OrderEditPatch` mirrors the editable surface (all fields optional):
`contact`, `recipient`, `fulfillmentMethod`, `address`, `window`, `cardMessage`, `lines`, `deliveryCentsOverride`. (Internal notes are not part of the patch — they use the existing `appendInternalNote` flow.)

Algorithm:
1. Load the current order (404 if missing).
2. Build `next` by applying the patch.
3. If `lines` or delivery inputs changed: recompute `subtotalCents` from the priced lines (same pricing path the intake POST uses), resolve `deliveryCents` (zip/city zone or manual override), then `computeOrderTotals(subtotal, delivery)`.
4. Diff `current` vs `next` over a fixed field set → `FieldDiff[]`, with money values formatted (`$45.00 → $52.00`).
5. If the diff is empty, return `{ order: current, change: null }` (no write, no history row).
6. `saveOrder(next)` (existing dual-write: SQLite + `pending-orders.json` mirror; bumps `updatedAt`).
7. `recordOrderChange({ kind: "edit", summary, changes })`.
8. Return `{ order: next, change }`.

Validation: at least 1 line required to save; address required when method is `delivery`; window required when method is `delivery` or `pickup`. Reuses the intake's zod schemas where possible.

**Retrofit existing mutations** (`lib/order-mutations.ts`) to also `recordOrderChange`, so the timeline is complete:

| Function | Logged kind | Summary example | Notes |
| -------- | ----------- | --------------- | ----- |
| `markPaidManual` | `payment` | `Pagado en efectivo · $52.00` | Also sets `amount_paid_cents = total_cents`. |
| `changeFulfillmentStatus` | `fulfillment` | `Estado: preparando → en camino` | |
| `cancelOrder` | `cancel` | `Cancelada · motivo: …` | |
| `appendInternalNote` | `note` | `Nota agregada` | `internal_notes` stays canonical; history logs the event. |
| (order creation, intake POST) | `created` | `Orden creada · walk-in` | |
| (reprint endpoint) | `reprint` | `Reimpresa` | |

**Balance / payment interplay**
- `amount_paid_cents` is moved only by payment events (`markPaidManual`, the Stripe webhook, gift-card application).
- Editing the total leaves `amount_paid_cents` untouched, so the balance shifts.
- A "marcar saldo saldado" action sets `amount_paid_cents = total_cents` (records that the in-person difference was settled). For a *saldo a favor* (credit) it likewise zeroes the balance for record-keeping; the actual refund is manual.
- `payment_status` keeps its current values; the drawer's display layer additionally reads the balance to label "Saldo pendiente" / "Saldo a favor" regardless of `payment_status`.

### Preview — `GET /api/admin/orders/[id]/sheet`

Loads the order, calls `buildSheetHtml(order)` (from `lib/print-render-html.tsx` — the same function the print queue serves to the agent), returns it as `text/html`. Because the agent builds the sheet fresh from the current order at fetch time, this preview is byte-for-byte what will print. Admin-session protected.

### Reprint — `POST /api/admin/orders/[id]/reprint`

Loads the order, calls `enqueuePrintJob(order)` (from `lib/print-queue.ts`), records an `order_changes` row (`kind="reprint"`), returns `{ jobId }`. The print-agent on the shop PC picks it up on its next poll and prints it — no agent changes required. Admin-session protected.

### API endpoints

| Method + path | Body | Returns |
| ------------- | ---- | ------- |
| `PATCH /api/admin/orders/[id]` | `OrderEditPatch` (zod-validated) | `{ order, change }` |
| `GET /api/admin/orders/[id]` | — | **extended**: `{ order, customer, messages, history, balanceCents }` |
| `POST /api/admin/orders/[id]/reprint` | — | `{ jobId }` |
| `GET /api/admin/orders/[id]/sheet` | — | `text/html` (work-sheet) |
| `PATCH /api/admin/orders/[id]/payment` | **extended** to accept `{ settleBalance: true }` | `{ order }` — sets `amount_paid = total` |

All require the `intake_session` admin cookie, validated **server-side** via `lib/admin-auth.ts`; 401 otherwise. (The new endpoints expose order PII and trigger physical printing, so they must not rely on client-only gating.)

## UI structure — `OrderDetailDrawer.tsx`

The drawer gains a `mode: "view" | "edit"` state.

### View mode (additions to current layout)
- **Balance banner** (only when `balanceCents !== 0`): amber chip "Saldo pendiente $X" or blue chip "Saldo a favor $X", with a small "Marcar saldado" button.
- **Header / action row** gains three buttons: ✏️ **Editar** (enters edit mode), 👁️ **Vista previa** (opens `/sheet` in a new tab), 🖨️ **Re-imprimir** (confirm → POST `/reprint` → toast "Enviada a impresora").
- **Historial** section (new): reverse-chronological timeline from `history`. Each entry shows `fmtTs(at) · actor · summary`; `kind="edit"` entries expand to the before→after `FieldDiff` list. The existing **Mensajes** section stays separate (those are customer communications, not internal changes).

### Edit mode
The contact / recipient / entrega / items / mensaje sections become inputs:
- **Contacto**: name, phone, email.
- **Destinatario**: name, phone.
- **Entrega**: method selector (delivery / pickup / in-store); address fields (street / city / state / zip) when delivery; date + slot; card message textarea.
- **Items**: each line with qty ± stepper, remove (×), and price override; an "Agregar artículo" button opens the product picker extracted from the intake form (shared component). Subtotal / delivery / tax / total recompute live (client mirror of `lib/totals.ts`); the server recompute is authoritative on save.
- **Delivery fee**: auto-resolved from zip/city with a manual override field (same UX as intake).
- Footer: **Guardar cambios** (→ `PATCH`, validates ≥1 line, exits edit mode, refreshes) and **Cancelar** (discards, back to view).

Reuses the existing `call(method, url, body)` helper and `resolveLine` for line display. The product picker is extracted from `components/admin/intake/IntakeForm.tsx` into a shared component so both intake and edit use one implementation.

## Testing (TDD, `tests/unit/`)

### Unit
- `lib/order-edit.test.ts` — diff correctness across each editable field; totals recompute when lines change; totals recompute when delivery zip/override changes; no-op (empty diff → no write, no history); ≥1-line validation; address/window required-field validation.
- `lib/order-balance.test.ts` — pending (total > paid), credit (total < paid), settled (equal), zero-total.
- `lib/order-history.test.ts` — `recordOrderChange` / `listOrderHistory` roundtrip and ordering.
- `lib/order-mutations.test.ts` — each retrofitted mutation writes the expected `order_changes` row; `markPaidManual` sets `amount_paid_cents`.

### API route
- `PATCH /api/admin/orders/[id]` — valid patch updates + logs; invalid body → 400; unauth → 401; empty-diff → 200 no-op.
- `GET /api/admin/orders/[id]` — returns `history` + `balanceCents`.
- `POST /reprint` — enqueues a job referencing the order; logs `reprint`; 401 unauth.
- `GET /sheet` — returns non-empty `text/html`; 401 unauth.

### Component
- `OrderDetailDrawer` — toggles edit mode; save calls PATCH; balance banner renders correct variant; history timeline renders + expands edit diffs; preview/reprint buttons fire.

## Deployment

Single PR to `main`. Migration `010` runs at boot via the existing migration runner. No new environment variables. No print-agent changes (reprint and preview both reuse the existing server-builds-HTML contract).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Editing a paid order's total silently diverges from what Stripe charged | Balance banner makes the gap explicit; "marcar saldado" records the in-person settlement; spec states no auto refund/recharge. |
| Reprint floods the agent with duplicate jobs | Confirmation prompt before POST; each reprint is logged in history so duplicates are visible. |
| `/sheet` leaks order PII if unauthenticated | Server-side admin-session check on the route (not client-only). |
| Inline item editing in a side drawer feels cramped | Reuse the intake product picker as a modal/popover within the drawer; keep the line list compact. |
| Diff noise (logging unchanged fields) | `editOrder` diffs over a fixed field set and skips equal values; empty diff → no history row. |
| History grows unbounded | Append-only at expected volume is fine (<few KB/order/year); pruning deferred. |

## File map

New files:
- `db/migrations/010_order_history.sql`
- `lib/order-history.ts`
- `lib/order-edit.ts`
- `lib/order-balance.ts`
- `app/api/admin/orders/[id]/reprint/route.ts`
- `app/api/admin/orders/[id]/sheet/route.ts`
- `components/admin/intake/ProductPicker.tsx` (extracted shared picker)
- `tests/unit/order-edit.test.ts`
- `tests/unit/order-balance.test.ts`
- `tests/unit/order-history.test.ts`
- `tests/unit/api/admin-order-edit.test.ts`
- `tests/unit/api/admin-order-reprint.test.ts`
- `tests/unit/api/admin-order-sheet.test.ts`
- `tests/unit/components/OrderDetailDrawer.edit.test.tsx`

Modified files:
- `types/order.ts` — add `amountPaidCents`, `OrderChange`, `OrderChangeKind`, `FieldDiff`.
- `lib/order-row.ts` — map `amount_paid_cents` ↔ `amountPaidCents`.
- `lib/order-mutations.ts` — retrofit mutations to log `order_changes`; `markPaidManual` sets `amount_paid_cents`; extend payment path with `settleBalance`.
- `app/api/admin/orders/[id]/route.ts` — add `PATCH`; extend `GET` with `history` + `balanceCents`.
- `app/api/admin/orders/[id]/payment/route.ts` — accept `settleBalance`.
- `app/api/admin/orders/route.ts` (intake POST) — log `created`.
- `components/admin/dashboard/OrderDetailDrawer.tsx` — edit mode, balance banner, history timeline, preview/reprint/edit buttons.
- `components/admin/intake/IntakeForm.tsx` — consume the extracted `ProductPicker`.
- `lib/admin-auth.ts` — ensure a reusable server-side `requireAdmin(req)` guard exists for the new routes.
