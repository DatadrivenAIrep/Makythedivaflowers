# Customer CRM — Phase 1 — design

**Status:** approved for plan
**Date:** 2026-07-01
**Owner:** Santiago Cardona
**Phase:** Phase 4 groundwork (CRM), delivered incrementally

## Summary

Turn the customer data the app **already captures** into a real CRM surface. Today the `customers` table stores name, phone, email, buyer/last-delivery addresses, order count, first/last seen, messaging channel, and locale — but there is **no UI to view it**. The only reads are `/api/admin/customers/lookup` (by phone, used by intake autofill) and `/api/admin/customers/search` (free-text).

Phase 1 adds two screens — a **Customers list** (searchable, segmented, with metrics) and a **Customer profile** (page with order history, derived metrics, addresses, editable notes and tags) — plus the small data-model and API surface they need. This serves both jobs the owner asked for equally: *serve a caller/walk-in fast* (rich individual profile) **and** *know my best/at-risk customers* (list, segments, metrics).

**Positioning vs Teleflora:** Teleflora surfaces little relationship intelligence and no bilingual, mobile-native profile. A fast, bilingual customer profile with LTV, repeat/VIP/at-risk badges, notes and tags is a visible quality/trust win built on data we already own (no clearinghouse, no lock-in).

This is **Phase 1** of a phased CRM. Phase 2 (separate spec) adds **important dates** (birthdays/anniversaries) and **structured preferences** (favorite flowers/colors, "no lilies", recipient relationships), which also feed the future **occasion reminders** feature.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| First focus (vs delivery-photo / analytics / reminders) | **Customer profile / CRM** first. |
| Primary job | **Both equally** — fast individual profile AND retention intelligence. Build the balanced backbone (list + profile). |
| Manual enrichment wanted | All four: notes, tags, important dates, structured preferences. |
| Build approach | **Phased.** Phase 1 = list + profile + auto metrics + **notes + tags**. Phase 2 = important dates + structured preferences (→ feeds reminders). |
| Profile presentation | **Full page** (`/admin/customers/[id]`), not a drawer — too much content for a drawer. |
| Notes shape (Phase 1) | **Single free-text field** per customer (a "notepad"), not a timestamped note timeline. |
| VIP threshold | `≥5 orders OR LTV ≥ $500` (tunable constant). |
| At-risk threshold | was recurring (≥2 orders) AND no order in `>90 days` (tunable constant). |
| LTV definition | Sum of **actually collected** cents (`amount_paid_cents`) across the customer's orders. |
| Intake changes | **None** in Phase 1. Notes/tags are edited on the profile page. Intake autofill stays as-is. |

## Goals & non-goals

### In scope (Phase 1)
- Migration `012_customer_crm.sql`: add `customers.notes TEXT`; create `customer_tags(customer_id, tag)` join table.
- `lib/customer-metrics.ts` — pure functions computing per-customer derived metrics + segment classification from that customer's orders. Unit-tested in isolation (no DB).
- Extend `lib/customer-storage.ts` with: list (search + filter + sort + pagination), get-by-id, update notes, add/remove tag, list-all-tags, and an aggregate stats query for the list header.
- API routes:
  - `GET /api/admin/customers` — list (search `q`, `segment`, `tag`, `sort`, cursor `limit`), returns customers + derived metrics + tags, plus header stats.
  - `GET /api/admin/customers/[id]` — profile: customer + derived metrics + tags + notes + their order history.
  - `PATCH /api/admin/customers/[id]` — update editable fields (notes; and contact name/email/messaging/locale).
  - `POST` / `DELETE /api/admin/customers/[id]/tags` — add / remove a tag.
- Screens:
  - `app/[locale]/admin/customers/page.tsx` — **Customers list** (metrics strip, search, segment chips, tag filter, sortable rows).
  - `app/[locale]/admin/customers/[id]/page.tsx` — **Customer profile** (header + badges + editable tags + contact; metrics row; addresses; editable notes; order history opening the existing order drawer; quick actions).
  - Add **"Clientes"** nav entry to `DashboardShell`.
  - Cross-link: contact name in `OrderDetailDrawer` → customer profile.
- i18n: new `admin_customers` namespace in `messages/en.json` + `messages/es.json` (identical keys). Spanish stays default. Covered by the existing `i18n-parity.test.ts`.
- Tests: metrics unit tests; API tests (list/profile/tags/notes); component tests (list + profile) with next-intl mocked.

