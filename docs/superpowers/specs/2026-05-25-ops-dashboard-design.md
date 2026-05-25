# Ops dashboard — design (Phase 3, sub-1)

**Status:** approved for plan
**Date:** 2026-05-25
**Owner:** Santiago Cardona
**Phase:** 3 of 4 (sub-project 1 — dashboard only; delivery route, driver UI, Calendar sync, day-before reminders are Phase 3 sub-projects 2-N)

## Summary

Operational dashboard at `/[locale]/admin/dashboard` with two tabs:

- **Bandeja** — live action queue (5 triage rules) over a chronological 24-hour feed. New orders ping with sound on iPad and a flashing title on desktop.
- **Libro de órdenes** — searchable, filterable, paginated history of every order in SQLite.

Same UI on iPad (Maky in-shop) and desktop (Santi remote). Read-mostly with a focused set of inline actions: mark paid manually, advance fulfillment status, resend payment link or confirmation, contact customer, add internal note. Editing items/addresses and Stripe refunds are deferred.

## Roadmap context

| Phase | Scope |
| ----- | ----- |
| 1 | iPad intake form + SQLite migration + customers seed — shipped |
| 2 | Stripe payment links + SMS/WhatsApp customer notifications — spec in review |
| **3, sub-1** | **Ops dashboard (this spec)** |
| 3, sub-2+ | Delivery route by zone, driver mobile UI with proof-of-delivery, Google Calendar sync, day-before reminders, automated DB backup |
| 4 | CRM UI on customers, one-tap reorder, daily close + QuickBooks/CSV export, metrics |

## Goals & non-goals

### In scope
- Two-tab dashboard at `/[locale]/admin/dashboard` (Bandeja + Libro).
- Bandeja: pendientes queue (5 triage rules) + chronological 24h feed.
- Libro: free-text search, date range, payment status, fulfillment status, source, fulfillment method filters; cursor-based pagination.
- Order detail drawer (60% width desktop / full-screen iPad) with timeline of events, messages log, internal notes input.
- Inline actions: mark paid manual, advance fulfillment status, resend payment link, resend confirmation, contact customer (WhatsApp/call deep links), append internal note.
- Real-time via 20s polling with visibility-aware pause; sound + title-flash on new order (iPad), title-flash only (desktop).
- `order_acknowledgments` table to drive the "web order seen" triage rule.
- Composite indexes on `orders` to keep filter queries fast.
- Spanish-only copy (no i18n) — operational tool, Maky-only audience.

### Out of scope (deferred)
- Edit order items, address, time, card message — Phase 3 sub-2+.
- Cancel order / Stripe refund — Phase 3 sub-2+ (sensitive, low frequency, needs its own UX).
- Driver mobile UI with proof-of-delivery photo — Phase 3 sub-2.
- Delivery route grouped by zone — Phase 3 sub-2.
- Google Calendar sync — Phase 3 sub-2.
- Day-before delivery reminders — Phase 3 sub-2 (waits for Phase 2 messaging).
- Automated SQLite backup cron — Phase 3 sub-3.
- Shopify-style metrics (revenue, top products, conversion) — Phase 4.
- Customers CRM view — Phase 4.
- Export CSV — Phase 4.
- Bilingual dashboard UI — only customer-facing surfaces stay bilingual.
- FTS5 search — `LIKE '%term%'` is enough until volume justifies a switch.
- WebSockets / SSE — polling is sufficient at current volume.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Primary jobs | (A) live inbox + (C) full searchable ledger. No metrics dashboard. |
| Users / device | Maky on iPad in shop + Santi on desktop remote. Same UI, responsive. |
| New-order notification | Sound + badge on iPad, badge/title-flash on desktop, no system push. |
| Inbox model | Hybrid: pending queue on top + chronological 24h feed below. |
| Pending triage rules | 5 rules (see Architecture). Thresholds: web "ack" persists until detail opened; intake-unpaid > 1h; same-day delivery/pickup gates. |
| Allowed actions | Mark paid manual, change fulfillment, resend messages, contact, internal note. Defer edit + refund. |
| Navigation | Tabs at top (no sidebar). |
| Row density | Tarjeta media (2-3 lines + contextual action buttons). |
| Ledger filters | All proposed filters; default view = last 30 days; cursor-based pagination. |
| Real-time mechanism | 20s polling with visibility-aware pause + manual refresh. |
| Persistence of "ack" | Automatic on detail open. |
| Dashboard language | Spanish only (hardcoded copy). |
| Sound asset | New `/public/sounds/new-order.mp3` (~0.4s soft chime), generated and committed. |
| Disabled "Export CSV" placeholder | Removed — keep UI clean. |

## Architecture

### Routes (Next.js App Router, locale group)

