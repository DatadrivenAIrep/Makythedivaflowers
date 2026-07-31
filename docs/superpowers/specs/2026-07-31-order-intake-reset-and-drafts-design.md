# Order Intake — Form Reset Fix + Server-Side Drafts

- **Date:** 2026-07-31
- **Status:** Approved (design) — pending spec review
- **Area:** Admin dashboard → "Nuevo pedido" (intake) order creation
- **Author:** Santiago Cardona (with Claude)

## Context

The staff-facing order-creation tool ("intake", labeled *Nuevo pedido*) lives at
`app/[locale]/admin/intake/page.tsx` and is orchestrated by
`components/admin/intake/IntakeForm.tsx`. It shares the domain core (types, totals,
storage) with the customer-facing checkout but adds staff-only concerns (channel/source,
manual payment, totals overrides, print jobs, message dispatch, gift-card redemption).

Two changes are requested:

1. **Bug — form does not fully reset after creating an order.** After a successful
   create, the form keeps the `fulfillment` (recipient, address, delivery window, card
   message) and `channel` values. Staff must reload the tab to start a clean order.
2. **Feature — order drafts.** Staff want to save an in-progress order as a draft and
   resume it later without losing any entered data.

## Goals

- After a successful create, the intake form returns to a clean state, ready for the next
  order immediately (no reload).
- Staff can save the current in-progress order as a draft with an explicit button, and
  resume any saved draft from the intake page, restoring the exact editing state.
- Drafts are shared server-side so a draft started on one iPad can be resumed on another,
  and survive reloads.

## Non-Goals (out of scope for this iteration)

- Autosave (continuous / from-scratch). Explicit save only.
- A drafts section/count in the main dashboard. Resume happens from the intake page.
- Deep-link resume via `?draft=<id>`. Resume happens through the in-page drawer.
- Robust per-user attribution / auth for `taken_by` (admin auth is a known open gap;
  see Follow-ups).
- Concurrency locking on a shared draft (last write wins in v1).

These all layer cleanly on top of the design below without rework.

---

## Part 1 — Form Reset Fix

### Root cause

