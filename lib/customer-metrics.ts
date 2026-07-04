// Pure, DB-free customer metrics + segmentation. The threshold constants here
// are the single source of truth — the SQL predicates in customer-storage.ts
// are built from these same exports.

export const VIP_MIN_ORDERS = 5;
export const VIP_MIN_LTV_CENTS = 50_000; // $500 actually collected
export const AT_RISK_DAYS = 90;
export const RECURRING_MIN_ORDERS = 2;

export type Segment = "new" | "recurring" | "vip" | "at_risk";

export type MetricsOrder = {
  totalCents: number;
  amountPaidCents: number;
  createdAt: string; // ISO
};

export type OrderAggregate = {
  orderCount: number;
  ltvCents: number;
  paidOrderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
};

export type SeenFallback = { firstSeenAt: string; lastSeenAt: string };

export type CustomerMetrics = {
  ltvCents: number;
  orderCount: number;
  paidOrderCount: number;
  aovCents: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  segment: Segment; // primary badge (precedence: at_risk > vip > recurring > new)
  isVip: boolean;
  isAtRisk: boolean;
  isRecurring: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO cutoff for SQL at-risk predicates: last_order_at < cutoff ⇔ daysSince > AT_RISK_DAYS. */
export function atRiskCutoffIso(now: Date): string {
  return new Date(now.getTime() - AT_RISK_DAYS * DAY_MS).toISOString();
}

export function aggregateOrders(orders: MetricsOrder[]): OrderAggregate {
  let ltvCents = 0;
  let paidOrderCount = 0;
  let firstOrderAt: string | null = null;
  let lastOrderAt: string | null = null;
  for (const o of orders) {
    ltvCents += o.amountPaidCents;
    if (o.amountPaidCents > 0) paidOrderCount += 1;
    if (!firstOrderAt || o.createdAt < firstOrderAt) firstOrderAt = o.createdAt;
    if (!lastOrderAt || o.createdAt > lastOrderAt) lastOrderAt = o.createdAt;
  }
  return { orderCount: orders.length, ltvCents, paidOrderCount, firstOrderAt, lastOrderAt };
}

export function metricsFromAggregate(
  agg: OrderAggregate,
  now: Date,
  fallback?: SeenFallback,
): CustomerMetrics {
  const firstOrderAt = agg.firstOrderAt ?? fallback?.firstSeenAt ?? null;
  const lastOrderAt = agg.lastOrderAt ?? fallback?.lastSeenAt ?? null;
  const daysSinceLastOrder = lastOrderAt
    ? Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / DAY_MS)
    : null;
  const isVip = agg.orderCount >= VIP_MIN_ORDERS || agg.ltvCents >= VIP_MIN_LTV_CENTS;
  const isRecurring = agg.orderCount >= RECURRING_MIN_ORDERS;
  // At-risk compares lastOrderAt against the same ISO cutoff the SQL filter and
  // header stat use (atRiskCutoffIso), so the badge, the "At risk" filter, and
  // the at-risk count always agree — including the sub-day (90, 91) window that a
  // floored day-count comparison (daysSinceLastOrder > AT_RISK_DAYS) would split.
  const isAtRisk =
    isRecurring && lastOrderAt !== null && lastOrderAt < atRiskCutoffIso(now);
  const segment: Segment = isAtRisk ? "at_risk" : isVip ? "vip" : isRecurring ? "recurring" : "new";
  return {
    ltvCents: agg.ltvCents,
    orderCount: agg.orderCount,
    paidOrderCount: agg.paidOrderCount,
    aovCents: agg.paidOrderCount > 0 ? Math.round(agg.ltvCents / agg.paidOrderCount) : 0,
    firstOrderAt,
    lastOrderAt,
    daysSinceLastOrder,
    segment,
    isVip,
    isAtRisk,
    isRecurring,
  };
}

export function computeMetrics(
  orders: MetricsOrder[],
  now: Date,
  fallback?: SeenFallback,
): CustomerMetrics {
  return metricsFromAggregate(aggregateOrders(orders), now, fallback);
}
