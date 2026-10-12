# Métricas con insights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/admin/metrics` as a summary (5 KPIs with deltas, this-year-vs-last-year sales chart, rule-based insights) plus three tabs (Ventas, Operación, Clientes).

**Architecture:** Pure, DB-free calculation modules under `lib/metrics/` (period math in shop-local time, sales, operations, customers, holidays) and `lib/metrics-insights.ts`. `lib/metrics-storage.ts` loads every order once, normalizes rows to `MetricOrder`, and assembles one `MetricsPayload`. That payload goes to the server-rendered page and to `GET /api/admin/metrics`. The UI is hand-built SVG/HTML components with no new dependencies. This supersedes the v1 panel planned in `2026-07-04-metrics-panel.md`. The pure helpers `byZone` and `OrderMetricRow` from `lib/metrics.ts` stay and are reused.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, next-intl, node:sqlite, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-metrics-insights-design.md`

## Global Constraints

- Shop time zone `America/New_York`: every day, week, month and weekday comes from `shopDateStr` (`lib/tv-slots.ts`), never from UTC slices of `created_at`.
- Revenue = `amount_paid_cents` of orders that are not `canceled` and not `refunded`. Order count = orders that are not `canceled`.
- Previous period = same length immediately before. YTD compares with the same span of last year. "Todo" has no deltas.
- A delta with a previous value of 0 shows "nuevo", never ∞%.
- Channel colors are fixed per channel and never assigned by rank: web `#B8345E`, phone `#1F78C8`, whatsapp `#C9850F`, walk-in `#1E8A5E`, event `#7A4FB0`. Main chart: this year `#B8345E` 2px line plus area at 10% opacity, last year `#BAB1A2`. One Y axis.
- No new npm dependencies. Text never takes the series color; values and labels use ink or mute tokens.
- i18n: every string goes in `messages/es.json` and `messages/en.json` under `admin_metrics`. Insert keys next to the existing ones, never reformat the files, and check for duplicate keys.
- Every chart has hover and keyboard-focus tooltips, plus an `sr-only` table.
- Run tests with `npx vitest run --root "$PWD" <files>` from the worktree root. Without `--root`, vitest can pick up the main checkout.
- Commit messages are Spanish conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never touch the main checkout. Never push.

---

### Task 1: Period math (`lib/metrics/period.ts`)

**Files:**
- Create: `lib/metrics/period.ts`
- Test: `tests/unit/metrics-period.test.ts`

**Interfaces:**
- Produces: `MetricsRange`, `METRICS_RANGES`, `Granularity`, `Period`, `resolvePeriod(range, today)`, `shopDay(iso)`, `shiftYears(ymd, years)`, `inPeriod(day, start, end)`, `bucketKey(day, g)`, `bucketKeys(period)`, `Delta`, `delta(cur, prev)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/metrics-period.test.ts
import { describe, it, expect } from "vitest";
import {
  resolvePeriod, shopDay, shiftYears, inPeriod, bucketKey, bucketKeys, delta,
} from "@/lib/metrics/period";

const TODAY = "2026-10-12"; // a Monday

describe("resolvePeriod", () => {
  it("rolling ranges end today and compare with the same length before", () => {
    expect(resolvePeriod("7d", TODAY)).toEqual({
      range: "7d", start: "2026-10-06", end: TODAY, prevStart: "2026-09-29", prevEnd: "2026-10-05", granularity: "day",
    });
    expect(resolvePeriod("30d", TODAY)).toMatchObject({ start: "2026-09-13", prevStart: "2026-08-14", prevEnd: "2026-09-12", granularity: "day" });
    expect(resolvePeriod("90d", TODAY)).toMatchObject({ start: "2026-07-15", granularity: "week" });
  });
  it("year to date compares with the same span last year", () => {
    expect(resolvePeriod("ytd", TODAY)).toEqual({
      range: "ytd", start: "2026-01-01", end: TODAY, prevStart: "2025-01-01", prevEnd: "2025-10-12", granularity: "month",
    });
  });
  it("all time has no start and no previous period", () => {
    expect(resolvePeriod("all", TODAY)).toEqual({
      range: "all", start: null, end: TODAY, prevStart: null, prevEnd: null, granularity: "month",
    });
  });
});

describe("shopDay", () => {
  it("uses New York time: 9:30 pm EDT is still the same day", () => {
    expect(shopDay("2026-10-13T01:30:00.000Z")).toBe("2026-10-12");
    expect(shopDay("2026-10-12T15:00:00.000Z")).toBe("2026-10-12");
  });
});

describe("shiftYears", () => {
  it("moves a date by whole years and folds Feb 29", () => {
    expect(shiftYears("2026-10-12", -1)).toBe("2025-10-12");
    expect(shiftYears("2028-02-29", -1)).toBe("2027-02-28");
  });
});

describe("inPeriod", () => {
  it("is inclusive and treats a null start as open", () => {
    expect(inPeriod("2026-09-13", "2026-09-13", TODAY)).toBe(true);
    expect(inPeriod("2026-09-12", "2026-09-13", TODAY)).toBe(false);
    expect(inPeriod("2019-01-01", null, TODAY)).toBe(true);
    expect(inPeriod("2026-10-13", null, TODAY)).toBe(false);
  });
});

describe("buckets", () => {
  it("keys days, Monday-starting weeks and months", () => {
    expect(bucketKey("2026-10-14", "day")).toBe("2026-10-14");
    expect(bucketKey("2026-10-14", "week")).toBe("2026-10-12");
    expect(bucketKey("2026-10-18", "week")).toBe("2026-10-12"); // Sunday belongs to the week that started Monday
    expect(bucketKey("2026-10-14", "month")).toBe("2026-10");
  });
  it("lists every bucket of the period, oldest first", () => {
    expect(bucketKeys(resolvePeriod("7d", TODAY))).toEqual([
      "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12",
    ]);
    expect(bucketKeys(resolvePeriod("ytd", TODAY))).toHaveLength(10);
    const all = bucketKeys(resolvePeriod("all", TODAY));
    expect(all).toHaveLength(12);
    expect(all[0]).toBe("2025-11");
    expect(all[11]).toBe("2026-10");
    const weeks = bucketKeys(resolvePeriod("90d", TODAY));
    expect(weeks[0]).toBe("2026-07-13");
    expect(weeks[weeks.length - 1]).toBe("2026-10-12");
  });
});

describe("delta", () => {
  it("is a rounded percent, 'new' from zero, and 'none' with no comparison", () => {
    expect(delta(118, 100)).toEqual({ kind: "pct", pct: 18 });
    expect(delta(80, 100)).toEqual({ kind: "pct", pct: -20 });
    expect(delta(5, 0)).toEqual({ kind: "new" });
    expect(delta(0, 0)).toEqual({ kind: "none" });
    expect(delta(5, null)).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-period.test.ts`
Expected: FAIL, because `@/lib/metrics/period` cannot be resolved.

- [ ] **Step 3: Implement**

```ts
// lib/metrics/period.ts
// Calendar math for the metrics screen, always in the shop's own time zone.
// Pure (no DB, no server-only) so client components can import the types.
import { addDaysStr, shopDateStr } from "@/lib/tv-slots";

export type MetricsRange = "7d" | "30d" | "90d" | "ytd" | "all";
export const METRICS_RANGES: readonly MetricsRange[] = ["7d", "30d", "90d", "ytd", "all"];
export type Granularity = "day" | "week" | "month";

export type Period = {
  range: MetricsRange;
  /** First shop-local day (YYYY-MM-DD), inclusive; null = since the beginning. */
  start: string | null;
  end: string;
  prevStart: string | null;
  prevEnd: string | null;
  granularity: Granularity;
};

const ROLLING_DAYS: Partial<Record<MetricsRange, number>> = { "7d": 7, "30d": 30, "90d": 90 };

/** Shop-local calendar day of an ISO instant. */
export function shopDay(iso: string): string {
  return shopDateStr(new Date(iso));
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function shiftYears(ymd: string, years: number): string {
  const y = Number(ymd.slice(0, 4)) + years;
  const md = ymd.slice(5);
  return md === "02-29" && !isLeap(y) ? `${y}-02-28` : `${y}-${md}`;
}

export function resolvePeriod(range: MetricsRange, today: string): Period {
  const span = ROLLING_DAYS[range];
  if (span) {
    const start = addDaysStr(today, -(span - 1));
    return {
      range, start, end: today,
      prevStart: addDaysStr(start, -span), prevEnd: addDaysStr(start, -1),
      granularity: span === 90 ? "week" : "day",
    };
  }
  if (range === "ytd") {
    const start = `${today.slice(0, 4)}-01-01`;
    return { range, start, end: today, prevStart: shiftYears(start, -1), prevEnd: shiftYears(today, -1), granularity: "month" };
  }
  return { range, start: null, end: today, prevStart: null, prevEnd: null, granularity: "month" };
}

export function inPeriod(day: string, start: string | null, end: string): boolean {
  return (start === null || day >= start) && day <= end;
}

export function bucketKey(day: string, g: Granularity): string {
  if (g === "day") return day;
  if (g === "month") return day.slice(0, 7);
  const mondayOffset = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysStr(day, -mondayOffset);
}

function addMonths(ym: string, n: number): string {
  const d = new Date(`${ym}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Every bucket of the period, oldest first. "Todo" shows the last 12 months. */
export function bucketKeys(p: Period): string[] {
  const keys: string[] = [];
  if (p.granularity === "month") {
    const last = p.end.slice(0, 7);
    let cur = p.start ? p.start.slice(0, 7) : addMonths(last, -11);
    while (cur <= last) {
      keys.push(cur);
      cur = addMonths(cur, 1);
    }
    return keys;
  }
  const step = p.granularity === "week" ? 7 : 1;
  const last = bucketKey(p.end, p.granularity);
  for (let k = bucketKey(p.start as string, p.granularity); k <= last; k = addDaysStr(k, step)) keys.push(k);
  return keys;
}

export type Delta = { kind: "pct"; pct: number } | { kind: "new" } | { kind: "none" };