| Route | Purpose |
| ----- | ------- |
| `/[locale]/admin` | Redirects to `/[locale]/admin/dashboard` (was: empty). |
| `/[locale]/admin/dashboard` | Bandeja tab (default). |
| `/[locale]/admin/dashboard/ledger` | Libro tab — filter state encoded in query string for shareable URLs. |
| `/[locale]/admin/intake` | Unchanged. |
| `/[locale]/admin/login` | Unchanged. |

Auth is the existing cookie session enforced by middleware on `/admin/*`.

### API endpoints (new — all under `app/api/admin/orders/`)

| Method + path | Body / Query | Returns |
| ------------- | ------------ | ------- |
| `GET /api/admin/orders` | `q`, `from`, `to` (ISO), `paymentStatus[]`, `fulfillmentStatus[]`, `source[]`, `fulfillmentMethod[]`, `limit` (default 50), `cursor` | `{ orders: Order[], nextCursor: string \| null, approxTotal: number }` |
| `GET /api/admin/orders/queue` | none | `{ items: PendingItem[], generatedAt: string }` — output of the 5 triage rules, with a `reason` discriminator per item |
| `GET /api/admin/orders/feed` | `sinceHours` (default 24) | `{ events: FeedEvent[] }` — normalized chronological stream (created, paid, status_changed) |
| `GET /api/admin/orders/[id]` | none | `{ order, customer, messages, notes }` |
| `PATCH /api/admin/orders/[id]/payment` | `{ method: "cash"\|"zelle"\|"venmo"\|"check", note?: string }` | `{ order }` — idempotent if already paid |
| `PATCH /api/admin/orders/[id]/fulfillment` | `{ status: "printed"\|"out_for_delivery"\|"delivered" }` | `{ order }` — validates legal transition |
| `POST /api/admin/orders/[id]/resend` | `{ kind: "payment_link"\|"confirmation" }` | `{ messageId }` |
| `POST /api/admin/orders/[id]/notes` | `{ text: string }` | `{ note }` — append-only with timestamp + author |
| `POST /api/admin/orders/[id]/ack` | none | `{ acknowledgedAt }` — called automatically by the detail drawer |

All endpoints require the admin session cookie; 401 otherwise.

### Pending queue — the 5 triage rules

Implemented in `lib/order-queue.ts` as `getPendingQueue(): Promise<PendingItem[]>`. Each item has a discriminated `reason` so the UI knows which contextual actions to render.

| Reason | Condition (SQL-shaped) |
| ------ | ---------------------- |
| `web_unacknowledged` | `source = 'web'` AND `id NOT IN (SELECT order_id FROM order_acknowledgments)` AND `created_at >= now() - 72h` |
| `intake_unpaid_stale` | `source != 'web'` AND `payment_status = 'pending'` AND `created_at <= now() - 1h` AND `stripe_checkout_session_id IS NOT NULL` |
| `delivery_today_undispatched` | `fulfillment_method = 'delivery'` AND `window_date = today()` AND `fulfillment_status NOT IN ('out_for_delivery','delivered','canceled')` |
| `delivery_today_unpaid` | `fulfillment_method = 'delivery'` AND `window_date = today()` AND `payment_status = 'pending'` — rendered with red border (high urgency) |
| `pickup_today_unpaid` | `fulfillment_method = 'pickup'` AND `window_date = today()` AND `payment_status = 'pending'` |

One order can match multiple reasons; the queue dedupes by `id` and keeps the highest-urgency reason for the visual treatment (urgency rank: `delivery_today_unpaid > pickup_today_unpaid > delivery_today_undispatched > intake_unpaid_stale > web_unacknowledged`). Contextual action buttons come from the highest-rank reason.

The web-unack 72h cap exists so very old un-touched web orders don't sit in the queue forever; they'll still surface in the Libro.

### Feed — `lib/order-feed.ts`

`getRecentFeed(sinceHours = 24)` reads `orders` and emits a normalized chronological stream of three event kinds:

| Kind | Source timestamp | Label format |
| ---- | ---------------- | ------------ |
| `created` | `created_at` | `"Orden {source}: {recipient} · ${total}"` |
| `paid` | `paid_at` (non-null and within window) | `"Pago confirmado: {recipient} · ${total}"` |
| `status_changed` | `updated_at` (when fulfillment status moved) | `"{status_label}: {recipient}"` — derived from a status_history join if available |

Phase-3 simplification: status_changed events are reconstructed by comparing `updated_at` against `created_at` and current `fulfillment_status` — full status history table is deferred. If precision matters later, add `order_status_history` table.

### Mutations — `lib/order-mutations.ts`