### Out of scope (deferred to Phase 2 or later)
- Important dates (birthdays/anniversaries) and structured preferences (favorite flowers/colors, dislikes, recipient relationships).
- Occasion reminders / any outbound messaging from the CRM.
- Note timeline with per-note timestamp/author (Phase 1 is a single field).
- Merging duplicate customers; bulk actions; CSV export.
- Editing notes/tags from the intake form.
- Configurable thresholds UI (thresholds are code constants in Phase 1).
- Customer-facing self-service / portal.

## Architecture

### Data model
Existing `customers` (unchanged columns): `id, name, phone (unique), email, last_address_json, buyer_address_json, order_count, first_seen_at, last_seen_at, messaging_channel, locale`.

Migration `012_customer_crm.sql`:
- `ALTER TABLE customers ADD COLUMN notes TEXT;`
- `CREATE TABLE customer_tags (customer_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (customer_id, tag));`
- Index: `CREATE INDEX idx_customer_tags_tag ON customer_tags(tag);` (filter-by-tag) and `idx_customer_tags_customer` on `customer_id`.

Tags are free-form strings; the UI suggests existing tags via `SELECT DISTINCT tag FROM customer_tags`. No separate tag catalog (YAGNI).

### Derived metrics — `lib/customer-metrics.ts`
Pure, DB-free functions operating on a customer plus an array of their orders (each order provides `total_cents`, `amount_paid_cents`, `payment_status`, `created_at`). Given "now" as a parameter for testability.

- `ltvCents` = Σ `amount_paid_cents` over the customer's orders (actually collected).
- `paidOrderCount`, `orderCount` (total).
- `aovCents` = `ltvCents / paidOrderCount` (0 if none).
- `firstOrderAt`, `lastOrderAt` (from orders; fall back to `first_seen_at`/`last_seen_at`).
- `daysSinceLastOrder`.
- `segment` (single, highest-priority label) + non-exclusive booleans, using tunable constants:
  - `VIP` — `orderCount ≥ 5 || ltvCents ≥ 50000`.
  - `AT_RISK` — `orderCount ≥ 2 && daysSinceLastOrder > 90`.
  - `RECURRING` — `orderCount ≥ 2`.
  - `NEW` — `orderCount ≤ 1`.
  - Display precedence for the single badge: `AT_RISK` > `VIP` > `RECURRING` > `NEW` (at-risk and VIP can both show as chips; precedence only picks the primary badge). Constants (`VIP_MIN_ORDERS=5`, `VIP_MIN_LTV_CENTS=50000`, `AT_RISK_DAYS=90`, `RECURRING_MIN_ORDERS=2`) live at the top of the module.

Metrics are computed on read; nothing is denormalized onto `customers` (no sync risk).

### API
All under `requireAdmin(req)`, matching existing admin routes.

- `GET /api/admin/customers?q=&segment=&tag=&sort=&cursor=&limit=`
  - `q`: matches name / phone / email (reuse the existing search predicate).
  - `segment`: one of `new|recurring|vip|at_risk` (computed filter).
  - `tag`: exact tag match via `customer_tags`.
  - `sort`: `ltv|last_order|orders|name` (default `last_order` desc).
  - Returns `{ customers: Array<Customer & metrics & tags>, stats, nextCursor }`.
  - `stats`: `{ total, newThisMonth, repeatRatePct, atRiskCount }` for the header strip.
- `GET /api/admin/customers/[id]` → `{ customer, metrics, tags, notes, orders }` where `orders` is that customer's order rows (id, order_number, created_at, totals, payment_status, fulfillment_status, line summary) newest-first.
- `PATCH /api/admin/customers/[id]` → body may include `notes`, `name`, `email`, `messagingChannel`, `locale`; validated with a Zod schema; returns the updated customer. (Phone is the identity key — not editable here in Phase 1.)
- `POST /api/admin/customers/[id]/tags` `{ tag }` → adds (idempotent). `DELETE /api/admin/customers/[id]/tags` `{ tag }` → removes. Tag normalized (trim, lowercase-compare, max length ~24).

Because `segment` and `ltv`/`last_order` sorting depend on per-customer order aggregates, the list query joins/aggregates against `orders` (grouped by `customer_id`) so filtering and sorting happen in SQL where possible; segment classification that needs "now" (`at_risk`) is applied with a SQL date predicate mirroring the constant. Metric numbers returned to the client come from `customer-metrics.ts` fed by the aggregated columns, keeping one source of truth for thresholds. (Plan will specify the exact SQL.)

