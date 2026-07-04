# Metrics Panel — design

**Status:** approved for plan
**Date:** 2026-07-04
**Owner:** Santiago Cardona
**Phase:** Phase 4 (metrics) — independent of the CRM increments, same admin dashboard

## Summary

A read-only **"Métricas" dashboard tab** that turns the order/customer data already in SQLite into an at-a-glance business picture: revenue (collected), outstanding balance, order count, average order value, repeat-customer rate, a 12-month revenue trend, top products, and revenue by delivery zone. KPIs and tables recompute for a selected time range (Last 30/90 days · This year · All time); the monthly trend always spans the last 12 months. Nothing is written — pure aggregation over existing tables. Charts are hand-rolled SVG sparklines (no charting library) to keep it fast and low-risk.

**Positioning:** the owner currently has no revenue/product visibility inside the admin — only the per-order ledger. This gives Maky/Santi the numbers a florist actually acts on (what sold, where deliveries go, how much is uncollected) without any external analytics tool.

## Decisions captured during brainstorm

| Decision | Choice |
| -------- | ------ |
| Visualization level | **KPI cards + ranked tables + hand-rolled SVG sparklines.** No chart library. |
| Revenue definition | **Collected** (`amount_paid_cents`), consistent with Phase 1 LTV, **plus a separate "outstanding balance" KPI** (`total_cents - amount_paid_cents` over not-fully-paid, non-canceled orders). |
| Time bucketing | Group everything by **`created_at`** (always present; consistent with the ledger and Phase 1). Documented trade-off: an order created in one month but paid later still counts toward its creation month. |
| Compute model | **Compute-on-read** — SQL aggregates per request, no materialized/denormalized metrics (florist scale; no staleness risk). Mirrors Phase 1. |
| Top products | Count **catalog** lines by resolved product name; **custom** lines are grouped under a single "Personalizados" bucket (they have no productId). |
| Range presets | **Last 30 days · Last 90 days · This year · All time.** Trend sparklines are always last-12-months regardless of preset. |

## Goals & non-goals

### In scope
- `lib/metrics.ts` — pure, DB-free aggregation functions (revenue/AOV/monthly buckets/rank/line-parsing). Unit-tested in isolation.
- `lib/metrics-storage.ts` — new storage module: range-parameterized aggregate queries feeding the pure module.
- `GET /api/admin/metrics?range=<preset>` — returns the full metrics payload.
- `app/[locale]/admin/metrics/page.tsx` + `MetricsView` — range selector, KPI cards, sparkline trend, top-products table, by-zone table.
- Components: `KpiCard`, `Sparkline` (SVG), `RankTable` (reused for products and zones).
- `nav_metrics` nav entry in `DashboardShell`.
- i18n `admin_metrics` namespace (es/en, identical keys), gated by the parity test.
- Tests: pure-module unit tests, storage tests (in-memory SQLite), API tests, component tests, i18n parity.

### Out of scope
- Any charting library or interactive/animated charts.
- CSV/PDF export.
- Web conversion / funnel analytics (already handled separately in `lib/analytics*`).
- Period-over-period comparisons (e.g. "vs last month").
- Filtering by source/channel (all current orders are `source=web`; no useful signal yet).
- Custom date-range picker (presets only).
- Writing/caching any computed metric back to the DB.

## Architecture

### Range model
A `MetricsRange` is one of `"30d" | "90d" | "ytd" | "all"`. The storage layer converts it to an ISO lower-bound on `created_at`:
- `30d` / `90d`: `now - N days`.
- `ytd`: `Date.UTC(year, 0, 1)`.
- `all`: no lower bound.
Upper bound is always "now" (no future filter needed). Invalid/absent range → `90d` default.

### Pure module — `lib/metrics.ts`
Operates on plain rows already fetched; takes `now` where needed. No DB import.

