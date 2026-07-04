# Metrics Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only "Métricas" dashboard tab showing collected revenue, outstanding balance, order count, AOV, repeat rate, a 12-month revenue sparkline, top products, and revenue by delivery zone — computed on read from existing orders, no chart library.

**Architecture:** Calendar/aggregation math lives in a pure DB-free module `lib/metrics.ts` (unit-tested in isolation, like `customer-metrics.ts`). `lib/metrics-storage.ts` fetches the order rows for a time range once and feeds the pure functions, resolving product names (from `PRODUCTS`) and zones (`findDeliveryZoneByZip`). One API route returns the whole payload; the page + small presentational components (`KpiCard`, `Sparkline`, `RankTable`) render it. Spec: `docs/superpowers/specs/2026-07-04-metrics-panel-design.md`.

**Tech Stack:** Next.js App Router (custom conventions — see `AGENTS.md`), node:sqlite via `lib/db.ts`, next-intl, vitest + @testing-library/react, Tailwind tokens (`bone`, `ink`, `rouge`).

---

## Project conventions the engineer MUST know

1. **Node 22 required.** Shell default (v16) breaks vitest/next. Prefix EVERY command session with:
   ```bash
   export PATH="/opt/homebrew/bin:$PATH"   # node v22
   ```
2. **Run tests** with `npm test -- <file>`. Known-noisy baseline failures (identical on `main`): print-chromium, print-render, _preview (need Chrome), CartUpsellStrip (flaky), checkout-schema. Targeted files must pass 100%; the full suite must show no NEW failures.
3. **DB:** `getDb()` from `@/lib/db` + `runMigrations()` from `@/lib/db-migrate` at the top of storage functions. No new migration in this feature — reads only.
4. **Admin auth is middleware-level** (`proxy.ts`). Route handlers do NOT call auth; unit tests invoke handlers directly.
5. **Route handlers:** `export const runtime = "nodejs"`; take `Request`; validate query params against allowlists.
6. **API/storage tests** stub the DB: `vi.stubEnv("SQLITE_FILE", ":memory:")` + `runMigrations()` in `beforeEach`, `closeDb(); vi.unstubAllEnvs()` in `afterEach`.
7. **Component tests** wrap in `NextIntlClientProvider` with REAL `messages/es.json` (missing keys throw). See `tests/unit/CustomersList.test.tsx`.
8. **`import type` for server-module types in client components** — but the metrics client components import ALL their types from `lib/metrics.ts`, which is PURE (no `server-only`), so normal imports are fine. `lib/metrics-storage.ts` DOES begin with `import "server-only"`; only the server page/route import it.
9. **i18n:** `messages/en.json` and `messages/es.json` keep identical key paths — `tests/unit/i18n-parity.test.ts` gates this. Spanish is default.
10. **Branch:** create `feature/metrics-panel` off `main` before Task 1 (Step 0). Do NOT push. Commits end with:
    ```
    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
    ```

**Known data facts (verified):** `orders` has `total_cents`, `amount_paid_cents`, `payment_status` (`paid|pending|refunded`), `fulfillment_status` (incl. `canceled`), `created_at` (ISO UTC), `lines_json`, `address_json`. `lines_json` is a JSON array of `CatalogCartLine { kind:"catalog", productId, variantId, addOnIds, qty }` or `CustomCartLine { kind:"custom", title, priceCents, qty }`. Catalog lines have NO per-line price (order stores only aggregate `total_cents`). `PRODUCTS` (from `@/data/products`) items have `{ id, title: { en, es }, ... }`. `findDeliveryZoneByZip(zip)` → `DeliveryZone { id, label: { en, es }, zips } | null`.

**Timezone:** all month/day math is UTC-based (consistent with Phase 1/2). Time-bucketing is by `created_at`.

---

### Task 1: Pure module `lib/metrics.ts`

**Files:**
- Create: `lib/metrics.ts`
- Test: `tests/unit/metrics.test.ts`

- [ ] **Step 0: Create the feature branch**

```bash
cd "/Users/santiagocardonacastellanos/Desktop/Diva Flowers"
git checkout -b feature/metrics-panel
```

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/metrics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  revenueCollectedCents, outstandingCents, paidOrderCount, aovCents,
  monthlyRevenue, topProducts, byZone,
  type OrderMetricRow,
} from "@/lib/metrics";

const NOW = new Date("2026-07-04T12:00:00Z");

function row(p: Partial<OrderMetricRow>): OrderMetricRow {
  return {
    totalCents: 10000, amountPaidCents: 10000, paymentStatus: "paid",
    fulfillmentStatus: "delivered", createdAt: "2026-07-01T00:00:00Z",
    linesJson: "[]", addressZip: null, ...p,
  };
}

