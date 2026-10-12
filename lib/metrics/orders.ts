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