- `type OrderMetricRow = { totalCents; amountPaidCents; paymentStatus; fulfillmentStatus; createdAt; linesJson; addressZip: string | null }`.
- `revenueCollectedCents(rows)` = Σ `amountPaidCents`.
- `outstandingCents(rows)` = Σ `max(0, totalCents - amountPaidCents)` over rows whose `fulfillmentStatus !== "canceled"` and `paymentStatus !== "refunded"`.
- `paidOrderCount(rows)` = count where `amountPaidCents > 0`.
- `aovCents(rows)` = `revenueCollectedCents / paidOrderCount` (0 if none).
- `monthlyRevenue(rows, now)` → array of 12 `{ month: "YYYY-MM"; cents }`, oldest→newest, spanning the last 12 calendar months (UTC), zero-filled. Buckets by `createdAt`, sums `amountPaidCents`.
- `topProducts(rows, resolveName)` → ranked `{ key; name; qty; cents }[]`. Parses each paid row's `linesJson`: catalog lines keyed by `productId` (name via `resolveName(productId)`), custom lines collapsed into key `"__custom__"` (name from a passed-in label). `qty` summed; `cents` best-effort (custom lines carry `priceCents*qty`; catalog lines are counted by qty only — see note). Sorted by qty desc, then name.
- `byZone(rows, resolveZone)` → ranked `{ zoneId; label; orderCount; cents }[]` over delivery rows with a zip; `resolveZone(zip)` maps to a zone id+label (unknown → an `"unknown"` bucket). Sorted by cents desc.

**Catalog line revenue note:** an order's `lines_json` catalog entries reference a `productId`/`variantId` but not a per-line price; the order only stores aggregate `total_cents`. So `topProducts` ranks catalog products by **quantity** (reliable) and reports `cents` only for custom lines (which carry an explicit `priceCents`). The table's money column shows `—` for catalog rows. This keeps the number honest rather than fabricating per-line splits.

### Storage — `lib/metrics-storage.ts`
- `rangeLowerBound(range, now): string | null`.
- `fetchOrderRows(range, now): OrderMetricRow[]` — one `SELECT` of the needed columns over `orders` within range, parsing `address_json` for the zip. This is the single row set the pure functions consume.
- `repeatRatePct(now): number` — reuse Phase 1's definition (customers with `≥ RECURRING_MIN_ORDERS` orders / total customers), computed over all customers (not range-bound; "repeat rate" is a relationship metric). Import the constant from `@/lib/customer-metrics`.
- `getMetrics(range, now): MetricsPayload` — orchestrates: fetch rows once, run the pure functions, resolve product names (from `PRODUCTS` + price-override-free name lookup) and zones (`findDeliveryZoneByZip`), and assemble:
  ```ts
  type MetricsPayload = {
    range: MetricsRange;
    kpis: { revenueCents; outstandingCents; orderCount; paidOrderCount; aovCents; repeatRatePct };
    monthly: { month: string; cents: number }[];      // 12 buckets
    topProducts: { key; name; qty; cents: number | null }[]; // top 10
    byZone: { zoneId; label; orderCount; cents }[];
  };
  ```

Product-name resolution: a small `resolveProductName(id, locale)` built from `PRODUCTS` (id → localized `title[locale]`; products carry `title: { en, es }`, not `name`); unknown ids fall back to the raw id. Zone resolution uses the existing `findDeliveryZoneByZip` (returns a `DeliveryZone` with `id` and a bilingual `label: { en, es }`); null → `"unknown"` bucket labeled via i18n.

### API
- `GET /api/admin/metrics?range=30d|90d|ytd|all` under middleware auth. Validates `range` against the allowlist (invalid → `90d`). Returns `MetricsPayload`. `runtime = "nodejs"`.

### Screens
- **Nav:** add `nav_metrics` ("Métricas"/"Metrics") to `DashboardShell` (after "Ocasiones"); exclude from `isBandeja`.
- **`/[locale]/admin/metrics`** (`force-dynamic`): server page calls `getMetrics("90d", new Date())` for first paint, renders `MetricsView` in `DashboardShell`.
- **`MetricsView`** (client): range selector (4 preset buttons) that refetches `/api/admin/metrics?range=`; KPI card row; a "Ingresos (12 meses)" panel with the `Sparkline` + a small "$ / mes" caption; top-products `RankTable`; by-zone `RankTable`. Locale-aware money/number formatting via the existing `formatDate`/local `money` helpers.
- **`KpiCard`** — label + big value (+ optional sub-caption, e.g. outstanding shown under revenue).
- **`Sparkline`** — takes `{ points: number[]; labels: string[] }`, renders an SVG polyline normalized into a fixed viewBox with a baseline; last point emphasized with a dot; empty/one-point degrade gracefully (flat line). Pure presentational, no library.
- **`RankTable`** — `{ rows: { name; value; sub? }[]; valueLabel }`; renders a compact ranked table; empty state row.