describe("money aggregates", () => {
  it("revenue = sum of collected; AOV over paid orders only", () => {
    const rows = [
      row({ amountPaidCents: 6000 }),
      row({ amountPaidCents: 9000 }),
      row({ amountPaidCents: 0, paymentStatus: "pending", totalCents: 5000 }),
    ];
    expect(revenueCollectedCents(rows)).toBe(15000);
    expect(paidOrderCount(rows)).toBe(2);
    expect(aovCents(rows)).toBe(7500);
  });

  it("AOV is 0 with no paid orders", () => {
    expect(aovCents([row({ amountPaidCents: 0, paymentStatus: "pending" })])).toBe(0);
    expect(aovCents([])).toBe(0);
  });

  it("outstanding = unpaid remainder, excluding canceled and refunded", () => {
    const rows = [
      row({ totalCents: 10000, amountPaidCents: 4000, paymentStatus: "pending" }), // 6000 due
      row({ totalCents: 8000, amountPaidCents: 0, paymentStatus: "pending", fulfillmentStatus: "canceled" }), // excluded
      row({ totalCents: 5000, amountPaidCents: 5000, paymentStatus: "refunded" }), // excluded
      row({ totalCents: 3000, amountPaidCents: 3000, paymentStatus: "paid" }), // 0 due
    ];
    expect(outstandingCents(rows)).toBe(6000);
  });
});

describe("monthlyRevenue", () => {
  it("returns 12 zero-filled UTC month buckets oldest→newest, summing collected", () => {
    const rows = [
      row({ createdAt: "2026-07-02T00:00:00Z", amountPaidCents: 5000 }),
      row({ createdAt: "2026-07-30T00:00:00Z", amountPaidCents: 3000 }),
      row({ createdAt: "2025-08-15T00:00:00Z", amountPaidCents: 1000 }), // oldest bucket
      row({ createdAt: "2024-01-01T00:00:00Z", amountPaidCents: 9999 }), // out of window → ignored
    ];
    const m = monthlyRevenue(rows, NOW);
    expect(m).toHaveLength(12);
    expect(m[0].month).toBe("2025-08");
    expect(m[11].month).toBe("2026-07");
    expect(m[0].cents).toBe(1000);
    expect(m[11].cents).toBe(8000);
    expect(m[5].cents).toBe(0); // some empty month
  });
});

describe("topProducts", () => {
  const resolve = (id: string) => (id === "p1" ? "Ramo Rosa" : id === "p2" ? "Caja Lujo" : id);

  it("ranks catalog by qty (cents null), collapses custom into one bucket with summed cents", () => {
    const rows = [
      row({ linesJson: JSON.stringify([
        { kind: "catalog", productId: "p1", variantId: "s", addOnIds: [], qty: 2 },
        { kind: "custom", title: "Especial", priceCents: 4000, qty: 1 },
      ]) }),
      row({ linesJson: JSON.stringify([
        { kind: "catalog", productId: "p1", variantId: "s", addOnIds: [], qty: 1 },
        { kind: "catalog", productId: "p2", variantId: "s", addOnIds: [], qty: 5 },
        { kind: "custom", title: "Otra", priceCents: 2000, qty: 2 },
      ]) }),
      row({ amountPaidCents: 0, paymentStatus: "pending", linesJson: JSON.stringify([
        { kind: "catalog", productId: "p2", variantId: "s", addOnIds: [], qty: 99 },
      ]) }), // unpaid → ignored
    ];
    const top = topProducts(rows, resolve, "Personalizados");
    expect(top).toEqual([
      { key: "p2", name: "Caja Lujo", qty: 5, cents: null },
      { key: "p1", name: "Ramo Rosa", qty: 3, cents: null },
      { key: "__custom__", name: "Personalizados", qty: 3, cents: 8000 },
    ]);
  });

  it("tolerates empty/malformed lines and caps at the limit", () => {
    const rows = [
      row({ linesJson: "[]" }),
      row({ linesJson: "not json" }),
      row({ linesJson: JSON.stringify([{ kind: "catalog", productId: "p1", variantId: "s", addOnIds: [], qty: 1 }]) }),
    ];
    expect(topProducts(rows, resolve, "Personalizados", 1)).toEqual([
      { key: "p1", name: "Ramo Rosa", qty: 1, cents: null },
    ]);
  });
});

