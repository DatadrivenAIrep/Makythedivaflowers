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
