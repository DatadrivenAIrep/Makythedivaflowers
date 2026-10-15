import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { customerStats, listCustomers } from "@/lib/customer-storage";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";
import type { DateKind } from "@/lib/customer-dates";
import { findDeliveryZoneByZip } from "@/lib/delivery-zones";
import { getPricedProducts } from "@/lib/product-prices";
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
  const products = getPricedProducts();
  return (line: Record<string, unknown>): LineValue | null => {
    const qty = typeof line.qty === "number" ? line.qty : 0;
    if (line.kind === "custom") {
      const price = typeof line.priceCents === "number" ? line.priceCents : 0;
      return { key: "__custom__", name: customLabel, cents: price * qty };
    }
    if (line.kind !== "catalog" || typeof line.productId !== "string") return null;
    const resolved = resolveCartLine(line as unknown as CartLine, products);
    const product = resolved?.product ?? products.find((p) => p.id === line.productId);
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
      ordersInPeriod: heatmap.total, // the peak is read from deliveries, so gate it on them too
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