| Function | Behavior |
| -------- | -------- |
| `markPaidManual(orderId, { method, note })` | If `payment_status = 'paid'`, no-op (returns existing). Else: set `payment_status='paid'`, `payment_method=method`, `paid_at=now()`. Append `"[paid manually as {method}] {note}"` to `internal_notes`. Triggers `dispatchPaymentConfirmed` and `notifyOrderPaid` (email if address on file) — same paths the Stripe webhook uses. |
| `changeFulfillmentStatus(orderId, status)` | Validates transition: `pending → printed → out_for_delivery → delivered`. Skipping forward is allowed (e.g., `pending → out_for_delivery`); going backward returns 400. `canceled` not reachable from this endpoint (it stays in deferred refund flow). |
| `appendInternalNote(orderId, text)` | Prepends `"[ISO timestamp · {author}] "` and appends to `internal_notes` with a newline separator. Author = admin session user. |
| `acknowledgeOrder(orderId, by)` | Insert into `order_acknowledgments` ignoring conflicts. |

All mutations write through the existing `saveOrder` dual-write (SQLite + legacy JSON mirror) to keep parity with current behavior.

### Real-time — client polling

A single `useDashboardPolling()` hook lives in `components/admin/dashboard/`. It:

1. Fetches `/queue` and `/feed` every 20 seconds when `document.visibilityState === 'visible'`.
2. On hidden, pauses; resumes immediately on visible.
3. Diffs new payload vs previous snapshot by `order.id`; new IDs trigger `onNewOrder(items)`.
4. `onNewOrder` plays the chime (iPad) + flashes title `"(N) Diva · Bandeja"` for 5s (both devices) + animates new cards with a slide-in + temporary highlight.

iPad detection: a single `isIpadLike` helper checks `navigator.userAgent` for `iPad|Macintosh.*Touch`. Audio unlock: first user interaction in the dashboard plays a silent buffer to satisfy iOS Safari's autoplay gesture requirement.

### SQLite migration

One new migration in `lib/db-migrate.ts`:

```sql
CREATE TABLE IF NOT EXISTS order_acknowledgments (
  order_id TEXT PRIMARY KEY,
  acknowledged_at TEXT NOT NULL,
  acknowledged_by TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_window_date ON orders(window_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
```

## UI structure

### Tab shell

`components/admin/dashboard/DashboardShell.tsx` renders:
- Sticky header: Diva mini-logo · tabs (`Bandeja` / `Libro` / `+ Nueva orden` → links to `/admin/intake`) · last-updated timestamp · refresh button.
- Tab content area: routes do the actual rendering (Bandeja at `/admin/dashboard`, Libro at `/admin/dashboard/ledger`).

### Bandeja

Two collapsible sections, default expanded:

1. **Pendientes (N)** — tarjeta media list. Empty state: `"✓ Todo al día"`. Cards render based on `reason` (contextual action buttons per reason as listed above).
2. **Feed (N eventos)** — 1-line items: `HH:MM — {label}`. Click opens detail drawer.

### Libro de órdenes

1. **Sticky filter bar** — free-text input + collapsible filter panel (date chips, multiselect chips for status/source/method). Active filters appear as removable chips below input. Filter state ↔ URL query string.
2. **Tarjeta media list** — same component as Bandeja.
3. **Cursor pagination** — footer `"Mostrando 50 de ~N · Cargar 50 más"`. `~N` from a separate `COUNT(*)` with the same WHERE clause.
4. **Empty state** — `"Sin órdenes que coincidan"` + `"Limpiar filtros"` button.

### Order detail drawer

`components/admin/dashboard/OrderDetailDrawer.tsx`. 60% width on desktop, full-screen modal on iPad. Sections:

1. **Customer** — name, phone (tel: link), email (mailto:), messaging channel preference.
2. **Items** — line list with thumbnails when available, card message in a highlighted block.
3. **Fulfillment** — method, address (Maps deep link), date + slot.
4. **Totals** — subtotal / delivery / tax / total.
5. **Status timeline** — vertical timeline: `created → link sent → paid → printed → out for delivery → delivered`, with timestamps on each step and grayed-out future steps.
6. **Messages log** — list of every outbound SMS / WhatsApp / email for this order with copy, channel, timestamp (reads from the `messages` table introduced in Phase 2).
7. **Internal notes** — input + append-only log.
8. **Floating action bar** at the bottom: contextual actions based on current state (mark paid, advance fulfillment, resend message, contact).

Close: Esc, click-outside, swipe-down (iPad).

Opening the drawer for an order with `source = 'web'` that has no row in `order_acknowledgments` triggers `POST /api/admin/orders/[id]/ack` in the background.

## Testing

Following the project's TDD discipline.

### Unit tests (`tests/unit/`)

- `lib/order-queue.test.ts` — each of the 5 triage rules in isolation; combination cases dedupe + urgency ranking; web-unack 72h cap.
- `lib/order-feed.test.ts` — chronological order, 24h window, dedup, label rendering.
- `lib/order-mutations.test.ts` — `markPaidManual` idempotent + appends note + triggers downstream; `changeFulfillmentStatus` legal/illegal transitions; `appendInternalNote` formatting.
- `lib/order-acknowledgments.test.ts` — insert + conflict-ignore + query.