export function delta(cur: number, prev: number | null): Delta {
  if (prev === null) return { kind: "none" };
  if (prev === 0) return cur > 0 ? { kind: "new" } : { kind: "none" };
  return { kind: "pct", pct: Math.round(((cur - prev) / prev) * 100) };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-period.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/period.ts tests/unit/metrics-period.test.ts
git commit -m "feat(metrics): períodos, buckets y deltas en hora de la tienda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Orders, summary and sales trend (`lib/metrics/orders.ts`)

**Files:**
- Create: `lib/metrics/orders.ts`, `tests/unit/metrics-fixtures.ts` (shared test factory)
- Test: `tests/unit/metrics-orders.test.ts`

**Interfaces:**
- Consumes: `Period`, `bucketKey`, `bucketKeys`, `shiftYears`, `inPeriod` (Task 1); `OrderMetricRow` from `lib/metrics.ts` (existing).
- Produces: `MetricOrder`, `isLive(o)`, `countsAsRevenue(o)`, `revenueOf(o)`, `between(orders, start, end)`, `PeriodStats`, `periodStats(orders)`, `TrendPoint`, `salesTrend(orders, period)`, `pendingPayments(orders)`. Test factory `mo(partial)` in `tests/unit/metrics-fixtures.ts`.

- [ ] **Step 1: Write the shared factory and the failing test**

```ts
// tests/unit/metrics-fixtures.ts
import type { MetricOrder } from "@/lib/metrics/orders";

let n = 0;
/** A paid, delivered $100 phone order on `day`; override any field. */
export function mo(p: Partial<MetricOrder> & { day: string }): MetricOrder {
  n += 1;
  return {
    id: `o${n}`, customerId: null, contactPhone: "5165550100", contactName: "Ana", source: "phone",
    totalCents: 10000, amountPaidCents: 10000, paymentStatus: "paid", fulfillmentStatus: "delivered",
    createdAt: `${p.day}T15:00:00.000Z`, linesJson: "[]", addressZip: null,
    windowDate: null, windowSlot: null, windowTime: null, funeral: false,
    discountCents: 0, promoCode: null, giftCardCents: 0, houseAccount: false,
    ...p,
  };
}
```

```ts
// tests/unit/metrics-orders.test.ts
import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/metrics/period";
import { between, periodStats, salesTrend, pendingPayments } from "@/lib/metrics/orders";
import { mo } from "./metrics-fixtures";

describe("periodStats", () => {
  it("counts non-canceled orders and collected, non-refunded revenue", () => {
    const s = periodStats([
      mo({ day: "2026-10-01", amountPaidCents: 6000 }),
      mo({ day: "2026-10-02", amountPaidCents: 0, paymentStatus: "pending" }),
      mo({ day: "2026-10-03", fulfillmentStatus: "canceled" }),
      mo({ day: "2026-10-04", paymentStatus: "refunded" }),
    ]);
    expect(s).toEqual({ revenueCents: 6000, orderCount: 3, paidOrderCount: 1, aovCents: 6000 });
  });
});

describe("between", () => {
  it("keeps orders whose shop day is inside the range", () => {
    const os = [mo({ day: "2026-09-12" }), mo({ day: "2026-09-13" }), mo({ day: "2026-10-12" })];
    expect(between(os, "2026-09-13", "2026-10-12").map((o) => o.day)).toEqual(["2026-09-13", "2026-10-12"]);
  });
});

describe("salesTrend", () => {
  it("puts this year in each bucket and last year's same dates beside it", () => {
    const p = resolvePeriod("7d", "2026-10-12");
    const pts = salesTrend([
      mo({ day: "2026-10-10", amountPaidCents: 5000 }),
      mo({ day: "2026-10-10", amountPaidCents: 3000 }),
      mo({ day: "2025-10-10", amountPaidCents: 4000 }),
      mo({ day: "2026-10-12", fulfillmentStatus: "canceled" }),
    ], p);
    expect(pts).toHaveLength(7);
    expect(pts.find((x) => x.key === "2026-10-10")).toEqual({
      key: "2026-10-10", revenueCents: 8000, orders: 2, prevRevenueCents: 4000, prevOrders: 1,
    });
    expect(pts.find((x) => x.key === "2026-10-12")).toMatchObject({ orders: 0 });
  });
});

describe("pendingPayments", () => {
  it("sums open balances of live orders, leaving house-account orders to their statements", () => {
    expect(pendingPayments([
      mo({ day: "2026-10-01", totalCents: 10000, amountPaidCents: 4000, paymentStatus: "pending" }),
      mo({ day: "2026-10-02", totalCents: 5000, amountPaidCents: 0, paymentStatus: "pending", houseAccount: true }),
      mo({ day: "2026-10-03", totalCents: 5000, amountPaidCents: 0, paymentStatus: "pending", fulfillmentStatus: "canceled" }),
      mo({ day: "2026-10-04" }),
    ])).toEqual({ count: 1, cents: 6000 });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-orders.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

```ts
// lib/metrics/orders.ts
// The order shape every metrics module works on, plus the summary numbers and
// the this-year-vs-last-year trend. Pure.
import type { OrderMetricRow } from "@/lib/metrics";
import { bucketKey, bucketKeys, inPeriod, shiftYears, type Period } from "@/lib/metrics/period";

export type MetricOrder = OrderMetricRow & {
  id: string;
  /** Linked customer, or the customer whose phone matches the contact phone. */
  customerId: string | null;
  contactPhone: string;
  contactName: string | null;
  source: string;
  /** Shop-local day the order was placed (YYYY-MM-DD). */
  day: string;
  windowDate: string | null;
  windowSlot: string | null;
  windowTime: string | null;
  funeral: boolean;
  discountCents: number;
  promoCode: string | null;
  giftCardCents: number;
  /** Billed through a house account: its balance lives on the statements. */
  houseAccount: boolean;
};

export const isLive = (o: MetricOrder) => o.fulfillmentStatus !== "canceled";
export const countsAsRevenue = (o: MetricOrder) => isLive(o) && o.paymentStatus !== "refunded";
export const revenueOf = (o: MetricOrder) => (countsAsRevenue(o) ? o.amountPaidCents : 0);

export function between(orders: MetricOrder[], start: string | null, end: string): MetricOrder[] {
  return orders.filter((o) => inPeriod(o.day, start, end));
}

export type PeriodStats = { revenueCents: number; orderCount: number; paidOrderCount: number; aovCents: number };

export function periodStats(orders: MetricOrder[]): PeriodStats {
  let revenueCents = 0;
  let orderCount = 0;
  let paidOrderCount = 0;
  for (const o of orders) {
    if (!isLive(o)) continue;
    orderCount += 1;
    const rev = revenueOf(o);
    revenueCents += rev;
    if (rev > 0) paidOrderCount += 1;
  }
  return { revenueCents, orderCount, paidOrderCount, aovCents: paidOrderCount ? Math.round(revenueCents / paidOrderCount) : 0 };
}

export type TrendPoint = { key: string; revenueCents: number; orders: number; prevRevenueCents: number; prevOrders: number };

/** One point per bucket: this period, and the same dates one year earlier. */
export function salesTrend(orders: MetricOrder[], period: Period): TrendPoint[] {
  const keys = bucketKeys(period);
  const index = new Map(keys.map((k, i) => [k, i]));
  const points: TrendPoint[] = keys.map((key) => ({ key, revenueCents: 0, orders: 0, prevRevenueCents: 0, prevOrders: 0 }));
  for (const o of orders) {
    if (!isLive(o)) continue;
    const rev = revenueOf(o);
    const cur = index.get(bucketKey(o.day, period.granularity));
    if (cur !== undefined) {
      points[cur].revenueCents += rev;
      points[cur].orders += 1;
    }
    const prev = index.get(bucketKey(shiftYears(o.day, 1), period.granularity));
    if (prev !== undefined) {
      points[prev].prevRevenueCents += rev;
      points[prev].prevOrders += 1;
    }
  }
  return points;
}

/** Money still to collect on regular orders, whatever their date. */
export function pendingPayments(orders: MetricOrder[]): { count: number; cents: number } {
  let count = 0;
  let cents = 0;
  for (const o of orders) {
    if (!countsAsRevenue(o) || o.houseAccount) continue;
    const open = o.totalCents - o.amountPaidCents;
    if (open > 0) {
      count += 1;
      cents += open;
    }
  }
  return { count, cents };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/orders.ts tests/unit/metrics-fixtures.ts tests/unit/metrics-orders.test.ts
git commit -m "feat(metrics): resumen del período, tendencia contra el año pasado y saldos por cobrar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sales tab calculations (`lib/metrics/sales.ts`)

**Files:**
- Create: `lib/metrics/sales.ts`
- Test: `tests/unit/metrics-sales.test.ts`

**Interfaces:**
- Consumes: `MetricOrder`, `isLive`, `revenueOf` (Task 2); `Period`, `bucketKey`, `bucketKeys`, `delta`, `Delta` (Task 1); `mo` from `tests/unit/metrics-fixtures.ts`.
- Produces: `CHANNELS`, `ChannelId`, `channelOf(source)`, `ChannelBucket`, `channelTrend(orders, period)`, `ChannelShare`, `channelShares(cur, prev)`, `LineValue`, `ProductRevenue`, `productRevenue(cur, prev, resolveLine, limit?)`, `PromoStats`, `promoStats(orders)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/metrics-sales.test.ts
import { describe, it, expect } from "vitest";
import { resolvePeriod } from "@/lib/metrics/period";
import { channelOf, channelTrend, channelShares, productRevenue, promoStats, type LineValue } from "@/lib/metrics/sales";
import { mo } from "./metrics-fixtures";

describe("channelOf", () => {
  it("maps known sources and folds anything else into the shop", () => {
    expect(channelOf("web")).toBe("web");
    expect(channelOf("whatsapp")).toBe("whatsapp");
    expect(channelOf("mystery")).toBe("walk-in");
  });
});

describe("channelTrend", () => {
  it("splits each bucket's revenue by channel", () => {
    const p = resolvePeriod("7d", "2026-10-12");
    const b = channelTrend([
      mo({ day: "2026-10-12", source: "web", amountPaidCents: 3000 }),
      mo({ day: "2026-10-12", source: "phone", amountPaidCents: 2000 }),
    ], p);
    expect(b).toHaveLength(7);
    expect(b[6]).toEqual({ key: "2026-10-12", web: 3000, phone: 2000, whatsapp: 0, "walk-in": 0, event: 0 });
  });
});

describe("channelShares", () => {
  it("gives every channel in fixed order with its share and change in points", () => {
    const cur = [mo({ day: "2026-10-01", source: "web", amountPaidCents: 6000 }), mo({ day: "2026-10-01", source: "phone", amountPaidCents: 4000 })];
    const prev = [mo({ day: "2026-09-01", source: "web", amountPaidCents: 5000 }), mo({ day: "2026-09-01", source: "phone", amountPaidCents: 5000 })];
    const s = channelShares(cur, prev);
    expect(s.map((x) => x.channel)).toEqual(["web", "phone", "whatsapp", "walk-in", "event"]);
    expect(s[0]).toEqual({ channel: "web", cents: 6000, orders: 1, sharePct: 60, shareDeltaPts: 10 });
    expect(channelShares(cur, null)[0].shareDeltaPts).toBeNull();
  });
});

describe("productRevenue", () => {
  const resolve = (line: Record<string, unknown>): LineValue | null =>
    line.kind === "custom"
      ? { key: "__custom__", name: "Personalizados", cents: (line.priceCents as number) * (line.qty as number) }
      : { key: line.productId as string, name: `P ${line.productId}`, cents: 5000 * (line.qty as number) };
  const lines = (...ls: object[]) => JSON.stringify(ls);

  it("ranks by revenue from paid orders and compares with the previous period", () => {
    const cur = [
      mo({ day: "2026-10-01", linesJson: lines({ kind: "catalog", productId: "a", qty: 2 }) }),
      mo({ day: "2026-10-02", linesJson: lines({ kind: "custom", priceCents: 20000, qty: 1 }) }),
      mo({ day: "2026-10-03", amountPaidCents: 0, paymentStatus: "pending", linesJson: lines({ kind: "catalog", productId: "b", qty: 9 }) }),
    ];
    const prev = [mo({ day: "2026-09-01", linesJson: lines({ kind: "catalog", productId: "a", qty: 1 }) })];
    expect(productRevenue(cur, prev, resolve)).toEqual([
      { key: "__custom__", name: "Personalizados", qty: 1, cents: 20000, delta: { kind: "new" } },
      { key: "a", name: "P a", qty: 2, cents: 10000, delta: { kind: "pct", pct: 100 } },
    ]);
  });
});

describe("promoStats", () => {
  it("adds up discounts, codes, gift cards and the funeral share", () => {
    expect(promoStats([
      mo({ day: "2026-10-01", discountCents: 1000, promoCode: "DIVA10", amountPaidCents: 9000 }),
      mo({ day: "2026-10-02", giftCardCents: 2500, funeral: true, amountPaidCents: 1000 }),
      mo({ day: "2026-10-03", fulfillmentStatus: "canceled", discountCents: 999, promoCode: "X" }),
    ])).toEqual({ discountCents: 1000, promoOrders: 1, giftCardRedeemedCents: 2500, funeralOrders: 1, funeralSharePct: 10 });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-sales.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

```ts
// lib/metrics/sales.ts
// Ventas tab: revenue by channel, products by revenue, promos and gift cards. Pure.
import { bucketKey, bucketKeys, delta, type Delta, type Period } from "@/lib/metrics/period";
import { isLive, revenueOf, type MetricOrder } from "@/lib/metrics/orders";

export const CHANNELS = ["web", "phone", "whatsapp", "walk-in", "event"] as const;
export type ChannelId = (typeof CHANNELS)[number];

export function channelOf(source: string): ChannelId {
  return (CHANNELS as readonly string[]).includes(source) ? (source as ChannelId) : "walk-in";
}

export type ChannelBucket = { key: string } & Record<ChannelId, number>;

function emptyChannels(): Record<ChannelId, number> {
  return { web: 0, phone: 0, whatsapp: 0, "walk-in": 0, event: 0 };
}

export function channelTrend(orders: MetricOrder[], period: Period): ChannelBucket[] {
  const keys = bucketKeys(period);
  const index = new Map(keys.map((k, i) => [k, i]));
  const buckets: ChannelBucket[] = keys.map((key) => ({ key, ...emptyChannels() }));
  for (const o of orders) {
    const i = index.get(bucketKey(o.day, period.granularity));
    if (i !== undefined) buckets[i][channelOf(o.source)] += revenueOf(o);
  }
  return buckets;
}

export type ChannelShare = { channel: ChannelId; cents: number; orders: number; sharePct: number; shareDeltaPts: number | null };

function sharesOf(orders: MetricOrder[]) {
  const cents = emptyChannels();
  const counts = emptyChannels();
  let total = 0;
  for (const o of orders) {
    if (!isLive(o)) continue;
    const ch = channelOf(o.source);
    const rev = revenueOf(o);
    cents[ch] += rev;
    counts[ch] += 1;
    total += rev;
  }
  return { cents, orders: counts, total };
}

export function channelShares(cur: MetricOrder[], prev: MetricOrder[] | null): ChannelShare[] {
  const now = sharesOf(cur);
  const before = prev ? sharesOf(prev) : null;
  return CHANNELS.map((channel) => {
    const sharePct = now.total ? Math.round((now.cents[channel] / now.total) * 100) : 0;
    const prevPct = before && before.total ? Math.round((before.cents[channel] / before.total) * 100) : null;
    return { channel, cents: now.cents[channel], orders: now.orders[channel], sharePct, shareDeltaPts: prevPct === null ? null : sharePct - prevPct };
  });
}

/** What one cart line is worth: storage resolves catalog prices, custom lines carry their own. */
export type LineValue = { key: string; name: string; cents: number };
export type ProductRevenue = { key: string; name: string; qty: number; cents: number; delta: Delta };

function productTotals(orders: MetricOrder[], resolveLine: (line: Record<string, unknown>) => LineValue | null) {
  const totals = new Map<string, { name: string; qty: number; cents: number }>();
  for (const o of orders) {
    if (revenueOf(o) <= 0) continue; // realized sales only
    let lines: unknown;
    try {
      lines = JSON.parse(o.linesJson);
    } catch {
      continue;
    }
    if (!Array.isArray(lines)) continue;
    for (const raw of lines) {
      const line = raw as Record<string, unknown>;
      const qty = typeof line.qty === "number" ? line.qty : 0;
      if (qty <= 0) continue;
      const v = resolveLine(line);
      if (!v) continue;
      const cur = totals.get(v.key) ?? { name: v.name, qty: 0, cents: 0 };
      cur.qty += qty;
      cur.cents += v.cents;
      totals.set(v.key, cur);
    }
  }
  return totals;
}

export function productRevenue(
  cur: MetricOrder[],
  prev: MetricOrder[] | null,
  resolveLine: (line: Record<string, unknown>) => LineValue | null,
  limit = 8,
): ProductRevenue[] {
  const now = productTotals(cur, resolveLine);
  const before = prev ? productTotals(prev, resolveLine) : null;
  return [...now.entries()]
    .map(([key, v]) => ({ key, name: v.name, qty: v.qty, cents: v.cents, delta: delta(v.cents, before ? before.get(key)?.cents ?? 0 : null) }))
    .sort((a, b) => b.cents - a.cents || b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type PromoStats = { discountCents: number; promoOrders: number; giftCardRedeemedCents: number; funeralOrders: number; funeralSharePct: number };

export function promoStats(orders: MetricOrder[]): PromoStats {
  let discountCents = 0;
  let promoOrders = 0;
  let giftCardRedeemedCents = 0;
  let funeralOrders = 0;
  let funeralCents = 0;
  let totalCents = 0;
  for (const o of orders) {
    if (!isLive(o)) continue;
    discountCents += o.discountCents;
    if (o.promoCode) promoOrders += 1;
    giftCardRedeemedCents += o.giftCardCents;
    const rev = revenueOf(o);
    totalCents += rev;
    if (o.funeral) {
      funeralOrders += 1;
      funeralCents += rev;
    }
  }
  return { discountCents, promoOrders, giftCardRedeemedCents, funeralOrders, funeralSharePct: totalCents ? Math.round((funeralCents / totalCents) * 100) : 0 };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-sales.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/sales.ts tests/unit/metrics-sales.test.ts
git commit -m "feat(metrics): ventas por canal, productos por ingresos y promos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Operations and holidays (`lib/metrics/operations.ts`, `lib/metrics/holidays.ts`)

**Files:**
- Create: `lib/metrics/operations.ts`, `lib/metrics/holidays.ts`
- Test: `tests/unit/metrics-operations.test.ts`

**Interfaces:**
- Consumes: `MetricOrder`, `isLive`, `revenueOf` (Task 2); `inPeriod` (Task 1); `SLOT_ORDER`, `slotForTime`, `addDaysStr`, `dayDiff` from `lib/tv-slots.ts`; `mo` fixture.
- Produces: `Heatmap` (`{ counts: number[][]; total: number }`, weekday 0 = Monday, slots in `SLOT_ORDER`), `weekdaySlotHeatmap(orders, start, end)`, `PeakDay`, `peakDay(h)`, `DayLoad`, `upcomingLoad(orders, today, days?)`, `HolidayId`, `Holiday`, `holidaysForYear(y)`, `nextHoliday(today, withinDays?)`, `weekRevenueUpTo(orders, date)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/metrics-operations.test.ts
import { describe, it, expect } from "vitest";
import { weekdaySlotHeatmap, peakDay, upcomingLoad } from "@/lib/metrics/operations";
import { holidaysForYear, nextHoliday, weekRevenueUpTo } from "@/lib/metrics/holidays";
import { mo } from "./metrics-fixtures";

describe("weekdaySlotHeatmap", () => {
  it("counts live orders by delivery weekday and slot, exact times bucketed into their slot", () => {
    const h = weekdaySlotHeatmap([
      mo({ day: "2026-10-01", windowDate: "2026-10-10", windowSlot: "midday" }), // Saturday
      mo({ day: "2026-10-01", windowDate: "2026-10-10", windowSlot: "midday", windowTime: "16:30" }), // → afternoon
      mo({ day: "2026-10-01", windowDate: "2026-10-12", windowSlot: "morning" }), // Monday
      mo({ day: "2026-10-01", windowDate: "2026-10-10", windowSlot: "midday", fulfillmentStatus: "canceled" }),
      mo({ day: "2026-10-01", windowDate: "2026-08-01", windowSlot: "midday" }), // outside the period
      mo({ day: "2026-10-01" }), // in-store, no window
    ], "2026-09-13", "2026-10-12");
    expect(h.total).toBe(3);
    expect(h.counts[5]).toEqual([0, 1, 1, 0]);
    expect(h.counts[0]).toEqual([1, 0, 0, 0]);
    expect(peakDay(h)).toEqual({ weekday: 5, count: 2, sharePct: 67 });
    expect(peakDay({ counts: h.counts.map((r) => r.map(() => 0)), total: 0 })).toBeNull();
  });
});

describe("upcomingLoad", () => {
  it("lists the next 14 days with their scheduled live orders", () => {
    const load = upcomingLoad([
      mo({ day: "2026-10-01", windowDate: "2026-10-12", windowSlot: "midday" }),
      mo({ day: "2026-10-01", windowDate: "2026-10-17", windowSlot: "midday" }),
      mo({ day: "2026-10-01", windowDate: "2026-10-17", windowSlot: "evening" }),
      mo({ day: "2026-10-01", windowDate: "2026-10-26", windowSlot: "midday" }), // day 15: outside
      mo({ day: "2026-10-01", windowDate: "2026-10-13", windowSlot: "midday", fulfillmentStatus: "canceled" }),
    ], "2026-10-12");
    expect(load).toHaveLength(14);
    expect(load[0]).toEqual({ date: "2026-10-12", count: 1 });
    expect(load[5]).toEqual({ date: "2026-10-17", count: 2 });
    expect(load[13].date).toBe("2026-10-25");
  });
});

describe("holidays", () => {
  it("knows each flower holiday's date, including the moving ones", () => {
    expect(holidaysForYear(2026)).toEqual([
      { id: "valentines", date: "2026-02-14" },
      { id: "mothers_day", date: "2026-05-10" },
      { id: "halloween", date: "2026-10-31" },
      { id: "thanksgiving", date: "2026-11-26" },
      { id: "christmas", date: "2026-12-25" },
    ]);
    expect(holidaysForYear(2025).find((h) => h.id === "mothers_day")?.date).toBe("2025-05-11");
  });
  it("finds the next holiday within 30 days, across the new year", () => {
    expect(nextHoliday("2026-10-12")).toEqual({ id: "halloween", date: "2026-10-31", daysUntil: 19 });
    expect(nextHoliday("2026-06-01")).toBeNull();
    expect(nextHoliday("2026-12-30", 50)).toEqual({ id: "valentines", date: "2027-02-14", daysUntil: 46 });
  });
  it("sums revenue placed in the 7 days up to a date", () => {
    expect(weekRevenueUpTo([
      mo({ day: "2025-10-25", amountPaidCents: 1000 }),
      mo({ day: "2025-10-31", amountPaidCents: 2000 }),
      mo({ day: "2025-10-24", amountPaidCents: 9999 }),
    ], "2025-10-31")).toBe(3000);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-operations.test.ts`
Expected: FAIL, because the modules are not found.

- [ ] **Step 3: Implement**

```ts
// lib/metrics/operations.ts
// Operación tab: when the work happens (weekday × slot) and what is already booked. Pure.
import type { DeliverySlot } from "@/types/order";
import { SLOT_ORDER, addDaysStr, slotForTime } from "@/lib/tv-slots";
import { inPeriod } from "@/lib/metrics/period";
import { isLive, type MetricOrder } from "@/lib/metrics/orders";

/** counts[weekday][slot]: weekday 0 = Monday … 6 = Sunday; slots in SLOT_ORDER. */
export type Heatmap = { counts: number[][]; total: number };

function slotOf(o: MetricOrder): DeliverySlot | null {
  if (o.windowTime) return slotForTime(o.windowTime);
  return (SLOT_ORDER as string[]).includes(o.windowSlot ?? "") ? (o.windowSlot as DeliverySlot) : null;
}

function weekdayOf(ymd: string): number {
  return (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Deliveries and pickups whose scheduled day falls inside [start, end]. */
export function weekdaySlotHeatmap(orders: MetricOrder[], start: string | null, end: string): Heatmap {
  const counts = Array.from({ length: 7 }, () => SLOT_ORDER.map(() => 0));
  let total = 0;
  for (const o of orders) {
    if (!isLive(o) || !o.windowDate || !inPeriod(o.windowDate, start, end)) continue;
    const slot = slotOf(o);
    if (!slot) continue;
    counts[weekdayOf(o.windowDate)][SLOT_ORDER.indexOf(slot)] += 1;
    total += 1;
  }
  return { counts, total };
}

export type PeakDay = { weekday: number; count: number; sharePct: number };

export function peakDay(h: Heatmap): PeakDay | null {
  if (h.total === 0) return null;
  let best = 0;
  let bestCount = -1;
  h.counts.forEach((row, weekday) => {
    const c = row.reduce((s, v) => s + v, 0);
    if (c > bestCount) {
      best = weekday;
      bestCount = c;
    }
  });
  return { weekday: best, count: bestCount, sharePct: Math.round((bestCount / h.total) * 100) };
}

export type DayLoad = { date: string; count: number };

/** Live orders already scheduled for each of the next `days` days, starting today. */
export function upcomingLoad(orders: MetricOrder[], today: string, days = 14): DayLoad[] {
  const load: DayLoad[] = Array.from({ length: days }, (_, i) => ({ date: addDaysStr(today, i), count: 0 }));
  const index = new Map(load.map((d, i) => [d.date, i]));
  for (const o of orders) {
    if (!isLive(o) || !o.windowDate) continue;
    const i = index.get(o.windowDate);
    if (i !== undefined) load[i].count += 1;
  }
  return load;
}
```

```ts
// lib/metrics/holidays.ts
// The flower holidays the insights warn about, and last year's sales the week before each. Pure.
import { addDaysStr, dayDiff } from "@/lib/tv-slots";
import { revenueOf, type MetricOrder } from "@/lib/metrics/orders";

export type HolidayId = "valentines" | "mothers_day" | "halloween" | "thanksgiving" | "christmas";
export type Holiday = { id: HolidayId; date: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** The nth given weekday (0 = Sunday) of a month. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstDow + 7) % 7) + (nth - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function holidaysForYear(y: number): Holiday[] {
  return [
    { id: "valentines", date: `${y}-02-14` },
    { id: "mothers_day", date: nthWeekday(y, 5, 0, 2) },
    { id: "halloween", date: `${y}-10-31` },
    { id: "thanksgiving", date: nthWeekday(y, 11, 4, 4) },
    { id: "christmas", date: `${y}-12-25` },
  ];
}

export function nextHoliday(today: string, withinDays = 30): (Holiday & { daysUntil: number }) | null {
  const y = Number(today.slice(0, 4));
  for (const h of [...holidaysForYear(y), ...holidaysForYear(y + 1)]) {
    const daysUntil = dayDiff(today, h.date);
    if (daysUntil >= 0) return daysUntil <= withinDays ? { ...h, daysUntil } : null;
  }
  return null;
}

/** Revenue from orders placed in the 7 days ending on `date` (inclusive). */
export function weekRevenueUpTo(orders: MetricOrder[], date: string): number {
  const from = addDaysStr(date, -6);
  return orders.reduce((s, o) => (o.day >= from && o.day <= date ? s + revenueOf(o) : s), 0);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-operations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/operations.ts lib/metrics/holidays.ts tests/unit/metrics-operations.test.ts
git commit -m "feat(metrics): mapa de calor de entregas, carga de 14 días y feriados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Customers tab calculations (`lib/metrics/customers.ts`)

**Files:**
- Create: `lib/metrics/customers.ts`
- Test: `tests/unit/metrics-customers.test.ts`

**Interfaces:**
- Consumes: `MetricOrder`, `isLive`, `revenueOf` (Task 2); `mo` fixture.
- Produces: `buyerKey(o)`, `firstOrderDays(orders)`, `BuyerSplit`, `newVsReturning(cur, firstDays, start)`, `TopCustomer`, `topCustomers(cur, limit?)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/metrics-customers.test.ts
import { describe, it, expect } from "vitest";
import { buyerKey, firstOrderDays, newVsReturning, topCustomers } from "@/lib/metrics/customers";
import { mo } from "./metrics-fixtures";

describe("buyerKey", () => {
  it("prefers the customer id and falls back to the last 10 phone digits", () => {
    expect(buyerKey(mo({ day: "2026-10-01", customerId: "cus_1" }))).toBe("cus_1");
    expect(buyerKey(mo({ day: "2026-10-01", contactPhone: "+1 (516) 555-0100" }))).toBe("phone:5165550100");
    expect(buyerKey(mo({ day: "2026-10-01", contactPhone: "n/a" }))).toBeNull();
  });
});

describe("newVsReturning", () => {
  const all = [
    mo({ day: "2026-03-01", customerId: "old" }),
    mo({ day: "2026-10-02", customerId: "old", amountPaidCents: 4000 }),
    mo({ day: "2026-10-03", customerId: "new1", amountPaidCents: 6000 }),
    mo({ day: "2026-10-04", customerId: "new1", amountPaidCents: 1000 }),
  ];
  const cur = all.filter((o) => o.day >= "2026-09-13");

  it("calls a buyer new when their first order falls inside the period", () => {
    expect(newVsReturning(cur, firstOrderDays(all), "2026-09-13")).toEqual({
      newBuyers: 1, newCents: 7000, returningBuyers: 1, returningCents: 4000,
    });
  });
  it("for all time, a buyer with one order is new and the rest repeat", () => {
    expect(newVsReturning(all, firstOrderDays(all), null)).toEqual({
      newBuyers: 0, newCents: 0, returningBuyers: 2, returningCents: 21000,
    });
  });
});

describe("topCustomers", () => {
  it("ranks buyers by revenue in the period", () => {
    expect(topCustomers([
      mo({ day: "2026-10-01", customerId: "a", contactName: "Ana", amountPaidCents: 3000 }),
      mo({ day: "2026-10-02", customerId: "a", contactName: "Ana", amountPaidCents: 3000 }),
      mo({ day: "2026-10-03", customerId: "b", contactName: "Beto", amountPaidCents: 5000 }),
    ])).toEqual([
      { key: "a", customerId: "a", name: "Ana", cents: 6000, orders: 2 },
      { key: "b", customerId: "b", name: "Beto", cents: 5000, orders: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-customers.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

```ts
// lib/metrics/customers.ts
// Clientes tab: new vs returning buyers and the best buyers of the period. Pure.
import { isLive, revenueOf, type MetricOrder } from "@/lib/metrics/orders";

export function buyerKey(o: Pick<MetricOrder, "customerId" | "contactPhone">): string | null {
  if (o.customerId) return o.customerId;
  const digits = o.contactPhone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `phone:${digits}` : null;
}

/** Day of each buyer's first live order, across the whole history. */
export function firstOrderDays(orders: MetricOrder[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const o of orders) {
    if (!isLive(o)) continue;
    const key = buyerKey(o);
    if (!key) continue;
    const seen = first.get(key);
    if (!seen || o.day < seen) first.set(key, o.day);
  }
  return first;
}

export type BuyerSplit = { newBuyers: number; newCents: number; returningBuyers: number; returningCents: number };

/**
 * A buyer is new when their first order ever falls inside the period. With no
 * period start (all time) that would make everyone new, so there a buyer with a
 * single order counts as new and anyone with more as returning.
 */
export function newVsReturning(cur: MetricOrder[], firstDays: Map<string, string>, start: string | null): BuyerSplit {
  const byBuyer = new Map<string, { orders: number; cents: number }>();
  for (const o of cur) {
    if (!isLive(o)) continue;
    const key = buyerKey(o);
    if (!key) continue;
    const b = byBuyer.get(key) ?? { orders: 0, cents: 0 };
    b.orders += 1;
    b.cents += revenueOf(o);
    byBuyer.set(key, b);
  }
  const split: BuyerSplit = { newBuyers: 0, newCents: 0, returningBuyers: 0, returningCents: 0 };
  for (const [key, b] of byBuyer) {
    const isNew = start === null ? b.orders === 1 : (firstDays.get(key) ?? "") >= start;
    if (isNew) {
      split.newBuyers += 1;
      split.newCents += b.cents;
    } else {
      split.returningBuyers += 1;
      split.returningCents += b.cents;
    }
  }
  return split;
}

export type TopCustomer = { key: string; customerId: string | null; name: string; cents: number; orders: number };

export function topCustomers(cur: MetricOrder[], limit = 10): TopCustomer[] {
  const byBuyer = new Map<string, TopCustomer>();
  for (const o of cur) {
    if (!isLive(o)) continue;
    const key = buyerKey(o);
    if (!key) continue;
    const t = byBuyer.get(key) ?? { key, customerId: o.customerId, name: o.contactName?.trim() || o.contactPhone, cents: 0, orders: 0 };
    t.cents += revenueOf(o);
    t.orders += 1;
    byBuyer.set(key, t);
  }
  return [...byBuyer.values()]
    .filter((t) => t.cents > 0)
    .sort((a, b) => b.cents - a.cents || b.orders - a.orders || a.name.localeCompare(b.name))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-customers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/customers.ts tests/unit/metrics-customers.test.ts
git commit -m "feat(metrics): clientes nuevos vs que repiten y mejores clientes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Insight rules (`lib/metrics-insights.ts`)

**Files:**
- Create: `lib/metrics-insights.ts`
- Test: `tests/unit/metrics-insights.test.ts`

**Interfaces:**
- Consumes: `Delta` (Task 1); `HolidayId` (Task 4); `ChannelId` (Task 3).
- Produces: `InsightId`, `Insight`, `InsightInput`, `buildInsights(input)`. The UI turns an `Insight` into text with `t(insight.key, …)` (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/metrics-insights.test.ts
import { describe, it, expect } from "vitest";
import { buildInsights, type InsightInput } from "@/lib/metrics-insights";

const quiet: InsightInput = {
  locale: "es", revenueDelta: { kind: "pct", pct: 3 }, pending: { count: 0, cents: 0 },
  upcomingDates7: 0, holiday: null, atRiskCount: 0, peakDay: null, ordersInPeriod: 5, channelShift: null,
};

describe("buildInsights", () => {
  it("says there is nothing new when no rule fires", () => {
    expect(buildInsights(quiet)).toEqual([{ id: "none", icon: "🌿", key: "insight_none", values: {}, refs: {} }]);
  });

  it("orders money and near dates before trends and caps at five", () => {
    const out = buildInsights({
      ...quiet,
      revenueDelta: { kind: "pct", pct: 18 },
      pending: { count: 7, cents: 184000 },
      upcomingDates7: 12,
      holiday: { id: "halloween", daysUntil: 19, lastYearCents: 230000 },
      atRiskCount: 14,
      peakDay: { weekday: 5, count: 31, sharePct: 31 },
      ordersInPeriod: 96,
      channelShift: { channel: "web", pts: 6 },
    });
    expect(out.map((i) => i.id)).toEqual(["pending_payments", "upcoming_dates", "holiday_ahead", "at_risk", "revenue_trend"]);
    expect(out[0]).toEqual({
      id: "pending_payments", icon: "💳", key: "insight_pending", values: { n: 7, amountCents: 184000 }, refs: {},
      action: { kind: "link", href: "/es/admin/dashboard/ledger" },
    });
    expect(out[1].action).toEqual({ kind: "tab", tab: "customers" });
    expect(out[2]).toMatchObject({ key: "insight_holiday", values: { days: 19, amountCents: 230000 }, refs: { holiday: "halloween" } });
    expect(out[3].action).toEqual({ kind: "link", href: "/es/admin/campaigns" });
    expect(out[4]).toMatchObject({ key: "insight_revenue_up", values: { pct: 18 } });
  });

  it("reads a drop, a channel shift and a weekday peak", () => {
    const out = buildInsights({
      ...quiet,
      revenueDelta: { kind: "pct", pct: -15 },
      peakDay: { weekday: 5, count: 31, sharePct: 31 },
      ordersInPeriod: 40,
      channelShift: { channel: "phone", pts: -7 },
    });
    expect(out.map((i) => i.key)).toEqual(["insight_revenue_down", "insight_channel_down", "insight_peak_day"]);
    expect(out[0].values).toEqual({ pct: 15 });
    expect(out[1]).toMatchObject({ values: { pts: 7 }, refs: { channel: "phone" } });
    expect(out[2]).toMatchObject({ values: { pct: 31 }, refs: { weekday: 5 } });
  });

  it("skips a holiday nobody bought for last year and a peak on few orders", () => {
    const out = buildInsights({
      ...quiet,
      holiday: { id: "christmas", daysUntil: 10, lastYearCents: 0 },
      peakDay: { weekday: 5, count: 3, sharePct: 60 },
      ordersInPeriod: 5,
    });
    expect(out.map((i) => i.id)).toEqual(["none"]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-insights.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

```ts
// lib/metrics-insights.ts
// "Lo que hay que saber": fixed rules over numbers the payload already has.
// No AI: same data, same sentences. The UI renders `key` with next-intl.
import type { Delta } from "@/lib/metrics/period";
import type { HolidayId } from "@/lib/metrics/holidays";
import type { ChannelId } from "@/lib/metrics/sales";

export type InsightId =
  | "pending_payments" | "upcoming_dates" | "holiday_ahead" | "at_risk"
  | "revenue_trend" | "channel_shift" | "peak_day" | "none";

export type Insight = {
  id: InsightId;
  icon: string;
  /** admin_metrics message key. */
  key: string;
  /** Numbers for the message; `amountCents` is formatted as money by the UI. */
  values: Record<string, number>;
  /** Names the UI translates itself: holiday, weekday (0 = Monday), channel. */
  refs: { holiday?: HolidayId; weekday?: number; channel?: ChannelId };
  action?: { kind: "link"; href: string } | { kind: "tab"; tab: "sales" | "operations" | "customers" };
};

export type InsightInput = {
  locale: "en" | "es";
  revenueDelta: Delta;
  pending: { count: number; cents: number };
  upcomingDates7: number;
  holiday: { id: HolidayId; daysUntil: number; lastYearCents: number } | null;
  atRiskCount: number;
  peakDay: { weekday: number; count: number; sharePct: number } | null;
  ordersInPeriod: number;
  channelShift: { channel: ChannelId; pts: number } | null;
};

const MAX = 5;
const TREND_THRESHOLD_PCT = 10;
const PEAK_MIN_ORDERS = 20;
const CHANNEL_SHIFT_PTS = 5;

export function buildInsights(input: InsightInput): Insight[] {
  const admin = `/${input.locale}/admin`;
  const out: Insight[] = [];

  // Money and near dates: what to act on today.
  if (input.pending.count > 0) {
    out.push({
      id: "pending_payments", icon: "💳", key: "insight_pending",
      values: { n: input.pending.count, amountCents: input.pending.cents }, refs: {},
      action: { kind: "link", href: `${admin}/dashboard/ledger` },
    });
  }
  if (input.upcomingDates7 > 0) {
    out.push({
      id: "upcoming_dates", icon: "🎂", key: input.upcomingDates7 === 1 ? "insight_upcoming_dates_one" : "insight_upcoming_dates",
      values: { n: input.upcomingDates7 }, refs: {}, action: { kind: "tab", tab: "customers" },
    });
  }
  if (input.holiday && input.holiday.lastYearCents > 0) {
    out.push({
      id: "holiday_ahead", icon: "📅", key: "insight_holiday",
      values: { days: input.holiday.daysUntil, amountCents: input.holiday.lastYearCents }, refs: { holiday: input.holiday.id },
    });
  }
  if (input.atRiskCount > 0) {
    out.push({
      id: "at_risk", icon: "💤", key: "insight_at_risk", values: { n: input.atRiskCount }, refs: {},
      action: { kind: "link", href: `${admin}/campaigns` },
    });
  }

  // Trends: how the period reads.
  if (input.revenueDelta.kind === "pct" && Math.abs(input.revenueDelta.pct) >= TREND_THRESHOLD_PCT) {
    const up = input.revenueDelta.pct > 0;
    out.push({
      id: "revenue_trend", icon: up ? "📈" : "📉", key: up ? "insight_revenue_up" : "insight_revenue_down",
      values: { pct: Math.abs(input.revenueDelta.pct) }, refs: {},
    });
  }
  if (input.channelShift && Math.abs(input.channelShift.pts) >= CHANNEL_SHIFT_PTS) {
    const up = input.channelShift.pts > 0;
    out.push({
      id: "channel_shift", icon: up ? "↗️" : "↘️", key: up ? "insight_channel_up" : "insight_channel_down",
      values: { pts: Math.abs(input.channelShift.pts) }, refs: { channel: input.channelShift.channel },
      action: { kind: "tab", tab: "sales" },
    });
  }
  if (input.peakDay && input.ordersInPeriod >= PEAK_MIN_ORDERS) {
    out.push({
      id: "peak_day", icon: "🗓️", key: "insight_peak_day",
      values: { pct: input.peakDay.sharePct }, refs: { weekday: input.peakDay.weekday },
      action: { kind: "tab", tab: "operations" },
    });
  }

  return out.length ? out.slice(0, MAX) : [{ id: "none", icon: "🌿", key: "insight_none", values: {}, refs: {} }];
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-insights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics-insights.ts tests/unit/metrics-insights.test.ts
git commit -m "feat(metrics): reglas de insights para «Lo que hay que saber»

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Storage, payload, API and page

**Files:**
- Modify: `lib/metrics-storage.ts` (full rewrite below)
- Modify: `lib/customer-dates-storage.ts`: `UpcomingOccasion` gains `recipientPhone?: string`, and `listUpcomingOccasions` selects `d.recipient_phone`
- Modify: `app/api/admin/metrics/route.ts`, `app/[locale]/admin/metrics/page.tsx`
- Modify tests: `tests/unit/metrics-storage.test.ts` (full rewrite), `tests/unit/api-admin-metrics.test.ts`

**Interfaces:**
- Consumes: Tasks 1–6; `PRODUCTS` (`data/products.ts`); `resolveCartLine` (`lib/cart-helpers.ts`); `byZone`, `ZoneRank` (`lib/metrics.ts`); `findDeliveryZoneByZip` (`lib/delivery-zones.ts`); `receivablesSummary` (`lib/house-account-storage.ts`); `listCustomers`, `customerStats` (`lib/customer-storage.ts`); `listUpcomingOccasions` (`lib/customer-dates-storage.ts`); `shopDateStr` (`lib/tv-slots.ts`).
- Produces (used by every UI task): `Kpi`, `AtRiskCustomer`, `UpcomingDate`, `MetricsPayload`, `MetricsLabels`, `loadMetricOrders()`, `getMetrics(range, now, locale, labels)` with the shapes in the code below.

- [ ] **Step 1: Rewrite the storage tests to the new payload (failing)**

Replace the whole of `tests/unit/metrics-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getMetrics } from "@/lib/metrics-storage";

// 2026-10-12 15:00 New York.
const NOW = new Date("2026-10-12T19:00:00Z");
const LABELS = { customProducts: "Personalizados", unknownZone: "Sin zona" };

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

let n = 0;
function seed(p: {
  at: string; paid?: number; total?: number; source?: string; payment?: string; status?: string;
  customerId?: string | null; phone?: string; name?: string; zip?: string; lines?: unknown[];
  windowDate?: string; slot?: string; funeral?: boolean; discount?: number; promo?: string; giftCard?: number;
}) {
  n += 1;
  const address = p.zip ? JSON.stringify({ street1: "1 A", city: "X", state: "NY", zip: p.zip, country: "US" }) : null;
  getDb().prepare(
    `INSERT INTO orders (id, customer_id, locale, source, recipient_name, recipient_phone, contact_name, contact_phone,
       fulfillment_method, address_json, window_date, window_slot, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, amount_paid_cents, fulfillment_status, payment_status, funeral, discount_cents, promo_code,
       gift_card_cents, created_at, updated_at)
     VALUES (?, ?, 'es', ?, 'R', '1', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `o${n}`, p.customerId ?? null, p.source ?? "phone", p.name ?? "Ana", p.phone ?? "5165550100",
    p.zip ? "delivery" : p.windowDate ? "pickup" : "in-store", address, p.windowDate ?? null,
    p.slot ?? (p.windowDate ? "midday" : null), JSON.stringify(p.lines ?? []),
    p.total ?? p.paid ?? 10000, p.paid ?? 10000, p.status ?? "delivered", p.payment ?? "paid",
    p.funeral ? 1 : 0, p.discount ?? 0, p.promo ?? null, p.giftCard ?? null, p.at, p.at,
  );
}

describe("getMetrics", () => {
  it("compares the period with the one before, in shop time", () => {
    seed({ at: "2026-10-13T01:30:00Z", paid: 6000 }); // 9:30 pm Oct 12 NY: inside 30d
    seed({ at: "2026-10-01T15:00:00Z", paid: 4000, source: "web" });
    seed({ at: "2026-09-01T15:00:00Z", paid: 5000 }); // previous 30 days
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.today).toBe("2026-10-12");
    expect(m.kpis.revenue).toEqual({ value: 10000, delta: { kind: "pct", pct: 100 } });
    expect(m.kpis.orders).toEqual({ value: 2, delta: { kind: "pct", pct: 100 } });
    expect(m.trend.find((p) => p.key === "2026-10-12")?.revenueCents).toBe(6000);
    expect(m.sales.channels.find((c) => c.channel === "web")?.sharePct).toBe(40);
  });

  it("puts last year's same dates on the trend", () => {
    seed({ at: "2025-10-10T15:00:00Z", paid: 4000 });
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.trend.find((p) => p.key === "2026-10-10")?.prevRevenueCents).toBe(4000);
  });

  it("values custom lines for product revenue and counts pending balances", () => {
    seed({ at: "2026-10-05T15:00:00Z", lines: [{ kind: "custom", title: "Especial", priceCents: 4000, qty: 2 }] });
    seed({ at: "2026-10-06T15:00:00Z", total: 9000, paid: 2000, payment: "pending" });
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.sales.products[0]).toMatchObject({ key: "__custom__", name: "Personalizados", qty: 2, cents: 8000 });
    expect(m.kpis.pendingCount).toBe(1);
    expect(m.kpis.pendingCents).toBe(7000);
  });

  it("builds the operations tab from scheduled days", () => {
    seed({ at: "2026-10-01T15:00:00Z", windowDate: "2026-10-10", slot: "midday" });
    seed({ at: "2026-10-11T15:00:00Z", windowDate: "2026-10-17", slot: "evening" });
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.operations.heatmap.counts[5]).toEqual([0, 1, 0, 0]);
    expect(m.operations.upcoming[5]).toEqual({ date: "2026-10-17", count: 1 });
  });

  it("matches unlinked orders to their customer by phone for new vs returning", () => {
    getDb().prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
       VALUES ('cus_a', 'Ana', '5165550100', 2, '2026-03-01T15:00:00Z', '2026-10-05T15:00:00Z')`,
    ).run();
    seed({ at: "2026-03-01T15:00:00Z", customerId: "cus_a" });
    seed({ at: "2026-10-05T15:00:00Z", customerId: null }); // unlinked, same phone → returning
    seed({ at: "2026-10-06T15:00:00Z", phone: "5165550199", name: "Beto" }); // new
    const m = getMetrics("30d", NOW, "es", LABELS);
    expect(m.customers.split).toMatchObject({ newBuyers: 1, returningBuyers: 1 });
    expect(m.kpis.newCustomers.value).toBe(1);
    expect(m.customers.top.map((c) => c.name).sort()).toEqual(["Ana", "Beto"]);
  });

  it("always returns at least one insight", () => {
    expect(getMetrics("7d", NOW, "es", LABELS).insights.length).toBeGreaterThan(0);
  });
});
```

In `tests/unit/api-admin-metrics.test.ts`, replace the old payload assertions (`body.kpis.revenueCents`, `body.monthly`, `body.topProducts`) with:

```ts
  expect(body.range).toBe("90d");
  expect(body.kpis.revenue.value).toBe(6000);
  expect(Array.isArray(body.trend)).toBe(true);
  expect(Array.isArray(body.sales.products)).toBe(true);
```

and add:

```ts
it("accepts the 7-day range", async () => {
  const res = await GET(new Request("http://x/api/admin/metrics?range=7d"));
  expect((await res.json()).range).toBe("7d");
});
```

`tests/unit/metrics-house-accounts.test.ts` stays unchanged: `kpis.houseAccounts*` keep their names.

Run: `npx vitest run --root "$PWD" tests/unit/metrics-storage.test.ts tests/unit/api-admin-metrics.test.ts`
Expected: FAIL (old payload shape).

- [ ] **Step 2: Add the recipient phone to upcoming occasions**

In `lib/customer-dates-storage.ts`:
- Add `recipientPhone?: string;` to `UpcomingOccasion`, after `label?: string;`.
- In `listUpcomingOccasions`, change the query to:

```ts
      `SELECT d.id AS date_id, d.customer_id, d.kind, d.label, d.month, d.day, d.recipient_phone,
              c.name AS customer_name, c.phone
       FROM customer_important_dates d
       JOIN customers c ON c.id = d.customer_id`,
```

- Add `recipient_phone: string | null;` to the row type.
- In the mapped object, after `label: r.label ?? undefined,`, add `...(r.recipient_phone ? { recipientPhone: r.recipient_phone } : {}),`.

- [ ] **Step 3: Rewrite `lib/metrics-storage.ts`**

```ts
import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { customerStats, listCustomers } from "@/lib/customer-storage";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";
import type { DateKind } from "@/lib/customer-dates";
import { findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { PRODUCTS } from "@/data/products";
import { resolveCartLine } from "@/lib/cart-helpers";
import { receivablesSummary } from "@/lib/house-account-storage";
import { shopDateStr } from "@/lib/tv-slots";
import { byZone, type ZoneRank } from "@/lib/metrics";
import { delta, resolvePeriod, shopDay, type Delta, type MetricsRange, type Period } from "@/lib/metrics/period";
import { between, isLive, pendingPayments, periodStats, salesTrend, type MetricOrder, type TrendPoint } from "@/lib/metrics/orders";
import {
  channelShares, channelTrend, productRevenue, promoStats,
  type ChannelBucket, type ChannelShare, type LineValue, type ProductRevenue, type PromoStats,
} from "@/lib/metrics/sales";
import { peakDay, upcomingLoad, weekdaySlotHeatmap, type DayLoad, type Heatmap } from "@/lib/metrics/operations";
import { holidaysForYear, nextHoliday, weekRevenueUpTo } from "@/lib/metrics/holidays";
import { firstOrderDays, newVsReturning, topCustomers, type BuyerSplit, type TopCustomer } from "@/lib/metrics/customers";
import { buildInsights, type Insight } from "@/lib/metrics-insights";
import type { CartLine } from "@/types/order";

export type Kpi = { value: number; delta: Delta };
export type AtRiskCustomer = { id: string; name: string; phone: string; orderCount: number; ltvCents: number; lastOrderAt: string | null };
export type UpcomingDate = {
  dateId: string; customerId: string; customerName: string; phone: string;
  kind: DateKind; label?: string; recipientPhone?: string; date: string; daysUntil: number;
};

export type MetricsPayload = {
  range: MetricsRange;
  period: Period;
  today: string;
  kpis: {
    revenue: Kpi; orders: Kpi; aov: Kpi; newCustomers: Kpi;
    pendingCents: number; pendingCount: number;
    houseAccountsCents: number; houseAccountsOverdueCents: number; houseAccountsOverdueCount: number;
  };
  trend: TrendPoint[];
  insights: Insight[];
  sales: {
    channels: ChannelShare[]; channelTrend: ChannelBucket[]; products: ProductRevenue[];
    promos: PromoStats & { giftCardsIssuedCents: number }; byZone: ZoneRank[];
  };
  operations: { heatmap: Heatmap; upcoming: DayLoad[] };
  customers: { split: BuyerSplit; top: TopCustomer[]; atRisk: AtRiskCustomer[]; atRiskCount: number; upcomingDates: UpcomingDate[] };
};

export type MetricsLabels = { customProducts: string; unknownZone: string };

type Row = {
  id: string; customer_id: string | null; contact_phone: string; contact_name: string | null; source: string;
  total_cents: number; amount_paid_cents: number; payment_status: string; fulfillment_status: string;
  created_at: string; window_date: string | null; window_slot: string | null; window_time: string | null;
  lines_json: string; address_json: string | null; funeral: number; discount_cents: number | null;
  promo_code: string | null; gift_card_cents: number | null; house_account_id: string | null;
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

const last10 = (p: string | null | undefined) => (p ?? "").replace(/\D/g, "").slice(-10);

/** Every order, normalized. The shop's volume makes loading them all the simplest correct choice. */
export function loadMetricOrders(): MetricOrder[] {
  runMigrations();
  const db = getDb();
  // Orders placed before checkout linked customers still belong to someone: match them by phone.
  const byPhone = new Map(
    (db.prepare("SELECT id, phone FROM customers").all() as { id: string; phone: string }[])
      .map((c) => [last10(c.phone), c.id] as const)
      .filter(([p]) => p.length === 10),
  );
  const rows = db
    .prepare(
      `SELECT id, customer_id, contact_phone, contact_name, source, total_cents, amount_paid_cents,
              payment_status, fulfillment_status, created_at, window_date, window_slot, window_time,
              lines_json, address_json, funeral, discount_cents, promo_code, gift_card_cents, house_account_id
       FROM orders`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id ?? byPhone.get(last10(r.contact_phone)) ?? null,
    contactPhone: r.contact_phone,
    contactName: r.contact_name,
    source: r.source,
    totalCents: r.total_cents,
    amountPaidCents: r.amount_paid_cents,
    paymentStatus: r.payment_status,
    fulfillmentStatus: r.fulfillment_status,
    createdAt: r.created_at,
    day: shopDay(r.created_at),
    windowDate: r.window_date,
    windowSlot: r.window_slot,
    windowTime: r.window_time,
    linesJson: r.lines_json,
    addressZip: parseZip(r.address_json),
    funeral: r.funeral === 1,
    discountCents: r.discount_cents ?? 0,
    promoCode: r.promo_code,
    giftCardCents: r.gift_card_cents ?? 0,
    houseAccount: r.house_account_id !== null,
  }));
}

function giftCardsIssuedCents(start: string | null, end: string): number {
  const rows = getDb()
    .prepare("SELECT initial_cents, created_at FROM gift_cards WHERE status != 'void'")
    .all() as { initial_cents: number; created_at: string }[];
  return rows.reduce((s, r) => {
    const d = shopDay(r.created_at);
    return (start === null || d >= start) && d <= end ? s + r.initial_cents : s;
  }, 0);
}

function lineResolver(locale: "en" | "es", customLabel: string) {
  return (line: Record<string, unknown>): LineValue | null => {
    const qty = typeof line.qty === "number" ? line.qty : 0;
    if (line.kind === "custom") {
      const price = typeof line.priceCents === "number" ? line.priceCents : 0;
      return { key: "__custom__", name: customLabel, cents: price * qty };
    }
    if (line.kind !== "catalog" || typeof line.productId !== "string") return null;
    const resolved = resolveCartLine(line as unknown as CartLine, PRODUCTS);
    const product = resolved?.product ?? PRODUCTS.find((p) => p.id === line.productId);
    return { key: line.productId, name: product?.title[locale] ?? line.productId, cents: resolved ? resolved.lineTotalCents : 0 };
  };
}

export function getMetrics(range: MetricsRange, now: Date, locale: "en" | "es", labels: MetricsLabels): MetricsPayload {
  const today = shopDateStr(now);
  const period = resolvePeriod(range, today);
  const all = loadMetricOrders();
  const cur = between(all, period.start, period.end);
  const prev = period.prevStart && period.prevEnd ? between(all, period.prevStart, period.prevEnd) : null;

  const curStats = periodStats(cur);
  const prevStats = prev ? periodStats(prev) : null;
  const firstDays = firstOrderDays(all);
  const split = newVsReturning(cur, firstDays, period.start);
  const prevSplit = prev && period.prevStart ? newVsReturning(prev, firstDays, period.prevStart) : null;
  const pending = pendingPayments(all);
  const receivables = receivablesSummary(today);

  const channels = channelShares(cur, prev);
  const shift = channels
    .filter((c) => c.shareDeltaPts !== null && c.shareDeltaPts !== 0)
    .sort((a, b) => Math.abs(b.shareDeltaPts as number) - Math.abs(a.shareDeltaPts as number))[0];
  const heatmap = weekdaySlotHeatmap(all, period.start, period.end);
  const upcomingDates: UpcomingDate[] = listUpcomingOccasions(14, now).map((o) => ({
    dateId: o.dateId, customerId: o.customerId, customerName: o.customerName, phone: o.phone, kind: o.kind,
    ...(o.label ? { label: o.label } : {}), ...(o.recipientPhone ? { recipientPhone: o.recipientPhone } : {}),
    date: o.next.date, daysUntil: o.next.daysUntil,
  }));
  const stats = customerStats(now);
  const atRisk: AtRiskCustomer[] = listCustomers({ segment: "at_risk", sort: "ltv", limit: 10 }, now).customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, orderCount: c.metrics.orderCount, ltvCents: c.metrics.ltvCents, lastOrderAt: c.metrics.lastOrderAt,
  }));
  const holiday = nextHoliday(today);
  const lastYearHoliday = holiday
    ? holidaysForYear(Number(holiday.date.slice(0, 4)) - 1).find((h) => h.id === holiday.id)
    : undefined;
  const resolveZone = (zip: string) => {
    const z = findDeliveryZoneByZip(zip);
    return z ? { id: z.id, label: z.label[locale] } : null;
  };

  return {
    range,
    period,
    today,
    kpis: {
      revenue: { value: curStats.revenueCents, delta: delta(curStats.revenueCents, prevStats?.revenueCents ?? null) },
      orders: { value: curStats.orderCount, delta: delta(curStats.orderCount, prevStats?.orderCount ?? null) },
      aov: { value: curStats.aovCents, delta: delta(curStats.aovCents, prevStats?.aovCents ?? null) },
      newCustomers: { value: split.newBuyers, delta: delta(split.newBuyers, prevSplit?.newBuyers ?? null) },
      pendingCents: pending.cents,
      pendingCount: pending.count,
      houseAccountsCents: receivables.balanceCents,
      houseAccountsOverdueCents: receivables.overdueCents,
      houseAccountsOverdueCount: receivables.overdueCount,
    },
    trend: salesTrend(all, period),
    insights: buildInsights({
      locale,
      revenueDelta: delta(curStats.revenueCents, prevStats?.revenueCents ?? null),
      pending,
      upcomingDates7: upcomingDates.filter((d) => d.daysUntil <= 7).length,
      holiday: holiday && lastYearHoliday
        ? { id: holiday.id, daysUntil: holiday.daysUntil, lastYearCents: weekRevenueUpTo(all, lastYearHoliday.date) }
        : null,
      atRiskCount: stats.atRiskCount,
      peakDay: peakDay(heatmap),
      ordersInPeriod: curStats.orderCount,
      channelShift: shift ? { channel: shift.channel, pts: shift.shareDeltaPts as number } : null,
    }),
    sales: {
      channels,
      channelTrend: channelTrend(cur, period),
      products: productRevenue(cur, prev, lineResolver(locale, labels.customProducts)),
      promos: { ...promoStats(cur), giftCardsIssuedCents: giftCardsIssuedCents(period.start, period.end) },
      byZone: byZone(cur.filter(isLive), resolveZone, labels.unknownZone),
    },
    operations: { heatmap, upcoming: upcomingLoad(all, today) },
    customers: { split, top: topCustomers(cur), atRisk, atRiskCount: stats.atRiskCount, upcomingDates },
  };
}
```

- [ ] **Step 4: Update the API route and the page**

`app/api/admin/metrics/route.ts`: replace `import type { MetricsRange } from "@/lib/metrics";` and the `RANGES` set with:

```ts
import { METRICS_RANGES, type MetricsRange } from "@/lib/metrics/period";
// …
const RANGES = new Set<string>(METRICS_RANGES);
```

Leave the rest as it is (the default range stays `"90d"`).

`app/[locale]/admin/metrics/page.tsx`: the first load shows 30 days:

```ts
  const initial = getMetrics("30d", new Date(), locale, labels);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-storage.test.ts tests/unit/api-admin-metrics.test.ts tests/unit/metrics-house-accounts.test.ts tests/unit/customer-dates-storage.test.ts tests/unit/metrics.test.ts`
Expected: PASS. `npx tsc --noEmit -p .` should report errors only in `components/admin/metrics/MetricsView.tsx` and `tests/unit/MetricsView.test.tsx`, which Task 10 rewrites.

- [ ] **Step 6: Commit**

```bash
git add lib/metrics-storage.ts lib/customer-dates-storage.ts app/api/admin/metrics/route.ts "app/[locale]/admin/metrics/page.tsx" tests/unit/metrics-storage.test.ts tests/unit/api-admin-metrics.test.ts
git commit -m "feat(metrics): payload completo con resumen, pestañas e insights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Messages (es/en)

**Files:**
- Modify: `messages/es.json`, `messages/en.json` (`admin_metrics` namespace)

**Interfaces:**
- Produces: every `admin_metrics.*` key the UI tasks use (below).

- [ ] **Step 1: Update and add the keys with this script (preserves formatting)**

```bash
python3 - <<'EOF'
import json
UPDATE = {"range_30d": ("30 días", "30 days"), "range_90d": ("90 días", "90 days"), "range_ytd": ("Año", "Year")}
ROWS = [
  ("range_7d", "7 días", "7 days"),
  ("kpi_new_customers", "Clientes nuevos", "New customers"),
  ("kpi_pending", "Por cobrar", "To collect"),
  ("kpi_pending_sub", "{n} pendientes · cuentas {amount}", "{n} pending · accounts {amount}"),
  ("delta_vs_prev", "vs período anterior", "vs previous period"),
  ("delta_new", "nuevo", "new"),
  ("trend_title_ly", "Ventas · este año vs año pasado", "Sales · this year vs last year"),
  ("trend_this_year", "Este año", "This year"),
  ("trend_last_year", "Año pasado", "Last year"),
  ("metric_revenue", "Ingresos", "Revenue"),
  ("metric_orders", "Órdenes", "Orders"),
  ("chart_empty", "Sin ventas en este período.", "No sales in this period."),
  ("insights_title", "Lo que hay que saber", "What to know"),
  ("insight_action_view", "Ver", "View"),
  ("insight_none", "Sin novedades en este período.", "Nothing new in this period."),
  ("insight_pending", "{n} órdenes con pago pendiente ({amount}).", "{n} orders awaiting payment ({amount})."),
  ("insight_upcoming_dates", "{n} fechas importantes en los próximos 7 días.", "{n} important dates in the next 7 days."),
  ("insight_upcoming_dates_one", "1 fecha importante en los próximos 7 días.", "1 important date in the next 7 days."),
  ("insight_holiday", "{holiday} en {days} días. El año pasado esa semana vendiste {amount}.", "{holiday} is in {days} days. That week last year you sold {amount}."),
  ("insight_at_risk", "{n} clientes que compraban seguido no vuelven hace 90+ días.", "{n} regular customers haven't ordered in 90+ days."),
  ("insight_revenue_up", "Los ingresos van {pct}% arriba del período anterior.", "Revenue is up {pct}% on the previous period."),
  ("insight_revenue_down", "Los ingresos van {pct}% abajo del período anterior.", "Revenue is down {pct}% on the previous period."),
  ("insight_channel_up", "{channel} subió {pts} puntos en participación.", "{channel} gained {pts} points of share."),
  ("insight_channel_down", "{channel} bajó {pts} puntos en participación.", "{channel} lost {pts} points of share."),
  ("insight_peak_day", "El {day} es tu día más fuerte ({pct}% de las entregas).", "{day} is your busiest day ({pct}% of deliveries)."),
  ("tab_sales", "Ventas", "Sales"),
  ("tab_operations", "Operación", "Operations"),
  ("tab_customers", "Clientes", "Customers"),
  ("channels_title", "Ventas por canal", "Sales by channel"),
  ("channel_web", "Web", "Web"),
  ("channel_phone", "Teléfono", "Phone"),
  ("channel_whatsapp", "WhatsApp", "WhatsApp"),
  ("channel_walk-in", "Tienda", "Walk-in"),
  ("channel_event", "Eventos", "Events"),
  ("share_pts", "{sign}{pts} pts", "{sign}{pts} pts"),
  ("products_revenue_title", "Productos que más facturan", "Top products by revenue"),
  ("col_units", "Uds", "Units"),
  ("col_vs_prev", "vs antes", "vs before"),
  ("promos_title", "Promos y gift cards", "Promos & gift cards"),
  ("promo_discounts", "Descuentos dados", "Discounts given"),
  ("promo_orders", "Órdenes con código", "Orders with a code"),
  ("gift_issued", "Gift cards emitidas", "Gift cards issued"),
  ("gift_redeemed", "Gift cards canjeadas", "Gift cards redeemed"),
  ("funeral_share", "Funerales", "Funerals"),
  ("funeral_share_value", "{pct}% de ventas · {n} órdenes", "{pct}% of sales · {n} orders"),
  ("heatmap_title", "Entregas y recogidas por día y franja", "Deliveries & pickups by day and slot"),
  ("heatmap_peak", "El {day} es el día con más trabajo.", "{day} is the busiest day."),
  ("weekday_0", "Lun", "Mon"), ("weekday_1", "Mar", "Tue"), ("weekday_2", "Mié", "Wed"), ("weekday_3", "Jue", "Thu"),
  ("weekday_4", "Vie", "Fri"), ("weekday_5", "Sáb", "Sat"), ("weekday_6", "Dom", "Sun"),
  ("weekday_full_0", "lunes", "Monday"), ("weekday_full_1", "martes", "Tuesday"), ("weekday_full_2", "miércoles", "Wednesday"),
  ("weekday_full_3", "jueves", "Thursday"), ("weekday_full_4", "viernes", "Friday"), ("weekday_full_5", "sábado", "Saturday"),
  ("weekday_full_6", "domingo", "Sunday"),
  ("slot_morning", "Mañana", "Morning"), ("slot_midday", "Mediodía", "Midday"),
  ("slot_afternoon", "Tarde", "Afternoon"), ("slot_evening", "Noche", "Evening"),
  ("upcoming_title", "Próximos 14 días (ya agendado)", "Next 14 days (already booked)"),
  ("upcoming_count", "{count} pedidos", "{count} orders"),
  ("split_title", "Nuevos vs que repiten", "New vs returning"),
  ("split_new", "Nuevos", "New"),
  ("split_returning", "Repiten", "Returning"),
  ("split_value", "{n} clientes · {amount}", "{n} customers · {amount}"),
  ("top_customers_title", "Mejores clientes del período", "Best customers this period"),
  ("at_risk_title", "Por recuperar", "To win back"),
  ("at_risk_meta", "{n} pedidos · {amount}", "{n} orders · {amount}"),
  ("at_risk_cta", "Crear campaña", "Create campaign"),
  ("at_risk_more", "y {n} más", "and {n} more"),
  ("upcoming_dates_title", "Fechas importantes que vienen", "Upcoming important dates"),
  ("date_from", "de {name}", "from {name}"),
  ("date_in_days", "en {n} días", "in {n} days"),
  ("date_today", "hoy", "today"),
  ("new_order", "Nuevo pedido", "New order"),
  ("holiday_valentines", "San Valentín", "Valentine's Day"),
  ("holiday_mothers_day", "Día de las Madres", "Mother's Day"),
  ("holiday_halloween", "Halloween", "Halloween"),
  ("holiday_thanksgiving", "Thanksgiving", "Thanksgiving"),
  ("holiday_christmas", "Navidad", "Christmas"),
  ("kind_birthday", "Cumpleaños", "Birthday"),
  ("kind_anniversary", "Aniversario", "Anniversary"),
  ("kind_custom", "Fecha", "Date"),
]
for li, lang in enumerate(["es", "en"]):
    p = f"messages/{lang}.json"
    lines = open(p).read().split("\n")
    start = next(i for i, l in enumerate(lines) if l.strip().startswith('"admin_metrics"'))
    anchor = next(i for i in range(start, len(lines)) if lines[i].strip().startswith('"empty"'))
    for i in range(start, anchor + 1):
        for k, vals in UPDATE.items():
            if lines[i].strip().startswith(f'"{k}"'):
                ind = lines[i][: len(lines[i]) - len(lines[i].lstrip())]
                lines[i] = f'{ind}"{k}": {json.dumps(vals[li], ensure_ascii=False)},'
    ind = lines[anchor][: len(lines[anchor]) - len(lines[anchor].lstrip())]
    was_last = not lines[anchor].rstrip().endswith(",")
    if was_last:
        lines[anchor] = lines[anchor].rstrip() + ","
    new = [f'{ind}{json.dumps(k)}: {json.dumps((es, en)[li], ensure_ascii=False)},' for k, es, en in ROWS]
    if was_last:
        new[-1] = new[-1].rstrip(",")
    lines[anchor + 1 : anchor + 1] = new
    open(p, "w").write("\n".join(lines))
    def hook(pairs):
        keys = [k for k, _ in pairs]
        dup = {k for k in keys if keys.count(k) > 1}
        assert not dup, dup
        return dict(pairs)
    json.load(open(p), object_pairs_hook=hook)
print("ok")
EOF
```

- [ ] **Step 2: Verify**

Run: `npx vitest run --root "$PWD" tests/unit/i18n*.test.ts`
Expected: PASS (es/en parity). If no i18n test file exists, check that both files parse and have the same `admin_metrics` keys: `node -e "const a=require('./messages/es.json').admin_metrics,b=require('./messages/en.json').admin_metrics;console.log(Object.keys(a).filter(k=>!(k in b)),Object.keys(b).filter(k=>!(k in a)))"`, which should print `[] []`.

- [ ] **Step 3: Commit**

```bash
git add messages/es.json messages/en.json
git commit -m "feat(metrics): textos de la nueva sección de métricas (es/en)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Chart components

**Files:**
- Create: `components/admin/metrics/format.ts`, `components/admin/metrics/SalesTrendChart.tsx`, `components/admin/metrics/ChannelColumns.tsx`, `components/admin/metrics/Heatmap.tsx`, `components/admin/metrics/UpcomingLoad.tsx`
- Modify: `components/admin/metrics/KpiCard.tsx` (full rewrite, adds `delta`)
- Delete: `components/admin/metrics/Sparkline.tsx`
- Test: `tests/unit/metrics-charts.test.tsx`

**Interfaces:**
- Consumes: `TrendPoint` (Task 2), `ChannelBucket`, `ChannelShare`, `ChannelId`, `CHANNELS` (Task 3), `Heatmap`, `DayLoad` (Task 4), `Delta`, `Granularity` (Task 1), the Task 8 keys, `SLOT_ORDER` (`lib/tv-slots.ts`).
- Produces: `money(cents, compact?)`, `CHANNEL_COLOR`, `bucketLabel(key, g, locale)` (`format.ts`); `<KpiCard label value delta? sub? href? />`; `<SalesTrendChart points granularity locale />`; `<ChannelColumns buckets shares granularity locale />`; `<HeatmapGrid heatmap />` (default export of `Heatmap.tsx`); `<UpcomingLoad days locale />`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/metrics-charts.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import KpiCard from "@/components/admin/metrics/KpiCard";
import SalesTrendChart from "@/components/admin/metrics/SalesTrendChart";
import ChannelColumns from "@/components/admin/metrics/ChannelColumns";
import HeatmapGrid from "@/components/admin/metrics/Heatmap";
import UpcomingLoad from "@/components/admin/metrics/UpcomingLoad";
import { money, bucketLabel } from "@/components/admin/metrics/format";

const wrap = (ui: React.ReactNode) =>
  render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);

const points = [
  { key: "2026-08", revenueCents: 840000, orders: 60, prevRevenueCents: 710000, prevOrders: 50 },
  { key: "2026-09", revenueCents: 1020000, orders: 80, prevRevenueCents: 800000, prevOrders: 61 },
  { key: "2026-10", revenueCents: 1250000, orders: 96, prevRevenueCents: 1060000, prevOrders: 70 },
];

describe("format", () => {
  it("formats money and bucket labels", () => {
    expect(money(1248000)).toBe("$12,480");
    expect(money(1248000, true)).toBe("$12.5K");
    expect(bucketLabel("2026-10", "month", "es")).toBe("oct");
    expect(bucketLabel("2026-10-12", "day", "es")).toBe("12 oct");
  });
});

describe("KpiCard", () => {
  it("shows the delta with its direction", () => {
    wrap(<KpiCard label="Ingresos cobrados" value="$12,480" delta={{ kind: "pct", pct: 18 }} />);
    expect(screen.getByText("▲ 18%")).toBeDefined();
  });
  it("says 'nuevo' when there was nothing before", () => {
    wrap(<KpiCard label="Órdenes" value="3" delta={{ kind: "new" }} />);
    expect(screen.getByText("nuevo")).toBeDefined();
  });
});

describe("SalesTrendChart", () => {
  it("labels the last point, has a data table, and switches to orders", () => {
    wrap(<SalesTrendChart points={points} granularity="month" locale="es" />);
    expect(screen.getByText("$12.5K")).toBeDefined();
    expect(screen.getByRole("table", { name: "Ventas · este año vs año pasado" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Órdenes" }));
    expect(screen.getAllByText("96").length).toBeGreaterThan(0);
  });
  it("shows both years for the point under focus", () => {
    wrap(<SalesTrendChart points={points} granularity="month" locale="es" />);
    const plot = screen.getByRole("img", { name: "Ventas · este año vs año pasado" });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: "ArrowLeft" });
    const tip = screen.getByRole("status");
    expect(tip.textContent).toContain("$10,200");
    expect(tip.textContent).toContain("$8,000");
  });
});

describe("ChannelColumns", () => {
  it("lists every channel with its share and change in the legend", () => {
    const zero = { web: 0, phone: 0, whatsapp: 0, "walk-in": 0, event: 0 };
    wrap(
      <ChannelColumns
        granularity="month" locale="es"
        buckets={[{ key: "2026-10", ...zero, web: 600000, phone: 400000 }]}
        shares={[
          { channel: "web", cents: 600000, orders: 40, sharePct: 60, shareDeltaPts: 6 },
          { channel: "phone", cents: 400000, orders: 30, sharePct: 40, shareDeltaPts: -6 },
          { channel: "whatsapp", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
          { channel: "walk-in", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
          { channel: "event", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: null },
        ]}
      />,
    );
    expect(screen.getByText("Web 60%")).toBeDefined();
    expect(screen.getByText("+6 pts")).toBeDefined();
    expect(screen.getByText("Tienda 0%")).toBeDefined();
  });
});

describe("HeatmapGrid and UpcomingLoad", () => {
  it("prints each cell's count under weekday and slot headers", () => {
    const counts = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    counts[5][1] = 12;
    wrap(<HeatmapGrid heatmap={{ counts, total: 12 }} />);
    expect(screen.getByText("Sáb")).toBeDefined();
    expect(screen.getByText("Mediodía")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });
  it("names the busiest upcoming days", () => {
    wrap(
      <UpcomingLoad
        locale="es"
        days={Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(12 + i).padStart(2, "0")}`, count: i === 5 ? 14 : 2 }))}
      />,
    );
    expect(screen.getByText(/14 pedidos/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-charts.test.tsx`
Expected: FAIL, because the modules are not found.

- [ ] **Step 3: `format.ts` and the new `KpiCard.tsx`**

```ts
// components/admin/metrics/format.ts
import type { ChannelId } from "@/lib/metrics/sales";
import type { Granularity } from "@/lib/metrics/period";

export function money(cents: number, compact = false): string {
  const dollars = cents / 100;
  if (compact && Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
  }
  return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// Fixed per channel (validated against #FAF6F0) — never by rank.
export const CHANNEL_COLOR: Record<ChannelId, string> = {
  web: "#B8345E", phone: "#1F78C8", whatsapp: "#C9850F", "walk-in": "#1E8A5E", event: "#7A4FB0",
};

const intl = (locale: string) => (locale === "es" ? "es-ES" : "en-US");

/** Axis/tooltip label for a bucket key: "12 oct" for days and weeks, "oct" for months. */
export function bucketLabel(key: string, g: Granularity, locale: string): string {
  if (g === "month") {
    return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(intl(locale), { month: "short", timeZone: "UTC" }).replace(".", "");
  }
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(intl(locale), { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
}
```

```tsx
// components/admin/metrics/KpiCard.tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Delta } from "@/lib/metrics/period";

type Props = { label: string; value: string; delta?: Delta; sub?: string; href?: string };

function DeltaBadge({ delta }: { delta: Delta }) {
  const t = useTranslations("admin_metrics");
  if (delta.kind === "none") return null;
  if (delta.kind === "new") return <span className="text-xs font-semibold text-success">{t("delta_new")}</span>;
  if (delta.pct === 0) return <span className="text-xs text-ink/50">= 0%</span>;
  const up = delta.pct > 0;
  return <span className={`text-xs font-semibold ${up ? "text-success" : "text-error"}`}>{up ? "▲" : "▼"} {Math.abs(delta.pct)}%</span>;
}

export default function KpiCard({ label, value, delta, sub, href }: Props) {
  const t = useTranslations("admin_metrics");
  const body = (
    <>
      <div className="text-xs text-ink/60">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
        {delta && <DeltaBadge delta={delta} />}
        {delta?.kind === "pct" && <span className="text-xs text-ink/50">{t("delta_vs_prev")}</span>}
        {sub && <span className="text-xs text-ink/50">{sub}</span>}
      </div>
    </>
  );
  const cls = "block rounded-2xl bg-bone p-3.5";
  if (href) {
    return (
      <Link href={href} className={`${cls} transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge`}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
```

- [ ] **Step 4: `SalesTrendChart.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TrendPoint } from "@/lib/metrics/orders";
import type { Granularity } from "@/lib/metrics/period";
import { bucketLabel, money } from "./format";

type Props = { points: TrendPoint[]; granularity: Granularity; locale: string };
type Metric = "revenue" | "orders";

const W = 640, H = 220, L = 52, R = 16, T = 16, B = 28;
const PW = W - L - R, PH = H - T - B;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= v / 4) ?? 10;
  return Math.ceil(v / (step * mag)) * step * mag;
}

export default function SalesTrendChart({ points, granularity, locale }: Props) {
  const t = useTranslations("admin_metrics");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [active, setActive] = useState<number | null>(null);
  const title = t("trend_title_ly");
  const cur = points.map((p) => (metric === "revenue" ? p.revenueCents : p.orders));
  const prev = points.map((p) => (metric === "revenue" ? p.prevRevenueCents : p.prevOrders));
  const fmt = (v: number, compact = false) => (metric === "revenue" ? money(v, compact) : String(Math.round(v)));
  const max = niceMax(Math.max(0, ...cur, ...prev));
  const n = points.length;
  const last = n - 1;
  const x = (i: number) => (n === 1 ? L + PW / 2 : L + (PW * i) / (n - 1));
  const y = (v: number) => T + PH * (1 - v / max);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const empty = n === 0 || (cur.every((v) => v === 0) && prev.every((v) => v === 0));

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    setActive(Math.min(last, Math.max(0, Math.round(((px - L) / PW) * (n - 1)))));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-xs uppercase tracking-wide text-ink/50">{title}</div>
        <div className="ml-auto flex gap-1" role="group">
          {(["revenue", "orders"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-2.5 py-1 text-xs ${metric === m ? "bg-ink text-bone" : "border border-ink/15 hover:bg-ink/5"}`}
            >
              {t(m === "revenue" ? "metric_revenue" : "metric_orders")}
            </button>
          ))}
        </div>
      </div>
      {empty ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink/50">{t("chart_empty")}</div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={title}
            tabIndex={0}
            className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-rouge/40"
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((a) => a ?? last)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? last) - 1));
              if (e.key === "ArrowRight") setActive((a) => Math.min(last, (a ?? last) + 1));
            }}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EDE8E0" strokeWidth={1} />
                <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#6F685B">{fmt(v, true)}</text>
              </g>
            ))}
            <polygon points={`${x(0)},${y(0)} ${line(cur)} ${x(last)},${y(0)}`} fill="#B8345E" opacity={0.1} />
            <polyline points={line(prev)} fill="none" stroke="#BAB1A2" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={line(cur)} fill="none" stroke="#B8345E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              i % labelEvery === 0 || i === last ? (
                <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#6F685B">
                  {bucketLabel(p.key, granularity, locale)}
                </text>
              ) : null,
            )}
            <circle cx={x(last)} cy={y(cur[last])} r={4.5} fill="#B8345E" stroke="#FAF6F0" strokeWidth={2} />
            <text x={x(last) - 6} y={y(cur[last]) - 9} textAnchor="end" fontSize={11} fontWeight={600} fill="#0E0D0C">
              {fmt(cur[last], true)}
            </text>
            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={T} y2={y(0)} stroke="#968D7E" strokeWidth={1} />
                <circle cx={x(active)} cy={y(prev[active])} r={4.5} fill="#BAB1A2" stroke="#FAF6F0" strokeWidth={2} />
                <circle cx={x(active)} cy={y(cur[active])} r={4.5} fill="#B8345E" stroke="#FAF6F0" strokeWidth={2} />
              </g>
            )}
          </svg>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 rounded-xl border border-mute-200 bg-white px-3 py-2 text-xs shadow-sm"
              style={{ left: `${Math.min(70, (x(active) / W) * 100)}%` }}
            >
              <div className="text-ink/60">{bucketLabel(points[active].key, granularity, locale)}</div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 bg-rouge" />
                <span className="font-semibold">{fmt(cur[active])}</span>
                <span className="text-ink/50">{t("trend_this_year")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 bg-mute-300" />
                <span>{fmt(prev[active])}</span>
                <span className="text-ink/50">{t("trend_last_year")}</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-1 flex gap-4 text-xs text-ink/70">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-rouge" />{t("trend_this_year")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-mute-300" />{t("trend_last_year")}</span>
      </div>
      <table className="sr-only" aria-label={title}>
        <thead><tr><th>—</th><th>{t("trend_this_year")}</th><th>{t("trend_last_year")}</th></tr></thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.key}><td>{bucketLabel(p.key, granularity, locale)}</td><td>{fmt(cur[i])}</td><td>{fmt(prev[i])}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: `ChannelColumns.tsx`, `Heatmap.tsx`, `UpcomingLoad.tsx`**

```tsx
// components/admin/metrics/ChannelColumns.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CHANNELS, type ChannelBucket, type ChannelShare } from "@/lib/metrics/sales";
import type { Granularity } from "@/lib/metrics/period";
import { CHANNEL_COLOR, bucketLabel, money } from "./format";

type Props = { buckets: ChannelBucket[]; shares: ChannelShare[]; granularity: Granularity; locale: string };

const W = 640, H = 200, L = 52, R = 12, T = 12, B = 26;
const PW = W - L - R, PH = H - T - B, GAP = 2;

export default function ChannelColumns({ buckets, shares, granularity, locale }: Props) {
  const t = useTranslations("admin_metrics");
  const [active, setActive] = useState<number | null>(null);
  const totals = buckets.map((b) => CHANNELS.reduce((s, c) => s + b[c], 0));
  const max = Math.max(1, ...totals);
  const band = PW / Math.max(1, buckets.length);
  const bw = Math.min(24, band * 0.6);
  const h = (v: number) => (PH * v) / max;
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("channels_title")}</div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("channels_title")} className="block">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={L} x2={W - R} y1={T + PH * (1 - f)} y2={T + PH * (1 - f)} stroke="#EDE8E0" />
              <text x={L - 6} y={T + PH * (1 - f) + 3} textAnchor="end" fontSize={10} fill="#6F685B">{money(max * f, true)}</text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const cx = L + band * (i + 0.5);
            const segs = CHANNELS.filter((c) => b[c] > 0);
            let top = T + PH;
            return (
              <g
                key={b.key}
                tabIndex={0}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <rect x={cx - band / 2} y={T} width={band} height={PH} fill="transparent" />
                {segs.map((c, k) => {
                  const segH = h(b[c]);
                  const isTop = k === segs.length - 1;
                  top -= segH;
                  return (
                    <rect
                      key={c}
                      x={cx - bw / 2}
                      y={top}
                      width={bw}
                      height={Math.max(0.5, segH - (isTop ? 0 : GAP))}
                      rx={isTop ? 4 : 0}
                      fill={CHANNEL_COLOR[c]}
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  );
                })}
                {(i % labelEvery === 0 || i === buckets.length - 1) && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="#6F685B">{bucketLabel(b.key, granularity, locale)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div role="status" className="pointer-events-none absolute right-2 top-1 rounded-xl border border-mute-200 bg-white px-3 py-2 text-xs shadow-sm">
            <div className="text-ink/60">{bucketLabel(buckets[active].key, granularity, locale)} · {money(totals[active])}</div>
            {CHANNELS.filter((c) => buckets[active][c] > 0).map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3" style={{ background: CHANNEL_COLOR[c] }} />
                <span className="font-semibold">{money(buckets[active][c])}</span>
                <span className="text-ink/50">{t(`channel_${c}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
        {shares.map((s) => (
          <li key={s.channel} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_COLOR[s.channel] }} />
            <span>{t(`channel_${s.channel}`)} {s.sharePct}%</span>
            {s.shareDeltaPts !== null && s.shareDeltaPts !== 0 && (
              <span className={s.shareDeltaPts > 0 ? "text-success" : "text-error"}>
                {t("share_pts", { sign: s.shareDeltaPts > 0 ? "+" : "−", pts: Math.abs(s.shareDeltaPts) })}
              </span>
            )}
          </li>
        ))}
      </ul>
      <table className="sr-only" aria-label={t("channels_title")}>
        <tbody>
          {shares.map((s) => (
            <tr key={s.channel}><td>{t(`channel_${s.channel}`)}</td><td>{money(s.cents)}</td><td>{s.sharePct}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// components/admin/metrics/Heatmap.tsx
import { useTranslations } from "next-intl";
import { SLOT_ORDER } from "@/lib/tv-slots";
import type { Heatmap } from "@/lib/metrics/operations";

// One hue, light → dark (sequential): more orders, darker rose.
const RAMP = ["#F7E6EC", "#EFC6D3", "#E09AB1", "#CB5F84", "#B8345E"];

export default function HeatmapGrid({ heatmap }: { heatmap: Heatmap }) {
  const t = useTranslations("admin_metrics");
  const max = Math.max(1, ...heatmap.counts.flat());
  const step = (v: number) => (v === 0 ? -1 : Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 1) + 1e-9)));
  return (
    <table className="w-full border-separate text-center text-xs" style={{ borderSpacing: 2 }}>
      <thead>
        <tr>
          <th />
          {heatmap.counts.map((_, d) => <th key={d} scope="col" className="font-normal text-ink/60">{t(`weekday_${d}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {SLOT_ORDER.map((slot, s) => (
          <tr key={slot}>
            <th scope="row" className="pr-2 text-left font-normal text-ink/60">{t(`slot_${slot}`)}</th>
            {heatmap.counts.map((row, d) => {
              const k = step(row[s]);
              return (
                <td key={d} className="h-9 rounded-md" style={{ background: k < 0 ? "#EDE8E0" : RAMP[k], color: k >= 3 ? "#FFFFFF" : "#0E0D0C" }}>
                  {row[s]}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// components/admin/metrics/UpcomingLoad.tsx
import { useTranslations } from "next-intl";
import type { DayLoad } from "@/lib/metrics/operations";

export default function UpcomingLoad({ days, locale }: { days: DayLoad[]; locale: string }) {
  const t = useTranslations("admin_metrics");
  const max = Math.max(1, ...days.map((d) => d.count));
  const busy = (c: number) => c > 0 && c >= max * 0.8;
  const label = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { weekday: "short", day: "numeric", timeZone: "UTC" });
  const peaks = days.filter((d) => busy(d.count));
  return (
    <div>
      <div className="flex h-24 items-end gap-1" role="img" aria-label={t("upcoming_title")}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end" title={`${label(d.date)} · ${t("upcoming_count", { count: d.count })}`}>
            <div className="w-full max-w-6 rounded-t" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 3 : 0, background: busy(d.count) ? "#B8345E" : "#DCD5C9" }} />
          </div>
        ))}
      </div>
      {days.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] text-ink/50">
          <span>{label(days[0].date)}</span>
          <span>{label(days[days.length - 1].date)}</span>
        </div>
      )}
      {peaks.length > 0 && (
        <p className="mt-1 text-xs text-ink/70">{peaks.map((d) => `${label(d.date)}: ${t("upcoming_count", { count: d.count })}`).join(" · ")}</p>
      )}
      <table className="sr-only" aria-label={t("upcoming_title")}>
        <tbody>{days.map((d) => <tr key={d.date}><td>{label(d.date)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
```

Delete `components/admin/metrics/Sparkline.tsx`. Task 10 removes its only import (`MetricsView.tsx`). Until then the file compiles on its own, so it can go now.

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npx vitest run --root "$PWD" tests/unit/metrics-charts.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/admin/metrics tests/unit/metrics-charts.test.tsx
git commit -m "feat(metrics): gráficas de ventas, canales, mapa de calor y próximos 14 días

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The screen (`MetricsView` and tab panels)

**Files:**
- Create: `components/admin/metrics/InsightList.tsx`, `components/admin/metrics/SalesTab.tsx`, `components/admin/metrics/OperationsTab.tsx`, `components/admin/metrics/CustomersTab.tsx`
- Modify: `components/admin/metrics/MetricsView.tsx` (full rewrite). Delete `components/admin/metrics/RankTable.tsx` if nothing else imports it (`grep -rn RankTable app components`).
- Test: `tests/unit/MetricsView.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `MetricsPayload` (Task 7), the Task 9 components, the Task 8 keys, `peakDay` (Task 4), and `intakeHrefFor(locale, senderPhone, recipient: KnownRecipient)` from `components/admin/customers/RecipientList.tsx`, which only reads `recipient.phone` and `recipient.name`.
- Produces: `<MetricsView locale initial />` (same props as today) and `TabId`.

- [ ] **Step 1: Write the failing test (replaces the whole file)**

```tsx
// tests/unit/MetricsView.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import MetricsView from "@/components/admin/metrics/MetricsView";
import type { MetricsPayload } from "@/lib/metrics-storage";

afterEach(() => vi.restoreAllMocks());

const wrap = (ui: React.ReactNode) =>
  render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);

const zeroCh = { web: 0, phone: 0, whatsapp: 0, "walk-in": 0, event: 0 };
const payload: MetricsPayload = {
  range: "30d",
  period: { range: "30d", start: "2026-09-13", end: "2026-10-12", prevStart: "2026-08-14", prevEnd: "2026-09-12", granularity: "day" },
  today: "2026-10-12",
  kpis: {
    revenue: { value: 1248000, delta: { kind: "pct", pct: 18 } },
    orders: { value: 96, delta: { kind: "pct", pct: 9 } },
    aov: { value: 13000, delta: { kind: "pct", pct: 8 } },
    newCustomers: { value: 31, delta: { kind: "pct", pct: -4 } },
    pendingCents: 184000, pendingCount: 7,
    houseAccountsCents: 62000, houseAccountsOverdueCents: 0, houseAccountsOverdueCount: 0,
  },
  trend: [
    { key: "2026-10-11", revenueCents: 50000, orders: 4, prevRevenueCents: 40000, prevOrders: 3 },
    { key: "2026-10-12", revenueCents: 60000, orders: 5, prevRevenueCents: 45000, prevOrders: 4 },
  ],
  insights: [
    { id: "pending_payments", icon: "💳", key: "insight_pending", values: { n: 7, amountCents: 184000 }, refs: {}, action: { kind: "link", href: "/es/admin/dashboard/ledger" } },
    { id: "upcoming_dates", icon: "🎂", key: "insight_upcoming_dates", values: { n: 12 }, refs: {}, action: { kind: "tab", tab: "customers" } },
    { id: "holiday_ahead", icon: "📅", key: "insight_holiday", values: { days: 19, amountCents: 230000 }, refs: { holiday: "halloween" } },
  ],
  sales: {
    channels: [
      { channel: "web", cents: 600000, orders: 40, sharePct: 60, shareDeltaPts: 6 },
      { channel: "phone", cents: 400000, orders: 30, sharePct: 40, shareDeltaPts: -6 },
      { channel: "whatsapp", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
      { channel: "walk-in", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
      { channel: "event", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: null },
    ],
    channelTrend: [{ key: "2026-10-12", ...zeroCh, web: 60000 }],
    products: [{ key: "a", name: "Docena de rosas", qty: 18, cents: 171000, delta: { kind: "pct", pct: 22 } }],
    promos: { discountCents: 41000, promoOrders: 23, giftCardRedeemedCents: 54000, funeralOrders: 6, funeralSharePct: 11, giftCardsIssuedCents: 125000 },
    byZone: [{ zoneId: "albertson", label: "Albertson", orderCount: 20, cents: 210000 }],
  },
  operations: {
    heatmap: { counts: Array.from({ length: 7 }, (_, d) => (d === 5 ? [3, 12, 9, 2] : [1, 2, 1, 0])), total: 50 },
    upcoming: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(12 + i).padStart(2, "0")}`, count: i === 5 ? 14 : 3 })),
  },
  customers: {
    split: { newBuyers: 31, newCents: 524000, returningBuyers: 44, returningCents: 724000 },
    top: [{ key: "c1", customerId: "c1", name: "Ana López", cents: 64000, orders: 3 }],
    atRisk: [{ id: "c9", name: "María G.", phone: "5165550109", orderCount: 6, ltvCents: 98000, lastOrderAt: "2026-06-01T15:00:00Z" }],
    atRiskCount: 14,
    upcomingDates: [{ dateId: "d1", customerId: "c1", customerName: "Ana López", phone: "5165550100", kind: "birthday", label: "Mamá Rosa", recipientPhone: "5165550902", date: "2026-10-15", daysUntil: 3 }],
  },
};

describe("MetricsView", () => {
  it("shows the summary: KPIs with deltas, the chart and the insights", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByText("$12,480")).toBeDefined();
    expect(screen.getByText("▲ 18%")).toBeDefined();
    expect(screen.getByText("Clientes nuevos")).toBeDefined();
    expect(screen.getByText("7 órdenes con pago pendiente ($1,840).")).toBeDefined();
    expect(screen.getByText("Halloween en 19 días. El año pasado esa semana vendiste $2,300.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ver" }).getAttribute("href")).toBe("/es/admin/dashboard/ledger");
  });

  it("opens Ventas first and switches tabs", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByRole("tab", { name: "Ventas" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Docena de rosas")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Operación" }));
    expect(screen.getByText("Entregas y recogidas por día y franja")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Clientes" }));
    expect(screen.getByText("Mejores clientes del período")).toBeDefined();
    expect(screen.getByRole("link", { name: "Nuevo pedido" }).getAttribute("href")).toBe(
      "/es/admin/intake?phone=5165550100&rphone=5165550902&rname=Mam%C3%A1+Rosa",
    );
  });

  it("an insight with a tab action jumps to that tab", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    fireEvent.click(screen.getByRole("button", { name: /12 fechas importantes/ }));
    expect(screen.getByRole("tab", { name: "Clientes" }).getAttribute("aria-selected")).toBe("true");
  });

  it("reloads every section for another period", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ ...payload, range: "7d", kpis: { ...payload.kpis, orders: { value: 12, delta: { kind: "none" } } } }), { status: 200 }),
    );
    wrap(<MetricsView locale="es" initial={payload} />);
    fireEvent.click(screen.getByRole("button", { name: "7 días" }));
    await waitFor(() => expect(screen.getByText("12")).toBeDefined());
    expect(String(spy.mock.calls[0][0])).toBe("/api/admin/metrics?range=7d&locale=es");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --root "$PWD" tests/unit/MetricsView.test.tsx`
Expected: FAIL (old view).

- [ ] **Step 3: `InsightList.tsx`**

```tsx
"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Insight } from "@/lib/metrics-insights";
import { money } from "./format";

export type TabId = "sales" | "operations" | "customers";

export default function InsightList({ insights, onTab }: { insights: Insight[]; onTab: (tab: TabId) => void }) {
  const t = useTranslations("admin_metrics");
  const text = (i: Insight) => {
    const v: Record<string, string | number> = { ...i.values };
    if (typeof i.values.amountCents === "number") v.amount = money(i.values.amountCents);
    if (i.refs.holiday) v.holiday = t(`holiday_${i.refs.holiday}`);
    if (i.refs.weekday !== undefined) v.day = t(`weekday_full_${i.refs.weekday}`);
    if (i.refs.channel) v.channel = t(`channel_${i.refs.channel}`);
    return t(i.key, v);
  };
  const cls = "flex w-full items-start gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm";
  return (
    <ul className="flex flex-col gap-1.5">
      {insights.map((i) => {
        const body = (
          <>
            <span aria-hidden>{i.icon}</span>
            <span className="flex-1">{text(i)}</span>
          </>
        );
        if (i.action?.kind === "tab") {
          const tab = i.action.tab;
          return (
            <li key={i.id}>
              <button type="button" onClick={() => onTab(tab)} className={`${cls} hover:ring-1 hover:ring-rouge/30`}>
                {body}
                <span aria-hidden className="text-rouge">→</span>
              </button>
            </li>
          );
        }
        return (
          <li key={i.id} className={cls}>
            {body}
            {i.action?.kind === "link" && (
              <Link href={i.action.href} className="whitespace-nowrap text-rouge underline-offset-2 hover:underline">
                {t("insight_action_view")}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: The three tab panels**

```tsx
// components/admin/metrics/SalesTab.tsx
import { useTranslations } from "next-intl";
import type { MetricsPayload } from "@/lib/metrics-storage";
import ChannelColumns from "./ChannelColumns";
import { money } from "./format";

const box = "rounded-2xl bg-bone p-3.5";
const head = "mb-2 text-xs uppercase tracking-wide text-ink/50";

export default function SalesTab({ data, locale }: { data: MetricsPayload; locale: string }) {
  const t = useTranslations("admin_metrics");
  const s = data.sales;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={`${box} lg:col-span-2`}>
        <ChannelColumns buckets={s.channelTrend} shares={s.channels} granularity={data.period.granularity} locale={locale} />
      </div>
      <div className={box}>
        <div className={head}>{t("promos_title")}</div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
          <dt className="text-ink/70">{t("promo_discounts")}</dt><dd className="text-right font-semibold">{money(s.promos.discountCents)}</dd>
          <dt className="text-ink/70">{t("promo_orders")}</dt><dd className="text-right font-semibold">{s.promos.promoOrders}</dd>
          <dt className="text-ink/70">{t("gift_issued")}</dt><dd className="text-right font-semibold">{money(s.promos.giftCardsIssuedCents)}</dd>
          <dt className="text-ink/70">{t("gift_redeemed")}</dt><dd className="text-right font-semibold">{money(s.promos.giftCardRedeemedCents)}</dd>
          <dt className="text-ink/70">{t("funeral_share")}</dt>
          <dd className="text-right font-semibold">{t("funeral_share_value", { pct: s.promos.funeralSharePct, n: s.promos.funeralOrders })}</dd>
        </dl>
      </div>
      <div className={`${box} lg:col-span-2`}>
        <div className={head}>{t("products_revenue_title")}</div>
        {s.products.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/50">
                <th className="py-1 font-normal">{t("col_product")}</th>
                <th className="py-1 text-right font-normal">{t("col_units")}</th>
                <th className="py-1 text-right font-normal">{t("col_revenue")}</th>
                <th className="py-1 text-right font-normal">{t("col_vs_prev")}</th>
              </tr>
            </thead>
            <tbody>
              {s.products.map((p) => (
                <tr key={p.key} className="border-t border-mute-100">
                  <td className="py-1.5">{p.key === "__custom__" ? t("custom_products") : p.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.qty}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{money(p.cents)}</td>
                  <td className="py-1.5 text-right text-xs">
                    {p.delta.kind === "pct" ? (
                      <span className={p.delta.pct >= 0 ? "text-success" : "text-error"}>{p.delta.pct >= 0 ? "▲" : "▼"} {Math.abs(p.delta.pct)}%</span>
                    ) : p.delta.kind === "new" ? (
                      <span className="text-success">{t("delta_new")}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className={box}>
        <div className={head}>{t("by_zone_title")}</div>
        {s.byZone.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {s.byZone.map((z) => (
                <tr key={z.zoneId} className="border-t border-mute-100 first:border-0">
                  <td className="py-1.5">{z.label}</td>
                  <td className="py-1.5 text-right text-xs text-ink/50">{z.orderCount}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{money(z.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

```tsx
// components/admin/metrics/OperationsTab.tsx
import { useTranslations } from "next-intl";
import type { MetricsPayload } from "@/lib/metrics-storage";
import { peakDay } from "@/lib/metrics/operations";
import HeatmapGrid from "./Heatmap";
import UpcomingLoad from "./UpcomingLoad";

const box = "rounded-2xl bg-bone p-3.5";
const head = "mb-2 text-xs uppercase tracking-wide text-ink/50";

export default function OperationsTab({ data, locale }: { data: MetricsPayload; locale: string }) {
  const t = useTranslations("admin_metrics");
  const peak = peakDay(data.operations.heatmap);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={`${box} lg:col-span-2`}>
        <div className={head}>{t("heatmap_title")}</div>
        <HeatmapGrid heatmap={data.operations.heatmap} />
        {peak && <p className="mt-2 text-xs text-ink/70">{t("heatmap_peak", { day: t(`weekday_full_${peak.weekday}`) })}</p>}
      </div>
      <div className={box}>
        <div className={head}>{t("upcoming_title")}</div>
        <UpcomingLoad days={data.operations.upcoming} locale={locale} />
      </div>
    </div>
  );
}
```

```tsx
// components/admin/metrics/CustomersTab.tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MetricsPayload } from "@/lib/metrics-storage";
import { intakeHrefFor } from "@/components/admin/customers/RecipientList";
import { money } from "./format";

const box = "rounded-2xl bg-bone p-3.5";
const head = "mb-2 text-xs uppercase tracking-wide text-ink/50";
const KIND_ICON = { birthday: "🎂", anniversary: "💍", custom: "⭐" } as const;

export default function CustomersTab({ data, locale }: { data: MetricsPayload; locale: string }) {
  const t = useTranslations("admin_metrics");
  const c = data.customers;
  const total = c.split.newCents + c.split.returningCents || 1;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={box}>
        <div className={head}>{t("split_title")}</div>
        <div className="flex h-4 gap-0.5 overflow-hidden rounded">
          <div style={{ flex: c.split.newCents / total, background: "#B8345E" }} />
          <div style={{ flex: c.split.returningCents / total, background: "#BAB1A2" }} />
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rouge" />{t("split_new")}: {t("split_value", { n: c.split.newBuyers, amount: money(c.split.newCents) })}</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-mute-300" />{t("split_returning")}: {t("split_value", { n: c.split.returningBuyers, amount: money(c.split.returningCents) })}</li>
        </ul>
      </div>
      <div className={box}>
        <div className={head}>{t("top_customers_title")}</div>
        {c.top.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {c.top.map((x) => (
              <li key={x.key} className="flex justify-between gap-2">
                {x.customerId ? (
                  <Link href={`/${locale}/admin/customers/${x.customerId}`} className="truncate hover:underline">{x.name}</Link>
                ) : (
                  <span className="truncate">{x.name}</span>
                )}
                <span className="font-semibold tabular-nums">{money(x.cents)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className={box}>
        <div className={head}>{t("at_risk_title")}</div>
        {c.atRisk.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {c.atRisk.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <Link href={`/${locale}/admin/customers/${x.id}`} className="truncate hover:underline">{x.name}</Link>
                <span className="text-xs text-ink/50">{t("at_risk_meta", { n: x.orderCount, amount: money(x.ltvCents) })}</span>
              </li>
            ))}
          </ul>
        )}
        {c.atRiskCount > c.atRisk.length && <p className="mt-1 text-xs text-ink/50">{t("at_risk_more", { n: c.atRiskCount - c.atRisk.length })}</p>}
        {c.atRiskCount > 0 && (
          <Link href={`/${locale}/admin/campaigns`} className="mt-2 inline-block text-sm text-rouge hover:underline">{t("at_risk_cta")} →</Link>
        )}
      </div>
      <div className={`${box} lg:col-span-3`}>
        <div className={head}>{t("upcoming_dates_title")}</div>
        {c.upcomingDates.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-mute-100 text-sm">
            {c.upcomingDates.map((d) => (
              <li key={d.dateId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                <span aria-hidden>{KIND_ICON[d.kind]}</span>
                <span className="font-semibold">{t(`kind_${d.kind}`)}{d.label ? ` · ${d.label}` : ""}</span>
                <span className="text-ink/60">{t("date_from", { name: d.customerName })}</span>
                <span className="text-ink/60">{d.daysUntil === 0 ? t("date_today") : t("date_in_days", { n: d.daysUntil })}</span>
                <Link
                  href={intakeHrefFor(locale, d.phone, {
                    name: d.label ?? "", phone: d.recipientPhone ?? "", addresses: [], days: [],
                    orderCount: 0, lastDate: d.date, lastOrderId: "",
                  })}
                  className="ml-auto text-rouge hover:underline"
                >
                  {t("new_order")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `MetricsView.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { METRICS_RANGES, type MetricsRange } from "@/lib/metrics/period";
import type { MetricsPayload } from "@/lib/metrics-storage";
import KpiCard from "./KpiCard";
import SalesTrendChart from "./SalesTrendChart";
import InsightList, { type TabId } from "./InsightList";
import SalesTab from "./SalesTab";
import OperationsTab from "./OperationsTab";
import CustomersTab from "./CustomersTab";
import { money } from "./format";

type Props = { locale: string; initial: MetricsPayload };

const TABS: { id: TabId; key: string }[] = [
  { id: "sales", key: "tab_sales" },
  { id: "operations", key: "tab_operations" },
  { id: "customers", key: "tab_customers" },
];

export default function MetricsView({ locale, initial }: Props) {
  const t = useTranslations("admin_metrics");
  const [data, setData] = useState<MetricsPayload>(initial);
  const [range, setRange] = useState<MetricsRange>(initial.range);
  const [tab, setTab] = useState<TabId>("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function pick(r: MetricsRange) {
    setRange(r);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/metrics?range=${r}&locale=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as MetricsPayload);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function openTab(id: TabId) {
    setTab(id);
    document.getElementById("metrics-tabs")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const k = data.kpis;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
        <div className="ml-auto flex flex-wrap gap-1" role="group">
          {METRICS_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => void pick(r)}
              className={`min-h-10 rounded-full px-3.5 text-sm ${range === r ? "bg-rouge text-bone" : "border border-ink/15 bg-white hover:bg-ink/5"}`}
            >
              {t(`range_${r}`)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("empty")}</div>}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label={t("kpi_revenue")} value={money(k.revenue.value)} delta={k.revenue.delta} />
          <KpiCard label={t("kpi_orders")} value={String(k.orders.value)} delta={k.orders.delta} />
          <KpiCard label={t("kpi_aov")} value={money(k.aov.value)} delta={k.aov.delta} />
          <KpiCard label={t("kpi_new_customers")} value={String(k.newCustomers.value)} delta={k.newCustomers.delta} />
          <KpiCard
            label={t("kpi_pending")}
            value={money(k.pendingCents + k.houseAccountsCents)}
            sub={t("kpi_pending_sub", { n: k.pendingCount, amount: money(k.houseAccountsCents) })}
            href={`/${locale}/admin/accounts`}
          />
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl bg-bone p-3.5">
            <SalesTrendChart points={data.trend} granularity={data.period.granularity} locale={locale} />
          </div>
          <div className="rounded-2xl bg-bone p-3.5">
            <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("insights_title")}</div>
            <InsightList insights={data.insights} onTab={openTab} />
          </div>
        </div>

        <div id="metrics-tabs" role="tablist" aria-label={t("title")} className="mb-3 flex gap-5 border-b border-mute-200">
          {TABS.map((x) => (
            <button
              key={x.id}
              id={`tab-${x.id}`}
              role="tab"
              type="button"
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              onClick={() => setTab(x.id)}
              className={`-mb-px border-b-2 py-2 text-sm ${tab === x.id ? "border-rouge font-semibold text-ink" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t(x.key)}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "sales" && <SalesTab data={data} locale={locale} />}
          {tab === "operations" && <OperationsTab data={data} locale={locale} />}
          {tab === "customers" && <CustomersTab data={data} locale={locale} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `npx vitest run --root "$PWD" tests/unit/MetricsView.test.tsx tests/unit/metrics-charts.test.tsx && npx tsc --noEmit -p .`
Expected: PASS, and tsc reports no errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/metrics tests/unit/MetricsView.test.tsx
git commit -m "feat(metrics): nueva pantalla con resumen, insights y pestañas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verification

**Files:** none (temporary seed test deleted at the end)

- [ ] **Step 1: Full suite**

Run: `npx vitest run --root "$PWD"`
Expected: the only failures are the known pre-existing ones (`_preview`, `print-chromium`, `print-render`, `api-stripe-webhook`, plus the flaky gift-card or checkout ones). Re-run any other failure alone. If it still fails alone, fix it.

- [ ] **Step 2: Production build with a fresh database**

Run: `STRIPE_SECRET_KEY=sk_test_dummy_build_only SQLITE_FILE="$TMPDIR/metrics-build.sqlite" npm run build`
Expected: `✓ Compiled successfully` and every static page generated.

- [ ] **Step 3: Browser check with seeded data**

Copy `../../data/diva.e2e.sqlite*` into the worktree's `data/` (git-ignored). Seed it with a temporary `tests/unit/zz-seed-metrics.test.ts` and delete the file afterwards. The seed should have:
- about 80 orders across the last 14 months, spread over the 5 sources, with window dates and slots;
- some orders in the week before last Halloween;
- one pending order;
- one customer with an important date in 3 days that has a recipient phone;
- one at-risk customer (2+ orders, the last one 120 days ago).

Add a `metrics-preview` entry (port 3339) to the main checkout's `.claude/launch.json`, using `npm --prefix <worktree>`, `INTAKE_PASSWORD=test-pass` and `TWILIO_DRY_RUN=true`. Start it, log in with the test password and open `/es/admin/metrics`. Then check:
- each range button reloads the data;
- the chart tooltip shows both years;
- each tab renders;
- an upcoming date's "Nuevo pedido" opens the filled-in intake;
- the console has no errors other than the SQLite experimental warning.

The preview pane delays repaints until an interaction, so click a blank area before deciding something didn't render. Take screenshots of the summary and each tab. Then stop the server and remove the launch entry.

- [ ] **Step 4: Clean up and report**

```bash
git status --short   # only intended changes; never commit data/*.sqlite or the seed test
```