describe("byZone", () => {
  const resolve = (zip: string) =>
    zip === "11507" ? { id: "albertson", label: "Albertson" }
    : zip === "11576" ? { id: "roslyn", label: "Roslyn" }
    : null;

  it("groups delivery rows by zone, sums collected, unknown zip → unknown bucket, sorted by cents", () => {
    const rows = [
      row({ addressZip: "11507", amountPaidCents: 5000 }),
      row({ addressZip: "11507", amountPaidCents: 3000 }),
      row({ addressZip: "11576", amountPaidCents: 10000 }),
      row({ addressZip: "99999", amountPaidCents: 2000 }), // unknown
      row({ addressZip: null, amountPaidCents: 7000 }), // pickup → excluded
    ];
    expect(byZone(rows, resolve, "Sin zona")).toEqual([
      { zoneId: "roslyn", label: "Roslyn", orderCount: 1, cents: 10000 },
      { zoneId: "albertson", label: "Albertson", orderCount: 2, cents: 8000 },
      { zoneId: "unknown", label: "Sin zona", orderCount: 1, cents: 2000 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test -- tests/unit/metrics.test.ts
```
Expected: FAIL — cannot resolve `@/lib/metrics`.

- [ ] **Step 3: Write the implementation**

Create `lib/metrics.ts`:

```ts
// Pure, DB-free metrics aggregation. Operates on rows already fetched by
// metrics-storage; takes `now` where needed. No server-only import — the
// client components import the types here directly. All time math is UTC.

export type MetricsRange = "30d" | "90d" | "ytd" | "all";

export type OrderMetricRow = {
  totalCents: number;
  amountPaidCents: number;
  paymentStatus: string; // "paid" | "pending" | "refunded"
  fulfillmentStatus: string; // includes "canceled"
  createdAt: string; // ISO UTC
  linesJson: string;
  addressZip: string | null;
};

export function revenueCollectedCents(rows: OrderMetricRow[]): number {
  return rows.reduce((s, r) => s + r.amountPaidCents, 0);
}

export function paidOrderCount(rows: OrderMetricRow[]): number {
  return rows.filter((r) => r.amountPaidCents > 0).length;
}

export function aovCents(rows: OrderMetricRow[]): number {
  const paid = paidOrderCount(rows);
  return paid > 0 ? Math.round(revenueCollectedCents(rows) / paid) : 0;
}

export function outstandingCents(rows: OrderMetricRow[]): number {
  return rows.reduce((s, r) => {
    if (r.fulfillmentStatus === "canceled" || r.paymentStatus === "refunded") return s;
    return s + Math.max(0, r.totalCents - r.amountPaidCents);
  }, 0);
}

export type MonthlyBucket = { month: string; cents: number };

export function monthlyRevenue(rows: OrderMetricRow[], now: Date): MonthlyBucket[] {
  const keys: string[] = [];
  const buckets = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    keys.push(key);
    buckets.set(key, 0);
  }
  for (const r of rows) {
    const key = r.createdAt.slice(0, 7); // "YYYY-MM" from ISO UTC
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + r.amountPaidCents);
  }
  return keys.map((month) => ({ month, cents: buckets.get(month) ?? 0 }));
}

export type ProductRank = { key: string; name: string; qty: number; cents: number | null };

export function topProducts(
  rows: OrderMetricRow[],
  resolveName: (productId: string) => string,
  customLabel: string,
  limit = 10,
): ProductRank[] {
  const agg = new Map<string, { name: string; qty: number; cents: number | null }>();
  for (const r of rows) {
    if (r.amountPaidCents <= 0) continue; // realized sales only
    let lines: unknown;
    try {
      lines = JSON.parse(r.linesJson);
    } catch {
      continue;
    }
    if (!Array.isArray(lines)) continue;
    for (const raw of lines) {
      const l = raw as Record<string, unknown>;
      const qty = typeof l.qty === "number" ? l.qty : 0;
      if (qty <= 0) continue;
      if (l.kind === "catalog" && typeof l.productId === "string") {
        const key = l.productId;
        const cur = agg.get(key) ?? { name: resolveName(key), qty: 0, cents: null };
        cur.qty += qty;
        agg.set(key, cur);
      } else if (l.kind === "custom") {
        const key = "__custom__";
        const price = typeof l.priceCents === "number" ? l.priceCents : 0;
        const cur = agg.get(key) ?? { name: customLabel, qty: 0, cents: 0 };
        cur.qty += qty;
        cur.cents = (cur.cents ?? 0) + price * qty;
        agg.set(key, cur);
      }
    }
  }
  return [...agg.entries()]
    .map(([key, v]) => ({ key, name: v.name, qty: v.qty, cents: v.cents }))
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type ZoneRank = { zoneId: string; label: string; orderCount: number; cents: number };

export function byZone(
  rows: OrderMetricRow[],
  resolveZone: (zip: string) => { id: string; label: string } | null,
  unknownLabel: string,
): ZoneRank[] {
  const agg = new Map<string, { label: string; orderCount: number; cents: number }>();
  for (const r of rows) {
    if (!r.addressZip) continue; // pickup / in-store excluded
    const zone = resolveZone(r.addressZip);
    const id = zone?.id ?? "unknown";
    const label = zone?.label ?? unknownLabel;
    const cur = agg.get(id) ?? { label, orderCount: 0, cents: 0 };
    cur.orderCount += 1;
    cur.cents += r.amountPaidCents;
    agg.set(id, cur);
  }
  return [...agg.entries()]
    .map(([zoneId, v]) => ({ zoneId, label: v.label, orderCount: v.orderCount, cents: v.cents }))
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/metrics.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics.ts tests/unit/metrics.test.ts
git commit -m "feat(metrics): pure aggregation module — revenue, AOV, trend, rankings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Storage `lib/metrics-storage.ts`

**Files:**
- Create: `lib/metrics-storage.ts`
- Test: `tests/unit/metrics-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/metrics-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { rangeLowerBound, fetchOrderRows, getMetrics } from "@/lib/metrics-storage";

const NOW = new Date("2026-07-04T12:00:00Z");
const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const LABELS = { customProducts: "Personalizados", unknownZone: "Sin zona" };

function seedOrder(p: {
  id: string; daysAgo: number; total: number; paid: number;
  payment?: string; fulfillment?: string; zip?: string | null; lines?: unknown[];
}) {
  const at = new Date(NOW.getTime() - p.daysAgo * DAY).toISOString();
  const address = p.zip ? JSON.stringify({ street1: "1", city: "X", state: "NY", zip: p.zip, country: "US" }) : null;
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, address_json, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, amount_paid_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'R', '1', '1', ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.id, p.zip ? "delivery" : "pickup", address, JSON.stringify(p.lines ?? []),
    p.total, p.paid, p.fulfillment ?? "delivered", p.payment ?? "paid", at, at,
  );
}

function seedCustomer(id: string, orderCount: number) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')`,
  ).run(id, `C${id}`, `phone-${id}`, orderCount);
}

describe("rangeLowerBound", () => {
  it("computes each preset bound; all → null", () => {
    expect(rangeLowerBound("30d", NOW)).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
    expect(rangeLowerBound("90d", NOW)).toBe(new Date(NOW.getTime() - 90 * DAY).toISOString());
    expect(rangeLowerBound("ytd", NOW)).toBe("2026-01-01T00:00:00.000Z");
    expect(rangeLowerBound("all", NOW)).toBeNull();
  });
});

describe("fetchOrderRows", () => {
  it("respects the range window and parses the zip from address_json", () => {
    seedOrder({ id: "recent", daysAgo: 5, total: 5000, paid: 5000, zip: "11507" });
    seedOrder({ id: "old", daysAgo: 200, total: 8000, paid: 8000, zip: "11576" });
    const within90 = fetchOrderRows("90d", NOW);
    expect(within90.map((r) => r.id ?? undefined)).toBeDefined(); // shape sanity
    expect(within90).toHaveLength(1);
    expect(within90[0].addressZip).toBe("11507");
    expect(fetchOrderRows("all", NOW)).toHaveLength(2);
  });
});

describe("getMetrics", () => {
  it("assembles KPIs, 12-month trend, top products, and by-zone", () => {
    seedOrder({ id: "o1", daysAgo: 3, total: 6000, paid: 6000, zip: "11507",
      lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 2 }] });
    seedOrder({ id: "o2", daysAgo: 10, total: 10000, paid: 4000, payment: "pending", zip: "11576",
      lines: [{ kind: "custom", title: "Especial", priceCents: 4000, qty: 1 }] });
    seedCustomer("a", 3); // recurring
    seedCustomer("b", 1); // not

    const m = getMetrics("90d", NOW, "es", LABELS);
    expect(m.kpis.revenueCents).toBe(10000); // 6000 + 4000 collected
    expect(m.kpis.outstandingCents).toBe(6000); // o2 remainder (10000 - 4000)
    expect(m.kpis.orderCount).toBe(2);
    expect(m.kpis.paidOrderCount).toBe(2); // both o1 and o2 have amount_paid > 0
    expect(m.kpis.aovCents).toBe(5000); // 10000 / 2
    expect(m.kpis.repeatRatePct).toBe(50); // a out of {a,b}
    expect(m.monthly).toHaveLength(12);
    expect(m.topProducts.length).toBeGreaterThanOrEqual(1);
    expect(m.byZone.map((z) => z.zoneId).sort()).toEqual(["albertson", "roslyn"]);
  });

  it("uses the requested locale for product/zone names", () => {
    seedOrder({ id: "o1", daysAgo: 1, total: 6000, paid: 6000, zip: "11507",
      lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "standard", addOnIds: [], qty: 1 }] });
    const es = getMetrics("30d", NOW, "es", LABELS);
    expect(es.byZone[0].label).toBe("Albertson");
    // product name resolves to the localized title, not the raw id
    expect(es.topProducts[0].name).not.toBe("p-arr-m01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/metrics-storage.test.ts
```
Expected: FAIL — cannot resolve `@/lib/metrics-storage`.

- [ ] **Step 3: Write the implementation**

Create `lib/metrics-storage.ts`:

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { customerStats } from "@/lib/customer-storage";
import { findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { PRODUCTS } from "@/data/products";
import {
  aovCents,
  byZone,
  monthlyRevenue,
  outstandingCents,
  paidOrderCount,
  revenueCollectedCents,
  topProducts,
  type MetricsRange,
  type MonthlyBucket,
  type OrderMetricRow,
  type ProductRank,
  type ZoneRank,
} from "@/lib/metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

export function rangeLowerBound(range: MetricsRange, now: Date): string | null {
  switch (range) {
    case "30d":
      return new Date(now.getTime() - 30 * DAY_MS).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * DAY_MS).toISOString();
    case "ytd":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    case "all":
      return null;
  }
}

type OrderRowRaw = {
  id: string;
  total_cents: number;
  amount_paid_cents: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  lines_json: string;
  address_json: string | null;
};

function parseZip(addressJson: string | null): string | null {
  if (!addressJson) return null;
  try {
    const a = JSON.parse(addressJson) as { zip?: string };
    return typeof a.zip === "string" ? a.zip : null;
  } catch {
    return null;
  }
}

/** Row type carries `id` for test sanity but pure functions ignore it. */
export function fetchOrderRows(range: MetricsRange, now: Date): (OrderMetricRow & { id: string })[] {
  runMigrations();
  const lb = rangeLowerBound(range, now);
  const where = lb ? "WHERE created_at >= ?" : "";
  const params = lb ? [lb] : [];
  const rows = getDb()
    .prepare(
      `SELECT id, total_cents, amount_paid_cents, payment_status, fulfillment_status,
              created_at, lines_json, address_json
       FROM orders ${where}`,
    )
    .all(...params) as OrderRowRaw[];
  return rows.map((r) => ({
    id: r.id,
    totalCents: r.total_cents,
    amountPaidCents: r.amount_paid_cents,
    paymentStatus: r.payment_status,
    fulfillmentStatus: r.fulfillment_status,
    createdAt: r.created_at,
    linesJson: r.lines_json,
    addressZip: parseZip(r.address_json),
  }));
}

export type MetricsKpis = {
  revenueCents: number;
  outstandingCents: number;
  orderCount: number;
  paidOrderCount: number;
  aovCents: number;
  repeatRatePct: number;
};

export type MetricsPayload = {
  range: MetricsRange;
  kpis: MetricsKpis;
  monthly: MonthlyBucket[];
  topProducts: ProductRank[];
  byZone: ZoneRank[];
};

export type MetricsLabels = { customProducts: string; unknownZone: string };

export function getMetrics(
  range: MetricsRange,
  now: Date,
  locale: "en" | "es",
  labels: MetricsLabels,
): MetricsPayload {
  const rows = fetchOrderRows(range, now);
  const nameById = new Map(PRODUCTS.map((p) => [p.id, p.title[locale]]));
  const resolveName = (id: string) => nameById.get(id) ?? id;
  const resolveZone = (zip: string) => {
    const z = findDeliveryZoneByZip(zip);
    return z ? { id: z.id, label: z.label[locale] } : null;
  };
  return {
    range,
    kpis: {
      revenueCents: revenueCollectedCents(rows),
      outstandingCents: outstandingCents(rows),
      orderCount: rows.length,
      paidOrderCount: paidOrderCount(rows),
      aovCents: aovCents(rows),
      repeatRatePct: customerStats(now).repeatRatePct,
    },
    monthly: monthlyRevenue(rows, now),
    topProducts: topProducts(rows, resolveName, labels.customProducts),
    byZone: byZone(rows, resolveZone, labels.unknownZone),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/metrics-storage.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics-storage.ts tests/unit/metrics-storage.test.ts
git commit -m "feat(metrics): storage — range fetch + getMetrics assembly

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: API route `GET /api/admin/metrics`

**Files:**
- Create: `app/api/admin/metrics/route.ts`
- Test: `tests/unit/api-admin-metrics.test.ts`

The route resolves the two synthetic labels from the message JSON for the requested locale (so `getMetrics` stays i18n-free). i18n keys `admin_metrics.custom_products` / `admin_metrics.unknown_zone` are added in Task 4 — this task imports them; if you run this test BEFORE Task 4, add the two keys first. To keep tasks independently runnable, this task's Step 3 also lists the two keys to add if missing.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-admin-metrics.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/metrics/route";

const DAY = 86_400_000;

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedPaid(id: string, daysAgo: number, paid: number) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, amount_paid_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'R', '1', '1', 'pickup', '[]', 0, 0, 0, ?, ?, 'delivered', 'paid', ?, ?)`,
  ).run(id, paid, paid, at, at);
}

it("returns the metrics payload for a valid range", async () => {
  seedPaid("o1", 5, 6000);
  seedPaid("o2", 400, 9999); // outside 90d
  const res = await GET(new Request("http://x/api/admin/metrics?range=90d"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.range).toBe("90d");
  expect(body.kpis.revenueCents).toBe(6000);
  expect(body.monthly).toHaveLength(12);
  expect(Array.isArray(body.topProducts)).toBe(true);
  expect(Array.isArray(body.byZone)).toBe(true);
});

it("falls back to 90d on an invalid range and honors range=all", async () => {
  seedPaid("o1", 5, 6000);
  seedPaid("o2", 400, 4000);
  const bad = await (await GET(new Request("http://x/api/admin/metrics?range=bogus"))).json();
  expect(bad.range).toBe("90d");
  expect(bad.kpis.revenueCents).toBe(6000);

  const all = await (await GET(new Request("http://x/api/admin/metrics?range=all"))).json();
  expect(all.range).toBe("all");
  expect(all.kpis.revenueCents).toBe(10000);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/api-admin-metrics.test.ts
```
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Write the route**

Create `app/api/admin/metrics/route.ts`:

```ts
import { NextResponse } from "next/server";
import esMessages from "@/messages/es.json";
import enMessages from "@/messages/en.json";
import { getMetrics } from "@/lib/metrics-storage";
import type { MetricsRange } from "@/lib/metrics";

export const runtime = "nodejs";

const RANGES = new Set<string>(["30d", "90d", "ytd", "all"]);

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const rawRange = sp.get("range");
  const range: MetricsRange = (rawRange && RANGES.has(rawRange) ? rawRange : "90d") as MetricsRange;
  const locale = sp.get("locale") === "en" ? "en" : "es";
  const m = (locale === "en" ? enMessages : esMessages).admin_metrics;
  const labels = { customProducts: m.custom_products, unknownZone: m.unknown_zone };
  return NextResponse.json(getMetrics(range, new Date(), locale, labels));
}
```

If `messages/*.json` does NOT yet contain `admin_metrics.custom_products` / `admin_metrics.unknown_zone` (Task 4 not run yet), add these two keys to the `admin_metrics` object in BOTH files now so this compiles: es `"custom_products": "Personalizados", "unknown_zone": "Sin zona"`, en `"custom_products": "Custom pieces", "unknown_zone": "No zone"`. (Task 4 adds the full namespace; if the namespace doesn't exist yet, create it with just these two keys and Task 4 will extend it.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/api-admin-metrics.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/metrics/route.ts tests/unit/api-admin-metrics.test.ts messages/es.json messages/en.json
git commit -m "feat(metrics): GET /api/admin/metrics endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: i18n — `admin_metrics` namespace + nav key

**Files:**
- Modify: `messages/es.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Confirm parity baseline passes**

```bash
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: PASS. (If Task 3 already added `custom_products`/`unknown_zone`, they exist in both files — keep them, just add the rest.)

- [ ] **Step 2: Add the Spanish keys**

In `messages/es.json`:

**(a)** Inside `"admin_dashboard"`, after `"nav_occasions": "Ocasiones",` add:

```json
"nav_metrics": "Métricas",
```

**(b)** Ensure an `"admin_metrics"` top-level namespace exists with exactly these keys (if Task 3 created a stub with `custom_products`/`unknown_zone`, merge — do not duplicate):

```json
"admin_metrics": {
  "title": "Métricas",
  "range_30d": "Últimos 30 días",
  "range_90d": "Últimos 90 días",
  "range_ytd": "Este año",
  "range_all": "Todo",
  "kpi_revenue": "Ingresos cobrados",
  "kpi_outstanding": "Saldo pendiente",
  "kpi_orders": "Órdenes",
  "kpi_aov": "Ticket promedio",
  "kpi_repeat_rate": "Clientes que repiten",
  "trend_title": "Ingresos (12 meses)",
  "top_products_title": "Productos más pedidos",
  "by_zone_title": "Ingresos por zona",
  "col_product": "Producto",
  "col_qty": "Cantidad",
  "col_zone": "Zona",
  "col_orders": "Órdenes",
  "col_revenue": "Ingresos",
  "custom_products": "Personalizados",
  "unknown_zone": "Sin zona",
  "not_available": "—",
  "empty": "Sin datos en este rango."
}
```

- [ ] **Step 3: Add the English keys**

In `messages/en.json`:

**(a)** Inside `"admin_dashboard"`, after `"nav_occasions": "Occasions",` add:

```json
"nav_metrics": "Metrics",
```

**(b)** `"admin_metrics"` namespace (same keys, English values):

```json
"admin_metrics": {
  "title": "Metrics",
  "range_30d": "Last 30 days",
  "range_90d": "Last 90 days",
  "range_ytd": "This year",
  "range_all": "All time",
  "kpi_revenue": "Collected revenue",
  "kpi_outstanding": "Outstanding balance",
  "kpi_orders": "Orders",
  "kpi_aov": "Average order",
  "kpi_repeat_rate": "Repeat customers",
  "trend_title": "Revenue (12 months)",
  "top_products_title": "Top products",
  "by_zone_title": "Revenue by zone",
  "col_product": "Product",
  "col_qty": "Quantity",
  "col_zone": "Zone",
  "col_orders": "Orders",
  "col_revenue": "Revenue",
  "custom_products": "Custom pieces",
  "unknown_zone": "No zone",
  "not_available": "—",
  "empty": "No data in this range."
}
```

- [ ] **Step 4: Validate JSON + parity**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('JSON OK')"
npm test -- tests/unit/i18n-parity.test.ts
```
Expected: `JSON OK` and parity PASS.

- [ ] **Step 5: Commit**

```bash
git add messages/es.json messages/en.json
git commit -m "feat(metrics): admin_metrics i18n namespace (es/en) + nav key

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Presentational components — `KpiCard`, `Sparkline`, `RankTable`

**Files:**
- Create: `components/admin/metrics/KpiCard.tsx`
- Create: `components/admin/metrics/Sparkline.tsx`
- Create: `components/admin/metrics/RankTable.tsx`
- Test: `tests/unit/Sparkline.test.tsx`, `tests/unit/RankTable.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/Sparkline.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Sparkline from "@/components/admin/metrics/Sparkline";

describe("Sparkline", () => {
  it("renders a polyline with one point per value (12 points)", () => {
    const { container } = render(
      <Sparkline points={[0, 5, 3, 8, 2, 9, 4, 7, 1, 6, 10, 3]} ariaLabel="trend" />,
    );
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
    const coords = poly!.getAttribute("points")!.trim().split(/\s+/);
    expect(coords).toHaveLength(12);
  });

  it("renders a flat line for a single point without crashing", () => {
    const { container } = render(<Sparkline points={[7]} ariaLabel="trend" />);
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
    expect(poly!.getAttribute("points")!.trim().split(/\s+/)).toHaveLength(1);
  });

  it("renders nothing drawable for an empty series but stays mounted", () => {
    const { container } = render(<Sparkline points={[]} ariaLabel="trend" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("polyline")).toBeNull();
  });
});
```

Create `tests/unit/RankTable.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RankTable from "@/components/admin/metrics/RankTable";

describe("RankTable", () => {
  it("renders a header and one row per item", () => {
    render(
      <RankTable
        nameHeader="Producto"
        valueHeader="Cantidad"
        rows={[
          { key: "a", name: "Ramo Rosa", value: "12" },
          { key: "b", name: "Caja Lujo", value: "8", sub: "$120.00" },
        ]}
        emptyLabel="Sin datos"
      />,
    );
    expect(screen.getByText("Producto")).toBeDefined();
    expect(screen.getByText("Ramo Rosa")).toBeDefined();
    expect(screen.getByText("$120.00")).toBeDefined();
  });

  it("renders the empty label when there are no rows", () => {
    render(<RankTable nameHeader="Zona" valueHeader="Ingresos" rows={[]} emptyLabel="Sin datos" />);
    expect(screen.getByText("Sin datos")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- tests/unit/Sparkline.test.tsx tests/unit/RankTable.test.tsx
```
Expected: FAIL — cannot resolve the component modules.

- [ ] **Step 3: Write `KpiCard`**

Create `components/admin/metrics/KpiCard.tsx`:

```tsx
type Props = { label: string; value: string; sub?: string };

export default function KpiCard({ label, value, sub }: Props) {
  return (
    <div className="rounded border border-ink/10 bg-bone p-3">
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink/50">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Write `Sparkline`**

Create `components/admin/metrics/Sparkline.tsx`:

```tsx
type Props = { points: number[]; ariaLabel: string };

const W = 240;
const H = 48;
const PAD = 4;

export default function Sparkline({ points, ariaLabel }: Props) {
  const max = points.length ? Math.max(...points) : 0;
  const min = points.length ? Math.min(...points) : 0;
  const span = max - min || 1;
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = coords[coords.length - 1]?.split(",").map(Number);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      {coords.length > 0 && (
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-rouge"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {last && <circle cx={last[0]} cy={last[1]} r="2.5" className="fill-rouge" />}
    </svg>
  );
}
```

- [ ] **Step 5: Write `RankTable`**

Create `components/admin/metrics/RankTable.tsx`:

```tsx
export type RankRow = { key: string; name: string; value: string; sub?: string };

type Props = { nameHeader: string; valueHeader: string; rows: RankRow[]; emptyLabel: string };

export default function RankTable({ nameHeader, valueHeader, rows, emptyLabel }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-ink/10 bg-bone p-4 text-center text-sm text-ink/50">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-ink/10 bg-bone">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
            <th className="px-3 py-2">{nameHeader}</th>
            <th className="px-3 py-2 text-right">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-ink/5 last:border-0">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right">
                <span className="font-semibold">{r.value}</span>
                {r.sub && <span className="ml-2 text-ink/50">{r.sub}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/unit/Sparkline.test.tsx tests/unit/RankTable.test.tsx
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add components/admin/metrics/KpiCard.tsx components/admin/metrics/Sparkline.tsx components/admin/metrics/RankTable.tsx tests/unit/Sparkline.test.tsx tests/unit/RankTable.test.tsx
git commit -m "feat(metrics): presentational KpiCard, Sparkline, RankTable

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `MetricsView` + page + nav

**Files:**
- Create: `components/admin/metrics/MetricsView.tsx`
- Create: `app/[locale]/admin/metrics/page.tsx`
- Modify: `components/admin/dashboard/DashboardShell.tsx`
- Test: `tests/unit/MetricsView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/MetricsView.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import MetricsView from "@/components/admin/metrics/MetricsView";
import type { MetricsPayload } from "@/lib/metrics-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const payload: MetricsPayload = {
  range: "90d",
  kpis: { revenueCents: 360000, outstandingCents: 12000, orderCount: 42, paidOrderCount: 40, aovCents: 9000, repeatRatePct: 55 },
  monthly: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, cents: i * 1000 })),
  topProducts: [
    { key: "p1", name: "Ramo Rosa", qty: 12, cents: null },
    { key: "__custom__", name: "Personalizados", qty: 5, cents: 40000 },
  ],
  byZone: [{ zoneId: "albertson", label: "Albertson", orderCount: 20, cents: 200000 }],
};

describe("MetricsView", () => {
  it("renders KPI values, range buttons, and the two ranked tables", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByText("$3,600.00")).toBeDefined(); // revenue
    expect(screen.getByText("Últimos 90 días")).toBeDefined(); // active range button
    expect(screen.getByText("Productos más pedidos")).toBeDefined();
    expect(screen.getByText("Ramo Rosa")).toBeDefined();
    expect(screen.getByText("Ingresos por zona")).toBeDefined();
    expect(screen.getByText("Albertson")).toBeDefined();
  });

  it("shows the custom-products money and a dash for catalog", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByText("$400.00")).toBeDefined(); // custom bucket cents
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- tests/unit/MetricsView.test.tsx
```
Expected: FAIL — cannot resolve `@/components/admin/metrics/MetricsView`.

- [ ] **Step 3: Write `MetricsView`**

Create `components/admin/metrics/MetricsView.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MetricsRange } from "@/lib/metrics";
import type { MetricsPayload } from "@/lib/metrics-storage";
import KpiCard from "./KpiCard";
import Sparkline from "./Sparkline";
import RankTable, { type RankRow } from "./RankTable";

type Props = { locale: string; initial: MetricsPayload };

function money(c: number) {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const RANGES: Array<{ id: MetricsRange; key: string }> = [
  { id: "30d", key: "range_30d" },
  { id: "90d", key: "range_90d" },
  { id: "ytd", key: "range_ytd" },
  { id: "all", key: "range_all" },
];

export default function MetricsView({ locale, initial }: Props) {
  const t = useTranslations("admin_metrics");
  const [data, setData] = useState<MetricsPayload>(initial);
  const [range, setRange] = useState<MetricsRange>(initial.range);
  const [error, setError] = useState(false);

  async function pick(r: MetricsRange) {
    setRange(r);
    try {
      const res = await fetch(`/api/admin/metrics?range=${r}&locale=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as MetricsPayload);
      setError(false);
    } catch {
      setError(true);
    }
  }

  const k = data.kpis;
  const kpis = [
    { key: "kpi_revenue", value: money(k.revenueCents), sub: `${t("kpi_outstanding")}: ${money(k.outstandingCents)}` },
    { key: "kpi_orders", value: String(k.orderCount) },
    { key: "kpi_aov", value: money(k.aovCents) },
    { key: "kpi_repeat_rate", value: `${k.repeatRatePct}%` },
  ];

  const productRows: RankRow[] = data.topProducts.map((p) => ({
    key: p.key,
    name: p.key === "__custom__" ? t("custom_products") : p.name,
    value: String(p.qty),
    sub: p.cents === null ? t("not_available") : money(p.cents),
  }));

  const zoneRows: RankRow[] = data.byZone.map((z) => ({
    key: z.zoneId,
    name: z.label,
    value: money(z.cents),
    sub: `${z.orderCount} ${t("col_orders").toLowerCase()}`,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="ml-auto flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void pick(r.id)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
                range === r.id ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
              }`}
            >
              {t(r.key)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("empty")}</div>}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((c) => (
          <KpiCard key={c.key} label={t(c.key)} value={c.value} sub={c.sub} />
        ))}
      </div>

      <div className="mb-3 rounded border border-ink/10 bg-bone p-3">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("trend_title")}</div>
        <Sparkline points={data.monthly.map((m) => m.cents)} ariaLabel={t("trend_title")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("top_products_title")}</div>
          <RankTable
            nameHeader={t("col_product")}
            valueHeader={t("col_qty")}
            rows={productRows}
            emptyLabel={t("empty")}
          />
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("by_zone_title")}</div>
          <RankTable
            nameHeader={t("col_zone")}
            valueHeader={t("col_revenue")}
            rows={zoneRows}
            emptyLabel={t("empty")}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

Create `app/[locale]/admin/metrics/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import MetricsView from "@/components/admin/metrics/MetricsView";
import { getMetrics } from "@/lib/metrics-storage";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "es" }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin_metrics" });
  const labels = { customProducts: t("custom_products"), unknownZone: t("unknown_zone") };
  const initial = getMetrics("90d", new Date(), locale, labels);
  return (
    <DashboardShell locale={locale}>
      <MetricsView locale={locale} initial={initial} />
    </DashboardShell>
  );
}
```

- [ ] **Step 5: Add the nav entry**

Modify `components/admin/dashboard/DashboardShell.tsx`:

**(a)** Replace:
```tsx
  const isOccasions = pathname.includes("/admin/occasions");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers && !isOccasions;
```
with:
```tsx
  const isOccasions = pathname.includes("/admin/occasions");
  const isMetrics = pathname.includes("/admin/metrics");
  const isBandeja =
    !isLedger && !isRunSheet && !isSettings && !isGiftCards && !isCustomers && !isOccasions && !isMetrics;
```

**(b)** After the Ocasiones `<Link>` (containing `{t("nav_occasions")}`) and BEFORE the "Nueva orden" intake link, insert:
```tsx
            <Link
              href={`/${locale}/admin/metrics`}
              className={`flex min-h-11 items-center rounded-lg px-3 ${isMetrics ? "bg-rouge text-bone" : "hover:bg-ink/5"}`}
            >
              {t("nav_metrics")}
            </Link>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/unit/MetricsView.test.tsx tests/unit/i18n-parity.test.ts
npx tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add components/admin/metrics/MetricsView.tsx "app/[locale]/admin/metrics/page.tsx" components/admin/dashboard/DashboardShell.tsx tests/unit/MetricsView.test.tsx
git commit -m "feat(metrics): Métricas tab — view, page, dashboard nav entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification — types, suite, build, live server

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Full test suite**

```bash
npm test 2>&1 | tail -8
```
Expected: all metrics test files pass. Known baseline failures (identical on `main`): print-chromium / print-render / _preview, CartUpsellStrip, checkout-schema. **No NEW failures.**

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 4: Live-server verification (both locales)**

Start the dev server with Node 22 (`npm run dev`, background, log to a file). Authenticate: POST `/api/admin/session` with the password from `INTAKE_PASSWORD` in `.env.local`; extract the `intake_session` token from the response Set-Cookie and pass it inline as `-b "intake_session=$TOK"` (the cookie-jar `#HttpOnly_` prefix breaks `-b <file>` — pass inline).

Seed a few paid delivery orders with catalog + custom lines and known zips, then verify:
1. `GET /api/admin/metrics?range=90d&locale=es` returns KPIs, `monthly` length 12, `topProducts`, `byZone`.
2. `GET /api/admin/metrics?range=all&locale=en` returns English zone/product names.
3. `/es/admin/metrics` and `/en/admin/metrics` SSR 200 with correct strings and an `<svg><polyline>` present; no raw `admin_metrics.` keys in the HTML.
4. Range buttons hit the API (check the dev log for `GET /api/admin/metrics?range=30d`).
5. Nav shows "Métricas"; Bandeja still highlights on `/es/admin/dashboard`.
6. Dev log shows no runtime errors.

**Clean up the seeded orders afterwards** (delete the test orders from `data/diva.sqlite`) and stop the dev server.

- [ ] **Step 5: Final commit (only if the live pass required fixes)**

```bash
git add -A && git commit -m "fix(metrics): post-verification polish

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

**Reminder for the operator:** production runs on a separate Hostinger Node host NOT auto-deployed from GitHub; this feature is read-only (no migration) and takes effect there only after that host is updated.