### API route tests

- `GET /api/admin/orders` — each filter individually, combinations, cursor pagination correctness, `approxTotal` accuracy.
- `GET /api/admin/orders/queue` — same fixtures as `order-queue.test.ts`, end-to-end.
- `PATCH /payment` and `PATCH /fulfillment` — 200, 409 idempotent, 400 invalid transition, 401 unauthenticated.
- `POST /resend` — calls the right dispatcher per `kind`.

### Component tests (Vitest + Testing Library)

- `PendingCard` — renders correct buttons per `reason`; click handlers fire mutations.
- `LedgerFilters` — query-string round-trip; chip add/remove updates URL.
- `OrderDetailDrawer` — renders timeline; opens & calls `/ack` for unacknowledged web orders.

### Manual smoke E2E (not automated this phase)

1. Open dashboard on iPad, audio-unlock via first tap.
2. Trigger a test web order in another window → confirm chime + title flash + new card animation in <25s.
3. Click new card → drawer opens → ack fires → card disappears from queue on next poll.
4. Mark a pending intake as paid manually → moves to "paid" in feed, payment-confirmation message fires.
5. Filter Libro by `source = web` + `paymentStatus = paid` last 7 days → results match.

## Deployment

Single PR to `main`. No feature flag — the dashboard replaces the empty `/admin` landing.

Migration runs at boot via the existing `lib/db-migrate.ts` pattern. No new environment variables.

Sound asset committed at `public/sounds/new-order.mp3`.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| iOS Safari blocks autoplay audio | Silent audio-unlock buffer played on first user tap inside dashboard. Visual flash still works if unlock fails. |
| Polling drains iPad battery in background | Pause polling when `document.hidden`; resume on `visibilitychange`. |
| Race between manual mark-paid and Stripe webhook | Existing idempotent guard (`if paymentStatus === 'paid' return`) covers it. Note in both code paths links to the other. |
| Internal notes grow unboundedly | Append-only is fine at expected scale (<2KB/order over a year). Truncation logic deferred. |
| Triage rule thresholds need tuning | Constants in `lib/order-queue.ts` (e.g., `INTAKE_UNPAID_STALE_HOURS = 1`, `WEB_UNACK_CAP_HOURS = 72`) — easy to tweak without touching SQL. |

## Open decisions resolved during brainstorm

1. Dashboard language → Spanish only.
2. Ack of web orders → automatic on detail open.
3. Sound asset → generate + commit `new-order.mp3` (replaceable later).
4. Export CSV placeholder → removed.

## File map

New files:

- `app/[locale]/admin/page.tsx` (replace existing redirect)
- `app/[locale]/admin/dashboard/page.tsx`
- `app/[locale]/admin/dashboard/ledger/page.tsx`
- `app/api/admin/orders/route.ts` (extend — add GET handler)
- `app/api/admin/orders/queue/route.ts`
- `app/api/admin/orders/feed/route.ts`
- `app/api/admin/orders/[id]/route.ts` (extend — add GET handler)
- `app/api/admin/orders/[id]/payment/route.ts`
- `app/api/admin/orders/[id]/fulfillment/route.ts`
- `app/api/admin/orders/[id]/resend/route.ts`
- `app/api/admin/orders/[id]/notes/route.ts`
- `app/api/admin/orders/[id]/ack/route.ts`
- `lib/order-queue.ts`
- `lib/order-feed.ts`
- `lib/order-mutations.ts`
- `lib/order-acknowledgments.ts`
- `components/admin/dashboard/DashboardShell.tsx`
- `components/admin/dashboard/PendingCard.tsx`
- `components/admin/dashboard/FeedItem.tsx`
- `components/admin/dashboard/LedgerFilters.tsx`
- `components/admin/dashboard/OrderDetailDrawer.tsx`
- `components/admin/dashboard/useDashboardPolling.ts`
- `public/sounds/new-order.mp3`
- `tests/unit/order-queue.test.ts`
- `tests/unit/order-feed.test.ts`
- `tests/unit/order-mutations.test.ts`
- `tests/unit/order-acknowledgments.test.ts`
- `tests/unit/api/admin-orders.test.ts`
- `tests/unit/api/admin-orders-queue.test.ts`
- `tests/unit/api/admin-orders-mutations.test.ts`
- `tests/unit/components/PendingCard.test.tsx`
- `tests/unit/components/LedgerFilters.test.tsx`
- `tests/unit/components/OrderDetailDrawer.test.tsx`

Modified files:

- `lib/db-migrate.ts` — add `order_acknowledgments` table + four indexes.
- `lib/order-storage.ts` — add `listOrders({ filters, cursor, limit })` query helper.
