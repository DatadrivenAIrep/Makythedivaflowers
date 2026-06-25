# Intake redesign (B) + buyer address + editable card message — design

**Status:** approved for plan
**Date:** 2026-06-25
**Owner:** Santiago Cardona
**Phase:** 3, sub-3 (intake UX polish) + Phase 4 seed (customer CRM data — buyer address)

## Summary

Three cohesive changes to the staff intake/admin order experience:

1. **Editable card message** — close the gap where the order **edit** drawer cannot modify the card message. The backend already supports it (`OrderEditPatch.cardMessage`, `patchSchema`, `editOrder`/`diffOrders`); only the UI is missing. We fix it at the source by moving the card-message textarea **into `FulfillmentBlock`**, so both the intake form and the edit drawer get it from one component.
2. **Buyer address** — capture the buyer's own address (distinct from the recipient/delivery address), persist it on the `customers` record, and auto-fill it when that phone returns. Optional (never blocks intake), with a "usar como dirección de entrega" shortcut for when the buyer is also the recipient.
3. **Intake UI upgrade (Direction B)** — restructure the intake form into clean section cards (Cliente · Destinatario y entrega · Productos · Pago y total) at the polished bar set by the gift-cards admin UI, single-screen for fast iPad capture, and replace the three `window.prompt()` price overrides in the cart with **inline editable totals**.

Spanish-only admin copy. Reuses existing building blocks (`AddressAutocomplete`, `FulfillmentBlock`, `ProductPicker`, `PaymentBlock`) and the design tokens in `styles/tokens.css`.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Visual direction | **B — Tarjetas y jerarquía**: single-screen, section-card layout, gift-cards polish, iPad-friendly. (Not A = too modest; not C = stepper slows expert capture.) |
| Buyer address behavior | **Optional + persisted + auto-filled** on phone return. Includes a "usar como dirección de entrega" link. Never required, never blocks submit. |
| Card-message fix location | Move the textarea **into `FulfillmentBlock`** (owns `cardMessage` in `FulfillmentState`). Fixes the edit-drawer gap, implements the B grouping, and removes the orphaned intake textarea — one change, three wins. |
| Card message for in-store | Card message is editable for **all** methods (including in-store), so its textarea renders outside the method-specific block. |
| Price overrides | Replace `window.prompt()` (×3 in `CartSummary`) with **inline editable number fields** showing override state + a reset affordance. |
| Cart split | Split `CartSummary` into `CartLines` (line list, under "Productos") and `CartTotals` (editable totals, under "Pago y total") — smaller focused components matching the approved mockup. |

## Goals & non-goals

### In scope
- New migration `011`: `buyer_address_json` column on `customers`.
- `customer-storage.ts`: `buyerAddress` on `Customer` + `CustomerRow` + `UpsertInput`; persist in `upsertOnOrder` (INSERT + COALESCE UPDATE).
- Intake schema: optional `customer.buyerAddress` (reuse the existing `address` zod shape).
- Intake POST: pass `buyerAddress` to `upsertOnOrder`.
- `CustomerBlock`: capture buyer address via reused `AddressAutocomplete`, pre-fill from phone lookup, "usar como dirección de entrega" link; `CustomerSnapshot` gains `buyerAddress`.
- Move card-message textarea into `FulfillmentBlock` (rendered for all methods); remove the standalone textarea from `IntakeForm`; `OrderEditForm` inherits it automatically.
- Restructure `IntakeForm` into Direction-B section cards; responsive (2-col → stacked on iPad portrait); polish to gift-cards tokens.
- Split `CartSummary` → `CartLines` + `CartTotals`; `CartTotals` uses inline editable number fields instead of `window.prompt()`, with override + reset.
- Tests for storage, schema, intake POST persistence, and components.

### Out of scope (deferred)
- Buyer address on the **web checkout** form — staff intake only for now.
- A full customers CRM view / editing a customer's buyer address outside an order — Phase 4.
- Validating buyer↔delivery address consistency, or geocoding the buyer address for delivery pricing (buyer address never drives pricing; only the delivery address does).
- Direction C (stepper) and any change to the order **source** channel tabs.
- Reworking `PaymentBlock`, `ProductPicker` internals beyond wrapping them in the new cards.
- Mandatory address on delivery (still server-validated as today).