### Dates / i18n
Reuse `lib/format-datetime.ts`. New `admin_metrics` namespace in both message files (identical keys); Spanish default; parity enforced by `tests/unit/i18n-parity.test.ts`.

## Testing

- `lib/metrics.test.ts` — revenue/AOV (including 0-order → 0), outstanding excludes canceled/refunded, `monthlyRevenue` 12-bucket zero-fill + year rollover + correct bucketing by createdAt, `topProducts` catalog-by-qty + custom collapsed to "Personalizados" + tie-break, `byZone` unknown-zip bucket + sort. `now` injected.
- `lib/metrics-storage.test.ts` — in-memory SQLite: `rangeLowerBound` per preset; `fetchOrderRows` respects range and parses zip; `getMetrics` end-to-end on a seeded set (paid + pending + canceled + delivery/pickup mix) asserting KPI numbers, monthly length 12, top-products order, by-zone grouping; `repeatRatePct` reuse.
- API test — each preset returns 200 with the payload shape; invalid range falls back to `90d`.
- Component tests (real `es.json`): `MetricsView` renders KPI values + range buttons; `Sparkline` renders a polyline for 12 points and a flat line for 1; `RankTable` renders rows + empty state.
- `i18n-parity.test.ts` gates key completeness.

## Implementation approach
Same machinery as the CRM phases: one plan, bite-sized TDD tasks, subagent-driven execution with two-stage review. Suggested order: (1) pure module + tests, (2) storage + tests, (3) API + test, (4) i18n, (5) presentational components (`KpiCard`/`Sparkline`/`RankTable`) + tests, (6) `MetricsView` + page + nav + test, (7) full verification (tsc, suite vs baseline, build, live-server pass in es/en).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `lines_json` shape varies (catalog vs custom; empty in some seed rows) | Pure parser tolerates empty/malformed lines (skips), typed discriminated union; catalog ranked by qty, custom by explicit price. Tests cover both + empty. |
| Catalog per-line revenue not stored → can't attribute $ to catalog products | Documented: rank catalog by quantity, show `—` for their money column; only custom lines report $. Honest over fabricated. |
| UTC vs shop-local month boundary shifts a bucket | Accepted (documented), consistent with Phase 1/Phase 2 UTC basis. |
| Large orders table makes the aggregate slow | Single indexed range scan on `created_at` (index exists from `001_init.sql`); pure functions are O(rows). Fine to thousands. |
| Zip missing/outside zones | `findDeliveryZoneByZip` → null → "unknown" bucket; pickup/in-store rows (no address) excluded from by-zone. |
| `CustomerProfile`-style file bloat | Metrics split across pure module + storage + small presentational components, each single-responsibility. |

## File map

New files:
- `lib/metrics.ts` · `tests/unit/metrics.test.ts`
- `lib/metrics-storage.ts` · `tests/unit/metrics-storage.test.ts`
- `app/api/admin/metrics/route.ts` · `tests/unit/api-admin-metrics.test.ts`
- `app/[locale]/admin/metrics/page.tsx`
- `components/admin/metrics/MetricsView.tsx` · `tests/unit/MetricsView.test.tsx`
- `components/admin/metrics/KpiCard.tsx`
- `components/admin/metrics/Sparkline.tsx` · `tests/unit/Sparkline.test.tsx`
- `components/admin/metrics/RankTable.tsx` · `tests/unit/RankTable.test.tsx`

Modified files:
- `components/admin/dashboard/DashboardShell.tsx` — "Métricas" nav entry.
- `messages/es.json`, `messages/en.json` — `admin_metrics` namespace + `admin_dashboard.nav_metrics`.