In `IntakeForm.onSubmit` success path
([IntakeForm.tsx:146-152](../../../components/admin/intake/IntakeForm.tsx#L146)),
the form resets `customer`, `lines`, `override`, `giftCardCode`, and `payment`, but
**not** `fulfillment` or `channel`. Because `router.replace(?ok=…)` performs a
client-side navigation (no remount), the un-reset state persists into the next order.

### Solution

- Extract the initial state into module-level constants and a `makeInitialFulfillment()`
  factory (a factory, not a constant, so `window.date` is recomputed to "today" on each
  reset rather than frozen at first mount).
- Add a single `resetForm()` that returns **all** form fields to their initial state:
  `channel`, `customer`, `fulfillment`, `lines`, `override`, `giftCardCode`, `payment`,
  and (Part 2) `draftId`. Centralizing this prevents the "forgot a field" class of bug
  from recurring.
- Call `resetForm()` in the `onSubmit` success path (replacing the current scattered
  setters). The success banner is driven by the `?ok=` search param, not component state,
  so it is unaffected and continues to show.
- Wire the currently-dead "Descartar" button (no `onClick` today,
  [IntakeForm.tsx:277-279](../../../components/admin/intake/IntakeForm.tsx#L277)) to
  `resetForm()`.

### Resolved sub-decisions

- **Reset `channel` too:** Yes. Reset to the default `walk-in` for a clean slate identical
  to a fresh page load.

### Behavior after this change

- Create order → form clears completely (including recipient/address/window/card message
  and channel) → success banner remains until dismissed or next create → ready for the
  next order with no reload.
- "Descartar" clears the form to the same clean state.

---

## Part 2 — Server-Side Order Drafts

Decisions locked during brainstorming: **server-side (shared)** storage · **explicit
"Save draft" button** · **resume from a drawer on the intake page**.

### Data approach (architecture decision)

Store the **raw intake form state** as JSON in a new `order_drafts` table — do **not**
reuse the `orders` table. A draft is incomplete by definition (may have no lines, no valid
address), whereas the `Order` type and `intakeSchema` require valid data. Persisting the
raw form shape decouples drafts from order validation and lets us restore the exact
editing state on resume. Rejected alternative: an `orders` row with a `draft` status —
it would force fighting the required-field validations and pollute order queries/metrics.

### Data model

New migration `db/migrations/015_order_drafts.sql` (follows the existing convention:
`CREATE TABLE IF NOT EXISTS`, aligned columns, indexes, auto-discovered + tracked in
`schema_migrations`):

```sql
-- 015_order_drafts.sql — in-progress intake orders saved for later.
CREATE TABLE IF NOT EXISTS order_drafts (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL DEFAULT '',   -- display label (customer/recipient name)
  payload_json TEXT NOT NULL,              -- raw IntakeForm state (DraftPayload)
  item_count   INTEGER NOT NULL DEFAULT 0, -- denormalized for the list row
  total_cents  INTEGER NOT NULL DEFAULT 0, -- denormalized for the list row (best-effort)
  taken_by     TEXT,                       -- who saved it (best-effort; see Follow-ups)
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_drafts_updated_at ON order_drafts(updated_at DESC);
```

### Types — `types/draft.ts`

```ts
// The exact IntakeForm client state, so resume restores editing state 1:1.
export type DraftPayload = {
  version: 1;
  channel: Channel;                 // "walk-in" | "phone" | "whatsapp" | "event"
  customer: CustomerSnapshot;       // from CustomerBlock
  fulfillment: FulfillmentState;    // from FulfillmentBlock (UI shape, not OrderFulfillment)
  lines: CartLine[];
  override: Partial<OrderTotals>;
  giftCardCode: string;
  payment: PaymentState;            // from PaymentBlock
};

export type OrderDraft = {
  id: string;
  label: string;
  itemCount: number;
  totalCents: number;
  takenBy?: string;
  createdAt: string;
  updatedAt: string;
};

// List row = OrderDraft metadata (no payload). Detail = OrderDraft + payload.
export type OrderDraftDetail = OrderDraft & { payload: DraftPayload };
```

Note: `DraftPayload` stores the **UI-shape** `FulfillmentState` / `CustomerSnapshot` /
`PaymentState`, not the converted `OrderFulfillment`. `toOrderFulfillment()` is only
applied at final create time, exactly as today.

### Storage layer

- `lib/draft-row.ts` — `DraftRow` type + `draftToRow` / `rowToDraft` mapping (mirrors
  `order-row.ts`; `payload_json` (de)serialized here).
- `lib/draft-storage.ts` (`import "server-only"`, `ensureSchema()` via `runMigrations()`,
  same pattern as `order-storage.ts`):
  - `saveDraft(input): OrderDraft` — upsert by `id` (`INSERT … ON CONFLICT(id) DO UPDATE`).
    Sets `created_at` on insert, always bumps `updated_at`.
  - `listDrafts(): OrderDraft[]` — metadata only, `ORDER BY updated_at DESC`.
  - `getDraft(id): OrderDraftDetail | null` — includes parsed payload.
  - `deleteDraft(id): void`.

### Validation — `schemas/draft.ts`

A **lax** Zod schema (`draftPayloadSchema`) with all fields optional / `.passthrough()`,
used only to bound payload size and basic types. Deliberately does **not** reuse
`intakeSchema` (which requires a valid, complete order). The API request also carries the
denormalized `label`, `itemCount`, `totalCents` computed client-side.

Denormalized-metadata precision:
- `itemCount` = sum of line quantities (`lines.reduce((n, l) => n + l.qty, 0)`), trivially
  available in `IntakeForm`.
- `totalCents` = best-effort. The exact total is computed inside `CartTotals` today, not
  held in `IntakeForm`. For v1 use the override total if present
  (`override.totalCents`), else a rough subtotal from lines (catalog prices resolved from
  the `products` prop, custom-line `priceCents`), else `0`. This value is only a list hint;
  the payload remains the source of truth. (A cleaner future option: have `CartTotals`
  report computed totals up via a callback — deferred.)

### API — `app/api/admin/orders/drafts/`

`route.ts`:
- `GET` → `{ drafts: OrderDraft[] }` (metadata list, newest first).
- `POST` `{ payload, label, itemCount, totalCents }` → creates, returns `{ id, draft }`.

`[id]/route.ts`:
- `GET` → `{ draft: OrderDraftDetail }` or `404`.
- `PUT` `{ payload, label, itemCount, totalCents }` → updates existing, returns `{ draft }`.
- `DELETE` → `204`/`{ ok: true }`.

(The client uses `POST` when no `draftId` yet and `PUT` when resuming/re-saving an existing
one, so "save and keep working" never duplicates.)

### Client UX (intake)

`IntakeForm.tsx`:
- New `draftId: string | null` state (non-null only when the form currently backs a draft).
- **"Guardar borrador" button**: serializes current state into `DraftPayload` + computes
  `label` / `itemCount` / `totalCents`; `POST` if `draftId` is null (store returned id),
  else `PUT`. Shows a brief saved confirmation. Enabled once there is meaningful content
  (`customer.name`/`customer.phone` non-empty **or** `lines.length > 0`) — i.e. it can be
  saved even when the order is not yet valid to create.
- **"Borradores" button** (header): opens `DraftsDrawer`.
- On successful create in `onSubmit`: if `draftId` is set, `DELETE` that draft, then
  `resetForm()` (which also clears `draftId`). The draft is "converted" into the order.

`DraftsDrawer.tsx` (new):
- Fetches `GET /api/admin/orders/drafts`; lists rows with label, item count, total, and a
  relative "hace X" timestamp (reusing existing datetime formatting).
- Each row: **Retomar** → `GET /…/[id]`, load `payload` into all form state via an
  `onResume(payload, id)` callback on `IntakeForm` (sets every field + `draftId`), close
  drawer. **Eliminar** → `DELETE /…/[id]`, refresh list; if the deleted draft is the one
  currently loaded, clear `draftId`.
- Empty state message when there are no drafts.

Label derivation: `customer.name` → `recipient.name` → "Borrador sin nombre".

### i18n

New keys under `admin_intake` in both `messages/en.json` and `messages/es.json`:
`action_save_draft`, `action_saving_draft`, `draft_saved`, `drafts_button`,
`drafts_title`, `drafts_empty`, `draft_resume`, `draft_delete`, `draft_items`,
`draft_untitled`. (Exact key set may grow slightly during implementation; both locales
stay in sync.)

### Edge cases

- **Incomplete draft** (no lines / partial address): allowed; that is the point.
- **Deleting the currently-loaded draft:** clears `draftId` so a subsequent save creates a
  fresh draft.
- **Two staff editing the same draft:** last write wins (acceptable v1; noted).
- **`taken_by` identity:** stored best-effort from whatever identity is available today
  (may be empty until admin auth lands).

### Testing

- `lib/draft-storage` unit: save (insert), save (upsert/update same id), list order,
  get (with payload round-trip), delete.
- `lib/draft-row` unit: `draftToRow` / `rowToDraft` round-trip incl. payload JSON.
- API route: create → list → get → delete happy path; `404` on missing id.
- Reset: after `onSubmit` success, `fulfillment` and `channel` return to initial (guards
  the Part 1 regression). Approach to match existing test conventions in `tests/unit`.

---

## Files touched

**New**
- `db/migrations/015_order_drafts.sql`
- `types/draft.ts`
- `lib/draft-row.ts`
- `lib/draft-storage.ts`
- `schemas/draft.ts`
- `app/api/admin/orders/drafts/route.ts`
- `app/api/admin/orders/drafts/[id]/route.ts`
- `components/admin/intake/DraftsDrawer.tsx`
- Tests under `tests/unit/` (draft-storage, draft-row, drafts API, reset)

**Modified**
- `components/admin/intake/IntakeForm.tsx` (reset centralization + draft state/buttons/resume)
- `messages/en.json`, `messages/es.json` (new `admin_intake` keys)

---

## Follow-ups (deferred, not in this iteration)

- Autosave of an open draft.
- Drafts section / unread count in the main dashboard.
- Deep-link resume (`?draft=<id>`) for opening a draft from the dashboard.
- Real `taken_by` attribution once admin auth exists (ties into the known admin-auth gap).
- Optional: fix the pre-existing `Order.locale` always-`"en"` bug and hardcoded Spanish
  strings noted during exploration (tracked separately; not part of this scope).