## Architecture

### Migration — `db/migrations/011_buyer_address.sql`

```sql
ALTER TABLE customers ADD COLUMN buyer_address_json TEXT;
```

Additive, nullable; no backfill. `last_address_json` (recipient/delivery history) is untouched and keeps its current meaning.

### Customer storage — `lib/customer-storage.ts`

- `Customer` gains `buyerAddress?: Address`; `CustomerRow` gains `buyer_address_json: string | null`.
- `rowToCustomer`: parse `buyer_address_json` → `buyerAddress`.
- `UpsertInput` gains `buyerAddress?: Address`.
- `upsertOnOrder`:
  - UPDATE: add `buyer_address_json = COALESCE(?, buyer_address_json)` (preserve if not provided — same pattern as `last_address_json`).
  - INSERT: add the column + value.
- `getByPhone` automatically returns `buyerAddress` (via `rowToCustomer`).

So the existing **lookup** endpoint (`GET /api/admin/customers/lookup`) returns `buyerAddress` for free (it returns the full `Customer`).

### Intake schema + POST

- `schemas/intake.ts`: the `customer` object gains `buyerAddress: address.optional()` (reusing the existing `address` zod object). Distinct from `fulfillment.address` (recipient).
- `app/api/admin/orders/route.ts` (POST): pass `buyerAddress: input.customer.buyerAddress` into the `upsertOnOrder({...})` call. (Recipient delivery address still flows separately into `last_address_json` exactly as today.)

### Reuse / auto-fill

- `CustomerBlock`'s existing phone-lookup effect already pulls the matched customer. Extend it to also set `buyerAddress` into form state when the field is empty (don't clobber typed input).
- `CustomerSnapshot` gains `buyerAddress?: Address`.
- "usar como dirección de entrega" link copies `buyerAddress` → the fulfillment address and sets `method = "delivery"` (reuses the existing `onApplyAddress` channel into `IntakeForm`).

### Card message — single source in `FulfillmentBlock`

- Add a card-message `<textarea>` to `FulfillmentBlock`, bound to `value.cardMessage` / `onChange`, rendered for **all** methods (outside the `method !== "in-store"` block).
- `IntakeForm`: delete its standalone card-message textarea (now owned by `FulfillmentBlock`).
- `OrderEditForm`: no change needed beyond removing any now-redundant handling — it already passes `cardMessage` through `FulfillmentBlock` → `toOrderFulfillment` → patch; with the textarea present, staff can finally edit it. The drawer read-only view already shows the card message.

### Intake restructure — Direction B

`IntakeForm` becomes four section cards inside a responsive 2-column grid (`grid-cols-1 lg:grid-cols-2`, stacks on iPad portrait):

| Card | Contents |
| ---- | -------- |
| **Cliente** | `CustomerBlock`: phone + name + email, `ChannelPicker`, **buyer address** (`AddressAutocomplete` + "usar como dirección de entrega"), recurring-customer hint. |
| **Destinatario y entrega** | `FulfillmentBlock`: method segmented control, recipient, delivery address, date/slot, **card message**. |
| **Productos** | `ProductPicker` + `CartLines` (the line list with remove). |
| **Pago y total** | `CartTotals` (editable subtotal/delivery/tax/total), `PaymentBlock`, gift-card input. |

Each card: `rounded-xl border border-mute-200 bg-white p-…` with a serif (`font-display`) section header and the gift-cards label/spacing conventions. The channel tabs (walk-in/phone/whatsapp/event) and success banner stay in the header. Footer (Descartar / Guardar) unchanged in behavior.

### Cart split + inline totals

- `CartSummary` is split:
  - `CartLines` — `{ lines, onChangeLines }` — the existing line-item list + remove; rendered under "Productos".
  - `CartTotals` — `{ lines, fulfillmentMethod, deliveryZip, deliveryCity, override, onOverride }` — computes via `resolveOrderTotals`/`cartSubtotalCents` (unchanged logic) and renders **inline editable** rows.