### Screens
- **Nav:** add `nav_customers` ("Clientes"/"Customers") to `DashboardShell` between existing items.
- **List** (`/[locale]/admin/customers`): metrics strip (total, nuevos este mes, % repite, en riesgo); search input; segment chips (Todos / Nuevos / Recurrentes / VIP / En riesgo); tag filter; sortable rows (nombre, teléfono, badges+tags, nº órdenes, LTV, última compra relative). Row → profile.
- **Profile** (`/[locale]/admin/customers/[id]`, full page):
  - Header: name; primary badge + chips (VIP / En riesgo); **editable tags**; contact (phone → `tel:` + WhatsApp link, email); messaging channel + locale.
  - Metrics row: LTV, ticket promedio, nº órdenes, primera compra, última compra (hace X días).
  - Addresses: buyer address + last delivery address (Google Maps link).
  - **Notes**: editable textarea with an explicit Save (PATCH).
  - Order history: their orders (fecha, nº, total, estado pago/entrega, resumen de items); clicking opens the **existing** `OrderDetailDrawer`.
  - Quick actions: **"Nueva orden para este cliente"** (navigates to intake pre-filled via the existing lookup-by-phone autofill), WhatsApp, llamar.
- **Cross-link:** in `OrderDetailDrawer`, the contact name links to `/admin/customers/[customerId]` when the order has a linked `customer_id`.

### Dates / i18n
Reuse `lib/format-datetime.ts` (`formatDate`/`formatDateTime`) for all dates. New `admin_customers` namespace added to both message files with identical keys; Spanish default; parity enforced by `tests/unit/i18n-parity.test.ts`.

## Testing

- `lib/customer-metrics.test.ts` — LTV/AOV/segment classification across cases: new (0–1 order), recurring, VIP by orders, VIP by LTV, at-risk (recurring + >90d), boundary values at each threshold; "now" injected.
- API tests (in-memory SQLite, `vi.stubEnv("SQLITE_FILE", ":memory:")`):
  - list: search, each segment filter, tag filter, each sort, pagination, stats shape.
  - profile: returns metrics + tags + notes + order history for a seeded customer with several orders.
  - PATCH notes/contact; tag add is idempotent; tag delete removes.
- Component tests (next-intl mocked to return keys, `useLocale: () => "es"`): list renders segment chips + a row; profile renders metrics, tags, notes field, and an order-history row.
- `i18n-parity.test.ts` continues to gate en/es key completeness.

## Implementation approach

Mechanical + moderately wide but a single cohesive subsystem — one plan. Suggested task order: (1) migration, (2) `customer-metrics.ts` + tests, (3) storage functions + tests, (4) API routes + tests, (5) i18n keys, (6) list page, (7) profile page + order-history/drawer reuse + cross-link, (8) nav entry, (9) component tests, (10) full-suite + preview verification in `/es` and `/en`. Execute via subagent-driven-development; the parity test + `tsc` + tests gate each task.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Segment/sort logic duplicated between SQL (filtering) and `customer-metrics.ts` (display) drifts | Thresholds are named constants in one module; the plan specifies the SQL predicates to mirror them; tests assert both agree on boundary cases. |
| Denormalized metrics going stale | Nothing is denormalized — all metrics computed on read from `orders`. |
| Missing an en/es translation → raw key in UI | `i18n-parity.test.ts` + a preview pass in both locales. |
| Large customer/order tables make the list slow | Cursor pagination + SQL aggregation + indexes on `customer_tags`; orders already indexed by `customer_id` (verify in plan, add index if missing). |
| Profile page duplicates order-rendering logic | Reuse the existing `OrderDetailDrawer` for order detail; the history list only renders a compact row. |
| Scope creep from Phase 2 items | Important dates, structured preferences, reminders, note-timeline explicitly deferred. |

## File map

New files:
- `db/migrations/012_customer_crm.sql`
- `lib/customer-metrics.ts`, `lib/customer-metrics.test.ts`
- `app/api/admin/customers/route.ts` (GET list)
- `app/api/admin/customers/[id]/route.ts` (GET profile, PATCH)
- `app/api/admin/customers/[id]/tags/route.ts` (POST/DELETE)
- `app/[locale]/admin/customers/page.tsx`
- `app/[locale]/admin/customers/[id]/page.tsx`
- `components/admin/customers/CustomersList.tsx`
- `components/admin/customers/CustomerProfile.tsx`
- `components/admin/customers/CustomerOrderHistory.tsx`
- Their component tests under `tests/unit/...`
- API tests under `tests/unit/...`

Modified files:
- `lib/customer-storage.ts` — list/get-by-id/update/tags/stats functions (+ tests).
- `messages/en.json`, `messages/es.json` — add `admin_customers` (identical keys) + `admin_dashboard.nav_customers`.
- `components/admin/dashboard/DashboardShell.tsx` — add "Clientes" nav entry.
- `components/admin/dashboard/OrderDetailDrawer.tsx` — link contact name to the customer profile.