- Inline edit: each amount renders as a button showing the dollar value; clicking swaps it for an `<input inputmode="decimal">` prefilled with the current dollars. On Enter/blur, parse → `onOverride`. Overridden rows show in `text-rouge` with a small "↺ restablecer" that clears that override back to the computed value. The unresolved-delivery case keeps its "set fee" affordance but as an inline field, not a prompt.

## UI structure summary

- Same data, same submit contract (`POST /api/admin/orders` body unchanged except `customer.buyerAddress?`).
- New: buyer-address field (Cliente card), card-message field now in Destinatario y entrega, inline-editable totals (Pago y total).
- Edit drawer (`OrderEditForm`) inherits the card-message field via `FulfillmentBlock`; its layout can stay as-is (it already stacks the blocks) — only the new textarea appears.

## Testing (TDD, `tests/unit/`)

- `customer-storage.test.ts` — `upsertOnOrder` persists `buyerAddress` on insert; preserves it on update when omitted (COALESCE); `getByPhone` round-trips it.
- `intake schema` — accepts a payload with `customer.buyerAddress`; accepts without it (optional); rejects a malformed buyer address.
- `api-admin-orders` (POST) — creating an order with `customer.buyerAddress` persists it on the customer and is returned by the lookup endpoint.
- Component: `FulfillmentBlock` renders + edits the card-message textarea for delivery AND in-store; `CartTotals` inline edit sets an override and reset clears it (no `window.prompt`); `CustomerBlock` "usar como dirección de entrega" fires `onApplyAddress` with the buyer address; buyer address pre-fills from a mocked lookup.
- Regression: existing `IntakeForm`, `CartSummary`-derived, and `OrderDetailDrawer` tests updated for the split/move.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Moving the card-message textarea breaks intake tests that target the old location | Update those tests; the field still exists, just inside `FulfillmentBlock`. |
| Splitting `CartSummary` breaks its existing tests | Re-point tests to `CartLines`/`CartTotals`; keep the totals math identical (reuse `resolveOrderTotals`). |
| Buyer address confused with recipient/last-delivery address | Distinct labels ("Dirección del comprador" vs "Dirección de entrega"), separate state, separate storage column. Buyer address never drives delivery pricing. |
| Inline totals lose the "override is active" signal that prompt() implied | Override rows render in rouge with an explicit "↺ restablecer". |
| iPad portrait layout regressions | Responsive grid (`lg:grid-cols-2`, stacks below), verified in the preview at tablet width. |

## File map

New files:
- `db/migrations/011_buyer_address.sql`
- `components/admin/intake/CartLines.tsx`
- `components/admin/intake/CartTotals.tsx`
- `tests/unit/components/CartTotals.test.tsx`
- `tests/unit/customer-storage-buyer-address.test.ts`

Modified files:
- `lib/customer-storage.ts` — `buyerAddress` on type/row/upsert.
- `schemas/intake.ts` — optional `customer.buyerAddress`.
- `app/api/admin/orders/route.ts` — pass `buyerAddress` to `upsertOnOrder`.
- `components/admin/intake/CustomerBlock.tsx` — buyer-address field + pre-fill + "use as delivery"; `CustomerSnapshot` += `buyerAddress`.
- `components/admin/intake/FulfillmentBlock.tsx` — render card-message textarea for all methods.
- `components/admin/intake/IntakeForm.tsx` — Direction-B section cards; remove standalone card-message textarea; wire buyer address; use `CartLines` + `CartTotals`.
- `components/admin/intake/CartSummary.tsx` — split into `CartLines` + `CartTotals` (or replaced by them).
- `components/admin/dashboard/OrderEditForm.tsx` — confirm card message now editable via `FulfillmentBlock` (remove redundant code if any).
- `tests/unit/components/CartSummary.test.tsx`, `tests/unit/components/OrderDetailDrawer.test.tsx`, intake tests — updated for the move/split.
